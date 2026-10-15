'use client';
import { useState, type ReactNode } from 'react';
import s from './compare.module.css';

const TABS = [
  { key: 'groups', label: 'Food groups', short: 'Groups' },
  { key: 'nutrients', label: 'Nutrients', short: 'Nutrients' },
  { key: 'plan', label: 'Plan', short: 'Plan' },
] as const;
type Tab = (typeof TABS)[number]['key'];

/** Segmented control over three server-rendered panels. Panels stay mounted so switching is instant. */
export function CompareTabs({ initial, groups, nutrients, plan }: { initial: Tab; groups: ReactNode; nutrients: ReactNode; plan: ReactNode }) {
  const [tab, setTab] = useState<Tab>(initial);
  const panels: Record<Tab, ReactNode> = { groups, nutrients, plan };
  return (
    <section className={`panel panel-pad ${s.detail}`} aria-label="Details">
      <div className={`seg ${s.seg}`} role="group" aria-label="Show details for">
        {TABS.map(t => (
          <button key={t.key} type="button" aria-label={t.label} aria-pressed={tab === t.key} aria-controls={`cmp-${t.key}`} onClick={() => setTab(t.key)}>
            <span className={s.long}>{t.label}</span>
            <span className={s.short} aria-hidden="true">{t.short}</span>
          </button>
        ))}
      </div>
      {TABS.map(t => (
        <div key={t.key} id={`cmp-${t.key}`} hidden={tab !== t.key} className={s.panelBody}>
          {panels[t.key]}
        </div>
      ))}
    </section>
  );
}
