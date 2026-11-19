import Link from 'next/link';
import { requireAuth, authEnabled } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Sidebar } from '@/components/Sidebar';
import { MobileNav } from '@/components/MobileNav';
import { Icon } from '@/components/icons';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();
  const [events, personCount] = await Promise.all([
    prisma.event.findMany({
      orderBy: [{ archived: 'asc' }, { startDate: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      select: { id: true, name: true, archived: true },
    }),
    prisma.person.count(),
  ]);
  const latest = events.find((e) => !e.archived) ?? events[0] ?? null;

  return (
    <div className="min-h-screen md:flex">
      <Sidebar events={events} personCount={personCount} authEnabled={authEnabled()} />
      <div className="min-w-0 flex-1 overflow-x-clip">
        <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-line2 bg-white/95 px-3 backdrop-blur md:hidden">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-pine text-white">
              <Icon name="snow" size={14} strokeWidth={2.2} />
            </span>
            Laponie
          </Link>
          <Link href="/families" className="icon-btn ml-auto h-11 w-11" aria-label="Familles et couples">
            <Icon name="rings" size={19} />
          </Link>
        </header>
        <div className="pb-24 md:pb-0">{children}</div>
      </div>
      <MobileNav latestEventId={latest?.id ?? null} />
    </div>
  );
}
