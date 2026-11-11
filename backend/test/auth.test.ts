import { describe, expect, it } from 'vitest';
import { signToken, verifyToken } from '../src/auth';

const NOW = new Date('2026-11-11T09:00:00+09:00');
const HOUR = 3600e3;

describe('auth token', () => {
  it('verifies until it expires after 12 hours', () => {
    const token = signToken('secret', NOW);
    expect(verifyToken(token, 'secret', new Date(NOW.getTime() + 11 * HOUR))).toBe(true);
    expect(verifyToken(token, 'secret', new Date(NOW.getTime() + 13 * HOUR))).toBe(false);
  });

  it('rejects a token signed with another secret or tampered with', () => {
    const token = signToken('secret', NOW);
    expect(verifyToken(token, 'other', NOW)).toBe(false);
    const [payload, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'admin', exp: NOW.getTime() * 2 })).toString('base64url');
    expect(verifyToken(`${forged}.${sig}`, 'secret', NOW)).toBe(false);
    expect(verifyToken(payload, 'secret', NOW)).toBe(false);
    expect(verifyToken('', 'secret', NOW)).toBe(false);
  });
});
