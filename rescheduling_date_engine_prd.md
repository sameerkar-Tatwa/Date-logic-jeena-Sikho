# Product Requirements Document (PRD)

## AI Agent Rescheduling Date Engine (7-Day Lock-in)

### 1. Project Overview & Scope

**Objective:** To build a robust, foolproof date extraction and validation engine for an Outbound AI Voice Agent (Preeti). The engine will process patient rescheduling requests spoken in natural Hindi/Hinglish, convert them to standard English representations via the LLM, and calculate the validity of the date against a strict 7-day mathematical lock-in rule via a Node.js API.

**The Core Problem:**
Large Language Models (LLMs) are notorious for hallucinating dates and failing at strict mathematical window constraints (e.g., exactly T+1 to T+7). Furthermore, standard NLP libraries in Node.js struggle with Hinglish (e.g., "agle somwar", "parso").

**The Solution:**

1. **LLM as a Translator:** The AI Agent is strictly tasked with converting the user's Hindi/Hinglish relative time phrase into standard English (e.g., "kal" -> "tomorrow").

2. **Node.js as a Calculator:** The Express API takes the English string, parses it into an exact calendar date, applies the mathematical 7-day rule, and returns the exact Hindi script the agent must speak.

### 2. System Architecture & ASCII Flow Diagram

```
=======================================================================================
                            END-TO-END SYSTEM ARCHITECTURE
=======================================================================================

  [1] THE PATIENT (Call)                         [2] AI AGENT (LLM)
  Spoken Hindi/Hinglish                          Prompt Instruction: "Translate to English"
  "मैं परसों नहीं, अगले सोमवार आऊँगा"   --------->  Recognizes "agle somwar"
  (I will come next Monday)                      Translates to "next Monday"
                                                 Calls Tool: verify_reschedule_date
                                                                |
                                                                | { "time_reference": "next Monday" }
                                                                v
  [4] AI AGENT SPEAKS                            [3] NODE.JS (EXPRESS API)
  Reads `agent_message_hindi` verbatim.          - Calculates Current Date (IST)
  "जी, आपकी अपॉइंटमेंट 5 अक्टूबर के    <---------  - Parses "next Monday" to Date Object
  लिए रीशेड्यूल हो सकती है। क्या..."               - Start Date = T+1, End Date = T+7
                                                 - Validates if target date falls in window
                                                 - Generates dynamic Hindi response
                                                 - Returns JSON payload
=======================================================================================

```

### 3. LLM Prompt Instructions & Translation Matrix

To ensure the Node.js API receives predictable data, the AI Agent must be explicitly instructed on how to format its tool call.

#### 3.1 Inject this into the Agent's Main Prompt:

> **Rescheduling Extraction Rule:**
> When the user asks to reschedule and mentions a date, day, or relative time in Hindi or Hinglish (e.g., 'kal', 'parso', 'agle hafte', 'somwar', '15 tareekh'), you must **NOT** pass the Hindi word to the API.
> You must translate their intent into a standard English phrase and pass it to the `verify_reschedule_date` tool.
>
> **Do not calculate the calendar date yourself.** Only pass the relative English phrase.

#### 3.2 Standardization Matrix (Hinglish -> English)

| 

| **User Intent (Hindi/Hinglish)** | **Standardized English Payload to send to API** | 
| "Aaj" / "Today" | `today` | 
| "Kal" / "Tomorrow" | `tomorrow` | 
| "Parso" / "Day after tomorrow" | `day after tomorrow` | 
| "Tarso" / "3 din baad" | `in 3 days` | 
| "\[X\] din baad" (e.g., 4 din baad) | `in [X] days` (e.g., `in 4 days`) | 
| "Agle hafte" / "Next week" | `next week` | 
| "Is somwar/mangalwar" | `this Monday` / `this Tuesday` | 
| "Agle somwar/mangalwar" | `next Monday` / `next Tuesday` | 
| "15 tareekh" / "15 October" | `15th of this month` or `15 October` | 

### 4. API Definition & Tool Schema

#### 4.1 Tool JSON Schema (For the Agent Platform)

```
{
  "name": "verify_reschedule_date",
  "description": "Validates a user's requested date for rescheduling against a 7-day rule. Use this whenever the user mentions a day, date, or relative time to reschedule.",
  "parameters": {
    "type": "object",
    "properties": {
      "time_reference": {
        "type": "string",
        "description": "The english translation of the relative time or date the user requested (e.g., 'tomorrow', 'next monday', 'in 3 days', '12 october')."
      }
    },
    "required": ["time_reference"]
  }
}

```

#### 4.2 Edge Cases & Fallback Handling

| **Scenario** | **Backend Action** | **API Response (agent_message_hindi)** | 
| **Date is VALID (T+1 to T+7)** | Return `isValid: true` and formatted dates. | "जी, आप अपनी OPD appointment \[Date\] के लिए reschedule कराना चाहेंगे?" | 
| **Date is INVALID (Past)** | Return `isValid: false`, calculate limits. | "जी, मैं पिछले समय में अपॉइंटमेंट बुक नहीं कर सकती। मैं अगले 7 दिनों यानी \[Start\] से \[End\] तक रीशेड्यूल कर सकती हूँ। आप कौन सी तारीख़ चाहेंगे?" | 
| **Date is INVALID (>7 Days)** | Return `isValid: false`, calculate limits. | "जी, फिलहाल मैं आपकी OPD appointment अगले 7 दिनों के अंदर यानी \[Start\] से \[End\] तक ही reschedule कर सकती हूँ। क्या आप इस बीच कोई तारीख़ बता सकते हैं?" | 
| **Unparsable Garbage Text** | Return `isValid: false`, calculate limits. | "माफ़ कीजिए, मुझे तारीख़ स्पष्ट नहीं हुई। आपकी अपॉइंटमेंट \[Start\] से \[End\] के बीच ही रीशेड्यूल हो सकती है। आप किस दिन आना चाहेंगे?" | 
