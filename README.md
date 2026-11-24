# anchor-triggerPoint-team-unityWebView

Trigger_Point 영점사격 훈련 분석 플랫폼의 **웹 대시보드(Web View)** 프로젝트입니다.
Unity 사격 시뮬레이터 안의 WebView로 띄워서 쓰고, 같은 화면을 브라우저에서도 그대로 볼 수 있습니다.

- 관리자 화면은 **중대 기준**입니다 (1중대 · 소대 10개 · 소대당 30명).
- 관리자 화면 안에 **소대 대시보드**와 **사용자(개인) 대시보드**가 함께 들어 있습니다.
- `trigger_point_dashboard.html` 은 처음 만든 단일 HTML 시안이고, 실제 앱은 `frontend/` 입니다.

---

## 1. 기술 스택

| 구분             | 사용 기술                                                                            |
| ---------------- | ------------------------------------------------------------------------------------ |
| 빌드 · 개발 서버 | Vite 8                                                                               |
| 언어 · UI        | TypeScript 5.9, React 19                                                             |
| 라우팅           | React Router 7 (`BrowserRouter`)                                                     |
| 상태 관리        | Zustand 5 (인증 · 테마 · 토스트)                                                     |
| HTTP             | Axios (JWT 헤더 · 에러 변환 인터셉터)                                                |
| 스타일           | Tailwind CSS 4 + CSS 변수 토큰 (라이트/다크)                                         |
| 차트             | Chart.js 4 + react-chartjs-2, 표적지는 SVG 직접 그림                                 |
| 더미 데이터      | MSW 3 핸들러를 axios 어댑터로 직접 실행 (서비스 워커 없음 → HTTP·WebView에서도 동작) |
| 린트 · 포맷      | ESLint 9 + Prettier (공용 설정 `xxrthscrclz/eslint-prettier-configs`)                |
| 패키지 매니저    | pnpm                                                                                 |
| 배포 (예정)      | Terraform → AWS S3 + EC2 (t3.small)                                                  |

프론트엔드 작업 규칙은 [`frontend/CLAUDE.md`](frontend/CLAUDE.md)에 있습니다. 경로 별칭 `@/*`, API는 `@/api/command` 로만 호출하기, 마크업은 `div` 만 쓰기, 색상은 테마 토큰만 쓰기 같은 규칙입니다.

---

## 2. 화면 구성

| 경로                   | 화면                          | 내용                                                                                                                                                     |
| ---------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`               | 관리자 로그인                 | 목 모드에서는 아래 **개발자 로그인** 버튼으로 바로 들어갑니다                                                                                            |
| `/admin`               | 중대 대시보드                 | KPI 5개, 일별 사격 세션, 영점 상태(영점 완료/재훈련 필요), 소대별 합격률(10개 소대), 주요 교정 포인트(조준선 정렬·호흡 불안정·사격 자세), 소대 인원 현황 |
| `/platoons`            | 소대 목록                     | 소대 10개 카드 (합격률 · 영점 완료 · 재훈련 · 세션 수)                                                                                                   |
| `/platoons/:platoonId` | 소대 대시보드                 | 중대 대시보드와 같은 구성을 해당 소대 기준으로 보여 줌                                                                                                   |
| `/users`               | 사용자 목록                   | 이름·군번 검색, 소대·상태 필터, 정렬. 행을 누르면 개인 대시보드로 이동                                                                                   |
| `/users/:userId`       | 사용자 대시보드 (관리자용)    | 최근 탄착군, 표적지(1·2·3회차), 사격 역량 진단, AI 코치 분석, 리포트 목록                                                                                |
| `/me/:userId`          | 개인 대시보드 (사용자 본인용) | 관리자 메뉴 없이 위와 같은 개인 대시보드만 단독으로 보여 줌. 관리자 로그인 불필요 (Unity에서 사격 후 바로 열기용)                                        |

표적지 용어: 한 **세션** 안에서 3발씩 쏘는 단위를 **회차**라고 부릅니다 (1회차 = 조정 전, 3회차 = 최종). 세션 자체는 `세션 #N` 으로 표시합니다.

---

## 3. 로컬에서 실행하기

필요한 것: Node.js 22 이상, pnpm 11 이상

```bash
cd frontend
pnpm install
cp .env.example .env     # 처음 한 번만
pnpm dev                 # http://localhost:5173
```

