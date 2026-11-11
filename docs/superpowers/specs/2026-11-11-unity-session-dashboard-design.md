# 유니티 사격 세션 → 영점사격 대시보드 연결 설계

- 작성일: 2026-11-11
- 대상 저장소
  - 웹(대시보드 + 새 서버): `nxtcloud-edu/anchor-triggerPoint-team-unityWebView` (이하 **view 저장소**)
  - 유니티 클라이언트: `C:\VRMilitarySimulator` (이하 **유니티 프로젝트**)
- 상태: 초안 (사용자 승인 전)

## 1. 목적과 배경

유니티(Quest/에디터)에서 실제로 쏜 사격 세션을, view 저장소의 대시보드 화면(관리자 화면 + 개인 대시보드)에 **가짜 데이터 대신 실제 데이터로** 보여준다. 개인 대시보드에서는 표적지에 탄이 어디 박혔는지, 탄착군 크기, 중심 편차, 조정 클릭, 사격 역량 지표, 코치 분석이 보여야 한다.

지금 상태:

- 대시보드(`frontend/`)는 `VITE_USE_MOCK=true`로 브라우저 안에서 만든 가짜 데이터만 보여준다. 실제 서버는 없다.
- 유니티는 세션을 저장할 때마다 `ShootingResultSender`가 세션 JSON 전체를 HTTP POST로 보낸다 (`Assets/Scripts/Content/Records/ShootingResultSender.cs`). EC2에 띄운 임시 수신기로 전송이 되는 것까지 확인했다 (2026-11-03, 6,897 bytes).
- AWS 교육 계정 조건: **S3와 EC2만 사용**. 데이터는 반드시 S3에 둔다. IAM 역할은 새로 만들 수 없고, EC2에는 `SafeRole-anchor-edu-01` 역할이 이미 붙어 있다.

## 2. 목표 / 비목표 / 안티목표

**목표**

1. EC2 80번 포트에 데이터 서버를 띄워, 유니티가 보낸 세션을 받아 S3에 저장한다.
2. 서버가 대시보드의 기존 API 계약(README의 API 목록, `frontend/src/api/types.ts`)을 실제 데이터로 제공한다. 관리자 화면(중대·소대·인원 목록)과 개인 대시보드(`/users/:id`, `/me/:id`)가 모두 실제 데이터로 동작한다.
3. 관리자 웹에서 명단(군번·이름·소대)을 넣고, 시뮬레이터별로 사수를 배치하고, 잘못 붙은 세션을 다른 사람에게 옮길 수 있다.
4. 개인 대시보드의 코치 분석 문장이 실제 지표로 채워진다 (규칙 기반).

**비목표 (이번에 하지 않음)**

- S3 정적 웹사이트로 화면 배포, 보안 그룹·EC2의 Terraform 관리 → 다음 프로젝트
- Amazon Bedrock AI 분석 → 규칙 기반으로 먼저 채우고, 권한 확인 후 다음 단계
- 리포트 PDF·MD·JSON 실제 생성 (리포트 버튼은 지금처럼 데모 토스트로 남김)
- VR 안에 "현재 사수" 이름 표시
- 기기별 시뮬레이터 번호를 바꾸는 유니티 UI (기본값 1 고정)
- 훈련병(사용자) 로그인, HTTPS, 탄력적 IP
- 25m 환산 (사용자 결정: cm 그대로)
- 서버가 꺼져 있을 때 쏜 세션을 나중에 채워 넣기 (§5-13)

**안티목표 (이렇게 되면 실패)**

- 화면 배치·디자인이 바뀌는 것. 화면은 그대로 두고 데이터를 화면에 맞춘다. 허용하는 화면 변경은 §10에 적은 것뿐이다.
- 가짜 데이터 모드(`VITE_USE_MOCK=true`)가 깨지는 것. 시연용으로 계속 쓴다.
- 데이터가 EC2 디스크에만 남는 것.
- 비밀번호·키가 깃에 올라가는 것.

## 3. 제약

