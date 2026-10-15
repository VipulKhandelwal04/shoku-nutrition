import type { Metadata } from 'next';
import { AdminNav } from '@/components/admin/AdminNav';
import s from '@/components/admin/admin.module.css';
import { ToastProvider } from '@/components/ui/Toast';
import { requireAdmin } from '@/lib/auth';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Shoku admin' }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  // Signed-out visitors go to /login, non-admins to /app. Every server action re-checks on its own too.
  const admin = await requireAdmin();
  const name = admin.display_name?.trim() || admin.email?.split('@')[0] || 'Admin';

  return (
    <ToastProvider>
      <div className={s.shell}>
        <AdminNav name={name} email={admin.email} />
        <main id="main" className={s.main}>{children}</main>
      </div>
    </ToastProvider>
  );
}
