/**
 * Indeed Auto-Applier - Popup Dashboard Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const sessionBadge = document.getElementById('session-badge');
  const btnStart = document.getElementById('btn-start');
  const btnStop = document.getElementById('btn-stop');
  const btnClearLogs = document.getElementById('btn-clear-logs');
  const consoleLogs = document.getElementById('console-logs');

  const metricScanned = document.getElementById('metric-scanned');
  const metricApplied = document.getElementById('metric-applied');
  const metricSaved = document.getElementById('metric-saved');
  const metricSkipped = document.getElementById('metric-skipped');

  const progressText = document.getElementById('progress-text');
  const progressBarFill = document.getElementById('progress-bar-fill');

  const ruleQuery = document.getElementById('rule-query');
  const ruleLocation = document.getElementById('rule-location');
  const ruleExp = document.getElementById('rule-exp');
  const ruleSalary = document.getElementById('rule-salary');
  const ruleUnlistedExp = document.getElementById('rule-unlisted-exp');
  const ruleMaxJobs = document.getElementById('rule-max-jobs');
  const ruleDelay = document.getElementById('rule-delay');
  const ruleBlacklist = document.getElementById('rule-blacklist');
  const ruleCompanyBlacklist = document.getElementById('rule-company-blacklist');
  const ruleTargetResume = document.getElementById('rule-target-resume');
  const ruleStrictLocation = document.getElementById('rule-strict-location');
  const ruleEasyApplyOnly = document.getElementById('rule-easy-apply-only');
  const btnSaveRules = document.getElementById('btn-save-rules');

  const profFullName = document.getElementById('prof-fullname');
  const profPhone = document.getElementById('prof-phone');
  const profEmail = document.getElementById('prof-email');
  const profCity = document.getElementById('prof-city');
  const profCurrTitle = document.getElementById('prof-curr-title');
  const profCurrCompany = document.getElementById('prof-curr-company');
  const profYearsExp = document.getElementById('prof-years-exp');
  const profNotice = document.getElementById('prof-notice');
  const btnSaveProfile = document.getElementById('btn-save-profile');

  // Screening Q&A Bank elements
  const qaListContainer = document.getElementById('qa-list-container');
  const btnOpenAddQa = document.getElementById('btn-open-add-qa');
  const qaFormContainer = document.getElementById('qa-form-container');
  const qaFormTitle = document.getElementById('qa-form-title');
  const qaEditIndex = document.getElementById('qa-edit-index');
  const qaInputKeywords = document.getElementById('qa-input-keywords');
  const qaInputAnswer = document.getElementById('qa-input-answer');
  const btnCancelQa = document.getElementById('btn-cancel-qa');
  const btnSaveQa = document.getElementById('btn-save-qa');

  // Saved & Applied Jobs elements
  const viewSavedBtn = document.getElementById('view-saved-btn');
  const viewAppliedBtn = document.getElementById('view-applied-btn');
  const savedSubview = document.getElementById('saved-subview');
  const appliedSubview = document.getElementById('applied-subview');
  const savedJobsContainer = document.getElementById('saved-jobs-container');
  const appliedJobsContainer = document.getElementById('applied-jobs-container');
  const savedCountBadge = document.getElementById('saved-count-badge');
  const savedTabCount = document.getElementById('saved-tab-count');
  const appliedTabCount = document.getElementById('applied-tab-count');
  const savedSearchInput = document.getElementById('saved-search-input');
  const appliedSearchInput = document.getElementById('applied-search-input');
  const btnExportSaved = document.getElementById('btn-export-saved');
  const btnClearSaved = document.getElementById('btn-clear-saved');
  const btnExportApplied = document.getElementById('btn-export-applied');
  const btnClearApplied = document.getElementById('btn-clear-applied');

  // Logs / Historical Analytics elements
  const logsPeriodBtns = document.querySelectorAll('.period-btn');
  const logsPeriodLabel = document.getElementById('logs-period-label');
  const logsSessionsCount = document.getElementById('logs-sessions-count');
  const logsProgressTitle = document.getElementById('logs-progress-title');
  const logsProgressText = document.getElementById('logs-progress-text');
  const logsProgressBarFill = document.getElementById('logs-progress-bar-fill');
  const logsMetricScanned = document.getElementById('logs-metric-scanned');
  const logsMetricApplied = document.getElementById('logs-metric-applied');
  const logsMetricSaved = document.getElementById('logs-metric-saved');
  const logsMetricSkipped = document.getElementById('logs-metric-skipped');
  const logsTableHeading = document.getElementById('logs-table-heading');
  const logsBreakdownContainer = document.getElementById('logs-breakdown-container');
  const btnExportLogs = document.getElementById('btn-export-logs');
  const btnClearHistory = document.getElementById('btn-clear-history');

  let currentLogsPeriod = 'daily';

  const tabButtons = document.querySelectorAll('.nav-tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(btn.dataset.tab);
      if (targetPane) {
        targetPane.classList.add('active');
        if (btn.dataset.tab === 'tab-logs') {
          renderAnalytics(currentLogsPeriod);
        }
      }
    });
  });

  logsPeriodBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      logsPeriodBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentLogsPeriod = btn.dataset.period || 'daily';
      renderAnalytics(currentLogsPeriod);
    });
  });

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    themeToggleBtn.textContent = newTheme === 'light' ? '☀️' : '🌙';
    chrome.storage.local.set({ appTheme: newTheme });
  });

  const themeData = await chrome.storage.local.get(['appTheme']);
  if (themeData.appTheme) {
    document.documentElement.setAttribute('data-theme', themeData.appTheme);
    themeToggleBtn.textContent = themeData.appTheme === 'light' ? '☀️' : '🌙';
  }

  async function loadInitialData() {
    const data = await chrome.storage.local.get([
      'userProfile',
      'autoApplierSettings',
      'autoApplySession',
      'sessionLogs',
      'savedJobs',
      'appliedJobs'
    ]);

    const profile = data.userProfile || {};
    const settings = Object.assign({}, profile.autoApplierSettings || {}, data.autoApplierSettings || {});

    ruleQuery.value = settings.targetJobQuery || profile.work?.targetRole?.jobTitle || 'Data Analyst';
    ruleLocation.value = settings.targetLocation || profile.work?.targetRole?.targetLocation || 'City, State';
    ruleExp.value = settings.userYearsExp !== undefined ? settings.userYearsExp : 1;
    ruleSalary.value = settings.minMonthlySalary || 25000;
    ruleUnlistedExp.value = settings.unlistedExpAction || 'apply';
    ruleMaxJobs.value = settings.maxJobsPerSession || 25;
    ruleDelay.value = settings.stepDelayMs || 1500;
    ruleBlacklist.value = settings.blacklistKeywords || 'intern, unpaid, bpo, telecaller, faculty, teaching, night shift';
    if (ruleCompanyBlacklist) ruleCompanyBlacklist.value = settings.blockedCompanies || '';
    ruleTargetResume.value = settings.targetResumeName || '';
    ruleStrictLocation.checked = settings.strictLocation !== false;
    if (ruleEasyApplyOnly) ruleEasyApplyOnly.checked = !!settings.easyApplyOnly;

    profFullName.value = profile.personal?.fullName || '';
    profPhone.value = profile.personal?.phone || '';
    profEmail.value = profile.personal?.email || '';
    profCity.value = profile.personal?.city || '';
    profCurrTitle.value = profile.work?.currentRole?.jobTitle || '';
    profCurrCompany.value = profile.work?.currentRole?.company || '';
    profYearsExp.value = profile.work?.currentRole?.yearsExperience || '1';
    profNotice.value = profile.work?.targetRole?.noticePeriod || 'Immediate / 15 Days';

    const session = data.autoApplySession || { isRunning: false, stats: { scanned: 0, applied: 0, saved: 0, skipped: 0 } };
    updateSessionUI(session);

    if (data.sessionLogs && data.sessionLogs.length > 0) {
      consoleLogs.innerHTML = '';
      data.sessionLogs.forEach(entry => appendLogToUI(entry));
    }

    renderSavedJobs(data.savedJobs || []);
    renderAppliedJobs(data.appliedJobs || []);
    renderQaBank(profile.screening || []);
    await renderAnalytics(currentLogsPeriod);
  }

  function updateSessionUI(session) {
    const isRunning = session && session.isRunning;
    if (isRunning) {
      sessionBadge.textContent = 'Running';
      sessionBadge.className = 'status-badge status-running';
      btnStart.disabled = true;
      btnStop.disabled = false;
    } else {
      sessionBadge.textContent = 'Ready';
      sessionBadge.className = 'status-badge status-idle';
      btnStart.disabled = false;
      btnStop.disabled = true;
    }

    const stats = session?.stats || { scanned: 0, applied: 0, saved: 0, skipped: 0 };
    metricScanned.textContent = stats.scanned || 0;
    metricApplied.textContent = stats.applied || 0;
    metricSaved.textContent = stats.saved || 0;
    metricSkipped.textContent = stats.skipped || 0;

    const maxJobs = parseInt(ruleMaxJobs.value, 10) || 25;
    const processed = (stats.applied || 0) + (stats.saved || 0);
    progressText.textContent = `${processed} / ${maxJobs} Jobs`;
    const pct = Math.min(100, Math.round((processed / maxJobs) * 100));
    progressBarFill.style.width = `${pct}%`;
  }

  function appendLogToUI(log) {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${log.type || 'info'}`;
    entry.textContent = `[${log.timestamp || new Date().toLocaleTimeString()}] ${log.message}`;
    consoleLogs.appendChild(entry);
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
  }

  async function updateNavBadge() {
    const data = await chrome.storage.local.get(['savedJobs', 'appliedJobs']);
    const savedLen = (data.savedJobs || []).length;
    const appliedLen = (data.appliedJobs || []).length;
    if (savedCountBadge) savedCountBadge.textContent = savedLen;
    if (savedTabCount) savedTabCount.textContent = savedLen;
    if (appliedTabCount) appliedTabCount.textContent = appliedLen;
  }

  // Segmented control tabs in Saved & Applied
  if (viewSavedBtn && viewAppliedBtn) {
    viewSavedBtn.addEventListener('click', () => {
      viewSavedBtn.classList.add('active');
      viewAppliedBtn.classList.remove('active');
      if (savedSubview) savedSubview.style.display = 'block';
      if (appliedSubview) appliedSubview.style.display = 'none';
    });

    viewAppliedBtn.addEventListener('click', () => {
      viewAppliedBtn.classList.add('active');
      viewSavedBtn.classList.remove('active');
      if (appliedSubview) appliedSubview.style.display = 'block';
      if (savedSubview) savedSubview.style.display = 'none';
    });
  }

  function renderSavedJobs(jobs) {
    if (!savedJobsContainer) return;
    savedJobsContainer.innerHTML = '';
    updateNavBadge();

    const query = (savedSearchInput?.value || '').toLowerCase().trim();
    const filtered = jobs.filter(j => {
      if (!query) return true;
      return (j.title && j.title.toLowerCase().includes(query)) ||
             (j.company && j.company.toLowerCase().includes(query)) ||
             (j.location && j.location.toLowerCase().includes(query));
    });

    if (filtered.length === 0) {
      savedJobsContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 20px; font-size: 12px;">No saved jobs found.</div>';
      return;
    }

    filtered.forEach((job, index) => {
      const card = document.createElement('div');
      card.className = 'saved-job-card';

      const dateStr = job.savedAt ? new Date(job.savedAt).toLocaleDateString() : 'Recent';
      const salaryTag = job.salary ? `<span style="font-size: 11px; color: var(--accent-success);">${job.salary}</span>` : '';

      card.innerHTML = `
        <div class="job-card-header">
          <div>
            <div class="job-card-title">${job.title || 'Untitled Role'}</div>
            <div class="job-card-meta">${job.company || 'Unknown Company'} • ${job.location || 'India'}</div>
          </div>
          <span class="job-card-reason">${job.reason || 'Saved'}</span>
        </div>
        ${salaryTag ? `<div>${salaryTag}</div>` : ''}
        <div style="font-size: 10px; color: var(--text-secondary);">Saved on: ${dateStr}</div>
        <div class="job-card-actions">
          <button class="btn btn-secondary btn-open-job" data-url="${job.url}">🔗 Open Job</button>
          <button class="btn btn-danger btn-delete-job" data-index="${index}">🗑 Remove</button>
        </div>
      `;

      card.querySelector('.btn-open-job').addEventListener('click', (e) => {
        const url = e.currentTarget.dataset.url;
        if (url) chrome.tabs.create({ url });
      });

      card.querySelector('.btn-delete-job').addEventListener('click', async () => {
        jobs.splice(index, 1);
        await chrome.storage.local.set({ savedJobs: jobs });
        renderSavedJobs(jobs);
      });

      savedJobsContainer.appendChild(card);
    });
  }

  function renderAppliedJobs(jobs) {
    if (!appliedJobsContainer) return;
    appliedJobsContainer.innerHTML = '';
    updateNavBadge();

    const query = (appliedSearchInput?.value || '').toLowerCase().trim();
    const filtered = jobs.filter(j => {
      if (!query) return true;
      return (j.title && j.title.toLowerCase().includes(query)) ||
             (j.company && j.company.toLowerCase().includes(query)) ||
             (j.location && j.location.toLowerCase().includes(query));
    });

    if (filtered.length === 0) {
      appliedJobsContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 20px; font-size: 12px;">No applied jobs recorded yet.</div>';
      return;
    }

    filtered.forEach((job, index) => {
      const card = document.createElement('div');
      card.className = 'saved-job-card';

      const dateStr = job.appliedAt ? new Date(job.appliedAt).toLocaleDateString() : 'Recent';
      const salaryTag = job.salary ? `<span style="font-size: 11px; color: var(--accent-success);">${job.salary}</span>` : '';

      card.innerHTML = `
        <div class="job-card-header">
          <div>
            <div class="job-card-title">${job.title || 'Untitled Role'}</div>
            <div class="job-card-meta">${job.company || 'Unknown Company'} • ${job.location || 'India'}</div>
          </div>
          <span class="job-card-reason" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">✅ Applied</span>
        </div>
        ${salaryTag ? `<div>${salaryTag}</div>` : ''}
        <div style="font-size: 10px; color: var(--text-secondary);">Applied on: ${dateStr}</div>
        <div class="job-card-actions">
          <button class="btn btn-secondary btn-open-job" data-url="${job.url}">🔗 Open Job</button>
          <button class="btn btn-danger btn-delete-job" data-index="${index}">🗑 Remove</button>
        </div>
      `;

      card.querySelector('.btn-open-job').addEventListener('click', (e) => {
        const url = e.currentTarget.dataset.url;
        if (url) chrome.tabs.create({ url });
      });

      card.querySelector('.btn-delete-job').addEventListener('click', async () => {
        jobs.splice(index, 1);
        await chrome.storage.local.set({ appliedJobs: jobs });
        renderAppliedJobs(jobs);
      });

      appliedJobsContainer.appendChild(card);
    });
  }

  savedSearchInput?.addEventListener('input', async () => {
    const data = await chrome.storage.local.get(['savedJobs']);
    renderSavedJobs(data.savedJobs || []);
  });

  appliedSearchInput?.addEventListener('input', async () => {
    const data = await chrome.storage.local.get(['appliedJobs']);
    renderAppliedJobs(data.appliedJobs || []);
  });

  btnExportSaved?.addEventListener('click', async () => {
    const data = await chrome.storage.local.get(['savedJobs']);
    const jobs = data.savedJobs || [];
    if (jobs.length === 0) {
      alert('No saved jobs to export!');
      return;
    }

    let csv = 'Title,Company,Location,Salary,Reason,SavedAt,URL\n';
    jobs.forEach(j => {
      const escape = (val) => `"${String(val || '').replace(/"/g, '""')}"`;
      csv += `${escape(j.title)},${escape(j.company)},${escape(j.location)},${escape(j.salary)},${escape(j.reason)},${escape(j.savedAt)},${escape(j.url)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `indeed_saved_jobs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  btnExportApplied?.addEventListener('click', async () => {
    const data = await chrome.storage.local.get(['appliedJobs']);
    const jobs = data.appliedJobs || [];
    if (jobs.length === 0) {
      alert('No applied jobs to export!');
      return;
    }

    let csv = 'Title,Company,Location,Salary,AppliedAt,URL\n';
    jobs.forEach(j => {
      const escape = (val) => `"${String(val || '').replace(/"/g, '""')}"`;
      csv += `${escape(j.title)},${escape(j.company)},${escape(j.location)},${escape(j.salary)},${escape(j.appliedAt)},${escape(j.url)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `indeed_applied_jobs_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  btnClearSaved?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all saved jobs?')) {
      await chrome.storage.local.set({ savedJobs: [] });
      renderSavedJobs([]);
    }
  });

  btnClearApplied?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all applied jobs records?')) {
      await chrome.storage.local.set({ appliedJobs: [] });
      renderAppliedJobs([]);
    }
  });

  // Screening Q&A Bank Renderer and Handlers
  function renderQaBank(screeningList = []) {
    if (!qaListContainer) return;
    qaListContainer.innerHTML = '';

    if (screeningList.length === 0) {
      qaListContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 14px; font-size: 11.5px;">No screening Q&A rules configured yet.<br>Click "+ Add Question" to create one.</div>';
      return;
    }

    screeningList.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'qa-card';

      const keywords = (item.keywords || '').split(',').map(k => k.trim()).filter(Boolean);
      const tagsHtml = keywords.map(kw => `<span class="qa-keyword-tag">${kw}</span>`).join('');

      card.innerHTML = `
        <div class="qa-card-header">
          <div class="qa-keywords-wrap">${tagsHtml}</div>
          <div class="qa-actions">
            <button class="qa-btn-action btn-edit-qa" title="Edit Rule">✏️</button>
            <button class="qa-btn-action btn-delete-qa" title="Delete Rule">🗑️</button>
          </div>
        </div>
        <div class="qa-card-body">
          <span style="font-size: 10.5px; color: var(--text-secondary);">Answer:</span>
          <span class="qa-answer-badge">${item.answer || ''}</span>
        </div>
      `;

      card.querySelector('.btn-edit-qa').addEventListener('click', () => {
        qaFormTitle.textContent = 'Edit Screening Rule';
        qaEditIndex.value = index;
        qaInputKeywords.value = item.keywords || '';
        qaInputAnswer.value = item.answer || '';
        qaFormContainer.style.display = 'block';
        qaInputKeywords.focus();
      });

      card.querySelector('.btn-delete-qa').addEventListener('click', async () => {
        const data = await chrome.storage.local.get(['userProfile']);
        const prof = data.userProfile || {};
        const screening = prof.screening || [];
        screening.splice(index, 1);
        prof.screening = screening;
        await chrome.storage.local.set({ userProfile: prof });
        renderQaBank(screening);
      });

      qaListContainer.appendChild(card);
    });
  }

  btnOpenAddQa?.addEventListener('click', () => {
    qaFormTitle.textContent = 'Add Screening Rule';
    qaEditIndex.value = '-1';
    qaInputKeywords.value = '';
    qaInputAnswer.value = '';
    qaFormContainer.style.display = 'block';
    qaInputKeywords.focus();
  });

  btnCancelQa?.addEventListener('click', () => {
    qaFormContainer.style.display = 'none';
  });

  btnSaveQa?.addEventListener('click', async () => {
    const keywords = qaInputKeywords.value.trim();
    const answer = qaInputAnswer.value.trim();
    if (!keywords || !answer) {
      alert('Please provide both question keywords and an answer value.');
      return;
    }

    const data = await chrome.storage.local.get(['userProfile']);
    const prof = data.userProfile || {};
    const screening = prof.screening || [];
    const editIdx = parseInt(qaEditIndex.value, 10);

    if (editIdx >= 0 && editIdx < screening.length) {
      screening[editIdx] = { keywords, answer };
    } else {
      screening.push({ keywords, answer });
    }

    prof.screening = screening;
    await chrome.storage.local.set({ userProfile: prof });
    renderQaBank(screening);
    qaFormContainer.style.display = 'none';
  });

  btnClearLogs.addEventListener('click', async () => {
    await chrome.storage.local.set({ sessionLogs: [] });
    consoleLogs.innerHTML = '<div class="log-entry log-info">[System] Logs cleared.</div>';
  });

  function getLocalDateKey(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function renderDropoffAnalytics(reasons = {}, totalPeriodSkipped = 0) {
    const logsDropoffContainer = document.getElementById('logs-dropoff-container');
    const dropoffTotalSkipped = document.getElementById('dropoff-total-skipped');
    if (!logsDropoffContainer) return;

    const categories = [
      { key: 'experience', label: '🎓 Experience Exceeded', class: 'fill-exp' },
      { key: 'salary', label: '💰 Salary Floor Unmet', class: 'fill-salary' },
      { key: 'blacklist', label: '🚫 Blacklist Keyword', class: 'fill-blacklist' },
      { key: 'location', label: '📍 Outside Target Location', class: 'fill-loc' },
      { key: 'company', label: '🏢 Blocked Company', class: 'fill-company' },
      { key: 'easy_apply', label: '⚡ External Site (Easy Apply Only)', class: 'fill-easy' },
      { key: 'unrecognized', label: '❓ Unrecognized / Expired', class: 'fill-other' }
    ];

    let categorizedTotal = 0;
    categories.forEach(c => {
      c.count = reasons[c.key] || 0;
      categorizedTotal += c.count;
    });

    const displayTotal = Math.max(categorizedTotal, totalPeriodSkipped);

    if (totalPeriodSkipped > categorizedTotal) {
      const uncat = totalPeriodSkipped - categorizedTotal;
      categories.push({
        key: 'other_filters',
        label: '⏳ Prior / General Filters',
        count: uncat,
        class: 'fill-other'
      });
    }

    if (dropoffTotalSkipped) {
      dropoffTotalSkipped.textContent = `${displayTotal} Skipped`;
    }

    if (displayTotal === 0) {
      logsDropoffContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 8px; font-size: 11px;">No skipped jobs recorded for this period.</div>';
      return;
    }

    logsDropoffContainer.innerHTML = categories
      .filter(c => c.count > 0)
      .map(c => {
        const pct = Math.round((c.count / displayTotal) * 100);
        return `
          <div class="dropoff-row">
            <div class="dropoff-header">
              <span class="dropoff-name">${c.label}</span>
              <span class="dropoff-count">${c.count} (${pct}%)</span>
            </div>
            <div class="dropoff-bar-bg">
              <div class="dropoff-bar-fill ${c.class}" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      }).join('');
  }

  async function renderAnalytics(period = 'daily') {
    const data = await chrome.storage.local.get(['analyticsHistory', 'sessionHistory', 'autoApplySession']);
    let history = data.analyticsHistory || {};
    const sessions = data.sessionHistory || [];
    const autoApplySession = data.autoApplySession || {};
    const sessionStats = autoApplySession.stats || { scanned: 0, applied: 0, saved: 0, skipped: 0 };

    const todayKey = getLocalDateKey();

    // Auto-seed today's record if missing or empty but current session has stats
    if ((!history[todayKey] || (history[todayKey].scanned === 0 && sessionStats.scanned > 0)) &&
        (sessionStats.scanned > 0 || sessionStats.saved > 0 || sessionStats.applied > 0 || sessionStats.skipped > 0)) {
      history[todayKey] = {
        date: todayKey,
        scanned: sessionStats.scanned || 0,
        applied: sessionStats.applied || 0,
        saved: sessionStats.saved || 0,
        skipped: sessionStats.skipped || 0,
        sessions: 1,
        lastUpdated: Date.now()
      };
      await chrome.storage.local.set({ analyticsHistory: history });
    }

    const now = new Date();

    if (period === 'daily') {
      const rec = history[todayKey] || { scanned: 0, applied: 0, saved: 0, skipped: 0, sessions: 0 };
      const todaySessions = sessions.filter(s => s.date === todayKey);
      const sessCount = rec.sessions || todaySessions.length || (rec.scanned > 0 ? 1 : 0);

      const todayDayName = now.toLocaleDateString(undefined, { weekday: 'short' });
      logsPeriodLabel.textContent = `Today, ${todayDayName} (${now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })})`;
      logsSessionsCount.textContent = `${sessCount} ${sessCount === 1 ? 'Session' : 'Sessions'} Run`;

      const scanned = rec.scanned || 0;
      const applied = rec.applied || 0;
      const saved = rec.saved || 0;
      const skipped = rec.skipped || 0;

      logsMetricScanned.textContent = scanned;
      logsMetricApplied.textContent = applied;
      logsMetricSaved.textContent = saved;
      logsMetricSkipped.textContent = skipped;

      const processed = applied + saved;
      const targetJobs = (parseInt(ruleMaxJobs?.value, 10) || 25) * Math.max(1, sessCount);
      logsProgressTitle.textContent = 'Session Progress';
      logsProgressText.textContent = `${processed} / ${targetJobs} Jobs`;
      const pct = Math.min(100, Math.round((processed / targetJobs) * 100));
      logsProgressBarFill.style.width = `${pct}%`;

      logsTableHeading.textContent = "Today's Session Activity";
      if (todaySessions.length > 0) {
        logsBreakdownContainer.innerHTML = todaySessions.map((s, idx) => {
          const timeStr = s.startTime ? new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent';
          const durMins = (s.startTime && s.endTime) ? Math.max(1, Math.round((s.endTime - s.startTime) / 60000)) : null;
          return `
            <div class="logs-session-item">
              <div class="logs-session-title">
                <span>Session #${todaySessions.length - idx} &bull; ${s.query || 'Auto-Apply'}</span>
                <span class="logs-session-time">${timeStr}${durMins ? ` (${durMins}m)` : ''}</span>
              </div>
              <div style="font-size: 10.5px; color: var(--text-secondary);">${s.location || 'India'} &bull; Status: <strong>${s.status || 'completed'}</strong></div>
              <div class="logs-session-tags">
                <span class="tag-badge tag-scanned">Scanned: ${s.stats?.scanned || 0}</span>
                <span class="tag-badge tag-applied">Applied: ${s.stats?.applied || 0}</span>
                <span class="tag-badge tag-saved">Saved: ${s.stats?.saved || 0}</span>
                <span class="tag-badge tag-skipped">Skipped: ${s.stats?.skipped || 0}</span>
              </div>
            </div>
          `;
        }).join('');
      } else if (scanned > 0 || applied > 0 || saved > 0) {
        logsBreakdownContainer.innerHTML = `
          <div class="logs-session-item">
            <div class="logs-session-title">
              <span>Active Today's Summary</span>
              <span class="logs-session-time">${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div style="font-size: 10.5px; color: var(--text-secondary);">Jobs Processed & Categorized</div>
            <div class="logs-session-tags">
              <span class="tag-badge tag-scanned">Scanned: ${scanned}</span>
              <span class="tag-badge tag-applied">Applied: ${applied}</span>
              <span class="tag-badge tag-saved">Saved: ${saved}</span>
              <span class="tag-badge tag-skipped">Skipped: ${skipped}</span>
            </div>
          </div>
        `;
      } else {
        logsBreakdownContainer.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 25px 10px; font-size: 11.5px;">No auto-apply sessions recorded today.<br>Click "Start Auto-Apply" to begin!</div>';
      }

      const dailyReasons = Object.assign({}, autoApplySession.skipReasons || {}, rec.skipReasons || {});
      renderDropoffAnalytics(dailyReasons, skipped);
    } else if (period === 'weekly') {
      const days = [];
      let scannedSum = 0, appliedSum = 0, savedSum = 0, skippedSum = 0, sessSum = 0;

      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const k = getLocalDateKey(d);
        const r = history[k] || { scanned: 0, applied: 0, saved: 0, skipped: 0, sessions: 0 };
        const dayOfWeek = d.toLocaleDateString(undefined, { weekday: 'short' });
        let dayLabel = dayOfWeek;
        if (i === 0) {
          dayLabel = `Today, ${dayOfWeek}`;
        } else if (i === 1) {
          dayLabel = `Yesterday, ${dayOfWeek}`;
        }

        days.push({
          dateKey: k,
          label: dayLabel,
          dateStr: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          scanned: r.scanned || 0,
          applied: r.applied || 0,
          saved: r.saved || 0,
          skipped: r.skipped || 0,
          sessions: r.sessions || (r.scanned > 0 ? 1 : 0)
        });
        scannedSum += (r.scanned || 0);
        appliedSum += (r.applied || 0);
        savedSum += (r.saved || 0);
        skippedSum += (r.skipped || 0);
        sessSum += (r.sessions || (r.scanned > 0 ? 1 : 0));
      }

      logsPeriodLabel.textContent = `Last 7 Days (${days[0].dateStr} - ${days[6].dateStr})`;
      logsSessionsCount.textContent = `${sessSum} ${sessSum === 1 ? 'Session' : 'Sessions'} Total`;

      logsMetricScanned.textContent = scannedSum;
      logsMetricApplied.textContent = appliedSum;
      logsMetricSaved.textContent = savedSum;
      logsMetricSkipped.textContent = skippedSum;

      const processed = appliedSum + savedSum;
      const targetJobs = Math.max(25, sessSum * 25);
      logsProgressTitle.textContent = 'Weekly Progress';
      logsProgressText.textContent = `${processed} / ${targetJobs} Jobs`;
      logsProgressBarFill.style.width = `${Math.min(100, Math.round((processed / targetJobs) * 100))}%`;

      logsTableHeading.textContent = 'Daily Breakdown (Last 7 Days)';
      logsBreakdownContainer.innerHTML = `
        <table class="logs-table">
          <thead>
            <tr>
              <th>Date</th>
              <th class="num-col">Scanned</th>
              <th class="num-col">Applied</th>
              <th class="num-col">Saved</th>
              <th class="num-col">Skipped</th>
            </tr>
          </thead>
          <tbody>
            ${days.slice().reverse().map(d => `
              <tr>
                <td><strong>${d.label}</strong> <span style="font-size: 10px; color: var(--text-secondary);">(${d.dateStr})</span></td>
                <td class="num-col">${d.scanned}</td>
                <td class="num-col" style="color: ${d.applied > 0 ? 'var(--accent-success)' : 'inherit'};">${d.applied}</td>
                <td class="num-col" style="color: ${d.saved > 0 ? 'var(--accent-warning)' : 'inherit'};">${d.saved}</td>
                <td class="num-col">${d.skipped}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight: 700; border-top: 1px solid var(--border-color);">
              <td>Total</td>
              <td class="num-col">${scannedSum}</td>
              <td class="num-col" style="color: var(--accent-success);">${appliedSum}</td>
              <td class="num-col" style="color: var(--accent-warning);">${savedSum}</td>
              <td class="num-col">${skippedSum}</td>
            </tr>
          </tfoot>
        </table>
      `;

      const weeklyReasons = {};
      days.forEach(d => {
        const r = history[d.dateKey];
        if (r && r.skipReasons) {
          Object.entries(r.skipReasons).forEach(([k, v]) => {
            weeklyReasons[k] = (weeklyReasons[k] || 0) + v;
          });
        }
      });
      renderDropoffAnalytics(weeklyReasons, skippedSum);
    } else if (period === 'monthly') {
      const year = now.getFullYear();
      const month = now.getMonth();
      const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
      const monthName = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

      let scannedSum = 0, appliedSum = 0, savedSum = 0, skippedSum = 0, sessSum = 0;
      const monthEntries = [];

      Object.keys(history).sort().forEach(k => {
        if (k.startsWith(monthPrefix)) {
          const r = history[k];
          scannedSum += (r.scanned || 0);
          appliedSum += (r.applied || 0);
          savedSum += (r.saved || 0);
          skippedSum += (r.skipped || 0);
          sessSum += (r.sessions || (r.scanned > 0 ? 1 : 0));
          monthEntries.push({
            dateKey: k,
            dateStr: new Date(k + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' }),
            ...r
          });
        }
      });

      logsPeriodLabel.textContent = monthName;
      logsSessionsCount.textContent = `${sessSum} ${sessSum === 1 ? 'Session' : 'Sessions'} in ${now.toLocaleDateString(undefined, { month: 'short' })}`;

      logsMetricScanned.textContent = scannedSum;
      logsMetricApplied.textContent = appliedSum;
      logsMetricSaved.textContent = savedSum;
      logsMetricSkipped.textContent = skippedSum;

      const processed = appliedSum + savedSum;
      const targetJobs = Math.max(50, sessSum * 25);
      logsProgressTitle.textContent = 'Monthly Progress';
      logsProgressText.textContent = `${processed} / ${targetJobs} Jobs`;
      logsProgressBarFill.style.width = `${Math.min(100, Math.round((processed / targetJobs) * 100))}%`;

      logsTableHeading.textContent = `Daily Breakdown (${now.toLocaleDateString(undefined, { month: 'short' })})`;

      if (monthEntries.length === 0) {
        logsBreakdownContainer.innerHTML = `<div style="text-align: center; color: var(--text-secondary); padding: 25px 10px; font-size: 11.5px;">No activity logged yet for ${monthName}.</div>`;
      } else {
        logsBreakdownContainer.innerHTML = `
          <table class="logs-table">
            <thead>
              <tr>
                <th>Date</th>
                <th class="num-col">Scanned</th>
                <th class="num-col">Applied</th>
                <th class="num-col">Saved</th>
                <th class="num-col">Skipped</th>
              </tr>
            </thead>
            <tbody>
              ${monthEntries.slice().reverse().map(d => `
                <tr>
                  <td>${d.dateStr}</td>
                  <td class="num-col">${d.scanned || 0}</td>
                  <td class="num-col" style="color: ${(d.applied || 0) > 0 ? 'var(--accent-success)' : 'inherit'};">${d.applied || 0}</td>
                  <td class="num-col" style="color: ${(d.saved || 0) > 0 ? 'var(--accent-warning)' : 'inherit'};">${d.saved || 0}</td>
                  <td class="num-col">${d.skipped || 0}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="font-weight: 700; border-top: 1px solid var(--border-color);">
                <td>Total</td>
                <td class="num-col">${scannedSum}</td>
                <td class="num-col" style="color: var(--accent-success);">${appliedSum}</td>
                <td class="num-col" style="color: var(--accent-warning);">${savedSum}</td>
                <td class="num-col">${skippedSum}</td>
              </tr>
            </tfoot>
          </table>
        `;
      }

      const monthlyReasons = {};
      monthEntries.forEach(m => {
        if (m.skipReasons) {
          Object.entries(m.skipReasons).forEach(([k, v]) => {
            monthlyReasons[k] = (monthlyReasons[k] || 0) + v;
          });
        }
      });
      renderDropoffAnalytics(monthlyReasons, skippedSum);
    } else if (period === 'yearly') {
      const currentYear = now.getFullYear();
      const yearPrefix = `${currentYear}-`;

      let scannedSum = 0, appliedSum = 0, savedSum = 0, skippedSum = 0, sessSum = 0;
      const monthBuckets = Array.from({ length: 12 }, (_, i) => {
        const m = String(i + 1).padStart(2, '0');
        const monthDate = new Date(currentYear, i, 1);
        return {
          monthKey: `${currentYear}-${m}`,
          monthName: monthDate.toLocaleDateString(undefined, { month: 'short' }),
          scanned: 0,
          applied: 0,
          saved: 0,
          skipped: 0,
          sessions: 0
        };
      });

      Object.keys(history).forEach(k => {
        if (k.startsWith(yearPrefix)) {
          const r = history[k];
          const mIdx = parseInt(k.substring(5, 7), 10) - 1;
          if (mIdx >= 0 && mIdx < 12) {
            monthBuckets[mIdx].scanned += (r.scanned || 0);
            monthBuckets[mIdx].applied += (r.applied || 0);
            monthBuckets[mIdx].saved += (r.saved || 0);
            monthBuckets[mIdx].skipped += (r.skipped || 0);
            monthBuckets[mIdx].sessions += (r.sessions || (r.scanned > 0 ? 1 : 0));
          }
          scannedSum += (r.scanned || 0);
          appliedSum += (r.applied || 0);
          savedSum += (r.saved || 0);
          skippedSum += (r.skipped || 0);
          sessSum += (r.sessions || (r.scanned > 0 ? 1 : 0));
        }
      });

      logsPeriodLabel.textContent = `Year ${currentYear}`;
      logsSessionsCount.textContent = `${sessSum} ${sessSum === 1 ? 'Session' : 'Sessions'} in ${currentYear}`;

      logsMetricScanned.textContent = scannedSum;
      logsMetricApplied.textContent = appliedSum;
      logsMetricSaved.textContent = savedSum;
      logsMetricSkipped.textContent = skippedSum;

      const processed = appliedSum + savedSum;
      const targetJobs = Math.max(100, sessSum * 25);
      logsProgressTitle.textContent = 'Yearly Progress';
      logsProgressText.textContent = `${processed} / ${targetJobs} Jobs`;
      logsProgressBarFill.style.width = `${Math.min(100, Math.round((processed / targetJobs) * 100))}%`;

      logsTableHeading.textContent = `Monthly Summary (${currentYear})`;
      logsBreakdownContainer.innerHTML = `
        <table class="logs-table">
          <thead>
            <tr>
              <th>Month</th>
              <th class="num-col">Scanned</th>
              <th class="num-col">Applied</th>
              <th class="num-col">Saved</th>
              <th class="num-col">Skipped</th>
            </tr>
          </thead>
          <tbody>
            ${monthBuckets.filter(m => m.scanned > 0 || m.applied > 0 || m.saved > 0 || m.skipped > 0).length > 0
              ? monthBuckets.filter(m => m.scanned > 0 || m.applied > 0 || m.saved > 0 || m.skipped > 0).map(m => `
                <tr>
                  <td><strong>${m.monthName}</strong></td>
                  <td class="num-col">${m.scanned}</td>
                  <td class="num-col" style="color: ${m.applied > 0 ? 'var(--accent-success)' : 'inherit'};">${m.applied}</td>
                  <td class="num-col" style="color: ${m.saved > 0 ? 'var(--accent-warning)' : 'inherit'};">${m.saved}</td>
                  <td class="num-col">${m.skipped}</td>
                </tr>
              `).join('')
              : monthBuckets.slice(0, now.getMonth() + 1).map(m => `
                <tr>
                  <td><strong>${m.monthName}</strong></td>
                  <td class="num-col">${m.scanned}</td>
                  <td class="num-col">${m.applied}</td>
                  <td class="num-col">${m.saved}</td>
                  <td class="num-col">${m.skipped}</td>
                </tr>
              `).join('')}
          </tbody>
          <tfoot>
            <tr style="font-weight: 700; border-top: 1px solid var(--border-color);">
              <td>Total</td>
              <td class="num-col">${scannedSum}</td>
              <td class="num-col" style="color: var(--accent-success);">${appliedSum}</td>
              <td class="num-col" style="color: var(--accent-warning);">${savedSum}</td>
              <td class="num-col">${skippedSum}</td>
            </tr>
          </tfoot>
        </table>
      `;

      const yearlyReasons = {};
      Object.keys(history).forEach(k => {
        if (k.startsWith(yearPrefix) && history[k].skipReasons) {
          Object.entries(history[k].skipReasons).forEach(([subK, v]) => {
            yearlyReasons[subK] = (yearlyReasons[subK] || 0) + v;
          });
        }
      });
      renderDropoffAnalytics(yearlyReasons, skippedSum);
    }
  }

  btnExportLogs.addEventListener('click', async () => {
    const data = await chrome.storage.local.get(['analyticsHistory', 'sessionHistory']);
    const history = data.analyticsHistory || {};
    const sessions = data.sessionHistory || [];

    if (Object.keys(history).length === 0 && sessions.length === 0) {
      alert('No analytics history to export yet!');
      return;
    }

    let csv = '=== DAILY ANALYTICS SUMMARY ===\n';
    csv += 'Date,Scanned,Applied,Saved,Skipped,Sessions,LastUpdated\n';
    const dates = Object.keys(history).sort();
    dates.forEach(d => {
      const r = history[d];
      csv += `"${d}",${r.scanned || 0},${r.applied || 0},${r.saved || 0},${r.skipped || 0},${r.sessions || 0},"${r.lastUpdated ? new Date(r.lastUpdated).toISOString() : ''}"\n`;
    });

    if (sessions.length > 0) {
      csv += '\n=== SESSION RUN DETAILS ===\n';
      csv += 'SessionID,Date,StartTime,EndTime,Query,Location,Scanned,Applied,Saved,Skipped,Status\n';
      sessions.forEach(s => {
        const escape = (val) => `"${String(val || '').replace(/"/g, '""')}"`;
        const start = s.startTime ? new Date(s.startTime).toISOString() : '';
        const end = s.endTime ? new Date(s.endTime).toISOString() : '';
        csv += `${escape(s.id)},${escape(s.date)},${escape(start)},${escape(end)},${escape(s.query)},${escape(s.location)},${s.stats?.scanned || 0},${s.stats?.applied || 0},${s.stats?.saved || 0},${s.stats?.skipped || 0},${escape(s.status)}\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `indeed_auto_applier_analytics_${getLocalDateKey()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  btnClearHistory.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all historical logs and analytics? This cannot be undone.')) {
      chrome.runtime.sendMessage({ action: 'CLEAR_ANALYTICS_HISTORY' }, () => {
        renderAnalytics(currentLogsPeriod);
      });
    }
  });

  btnStart.addEventListener('click', async () => {
    const customSettings = {
      targetJobQuery: ruleQuery.value.trim() || 'Data Analyst',
      targetLocation: ruleLocation.value.trim() || 'City, State',
      userYearsExp: parseFloat(ruleExp.value) || 1,
      minMonthlySalary: parseInt(ruleSalary.value, 10) || 25000,
      unlistedExpAction: ruleUnlistedExp.value,
      maxJobsPerSession: parseInt(ruleMaxJobs.value, 10) || 25,
      stepDelayMs: parseInt(ruleDelay.value, 10) || 1500,
      blacklistKeywords: ruleBlacklist.value.trim(),
      blockedCompanies: (ruleCompanyBlacklist?.value || '').trim(),
      targetResumeName: ruleTargetResume.value.trim(),
      strictLocation: ruleStrictLocation.checked,
      easyApplyOnly: !!ruleEasyApplyOnly?.checked
    };

    await chrome.storage.local.set({ autoApplierSettings: customSettings });

    btnStart.disabled = true;
    btnStop.disabled = false;
    sessionBadge.textContent = 'Starting...';
    sessionBadge.className = 'status-badge status-running';

    chrome.runtime.sendMessage({ action: 'START_AUTO_APPLY', settings: customSettings }, (response) => {
      if (response && response.success) {
        sessionBadge.textContent = 'Running';
      } else {
        sessionBadge.textContent = 'Error';
        btnStart.disabled = false;
        btnStop.disabled = true;
      }
    });
  });

  btnStop.addEventListener('click', () => {
    btnStop.disabled = true;
    chrome.runtime.sendMessage({ action: 'STOP_AUTO_APPLY' }, () => {
      sessionBadge.textContent = 'Stopped';
      sessionBadge.className = 'status-badge status-idle';
      btnStart.disabled = false;
    });
  });

  btnSaveRules.addEventListener('click', async () => {
    const updated = {
      targetJobQuery: ruleQuery.value.trim(),
      targetLocation: ruleLocation.value.trim(),
      userYearsExp: parseFloat(ruleExp.value) || 1,
      minMonthlySalary: parseInt(ruleSalary.value, 10) || 25000,
      unlistedExpAction: ruleUnlistedExp.value,
      maxJobsPerSession: parseInt(ruleMaxJobs.value, 10) || 25,
      stepDelayMs: parseInt(ruleDelay.value, 10) || 1500,
      blacklistKeywords: ruleBlacklist.value.trim(),
      blockedCompanies: (ruleCompanyBlacklist?.value || '').trim(),
      targetResumeName: ruleTargetResume.value.trim(),
      strictLocation: ruleStrictLocation.checked,
      easyApplyOnly: !!ruleEasyApplyOnly?.checked
    };

    await chrome.storage.local.set({ autoApplierSettings: updated });
    btnSaveRules.textContent = '✅ Saved!';
    setTimeout(() => { btnSaveRules.textContent = 'Save Rules & Filters'; }, 1500);
  });

  btnSaveProfile.addEventListener('click', async () => {
    const data = await chrome.storage.local.get(['userProfile']);
    const prof = data.userProfile || {};

    if (!prof.personal) prof.personal = {};
    prof.personal.fullName = profFullName.value.trim();
    prof.personal.phone = profPhone.value.trim();
    prof.personal.email = profEmail.value.trim();
    prof.personal.city = profCity.value.trim();

    if (!prof.work) prof.work = {};
    if (!prof.work.currentRole) prof.work.currentRole = {};
    prof.work.currentRole.jobTitle = profCurrTitle.value.trim();
    prof.work.currentRole.company = profCurrCompany.value.trim();
    prof.work.currentRole.yearsExperience = profYearsExp.value.trim();

    if (!prof.work.targetRole) prof.work.targetRole = {};
    prof.work.targetRole.noticePeriod = profNotice.value.trim();

    await chrome.storage.local.set({ userProfile: prof });
    btnSaveProfile.textContent = '✅ Profile Saved!';
    setTimeout(() => { btnSaveProfile.textContent = 'Save Profile Details'; }, 1500);
  });

  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'NEW_LOG' && request.log) {
      appendLogToUI(request.log);
    }
    if (request.action === 'STATS_UPDATED' && request.stats) {
      metricScanned.textContent = request.stats.scanned || 0;
      metricApplied.textContent = request.stats.applied || 0;
      metricSaved.textContent = request.stats.saved || 0;
      metricSkipped.textContent = request.stats.skipped || 0;

      const maxJobs = parseInt(ruleMaxJobs.value, 10) || 25;
      const processed = (request.stats.applied || 0) + (request.stats.saved || 0);
      progressText.textContent = `${processed} / ${maxJobs} Jobs`;
      const pct = Math.min(100, Math.round((processed / maxJobs) * 100));
      progressBarFill.style.width = `${pct}%`;

      renderAnalytics(currentLogsPeriod);
    }
    if (request.action === 'ANALYTICS_UPDATED') {
      renderAnalytics(currentLogsPeriod);
    }
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.autoApplySession) {
        updateSessionUI(changes.autoApplySession.newValue);
      }
      if (changes.savedJobs) {
        renderSavedJobs(changes.savedJobs.newValue || []);
      }
      if (changes.appliedJobs) {
        renderAppliedJobs(changes.appliedJobs.newValue || []);
      }
      if (changes.userProfile) {
        renderQaBank(changes.userProfile.newValue?.screening || []);
      }
      if (changes.analyticsHistory || changes.sessionHistory) {
        renderAnalytics(currentLogsPeriod);
      }
    }
  });

  await loadInitialData();
});