- **AWS**: 리전 `us-east-1`. EC2 `anchor-edu-01-ec2` (t3.small, Amazon Linux 2023). Node 22.21.1, pnpm 12.16.1(ec2-user 계정에 전역 설치), git, aws-cli 2 설치돼 있음. Terraform은 설치 안 됨.
- **S3 버킷** `anchor-edu-01-s3`: 2026-11-03 확인 시 **아직 없음**.
- **보안 그룹 열린 포트**: 80(서버, sudo 필요), 8000(화면), 9080(브라우저 VS Code 작업실).
- **퍼블릭 IP는 EC2를 켤 때마다 바뀐다** (탄력적 IP 없음). 켤 때마다 콘솔에서 확인한다.
- 같은 AWS 계정에 다른 팀 인스턴스가 있다. 이름이 `anchor-edu-01`로 시작하는 리소스만 건드린다.
- 사용 후 EC2는 반드시 중지한다. 서버가 상시 떠 있지 않으므로 상태는 매번 S3에서 다시 읽어야 한다.
- 화면 코드는 `frontend/CLAUDE.md` 규칙을 따른다 (`@/api/command`로만 호출, 마크업은 `div`, 색은 테마 토큰).

## 4. 접근 방식 (Approaches)

| 방식 | 장점 | 단점 | 결정 |
|---|---|---|---|
| **Node + TypeScript 서버, view 저장소 `backend/`** | 화면과 같은 언어. `frontend/src/api/types.ts`·`constants/shooting.ts`를 그대로 가져다 써서 계약이 어긋나지 않음. EC2에 Node가 이미 있음. 웹 담당자가 유지보수 가능 | `ShootingAdvisor`의 클릭 계산을 C#에서 옮겨야 함 | **선택 (사용자)** |
| C# ASP.NET Core 서버 | 유니티 개발자가 고치기 쉬움. `ShootingRecordData`를 거의 그대로 재사용 | EC2에 .NET 설치 필요. 화면 타입을 C#으로 한 번 더 정의해야 함 | 탈락 |
| Lambda 등 서버리스 | 상시 서버 불필요 | "S3 + EC2만 사용" 조건 위반 | 탈락 |

## 5. 결정 사항

사용자가 정한 것:

1. **유니티 탄창 하나(현재 10발) = 화면의 세션 하나 = 회차 하나.** 3발씩 나누지 않는다. 표적지에는 1회차 한 가지 색으로 찍힌다.
2. **거리는 cm 그대로.** 쏜 거리(10m·20m·30m…)에서 잰 cm 값을 그대로 쓰고, 합격 기준(탄착군 ⌀5cm, 중심 편차 2.5cm)도 거리와 상관없이 그대로 적용한다. 가까이서 쏠수록 합격이 쉬운 점은 알고 받아들인 것이다.
3. **사수는 관리자 웹에서 정한다.** 명단을 붙여넣고, 시뮬레이터별로 사람을 배치하며, 들어온 세션에는 그 순간 배치된 사람이 붙는다. VR 이름 표시는 나중에 한다.
4. **AI 코치 분석은 규칙 기반 먼저.**
5. **서버는 Node + TypeScript.**

설계자(Claude)가 정한 것 (사용자가 뒤집을 수 있음):

