import { addDays, startOfDay, isBefore, isAfter, format, isValid as isDateValid, setDate, addMonths, getDate } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import * as chrono from 'chrono-node';

const TIMEZONE = 'Asia/Kolkata';

// --- ROBUST HINDI/HINGLISH TRANSLATION LAYER ---
function translateHindiToEnglish(inputStr) {
    if (!inputStr) return "";
    let str = inputStr.toLowerCase().trim();

    // 1. If LLM sends just a raw number (e.g., "4"), instantly make it "4th"
    if (/^\d+$/.test(str)) {
        str = str + "th";
    }

    str = str.replace(/day after tomorrow/g, 'in 2 days');
    str = str.replace(/coming/gi, 'next'); // Normalize 'coming' to 'next'
    
    // Word-bounded dictionary for risky short ENGLISH transliterated words and numbers
    const boundedDictionary = {
        'ek': '1', 'do': '2', 'teen': '3', 'char': '4', 'paanch': '5',
        'chhe': '6', 'saat': '7', 'aath': '8', 'nau': '9', 'das': '10',
        'is': 'this', 'ko': 'th', 'ka': '', 'ke': ''
    };
    for (const [hindiWord, englishWord] of Object.entries(boundedDictionary)) {
        const regex = new RegExp(`\\b${hindiWord}\\b`, 'gi');
        str = str.replace(regex, englishWord);
    }
    
    const dictionary = {
        'parson': 'in 2 days', 'parso': 'in 2 days', 'परसों': 'in 2 days',
        'kal': 'tomorrow', 'कल': 'tomorrow',
        'aaj': 'today', 'आज': 'today',
        'tareekh': 'th', 'tarikh': 'th', 'tareek': 'th', 'तारीख': 'th',
        'को': 'th',
        'agle': 'next ', 'agla': 'next ', 'agli': 'next ', 'अगले': 'next ',
        'इस': 'this ',
        'hafte': 'week', 'hafta': 'week', 'हफ्ते': 'week',
        'din': 'days', 'दिन': 'days',
        'baad': 'later', 'बाद': 'later',
        'mahina': 'month', 'महीने': 'month',
        // Transliterated Days
        'संडे': 'sunday', 'मंडे': 'monday', 'ट्यूसडे': 'tuesday', 'वेडनसडे': 'wednesday',
        'थर्सडे': 'thursday', 'फ्राइडे': 'friday', 'सैटरडे': 'saturday',
        // Standard Hindi Days
        'somwar': 'monday', 'सोमवार': 'monday',
        'mangalwar': 'tuesday', 'मंगलवार': 'tuesday',
        'budhwar': 'wednesday', 'बुधवार': 'wednesday',
        'वीरवार': 'thursday', 'बृहस्पतिवार': 'thursday', 'गुरुवार': 'thursday', 
        'shukrawar': 'friday', 'शुक्रवार': 'friday',
        'shaniwar': 'saturday', 'शनिवार': 'saturday',
        'raviwar': 'sunday', 'इतवार': 'sunday', 'रविवार': 'sunday',
        // Months
        'january': 'january', 'february': 'february', 'फ़रवरी': 'february', 'फरवरी': 'february',
        'मार्च': 'march', 'अप्रैल': 'april', 'मई': 'may', 'जून': 'june',
        'जुलाई': 'july', 'अगस्त': 'august', 'सितंबर': 'september',
        'अक्टूबर': 'october', 'नवंबर': 'november', 'दिसंबर': 'december',
        // English Ordinals
        'first': '1', 'second': '2', 'third': '3', 'fourth': '4', 'fifth': '5',
        'sixth': '6', 'seventh': '7', 'eighth': '8', 'ninth': '9', 'tenth': '10',
        // Hindi Numbers
        'एक': '1', 'दो': '2', 'तीन': '3', 'चार': '4', 'पांच': '5', 'पाँच': '5',
        'छह': '6', 'छै': '6', 'सात': '7', 'आठ': '8', 'नौ': '9', 'दस': '10',
        'ग्यारह': '11', 'बारह': '12', 'तेरह': '13', 'चौदह': '14', 'पंद्रह': '15',
        'सोलह': '16', 'सत्रह': '17', 'अठारह': '18', 'उन्नीस': '19', 'बीस': '20'
    };

    for (const [hindiWord, englishWord] of Object.entries(dictionary)) {
        const regex = new RegExp(hindiWord, 'gi');
        str = str.replace(regex, englishWord);
    }
    
    // 2. Clean up extra spaces (e.g., changes "4 th" to "4th")
    str = str.replace(/\s+/g, ' ').trim();
    str = str.replace(/(\d+)\s*(st|nd|rd|th)/g, '$1$2');
    
    // 3. Final safety net: If it translates to just a number (e.g. user said "चार"), make it "4th"
    if (/^\d+$/.test(str)) {
        str = str + "th";
    }

    return str;
}

function formatHindiDate(dateObj) {
    const options = { day: 'numeric', month: 'long', timeZone: TIMEZONE };
    return new Intl.DateTimeFormat('hi-IN', options).format(dateObj);
}

