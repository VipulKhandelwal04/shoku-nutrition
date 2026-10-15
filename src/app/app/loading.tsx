import s from '@/components/app/shell/status.module.css';

export default function Loading() {
  return (
    <div className={s.loading} role="status" aria-live="polite">
      <span className="sr-only">Loading your day…</span>
      <div className={`${s.block} ${s.title}`} />
      <div className={`${s.block} ${s.hero}`} />
      <div className={s.row}>
        {Array.from({ length: 4 }, (_, i) => <div key={i} className={`${s.block} ${s.card}`} />)}
      </div>
    </div>
  );
}
