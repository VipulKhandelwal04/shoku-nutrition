# Shoku

## Purpose and audience

Shoku is a nutrition tracker for people who want to understand and improve everyday eating, with a catalogue and language built around Indian plates. The central loop is to log a meal, see how the day compares with food-group and nutrient targets, and choose what to eat next. The product voice is practical and encouraging, without guilt about missed meals or broken streaks.

This document records the live application's code as inspected on 2026-10-16. Implementation does not guarantee that every integration is configured in a deployed environment. The separate static concept prototype is not the product specification.

## Platform and architecture

Responsive web app using Next.js App Router, React, TypeScript, CSS modules, Supabase authentication/Postgres/storage, and AI provider integrations. Google sign-in leads to onboarding and the authenticated app. Supabase row-level security protects user data; admin routes manage catalogue and configuration. See `README.md`, `docs/ARCHITECTURE.md`, and `src/app` for implementation details.

## Main journeys

- Public home (`/`): existing launch quote splash, then the dark-teal rotating-cuisine welcome. Completing the slide-to-start control opens `/login`; Sign in opens `/login#sign-in`. Signed-in users have an Open Shoku link to `/app`.
- Tour and sign-in (`/login`): feature slides and the Google sign-in action share the second screen.
- Onboarding (`/onboarding`): six full-screen steps establish goals, body details, activity, food preferences, and editable daily targets, with a different cuisine background for each step.
- Today: review the current day and add food or activity context.
- Diary: inspect and manage meal entries.
- Compare: inspect food-group coverage, nutrients, and the personal plan.
- Progress: review consistency and progress. A counted day requires at least three logged meals.
- Profile: manage personal settings and export data.
- Admin: manage foods, recipes, public quotes and tour slides, users, feature availability, AI limits, and usage.

## Entry and onboarding flow

The quote splash remains before the welcome and retains the session and rotation behavior below. The welcome uses a dark-teal canvas with “Eat healthy. Feel good.”, a rotating cuisine photograph and caption, a slide-to-start control, and privacy/terms links. It is a dedicated first screen; the feature tour and Google action are on the second screen.

Each home visit selects a cuisine from a Fisher–Yates shuffle bag stored under `shoku.home-cuisines.v1` in localStorage. All six appear before repeating, and the next round avoids the previous image. Reloads, client navigation, and browser back/forward cache restoration advance rotation independently of the quote splash. Storage is local to the browser; clearing it resets history, blocked storage retains only in-memory history, and simultaneous tabs are not coordinated.

Slide the arrow fully to the checkmark and release to open `/login`. Clicking the track, tapping the arrow, or cancelling or releasing an incomplete drag does not navigate. Keyboard users can advance with arrow keys or complete with End.

The tour loads active admin slides, falling back to the existing bundled slides when needed. Users advance with dots, previous/next controls, keyboard arrows, or horizontal swipes; slides do not auto-advance. Skip tour moves to the sign-in section without requiring completion. Bundled lunch, breakfast, hero, and dinner images map to the new Indian, Japanese, Mediterranean, and Italian full-screen backgrounds respectively. Custom admin image URLs remain in use.

Continue with Google starts the existing Supabase Google OAuth flow. While opening Google, the button is disabled and the tour dims; failure restores the action and shows an inline error. The Google-hosted account and consent screens are external to Shoku and cannot receive Shoku's full-screen background treatment. The existing `/auth/callback` routing is unchanged: accounts requiring setup enter `/onboarding`, onboarded accounts continue to the validated destination, and disabled accounts or closed sign-ups receive the existing error handling. Signed-in visitors to `/login` see Open Shoku in place of the Google button.

Each onboarding step uses its own decorative full-screen cuisine image:

| Step | Content | Background asset |
| --- | --- | --- |
| 1 | Welcome and setup introduction | Indian thali — `indian.webp` |
| 2 | Goal | Japanese soba meal — `japanese.webp` |
| 3 | Body details | Mediterranean spread — `mediterranean.webp` |
| 4 | Activity | Mexican tacos — `mexican.webp` |
| 5 | Food style and restrictions | Thai curry — `thai.webp` |
| 6 | Daily targets and adjustments | Italian pasta — `italian.webp` |

Assets live under `public/img/onboarding/`; the welcome reuses the six cuisine photographs. `README.md` in that directory records generation provenance and full prompts. These generated images are decorative editorial imagery, not logged meals or personalized food recommendations. Existing onboarding calculations, validation, target adjustments, and completion behavior remain in place. The background changes with the step; going Back retains the draft answers. Long steps remain scrollable, with sticky action controls on phones.

Implementation evidence: `src/app/page.tsx`, `src/app/login/page.tsx`, `src/components/public/{HomeCuisine.tsx,cuisines.ts,SlideToStart.tsx,EntryTour.tsx,GoogleButton.tsx}`, `src/app/auth/callback/route.ts`, and `src/app/onboarding/OnboardingFlow.tsx`. Visual treatment is documented in `Design.md`.

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
- Existing splash appearance, routes, launch duration, and accessibility behavior remain stable.
- Home cuisine rotation completes unique rounds and avoids consecutive repeats.
- The welcome slider requires a complete drag and release or keyboard completion; taps, partial drags, and cancellation do not navigate.
- The public welcome leads to a separate tour/sign-in screen; sign-in is available without completing the tour.
- All six onboarding steps show their assigned full-screen cuisine background, retain answers when going Back, and keep form validation and target editing usable on phones.
- Keyboard tour controls, focus movement, busy/error states, and reduced-motion behavior remain usable.

## Development checks

Run `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build`. Quote behavior has regression coverage in `src/components/splash/quoteRotation.test.ts`. For manual replay in a local browser, clear only `sessionStorage['shoku-splash']` and reload; preserve the localStorage bag to observe progress across rounds.
