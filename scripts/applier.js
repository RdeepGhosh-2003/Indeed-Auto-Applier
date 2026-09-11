/**
 * Indeed Auto-Applier - Core Crawl & Apply Engine
 * Scans Indeed job cards, parses experience, evaluates salary range,
 * triggers 'Apply with Indeed', saves company site jobs, and handles pagination.
 */

(function() {
  // CRITICAL GUARD: Only run the crawler engine in the TOP browser window.
  // Child iframes (tracking, ads, smart-apply) must NEVER scan cards or control crawl sessions.
  if (window !== window.top) {
    console.log('[Indeed Auto-Applier] Child frame detected; skipping crawler engine.');
    return;
  }

  let isRunning = false;
  let isHalted = false;
  let processedJks = new Set();
  // Load and persist processed job keys across pagination / page reloads
  async function loadProcessedJks() {
    try {
      const data = await chrome.storage.local.get(['autoApplySession']);
      const list = data?.autoApplySession?.processedJks || [];
      processedJks.clear();
      list.forEach(jk => processedJks.add(jk));
    } catch (_) {}
  }

  async function persistProcessedJk(jk) {
    processedJks.add(jk);
    try {
      const data = await chrome.storage.local.get(['autoApplySession']);
      if (data?.autoApplySession) {
        if (!data.autoApplySession.processedJks) data.autoApplySession.processedJks = [];
        if (!data.autoApplySession.processedJks.includes(jk)) {
          data.autoApplySession.processedJks.push(jk);
          await chrome.storage.local.set({ autoApplySession: data.autoApplySession });
        }
      }
    } catch (_) {}
  }


  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Human-like timing jitter (base delay +/- random milliseconds)
  function humanDelay(baseMs = 1500) {
    const jitter = Math.floor(Math.random() * 600) - 200;
    return sleep(Math.max(800, baseMs + jitter));
  }

  // Synthesize pleasant two-tone chime via Web Audio API (offline, zero assets)
  function playAudioChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (_) {}
  }

  // Floating in-page status pill
  function updateFloatingPill(text, isDone = false) {
    let pill = document.getElementById('indeed-auto-applier-pill');
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'indeed-auto-applier-pill';
      pill.innerHTML = `
        <div style="position: fixed; bottom: 20px; right: 20px; z-index: 2147483647; background: #0f172a; color: #f8fafc; border: 1px solid #3b82f6; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border-radius: 30px; padding: 8px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 10px; cursor: default;">
          <span id="pill-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981; display: inline-block;"></span>
          <span id="pill-text">${text}</span>
          <button id="pill-stop-btn" style="background: #ef4444; color: white; border: none; border-radius: 12px; padding: 4px 10px; font-size: 11px; font-weight: 700; cursor: pointer;">⏹ Stop</button>
        </div>
      `;
      document.body.appendChild(pill);
      pill.querySelector('#pill-stop-btn').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'STOP_AUTO_APPLY' });
        pill.remove();
      });
    }

    const pillText = pill.querySelector('#pill-text');
    if (pillText) pillText.textContent = text;

    if (isDone) {
      const dot = pill.querySelector('#pill-dot');
      if (dot) { dot.style.background = '#3b82f6'; dot.style.boxShadow = 'none'; }
      const btn = pill.querySelector('#pill-stop-btn');
      if (btn) {
        btn.textContent = '✕ Close';
        btn.style.background = '#475569';
        btn.onclick = () => pill.remove();
      }
    }
  }

  function removeFloatingPill() {
    const pill = document.getElementById('indeed-auto-applier-pill');
    if (pill) pill.remove();
  }

  function log(message, type = 'info') {
    console.log(`[Auto-Applier] ${message}`);
    chrome.runtime.sendMessage({ action: 'APPEND_LOG', message, logType: type }).catch(() => {});
    if (isRunning) updateFloatingPill(message.slice(0, 50));
  }

  // Helper to trigger realistic click on React elements
  function triggerClick(el) {
    if (!el) return;
    try {
      el.focus();
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      el.click();
    } catch (e) {
      el.click();
    }
  }

  // Parse salary string to { minMonthly, maxMonthly } INR
  function parseMonthlySalary(salaryStr) {
    if (!salaryStr) return null;
    const lower = salaryStr.toLowerCase().replace(/,/g, '');

    if (lower.includes('₹') || lower.includes('inr') || lower.includes('rs')) {
      const nums = lower.match(/\d+/g);
      if (!nums || nums.length === 0) return null;

      const parsedVals = nums.map(n => parseInt(n, 10)).filter(n => !isNaN(n) && n > 100);
      if (parsedVals.length === 0) return null;

      const toMonthly = (val) => {
        if (lower.includes('year') || lower.includes('lpa') || lower.includes('annum') || val > 80000) {
          return Math.round(val / 12);
        }
        if (lower.includes('month') || lower.includes('pm') || lower.includes('per month')) {
          return val;
        }
        if (lower.includes('day')) {
          return val * 22;
        }
        if (lower.includes('hour')) {
          return val * 176;
        }
        if (val >= 10000 && val <= 80000) {
          return val;
        }
        if (val > 80000) {
          return Math.round(val / 12);
        }
        return val;
      };

      const monthlyVals = parsedVals.map(toMonthly);
      const minMonthly = Math.min(...monthlyVals);
      const maxMonthly = Math.max(...monthlyVals);

      return { minMonthly, maxMonthly };
    }

    return null;
  }

  // Parse experience requirement from text (normalizes unicode dashes and whitespace)
  function parseExperienceRequirement(title, description) {
    let fullText = `${title} \n ${description}`.toLowerCase();
    fullText = fullText.replace(/[\u2010-\u2015\u2212\u2013\u2014]/g, '-');

    // 1. Fresher / 0 years indicators
    if (/\b(fresher|entry level|intern|trainee|0\s*-\s*1\s*(?:years?|yrs?)|0\s*-\s*2\s*(?:years?|yrs?)|no experience required|freshers(?:\s+are)?\s+welcome)\b/i.test(fullText)) {
      return 0;
    }

    // 2. Explicit patterns for required experience
    const expPatterns = [
      /(?:experience|exp)\s*(?:required|needed|mandatory)?\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(?:to|-|\+)?\s*(\d+(?:\.\d+)?)?\s*(?:years?|yrs?)/i,
      /(\d+(?:\.\d+)?)\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)(?:\s+(?:of\s+)?(?:relevant\s+)?experience)?/i,
      /(\d+(?:\.\d+)?)\s*\+\s*(?:years?|yrs?)(?:\s+(?:of\s+)?(?:relevant\s+)?experience)/i,
      /(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s+(?:of\s+)?(?:relevant\s+)?experience/i,
      /minimum\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i,
      /at least\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i
    ];

    for (const pat of expPatterns) {
      const match = fullText.match(pat);
      if (match && match[1]) {
        const val = parseFloat(match[1]);
        if (!isNaN(val) && val >= 0 && val <= 30) {
          return val;
        }
      }
    }

    // 3. Senior role title hints
    if (/\b(senior|sr\.|lead|manager|principal|architect|head of)\b/i.test(title)) {
      if (!/\b(executive|assistant|junior|jr\.|trainee|associate)\b/i.test(title)) {
        return 4;
      }
    }

    return null; // Unlisted
  }

  // Inspect Apply Button type in details pane
  function inspectApplyButton(detailsPane) {
    const scope = detailsPane || document;

    const allClickables = Array.from(scope.querySelectorAll('button, a, div[role="button"], input[type="button"], input[type="submit"]'))
      .filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);

    // 1. Check for "Apply with Indeed" / "Easily apply" / "Apply now" FIRST
    const indeedSelector = scope.querySelector(
      '#indeedApplyButton, button[id="indeedApplyButton"], [data-testid*="indeedApply"], [data-indeed-apply="true"], button[aria-label*="Apply with Indeed"], button[aria-label*="Easily apply"], button[aria-label*="Apply now"]'
    );

    if (indeedSelector) {
      return { type: 'indeed_apply', element: indeedSelector };
    }

    const indeedByText = allClickables.find(el => {
      const txt = (el.textContent || el.value || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase().replace(/\s+/g, ' ').trim();
      return txt.includes('apply with indeed') || aria.includes('apply with indeed') ||
             txt === 'easily apply' || aria.includes('easily apply') ||
             txt === 'apply now' || aria.includes('apply now');
    });

    if (indeedByText) {
      return { type: 'indeed_apply', element: indeedByText };
    }

    // 2. Check for "Apply on company site"
    const companySiteSelector = scope.querySelector(
      'a[aria-label*="Apply on company site" i], a[aria-label*="Apply on employer site" i], #applyButtonLinkContainer a, a[id="applyButtonLinkContainer"], [data-testid="apply-button"] a'
    );

    if (companySiteSelector) {
      const url = companySiteSelector.href || window.location.href;
      return { type: 'company_site', element: companySiteSelector, url };
    }

    const companyByText = allClickables.find(el => {
      const txt = (el.textContent || el.value || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase().replace(/\s+/g, ' ').trim();
      return txt.includes('apply on company site') || aria.includes('apply on company site') ||
             txt.includes('apply on employer site') || aria.includes('apply on employer site') ||
             txt.includes('apply on company website') ||
             txt.includes('continue to application') || aria.includes('continue to application');
    });

    if (companyByText) {
      const url = companyByText.closest('a')?.href || companyByText.querySelector('a')?.href || companyByText.href || companyByText.getAttribute('href') || window.location.href;
      return { type: 'company_site', element: companyByText, url };
    }

    return { type: 'unknown', element: null };
  }

  // Wait for right-side job description to load for the specific clicked card
  async function waitForJobDetails(card, maxWaitMs = 3500) {
    const cardTitle = (card?.querySelector('h2.jobTitle, .jobTitle, a.jcs-JobTitle')?.textContent || '').trim().toLowerCase();
    const cardJk = card?.getAttribute('data-jk') || card?.querySelector('[data-jk]')?.getAttribute('data-jk') || null;
    const start = Date.now();

    // Give Indeed's React SPA a moment to initiate the fetch/render
    await sleep(400);

    while (Date.now() - start < maxWaitMs) {
      const viewPane = document.querySelector('#jobsearch-ViewjobPaneWrapper, .jobsearch-JobComponent, div[data-testid="jobsearch-ViewjobPaneWrapper"]');
      const desc = document.querySelector('#jobDescriptionText, .jobsearch-jobDescriptionText, [data-testid="jobDescriptionText"]');

      if (desc && desc.textContent.trim().length > 30) {
        if (viewPane && cardJk) {
          const paneJk = viewPane.querySelector(`[data-jk="${cardJk}"]`) || document.querySelector(`[data-jk="${cardJk}"]`);
          if (paneJk) return desc;
        }
        if (cardTitle && viewPane) {
          const paneTitle = (viewPane.querySelector('h2[data-testid="simpler-jobTitle"], .jobsearch-JobInfoHeader-title, h1.jobTitle, h2.jobTitle')?.textContent || '').trim().toLowerCase();
          if (paneTitle && (paneTitle.includes(cardTitle.slice(0, 15)) || cardTitle.includes(paneTitle.slice(0, 15)))) {
            return desc;
          }
        }
        if (Date.now() - start > 800) {
          return desc;
        }
      }
      await sleep(200);
    }
    return document.querySelector('#jobDescriptionText, .jobsearch-jobDescriptionText, [data-testid="jobDescriptionText"]');
  }

  // Execute Indeed Apply wizard flow with cross-frame coordination
  async function executeIndeedApplication(profile, settings) {
    log('Waiting for application wizard modal/frame to load...', 'info');
    await sleep(2500);

    const maxSteps = 12;
    let stepCount = 0;
    let consecutiveStuckSteps = 0;

    while (stepCount < maxSteps) {
      if (isHalted) return { success: false, reason: 'halted' };
      stepCount++;

      let handled = false;

      // 1. Try local window.top execution first (if modal is in parent DOM)
      try {
        const localContainer = window.SpeedFillMatcher?.getAppContainer() || document.querySelector('[data-testid="ia-container"], #ia-container, div[role="dialog"]');
        if (localContainer && window.IndeedAutoFormFiller) {
          if (window.IndeedAutoFormFiller.checkCaptcha()) {
            playAudioChime();
            log('⚠️ CAPTCHA detected on application! Pausing for user verification...', 'warning');
            while (window.IndeedAutoFormFiller.checkCaptcha() && !isHalted) {
              await sleep(2000);
            }
          }

          if (window.IndeedAutoFormFiller.isApplicationSubmitted(localContainer)) {
            log('🎉 Confirmation detected: Application has been submitted!', 'success');
            await sleep(1500);
            window.IndeedAutoFormFiller.closeModal();
            return { success: true };
          }

          const fillRes = window.IndeedAutoFormFiller.fillCurrentStep(profile);
          log(`Step ${stepCount}: Auto-filled ${fillRes?.filled || 0} fields.`, 'info');
          await humanDelay(settings?.stepDelayMs || 1200);

          const advRes = await window.IndeedAutoFormFiller.advanceOrSubmit(localContainer);
          if (advRes?.action === 'submitted') {
            log('Clicked Submit Application button!', 'info');
            await sleep(3000);
            if (window.IndeedAutoFormFiller.isApplicationSubmitted(localContainer)) {
              window.IndeedAutoFormFiller.closeModal();
              return { success: true };
            }
            handled = true;
          } else if (advRes?.action === 'advanced') {
            log('Advanced to next step...', 'info');
            await sleep(2000);
            handled = true;
          }
        }
      } catch (localErr) {
        console.warn('[Auto-Applier] Local wizard step error:', localErr);
      }

      // 2. If not handled locally, broadcast to active application subframes (e.g. smart-apply iframe)
      if (!handled) {
        try {
          const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage({
              action: 'FORWARD_TO_ACTIVE_TAB',
              message: { action: 'IA_FILL_AND_ADVANCE', profile, settings }
            }, (resp) => {
              if (chrome.runtime.lastError) resolve(null);
              else resolve(resp);
            });
            setTimeout(() => resolve(null), 4000);
          });

          if (response && response.handled) {
            if (response.action === 'submitted') {
              log('🎉 Application submitted in application frame!', 'success');
              return { success: true };
            } else if (response.action === 'captcha_detected') {
              playAudioChime();
              log('⚠️ CAPTCHA detected in application frame! Pausing...', 'warning');
              await sleep(5000);
              handled = true;
            } else if (response.action === 'advanced') {
              log(`Step ${stepCount}: Auto-filled ${response.filled || 0} fields & advanced in application frame.`, 'info');
              await sleep(2000);
              handled = true;
            }
          }
        } catch (frameErr) {
          console.warn('[Auto-Applier] Frame messaging error:', frameErr);
        }
      }

      // 3. Inspect iframes directly for submission confirmation
      const iframes = Array.from(document.querySelectorAll('iframe[name*="indeedapply"], iframe[id*="indeedapply"], iframe[src*="smartapply"], iframe[src*="indeedapply"], div[role="dialog"] iframe'));
      for (const iframe of iframes) {
        try {
          const idoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (idoc && idoc.body) {
            const subSubmitted = idoc.querySelector('.ia-Confirmation, [data-testid="ia-Confirmation"], [data-testid*="success"]');
            if (subSubmitted || idoc.body.innerText.toLowerCase().includes('application submitted')) {
              log('🎉 Confirmation detected in iframe: Application submitted!', 'success');
              return { success: true };
            }
          }
        } catch (_) {}
      }

      if (window.IndeedAutoFormFiller?.isApplicationSubmitted()) {
        window.IndeedAutoFormFiller.closeModal();
        return { success: true };
      }

      if (handled) {
        consecutiveStuckSteps = 0;
      } else {
        consecutiveStuckSteps++;
        if (consecutiveStuckSteps === 2) {
          log('⚠️ Wizard waiting for input: please review any required fields...', 'warning');
        }
        if (consecutiveStuckSteps >= 4) {
          log('⚠️ Wizard could not advance past current step. Closing modal to proceed with remaining jobs.', 'warning');
          window.IndeedAutoFormFiller?.closeModal();
          return { success: false, reason: 'unresolved_fields' };
        }
        await sleep(2000);
      }
    }

    if (window.IndeedAutoFormFiller?.isApplicationSubmitted()) {
      window.IndeedAutoFormFiller.closeModal();
      return { success: true };
    }

    window.IndeedAutoFormFiller?.closeModal();
    return { success: false, reason: 'max_steps_exceeded' };
  }

  // Process a single job card
  async function processJobCard(card, profile, settings) {
    if (isHalted) return 'halted';

    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const originalBorder = card.style.border;
    card.style.border = '2px solid #2557a7';
    card.style.borderRadius = '8px';

    const jk = card.getAttribute('data-jk') || card.querySelector('[data-jk]')?.getAttribute('data-jk') ||
               card.querySelector('a[id^="job_"]')?.id?.replace('job_', '') ||
               `job_${Date.now()}`;

    if (processedJks.has(jk)) {
      card.style.border = originalBorder;
      return 'already_processed';
    }
    await persistProcessedJk(jk);

    chrome.runtime.sendMessage({ action: 'UPDATE_STATS', delta: { scanned: 1 } }).catch(() => {});

    // Click card to open right-side details
    const clickable = card.querySelector('h2.jobTitle a, a.jcs-JobTitle, a[data-jk], h2 a') || card;
    triggerClick(clickable);

    // Wait for details pane to load
    const descEl = await waitForJobDetails(card, 3500);

    const viewPane = document.querySelector('#jobsearch-ViewjobPaneWrapper, .jobsearch-JobComponent, div[data-testid="jobsearch-ViewjobPaneWrapper"], #vjs-container');
    const scope = viewPane || document;

    const titleEl = scope.querySelector('h2[data-testid="simpler-jobTitle"], .jobsearch-JobInfoHeader-title, h1.jobTitle, h2.jobTitle, [data-testid="jobsearch-JobInfoHeader-title"]') || card.querySelector('h2.jobTitle, .jobTitle, a.jcs-JobTitle');
    const companyEl = scope.querySelector('div[data-testid="inlineHeader-companyName"], [data-company-name="true"], [data-testid="company-name"], .companyName') || card.querySelector('[data-testid="company-name"], span[data-testid="company-name"], .companyName');
    const locationEl = scope.querySelector('div[data-testid="inlineHeader-companyLocation"], [data-testid="text-location"], .companyLocation') || card.querySelector('[data-testid="text-location"], div[data-testid="text-location"], .companyLocation');
    const salaryEl = scope.querySelector('div[data-testid="attribute_snippet_testid"], div[data-testid="job-salary-snippet"], #salaryInfoAndJobType, .salary-snippet-container, [data-testid*="salary" i]') || card.querySelector('.salary-snippet-container, [data-testid="attribute_snippet_testid"], [data-testid="job-salary-snippet"], [data-testid*="salary" i]');

    const jobTitle = titleEl ? titleEl.textContent.trim() : 'Unknown Role';
    const company = companyEl ? companyEl.textContent.trim() : 'Unknown Company';
    const location = locationEl ? locationEl.textContent.trim() : 'Unknown Location';
    const salaryText = salaryEl ? salaryEl.textContent.trim() : '';
    
    // Read the ENTIRE job details pane (captures tags like Fresher, full description, etc. regardless of scroll position)
    const paneText = viewPane ? (viewPane.innerText || viewPane.textContent || '') : '';
    const descText = descEl ? (descEl.innerText || descEl.textContent || '') : '';
    const description = `${paneText}\n${descText}`.trim();
    const jobUrl = window.location.href;

    log(`🔍 Inspecting: "${jobTitle}" at "${company}" (${location})`, 'info');

    // 0. Blocked Companies / Agency Check
    const blockedCompaniesStr = settings?.blockedCompanies || '';
    if (blockedCompaniesStr) {
      const blockedTokens = blockedCompaniesStr.toLowerCase().split(/[,|]/).map(t => t.trim()).filter(t => t.length > 1);
      const compLower = company.toLowerCase();
      const matchedBlocked = blockedTokens.find(token => compLower.includes(token));
      if (matchedBlocked) {
        log(`⏭️ Skipped: "${jobTitle}" at "${company}" matches blocked company filter ("${matchedBlocked}").`, 'info');
        chrome.runtime.sendMessage({ action: 'UPDATE_STATS', delta: { skipped: 1, reason: 'company' } }).catch(() => {});
        card.style.border = originalBorder;
        return 'skipped_company';
      }
    }

    // 0.1 Blacklist / Negative Keywords Check (Word-boundary matching prevents false positives like "internet" or "internal")
    const blacklistStr = settings?.blacklistKeywords || 'intern, unpaid, bpo, telecaller, faculty, teaching, night shift';
    const blacklistTokens = blacklistStr.toLowerCase().split(/[,|]/).map(t => t.trim()).filter(t => t.length > 1);
    const fullTextLower = `${jobTitle} \n ${description}`.toLowerCase();

    function escapeRegex(str) {
      return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    const matchedBlacklist = blacklistTokens.find(token => {
      if (!token) return false;
      let regex;
      if (token === 'intern') {
        regex = /\b(?:intern|interns|internship|internships)\b/i;
      } else {
        regex = new RegExp(`\\b${escapeRegex(token)}\\b`, 'i');
      }
      return regex.test(fullTextLower);
    });

    if (matchedBlacklist) {
      log(`⏭️ Skipped: "${jobTitle}" matches blacklist keyword "${matchedBlacklist}".`, 'info');
      chrome.runtime.sendMessage({ action: 'UPDATE_STATS', delta: { skipped: 1, reason: 'blacklist' } }).catch(() => {});
      card.style.border = originalBorder;
      return 'skipped_blacklist';
    }

    // 0.2 Strict Location Filter (Target City + Remote Only)
    if (settings?.strictLocation !== false) {
      const locLower = location.toLowerCase();
      const rawTarget = (settings?.targetLocation || '').toLowerCase().trim();
      const targetTokens = rawTarget.split(/[,|]/).map(t => t.trim()).filter(t => t.length > 2);
      const isRemote = locLower.includes('remote') || fullTextLower.includes('remote') || fullTextLower.includes('work from home');
      
      let isCityMatch = targetTokens.length === 0;
      if (!isCityMatch) {
        // If target location is India / countrywide, all jobs on in.indeed.com are within target location!
        if (targetTokens.includes('india') || rawTarget === 'india' || rawTarget === 'all india') {
          isCityMatch = true;
        } else {
          isCityMatch = targetTokens.some(t => {
            if (t === 'bangalore' || t === 'bengaluru') {
              return locLower.includes('bangalore') || locLower.includes('bengaluru');
            }
            if (t === 'delhi' || t === 'ncr' || t === 'gurgaon' || t === 'gurugram' || t === 'noida') {
              return locLower.includes('delhi') || locLower.includes('ncr') || locLower.includes('gurgaon') || locLower.includes('gurugram') || locLower.includes('noida');
            }
            return locLower.includes(t);
          });
        }
      }

      if (!isRemote && !isCityMatch) {
        log(`⏭️ Skipped: "${jobTitle}" at "${location}" is outside target location and not Remote.`, 'info');
        chrome.runtime.sendMessage({ action: 'UPDATE_STATS', delta: { skipped: 1, reason: 'location' } }).catch(() => {});
        card.style.border = originalBorder;
        return 'skipped_location';
      }
    }


    // 1. Salary Check: if job provides salary, only skip if even its UPPER limit is below our floor
    const minSalaryFloor = settings?.minMonthlySalary !== undefined ? settings.minMonthlySalary : 25000;
    const sal = parseMonthlySalary(salaryText);
    if (sal) {
      if (sal.maxMonthly < minSalaryFloor) {
        log(`⏭️ Skipped: "${jobTitle}" salary range (₹${sal.minMonthly.toLocaleString()} - ₹${sal.maxMonthly.toLocaleString()}/mo) below ₹${minSalaryFloor.toLocaleString()} floor.`, 'info');
        chrome.runtime.sendMessage({ action: 'UPDATE_STATS', delta: { skipped: 1, reason: 'salary' } }).catch(() => {});
        card.style.border = originalBorder;
        return 'skipped_salary';
      }
    }

    // 2. Experience Check
    const userExp = settings?.userYearsExp !== undefined ? settings.userYearsExp : 1;
    const reqExp = parseExperienceRequirement(jobTitle, description);

    // If experience is explicitly required and exceeds user experience -> SKIP!
    if (reqExp !== null && reqExp > userExp) {
      log(`⏭️ Skipped: "${jobTitle}" requires ${reqExp}+ years of experience (Your profile: ${userExp} yr).`, 'info');
      chrome.runtime.sendMessage({ action: 'UPDATE_STATS', delta: { skipped: 1, reason: 'experience' } }).catch(() => {});
      card.style.border = originalBorder;
      return 'skipped_experience';
    }

    // If experience is unlisted and user explicitly requested to skip
    if (reqExp === null && settings?.unlistedExpAction === 'skip') {
      log(`⏭️ Skipped: "${jobTitle}" has no experience requirement listed (Policy: Skip).`, 'info');
      chrome.runtime.sendMessage({ action: 'UPDATE_STATS', delta: { skipped: 1, reason: 'experience' } }).catch(() => {});
      card.style.border = originalBorder;
      return 'skipped_unlisted_exp';
    }

    // 3. Seniority Check
    if (/\b(senior|sr\.|lead|manager|principal|architect|director|head of)\b/i.test(jobTitle) &&
        !/\b(executive|assistant|junior|jr\.|trainee|associate)\b/i.test(jobTitle)) {
      log(`⏭️ Skipped: "${jobTitle}" is a senior/managerial role.`, 'info');
      chrome.runtime.sendMessage({ action: 'UPDATE_STATS', delta: { skipped: 1, reason: 'senior' } }).catch(() => {});
      card.style.border = originalBorder;
      return 'skipped_senior';
    }

    // 4. Criteria matches! Inspect apply button
    log(`🎯 Criteria matched for "${jobTitle}"! Checking apply type...`, 'success');

    const applyInfo = inspectApplyButton(viewPane);

    // Subcase A: "Apply with Indeed" -> AUTO-APPLY (or save if user specifically asked to review unlisted exp)
    if (applyInfo.type === 'indeed_apply') {
      if (reqExp === null && settings?.unlistedExpAction === 'save') {
        log(`📋 Experience unlisted: Saving "${jobTitle}" for manual review as configured.`, 'info');
        chrome.runtime.sendMessage({
          action: 'SAVE_JOB',
          job: { jk, title: jobTitle, company, location, salary: salaryText, url: jobUrl, reason: 'Unlisted Experience (Manual Review)' }
        }).catch(() => {});
        card.style.border = originalBorder;
        return 'saved_unlisted_exp';
      }

      log(`🚀 "Apply with Indeed" found! Triggering application for "${jobTitle}"...`, 'info');
      triggerClick(applyInfo.element);

      const result = await executeIndeedApplication(profile, settings);
      if (result.success) {
        chrome.runtime.sendMessage({
          action: 'JOB_APPLIED',
          job: { jk, title: jobTitle, company, location, salary: salaryText, url: jobUrl }
        }).catch(() => {});
      } else {
        const failDetail = result.reason === 'unresolved_fields' ? 'Unresolved Questions' :
                           result.reason === 'max_steps_exceeded' ? 'Multi-Step Limit' :
                           (result.reason || 'Manual Review');
        log(`⚠️ Could not auto-complete application for "${jobTitle}" (${failDetail}).`, 'warning');
        log(`📋 Auto-saving to "Saved Jobs" for manual completion so opportunity is not lost!`, 'info');
        chrome.runtime.sendMessage({
          action: 'SAVE_JOB',
          job: {
            jk,
            title: jobTitle,
            company,
            location,
            salary: salaryText,
            url: jobUrl,
            reason: `⚠️ Incomplete: ${failDetail}`
          }
        }).catch(() => {});
      }
      card.style.border = originalBorder;
      return result.success ? 'applied' : 'saved_incomplete';
    }

    // Subcase B: "Apply on Company Site" -> SAVE ONLY BECAUSE CRITERIA FITS (or skip if easyApplyOnly)
    if (applyInfo.type === 'company_site') {
      if (settings?.easyApplyOnly) {
        log(`⏭️ Skipped: "${jobTitle}" requires application on external company site (Easy Apply Only mode active).`, 'info');
        chrome.runtime.sendMessage({ action: 'UPDATE_STATS', delta: { skipped: 1, reason: 'easy_apply' } }).catch(() => {});
        card.style.border = originalBorder;
        return 'skipped_external';
      }
      log(`📋 Criteria matched! Saving company site job: "${jobTitle}" at "${company}".`, 'info');
      chrome.runtime.sendMessage({
        action: 'SAVE_JOB',
        job: { jk, title: jobTitle, company, location, salary: salaryText, url: applyInfo.url || jobUrl, reason: 'Criteria Matched (Company Site)' }
      }).catch(() => {});
      card.style.border = originalBorder;
      return 'saved_company_site';
    }

    // Subcase C: Unrecognized / expired apply button -> SKIP (do not keep saving unknown jobs)
    log(`⏭️ Skipped: Unrecognized or inactive apply button for "${jobTitle}".`, 'info');
    chrome.runtime.sendMessage({ action: 'UPDATE_STATS', delta: { skipped: 1, reason: 'unrecognized' } }).catch(() => {});
    card.style.border = originalBorder;
    return 'skipped_unrecognized';
  }

  async function navigateToNextPage() {
    log('Searching for Next Page of job results...', 'info');
    const nextBtn = document.querySelector(
      'a[data-testid="pagination-page-next"], button[data-testid="pagination-page-next"], [data-testid="pagination-page-next"], nav[role="navigation"] a[aria-label*="Next" i], nav[role="navigation"] button[aria-label*="Next" i], a[aria-label="Next Page"], button[aria-label="Next Page"], a[aria-label="Next"], button[aria-label="Next"], a.pn[aria-label*="Next" i]'
    );

    if (nextBtn) {
      if (nextBtn.disabled || nextBtn.getAttribute('aria-disabled') === 'true' || nextBtn.classList.contains('disabled')) {
        log('Reached the last page of job results.', 'info');
        return false;
      }

      log('Navigating to next page of results...', 'info');
      if (nextBtn.tagName === 'A' && nextBtn.href && !nextBtn.href.startsWith('javascript:')) {
        window.location.href = nextBtn.href;
      } else {
        triggerClick(nextBtn);
      }
      await sleep(4000);
      return true;
    }
    return false;
  }

  async function runCrawlLoop() {
    if (isRunning) return;

    // Guard: Verify this tab is the single designated session tab (prevents multi-tab clashing)
    try {
      const auth = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'CHECK_CRAWLER_TAB' }, resp => {
          if (chrome.runtime.lastError) resolve({ isAllowed: false });
          else resolve(resp);
        });
        setTimeout(() => resolve({ isAllowed: false }), 2500);
      });
      if (!auth || !auth.isAllowed) {
        console.log('[Indeed Auto-Applier] Tab is not the active session tab. Crawler will remain idle.');
        return;
      }
    } catch (_) {
      return;
    }

    isRunning = true;
    isHalted = false;

    log('Starting Auto-Applier crawler loop...', 'info');
    await loadProcessedJks();

    try {
      const data = await chrome.storage.local.get(['userProfile', 'autoApplySession']);
      const profile = data.userProfile || {};
      const session = data.autoApplySession || {};
      const settings = session.settings || profile.autoApplierSettings || {};
      const maxJobs = settings.maxJobsPerSession || 25;

      while (!isHalted) {
        const currentData = await chrome.storage.local.get(['autoApplySession']);
        const currentStats = currentData.autoApplySession?.stats || { scanned: 0, applied: 0, saved: 0, skipped: 0 };
        const totalProcessed = (currentStats.applied || 0) + (currentStats.saved || 0);

        if (totalProcessed >= maxJobs || currentStats.scanned >= (maxJobs * 3)) {
          log(`🎯 Session goal reached (${totalProcessed} jobs processed).`, 'success');
          chrome.runtime.sendMessage({ action: 'SESSION_COMPLETED', summary: currentStats }).catch(() => {});
          updateFloatingPill('🎉 Completed 25 jobs!', true);
          break;
        }

        const rawCards = Array.from(document.querySelectorAll(
          'div.job_seen_beacon, div.cardOutline, div[data-testid="slider_item"], td.resultContent, li:has([data-jk]), div[data-jk]'
        )).filter(c => c.offsetWidth > 0 && c.offsetHeight > 0);

        // Deduplicate cards by job key so nested elements do not cause redundant processing
        const seenJksThisLoop = new Set();
        const cards = [];
        for (const c of rawCards) {
          const jk = c.getAttribute('data-jk') || c.querySelector('[data-jk]')?.getAttribute('data-jk') ||
                     c.querySelector('a[id^="job_"]')?.id?.replace('job_', '') ||
                     c.querySelector('a[data-jk]')?.getAttribute('data-jk') || null;
          if (jk) {
            if (!seenJksThisLoop.has(jk)) {
              seenJksThisLoop.add(jk);
              cards.push(c);
            }
          } else {
            cards.push(c);
          }
        }

        if (cards.length === 0) {
          log('No job cards found on page. Waiting for page load...', 'warning');
          await sleep(3000);
          continue;
        }

        let processedAnyOnPage = false;

        for (const card of cards) {
          if (isHalted) break;

          const freshData = await chrome.storage.local.get(['autoApplySession']);
          if (!freshData.autoApplySession?.isRunning) {
            isHalted = true;
            break;
          }

          const freshStats = freshData.autoApplySession?.stats || {};
          if ((freshStats.applied || 0) + (freshStats.saved || 0) >= maxJobs) {
            isHalted = true;
            break;
          }

          try {
            const status = await processJobCard(card, profile, settings);
            if (status !== 'already_processed') {
              processedAnyOnPage = true;
              await humanDelay(settings.stepDelayMs || 1500);
            }
          } catch (cardErr) {
            log(`⚠️ Error evaluating card: ${cardErr.message}. Skipping to next job...`, 'warning');
            chrome.runtime.sendMessage({ action: 'UPDATE_STATS', delta: { skipped: 1, reason: 'unrecognized' } }).catch(() => {});
            try { card.style.border = ''; } catch (_) {}
          }
        }

        if (isHalted) break;

        const hasNext = await navigateToNextPage();
        if (!hasNext) {
          log('No further pages found for current search query.', 'info');
          const finalData = await chrome.storage.local.get(['autoApplySession']);
          chrome.runtime.sendMessage({ action: 'QUERY_RESULTS_FINISHED', summary: finalData.autoApplySession?.stats }).catch(() => {});
          break;
        }
      }
    } catch (err) {
      log(`Error in crawl loop: ${err.message}`, 'error');
    } finally {
      isRunning = false;
      log('Auto-Applier crawler stopped.', 'info');
    }
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'HALT_SESSION') {
      isHalted = true;
      isRunning = false;
      removeFloatingPill();
      log('Session halted by user request.', 'warning');
      sendResponse({ status: 'halted' });
      return true;
    }
    if (request.action === 'PLAY_ALERT_CHIME') {
      playAudioChime();
      sendResponse({ status: 'played' });
      return true;
    }
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.autoApplySession) {
      const newSession = changes.autoApplySession.newValue;
      if (newSession && newSession.isRunning && !isRunning) {
        runCrawlLoop();
      } else if (newSession && !newSession.isRunning && isRunning) {
        isHalted = true;
      }
    }
  });

  chrome.storage.local.get(['autoApplySession'], (res) => {
    if (res?.autoApplySession?.isRunning) {
      log('Resuming active auto-apply session on page load...', 'info');
      setTimeout(runCrawlLoop, 2000);
    }
  });

  console.log('[Indeed Auto-Applier] Core applier engine loaded.');
})();
