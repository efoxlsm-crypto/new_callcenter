# FMCS 헬프데스크 AI 챗봇 — 실행 가이드 (코딩 몰라도 OK)

이 폴더는 HISCO(혁산정보시스템) 헬프데스크 실제 자료(`data/source_교육스크립트.txt` 128개 Q&A +
`data/source_헬프데스크문의사항.pdf`에서 뽑은 신규 18건, 실제 화면 스크린샷 포함)를 학습한
**AI 상담 챗봇**입니다. 체육시설 운영자가 FMCS 프로그램 사용 중 궁금한 점을 채팅으로 물어보면,
AI가 관련 FAQ와 실제 화면 스크린샷을 함께 보여주면서 정리된 형태(한줄요약 → 단계별 안내 →
참고사항)로 답변하고, 동시에 문의를 자동 분류하고 통계를 쌓아줍니다.

## 1. 이게 뭘로 이루어져 있나요? (초기초 설명)

| 폴더/파일 | 역할 | 비유 |
|---|---|---|
| `data/source_교육스크립트.txt` | HISCO 헬프데스크 원본 자료 (텍스트) | 회사가 준 "원본 교육 자료" |
| `data/source_헬프데스크문의사항.pdf` | HISCO 헬프데스크 원본 자료 (PDF, 100p) — 교육스크립트와 겹치지 않는 18건만 `faq.json`에 반영됨 | 또 다른 "원본 교육 자료" |
| `data/faq.json` | 두 원본을 정리한 FAQ 146개 + 이미지 정보 | 상담원이 참고하는 "매뉴얼 책" |
| `data/images/` | 각 FAQ의 실제 화면 스크린샷 | 매뉴얼 속 그림 |
| `scripts/build_faq.py` | 원본 자료를 다시 학습(파싱+이미지 다운로드)하는 스크립트 | 매뉴얼을 새로 편집하는 도구 |
| `scripts/describe_images.py` | 스크린샷 76개를 AI(비전 모델)로 분석해서 한국어 설명을 만들어 `faq.json`에 저장 (1회성) | 그림마다 설명 캡션 달아주기 |
| `backend/knowledge.py` | 질문과 관련된 FAQ(+이미지 설명)를 골라 AI에게 건네주는 역할 | 매뉴얼에서 필요한 페이지만 찾아주기 |
| `backend/ai_client.py` | Anthropic(Claude, AI)에게 질문을 보내고 답을 받는 부분 | 상담원(AI)의 "두뇌" |
| `backend/db.py` | 모든 문의 내역을 기록 | 상담 일지 |
| `backend/predict.py` | 쌓인 기록을 분석해서 예측 | 통계 분석가 |
| `backend/main.py` | API 서버 (화면은 없음, 이미지 파일도 여기서 제공) | 콜센터 건물 자체 |
| `web/` | Next.js로 만든 채팅+대시보드 화면 | 고객이 보는 화면 |

전체 흐름: 고객이 화면(`web/`)에 질문 입력 → API 서버(`main.py`)가 받음 → AI(`ai_client.py`)가
관련 FAQ(`knowledge.py`)를 보고 요약/단계/주의사항으로 정리된 답변 생성 + 참고 화면 스크린샷 첨부 +
자동분류 → 기록 저장(`db.py`) → 화면에 표시. 동시에 대시보드가 쌓인 기록으로 예측(`predict.py`)을
보여줍니다.

### 자료를 새로 업데이트하고 싶다면

`data/source_교육스크립트.txt` 파일을 새 버전으로 교체한 뒤, 아래 명령을 실행하면 FAQ 데이터베이스와
이미지가 통째로 다시 만들어집니다 (이미지는 `helpdesk.hisco.co.kr` 로그인이 필요하며, 로그인 정보는
`.env`의 `HISCO_LOGIN_ID` / `HISCO_LOGIN_PW`에 저장되어 있습니다):

```powershell
cd c:\DATA\documents\ai-callcenter
python scripts\build_faq.py
python scripts\describe_images.py
```

`build_faq.py`가 새 이미지를 받아오면, `describe_images.py`를 이어서 실행해야 그 새 이미지들의
설명이 만들어지고 검색에 반영됩니다 (이미 설명이 있는 이미지는 건너뛰므로 다시 돌려도 새로
추가된 것만 처리합니다).

