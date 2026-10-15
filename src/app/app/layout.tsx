import { AppChrome } from '@/components/app/shell/AppChrome';
import { Splash } from '@/components/splash/Splash';
import { ToastProvider } from '@/components/ui/Toast';
import { requireOnboarded } from '@/lib/auth';
import { getAiAssist, getFlags, getQuotes } from '@/lib/data/queries';
import { isOn } from '@/lib/flags';

export default async function AppLayout({ children }: LayoutProps<'/app'>) {
  const [profile, quotes, ai, flags] = await Promise.all([requireOnboarded(), getQuotes(), getAiAssist(), getFlags()]);
  const hide = [!isOn(flags, 'compare') && '/app/compare', !isOn(flags, 'progress') && '/app/progress'].filter((h): h is string => !!h);
  const ask = ai.features.ask ? {
    workouts: profile.use_workouts === false ? 'off' as const : profile.ask_workouts ? 'ask' as const : 'use' as const,
    rateIdeas: isOn(flags, 'feedback', 'ideas'),
  } : null;
  const name = profile.display_name?.trim() || profile.email?.split('@')[0] || 'You';
  return (
    <ToastProvider>
      <Splash quotes={quotes.map(q => ({ text: q.text, author: q.author }))} storageKey="shoku-app-splash" />
      <AppChrome user={{ name, avatarUrl: profile.avatar_url, isAdmin: profile.role === 'admin' }} ask={ask} hide={hide}>
        {children}
      </AppChrome>
    </ToastProvider>
  );
}
