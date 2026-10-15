import type { Metadata } from 'next';
import { UsersTable } from '@/components/admin/UsersTable';
import s from '@/components/admin/admin.module.css';
import { requireAdmin } from '@/lib/auth';
import { adminUserStats } from '@/lib/admin/queries';

export const metadata: Metadata = { title: 'Users' };

export default async function UsersPage() {
  const [me, users] = await Promise.all([requireAdmin(), adminUserStats()]);
  return (
    <>
      <div className={s.head}>
        <div>
          <p className="label">Members</p>
          <h1>Users</h1>
          <p>Roles and account status. Paused members can’t sign in until you restore them; their data stays untouched.</p>
        </div>
      </div>
      <UsersTable users={users} meId={me.id} />
    </>
  );
}