**서버가 2개로 나뉘어 있습니다**: 백엔드(API, 8000번 포트)와 프론트엔드(화면, 3000번 포트)를
**둘 다** 켜야 정상 작동합니다. 자세한 실행 방법은 4번 항목을 참고하세요.

## 2. 준비물

1. **Python** — 이미 설치되어 있습니다 (버전 3.14 확인됨).
2. **Anthropic(Claude) API 키** — AI를 쓰기 위한 "출입증"입니다.
   - https://console.anthropic.com 에 가입 후, 왼쪽 메뉴에서 **API Keys** → **Create Key**
   - 생성된 키(`sk-ant-...`로 시작)를 복사해두세요. (이 키는 비밀번호처럼 다른 사람에게 노출하면 안 됩니다.
     특히 챗봇이나 채팅창에 붙여넣지 마세요 — 대화 기록에 남습니다.)
   - 참고: 사용량만큼 과금됩니다. 이 챗봇은 기본적으로 가장 빠르고 저렴한 모델(`claude-haiku-4-5`,
     100만 토큰당 입력 $1.00 / 출력 $5.00)을 쓰도록 설정되어 있습니다. 설정 화면에서 언제든
     다른 Claude 모델(sonnet, opus 등)로 바꿀 수 있습니다.
3. **Neon(Postgres) 데이터베이스** — 문의 기록을 저장하는 곳입니다 (SQLite에서 이전됨).
   - https://neon.tech 에서 무료로 가입 후 프로젝트를 만들면 연결 주소(connection string)를 줍니다.
   - 자세한 절차는 8번 "배포하기" 항목을 참고하세요.

## 3. API 키 / DB 설정하기

`ai-callcenter` 폴더에 이미 `.env` 파일이 준비되어 있습니다 (`.env.example`을 복사해서 만든 것).
메모장으로 열어서 값을 채우고 저장하세요.

```powershell
notepad .env
```

`.env` 파일 내용 예시:
```
ANTHROPIC_API_KEY=sk-ant-여기에실제키
ANTHROPIC_MODEL=claude-haiku-4-5
DATABASE_URL=postgresql://사용자:비밀번호@호스트/디비이름?sslmode=require
```

## 4. 실행하기

⚠️ **서버는 항상 2개(백엔드+프론트엔드)를 "동시에" 켜야 합니다.** 한 창에서 명령을 이어서
치면 안 됩니다 — `uvicorn`이 그 창을 계속 점유해서 다음 명령이 실행되지 않습니다.

### 방법 A — 스크립트로 한 번에 (추천)

`ai-callcenter` 폴더에서 PowerShell을 열고:

```powershell
cd c:\DATA\documents\ai-callcenter
.\run_all.ps1
```

새 창 2개가 자동으로 열리며 각각 백엔드/프론트엔드를 실행합니다. **"실행할 수 없습니다"
같은 보안 오류**가 뜨면, 아래 명령으로 한 번만 실행 정책을 풀어주세요 (관리자 권한 불필요):
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### 방법 B — 직접 창 2개 열기

**첫 번째 창 — 백엔드(API 서버):**
```powershell
cd c:\DATA\documents\ai-callcenter
pip install -r requirements.txt
playwright install chromium
uvicorn backend.main:app --reload --port 8000
```
(`playwright install chromium`은 행정공동망 서비스 중단 공지를 확인하는 기능이 쓰는 브라우저를
한 번만 받아두는 명령입니다 — 이미 받아져 있으면 다시 실행해도 안전합니다.)

**두 번째 창(반드시 새 창!) — 프론트엔드(화면, Next.js):** (처음 한 번만 `npm install` 필요할 수 있음)
```powershell
cd c:\DATA\documents\ai-callcenter\web
npm install
npm run dev
```

---

두 서버가 모두 켜진 상태로, 브라우저에서 **http://localhost:3000** 을 열면 채팅창과 대시보드가
나옵니다. 종료할 때는 각 창에서 `Ctrl + C` (또는 그냥 창을 닫아도 됩니다).

