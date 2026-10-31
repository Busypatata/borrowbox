import { describe, expect, it } from 'vitest';

process.env.DATABASE_URL ??= 'postgresql://x:x@localhost:5432/x';
process.env.SESSION_SECRET ??= 'unit-test-secret-unit-test-secret-1234';

const { detectImageType, validateImage } = await import('../../src/services/storage.service');
const { shouldNotify } = await import('../../src/utils/notificationRules');
const { conversationKey } = await import('../../src/utils/conversationKey');
const { hashPassword, verifyPassword, sha256, randomToken, hashSessionToken, safeEqual } = await import('../../src/utils/crypto');
const { isExclusionViolation } = await import('../../src/utils/errors');

const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]);

describe('image content sniffing', () => {
  it('recognises real formats by magic bytes', () => {
    expect(detectImageType(png)?.mime).toBe('image/png');
    expect(detectImageType(jpg)?.mime).toBe('image/jpeg');
    expect(detectImageType(webp)?.mime).toBe('image/webp');
  });
  it('rejects executables and text renamed to .jpg', () => {
    expect(detectImageType(Buffer.from('MZ' + 'x'.repeat(40)))).toBeNull();
    expect(detectImageType(Buffer.from('<script>alert(1)</script>'.padEnd(40)))).toBeNull();
    expect(detectImageType(Buffer.from('GIF89a' + 'x'.repeat(40)))).toBeNull();
  });
  it('rejects oversized files', () => {
    expect(() => validateImage({ buffer: png, size: 6 * 1024 * 1024 })).toThrow(/smaller than/);
  });
  it('accepts a valid small image', () => expect(validateImage({ buffer: png, size: png.length }).ext).toBe('png'));
});

describe('notification eligibility', () => {
  it('honours opt-outs for non-essential notifications', () => {
    expect(shouldNotify('NEW_MESSAGE', { messages: false })).toBe(false);
    expect(shouldNotify('REQUEST_APPROVED', { requestUpdates: false })).toBe(false);
    expect(shouldNotify('NEW_REVIEW', { reviews: false })).toBe(false);
  });
  it('defaults to enabled', () => expect(shouldNotify('NEW_MESSAGE', null)).toBe(true));
  it('SECURITY notifications can never be disabled', () => {
    expect(shouldNotify('SECURITY', { requestUpdates: false, messages: false, reviews: false })).toBe(true);
  });
});

describe('conversation key', () => {
  const a = '00000000-0000-4000-8000-000000000001';
  const b = '00000000-0000-4000-8000-000000000002';
  it('is symmetric in participants', () => expect(conversationKey(a, b, 'i')).toBe(conversationKey(b, a, 'i')));
  it('differs by item context', () => expect(conversationKey(a, b, 'i1')).not.toBe(conversationKey(a, b, 'i2')));
  it('has a direct context', () => expect(conversationKey(a, b)).toContain('direct'));
});

describe('crypto helpers', () => {
  it('hashes passwords with argon2id and verifies them', async () => {
    const h = await hashPassword('correct horse 9');
    expect(h.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(h, 'correct horse 9')).toBe(true);
    expect(await verifyPassword(h, 'wrong')).toBe(false);
    expect(await verifyPassword('not-a-hash', 'x')).toBe(false);
  });
  it('generates unique url-safe tokens and stable hashes', () => {
    const a = randomToken();
    expect(a).not.toBe(randomToken());
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(sha256(a)).toBe(sha256(a));
    expect(hashSessionToken(a)).not.toBe(sha256(a));
  });
  it('compares in constant time safely', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

describe('error helpers', () => {
  it('detects exclusion-constraint violations', () => {
    expect(isExclusionViolation(new Error('conflicting key value violates exclusion constraint "BorrowRequest_no_overlapping_approved"'))).toBe(true);
    expect(isExclusionViolation(new Error('something else'))).toBe(false);
  });
});
