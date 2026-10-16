---
name: Shoku Glass
description: A dark, photo-backed nutrition interface with condensed typography and a pink accent.
colors:
  background: '#050506'
  surface: 'rgba(30, 30, 36, .5)'
  surface-solid: '#141418'
  text: '#ffffff'
  text-secondary: '#d2d2da'
  muted: '#9d9daa'
  accent: '#ff3f6c'
  accent-hover: '#ff5b81'
  accent-text: '#ff8fa8'
  accent-ink: '#0a0a0c'
  success: '#41d99a'
  warning: '#ffb547'
  danger: '#ff8a8a'
  entry-welcome-bg: '#031c27'
  entry-photo-bg: '#07141b'
  entry-supporting-text: '#e1e7ea'
  entry-muted-text: '#bdcbd2'
  entry-form-surface: 'rgba(9, 22, 29, .82)'
typography:
  display:
    fontFamily: 'Barlow Condensed, Arial Narrow, sans-serif'
    fontWeight: 800
  body:
    fontFamily: 'Inter, sans-serif'
    fontSize: '14px'
    lineHeight: 1.55
  entry-welcome-display:
    fontFamily: 'Inter, sans-serif'
    fontSize: 'clamp(42px, 5.6vw, 72px)'
    fontWeight: 500
    lineHeight: 1.12
    letterSpacing: '-.035em'
rounded:
  panel: '22px'
  sheet: '28px'
  field: '12px'
  pill: '999px'
---

# Shoku design

## Overview

Shoku Glass is the current live app identity: dark surfaces, real food photography, frosted panels, bold condensed headings, and restrained hot-pink emphasis. This document describes the live Next.js app, not the separate gym-and-home-meals concept prototype.

Source files: `src/app/globals.css`, `src/app/layout.tsx`, `src/components/brand/Brand.tsx`, and co-located component CSS modules. Keep these files and this document in sync when the design changes.

The approved entry surfaces extend this identity with a dark-teal rotating-cuisine welcome and full-screen cuisine imagery on the tour/sign-in and onboarding screens. This is an entry-specific treatment; the authenticated app retains the existing Shoku Glass system. Source evidence: `src/app/page.tsx`, `src/app/login/page.tsx`, `src/components/public/Welcome.module.css`, `src/components/public/EntryTour.tsx`, `src/components/public/Login.module.css`, and `src/app/onboarding/{OnboardingFlow.tsx,onboarding.module.css}`.

## Colors

Use the accent for primary actions, selected controls, and brand details. Use the lighter accent-text token for text on dark surfaces. White carries primary content; secondary and muted text establish hierarchy. Green, amber, and danger colors communicate semantic states. Protein uses pink; carbs use near-white; fat uses gray.

Entry surfaces use the welcome background token for the deep petrol-teal canvas and the photo background token as a fallback behind full-bleed imagery. Tour and onboarding text sit over dark directional gradients. Onboarding locally uses the supporting-text, muted-text, and form-surface entry tokens; selected choices and progress retain the existing pink accent. These local colors do not replace app-wide tokens.

## Typography

Barlow Condensed carries uppercase headings, prominent numbers, buttons, and navigation. Inter carries prose, forms, and supporting information. Global h1 size is `clamp(40px, 6vw, 56px)` with .92 line height; h2 is 30px with line height 1. Use tabular figures for comparable nutrition values. Preserve readable wrapping and 16px form text on phones.

The welcome headline uses the entry-welcome-display role in sentence case. At 760px and below it becomes `clamp(34px, 9.8vw, 46px)` with 1.16 line height and -.025em tracking. Tour and onboarding headings retain Barlow Condensed: tour headings use `clamp(46px, 6vw, 76px)` with .98 line height; onboarding headings use `clamp(40px, 7vw, 64px)`. The Google action uses Inter at 15px and weight 600, in sentence case.

## Layout

The main content container is 1180px wide, with desktop page padding of 32px 28px 64px. At 760px and below, page padding becomes 20px 16px 116px. The app uses a sticky topbar and desktop pill navigation; at 1000px and below, navigation becomes a floating bottom bar. Respect safe-area insets and reserve space below content and toasts for the bar.