> 참고: 화면(`web/`)은 `http://localhost:8000`의 API를 호출하도록 설정되어 있습니다
> (`web/.env.local`의 `NEXT_PUBLIC_API_URL`). 포트를 바꾸면 이 값도 함께 바꿔야 합니다.

## 5. "예측 서비스"는 정확히 무엇을 하나요? (정직한 설명)

과장 없이 말씀드리면, 아직 실제 통화/문의 이력 데이터가 없는 상태에서 시작하기 때문에
"AI가 미래를 맞춘다"는 것보다는 **"쌓이는 데이터를 실시간으로 통계 내어 미리 알려주는 것"**입니다.
운영을 시작하면 정확도가 점점 올라갑니다.

1. **문의 자동 분류/라우팅** — AI가 질문마다 8개 카테고리(결제/환불, 하드웨어/키오스크,
   강습관리, 회원관리, 시스템/사용자권한, 사물함/대관, 온라인예약/웹, 기타) 중 하나로 즉시 분류합니다.
   지금 바로 동작합니다 (데이터 축적 불필요).
2. **상담량 예측** — 문의가 최소 14건 쌓이면, 요일별/시간대별 평균 문의량을 보여줍니다.
   (예: "화요일에 유독 문의가 많다" 같은 패턴)
3. **장비 고장 사전 예측** — 같은 업장에서 같은 장비(예: IC카드리더기) 문의가 최근 14일 내
   2회 이상 반복되면 "점검 권장" 경고를 띄웁니다. 이는 머신러닝이 아니라 규칙 기반(반복 횟수 감지)
   경고이며, `backend/predict.py`의 `EQUIPMENT_RISK_THRESHOLD` 값으로 민감도를 조절할 수 있습니다.
4. **트렌드/이상 탐지** — 특정 카테고리 문의가 평소보다 급증하거나, 같은 장비 문제가 여러 업장에서
   동시에(48시간 내 3곳 이상) 발생하면 "시스템 전반 장애 의심" 경고를 띄웁니다.
5. **지식 갭 자동 감지** — AI 스스로 확신도가 50% 미만이라고 판단한 답변을 대시보드에 모아
   보여줍니다. 고객이 👎(도움안됨)를 누르지 않아도, FAQ로 커버되지 않는 질문 유형을 미리
   발견할 수 있습니다.

## 6. 다음 단계로 확장하려면

- **카카오톡 채널 연동**: 카카오 i 오픈빌더에서 스킬 서버로 이 서버의 `/chat` API를 연결
- **전화 음성 상담**: Twilio 등 전화 인프라 + 음성-텍스트 변환(STT)을 앞단에 추가해서
  `/chat`을 호출하는 방식으로 확장 가능 (별도 구축 난이도 높음)
- **실제 서비스 배포**: 8번 "배포하기" 항목을 참고하세요 (Neon + GitHub + Render + Vercel).
- **데이터 확인**: 문의 기록은 이제 Neon(Postgres)에 쌓입니다. Neon 대시보드의
  **SQL Editor**에서 `SELECT * FROM tickets ORDER BY created_at DESC;` 같은 SQL로 눈으로 확인할 수 있습니다.

## 7. 문제가 생기면

- "API 키가 없다"는 오류 → `.env` 파일에 키를 제대로 넣었는지, 백엔드 서버를 재시작했는지 확인
- 화면은 뜨는데 대시보드/채팅이 안 됨 → 백엔드(8000번 포트)가 켜져 있는지 확인. 두 서버가
  **동시에** 켜져 있어야 합니다.
- 챗봇이 이상한 답을 함 → `data/faq.json`에 없는 내용은 "사람 상담원 연결 권장"으로 표시되도록
  이미 설계되어 있습니다. 계속 이상하면 `backend/ai_client.py`의 `SYSTEM_HEADER` 지침을 조정하세요.
- `"rate_limit_error"` 오류 (API 사용량 한도 초과) → FAQ가 많아지면 발생할 수 있습니다.
  `backend/knowledge.py`의 `_relevant_faqs()` 함수에서 `top_k` 값(현재 8)을 줄이면 매 요청마다
  보내는 데이터量이 줄어듭니다.
- `DATABASE_URL 환경변수가 없습니다` 오류 → `.env`에 Neon 연결 주소를 넣었는지 확인하세요.

