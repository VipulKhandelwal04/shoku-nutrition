'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, useTransition, type FormEvent } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { addWorkout, removeWorkout, restoreWorkout, restoreBase, switchToLightBase } from '@/lib/data/workouts';
import { ACTIVITY, EXERCISE_CREDIT, WORKOUT_PRESETS, estimateBurn, exerciseCredit, type Activity } from '@/lib/nutrition';
import type { ConnectionStatus, WorkoutRow } from '@/lib/types';
import { fmt } from './clientDate';
import s from './log.module.css';

export type WorkoutsData = {
  workouts: WorkoutRow[];
  strava: { configured: boolean; connection: ConnectionStatus | null };
  weightKg: number;
  activity: Activity | null;
};

const SYNC_AFTER_MS = 10 * 60 * 1000;
const iconFor = (kind: string): IconName => (WORKOUT_PRESETS.find(p => p.kind === kind)?.icon as IconName | undefined) ?? 'bolt';

function ago(iso: string | null): string {
  if (!iso) return 'not synced yet';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'synced just now';
  if (m < 60) return `synced ${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `synced ${h} h ago` : `synced ${Math.round(h / 24)} d ago`;
}

/** Today's workouts: calories burned, half credited to the target, manual logging and Strava sync. */
export function WorkoutsPanel({ day, isToday, data }: { day: string; isToday: boolean; data: WorkoutsData }) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pending, start] = useTransition();
  const list = data.workouts.filter(w => w.day === day);
  const burned = list.reduce((n, w) => n + w.kcal, 0);
  const credit = exerciseCredit(burned);
  const connection = data.strava.connection;
  const doubleCount = !!data.activity && (data.activity === 'moderate' || data.activity === 'high') && (list.length > 0 || !!connection);

  // Quiet background import when Today opens; the server throttles too.
  const tried = useRef(false);
  useEffect(() => {
    if (tried.current || !isToday || !connection) return;
    if (connection.last_sync_at && Date.now() - new Date(connection.last_sync_at).getTime() < SYNC_AFTER_MS) return;
    tried.current = true;
    void runSync(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isToday, connection]);

  async function runSync(force: boolean) {
    setSyncing(true);
    try {
      const res = await fetch('/api/strava/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force }) });
      const j = (await res.json()) as { ok: boolean; data?: { imported: number }; error?: string };
      if (!j.ok) { if (force) toast(j.error ?? 'Couldn’t reach Strava.'); return; }
      const n = j.data?.imported ?? 0;
      if (n > 0) { toast(`Imported ${n} ${n === 1 ? 'workout' : 'workouts'} from Strava.`); router.refresh(); }
      else if (force) { toast('Strava is up to date.'); router.refresh(); }
    } catch {
      if (force) toast('Couldn’t reach Strava. Check your connection.');
    } finally {
      setSyncing(false);
    }
  }

  const remove = (w: WorkoutRow) => start(async () => {
    const r = await removeWorkout(w.id);
    if (!r.ok) { toast(r.error); return; }
    toast(`Removed ${w.label}.`, { undo: async () => { const u = await restoreWorkout(r.data.restore); if (!u.ok) toast(u.error); } });
  });

  const lightBase = () => start(async () => {
    const r = await switchToLightBase();
    if (!r.ok) { toast(r.error); return; }
    toast('Base target switched to light activity.', { undo: async () => { const u = await restoreBase(r.data.previous); if (!u.ok) toast(u.error); } });
  });

  return (
    <section className={`panel ${s.workouts}`} aria-labelledby="workouts-h">
      <div className={s.waterHeading}>
        <h3 id="workouts-h">Workouts</h3>
        <Icon name="flame" />
      </div>
      <p className={s.waterValue} aria-live="polite">{fmt(burned)} <span>kcal burned</span></p>
      <p className={s.subtle}>
        {burned > 0
          ? <>+{fmt(credit)} kcal added to {isToday ? 'today’s' : 'this day’s'} target ({Math.round(EXERCISE_CREDIT * 100)}% of the burn, since estimates run high).</>
          : <>Log a class, run or walk. Half of what you burn is added to {isToday ? 'today’s' : 'this day’s'} target.</>}
      </p>

      {list.length > 0 && (
        <ul className={s.workoutList}>
          {list.map(w => (
            <li key={w.id} className={s.workoutRow}>
              <span className={s.workoutIcon}><Icon name={w.source === 'strava' ? 'arrow' : iconFor(w.kind)} size="sm" /></span>
              <span className={s.workoutText}>
                <strong>{w.label}</strong>
                <small>{w.minutes} min · {w.source === 'strava' ? 'Strava' : w.kcal_source === 'device' ? 'from your watch' : 'estimate'}</small>
              </span>
              <span className={s.workoutKcal}>{fmt(w.kcal)}<small> kcal</small></span>
              <button type="button" className="btn-icon" aria-label={`Remove ${w.label}`} disabled={pending} onClick={() => remove(w)}>
                <Icon name="trash" size="sm" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="btn-secondary" onClick={() => setOpen(true)}>
        <Icon name="plus" size="sm" /> Log a workout
      </button>

      {doubleCount && (
        <div className={s.workoutHint} role="note">
          <p>Your target already assumes “{data.activity ? ACTIVITY[data.activity].label : ''}”. Now that workouts are logged, switch to a light base so they aren’t counted twice?</p>
          <button type="button" className="btn-text" onClick={lightBase} disabled={pending}>Use light base</button>
        </div>
      )}

      {data.strava.configured && (
        <div className={s.stravaLine}>
          {connection ? (
            <>
              <span><b>Strava</b> · {syncing ? 'syncing…' : ago(connection.last_sync_at)}</span>
              <button type="button" className="btn-text" onClick={() => runSync(true)} disabled={syncing}>Sync now</button>
            </>
          ) : (
            <>
              <span>Auto-import runs, rides and classes.</span>
              <a className="btn-text" href="/api/strava/connect">Connect Strava</a>
            </>
          )}
        </div>
      )}

      <WorkoutSheet open={open} onClose={() => setOpen(false)} day={day} weightKg={data.weightKg} />
    </section>
  );
}

function WorkoutSheet({ open, onClose, day, weightKg }: { open: boolean; onClose: () => void; day: string; weightKg: number }) {
  const toast = useToast();
  const ids = useId();
  const [kind, setKind] = useState<string>('hiit');
  const [minutes, setMinutes] = useState('45');
  const [watchKcal, setWatchKcal] = useState('');
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const preset = WORKOUT_PRESETS.find(p => p.kind === kind)!;
  const mins = Number(minutes);
  const estimate = useMemo(() => estimateBurn(preset.met, weightKg, Number.isFinite(mins) ? mins : 0), [preset.met, weightKg, mins]);
  const device = watchKcal.trim() ? Number(watchKcal) : null;
  const kcal = device !== null && Number.isFinite(device) ? Math.round(device) : estimate;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!Number.isInteger(mins) || mins < 1 || mins > 600) { setError('Minutes: a whole number from 1 to 600.'); return; }
    if (device !== null && (!Number.isFinite(device) || device < 0 || device > 5000)) { setError('Watch calories: 0 to 5,000 kcal.'); return; }
    setError('');
    start(async () => {
      const r = await addWorkout({ day, kind, label: preset.label, minutes: mins, kcal, kcalSource: device !== null ? 'device' : 'estimate' });
      if (!r.ok) { setError(r.error); return; }
      toast(`Logged ${preset.label.toLowerCase()} · ${fmt(kcal)} kcal.`, {
        undo: async () => { const u = await removeWorkout(r.data.id); if (!u.ok) toast(u.error); },
      });
      setWatchKcal('');
      onClose();
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log a workout" labelledBy={`${ids}-t`}>
      <form onSubmit={submit} noValidate>
        <fieldset className={s.presetSet}>
          <legend className="field-label">What did you do?</legend>
          <div className={s.presetGrid}>
            {WORKOUT_PRESETS.map(p => (
              <button key={p.kind} type="button" className="pill-choice" aria-pressed={kind === p.kind} onClick={() => setKind(p.kind)}>
                <Icon name={p.icon as IconName} size="sm" /> {p.label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className={s.workoutFields}>
          <div className="field">
            <label htmlFor={`${ids}-m`}>Minutes</label>
            <input id={`${ids}-m`} type="number" inputMode="numeric" min={1} max={600} step={5} value={minutes} onChange={e => setMinutes(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`${ids}-k`}>Calories from your watch <span className="muted">(optional)</span></label>
            <input id={`${ids}-k`} type="number" inputMode="numeric" min={0} max={5000} placeholder={`≈ ${fmt(estimate)}`} value={watchKcal} onChange={e => setWatchKcal(e.target.value)} aria-describedby={`${ids}-kh`} />
            <p className="field-help" id={`${ids}-kh`}>Use your watch’s <b>active</b> calories if you have them.</p>
          </div>
        </div>
        <p className={s.workoutPreview} aria-live="polite">
          <b>{fmt(kcal)} kcal</b> burned · <b>+{fmt(exerciseCredit(kcal))}</b> to the day’s target
          <small>{device !== null ? 'From your watch.' : `Estimate for ${weightKg} kg. Real burn varies with effort.`}</small>
        </p>
        <p className="error-text" role="alert">{error}</p>
        <button type="submit" className="btn accent full" disabled={pending} aria-busy={pending || undefined}>{pending ? 'Saving…' : 'Log workout'}</button>
      </form>
    </Sheet>
  );
}
