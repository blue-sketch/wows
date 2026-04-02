# Wolf of Wall Street - Progress Tracker

Last updated: 2026-03-21

This document is the persistent handoff context for future chat sessions.

## Project Status

- Stage: Late implementation + rehearsal hardening.
- Backend/runtime: Functional with Supabase-connected migrations and seed data.
- Frontend: Running in dev mode via Vite, routed through backend proxy.
- Core flows: Trading, admin controls, leaderboard reveal, display bootstrap validated via API drills.
- Production readiness: Strong, with final operator-led browser rehearsal recommended before event-day signoff.

## Baseline and Delta Context

- Primary baseline doc: `WoWS_Final_Balanced.docx` (extracted as `WoWS_Final_Balanced.txt`).
- Execution delta doc: `PLAN.md`.
- Implementation has adopted major PLAN hardening items:
  - persisted market control plane (`MarketState`)
  - append-only operator audit trail (`AdminEvent`)
  - idempotent trade requests (`requestId`)
  - database-authoritative money/valuation paths
  - scripted recovery helpers.

## Key Decisions Made

1. **Same-origin capable backend-first runtime retained**
   - Backend serves built frontend in production (`createApp` static serving path).

2. **Participant-only trading enforced**
   - Admins cannot execute participant trades at route level.

3. **Operational resilience prioritized**
   - Startup script path fixed.
   - Transaction retries expanded for transient Prisma/Supabase failures.
   - Interactive transaction timeouts increased to avoid 5s expiry under latency.
   - Tick loop guarded so one failed tick does not crash the process.

4. **Deployment discipline**
   - Supabase migrations applied via committed migration and `prisma migrate deploy`.
   - Rehearsal checklist added for go/no-go gating.

## Implemented Changes (This Workstream)

### 1) Start command fixed

- File: `package.json`
- Change:
  - `start` updated from `node dist/server/index.js` to `node dist/server/src/server/index.js`.
- Why:
  - Built server output path is rooted under `dist/server/src/server`.

### 2) Participant-only trade guard

- File: `src/server/lib/http.ts`
  - Added `requireParticipant` middleware (401 unauthenticated, 403 non-participant).
- File: `src/server/routes/api.ts`
  - Applied `requireParticipant` to:
    - `POST /api/trade/buy`
    - `POST /api/trade/sell`
- Why:
  - Preserve event fairness and prevent admin-side accidental trading.

### 3) Transaction and tick stability hardening

- File: `src/server/services/tradeService.ts`
  - Added transient failure detection for:
    - `P2028`
    - "Transaction not found"
    - "could not serialize access due to concurrent update"
  - Retries now cover these transient failures in addition to serializable conflicts.
  - Added transaction options:
    - `maxWait: 10000`
    - `timeout: 20000`

- File: `src/server/services/marketService.ts`
  - Added transaction options on market tick:
    - `maxWait: 10000`
    - `timeout: 20000`

- File: `src/server/index.ts`
  - Wrapped interval tick call with safe catch:
    - logs `[market-tick] failed: ...`
    - prevents process crash on tick failures.

### 4) Rehearsal and operations documentation

- File: `DEPLOY_REHEARSAL_CHECKLIST.md`
  - Added full pre-deploy and event rehearsal pass/fail checklist.

## Verification Performed

### Environment and DB

- `.env` validated and Supabase connection confirmed.
- `npm run prisma:deploy` succeeded (migration applied).
- `npm run prisma:seed` succeeded (rounds/stocks/users seeded).

### Build/Test

- `npm test` passed.
- `npm run build` passed.
- `npm start` healthy with `/health` returning DB-connected status.

### API Drills (Multiple passes)

- Auth: admin + participant login OK.
- Round controls: start/end OK.
- News/shock/broadcast OK.
- Halt/resume OK.
- Leaderboard reveal/hide OK.
- Display bootstrap state consistency OK.
- CSV import OK.
- Post-end trading blocked as expected.
- Admin trading blocked (`Participant access required`) as expected.

## Current Runtime for UI Testing

- Dev servers started with:
  - `npm run dev`
- Frontend URL:
  - `http://localhost:5173`
- Backend health:
  - `http://localhost:3000/health` (returns 200)

## Known Remaining Gaps / Recommendations

1. Run one full operator-led browser rehearsal across:
   - participant (desktop + mobile)
   - admin panel timings
   - display/projection readability.
2. Add integration tests for:
   - auth/session persistence after restart
   - trade concurrency under active tick load
   - end-to-end round and reveal workflows.
3. For deployment:
   - ensure env parity on Render/Vercel
   - enable external health monitor (`/health`).

## Session-End Update Rule (Mandatory)

At the end of every development session, append/update:

- Date/time and summary of work completed.
- Files changed.
- Commands/tests run with result.
- New risks discovered and mitigation status.
- Next immediate tasks for the following session.

Do not start a new major task in a future chat without first reading this file.

## Session Update - 2026-03-23 15:42 IST

- Summary:
  - Recovered the app from a dead Supabase `DATABASE_URL` whose host no longer resolved.
  - Installed local PostgreSQL 17 tooling, initialized a local cluster at `/tmp/wows-pg17`, created `wows_dev`, migrated, and reseeded the app database.
  - Updated local `.env` to use `postgresql://postgres@127.0.0.1:5433/wows_dev?schema=public`.
  - Added `.env.example` and README guidance so future local setup starts from a reachable Postgres target.

- Files changed:
  - `README.md`
  - `.env.example`

- Commands/tests run:
  - `node -e "dns.lookup(...db.xqnoujhcpjskmdzbjddo.supabase.co...)"` -> failed with `ENOTFOUND` confirming stale host.
  - `brew install postgresql@17` -> installed.
  - `brew link --overwrite postgresql@17` -> succeeded.
  - `initdb -D /tmp/wows-pg17 -A trust -U postgres` -> succeeded.
  - `pg_ctl -D /tmp/wows-pg17 -l /tmp/wows-pg17.log -o "-p 5433 -h 127.0.0.1" start` -> succeeded.
  - `createdb -h 127.0.0.1 -p 5433 -U postgres wows_dev` -> succeeded.
  - `npm run prisma:deploy` -> succeeded against local DB.
  - `npm run prisma:seed` -> succeeded against local DB.
  - `npm test` -> passed (3 files, 9 tests).
  - `npm run build` -> passed.
  - `curl http://127.0.0.1:3000/health` -> returned `ok: true`.
  - `curl http://127.0.0.1:3000/api/display/bootstrap` -> returned seeded market snapshot.
  - `curl POST http://127.0.0.1:3000/auth/login` with `admin / venturers-admin` -> returned valid admin bootstrap payload.

- Risks / mitigation:
  - The local Postgres cluster currently lives in `/tmp/wows-pg17`, so it is suitable for immediate development and rehearsal recovery but not for durable long-term storage across OS cleanup/reboot.
  - Mitigation: if the team wants persistence, move this to a managed/persistent Postgres data directory or restore a valid Supabase/hosted Postgres URL and rerun migrations/seed as needed.

- Next immediate tasks:
  - Run one browser-level admin/participant/display rehearsal against the repaired local stack.
  - Decide whether local dev should stay on PostgreSQL in `/tmp` or move to a persistent local/service-backed data directory.
