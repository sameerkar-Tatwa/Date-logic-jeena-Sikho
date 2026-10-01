# Clarification Message Handling Guide

This document explains the `ambiguous_day_of_week` logic in the Date 7-Day Tool and how your Voice Agent (LLM) should handle these cases to provide a seamless user experience.

## 1. When Does the Clarification Message Appear?

The `clarification_message` is exclusively generated when the user provides an **ambiguous forward-looking day of the week**. 

Specifically, it triggers if the user says **ANY** of the following variations:
*   `"next monday"`, `"next tuesday"`, `"next wednesday"`, etc.
*   `"coming monday"`, `"coming sunday"`, etc.
*   `"agle somwar"`, `"agla ravivar"`, etc. (Translated natively to "next monday")

### Why does this happen?
When an Indian user says *"next Sunday"* or *"coming Sunday"*, it is inherently ambiguous in natural language. 
*   Does it mean the immediate upcoming Sunday (e.g., T+3 days)? 
*   Or does it mean the Sunday of the *following* week (e.g., T+10 days)?

Because the Voice Agent cannot guess the user's exact intent, the Date Logic engine mathematically calculates **both** possible dates, blocks the booking, and hands a pre-formatted Hindi question back to the LLM.

---

## 2. What Does the API Return?

When an ambiguous day is detected, the API immediately returns an HTTP 200 response with a JSON payload that looks like this:

```json
{
  "is_booking_allowed": false,
  "rejection_reason": "ambiguous_day_of_week",
  "clarification_message": "क्या आप 4 अक्टूबर (इस रविवार) या 11 अक्टूबर (अगले रविवार) की बात कर रहे हैं?",
  "user_spoken_date": "next sunday",
  "allowed_booking_window": { ... },
  "next_seven_available_dates": [ ... ]
}
```

---

## 3. How Your LLM Engine Should Reconfirm

You should add a specific rule in your Voice Agent's system prompt (or code logic) to handle the `ambiguous_day_of_week` rejection reason.

### Recommended System Prompt / Logic Rule for the Agent:

> **Rule for Ambiguous Dates:**
> If the API returns `"is_booking_allowed": false` AND `"rejection_reason": "ambiguous_day_of_week"`, **do not** tell the user that the date is invalid or out of bounds. 
> 
> Instead, simply read the exact string provided in the `"clarification_message"` field back to the user to reconfirm their choice.

### Example Call Flow:

**User:** "मैम, कमिंग संडे का बुक कर दो।" (Ma'am, book for coming Sunday)
**Agent (Calls API):** *Sends "coming sunday"*
**API (Responds):** *Returns `ambiguous_day_of_week` and the clarification message.*
**Agent (Reads the message):** "क्या आप 4 अक्टूबर (इस रविवार) या 11 अक्टूबर (अगले रविवार) की बात कर रहे हैं?"
**User:** "4 अक्टूबर को कर दो।" (Do it for Oct 4)
**Agent (Calls API):** *Sends "4 october"*
**API (Responds):** *Returns `is_booking_allowed: true`, booking proceeds smoothly.*