The welcome fills at least the viewport, with a two-column composition inside an 1180px canvas: copy and the slide-to-start control beside the cuisine photograph. At 760px and below, it becomes a single column with a 500px maximum canvas, 24px side padding, a minimum 680px page height, and the cuisine image between headline and action. The supporting desktop paragraph is hidden on phones.

The tour/sign-in and onboarding use fixed, edge-to-edge food backgrounds with cover cropping, not image cards. Desktop content sits to the left of the food: tour copy is at most 510px wide, its sign-in area 460px, and onboarding content 620px. At 760px and below, gradients run vertically, controls stack as needed, and safe-area padding is retained. Onboarding actions become sticky at the bottom, while the page remains scrollable for longer steps. Cuisine labels are hidden on phones.

## Elevation & Depth

The app background uses `/img/ambient.webp`, blurred and dimmed so panels receive food-derived color. The shared glass recipe is `blur(24px) saturate(170%)`, with a subtle inset edge and an offset soft shadow. Opaque public sections and the splash have their own surfaces. Preserve solid fallbacks for browsers without blur support and people requesting reduced transparency.

Entry backgrounds use dark gradients to separate readable copy and forms from food imagery. The welcome uses a dark translucent cuisine caption and a translucent slide-to-start pill with 20px blur. The cuisine photograph uses cover cropping and feathered edges blending into its teal canvas. Preserve the full-screen composition and legibility overlays when changing imagery.

## Shapes

Buttons, chips, segmented controls, and compact choices use pills. Panels use the panel radius, sheets use the larger radius, and fields use the field radius. Food tiles use 14px rounding. Reuse the outlined kettlebell-bowl brand SVG; do not substitute the older prototype's kanji tile.

## Components

- The welcome slide-to-start control is a translucent outlined pill, 68px high on desktop and 64px on phones. Drag its circular arrow fully to the checkmark and release to open the tour/sign-in screen. Taps and incomplete or cancelled drags reset without navigation. Keyboard users advance with arrow keys or complete with End; focus remains visible and reduced motion disables the reset animation.
- The tour pairs manually controlled slides with a persistent sign-in section; use dots, 44px arrow controls, keyboard arrows, and horizontal swipes. The selected dot uses the pink accent. Google sign-in has a 60px minimum height, a disabled busy state, and inline error feedback.
- Onboarding presents one step at a time, six progress segments, dark translucent choices, and pink selected states. Keep validation, focus movement, Back/Continue controls, and editable targets intact.
- Cuisine backgrounds are decorative generated editorial assets. Each onboarding step has a different cuisine; the mapping belongs in `product.md`. Full generation prompts and provenance live in `public/img/onboarding/README.md`. Do not bake interface text into these images.
- Tour photos reveal over .5s and onboarding photos over .45s; reduced-motion preferences disable these animations and associated local transitions.
- Primary buttons are 52px tall; secondary buttons are at least 48px. Icon controls and compact actions offer 44px targets. Use visible focus, disabled, selected, and hover states.
- Native dialog sheets have sticky headings and footers; on phones they rise from the bottom. Keep dismissal and keyboard behavior intact.
- Forms pair labels with help or error text. AI suggestions remain editable before confirmation.
- The splash retains a black surface, large SHOKU wordmark with a pink O, outlined brand backdrop, one quote and optional attribution, progress line, and Skip intro control. Hold time is 2600ms followed by a 450ms exit; CSS also dismisses the splash if JavaScript fails.
- Quotes rotate between splash appearances, never during a single appearance. A persistent shuffle bag exhausts the unique quote pool before repeating, with no immediate repeat at a round boundary when multiple quotes exist. Selection happens before paint; hydration reuses it. See `product.md` for persistence and session rules.
- Preserve reduced-motion behavior, screen-reader access to underlying content, Escape/Tab dismissal, and dismissal when focus moves beneath the overlay.

## Do's and Don'ts

- Do reuse global tokens, existing brand assets, shared primitives, and feature CSS modules.
- Do distinguish estimates and suggestions from confirmed records.
- Do preserve responsive navigation, readable contrast, focus rings, and reduced-motion/transparency support.
- Do retain the rotating-cuisine welcome and full-screen cuisine imagery within the entry flow; do not extend this page composition into an app-wide redesign.
- Don't add quote carousels or extra waits to the splash.
- Don't copy the separate prototype's routes or unimplemented integrations into the live app.
