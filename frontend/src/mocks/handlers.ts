import type { LoginRequest, MemberSortKey, MemberStatus } from '@/api/types';
import {
  buildDashboard,
  buildMemberDetail,
  platoonSummaries,
  toMember,
} from '@/mocks/data/aggregate';
import { COMPANY, PLATOONS, members } from '@/mocks/data/seed';
import { http, HttpResponse } from 'msw';

const MOCK_TOKEN = 'mock-admin-token';
const ADMIN = { id: 'admin', name: '관리자', role: 'admin' as const };
const DEVELOPER = { id: 'developer', name: '개발자', role: 'admin' as const };

const authed = (req: Request) => req.headers.get('Authorization') === `Bearer ${MOCK_TOKEN}`;
const unauthorized = () => HttpResponse.json({ message: '로그인이 필요합니다' }, { status: 401 });
const notFound = (what: string) =>
  HttpResponse.json({ message: `${what}을(를) 찾을 수 없습니다` }, { status: 404 });

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
];
