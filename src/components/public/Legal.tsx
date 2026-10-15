// Layout for the short legal pages (privacy, terms).
import type { ReactNode } from 'react';
import { Footer, TopBar } from './PublicChrome';
import styles from './Legal.module.css';

// TODO(owner): replace with a real, monitored support inbox before launch.
export const SUPPORT_EMAIL = 'support@katori.app';

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
