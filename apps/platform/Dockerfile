FROM node:22.23.3-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/site-core/package.json ./packages/site-core/
COPY packages/generator/package.json ./packages/generator/
COPY apps/platform/package.json ./apps/platform/
RUN npm ci
COPY packages/site-core ./packages/site-core
COPY packages/generator ./packages/generator
COPY apps/platform/tsconfig.json ./apps/platform/
COPY apps/platform/src ./apps/platform/src
COPY apps/platform/scripts ./apps/platform/scripts
COPY library ./library
COPY collections ./collections
COPY starters ./starters
COPY plans ./plans
COPY contracts/site ./contracts/site
COPY LICENSE ./
RUN npm run build -w @a2aviary/site-core && npm run check -w @a2aviary/site-core \
    && npm run check:static -w @a2aviary/generator && npm run build -w @a2aviary/generator \
    && npm run check -w a2aviary-platform && npm run build -w a2aviary-platform
RUN npm prune --omit=dev

FROM node:22.23.3-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/site-core/package.json ./packages/site-core/
COPY --from=build /app/packages/site-core/src ./packages/site-core/src
COPY --from=build /app/packages/generator/package.json ./packages/generator/
COPY --from=build /app/packages/generator/dist ./packages/generator/dist
COPY --from=build /app/apps/platform/package.json ./apps/platform/
COPY --from=build /app/apps/platform/dist ./apps/platform/dist
COPY apps/platform/migrations ./apps/platform/migrations
COPY --from=build /app/plans ./plans
COPY --from=build /app/contracts/site ./contracts/site
COPY LICENSE ./
WORKDIR /app/apps/platform
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
