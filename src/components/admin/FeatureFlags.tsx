'use client';
import { useState } from 'react';
import { saveFlags } from '@/lib/admin/actions';
import { FEATURE_FLAGS, PRIMARY_KEYS, secondaryKeys, type FeatureFlags, type PrimaryKey } from '@/lib/flags';
import s from './admin.module.css';
import { Switch, useAdminAction } from './primitives';

/**
 * Primary features, each with its secondary switches underneath. Secondaries stay editable while their primary
 * is off (set up ahead of time) but show dimmed, since nothing under an off primary reaches members.
 * Local state is the source of truth after first render; each change saves the whole object and reverts on failure.
 */
export function FeatureFlagsControls({ initial }: { initial: FeatureFlags }) {
  const [flags, setFlags] = useState<FeatureFlags>(initial);
  const { run, pending } = useAdminAction();

  const save = (next: FeatureFlags, success: string) => {
    const prev = flags;
    setFlags(next);
    run(() => saveFlags(next), {
      success,
      undo: async () => { const r = await saveFlags(prev); if (r.ok) setFlags(prev); return r; },
      onDone: r => { if (!r.ok) setFlags(prev); },
    });
  };

  const set = (p: PrimaryKey, key: string, value: boolean) => ({ ...flags, [p]: { ...flags[p], [key]: value } }) as FeatureFlags;

  return (
    <div className={s.flagList}>
      {PRIMARY_KEYS.map(p => {
        const meta = FEATURE_FLAGS[p];
        const on = flags[p].on;
        const kids = secondaryKeys(p);
        const live = kids.filter(k => (flags[p] as Record<string, boolean>)[k]).length;
        return (
          <section key={p} className={`${s.flagGroup} ${on ? s.flagGroupOn : ''}`} aria-labelledby={`flag-${p}-h`}>
            <div className={s.flagHead}>
              <div>
                <p className="label">Primary</p>
                <h2 id={`flag-${p}-h`}>{meta.title}</h2>
                <p id={`flag-${p}-d`}>{meta.body}</p>
                <p className={s.flagState}>{on ? `On · ${live} of ${kids.length} ${kids.length === 1 ? 'part' : 'parts'} live` : 'Off for everyone'}</p>
              </div>
              <Switch pressed={on} label={meta.title} hideLabel describedBy={`flag-${p}-d`} disabled={pending}
                onChange={v => save(set(p, 'on', v), `${meta.title} ${v ? 'on' : 'off for everyone'}.`)} />
            </div>
            {kids.length > 0 && (
              <ul className={`${s.flagKids} ${on ? '' : s.dimmed}`} aria-label={`${meta.title} parts`}>
                {kids.map(k => {
                  const kid = (meta.children as Record<string, { title: string; body: string }>)[k];
                  return (
                    <li key={k} className={s.flagKid}>
                      <div>
                        <h3 id={`flag-${p}-${k}-h`}>{kid.title}</h3>
                        <p id={`flag-${p}-${k}-d`}>{kid.body}</p>
                      </div>
                      <Switch pressed={(flags[p] as Record<string, boolean>)[k]} label={`${meta.title}: ${kid.title}`} hideLabel
                        describedBy={`flag-${p}-${k}-d`} disabled={pending}
                        onChange={v => save(set(p, k, v), `${kid.title} ${v ? 'on' : 'off'}.`)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
