# 유니티 사격 세션 → 대시보드 연결 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 유니티가 보내는 사격 세션을 EC2:80의 Node 서버가 받아 S3에 저장하고, 기존 대시보드 API 계약과 사격 배치·명단 API로 화면에 실제 데이터를 제공한다.

**Architecture:** `backend/`는 Hono 기반 Node + TypeScript 서버다. 상태 전체(명단·배치·세션 요약)를 메모리에 두고 S3 `db/state.json`에 통째로 저장하며, 원본은 `raw/YYYY/MM/DD/<Id>.json`에 둔다. 화면 타입과 상수는 `frontend/src/api/types.ts`, `frontend/src/constants/shooting.ts`를 상대 경로로 가져와 계약을 공유하고, 집계는 `frontend/src/mocks/data/aggregate.ts`와 같은 의미로 다시 구현해 시드 데이터로 일치를 검증한다.

**Tech Stack:** Node 22, TypeScript 5.9, Hono + @hono/node-server, @aws-sdk/client-s3, tsx, vitest, React 19 + Vite 8 (기존), Terraform (HCL)

**Spec:** `docs/superpowers/specs/2026-11-11-unity-session-dashboard-design.md`

## Global Constraints

- AWS: S3와 EC2만. 리전 `us-east-1`, 버킷 `anchor-edu-01-s3`. IAM 리소스를 만들지 않는다. 자격 증명은 EC2 역할에서 자동으로 얻는다.
- 비밀값(관리자 비밀번호, `AUTH_SECRET`, `INGEST_KEY`)과 `.env`, `*.tfstate*`, `*.tfvars`는 깃에 넣지 않는다.
- 합격 기준은 화면 상수 그대로: `PASS_DIAMETER_CM = 5`, `PASS_OFFSET_CM = 2.5`, 명중 3발 미만은 불합격.
- 단위: 유니티 m → 화면 cm(×100). 거리 환산 없음.
- 집계 대상: `Target.ProfileName ∈ COUNTED_TARGET_PROFILES(기본 IndoorTargetScore)` 그리고 `EndReason === 'MagazineEmpty'` 그리고 사람이 배치된 세션.
- 날짜 계산과 라벨은 `TZ=Asia/Seoul`.
- 화면 코드는 `frontend/CLAUDE.md` 규칙 (`@/api/command`로만 호출, `div` 마크업, 테마 토큰). 가짜 데이터 모드(`VITE_USE_MOCK=true`)는 계속 동작해야 한다.
- 유니티 수신 응답은 2초 안에 (`ShootingResultSender` 제한 시간).

## Review Focus

1. 마지막 탄의 `Trace` 배열이 비었거나 모든 탄에 궤적이 없는 세션 → 지표는 계산 가능한 탄만 평균, 하나도 없으면 50. 예외로 죽지 않는다. (Task 2 `computeMetrics` 테스트)
2. 명단·배치가 하나도 없는 첫 실행에서 세션 수신과 모든 조회 → 미배정 세션으로 저장, 대시보드는 0과 빈 배열(NaN·Infinity 없음). (Task 5 `empty state` 테스트, Task 6 `first run` 테스트)
3. 엑셀에서 복사한 명단(탭 구분, 머리글 줄, 빈 줄, `3소대` 표기, 같은 군번 중복) → 정상 줄은 반영, 잘못된 줄은 줄 번호와 이유로 돌려준다. (Task 3 테스트)
4. 같은 세션 Id 재전송 → 세션이 두 개가 되지 않고 사람 배정이 유지된다. (Task 4 테스트)
5. 세션이 없는 사람의 개인 대시보드 → API는 `sessions: []`, 화면은 빈 상태 문구로 깨지지 않는다. (Task 5 테스트, Task 9 확인)

---

### Task 1: 서버 뼈대 · 설정 · 모델 · 저장소

**Files:**
- Create: `backend/package.json`, `backend/tsconfig.json`, `backend/vitest.config.ts`, `backend/.gitignore`, `backend/.env.example`
- Create: `backend/src/config.ts`, `backend/src/domain/unity.ts`, `backend/src/domain/model.ts`
- Create: `backend/src/storage/storage.ts`, `backend/src/storage/fs.ts`, `backend/src/storage/s3.ts`
- Test: `backend/test/storage.test.ts`

