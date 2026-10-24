# Gym Tracker

Next.js 14 fitness tracker for Vercel. Data lives in Upstash Redis (connected from the Vercel dashboard). Single password login.

## Deploy (3 steps)
1. Push this project to GitHub, then import the repo in Vercel.
2. Vercel > your project > **Storage** > Create > **Upstash Redis** (free plan) > Connect to this project. The database env vars are added for you.
3. Vercel > **Settings > Environment Variables**: add `APP_PASSWORD`. Then **Redeploy** (Deployments > ... > Redeploy).

## Local dev
`npm install`, copy the two database values from Vercel into `.env.local` (see `.env.example`), `npm run dev`.
Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Backups
History tab > **Download All-Time History (.txt)**. Each file ends with a `STATUS:` line that says COMPLETE only if every record was read. Download one regularly: the TXT file is your independent backup.

## Security
Signed HttpOnly SameSite=Strict cookie (7 days), writes need a custom header, zod validation on the server, best-effort rate limits, no-store API responses. Change `APP_PASSWORD` and redeploy to sign everyone out.

## Troubleshooting
- "Storage is not connected": do step 2, then redeploy.
- Conflict error on save: the day changed on another device. Reload; your edits stay on screen until you do.
- Never commit `.env.local`.

## Not yet built
TXT import, E2E tests, light theme, saved meals/templates, achievements, monthly analytics screen, calendar grid.
