import { getConnInfo } from '@hono/node-server/conninfo';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';
import type {
  AdminUser,
  MemberQuery,
  MemberSortKey,
  MemberStatus,
} from '../../frontend/src/api/types';
import { safeEqual, signToken, verifyToken } from './auth';
import type { Config } from './config';
import { recentSessions, simulatorSlots } from './domain/admin';
import {
  buildDashboard,
  buildMemberDetail,
  buildView,
  listMembers,
  platoonSummaries,
} from './domain/aggregate';
import type { UnitySession } from './domain/unity';
import { ValidationError, type Repo } from './repo';

const ADMIN: AdminUser = { id: 'admin', name: '관리자', role: 'admin' };
const SORT_KEYS: MemberSortKey[] = ['id', 'name', 'platoonName', 'sessionCount', 'best', 'last', 'score', 'lastDate'];
const STATUSES: MemberStatus[] = ['영점 완료', '재훈련 필요'];

const message = (c: Context, status: 400 | 401 | 404 | 429 | 500 | 503, text: string) =>
  c.json({ message: text }, status);

/** 관리자 계정 하나가 공개 HTTP 80번에 열려 있으므로, 같은 주소에서 연달아 틀리면 잠근다 */
const MAX_LOGIN_FAILURES = 5;
const LOGIN_LOCK_MS = 5 * 60e3;

const clientAddress = (c: Context) => {
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
};

const intOf = (value: string | undefined, fallback: number, max = 1000) => {
  const n = Number(value);
  return value && Number.isInteger(n) && n >= 0 ? Math.min(n, max) : fallback;
};

