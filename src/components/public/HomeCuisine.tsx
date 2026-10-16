'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { CUISINES, nextCuisine } from './cuisines';
import s from './Welcome.module.css';

export function HomeCuisine() {
  const [cuisine, setCuisine] = useState<(typeof CUISINES)[number] | null>(null);
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) { initialized.current = true; setCuisine(nextCuisine()); }
    const restored = (event: PageTransitionEvent) => { if (event.persisted) setCuisine(nextCuisine()); };
    window.addEventListener('pageshow', restored);
    return () => window.removeEventListener('pageshow', restored);
  }, []);
  return (
    <div className={s.art} data-home-cuisine={cuisine?.id}>
      {cuisine && <>
        <Image key={cuisine.id} src={`/img/onboarding/${cuisine.id}.webp`} alt={cuisine.alt} fill loading="eager" sizes="(max-width: 760px) 850px, 1100px" className={s.cuisinePhoto} />
        <div className={s.cuisineCaption}><span>{cuisine.name}</span><p>{cuisine.dish}</p></div>
      </>}
      <noscript><p className={s.cuisineCaption}>Food from every kitchen. A balance that’s yours.</p></noscript>
    </div>
  );
}
