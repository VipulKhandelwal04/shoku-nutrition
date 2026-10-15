'use client';
import { useState, type ReactNode } from 'react';
import s from './compare.module.css';

const TABS = [
  { key: 'overview', label: 'Overview', short: 'Overview' },
  { key: 'groups', label: 'Food groups', short: 'Groups' },
  { key: 'nutrients', label: 'Nutrients', short: 'Nutrients' },
  { key: 'plan', label: 'Plan', short: 'Plan' },
] as const;
type Tab = (typeof TABS)[number]['key'];

/**
 * Segmented control over the server-rendered panels. Panels stay mounted so switching is instant.
 * A panel passed as null is switched off (feature flag) and its tab is left out; with none left, nothing renders.
 */
export function CompareTabs({ initial, overview, groups, nutrients, plan }: { initial: Tab; overview: ReactNode; groups: ReactNode | null; nutrients: ReactNode | null; plan: ReactNode | null }) {
  const panels: Record<Tab, ReactNode | null> = { overview, groups, nutrients, plan };
  const tabs = TABS.filter(t => panels[t.key] !== null);
  const [tab, setTab] = useState<Tab>(tabs.some(t => t.key === initial) ? initial : (tabs[0]?.key ?? initial));
  if (!tabs.length) return null;
  return (
    <section className={s.detail} aria-label="Details">
      <div className={`seg ${s.seg}`} role="group" aria-label="Show details for">
        {tabs.map(t => (
          <button key={t.key} type="button" aria-label={t.label} aria-pressed={tab === t.key} aria-controls={`cmp-${t.key}`} onClick={() => setTab(t.key)}>
            <span className={s.long}>{t.label}</span>
            <span className={s.short} aria-hidden="true">{t.short}</span>
          </button>
        ))}
      </div>
      {tabs.map(t => (
        <div key={t.key} id={`cmp-${t.key}`} hidden={tab !== t.key} className={`${s.panelBody} ${t.key !== 'overview' ? `panel panel-pad` : ''}`}>
          {panels[t.key]}
        </div>
      ))}
    </section>
  );
}
