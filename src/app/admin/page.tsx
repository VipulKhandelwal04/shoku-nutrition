import type { Metadata } from 'next';
import Link from 'next/link';
import s from '@/components/admin/admin.module.css';
import { Icon, type IconName } from '@/components/ui/Icon';
import { adminAiSettings, adminAiUsage, adminFoods, adminUserStats } from '@/lib/admin/queries';
import { istToday, summarizeUsers } from '@/lib/admin/stats';
import { getAiAssist } from '@/lib/data/queries';

export const metadata: Metadata = { title: 'Overview' };

const QUICK: { href: string; title: string; body: string; icon: IconName }[] = [
  { href: '/admin/foods', title: 'Food catalogue', body: 'Add, fix or retire foods', icon: 'bowl' },
  { href: '/admin/content', title: 'Splash & tour', body: 'Quotes and home slides', icon: 'quote' },
  { href: '/admin/users', title: 'Members', body: 'Roles and account status', icon: 'users' },
  { href: '/admin/ai', title: 'AI Assist', body: 'Master switch, limits, usage', icon: 'spark' },
  { href: '/admin/settings', title: 'Sign-ups', body: 'Open or close new accounts', icon: 'sliders' },
];

export default async function OverviewPage() {
  const today = istToday();
  const [users, usage, assist, ai, foods] = await Promise.all([adminUserStats(), adminAiUsage(1), getAiAssist(), adminAiSettings(), adminFoods()]);
  const u = summarizeUsers(users, today);
  const todayUsage = usage.filter(r => String(r.day).slice(0, 10) === today);
  const calls = todayUsage.reduce((n, r) => n + r.calls, 0);
  const failures = todayUsage.reduce((n, r) => n + r.failures, 0);
  const liveFoods = foods.filter(f => f.active).length;

  const aiState = !ai.enabled ? 'Off' : !assist.configured ? 'No key' : assist.available ? 'On' : 'Paused';
  const aiMeta = !ai.enabled
    ? 'Switched off. No AI buttons show.'
    : !assist.configured
      ? 'Set GEMINI_API_KEY in Vercel'
      : assist.available
        ? `${Object.values(assist.features).filter(Boolean).length} of 4 features live`
        : 'Every feature is switched off';

  return (
    <>
      <div className={s.head}>
        <div>
          <p className="label">Admin</p>
          <h1>Overview</h1>
          <p>Counts only. Admins never see what anyone eats.</p>
        </div>
      </div>

      <section aria-labelledby="stats-h">
        <h2 id="stats-h" className="sr-only">Key numbers</h2>
        <div className={s.tiles}>
          <Tile label="Members" value={u.users} meta={u.paused ? `${u.paused} paused` : u.users <= 1 ? 'Just you so far' : `${u.admins} admin${u.admins === 1 ? '' : 's'}`} />
          <Tile label="Onboarded" value={u.onboarded} suffix={u.users ? `/${u.users}` : undefined} meta={u.users ? `${Math.round((u.onboarded / u.users) * 100)}% finished setup` : 'Nobody yet'} />
          <Tile label="Active · 7 days" value={u.active7d} meta={u.active7d ? 'Logged a meal this week' : 'No meals logged this week'} accent={u.active7d > 0} />
          <Tile label="AI calls today" value={calls} meta={calls ? (failures ? `${failures} failed` : 'No failures') : 'None yet today'} />
          <Tile label="AI Assist" value={aiState} meta={aiMeta} accent={aiState === 'On'} off={aiState !== 'On'} href="/admin/ai" />
          <Tile label="Foods live" value={liveFoods} suffix={foods.length !== liveFoods ? `/${foods.length}` : undefined} meta={foods.length ? 'In the shared catalogue' : 'Catalogue is empty. Add the first food.'} href="/admin/foods" />
        </div>
      </section>

      {u.users <= 1 && (
        <p className="note" style={{ marginTop: 16 }}>
          Fresh deployment: once people sign in with Google, their activity counts appear here. Check the splash quotes and tour
          slides in <Link href="/admin/content">Content</Link> before you share the link.
        </p>
      )}

      <section className={s.section} aria-labelledby="quick-h">
        <h2 id="quick-h">Jump to</h2>
        <p className={s.sectionSub}>Everything you can change lives in one of these.</p>
        <div className={s.quick}>
          {QUICK.map(q => (
            <Link key={q.href} href={q.href} className={s.quickLink}>
              <Icon name={q.icon} />
              <div>
                <strong>{q.title}</strong>
                <span>{q.body}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

function Tile({ label, value, suffix, meta, accent, off, href }: { label: string; value: number | string; suffix?: string; meta: string; accent?: boolean; off?: boolean; href?: string }) {
  const body = (
    <>
      <span className="label">{label}</span>
      <span className={s.tileNum}>{value}{suffix && <small>{suffix}</small>}</span>
      <span className={s.tileMeta}>{meta}</span>
    </>
  );
  const cls = `${s.tile} ${accent ? s.tileAccent : ''} ${off ? s.tileOff : ''}`;
  return href ? <Link href={href} className={cls} style={{ color: 'inherit' }}>{body}</Link> : <div className={cls}>{body}</div>;
}
