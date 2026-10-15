# Katori

A nutrition tracker for Indian plates. Log rotis, dal, sabzi and curd in seconds, see which food groups your
plate is missing, and build a streak one counted day (3+ meals) at a time.

- **Public site:** splash with rotating fitness quotes, feature tour, Google sign-in
- **App:** onboarding, Today, Diary, Compare (food groups first, then nutrients and your plan), Progress, Profile + data export
- **AI Assist** (Gemini, admin-toggleable): photo → meal, plain-words logging, a tailored plan, a daily coach line.
  Every result is a suggestion you confirm.
- **Admin:** food catalogue, splash quotes + tour, users and roles, AI Assist switch, limits and usage

Nutrition values are estimates. Katori does not give medical advice.

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
