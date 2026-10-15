import type { Metadata } from 'next';
import { SignupsToggle } from '@/components/admin/SignupsToggle';
import s from '@/components/admin/admin.module.css';
import { adminFeatureSettings } from '@/lib/admin/queries';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const features = await adminFeatureSettings();
  return (
    <>
      <div className={s.head}>
        <div>
          <p className="label">App</p>
          <h1>Settings</h1>
          <p>Switches that affect everyone. AI Assist has its own page.</p>
        </div>
      </div>
      <SignupsToggle initial={features.signups_open} />
    </>
  );
}
