'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { CoachResponse } from '@/lib/ai/contracts';
import { AiBadge } from './AiBadge';
import { callAi } from './api';
import styles from './ai.module.css';

const cacheKey = (day: string) => `katori:coach:${day}`;

function readCache(day: string): string | null {
  try {
    return sessionStorage.getItem(cacheKey(day));
  } catch {
    return null;
  }
}
function writeCache(day: string, line: string) {
  try {
    sessionStorage.setItem(cacheKey(day), line);
  } catch {
    /* storage blocked: the line just won't be cached */
  }
}

async function fetchLine(day: string): Promise<string | null> {
  try {
    const res = await callAi<CoachResponse>('/api/ai/coach', { day });
    return res.ok ? res.data.line : null;
  } catch {
    return null;
  }
}

/**
 * One short, never-shaming nudge for the day. Fetched once per day per tab (sessionStorage), with a refresh button.
 * Renders nothing while loading, or when AI Assist is off, out of quota, or not configured.
 */
export function CoachLine({ day }: { day: string }) {
  const [state, setState] = useState<{ day: string; line: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const cached = readCache(day);
      const line = cached ?? (await fetchLine(day));
      if (!live || !line) return;
      if (!cached) writeCache(day, line);
      setState({ day, line });
    })();
    return () => { live = false; };
  }, [day]);

  async function refresh() {
    setRefreshing(true);
    const line = await fetchLine(day);
    setRefreshing(false);
    if (!line) return;
    writeCache(day, line);
    setState({ day, line });
  }

  if (!state || state.day !== day) return null;
  return (
    <div className={styles.coach}>
      <AiBadge />
      <p aria-live="polite">{state.line}</p>
      <button type="button" className="btn-icon" onClick={refresh} disabled={refreshing} aria-label="Get a new nudge">
        <Icon name="spark" size="sm" className={refreshing ? styles.spin : ''} />
      </button>
    </div>
  );
}
