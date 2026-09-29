# Jeena Sikho: 7-Day Rescheduling Validation Engine

This project serves as the backend NLP (Natural Language Processing) Date Engine for an AI Voice Agent. It takes natural conversational inputs (e.g., "कल", "next wednesday", "in 5 days", "tomorrow") and accurately maps them into a strict 7-day rescheduling window. 

Critically, the engine guarantees that all calculations remain tethered to **India Standard Time (IST)**, protecting against midnight UTC rollovers that typically break AI Agent scheduling on cloud servers. It dynamically generates localized, conversational **Hindi prompt replies** based on whether the date is valid, too far in the future, or in the past.

---

## 🚀 Features

- **Conversational Date Parsing:** Leverages `chrono-node` to understand abstract human time references.
- **Bulletproof Timezones:** Uses `date-fns-tz` to ensure strict calculation boundaries against `Asia/Kolkata` (IST).
- **Strict Scheduling Window:** Constrains valid rescheduling strictly to `Tomorrow (T+1)` up to `7 days from today (T+7)`.
- **Dynamic Hindi Generation:** Automatically crafts contextual Hindi phrases for the AI Agent to speak back to the user based on the validation result.
- **Dual Support:** Contains both an **Express.js Node Engine** (primary) and a **Cloudflare Worker** variant.

---

## 🧩 Code Explanation: Section by Section

The primary logic is located inside `src/engine.js`. Here is a breakdown of what the code does:

### 1. Dependencies and Initialization
```javascript
import express from 'express';
import * as chrono from 'chrono-node';
import { addDays, startOfDay, isBefore, isAfter, format, isValid as isDateValid } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

const app = express();
app.use(express.json());
const TIMEZONE = 'Asia/Kolkata';
```
* **What it does:** We import the necessary libraries. `chrono-node` handles reading the human text, while `date-fns` acts as the backbone for calculating accurate date boundaries. `express` sets up the server to accept web requests.

### 2. Helper Functions (Formatting & Current Time)
```javascript
export function formatHindiDate(dateObj) {
    const options = { day: 'numeric', month: 'long', timeZone: TIMEZONE };
    return new Intl.DateTimeFormat('hi-IN', options).format(dateObj);
}

export function getTodayIST() {
    const now = new Date();
    const nowISTStr = formatInTimeZone(now, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
    const zonedNow = new Date(nowISTStr);
    return startOfDay(zonedNow);
}
```
* **What it does:** 
  * `formatHindiDate`: Takes a raw Date object and spits out a pretty string like `"16 मई"` so the Voice Agent sounds natural.
  * `getTodayIST`: This is the most crucial function for server stability. It gets the current UTC server time, forces it into the exact current hour and day in India, and then rewinds to `00:00:00` (Start of Day). This prevents bugs where 11 PM in London accidentally shifts the day in India.

### 3. Establishing Time Bounds
```javascript
const todayIST = getTodayIST();
const windowStart = addDays(todayIST, 1); // T+1 (Tomorrow)
const windowEnd = addDays(todayIST, 7);   // T+7 (7 days from today)
```
* **What it does:** It sets up the strict boundary for the Voice Agent. The appointment cannot be rescheduled for "Today", it must be from "Tomorrow" onwards, up to a maximum of 7 days out.

### 4. Parsing the Natural Language
```javascript
const parsedResult = chrono.parseDate(time_reference, todayIST, { forwardDate: true });
```
* **What it does:** We feed the user's spoken words (e.g., "Monday") into `chrono-node`. By passing `todayIST` and `{ forwardDate: true }`, we instruct the engine to assume the user means the *upcoming* Monday relative to the Indian timezone.

### 5. Validation Logic
```javascript
const isPast = isBefore(targetDate, windowStart);
const isTooFarFuture = isAfter(targetDate, windowEnd);
const isValid = !isPast && !isTooFarFuture;
```
* **What it does:** Cross-checks the date `chrono` found against our `windowStart` and `windowEnd`.

### 6. AI Agent Script Generation
```javascript
let agentMessage = "";
if (isValid) {
    agentMessage = `जी, आप अपनी OPD appointment ${targetHindi} के लिए reschedule कराना चाहेंगे?`;
} else if (isPast) {
    agentMessage = `जी, मैं बीते हुए समय में अपॉइंटमेंट बुक नहीं कर सकती। मैं अगले 7 दिनों यानी ${startHindi} से ${endHindi} तक रीशेड्यूल कर सकती हूँ...`;
}
```
* **What it does:** Based on the boolean checks above, it dynamically concatenates the Hindi Date strings (`targetHindi`, `startHindi`) into a sentence that the AI voice engine will immediately read out to the customer.

---

## 🧪 Comprehensive Test Report

The engine is backed by a robust Vitest suite (`test/index.test.js` & `test/engine.test.js`) that simulates Voice Agent API constraints. 

**Test Output:**
```bash
> date-7day-tool@1.0.0 test
> vitest run

 RUN  v1.6.1 D:/Tatwa projects/jeena seekho/Date 7day tool

 ✓ test/index.test.js  (11 tests) 108ms
 ✓ test/engine.test.js  (7 tests) 396ms
   ✓ should return 400 if time_reference is missing
   ✓ should correctly reject "today" because window starts tomorrow (T+1)
   ✓ should accept "tomorrow" (T+1)
   ✓ should accept a date exactly 7 days away (T+7)
   ✓ should reject a date beyond 7 days (T+8) with future warning
   ✓ should handle unparseable gibberish with a polite Hindi prompt
   ✓ should correctly format Hindi dates and expose window boundaries in response

 Test Files  2 passed (2)
      Tests  18 passed (18)
```
**Conclusion:** All 18 edge cases pass securely. The tool correctly blocks past bounds, correctly limits future bounds, flawlessly renders conversational Hindi strings, and accurately intercepts "gibberish" inputs with a polite fallback prompt.

---

## ☁️ Deployment Guide

### Option 1: Deploying the Node/Express Engine (Recommended for standard servers)
Because `src/engine.js` relies on Express.js, it is best suited for deployment on standard Node.js environments (like AWS EC2, Heroku, DigitalOcean, Render, or a Docker Container).

1. **Local Startup:**
   Add a `server.js` file that imports the engine and listens on a port:
   ```javascript
   import app from './src/engine.js';
   app.listen(3000, () => console.log('Server running on port 3000'));
   ```
2. **Start the server:**
   ```bash
   node server.js
   ```
3. **Deploy to Render / Heroku:**
   - Push your code to a GitHub Repository.
   - Connect the repository to your PaaS of choice.
   - Set the build command to `npm install`.
   - Set the start command to `node server.js`.

### Option 2: Deploying to Cloudflare Workers (Edge Deployment)
If you require Cloudflare Workers deployment, you must utilize the `src/index.js` file (which uses the native Cloudflare `fetch` API instead of Express).

1. Authenticate your CLI:
   ```bash
   npx wrangler login
   ```
2. Deploy the worker directly:
   ```bash
   npm run deploy
   ```
This will read the `wrangler.toml` file and deploy the lightweight variant of the logic to Cloudflare's Edge network.