| 명령                                | 설명                                  |
| ----------------------------------- | ------------------------------------- |
| `pnpm dev`                          | 개발 서버                             |
| `pnpm build`                        | 타입 검사 후 `frontend/dist/` 로 빌드 |
| `pnpm preview`                      | 빌드 결과 미리보기                    |
| `pnpm lint`                         | ESLint                                |
| `pnpm format` / `pnpm format:check` | Prettier                              |

### 환경 변수 (`frontend/.env`)

```env
VITE_SERVER_URL=                        # 백엔드 API 주소. 비우면 같은 주소의 /api 로 요청 (개발 서버가 아래 주소로 넘김)
VITE_PROXY_TARGET=http://localhost:80   # pnpm dev 가 /api 요청을 넘길 데이터 서버 (backend/)
VITE_USE_MOCK=true                      # 목(더미 데이터) 모드. 기본값 true
```

| `VITE_USE_MOCK`                    | 동작                                                                                                     | 로그인                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `true` (기본값, 값을 안 줘도 true) | `/api/*` 요청을 브라우저 안에서 더미 데이터로 응답 (`src/mocks/`)                                        | 로그인 화면 아래 **개발자 로그인** 버튼으로 아이디·비밀번호 없이 들어감 |
| `false`                            | `VITE_SERVER_URL/api/*` 실제 서버로 요청. 비워 두면 개발 서버가 `VITE_PROXY_TARGET`(`backend/`)으로 넘김 | 실제 서버의 아이디·비밀번호로 로그인. 개발자 로그인 버튼은 숨겨짐       |

> **실제 배포할 때는 반드시 `VITE_USE_MOCK=false` 로 빌드합니다.** 지금처럼 백엔드 없이 시연할 때만 `true` 를 씁니다.

더미 데이터는 시드가 고정되어 있어서 언제 열어도 같은 군번이면 같은 사람입니다 (날짜는 오늘 기준 최근 30일로 계산).

### API 목록 (`backend/` 가 제공)

타입은 `frontend/src/api/types.ts`, 호출 함수는 `frontend/src/api/command.ts` 에 있습니다. 서버 구현은 `backend/`, 설계는 `docs/superpowers/specs/2026-11-11-unity-session-dashboard-design.md` 입니다.

| 메서드 · 경로                                            | 설명                                                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `POST /api/auth/login`                                   | `{ username, password }` → `{ token, user }`                                                                 |
| `GET /api/auth/me`                                       | 현재 관리자                                                                                                  |
| `GET /api/company`                                       | 중대 정보 (이름, 과정, 소대 수, 인원 수)                                                                     |
| `GET /api/platoons?range=30`                             | 소대별 요약                                                                                                  |
| `GET /api/dashboard?range=30&platoonId=`                 | 대시보드 집계. `platoonId` 가 없으면 중대 전체                                                               |
| `GET /api/members?platoonId&q&status&sort&dir&page&size` | 인원 목록 (페이지)                                                                                           |
| `GET /api/members/:id`                                   | 개인 상세 (세션 · 회차별 탄착 · 지표)                                                                        |
| `GET /api/me/:id`                                        | 사용자 본인용 개인 상세. 응답은 위와 같음. 지금은 인증 없이 군번으로 조회 → **실서비스 전 사용자 인증 필요** |
| `POST /api/session`                                      | 유니티 세션 수신 (`ShootingResultSender`). `INGEST_KEY` 를 설정하면 `X-Ingest-Key` 헤더가 필요                |
| `POST /api/roster`                                       | 명단 붙여넣기 `{ text }` (한 줄에 `군번, 이름, 소대`) → `{ added, updated, errors }`                         |
| `GET /api/simulators` · `PUT /api/simulators/:id`        | 시뮬레이터별 사수 배치 조회 · 변경 (`memberId` 에 군번 또는 `null`)                                          |
| `GET /api/sessions/recent?limit=20`                      | 최근 받은 세션 (미배정 · 집계 제외 포함)                                                                     |
| `POST /api/sessions/:id/assign`                          | 세션을 다른 사람으로 옮기기 `{ memberId }`                                                                   |

인증은 `Authorization: Bearer <token>` 헤더를 씁니다 (`/api/me/:id`, `/api/session` 제외).

---

## 4. Unity 안에서 사용하기

