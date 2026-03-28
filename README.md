# AI DB 설계 툴

자연어 대화로 DB 스키마를 설계하는 Next.js 기반 웹 툴입니다.

## 주요 기능

- **자연어 → 스키마 생성** — AI와 대화하여 DB 스키마(JSON)를 설계
- **ERD 시각화** — React Flow 기반 ERD 자동 렌더링
- **DDL 생성 및 편집** — MySQL · PostgreSQL · SQLite 등 DDL 출력, 직접 편집 후 스키마 역파싱
- **문서 업로드** — PDF · Word(.docx) · 텍스트 파일을 분석해 스키마 초안 생성
- **스키마 검증** — FK 참조 오류, 중복 컬럼 등 자동 검사
- **멀티 프로젝트** — 로그인 후 여러 설계 프로젝트를 독립 관리
- **실행 취소** — 최대 20단계 스키마 변경 이력 보존

## 기술 스택

- **프레임워크** — Next.js 15 (App Router), TypeScript, Tailwind CSS
- **AI** — Anthropic Claude / OpenAI GPT (선택 가능)
- **ERD** — @xyflow/react + @dagrejs/dagre
- **DB** — PostgreSQL (`pg`)
- **문서 파싱** — pdf-parse, mammoth

## 시작하기

### 사전 요구사항

- Node.js 20+
- PostgreSQL (로컬 또는 클라우드)

### 환경 변수 설정

`.env.local` 파일을 생성하고 아래 값을 입력합니다.
```bash
cp .env.example .env.local
```

```env
# PostgreSQL 연결 문자열
DATABASE_URL=postgresql://유저명:비밀번호@localhost:5432/db_designer

# AI API 키 (둘 중 하나 이상 필요)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

### 설치 및 실행

```bash
npm install
npm run dev
```

http://localhost:3000 에서 확인합니다.

앱을 처음 실행하면 DB 테이블이 자동으로 생성됩니다.

## Docker로 실행

### 개발 환경 (PostgreSQL 포함)

```bash
docker compose up
```

`.env.local`의 AI API 키가 컨테이너 안에서 그대로 사용됩니다.
`DATABASE_URL`은 `docker-compose.yml`에 이미 설정되어 있습니다.

### 프로덕션 빌드

```bash
docker build -t db-designer .

docker run -p 3000:3000 \
  -e DATABASE_URL=postgresql://... \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  db-designer
```

## 배포 (Vercel 기준)

1. Vercel에 레포지토리 연결
2. 환경 변수 설정 (`DATABASE_URL`, `ANTHROPIC_API_KEY` 등)
3. 배포

PostgreSQL은 [Neon](https://neon.tech), [Railway](https://railway.app) 등 서버리스 PostgreSQL 서비스를 사용할 수 있습니다.

## 프로젝트 구조

```
app/
  page.tsx                  # 메인 페이지
  api/
    chat/                   # AI 대화 API
    upload/                 # 문서 업로드 API
    parse-ddl/              # DDL 파싱 API
    users/                  # 사용자 조회/생성
    projects/               # 프로젝트 CRUD
    migrate/                # localStorage → DB 마이그레이션

components/
  ChatPanel.tsx             # 채팅 UI
  SchemaPanel.tsx           # 스키마 뷰어 (ERD/테이블/JSON/DDL/검증)
  ERDView.tsx               # ERD 시각화
  LoginModal.tsx            # 로그인 모달
  ProjectSidebar.tsx        # 프로젝트 사이드바

hooks/
  useSchemaChat.ts          # 채팅 + 스키마 상태 관리 (DB 연동)
  useProviderSettings.ts    # AI 제공자 설정

lib/
  db.ts                     # PostgreSQL CRUD 함수
  callLLM.ts                # AI 호출 추상화 (Anthropic / OpenAI)
  generateDDL.ts            # SchemaJSON → SQL DDL
  validateSchema.ts         # 스키마 검증
  schemaDiff.ts             # 스키마 변경 감지
  erdLayout.ts              # ERD 자동 레이아웃 (dagre)
  types.ts                  # 공통 타입 정의
```
