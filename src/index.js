import { addDays, startOfDay, isBefore, isAfter, format, isValid as isDateValid } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import * as chrono from 'chrono-node';

const TIMEZONE = 'Asia/Kolkata';

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

export default {
  async fetch(request, env, ctx) {
    // Cloudflare Worker POST handler
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: "Only POST method is allowed for /api/verify-reschedule." }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      const body = await request.json();
      const time_reference = body.time_reference;

      if (!time_reference) {
          return new Response(JSON.stringify({ error: "Missing required parameter: time_reference" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      // 1. Establish strict Time bounds in IST
      const todayIST = getTodayIST();
      const windowStart = addDays(todayIST, 1); // T+1 (Tomorrow)
      const windowEnd = addDays(todayIST, 7);   // T+7 (7 days from today)

      const startHindi = formatHindiDate(windowStart);
      const endHindi = formatHindiDate(windowEnd);

      // 2. Parse the natural language string
      const parsedResult = chrono.parseDate(time_reference, todayIST, { forwardDate: true });

      if (!parsedResult || !isDateValid(parsedResult)) {
          return new Response(JSON.stringify({
              is_valid: false,
              received_reference: time_reference,
              agent_message_hindi: `माफ़ कीजिए, मुझे तारीख़ स्पष्ट नहीं हुई। आपकी अपॉइंटमेंट ${startHindi} से ${endHindi} के बीच ही रीशेड्यूल हो सकती है। क्या आप इस बीच की कोई तारीख़ बता सकते हैं?`
          }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
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

      return new Response(JSON.stringify({
          is_valid: isValid,
          received_reference: time_reference,
          target_date_iso: targetISO,
          target_date_hindi: targetHindi,
          window: {
              start_iso: format(windowStart, 'yyyy-MM-dd'),
              end_iso: format(windowEnd, 'yyyy-MM-dd')
          },
          agent_message_hindi: agentMessage
      }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

    } catch (error) {
      return new Response(JSON.stringify({ error: "Internal Server Error while calculating dates." }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }
};
