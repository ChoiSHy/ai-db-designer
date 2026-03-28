# ── Stage 1: 의존성 설치 ─────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: 빌드 ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 빌드 시 더미 DB URL (실제 연결 없이 타입 체크/빌드만)
ENV DATABASE_URL=postgresql://postgres:password@localhost:5432/db_designer

RUN npm run build

# ── Stage 3: 런타임 ──────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# standalone 출력물만 복사 (최소 이미지)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
