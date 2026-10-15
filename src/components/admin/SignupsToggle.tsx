'use client';
import { useState } from 'react';
import { saveFeatureSettings } from '@/lib/admin/actions';
import s from './admin.module.css';
import { Switch, useAdminAction } from './primitives';

export function SignupsToggle({ initial }: { initial: boolean }) {
  const [open, setOpen] = useState(initial);
  const { run, pending } = useAdminAction();

  const save = (next: boolean) => {
    const prev = open;
    setOpen(next);
    run(() => saveFeatureSettings({ signups_open: next }), {
      undo: async () => { setOpen(prev); return saveFeatureSettings({ signups_open: prev }); },
      onDone: r => { if (!r.ok) setOpen(prev); },
    });
  };

  return (
    <section className={s.settingCard} aria-labelledby="signups-h">
      <div>
        <h2 id="signups-h">New sign-ups</h2>
        <p id="signups-d">
          {open
            ? 'Open: anyone with a Google account can join Shoku from the home page.'
            : 'Closed: new Google accounts are turned away with a friendly note. Existing members sign in as usual.'}
        </p>
        <p className="fine-print" style={{ marginTop: 8 }}>Close sign-ups to run a private beta or to pause growth while you fix something. Nobody already in loses access. Turned-away sign-ins can still appear in Users as not onboarded.</p>
      </div>
      <Switch pressed={open} label="Sign-ups open" hideLabel describedBy="signups-d" disabled={pending} onChange={save} />
    </section>
  );
}
