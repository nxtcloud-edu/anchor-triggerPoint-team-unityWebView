import { createHmac, timingSafeEqual } from 'node:crypto';

const TTL_MS = 12 * 3600e3;

const sign = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest('base64url');

/** 같은 길이로 맞춘 뒤 비교해서 비교 시간으로 값이 새지 않게 한다 */
export const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** "payload.signature" — 서버가 재시작돼도 AUTH_SECRET이 같으면 계속 유효하다 */
export const signToken = (secret: string, now: Date, ttlMs = TTL_MS) => {
  const payload = Buffer.from(JSON.stringify({ sub: 'admin', exp: now.getTime() + ttlMs })).toString(
    'base64url',
  );
  return `${payload}.${sign(payload, secret)}`;
};

export const verifyToken = (token: string, secret: string, now: Date) => {
  const [payload, signature] = token.split('.');
  if (!payload || !signature || !safeEqual(signature, sign(payload, secret))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: unknown };
    return typeof exp === 'number' && exp > now.getTime();
  } catch {
    return false;
  }
};