function getTodayIST() {
    const now = new Date();
    const nowISTStr = formatInTimeZone(now, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
    const zonedNow = new Date(nowISTStr);
    return startOfDay(zonedNow);
}

function generateAvailableDates(todayIST) {
    const dates = [];
    for (let i = 1; i <= 7; i++) {
        const d = addDays(todayIST, i);
        dates.push({
            date_english: format(d, 'yyyy-MM-dd'),
            date_hindi: formatHindiDate(d),
            day_english: new Intl.DateTimeFormat('en-IN', { weekday: 'long', timeZone: TIMEZONE }).format(d),
            day_hindi: new Intl.DateTimeFormat('hi-IN', { weekday: 'long', timeZone: TIMEZONE }).format(d)
        });
    }
    return dates;
}

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: "Only POST method is allowed for /api/verify-reschedule." }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const body = await request.json();
      const user_spoken_date = body.user_spoken_date || body.time_reference; // Support old parameter just in case

      if (!user_spoken_date) {
          return new Response(JSON.stringify({ error: "Missing required parameter: user_spoken_date" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      const todayIST = getTodayIST();
      const windowStart = addDays(todayIST, 1);
      const windowEnd = addDays(todayIST, 7);
      
      const next_seven_available_dates = generateAvailableDates(todayIST);

      // Pass the LLM's output through our robust translation dictionary
      const cleaned_reference = translateHindiToEnglish(user_spoken_date);
      
      const ambiguousDayMatch = cleaned_reference.match(/^next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i);
      if (ambiguousDayMatch) {
          const dayOfWeek = ambiguousDayMatch[1].toLowerCase();
          const thisDate = chrono.parseDate(`this ${dayOfWeek}`, todayIST, { forwardDate: true });
          const nextDate = addDays(thisDate, 7); // Mathematically enforce it is exactly 1 week later
          
          const hindiDays = { monday: 'सोमवार', tuesday: 'मंगलवार', wednesday: 'बुधवार', thursday: 'गुरुवार', friday: 'शुक्रवार', saturday: 'शनिवार', sunday: 'रविवार' };
          const dayHindiName = hindiDays[dayOfWeek];
          
          const thisHindi = formatHindiDate(thisDate);
          const nextHindi = formatHindiDate(nextDate);
          
          const clarification_message = `क्या आप ${thisHindi} (इस ${dayHindiName}) या ${nextHindi} (अगले ${dayHindiName}) की बात कर रहे हैं?`;
          
          return new Response(JSON.stringify({
              is_booking_allowed: false,
              rejection_reason: "ambiguous_day_of_week",
              clarification_message: clarification_message,
              user_spoken_date: user_spoken_date,
              allowed_booking_window: {
                  start_date: format(windowStart, 'yyyy-MM-dd'),
                  end_date: format(windowEnd, 'yyyy-MM-dd')
              },
              next_seven_available_dates: next_seven_available_dates
          }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }
      
      let parsedResult = null;
      
      // INTERCEPTOR: If the cleaned string is just an ordinal like "5th", "1st", or "the 2nd"
      const cleaned_for_interceptor = cleaned_reference.replace(/^the\s+/i, '');
      const standaloneDateMatch = cleaned_for_interceptor.match(/^(\d+)(st|nd|rd|th)?$/);
      if (standaloneDateMatch) {
          const targetDay = parseInt(standaloneDateMatch[1], 10);
          let tempDate = setDate(todayIST, targetDay);
          
          // If the day has already passed this month, or is today, they mean next month
          if (targetDay <= getDate(todayIST)) {
              tempDate = addMonths(tempDate, 1);
          }
          parsedResult = tempDate;
      } else {
          parsedResult = chrono.parseDate(cleaned_reference, todayIST, { forwardDate: true });
      }

      if (!parsedResult || !isDateValid(parsedResult)) {
          return new Response(JSON.stringify({
              is_booking_allowed: false,
              rejection_reason: "unparseable_gibberish",
              user_spoken_date: user_spoken_date,
              allowed_booking_window: {
                  start_date: format(windowStart, 'yyyy-MM-dd'),
                  end_date: format(windowEnd, 'yyyy-MM-dd')
              },
              next_seven_available_dates: next_seven_available_dates
          }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
      }

      const targetDate = startOfDay(parsedResult);
      const calculated_date_hindi = formatHindiDate(targetDate);
      const calculated_date_english = format(targetDate, 'yyyy-MM-dd');

      const isPast = isBefore(targetDate, windowStart);
      const isTooFarFuture = isAfter(targetDate, windowEnd);
      const is_booking_allowed = !isPast && !isTooFarFuture;

      let rejection_reason = null;
      if (isPast) rejection_reason = "date_is_in_past";
      if (isTooFarFuture) rejection_reason = "date_exceeds_7_day_limit";

      return new Response(JSON.stringify({
          is_booking_allowed: is_booking_allowed,
          rejection_reason: rejection_reason,
          user_spoken_date: user_spoken_date,
          calculated_date_english: calculated_date_english,
          calculated_date_hindi: calculated_date_hindi,
          allowed_booking_window: {
              start_date: format(windowStart, 'yyyy-MM-dd'),
              end_date: format(windowEnd, 'yyyy-MM-dd')
          },
          next_seven_available_dates: next_seven_available_dates
      }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

    } catch (error) {
      return new Response(JSON.stringify({ error: "Internal Server Error while calculating dates." }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }
};
