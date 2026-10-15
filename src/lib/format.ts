// Number formats used across the app. Plain functions (no 'use client'), so server and client code share them.

/** A whole number with Indian digit grouping: 12,345. */
export const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

/** A quantity to at most two decimals, no trailing zeros: 1.5, 0.25, 2. */
export const qty = (n: number) => String(Math.round(n * 100) / 100);
