'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Targets } from '@/lib/nutrition';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import type { CuisinePrefs, FeedbackRow } from '@/lib/preferences';
import type { ConnectionStatus } from '@/lib/types';
import { ActivitySwitches, CuisineForm, RatingsList } from './PreferenceForms';
import { BodyForm, TargetsForm, type BodyValues } from './ProfileForms';
import s from './profile.module.css';

type SheetKind = 'body' | 'targets' | 'strava' | 'style' | 'activity' | 'ratings';

const STRAVA_MSG: Record<string, string> = {
  connected: 'Strava connected. Recent workouts are imported.',
  cancelled: 'Strava wasn’t connected.',
  scope: 'Strava needs permission to read activities. Try again and keep that box ticked.',
  error: 'Couldn’t connect Strava. Try again.',
  unavailable: 'Strava isn’t available right now.',
};
type PlanRow = { label: string; value: string; sheet: SheetKind; icon: IconName };

/**
 * Health platforms people ask for. Samsung Health and Apple Health only share data with a phone app
 * (Android Health Connect / iOS HealthKit), so they can't connect from the web app yet; listed so people know.
 */
const UPCOMING_APPS: { name: string; note: string; icon: IconName }[] = [
  { name: 'Samsung Health', note: 'Galaxy Watch and phone workouts · needs the Shoku Android app (via Health Connect)', icon: 'heart' },
  { name: 'Apple Health', note: 'Apple Watch and iPhone workouts · needs the Shoku iOS app', icon: 'heart' },
  { name: 'Garmin Connect', note: 'Garmin watches and bike computers', icon: 'bolt' },
];

/** iOS-style grouped settings list. Plan rows open their form in a sheet; the rest are links. */
export function ProfileMenu({ plan, initial, targets, recommended, isAdmin, strava, upcoming, prefs }: {
  plan: PlanRow[];
  initial: BodyValues;
  targets: Targets;
  recommended: Targets | null;
  isAdmin: boolean;
  strava: { configured: boolean; connection: ConnectionStatus | null };
  /** Feature flag: list the coming-soon health apps. */
  upcoming: boolean;
  /** Meal-idea preferences. `cuisines` / `ratings` are null while their feature flag is off. */
  prefs: {
    cuisines: { value: CuisinePrefs; choices: string[] } | null;
    activity: { useWorkouts: boolean; askFirst: boolean };
    ratings: FeedbackRow[] | null;
  };
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

      {(strava.configured || strava.connection || upcoming) && (
      <section aria-labelledby="pm-apps">
        <h2 id="pm-apps" className={s.groupTitle}>Connected apps</h2>
        <ul className={s.group}>
          {/* An existing connection always shows, so members can disconnect even after Strava is switched off. */}
          {(strava.configured || strava.connection) && (
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
          )}
          {upcoming && UPCOMING_APPS.map(app => (
            <li key={app.name}>
              <div className={`${s.row} ${s.rowStatic}`}>
                <span className={s.rowIcon} aria-hidden="true"><Icon name={app.icon} size="sm" /></span>
                <span className={s.rowText}>
                  <span className={s.rowLabel}>{app.name}</span>
                  <span className={s.rowValue}>{app.note}</span>
                </span>
                <span className="chip">Soon</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
      )}

      {/* Ratings stay listed (and deletable) even after Meal feedback is switched off, as long as some exist. */}
      {prefs.ratings && (
      <section aria-labelledby="pm-feedback">
        <h2 id="pm-feedback" className={s.groupTitle}>What Shoku remembers</h2>
        <ul className={s.group}>
          <li>
            <button type="button" className={s.row} onClick={() => setOpen('ratings')}>
              <span className={s.rowIcon}><Icon name="heart" size="sm" /></span>
              <span className={s.rowText}>
                <span className={s.rowLabel}>Meal feedback</span>
                <span className={s.rowValue}>{prefs.ratings.length ? `${prefs.ratings.length} ${prefs.ratings.length === 1 ? 'rating' : 'ratings'} · only you see them` : 'Rate meals to tell Shoku what works for you'}</span>
              </span>
              <Icon name="next" size="sm" className={s.chev} />
            </button>
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
                <span className={s.rowValue}>Profile, diary, water, workouts, ratings and custom foods as JSON</span>
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

      {prefs.cuisines && (
        <Sheet open={open === 'style'} onClose={() => setOpen(null)} title="Food style" labelledBy="pm-style-title">
          <CuisineForm key={JSON.stringify(prefs.cuisines.value)} initial={prefs.cuisines.value} choices={prefs.cuisines.choices} onSaved={() => { setOpen(null); router.refresh(); }} />
          <button type="button" className={`btn-text ${s.linkBtn}`} onClick={() => setOpen('body')}>Diet and foods to skip are in Goal and body <Icon name="next" size="sm" /></button>
        </Sheet>
      )}
      <Sheet open={open === 'activity'} onClose={() => { setOpen(null); router.refresh(); }} title="Workouts in meal ideas" labelledBy="pm-activity-title">
        <ActivitySwitches initial={prefs.activity} />
      </Sheet>
      {prefs.ratings && (
        <Sheet open={open === 'ratings'} onClose={() => setOpen(null)} title="Meal feedback" labelledBy="pm-ratings-title">
          <RatingsList ratings={prefs.ratings} />
        </Sheet>
      )}

      <Sheet open={open === 'body'} onClose={() => setOpen(null)} title="Goal and body" labelledBy="pm-body-title">
        <BodyForm initial={initial} bare />
      </Sheet>
      <Sheet open={open === 'targets'} onClose={() => setOpen(null)} title="Daily targets" labelledBy="pm-targets-title">
        <TargetsForm key={JSON.stringify(targets)} initial={targets} recommended={recommended} bare />
      </Sheet>
    </>
  );
}
