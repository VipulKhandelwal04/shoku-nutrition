import type { Metadata } from 'next';
import Link from 'next/link';
import { FeatureFlagsControls } from '@/components/admin/FeatureFlags';
import s from '@/components/admin/admin.module.css';
import { getFlags } from '@/lib/data/queries';

export const metadata: Metadata = { title: 'Features' };

export default async function FeaturesPage() {
  const flags = await getFlags();
  return (
    <>
      <div className={s.head}>
        <div>
          <p className="label">App</p>
          <h1>Features</h1>
          <p>
            Each primary feature has its own switch, with its parts underneath. Turning a primary off hides it and everything under it
            for all members, and the server refuses its actions too. AI features have their own page: <Link href="/admin/ai">AI Assist</Link>.
          </p>
        </div>
      </div>
      <FeatureFlagsControls initial={flags} />
    </>
  );
}