6. 레이더 5개 지표는 유니티 센서 기록(총구 궤적, 캔트)과 탄착에서 계산한다 (§7.3). 점수 기준값은 초기값이며 실제 기록을 보며 조정한다.
7. 관리자 계정은 하나. 아이디·비밀번호는 EC2 환경 변수로만 둔다.
8. 코치 분석 문장은 **화면이 이미 지표·회차 값으로 만들어내는 규칙 기반 문장**(`UserDashboard.tsx`의 `CoachCard`)을 그대로 쓴다. 서버는 지표와 클릭 수를 정확히 계산해 넘기는 것으로 충분하다. 회차가 1개일 때 어색해지는 한 줄과 "Bedrock" 표기만 고친다 (§10).
9. 세션 날짜는 유니티의 `StartedAt`(시간대 정보 없음) 대신 **서버가 받은 시각**을 쓴다. 유니티는 저장 직후 바로 보내므로 차이가 거의 없다.
10. 빗나간 탄(`Hit=false`)은 표적지에 찍지 않고 명중 수에만 반영한다.
11. 명중이 3발 미만이면 합격으로 보지 않는다 (유니티 `_minHitsForEvaluation = 3`과 같은 기준).
12. 명중 3발 미만 세션은 "실패한 세션"으로 세되, 탄착군 크기를 잴 수 없는 세션으로 다룬다 (§7.7). 실제 기록에 이미 10발 모두 빗나간 세션이 있다.
13. 서버가 꺼져 있거나 유니티에 예전 IP가 박혀 있을 때 쏜 세션은 대시보드에 오지 않는다. 유니티는 2초 안에 한 번만 보내고 다시 시도하지 않는다. 그 세션은 기기 안의 `ShootingRecords/sessions`에만 남는다. 이번에는 채워 넣는 기능을 만들지 않는다. 나중에 할 일로는 유니티가 못 보낸 세션을 다음 실행 때 다시 보내는 방식을 권한다.
14. **대시보드에는 실내 영점 표적에서 탄창을 다 쏜 세션만 넣는다 (사용자 결정).** 판별 규칙(설계자): `Target.ProfileName`이 `COUNTED_TARGET_PROFILES`(기본 `IndoorTargetScore`)에 있고 `EndReason == "MagazineEmpty"`. 실외 스테이지(Stage02, 사람 모양 표적 `OutdoorTargetScore`, 레일이 없어 거리 칸이 명중탄 평균 거리가 됨)와 중간에 멈춘 세션(`Stopped`)도 원본은 S3에 저장하지만, `counted: false`로 표시해 세션 수·합격률·일별 막대·인원 목록·개인 대시보드·지표 평균 어디에도 넣지 않는다. 사격 배치 페이지의 최근 세션 목록에는 "집계 제외" 표시와 함께 보여 줘서, 세션이 도착했는지는 확인할 수 있게 한다.

## 6. 전체 구조

```
유니티 (에디터/Quest)
  └─ POST http://<EC2 IP>/api/session  ── 세션 JSON (기존 형식 + SimulatorId)
                         │
EC2 :80  backend (Node + TS)
  ├─ 받은 세션 → 화면 형식으로 변환 (§7) → S3에 저장 (§8)
  ├─ 기존 API 계약 제공 (/api/company, /api/dashboard, /api/members …)
  └─ 새 API: 명단, 시뮬레이터 배치, 최근 세션 옮기기 (§9)
                         ▲  /api/* (Vite 개발 서버가 넘겨줌)
EC2 :8000  frontend (Vite 개발 서버, VITE_USE_MOCK=false)
                         ▲
관리자 브라우저 (http://<EC2 IP>:8000)
```

- 개발 중에는 Vite 개발 서버의 proxy가 `/api/*`를 `http://localhost:80`으로 넘긴다. 화면은 같은 주소로 요청하므로 IP가 바뀌어도 화면 설정을 고칠 필요가 없고, CORS도 필요 없다.
- 나중에 S3 정적 호스팅으로 옮길 때를 위해 서버는 `CORS_ORIGINS` 환경 변수에 적힌 주소만 허용하는 CORS를 지금 넣어 둔다 (기본은 비어 있음).

## 7. 데이터 변환 규칙 (유니티 → 화면)

### 7.1 유니티가 보내는 것

`ShootingSessionRecord` (`Assets/Scripts/Content/Records/ShootingRecordData.cs`)를 `JsonUtility`로 직렬화한 JSON. 필드 이름은 PascalCase다. 단위:

- `X`, `Y`, `MpiX`, `MpiY`, `GroupSize`, `MeanRadius`는 **미터**. 표적 중심 기준, x는 오른쪽 +, y는 위 +.
- `GroupSize`는 명중탄 사이의 최대 거리(extreme spread), `MeanRadius`는 평균 탄착점에서의 평균 거리 (`ShootingRecordMath.cs`).
- `CantDegrees`는 총의 좌우 기울기(도).
- `Trace`(AimTrace): `StartMs=-500`, `StepMs=20`, 격발 -500ms부터 +200ms까지 36개 샘플. `RightMrad`, `UpMrad`는 격발 순간 총구 방향 기준 각도(mrad). 격발 순간은 인덱스 25. **마지막 탄은 세션이 저장될 때 +200ms가 지나지 않아 배열이 비어 있을 수 있다.**
- `Advice`는 기본 객체(빈 문자열)로 온다. EC2로 보낸 세션에는 분석이 붙어 있지 않다.
- `ShooterId`, `ShooterName`은 받기만 하고 쓰지 않는다 (원본에는 그대로 남김).
- 새 필드 `SimulatorId` (문자열). 없으면 `"1"`로 본다.

