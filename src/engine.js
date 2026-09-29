import express from 'express';
import * as chrono from 'chrono-node';
import { addDays, startOfDay, isBefore, isAfter, format, isValid as isDateValid } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

const app = express();
app.use(express.json());

const TIMEZONE = 'Asia/Kolkata';

/**
 * Formats a Date object into a conversational Hindi string.
 * Example output: "5 अक्टूबर" or "12 नवंबर"
 */
export function formatHindiDate(dateObj) {
    const options = { day: 'numeric', month: 'long', timeZone: TIMEZONE };
    return new Intl.DateTimeFormat('hi-IN', options).format(dateObj);
}

/**
 * Gets the absolute "Start of Day" for today in IST time.
 * This prevents bugs where 11:59 PM UTC shifts the day incorrectly.
 */
export function getTodayIST() {
    const now = new Date();
    // A trick to create an IST date object from UTC current time:
    const nowISTStr = formatInTimeZone(now, TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
    const zonedNow = new Date(nowISTStr);
    return startOfDay(zonedNow);
}

// POST Endpoint for the AI Voice Agent Tool
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

        // Strings for fallback/error messages
        const startHindi = formatHindiDate(windowStart);
        const endHindi = formatHindiDate(windowEnd);

        // 2. Parse the natural language string using Chrono-node
        // { forwardDate: true } assumes the user means the future if they just say "Monday"
        const parsedResult = chrono.parseDate(time_reference, todayIST, { forwardDate: true });

        // Handle Unparsable gibberish
        if (!parsedResult || !isDateValid(parsedResult)) {
            return res.json({
                is_valid: false,
                received_reference: time_reference,
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

        // 4. Generate AI Agent Script
        let agentMessage = "";

        if (isValid) {
            // Success Scenario
            agentMessage = `जी, आप अपनी OPD appointment ${targetHindi} के लिए reschedule कराना चाहेंगे?`;
        } else if (isPast) {
            // Past Date Scenario
            agentMessage = `जी, मैं बीते हुए समय में अपॉइंटमेंट बुक नहीं कर सकती। मैं अगले 7 दिनों यानी ${startHindi} से ${endHindi} तक रीशेड्यूल कर सकती हूँ। आप कौन सी तारीख़ चाहेंगे?`;
        } else if (isTooFarFuture) {
            // Future Bound Exceeded Scenario
            agentMessage = `जी, फिलहाल मैं आपकी OPD appointment अगले 7 दिनों के अंदर यानी ${startHindi} से ${endHindi} तक ही reschedule कर सकती हूँ। क्या आप इस बीच कोई तारीख़ बता सकते हैं?`;
        }

        // 5. Construct Final Response Payload
        return res.json({
            is_valid: isValid,
            received_reference: time_reference,
            target_date_iso: targetISO,
            target_date_hindi: targetHindi,
            window: {
                start_iso: format(windowStart, 'yyyy-MM-dd'),
                end_iso: format(windowEnd, 'yyyy-MM-dd')
            },
            agent_message_hindi: agentMessage
        });

    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ error: "Internal Server Error while calculating dates." });
    }
});

export default app;
