import { describe, expect, it } from 'vitest';
import {
  TX_ACTIONS,
  averageRating,
  canTransitionRequest,
  canTransitionTransaction,
  distanceKm,
  rangesOverlap,
  validateDateRange,
  registerSchema,
  createItemSchema,
  createReviewSchema,
  createReportSchema,
  sendMessageSchema,
  itemQuerySchema,
} from '@borrowbox/shared';

const NOW = new Date('2026-11-01T10:00:00Z');

describe('date range rules', () => {
  it('accepts a valid range', () => expect(validateDateRange('2026-11-02', '2026-11-05', NOW)).toBeNull());
  it('accepts a single-day booking starting today', () => expect(validateDateRange('2026-11-01', '2026-11-01', NOW)).toBeNull());
  it('rejects past start', () => expect(validateDateRange('2026-10-31', '2026-11-02', NOW)).toBe('START_IN_PAST'));
  it('rejects end before start', () => expect(validateDateRange('2026-11-05', '2026-11-03', NOW)).toBe('END_BEFORE_START'));
  it('rejects bookings longer than the maximum', () => expect(validateDateRange('2026-11-02', '2026-12-31', NOW, 30)).toBe('TOO_LONG'));
  it('allows exactly the maximum', () => expect(validateDateRange('2026-11-01', '2026-11-30', NOW, 30)).toBeNull());
});

describe('availability overlap', () => {
  const a = { startDate: '2026-11-10', endDate: '2026-11-12' };
  it('detects shared boundary day as overlap', () => expect(rangesOverlap(a, { startDate: '2026-11-12', endDate: '2026-11-14' })).toBe(true));
  it('detects containment', () => expect(rangesOverlap(a, { startDate: '2026-11-11', endDate: '2026-11-11' })).toBe(true));
  it('allows adjacent days', () => expect(rangesOverlap(a, { startDate: '2026-11-13', endDate: '2026-11-15' })).toBe(false));
  it('allows earlier ranges', () => expect(rangesOverlap(a, { startDate: '2026-11-01', endDate: '2026-11-09' })).toBe(false));
});

describe('request state machine', () => {
  it('allows PENDING -> APPROVED/DECLINED/CANCELLED', () => {
    for (const to of ['APPROVED', 'DECLINED', 'CANCELLED'] as const) expect(canTransitionRequest('PENDING', to)).toBe(true);
  });
  it('never reopens terminal states', () => {
    for (const from of ['DECLINED', 'CANCELLED', 'COMPLETED'] as const) {
      for (const to of ['PENDING', 'APPROVED', 'DECLINED', 'CANCELLED', 'COMPLETED'] as const) {
        expect(canTransitionRequest(from, to)).toBe(false);
      }
    }
  });
  it('approved cannot be cancelled or declined', () => {
    expect(canTransitionRequest('APPROVED', 'CANCELLED')).toBe(false);
    expect(canTransitionRequest('APPROVED', 'DECLINED')).toBe(false);
    expect(canTransitionRequest('APPROVED', 'COMPLETED')).toBe(true);
  });
});

describe('transaction state machine', () => {
  it('follows the happy path', () => {
    expect(canTransitionTransaction('AWAITING_HANDOVER', 'BORROWED')).toBe(true);
    expect(canTransitionTransaction('BORROWED', 'RETURN_REQUESTED')).toBe(true);
    expect(canTransitionTransaction('RETURN_REQUESTED', 'COMPLETED')).toBe(true);
  });
  it('rejects out-of-order completion', () => {
    expect(canTransitionTransaction('AWAITING_HANDOVER', 'COMPLETED')).toBe(false);
    expect(canTransitionTransaction('AWAITING_HANDOVER', 'RETURN_REQUESTED')).toBe(false);
  });
  it('completed is terminal', () => expect(canTransitionTransaction('COMPLETED', 'BORROWED')).toBe(false));
  it('assigns each action to the right participant', () => {
    expect(TX_ACTIONS['confirm-handover'].role).toBe('OWNER');
    expect(TX_ACTIONS['request-return'].role).toBe('BORROWER');
    expect(TX_ACTIONS['confirm-return'].role).toBe('OWNER');
  });
  it('confirm-return cannot run twice (COMPLETED not in from)', () => {
    expect(TX_ACTIONS['confirm-return'].from).not.toContain('COMPLETED');
  });
  it('every action target is a legal transition from each allowed source', () => {
    for (const rule of Object.values(TX_ACTIONS)) {
      for (const from of rule.from) expect(canTransitionTransaction(from, rule.to)).toBe(true);
    }
  });
});

describe('ratings & distance', () => {
  it('returns null (not a fake 5) with no reviews', () => expect(averageRating([])).toBeNull());
  it('rounds to one decimal', () => expect(averageRating([5, 4, 4])).toBe(4.3));
  it('computes haversine distance', () => expect(distanceKm(24.817, 93.936, 24.808, 93.944)).toBeGreaterThan(0.5));
  it('zero distance for same point', () => expect(distanceKm(10, 10, 10, 10)).toBe(0));
});

describe('validation schemas', () => {
  const valid = { name: 'Ada Lovelace', email: ' ADA@Example.com ', password: 'longpass123', confirmPassword: 'longpass123', acceptTerms: true };
  it('normalises email', () => expect(registerSchema.parse(valid).email).toBe('ada@example.com'));
  it('rejects weak passwords', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'short1', confirmPassword: 'short1' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, password: 'onlyletterspass', confirmPassword: 'onlyletterspass' }).success).toBe(false);
  });
  it('requires matching confirmation and terms', () => {
    expect(registerSchema.safeParse({ ...valid, confirmPassword: 'different123' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
  });
  it('validates item bounds', () => {
    const item = { title: 'Drill', description: 'x'.repeat(20), category: 'tools-diy', condition: 'GOOD', community: 'Here', city: 'There' };
    expect(createItemSchema.safeParse(item).success).toBe(true);
    expect(createItemSchema.safeParse({ ...item, title: 'ab' }).success).toBe(false);
    expect(createItemSchema.safeParse({ ...item, description: 'short' }).success).toBe(false);
    expect(createItemSchema.safeParse({ ...item, category: 'weapons' }).success).toBe(false);
  });
  it('validates ratings are integers 1..5', () => {
    for (const r of [0, 6, 2.5]) expect(createReviewSchema.safeParse({ rating: r }).success).toBe(false);
    expect(createReviewSchema.safeParse({ rating: 5 }).success).toBe(true);
  });
  it('rejects whitespace-only messages and over-long ones', () => {
    expect(sendMessageSchema.safeParse({ body: '   ' }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ body: 'x'.repeat(2001) }).success).toBe(false);
    expect(sendMessageSchema.safeParse({ body: 'hello' }).success).toBe(true);
  });
  it('reports must target exactly one thing', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(createReportSchema.safeParse({ reason: 'OTHER' }).success).toBe(false);
    expect(createReportSchema.safeParse({ reason: 'OTHER', itemId: id, userId: id }).success).toBe(false);
    expect(createReportSchema.safeParse({ reason: 'OTHER', itemId: id }).success).toBe(true);
  });
  it('clamps page size via validation', () => {
    expect(itemQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
    expect(itemQuerySchema.parse({}).pageSize).toBe(12);
  });
});
