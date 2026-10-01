import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from '../src/index.js';

describe('Date 7-day Tool Worker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-15T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const runRequest = async (query) => {
    const req = new Request('http://localhost/api/verify-reschedule', {
        method: 'POST',
        body: JSON.stringify({ user_spoken_date: query }),
        headers: { 'Content-Type': 'application/json' }
    });
    const res = await worker.fetch(req, {}, {});
    return {
      status: res.status,
      body: await res.json()
    };
  };

  it('should return error if no query is provided (POST)', async () => {
    const res = await runRequest('');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Missing required');
  });

  it('should reject "today"', async () => {
    const res = await runRequest('today');
    expect(res.status).toBe(200);
    expect(res.body.is_booking_allowed).toBe(false);
    expect(res.body.rejection_reason).toBe('date_is_in_past');
  });

  it('should parse "tomorrow"', async () => {
    const res = await runRequest('tomorrow');
    expect(res.status).toBe(200);
    expect(res.body.calculated_date_english).toBe('2024-05-16');
  });

  it('should intercept "next tuesday" as ambiguous', async () => {
    const res = await runRequest('next tuesday');
    expect(res.status).toBe(200);
    expect(res.body.is_booking_allowed).toBe('ambiguous');
    expect(res.body.rejection_reason).toBe('ambiguous_day_of_week');
  });
  it('should parse standalone number (18)', async () => {
    const res = await runRequest('18');
    expect(res.status).toBe(200);
    expect(res.body.calculated_date_english).toBe('2024-05-18');
  });

  it('should parse Hindi standalone date (5 तारीख)', async () => {
    const res = await runRequest('5 तारीख');
    expect(res.status).toBe(200);
    expect(res.body.is_booking_allowed).toBe(false);
    expect(res.body.calculated_date_english).toBe('2024-06-05');
  });
});
