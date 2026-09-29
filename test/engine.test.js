import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../src/engine.js';
import { format, addDays } from 'date-fns';

describe('7-Day Rescheduling Validation Engine (Express)', () => {
    // We will freeze time at 2024-05-15T10:00:00Z (which is 15:30 IST)
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-05-15T10:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should return 400 if time_reference is missing', async () => {
        const response = await request(app)
            .post('/api/verify-reschedule')
            .send({});
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Missing required parameter: time_reference');
    });

    it('should correctly reject "today" because window starts tomorrow (T+1)', async () => {
        const response = await request(app)
            .post('/api/verify-reschedule')
            .send({ time_reference: 'today' });
        
        expect(response.status).toBe(200);
        expect(response.body.is_valid).toBe(false);
        // It's in the past relative to T+1
        expect(response.body.agent_message_hindi).toContain('मैं बीते हुए समय में अपॉइंटमेंट बुक नहीं कर सकती');
    });

    it('should accept "tomorrow" (T+1)', async () => {
        const response = await request(app)
            .post('/api/verify-reschedule')
            .send({ time_reference: 'tomorrow' });
        
        expect(response.status).toBe(200);
        expect(response.body.is_valid).toBe(true);
        expect(response.body.target_date_iso).toBe('2024-05-16');
        expect(response.body.agent_message_hindi).toContain('जी, आप अपनी OPD appointment 16 मई के लिए reschedule कराना चाहेंगे?');
    });

    it('should accept a date exactly 7 days away (T+7)', async () => {
        const response = await request(app)
            .post('/api/verify-reschedule')
            .send({ time_reference: 'in 7 days' });
        
        expect(response.status).toBe(200);
        expect(response.body.is_valid).toBe(true);
        expect(response.body.target_date_iso).toBe('2024-05-22');
        expect(response.body.agent_message_hindi).toContain('22 मई');
    });

    it('should reject a date beyond 7 days (T+8) with future warning', async () => {
        const response = await request(app)
            .post('/api/verify-reschedule')
            .send({ time_reference: 'in 10 days' });
        
        expect(response.status).toBe(200);
        expect(response.body.is_valid).toBe(false);
        expect(response.body.agent_message_hindi).toContain('फिलहाल मैं आपकी OPD appointment अगले 7 दिनों के अंदर यानी 16 मई से 22 मई तक ही reschedule कर सकती हूँ');
    });

    it('should handle unparseable gibberish with a polite Hindi prompt', async () => {
        const response = await request(app)
            .post('/api/verify-reschedule')
            .send({ time_reference: 'some random non-date string' });
        
        expect(response.status).toBe(200);
        expect(response.body.is_valid).toBe(false);
        expect(response.body.agent_message_hindi).toContain('माफ़ कीजिए, मुझे तारीख़ स्पष्ट नहीं हुई');
    });

    it('should correctly format Hindi dates and expose window boundaries in response', async () => {
        const response = await request(app)
            .post('/api/verify-reschedule')
            .send({ time_reference: 'next wednesday' }); // 22nd May
        
        expect(response.status).toBe(200);
        expect(response.body.window.start_iso).toBe('2024-05-16');
        expect(response.body.window.end_iso).toBe('2024-05-22');
        expect(response.body.target_date_hindi).toBe('22 मई');
    });
});