**Interfaces:**
- Produces:
  - `loadConfig(env?: NodeJS.ProcessEnv): Config` — `Config = { port, storage: 'fs'|'s3', dataDir, bucket, region, adminUsername, adminPassword, authSecret, corsOrigins: string[], ingestKey?: string, clickCmAt100mH: number, clickCmAt100mV: number, countedProfiles: string[] }`. 기본값: port 80, storage `fs`, dataDir `./data`, bucket `anchor-edu-01-s3`, region `us-east-1`, click 3/3, countedProfiles `['IndoorTargetScore']`. `TZ`가 없으면 `Asia/Seoul`로 설정.
  - `unity.ts`: `UnityShot`, `UnityTrace`, `UnitySession` (유니티 `ShootingRecordData.cs` 필드 그대로, PascalCase, `SimulatorId?: string`)
  - `model.ts`: `RosterMember { id; name; platoonNo: number }`, `SimulatorAssignment { memberId: string|null; assignedAt: string|null }`, `StoredSession` (§7.2 필드 + `memberId: string|null; simulatorId; receivedAt; rawKey; counted; correction; stageName; distanceMeters; shotsFired; hitCount`, `index`·`date`·`report`·`key` 제외), `CompanyInfo { id; name; course; simulatorCount }`, `State { version: 1; company; members: RosterMember[]; simulators: Record<string, SimulatorAssignment>; sessions: StoredSession[] }`, `emptyState(): State` (company `c1`, `1중대`, `2026년 2기 영점사격 과정`, 1)
  - `Storage { readState(): Promise<State|null>; writeState(s: State): Promise<void>; putRaw(key: string, body: unknown): Promise<void>; getRaw(key: string): Promise<unknown>; listRaw(): Promise<string[]> }`, `createFsStorage(dir: string): Storage`, `createS3Storage(bucket: string, region: string): Storage` (키 `db/state.json`, `raw/...`)

- [ ] **Step 1:** 패키지 구성. scripts `dev`(`tsx watch src/server.ts`), `start`(`tsx src/server.ts`), `test`(`vitest run`), `typecheck`(`tsc --noEmit`), `recompute`(`tsx src/scripts/recompute.ts`). vitest alias `@` → `../frontend/src` (시드·집계 비교 테스트용).
- [ ] **Step 2: 실패하는 테스트** `storage.test.ts`
  - `fs storage returns null before first write`: `readState()` → `null`
  - `fs storage round-trips state and raw`: `writeState(emptyState())` 후 `readState()`가 같은 값, `putRaw('raw/2026/11/11/a.json', {Id:'a'})` 후 `getRaw` 같은 값, `listRaw()` → `['raw/2026/11/11/a.json']`
- [ ] **Step 3:** 구현 후 `pnpm test` 통과, `pnpm typecheck` 통과.

### Task 2: 유니티 세션 변환 · 지표 · 클릭 · 집계 대상 판별

**Files:**
- Create: `backend/src/domain/metrics.ts`, `backend/src/domain/convert.ts`
- Test: `backend/test/metrics.test.ts`, `backend/test/convert.test.ts` (fixtures `unity-session-hit10.json`, `unity-session-hit0.json`)

**Interfaces:**
- Produces:
  - `METRIC_THRESHOLDS`: 조준 안정성 0.3→3.0, 호흡 통제 0.2→2.0, 격발 제어 0.2→2.0, 사격 자세 1→10, 탄착 일관성 0.5→5.0
  - `scoreOf(value: number, good: number, bad: number): number` = `clamp(round(99 − 84 × (value − good)/(bad − good)), 15, 99)`
  - `computeMetrics(raw: UnitySession): number[]` (METRICS 순서 5개). 탄별 궤적 값: 격발 인덱스 `(0 − StartMs)/StepMs`, 이전 구간 `[0, fire]`, 200ms 전 인덱스 `fire − 200/StepMs`. 궤적이 없거나 짧은 탄은 제외, 하나도 없으면 그 지표 50. 명중 3발 미만이면 탄착 일관성 15.
  - `correctionOf(metrics: number[]): number` — 지표 [0,1,3] 중 최솟값의 인덱스를 {0→0, 1→1, 3→2}로
  - `isCounted(raw: UnitySession, profiles: string[]): boolean`
  - `summarize(raw: UnitySession, opts: { clickCmAt100mH: number; clickCmAt100mV: number; countedProfiles: string[] }): SessionSummary` — `SessionSummary = Omit<StoredSession, 'memberId'|'simulatorId'|'receivedAt'|'rawKey'> & { id: string }`

