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

        // 1. Establish strict Time bounds in IST
        const todayIST = getTodayIST();
        const windowStart = addDays(todayIST, 1); // T+1 (Tomorrow)
        const windowEnd = addDays(todayIST, 7);   // T+7 (7 days from today)

        const startHindi = formatHindiDate(windowStart);
        const endHindi = formatHindiDate(windowEnd);

        // Generate array of next 7 days
        const available_dates = generateAvailableDates(todayIST);

        // 2. Parse the natural language string
        const parsedResult = chrono.parseDate(time_reference, todayIST, { forwardDate: true });

        if (!parsedResult || !isDateValid(parsedResult)) {
            return res.json({
                is_valid: false,
                received_reference: time_reference,
                available_dates: available_dates,
                agent_message_hindi: `माफ़ कीजिए, मुझे तारीख़ स्पष्ट नहीं हुई। आपकी अपॉइंटमेंट ${startHindi} से ${endHindi} के बीच ही रीशेड्यूल हो सकती है। क्या आप इस बीच की कोई तारीख़ बता सकते हैं?`
            });
        }

        const targetDate = startOfDay(parsedResult);
        const targetHindi = formatHindiDate(targetDate);
        const targetISO = format(targetDate, 'yyyy-MM-dd');

        // 3. Validation Logic
        const isPast = isBefore(targetDate, windowStart);
        const isTooFarFuture = isAfter(targetDate, windowEnd);
        const isValid = !isPast && !isTooFarFuture;

        let agentMessage = "";
        if (isValid) {
            agentMessage = `जी, आप अपनी OPD appointment ${targetHindi} के लिए reschedule कराना चाहेंगे?`;
        } else if (isPast) {
            agentMessage = `जी, मैं बीते हुए समय में अपॉइंटमेंट बुक नहीं कर सकती। मैं अगले 7 दिनों यानी ${startHindi} से ${endHindi} तक रीशेड्यूल कर सकती हूँ। आप कौन सी तारीख़ चाहेंगे?`;
        } else if (isTooFarFuture) {
            agentMessage = `जी, फिलहाल मैं आपकी OPD appointment अगले 7 दिनों के अंदर यानी ${startHindi} से ${endHindi} तक ही reschedule कर सकती हूँ। क्या आप इस बीच कोई तारीख़ बता सकते हैं?`;
        }

        return res.json({
            is_valid: isValid,
            received_reference: time_reference,
            target_date_iso: targetISO,
            target_date_hindi: targetHindi,
            window: {
                start_iso: format(windowStart, 'yyyy-MM-dd'),
                end_iso: format(windowEnd, 'yyyy-MM-dd')
            },
            available_dates: available_dates,
            agent_message_hindi: agentMessage
        });

    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ error: "Internal Server Error while calculating dates." });
    }
});

export default app;
