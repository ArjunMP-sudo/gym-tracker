# ASCEND — The Training System

Next.js 14 (App Router) fitness tracker. Logs are stored as JSON in a **separate private GitHub repo** through a server-side token. Deploys on Vercel.

## Setup
1. **Data repo:** create a *private* repo (e.g. `fitness-data`) with an initial commit (add a README so `main` exists). Never put it in this app's repo.
2. **Token:** GitHub > Settings > Developer settings > Fine-grained tokens. Repository access: *only* `fitness-data`. Permission: **Contents: Read and write** (nothing else). Set an expiry.
3. **App repo:** `git init && git add . && git commit -m init`, push to GitHub (public or private is fine; no secrets are in it).
4. **Vercel:** Import the app repo. Add env vars (Production + Preview), see `.env.example`: `APP_PASSWORD`, `SESSION_SECRET` (32+ chars), `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH`. Deploy.
5. Open the site, sign in, go to **Settings**, set your height, targets and timezone, and save.

## Local dev
`cp .env.example .env.local`, fill it in, then `npm install && npm run dev`.
Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Data layout (in the data repo)
`profile.json`, `logs/YYYY/MM/YYYY-MM-DD.json`. One commit per explicit "Save day" click. Saves send the file's SHA; if it changed elsewhere you get a conflict error and your edits stay on screen (no silent overwrite).

## Exports
History tab: day, month, and **All-Time History (.txt)**. Every file ends with a `STATUS:` line that says COMPLETE only if all source files were read. Exports read GitHub directly; the data repo itself is also a full backup (clone it).

## Security notes
Single-user password login, signed HttpOnly SameSite=Strict cookie (7 days), `x-requested-with` check on writes, server-side zod validation, best-effort rate limits (in-memory per serverless instance), no-store on API responses. **Rotate:** create a new token, update `GITHUB_TOKEN` in Vercel, redeploy, delete the old token. Change `SESSION_SECRET` to sign everyone out.

## XP rules
See `lib/xp.ts` (`XP_RULES`). XP is recomputed from saved data, so edits can't double-award. No XP for under/over-eating bands, excess water, or too-little sleep.

## Troubleshooting
- "GitHub token is invalid": token expired or revoked. Rotate it.
- "lacks permission": token needs Contents read/write on the data repo.
- Empty repo errors: make an initial commit on the configured branch.
- Rate limit: wait a few minutes. All-time export/dashboard fetch one file per logged day.

## Not yet built
Playwright E2E, TXT import/recovery, light theme, favorites/saved meals, workout templates, achievements/weekly quests, monthly analytics screen (monthly summary is in the TXT exports), calendar grid view (list view exists).
