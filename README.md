# Jeena Sikho: 7-Day Rescheduling Validation Engine

This project serves as the backend NLP (Natural Language Processing) Date Engine for an AI Voice Agent. It takes natural conversational inputs (e.g., "कल", "next wednesday", "in 5 days", "tomorrow") and accurately maps them into a strict 7-day rescheduling window. 

Critically, the engine guarantees that all calculations remain tethered to **India Standard Time (IST)**, protecting against midnight UTC rollovers that typically break AI Agent scheduling on cloud servers.

---

## 🗺️ Overall System Architecture

Here is how the data flows from the moment the user speaks, down to the Cloudflare Worker, and back to the user:

```text
  [ User ]
     │ 🗣️ "I want to reschedule to next wednesday"
     ▼
┌───────────────┐
│  Voice Agent  │  <-- Uses LLM (ChatGPT/Claude) to transcribe & extract text.
│   (Vapi/Bland)│      Extracted `user_spoken_date` = "next wednesday"
└───────┬───────┘
        │ 🌐 POST /api/verify-reschedule
        │ JSON: { "user_spoken_date": "next wednesday" }
        ▼
┌───────────────┐
│   Cloudflare  │  <-- 1. Evaluates Time in IST.
│     Worker    │  <-- 2. Parses string using chrono-node.
│ (Date Engine) │  <-- 3. Checks boundaries (Tomorrow to T+7).
└───────┬───────┘
        │ 📤 Returns strict JSON payload 
        │ (e.g. is_booking_allowed: true, calculated_date_english: '2024-05-22', next_seven_available_dates: [...])
        ▼
┌───────────────┐
│  Voice Agent  │  <-- Reads the API response.
│   (Vapi/Bland)│      If allowed: Proceeds to book.
└───────┬───────┘      If rejected: Offers alternative dates from `next_seven_available_dates`.
        │ 🗣️ "Great! I have rescheduled your appointment for 22nd May."
        ▼
  [ User ]
```

---

## 📡 How to Hit the Cloudflare API

Once deployed to Cloudflare, your worker will be assigned a public URL (usually something like `https://date-7day-tool.<your-cloudflare-subdomain>.workers.dev`). 

You must trigger the endpoint via an HTTP **POST** request.

### cURL Example:
```bash
curl -X POST "https://date-7day-tool.<your-cloudflare-subdomain>.workers.dev/api/verify-reschedule" \
     -H "Content-Type: application/json" \
     -d '{
           "user_spoken_date": "day after tomorrow"
         }'
```

### Expected JSON Response (Success)
When the user requests a valid date inside the window, the API responds like this:
```json
{
  "is_booking_allowed": true,
  "rejection_reason": null,
  "user_spoken_date": "day after tomorrow",
  "calculated_date_english": "2024-05-17",
  "calculated_date_hindi": "17 मई",
  "allowed_booking_window": {
    "start_date": "2024-05-16",
    "end_date": "2024-05-22"
  },
  "next_seven_available_dates": [
    {
      "date_english": "2024-05-16",
      "date_hindi": "16 मई",
      "day_english": "Thursday",
      "day_hindi": "गुरुवार"
    }
    // ... all 7 days returned here to help the voice agent
  ]
}
```

### Expected JSON Response (Rejected/Past Date)
If the user asks for `"today"`, the engine explicitly rejects it and provides the `rejection_reason`:
```json
{
  "is_booking_allowed": false,
  "rejection_reason": "date_is_in_past",
  "user_spoken_date": "today",
  "calculated_date_english": "2024-05-15",
  "calculated_date_hindi": "15 मई",
  "allowed_booking_window": {
    "start_date": "2024-05-16",
    "end_date": "2024-05-22"
  },
  "next_seven_available_dates": [ /* ... */ ]
}
```

*(Rejection reasons can be: `"date_is_in_past"`, `"date_exceeds_7_day_limit"`, or `"unparseable_gibberish"`).*

---

## 🧩 Code Explanation: Section by Section

The primary logic for Cloudflare is located inside `src/index.js`. Here is a breakdown of what the code does:

### 1. Dependencies and Initialization
```javascript
import { addDays, startOfDay, isBefore, isAfter, format, isValid as isDateValid } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import * as chrono from 'chrono-node';
```
* **What it does:** We import the necessary libraries. `chrono-node` handles reading the human text, while `date-fns` acts as the backbone for calculating accurate date boundaries. 

### 2. Helper Functions (Formatting & Current Time)
```javascript
function formatHindiDate(dateObj) { ... }

function getTodayIST() {
    const now = new Date();
    const nowISTStr = formatInTimeZone(now, 'Asia/Kolkata', "yyyy-MM-dd'T'HH:mm:ss");
    const zonedNow = new Date(nowISTStr);
    return startOfDay(zonedNow);
}
```
* **What it does:** 
  * `getTodayIST`: This is the most crucial function for server stability. It gets the current UTC Cloudflare Edge server time, forces it into the exact current hour and day in India, and then rewinds to `00:00:00` (Start of Day). This prevents bugs where 11 PM in London accidentally shifts the day in India.

### 3. Establishing Time Bounds
```javascript
const todayIST = getTodayIST();
const windowStart = addDays(todayIST, 1); // T+1 (Tomorrow)
const windowEnd = addDays(todayIST, 7);   // T+7 (7 days from today)
const next_seven_available_dates = generateAvailableDates(todayIST);
```
* **What it does:** It sets up the strict boundary for the Voice Agent. The appointment cannot be rescheduled for "Today", it must be from "Tomorrow" onwards, up to a maximum of 7 days out. It also generates the array of available days to feed back to the AI.

### 4. Parsing the Natural Language
```javascript
let cleaned_reference = user_spoken_date.toLowerCase().replace('day after tomorrow', 'in 2 days');
const parsedResult = chrono.parseDate(cleaned_reference, todayIST, { forwardDate: true });
```
* **What it does:** We feed the user's spoken words (e.g., "Monday") into `chrono-node`. We have a specific interceptor that safely cleans Indian-English idioms like "day after tomorrow". 

### 5. Validation Logic & Routing
```javascript
const isPast = isBefore(targetDate, windowStart);
const isTooFarFuture = isAfter(targetDate, windowEnd);
const is_booking_allowed = !isPast && !isTooFarFuture;
```
* **What it does:** Cross-checks the date `chrono` found against our bounds and builds the final JSON payload containing exactly why it passed or failed.

---

## 🧪 Comprehensive Test Report

The engine is backed by a robust Vitest suite (`test/index.test.js` & `test/engine.test.js`) that simulates Voice Agent API constraints. 

**Test Output:**
```bash
> date-7day-tool@1.0.0 test
> vitest run

 RUN  v1.6.1 D:/Tatwa projects/jeena seekho/Date 7day tool

 ✓ test/index.test.js  (4 tests) 99ms
 ✓ test/engine.test.js  (11 tests) 201ms
 
 Test Files  2 passed (2)
      Tests  15 passed (15)
```
**Conclusion:** All 15 edge cases pass securely. The tool correctly blocks past bounds, limits future bounds, flawlessly formats Hindi strings, resolves tricky idioms like "day after tomorrow", and rejects gibberish safely.

---

## ☁️ Local Development & Deployment

### Run Locally
To run tests and test the API locally:
```bash
npm install
npm run test
npm run dev
```

### Deploying to Cloudflare Workers
Ensure you have authenticated the Wrangler CLI:
```bash
npx wrangler login
```
Deploy the worker directly to the edge network:
```bash
npm run deploy
```
*(This commands reads `wrangler.toml` and uploads `src/index.js` to your Cloudflare account).*
