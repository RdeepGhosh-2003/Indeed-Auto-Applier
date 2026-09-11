# 📜 Indeed Auto-Applier — Official Changelog & Release Ledger

This document serves as the permanent chronological reference for all updates, features, architectural decisions, and bug fixes implemented in the **Indeed Auto-Applier** browser extension.

---

## 📌 Release Summary Table

| Version | Date & Timestamp | Type | Key Highlights |
|---|---|---|---|
| **`v1.1.0`** | 2026-09-11 12:45 IST | **Major Feature Suite** | Screening Q&A Bank Manager, Applied Jobs Tracker, Filter Drop-Off Analytics, Easy Apply Only Mode, Company Blacklist, Audio Chimes, Multi-Role Search Queue. |
| **`v1.0.8`** | 2026-09-11 11:56 IST | **UI / Spacing Fix** | Equalized navigation tab spacing across 500px popup body; added weekday names to Today/Yesterday in weekly log tables (`Today, Fri`, `Yesterday, Thu`). |
| **`v1.0.7`** | 2026-09-11 11:45 IST | **Feature Release** | Added dedicated `📊 Logs` tab with Daily, Weekly, Monthly, and Yearly rollups for Scanned, Applied, Saved, and Skipped metrics, plus CSV export. |
| **`v1.0.6`** | 2026-09-10 16:27 IST | **Bug Fix** | Resolved notification icon origin URL via `chrome.runtime.getURL('icons/icon48.png')` and wrapped callbacks to prevent Chromium image fetch warnings. |
| **`v1.0.5`** | 2026-09-10 16:15 IST | **Bug Fix** | Replaced negative keywords `.includes()` matching with exact word-boundary regex (`\b(?:intern|interns|internship)\b`) to prevent false skips on "Internet" / "internal". |
| **`v1.0.4`** | 2026-09-10 11:15 IST | **Stability Fix** | Introduced tab-lock authentication (`CHECK_CRAWLER_TAB`), unmasked child iframe wizard responses, and added stuck-step recovery for unhandled questions. |
| **`v1.0.3`** | 2026-09-10 10:45 IST | **Crawler Fix** | Card-to-details synchronization in `waitForJobDetails`, nested card deduplication, and disabled-state guards on pagination navigation. |
| **`v1.0.2`** | 2026-09-10 10:30 IST | **Bug Fix** | Eliminated self-referential call stack recursion in `persistProcessedJk`, cleared processed JK cache on session start, and updated pagination selectors. |
| **`v1.0.1`** | 2026-09-10 10:20 IST | **Stability Fix** | Top-window crawler isolation (preventing subframes from firing premature halts), background frameId checks, and cross-frame message unmasking. |
| **`v1.0.0`** | 2026-09-10 10:00 IST | **Production Release** | Negative keywords blacklist, strict location matching, floating in-page status pill with `[⏹ Stop]`, human delay jitter, and screening QA auto-learning. |
| **`v0.9.0`** | 2026-09-10 09:30 IST | **Engine Upgrade** | Unicode dash normalization, full job description pane reading for unscrollable tags, and qualification criteria guards before saving company site jobs. |
| **`v0.6.0`** | 2026-09-10 09:00 IST | **Crawler Core** | Job card scanning, salary floor parsing and normalization, experience requirement evaluator, and seniority checks. |
| **`v0.5.0`** | 2026-09-10 08:30 IST | **UI Dashboard** | Interactive popup dashboard, real-time activity log stream, metric counters, and CSV export. |
| **`v0.4.0`** | 2026-09-10 08:00 IST | **Service Worker** | MV3 background service worker with lifecycle control, tab navigation, and `fromage=1` & `sort=date` URL synthesis. |
| **`v0.3.0`** | 2026-09-10 07:30 IST | **Form Filler** | Autonomous multi-step Indeed application form filler, radio button selection, and CAPTCHA observation. |
| **`v0.2.0`** | 2026-09-10 07:00 IST | **Matcher Engine** | Fuzzy label scoring algorithm and synthetic React event dispatchers. |
| **`v0.1.0`** | 2026-09-10 06:30 IST | **Architecture Init** | Initial Manifest V3 manifest, branding icons, default profile, and workspace scaffolding. |

