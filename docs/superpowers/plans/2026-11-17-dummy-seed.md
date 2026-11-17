# 발표용 더미 데이터 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실제 서버 상태에 지울 수 있는 더미 200명과 세션 약 1,000개를 넣는 스크립트.

**Architecture:** `domain/dummy.ts`가 시드 고정 난수로 유니티 세션 모양의 데이터를 만들고, `Repo.seedDummy`/`clearDummy`가 상태를 한 번에 바꿔 저장한다. 스크립트는 `bootstrap`으로 같은 저장소(S3/fs)를 연다.

**Tech Stack:** 기존 backend (Node 22, TypeScript, vitest)

**Spec:** `docs/superpowers/specs/2026-11-17-dummy-seed-design.md`

## Global Constraints

- 더미 세션도 `summarize` 를 거친다. 화면 응답(`Member`, `Session`)에 `dummy` 필드를 넣지 않는다.
- 더미 원본은 저장소 `raw/` 에 쓰지 않는다.
- 같은 시드면 같은 데이터 (테스트 재현성).

## Review Focus

1. 실제 명단 군번과 더미 군번 충돌 → 더미가 다른 군번을 쓴다 (Task 1 테스트)
2. 더미를 다시 넣을 때 중복 → 이전 더미가 지워지고 실제 데이터는 남는다 (Task 2 테스트)
3. 실제 세션이 더미 사람에게 옮겨져 있던 상태에서 지우기 → 미배정으로 돌아간다 (Task 2 테스트)
4. 더미 세션이 있는 상태에서 `recompute` → 원본이 없어도 실패하지 않는다 (Task 2 테스트)
5. 분포가 발표용으로 그럴듯함 → 영점 완료 40~80%, 세션 합격률 30~75%, 교정 포인트 3종 모두 0 아님 (Task 1 테스트)

---

### Task 1: 더미 생성기

**Files:** Create `backend/src/domain/dummy.ts` · Test `backend/test/dummy.test.ts`

**Interfaces — Produces:**
- `DummyOptions { count; platoons; minSessions; maxSessions; days; seed; existingIds: Set<string> }`, `DEFAULT_DUMMY` (200, 10, 2, 8, 30, 20261117)
- `DummySession { raw: UnitySession; memberId: string; receivedAt: string }`
- `generateDummy(now: Date, opts?: Partial<DummyOptions>): { members: RosterMember[]; sessions: DummySession[] }`

- [ ] 테스트: 같은 시드 → 같은 결과 · 200명 · 소대당 20명 · 군번 유일하고 `existingIds`와 안 겹침 · 1인당 세션 2~8 · `receivedAt`이 `now - 30일` 이후이고 `now` 이전 · 모든 세션 `isCounted` · 분포(Review Focus 5)
- [ ] 구현 → `pnpm test`

### Task 2: 넣기·지우기와 스크립트

**Files:** Modify `backend/src/domain/model.ts`, `backend/src/repo.ts`, `backend/package.json` · Create `backend/src/scripts/seed.ts` · Test `backend/test/repo.test.ts`

**Interfaces — Produces:**
- `RosterMember.dummy?: boolean`, `StoredSession.dummy?: boolean`
- `Repo.seedDummy(data: { members: RosterMember[]; sessions: DummySession[] }): Promise<{ members: number; sessions: number }>` — 기존 더미 제거 후 추가 (한 번 저장)
- `Repo.clearDummy(): Promise<{ members: number; sessions: number }>`
- scripts: `seed` (`--clear` 이면 지우기만)

- [ ] 테스트: 다시 넣어도 더미 수 그대로 · 실제 명단·세션 유지 · 지우기 후 실제 세션이 더미에게 붙어 있었으면 미배정 · 더미 배치 해제 · `recompute`가 더미를 건너뜀 · 원본 저장 안 함
- [ ] 구현 → `pnpm test`, `pnpm typecheck`

### Task 3: 확인과 안내

- [ ] 로컬 fs 저장소에 넣고 서버+화면으로 중대·소대·개인 대시보드 확인
- [ ] README 5-6 에 발표 전 더미 넣기·지우기 안내
