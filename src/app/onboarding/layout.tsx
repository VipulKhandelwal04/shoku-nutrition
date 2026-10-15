import { redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata = { title: 'Set up' };

export default async function OnboardingLayout({ children }: LayoutProps<'/onboarding'>) {
  const profile = await requireProfile('/onboarding');
  if (profile.onboarded_at && profile.targets) redirect('/app');
  return <ToastProvider>{children}</ToastProvider>;
}
