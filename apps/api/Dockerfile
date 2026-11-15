FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

FROM base AS build
WORKDIR /workspace
RUN npm install --global pnpm@10.34.9
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter api...
COPY apps/api apps/api
RUN pnpm --filter api build
RUN pnpm --filter api build:seed

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /workspace/apps/api/dist ./apps/api/dist
COPY --from=build /workspace/apps/api/dist-seed ./apps/api/dist-seed
COPY --from=build /workspace/apps/api/package.json ./apps/api/package.json
COPY --from=build /workspace/apps/api/prisma ./apps/api/prisma
COPY --from=build /workspace/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --chmod=755 apps/api/scripts/docker-entrypoint.sh /usr/local/bin/ehecatl-api-entrypoint
WORKDIR /workspace/apps/api
USER node
EXPOSE 3001
ENTRYPOINT ["ehecatl-api-entrypoint"]
CMD ["node", "dist/main.js"]