### 7.2 세션 하나 → `Session` (types.ts)

| 화면 필드 | 계산 |
|---|---|
| `id` | 유니티 `Id` |
| `index` | 그 사람의 세션을 받은 시각 순으로 1부터. 세션을 옮기면 다시 매김 |
| `date` | 서버가 받은 시각 (ISO) |
| `diameter` | `GroupSize × 100`, 소수 1자리 (cm) |
| `offset` | `hypot(MpiX, MpiY) × 100`, 소수 1자리 |
| `pass` | `HitCount ≥ 3` 그리고 `diameter ≤ PASS_DIAMETER_CM(5)` 그리고 `offset ≤ PASS_OFFSET_CM(2.5)` |
| `metrics` | §7.3의 5개 점수, `METRICS` 순서 |
| `rounds` | 회차 1개: `{ round: 1, cx: MpiX×100, cy: MpiY×100, diameter, shots: 명중탄의 {x: X×100, y: Y×100} }` (소수 2자리) |
| `clicksH`, `clicksV` | §7.4 |
| `durationMin` | `DurationSeconds / 60`, 소수 1자리 |
| `report` | 항상 `'ok'` (리포트 버튼은 데모 그대로) |
| `key` | 원본의 S3 키 (§8) |
| 새 선택 필드 | `distanceMeters`, `shotsFired`, `hitCount`, `stageName`, `simulatorId` |

새 필드는 모두 선택(optional)으로 추가해서 가짜 데이터 모드가 그대로 동작하게 한다.

### 7.3 레이더 5개 지표 (0–100)

탄마다 `Trace`가 온전한 경우만 사용하고, 세션 값은 탄별 값의 평균이다. 계산할 수 있는 탄이 하나도 없으면 그 지표는 50으로 둔다.

| 지표 (`METRICS` 순서) | 원래 값 | 좋음 → 나쁨 (초기값) |
|---|---|---|
| 조준 안정성 | 격발 전 -500~0ms 동안 조준점의 흔들림 = `sqrt(var(Right) + var(Up))` (mrad) | 0.3 → 3.0 |
| 호흡 통제 | 같은 구간 `std(Up)` (mrad) | 0.2 → 2.0 |
| 격발 제어 | 격발 직전 200ms 이동량 = `hypot(Right[25]−Right[15], Up[25]−Up[15])` (mrad). `ShootingAdvisor.TryGetPreShotMovement`와 같은 값 | 0.2 → 2.0 |
| 사격 자세 | 세션 안 `CantDegrees`의 최댓값 − 최솟값 (도) | 1 → 10 |
| 탄착 일관성 | `MeanRadius × 100` (cm) | 0.5 → 5.0 |

점수 = `clamp(round(99 − 84 × (값 − 좋음) / (나쁨 − 좋음)), 15, 99)`. 좋음 이하면 99, 나쁨 이상이면 15. 가짜 데이터의 점수 범위(15–99)와 맞춘 것이다. 기준값은 서버 설정 한 곳에 모아 두고, 실제 기록을 보며 조정한다.

### 7.4 조정 클릭

`ShootingAdvisor.ApplyClicks`의 계산을 옮긴다. 단, 화면은 클릭 수를 항상 보여주므로 문제 유형과 상관없이 계산한다.

- 한 클릭이 움직이는 거리(cm): 좌우 = `CLICK_CM_AT_100M_H(기본 3) × DistanceMeters / 100`, 상하 = `CLICK_CM_AT_100M_V(기본 3) × DistanceMeters / 100`. 유니티의 `WindageClickCmAt100m`, `ElevationClickCmAt100m`에 대응한다.
- `clicksH = round(−cx / 좌우 한 클릭)`, `clicksV = round(−cy / 상하 한 클릭)` → 화면 규칙대로 양수면 R·U, 음수면 L·D (탄착을 중심으로 옮기는 방향)
- 명중 3발 미만이거나 `DistanceMeters ≤ 0`이면 0

