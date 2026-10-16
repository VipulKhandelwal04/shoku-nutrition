'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, type TouchEvent } from 'react';
import { BrandLockup } from '@/components/brand/Brand';
import { Icon } from '@/components/ui/Icon';
import { GoogleButton } from './GoogleButton';
import { FALLBACK_SLIDES, type SlideLite } from './content';
import s from './Login.module.css';

// Upgrade the bundled tour photos for full-screen use; custom admin imagery remains unchanged.
const BACKGROUNDS: Record<string, string> = {
  '/img/lunch.webp': '/img/onboarding/indian.webp',
  '/img/breakfast.webp': '/img/onboarding/japanese.webp',
  '/img/hero.webp': '/img/onboarding/mediterranean.webp',
  '/img/dinner.webp': '/img/onboarding/italian.webp',
};

export function EntryTour({ slides, next, error, signedIn = false }: { slides: SlideLite[]; next: string; error: string | null; signedIn?: boolean }) {
  const pool = slides.length ? slides : FALLBACK_SLIDES;
  const [at, setAt] = useState(0);
  const [openingGoogle, setOpeningGoogle] = useState(false);
  const touch = useRef<number | null>(null);
  const slide = pool[Math.min(at, pool.length - 1)];
  const image = BACKGROUNDS[slide.image_url] || slide.image_url || '/img/onboarding/indian.webp';
  const go = (n: number) => setAt(Math.max(0, Math.min(pool.length - 1, n)));
  const onTouchEnd = (event: TouchEvent) => {
    if (touch.current === null) return;
    const delta = event.changedTouches[0].clientX - touch.current;
    if (Math.abs(delta) > 50) go(at + (delta < 0 ? 1 : -1));
    touch.current = null;
  };
  return (
    <main className={s.page} data-opaque-page data-opening-google={openingGoogle || undefined}>
      <div className={s.photo} aria-hidden="true">
        {image.startsWith('/') && !image.startsWith('//') ? (
          <Image key={image} src={image} alt="" fill loading="eager" quality={60} sizes="(max-aspect-ratio: 3/2) 150vh, 100vw" className={s.img} />
        ) : (
          // Admin-supplied images may come from hosts outside next/image's allowlist.
          // eslint-disable-next-line @next/next/no-img-element
          <img key={image} src={image} alt="" className={s.img} />
        )}
      </div>
      <header className={s.header}>
        <Link href="/" className={s.brandLink} aria-label="Shoku home"><BrandLockup size={30} wordClass={s.word} /></Link>
        <a href="#sign-in" className={s.skip}>Skip tour <Icon name="arrow" size="sm" /></a>
      </header>
      <div className={s.panel}>
        <section className={s.tour} aria-label="Shoku tour" aria-roledescription="carousel" tabIndex={0}
          onKeyDown={event => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
              event.preventDefault(); go(at + (event.key === 'ArrowRight' ? 1 : -1));
            }
          }}
          onTouchStart={event => { touch.current = event.touches[0].clientX; }} onTouchEnd={onTouchEnd}>
          <div aria-live="polite" aria-atomic="true" className={s.slideCopy}>
            <p className="sr-only">Slide {at + 1} of {pool.length}</p>
            <h1 className={s.title}>{slide.title}</h1>
            <p className={s.sub}>{slide.body}</p>
          </div>
          <div className={s.controls}>
            <div className={s.dots} aria-label="Choose a tour slide">
              {pool.map((item, index) => <button key={item.id} type="button" aria-label={`Show slide ${index + 1}: ${item.title}`} aria-current={at === index ? 'step' : undefined} onClick={() => go(index)}><span /></button>)}
            </div>
            <div className={s.arrows}>
              <button type="button" aria-label="Previous slide" disabled={at === 0} onClick={() => go(at - 1)}><Icon name="back" /></button>
              <button type="button" aria-label="Next slide" disabled={at === pool.length - 1} onClick={() => go(at + 1)}><Icon name="next" /></button>
            </div>
          </div>
        </section>
        <section id="sign-in" className={s.signIn} tabIndex={-1} aria-label="Sign in to Shoku">
          {error && <p className={s.alert} role="alert"><Icon name="info" size="sm" /> {error}</p>}
          {signedIn ? <Link className="btn big full" href={next}>Open Shoku <Icon name="arrow" /></Link> : <GoogleButton next={next} onBusyChange={setOpeningGoogle} />}
          <p className={s.consent}>By continuing, you agree to our <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy policy</Link>.</p>
          <p className={s.fine}>Nutrition estimates. Your choices, always.</p>
        </section>
      </div>
    </main>
  );
}
