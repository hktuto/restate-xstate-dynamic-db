FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate

RUN apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

WORKDIR /app

# Copy workspace manifests and lockfile for a cacheable install layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/admin/package.json ./apps/admin/
COPY apps/health-monitor/package.json ./apps/health-monitor/
COPY apps/web/package.json ./apps/web/
COPY apps/workflow-runtime/package.json ./apps/workflow-runtime/
COPY layers/workflow-editor/package.json ./layers/workflow-editor/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/workflow-actions/package.json ./packages/workflow-actions/

RUN pnpm install --frozen-lockfile

# Copy only the source needed for the health-monitor service.
COPY packages/shared ./packages/shared
COPY packages/db ./packages/db
COPY apps/health-monitor ./apps/health-monitor

WORKDIR /app/apps/health-monitor

CMD ["bun", "src/index.ts"]
