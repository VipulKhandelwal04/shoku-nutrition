'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { firstIssue, onboardingSchema, type OnboardingInput } from '@/components/app/insights/schemas';

/** Validates the whole onboarding draft, saves it to the profile and sends the user to Today. Returns only on error. */
export async function completeOnboarding(input: OnboardingInput): Promise<{ ok: false; error: string }> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: 'Your session ended. Sign in again to finish setting up.' };
  const d = parsed.data;
  const { error } = await supabase.from('profiles').update({
    goal: d.goal, sex: d.sex, age: d.age, height_cm: d.height, weight_kg: d.weight, activity: d.activity,
    diet: d.diet, restrictions: d.restrictions, targets: d.targets, onboarded_at: new Date().toISOString(),
  }).eq('id', auth.user.id);
  if (error) return { ok: false, error: 'Couldn’t save your setup. Check your connection and try again.' };
  revalidatePath('/', 'layout');
  redirect('/app');
}
