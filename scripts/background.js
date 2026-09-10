/**
 * Indeed Auto-Applier - Background Service Worker (Manifest V3)
 * Manages auto-apply sessions, tab navigation, notification alerts, and data persistence.
 */

const notificationTabMap = new Map();

// Helper to push a live log message to storage and broadcast to popup
async function appendSessionLog(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const logItem = { timestamp, message, type };

  try {
    const data = await chrome.storage.local.get(['sessionLogs', 'autoApplySession']);
    const logs = data.sessionLogs || [];
    logs.push(logItem);
    if (logs.length > 150) logs.shift();

    await chrome.storage.local.set({ sessionLogs: logs });
    chrome.runtime.sendMessage({ action: 'NEW_LOG', log: logItem }).catch(() => {});
  } catch (err) {
    console.error('[Background] Failed to append log:', err);
  }
}

// Update session statistics
async function updateSessionStats(delta) {
  try {
    const data = await chrome.storage.local.get(['autoApplySession']);
    const session = data.autoApplySession || { isRunning: false, stats: { scanned: 0, applied: 0, saved: 0, skipped: 0 } };
    
    if (delta.scanned) session.stats.scanned = (session.stats.scanned || 0) + delta.scanned;
    if (delta.applied) session.stats.applied = (session.stats.applied || 0) + delta.applied;
    if (delta.saved) session.stats.saved = (session.stats.saved || 0) + delta.saved;
    if (delta.skipped) session.stats.skipped = (session.stats.skipped || 0) + delta.skipped;

    await chrome.storage.local.set({ autoApplySession: session });
    chrome.runtime.sendMessage({ action: 'STATS_UPDATED', stats: session.stats }).catch(() => {});
  } catch (err) {
    console.error('[Background] Failed to update stats:', err);
  }
}

// Runtime message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'START_AUTO_APPLY') {
    handleStartAutoApply(request.settings)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'STOP_AUTO_APPLY') {
    handleStopAutoApply()
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'APPEND_LOG') {
    appendSessionLog(request.message, request.logType || 'info');
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'UPDATE_STATS') {
    updateSessionStats(request.delta || {});
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'SAVE_JOB' && request.job) {
    handleSaveJob(request.job)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'JOB_APPLIED' && request.job) {
    handleJobApplied(request.job)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'NOTIFY_CAPTCHA' && sender.tab) {
    const tabId = sender.tab.id;
    const windowId = sender.tab.windowId;
    const notifId = `captcha_${tabId}_${Date.now()}`;
    notificationTabMap.set(notifId, { tabId, windowId });

    if (chrome.notifications) {
      chrome.notifications.create(notifId, {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: '⚠️ CAPTCHA Verification Required!',
        message: 'Indeed application requires CAPTCHA verification. Click here to solve it.',
        priority: 2,
        requireInteraction: true
      });
    }
    appendSessionLog('⚠️ CAPTCHA detected! Waiting for manual verification...', 'warning');
    sendResponse({ status: 'notified' });
    return true;
  }

  if (request.action === 'FORWARD_TO_ACTIVE_TAB' && request.message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        sendResponse({ handled: false, reason: 'no_active_tab' });
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, request.message, (resp) => {
        if (chrome.runtime.lastError) {
          sendResponse({ handled: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse(resp || { handled: false });
        }
      });
    });
    return true;
  }

  if (request.action === 'SESSION_COMPLETED') {
    if (sender && sender.frameId && sender.frameId !== 0) {
      console.warn('[Background] Ignored SESSION_COMPLETED from non-top frame:', sender.frameId);
      sendResponse({ status: 'ignored' });
      return true;
    }
    handleSessionCompleted(request.summary);
    sendResponse({ status: 'ok' });
    return true;
  }
});

