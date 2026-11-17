import { requireAuth } from '@/lib/auth';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Page } from '@/components/Page';
import { Empty, PageHeader } from '@/components/ui';
import { Icon } from '@/components/icons';
import { dateRange, plural } from '@/lib/ui';
import { formatEUR, sum } from '@/lib/domain/money';

export default async function HomePage() {
  await requireAuth();
  const events = await prisma.event.findMany({
    orderBy: [{ archived: 'asc' }, { startDate: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    include: {
      _count: { select: { participants: true, gifts: true } },
      gifts: { select: { priceCents: true } },
    },
  });
  const personCount = await prisma.person.count();

  return (
    <Page
      actions={
        <Link href="/events/new" className="btn-primary">
          <Icon name="plus" size={15} strokeWidth={2.2} />
          Nouvel événement
        </Link>
      }
    >
      <PageHeader icon="snow" title="Laponie" subtitle="Vos événements, leurs cadeaux et qui participe à quoi." />

      {personCount === 0 ? (
        <div className="mb-6 rounded-[10px] bg-soft p-4 text-[13px] text-[#5F5E5B]">
          Pour commencer, ajoutez les personnes de votre entourage dans le{' '}
          <Link href="/people" className="font-semibold text-pine underline underline-offset-2">
            carnet
          </Link>
          , regroupez-les en familles et formez les couples, puis créez un événement.
        </div>
      ) : null}

      {events.length === 0 ? (
        <Empty icon="gift" title="Aucun événement pour l’instant">
          Créez un événement (Noël, un anniversaire…) puis ajoutez-y des participants depuis le carnet.
          <div className="mt-4">
            <Link href="/events/new" className="btn-primary">
              Créer un événement
            </Link>
          </div>
        </Empty>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {events.map((e) => (
            <Link key={e.id} href={`/events/${e.id}`} className="card block p-4 transition hover:border-[#CFCECA] hover:shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pine-light text-pine">
                  <Icon name="gift" size={20} />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{e.name}</div>
                  <div className="text-xs text-muted">{dateRange(e.startDate, e.endDate)}</div>
                </div>
                {e.archived ? <span className="tag ml-auto bg-line2 text-muted">Archivé</span> : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
                <span>{plural(e._count.participants, 'participant', 'participants')}</span>
                <span>{plural(e._count.gifts, 'cadeau', 'cadeaux')}</span>
                <span className="font-semibold text-ink tabular">{formatEUR(sum(e.gifts.map((g) => g.priceCents)))}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Page>
  );
}