Unity에는 기본 WebView가 없으므로 WebView 플러그인으로 이 웹앱의 URL을 띄웁니다.

### 4-1. 플러그인 고르기

| 플러그인                                                    | 지원 플랫폼                      | 비고                                                  |
| ----------------------------------------------------------- | -------------------------------- | ----------------------------------------------------- |
| [gree/unity-webview](https://github.com/gree/unity-webview) | Android, iOS, macOS(에디터 포함) | 무료 · 오픈소스. **Windows 빌드는 지원하지 않습니다** |
| Vuplex 3D WebView                                           | Windows, macOS, Android, iOS, VR | 유료. Windows 시뮬레이터 PC라면 이쪽이 현실적입니다   |

시뮬레이터가 Windows PC에서 돌아가면 Vuplex 같은 Windows 지원 플러그인이 필요합니다.

### 4-2. 기본 사용 예 (gree/unity-webview)

```csharp
using UnityEngine;

public class DashboardWebView : MonoBehaviour
{
    // 배포한 대시보드 주소 (S3 정적 웹사이트)
    [SerializeField] string baseUrl = "http://anchor-edu-01-s3.s3-website-us-east-1.amazonaws.com/web";
    WebViewObject webView;

    void Start()
    {
        webView = new GameObject("WebView").AddComponent<WebViewObject>();
        webView.Init(
            cb: msg => Debug.Log($"[Web→Unity] {msg}"),   // 웹에서 Unity로 보낸 메시지
            ld: loaded => Debug.Log($"[WebView] loaded {loaded}")
        );
        webView.SetMargins(0, 0, 0, 0);                  // 전체 화면. 패널 크기로 쓰려면 여백 조정
        webView.SetVisibility(true);
        webView.LoadURL($"{baseUrl}/admin");
    }

    // 사격이 끝난 사용자 본인에게 개인 대시보드를 보여 줄 때 (로그인 불필요)
    public void OpenMyDashboard(string memberId) => webView.LoadURL($"{baseUrl}/me/{memberId}");
}
```

- **관리자용** `/admin`: 처음 열면 로그인 화면이 나옵니다. 로그인 토큰은 WebView의 `localStorage` 에 저장되므로 다음부터는 바로 들어갑니다.
- **사용자 본인용** `/me/<군번>`: 관리자 메뉴 없이 개인 대시보드만 열립니다. 사격이 끝나면 그 사람의 군번으로 바로 띄우면 됩니다.

### 4-3. 꼭 확인할 것

- **HTTP 주소를 쓰면** Android는 `usesCleartextTraffic="true"` (또는 network security config), iOS는 ATS 예외를 설정해야 페이지가 열립니다. 가능하면 HTTPS를 쓰세요.
- **목 모드는 서비스 워커를 쓰지 않으므로** HTTP 주소(S3 웹사이트)와 서비스 워커를 지원하지 않는 WebView에서도 더미 데이터가 그대로 나옵니다.
- **새로고침·딥링크**: `BrowserRouter` 를 쓰므로, 웹 서버가 없는 경로를 받으면 `index.html` 을 돌려줘야 합니다 (아래 배포 절 참고).
- 화면은 폭 768px 미만에서 사이드바가 위로 접히는 반응형입니다. WebView 패널을 작게 띄워도 됩니다.

### 4-4. Unity ↔ 웹 연동 (다음 단계)

아직 구현하지 않았습니다. 필요해지면 아래 방식으로 붙입니다.

- Unity → 웹: `webView.EvaluateJS("window.dispatchEvent(new CustomEvent('tp:session', { detail: {...} }))")` 로 세션 종료를 알리고, 웹에서 데이터를 다시 불러오기
- 웹 → Unity: gree 플러그인 기준 `window.Unity.call('메시지')` → `Init` 의 `cb` 로 들어옴

---

## 5. 배포

배포는 **Terraform** 으로 하고, Unity 쪽과 같이 **AWS S3 + EC2** 만 사용합니다 (리전 `us-east-1`). 데이터 서버(`backend/`)와 S3 버킷 Terraform(`infra/`)은 준비됐고, 화면의 S3 정적 호스팅(5-3, 5-4)은 아직 계획 단계입니다. 실제로 돌리는 순서는 **5-6** 을 보세요.

### 5-1. 구성

| 리소스                     | 용도                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| EC2 (t3.small, 이미 생성)  | 80: 데이터 서버(`backend/`), 8000: 화면 개발 서버, 9080: 개발용 (브라우저 VS Code)            |
| S3 버킷 `anchor-edu-01-s3` | 사격 데이터(`raw/`, `db/`), 클라이언트 호스팅(정적 웹사이트, 예정), Unity 이미지·사운드(예정) |

### 5-2. 버킷 폴더 구조

```
anchor-edu-01-s3/
├── raw/            # 유니티 원본 세션 (raw/YYYY/MM/DD/<세션Id>.json) — 받은 날짜(한국 시간) 기준
├── db/             # 서버 상태 state.json (명단 · 시뮬레이터 배치 · 세션 계산 결과)
├── web/            # frontend/dist 빌드 결과 (예정)
├── reports/        # 생성된 리포트 (PDF · MD · JSON, 예정)
└── unity-assets/   # Unity 이미지 · 사운드 (예정)
```

원본 키에 군번을 넣지 않는 이유: 세션을 다른 사람으로 옮겨도 S3 객체를 옮기지 않으려고. 사람과 세션의 연결은 `db/state.json` 에 있습니다.

IAM 역할은 바꿀 수 없으므로 클라이언트는 **S3 정적 웹사이트 호스팅**으로 직접 공개합니다. 대신 버킷 정책으로 **`web/` 경로만** 공개 읽기를 허용하고, `raw/` · `reports/` 같은 사격 데이터는 공개하지 않습니다.

### 5-3. S3 버킷 설정 — 정적 호스팅 단계 (예정)

> 지금 `infra/main.tf` 는 **퍼블릭 액세스를 전부 차단**합니다 (사격 데이터 보호). 아래 설정은 화면을 S3로 호스팅하는 단계에서 Terraform 에 옮겨 넣습니다.

1. **객체 소유권**: ACL 비활성화됨 (권장값 그대로)
2. **이 버킷의 퍼블릭 액세스 차단 설정**: "모든 퍼블릭 액세스 차단" 체크를 풀고, 아래처럼 둡니다.

   | 항목                                                                                     | 설정  |
   | ---------------------------------------------------------------------------------------- | ----- |
   | 새 ACL을 통해 부여된 … 퍼블릭 액세스 차단                                                | ✅ 켬 |
   | 임의의 ACL을 통해 부여된 … 퍼블릭 액세스 차단                                            | ✅ 켬 |
   | 새 퍼블릭 버킷 또는 액세스 지점 정책을 통해 부여된 … 퍼블릭 액세스 차단                  | ⬜ 끔 |
   | 임의의 퍼블릭 버킷 또는 액세스 지점 정책을 통해 부여된 … 퍼블릭 및 교차 계정 액세스 차단 | ⬜ 끔 |

3. **권한 → 버킷 정책**: `web/` 아래만 누구나 읽을 수 있게 합니다.

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadWebOnly",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::anchor-edu-01-s3/web/*"
       }
     ]
   }
   ```

4. **속성 → 정적 웹사이트 호스팅**: 활성화, 인덱스 문서 `index.html`, 오류 문서 `web/index.html` (새로고침·딥링크 시 앱으로 돌아오게 함)

버킷 정책 저장이 "퍼블릭 액세스 차단" 때문에 거부되면 계정 단위 차단이 켜져 있는 것이므로 계정 관리자에게 요청해야 합니다.

### 5-4. 화면 배포 흐름 (예정)

1. `cd frontend && pnpm build:s3` (`/web/` 경로 기준으로 빌드)
2. `aws s3 sync dist/ s3://anchor-edu-01-s3/web/ --delete` (또는 콘솔에서 `dist/` 안의 파일을 `web/` 에 업로드)
3. 접속 주소: `http://anchor-edu-01-s3.s3-website-us-east-1.amazonaws.com/web/admin`

