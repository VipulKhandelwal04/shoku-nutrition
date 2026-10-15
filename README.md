# Shoku Nutrition

Production: https://shoku-nutrition.vercel.app

A nutrition tracker for Indian plates. Log rotis, dal, sabzi and curd in seconds, see which food groups your
plate is missing, and build a streak one counted day (3+ meals) at a time.

- **Public site:** splash with rotating fitness quotes, feature tour, Google sign-in
- **App:** onboarding, Today, Diary, Compare (food groups first, then nutrients and your plan), Progress, Profile + data export
- **AI Assist** (Gemini, admin-toggleable): photo → meal, plain-words logging, a tailored plan, a daily coach line.
  Every result is a suggestion you confirm.
- **Admin:** food catalogue, splash quotes + tour, users and roles, AI Assist switch, limits and usage

Nutrition values are estimates. Shoku does not give medical advice.

## Stack

Next.js 16 (App Router) · Supabase (Postgres + RLS, Google OAuth, Storage) · Gemini via `@google/genai` · Vercel.
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + publishable key (and GEMINI_API_KEY for AI Assist)
npx supabase link --project-ref <your-ref>
npx supabase db push         # applies supabase/migrations
npm run dev
```

Make yourself admin before your first sign-in (SQL editor):

```sql
insert into private.admin_emails (email) values ('you@example.com');
```

## Checks

```bash
npm run typecheck && npm test && npx eslint . && npx next build
```

Photo credits: see [CREDITS.md](CREDITS.md).

## Deploying the review security fixes

Migration `20261015000018_review_security.sql` and the matching application must be rolled out together.
The preview shares the production database: obtain the owner's confirmation before applying the migration.
This PR does not apply it or change deployment secrets.

1. Configure `SUPABASE_SERVICE_ROLE_KEY` on the server alongside `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET`.
   Never give it a `NEXT_PUBLIC_` prefix. Only the Strava credential RPC client uses this privileged key.
2. Pause AI Assist and Strava imports during the coordinated rollout, then apply the migration and deploy this code.
   The migration revokes the old token RPCs and direct AI usage inserts, so the old application is not compatible.
3. Re-enable the features and verify Google sign-in, Strava connect/sync/disconnect, AI suggestions, and week Undo.
   Existing Strava connections and usage history remain in place; no reconnection is required.

The migration enforces active accounts with restrictive RLS, rejects new auth users while signups are closed,
reserves AI quota atomically before generation, protects Strava credentials from browser JWTs, and restores
weeks transactionally. Unfinished profiles cannot complete onboarding while signups are closed, regardless of age.
Failed/cancelled model calls consume their reserved quota; invalid requests and non-AI coach fallbacks do not.
Strava backlogs resume in batches of up to 15 activities without advancing the completed-sync watermark early.

`npm test` includes an isolated PGlite PostgreSQL suite that applies every migration to a minimal Supabase
platform scaffold and checks RLS, signup enforcement, function permissions, quota reservations, and restore
rollback. It does not connect to the shared database. PGlite has one backend; production multi-connection lock
contention and live OAuth/provider behavior still need deployment smoke checks.
