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

- Domain: **liveeen.kkweb.io**, chosen by the owner on 2026-10-31 for the site, the media server (**media.liveeen.kkweb.io**, left to Claude by the owner on 2026-10-31; chosen because it matches `MEDIA_HOST` and the earlier example) and the email sender. On 2026-10-31 Vercel showed liveeen.com, .app, .live, .tv, .io and .jp all free (liveeen.com $11.25 a year); none was bought
- Web app: Next.js on Vercel, functions in **sin1**. Same setup as vocafy (Better Auth with Google, `pg`)
- DB: Neon, **Singapore** (no Tokyo region; the region cannot be changed later)
- Set up on 2026-10-31 after the owner said 「ok」 to it:
  - Vercel project `liveeen` in team kkweb, made with `vercel project add`; framework set to nextjs and functions to sin1 through the API (`resourceConfig.functionDefaultRegions`), as vocafy needed. Not linked to the GitHub repository yet
  - Neon `liveeen-db-sin` through Vercel's Neon integration (`vercel integration add neon -m region=sin1 -m auth=false --no-env-pull`), Free plan; it put `DATABASE_URL` and the others on all environments. Migrations up to 0015 were applied with `DATABASE_URL_UNPOOLED` from `vercel env pull`
  - Domain liveeen.kkweb.io is on the project and verified: CNAME `liveeen` → `588121aaa12811d4.vercel-dns-016.com` (DNS only) and TXT `_vercel` with its `vc-domain-verify` value in kkweb.io's Cloudflare zone (196 of 200 records afterwards)
  - Production env on Vercel: the auth values, the media and relay URLs (see the production media server), the secrets shared with the media server, `ADMIN_EMAILS` and `VAPID_SUBJECT` with the owner's Gmail address, a new VAPID pair, `RESEND_API_KEY` (Resend key `liveeen production`, sending only, limited to liveeen.kkweb.io), `EMAIL_FROM=Liveeen <liveeen@liveeen.kkweb.io>`, `AKAMAI_API_TOKEN` (personal access token `liveeen view cap (Vercel)`: Account read only, everything else no access, no expiry), `MEDIA_SERVER_FEE_USD=5`, `YEN_PER_USD=150` (Claude's placeholder; the owner sets it)
  - Deployed to production on 2026-10-31 by the owner, who ran `vercel deploy --prod --scope kkweb --yes` in VSCode's terminal (Claude Code's permission check refuses production deploys, also after the owner's 「ok」; `!` in the VSCode extension does not run a command). The deploy was made from `git archive HEAD` with `.vercel` copied in, so untracked files were not sent. Not linked to GitHub, so each deploy is done this way
  - Checked 2026-10-31 after the deploy: `/`, `/broadcast`, `/settings` gave 200, `/admin` 404 when signed out; sign-in returns Google's URL with the production redirect URI. Signing in with Google in production was not tried
- Media: MediaMTX on Akamai Tokyo
- Live comments: a small WebSocket relay on the same Akamai server, because Vercel functions cannot hold long-lived connections
- Locally, `compose.yaml` runs MediaMTX (same version as production) and Postgres. Run `pnpm db:up`, `pnpm migrate`, then `pnpm dev` on port 3000 (MediaMTX asks it about every publish and read), and `pnpm relay` for comments (port 8090)

## How publishing is checked