주의할 점:

- 지금(시연)은 더미 데이터를 쓰므로 `VITE_USE_MOCK=true` 그대로 빌드하면 S3 웹사이트에서도 바로 동작합니다.
- **실제 배포 때는 `VITE_USE_MOCK=false`** 로 빌드하고 EC2의 데이터 서버(80 포트)를 `VITE_SERVER_URL` 로 연결합니다. S3 웹사이트 주소는 HTTP만 지원합니다.
- 페이지(S3)와 API(EC2)의 주소가 다르므로 `backend/.env` 의 `CORS_ORIGINS` 에 S3 웹사이트 주소를 넣습니다.
- EC2 를 켤 때마다 퍼블릭 IP 가 바뀌므로, 이 단계에서는 탄력적 IP 가 필요합니다.

### 5-5. Terraform

- ✅ `infra/main.tf`: S3 버킷 · 퍼블릭 액세스 전부 차단 · 버전 관리 · 기본 암호화
- 예정: `web/*` 공개 읽기 정책과 정적 웹사이트 호스팅 (5-3), 보안 그룹 (80, 8000, 9080 — 9080은 허용 IP를 좁혀 둠), 이미 만든 EC2 `terraform import`
- IAM 역할은 권한이 없어 만들지 않습니다. EC2 에는 `SafeRole-anchor-edu-01` 이 이미 붙어 있어 키 없이 S3 에 접근합니다
- 이 저장소에는 접속 정보·비밀번호·액세스 키를 올리지 않습니다 (`.env`, `*.tfvars`, `*.tfstate` 는 `.gitignore`)

