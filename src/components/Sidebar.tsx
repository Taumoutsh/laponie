'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './icons';
import { logout } from '@/app/actions/auth';

type EventItem = { id: string; name: string; archived: boolean };

export function currentEventId(pathname: string): string | null {
  const m = pathname.match(/^\/events\/([^/]+)/);
  return m && m[1] !== 'new' ? m[1] : null;
}

function NavLink({ href, icon, children, active, badge }: { href: string; icon: IconName; children: React.ReactNode; active: boolean; badge?: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 transition-colors hover:bg-hover ${
        active ? 'bg-[#EAEAE7] font-semibold text-ink' : 'text-[#5F5E5B]'
      }`}
    >
      <Icon name={icon} size={16} />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {badge}
    </Link>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <div className="px-2.5 pb-1.5 pt-5 text-xs font-semibold text-muted">{children}</div>;
}

export function Sidebar({ events, personCount, authEnabled }: { events: EventItem[]; personCount: number; authEnabled: boolean }) {
  const pathname = usePathname();
  const eventId = currentEventId(pathname);
  const current = events.find((e) => e.id === eventId);
  const active = events.filter((e) => !e.archived);
  const archived = events.filter((e) => e.archived);
  const is = (href: string, exact = false) => (exact ? pathname === href : pathname === href || pathname.startsWith(href + '/'));

  return (
    <nav
      aria-label="Navigation principale"
      className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-line bg-soft px-2 py-3 md:flex"
    >
      <Link href="/" className="flex items-center gap-2.5 px-2.5 pb-3 pt-1.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-pine text-white">
          <Icon name="snow" size={16} strokeWidth={2} />
        </span>
        <span className="text-[15px] font-semibold">Laponie</span>
      </Link>
      <NavLink href="/" icon="home" active={pathname === '/'}>
        Accueil
      </NavLink>

      <Heading>Événements</Heading>
      {active.map((e) => (
        <NavLink key={e.id} href={`/events/${e.id}`} icon="gift" active={e.id === eventId && pathname === `/events/${e.id}`}>
          {e.name}
        </NavLink>
      ))}
      {archived.length > 0 ? (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[#5F5E5B] hover:bg-hover">
            <Icon name="archive" size={16} />
            Archivés ({archived.length})
          </summary>
          {archived.map((e) => (
            <NavLink key={e.id} href={`/events/${e.id}`} icon="gift" active={e.id === eventId && pathname === `/events/${e.id}`}>
              {e.name}
            </NavLink>
          ))}
        </details>
      ) : null}
      <NavLink href="/events/new" icon="plus" active={pathname === '/events/new'}>
        Nouvel événement
      </NavLink>

      {current ? (
        <>
          <Heading>{current.name}</Heading>
          <NavLink href={`/events/${current.id}/gifts`} icon="list" active={is(`/events/${current.id}/gifts`)}>
            Cadeaux
          </NavLink>
          <NavLink href={`/events/${current.id}/participants`} icon="userPlus" active={is(`/events/${current.id}/participants`)}>
            Participants
          </NavLink>
          <NavLink href={`/events/${current.id}/finances`} icon="wallet" active={is(`/events/${current.id}/finances`)}>
            Finances
          </NavLink>
          <NavLink href={`/events/${current.id}/balances`} icon="scale" active={is(`/events/${current.id}/balances`)}>
            Balances
          </NavLink>
          <NavLink href={`/events/${current.id}/export`} icon="download" active={is(`/events/${current.id}/export`)}>
            Export Excel
          </NavLink>
          <NavLink href={`/events/${current.id}/settings`} icon="settings" active={is(`/events/${current.id}/settings`)}>
            Réglages
          </NavLink>
        </>
      ) : null}

      <Heading>Carnet</Heading>
      <NavLink href="/people" icon="users" active={is('/people')} badge={<span className="text-xs text-muted">{personCount}</span>}>
        Personnes
      </NavLink>
      <NavLink href="/families" icon="rings" active={is('/families')}>
        Familles &amp; couples
      </NavLink>

      {authEnabled ? (
        <form action={logout} className="mt-auto pt-4">
          <button type="submit" className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[#5F5E5B] hover:bg-hover">
            <Icon name="logout" size={16} />
            Se déconnecter
          </button>
        </form>
      ) : null}
    </nav>
  );
}
