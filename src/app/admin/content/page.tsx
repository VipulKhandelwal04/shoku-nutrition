import type { Metadata } from 'next';
import { QuotesManager } from '@/components/admin/QuotesManager';
import { TourManager } from '@/components/admin/TourManager';
import s from '@/components/admin/admin.module.css';
import { adminQuotes, adminTourSlides, localImages } from '@/lib/admin/queries';

export const metadata: Metadata = { title: 'Content' };

export default async function ContentPage() {
  const [quotes, slides, images] = await Promise.all([adminQuotes(), adminTourSlides(), localImages()]);
  return (
    <>
      <div className={s.head}>
        <div>
          <p className="label">Public pages</p>
          <h1>Content</h1>
          <p>What visitors see before they sign in: the splash quote and the feature tour on the home page. Changes go live on the next visit.</p>
        </div>
      </div>

      <section aria-labelledby="quotes-h">
        <h2 id="quotes-h" style={{ fontSize: 26 }}>Splash quotes</h2>
        <p className={s.sectionSub}>One active quote shows per visit, rotating in this order. Keep them short, punchy and never shaming.</p>
        <QuotesManager quotes={quotes} />
      </section>

      <section className={s.section} aria-labelledby="tour-h">
        <h2 id="tour-h" style={{ fontSize: 26 }}>Home tour</h2>
        <p className={s.sectionSub}>The feature slides on the landing page, in this order.</p>
        <TourManager slides={slides} images={images} />
      </section>
    </>
  );
}
