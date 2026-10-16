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
typography:
  display:
    fontFamily: 'Barlow Condensed, Arial Narrow, sans-serif'
    fontWeight: 800
  body:
    fontFamily: 'Inter, sans-serif'
    fontSize: '14px'
    lineHeight: 1.55
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

## Colors

Use the accent for primary actions, selected controls, and brand details. Use the lighter accent-text token for text on dark surfaces. White carries primary content; secondary and muted text establish hierarchy. Green, amber, and danger colors communicate semantic states. Protein uses pink; carbs use near-white; fat uses gray.

## Typography

Barlow Condensed carries uppercase headings, prominent numbers, buttons, and navigation. Inter carries prose, forms, and supporting information. Global h1 size is `clamp(40px, 6vw, 56px)` with .92 line height; h2 is 30px with line height 1. Use tabular figures for comparable nutrition values. Preserve readable wrapping and 16px form text on phones.

## Layout

The main content container is 1180px wide, with desktop page padding of 32px 28px 64px. At 760px and below, page padding becomes 20px 16px 116px. The app uses a sticky topbar and desktop pill navigation; at 1000px and below, navigation becomes a floating bottom bar. Respect safe-area insets and reserve space below content and toasts for the bar.

## Elevation & Depth

The app background uses `/img/ambient.webp`, blurred and dimmed so panels receive food-derived color. The shared glass recipe is `blur(24px) saturate(170%)`, with a subtle inset edge and an offset soft shadow. Opaque public sections and the splash have their own surfaces. Preserve solid fallbacks for browsers without blur support and people requesting reduced transparency.

## Shapes

Buttons, chips, segmented controls, and compact choices use pills. Panels use the panel radius, sheets use the larger radius, and fields use the field radius. Food tiles use 14px rounding. Reuse the outlined kettlebell-bowl brand SVG; do not substitute the older prototype's kanji tile.

## Components

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
- Don't add quote carousels or extra waits to the splash.
- Don't copy the separate prototype's routes or unimplemented integrations into the live app.
