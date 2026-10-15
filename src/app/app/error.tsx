'use client';
import Link from 'next/link';
import { useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import s from '@/components/app/shell/status.module.css';

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error('[katori/app]', error.digest ?? '', error);
  }, [error]);
  return (
    <section className={`panel ${s.status}`} aria-labelledby="app-error-h">
      <Icon name="info" />
      <h1 id="app-error-h">Missed a beat.</h1>
      <p>We couldn’t load this screen. Your logged meals are safe. Check your connection and try again.</p>
      <div className={s.actions}>
        <button type="button" className="btn accent" onClick={() => retry()}>Try again</button>
        <Link href="/app" className="btn-secondary">Back to today</Link>
      </div>
      {error.digest && <p className="fine-print">Reference: {error.digest}</p>}
    </section>
  );
}
