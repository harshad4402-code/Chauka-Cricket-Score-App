# Gully Live
Mobile-first live cricket scorer for gully matches: teams, ball-by-ball scoring, history, tournaments with points table and NRR. Starts empty, no sample data.

## Run
    npm install
    npm start        # http://localhost:3000

Env: `PORT` (default 3000), `DATA_DIR` (default ./data, holds state.json).
Docker: `docker build -t gully-live . && docker run -p 3000:3000 -v gully:/data gully-live`

## Structure
- `server.js`: Express API (`GET/PUT /api/state`, `/api/health`), atomic file writes, security headers
- `lib/core.js`: ownership + merge rules shared by `server.js` and `api/state.js`
- `public/sw.js`: service worker (offline support)
- `public/`: frontend (index.html, styles.css, app.js), no build step

## Notes
- Data saves to the server and is cached in the browser, so scoring continues offline and syncs on the next save.
- One shared dataset per server (no login). Add auth before exposing publicly.

## Performance
Gzip responses, debounced saves, capped undo history, one-time view animations, reduced-motion support.
Layout: bottom bar on phones, sidebar on desktop; dark theme by default with a light toggle.

## Voice and sound
Tap the speaker icon: voice commentary (each over, wickets, fours, sixes, result, player of the match), call every ball, sound effects, language (English India/UK, Hindi), volume and speed. Uses the browser speech engine, so no extra setup; available voices depend on the device.

Update: every ball is spoken; after each over only the runs and wickets of that over (and the score) are spoken. A Voice picker in the speaker settings lets you choose the best voice on your device.

## v5 fixes
- Celebration animations for Wide, No ball, Bye, Leg bye (plus Four, Six, Wicket) with confetti/shake; they still show when the phone has reduced-motion/battery-saver on.
- Commentary now defaults to a woman's voice (Heera/Neerja/Zira/Kalpana/Google etc. picked automatically; pitch raised if the device only has a male voice). Switch Woman/Man or pick a voice in the speaker settings.
- Speech: new ball cancels stale speech, iOS audio unlock on first tap, auto-retry without voice if a voice fails.
- Undo can step back from the start of the 2nd innings; undoing a finished match clears the result.

## Deploy on Vercel
1. Push this folder to GitHub (or run `npx vercel` in it).
2. Vercel -> Add New Project -> import the repo. Framework Preset: **Other**. No build command, leave Output Directory empty (`public/` is served automatically).
3. Deploy. The app works immediately, saving on each device (localStorage).
4. To sync data across devices: Project -> Storage -> Marketplace -> **Upstash Redis** -> create and connect to the project (it adds the env vars automatically), then Redeploy.
Vercel cannot write to disk, so `server.js` (Express) is not used there; `api/state.js` replaces it.

