import { CHIP, type ChipStatus } from './insights';
import s from './insights.module.css';
import { fmt } from '@/lib/format';


export function StatusChip({ status }: { status: ChipStatus }) {
  const c = CHIP[status];
  return <span className={`chip ${c.tone}`}>{c.label}</span>;
}

/** Eaten vs target with a target marker. `kind: 'limit'` reads "up to". Colour is never the only signal: the chip names it. */
export function CompareRow({ label, eaten, target, unit, kind, status }: {
  label: string; eaten: number; target: number; unit: string; kind: 'limit' | 'atleast' | 'target'; status: ChipStatus;
}) {
  const scale = Math.max(eaten, target) * 1.15 || 1;
  const prefix = kind === 'limit' ? 'Up to ' : kind === 'atleast' ? 'At least ' : '';
  return (
    <div className={s.row}>
      <div className={s.head}>
        <span className={s.label}>{label}</span>
        <StatusChip status={status} />
      </div>
      <div className={s.bar} role="img" aria-label={`${label}: ${fmt(eaten)} ${unit} eaten, ${prefix.toLowerCase()}${fmt(target)} ${unit} target. ${CHIP[status].label}.`}>
        <div className={s.barClip}><div className={s.fill} data-status={status} style={{ transform: `scaleX(${Math.min(eaten / scale, 1)})` }} /></div>
        <div className={s.mark} style={{ left: `${(target / scale) * 100}%` }} />
      </div>
      <div className={s.nums} aria-hidden="true">
        <span><b>{fmt(eaten)}</b> {unit} eaten</span>
        <span>{prefix}{fmt(target)} {unit}</span>
      </div>
    </div>
  );
}
