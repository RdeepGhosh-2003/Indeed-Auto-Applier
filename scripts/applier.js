/**
 * Indeed Auto-Applier - Core Crawl & Apply Engine
 * Scans Indeed job cards, parses experience, evaluates salary, triggers auto-apply,
 * saves company website jobs, and handles pagination.
 */

(function() {
  let isRunning = false;
  let isHalted = false;
  let processedJks = new Set();
  let currentSession = null;
  let activeCardIndex = 0;

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function log(message, type = 'info') {
    console.log(`[Auto-Applier] ${message}`);
    chrome.runtime.sendMessage({ action: 'APPEND_LOG', message, logType: type }).catch(() => {});
  }

  function parseMonthlySalary(salaryStr) {
    if (!salaryStr) return null;
    const lower = salaryStr.toLowerCase().replace(/,/g, '');

    if (lower.includes('₹') || lower.includes('inr') || lower.includes('rs')) {
      const nums = lower.match(/\\d+/g);
      if (!nums || nums.length === 0) return null;

      const val = parseInt(nums[0], 10);
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
    }

    return null;
  }

  function parseExperienceRequirement(title, description) {
    const fullText = `${title} \\n ${description}`.toLowerCase();

    if (/\\b(fresher|entry level|intern|trainee|0\\s*-\\s*1|0\\s*-\\s*2|no experience required)\\b/i.test(fullText)) {
      return 0;
    }

    const patterns = [
      /(\\d+(?:\\.\\d+)?)\\s*(?:to|-|\\+)?\\s*(?:\\d+(?:\\.\\d+)?)?\\s*(?:years?|yrs?)(?:\\s+of\\s+experience)?/i,
      /experience\\s*(?:required|needed)?\\s*:\\s*(\\d+(?:\\.\\d+)?)/i,
      /minimum\\s*(\\d+(?:\\.\\d+)?)\\s*(?:years?|yrs?)/i,
      /at least\\s*(\\d+(?:\\.\\d+)?)\\s*(?:years?|yrs?)/i,
      /(\\d+)\\+?\\s*years?/i
    ];

    for (const pat of patterns) {
      const match = fullText.match(pat);
      if (match && match[1]) {
        const val = parseFloat(match[1]);
        if (!isNaN(val) && val >= 0 && val <= 30) {
          return val;
        }
      }
    }

    if (/\\b(senior|sr\\.|lead|manager|principal|architect|head of)\\b/i.test(title)) {
      return 4;
    }

    return null;
  }

  function inspectApplyButton(detailsPane) {
    const scope = detailsPane || document;

    const companySiteBtn = scope.querySelector(
      'a[aria-label*="Apply on company site"], a[aria-label*="Apply on employer site"], a[id="applyButtonLinkContainer"], a[href*="apply"]'
    );
    const allLinks = Array.from(scope.querySelectorAll('a, button'));
    const isCompanySite = companySiteBtn || allLinks.some(el => {
      const txt = (el.textContent || '').toLowerCase().trim();
      return txt.includes('apply on company site') || txt.includes('apply on employer site');
    });

    if (isCompanySite) {
      const url = companySiteBtn ? companySiteBtn.href : window.location.href;
      return { type: 'company_site', element: companySiteBtn, url };
    }

    const indeedApplyBtn = scope.querySelector(
      'button[id="indeedApplyButton"], button[aria-label*="Apply now"], button[aria-label*="Easily apply"], #indeedApplyButton'
    ) || allLinks.find(el => {
      const txt = (el.textContent || '').toLowerCase().trim();
      return txt === 'apply now' || txt === 'easily apply' || txt.includes('apply with indeed');
    });

    if (indeedApplyBtn) {
      return { type: 'indeed_apply', element: indeedApplyBtn };
    }

    return { type: 'unknown', element: null };
  }

  async function executeIndeedApplication(profile, settings) {
    log('Waiting for application wizard modal to open...', 'info');
    await sleep(2000);

    const maxSteps = 12;
    let stepCount = 0;

    while (stepCount < maxSteps) {
      if (isHalted) return { success: false, reason: 'halted' };
      stepCount++;

      if (window.IndeedAutoFormFiller?.checkCaptcha()) {
        log('⚠️ CAPTCHA detected on application! Pausing for user verification...', 'warning');
        while (window.IndeedAutoFormFiller?.checkCaptcha() && !isHalted) {
          await sleep(2000);
        }
        log('✅ CAPTCHA cleared, resuming application flow...', 'info');
      }

      if (window.IndeedAutoFormFiller?.isApplicationSubmitted()) {
        log('🎉 Confirmation detected: Application has been submitted!', 'success');
        await sleep(1500);
        window.IndeedAutoFormFiller?.closeModal();
        return { success: true };
      }

      const fillRes = window.IndeedAutoFormFiller?.fillCurrentStep(profile);
      log(`Step ${stepCount}: Auto-filled ${fillRes?.filled || 0} fields.`, 'info');

      await sleep(settings?.stepDelayMs || 1200);

      const advRes = window.IndeedAutoFormFiller?.advanceOrSubmit();
      if (advRes?.action === 'submitted') {
        log('Clicked Submit Application button!', 'info');
        await sleep(3000);
        if (window.IndeedAutoFormFiller?.isApplicationSubmitted()) {
          window.IndeedAutoFormFiller?.closeModal();
          return { success: true };
        }
      } else if (advRes?.action === 'advanced') {
        log('Advanced to next step...', 'info');
        await sleep(2000);
      } else {
        if (window.IndeedAutoFormFiller?.isApplicationSubmitted()) {
          window.IndeedAutoFormFiller?.closeModal();
          return { success: true };
        }
        await sleep(1500);
      }
    }

    if (window.IndeedAutoFormFiller?.isApplicationSubmitted()) {
      window.IndeedAutoFormFiller?.closeModal();
      return { success: true };
    }

    window.IndeedAutoFormFiller?.closeModal();
    return { success: false, reason: 'max_steps_exceeded' };
  }

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
    processedJks.add(jk);

    chrome.runtime.sendMessage({ action: 'UPDATE_STATS', delta: { scanned: 1 } }).catch(() => {});

    const clickable = card.querySelector('h2.jobTitle a, a.jcs-JobTitle, a[data-jk], h2 a') || card;
    clickable.click();
    await sleep(2000);

    const viewPane = document.querySelector('#jobsearch-ViewjobPaneWrapper, .jobsearch-JobComponent, div[data-testid="jobsearch-ViewjobPaneWrapper"]');
    const scope = viewPane || document;

    const titleEl = scope.querySelector('h2[data-testid="simpler-jobTitle"], .jobsearch-JobInfoHeader-title, h1.jobTitle, h2.jobTitle') || card.querySelector('h2.jobTitle, .jobTitle');
    const companyEl = scope.querySelector('div[data-testid="inlineHeader-companyName"], [data-company-name="true"], .companyName') || card.querySelector('.companyName');
    const locationEl = scope.querySelector('div[data-testid="inlineHeader-companyLocation"], .companyLocation') || card.querySelector('.companyLocation');
    const salaryEl = scope.querySelector('div[data-testid="attribute_snippet_testid"], #salaryInfoAndJobType, .salary-snippet-container') || card.querySelector('.salary-snippet-container, [data-testid="attribute_snippet_testid"]');
    const descEl = scope.querySelector('#jobDescriptionText, .jobsearch-jobDescriptionText');

    const jobTitle = titleEl ? titleEl.textContent.trim() : 'Unknown Role';
    const company = companyEl ? companyEl.textContent.trim() : 'Unknown Company';
    const location = locationEl ? locationEl.textContent.trim() : 'Unknown Location';
    const salaryText = salaryEl ? salaryEl.textContent.trim() : '';
    const description = descEl ? descEl.textContent.trim() : '';
    const jobUrl = window.location.href;

    log(`🔍 Inspecting: "${jobTitle}" at "${company}" (${location})`, 'info');

    // 1. Salary Check
    const minSalary = settings?.minMonthlySalary || 25000;
    const estSalary = parseMonthlySalary(salaryText);
    if (estSalary && estSalary < minSalary) {
      log(`⏭️ Skipped: "${jobTitle}" salary (est. ₹${estSalary.toLocaleString()}/mo) below ₹${minSalary.toLocaleString()} minimum floor.`, 'info');
      chrome.runtime.sendMessage({ action: 'UPDATE_STATS', delta: { skipped: 1 } }).catch(() => {});
      card.style.border = originalBorder;
      return 'skipped_salary';
    }

    // 2. Experience Check
    const userExp = settings?.userYearsExp !== undefined ? settings.userYearsExp : 1;
    const reqExp = parseExperienceRequirement(jobTitle, description);

    // Case: No experience mentioned
    if (reqExp === null) {
      const action = settings?.unlistedExpAction || 'save';
      if (action === 'save') {
        log(`📋 No experience requirement listed for "${jobTitle}" — Saving for manual review.`, 'info');
        chrome.runtime.sendMessage({
          action: 'SAVE_JOB',
          job: { jk, title: jobTitle, company, location, salary: salaryText, url: jobUrl, reason: 'No Experience Listed' }
        }).catch(() => {});
      } else {
        log(`⏭️ Skipped: No experience requirement listed for "${jobTitle}".`, 'info');
        chrome.runtime.sendMessage({ action: 'UPDATE_STATS', delta: { skipped: 1 } }).catch(() => {});
      }
      card.style.border = originalBorder;
      return 'saved_no_exp';
    }

    // Case: Experience exceeds user experience
    if (reqExp > userExp) {
      log(`⏭️ Skipped: "${jobTitle}" requires ${reqExp}+ years of experience (Your profile: ${userExp} year).`, 'info');
      chrome.runtime.sendMessage({ action: 'UPDATE_STATS', delta: { skipped: 1 } }).catch(() => {});
      card.style.border = originalBorder;
      return 'skipped_experience';
    }

    // Case: Experience matches
    log(`🎯 Experience match (${reqExp} <= ${userExp} yr) for "${jobTitle}"! Checking apply type...`, 'success');

    const applyInfo = inspectApplyButton(viewPane);

    // Subcase: Apply on Company Website
    if (applyInfo.type === 'company_site') {
      log(`📋 Job directs to external company website — Saving to your list.`, 'info');
      chrome.runtime.sendMessage({
        action: 'SAVE_JOB',
        job: { jk, title: jobTitle, company, location, salary: salaryText, url: applyInfo.url || jobUrl, reason: 'Company Website' }
      }).catch(() => {});
      card.style.border = originalBorder;
      return 'saved_company_site';
    }

    // Subcase: Indeed Apply
    if (applyInfo.type === 'indeed_apply') {
      log(`🚀 "Apply with Indeed" found! Triggering application...`, 'info');
      applyInfo.element.click();

      const result = await executeIndeedApplication(profile, settings);
      if (result.success) {
        chrome.runtime.sendMessage({
          action: 'JOB_APPLIED',
          job: { jk, title: jobTitle, company, location, salary: salaryText, url: jobUrl }
        }).catch(() => {});
      } else {
        log(`⚠️ Could not auto-complete application for "${jobTitle}" (${result.reason || 'unresolved'}).`, 'warning');
      }
      card.style.border = originalBorder;
      return result.success ? 'applied' : 'apply_failed';
    }

    // Unknown apply type fallback
    log(`📋 Unable to determine apply button type for "${jobTitle}" — Saving for manual apply.`, 'info');
    chrome.runtime.sendMessage({
      action: 'SAVE_JOB',
      job: { jk, title: jobTitle, company, location, salary: salaryText, url: jobUrl, reason: 'Unknown Apply Method' }
    }).catch(() => {});
    card.style.border = originalBorder;
    return 'saved_unknown';
  }

  async function navigateToNextPage() {
    log('Searching for Next Page of job results...', 'info');
    const nextBtn = document.querySelector(
      'a[data-testid="pagination-page-next"], nav[role="navigation"] a[aria-label="Next Page"], a[aria-label="Next"], a.pn[aria-label*="Next"]'
    );

    if (nextBtn && nextBtn.href) {
      log('Navigating to next page of results...', 'info');
      nextBtn.click();
      await sleep(4000);
      return true;
    }
    return false;
  }

  async function runCrawlLoop() {
    if (isRunning) return;
    isRunning = true;
    isHalted = false;

    log('Starting Auto-Applier crawler loop...', 'info');

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
          break;
        }

        const cards = Array.from(document.querySelectorAll(
          'div.job_seen_beacon, div[data-testid="slider_item"], td.resultContent, li:has([data-jk]), div[data-jk]'
        )).filter(c => c.offsetWidth > 0 && c.offsetHeight > 0);

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

          const status = await processJobCard(card, profile, settings);
          if (status !== 'already_processed') {
            processedAnyOnPage = true;
            await sleep(settings.stepDelayMs || 1500);
          }
        }

        if (isHalted) break;

        const hasNext = await navigateToNextPage();
        if (!hasNext) {
          log('No further pages found. Completed all available listings.', 'info');
          const finalData = await chrome.storage.local.get(['autoApplySession']);
          chrome.runtime.sendMessage({ action: 'SESSION_COMPLETED', summary: finalData.autoApplySession?.stats }).catch(() => {});
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
      log('Session halted by user request.', 'warning');
      sendResponse({ status: 'halted' });
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