### 5-6. 실제 서버 실행 (EC2)

9080 의 브라우저 VS Code 터미널에서 실행합니다. 저장소는 `~/anchor-triggerPoint-team-unityWebView` 에 있다고 가정합니다.

**1) 권한 확인**

```bash
aws sts get-caller-identity   # assumed-role/SafeRole-anchor-edu-01 이 보이면 OK
```

**2) S3 버킷 만들기 (처음 한 번)**

```bash
sudo dnf install -y dnf-plugins-core
sudo dnf config-manager --add-repo https://rpm.releases.hashicorp.com/AmazonLinux/hashicorp.repo
sudo dnf -y install terraform
cd infra && terraform init && terraform apply
```

- 권한 오류로 버킷을 못 만들면 콘솔에서 `anchor-edu-01-s3` 를 만들고 `terraform import aws_s3_bucket.data anchor-edu-01-s3` 후 다시 `terraform apply`
- 목록·쓰기 권한 확인: `aws s3 ls s3://anchor-edu-01-s3/` 와 `echo ok | aws s3 cp - s3://anchor-edu-01-s3/db/check.txt && aws s3 rm s3://anchor-edu-01-s3/db/check.txt`. 목록 권한이 없으면 첫 실행 때 `db/state.json` 이 없다는 것을 알 수 없어 서버가 시작되지 않습니다
- Terraform 상태 파일(`infra/terraform.tfstate`)은 EC2 에만 있습니다. 지우지 마세요

**3) 데이터 서버 (80 포트)**

```bash
cd ~/anchor-triggerPoint-team-unityWebView/backend
pnpm install
cp .env.example .env   # ADMIN_PASSWORD 와 AUTH_SECRET 을 채운다 (AUTH_SECRET 은 openssl rand -hex 32)
sudo $(which node) --import tsx src/server.ts
```

- 80 포트라 `sudo` 가 필요합니다. node 가 ec2-user 계정에 설치돼 있어서 `sudo node` 대신 `sudo $(which node)` 로 경로를 넘깁니다
- `Trigger_Point 서버 :80 · 저장소 s3://anchor-edu-01-s3` 가 나오면 성공. 이 터미널은 켜 둡니다

**4) 화면 (8000 포트) — 새 터미널**

```bash
cd ~/anchor-triggerPoint-team-unityWebView/frontend
cp .env.example .env   # VITE_USE_MOCK=false 로 바꾼다 (VITE_SERVER_URL 은 비워 둔다)
pnpm dev --host 0.0.0.0 --port 8000
```

`http://<EC2 퍼블릭 IP>:8000` → 관리자 로그인 → **사용자 대시보드 › 명단 붙여넣기** → **사격 배치**에서 시뮬레이터에 사수 지정 → 유니티에서 사격하면 최근 세션에 뜨고 개인 대시보드 표적지에 찍힙니다.

**5) 유니티 변경**

