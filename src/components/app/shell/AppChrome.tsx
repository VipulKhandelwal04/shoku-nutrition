'use client';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import s from './shell.module.css';

export type ShellUser = { name: string; avatarUrl: string | null; isAdmin: boolean };

const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: '/app', label: 'Today', icon: 'sun' },
  { href: '/app/diary', label: 'Diary', icon: 'diary' },
  { href: '/app/compare', label: 'Compare', icon: 'plate' },
  { href: '/app/progress', label: 'Progress', icon: 'chart' },
];
const TABS = [...NAV, { href: '/app/profile', label: 'You', icon: 'user' as IconName }];

function isActive(pathname: string, href: string) {
  return href === '/app' ? pathname === '/app' : pathname === href || pathname.startsWith(`${href}/`);
}

/** Google photos only: next.config allows that host. Anything else falls back to initials. */
function canOptimise(url: string) {
  try {
    return new URL(url).hostname === 'lh3.googleusercontent.com';
  } catch {
    return false;
  }
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? 'S') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function AppChrome({ user, children }: { user: ShellUser; children: ReactNode }) {
  const pathname = usePathname();
  const profileActive = isActive(pathname, '/app/profile');
  return (
    <>
      <a href="#main" className={s.skip}>Skip to content</a>
      <header className={s.topbar}>
        <div className={s.topbarInner}>
          <Link href="/app" className={s.brand} aria-label="Shoku, today">
            <span className={s.brandMark} aria-hidden="true" lang="ja">食</span>
            <span className={s.brandName}>Shoku</span>
          </Link>
          <nav className={s.topLinks} aria-label="Main">
            {NAV.map(n => (
              <Link key={n.href} href={n.href} aria-current={isActive(pathname, n.href) ? 'page' : undefined}>{n.label}</Link>
            ))}
          </nav>
          <div className={s.topRight}>
            {user.isAdmin && (
              <Link href="/admin" className={s.adminLink}><Icon name="shield" size="sm" /> Admin</Link>
            )}
            <Link
              href="/app/profile"
              className={`${s.avatar} ${profileActive ? s.avatarActive : ''}`}
              aria-label={`Your profile, ${user.name}`}
              aria-current={profileActive ? 'page' : undefined}
            >
              {user.avatarUrl && canOptimise(user.avatarUrl) ? (
                <Image src={user.avatarUrl} alt="" width={44} height={44} sizes="44px" />
              ) : (
                <span aria-hidden="true">{initials(user.name)}</span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main id="main" className={`page ${s.main}`} tabIndex={-1}>
        {children}
      </main>

      <nav className={s.tabbar} aria-label="Main">
        {TABS.map(t => {
          const active = isActive(pathname, t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined}>
              <Icon name={t.icon} />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
