# Shoku

## Purpose and audience

Shoku is a nutrition tracker for people who want to understand and improve everyday eating, with a catalogue and language built around Indian plates. The central loop is to log a meal, see how the day compares with food-group and nutrient targets, and choose what to eat next. The product voice is practical and encouraging, without guilt about missed meals or broken streaks.

This document records the live application's code as inspected on 2026-10-16. Implementation does not guarantee that every integration is configured in a deployed environment. The separate static concept prototype is not the product specification.

## Platform and architecture

Responsive web app using Next.js App Router, React, TypeScript, CSS modules, Supabase authentication/Postgres/storage, and AI provider integrations. Google sign-in leads to onboarding and the authenticated app. Supabase row-level security protects user data; admin routes manage catalogue and configuration. See `README.md`, `docs/ARCHITECTURE.md`, and `src/app` for implementation details.

## Main journeys

- Public home: launch splash, food-led introduction, feature tour, and sign-in or open-app action.
- Onboarding: establish goals and preferences for daily targets.
- Today: review the current day and add food or activity context.
- Diary: inspect and manage meal entries.
- Compare: inspect food-group coverage, nutrients, and the personal plan.
- Progress: review consistency and progress. A counted day requires at least three logged meals.
- Profile: manage personal settings and export data.
- Admin: manage foods, recipes, public quotes and tour slides, users, feature availability, AI limits, and usage.

## AI and nutrition principles

AI Assist offers suggestions for photo-based and plain-language logging, planning, and coaching, subject to feature configuration and provider availability. Users review suggestions before saving. Nutrition values are estimates; the product is not a medical service. Keep food-group explanations understandable and qualify incomplete days as “so far.” Do not claim capabilities from the concept prototype as shipped integrations.

## Splash quote behavior

The splash on the public home appears once per tab session using the existing `shoku-splash` sessionStorage flag. Navigating back or reloading in that session does not replay it. Quote rotation advances only when the splash actually appears. It does not introduce a new splash on authenticated routes.

Active quotes come from the existing content query; built-in quotes remain the fallback when no usable content is returned. Blank quotes are removed and duplicate text is collapsed after whitespace and case normalization. Up to 24 unique quotes participate, preserving the existing rendering cap.

A Fisher–Yates shuffle bag stores the pool signature, remaining quote identities, and last displayed identity in localStorage under `<storageKey>:quotes:v1`. Each launch consumes one quote; every quote in a stable pool appears before a new round begins. The next round cannot start with the previous round's last quote when there are at least two choices. Admin reordering preserves progress; changes to quote text or pool membership rebuild the bag while avoiding the last quote when possible.

The pre-paint script and client-navigation initialization share one implementation. Initialization is idempotent so hydration and React Strict Mode do not advance twice. The quote stays fixed during a splash appearance. Existing skip, keyboard dismissal, automatic timeout, reduced-motion behavior, and CSS no-JavaScript dismissal remain intact.

History is local to the browser and origin, independent of account login. Clearing site data resets it. A singleton pool necessarily repeats. Corrupt state recovers to a new bag. If storage is unavailable, the splash still works but persistence and non-repetition across launches cannot be guaranteed. Simultaneous tabs do not have transactional coordination and can draw the same quote. No new remote-config service or network request is added for selection.

## Acceptance checks

- A stable pool produces a full unique round before repeating and no consecutive repeat across rounds.
- A skipped launch and repeated initialization leave the bag unchanged.
- Reordering, changed pools, corrupt storage, blocked storage, and singleton pools are handled.
- The serialized pre-paint script runs without module dependencies and safely escapes embedded arguments.
- Existing appearance, routes, launch duration, and accessibility behavior remain stable.

## Development checks

Run `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build`. Quote behavior has regression coverage in `src/components/splash/quoteRotation.test.ts`. For manual replay in a local browser, clear only `sessionStorage['shoku-splash']` and reload; preserve the localStorage bag to observe progress across rounds.
