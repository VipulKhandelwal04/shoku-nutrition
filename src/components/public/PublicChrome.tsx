// Shared top bar and footer for the public pages (home, login, privacy, terms). Server Components.
import Link from 'next/link';
import styles from './PublicChrome.module.css';

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`${styles.word} ${className}`}>
      SH<span>O</span>KU
    </span>
  );
}

export function TopBar({ signedIn = false, solid = false }: { signedIn?: boolean; solid?: boolean }) {
  return (
    <header className={`${styles.bar} ${solid ? styles.solid : ''}`}>
      <div className={styles.barInner}>
        <Link href="/" className={styles.home} aria-label="Shoku home">
          <Wordmark />
        </Link>
        {signedIn ? (
          <Link href="/app" className={styles.signIn}>Open Shoku</Link>
        ) : (
          <Link href="/login" className={styles.signIn}>Sign in</Link>
        )}
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footInner}>
        <div className={styles.footTop}>
          <Wordmark className={styles.footWord} />
          <nav aria-label="Legal" className={styles.footNav}>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
        </div>
        <p className={styles.disclaimer}>Nutrition values are estimates. Shoku does not give medical advice.</p>
        <p className={styles.small}>Built for Indian plates. Plate guidance follows ICMR-NIN’s My Plate for the Day.</p>
      </div>
    </footer>
  );
}
