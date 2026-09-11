/**
 * Indeed Auto-Applier - Form Filler Module
 * Autonomous multi-step form completion, radio answering,
 * resume selection, step advancement, and application submission.
 */

(function() {
  let hasNotifiedCaptcha = false;
  let activeProfile = null;
  let isObserverActive = false;

  function loadProfile(callback) {
    chrome.storage.local.get(['userProfile'], (res) => {
      activeProfile = res && res.userProfile ? res.userProfile : null;
      if (callback) callback(activeProfile);
    });
  }

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.userProfile) {
      activeProfile = changes.userProfile.newValue;
    }
  });

    // Trigger realistic synthetic click for React buttons
  function triggerClick(el) {
    if (!el) return;
    try {
      el.focus();
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      el.click();
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {
      el.click();
    }
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

  function setSelectValue(selectEl, value) {
    if (!selectEl || !value) return false;
    if (selectEl.disabled) return false;

    const targetVal = String(value).toLowerCase().trim();
    if (!targetVal) return false;

    let matchedOption = null;

    for (const option of selectEl.options) {
      const optText = (option.textContent || '').toLowerCase().trim();
      const optVal = (option.value || '').toLowerCase().trim();
      if (!optText && !optVal) continue;
      if (optVal === '' && optText.includes('select')) continue;

      if ((optText && optText === targetVal) || (optVal && optVal === targetVal) ||
          (optText && optText.includes(targetVal)) || (optVal && optVal.includes(targetVal))) {
        matchedOption = option;
        break;
      }
    }

    if (!matchedOption) {
      const tokens = targetVal.split(/\s+/).filter(t => t.length > 2);
      for (const option of selectEl.options) {
        const optText = (option.textContent || '').toLowerCase().trim();
        if (tokens.some(t => optText.includes(t))) {
          matchedOption = option;
          break;
        }
      }
    }

    if (!matchedOption && window.SpeedFillMatcher?.normalizeDegreeCategory) {
      const cat = window.SpeedFillMatcher.normalizeDegreeCategory(targetVal);
      if (cat) {
        for (const option of selectEl.options) {
          const optText = (option.textContent || '').toLowerCase().trim();
          if (window.SpeedFillMatcher.normalizeDegreeCategory(optText) === cat) {
            matchedOption = option;
            break;
          }
        }
      }
    }

    if (matchedOption) {
      if (selectEl.value === matchedOption.value) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
      if (setter) setter.call(selectEl, matchedOption.value);
      else selectEl.value = matchedOption.value;

      selectEl.dispatchEvent(new Event('input', { bubbles: true }));
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
      selectEl.dispatchEvent(new Event('blur', { bubbles: true }));
      return true;
    }
    return false;
  }

  function getRadioLabelText(radioEl, container) {
    if (radioEl.id) {
      const lbl = container.querySelector(`label[for="${radioEl.id}"]`);
      if (lbl && lbl.textContent) return lbl.textContent.toLowerCase().trim();
    }
    const parentLbl = radioEl.closest('label');
    if (parentLbl && parentLbl.textContent) return parentLbl.textContent.toLowerCase().trim();
    return (radioEl.value || '').toLowerCase().trim();
  }

  function handleRadioGroups(container, profile) {
    const prof = profile || activeProfile;
    if (!container || !prof) return 0;
    let count = 0;
    const userCity = (prof.personal?.city || '').toLowerCase().trim();

    const groups = container.querySelectorAll('fieldset, [role="radiogroup"], .ia-Questions-item, div[class*="Question"]');
    groups.forEach(group => {
      if (window.SpeedFillMatcher?.isInsideExcludedContainer(group)) return;

      const radios = Array.from(group.querySelectorAll('input[type="radio"]'));
      if (radios.length === 0 || radios.some(r => r.checked)) return;

      let questionText = '';
      const header = group.querySelector('legend, h1, h2, h3, h4, [class*="label"], [class*="title"], p, span');
      if (header) questionText = header.textContent.toLowerCase().trim();

      let targetRadio = null;

      // 1. Commute / Relocate
      if (window.SpeedFillMatcher?.isOfficeOrCommuteQuestion(questionText)) {
        targetRadio = radios.find(r => {
          const txt = getRadioLabelText(r, group);
          return txt.includes('yes') || txt.includes('relocate') || txt.includes('commute');
        });
      }

      // 2. City / Location
      if (!targetRadio && (questionText.includes('located in') || questionText.includes('live in') || questionText.includes('based in'))) {
        const matchesCity = userCity ? questionText.includes(userCity) : false;
        targetRadio = radios.find(r => {
          const txt = getRadioLabelText(r, group);
          return matchesCity ? txt.includes('yes') : txt.includes('no');
        });
      }

      // 3. Screening QA Bank keywords
      if (!targetRadio && prof.screening && Array.isArray(prof.screening)) {
        for (const item of prof.screening) {
          if (!item.keywords || !item.answer) continue;
          const kws = item.keywords.toLowerCase().split(/[,/|]/).map(k => k.trim());
          if (kws.some(kw => kw && questionText.includes(kw))) {
            const ansLower = item.answer.toLowerCase();
            targetRadio = radios.find(r => {
              const txt = getRadioLabelText(r, group);
              return txt.includes(ansLower) || ansLower.includes(txt);
            });
            if (targetRadio) break;
          }
        }
      }

      // 4. Default yes / no fallback for eligibility
      if (!targetRadio) {
        if (questionText.includes('authorized') || questionText.includes('eligible') || questionText.includes('background check') || questionText.includes('18 years')) {
          targetRadio = radios.find(r => getRadioLabelText(r, group).includes('yes'));
        }
      }

      if (targetRadio) {
        if (window.SpeedFillMatcher?.setNativeCheckboxRadio) {
          window.SpeedFillMatcher.setNativeCheckboxRadio(targetRadio, true);
        } else {
          targetRadio.click();
        }
        count++;
      }
    });

    return count;
  }

  function handleResume(container, profile) {
    if (!container) return false;
    const headings = Array.from(container.querySelectorAll('h1, h2, h3, [class*="title"], [class*="heading"]'));
    const isResumeStep = headings.some(h => {
      const t = (h.textContent || '').toLowerCase();
      return t.includes('resume') && !t.includes('review');
    });

    if (!isResumeStep) return false;

    const cards = Array.from(container.querySelectorAll('[data-testid*="resume"], [class*="ResumeCard"], [class*="resume-card"], [class*="resume-option"]'))
      .filter(c => c.offsetWidth > 0 && c.offsetHeight > 0);

    if (cards.length === 0) return false;

    let targetCard = cards[0];
    const prof = profile || activeProfile;
    const targetName = (prof?.autoApplierSettings?.targetResumeName || prof?.work?.targetRole?.targetResumeName || '').toLowerCase().trim();
    if (targetName) {
      const found = cards.find(c => (c.textContent || '').toLowerCase().includes(targetName));
      if (found) targetCard = found;
    }

    const isSelected = targetCard.classList.contains('selected') ||
                       targetCard.getAttribute('aria-checked') === 'true' ||
                       targetCard.getAttribute('aria-selected') === 'true';

    if (!isSelected) {
      targetCard.click();
      return true;
    }
    return false;
  }

  function checkCaptcha() {
    const hasCaptchaEl = document.querySelector('iframe[src*="recaptcha"], iframe[title*="recaptcha"], .g-recaptcha, [class*="captcha"], [id*="captcha"]');
    const bodyText = (document.body?.innerText || '');
    const hasCaptchaText = bodyText.includes("I'm not a robot") || bodyText.includes("Security Verification") || bodyText.includes("reCAPTCHA");

    if (hasCaptchaEl || hasCaptchaText) {
      if (!hasNotifiedCaptcha) {
        hasNotifiedCaptcha = true;
        playAudioChime();
        chrome.runtime.sendMessage({ action: 'NOTIFY_CAPTCHA' }).catch(() => {});
      }
      return true;
    }
    hasNotifiedCaptcha = false;
    return false;
  }

  function isApplicationSubmitted(container) {
    const scope = container || document;
    const text = (scope.innerText || scope.textContent || '').toLowerCase();
    
    const confirmations = [
      'your application has been submitted',
      'application submitted',
      'your application was sent',
      'application has been sent',
      'you applied to this job',
      'thank you for applying',
      'successfully applied'
    ];

    if (confirmations.some(c => text.includes(c))) {
      return true;
    }

    const successBadge = scope.querySelector('[data-testid="ia-SuccessView"], .ia-SuccessView, [aria-label*="Application submitted"]');
    if (successBadge) return true;

    return false;
  }

    // Auto-learn user responses when they manually fill/edit application inputs
  function attachAutoLearnListeners(container, profile) {
    if (!container) return;
    const inputs = container.querySelectorAll('input, textarea, select');
    inputs.forEach(el => {
      if (el._autoLearnBound) return;
      el._autoLearnBound = true;
      el.addEventListener('change', () => {
        const val = (el.value || '').trim();
        if (!val || val.length < 2) return;

        let qText = '';
        const parentQuestion = el.closest('.ia-Questions-item, fieldset, div[class*="Question"], div[class*="FormGroup"]');
        if (parentQuestion) {
          const header = parentQuestion.querySelector('legend, h1, h2, h3, h4, label, [class*="label"], [class*="title"], p');
          if (header) qText = header.textContent.trim();
        }
        if (!qText && el.id) {
          const lbl = container.querySelector(`label[for="${el.id}"]`);
          if (lbl) qText = lbl.textContent.trim();
        }

        if (qText && qText.length > 5) {
          chrome.storage.local.get(['userProfile'], (res) => {
            const p = res?.userProfile || profile || activeProfile || {};
            if (!p.screening) p.screening = [];
            const cleanQ = qText.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
            const exists = p.screening.some(item => item.keywords && cleanQ.includes(item.keywords.toLowerCase()));
            if (!exists) {
              const keywords = cleanQ.split(' ').filter(w => w.length > 3).slice(0, 4).join(', ');
              if (keywords) {
                p.screening.push({ keywords, answer: val });
                chrome.storage.local.set({ userProfile: p });
                console.log(`[Indeed Auto-Applier] Auto-learned QA pair: "${keywords}" -> "${val}"`);
              }
            }
          });
        }
      });
    });
  }

  function fillCurrentStep(profile) {
    const prof = profile || activeProfile;
    const container = window.SpeedFillMatcher?.getAppContainer() || document.querySelector('[data-testid="ia-container"], #ia-container, div[role="dialog"]');
    if (!container || !prof) return { filled: 0, containerFound: false };

    let filled = 0;

    handleResume(container, prof);
    attachAutoLearnListeners(container, prof);
    filled += handleRadioGroups(container, prof);

    const inputs = container.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input:not([type]), textarea');
    inputs.forEach(input => {
      if (input.offsetWidth === 0 && input.offsetHeight === 0) return;
      if (input.disabled || input.readOnly) return;
      if (window.SpeedFillMatcher?.isNonApplicationInput(input)) return;

      const match = window.SpeedFillMatcher?.matchField(input, prof);
      if (match && match.value) {
        const ok = window.SpeedFillMatcher.setNativeInputValue(input, match.value);
        if (ok) filled++;
      }
    });

    const selects = container.querySelectorAll('select');
    selects.forEach(select => {
      if (select.offsetWidth === 0 && select.offsetHeight === 0) return;
      if (select.disabled) return;
      if (window.SpeedFillMatcher?.isNonApplicationInput(select)) return;

      const match = window.SpeedFillMatcher?.matchField(select, prof);
      if (match && match.value) {
        const ok = setSelectValue(select, match.value);
        if (ok) filled++;
      }
    });

    return { filled, containerFound: true };
  }

    async function advanceOrSubmit(container) {
    const scope = container || window.SpeedFillMatcher?.getAppContainer() || document;

    const findButtons = () => Array.from(scope.querySelectorAll('button, a[role="button"], input[type="submit"], input[type="button"]'));

    // Check for Submit button first
    let buttons = findButtons();
    let submitBtn = buttons.find(b => {
      if (b.offsetWidth === 0 && b.offsetHeight === 0) return false;
      const testId = (b.getAttribute('data-testid') || '').toLowerCase();
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      const cls = (b.className || '').toLowerCase();
      const t = (b.textContent || b.value || '').toLowerCase().trim();
      return testId.includes('submit') || aria.includes('submit') || cls.includes('submit') ||
             t === 'submit your application' || t.includes('submit application') || t === 'submit';
    });

    if (submitBtn) {
      let attempts = 0;
      while ((submitBtn.disabled || submitBtn.getAttribute('aria-disabled') === 'true') && attempts < 15) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }
      console.log('[Auto-Applier FormFiller] Clicking Submit button...');
      triggerClick(submitBtn);
      return { action: 'submitted', button: submitBtn };
    }

    // Check for Continue / Next / Review button
    let continueBtn = buttons.find(b => {
      if (b.offsetWidth === 0 && b.offsetHeight === 0) return false;
      const testId = (b.getAttribute('data-testid') || '').toLowerCase();
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      const cls = (b.className || '').toLowerCase();
      const t = (b.textContent || b.value || '').toLowerCase().trim();
      return testId.includes('continue') || aria.includes('continue') || cls.includes('continue') ||
             testId.includes('review') || aria.includes('review') || cls.includes('review') ||
             testId.includes('next') || aria.includes('next') ||
             t === 'continue' || t.includes('continue') || t.includes('next') ||
             t === 'review' || t.includes('review your application') || t.includes('review application');
    });

    if (continueBtn) {
      let attempts = 0;
      while ((continueBtn.disabled || continueBtn.getAttribute('aria-disabled') === 'true') && attempts < 15) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }
      console.log('[Auto-Applier FormFiller] Clicking Continue/Next/Review button...');
      triggerClick(continueBtn);
      return { action: 'advanced', button: continueBtn };
    }

    return { action: 'none' };
  }

  
  // Autonomous step execution (fill + wait + advance/submit)
  async function handleStepFillAndAdvance(profile, settings) {
    const prof = profile || activeProfile;
    const container = window.SpeedFillMatcher?.getAppContainer() || document.querySelector('[data-testid="ia-container"], #ia-container, div[role="dialog"], form');
    if (!container) return { handled: false, reason: 'no_container' };

    if (checkCaptcha()) {
      return { handled: true, action: 'captcha_detected' };
    }

    if (isApplicationSubmitted(container)) {
      closeModal();
      return { handled: true, action: 'submitted' };
    }

    // 1. Fill fields
    const fillRes = fillCurrentStep(prof);
    const delay = Math.max(800, (settings?.stepDelayMs || 1200) + Math.floor(Math.random() * 400) - 200);
    await new Promise(r => setTimeout(r, delay));

    // 2. Advance or submit
    const advRes = await advanceOrSubmit(container);

    // 3. Immediate re-check for submission confirmation
    await new Promise(r => setTimeout(r, 1000));
    if (isApplicationSubmitted(container)) {
      closeModal();
      return { handled: true, action: 'submitted', filled: fillRes?.filled || 0 };
    }

    return { handled: true, action: advRes.action, filled: fillRes?.filled || 0 };
  }

  // Cross-frame runtime message listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'IA_FILL_AND_ADVANCE') {
      // Top window already tried locally; only subframes (application iframes) should handle this message!
      if (window === window.top) {
        return false;
      }
      handleStepFillAndAdvance(request.profile, request.settings)
        .then(res => sendResponse(res))
        .catch(err => sendResponse({ handled: false, error: err.message }));
      return true;
    }

    if (request.action === 'IA_CHECK_STATUS') {
      const container = window.SpeedFillMatcher?.getAppContainer() || document.querySelector('[data-testid="ia-container"], #ia-container, div[role="dialog"], form');
      sendResponse({
        hasContainer: !!container,
        isSubmitted: isApplicationSubmitted(container),
        hasCaptcha: checkCaptcha()
      });
      return true;
    }

    if (request.action === 'IA_CLOSE_MODAL') {
      closeModal();
      sendResponse({ ok: true });
      return true;
    }
  });

  function closeModal() {
    const closeBtn = document.querySelector(
      'button[aria-label*="close" i], button[data-testid*="close" i], button.ia-CloseButton, [data-testid="ia-close-button"], [data-testid="modal-close-button"], div[role="dialog"] button[aria-label*="close" i], button[id="close-button"]'
    );
    if (closeBtn) {
      try {
        closeBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        closeBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        closeBtn.click();
      } catch (_) {
        closeBtn.click();
      }
    }
  }

  // Setup autonomous MutationObserver to fill forms even if opened in iframe / separate flow
  function setupDOMObserver() {
    if (isObserverActive) return;

    const observer = new MutationObserver(() => {
      const container = window.SpeedFillMatcher?.getAppContainer() || document.querySelector('[data-testid="ia-container"], #ia-container');
      if (container && activeProfile) {
        clearTimeout(window._autoFillDebounceTimer);
        window._autoFillDebounceTimer = setTimeout(() => {
          fillCurrentStep(activeProfile);
        }, 300);
      }
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
      isObserverActive = true;
    }
  }

  loadProfile(() => {
    setupDOMObserver();
  });

  window.IndeedAutoFormFiller = {
    fillCurrentStep,
    advanceOrSubmit,
    handleStepFillAndAdvance,
    checkCaptcha,
    isApplicationSubmitted,
    closeModal,
    loadProfile
  };

  console.log('[Indeed Auto-Applier] Form Filler engine loaded.');
})();
