# コメントの中継と配信の縮小画像（relay/）を1つのファイルにまとめて動かす。deploy/compose.yaml から、リポジトリの根を context に作る
FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY relay ./relay
COPY src/lib ./src/lib
RUN pnpm relay:build

FROM node:24-alpine
# 配信の縮小画像を HLS から撮る（relay/thumbnails.ts）
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY --from=build /app/dist/relay.cjs ./
USER node
CMD ["node", "relay.cjs"]