- MediaMTX uses `authMethod: http` and asks `/api/media/auth` on every publish and read (`src/lib/media-auth.ts`)
- Each streamer has one channel (`channel` table). The channel id is the MediaMTX path; the stream key is stored as SHA-256
- Publish passes only when the key matches that channel: WHIP Bearer token, RTMP `?key=` after the path, or RTMP password
- The key is shown only when it is created or reset (Claude's call, since only the hash is stored; the owner has not seen the screen yet)
- The browser cannot hold the key, so `/broadcast` gets a 10-minute signed token from a server action (`src/lib/media-token.ts`, `MEDIA_TOKEN_SECRET`). Credentials containing `.` are treated as tokens; stream keys never contain `.`
- Publish is refused for a channel the owner has banned, whatever the key or token (`channel.banned_at`)
- Read passes for anyone (watching needs no sign-in) until the monthly cap is reached (see the monthly cap)
- Checked locally on 2026-10-30 with ffmpeg over RTMP: wrong key and no key get 401, the right key publishes

## Design rules

- The model is **YouTube** (the owner on 2026-10-31: not TwitCasting, otherwise left to Claude, "simple is fine"; Claude picked YouTube over Twitch as the simpler one and looked at youtube.com's live page and a live watch page signed out). The owner said 「ok」 to the top page and watch page built from it
- Colors are YouTube's light and dark values, as named tokens in `src/app/globals.css` (`background`, `foreground`, `muted`, `surface`, `surface-hover`, `line`, `accent`, `live`, `danger`). Light or dark follows the device. Components use the token names only, never hex values or Tailwind's palette
- Buttons, inputs, cards, headings and notes come from `src/lib/ui.ts`: pill buttons (`primaryButton` black like チャンネル登録, `tonalButton` grey like 登録済み, `signInButton` outlined blue like YouTube's ログイン), `card` for a group on `/broadcast`, `/settings` and `/admin`
- `test/design-rules.test.ts` fails on hex colors, Tailwind palette colors, `rounded-full` outside `ui.ts` and the avatar, and the old `rounded border px-` buttons. Each check was seen failing on a planted line
- Every page has the header (`src/components/site-header.tsx`): Liveeen on the left; signed out, ログイン on the right; signed in, 配信する (where YouTube has 作成) and the person's mark linking to `/settings`. There is no sign-out yet
- A person's mark is the first character of their display name in a circle (`src/components/avatar.tsx`), not the Google photo, which can show a face or real name (Claude's call)
- The top page shows 16:9 cards with a red ライブ tag, the mark, the name and the start time. There are no stream thumbnails (MediaMTX does not make images), so the card shows the name's first character large
- The watch page puts the player and the streamer row (mark, name, @handle, フォローする, 通報する at the right) on the left and the comments panel on the right at the same height; on narrow screens they stack. Not-live and over-the-cap messages show in the middle of the black player. On a phone width 通報する wraps to its own line

## The broadcast screen (`/broadcast`)

- Sign in → declare 18+ (checkbox) → the channel is created and the key shown → OBS settings (RTMP and WHIP) and browser streaming
- Wording is provisional. Each part is a card (see Design rules)
- Google sign-in: Google Cloud project `liveeen` (made 2026-10-31, billing account kk-web attached by default), OAuth client `liveeen-web`, redirect URIs `https://liveeen.kkweb.io/api/auth/callback/google` and `http://localhost:3000/api/auth/callback/google`. The consent screen is External and still **in testing**: only test users can sign in (now `piro.haniwa@gmail.com`). Publishing it needs a privacy policy URL, and the site has no privacy policy page. The client secret is in this Mac's Keychain as `liveeen-google-client-secret`; the first secret was disabled because it showed up in a session log. `.env.local` still has placeholder Google ids; local checks used a session row and a hand-signed `better-auth.session_token` cookie
- Browser streaming asks for H264 Constrained Baseline (`42e01f`) first. With Chrome's first H264 entry (Baseline `42001f`), Chrome on this Mac encoded about 10 frames with VideoToolbox and stopped; `42e01f` and High `640034` kept going. Without any preference Chrome sends VP8, which HLS cannot carry
- Checked 2026-10-30 in Chrome (window off screen, fake camera): create channel → stream → MediaMTX has Opus + H264 → HLS plays → stop removes the stream. HLS showed 640×360 that time although the camera gave 1280×720. Measured again 2026-10-31 (fake camera, stats every 5 s for 40 s): Chrome sends 640×360 for the first ~5 s with `qualityLimitationReason: bandwidth` while it is still estimating the bandwidth, then 1280×720 with no limitation for the rest. This is WebRTC's normal start, so nothing was changed. Not checked with a real camera, Safari, or a phone

## Latency choice and the watch screen (`/<channel id>`)

- The streamer picks the latency on `/broadcast` (`channel.latency_mode`: `hls` default, or `low`). It applies to viewers from their next connection
- OBS over RTMP in low-latency mode is handled by telling the streamer, not by transcoding (the owner left it to Claude's recommendation on 2026-10-31; transcoding would need the video too because of B-frames, and costs server CPU). While `low` is chosen, the OBS section of `/broadcast` says to stream with WHIP from OBS 30 or later, because over RTMP viewers get no sound and, depending on the video settings, no picture (wording provisional). OBS's WHIP output sends Opus and sets B-frames to 0 itself (`plugins/obs-webrtc/whip-service.cpp`, checked 2026-10-31; WHIP arrived in OBS 30.0.0 per its release notes). Not checked with a real OBS
- Checked 2026-10-31 in Chrome: the note shows while `low` is chosen, disappears on switching to HLS, comes back on switching to `low`, and each state stays after a reload
- The watch screen plays `low` with WebRTC (WHEP) and `hls` with HLS (hls.js; Safari plays HLS natively). No sign-in. When nothing is live it shows 配信していません and retries every 5 s
- The streamer's URL is `/@<handle>` (see Handles). A channel whose streamer has not picked a handle yet is at `/<channel id>`
- Checked 2026-10-30 in Chrome with ffmpeg over RTMP: HLS and WebRTC both play 1280×720; HLS notices a stream starting and ending within seconds. WebRTC took about 16 s after the stream ended to show 配信していません (the connection has to fail first); since 2026-10-31 the page asks the server when Chrome reports `disconnected` (the same rule as the broadcast screen, `src/lib/whep.ts`), and it showed 配信していません 6.8 s after ffmpeg ended (measured locally). Over RTMP, WebRTC viewers get no sound (AAC; see below). Not checked in Safari or on a phone

## The top page (`/`)

- Lists the channels that are live now, newest first, as cards (see Design rules), each linking to `/@<handle>`. The label is the streamer's display name (the channel id for channels made before names existed) and the start time in Japan time
- Whether a channel is live comes from MediaMTX's API (`GET /v3/paths/list`, `ready: true`) on every request (`src/lib/live.ts`, `MEDIA_API_URL`), not from a table. Claude's call: it cannot drift from what is really streaming. Paths that are not registered channels are dropped
- If MediaMTX does not answer within 3 s, the page shows the empty list (いま配信している人はいません)
- In production the web app on Vercel reaches MediaMTX's API through Caddy, which asks for `MEDIA_API_SECRET` as a Bearer token (see the production media server). Locally `authHTTPExclude` lets the API through and no secret is needed
- Checked locally on 2026-10-30 with ffmpeg over RTMP: the channel appears while streaming, the empty message shows after it stops, and the page still opens when MediaMTX is stopped

## Display names

- Everyone picks the name shown on the live list and on comments; the owner chose this on 2026-10-31. The Google account name is never shown, because it is often a real name
- Stored in the `profile` table, not in Better Auth's `user` table. Names need not be unique
- Up to 20 characters counted as they look (an emoji sequence is one), no line breaks or control characters (`src/lib/display-name.ts`; Claude's call)
- `/broadcast` asks for a name before anything else when there is none. `/settings` changes it
- Checked 2026-10-31 in Chrome with the local test user: 21 characters is refused, a valid name opens the broadcast setup, and the top page lists the stream under that name

## Handles

- Agreed with the owner on 2026-10-31 (Claude proposed the details; the owner chose 「この案で作る」):
  - The streamer's URL is `/@<handle>`. The old `/<channel id>` redirects there (not permanently, because handles can change)
  - Lowercase letters, digits and `_`, 3 to 20 characters. Uppercase input is lowercased (`src/lib/handle.ts`)
  - `/settings` can change it. The old `/@<handle>` stops working
  - `/broadcast` asks for it right after the display name, also for channels that already exist
  - Names of the site's own paths cannot be used: `admin`, `api`, `broadcast`, `settings`
- Stored in `profile.handle` (unique, `db/migrations/0012_handle.sql`), next to the display name, because it is asked before the channel is created. Another person's handle gets このハンドルはほかの人が使っています
- `/settings` shows the handle field only to users who already picked one on `/broadcast` (Claude's call; viewers have no use for it). Wording of the field is provisional
- Links on the top page, the admin screen, browser notifications and emails use `/@<handle>` (`channelPath`)
- Checked 2026-10-31 in Chrome with local users: too short and reserved handles are refused with the reason, ` Test_Piro` is saved as `test_piro`, another user cannot take it, `/<channel id>` redirects to `/@test_piro`, `/@TEST_PIRO` opens the channel, the top page links to `/@test_piro`, a viewer without a handle has no handle field in `/settings`, and after changing it the old handle gives 404 and the new one 200

## Comments

- Shown under the player on `/<channel id>`. Everyone can read them. Writing needs sign-in and a display name, unless the streamer allows signed-out comments
- Signed-out comments: a checkbox on `/broadcast` (`channel.guest_comments`, off by default; the default is Claude's call, matching what was there before). When on, a signed-out viewer types a name on the watch screen (same rules as display names), the browser remembers it, and the server gives a token with a fresh `guest:<uuid>` id. Their comments show （ゲスト） after the name (the owner chose this on 2026-10-31, because names need not be unique and a guest could take a regular viewer's name; wording provisional). The relay sets `guest` on each comment from the token's `guest:` id (`isGuestId`, `src/lib/comment.ts`). Checked 2026-10-31 in Chrome: a guest and a signed-in viewer both named 見る人 show as 見る人（ゲスト） and 見る人 in both windows
- Turning it off reaches viewers when they reconnect. The page reconnects with a new token a minute before the token's 10 minutes run out, and the relay checks the expiry on every post (closing with code 4001 so the page reconnects at once), so a guest already connected can write for at most about 10 minutes after it is turned off
- The relay is `relay/` (Node and `ws`), run on the Akamai server next to MediaMTX (see the production media server). Viewers connect to `NEXT_PUBLIC_COMMENT_RELAY_URL/<channel id>`
- The relay has no DB and no sign-in. The web app gives signed-in viewers with a name a 10-minute signed token (`src/lib/comment-token.ts`, `COMMENT_TOKEN_SECRET`, the same value on both sides) carrying the user id and the name; the relay checks only the signature, the channel and the expiry, once when connecting. A renamed user keeps the old name until they reconnect
- Comments are not saved (the owner confirmed this on 2026-10-31; decide again when reports on comments or recordings are built). Claude's calls on the details: the relay keeps the last 50 per channel in memory and sends them to whoever joins; one line, up to 200 characters (line breaks become spaces); one post per second per connection
- Checked 2026-10-31 in Chrome with the local test user and a signed-out window: the signed-out window shows the sign-in prompt and no input, a comment reaches it with the name, a second post within a second is refused, a window opened later sees the earlier comment
- Checked 2026-10-31 in Chrome: the checkbox starts off and stays on after a reload; with it on, a signed-out window picks a name, its comment reaches the signed-in window, and the name is remembered after a reload; after turning it off and reloading, the signed-out window shows the sign-in prompt and no input
- Not built yet: reporting comments

## Blocking commenters

- Agreed with the owner on 2026-10-31 (Claude proposed it; the owner chose 「この案で作る」):
  - On their own watch page the streamer sees ブロック next to each comment; it asks for confirmation first
  - A blocked person cannot comment on that streamer's channel, but can still watch
  - A signed-in person is blocked by account and by IP at once; a guest, who can come back under a new name, by IP
  - It takes effect at once, and the person's earlier comments disappear from everyone's screen
  - Nobody sees the IP, the streamer included
  - `/broadcast` lists the blocked people (name and time) with 戻す
  - It applies to that streamer's channel only; blocking site-wide is not built
- Stored in `comment_block` (`db/migrations/0015_comment_block.sql`, `src/lib/blocks.ts`). The IP is kept only as an HMAC with `COMMENT_TOKEN_SECRET` (`src/lib/ip-key.ts`), IPv6 by its first 64 bits because one line gets a whole /64. The IP comes from `x-forwarded-for`, which Vercel overwrites so it cannot be spoofed (https://vercel.com/docs/headers/request-headers#x-forwarded-for)
- How it reaches the relay (Claude's call): the comment token now carries the IP key and whether the holder is the channel's streamer. The relay attaches a signed author token to each comment for the streamer only; the streamer's page sends it to `blockCommenterAction`, which stores the block, then to the relay, which removes the person's comments (`remove`), closes their connections (code 4003) and refuses tokens made before the block for the next 10 minutes. After that, the web app gives them no token (`commentTokenAction` answers `blocked`) and the page shows この配信者のチャンネルではコメントできません (wording provisional). 戻す works from the next token
- Someone on the same IP as the streamer is blocked by account only, both in the relay and in the table, so the streamer's household is not blocked with them. A guest on the streamer's IP therefore cannot be blocked (Claude's call)
- IP blocking also catches others behind the same address, such as a mobile carrier's shared IPs (not measured)
- Checked 2026-10-31 in Chrome with two local users (both on the same local IP, so the block was by account): the viewer saw no ブロック button; after the streamer blocked them, their comment disappeared from both windows, their input was replaced by the sentence, and it stayed after a reload; `/broadcast` listed 見る人 with the time; after 戻す and a reload the viewer could comment again. Blocking by IP, and guests, are covered only by the relay tests (`test/relay.test.ts`), not checked in a browser

## Follow

- A button under the player on `/<channel id>` (フォローする / フォロー中). Signed-out viewers get the button too; pressing it starts sign-in. Your own channel has no button, and the DB insert also refuses following yourself
- All three ways to hear that someone you follow went live are built: listed at the top, browser notifications, email. On the top page, followed channels that are live get their own フォロー中 group under the 配信中 heading, above the rest
- `/settings` has the switch for it (`notification_setting.list_on_top`). On by default (Claude's call); a user with no row gets the default

## Browser notifications

- Web Push with VAPID (`web-push`), no third-party service. Checked 2026-10-31 on the official pages: Firebase lists Cloud Messaging (Chrome's push service) as "No-cost" (https://firebase.google.com/pricing); WebKit says "You don't need to join the Apple Developer Program to send Web Push notifications" (https://webkit.org/blog/12945/meet-web-push/)
- `/settings` has このブラウザに通知する. It is per browser, off until turned on (the browser asks for permission). Turning it on registers `public/sw.js` and stores the browser's push endpoint in `push_subscription`; turning it off deletes it. If the browser blocks notifications or has no Web Push, the switch is replaced by a sentence saying so
- Sent when a publish passes `/api/media/auth`, after the response (`after()`), to followers with an endpoint (`src/lib/notify.ts`, `src/lib/push.ts`). MediaMTX's `runOnReady` cannot be used: the official image holds only the `mediamtx` binary and its config (checked 2026-10-31), so it has no curl to call the site
- Not resent if the channel was notified less than 10 minutes before (`channel.notified_at`; Claude's call), so OBS reconnecting does not notify again. This covers email too. Endpoints that answer 404 or 410 are deleted
- The text is 〈name〉 さんが配信を始めました / タップして見る (provisional); clicking opens `/<channel id>`
- Needs `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:…`). Without them the switch is hidden and nothing is sent. Production needs a key pair made with `npx web-push generate-vapid-keys` and the owner's contact address; locally `.env.local` has a pair and a placeholder address
- Checked 2026-10-31 in Chrome (window off screen, persistent profile, real FCM): turning it on stores the endpoint and stays on after a reload; a publish (ffmpeg over RTMP, and a direct call to the auth endpoint) shows the notification with the streamer's name; a second publish within 10 minutes shows none; turning it off removes the endpoint. When Chrome lost the permission, FCM refused the endpoint and it was deleted. Not checked: Safari, Firefox, iPhone home-screen apps (iPhone may also need a web app manifest; not checked), clicking the notification
- Checked 2026-10-31 in Chrome with two local test channels live and a viewer user: following moves that channel into フォロー中 and the button stays フォロー中 after a reload; turning the switch off puts it back in the plain list; the owner sees no button; signed-out viewers see フォローする; unfollowing puts it back

## Email when someone you follow goes live

- Sent through **Resend**, on the owner's existing account (team kk-web, Pro plan: $20 a month for 50,000 emails, checked on the billing screen 2026-10-31). The owner chose it on 2026-10-31 because the account already exists. Compared with Amazon SES ($0.10 per 1,000) on the official pricing pages
- `/settings` has メールで知らせる (`notification_setting.email`). **Off by default** (Claude's call: no email nobody asked for). It goes to the Google address used to sign in
- Sent at the same moment as browser notifications and under the same 10-minute rule (`src/lib/email.ts`). Plain text only: subject 〈name〉 さんが配信を始めました, the stream's URL, and how to stop it with the link to `/settings` (wording provisional). Resend's batch API, 100 per request, one request at a time (the default limit is 10 requests per second per team)
- Needs `RESEND_API_KEY`, `EMAIL_FROM` and `BETTER_AUTH_URL` (the links are made from it). Without them the switch is hidden and nothing is sent. `EMAIL_FROM` contains `<` `>`, so quote it in `.env.local`
- Locally `.env.local` has a sending-only key named `liveeen local`, limited to kkweb.io, and sends from `Liveeen <liveeen@kkweb.io>`. **Production sends from `liveeen.kkweb.io`**, added to Resend on 2026-10-31 (region Tokyo, ap-northeast-1) and shown as verified there the same day. Its records went into kkweb.io's DNS on Cloudflare by hand, not through Resend's Cloudflare auto-configure (which would give Resend access to the zone): TXT `resend._domainkey.liveeen` (DKIM), CNAME `rsend.liveeen` → `rsend-apne1.forge.rmta.net` and CNAME `send.liveeen` → `send.forge.rmta.net`, both DNS only. Receiving is off. kkweb.io used 192 of its 200 DNS records afterwards (196 after the media server and the site). Production's key and `EMAIL_FROM` were set on Vercel on 2026-10-31 (see where things run)
- One-click unsubscribe (RFC 8058), added 2026-10-31: each email carries `List-Unsubscribe: <…/api/email/unsubscribe?token=…>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. The token is the user id signed with `BETTER_AUTH_SECRET` under its own purpose prefix, with no expiry (`src/lib/unsubscribe-token.ts`; Claude's call). A POST turns メールで知らせる off without sign-in; a GET only redirects to `/settings`, because mail scanners open links. The email body still links to `/settings` too
- Checked 2026-10-31 locally with curl: GET redirected and left the setting on, a wrong token got 400, the right token got 200 and turned it off. Not checked: a real email in Gmail (whether it shows the unsubscribe link)
- Checked 2026-10-31: turning the switch on stays on after a reload; a publish sent one email that reached piro.haniwa@gmail.com's inbox (not spam). Local test users have `@example.invalid` addresses; one email went to `u2@example.invalid` by mistake during the check, so point a test user at a real address before turning email on for it

## Reports and automatic delisting

- The owner left the threshold to Claude on 2026-10-31 (「まかせる」). What Claude chose:
  - A stream leaves the top page (the フォロー中 group too) once **3 different signed-in users** have reported it (`DELIST_THRESHOLD`, `src/lib/delist.ts`). The watch page still works by its URL
  - Only signed-in users can report, one report per person per stream. Without sign-in one person could report again and again and remove someone else's stream
  - Reports count per stream: a stream is told apart by its start time (MediaMTX `readyTime`). Starting a new stream starts from zero and puts it back on the list. Stopping a streamer for good is left to the owner's admin screen
- A 通報する button sits next to フォローする on the watch page. It opens a choice of reasons with 通報する and やめる (choosing and sending replaces the old confirmation dialog); signed-out viewers are sent to sign-in; the streamer sees no button. A report while nothing is live is refused (配信していないので通報できません)
- The reporter picks one reason (the owner chose this on 2026-10-31): 性的な内容, 暴力・危険な行為, 嫌がらせ・差別, その他 (`src/lib/report-reason.ts`, `report.reason`; the list and wording are provisional). Reports made before this have no reason. The admin screen shows the counts per reason after the total, e.g. 通報 2（性的な内容 1・その他 1）
- Checked 2026-10-31 in Chrome with local users: the four reasons show, sending without a reason keeps the choice open, やめる closes it, the button stays 通報しました after a reload, and the admin screen showed 通報 2（性的な内容 1・その他 1）
- Checked 2026-10-31 in Chrome with two local test channels live and three local users: the stream stayed listed after the first and second reports and left the list after the third; reporting twice counts once; the owner sees no button; after restarting the stream it was listed again

## The admin screen (`/admin`)

- Opens only for users whose Google email is in `ADMIN_EMAILS` (comma separated). Everyone else gets 404, as if the page did not exist. Production needs the owner's address there; locally it is the test user `u4@example.invalid`
- Lists live streams, most-reported first, with the report count and (一覧から外した) at the threshold; delisted streams are included. Each has two buttons, both asking for confirmation:
  - 配信を止める: cuts the stream's connection through MediaMTX's API (`/v3/rtmpconns/kick/…` or `/v3/webrtcsessions/kick/…`). The streamer can reconnect at once (OBS reconnects on its own)
  - 配信者を止める: sets `channel.banned_at` and cuts the stream. Publishing is refused from then on, and the channel leaves the live list
- 止めた配信者 lists banned channels with 戻す, which clears `banned_at`
- Checked 2026-10-31 locally: a non-admin gets 404; 配信を止める cut an RTMP stream (ffmpeg) and a browser (WHIP) stream, and ffmpeg could reconnect afterwards; 配信者を止める cut the stream, publishing again was refused, and after 戻す it was accepted
- When the server closes a browser (WHIP) stream, `/broadcast` stops the camera, goes back to ブラウザで配信する and shows 配信が切れました (wording provisional; `src/lib/whip.ts`). Chrome reports the connection `disconnected` about 7 s after the cut and `failed` about 10 s after that (measured 2026-10-31). On `disconnected` the page asks the server whether the stream is still on MediaMTX (`publishingAction`); if it is not, it ends then. If the server cannot tell, it waits for `failed`, so a brief network wobble does not end the stream. Measured locally: noticed 7.3 s and 7.8 s after 配信を止める's kick. Not checked: a real network wobble that recovers, Safari, phones. OBS streams are not affected (OBS shows its own state)

## What the local MediaMTX showed (2026-10-30, v1.21.2)

- RTMP in (ffmpeg standing in for OBS, 720p H264 + AAC) → HLS out: plays in the browser
- RTMP in → WebRTC out: H264 with B-frames is refused (`WebRTC doesn't support H264 streams with B-frames`, seen 2026-10-31 with ffmpeg's libx264 defaults; test with `-bf 0`). Whether OBS's default x264 settings use B-frames is not checked; if they do, OBS over RTMP cannot be watched in low-latency mode at all
- RTMP in → WebRTC out: video only. MediaMTX logs `skipping track 2 (MPEG-4 Audio)`; it does not transcode, and WebRTC cannot carry AAC. For the low-latency mode, OBS users need OBS's WHIP output (Opus); `/broadcast` tells them so (see the latency section)
- Browser in (WHIP) → HLS out: plays. MediaMTX's built-in publish page picks AV1 by default; our publish page asks for H264 (see the broadcast screen)

## The production media server (`deploy/`)

- Written 2026-10-31 when the owner said to handle the open items (「全部対応を」). The layout is Claude's call. Deployed on 2026-10-31 (below)
- Deployed: the repository (`git archive HEAD`) is in `/opt/liveeen` on the server, with Docker from get.docker.com; `deploy/.env` has `MEDIA_HOST=media.liveeen.kkweb.io` and `SITE_URL=https://liveeen.kkweb.io`. `MEDIA_API_SECRET` and `COMMENT_TOKEN_SECRET` were made with `openssl rand -hex 32` and are kept in this Mac's Keychain as `liveeen-media-api-secret` and `liveeen-comment-token-secret` (account `liveeen`); the web app on Vercel needs the same values. To update, send the repository again and run `docker compose up -d --build` in `/opt/liveeen/deploy`
- DNS: A and AAAA records for `media.liveeen.kkweb.io` in kkweb.io's Cloudflare zone, DNS only (RTMP and UDP cannot go through Cloudflare's proxy). The zone uses 194 of 200 records afterwards
- Checked 2026-10-31 from this Mac: Caddy obtained a Let's Encrypt certificate; the API gave 401 without or with a wrong secret and 200 with it, also over IPv6 (401 without); the WebSocket got the relay's empty history; RTMP 1935 is reachable
- After the site was deployed, MediaMTX could not ask `/api/media/auth`: `tls: failed to verify certificate: x509: certificate signed by unknown authority`, because the official image has no CA certificates. `deploy/compose.yaml` now mounts the server's `/etc/ssl/certs/ca-certificates.crt`. Checked 2026-10-31: an RTMP publish with a wrong key then got 401 from the site (`server replied with code 401`). A publish with a real key has not been tried in production
- The server exists since 2026-10-31: `liveeen-media` on Akamai, region JP Tokyo 2 (ap-northeast), Nanode 1 GB ($5 a month as shown on the create screen; 1 CPU, 1 GB RAM, 25 GB disk, 1 TB transfer, 1 Gbps out), Ubuntu 24.04, disk encrypted, no backups. IPv4 172.105.196.199, IPv6 2400:8902::2000:14ff:fe85:fb09. The owner chose the cheapest plan to start (「まずは一番安いのから」); raise it after measuring the load. Tokyo 2 and Tokyo 3 showed the same prices; Tokyo 2 was Claude's pick because it is an older core region, so its transfer is expected to count in the global pool (not stated in Akamai's docs)
- The Akamai account was made on 2026-10-31 by the owner with Google sign-in (`piro.haniwa@gmail.com`). SSH as root with `~/.ssh/id_rsa`; the root password is in this Mac's Keychain as `liveeen-media-root`
- Cloud Firewall `liveeen-media` is attached: inbound policy drop, accepting TCP 22, 80, 443, 1935 and UDP 8189 from anywhere; outbound accept
- One Akamai server runs `deploy/compose.yaml`: MediaMTX (same version as local), the comment relay, and Caddy, all with `network_mode: host` so WebRTC's UDP needs no port mapping, all `restart: unless-stopped`. Values go in `deploy/.env` (`deploy/.env.example`): `MEDIA_HOST`, `SITE_URL`, `MEDIA_API_SECRET`, `COMMENT_TOKEN_SECRET`. Start with `docker compose up -d --build` in `deploy/`
- Open to the internet directly: RTMP (1935) and WebRTC media (UDP 8189). HLS, WHIP/WHEP, the API and the relay listen on 127.0.0.1 behind Caddy, which takes TLS for `MEDIA_HOST` (Let's Encrypt) and routes by request: `/v3/*` → API only with `Authorization: Bearer <MEDIA_API_SECRET>` (else 401); WebSocket upgrades → relay; `/<id>/whip` and `/<id>/whep` (and what follows) → WebRTC; everything else → HLS. Routing by path prefix was avoided because MediaMTX answers WHIP/WHEP with a `Location` starting at `/`
- Why Caddy checks the API secret rather than MediaMTX's `authMethod: http`: that would add a round trip from MediaMTX to the site on every API call, and the top page calls the API on every request
- The relay is bundled into one file by `pnpm relay:build` (esbuild, CommonJS; the ESM bundle fails on `ws`'s `require('events')`) inside `deploy/relay.Dockerfile`. `RELAY_HOST` sets the listen address
- The web app then needs `MEDIA_API_URL=https://<MEDIA_HOST>`, `MEDIA_API_SECRET`, `NEXT_PUBLIC_MEDIA_HLS_URL` and `NEXT_PUBLIC_MEDIA_WEBRTC_URL` = `https://<MEDIA_HOST>`, `NEXT_PUBLIC_COMMENT_RELAY_URL=wss://<MEDIA_HOST>`, `NEXT_PUBLIC_MEDIA_RTMP_URL=rtmp://<MEDIA_HOST>:1935`, and for the monthly cap `AKAMAI_API_TOKEN`, `MEDIA_SERVER_FEE_USD`, `YEN_PER_USD`
- Checked 2026-10-31 on this Mac (Caddy in Docker with `MEDIA_HOST=localhost` and `UPSTREAM_HOST=host.docker.internal` in front of the local MediaMTX and relay): the API gave 401 without or with a wrong secret and 200 with it; HLS played an ffmpeg stream; WHEP decoded frames and its `Location` DELETE answered 200; the WebSocket got the relay's history. `deploy/mediamtx.yml` loaded in MediaMTX 1.21.2 without errors. Not checked: on Linux with host networking, real certificates, the web app calling the API with the secret end to end, RTMP from outside

## The monthly cap

- Built 2026-10-31 after the owner said 「続きを」. How the month's cost is measured is Claude's call:
  - This month's cost = the media server's monthly fee + the transfer billed beyond the included pool × $0.005 per GB, converted to yen (`src/lib/view-cap.ts`). Once it reaches ¥50,000, `/api/media/auth` refuses every new read; publishing still passes
  - The billed transfer is `billable` from Akamai's API (`GET /v4/account/transfer`, in GB, https://techdocs.akamai.com/linode-api/reference/get-transfer). With `AKAMAI_REGION` set, the entry for that region is used instead, since some newer regions keep their own pool (https://techdocs.akamai.com/cloud-computing/docs/network-transfer-usage-and-costs). On 2026-10-31, with the Tokyo 2 server running, the API answered `{"used": 1, "quota": 33, "billable": 0, "region_transfers": []}`, so Tokyo 2 counts in the global pool and `AKAMAI_REGION` stays unset
  - The last value is kept in `transfer_usage` (one row) and read again from Akamai when it is older than 5 minutes; if Akamai does not answer, the old value is used. If none was ever read, the cap is not applied
  - Needs `AKAMAI_API_TOKEN` (read access to the account is enough), `MEDIA_SERVER_FEE_USD` and `YEN_PER_USD`. Without any of them the cap is not checked (as locally). The fee is 5 for the Nanode, and the exchange rate is a value the owner sets
- MediaMTX asks only when someone starts watching, so people already watching are not cut. The watch page shows 今月の視聴の上限に達したため、いまは見られません instead of the player (wording provisional)
- How often Akamai updates `billable` is not stated in its docs, so the cap can lag behind the real transfer by that much (not measured)
- Checked 2026-10-31 locally with a hand-written `transfer_usage` row and placeholder values in `.env.local`: under the cap a read got 200 and over it 401, while publish got 200; an HLS viewer (ffmpeg) watching when the cap was reached kept receiving all 45 s; a new HLS viewer got 401 (200 again after going back under); a new WHEP viewer got 401 instead of passing the check. Not checked against Akamai's real API

## Not decided or not checked

- How many viewers one server can serve, per latency mode (measure on the server)
- Trademarks

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
