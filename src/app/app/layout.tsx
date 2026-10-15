import { AppChrome } from '@/components/app/shell/AppChrome';
import { Splash } from '@/components/splash/Splash';
import { ToastProvider } from '@/components/ui/Toast';
import { requireOnboarded } from '@/lib/auth';
import { getQuotes } from '@/lib/data/queries';

export default async function AppLayout({ children }: LayoutProps<'/app'>) {
  const [profile, quotes] = await Promise.all([requireOnboarded(), getQuotes()]);
  const name = profile.display_name?.trim() || profile.email?.split('@')[0] || 'You';
  return (
    <ToastProvider>
      <Splash quotes={quotes.map(q => ({ text: q.text, author: q.author }))} storageKey="shoku-app-splash" />
      <AppChrome user={{ name, avatarUrl: profile.avatar_url, isAdmin: profile.role === 'admin' }}>
        {children}
      </AppChrome>
    </ToastProvider>
  );
}
