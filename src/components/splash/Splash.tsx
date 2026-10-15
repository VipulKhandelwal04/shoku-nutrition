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

const HOLD_MS = 2600;
const EXIT_MS = 450;

type Phase = 'show' | 'leaving' | 'gone';

// useLayoutEffect warns on the server; this is a client component but it is still server-rendered.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function readSeen(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}
function markSeen(key: string) {
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    // Private mode or blocked storage: the splash may show again, which is harmless.
  }
}

/** Runs during HTML parsing on hard loads. Plain ES5, no dependencies. */
function bootScript(id: string, key: string, count: number) {
  return `(function(){try{var el=document.getElementById(${JSON.stringify(id)});if(!el)return;var seen=false;try{seen=sessionStorage.getItem(${JSON.stringify(key)})==='1';if(!seen)sessionStorage.setItem(${JSON.stringify(key)},'1');}catch(e){}el.setAttribute('data-seen',seen?'1':'0');var i=Math.floor(Math.random()*${count});el.setAttribute('data-q',String(i));var qs=el.querySelectorAll('[data-quote]');for(var n=0;n<qs.length;n++){qs[n].hidden=Number(qs[n].getAttribute('data-quote'))!==i;}}catch(e){}})();`;
}

function InlineScript({ html }: { html: string }) {
  // text/plain on the client stops React warning about script tags; the server copy is the one that runs.
  return <script type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Splash({ quotes, storageKey = 'shoku-splash' }: { quotes: Pick<Quote, 'text' | 'author'>[]; storageKey?: string }) {
  const list = (quotes ?? []).filter(q => q && q.text && q.text.trim()).slice(0, 24);
  const pool = list.length ? list : FALLBACK_QUOTES;
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
    const fromScript = el.dataset.seen; // set by the inline script on hard loads only
    const seen = fromScript === undefined ? readSeen(storageKey) : fromScript === '1';
    if (seen) {
      setPhase('gone');
      return;
    }
    markSeen(storageKey);
    const q = Number(el.dataset.q);
    setQuoteIndex(Number.isInteger(q) && q >= 0 && q < pool.length ? q : Math.floor(Math.random() * pool.length));
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
              <blockquote key={i} className={styles.quote} data-quote={i} hidden={i !== quoteIndex} suppressHydrationWarning>
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
      <InlineScript html={bootScript(id, storageKey, pool.length)} />
    </div>
  );
}