## 8. 배포하기 (Neon + GitHub + Render + Vercel)

지금까지는 내 PC에서만 실행됐다면, 이 단계를 거치면 인터넷 어디서나 접속 가능한 실제 서비스가
됩니다. 4개 서비스를 쓰는데 전부 무료 티어로 시작할 수 있습니다.

| 서비스 | 역할 |
|---|---|
| **Neon** | 문의 기록을 저장하는 데이터베이스 (Postgres) |
| **GitHub** | 코드 저장소 (Render/Vercel이 여기서 코드를 가져감) |
| **Render** | 백엔드(API 서버, `backend/`) 실행 |
| **Vercel** | 프론트엔드(화면, `web/`) 실행 |

### 8-1. Neon(데이터베이스) 만들기

1. https://neon.tech 접속 → 가입(무료)
2. **Create a project** 클릭 → 이름 아무거나 (예: `fmcs-helpdesk`) → 리전은 가까운 곳(Asia)
3. 프로젝트가 만들어지면 대시보드에 **Connection string**이 보입니다.
   `postgresql://...neon.tech/...?sslmode=require` 형태의 주소를 복사하세요.
4. 이 주소를 저에게 전달해주시면(또는 직접 `.env`의 `DATABASE_URL=` 뒤에 붙여넣으면) 연결 준비 끝입니다.

### 8-2. GitHub(코드 저장소) 만들기

1. https://github.com 접속 → 가입(이미 있으면 로그인)
2. 오른쪽 위 **+** → **New repository**
3. Repository name 입력 (예: `fmcs-helpdesk-ai`) → **Private** 선택 (내부 자료가 포함되어 있어 비공개 권장)
4. **Create repository** 클릭 (README, .gitignore 등은 추가하지 않고 빈 저장소로 생성)
5. 만들어진 저장소 페이지의 주소(`https://github.com/사용자명/fmcs-helpdesk-ai.git`)를 저에게 알려주시면,
   제가 지금까지 만든 코드를 그 저장소로 올려드립니다.

### 8-3. Render(백엔드) 배포

1. https://render.com 접속 → GitHub 계정으로 가입/로그인 (연동이 쉬움)
2. **New** → **Web Service** → 방금 만든 GitHub 저장소 선택
3. 설정:
   - **Runtime**: Docker (저장소 루트의 `Dockerfile`을 자동으로 인식합니다)
   - **Instance Type**: Free
4. **Environment Variables**에 아래 값들을 등록:
   - `ANTHROPIC_API_KEY` = (Anthropic 키)
   - `ANTHROPIC_MODEL` = `claude-haiku-4-5`
   - `DATABASE_URL` = (Neon 연결 주소)
   - `HISCO_LOGIN_ID`, `HISCO_LOGIN_PW` = (필요시)
   - `FRONTEND_ORIGIN` = (8-4에서 만들 Vercel 주소 — 나중에 채워도 됩니다)
5. **Create Web Service** → 몇 분 기다리면 `https://xxxx.onrender.com` 같은 주소가 생깁니다. 이게 백엔드 주소입니다.

### 8-4. Vercel(프론트엔드) 배포

1. https://vercel.com 접속 → GitHub 계정으로 가입/로그인
2. **Add New** → **Project** → 같은 GitHub 저장소 선택
3. **Root Directory**를 `web`으로 지정 (중요 — 저장소 전체가 아니라 `web/` 폴더가 Next.js 앱입니다)
4. **Environment Variables**에 등록:
   - `NEXT_PUBLIC_API_URL` = (8-3에서 받은 Render 주소, 예: `https://xxxx.onrender.com`)
5. **Deploy** 클릭 → 몇 분 후 `https://프로젝트명.vercel.app` 주소가 생성됩니다.
6. 이 주소를 다시 Render의 `FRONTEND_ORIGIN` 환경변수에 넣고 재배포하면 CORS(도메인 간 접근 허용)까지
   완전히 연결됩니다.

### 8-5. 확인

`https://프로젝트명.vercel.app`으로 접속해서 로컬에서처럼 채팅/대시보드가 동작하면 배포 성공입니다.
이후 코드를 수정하고 GitHub에 다시 올리면(`git push`), Render와 Vercel이 자동으로 재배포합니다.
