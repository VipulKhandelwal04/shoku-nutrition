import { requireProfile } from '@/lib/auth';
import { DeviceTimeZone } from '@/components/app/insights/DeviceTimeZone';
import { RESTRICTION_SLUGS, type Restriction } from '@/components/app/insights/insights';
import { userToday } from '@/components/app/insights/server';
import { OnboardingFlow, type Draft } from './OnboardingFlow';

export default async function OnboardingPage() {
  const profile = await requireProfile('/onboarding');
  const { tz } = await userToday();
  const firstName = (profile.display_name ?? '').trim().split(/\s+/)[0] || null;
  const str = (v: number | null) => (v === null || v === undefined ? '' : String(Number(v)));
  // Pre-fill anything already saved (e.g. the user left halfway through and came back).
  const initial: Draft = {
    goal: profile.goal, sex: profile.sex, age: str(profile.age), height: str(profile.height_cm), weight: str(profile.weight_kg),
    activity: profile.activity, diet: profile.diet ?? 'veg',
    restrictions: (profile.restrictions ?? []).filter((r): r is Restriction => (RESTRICTION_SLUGS as string[]).includes(r)),
    targets: null, basis: null,
  };
  return (
    <>
      <DeviceTimeZone current={tz} />
      <OnboardingFlow firstName={firstName} initial={initial} />
    </>
  );
}
