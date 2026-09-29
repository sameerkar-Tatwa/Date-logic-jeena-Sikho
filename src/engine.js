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
            date_iso: format(d, 'yyyy-MM-dd'),
            date_hindi: formatHindiDate(d),
            day_hindi: new Intl.DateTimeFormat('hi-IN', { weekday: 'long', timeZone: TIMEZONE }).format(d),
            day_english: new Intl.DateTimeFormat('en-IN', { weekday: 'long', timeZone: TIMEZONE }).format(d)
        });
    }
    return dates;
}

app.post('/api/verify-reschedule', (req, res) => {
    try {
        const { time_reference } = req.body;

        if (!time_reference) {
            return res.status(400).json({ error: "Missing required parameter: time_reference" });
        }

        const todayIST = getTodayIST();
        const windowStart = addDays(todayIST, 1);
        const windowEnd = addDays(todayIST, 7);

        const available_dates = generateAvailableDates(todayIST);

        const parsedResult = chrono.parseDate(time_reference, todayIST, { forwardDate: true });

        if (!parsedResult || !isDateValid(parsedResult)) {
            return res.json({
                is_valid: false,
                error_type: "unparseable",
                received_reference: time_reference,
                window: {
                    start_iso: format(windowStart, 'yyyy-MM-dd'),
                    end_iso: format(windowEnd, 'yyyy-MM-dd')
                },
                available_dates: available_dates
            });
        }

        const targetDate = startOfDay(parsedResult);
        const targetHindi = formatHindiDate(targetDate);
        const targetISO = format(targetDate, 'yyyy-MM-dd');

        const isPast = isBefore(targetDate, windowStart);
        const isTooFarFuture = isAfter(targetDate, windowEnd);
        const isValid = !isPast && !isTooFarFuture;

        let errorType = null;
        if (isPast) errorType = "past_date";
        if (isTooFarFuture) errorType = "future_date_exceeds_window";

        return res.json({
            is_valid: isValid,
            error_type: errorType,
            received_reference: time_reference,
            target_date_iso: targetISO,
            target_date_hindi: targetHindi,
            window: {
                start_iso: format(windowStart, 'yyyy-MM-dd'),
                end_iso: format(windowEnd, 'yyyy-MM-dd')
            },
            available_dates: available_dates
        });

    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ error: "Internal Server Error while calculating dates." });
    }
});

export default app;