### 7.5 사람(`Member`, `MemberDetail`)

| 필드 | 계산 |
|---|---|
| `id`, `name` | 명단의 군번, 이름 |
| `platoonId`, `platoonName` | 명단의 소대 번호 n → `p{n}`, `{n}소대` (정렬이 `platoonId.slice(1)`의 숫자에 의존함) |
| `sessionCount` | 그 사람 세션 수 |
| `best` | 명중 3발 이상 세션 중 가장 작은 `diameter`. 없으면 0 |
| `last` | 최근 세션 `diameter`. 없으면 0 |
| `score` | 가짜 데이터와 같은 식: `round(평균(최근 metrics) × 0.6 + clamp(100 − (last − 1.5) × 9, 0, 100) × 0.4)`. 세션 없으면 0 |
| `status` | 최근 세션이 `pass`면 `'영점 완료'`, 아니면(세션 없음 포함) `'재훈련 필요'` |
| `lastDate` | 최근 세션 `date`. 세션 없으면 빈 문자열 |
| `weapon` (Detail) | 최근 세션의 `"{StageName} · {DistanceMeters}m"`. 세션 없으면 `"사격 기록 없음"` |
| `metricLabels` | `METRICS` |
| `companyAvgMetrics` | 세션이 있는 모든 사람의 최근 세션 `metrics` 평균 |

### 7.6 집계 (중대·소대 대시보드)

`frontend/src/mocks/data/aggregate.ts`의 `platoonSummaries`, `buildDashboard`와 **같은 의미**로 계산한다. 차이는 데이터 출처뿐이다.

- 집계에는 사람이 붙은 세션 중 `counted`인 것만 쓴다 (§5-14). 미배정 세션과 집계 제외 세션은 빠진다. §7.5의 사람 필드(`sessionCount`, `best`, `last`, `status` 등)도 `counted` 세션만으로 계산한다.
- 교정 포인트(`corrections`)는 가짜 데이터와 같은 규칙: 지표 [조준 안정성, 호흡 통제, 사격 자세] 중 가장 낮은 것을 각각 [조준선 정렬, 호흡 불안정, 사격 자세]로 센다.
- "오늘", 일별 막대, `fmtD` 형식의 날짜 라벨은 **한국 시간(Asia/Seoul)** 기준이다. 서버는 `TZ=Asia/Seoul`로 실행한다.
- `Company`의 `name`, `course`, `simulatorCount`는 서버 상태(§8)의 `company` 값을 쓴다. 처음 값은 `1중대`, `2026년 2기 영점사격 과정`, `1`이다.

### 7.7 명중 3발 미만 세션

명중이 0~2발이면 유니티는 `GroupSize`, `MpiX`, `MpiY`, `MeanRadius`를 0이나 의미 없는 작은 값으로 보낸다. 그대로 쓰면 다 빗나간 사람이 탄착군 0.0cm로 상위권에 올라간다. 그래서 이렇게 다룬다.

- 세션 수, 합격률, 일별 막대에는 **실패한 세션**으로 들어간다 (`pass = false`).
- 탄착군 평균(`avgDiameter`, `prevAvgDiameter`, 소대 요약의 `avgDiameter`)과 `best`에서는 뺀다.
- `diameter`, `offset`, `rounds[0].diameter`는 0으로 보내고, 화면은 `hitCount < 3`이면 숫자 대신 `-`를 보여준다 (§10).
- `clicksH`, `clicksV`는 0.
- 지표: 탄착 일관성은 15(최저). 나머지 지표는 총구 궤적으로 계산되므로 그대로 계산한다.
- 사람의 `last`는 명중 3발 이상인 가장 최근 세션의 `diameter`(없으면 0). `status`는 가장 최근 세션 기준이므로 `'재훈련 필요'`.
- `score`의 탄착군 항(40%)은 위의 `last`를 쓴다. `last`가 0이면 그 항은 0점이다.

## 8. 저장 (S3 `anchor-edu-01-s3`, us-east-1)

