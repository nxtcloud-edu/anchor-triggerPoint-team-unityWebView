import { api } from '@/api/axios';
import type {
  AdminUser,
  Company,
  Dashboard,
  DashboardQuery,
  LoginRequest,
  LoginResponse,
  Member,
  MemberDetail,
  MemberQuery,
  Page,
  PlatoonSummary,
} from '@/api/types';

/* 인증 */
export const login = (body: LoginRequest) =>
  api.post<LoginResponse>('/auth/login', body).then(r => r.data);
export const fetchMe = () => api.get<AdminUser>('/auth/me').then(r => r.data);

/* 중대 · 소대 */
export const fetchCompany = () => api.get<Company>('/company').then(r => r.data);
export const fetchPlatoons = (range = 30) =>
  api.get<PlatoonSummary[]>('/platoons', { params: { range } }).then(r => r.data);

/* 대시보드 — platoonId 가 없으면 중대 전체 */
export const fetchDashboard = (query: DashboardQuery) =>
  api.get<Dashboard>('/dashboard', { params: query }).then(r => r.data);

/* 인원 */
export const fetchMembers = (query: MemberQuery) =>
  api.get<Page<Member>>('/members', { params: query }).then(r => r.data);
export const fetchMember = (id: string) =>
  api.get<MemberDetail>(`/members/${id}`).then(r => r.data);

/* 사용자 본인 대시보드 (관리자 로그인 없이 군번으로 조회) */
export const fetchMyDashboard = (id: string) =>
  api.get<MemberDetail>(`/me/${id}`).then(r => r.data);