- [ ] **Step 1: 실패하는 테스트**
  - `metrics: zero traces score 99 except posture/consistency rules` (hit10 고정 데이터): 조준 안정성·호흡 통제·격발 제어 = 99
  - `metrics: wobbling trace lowers aim score` (합성: 모든 탄 RightMrad가 ±1.5 교대) → 조준 안정성 < 70
  - `metrics: empty traces give 50` (합성: 모든 Trace 배열 빈 배열) → 앞 세 지표 50
  - `metrics: fewer than 3 hits gives consistency 15` (hit0) → `[4] === 15`
  - `summarize hit10`: `diameter === 7.6`, `offset === 2.8`, `pass === false`, `rounds.length === 1`, `rounds[0].shots.length === 10`, `rounds[0].shots[0]` = `{x: 1.23, y: -1.91}`, `clicksH === 0`, `clicksV === 9` (−(−2.83)/0.3 → 9.43 → 9), `durationMin === 0.3`, `counted === true`, `distanceMeters === 10`, `hitCount === 10`
  - `summarize hit0`: `diameter === 0`, `offset === 0`, `pass === false`, `rounds[0].shots.length === 0`, `clicksH === 0`, `clicksV === 0`
  - `isCounted rejects outdoor and stopped`: ProfileName `OutdoorTargetScore` → false, EndReason `Stopped` → false
  - `correctionOf picks weakest of aim/breath/posture`: `[50,40,10,60,90]` → 1 (격발 제어는 후보가 아님)
- [ ] **Step 2:** 실패 확인 → 구현 → `pnpm test` 통과.

### Task 3: 명단 파싱

**Files:**
- Create: `backend/src/domain/roster.ts`
- Test: `backend/test/roster.test.ts`

**Interfaces:**
- Produces: `parseRoster(text: string): { rows: RosterMember[]; errors: { line: number; reason: string }[] }` — 구분자 쉼표 또는 탭, 앞뒤 공백 제거, 빈 줄 무시, 소대 칸이 숫자가 아닌 첫 줄은 머리글로 보고 건너뜀, 소대 `3`·`3소대`·`3 소대` → 3, 같은 군번은 마지막 줄이 이김. 줄 번호는 1부터.

- [ ] **Step 1: 실패하는 테스트**
  - `parses comma and tab lines with 소대 suffix`: `"26-1,홍길동,3\n26-2\t김철수\t4소대"` → rows 2개, platoonNo 3·4
  - `skips header and blank lines`: `"군번,이름,소대\n\n26-1,홍길동,1"` → rows 1개, errors 0
  - `reports bad lines`: `"26-1,홍길동"` → errors `[{line:1, reason:'칸이 3개가 아닙니다'}]`, `"26-1,홍길동,일"`(머리글 아님: 둘째 줄) → `'소대는 숫자여야 합니다'`
  - `last duplicate wins`: 같은 군번 두 줄 → rows 1개, 이름은 뒤 줄
- [ ] **Step 2:** 구현 → 통과.

### Task 4: Repo (상태 변경과 저장)

**Files:**
- Create: `backend/src/repo.ts`
- Test: `backend/test/repo.test.ts` (임시 폴더 fs 저장소)

**Interfaces:**
- Consumes: Task 1 `Storage`, `State`, `emptyState`, `Config`; Task 2 `summarize`; Task 3 `parseRoster`
- Produces: `class Repo`
  - `static open(storage: Storage, config: Config): Promise<Repo>` — `readState()`가 null이면 `emptyState()`
  - `get state(): Readonly<State>`
  - `ingest(raw: UnitySession, now: Date): Promise<StoredSession>` — `Id` 없으면 `Error('Id가 없습니다')`; 시뮬레이터 `raw.SimulatorId ?? '1'`; 기존 Id면 `memberId` 유지하고 덮어씀; 새 세션은 그 시뮬레이터 배치의 `memberId`(없으면 null); 원본 키 `raw/YYYY/MM/DD/<Id>.json`(한국 날짜) 에 `{...raw, receivedAt, simulatorId}` 저장 후 상태 저장
  - `upsertRoster(text: string): Promise<{ added: number; updated: number; errors: {line:number; reason:string}[] }>`
  - `assignSimulator(simulatorId: string, memberId: string|null, now: Date): Promise<void>` — 범위 밖 번호·없는 군번이면 `Error`
  - `assignSession(sessionId: string, memberId: string): Promise<void>` — 없는 세션·군번이면 `Error`
  - 모든 쓰기는 내부 promise 체인으로 직렬화한다.

