import type { Metadata } from 'next';
import { TodayView } from '@/components/app/log/TodayView';
import { loadDiaryWindow } from '@/components/app/log/load';
import { requireOnboarded } from '@/lib/auth';
import { getAiAssist } from '@/lib/data/queries';

export const metadata: Metadata = { title: 'Today' };

export default async function TodayPage({ searchParams }: PageProps<'/app'>) {
  const [profile, data, ai] = await Promise.all([requireOnboarded(), searchParams.then(loadDiaryWindow), getAiAssist()]);
  // requireOnboarded guarantees targets.
  const targets = profile.targets!;
  return <TodayView data={{ ...data, targets, diet: profile.diet }} ai={ai} />;
}
