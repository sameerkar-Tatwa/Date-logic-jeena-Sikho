import express from 'express';
import * as chrono from 'chrono-node';
import { addDays, startOfDay, isBefore, isAfter, format, isValid as isDateValid } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

const app = express();
app.use(express.json());

const TIMEZONE = 'Asia/Kolkata';

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

        // Pre-process common Indian English phrase
        let cleaned_reference = user_spoken_date.toLowerCase().replace('day after tomorrow', 'in 2 days');

        const parsedResult = chrono.parseDate(cleaned_reference, todayIST, { forwardDate: true });

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
