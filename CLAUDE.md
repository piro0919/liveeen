# Liveeen

A live streaming service where anyone can stream video and voice, in the spirit of TwitCasting.

Nothing is built yet. Everything below was agreed with the owner in a sounding-board session on 2026-10-30 (in the home window; the log is `~/.claude/projects/-Users-piro/82aa99e4-4dfd-414d-8af0-58ec081a5264.jsonl`).

## Why this exists

- The owner wants to build a streaming service. Asked what would make streamers or viewers pick it over TwitCasting, YouTube Live or ふわっち, the owner said there is nothing in particular: "I just want to build it."
- So it is not meant to pay for itself. Monetization (tips, paid items) was ruled out, and the cost is capped instead (see Cost).

## Agreed

- Name: **Liveeen** (read ライブーン), the owner's idea. Romaji names (Utsuru, Imakoko, Mitero) were rejected because the service will go global. English-word names were also rejected: Hearth, Beamo, Wavely, Lumo, Nook, Popin, Busker, Magpie, Lantern, OpenLive, LiveNow, AnyStream. On 2026-10-30 a web search for "Liveeen" found no service with that name; liveeen .com/.io/.tv/.jp had no whois or DNS record (likely free); .app and .live could not be checked from the shell. Trademarks not checked. People who hear "ライブーン" may type the wrong number of e's (a guess, not checked); whether to hold the look-alike domains is open
- Anyone can stream, video and voice
- First version: stream, watch, comment, follow
- No tips and no paid items
- Saving recordings comes in a later version
- Watching needs no sign-in
- Whether signed-out viewers can comment is chosen by the streamer per stream (a signed-out troll can come back under a new name; the streamer's block and IP-based blocking are the defence)
- Streaming from the browser (camera and mic) and from tools like OBS, both
- The top page lists streams that are live now; a streamer's URL also works directly
- Moderation, both of:
  - Viewers report; the owner stops a stream or bans a streamer from an admin screen
  - When reports on a stream reach a threshold, it is removed from the live list automatically (this is the only guard while the owner is asleep)
- Streaming is 18 and over, by self-declaration. Watching has no age limit. Claude recommended 18+ because the operator is one person and the harm to minors (being lured out, leaking where they live) cannot be undone; loosening later is easy, banning existing streamers later is not. The owner first leaned toward allowing minors, then agreed
- Sexual content is forbidden, also between adults. It goes in the terms and is handled by reports and the automatic delisting
- When someone you follow goes live, three ways, each switched on or off by the viewer in settings:
  - They are listed at the top when you open the site
  - Browser notification (on iPhone this reaches only users who added the site to the home screen; not rechecked)
  - Email
- Latency: the streamer chooses per stream between low latency (WebRTC; heavier on the server, so a lower viewer cap) and higher latency but light (HLS). MediaMTX converts one input into both, per its README
- Video quality is capped at 720p for now
- First version is for Japan (Japanese screens). Build so other languages can be added later; overseas comes in a later version. Before going overseas, check each country's rules for streaming platforms (not researched), and plan for reports arriving while the owner is asleep
- Sign-in is Google only (no passwords to keep, harder to mass-create throwaway accounts)
- The owner does not want to use Japanese companies' services (rejected さくらのVPS for that reason)

## Cost

- Cap: **¥50,000 a month**. When the month's viewing reaches the cap, new viewers cannot start watching. The owner: "I can't pay hundreds of thousands of yen."
- Infrastructure: **Akamai (formerly Linode), Tokyo**, running our own relay (MediaMTX is the candidate). The owner picked it over Cloudflare Stream for the experience of building the streaming part.

What was compared on 2026-10-30 (unit prices from each vendor's official pages; the per-viewer-hour column is Claude's calculation assuming about 1.1 GB per viewer-hour, not measured):

| Option                       | Ingest              | Delivery                                                                           | Per viewer-hour |
| ---------------------------- | ------------------- | ---------------------------------------------------------------------------------- | --------------- |
| Cloudflare Stream            | free                | $1 per 1,000 minutes                                                               | $0.06           |
| Mux                          | $0.03125 per minute | 100,000 min/month free, then $0.001/min                                            | $0.06           |
| AWS IVS                      | $0.20–2.00 per hour | HD in Japan $0.092/hour                                                            | $0.092          |
| Akamai (Linode), Tokyo/Osaka | —                   | overage $0.005/GB                                                                  | ~$0.0055        |
| Hetzner, Singapore           | —                   | 0.5–5 TB included, then $8.49/TB                                                   | ~$0.009         |
| Vultr, Tokyo                 | —                   | overage $0.01/GB                                                                   | ~$0.011         |
| DigitalOcean, Singapore      | —                   | overage $0.01/GiB                                                                  | ~$0.011         |
| OVHcloud, Singapore          | —                   | no overage; throttled to 10 Mbps after the monthly quota (quota differs by source) | capped          |

At ¥150 per dollar (not checked), ¥50,000 is about 5,500 viewer-hours on Cloudflare Stream, or about 60,000 viewer-hours of Akamai transfer before the server's own monthly fee.

## Where things run

Decided 2026-10-30. The owner left the choice to Claude ("まかせる").

- Web app: Next.js on Vercel, functions in **sin1**. Same setup as vocafy (Better Auth with Google, `pg`)
- DB: Neon, **Singapore** (no Tokyo region; the region cannot be changed later)
- Media: MediaMTX on Akamai Tokyo
- Live comments: a small WebSocket relay on the same Akamai server, because Vercel functions cannot hold long-lived connections
- Locally, `compose.yaml` runs MediaMTX (same version as production) and Postgres. Run `pnpm db:up`, `pnpm migrate`, then `pnpm dev` on port 3000 (MediaMTX asks it about every publish and read)

## How publishing is checked

- MediaMTX uses `authMethod: http` and asks `/api/media/auth` on every publish and read (`src/lib/media-auth.ts`)
- Each streamer has one channel (`channel` table). The channel id is the MediaMTX path; the stream key is stored as SHA-256
- Publish passes only when the key matches that channel: WHIP Bearer token, RTMP `?key=` after the path, or RTMP password
- The key is shown only when it is created or reset (Claude's call, since only the hash is stored; the owner has not seen the screen yet)
- The browser cannot hold the key, so `/broadcast` gets a 10-minute signed token from a server action (`src/lib/media-token.ts`, `MEDIA_TOKEN_SECRET`). Credentials containing `.` are treated as tokens; stream keys never contain `.`
- Read passes for anyone (watching needs no sign-in). Admin stop and the monthly cap are not wired in yet
- Checked locally on 2026-10-30 with ffmpeg over RTMP: wrong key and no key get 401, the right key publishes

## The broadcast screen (`/broadcast`)

- Sign in → declare 18+ (checkbox) → the channel is created and the key shown → OBS settings (RTMP and WHIP) and browser streaming
- The UI is plain and has not been shown to the owner. Wording and layout are provisional
- Google sign-in is not set up yet (no OAuth client). `.env.local` has placeholder Google ids; local checks used a session row and a hand-signed `better-auth.session_token` cookie
- Browser streaming asks for H264 Constrained Baseline (`42e01f`) first. With Chrome's first H264 entry (Baseline `42001f`), Chrome on this Mac encoded about 10 frames with VideoToolbox and stopped; `42e01f` and High `640034` kept going. Without any preference Chrome sends VP8, which HLS cannot carry
- Checked 2026-10-30 in Chrome (window off screen, fake camera): create channel → stream → MediaMTX has Opus + H264 → HLS plays → stop removes the stream. HLS showed 640×360 that time although the camera gave 1280×720; Chrome lowers the size on its own, cause not checked. Not checked with a real camera, Safari, or a phone

## Latency choice and the watch screen (`/<channel id>`)

- The streamer picks the latency on `/broadcast` (`channel.latency_mode`: `hls` default, or `low`). It applies to viewers from their next connection
- The watch screen plays `low` with WebRTC (WHEP) and `hls` with HLS (hls.js; Safari plays HLS natively). No sign-in. When nothing is live it shows 配信していません and retries every 5 s
- The streamer's URL is `/<channel id>` for now (random id). Handles or nicer URLs are not decided
- Checked 2026-10-30 in Chrome with ffmpeg over RTMP: HLS and WebRTC both play 1280×720; HLS notices a stream starting and ending within seconds. WebRTC took about 16 s after the stream ended to show 配信していません (the connection has to fail first). Over RTMP, WebRTC viewers get no sound (AAC; see below). Not checked in Safari or on a phone

## The top page (`/`)

- Lists the channels that are live now, newest first, each linking to `/<channel id>`. The label is the streamer's display name (the channel id for channels made before names existed) and the start time in Japan time
- Whether a channel is live comes from MediaMTX's API (`GET /v3/paths/list`, `ready: true`) on every request (`src/lib/live.ts`, `MEDIA_API_URL`), not from a table. Claude's call: it cannot drift from what is really streaming. Paths that are not registered channels are dropped
- If MediaMTX does not answer within 3 s, the page shows the empty list (いま配信している人はいません)
- In production the web app on Vercel has to reach MediaMTX's API on Akamai. How to protect it is not decided (locally `authHTTPExclude` lets the API through without asking the site)
- Checked locally on 2026-10-30 with ffmpeg over RTMP: the channel appears while streaming, the empty message shows after it stops, and the page still opens when MediaMTX is stopped

## Display names

- Everyone picks the name shown on the live list and on comments; the owner chose this on 2026-10-31. The Google account name is never shown, because it is often a real name
- Stored in the `profile` table, not in Better Auth's `user` table. Names need not be unique
- Up to 20 characters counted as they look (an emoji sequence is one), no line breaks or control characters (`src/lib/display-name.ts`; Claude's call)
- `/broadcast` asks for a name before anything else when there is none. `/settings` changes it (it holds only the name for now)
- Checked 2026-10-31 in Chrome with the local test user: 21 characters is refused, a valid name opens the broadcast setup, and the top page lists the stream under that name

## What the local MediaMTX showed (2026-10-30, v1.21.2)

- RTMP in (ffmpeg standing in for OBS, 720p H264 + AAC) → HLS out: plays in the browser
- RTMP in → WebRTC out: video only. MediaMTX logs `skipping track 2 (MPEG-4 Audio)`; it does not transcode, and WebRTC cannot carry AAC. For the low-latency mode, OBS users need OBS's WHIP output (Opus), or the server transcodes the audio. Not decided
- Browser in (WHIP) → HLS out: plays. MediaMTX's built-in publish page picks AV1 by default; our publish page asks for H264 (see the broadcast screen)

## Not decided or not checked

- Akamai's monthly server price for the plan we need
- How many viewers one server can serve, per latency mode (measure on the server)
- The report threshold for automatic delisting
- OBS over RTMP in low-latency mode: ask for WHIP, or transcode the audio on the server
- Whether liveeen.app / .live are free; trademarks
- How the production web app authenticates to MediaMTX's API

Sources:

- https://developers.cloudflare.com/stream/pricing/
- https://www.mux.com/pricing
- https://aws.amazon.com/ivs/pricing/
- https://www.linode.com/docs/guides/network-transfer/
- https://www.hetzner.com/cloud-singapore/
- https://docs.vultr.com/support/platform/billing/what-is-the-bandwidth-overage-rate
- https://docs.digitalocean.com/platform/billing/bandwidth/
- https://www.ovhcloud.com/en/vps/vps-singapore/
- https://github.com/bluenviron/mediamtx
