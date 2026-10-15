'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { Targets } from '@/lib/nutrition';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { BodyForm, TargetsForm, type BodyValues } from './ProfileForms';
import s from './profile.module.css';

type SheetKind = 'body' | 'targets';
type PlanRow = { label: string; value: string; sheet: SheetKind; icon: IconName };

/** iOS-style grouped settings list. Plan rows open their form in a sheet; the rest are links. */
export function ProfileMenu({ plan, initial, targets, recommended, isAdmin }: {
  plan: PlanRow[];
  initial: BodyValues;
  targets: Targets;
  recommended: Targets | null;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState<SheetKind | null>(null);

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

      <Sheet open={open === 'body'} onClose={() => setOpen(null)} title="Goal and body" labelledBy="pm-body-title">
        <BodyForm initial={initial} bare />
      </Sheet>
      <Sheet open={open === 'targets'} onClose={() => setOpen(null)} title="Daily targets" labelledBy="pm-targets-title">
        <TargetsForm key={JSON.stringify(targets)} initial={targets} recommended={recommended} bare />
      </Sheet>
    </>
  );
}