- [ ] **Step 1: 실패하는 테스트**
  - `ingest without assignment stores unassigned session` → `memberId === null`, `listRaw()` 1개, 다시 `Repo.open`하면 세션 1개
  - `ingest uses current simulator assignment` → 명단 등록, `assignSimulator('1','26-1')` 후 ingest → `memberId === '26-1'`
  - `re-ingest same Id keeps member and does not duplicate` → 세션 1개, memberId 유지
  - `assignSession moves session to another member`
  - `assignSimulator rejects unknown member and out-of-range simulator`
  - `upsertRoster counts added and updated`
- [ ] **Step 2:** 구현 → 통과.

### Task 5: 집계 (화면 계약 응답 만들기)

**Files:**
- Create: `backend/src/domain/aggregate.ts`
- Test: `backend/test/aggregate.test.ts`

**Interfaces:**
- Consumes: Task 1 `State`, `StoredSession`, `CompanyInfo`; `frontend/src/api/types.ts`; `frontend/src/constants/shooting.ts`
- Produces:
  - `AggSession { id; memberId; platoonId; index; date: Date; diameter; offset; pass; metrics: number[]; correction: number; hitCount?: number; api: Session }`, `AggMember { id; name; platoonId; platoonName; sessions: AggSession[] }`, `View { company: CompanyInfo; platoons: {id; name}[]; members: AggMember[]; sessions: AggSession[]; now: Date }`
  - `buildView(state: State, now: Date): View` — 사람 붙은 `counted` 세션만, 사람별 받은 순 `index`, 소대는 명단의 `platoonNo` 오름차순 `p{n}`/`{n}소대`
  - `toMember(m: AggMember): Member`, `platoonSummaries(v: View, range: number): PlatoonSummary[]`, `buildDashboard(v: View, range: number, platoonId?: string): Dashboard | null`, `buildMemberDetail(v: View, id: string): MemberDetail | null`, `listMembers(v: View, q: MemberQuery): Page<Member>`
  - 명중 3발 미만 세션 규칙은 스펙 §7.7 (`hitCount`가 없으면 유효한 세션으로 본다)
- [ ] **Step 1: 실패하는 테스트**
  - `matches mock aggregate on seed data`: 시드 `members`/`sessions`를 `View`로 바꿔 `buildDashboard(v,30)`, `buildDashboard(v,7,'p3')`, `platoonSummaries(v,14)`가 `@/mocks/data/aggregate`의 결과와 `toEqual`; `toMember`도 시드 멤버 전원 일치
  - `empty state gives zeros`: `buildDashboard(buildView(emptyState(), now), 30)` → `kpis.sessions === 0`, `passRate === 0`, `avgDiameter === 0`, `daily.length === 30`, NaN 없음(`JSON.stringify`에 `null`이 `prev*` 외에 없음)
  - `member without sessions`: `buildMemberDetail` → `sessions: []`, `status '재훈련 필요'`, `best 0`, `last 0`, `lastDate ''`, `weapon '사격 기록 없음'`
  - `fewer-than-3-hit session excluded from avgDiameter and best but counts as failed`
  - `listMembers sorts by score desc by default and filters q/status/platoon` (handlers.ts와 같은 규칙, size 기본 12)
- [ ] **Step 2:** 구현 → 통과.

### Task 6: HTTP API · 인증 · 서버 진입점 · 재계산 스크립트

**Files:**
- Create: `backend/src/auth.ts`, `backend/src/app.ts`, `backend/src/server.ts`, `backend/src/scripts/recompute.ts`
- Test: `backend/test/auth.test.ts`, `backend/test/app.test.ts`

**Interfaces:**
- Consumes: Task 4 `Repo`, Task 5 집계 함수
- Produces:
  - `signToken(secret: string, now: Date, ttlMs?: number /* 12h */): string`, `verifyToken(token: string, secret: string, now: Date): boolean` (HMAC-SHA256, `payload.signature` base64url)
  - `createApp(repo: Repo, config: Config, clock?: () => Date): Hono` — 경로·응답은 스펙 §9 표 그대로. 오류는 `{ message }`와 400/401/404. CORS는 `config.corsOrigins`가 있을 때만.
  - `server.ts`: `process.loadEnvFile('.env')`(없으면 무시) → `loadConfig` → 저장소 → `Repo.open` → `serve({ fetch, port })`
  - `recompute.ts`: `listRaw()` 각 원본으로 `summarize` 다시 계산해 기존 `memberId`·`receivedAt` 유지하며 `state.json` 갱신
