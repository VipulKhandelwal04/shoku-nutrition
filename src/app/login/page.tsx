import type { Metadata } from 'next';
import { EntryTour } from '@/components/public/EntryTour';
import { FALLBACK_SLIDES, safeNext } from '@/components/public/content';
import { getTourSlides } from '@/lib/data/queries';
import { getUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Discover Shoku · Sign in',
  description: 'Take a quick tour, then sign in with Google to make Shoku yours.',
  robots: { index: false },
};
const ERRORS: Record<string, string> = {
  disabled: 'This account is paused. Contact the Shoku team.',
  oauth: 'Google sign-in didn’t finish. Try again.',
  signups_closed: 'New sign-ups are paused right now.',
};
export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const errorKey = Array.isArray(sp.error) ? sp.error[0] : sp.error;
  const [slides, user] = await Promise.all([getTourSlides().catch(() => []), getUser().catch(() => null)]);
  return <EntryTour slides={slides.length ? slides : FALLBACK_SLIDES} next={next} error={errorKey ? ERRORS[errorKey] ?? ERRORS.oauth : null} signedIn={!!user} />;
}
