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
  const ruleTargetResume = document.getElementById('rule-target-resume');
  const ruleStrictLocation = document.getElementById('rule-strict-location');
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

  const savedJobsContainer = document.getElementById('saved-jobs-container');
  const savedCountBadge = document.getElementById('saved-count-badge');
  const savedSearchInput = document.getElementById('saved-search-input');
  const btnExportSaved = document.getElementById('btn-export-saved');
  const btnClearSaved = document.getElementById('btn-clear-saved');

  const tabButtons = document.querySelectorAll('.nav-tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(btn.dataset.tab);
      if (targetPane) targetPane.classList.add('active');
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
      'savedJobs'
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
    ruleTargetResume.value = settings.targetResumeName || '';
    ruleStrictLocation.checked = settings.strictLocation !== false;

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

  function renderSavedJobs(jobs) {
    savedJobsContainer.innerHTML = '';
    savedCountBadge.textContent = jobs.length;

    const query = (savedSearchInput.value || '').toLowerCase().trim();
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

  savedSearchInput.addEventListener('input', async () => {
    const data = await chrome.storage.local.get(['savedJobs']);
    renderSavedJobs(data.savedJobs || []);
  });

  btnExportSaved.addEventListener('click', async () => {
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

  btnClearSaved.addEventListener('click', async () => {
    if (confirm('Are you sure you want to clear all saved jobs?')) {
      await chrome.storage.local.set({ savedJobs: [] });
      renderSavedJobs([]);
    }
  });

  btnClearLogs.addEventListener('click', async () => {
    await chrome.storage.local.set({ sessionLogs: [] });
    consoleLogs.innerHTML = '<div class="log-entry log-info">[System] Logs cleared.</div>';
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
      targetResumeName: ruleTargetResume.value.trim(),
      strictLocation: ruleStrictLocation.checked
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
      targetResumeName: ruleTargetResume.value.trim(),
      strictLocation: ruleStrictLocation.checked
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
    }
  });

  await loadInitialData();
});