---

## 🔍 Detailed Version Records

### `v1.1.0` — Major Productivity & Intelligence Suite
- **Date**: September 11, 2026 (12:45 IST)
- **Commits**: `feat(suite): screening QA bank, applied jobs tracker, drop-off analytics, easy-apply mode, company blacklist, audio chimes, search queue`
- **Files Modified**: `popup/popup.html`, `popup/popup.css`, `popup/popup.js`, `scripts/applier.js`, `scripts/form-filler.js`, `scripts/background.js`, `manifest.json`, `CHANGELOG.md`, `walkthrough.md`.
- **What Was Added / Updated:**
  1. **🧠 Screening Q&A Bank Manager**: Interactive UI under the Profile tab to view, add, edit, or delete question & answer pairs stored in `userProfile.screening`. Includes quick templates for Notice Period, Relocation, and Excel/SQL proficiency.
  2. **📋 Applied Jobs Tracker**: Added a segmented view inside Tab 3 (`[ 📋 Saved Jobs ]` | `[ ✅ Applied Jobs ]`) to review all submitted jobs, application dates, company names, direct links, and a dedicated CSV export.
  3. **🎯 Filter Drop-off Analytics**: Detailed breakdown card in the Logs tab showing exact counts and percentages for why jobs were skipped (`Experience > 1 yr`, `Salary < ₹27k`, `Negative Keywords`, `Location Mismatch`, `Blocked Company`, `Easy Apply Mode`).
  4. **⚡ Easy Apply Only Mode**: Added a toggle in Rules & Filters to skip Company Website jobs automatically without saving them.
  5. **🏢 Blocked Companies Blacklist**: Added a customizable company name blacklist (e.g. `TeamLease, Quess Corp`) to automatically skip third-party staffing agencies and consultancies.
  6. **🔔 Synthesized Audio Chimes**: Web Audio API two-tone synthesizer (587Hz -> 880Hz) alerting users when CAPTCHA or manual verification is required.
  7. **🔄 Multi-Role Search Queue**: Supports comma-separated job titles in target search (e.g. `MIS Analyst, Data Analyst, Operations Analyst`), automatically advancing to the next role when search results finish.
  8. **📜 CHANGELOG.md**: Permanent chronological documentation ledger for tracking updates.

---

### `v1.0.8` — Navigation Tab Equal Spacing & Weekday Names
- **Date**: September 11, 2026 (11:56 IST)
- **Commit**: `a25214a`
- **Files Modified**: `popup/popup.css`, `popup/popup.js`, `manifest.json`, `walkthrough.md`.
- **What Was Added / Updated:**
  1. Expanded popup body width to **500px × 600px** and updated `.nav-tabs` to `justify-content: space-between` with natural button sizing (`flex: 0 0 auto`). This eliminated uneven spacing where the first three tabs were congested while the right two tabs had large empty voids.
  2. Updated the Weekly breakdown table in the Logs tab to include the 3-letter weekday name alongside relative labels: **`Today, Fri (Sep 11)`** and **`Yesterday, Thu (Sep 10)`**.
  3. Updated Daily period header to display the day of the week: **`Today, Fri (Sep 11, 2026)`**.
  4. Optimized `.logs-details-card` height to 235px so all 7 weekly days and total footer fit without clipping.

---

### `v1.0.7` — Logs & Historical Analytics
- **Date**: September 11, 2026 (11:45 IST)
- **Commit**: `3f03d36`
- **Files Modified**: `popup/popup.html`, `popup/popup.css`, `popup/popup.js`, `scripts/background.js`, `manifest.json`, `walkthrough.md`.
- **What Was Added / Updated:**
  1. Inserted a new dedicated **`📊 Logs`** tab to the right of `📋 Saved Jobs` (between Saved Jobs and Profile).
  2. Implemented time-bucketed analytics across **Daily**, **Weekly**, **Monthly**, and **Yearly** intervals for all core metrics: Scanned, Applied ✅, Saved 📋, Skipped ⏭️, and Session Progress.
  3. Persisted metrics in `chrome.storage.local` under `analyticsHistory` (keyed by `YYYY-MM-DD`) and `sessionHistory`.
  4. Added **Auto-Seed Protection**: automatically imports existing session stats into today's bucket so prior runs are preserved upon update.
  5. Added **Export CSV** and **Clear History** functions.

