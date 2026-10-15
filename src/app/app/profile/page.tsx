import Image from 'next/image';
import { requireOnboarded } from '@/lib/auth';
import { recommend } from '@/lib/nutrition';
import { Icon } from '@/components/ui/Icon';
import { RESTRICTION_SLUGS, bodyOf, pickTargets, type Restriction } from '@/components/app/insights/insights';
import ins from '@/components/app/insights/insights.module.css';
import { BodyForm, TargetsForm, type BodyValues } from './ProfileForms';
import s from './profile.module.css';

export const metadata = { title: 'Profile' };

const GOOGLE_PHOTO = /^https:\/\/lh3\.googleusercontent\.com\//;

export default async function ProfilePage() {
  const profile = await requireOnboarded('/app/profile');
  const body = bodyOf(profile);
  const recommended = body ? pickTargets(recommend(body)) : null;
  const str = (n: number | null) => (n === null || n === undefined ? '' : String(Number(n)));
  const initial: BodyValues = {
    goal: profile.goal ?? 'fit', sex: profile.sex, age: str(profile.age), height: str(profile.height_cm), weight: str(profile.weight_kg),
    activity: profile.activity, diet: profile.diet ?? 'veg',
    restrictions: (profile.restrictions ?? []).filter((r): r is Restriction => (RESTRICTION_SLUGS as string[]).includes(r)),
  };
  const name = profile.display_name || profile.email?.split('@')[0] || 'You';
  const initials = name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const targets = profile.targets!;

  return (
    <div>
      <header className={ins.intro}>
        <div>
          <p className={ins.eyebrow}>Make it yours</p>
          <h1>Your targets. Your call.</h1>
          <p>Edit your goal, body details and daily targets. Download your data any time.</p>
        </div>
      </header>

      <div className={s.layout}>
        <div className="stack">
          <BodyForm initial={initial} />
          <TargetsForm key={JSON.stringify(targets)} initial={targets} recommended={recommended} />
        </div>

        <aside className="stack" aria-label="Account">
          <section className={`panel panel-pad ${s.card}`} aria-labelledby="account-title">
            <h2 id="account-title">Account</h2>
            <div className={s.account}>
              {profile.avatar_url && GOOGLE_PHOTO.test(profile.avatar_url) ? (
                <Image src={profile.avatar_url} alt="" width={64} height={64} className={s.avatar} />
              ) : (
                <span className={s.avatar} aria-hidden="true">{initials}</span>
              )}
              <div className={s.accountText}>
                <strong>{name}</strong>
                {profile.email && <span className="muted">{profile.email}</span>}
                <span className={s.google}><Icon name="google" size="sm" /> Signed in with Google</span>
              </div>
            </div>
            <form action="/auth/signout" method="post">
              <button type="submit" className="btn-secondary"><Icon name="logout" size="sm" /> Sign out</button>
            </form>
          </section>

          <section className={`panel panel-pad ${s.card}`} aria-labelledby="data-title">
            <h2 id="data-title">Your data</h2>
            <p className={s.sub}>Your profile, every diary entry, water and day logs, and your custom foods, as one JSON file.</p>
            <a className="btn-secondary" href="/app/profile/export" download>
              <Icon name="download" size="sm" /> Download my data
            </a>
            <p className="fine-print" style={{ marginTop: 14 }}>Meal photos stay in your private storage and aren’t included in the file.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