// Start auto apply handler
async function handleStartAutoApply(customSettings) {
  const data = await chrome.storage.local.get(['userProfile', 'autoApplierSettings']);
  const profile = data.userProfile || {};
  const settings = Object.assign({}, profile.autoApplierSettings || {}, data.autoApplierSettings || {}, customSettings || {});

  const query = encodeURIComponent(settings.targetJobQuery || profile.work?.targetRole?.jobTitle || 'MIS Analyst');
  const loc = encodeURIComponent(settings.targetLocation || profile.work?.targetRole?.targetLocation || 'Bangalore, Karnataka');

  // Date posted filter: 'fromage=1' for Last 24 hours, sorted by date (newest first)
  let searchUrl = `https://in.indeed.com/jobs?q=${query}&l=${loc}&fromage=1&sort=date`;

  const session = {
    isRunning: true,
    startTime: Date.now(),
    settings: settings,
    stats: { scanned: 0, applied: 0, saved: 0, skipped: 0 },
    processedJks: []
  };

  await chrome.storage.local.set({
    autoApplySession: session,
    sessionLogs: []
  });

  await appendSessionLog(`🚀 Auto-Apply session started for "${settings.targetJobQuery || 'MIS Analyst'}" in "${settings.targetLocation || 'Bangalore'}" (Filter: Last 24 Hours)`, 'info');

  const tabs = await chrome.tabs.query({ url: ['https://*.indeed.com/jobs*', 'https://indeed.com/jobs*'] });
  let targetTab;

  if (tabs.length > 0) {
    targetTab = tabs[0];
    await chrome.tabs.update(targetTab.id, { url: searchUrl, active: true });
    await appendSessionLog(`Navigating existing Indeed tab #${targetTab.id} to search URL...`, 'info');
  } else {
    targetTab = await chrome.tabs.create({ url: searchUrl, active: true });
    await appendSessionLog(`Opened new Indeed tab #${targetTab.id}...`, 'info');
  }

  session.tabId = targetTab.id;
  await chrome.storage.local.set({ autoApplySession: session });

  return { success: true, tabId: targetTab.id };
}

// Stop auto apply handler
async function handleStopAutoApply() {
  const data = await chrome.storage.local.get(['autoApplySession']);
  const session = data.autoApplySession || {};
  session.isRunning = false;

  await chrome.storage.local.set({ autoApplySession: session });
  await appendSessionLog('⏹ Auto-Apply session stopped by user.', 'warning');

  const tabs = await chrome.tabs.query({ url: ['https://*.indeed.com/*', 'https://*.indeedapply.com/*'] });
  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, { action: 'HALT_SESSION' }).catch(() => {});
  }

  return { success: true };
}

// Save job handler
async function handleSaveJob(job) {
  const data = await chrome.storage.local.get(['savedJobs']);
  const saved = data.savedJobs || [];

  const exists = saved.some(j => (job.jk && j.jk === job.jk) || (job.url && j.url === job.url) || (j.title === job.title && j.company === job.company));
  if (!exists) {
    job.savedAt = new Date().toISOString();
    saved.unshift(job);
    await chrome.storage.local.set({ savedJobs: saved });
    await updateSessionStats({ saved: 1 });
    await appendSessionLog(`📋 Saved Job: "${job.title}" at "${job.company}" (${job.reason || 'Company Site / Review'})`, 'success');
  } else {
    await appendSessionLog(`ℹ️ Job already in saved list: "${job.title}"`, 'info');
  }
  return { success: true, savedCount: saved.length };
}

// Applied job handler
async function handleJobApplied(job) {
  const data = await chrome.storage.local.get(['appliedJobs']);
  const applied = data.appliedJobs || [];

  job.appliedAt = new Date().toISOString();
  applied.unshift(job);
  await chrome.storage.local.set({ appliedJobs: applied });
  await updateSessionStats({ applied: 1 });
  await appendSessionLog(`✅ Successfully applied: "${job.title}" at "${job.company}"!`, 'success');

  return { success: true, appliedCount: applied.length };
}

// Session complete handler
async function handleSessionCompleted(summary = {}) {
  const data = await chrome.storage.local.get(['autoApplySession']);
  const session = data.autoApplySession || {};
  session.isRunning = false;
  await chrome.storage.local.set({ autoApplySession: session });

  const msg = `🎉 Session completed! Applied: ${summary.applied || 0}, Saved: ${summary.saved || 0}, Skipped: ${summary.skipped || 0}`;
  await appendSessionLog(msg, 'success');

  if (chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: '🎯 Indeed Auto-Applier Finished!',
      message: msg,
      priority: 1
    });
  }
}

// Notification click to switch to CAPTCHA tab
if (chrome.notifications) {
  chrome.notifications.onClicked.addListener((notifId) => {
    const target = notificationTabMap.get(notifId);
    if (target) {
      chrome.tabs.update(target.tabId, { active: true });
      chrome.windows.update(target.windowId, { focused: true });
      chrome.notifications.clear(notifId);
      notificationTabMap.delete(notifId);
    }
  });
}

// Initialize default profile and settings on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['userProfile'], (result) => {
    if (!result.userProfile) {
      fetch(chrome.runtime.getURL('data/default_profile.json'))
        .then(res => res.json())
        .then(data => {
          chrome.storage.local.set({
            userProfile: data,
            savedJobs: [],
            appliedJobs: [],
            sessionLogs: [],
            autoApplySession: { isRunning: false, stats: { scanned: 0, applied: 0, saved: 0, skipped: 0 } }
          }, () => {
            console.log('[Auto-Applier Background] Default profile initialized.');
          });
        })
        .catch(err => console.error('[Auto-Applier Background] Install init error:', err));
    }
  });
});
