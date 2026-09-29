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

    it('should accept "next monday" (May 20)', async () => {
        const response = await runPost('next monday');
        
        expect(response.status).toBe(200);
        expect(response.body.is_booking_allowed).toBe(true);
        expect(response.body.calculated_date_english).toBe('2024-05-20');
    });

    it('should accept "next wednesday" (May 22, boundary limit)', async () => {
        const response = await runPost('next wednesday');
        
        expect(response.status).toBe(200);
        expect(response.body.is_booking_allowed).toBe(true);
        expect(response.body.calculated_date_english).toBe('2024-05-22');
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
});
