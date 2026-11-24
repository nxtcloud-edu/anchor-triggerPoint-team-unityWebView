# 세션별 표적 사진 설계

- 작성일: 2026-11-24 · 상태: 승인됨 (사용자: "이대로 진행")
- 관련: `2026-11-11-unity-session-dashboard-design.md`, `2026-11-17-dummy-seed-design.md`

## 목적

유니티 결과 창에서 본 것과 같은 **탄흔이 찍힌 표적 사진**을 세션마다 S3에 암호화 저장하고, 관리자·본인 대시보드에서 세션별로 보여 준다. 발표용 더미 200명의 세션에도 사진이 있어야 한다.

## 접근 방식

| 방식 | 판단 |
|---|---|
| 유니티에서 결과 화면 캡처 → 업로드 | 더미·과거 세션에 사진이 없고, Quest 프레임 끊김·업로드 부담 · **탈락** |
| 대시보드가 좌표로 그림만 그림 (저장 없음) | S3 사진 저장 요구를 못 채움 · **탈락** |
| **서버가 결과 창과 같은 재료·계산으로 이미지를 만들어 S3에 저장 (선택)** | 모든 세션(실제·더미·과거)에 사진, 유니티는 좌표 몇 줄만 추가 |

## 유니티 결과 창이 그리는 방식 (확인한 사실)

- `ResultUIPresenter` → `UIBulletHoleMirror.Draw(FacePosition)`. 배경은 `Stage01Definition.Result.Sprite` = `Assets/Art/UI/Tablet_ShootingTarget.png` (352×498, A4 종이 표적, 링 1~10).
- 배경 `StageImage` 와 탄흔 부모 `ResultBullet_UI` 는 둘 다 569×805 UI 단위, 중심 정렬. 탄흔 위치 = `FacePosition × (569, 805)` → **표적 이미지 = 표적 상자 앞면**. 픽셀로는 `x = (0.5 + fx) × W`, `y = (0.5 − fy) × H`.
- `FacePosition` = `TargetFrame.TryNormalizeOnFace` : 상자 중심 기준 시점 좌표 ÷ 상자 시점 가로·세로.
- 탄흔: `Prefabs/Item/BulletHole.prefab` (기본 Plane 10단위 × 0.0006) × `BulletScale 4000` = 24 UI 단위 → **이미지 폭의 24/569 ≈ 4.2%**. 텍스처 `Assets/Art/Bullet_hole/BulletHoleSheet.png` (171×1024, 세로 6칸, VR은 칸을 무작위 선택).
- 세션의 `X`, `Y`(m)는 채점 중심(`IndoorTargetScore.CenterOffset`) 기준. 채점 링 반지름 0.01~0.097m.

## 결정

**사진 만들기 (backend)**
- 재료 두 장(표적 이미지, 탄흔 시트)은 **공개 저장소에 넣지 않는다** (유니티 에셋 라이선스). 저장소의 `assets/stage01-target.png`, `assets/bullet-hole-sheet.png` 에 한 번 올리고 서버가 읽는다. 없으면 사진 기능만 꺼지고 나머지는 동작한다.
- 탄흔 위치
  - 탄에 `HasFace`(유니티가 보낸 상자 앞면 비율 좌표 `FaceX`, `FaceY`)가 있으면 결과 창과 같은 식.
  - 없으면(더미·과거 세션) `X`, `Y`(m)를 이미지 픽셀로 변환: `x = ringCx + X × pxPerM`, `y = ringCy − Y × pxPerM`. `ringCx`, `ringCy`, `pxPerM` 은 표적 이미지의 링(바깥 링 반지름 = 0.097m)을 재서 코드 상수로 둔다.
  - 빗나간 탄은 그리지 않는다 (결과 창과 같음). `IndoorTargetScore` 가 아닌 세션은 사진을 만들지 않는다.
- 탄흔 크기는 이미지 폭의 4.2%, 시트 6칸 중 하나를 세션 Id·탄 번호로 정해 고른다 (같은 세션은 항상 같은 그림).
- 출력: 원본의 2배(704×996) JPEG. 표적 확대가 흐려지지 않도록 부드럽게 늘린다.
- 라이브러리: `sharp`.

**언제 만드나**
- 실제 세션: 수신해 유니티에 응답한 **뒤** 백그라운드로 (2초 제한에 영향 없음).
- 더미: `seed` 가 넣을 때 함께 (동시 처리, 1,000장 약 1~2분).
- 사진이 없는 세션(과거 기록, 실패한 경우): 대시보드가 그 사람을 열 때 백그라운드로 만들기 시작하고, 다음 새로고침부터 보인다.

**저장**
- `photos/<세션Id>.jpg`, 더미는 `photos/dummy/<세션Id>.jpg`. S3 기본 암호화에 더해 올릴 때 `ServerSideEncryption: AES256` 명시. 상태에는 세션별 `photoKey` 만 남긴다.
- 더미 지우기는 `photos/dummy/` 도 지운다. 삭제 권한이 없으면 경고만 남기고 상태는 지운다.

**보여주기**
- 세션 응답에 `photoUrl?: string` 추가. S3 저장소면 **1시간짜리 https 임시 주소(presigned URL)** — 브라우저가 S3에서 직접 받는다 (S3 → 브라우저 구간 암호화). 로컬 저장소면 서버의 `/api/photos/:sessionId?exp&sig` (AUTH_SECRET 서명, 1시간).
- 화면 (`UserDashboard`, 관리자·본인 공용)
  - ① 표적지 카드: 세션 고르기(기본 최근) + `[분석 그림 | 표적 사진]` 전환. 오른쪽 수치도 고른 세션 기준. 사진이 아직 없으면 "사진을 만드는 중입니다".
  - ② 리포트 목록: 사진이 있는 세션에 `[표적 사진]` 버튼 → 크게 보기 창 (세션 번호·날짜·탄착군·판정).
  - 어떤 세션에도 `photoUrl` 이 없으면(가짜 데이터 모드) 전환·버튼을 숨겨 지금 모습 그대로.

**유니티 (사용자가 직접 적용, 방법만 안내)**
- `ShotRecord` 에 `HasFace`, `FaceX`, `FaceY` 추가, `ShootingSessionRecorder.AttachHit` 에서 `frame.TryNormalizeOnFace(point, out Vector2 face)` 결과를 저장.

## 비목표

- 유니티 화면 캡처, Stage02(실외) 사진, 사진 위 주석·확대 도구, 사진 내려받기 버튼
- 유니티 → EC2 구간 암호화 (도메인·인증서 필요)

## 위험

- SafeRole 에 `s3:DeleteObject` 가 없으면 더미 사진이 남는다 (용량은 작음).
- 링 측정 상수가 결과 창의 상자 앞면 매핑과 몇 픽셀 다를 수 있다. 유니티 `FaceX` 가 들어오면 실제 세션은 정확해진다.
