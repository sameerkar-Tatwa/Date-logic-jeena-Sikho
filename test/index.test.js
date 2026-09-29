import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import worker from '../src/index.js';

describe('Date 7-day Tool Worker', () => {
  // Mock Date to ensure deterministic tests
  beforeEach(() => {
    // Let's pretend today is 2024-05-15 10:00:00 UTC
    // In IST (UTC+5:30), this is 2024-05-15 15:30:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-05-15T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const runRequest = async (query, method = 'GET') => {
    let req;
    if (method === 'GET') {
      req = new Request(`http://localhost/?query=${encodeURIComponent(query)}`);
    } else {
      req = new Request('http://localhost/', {
        method: 'POST',
        body: JSON.stringify({ query }),
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const res = await worker.fetch(req, {}, {});
    return {
      status: res.status,
      body: await res.json()
    };
  };

  it('should return error if no query is provided (GET)', async () => {
    const res = await runRequest('');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Missing query');
  });

  it('should return error if no query is provided (POST)', async () => {
    const res = await runRequest('', 'POST');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Missing query');
  });

  it('should parse "today" and return 0 relative days', async () => {
    const res = await runRequest('today');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.relativeDays).toBe(0);
    expect(res.body.parsedDate).toBe('2024-05-15');
  });

  it('should parse "tomorrow" and return 1 relative day', async () => {
    const res = await runRequest('tomorrow');
    expect(res.status).toBe(200);
    expect(res.body.relativeDays).toBe(1);
    expect(res.body.parsedDate).toBe('2024-05-16');
  });

  it('should parse "next tuesday" (which is May 21)', async () => {
    // 2024-05-15 is Wednesday. Next Tuesday is May 21 (6 days later)
    const res = await runRequest('next tuesday');
    expect(res.status).toBe(200);
    expect(res.body.relativeDays).toBe(6);
    expect(res.body.parsedDate).toBe('2024-05-21');
  });

  it('should reject "yesterday" as it is in the past', async () => {
    const res = await runRequest('yesterday');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('in the past');
    expect(res.body.parsedDate).toBe('2024-05-14');
  });

  it('should parse "in 5 days"', async () => {
    const res = await runRequest('in 5 days');
    expect(res.status).toBe(200);
    expect(res.body.relativeDays).toBe(5);
    expect(res.body.parsedDate).toBe('2024-05-20');
  });

  it('should parse "in 7 days"', async () => {
    const res = await runRequest('in 7 days');
    expect(res.status).toBe(200);
    expect(res.body.relativeDays).toBe(7);
    expect(res.body.parsedDate).toBe('2024-05-22');
  });

  it('should reject dates beyond the 7-day window (e.g. "in 10 days")', async () => {
    const res = await runRequest('in 10 days');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('outside the 7-day window');
    expect(res.body.parsedDate).toBe('2024-05-25');
  });

  it('should handle "next week" safely (might be ambiguous but let us see what chrono does)', async () => {
    const res = await runRequest('next week');
    // next week typically resolves to exactly 7 days from now in Chrono
    if (res.status === 200) {
      expect(res.body.relativeDays).toBeLessThanOrEqual(7);
    } else {
      expect(res.status).toBe(400);
    }
  });

  it('should return 400 for unparseable gibberish', async () => {
    const res = await runRequest('kajshdkjashdkjashd');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Could not parse');
  });
});
