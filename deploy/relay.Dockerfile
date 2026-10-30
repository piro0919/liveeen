# コメントの中継（relay/）を1つのファイルにまとめて動かす。deploy/compose.yaml から、リポジトリの根を context に作る
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY relay ./relay
COPY src/lib ./src/lib
RUN pnpm relay:build

FROM node:24-alpine
WORKDIR /app
COPY --from=build /app/dist/relay.cjs ./
USER node
CMD ["node", "relay.cjs"]
