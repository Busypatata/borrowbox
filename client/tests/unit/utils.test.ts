import { describe, expect, it } from 'vitest';
import { ApiError } from '@/api/client';
import { errorMessage, formatDate, formatRange, initials, pluralize, timeAgo } from '@/lib/utils';

describe('utils', () => {
  it('formats date-only strings without timezone shift', () => {
    expect(formatDate('2026-03-01')).toBe('1 Mar 2026');
  });
  it('formats ranges', () => {
    expect(formatRange('2026-03-01', '2026-03-01')).toBe('1 Mar 2026');
    expect(formatRange('2026-03-01', '2026-03-05')).toBe('1 Mar – 5 Mar 2026');
  });
  it('timeAgo buckets', () => {
    const now = Date.parse('2026-01-10T12:00:00Z');
    expect(timeAgo('2026-01-10T11:59:50Z', now)).toBe('just now');
    expect(timeAgo('2026-01-10T11:30:00Z', now)).toBe('30m ago');
    expect(timeAgo('2026-01-10T07:00:00Z', now)).toBe('5h ago');
    expect(timeAgo('2026-01-08T12:00:00Z', now)).toBe('2d ago');
  });
  it('initials and pluralize', () => {
    expect(initials('Aditi Rao Kumar')).toBe('AR');
    expect(initials('')).toBe('?');
    expect(pluralize(1, 'item')).toBe('1 item');
    expect(pluralize(3, 'item')).toBe('3 items');
  });
  it('errorMessage prefers ApiError messages and falls back safely', () => {
    expect(errorMessage(new ApiError(409, 'CONFLICT', 'Already booked'))).toBe('Already booked');
    expect(errorMessage('weird')).toMatch(/something went wrong/i);
  });
});
