// Public home: splash → landing with a feature tour → sign in with Google.
// Always renders: if Supabase isn't configured or a query fails, built-in content is used instead.
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Splash } from '@/components/splash/Splash';
import { TourCarousel } from '@/components/public/TourCarousel';
import { Footer, TopBar } from '@/components/public/PublicChrome';
import { FALLBACK_QUOTES, FALLBACK_SLIDES, type QuoteLite, type SlideLite } from '@/components/public/content';
import { Icon, type IconName } from '@/components/ui/Icon';
import { getUser } from '@/lib/auth';
import { getAiAssist, getQuotes, getTourSlides } from '@/lib/data/queries';
import { BADGES, GROUPS } from '@/lib/nutrition';
import styles from '@/components/public/Home.module.css';

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

async function safe<T>(load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch {
    return fallback;
  }
}

const STEPS = [
  { title: 'Sign in with Google', body: 'Use the Google account you already have. There’s no password to set.' },
  { title: 'Set your goal', body: 'Lose, maintain or build. Shoku turns it into a daily target for calories, protein and food groups.' },
  { title: 'Log each meal', body: 'Tap your usuals after you eat. Shoku shows which food groups the day still needs before your next meal.' },
] as const;

const AI_FEATURES: { icon: IconName; title: string; body: string; soon: string }[] = [
  { icon: 'camera', title: 'Snap your plate', body: 'Take a photo. AI Assist suggests the dishes and portions it sees.', soon: 'Take a photo and get suggested dishes and portions.' },
  { icon: 'type', title: 'Type it in plain words', body: '“2 rotis, dal, a bowl of curd.” It becomes entries you can edit.', soon: 'Write “2 rotis, dal, a bowl of curd” and get entries to edit.' },
  { icon: 'sliders', title: 'A plan from your foods', body: 'A day of meals built from your goal, your diet and the foods you already eat.', soon: 'A day of meals built from your goal, your diet and the foods you already eat.' },
  { icon: 'spark', title: 'A daily coach line', body: 'One line on what the rest of today’s meals could add.', soon: 'One line on what the rest of today’s meals could add.' },
];

