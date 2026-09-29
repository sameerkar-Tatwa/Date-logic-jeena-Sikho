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
        body: JSON.stringify({ time_reference: query }),
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
    expect(res.body.is_valid).toBe(false);
    expect(res.body.error_type).toBe('past_date');
  });

  it('should parse "tomorrow"', async () => {
    const res = await runRequest('tomorrow');
    expect(res.status).toBe(200);
    expect(res.body.target_date_iso).toBe('2024-05-16');
  });

  it('should parse "next tuesday"', async () => {
    const res = await runRequest('next tuesday');
    expect(res.status).toBe(200);
    expect(res.body.target_date_iso).toBe('2024-05-21');
  });
});
