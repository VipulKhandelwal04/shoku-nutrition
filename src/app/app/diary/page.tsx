import type { Metadata } from 'next';
import { DiaryView } from '@/components/app/log/DiaryView';
import { loadDiaryWindow } from '@/components/app/log/load';
import { requireOnboarded } from '@/lib/auth';
import { getFlags } from '@/lib/data/queries';
import { isOn } from '@/lib/flags';

export const metadata: Metadata = { title: 'Diary' };

export default async function DiaryPage({ searchParams }: PageProps<'/app/diary'>) {
  const [profile, data, flags] = await Promise.all([requireOnboarded('/app/diary'), searchParams.then(loadDiaryWindow), getFlags()]);
  const targets = profile.targets!;
  return <DiaryView data={{ ...data, targets, diet: profile.diet, rateMeals: isOn(flags, 'feedback', 'meals') }} />;
}