```
anchor-edu-01-s3/
├── raw/YYYY/MM/DD/<세션Id>.json   # 유니티 원본 + {receivedAt, simulatorId}. 같은 세션 Id가 다시 오면 덮어씀 (§9.1)
└── db/state.json                  # 서버 상태 전체
```

- `state.json`에는 `company`, 명단(`members`), 시뮬레이터 배치(`simulators`), 세션별 계산 결과(§7.2의 `Session` 필드 + `memberId`·`simulatorId`·`receivedAt`·`rawKey`)를 넣는다. 서버는 켜질 때 이 파일 하나만 읽어서 메모리에 올린다. 300명 × 세션 수십 개 수준이라 문제없다.
- 상태가 바뀔 때마다 `state.json`을 통째로 다시 쓴다. 서버 프로세스 안에서 쓰기를 한 줄로 세워(직렬화) 겹치지 않게 한다.
- 원본에 사람 군번을 넣지 않은 이유: 세션을 다른 사람으로 옮길 때 S3 객체를 옮기지 않아도 되게 하려고. README에 계획된 `raw/YYYY/MM/DD/<군번>/sNN` 구조와 다르다.
- 지표 기준값을 바꾸면, 원본에서 계산 결과를 다시 만드는 스크립트(`recompute`)로 `state.json`을 갱신한다.
- 버킷 버전 관리(versioning)를 켜서 `state.json`을 잘못 덮어써도 되돌릴 수 있게 한다.
- 개발·테스트용으로 같은 구조를 로컬 폴더에 쓰는 저장소 구현도 둔다 (`STORAGE=fs`).

**버킷 생성**: view 저장소 `infra/`에 최소 Terraform(HCL)을 둔다. 버킷, 퍼블릭 액세스 전부 차단, 버전 관리, 기본 암호화만 만든다. 정적 웹사이트와 `web/*` 공개 정책은 다음 프로젝트에서 추가한다. Terraform 상태 파일은 EC2의 `infra/` 안에 로컬로 두고 깃에서 제외한다.

## 9. API

기존 계약(README §3, `types.ts`, `command.ts`)은 **그대로** 제공한다. 쿼리 파라미터 의미(`range`, `platoonId`, `q`, `status`, `sort`, `dir`, `page`, `size`)는 `frontend/src/mocks/handlers.ts`와 같다.

| 메서드 · 경로 | 인증 | 설명 |
|---|---|---|
| `POST /api/auth/login` | – | `ADMIN_USERNAME`/`ADMIN_PASSWORD` 환경 변수와 비교. 토큰은 `AUTH_SECRET`으로 서명하고 12시간 뒤 만료 |
| `GET /api/auth/me` | 관리자 | `{ id: 'admin', name: '관리자', role: 'admin' }` |
| `GET /api/company`, `/api/platoons`, `/api/dashboard`, `/api/members`, `/api/members/:id` | 관리자 | 기존 계약 |
| `GET /api/me/:id` | – | 기존 계약. 군번만 알면 열린다 (README에 적힌 알려진 위험, 이번 범위 밖) |
| **`POST /api/session`** | – | 유니티 수신 (§9.1) |
| **`POST /api/roster`** | 관리자 | `{ text }`. 한 줄에 `군번,이름,소대` (쉼표 또는 탭. 엑셀 붙여넣기 대응). 소대는 `3` 또는 `3소대`. 군번 기준으로 추가하거나 갱신. 응답 `{ added, updated, errors: [{ line, reason }] }` |
| **`GET /api/simulators`** | 관리자 | `[{ id, member: { id, name, platoonName } \| null, assignedAt }]`, 1번부터 `simulatorCount`까지 |
| **`PUT /api/simulators/:id`** | 관리자 | `{ memberId: string \| null }`. 배치는 바꿀 때까지 유지된다 (한 사람이 연달아 쏘는 경우 대응) |
| **`GET /api/sessions/recent?limit=20`** | 관리자 | `[{ id, date, simulatorId, memberId \| null, memberName \| null, shotsFired, hitCount, diameter, counted, stageName }]` 최신순. 집계 제외 세션(§5-14)도 포함 |
| **`POST /api/sessions/:id/assign`** | 관리자 | `{ memberId }`. 세션 주인을 바꾸고 해당 사람들의 `index`를 다시 매김 |

