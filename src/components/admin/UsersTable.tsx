'use client';
import { useDeferredValue, useMemo, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { setUserDisabled, setUserRole } from '@/lib/admin/actions';
import { matchesUser, shortDate, type UserStatRow } from '@/lib/admin/stats';
import s from './admin.module.css';
import { ConfirmDialog, useAdminAction } from './primitives';

type Pending = { user: UserStatRow; kind: 'promote' | 'demote' | 'pause' | 'restore' };

const label = (u: UserStatRow) => u.display_name?.trim() || u.email || 'This member';

export function UsersTable({ users, meId }: { users: UserStatRow[]; meId: string }) {
  const [query, setQuery] = useState('');
  const [ask, setAsk] = useState<Pending | null>(null);
  const { run, pending } = useAdminAction();
  const q = useDeferredValue(query);
  const rows = useMemo(() => users.filter(u => matchesUser(u, q)), [users, q]);

  const confirmCopy = (p: Pending) => {
    const n = label(p.user);
    const self = p.user.id === meId;
    switch (p.kind) {
      case 'promote': return { title: `Make ${n} an admin?`, cta: 'Make admin', tone: 'default' as const, body: `${n} will be able to edit the catalogue, content, AI Assist and settings, and manage other members. They still can’t see anyone’s meals.` };
      case 'demote': return { title: self ? 'Remove your own admin access?' : `Remove admin from ${n}?`, cta: 'Remove admin', tone: 'danger' as const, body: self ? 'You’ll lose access to this console right away. Another admin will have to add you back.' : `${n} goes back to a regular member account.` };
      case 'pause': return { title: `Pause ${n}?`, cta: 'Pause account', tone: 'danger' as const, body: `${n} is signed out on their next visit and can’t sign in until restored. Nothing they logged is deleted.` };
      case 'restore': return { title: `Restore ${n}?`, cta: 'Restore', tone: 'default' as const, body: `${n} can sign in again and picks up where they left off.` };
    }
  };

  const act = (p: Pending) => {
    const id = p.user.id;
    if (p.kind === 'promote') run(() => setUserRole(id, 'admin'));
    if (p.kind === 'demote') run(() => setUserRole(id, 'user'));
    if (p.kind === 'pause') run(() => setUserDisabled(id, true));
    if (p.kind === 'restore') run(() => setUserDisabled(id, false));
  };

  const copy = ask ? confirmCopy(ask) : null;

  return (
    <>
      <p className={s.privacy}><Icon name="shield" size="sm" />Admins see activity counts only, never anyone’s meals.</p>

      <div className={s.toolbar} role="search" aria-label="Find a member">
        <div className={s.search}>
          <label htmlFor="user-q" className="sr-only">Search by name or email</label>
          <Icon name="search" size="sm" />
          <input id="user-q" type="search" placeholder="Search name or email" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" />
        </div>
        <span className={s.count} aria-live="polite">{rows.length === users.length ? `${users.length} members` : `${rows.length} of ${users.length}`}</span>
      </div>

      <div className={s.tableWrap}>
        {users.length === 0 ? (
          <div className={s.empty}><strong>No members yet</strong><p>People appear here after their first Google sign-in.</p></div>
        ) : rows.length === 0 ? (
          <div className={s.empty}><strong>No matches</strong><p>No one’s name or email contains “{query.trim()}”.</p></div>
        ) : (
          <table className={s.table} style={{ minWidth: 1040 }}>
            <caption>Members, newest first. Activity counts come from aggregate stats only.</caption>
            <thead>
              <tr>
                <th scope="col">Member</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Joined</th>
                <th scope="col">Onboarded</th>
                <th scope="col">Last logged</th>
                <th scope="col" className={s.num}>Days logged <span className="sr-only">in the last 30 days</span><span aria-hidden="true">· 30d</span></th>
                <th scope="col" className={s.num}>AI today</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(u => {
                const me = u.id === meId;
                return (
                  <tr key={u.id} className={u.disabled ? s.inactiveRow : undefined}>
                    <th scope="row" className={s.rowHead}>
                      <div className={s.cellMain}>
                        <div style={{ minWidth: 0 }}>
                          <strong>{u.display_name || 'No name'}{me && <span className="chip accent" style={{ marginLeft: 8 }}>You</span>}</strong>
                          <span>{u.email ?? 'No email'}</span>
                        </div>
                      </div>
                    </th>
                    <td><span className={`chip ${u.role === 'admin' ? 'accent' : ''}`}>{u.role === 'admin' ? 'Admin' : 'Member'}</span></td>
                    <td><span className={`chip ${u.disabled ? s.dangerChip : 'ok'}`}>{u.disabled ? 'Paused' : 'Active'}</span></td>
                    <td className={s.nowrap}>{shortDate(u.created_at)}</td>
                    <td className={s.nowrap}>{u.onboarded_at ? shortDate(u.onboarded_at) : <span className="muted">Not yet</span>}</td>
                    <td className={s.nowrap}>{shortDate(u.last_logged)}</td>
                    <td className={s.num}>{u.days_logged_30d}</td>
                    <td className={s.num}>{u.ai_calls_today}</td>
                    <td>
                      <div className={s.actions}>
                        {u.role === 'admin' ? (
                          <button type="button" className="btn-text" disabled={pending} onClick={() => setAsk({ user: u, kind: 'demote' })}>Remove admin</button>
                        ) : (
                          <button type="button" className="btn-text" disabled={pending || u.disabled} onClick={() => setAsk({ user: u, kind: 'promote' })} title={u.disabled ? 'Restore the account first' : undefined}>Make admin</button>
                        )}
                        {u.disabled ? (
                          <button type="button" className="btn-text" disabled={pending} onClick={() => setAsk({ user: u, kind: 'restore' })}>Restore</button>
                        ) : (
                          <button type="button" className={`btn-text ${s.dangerBtn}`} disabled={pending || me} title={me ? 'You can’t pause your own account' : undefined} aria-label={me ? 'Pause (not available for your own account)' : `Pause ${label(u)}`} onClick={() => setAsk({ user: u, kind: 'pause' })}>Pause</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={ask !== null}
        title={copy?.title ?? ''}
        confirmLabel={copy?.cta ?? 'Confirm'}
        tone={copy?.tone}
        onCancel={() => setAsk(null)}
        onConfirm={() => { const p = ask; setAsk(null); if (p) act(p); }}
      >
        <p>{copy?.body}</p>
      </ConfirmDialog>
    </>
  );
}
