import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import s from '@/components/app/shell/status.module.css';

export default function AppNotFound() {
  return (
    <section className={`panel ${s.status}`} aria-labelledby="nf-h">
      <Icon name="plate" />
      <h1 id="nf-h">Empty plate.</h1>
      <p>That page isn’t on the menu. Head back and keep logging.</p>
      <div className={s.actions}>
        <Link href="/app" className="btn accent">Back to today</Link>
        <Link href="/app/diary" className="btn-secondary">Open diary</Link>
      </div>
    </section>
  );
}
