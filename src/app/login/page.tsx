import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { GoogleButton } from '@/components/public/GoogleButton';
import { Wordmark } from '@/components/public/PublicChrome';
import { safeNext } from '@/components/public/content';
import { Icon } from '@/components/ui/Icon';
import styles from '@/components/public/Login.module.css';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Katori with Google to log your meals and track your plate.',
  robots: { index: false },
};

const ERRORS: Record<string, string> = {
  disabled: 'This account is paused. Contact the Katori team.',
  oauth: 'Google sign-in didn’t finish. Try again.',
  signups_closed: 'New sign-ups are paused right now.',
};

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const errorKey = Array.isArray(sp.error) ? sp.error[0] : sp.error;
  const error = errorKey ? (ERRORS[errorKey] ?? ERRORS.oauth) : null;

  return (
    <main className={styles.page}>
      <div className={styles.photo}>
        <Image src="/img/hero.webp" alt="" fill priority sizes="(max-width: 860px) 100vw, 55vw" className={styles.img} />
        <div className={styles.photoCopy}>
          <p className={styles.photoLine}>
            Eat like
            <br />
            you <span>train.</span>
          </p>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.panelInner}>
          <Link href="/" className={styles.back}>
            <Icon name="back" size="sm" /> Home
          </Link>
          <Wordmark className={styles.word} />
          <div className={styles.titles}>
            <h1 className={styles.title}>Sign in to Katori</h1>
            <p className={styles.sub}>Your meals, your streak and your plan, on every device.</p>
          </div>

          {error ? (
            <p className={styles.alert} role="alert">
              <Icon name="info" size="sm" /> {error}
            </p>
          ) : null}

          <GoogleButton next={next} />

          <p className={styles.consent}>
            By continuing you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy policy</Link>. Google shares your name,
            email and profile photo with Katori. Nothing is posted anywhere.
          </p>
          <p className={styles.fine}>Nutrition values are estimates. Katori does not give medical advice.</p>
        </div>
      </div>
    </main>
  );
}
