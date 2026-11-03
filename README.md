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
VITE_SERVER_URL=http://127.0.0.1:8080   # 백엔드 API 주소 (목 모드에서는 쓰지 않음)
VITE_USE_MOCK=true                      # 목(더미 데이터) 모드. 기본값 true
```

| `VITE_USE_MOCK`                    | 동작                                                              | 로그인                                                                  |
| ---------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `true` (기본값, 값을 안 줘도 true) | `/api/*` 요청을 브라우저 안에서 더미 데이터로 응답 (`src/mocks/`) | 로그인 화면 아래 **개발자 로그인** 버튼으로 아이디·비밀번호 없이 들어감 |
| `false`                            | `VITE_SERVER_URL/api/*` 실제 서버로 요청                          | 실제 서버의 아이디·비밀번호로 로그인. 개발자 로그인 버튼은 숨겨짐       |

> **실제 배포할 때는 반드시 `VITE_USE_MOCK=false` 로 빌드합니다.** 지금처럼 백엔드 없이 시연할 때만 `true` 를 씁니다.

더미 데이터는 시드가 고정되어 있어서 언제 열어도 같은 군번이면 같은 사람입니다 (날짜는 오늘 기준 최근 30일로 계산).

### API 목록 (백엔드가 맞춰야 할 계약)

타입은 `frontend/src/api/types.ts`, 호출 함수는 `frontend/src/api/command.ts` 에 있습니다.

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

인증은 `Authorization: Bearer <token>` 헤더를 씁니다 (`/api/me/:id` 제외).

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
    [SerializeField] string baseUrl = "http://anchor-edu-01-s3.s3-website.ap-northeast-2.amazonaws.com/web";
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

## 5. 배포 계획 (아직 작업하지 않음)

배포는 **Terraform** 으로 하고, Unity 쪽과 같이 **AWS S3 + EC2** 만 사용합니다. 아래는 계획이며 Terraform 코드는 아직 없습니다.

### 5-1. 구성

| 리소스                     | 용도                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------- |
| EC2 (t3.small, 이미 생성)  | 80: 서버(API), 9080: 개발용 (8000: 클라이언트 호스팅 포트는 S3 웹사이트를 쓰면 비워 둠) |
| S3 버킷 `anchor-edu-01-s3` | 클라이언트 호스팅(정적 웹사이트), 사격 데이터, Unity에서 쓰는 이미지·사운드 등          |

### 5-2. 버킷 폴더 구조 (안)

```
anchor-edu-01-s3/
├── web/            # frontend/dist 빌드 결과
├── raw/            # Unity가 올리는 사격 원본 데이터 (raw/YYYY/MM/DD/<군번>/sNN)
├── reports/        # 생성된 리포트 (PDF · MD · JSON)
└── unity-assets/   # Unity 이미지 · 사운드
```

IAM 역할은 바꿀 수 없으므로 클라이언트는 **S3 정적 웹사이트 호스팅**으로 직접 공개합니다. 대신 버킷 정책으로 **`web/` 경로만** 공개 읽기를 허용하고, `raw/` · `reports/` 같은 사격 데이터는 공개하지 않습니다.

### 5-3. S3 버킷 설정 (콘솔)

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

### 5-4. 배포 흐름 (안)

1. `cd frontend && pnpm build:s3` (`/web/` 경로 기준으로 빌드)
2. `aws s3 sync dist/ s3://anchor-edu-01-s3/web/ --delete` (또는 콘솔에서 `dist/` 안의 파일을 `web/` 에 업로드)
3. 접속 주소: `http://anchor-edu-01-s3.s3-website.ap-northeast-2.amazonaws.com/web/admin`

주의할 점:

- 지금(시연)은 더미 데이터를 쓰므로 `VITE_USE_MOCK=true` 그대로 빌드하면 S3 웹사이트에서도 바로 동작합니다.
- **실제 배포 때는 `VITE_USE_MOCK=false`** 로 빌드하고 EC2의 API 서버(80 포트)를 `VITE_SERVER_URL` 로 연결합니다. S3 웹사이트 주소는 HTTP만 지원합니다.
- 페이지(S3)와 API(EC2)의 주소가 다르므로 API 서버에 CORS 허용(S3 웹사이트 주소)이 필요합니다.
- Unity나 EC2가 `raw/` 에 사격 데이터를 **쓰려면** 별도 자격 증명이 필요합니다. IAM 역할을 쓸 수 없으면 관리자에게 권한을 요청하거나, 그때까지 데이터는 EC2에 저장합니다.

### 5-5. Terraform으로 만들 것 (예정)

- S3 버킷 · 퍼블릭 액세스 차단(위 표대로) · `web/*` 공개 읽기 버킷 정책 · 정적 웹사이트 호스팅
- IAM 역할은 권한이 없어 만들지 않습니다
- 보안 그룹 (80, 8000, 9080). 9080은 허용 IP를 좁혀 둡니다
- 이미 만든 EC2는 `terraform import` 로 가져오기
- 이 저장소에는 접속 정보·비밀번호·액세스 키를 올리지 않습니다 (`*.tfvars` 는 `.gitignore`)

> EC2는 사용하지 않을 때 반드시 **중지**하세요.

---

## 6. 폴더 구조

```
.
├── README.md
├── trigger_point_dashboard.html     # 초기 단일 HTML 시안
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
        ├── pages/                   # login · admin · platoons · platoonDetail · users · userDetail · me
        ├── routes/                  # routes.tsx · privateRoute.tsx
        ├── stores/                  # authStore · themeStore · toastStore
        ├── styles/                  # light-theme · dark-theme · theme-utilities
        └── utils/                   # auth · format · chartTheme
```
