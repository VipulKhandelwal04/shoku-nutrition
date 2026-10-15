'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { TZ_COOKIE } from './insights';

/**
 * Stores the device time zone in a cookie so server pages compute the user's own "today".
 * Refreshes once when the cookie was missing or stale (first visit, travel). Renders nothing.
 */
export function DeviceTimeZone({ current }: { current: string | null }) {
  const router = useRouter();
  useEffect(() => {
    let tz: string;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!tz || tz === current) return;
    document.cookie = `${TZ_COOKIE}=${encodeURIComponent(tz)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [current, router]);
  return null;
}
