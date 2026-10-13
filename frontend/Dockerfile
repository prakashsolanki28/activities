# Build from the repository root: docker build -f frontend/Dockerfile .
FROM node:24-alpine AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch --frozen-lockfile
COPY packages/shared/package.json packages/shared/
COPY frontend/package.json frontend/
RUN pnpm install --frozen-lockfile --offline --filter frontend...
COPY packages/shared packages/shared
COPY frontend frontend
RUN pnpm --filter @hrrl/shared build && pnpm --filter frontend build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/frontend/build/client /usr/share/nginx/html
EXPOSE 80
