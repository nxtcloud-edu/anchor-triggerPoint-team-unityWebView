import type {
  LoginRequest,
  MemberSortKey,
  MemberStatus,
  RecentSession,
  SimulatorSlot,
} from '@/api/types';
import {
  buildDashboard,
  buildMemberDetail,
  platoonSummaries,
  toMember,
} from '@/mocks/data/aggregate';
import { COMPANY, PLATOONS, members, sessions } from '@/mocks/data/seed';
import { http, HttpResponse } from 'msw';

const MOCK_TOKEN = 'mock-admin-token';
const ADMIN = { id: 'admin', name: '관리자', role: 'admin' as const };
const DEVELOPER = { id: 'developer', name: '개발자', role: 'admin' as const };

const authed = (req: Request) => req.headers.get('Authorization') === `Bearer ${MOCK_TOKEN}`;
const unauthorized = () => HttpResponse.json({ message: '로그인이 필요합니다' }, { status: 401 });
const notFound = (what: string) =>
  HttpResponse.json({ message: `${what}을(를) 찾을 수 없습니다` }, { status: 404 });
const badRequest = (message: string) => HttpResponse.json({ message }, { status: 400 });

/* 사격 배치 — 새로고침하면 처음 상태로 돌아가는 메모리 데이터 */
const assignments = new Map<string, { memberId: string | null; assignedAt: string | null }>(
  members.slice(0, 3).map((m, i) => [String(i + 1), { memberId: m.id, assignedAt: null }]),
);
const sessionOwner = new Map<string, string>();
const memberById = new Map(members.map(m => [m.id, m]));

const simulatorSlots = (): SimulatorSlot[] =>
  Array.from({ length: COMPANY.simulatorCount }, (_, i) => {
    const id = String(i + 1);
    const a = assignments.get(id);
    const m = a?.memberId ? memberById.get(a.memberId) : undefined;
    return {
      id,
      member: m ? { id: m.id, name: m.name, platoonName: m.platoonName } : null,
      assignedAt: a?.assignedAt ?? null,
    };
  });

const recentSessions = (limit: number): RecentSession[] =>
  [...sessions]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, limit)
    .map((s, i) => {
      const owner = memberById.get(sessionOwner.get(s.id) ?? s.memberId);
      const shots = s.rounds.reduce((n, r) => n + r.shots.length, 0);
      return {
        id: s.id,
        date: s.date.toISOString(),
        simulatorId: String((i % COMPANY.simulatorCount) + 1),
        memberId: owner?.id ?? null,
        memberName: owner?.name ?? null,
        shotsFired: shots,
        hitCount: shots,
        diameter: s.diameter,
        counted: true,
        stageName: 'Stage01',
      };
    });

export const handlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as LoginRequest;
    if (!body.username || !body.password) {
      return HttpResponse.json({ message: '아이디와 비밀번호를 입력하세요' }, { status: 400 });
    }
    return HttpResponse.json({
      token: MOCK_TOKEN,
      user: body.username === DEVELOPER.id ? DEVELOPER : ADMIN,
    });
  }),

  http.get('/api/auth/me', ({ request }) =>
    authed(request) ? HttpResponse.json(ADMIN) : unauthorized(),
  ),

  http.get('/api/company', ({ request }) => {
    if (!authed(request)) return unauthorized();
    return HttpResponse.json({
      ...COMPANY,
      platoonCount: PLATOONS.length,
      memberCount: members.length,
    });
  }),

  http.get('/api/platoons', ({ request }) => {
    if (!authed(request)) return unauthorized();
    const range = Number(new URL(request.url).searchParams.get('range') ?? 30);
    return HttpResponse.json(platoonSummaries(range));
  }),

  http.get('/api/dashboard', ({ request }) => {
    if (!authed(request)) return unauthorized();
    const p = new URL(request.url).searchParams;
    const data = buildDashboard(Number(p.get('range') ?? 30), p.get('platoonId') ?? undefined);
    return data ? HttpResponse.json(data) : notFound('소대');
  }),

  http.get('/api/members', ({ request }) => {
    if (!authed(request)) return unauthorized();
    const p = new URL(request.url).searchParams;
    const platoonId = p.get('platoonId');
    const q = p.get('q')?.trim();
    const status = p.get('status') as MemberStatus | null;
    const sort = (p.get('sort') ?? 'score') as MemberSortKey;
    const dir = p.get('dir') === 'asc' ? 1 : -1;
    const page = Number(p.get('page') ?? 0);
    const size = Number(p.get('size') ?? 12);

    const rows = members
      .map(toMember)
      .filter(m => (!platoonId || m.platoonId === platoonId) && (!status || m.status === status))
      .filter(m => !q || m.name.includes(q) || m.id.includes(q))
      .sort((a, b) => {
        const x = sort === 'platoonName' ? Number(a.platoonId.slice(1)) : a[sort];
        const y = sort === 'platoonName' ? Number(b.platoonId.slice(1)) : b[sort];
        return (x > y ? 1 : x < y ? -1 : 0) * dir;
      });
    return HttpResponse.json({
      items: rows.slice(page * size, page * size + size),
      total: rows.length,
      page,
      size,
    });
  }),

  http.get('/api/members/:id', ({ request, params }) => {
    if (!authed(request)) return unauthorized();
    const data = buildMemberDetail(String(params.id));
    return data ? HttpResponse.json(data) : notFound('인원');
  }),

  // 사용자 본인 대시보드 — 지금은 인증 없이 군번으로 조회 (실서비스 전 사용자 인증 필요)
  http.get('/api/me/:id', ({ params }) => {
    const data = buildMemberDetail(String(params.id));
    return data ? HttpResponse.json(data) : notFound('인원');
  }),

  // 명단 붙여넣기 — 더미 모드에서는 줄 수만 세고 인원은 바꾸지 않는다
  http.post('/api/roster', async ({ request }) => {
    if (!authed(request)) return unauthorized();
    const { text } = (await request.json()) as { text?: string };
    const lines = (text ?? '').split(/\r?\n/).filter(l => /\d/.test(l));
    return HttpResponse.json({ added: lines.length, updated: 0, errors: [] });
  }),

  http.get('/api/simulators', ({ request }) =>
    authed(request) ? HttpResponse.json(simulatorSlots()) : unauthorized(),
  ),

  http.put('/api/simulators/:id', async ({ request, params }) => {
    if (!authed(request)) return unauthorized();
    const id = String(params.id);
    const { memberId } = (await request.json()) as { memberId: string | null };
    if (Number(id) < 1 || Number(id) > COMPANY.simulatorCount) {
      return badRequest(`시뮬레이터 ${id}번은 없습니다`);
    }
    if (memberId && !memberById.has(memberId))
      return badRequest(`군번 ${memberId}을(를) 찾을 수 없습니다`);
    assignments.set(id, { memberId, assignedAt: memberId ? new Date().toISOString() : null });
    return HttpResponse.json({ ok: true });
  }),

  http.get('/api/sessions/recent', ({ request }) => {
    if (!authed(request)) return unauthorized();
    const limit = Number(new URL(request.url).searchParams.get('limit') ?? 20);
    return HttpResponse.json(recentSessions(limit));
  }),

  http.post('/api/sessions/:id/assign', async ({ request, params }) => {
    if (!authed(request)) return unauthorized();
    const { memberId } = (await request.json()) as { memberId: string };
    if (!memberById.has(memberId)) return badRequest(`군번 ${memberId}을(를) 찾을 수 없습니다`);
    sessionOwner.set(String(params.id), memberId);
    return HttpResponse.json({ ok: true });
  }),
];
