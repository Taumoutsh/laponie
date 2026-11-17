'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './icons';
import { currentEventId } from './Sidebar';

export function MobileNav({ latestEventId }: { latestEventId: string | null }) {
  const pathname = usePathname();
  const eventId = currentEventId(pathname) ?? latestEventId;
  const base = eventId ? `/events/${eventId}` : null;

  const tabs: { href: string; label: string; icon: IconName; active: boolean }[] = [
    {
      href: base ?? '/',
      label: 'Événement',
      icon: 'gift',
      active: pathname === '/' || (!!base && (pathname === base || pathname.startsWith(base + '/people') || pathname.startsWith(base + '/participants'))),
    },
    { href: base ? `${base}/gifts` : '/', label: 'Cadeaux', icon: 'list', active: !!base && pathname.startsWith(base + '/gifts') },
    { href: base ? `${base}/finances` : '/', label: 'Finances', icon: 'wallet', active: !!base && pathname.startsWith(base + '/finances') },
    { href: base ? `${base}/balances` : '/', label: 'Balances', icon: 'scale', active: !!base && pathname.startsWith(base + '/balances') },
    { href: '/people', label: 'Carnet', icon: 'users', active: pathname.startsWith('/people') || pathname.startsWith('/families') },
  ];

  return (
    <nav
      aria-label="Navigation"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-white px-1 pb-[max(env(safe-area-inset-bottom),10px)] pt-1.5 md:hidden"
    >
      {tabs.map((t) => (
        <Link
          key={t.label}
          href={t.href}
          aria-current={t.active ? 'page' : undefined}
          className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 text-[11px] ${t.active ? 'font-semibold text-pine' : 'text-muted'}`}
        >
          <Icon name={t.icon} size={21} strokeWidth={1.9} />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
