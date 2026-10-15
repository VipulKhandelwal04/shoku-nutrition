'use client';
// CONTRACT (owned by the public workstream). Myntra-style launch splash with a rotating fitness quote.
// Shows once per browser session, is skippable, and respects reduced motion. Signature is fixed.
import type { Quote } from '@/lib/types';

export function Splash(_props: { quotes: Pick<Quote, 'text' | 'author'>[]; storageKey?: string }) {
  return null;
}
