# Comprehensive List of Supported Inputs (Date 7-Day Tool)

This document outlines the massive variety of natural language inputs (English, Hindi, and Hinglish) that the Date Logic Engine can parse, translate, and resolve accurately.

## 1. Pure Numbers & Ordinals
*   `"4"`
*   `"4th"`
*   `"the 4th"`
*   `"4 th"`
*   `"fourth"`
*   `"first"`, `"second"`, `"third"`, `"fifth"`, etc.

## 2. Hindi & Hinglish Numbers (Text & Script)
*   `"ek"`, `"do"`, `"teen"`, `"char"`, `"paanch"`, `"chhe"`, `"saat"`, `"aath"`, `"nau"`, `"das"` *(Safely word-bounded so they don't interfere with English words like "do")*
*   `"एक"`, `"दो"`, `"तीन"`, `"चार"`, `"पांच"`, `"पाँच"`, `"छह"`, `"छै"`, `"सात"`, `"आठ"`, `"नौ"`, `"दस"`
*   *(And all Hindi numbers up to 20: `"ग्यारह"`, `"बारह"`, etc.)*

## 3. Mixed "Tareekh" (Date) Phrases
*   `"4 tareekh"`
*   `"4 tarikh"`
*   `"4 tareek"`
*   `"4 तारीख"`
*   `"4 ko"`
*   `"4 ka"`
*   `"4 को"`

## 4. Standard Relative Dates (English)
*   `"tomorrow"`
*   `"day after tomorrow"`
*   `"in 2 days"`
*   `"after 3 days"`
*   `"next week"`
*   `"this week"`

## 5. Conversational Hindi/Hinglish Time References
*   `"kal"`, `"कल"` *(tomorrow)*
*   `"parso"`, `"parson"`, `"परसों"` *(day after tomorrow)*
*   `"aaj"`, `"आज"` *(today)*
*   `"do din baad"`, `"2 din baad"`, `"2 दिन बाद"` *(in 2 days)*
*   `"agle hafte"`, `"अगले हफ्ते"` *(next week)*

## 6. Direct Days of the Week (English)
*   `"monday"`, `"tuesday"`, `"wednesday"`, `"thursday"`, `"friday"`, `"saturday"`, `"sunday"`
*   `"this monday"`, `"this sunday"`

## 7. Transliterated & Standard Days of the Week (Hindi/Hinglish)
*   `"संडे"`, `"मंडे"`, `"ट्यूसडे"`, `"वेडनसडे"`, `"थर्सडे"`, `"फ्राइडे"`, `"सैटरडे"`
*   `"somwar"`, `"mangalwar"`, `"budhwar"`, `"shukrawar"`, `"shaniwar"`, `"raviwar"`
*   `"सोमवार"`, `"मंगलवार"`, `"बुधवार"`, `"गुरुवार"`, `"वीरवार"`, `"बृहस्पतिवार"`, `"शुक्रवार"`, `"शनिवार"`, `"रविवार"`, `"इतवार"`

## 8. Explicit Absolute Dates
*   `"2nd oct"`
*   `"oct 2"`
*   `"october 4th"`
*   `"2026-10-04"`
*   `"2 अक्टूबर"`
*   `"2 october"`

## 9. Smart Ambiguity Handlers (The Interceptors)
*When these are passed, the engine intentionally blocks the request and generates a pre-formatted Hindi clarification message for the Voice Agent to ask the user.*
*   `"next sunday"`
*   `"coming monday"`
*   `"agle somwar"`
*   `"next wednesday"`

## 10. Intelligent "Month-Rolling"
*   If today is the **1st of the month**, and the user says `"1"` / `"1st"` / `"1 तारीख"` / `"ek"`, the engine knows they cannot book for *today* (due to the T+1 to T+7 window), so it correctly rolls the date to the **1st of the next month** and rejects it for exceeding the 7-day limit. 
