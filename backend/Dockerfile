# Build from the repository root: docker build -f backend/Dockerfile .
FROM node:24-alpine AS build
ENV MONGOMS_DISABLE_POSTINSTALL=1 PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch --frozen-lockfile
COPY packages/shared/package.json packages/shared/
COPY backend/package.json backend/
RUN pnpm install --frozen-lockfile --offline --filter backend...
COPY packages/shared packages/shared
COPY backend backend
RUN pnpm --filter @hrrl/shared build && pnpm --filter backend build
RUN pnpm --filter backend deploy --prod --legacy /out

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/package.json ./package.json
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /repo/backend/dist ./dist
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node
EXPOSE 3000
CMD ["node", "dist/main"]