- `ShootingSessionRecord` 에 `public string SimulatorId;` 를 추가하고, `ShootingResultSender` 가 보내기 전에 값을 채웁니다 (기본 `"1"`, 없으면 서버가 1번으로 봄)
- `ShootingResultSender.DEFAULT_URL` 을 `http://<EC2 퍼블릭 IP>/api/session` 으로 (80 포트라 번호 생략). EC2 를 켤 때마다 IP 가 바뀝니다
- (선택, 표적 사진을 결과 창과 픽셀까지 같게) `ShotRecord` 에 `public bool HasFace; public double FaceX; public double FaceY;` 를 추가하고, `ShootingSessionRecorder.AttachHit` 에서 `if (_profile == null) return;` **앞에** `frame.TryNormalizeOnFace(point, out Vector2 face)` 가 성공하면 세 값을 채웁니다 (`ShootingRecordMath.Round(face.x, 4)` 등)

**6) 발표용 더미 데이터 (선택)**

200명(10개 소대 × 20명)과 세션 약 1,000개를 실제 서버에 넣습니다. 실제 유니티 세션과 같은 모양으로 만들어 같은 규칙으로 계산되고, 화면에서는 실제 기록과 구분되지 않습니다. 원본(`raw/`)은 쓰지 않고 `db/state.json` 에만 들어갑니다.

```bash
# 터미널 A 에서 80번 서버를 Ctrl + C 로 먼저 끈다 (켜 둔 서버가 상태를 덮어쓰지 않도록)
cd ~/anchor-triggerPoint-team-unityWebView/backend
sudo $(which node) --import tsx src/scripts/seed.ts           # 더미 넣기 — 이전 더미는 지우고 오늘 기준 지난 30일로 새로 만든다
sudo $(which node) --import tsx src/scripts/seed.ts --clear   # 더미만 지우기 — 실제 명단·세션은 남는다
sudo $(which node) --import tsx src/server.ts                 # 서버 다시 켜기
```

- 발표 당일에 한 번 더 넣으면 날짜가 그날 기준으로 맞춰져 "최근 30일" 그래프가 꽉 찹니다
- 실제 인원은 지금처럼 명단 붙여넣기 → 사격 배치 → 사격으로 더하면 더미 사이에 섞여 보입니다
- 더미를 지울 때, 실제 세션이 더미 사람에게 옮겨져 있었으면 미배정으로 돌아가고 더미 사람에게 걸린 배치는 해제됩니다
- 머리말의 "Unity 시뮬레이터 N대" 는 `backend/.env` 의 `SIMULATOR_COUNT` 로 바꿉니다

**7) 세션별 표적 사진**

유니티 결과 창과 같은 그림(A4 종이 표적 + 탄흔)을 서버가 세션마다 만들어 `photos/<세션Id>.jpg` 에 암호화 저장하고(더미는 `photos/dummy/`), 개인 대시보드의 표적지 카드 `[표적 사진]` 과 리포트 목록 `[표적 사진]` 버튼에서 보여 줍니다. 브라우저는 서버가 붙여 주는 1시간짜리 https 임시 주소로 S3 에서 직접 받습니다.

재료 이미지 두 장은 유니티 에셋이라 공개 저장소에 넣지 않고, **S3 에 한 번 올립니다**. 9080 편집기 왼쪽 탐색기의 홈 폴더에 두 파일을 끌어다 놓은 뒤:

```bash
aws s3 cp ~/Tablet_ShootingTarget.png s3://anchor-edu-01-s3/assets/stage01-target.png   # Assets/Art/UI/Tablet_ShootingTarget.png
aws s3 cp ~/BulletHoleSheet.png      s3://anchor-edu-01-s3/assets/bullet-hole-sheet.png # Assets/Art/Bullet_hole/BulletHoleSheet.png
```

- 서버를 다시 켜면 첫 줄 끝에 `표적 사진 켜짐` 이 나옵니다 (재료가 없으면 `꺼짐`, 나머지 기능은 그대로)
- 사진은 세션을 받은 직후 만들고, 사진이 없던 예전 세션은 그 사람의 대시보드를 처음 열 때 만듭니다 (다음 새로고침부터 보임)
- 더미 사진은 `seed.ts` 를 다시 실행하면 함께 만들어집니다 (1,000장 약 1~2분). `--clear` 는 더미 사진도 지웁니다
- 사진이 브라우저에서 안 열리면 `backend/.env` 에 `PHOTO_PROXY=true` 를 넣고 서버를 다시 켜세요 (서버가 직접 내줌)
- 탄흔 위치: 유니티가 탄마다 표적 앞면 좌표(`HasFace`, `FaceX`, `FaceY`)를 보내면 결과 창과 똑같은 자리, 안 보내면 채점 좌표로 계산한 자리 (1~2px 차이)
- 검은 원(7~10점) 위의 탄흔은 검은 바탕에 묻히지 않도록 구멍 가장자리를 밝게 그립니다 (흰 바탕 탄흔은 결과 창 그대로)
- 사진 모양이 바뀌는 업데이트를 받은 뒤에는 서버를 끄고 이미 저장된 사진을 다시 만듭니다: `sudo $(which node) --import tsx src/scripts/photos.ts`

