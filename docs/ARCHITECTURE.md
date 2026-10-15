# Katori architecture

Katori is a nutrition tracker for Indian plates with a Cult-inspired look: black, one hot-pink accent
(`--accent: #ff3f6c`), Barlow Condensed uppercase display type over Inter. Voice: punchy, motivating, **never shaming**.

## Stack
- **Next.js 16 App Router** (TypeScript, `src/`). `proxy.ts` (not middleware) refreshes the Supabase session and
  redirects signed-out visitors away from `/app`, `/onboarding`, `/admin`. Cache Components is off.
  Read `node_modules/next/dist/docs/` before using any Next API: v16 has breaking changes
  (`cookies()`/`params`/`searchParams` are async, `proxy.ts`, `LayoutProps<'/route'>`/`PageProps<'/route'>` globals).
- **Supabase**: Google OAuth, Postgres with RLS on every table, private `meal-photos` storage bucket.
  Schema: `supabase/migrations/`. Server code uses `createClient()` from `@/lib/supabase/server` (runs as the user).
  There is **no service-role key** in the app; admin powers come from RLS `is_admin()` and `admin_*` SQL functions.
- **Gemini** via `@google/genai`, server-side only (`GEMINI_API_KEY`, model from `GEMINI_MODEL`, default
  `gemini-flash-latest`). Structured JSON output; results are matched to the food catalogue and confirmed by the user.

## Product flow
1. `/` public home: splash (rotating quote from `quotes`) → Cult-style landing + feature tour (`tour_slides`) → "Continue with Google".
2. `/login` → Google OAuth → `/auth/callback` → `/onboarding` (first time) → `/app`.
3. `/app` Today · `/app/diary` · `/app/compare` · `/app/progress` · `/app/profile`.
4. `/admin` (role = admin): foods, content (quotes + tour), users, AI (limits, flags, usage).

## Rules that apply everywhere
- No demo data. Empty states teach the next action.
- A day counts toward the streak at **3+ meals logged** (`dayCounts`, `streakInfo`). "Done for the day" is optional.
- Compare leads with **food groups** (`groupStatus`). While a day is open, shortfalls read "so far", never "low".
- Every mutation shows feedback; destructive or bulk actions offer **Undo** (`useToast()(msg, { undo })`).
- Accessibility: 44px targets, visible focus, labelled controls, `prefers-reduced-motion` respected, no text < 11px.
- Copy: no medical claims, no prescription diets. AI output is always labelled as a suggestion to confirm.

## Shared modules (owned by the integrator; workstreams consume, don't edit)
| Module | Purpose |
|---|---|
| `src/lib/nutrition.ts` | Pure maths: recommend, groupStatus, buildPlan/planCheck, streakInfo, BADGES, dates |
| `src/lib/seed-foods.ts` | Starter catalogue (seeded via `scripts/gen-food-seed.ts`) |
| `src/lib/types.ts` | Row types (Profile, FoodRow, EntryRow, Quote, TourSlide, AiSettings) |
| `src/lib/auth.ts` | `getUser`, `getProfile`, `requireProfile`, `requireOnboarded`, `requireAdmin` |
| `src/lib/data/queries.ts` | Server reads: foods, entries, days, meals-by-day, badges, quotes, tour, settings |
| `src/lib/data/diary.ts` | Server actions: `addEntries`, `deleteEntries`, `updateEntry`, `repeatMeal`, `changeWater`, `setDayDone`, `createCustomFood` |
| `src/components/ui/*` | `Icon`, `FoodTile`, `Sheet` (native dialog), `ToastProvider`/`useToast` |
| `src/app/globals.css` | Tokens + primitives: `.btn .btn.accent .btn-secondary .btn-text .btn-icon .btn-add .chip .pill-choice .seg .panel .field .note dialog.sheet .toast` |

Feature styles go in co-located CSS modules inside your own folders.

## Workstream ownership
| Workstream | Owns |
|---|---|
| Public | `src/app/page.tsx`, `src/app/login/**`, `src/app/auth/**`, `src/components/public/**`, `src/components/splash/**` |
| App | `src/app/onboarding/**`, `src/app/app/**`, `src/components/app/**` |
| AI | `src/app/api/ai/**`, `src/lib/ai/**`, `src/components/ai/**` |
| Admin | `src/app/admin/**`, `src/components/admin/**`, `src/lib/admin/**` |

Contracts between workstreams (signatures fixed): `src/components/ai/index.tsx` (`AiLogSheet`, `CoachLine`,
`PlanTuner`) and `src/components/splash/Splash.tsx` (`Splash`). Need a schema or shared-module change? Don't edit
it: describe it in your hand-off report.

## Environment
See `.env.example`.
