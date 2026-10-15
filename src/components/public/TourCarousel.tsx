'use client';
// Horizontal scroll-snap tour. Works as a plain swipeable list without JS; buttons and arrow keys enhance it.
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { SlideLite } from './content';
import styles from './TourCarousel.module.css';

function SlideImage({ src }: { src: string }) {
  // Local photos go through next/image; admin-supplied remote URLs fall back to a plain lazy <img>
  // (next/image would throw for hosts not listed in next.config).
  if (src.startsWith('/') && !src.startsWith('//')) {
    return <Image src={src} alt="" fill sizes="(max-width: 760px) 86vw, 420px" className={styles.img} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" loading="lazy" className={styles.img} />;
}

export function TourCarousel({ slides }: { slides: SlideLite[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(slides.length <= 1);

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [update]);

  const go = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector('li');
    const step = card ? card.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * step, behavior: reduce ? 'auto' : 'smooth' });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    }
  };

  return (
    <div className={styles.wrap}>
      <div
        ref={track}
        className={styles.track}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label="Shoku tour. Use the arrow keys to move between slides."
        onKeyDown={onKey}
      >
        <ul className={styles.list}>
        {slides.map((s, i) => (
          <li key={s.id} className={styles.slide} aria-label={`Slide ${i + 1} of ${slides.length}`}>
            <div className={styles.media}>
              <SlideImage src={s.image_url} />
              <span className={styles.num} aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
            </div>
            <div className={styles.copy}>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          </li>
        ))}
        </ul>
      </div>
      {slides.length > 1 ? (
        <div className={styles.controls}>
          <button type="button" className={styles.ctrl} onClick={() => go(-1)} disabled={atStart} aria-label="Previous slide">
            <Icon name="back" />
          </button>
          <button type="button" className={styles.ctrl} onClick={() => go(1)} disabled={atEnd} aria-label="Next slide">
            <Icon name="next" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