Local run: `npm start` (installs express + compression automatically, then opens http://localhost:3000).
Vercel: package.json intentionally has no dependencies so Vercel serves `public/` + `api/` instead of looking for an Express entrypoint.

## v6: white-screen fix, navigation, live watching, branding
- **Fixed the white screen** on Home -> Ongoing match (and tournament Resume). The handler was named `open`, and inline `onclick` resolves that to `document.open()`, which erases the page. Renamed to `openMatch`.
- **Back/Forward button works.** Every screen has a URL: `#/home`, `#/match/<id>`, `#/watch/<id>`, `#/tour/<id>`, `#/hist`, `#/teams`. Android Back also closes popups (scorecard, sound, share) instead of leaving the app.
- **Live watching.** Every live match has a read-only page at `#/watch/<id>` (no scoring buttons). Use the Share button on the score screen to send the link. Home cards have a Watch button. Devices refresh automatically (every 5s while viewing a live match or Home, every 30s elsewhere, paused when the tab is hidden).
- **Recovery screen** instead of a blank page if anything ever fails, plus a 10s start-up fallback in `index.html`.
- **Offline safety.** Scores entered offline are kept and pushed to the server on the next load. Previously the server copy could overwrite them.
- **Theme is per device** (it used to be saved in the shared data, so one person switching theme changed it for everyone).
- **Fixed** tapping a tournament on Home opened the tournament list instead of that tournament; "Summary copied" showed even when the copy failed.
- **Branding:** new name **Gully Live**, logo, favicon (`.ico`, `.svg`, 16/32 png), Apple touch icon, PWA manifest + maskable icons (Add to Home Screen), social share image, security headers incl. CSP.

### Changing the name
Name: `BRAND` at the top of `public/app.js`, plus `<title>`/meta in `public/index.html`, `name` in `public/manifest.webmanifest`. The logo is a symbol (ball + live dot) so it does not need to change. Keep the storage keys (`gullyscore.v1`) as they are or existing saved matches will disappear.

### Before going public
- Set absolute URLs for `og:image` / `twitter:image` in `index.html` once your domain is final (some apps ignore relative image URLs).
- There is still one shared dataset and no login: anyone with the link can score. Add auth before sharing widely.
- Upstash free tier counts every poll as a command. Live polling is light, but for many simultaneous viewers use a paid plan or raise the interval in `tick()`.

## v7: scorer lock, watch animations, offline, favicon

### Only the scorer can change a match
- Creating a match gives that phone a secret **scorer key** (stored on the device; the server stores only its hash). Only a device holding the key can score, undo, swap, delete or edit that match. Everyone else gets a read-only page: no buttons, "View only" banner. The **server enforces this too**, so editing the page in dev tools does not work.
- Home cards open the read-only page for matches you are not scoring.
- **Let another phone score** (button under the keypad) creates a private link. Whoever opens it becomes a scorer; the key is removed from the address bar. If two phones score at once, the server keeps the newer one and the older phone is told and re-synced (no silent overwrite).
- Saves are now merged per match instead of replacing the whole dataset, so an old or offline phone can no longer wipe other people's matches, and deleted matches cannot come back.
- Matches created before this update have no owner. The first phone that scores one claims it.
- Teams and tournaments are still shared and unlocked (no login). Add auth before sharing widely.

### Watching
- Every ball is sent as an event. Watchers see the **same celebrations, sounds and commentary** as the scorer (Four, Six, Wicket, Wide, No ball, Bye, Leg bye, over, innings break, result).
- The scoreboard no longer jumps: the celebration plays first, then runs and wickets roll to the new value and changed cells flash. Undo and returning to the tab never replay old events.
- Viewers check every 3s (every 6s after 2 quiet minutes), using a tiny "anything new?" request.

### Works without internet
- A service worker caches the app, icons and fonts (now self-hosted, no Google Fonts), so it opens offline after the first visit. Needs HTTPS (Vercel provides it).
- The app opens from saved data instantly and refreshes in the background.
- Scoring offline keeps working; an "Offline" pill shows, and everything syncs automatically (with retry back-off) when the connection returns.
- If phone storage is full the app warns instead of failing silently.

### Favicon
New high-contrast icon (large ball + red LIVE dot) readable at 16px: `favicon.ico` (16/32/48), `favicon.svg`, PNGs, Apple touch icon, maskable PWA icons. Icon links carry `?v=7` so browsers refresh their cached old icon.

### Upgrading notes
- Vercel/Upstash: data migrates automatically from the old single-key format on first request. Upstash usage is roughly one command per viewer check, so many viewers on the free tier can hit limits.
- Bump `V` in `public/sw.js` (and the `?v=` numbers) whenever you change files in `public/`.

## v8: batter selection, mini deck, new UI
- **Choose openers** at the start of every innings (tap the striker, then the non-striker). **After a wicket**, pick the next batter from the players who have not batted yet; he takes the dismissed end. The bowler is picked the same way each over. Nothing is scored until the batters and bowler are set.
- **Mini deck** under the score: striker, non-striker and bowler cards with live runs, balls, 4s/6s, SR, wickets and economy. Watchers see it too ("Selecting…" while the next batter is chosen).
- Scorecard shows **Yet to bat**. Matches already in progress keep working.
- New pitch-green / midnight / amber palette (light and dark), responsive from 320px phones to wide desktop (selection panel sticks beside the score on large screens).

## v9: data safety and secret-key delete

### Data no longer disappears after a restart
- **Root cause:** after a restart the server can answer with empty data (Vercel has no disk; a host without a persistent volume starts blank). The app used to replace its own saved copy with that empty answer. Now, if the server is empty but the device still has data, the app **restores it to the server automatically** (teams, tournaments, and every match this device scored, with its scorer key).
- **Server file storage (`server.js`)**: fsync'd atomic writes, `state.json.bak` (previous good copy), daily snapshots in `data/backups/` (last 14 days), cached reads. A corrupt file is **never treated as empty**: the server recovers from `.bak`, or pauses saving and logs `DATA FILE PROBLEM` instead of overwriting.
- **You must still give the server a persistent disk**: Docker `-v gully:/data`, or on Render/Railway/Fly attach a volume and set `DATA_DIR` to it. Without one, the host deletes the file on every deploy/restart (the device copy then restores it, but do not rely on that).
- **Vercel**: add **Upstash Redis** (Storage -> Marketplace). Without it nothing is stored on the server, only on each device.

### Delete needs a secret key
- Set the env var **`ADMIN_KEY`** to a long random secret (Vercel: Project -> Settings -> Environment Variables, then Redeploy; Docker: `-e ADMIN_KEY=...`).
- With `ADMIN_KEY` set, **a match can only be deleted by entering that key**, from any device, in History (open a match -> "Delete match") or on the result screen. The key is checked **on the server**; the scorer link or dev tools cannot bypass it. The Node server allows 5 wrong tries per IP per 10 minutes.
- Without `ADMIN_KEY`, the old rule applies (only the scorer's phone can delete).
- Deleting needs an internet connection, because the server must check the key.

## v10: player icons and head to head
- Realistic SVG icons (sprite in `index.html`, works offline): batter for striker and non-striker (mirrored, dimmed), bowler, cricket ball, and a bat. They appear on the mini deck and on every player card in the selection panel.
- **Head to head rebuilt**: results are worked out from the actual innings, so old, undone or edited matches always count. Shows wins bar, ties, total runs, highest score, average per innings, last 5 form and recent meetings. Teams can no longer be compared with themselves.
