import express from 'express';
import * as chrono from 'chrono-node';
import { addDays, startOfDay, isBefore, isAfter, format, isValid as isDateValid, setDate, addMonths, getDate } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

const app = express();
app.use(express.json());

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
    
    const dictionary = {
        'परसों': 'in 2 days', 'parso': 'in 2 days', 'parson': 'in 2 days',
        'कल': 'tomorrow', 'kal': 'tomorrow',
        'आज': 'today', 'aaj': 'today',
        // CRITICAL FIX: Convert tareekh/ko to 'th' so it parses as a date!
        'तारीख': 'th', 'tareekh': 'th', 'tarikh': 'th', 'tareek': 'th',
        'को': 'th', 'ko': 'th', 'ka': '', 'ke': '',
        'अगले': 'next ', 'agle': 'next ', 'agla': 'next ', 'agli': 'next ',
        'इस': 'this ', 'is': 'this ',
        'हफ्ते': 'week', 'hafte': 'week', 'hafta': 'week',
        'दिन': 'days', 'din': 'days',
        'बाद': 'later', 'baad': 'later',
        'महीने': 'month', 'mahina': 'month',
        'सोमवार': 'monday', 'somwar': 'monday',
        'मंगलवार': 'tuesday', 'mangalwar': 'tuesday',
        'बुधवार': 'wednesday', 'budhwar': 'wednesday',
        'गुरुवार': 'thursday', 'वीरवार': 'thursday', 'बृहस्पतिवार': 'thursday',
        'शुक्रवार': 'friday', 'shukrawar': 'friday',
        'शनिवार': 'saturday', 'shaniwar': 'saturday',
        'रविवार': 'sunday', 'इतवार': 'sunday', 'raviwar': 'sunday',
        'जनवरी': 'january', 'फ़रवरी': 'february', 'फरवरी': 'february',
        'मार्च': 'march', 'अप्रैल': 'april', 'मई': 'may', 'जून': 'june',
        'जुलाई': 'july', 'अगस्त': 'august', 'सितंबर': 'september',
        'अक्टूबर': 'october', 'नवंबर': 'november', 'दिसंबर': 'december',
        // Numbers to digits
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
    str = str.replace(/(\d+)\s*th/g, '$1th');
    
    // 3. Final safety net: If it translates to just a number (e.g. user said "चार"), make it "4th"
    if (/^\d+$/.test(str)) {
        str = str + "th";
    }

    return str;
}

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

app.post('/api/verify-reschedule', (req, res) => {
    try {
        const user_spoken_date = req.body.user_spoken_date || req.body.time_reference;

        if (!user_spoken_date) {
            return res.status(400).json({ error: "Missing required parameter: user_spoken_date" });
        }

        const todayIST = getTodayIST();
        const windowStart = addDays(todayIST, 1);
        const windowEnd = addDays(todayIST, 7);

        const next_seven_available_dates = generateAvailableDates(todayIST);

        // Pass the LLM's output through our robust translation dictionary
        const cleaned_reference = translateHindiToEnglish(user_spoken_date);
        
        let parsedResult = null;
        
        // INTERCEPTOR: If the cleaned string is just an ordinal like "5th"
        const standaloneDateMatch = cleaned_reference.match(/^(\d+)th$/);
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
            return res.json({
                is_booking_allowed: false,
                rejection_reason: "unparseable_gibberish",
                user_spoken_date: user_spoken_date,
                allowed_booking_window: {
                    start_date: format(windowStart, 'yyyy-MM-dd'),
                    end_date: format(windowEnd, 'yyyy-MM-dd')
                },
                next_seven_available_dates: next_seven_available_dates
            });
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

        return res.json({
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
        });

    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ error: "Internal Server Error while calculating dates." });
    }
});

export default app;
