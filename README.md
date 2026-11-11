# Chauka
Mobile-first gully cricket scorer: teams, ball-by-ball scoring, history, tournaments with points table and NRR. Starts empty, no sample data.

## Run
    npm install
    npm start        # http://localhost:3000

Env: `PORT` (default 3000), `DATA_DIR` (default ./data, holds state.json).
Docker: `docker build -t chauka . && docker run -p 3000:3000 -v gully:/data chauka`

## Structure
- `server.js`: Express API (`GET/PUT /api/state`, `/api/health`), atomic file writes, security headers
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
