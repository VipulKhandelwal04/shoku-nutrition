import type { Metadata } from 'next';
import Link from 'next/link';
import { Splash } from '@/components/splash/Splash';
import { BrandLockup } from '@/components/brand/Brand';
import { HomeCuisine } from '@/components/public/HomeCuisine';
import { SlideToStart } from '@/components/public/SlideToStart';
import { FALLBACK_QUOTES } from '@/components/public/content';
import { getUser } from '@/lib/auth';
import { getQuotes } from '@/lib/data/queries';
import s from '@/components/public/Welcome.module.css';

const siteUrl = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
  } catch {
    return new URL('http://localhost:3000');
  }
})();

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: { absolute: 'Shoku · Meal by meal' },
  description:
    'A food diary for Indian plates: log rotis, dal and curd in seconds and see what your day still needs.',
  openGraph: {
    title: 'Shoku · Meal by meal',
    description: 'A food diary for Indian plates. Log a meal in seconds and see which food groups your day is missing.',
    type: 'website',
    siteName: 'Shoku',
    images: [{ url: '/img/hero.webp', alt: 'A thali of Indian food on a dark table' }],
  },
  twitter: { card: 'summary_large_image', title: 'Shoku · Meal by meal', images: ['/img/hero.webp'] },
};


export default async function Home() {
  const [user, quotes] = await Promise.all([
    getUser().catch(() => null),
    getQuotes().catch(() => []),
  ]);
  return (
    <>
      <Splash quotes={quotes.length ? quotes : FALLBACK_QUOTES} />
      <main className={s.page} data-opaque-page>
        <div className={s.canvas}>
          <header className={s.header}>
            <BrandLockup size={30} wordClass={s.wordmark} />
            <Link href={user ? '/app' : '/login#sign-in'} className={s.skip}>{user ? 'Open Shoku' : 'Sign in'}</Link>
          </header>
          <div className={s.intro}>
            <h1>Eat healthy.<br />Feel good.</h1>
            <p>Your everyday meals.<br className={s.desktopBreak} /> A little more balanced.</p>
          </div>
          <HomeCuisine />
          <div className={s.bottom}>
            <SlideToStart />
            <p className={s.legal}><Link href="/privacy">Privacy</Link><span aria-hidden="true">·</span><Link href="/terms">Terms</Link></p>
          </div>
        </div>
      </main>
    </>
  );
}
