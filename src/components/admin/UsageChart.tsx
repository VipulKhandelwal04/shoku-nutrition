import type { CSSProperties } from 'react';
import { shortDate, type UsageDay } from '@/lib/admin/stats';
import s from './admin.module.css';

const FEATURE_LABEL: Record<string, string> = { photo: 'Photo', text: 'Text', plan: 'Plan', coach: 'Coach' };

/**
 * Calls per day as bars, failures as the pink cap on each bar. The chart is decorative for screen readers:
 * the table under it carries the same numbers with proper headers.
 */
export function UsageChart({ days }: { days: UsageDay[] }) {
  const max = Math.max(1, ...days.map(d => d.calls));
  const total = days.reduce((n, d) => n + d.calls, 0);
  const failed = days.reduce((n, d) => n + d.failures, 0);
  const features = Array.from(new Set(days.flatMap(d => Object.keys(d.byFeature)))).sort();

  if (total === 0) {
    return (
      <div className={`${s.empty} panel`}>
        <strong>No AI calls yet</strong>
        <p>Calls from the last {days.length} days show here once members use AI Assist.</p>
      </div>
    );
  }

  return (
    <>
      <figure className={s.chart} style={{ '--n': days.length } as CSSProperties}>
        <figcaption>
          <span>{total} calls · {failed} failed · last {days.length} days</span>
          <span className={s.legend}><i aria-hidden="true" />Calls</span>
          <span className={s.legend}><i className={s.fail} aria-hidden="true" />Failures</span>
        </figcaption>
        <div className={s.bars} aria-hidden="true">
          {days.map(d => (
            <div key={d.day} className={s.bar} title={`${shortDate(d.day)}: ${d.calls} calls, ${d.failures} failed`}>
              <span className={s.barVal}>{d.calls || ''}</span>
              <div className={`${s.barFill} ${d.calls ? '' : s.barZero}`} style={{ height: `${(d.calls / max) * 100}%` }}>
                {d.failures > 0 && <span className={s.barFail} style={{ height: `${(d.failures / d.calls) * 100}%`, minHeight: 3 }} />}
              </div>
            </div>
          ))}
        </div>
        <div className={s.axis} aria-hidden="true">
          {days.map(d => <span key={d.day}>{shortDate(d.day).split(' ')[0]}</span>)}
        </div>
      </figure>

      <div className={s.tableWrap}>
        <table className={s.table} style={{ minWidth: 520 }}>
          <caption>AI calls per day (India time), newest first</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              {features.map(f => <th key={f} scope="col" className={s.num}>{FEATURE_LABEL[f] ?? f}</th>)}
              <th scope="col" className={s.num}>Total</th>
              <th scope="col" className={s.num}>Failed</th>
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().map(d => (
              <tr key={d.day}>
                <th scope="row" className={s.rowHead}>{shortDate(d.day)}</th>
                {features.map(f => <td key={f} className={s.num}>{d.byFeature[f] ?? 0}</td>)}
                <td className={s.num}><strong style={{ color: 'var(--text)' }}>{d.calls}</strong></td>
                <td className={s.num}>{d.failures ? <span className="chip accent">{d.failures}</span> : 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
