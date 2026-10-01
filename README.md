# Jeena Sikho: 7-Day Rescheduling Validation Engine

This project serves as the backend NLP (Natural Language Processing) Date Engine for an AI Voice Agent. It takes natural conversational inputs (e.g., "कल", "next wednesday", "in 5 days", "tomorrow", "4 तारीख", "संडे", "ek") and accurately maps them into a strict 7-day rescheduling window. 

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
│   Cloudflare  │  <-- 1. Translates & Pre-processes (Hindi/Hinglish -> English Math)
│     Worker    │  <-- 2. Parses string using chrono-node / Math Interceptors.
│ (Date Engine) │  <-- 3. Checks boundaries (Tomorrow to T+7) or flags ambiguity.
└───────┬───────┘
        │ 📤 Returns strict JSON payload 
        │ (e.g. is_booking_allowed: true, calculated_date_english: '2026-10-07', next_seven_available_dates: [...])
        ▼
┌───────────────┐
│  Voice Agent  │  <-- Reads the API response.
│   (Vapi/Bland)│      If allowed: Proceeds to book.
└───────┬───────┘      If rejected: Offers alternative dates from `next_seven_available_dates` OR asks clarification.
        │ 🗣️ "Great! I have rescheduled your appointment for 7th October."
        ▼
  [ User ]
```

---

## 📡 Core Technologies

### 1. Chrono-Node (`chrono-node`)
Chrono is a powerful natural language date parser designed for JavaScript. It is the core engine we use to convert human time references (like `"tomorrow"`, `"in 2 days"`, `"this monday"`, `"october 4th"`) into actual computer `Date` objects. 

However, Chrono was built primarily for standard Western English formatting. It fails heavily on Indian conversational idioms (e.g. `"day after tomorrow"`, `"next monday"`, `"4th"` as a standalone number). Therefore, we built a massive **Pre-Processing NLP Translation Layer** on top of Chrono to "feed" it perfectly formatted data.

### 2. Date-Fns (`date-fns`)
This library acts as the mathematical backbone. It handles strictly calculating bounds (`addDays`), checking boundaries (`isBefore`, `isAfter`), and formatting dates identically regardless of the server's local time zone.

---

## 🧩 The Date-by-Date Engine Logic (How it Works)

The engine evaluates every user input through a sophisticated, multi-layer funnel inside `src/index.js` (and `src/engine.js`):

### Phase 1: The Translation & Safety Net (`translateHindiToEnglish`)
Before `chrono-node` even sees the text, we clean it aggressively:
1. **Raw Number Catch:** If the user says `"4"`, it mathematically appends `"th"` to make it `"4th"`.
2. **Word Boundary Hinglish Numbers:** Words like `"ek"`, `"do"`, `"char"` are translated to `"1"`, `"2"`, `"4"`. *Crucially, we use Regex Word Boundaries (`\b`) so that the English word "do" (as in "I do not know") is not accidentally translated into "2"!*
3. **Conversational Dictionary:** Translates words like `"कल"` / `"kal"` to `"tomorrow"`, `"परसों"` / `"parson"` to `"in 2 days"`, and transliterated days like `"संडे"` to `"sunday"`.
4. **Suffix Normalization:** Cleans up messy LLM outputs like `"the 4 th"` and normalizes them to `"4th"`.

### Phase 2: The "Next Day" Ambiguity Interceptor
When Indian users say `"next Sunday"` or `"coming Monday"`, it is naturally ambiguous (do they mean the immediate upcoming Sunday, or the one in the following week?). 
*   **Logic:** The engine intercepts any string starting with `next` or `coming`. It strictly calculates the date of *this* upcoming day (e.g. Oct 4), mathematically adds 7 days to get *next* week's day (Oct 11), and completely bypasses normal validation to return `is_booking_allowed: "ambiguous"`.
*   **Result:** It generates a custom Hindi message: `"क्या आप 4 अक्टूबर (इस रविवार) या 11 अक्टूबर (अगले रविवार) की बात कर रहे हैं?"` so the Voice Agent can ask the user for clarification.

### Phase 3: The Standalone Ordinal Interceptor
Chrono requires a month context to parse dates properly (e.g., `"4th October"`). If the LLM just says `"4th"` or `"2nd"`, Chrono crashes.
*   **Logic:** A custom Regex intercepts any standalone ordinal (`/^(\d+)(st|nd|rd|th)?$/`). It strips the suffix and mathematically forces the current month's date.
*   **Intelligent Month-Rolling:** If today is Oct 1st, and the user asks for `"1st"`, the engine knows they cannot book today (since the window is T+1 to T+7). It intelligently rolls the date to November 1st, where it gets cleanly rejected for being outside the 7-day window.

### Phase 4: Chrono Parsing & Boundary Validation
If the string passes through the interceptors, it hits `chrono.parseDate()`. The resulting `Date` object is then checked against the strict mathematical bounds:
*   `windowStart`: Tomorrow (T+1)
*   `windowEnd`: 7 Days from Today (T+7)

If the date is before `windowStart`, it rejects with `"date_is_in_past"`. If it's after `windowEnd`, it rejects with `"date_exceeds_7_day_limit"`.

---

## 📡 API Interaction Guide

### Expected JSON Response (Success)
When the user requests a valid date inside the window (e.g., `"day after tomorrow"`):
```json
{
  "is_booking_allowed": true,
  "rejection_reason": null,
  "user_spoken_date": "day after tomorrow",
  "calculated_date_english": "2026-10-03",
  "calculated_date_hindi": "3 अक्टूबर",
  "allowed_booking_window": {
    "start_date": "2026-10-02",
    "end_date": "2026-10-08"
  },
  "next_seven_available_dates": [ /* ... */ ]
}
```

### Expected JSON Response (Ambiguity Clarification)
When the user asks for `"next sunday"`:
```json
{
  "is_booking_allowed": "ambiguous",
  "rejection_reason": "ambiguous_day_of_week",
  "clarification_message": "क्या आप 4 अक्टूबर (इस रविवार) या 11 अक्टूबर (अगले रविवार) की बात कर रहे हैं?",
  "user_spoken_date": "next sunday",
  "allowed_booking_window": { ... },
  "next_seven_available_dates": [ ... ]
}
```

### Expected JSON Response (Rejected/Past Date)
When the user asks for `"today"` or `"10 तारीख"` (which exceeds the limit):
```json
{
  "is_booking_allowed": false,
  "rejection_reason": "date_exceeds_7_day_limit",
  "user_spoken_date": "10 तारीख",
  "calculated_date_english": "2026-10-10",
  "calculated_date_hindi": "10 अक्टूबर",
  "allowed_booking_window": { ... },
  "next_seven_available_dates": [ ... ]
}
```

---

## 🧪 Comprehensive Test Report

The engine is backed by a robust Vitest suite (`test/index.test.js` & `test/engine.test.js`) that verifies all boundaries, ordinals, and ambiguous cases. 

**Test Output:**
```bash
> date-7day-tool@1.0.0 test
> vitest run

 ✓ test/index.test.js  (6 tests) 
 ✓ test/engine.test.js  (14 tests) 
 
 Test Files  2 passed (2)
      Tests  20 passed (20)
```
**Conclusion:** All 20 edge cases pass perfectly. The tool correctly blocks past bounds, handles standalone ordinals (`"1st"`, `"2nd"`), translates `"parson"` and `"do din baad"`, intelligently month-rolls invalid current dates, and safely generates clarification prompts for ambiguous week days.

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
