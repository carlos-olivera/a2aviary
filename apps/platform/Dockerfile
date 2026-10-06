FROM node:22.23.3-bookworm-slim AS build
WORKDIR /app/apps/platform
COPY apps/platform/package*.json ./
RUN npm ci
COPY apps/platform/tsconfig.json ./
COPY apps/platform/src ./src
COPY apps/platform/scripts ./scripts
COPY plans /app/plans
COPY contracts/site /app/contracts/site
COPY services/src/site/policy.ts services/src/site/generator.ts services/src/site/types.ts /app/services/src/site/
RUN npm run check && npm run build
RUN npm prune --omit=dev

FROM node:22.23.3-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app/apps/platform
COPY --from=build /app/apps/platform/package*.json ./
COPY --from=build /app/apps/platform/node_modules ./node_modules
COPY --from=build /app/apps/platform/dist ./dist
COPY apps/platform/migrations ./migrations
COPY --from=build /app/plans /app/plans
COPY --from=build /app/contracts/site /app/contracts/site
COPY LICENSE /app/LICENSE
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
