import type { Metadata } from 'next';
import { TodayView } from '@/components/app/log/TodayView';
import { loadDiaryWindow } from '@/components/app/log/load';
import { requireOnboarded } from '@/lib/auth';
import { getAiAssist, getConnections, getWorkouts, isStravaConfigured } from '@/lib/data/queries';
import { shiftDate } from '@/lib/nutrition';

export const metadata: Metadata = { title: 'Today' };

export default async function TodayPage({ searchParams }: PageProps<'/app'>) {
  const [profile, data, ai, connections] = await Promise.all([requireOnboarded(), searchParams.then(loadDiaryWindow), getAiAssist(), getConnections()]);
  // Same window the diary loads around: the client may resolve "today" a day either side of the server's guess.
  const anchor = data.requestedDay ?? data.serverToday;
  const workouts = await getWorkouts(shiftDate(anchor, -2), shiftDate(anchor, 1));
  // requireOnboarded guarantees targets.
  const targets = profile.targets!;
  return (
    <TodayView
      data={{ ...data, targets, diet: profile.diet }}
      ai={ai}
      workouts={{
        workouts,
        strava: { configured: isStravaConfigured(), connection: connections.find(c => c.provider === 'strava') ?? null },
        weightKg: Number(profile.weight_kg ?? 70),
        activity: profile.activity,
      }}
    />
  );
}
