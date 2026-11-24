# 세션별 표적 사진 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 세션마다 유니티 결과 창과 같은 탄흔 표적 사진을 만들어 S3에 암호화 저장하고, 대시보드 표적지 카드·리포트 목록에서 보여 준다.

**Architecture:** `backend/src/photo/` 가 재료(표적 이미지·탄흔 시트)와 탄 좌표로 sharp 합성 → JPEG. `Photos` 서비스가 저장소에 쓰고 상태에 `photoKey` 를 남기며, 백그라운드 큐로 수신 후·열람 시 만든다. API 는 세션에 `photoUrl`(S3 presigned 또는 로컬 서명 주소)을 붙인다.

**Tech Stack:** sharp 0.35, @aws-sdk/s3-request-presigner, 기존 backend/frontend

**Spec:** `docs/superpowers/specs/2026-11-24-target-photo-design.md`

## Global Constraints

- 재료 이미지는 저장소 `assets/stage01-target.png`, `assets/bullet-hole-sheet.png` 에서만 읽는다. 깃에 넣지 않는다. 테스트는 sharp 로 만든 합성 재료를 쓴다.
- 표적 상수 (352×498 원본 기준): 링 중심 (174.8, 236.8)px, 1659 px/m, 탄흔 지름 = 이미지 폭 × 24/569, 시트 6칸 (칸 k = 아래에서 k번째).
- 출력 2배 (704×996) JPEG. S3 업로드는 `ServerSideEncryption: AES256`.
- 유니티 수신 응답(2초) 전에 사진을 만들지 않는다.
- `photoUrl` 은 1시간 유효. 화면 응답에 `photoKey` 는 내보내지 않는다.

## Review Focus

1. 재료가 저장소에 없을 때 → 사진 기능만 꺼지고 수신·대시보드는 정상 (Task 3 테스트)
2. 명중 0발 세션 → 탄흔 없는 표적 사진 (Task 1 테스트)
3. 이미지 밖으로 나가는 좌표 → 가장자리에 붙여 그리고 합성이 실패하지 않음 (Task 1 테스트)
4. 같은 세션을 여러 번 열람 → 사진을 한 번만 만든다 (Task 3 테스트)
5. 서명이 틀리거나 만료된 로컬 사진 주소 → 403 (Task 4 테스트)

---

### Task 1: 합성 (`backend/src/photo/render.ts`, test `photo-render.test.ts`)

**Produces:** `PhotoShot { hit: boolean; xM: number; yM: number; faceX?: number; faceY?: number; index: number }`, `TARGET_STAGE01`, `holeCenter(shot, scale): {x,y} | null`, `holeFrame(sessionId, index): number (0..5)`, `renderTargetPhoto(sessionId, shots, assets: {target: Buffer; sheet: Buffer}, scale = 2): Promise<Buffer>` (JPEG)

- [ ] 테스트: 채점 중심(0,0) 명중 → (174.8×2, 236.8×2) 픽셀이 어두움 · `faceX 0.1, faceY -0.1` → ((0.6)×704, (0.6)×996) 어두움 · 빗나간 탄은 안 그림 · 0발이면 배경 그대로 · 이미지 밖 좌표도 오류 없음 · 같은 입력 → 같은 바이트 · 출력 704×996 JPEG
- [ ] 구현

### Task 2: 저장소 확장 (`storage/*.ts`, test `storage.test.ts`)

**Produces (Storage):** `putObject(key, body: Buffer, contentType): Promise<void>`, `getObject(key): Promise<Buffer | null>`, `deletePrefix(prefix): Promise<number>`, `presign(key, ttlSec): Promise<string | null>` (fs 는 null)

- [ ] 테스트(fs): 쓰기/읽기/없으면 null/접두어 삭제 개수/경로 이탈 거부
- [ ] 구현 (S3: `PutObject` + `ServerSideEncryption`, `ListObjectsV2`+`DeleteObjects`, `getSignedUrl`)

### Task 3: 사진 서비스 (`backend/src/photos.ts`, `repo.ts`, test `photos.test.ts`)

**Produces:** `StoredSession.photoKey?: string`, `Repo.setPhotoKeys(map: Record<string,string>)`, `class Photos { static create(storage, repo, config); enabled: boolean; enqueue(sessionId): void; idle(): Promise<void>; renderSession(id): Promise<string|null>; renderDummy(items): Promise<Record<string,string>>; urlFor(session: StoredSession, now): Promise<string|undefined> }`
- 실제 세션 재료: 원본(`getRaw(rawKey)`)의 탄 (`HasFace` 있으면 face). 원본 없는 세션(더미)은 상태의 `rounds[0].shots`(cm)로.
- 대상: `counted` 이고 `stageName`/프로필이 실내 표적인 세션만.
- [ ] 테스트: 재료 없으면 `enabled=false` 이고 enqueue 가 아무것도 안 함 · enqueue 두 번 → 한 번만 렌더 · 렌더 후 `photoKey` = `photos/<id>.jpg`, 더미는 `photos/dummy/<id>.jpg` · `urlFor` fs → `/api/photos/<id>?exp=&sig=`

### Task 4: API (`app.ts`, `server.ts`, test `app.test.ts`)

- [ ] `/api/members/:id`, `/api/me/:id` 세션에 `photoUrl` (없으면 생략, 그리고 enqueue)
- [ ] `POST /api/session` 응답 뒤 enqueue
- [ ] `GET /api/photos/:id?exp&sig` (fs 전용, 서명 검증, `image/jpeg`)
- [ ] 테스트: 수신 → `idle()` → 상세에 `photoUrl` · 잘못된/만료 서명 403 · 응답에 `photoKey` 없음

### Task 5: 더미 (`scripts/seed.ts`)

- [ ] seed: 상태에 넣은 뒤 `renderDummy` (동시 8, 진행 로그) → `setPhotoKeys` · clear: `deletePrefix('photos/dummy/')` 실패해도 계속

### Task 6: 화면 (`types.ts`, `UserDashboard.tsx`, 새 `PhotoModal`)

- [ ] `Session.photoUrl?: string`
- [ ] 표적지 카드: 세션 고르기(기본 최근) + `Segmented` [분석 그림 | 표적 사진] — 어떤 세션에도 `photoUrl` 없으면 전환 숨김
- [ ] 리포트 목록: `photoUrl` 있는 세션에 [표적 사진] → `PhotoModal`
- [ ] `pnpm build`, `pnpm lint`

### Task 7: 확인·안내

- [ ] 로컬: 유니티 재료를 로컬 데이터 폴더 `assets/` 에 복사(저장소 밖) → 더미 넣기 → 서버+화면에서 사진 확인
- [ ] README: 재료 올리기(S3 콘솔 `assets/`), 유니티 `FaceX/FaceY` 방법, 사진 동작 요약
