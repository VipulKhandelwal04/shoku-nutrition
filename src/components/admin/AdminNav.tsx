'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@/components/ui/Icon';
import s from './admin.module.css';

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: '/admin', label: 'Overview', icon: 'chart' },
  { href: '/admin/foods', label: 'Foods', icon: 'bowl' },
  { href: '/admin/content', label: 'Content', icon: 'quote' },
  { href: '/admin/users', label: 'Users', icon: 'users' },
  { href: '/admin/features', label: 'Features', icon: 'check' },
  { href: '/admin/ai', label: 'AI Assist', icon: 'spark' },
  { href: '/admin/settings', label: 'Settings', icon: 'sliders' },
];

function isActive(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);
}

/** Left rail on desktop, sticky scrollable tabs on mobile. Both are the same list of links. */
export function AdminNav({ name, email }: { name: string; email: string | null }) {
  const pathname = usePathname();
  const links = (className?: string) =>
    LINKS.map(l => (
      <Link key={l.href} href={l.href} className={`${s.navLink} ${className ?? ''}`} aria-current={isActive(pathname, l.href) ? 'page' : undefined}>
        <Icon name={l.icon} size="sm" />
        {l.label}
      </Link>
    ));

  return (
    <>
      <aside className={s.side}>
        <Link href="/admin" className={s.brand} aria-label="Shoku admin home">
          <span className={s.brandName}>Shoku</span>
          <span className={s.brandTag}>Admin</span>
        </Link>
        <nav aria-label="Admin" className={s.nav}>{links()}</nav>
        <div className={s.sideFoot}>
          <Link href="/app" className={s.backLink}><Icon name="back" size="sm" />Back to the app</Link>
          <div className={s.who}>
            <strong>{name}</strong>
            {email}
          </div>
        </div>
      </aside>

      <header className={s.mobileTop}>
        <div className={s.mobileBar}>
          <Link href="/admin" className={s.brand} aria-label="Shoku admin home">
            <span className={s.brandName}>Shoku</span>
            <span className={s.brandTag}>Admin</span>
          </Link>
          <span className={s.mobileWho} title={email ?? undefined}>{name}</span>
          <Link href="/app" className="btn-text" aria-label="Back to the app">
            <Icon name="back" size="sm" />App
          </Link>
        </div>
        <nav aria-label="Admin sections" className={s.mobileTabs}>{links()}</nav>
      </header>
    </>
  );
}