- [ ] **Step 1: 실패하는 테스트**
  - `auth: token verifies until expiry and rejects tampering`
  - `app: first run accepts unity session and lists it as unassigned` → `POST /api/session` 202, 로그인 후 `GET /api/sessions/recent` 길이 1, `memberId null`
  - `app: login rejects wrong password with 401`, `admin routes require token` (`GET /api/company` 401)
  - `app: roster → assign simulator → ingest → member detail shows session` → `/api/members/26-1`의 `sessions[0].rounds[0].shots.length === 10`, `/api/me/26-1` 인증 없이 200
  - `app: ingest key enforced when configured` → 헤더 없으면 401
  - `app: dashboard contract shape` → `/api/dashboard?range=30` 키가 `Dashboard` 타입 키와 같음
- [ ] **Step 2:** 구현 → `pnpm test`, `pnpm typecheck` 통과.
- [ ] **Step 3:** 로컬 실행 확인: `STORAGE=fs PORT=8787 pnpm start` 후 `curl -X POST localhost:8787/api/session --data @test/fixtures/unity-session-hit10.json` → `{"ok":true}`.

### Task 7: 화면 — 서버 연결 · 새 API 타입 · 목 핸들러

**Files:**
- Modify: `frontend/vite.config.ts`, `frontend/.env.example`, `frontend/src/api/types.ts`, `frontend/src/api/command.ts`, `frontend/src/mocks/handlers.ts`

**Interfaces:**
- Produces (types.ts): `Session`에 선택 필드 `distanceMeters?`, `shotsFired?`, `hitCount?`, `stageName?`, `simulatorId?`; `SimulatorSlot { id: string; member: { id: string; name: string; platoonName: string } | null; assignedAt: string | null }`; `RecentSession { id; date; simulatorId; memberId: string|null; memberName: string|null; shotsFired; hitCount; diameter; counted: boolean; stageName }`; `RosterResult { added; updated; errors: { line; reason }[] }`
- Produces (command.ts): `uploadRoster(text: string): Promise<RosterResult>`, `fetchSimulators(): Promise<SimulatorSlot[]>`, `assignSimulator(id: string, memberId: string | null): Promise<void>`, `fetchRecentSessions(limit?: number): Promise<RecentSession[]>`, `assignSession(sessionId: string, memberId: string): Promise<void>`
- [ ] **Step 1:** `vite.config.ts`에 `server.proxy['/api'] = loadEnv(...).VITE_PROXY_TARGET || 'http://localhost:80'`. `.env.example`에 `VITE_PROXY_TARGET` 설명 추가, 실제 서버 사용 시 `VITE_SERVER_URL`을 비우라는 주석.
- [ ] **Step 2:** 목 핸들러: 시뮬레이터 `COMPANY.simulatorCount`개, 최근 세션은 시드에서 최신 10개, 명단 업로드는 줄 수만큼 `added` (메모리).
- [ ] **Step 3:** `pnpm build` 통과.

### Task 8: 화면 — 사격 배치 페이지 · 명단 붙여넣기

**Files:**
- Create: `frontend/src/pages/assignments/index.tsx`, `frontend/src/components/members/RosterImport.tsx`, `frontend/src/components/members/MemberPicker.tsx`
- Modify: `frontend/src/routes/routes.tsx`, `frontend/src/components/header/Sidebar.tsx`, `frontend/src/components/header/icons.tsx`, `frontend/src/pages/users/index.tsx`

