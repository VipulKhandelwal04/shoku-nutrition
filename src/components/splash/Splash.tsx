'use client';
// Myntra-style launch splash: the SHOKU wordmark over the outlined kettlebell-bowl mark, with a rotating quote.
// Shows once per browser session, is skippable, and respects reduced motion. Signature is fixed.
//
// How it stays safe:
// - Page content is rendered underneath; the splash is a fixed overlay that removes itself.
// - An inline script runs during HTML parsing (before first paint) to pick the quote and to hide the
//   overlay at once if this session already saw it. No flash, no hydration error (suppressHydrationWarning).
// - If JS never loads, a CSS animation fades the overlay out on its own, so it can never block the page.
// - The visual overlay is aria-hidden: screen readers go straight to the page. Only the Skip button is exposed.
import { BrandOutline } from '@/components/brand/Brand';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Quote } from '@/lib/types';
import { FALLBACK_QUOTES } from '@/components/public/content';
import styles from './Splash.module.css';
import { bootSplash, splashBootScript } from './quoteRotation';

const HOLD_MS = 2600;
const EXIT_MS = 450;

type Phase = 'show' | 'leaving' | 'gone';

// useLayoutEffect warns on the server; this is a client component but it is still server-rendered.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function InlineScript({ html }: { html: string }) {
  // text/plain on the client stops React warning about script tags; the server copy is the one that runs.
  return <script type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Splash({ quotes, storageKey = 'shoku-splash' }: { quotes: Pick<Quote, 'text' | 'author'>[]; storageKey?: string }) {
  const list = (quotes ?? []).filter(q => q && q.text && q.text.trim());
  const unique = new Map<string, Pick<Quote, 'text' | 'author'>>();
  for (const q of list.length ? list : FALLBACK_QUOTES) {
    const key = q.text.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!unique.has(key)) unique.set(key, q);
  }
  const entries = Array.from(unique.entries()).slice(0, 24);
  const pool = entries.map(([, quote]) => quote);
  const id = 'shoku-splash';

  const [phase, setPhase] = useState<Phase>('show');
  const [quoteIndex, setQuoteIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const leave = useCallback(() => {
    setPhase(p => (p === 'show' ? 'leaving' : p));
    timers.current.push(window.setTimeout(() => setPhase('gone'), EXIT_MS));
  }, []);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // The same boot path handles client navigation and is idempotent under Strict Mode.
    bootSplash(id, storageKey);
    const seen = el.dataset.seen === '1';
    if (seen) {
      setPhase('gone');
      return;
    }
    const q = Number(el.dataset.q);
    setQuoteIndex(Number.isInteger(q) && q >= 0 && q < pool.length ? q : 0);
    // Timers and listeners are set up once per mount; pool length is stable for a render of the page.
    const t = window.setTimeout(leave, HOLD_MS);
    timers.current.push(t);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Tab') {
        // Hide synchronously before the browser moves keyboard focus underneath.
        el.hidden = true;
        setPhase('gone');
      }
    };
    const onFocus = (e: FocusEvent) => {
      if (e.target instanceof Node && !el.contains(e.target)) {
        el.hidden = true;
        setPhase('gone');
      }
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocus, true);
    const pending = timers.current;
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocus, true);
      pending.forEach(window.clearTimeout);
    };
  }, []);

  if (phase === 'gone') return null;

  return (
    <div id={id} ref={ref} className={styles.root} data-phase={phase} suppressHydrationWarning>
      <button type="button" className={styles.skip} onClick={leave}>
        Skip<span className="sr-only"> intro</span>
      </button>
      <div className={styles.overlay} aria-hidden="true" onClick={leave}>
        <BrandOutline className={styles.kanji} />
        <div className={styles.inner}>
          <p className={styles.word}>
            SH<span>O</span>KU
          </p>
          <div className={styles.quotes}>
            {pool.map((q, i) => (
              <blockquote key={i} className={styles.quote} data-quote={i} data-quote-key={entries[i][0]} hidden={i !== quoteIndex} suppressHydrationWarning>
                <p>{q.text}</p>
                {q.author ? <cite>{q.author}</cite> : null}
              </blockquote>
            ))}
          </div>
          <div className={styles.bar}>
            <span />
          </div>
        </div>
      </div>
      <InlineScript html={splashBootScript(id, storageKey)} />
    </div>
  );
}