### 9.1 유니티 수신 `POST /api/session`

1. 본문을 JSON으로 읽는다. `Id`가 없으면 400.
2. 받은 시각(`receivedAt`)을 붙이고, `SimulatorId`가 없으면 `"1"`.
3. 그 시뮬레이터에 지금 배치된 사람을 `memberId`로 붙인다. 없으면 미배정(`null`)이며, 최근 세션 목록에서 나중에 옮길 수 있다.
4. 같은 `Id`가 이미 있으면 원본과 계산 결과를 덮어쓰되 `memberId`는 유지한다.
5. 원본을 S3에 쓰고, `state.json`을 갱신한 뒤 `202 { ok: true }`. 유니티 쪽 제한 시간이 2초라 그 안에 응답해야 한다.

선택: `INGEST_KEY` 환경 변수가 있으면 `X-Ingest-Key` 헤더가 같을 때만 받는다. 기본은 꺼 둔다 (유니티 변경 없이 시작하기 위해).

## 10. 화면 변경 (view 저장소 `frontend/`)

허용하는 변경은 이것뿐이다. 모두 `frontend/CLAUDE.md` 규칙을 따른다.

1. `vite.config.ts`: 개발 서버 `proxy`로 `/api` → `VITE_PROXY_TARGET`(기본 `http://localhost:80`).
2. `types.ts`, `command.ts`: §7.2의 선택 필드, §9의 새 API 타입과 호출 함수.
3. **사격 배치 페이지** `/assignments` (사이드바 "관리자" 아래 새 메뉴):
   - 시뮬레이터별 현재 사수와 [변경]/[해제]. 사람 고르기는 `/api/members` 검색으로.
   - 최근 세션 목록 (미배정 표시)과 [다른 사람으로 옮기기].
4. **사용자 목록 페이지**: [명단 붙여넣기] 버튼 → 텍스트 입력 창 → `POST /api/roster` → 결과 토스트 (오류 줄 표시).
5. **개인 대시보드** (`UserDashboard.tsx`)
   - 세션이 없는 사람: 화면이 깨지지 않게 "아직 사격 기록이 없습니다"를 보여준다 (지금은 `S[S.length-1]`이 없으면 깨짐).
   - `CoachCard`: 회차가 1개면 "1회차 대비 N회차 중심이 … 수렴했습니다. 클릭 조정은 정확했습니다." 줄 대신, 평균 탄착점 방향·거리와 조정 클릭(`좌우 L 2클릭 · 상하 U 2클릭`)을 알려주는 줄을 보여준다.
   - 문구만 수정: `CoachCard`의 "Amazon Bedrock이 … 생성한 리포트 발췌"와 "생성: Bedrock"은 "규칙 기반 분석"으로, `TargetCard`의 "25m 영점 표적 · 1칸 = 1cm · 회차별 3발"은 `distanceMeters`가 있으면 "{거리}m · 1칸 = 1cm · {발수}발"로 바꾼다.
6. 인원 표 등에서 `lastDate`가 빈 문자열이면 날짜 대신 `-`를 보여준다.
7. 명중 3발 미만 세션(§7.7, `hitCount < 3`): "최근 탄착군" 카드의 큰 숫자, 직전 세션 대비 표시, 회차 탄착군, 중심 편차를 `-`로 보여주고, `CoachCard` 첫 문장은 "명중 {n}발로 탄착군을 잴 수 없습니다"로 바꾼다. `hitCount`가 없는 가짜 데이터는 지금처럼 보인다.
8. **가짜 데이터 모드 유지**: 새 API에 대한 목 핸들러를 `src/mocks/handlers.ts`에 추가한다 (메모리 안에서만 동작하면 됨).

## 11. 유니티 변경 (사용자가 직접 적용, 방법만 안내)

1. `ShootingSessionRecord`에 `public string SimulatorId;` 추가.
2. `ShootingResultSender`가 보내기 전에 `SimulatorId`를 채운다. 기본값 `"1"` (기기별 설정은 비목표).
3. 전송 주소를 `http://<EC2 퍼블릭 IP>/api/session`(80번)으로. IP가 바뀔 때마다 고쳐야 하는 불편은 알려진 문제다 (탄력적 IP는 비목표).
4. 테스트 동안 바뀐 주소는 커밋하지 않는다.

