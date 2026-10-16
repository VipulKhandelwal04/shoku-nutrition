'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Icon } from '@/components/ui/Icon';
import { safeNext } from './content';
import styles from './Login.module.css';

export function GoogleButton({ next, onBusyChange }: { next: string; onBusyChange?: (busy: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signIn() {
    setBusy(true);
    onBusyChange?.(true);
    setError('');
    try {
      const supabase = createClient();
      const dest = safeNext(next);
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(dest)}` },
      });
      if (err) throw err;
      // On success the browser navigates to Google; keep the button disabled until it does.
    } catch {
      setBusy(false);
      onBusyChange?.(false);
      setError('Couldn’t reach Google sign-in. Check your connection and try again.');
    }
  }

  return (
    <div className={styles.action}>
      <button type="button" className={`btn big full ${styles.google}`} onClick={signIn} disabled={busy} aria-busy={busy}>
        <Icon name="google" />
        {busy ? 'Opening Google…' : 'Continue with Google'}
      </button>
      <p className="error-text" role="alert" aria-live="assertive">
        {error}
      </p>
    </div>
  );
}