/** 본문이 JSON 객체가 아니면 null */
const readBody = async (c: Context): Promise<Record<string, unknown> | null> => {
  try {
    const body: unknown = await c.req.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

/** README의 API 계약 + 사격 배치·명단 API. 경로와 응답은 설계 문서 §9 */
export const createApp = (repo: Repo, config: Config, clock: () => Date = () => new Date()) => {
  const app = new Hono();
  const view = () => buildView(repo.state, clock());

  if (config.corsOrigins.length) {
    app.use(
      '/api/*',
      cors({
        origin: config.corsOrigins,
        allowHeaders: ['Authorization', 'Content-Type', 'X-Ingest-Key'],
        allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
      }),
    );
  }

  const admin = createMiddleware(async (c, next) => {
    const header = c.req.header('Authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!config.authSecret || !token || !verifyToken(token, config.authSecret, clock())) {
      return message(c, 401, '로그인이 필요합니다');
    }
    await next();
  });

  /* 인증 */
  const loginFailures = new Map<string, { count: number; lockedUntil: number }>();

  app.post('/api/auth/login', async c => {
    if (!config.adminPassword || !config.authSecret) {
      return message(c, 503, '서버에 관리자 계정이 설정되지 않았습니다 (ADMIN_PASSWORD, AUTH_SECRET)');
    }
    const now = clock().getTime();
    const address = clientAddress(c);
    const record = loginFailures.get(address);
    if (record && record.lockedUntil > now) {
      return message(c, 429, '로그인을 여러 번 실패했습니다. 5분 뒤 다시 시도하세요');
    }

    const body = await readBody(c);
    const username = typeof body?.username === 'string' ? body.username : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!username || !password) return message(c, 400, '아이디와 비밀번호를 입력하세요');
    if (!safeEqual(username, config.adminUsername) || !safeEqual(password, config.adminPassword)) {
      const failures = (record?.count ?? 0) + 1;
      loginFailures.set(
        address,
        failures >= MAX_LOGIN_FAILURES
          ? { count: 0, lockedUntil: now + LOGIN_LOCK_MS }
          : { count: failures, lockedUntil: 0 },
      );
      return message(c, 401, '아이디 또는 비밀번호가 맞지 않습니다');
    }

    loginFailures.delete(address);
    return c.json({ token: signToken(config.authSecret, clock()), user: ADMIN });
  });

  app.get('/api/auth/me', admin, c => c.json(ADMIN));

  /* 중대 · 소대 · 대시보드 */
  app.get('/api/company', admin, c => {
    const v = view();
    return c.json({ ...v.company, platoonCount: v.platoons.length, memberCount: v.members.length });
  });

  app.get('/api/platoons', admin, c => c.json(platoonSummaries(view(), intOf(c.req.query('range'), 30, 365))));

  app.get('/api/dashboard', admin, c => {
    const data = buildDashboard(view(), intOf(c.req.query('range'), 30, 365), c.req.query('platoonId') || undefined);
    return data ? c.json(data) : message(c, 404, '소대을(를) 찾을 수 없습니다');
  });

  /* 인원 */
  app.get('/api/members', admin, c => {
    const q = c.req.query();
    const query: MemberQuery = {
      platoonId: q.platoonId || undefined,
      q: q.q || undefined,
      status: STATUSES.includes(q.status as MemberStatus) ? (q.status as MemberStatus) : undefined,
      sort: SORT_KEYS.includes(q.sort as MemberSortKey) ? (q.sort as MemberSortKey) : undefined,
      dir: q.dir === 'asc' ? 'asc' : 'desc',
      page: intOf(q.page, 0),
      size: Math.max(1, intOf(q.size, 12, 200)),
    };
    return c.json(listMembers(view(), query));
  });

  app.get('/api/members/:id', admin, c => {
    const data = buildMemberDetail(view(), c.req.param('id'));
    return data ? c.json(data) : message(c, 404, '인원을(를) 찾을 수 없습니다');
  });

  // 사용자 본인 대시보드 — 군번만 알면 열린다 (README에 적힌 알려진 위험)
  app.get('/api/me/:id', c => {
    const data = buildMemberDetail(view(), c.req.param('id'));
    return data ? c.json(data) : message(c, 404, '인원을(를) 찾을 수 없습니다');
  });

  /* 유니티 수신 — ShootingResultSender 제한 시간(2초) 안에 응답한다 */
  app.post('/api/session', async c => {
    if (config.ingestKey && !safeEqual(c.req.header('X-Ingest-Key') ?? '', config.ingestKey)) {
      return message(c, 401, '수신 키가 맞지 않습니다');
    }
    const body = await readBody(c);
    if (!body) return message(c, 400, '세션 JSON을 읽지 못했습니다');
    await repo.ingest(body as unknown as UnitySession, clock());
    return c.json({ ok: true }, 202);
  });

  /* 명단 · 사격 배치 */
  app.post('/api/roster', admin, async c => {
    const body = await readBody(c);
    if (typeof body?.text !== 'string') return message(c, 400, '명단 텍스트(text)가 필요합니다');
    return c.json(await repo.upsertRoster(body.text));
  });

  app.get('/api/simulators', admin, c => c.json(simulatorSlots(repo.state)));

  app.put('/api/simulators/:id', admin, async c => {
    const body = await readBody(c);
    const memberId = body?.memberId;
    if (memberId !== null && typeof memberId !== 'string') {
      return message(c, 400, 'memberId(군번 또는 null)가 필요합니다');
    }
    await repo.assignSimulator(c.req.param('id'), memberId, clock());
    return c.json({ ok: true });
  });

  app.get('/api/sessions/recent', admin, c =>
    c.json(recentSessions(repo.state, Math.max(1, intOf(c.req.query('limit'), 20, 200)))),
  );

  app.post('/api/sessions/:id/assign', admin, async c => {
    const body = await readBody(c);
    if (typeof body?.memberId !== 'string') return message(c, 400, 'memberId(군번)가 필요합니다');
    await repo.assignSession(c.req.param('id'), body.memberId);
    return c.json({ ok: true });
  });

  app.notFound(c => message(c, 404, '없는 경로입니다'));

  app.onError((error, c) => {
    if (error instanceof ValidationError) return message(c, 400, error.message);
    console.error(error);
    return message(c, 500, '서버 오류가 발생했습니다');
  });

  return app;
};
