import type { Metadata } from 'next';
import { AiControls } from '@/components/admin/AiControls';
import { UsageChart } from '@/components/admin/UsageChart';
import s from '@/components/admin/admin.module.css';
import { adminAiSettings, adminAiUsage } from '@/lib/admin/queries';
import { istToday, usageByDay } from '@/lib/admin/stats';
import { getAiAssist } from '@/lib/data/queries';

export const metadata: Metadata = { title: 'AI Assist' };

const DAYS = 14;

export default async function AiPage() {
  const [settings, assist, usage] = await Promise.all([adminAiSettings(), getAiAssist(), adminAiUsage(DAYS)]);
  const days = usageByDay(usage, istToday(), DAYS);

  return (
    <>
      <div className={s.head}>
        <div>
          <p className="label">Gemini</p>
          <h1>AI Assist</h1>
          <p>One switch decides whether members see any AI at all. Every AI answer is shown as a suggestion they confirm.</p>
        </div>
      </div>

      <AiControls initial={settings} configured={assist.configured} />

      <section className={s.section} aria-labelledby="ai-usage-h">
        <h2 id="ai-usage-h">Usage</h2>
        <p className={s.sectionSub}>All members combined, last {DAYS} days. The Gemini API key lives in Vercel environment variables, not here.</p>
        <UsageChart days={days} />
      </section>
    </>
  );
}
