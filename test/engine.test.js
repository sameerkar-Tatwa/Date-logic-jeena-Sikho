import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../src/engine.js';

describe('7-Day Rescheduling Validation Engine (Express)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // Wed May 15 2024
        vi.setSystemTime(new Date('2024-05-15T10:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const runPost = async (spoken_date) => {
        const response = await request(app)
            .post('/api/verify-reschedule')
            .send(spoken_date ? { user_spoken_date: spoken_date } : {});
        return response;
    }

    it('should return 400 if user_spoken_date is missing', async () => {
        const response = await runPost();
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Missing required parameter: user_spoken_date');
    });

    it('should correctly reject "today" because window starts tomorrow', async () => {
        const response = await runPost('today');
        
        expect(response.status).toBe(200);
        expect(response.body.is_booking_allowed).toBe(false);
        expect(response.body.rejection_reason).toBe('date_is_in_past');
        expect(response.body.next_seven_available_dates.length).toBe(7);
    });

    it('should accept "tomorrow"', async () => {
        const response = await runPost('tomorrow');
        
        expect(response.status).toBe(200);
        expect(response.body.is_booking_allowed).toBe(true);
        expect(response.body.calculated_date_english).toBe('2024-05-16');
        expect(response.body.rejection_reason).toBe(null);
    });

    it('should accept "day after tomorrow"', async () => {
        const response = await runPost('day after tomorrow');
        
        expect(response.status).toBe(200);
        expect(response.body.is_booking_allowed).toBe(true);
        expect(response.body.calculated_date_english).toBe('2024-05-17');
    });

    it('should intercept "next monday" as ambiguous', async () => {
        const response = await runPost('next monday');
        
        expect(response.status).toBe(200);
        expect(response.body.is_booking_allowed).toBe(false);
        expect(response.body.rejection_reason).toBe('ambiguous_day_of_week');
        expect(response.body.clarification_message).toContain('क्या आप');
    });

    it('should intercept "next wednesday" as ambiguous', async () => {
        const response = await runPost('next wednesday');
        
        expect(response.status).toBe(200);
        expect(response.body.is_booking_allowed).toBe(false);
        expect(response.body.rejection_reason).toBe('ambiguous_day_of_week');
        expect(response.body.clarification_message).toContain('क्या आप');
    });

    it('should properly parse "three days after" (May 18)', async () => {
        const response = await runPost('three days after');
        
        expect(response.status).toBe(200);
        expect(response.body.is_booking_allowed).toBe(true);
        expect(response.body.calculated_date_english).toBe('2024-05-18');
    });

    it('should accept a date exactly 7 days away (in 7 days)', async () => {
        const response = await runPost('in 7 days');
        
        expect(response.status).toBe(200);
        expect(response.body.is_booking_allowed).toBe(true);
        expect(response.body.calculated_date_english).toBe('2024-05-22');
    });

    it('should properly parse "10 days after" and reject it', async () => {
        const response = await runPost('10 days after');
        
        expect(response.status).toBe(200);
        expect(response.body.is_booking_allowed).toBe(false);
        expect(response.body.rejection_reason).toBe('date_exceeds_7_day_limit');
    });
    
    it('should properly parse "after two days"', async () => {
        const response = await runPost('after two days');
        
        expect(response.status).toBe(200);
        expect(response.body.is_booking_allowed).toBe(true);
        expect(response.body.calculated_date_english).toBe('2024-05-17'); // 15 + 2 = 17
    });

    it('should handle unparseable gibberish', async () => {
        const response = await runPost('some random non-date string');
        
        expect(response.status).toBe(200);
        expect(response.body.is_booking_allowed).toBe(false);
        expect(response.body.rejection_reason).toBe('unparseable_gibberish');
    });
    it('should properly parse standalone number greater than today (18)', async () => {
        const response = await runPost('18');
        expect(response.status).toBe(200);
        expect(response.body.is_booking_allowed).toBe(true);
        expect(response.body.calculated_date_english).toBe('2024-05-18');
    });

    it('should properly parse standalone ordinal less than today (5th)', async () => {
        const response = await runPost('5th');
        expect(response.status).toBe(200);
        expect(response.body.is_booking_allowed).toBe(false); // June 5th is outside the 7-day window
        expect(response.body.rejection_reason).toBe('date_exceeds_7_day_limit');
        expect(response.body.calculated_date_english).toBe('2024-06-05');
    });

    it('should properly parse Hindi standalone date (5 तारीख)', async () => {
        const response = await runPost('5 तारीख');
        expect(response.status).toBe(200);
        expect(response.body.is_booking_allowed).toBe(false);
        expect(response.body.rejection_reason).toBe('date_exceeds_7_day_limit');
        expect(response.body.calculated_date_english).toBe('2024-06-05');
    });
});