## 12. 실행 환경 (EC2)

- 저장소 위치: `~/anchor-triggerPoint-team-unityWebView` (이미 클론돼 있음)
- 서버(80번): `sudo` 필요. node가 ec2-user 계정에 설치돼 있어 `sudo node`로는 못 찾을 수 있다. `sudo env ... $(which node) ...` 형태로 실행하거나, `setcap cap_net_bind_service`로 node에 80번 사용 권한을 주는 방법 중 구현 때 하나를 고른다.
- 서버 환경 변수: `TZ=Asia/Seoul`, `PORT=80`, `STORAGE=s3`, `S3_BUCKET=anchor-edu-01-s3`, `AWS_REGION=us-east-1`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `AUTH_SECRET`, (선택) `CORS_ORIGINS`, `INGEST_KEY`, `CLICK_CM_AT_100M_H`, `CLICK_CM_AT_100M_V`, `COUNTED_TARGET_PROFILES`. 값은 EC2의 깃 제외 파일(`backend/.env`)에만 둔다. AWS 자격 증명은 EC2 역할에서 자동으로 얻는다.
- 화면(8000번): `frontend/.env`에 `VITE_USE_MOCK=false`, `VITE_SERVER_URL=`(비움). `pnpm dev --host 0.0.0.0 --port 8000`.
- 개발 브랜치에서 작업하고 PR로 `main`에 합친다. EC2에서는 `git pull`로 받는다.

## 13. 위험과 먼저 확인할 것

1. **SafeRole 권한**: 버킷 생성(`s3:CreateBucket`), 버전 관리·암호화 설정, 객체 읽기·쓰기·목록 권한이 있는지 가장 먼저 확인한다. 버킷을 만들 수 없으면 콘솔에서 만들고 `terraform import`로 가져온다. 객체 쓰기가 안 되면 이 설계는 진행할 수 없으므로 멘토에게 요청한다.
2. **Terraform 설치**: EC2에 없음. 설치가 막히면 버킷을 콘솔이나 aws-cli로 만들고 Terraform은 다음 프로젝트로 미룬다.
3. **마지막 탄의 Trace가 비어 있을 수 있음**: §7.3대로 그 탄은 지표 계산에서 뺀다.
4. **IP 변경**: 유니티 주소를 매번 고쳐야 한다.
5. **열려 있는 엔드포인트**: `/api/me/:id`, `/api/session`은 인증이 없다. 교육용 범위에서 받아들이고, `INGEST_KEY`는 필요할 때 켠다.

## 14. 테스트

- 서버 단위 테스트(vitest): 변환(§7). 실제 유니티 세션 JSON을 고정 데이터로 쓴다. EC2의 `~/received/*.json`에서 하나를 가져온다.
- 집계 일치 테스트: 가짜 데이터 시드(`seed.ts`의 members/sessions)를 서버 집계 함수에 넣었을 때 `aggregate.ts`와 같은 결과가 나오는지 확인한다.
- API 테스트: `STORAGE=fs`로 수신 → 배치 → 조회 → 옮기기 흐름.
- 화면: `pnpm build`(타입 검사) 통과, 가짜 데이터 모드와 실제 모드 둘 다 EC2에서 눈으로 확인.
- 끝에서 끝: 유니티 에디터에서 사격 → 관리자 화면 사격 배치에 최근 세션이 뜨고 → 개인 대시보드 표적지에 10발이 찍힌다.

## 15. 구현자에게 맡기는 것

- 서버 프레임워크(Express, Fastify, Hono 등)와 폴더 구조, `frontend`의 타입·상수를 `backend`에서 가져오는 방식(상대 경로, pnpm workspace 등)
- 토큰 구현 세부 (서명 방식)
- 사격 배치 페이지와 명단 입력 창의 세부 모양 (기존 컴포넌트 `Card`, `Button`, `Select`, `Toast` 재사용)
- §7.3 기준값의 실제 조정