export default async function Home() {
  const [user, quoteRows, slideRows, ai] = await Promise.all([
    safe(() => getUser(), null),
    safe(() => getQuotes(), []),
    safe(() => getTourSlides(), []),
    safe(() => getAiAssist(), null),
  ]);

  const quotes: QuoteLite[] = quoteRows.length ? quoteRows.map(q => ({ text: q.text, author: q.author })) : FALLBACK_QUOTES;
  const slides: SlideLite[] = slideRows.length ? slideRows.map(s => ({ id: s.id, title: s.title, body: s.body, image_url: s.image_url })) : FALLBACK_SLIDES;
  const aiLive = ai?.available ?? false;
  const signedIn = !!user;
  const bandQuote = quotes[new Date().getUTCDate() % quotes.length];

  const primary = signedIn ? (
    <Link href="/app" className="btn accent big">
      Open Shoku <Icon name="arrow" size="sm" />
    </Link>
  ) : (
    <Link href="/login" className="btn accent big">
      <span className={styles.gIcon}><Icon name="google" size="sm" /></span>
      Continue with Google
    </Link>
  );

  return (
    <>
      <Splash quotes={quotes} />
      <TopBar signedIn={signedIn} />

      <main id="main">
        {/* ---------- Hero ---------- */}
        <section className={styles.hero} aria-labelledby="hero-title">
          <Image src="/img/hero.webp" alt="" fill loading="eager" fetchPriority="high" quality={60} sizes="100vw" className={styles.heroPhoto} />
          <div className={styles.heroInner}>
            <h1 id="hero-title" className={styles.heroTitle}>
              Meal by
              <br />
              <span>meal.</span>
            </h1>
            <p className={styles.heroSub}>
              A food diary for Indian plates. Log rotis, dal and curd in seconds, and see what the day still needs before your next meal.
            </p>
            <div className={styles.heroActions}>
              {primary}
              <a href="#tour" className={styles.ghost}>
                Take the tour <Icon name="down" size="sm" />
              </a>
            </div>
          </div>
        </section>

        {/* ---------- Tour ---------- */}
        <section id="tour" className={styles.section} aria-labelledby="tour-title">
          <div className={styles.head}>
            <h2 id="tour-title" className={styles.h2}>Inside Shoku</h2>
            <p className={styles.lede}>Swipe or use the arrows to look around.</p>
          </div>
          <TourCarousel slides={slides} />
        </section>

        {/* ---------- How it works ---------- */}
        <section className={styles.section} aria-labelledby="how-title">
          <div className={styles.head}>
            <h2 id="how-title" className={styles.h2}>Set up once. Then log as you eat.</h2>
          </div>
          <ol className={styles.steps}>
            {STEPS.map((s, i) => (
              <li key={s.title} className={styles.step}>
                <span className={styles.stepNum} aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- AI Assist ---------- */}
        <section className={styles.section} aria-labelledby="ai-title">
          <div className={styles.aiPanel}>
            <div className={styles.aiHead}>
              <span className={`chip ${aiLive ? 'accent' : ''}`}>
                <Icon name="spark" size="sm" /> {aiLive ? 'Suggestions you confirm' : 'Rolling out'}
              </span>
              <h2 id="ai-title" className={styles.h2}>
                AI Assist{aiLive ? null : <span className={styles.soft}> (rolling out)</span>}
              </h2>
              <p className={styles.lede}>
                {aiLive
                  ? 'For days when tapping through a list is too slow. AI Assist only suggests: you check and edit each item, and nothing is saved until you confirm.'
                  : 'AI Assist is switching on gradually. Everything else in Shoku works without it, and when it arrives, every result will be a suggestion you check before saving.'}
              </p>
            </div>
            <ul className={styles.aiGrid}>
              {AI_FEATURES.map(f => (
                <li key={f.title} className={styles.aiCard}>
                  <span className={styles.aiIcon}><Icon name={f.icon} /></span>
                  <h3>{f.title}</h3>
                  <p>{aiLive ? f.body : f.soon}</p>
                </li>
              ))}
            </ul>
            <p className={styles.aiNote}>
              <Icon name="info" size="sm" /> AI can get dishes and portions wrong. Values are estimates, so give them a quick look.
            </p>
          </div>
        </section>

        {/* ---------- Plate vs plan ---------- */}
        <section className={`${styles.section} ${styles.split}`} aria-labelledby="plate-title">
          <div className={styles.plateCopy}>
            <h2 id="plate-title" className={styles.h2}>Food groups first.</h2>
            <p className={styles.lede}>
              Shoku reads your day as seven food groups, scaled to your own calorie target.
              Until the day is over, a gap reads “so far”, because dinner hasn’t happened yet.
            </p>
          </div>
          <div className={styles.plateCard}>
            <div className={styles.plateTop}>
              <span className="label">Reference day</span>
              <span className="label">2,000 kcal</span>
            </div>
            <ul className={styles.groups}>
              {GROUPS.map(g => (
                <li key={g.key}>
                  <span className={styles.gName}>{g.label}</span>
                  <span className={styles.gAmt}>
                    {g.grams}
                    <small>{g.unit}</small>
                  </span>
                  <span className={`chip ${g.kind === 'atleast' ? 'ok' : ''}`}>{g.kind === 'atleast' ? 'Reach' : 'Up to'}</span>
                </li>
              ))}
            </ul>
            <p className={styles.plateFoot}>Raw-weight amounts for a 2,000 kcal day. Shoku scales them to your own target.</p>
          </div>
        </section>

        {/* ---------- Streaks ---------- */}
        <section className={`${styles.section} ${styles.split} ${styles.streak}`} aria-labelledby="streak-title">
          <div className={styles.streakVisual} aria-hidden="true">
            <div className={styles.dots}>
              <span><Icon name="check" /></span>
              <span><Icon name="check" /></span>
              <span><Icon name="check" /></span>
            </div>
            <p className={styles.equals}>= day counts</p>
          </div>
          <div>
            <h2 id="streak-title" className={styles.h2}>Three meals and the day counts.</h2>
            <p className={styles.lede}>
              Macros don’t have to be perfect. Log any three meals and the day joins your streak. If you miss a day, the next one starts a new streak, and nothing is marked red.
            </p>
            <ul className={styles.badges}>
              {BADGES.map(b => (
                <li key={b.id}>
                  <Icon name="star" size="sm" />
                  <span>
                    <strong>{b.name}</strong> {b.blurb}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- Quote band ---------- */}
        <section className={styles.band} aria-label="Quote">
          <figure>
            <blockquote>
              <p>{bandQuote.text}</p>
            </blockquote>
            {bandQuote.author ? <figcaption>{bandQuote.author}</figcaption> : null}
          </figure>
        </section>

        {/* ---------- Final CTA ---------- */}
        <section className={styles.final} aria-labelledby="final-title">
          <Image src="/img/dinner.webp" alt="" fill sizes="100vw" className={styles.finalPhoto} />
          <div className={styles.finalInner}>
            <h2 id="final-title" className={styles.finalTitle}>
              Your next meal
              <br />
              is a <span>rep.</span>
            </h2>
            <p className={styles.heroSub}>{signedIn ? 'Pick up where you left off.' : 'Sign in with Google and log today’s next meal.'}</p>
            <div className={styles.heroActions}>{primary}</div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
