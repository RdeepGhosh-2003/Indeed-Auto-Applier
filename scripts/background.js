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

// Helper to get local date key formatted as YYYY-MM-DD
function getLocalDateKey(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Update session statistics and persistent daily analytics
async function updateSessionStats(delta) {
  try {
    const data = await chrome.storage.local.get(['autoApplySession', 'analyticsHistory']);
    const session = data.autoApplySession || { isRunning: false, stats: { scanned: 0, applied: 0, saved: 0, skipped: 0 } };
    session.skipReasons = session.skipReasons || { blacklist: 0, location: 0, salary: 0, experience: 0, senior: 0, company: 0, easy_apply: 0, unrecognized: 0 };
    
    if (delta.scanned) session.stats.scanned = (session.stats.scanned || 0) + delta.scanned;
    if (delta.applied) session.stats.applied = (session.stats.applied || 0) + delta.applied;
    if (delta.saved) session.stats.saved = (session.stats.saved || 0) + delta.saved;
    if (delta.skipped) {
      session.stats.skipped = (session.stats.skipped || 0) + delta.skipped;
      if (delta.reason) {
        session.skipReasons[delta.reason] = (session.skipReasons[delta.reason] || 0) + delta.skipped;
      }
    }

    const today = getLocalDateKey();
    const history = data.analyticsHistory || {};
    if (!history[today]) {
      history[today] = {
        date: today,
        scanned: 0,
        applied: 0,
        saved: 0,
        skipped: 0,
        sessions: session.isRunning ? 1 : 0,
        skipReasons: { blacklist: 0, location: 0, salary: 0, experience: 0, senior: 0, company: 0, easy_apply: 0, unrecognized: 0 },
        lastUpdated: Date.now()
      };
    }
    history[today].skipReasons = history[today].skipReasons || { blacklist: 0, location: 0, salary: 0, experience: 0, senior: 0, company: 0, easy_apply: 0, unrecognized: 0 };

    if (delta.scanned) history[today].scanned = (history[today].scanned || 0) + delta.scanned;
    if (delta.applied) history[today].applied = (history[today].applied || 0) + delta.applied;
    if (delta.saved) history[today].saved = (history[today].saved || 0) + delta.saved;
    if (delta.skipped) {
      history[today].skipped = (history[today].skipped || 0) + delta.skipped;
      if (delta.reason) {
        history[today].skipReasons[delta.reason] = (history[today].skipReasons[delta.reason] || 0) + delta.skipped;
      }
    }
    history[today].lastUpdated = Date.now();

    await chrome.storage.local.set({ 
      autoApplySession: session,
      analyticsHistory: history
    });

    chrome.runtime.sendMessage({ action: 'STATS_UPDATED', stats: session.stats, skipReasons: session.skipReasons }).catch(() => {});
    chrome.runtime.sendMessage({ action: 'ANALYTICS_UPDATED', history }).catch(() => {});
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

  if (request.action === 'CLEAR_ANALYTICS_HISTORY') {
    chrome.storage.local.set({ analyticsHistory: {}, sessionHistory: [] }, () => {
      chrome.runtime.sendMessage({ action: 'ANALYTICS_UPDATED', history: {} }).catch(() => {});
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'NOTIFY_CAPTCHA' && sender.tab) {
    const tabId = sender.tab.id;
    const windowId = sender.tab.windowId;
    const notifId = `captcha_${tabId}_${Date.now()}`;
    notificationTabMap.set(notifId, { tabId, windowId });

    // Relay chime to active tab
    chrome.tabs.sendMessage(tabId, { action: 'PLAY_ALERT_CHIME' }).catch(() => {});

    if (chrome.notifications) {
      try {
        chrome.notifications.create(notifId, {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon48.png'),
          title: '⚠️ CAPTCHA Verification Required!',
          message: 'Indeed application requires CAPTCHA verification. Click here to solve it.',
          priority: 2,
          requireInteraction: true
        }, () => {
          if (chrome.runtime.lastError) {
            console.warn('[Background] Notification error:', chrome.runtime.lastError.message);
          }
        });
      } catch (err) {
        console.warn('[Background] Notification exception:', err);
      }
    }
    appendSessionLog('⚠️ CAPTCHA detected! Waiting for manual verification...', 'warning');
    sendResponse({ status: 'notified' });
    return true;
  }

  if (request.action === 'CHECK_CRAWLER_TAB') {
    chrome.storage.local.get(['autoApplySession'], (data) => {
      const session = data?.autoApplySession;
      const isAllowed = !!(session?.isRunning && sender.tab && session.tabId === sender.tab.id);
      sendResponse({ isAllowed, tabId: sender.tab?.id, sessionTabId: session?.tabId });
    });
    return true;
  }

  if (request.action === 'FORWARD_TO_ACTIVE_TAB' && request.message) {
    chrome.storage.local.get(['autoApplySession'], (data) => {
      const targetTabId = sender?.tab?.id || data?.autoApplySession?.tabId;
      if (!targetTabId) {
        sendResponse({ handled: false, reason: 'no_target_tab' });
        return;
      }
      chrome.tabs.sendMessage(targetTabId, request.message, (resp) => {
        if (chrome.runtime.lastError) {
          sendResponse({ handled: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse(resp || { handled: false });
        }
      });
    });
    return true;
  }

  if (request.action === 'QUERY_RESULTS_FINISHED') {
    if (sender && sender.frameId && sender.frameId !== 0) {
      sendResponse({ status: 'ignored' });
      return true;
    }
    handleQueryResultsFinished(request.summary)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.action === 'SESSION_COMPLETED') {
    if (sender && sender.frameId && sender.frameId !== 0) {
      console.warn('[Background] Ignored SESSION_COMPLETED from non-top frame:', sender.frameId);
      sendResponse({ status: 'ignored' });
      return true;
    }
    chrome.storage.local.get(['autoApplySession'], (data) => {
      if (sender?.tab?.id && data?.autoApplySession?.tabId && sender.tab.id !== data.autoApplySession.tabId) {
        console.warn('[Background] Ignored SESSION_COMPLETED from non-session tab:', sender.tab.id);
        sendResponse({ status: 'ignored' });
        return true;
      }
      handleSessionCompleted(request.summary);
      sendResponse({ status: 'ok' });
    });
    return true;
  }
});

// Start auto apply handler
async function handleStartAutoApply(customSettings) {
  const data = await chrome.storage.local.get(['userProfile', 'autoApplierSettings', 'analyticsHistory']);
  const profile = data.userProfile || {};
  const settings = Object.assign({}, profile.autoApplierSettings || {}, data.autoApplierSettings || {}, customSettings || {});

  const rawQuery = settings.targetJobQuery || profile.work?.targetRole?.jobTitle || 'MIS Analyst';
  const queryQueue = rawQuery.split(/[,;]/).map(q => q.trim()).filter(q => q.length > 0);
  if (queryQueue.length === 0) queryQueue.push('MIS Analyst');

  const currentQueryIndex = 0;
  const currentQuery = queryQueue[currentQueryIndex];
  const query = encodeURIComponent(currentQuery);
  const loc = encodeURIComponent(settings.targetLocation || profile.work?.targetRole?.targetLocation || 'Bangalore, Karnataka');

  // Date posted filter: 'fromage=1' for Last 24 hours, sorted by date (newest first)
  let searchUrl = `https://in.indeed.com/jobs?q=${query}&l=${loc}&fromage=1&sort=date`;

  const sessionId = 'sess_' + Date.now();
  const session = {
    sessionId: sessionId,
    isRunning: true,
    startTime: Date.now(),
    settings: settings,
    queryQueue: queryQueue,
    currentQueryIndex: currentQueryIndex,
    stats: { scanned: 0, applied: 0, saved: 0, skipped: 0 },
    skipReasons: { blacklist: 0, location: 0, salary: 0, experience: 0, senior: 0, company: 0, easy_apply: 0, unrecognized: 0 },
    processedJks: []
  };

  const today = getLocalDateKey();
  const history = data.analyticsHistory || {};
  if (!history[today]) {
    history[today] = {
      date: today,
      scanned: 0,
      applied: 0,
      saved: 0,
      skipped: 0,
      sessions: 0,
      skipReasons: { blacklist: 0, location: 0, salary: 0, experience: 0, senior: 0, company: 0, easy_apply: 0, unrecognized: 0 },
      lastUpdated: Date.now()
    };
  }
  history[today].sessions = (history[today].sessions || 0) + 1;
  history[today].lastUpdated = Date.now();

  await chrome.storage.local.set({
    autoApplySession: session,
    sessionLogs: [],
    analyticsHistory: history
  });

  const queueLabel = queryQueue.length > 1 ? `role [1/${queryQueue.length}: "${currentQuery}"] (Queue: ${queryQueue.join(', ')})` : `"${currentQuery}"`;
  await appendSessionLog(`🚀 Auto-Apply session started for ${queueLabel} in "${settings.targetLocation || 'Bangalore'}" (Filter: Last 24 Hours)`, 'info');

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
  const data = await chrome.storage.local.get(['autoApplySession', 'sessionHistory']);
  const session = data.autoApplySession || {};
  session.isRunning = false;

  if (session.startTime) {
    const sessionHistory = data.sessionHistory || [];
    sessionHistory.unshift({
      id: session.sessionId || ('sess_' + session.startTime),
      date: getLocalDateKey(new Date(session.startTime)),
      startTime: session.startTime,
      endTime: Date.now(),
      query: (session.queryQueue && session.queryQueue.length > 1) ? session.queryQueue.join(', ') : (session.settings?.targetJobQuery || 'Job Search'),
      location: session.settings?.targetLocation || '',
      maxJobs: session.settings?.maxJobsPerSession || 25,
      stats: { ...(session.stats || { scanned: 0, applied: 0, saved: 0, skipped: 0 }) },
      skipReasons: { ...(session.skipReasons || {}) },
      status: 'stopped'
    });
    if (sessionHistory.length > 100) sessionHistory.pop();
    await chrome.storage.local.set({ autoApplySession: session, sessionHistory });
  } else {
    await chrome.storage.local.set({ autoApplySession: session });
  }

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

  const existingIndex = saved.findIndex(j => (job.jk && j.jk === job.jk) || (job.url && j.url === job.url) || (j.title === job.title && j.company === job.company));
  if (existingIndex === -1) {
    job.savedAt = new Date().toISOString();
    saved.unshift(job);
    await chrome.storage.local.set({ savedJobs: saved });
    await updateSessionStats({ saved: 1 });
    await appendSessionLog(`📋 Saved Job: "${job.title}" at "${job.company}" (${job.reason || 'Company Site / Review'})`, 'success');
  } else {
    saved[existingIndex].savedAt = new Date().toISOString();
    if (job.reason) saved[existingIndex].reason = job.reason;
    await chrome.storage.local.set({ savedJobs: saved });
    await updateSessionStats({ saved: 1 });
    await appendSessionLog(`📋 Updated Saved Job: "${job.title}" (${job.reason || 'Review'})`, 'info');
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

// Query results finished - advance multi-role queue or complete session
async function handleQueryResultsFinished(summary) {
  const data = await chrome.storage.local.get(['autoApplySession']);
  const session = data.autoApplySession;
  if (!session || !session.isRunning) return { completed: true };

  const queue = session.queryQueue || [];
  const nextIndex = (session.currentQueryIndex || 0) + 1;

  if (nextIndex < queue.length) {
    session.currentQueryIndex = nextIndex;
    const nextQuery = queue[nextIndex];
    const query = encodeURIComponent(nextQuery);
    const loc = encodeURIComponent(session.settings?.targetLocation || 'Bangalore, Karnataka');
    const searchUrl = `https://in.indeed.com/jobs?q=${query}&l=${loc}&fromage=1&sort=date`;

    await appendSessionLog(`🔄 Multi-Role Queue: Advancing to next role [${nextIndex + 1}/${queue.length}]: "${nextQuery}"...`, 'info');
    await chrome.storage.local.set({ autoApplySession: session });

    if (session.tabId) {
      try {
        await chrome.tabs.update(session.tabId, { url: searchUrl, active: true });
        return { advanced: true, query: nextQuery };
      } catch (err) {
        console.warn('[Background] Failed to navigate session tab to next query:', err);
      }
    }
  }

  // All queries in queue finished!
  await handleSessionCompleted(summary || session.stats);
  return { completed: true };
}

// Session complete handler
async function handleSessionCompleted(summary = {}) {
  const data = await chrome.storage.local.get(['autoApplySession', 'sessionHistory']);
  const session = data.autoApplySession || {};
  session.isRunning = false;

  if (session.startTime) {
    const sessionHistory = data.sessionHistory || [];
    sessionHistory.unshift({
      id: session.sessionId || ('sess_' + session.startTime),
      date: getLocalDateKey(new Date(session.startTime)),
      startTime: session.startTime,
      endTime: Date.now(),
      query: (session.queryQueue && session.queryQueue.length > 1) ? session.queryQueue.join(', ') : (session.settings?.targetJobQuery || 'Job Search'),
      location: session.settings?.targetLocation || '',
      maxJobs: session.settings?.maxJobsPerSession || 25,
      stats: {
        scanned: session.stats?.scanned || 0,
        applied: summary.applied !== undefined ? summary.applied : (session.stats?.applied || 0),
        saved: summary.saved !== undefined ? summary.saved : (session.stats?.saved || 0),
        skipped: summary.skipped !== undefined ? summary.skipped : (session.stats?.skipped || 0)
      },
      skipReasons: { ...(session.skipReasons || {}) },
      status: 'completed'
    });
    if (sessionHistory.length > 100) sessionHistory.pop();
    await chrome.storage.local.set({ autoApplySession: session, sessionHistory });
  } else {
    await chrome.storage.local.set({ autoApplySession: session });
  }

  const msg = `🎉 Session completed! Applied: ${summary.applied || 0}, Saved: ${summary.saved || 0}, Skipped: ${summary.skipped || 0}`;
  await appendSessionLog(msg, 'success');

  if (chrome.notifications) {
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon48.png'),
        title: '🎯 Indeed Auto-Applier Finished!',
        message: msg,
        priority: 1
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn('[Background] Notification error:', chrome.runtime.lastError.message);
        }
      });
    } catch (err) {
      console.warn('[Background] Notification exception:', err);
    }
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
            autoApplySession: { isRunning: false, stats: { scanned: 0, applied: 0, saved: 0, skipped: 0 }, skipReasons: { blacklist: 0, location: 0, salary: 0, experience: 0, senior: 0, company: 0, easy_apply: 0, unrecognized: 0 } },
            analyticsHistory: {},
            sessionHistory: []
          }, () => {
            console.log('[Auto-Applier Background] Default profile initialized.');
          });
        })
        .catch(err => console.error('[Auto-Applier Background] Install init error:', err));
    }
  });
});
