# Shoku architecture

Shoku (食, Japanese for "food, a meal") is a food diary for Indian plates with a Cult-inspired look: black, one
hot-pink accent (`--accent: #ff3f6c`), Barlow Condensed uppercase display type over Inter.

**Voice:** the meal is the unit. Plain, specific, **never shaming**. The name's meaning shows up as one idea (meal by
meal), not as Japanese decoration. The mark is the kettlebell-bowl icon with the SHOKU wordmark (pink O), shown in
every top bar; both live in `src/components/brand/Brand.tsx` (the static favicon `src/app/icon.svg` repeats the same
shapes: change both together). Keep "katori" as the Indian bowl serving unit (catalogue, AI matching), never as the
brand.

**Copy rules (no AI slop):** no "not just X", "unlock your", "journey", "elevate", "seamless", "with intent"; no
three-beat slogans ("Show up. Stack days."); no eyebrow label over every heading; no em dashes in UI text.

## Stack
- **Next.js 16 App Router** (TypeScript, `src/`). `proxy.ts` (not middleware) refreshes the Supabase session and
  redirects signed-out visitors away from `/app`, `/onboarding`, `/admin`. Cache Components is off.
  Read `node_modules/next/dist/docs/` before using any Next API: v16 has breaking changes
  (`cookies()`/`params`/`searchParams` are async, `proxy.ts`, `LayoutProps<'/route'>`/`PageProps<'/route'>` globals).
- **Supabase**: Google OAuth, Postgres with RLS on every table, private `meal-photos` storage bucket.
  Schema: `supabase/migrations/`. Server code uses `createClient()` from `@/lib/supabase/server` (runs as the user).
  Admin powers come from RLS `is_admin()` and `admin_*` SQL functions. Strava token access is the sole
  service-role exception: `supabase/strava-admin.ts` uses `SUPABASE_SERVICE_ROLE_KEY` for narrowly scoped token
  RPCs after the route verifies an active member. Diary and profile queries still run as the member under RLS.
- **AI Assist** = Gemini via `@google/genai`, server-side only (`GEMINI_API_KEY`, model from `GEMINI_MODEL`, default
  `gemini-flash-latest`). Structured JSON output; results are matched to the food catalogue and confirmed by the user.
  AI Assist is a **feature flag**: `app_settings.ai.enabled` is the master switch admins toggle in `/admin/ai`;
  per-feature flags (photo, text, plan, coach) and `daily_quota` sit under it. UI reads `getAiAssist()`
  (`available`, `features`, `configured`) and hides every AI Assist entry point when off; routes re-check server-side.
  Name it "AI Assist" in the UI (badge/label on every AI surface).

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

Shared pure modules any workstream may import: `src/lib/**` outside `admin/` (nutrition, restrictions, flags,
preferences, format, and `src/lib/ai/{candidates,plan,contracts}`). Suggestion surfaces get the member's eligible foods,
recipes and soft preferences from `src/lib/ai/member.ts` (server only), so diet and restriction rules live in one place.
Server code never imports from `src/components/**`.

Contracts between workstreams (signatures fixed): `src/components/ai/index.tsx` (`AiLogSheet`, `CoachLine`,
`PlanTuner`) and `src/components/splash/Splash.tsx` (`Splash`). Need a schema or shared-module change? Don't edit
it: describe it in your hand-off report.

## Environment
See `.env.example`.
