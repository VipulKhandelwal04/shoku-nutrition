'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Targets } from '@/lib/nutrition';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import type { ConnectionStatus } from '@/lib/types';
import { BodyForm, TargetsForm, type BodyValues } from './ProfileForms';
import s from './profile.module.css';

type SheetKind = 'body' | 'targets' | 'strava';

const STRAVA_MSG: Record<string, string> = {
  connected: 'Strava connected. Recent workouts are imported.',
  cancelled: 'Strava wasn’t connected.',
  scope: 'Strava needs permission to read activities. Try again and keep that box ticked.',
  error: 'Couldn’t connect Strava. Try again.',
  unavailable: 'Strava isn’t available right now.',
};
type PlanRow = { label: string; value: string; sheet: SheetKind; icon: IconName };

/** iOS-style grouped settings list. Plan rows open their form in a sheet; the rest are links. */
export function ProfileMenu({ plan, initial, targets, recommended, isAdmin, strava }: {
  plan: PlanRow[];
  initial: BodyValues;
  targets: Targets;
  recommended: Targets | null;
  isAdmin: boolean;
  strava: { configured: boolean; connection: ConnectionStatus | null };
}) {
  const [open, setOpen] = useState<SheetKind | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();

  // Result of the Strava OAuth round trip, shown once, then removed from the URL.
  const result = params.get('strava');
  useEffect(() => {
    if (!result) return;
    toast(STRAVA_MSG[result] ?? STRAVA_MSG.error);
    router.replace('/app/profile', { scroll: false });
  }, [result, toast, router]);

  async function disconnectStrava() {
    setBusy(true);
    try {
      const r = await fetch('/api/strava/disconnect', { method: 'POST' });
      const j = (await r.json()) as { ok: boolean; error?: string };
      toast(j.ok ? 'Strava disconnected. Imported workouts were removed.' : (j.error ?? 'Couldn’t disconnect Strava.'));
      if (j.ok) { setOpen(null); router.refresh(); }
    } catch {
      toast('Couldn’t disconnect Strava. Check your connection.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section aria-labelledby="pm-plan">
        <h2 id="pm-plan" className={s.groupTitle}>Your plan</h2>
        <ul className={s.group}>
          {plan.map(r => (
            <li key={r.label}>
              <button type="button" className={s.row} onClick={() => setOpen(r.sheet)}>
                <span className={s.rowIcon}><Icon name={r.icon} size="sm" /></span>
                <span className={s.rowText}>
                  <span className={s.rowLabel}>{r.label}</span>
                  <span className={s.rowValue}>{r.value}</span>
                </span>
                <Icon name="next" size="sm" className={s.chev} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      {strava.configured && (
        <section aria-labelledby="pm-apps">
          <h2 id="pm-apps" className={s.groupTitle}>Connected apps</h2>
          <ul className={s.group}>
            <li>
              {strava.connection ? (
                <button type="button" className={s.row} onClick={() => setOpen('strava')}>
                  <span className={`${s.rowIcon} ${s.strava}`}><Icon name="arrow" size="sm" /></span>
                  <span className={s.rowText}>
                    <span className={s.rowLabel}>Strava</span>
                    <span className={s.rowValue}>Connected{strava.connection.display_name ? ` as ${strava.connection.display_name}` : ''} · workouts import automatically</span>
                  </span>
                  <Icon name="next" size="sm" className={s.chev} />
                </button>
              ) : (
                <a className={s.row} href="/api/strava/connect">
                  <span className={`${s.rowIcon} ${s.strava}`}><Icon name="arrow" size="sm" /></span>
                  <span className={s.rowText}>
                    <span className={s.rowLabel}>Connect Strava</span>
                    <span className={s.rowValue}>Import runs, rides and classes as calories burned</span>
                  </span>
                  <Icon name="next" size="sm" className={s.chev} />
                </a>
              )}
            </li>
          </ul>
        </section>
      )}

      <section aria-labelledby="pm-data">
        <h2 id="pm-data" className={s.groupTitle}>Data and privacy</h2>
        <ul className={s.group}>
          <li>
            <a className={s.row} href="/app/profile/export" download>
              <span className={s.rowIcon}><Icon name="download" size="sm" /></span>
              <span className={s.rowText}>
                <span className={s.rowLabel}>Download my data</span>
                <span className={s.rowValue}>Profile, diary, water and custom foods as JSON</span>
              </span>
              <Icon name="next" size="sm" className={s.chev} />
            </a>
          </li>
          <li>
            <Link className={s.row} href="/privacy">
              <span className={s.rowIcon}><Icon name="lock" size="sm" /></span>
              <span className={s.rowText}><span className={s.rowLabel}>Privacy</span></span>
              <Icon name="next" size="sm" className={s.chev} />
            </Link>
          </li>
          <li>
            <Link className={s.row} href="/terms">
              <span className={s.rowIcon}><Icon name="file" size="sm" /></span>
              <span className={s.rowText}><span className={s.rowLabel}>Terms</span></span>
              <Icon name="next" size="sm" className={s.chev} />
            </Link>
          </li>
          {isAdmin && (
            <li>
              <Link className={s.row} href="/admin">
                <span className={s.rowIcon}><Icon name="shield" size="sm" /></span>
                <span className={s.rowText}><span className={s.rowLabel}>Admin console</span></span>
                <Icon name="next" size="sm" className={s.chev} />
              </Link>
            </li>
          )}
        </ul>
      </section>

      <form action="/auth/signout" method="post" className={s.group}>
        <button type="submit" className={`${s.row} ${s.signOut}`}>
          <span className={s.rowIcon}><Icon name="logout" size="sm" /></span>
          <span className={s.rowText}><span className={s.rowLabel}>Sign out</span></span>
        </button>
      </form>

      <Sheet open={open === 'strava'} onClose={() => setOpen(null)} title="Strava" labelledBy="pm-strava-title">
        <p className={s.sheetText}>
          Shoku reads your Strava activities (name, type, duration and calories) to count calories burned. It never posts to Strava.
        </p>
        <p className={s.sheetText}>Disconnecting revokes Shoku’s access at Strava and deletes the workouts imported from it. Workouts you logged yourself stay.</p>
        <button type="button" className={`btn full ${s.dangerBtn}`} onClick={disconnectStrava} disabled={busy} aria-busy={busy || undefined}>
          {busy ? 'Disconnecting…' : 'Disconnect Strava'}
        </button>
      </Sheet>

      <Sheet open={open === 'body'} onClose={() => setOpen(null)} title="Goal and body" labelledBy="pm-body-title">
        <BodyForm initial={initial} bare />
      </Sheet>
      <Sheet open={open === 'targets'} onClose={() => setOpen(null)} title="Daily targets" labelledBy="pm-targets-title">
        <TargetsForm key={JSON.stringify(targets)} initial={targets} recommended={recommended} bare />
      </Sheet>
    </>
  );
}
