# Indeed Auto-Applier (Chrome & Brave Extension - Manifest V3)

An intelligent, autonomous job application assistant for Indeed that filters recent jobs (Last 24 Hours), analyzes job descriptions against your experience, auto-applies to matching Indeed-hosted jobs, and saves matching company website listings for manual review.

---

## 🚀 Key Features

1. **Autonomous Search & Filter Application**:
   - Automatically loads Indeed with target keywords, location, and date filters (e.g. **Last 24 Hours** via `fromage=1`, sorted by date).
   - Evaluates listing salaries against your **configurable minimum salary floor**.

2. **Smart Experience Matching**:
   - Reads job descriptions and requirements in real time.
   - Compares requirements against your **customizable experience cutoff** (e.g., 0–1 year, 2 years, etc.).
   - Skips listings demanding seniority beyond your set threshold.
   - Configurable policy for jobs with unlisted experience (auto-apply, save for review, or skip).

3. **Dual Apply Strategy**:
   - **"Apply with Indeed"**: Automatically opens the application modal, fills your details, answers screening questions, selects your preferred resume, advances through wizard steps, and submits.
   - **"Apply on Company Website"**: Saves the job details and direct application link to your **Saved Jobs** list **only when it satisfies your criteria**, preventing clutter.

4. **Negative Keywords Blacklist & Strict Location**:
   - Instantly skips roles containing blacklisted keywords (e.g., unpaid, telecaller, night shift).
   - Strict location filter ensures positions are in your target city or marked Remote.

5. **Safety, Anti-Detection & In-Page Control**:
   - Configurable session cap (e.g., 25 jobs per run).
   - Human-like delay jitter between actions to mimic natural browsing.
   - Floating in-page status pill displays live crawl stats with an instant **[⏹ Stop]** button.
   - Desktop notifications and auto-pause upon CAPTCHA detection.

6. **Screening QA Auto-Learning**:
   - Automatically saves manual answers to new employer screening questions to your profile for future applications.

7. **Live Dashboard & Analytics**:
   - Real-time terminal log showing inspections, matches, skips, and applications.
   - Live metrics: Scanned, Applied, Saved, Skipped.
   - CSV export for all saved listings.

---

## 📦 How to Load in Chrome / Brave

1. Open your browser:
   - In **Brave**: navigate to `brave://extensions`
   - In **Chrome**: navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the extension directory:
   `c:\Users\KIIT\OneDrive\Documents\Automate Jobs\Indeed\Indeed-Auto-Applier`
5. Pin the extension icon to your toolbar!

---

## 🎯 How to Use

1. Click the **Indeed Auto-Applier** icon in your browser toolbar.
2. In the **Rules & Filters** tab:
   - Enter your target job title / keywords and preferred location.
   - Set your experience cutoff, minimum salary floor, and negative keywords.
3. In the **Profile** tab:
   - Fill in your contact details, current role, and work background.
4. Go to the **Auto-Apply** tab and click **▶ Start Auto-Apply**:
   - The extension opens an Indeed search with your filters.
   - The crawler inspects each job card, applies or saves based on your criteria, and logs activity in real time.
5. Click **⏹ Stop** in the popup or on the floating page pill at any time.