---

### `v1.0.6` — Notification Icon URL Resolution
- **Date**: September 10, 2026 (16:27 IST)
- **Commit**: `40b8411`
- **Files Modified**: `scripts/background.js`, `manifest.json`.
- **What Was Fixed:**
  - Replaced relative icon paths with canonical `chrome.runtime.getURL('icons/icon48.png')` and wrapped notification calls with `chrome.runtime.lastError` error callbacks to eliminate Chromium's `Unable to download all specified images` error on the extensions management page.

---

### `v1.0.5` — Negative Keywords Word-Boundary Blacklist
- **Date**: September 10, 2026 (16:15 IST)
- **Commit**: `6360802`
- **Files Modified**: `scripts/matcher.js`, `manifest.json`.
- **What Was Fixed:**
  - Replaced raw `.includes()` substring negative keywords checks with exact word-boundary regular expressions (`\b(?:intern|interns|internship)\b`). This fixed false skips where Amazon job descriptions containing "Internet" or "internal datasets" were mistakenly classified as internships.

---

### `v1.0.4` — Tab Lock Isolation & Stuck-Step Recovery
- **Date**: September 10, 2026 (11:15 IST)
- **Commit**: `e54c54c`
- **Files Modified**: `scripts/applier.js`, `scripts/background.js`, `scripts/form-filler.js`, `manifest.json`.
- **What Was Fixed:**
  - Implemented `CHECK_CRAWLER_TAB` authentication to prevent secondary Indeed tabs from interfering with active crawlers.
  - Unmasked child iframe form-filler responses by suppressing top-frame interception of `IA_FILL_AND_ADVANCE`.
  - Added intelligent stuck-step detection that gracefully closes modals to continue with other jobs if complex manual questions are encountered.

---

### `v1.0.3` — Card Synchronization & Robust Navigation
- **Date**: September 10, 2026 (10:45 IST)
- **Commit**: `b302843`
- **Files Modified**: `scripts/applier.js`, `manifest.json`.
- **What Was Fixed:**
  - Synchronized right-side detail pane reading with clicked card in `waitForJobDetails` to prevent evaluating cards against stale text from previous cards.
  - Added deduplication of nested card DOM elements and disabled-state checks on pagination buttons.

---

### `v1.0.2` — Recursion & Stack Overflow Fix
- **Date**: September 10, 2026 (10:30 IST)
- **Commit**: `b7a549c`
- **Files Modified**: `scripts/applier.js`, `scripts/background.js`, `manifest.json`.
- **What Was Fixed:**
  - Eliminated infinite self-referential call stack recursion in `persistProcessedJk`.
  - Cleaned up session initialization to properly reset processed JK arrays on each run.

---

### `v1.0.1` — Cross-Frame Stability Fix
- **Date**: September 10, 2026 (10:20 IST)
- **Commit**: `764f2a9`
- **Files Modified**: `scripts/applier.js`, `scripts/background.js`, `manifest.json`.
- **What Was Fixed:**
  - Prevented non-top frames (iframes) from sending spurious `SESSION_COMPLETED` or session halt messages to background service worker.

---

### `v1.0.0` — Production Release
- **Date**: September 10, 2026 (10:00 IST)
- **Commit**: `64a52c2`
- **What Was Added:**
  - Negative keywords blacklist, strict location matching, floating in-page status pill with `[⏹ Stop]`, human delay jitter (1200ms–2100ms), and autonomous screening QA learning.

---

### `v0.1.0` – `v0.9.0` — Foundation & Engine Milestones
- Initial Manifest V3 architecture, field matcher engine, multi-step application form wizard, background orchestrator, popup dashboard, salary parsing, and experience evaluator.