**Interfaces:**
- Consumes: Task 7 command 함수
- Produces: 라우트 `/assignments`(PrivateRoute 안), 사이드바 "사격 배치" 메뉴; `RosterImport({ onDone }: { onDone: () => void })`; `MemberPicker({ value, onPick }: { value: string | null; onPick: (memberId: string) => void })` (`fetchMembers({ q, size: 8 })` 검색)
- [ ] **Step 1:** 사격 배치 페이지: 카드 1 "시뮬레이터" — 줄마다 번호, 현재 사수(소대·군번·이름), [변경](MemberPicker), [해제]. 카드 2 "최근 세션" — 시각, 시뮬레이터, 사수(미배정은 배지), 명중/발수, 탄착군, "집계 제외" 배지, [다른 사람으로 옮기기](MemberPicker). 변경 후 다시 불러오고 토스트.
- [ ] **Step 2:** 사용자 목록 페이지 헤더 오른쪽에 [명단 붙여넣기] → `RosterImport`(textarea + 형식 안내 "군번, 이름, 소대 — 한 줄에 한 명") → 결과 토스트, 오류 줄 목록 표시 → `MemberTable` 다시 불러오기(`key` 변경).
- [ ] **Step 3:** `pnpm build`, `pnpm lint` 통과. 목 모드에서 `/assignments` 화면이 뜨는지 확인.

### Task 9: 화면 — 개인 대시보드 · 인원 표 보완

**Files:**
- Modify: `frontend/src/components/user/UserDashboard.tsx`, `frontend/src/components/members/MemberTable.tsx`

- [ ] **Step 1:** `UserDashboard`: 세션 0개면 헤더 + "아직 사격 기록이 없습니다" 카드만. `hitCount < 3`이면 최근 탄착군 큰 숫자·직전 대비·회차 탄착군·중심 편차를 `-`, `CoachCard` 첫 문장 "명중 {n}발로 탄착군을 잴 수 없습니다". 회차 1개면 "1회차 대비…" 줄 대신 `평균 탄착점: 중심에서 {좌/우} {x}cm, {위/아래} {y}cm → 좌우 {R/L} {n}클릭 · 상하 {U/D} {n}클릭 조정`. 문구: `CoachCard` hint "지표와 탄착을 바탕으로 한 규칙 기반 분석", 하단 "생성: 규칙 기반", `TargetCard` hint는 `distanceMeters`가 있으면 `{거리}m · 1칸 = 1cm · {발수}발`.
- [ ] **Step 2:** `MemberTable`: `lastDate`가 빈 문자열이면 `-`, `best`/`last`가 0이고 `sessionCount`가 0이면 `-`.
- [ ] **Step 3:** `pnpm build`, `pnpm lint` 통과. 목 모드 화면이 이전과 같은지 확인 (가짜 데이터에는 새 필드가 없으므로 변화 없음).

### Task 10: Terraform 버킷 · 실행 안내 · 유니티 변경 안내

**Files:**
- Create: `infra/main.tf`, `infra/outputs.tf`, `infra/.gitignore`
- Modify: `README.md` (5절 배포 계획에 "실제 서버 실행" 하위 절 추가), `.gitignore`(루트 없으면 만들지 않고 각 폴더 `.gitignore` 사용)

- [ ] **Step 1:** `main.tf`: provider aws `us-east-1`, `aws_s3_bucket` `anchor-edu-01-s3`, `aws_s3_bucket_public_access_block`(4개 모두 true), `aws_s3_bucket_versioning` Enabled, `aws_s3_bucket_server_side_encryption_configuration` AES256. 기존 버킷이 있으면 `terraform import aws_s3_bucket.data anchor-edu-01-s3` 안내 주석.
- [ ] **Step 2:** README: EC2 순서 — 권한 확인 명령(`aws s3api head-bucket`, `aws s3 cp` 테스트), Terraform 설치·`init/plan/apply`, `backend/.env` 작성, `sudo $(which node) --import tsx src/server.ts`, `frontend/.env`(`VITE_USE_MOCK=false`, `VITE_SERVER_URL=`) 후 `pnpm dev --host 0.0.0.0 --port 8000`, 유니티 변경(§11).
- [ ] **Step 3:** 로컬에 terraform이 없으면 `terraform fmt` 검증은 EC2에서 하도록 안내만 남긴다.

### Task 11: 전체 검증

- [ ] `backend`: `pnpm test`, `pnpm typecheck`
- [ ] `frontend`: `pnpm build`, `pnpm lint`
- [ ] 로컬 끝에서 끝: fs 저장소로 서버(8787) + Vite(프록시 `VITE_PROXY_TARGET=http://localhost:8787`) → 브라우저로 로그인 → 명단 붙여넣기 → 시뮬레이터 1 배치 → 고정 데이터 POST → 개인 대시보드 표적지에 10발
- [ ] 전체 브랜치 리뷰 (fresh reviewer)
