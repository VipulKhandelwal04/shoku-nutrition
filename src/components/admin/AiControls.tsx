'use client';
import { useState } from 'react';
import { saveAiSettings } from '@/lib/admin/actions';
import type { AiFeature, AiSettings } from '@/lib/types';
import s from './admin.module.css';
import { Switch, useAdminAction } from './primitives';

const FEATURES: { key: AiFeature; title: string; body: string }[] = [
  { key: 'photo', title: 'Snap a plate', body: 'Members photograph a meal and confirm the suggested foods.' },
  { key: 'text', title: 'Describe a meal', body: '“2 rotis and dal” becomes catalogue items to confirm.' },
  { key: 'plan', title: 'Tune my plan', body: 'Tailors the day plan to their goal and diet.' },
  { key: 'coach', title: 'Coach line', body: 'A short, encouraging nudge on the Today screen.' },
];

/**
 * AI Assist controls. Local state is the source of truth after first render (no remount on revalidate, so
 * focus stays on the control just used). Each change saves the whole settings object; failures revert.
 */
export function AiControls({ initial, configured }: { initial: AiSettings; configured: boolean }) {
  const [settings, setSettings] = useState<AiSettings>(initial);
  const [quota, setQuota] = useState(String(initial.daily_quota));
  const [quotaError, setQuotaError] = useState('');
  const { run, pending } = useAdminAction();

  const save = (next: AiSettings, success: string) => {
    const prev = settings;
    setSettings(next);
    run(() => saveAiSettings(next), {
      success,
      undo: async () => { setSettings(prev); setQuota(String(prev.daily_quota)); return saveAiSettings(prev); },
      onDone: r => { if (!r.ok) setSettings(prev); },
    });
  };

  const on = settings.enabled;
  const liveCount = FEATURES.filter(f => settings[f.key]).length;

  return (
    <>
      <section className={`${s.hero} ${on ? s.heroOn : ''}`} aria-labelledby="ai-master-h">
        <div>
          <p className="label" id="ai-master-h">AI Assist · master switch</p>
          <p className={s.heroState} aria-hidden="true">{on ? 'On' : 'Off'}</p>
          <p className={s.heroCopy}>
            {on
              ? `Members see AI Assist buttons for the ${liveCount} feature${liveCount === 1 ? '' : 's'} switched on below${configured ? '' : ', once a Gemini key is set'}.`
              : 'All AI Assist buttons disappear for everyone. Logging, plans and progress keep working without AI.'}
          </p>
          <div className={s.statusLine}>
            {configured ? (
              <span className="chip ok">Gemini key configured</span>
            ) : (
              <span className="chip warn">No Gemini key · Set GEMINI_API_KEY in Vercel</span>
            )}
            {on && liveCount === 0 && <span className="chip warn">Every feature is off</span>}
          </div>
        </div>
        <button
          type="button"
          className={s.bigSwitch}
          aria-pressed={on}
          disabled={pending}
          onClick={() => save({ ...settings, enabled: !on }, !on ? 'AI Assist is on.' : 'AI Assist is off for everyone.')}
        >
          <span>AI Assist</span>
          <span className={s.bigTrack} aria-hidden="true" />
        </button>
      </section>

      <section className={s.section} aria-labelledby="ai-features-h">
        <h2 id="ai-features-h">Features</h2>
        <p className={s.sectionSub}>
          {on ? 'Each one can be switched off on its own.' : 'Saved, but nothing applies while AI Assist is off. You can still set these up ahead of time.'}
        </p>
        <div className={`${s.features} ${on ? '' : s.dimmed}`}>
          {FEATURES.map(f => (
            <div key={f.key} className={s.featureCard}>
              <h3 id={`ai-${f.key}-h`}>{f.title}</h3>
              <p id={`ai-${f.key}-d`}>{f.body}</p>
              <Switch
                pressed={settings[f.key]}
                label={f.title}
                hideLabel
                describedBy={`ai-${f.key}-d`}
                disabled={pending}
                onChange={v => save({ ...settings, [f.key]: v }, `${f.title} ${v ? 'on' : 'off'}.`)}
              />
            </div>
          ))}
        </div>

        <form
          className={`${s.quota} ${on ? '' : s.dimmed}`}
          noValidate
          onSubmit={e => {
            e.preventDefault();
            const n = Number(quota);
            if (!Number.isInteger(n) || n < 1 || n > 200) { setQuotaError('Use a whole number from 1 to 200.'); return; }
            setQuotaError('');
            save({ ...settings, daily_quota: n }, `Daily limit set to ${n} calls.`);
          }}
        >
          <div className="field">
            <label htmlFor="ai-quota">Daily limit per member</label>
            <input id="ai-quota" type="number" inputMode="numeric" min={1} max={200} step={1} value={quota} onChange={e => setQuota(e.target.value)} aria-invalid={quotaError ? true : undefined} aria-describedby="ai-quota-help ai-quota-err" />
          </div>
          <button type="submit" className="btn-secondary" disabled={pending || quota === String(settings.daily_quota)}>Save limit</button>
          <p id="ai-quota-help" className="field-help" style={{ flexBasis: '100%', margin: 0 }}>AI calls each member can make per day (India time), 1 to 200. Counts reset at midnight IST.</p>
          <p id="ai-quota-err" className="error-text" role="alert" style={{ flexBasis: '100%' }}>{quotaError}</p>
        </form>
      </section>
    </>
  );
}