**집계 규칙 (요약)**

- 유니티 탄창 하나 = 화면의 세션 하나 = 1회차. 쏜 거리의 cm 그대로 (25m 환산 없음), 합격 기준은 ⌀5cm · 편차 2.5cm
- 실내 영점 표적(`IndoorTargetScore`)에서 탄창을 다 쏜 세션만 집계. 실외·중간 정지 세션은 원본만 저장하고 사격 배치 화면에 "집계 제외"로 표시
- 명중 3발 미만은 실패로 세고 탄착군은 `-`
- 레이더 5개 지표 기준값은 `backend/src/domain/metrics.ts` 의 `METRIC_THRESHOLDS`. 바꾼 뒤에는 서버를 끄고 `pnpm recompute`
- `pnpm recompute` 는 원본(`raw/`)은 있는데 대시보드에 빠진 세션(상태 저장 실패 등)도 미배정으로 되살립니다 → 사격 배치 화면에서 사람 지정
- 관리자 로그인은 같은 주소에서 5번 틀리면 5분 동안 잠깁니다
- `/api/session` 은 인증이 없습니다. 군번만 알면 `/api/me/:id` 에서 세션 Id 를 볼 수 있으므로, 실제 훈련에 쓰기 전에는 `INGEST_KEY` 를 켜고 유니티가 `X-Ingest-Key` 헤더를 보내게 하세요

> EC2는 사용하지 않을 때 반드시 **중지**하세요.

---

## 6. 폴더 구조

```
.
├── README.md
├── trigger_point_dashboard.html     # 초기 단일 HTML 시안
├── docs/superpowers/                # 설계(specs) · 구현 계획(plans)
├── infra/main.tf                    # S3 버킷 Terraform
├── backend/                         # 데이터 서버 (Node + TypeScript + Hono)
│   ├── .env.example
│   ├── src/
│   │   ├── server.ts · bootstrap.ts # 진입점 · .env → 설정 · 저장소 · 상태
│   │   ├── app.ts · auth.ts         # HTTP 라우트 · 관리자 토큰
│   │   ├── repo.ts                  # 상태 변경과 저장 (수신 · 명단 · 배치 · 옮기기)
│   │   ├── domain/                  # 유니티 형식 · 변환 · 지표 · 명단 파싱 · 집계 · 발표용 더미 생성
│   │   ├── photo/ · photos.ts       # 표적 사진 합성 (결과 창과 같은 계산) · 생성 큐 · 임시 주소
│   │   ├── storage/                 # S3 / 로컬 폴더 저장소
│   │   └── scripts/                 # recompute (원본으로 다시 계산) · seed (발표용 더미 넣기·지우기)
│   └── test/                        # vitest (실제 유니티 세션 고정 데이터 포함)
└── frontend/
    ├── CLAUDE.md                    # 프론트엔드 작업 규칙 (AI 에이전트용)
    ├── .env.example
    └── src/
        ├── index.tsx                # 엔트리: 목 모드 어댑터 → 인증 확인 → AppRouter
        ├── api/                     # axios · command · types · config · errors
        ├── components/              # header · layout · ui · dashboard · members · target · user
        ├── constants/               # 합격 기준 · 교정 포인트 · 기간
        ├── hooks/                   # useAsync · useNow
        ├── mocks/                   # 더미 데이터 핸들러 · axios 어댑터 · 시드 데이터 · 집계
        ├── pages/                   # login · admin · platoons · platoonDetail · users · userDetail · me · assignments
        ├── routes/                  # routes.tsx · privateRoute.tsx
        ├── stores/                  # authStore · themeStore · toastStore
        ├── styles/                  # light-theme · dark-theme · theme-utilities
        └── utils/                   # auth · format · chartTheme
```
