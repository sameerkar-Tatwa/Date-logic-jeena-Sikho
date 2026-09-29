import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../src/engine.js';

describe('7-Day Rescheduling Validation Engine (Express)', () => {
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

    it('should correctly reject "today" because window starts tomorrow', async () => {
        const response = await request(app)
            .post('/api/verify-reschedule')
            .send({ time_reference: 'today' });
        
        expect(response.status).toBe(200);
        expect(response.body.is_valid).toBe(false);
        expect(response.body.error_type).toBe('past_date');
        expect(response.body.available_dates.length).toBe(7);
    });

    it('should accept "tomorrow"', async () => {
        const response = await request(app)
            .post('/api/verify-reschedule')
            .send({ time_reference: 'tomorrow' });
        
        expect(response.status).toBe(200);
        expect(response.body.is_valid).toBe(true);
        expect(response.body.target_date_iso).toBe('2024-05-16');
        expect(response.body.error_type).toBe(null);
    });

    it('should accept a date exactly 7 days away (in 7 days)', async () => {
        const response = await request(app)
            .post('/api/verify-reschedule')
            .send({ time_reference: 'in 7 days' });
        
        expect(response.status).toBe(200);
        expect(response.body.is_valid).toBe(true);
        expect(response.body.target_date_iso).toBe('2024-05-22');
    });

    it('should properly parse "10 days after" and reject it', async () => {
        const response = await request(app)
            .post('/api/verify-reschedule')
            .send({ time_reference: '10 days after' });
        
        expect(response.status).toBe(200);
        expect(response.body.is_valid).toBe(false);
        expect(response.body.error_type).toBe('future_date_exceeds_window');
    });
    
    it('should properly parse "after two days"', async () => {
        const response = await request(app)
            .post('/api/verify-reschedule')
            .send({ time_reference: 'after two days' });
        
        expect(response.status).toBe(200);
        expect(response.body.is_valid).toBe(true);
        expect(response.body.target_date_iso).toBe('2024-05-17'); // 15 + 2 = 17
    });

    it('should handle unparseable gibberish', async () => {
        const response = await request(app)
            .post('/api/verify-reschedule')
            .send({ time_reference: 'some random non-date string' });
        
        expect(response.status).toBe(200);
        expect(response.body.is_valid).toBe(false);
        expect(response.body.error_type).toBe('unparseable');
    });
});
