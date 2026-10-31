# Liveeen

> Live streaming for anyone — go live with your camera, or just your voice and a picture, from the browser or OBS.

https://liveeen.kkweb.io

## ✨ Features

- 🎥 Stream from the browser with your camera, or with your voice over a still picture — no camera needed
- 🖥 Stream from OBS over RTMP or WHIP
- ⚡ Pick per stream between low latency (WebRTC) and light, higher-latency delivery (HLS)
- 💬 Live comments, with slow mode, blocked words, followers-only comments, moderators and blocking
- 🔔 Follow streamers and hear when they go live: at the top of the page, as a browser notification, or by email
- 🎵 Mix background music into a browser stream
- 🚩 Reports, with streams delisted automatically after several reports, and an admin screen
- 👀 Watching needs no sign-in; streaming is for adults (18+), signed in with Google
- 💴 A monthly cost cap: when the month's viewing reaches it, new viewers wait until next month

## 🛠 Tech Stack

- Next.js (App Router) + React + TypeScript, Tailwind CSS, next-intl
- Better Auth (Google sign-in)
- PostgreSQL (Neon in production)
- MediaMTX for RTMP, WebRTC (WHIP/WHEP) and HLS, behind Caddy
- A small WebSocket relay for comments (`relay/`)
- Vercel for the site; one Akamai (Linode) server in Tokyo for media and comments (`deploy/`)

## 🚀 Development

```bash
pnpm install
cp .env.example .env.local
pnpm db:up      # local Postgres and MediaMTX (compose.yaml)
pnpm migrate    # apply db/migrations/
pnpm dev        # http://localhost:3000 (MediaMTX asks it about every publish and read)
pnpm relay      # comments, on port 8090
```

To try a stream without a camera:

```bash
ffmpeg -re -f lavfi -i testsrc=size=1280x720:rate=30 -c:v libx264 -preset veryfast -bf 0 -g 60 \
  -f flv "rtmp://localhost:1935/<channel id>?key=<stream key>"
```

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm knip
pnpm test       # Vitest
pnpm build
```

## 📄 License

[MIT](LICENSE)
