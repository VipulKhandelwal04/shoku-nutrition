// Layout for the short legal pages (privacy, terms).
import type { ReactNode } from 'react';
import { Footer, TopBar } from './PublicChrome';
import styles from './Legal.module.css';

// Set NEXT_PUBLIC_SUPPORT_EMAIL to a real, monitored inbox (kept out of the public repo). The fallback is a placeholder.
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@shoku.app';

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <TopBar solid />
      <main className={styles.page}>
        <p className={styles.eyebrow}>Last updated {updated}</p>
        <h1 className={styles.title}>{title}</h1>
        <div className={styles.body}>{children}</div>
      </main>
      <Footer />
    </>
  );
}
