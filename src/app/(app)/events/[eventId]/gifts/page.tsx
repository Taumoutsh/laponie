import Link from 'next/link';
import { loadEvent } from '@/lib/event-data';
import { recipientsLabel, joinNames } from '@/lib/gift-form-data';
import { formatEUR, sum } from '@/lib/domain/money';
import { STATUSES, STATUS_LABEL, giftPercent, statusRank } from '@/lib/domain/status';
import type { GiftStatus } from '@/lib/domain/types';
import { STATUS_STYLE, shortDate } from '@/lib/ui';
import { normalize } from '@/lib/domain/duplicates';
import { Page } from '@/components/Page';
import { Empty, PageHeader, StatusBar, StatusTag } from '@/components/ui';
import { Icon } from '@/components/icons';

export const metadata = { title: 'Cadeaux' };

export default async function GiftsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { eventId } = await params;
  const sp = await searchParams;
  const { event, data, dir, eventStats } = await loadEvent(eventId);
  const filter = STATUSES.includes(sp.status as GiftStatus) ? (sp.status as GiftStatus) : null;
  const q = normalize(sp.q ?? '');

  const gifts = data.gifts
    .filter((g) => !filter || g.status === filter)
    .filter((g) => !q || normalize(g.name).includes(q) || normalize(recipientsLabel(dir, g.recipientIds)).includes(q))
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.name.localeCompare(b.name, 'fr'));

  const byStatus = STATUSES.map((s) => ({ status: s, gifts: gifts.filter((g) => g.status === s) })).filter((x) => x.gifts.length > 0);
  const qs = (status: string | null) => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (sp.q) p.set('q', sp.q);
    const s = p.toString();
    return s ? `?${s}` : '';
  };

  return (
    <Page
      crumbs={[{ href: `/events/${eventId}`, label: event.name }, { label: 'Cadeaux' }]}
      actions={
        <Link href={`/events/${eventId}/gifts/new`} className="btn-primary">
          <Icon name="plus" size={15} strokeWidth={2.2} />
          Nouveau cadeau
        </Link>
      }
    >
      <PageHeader icon="list" title="Cadeaux" subtitle={`${data.gifts.length} cadeaux · ${formatEUR(eventStats.engagedCents)} · ${eventStats.progress ?? 0} % prêt`}>
        <StatusBar distribution={eventStats.distribution} height={8} className="mt-4 max-w-xl" />
      </PageHeader>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-1.5">
          <Link href={qs(null)} aria-current={!filter ? 'true' : undefined} className={`tag h-8 px-3 ${!filter ? 'bg-ink text-white' : 'bg-line2 text-[#5F5E5B] hover:bg-hover'}`}>
            Tous · {data.gifts.length}
          </Link>
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={qs(s)}
              aria-current={filter === s ? 'true' : undefined}
              className="tag h-8 px-3"
              style={filter === s ? { background: STATUS_STYLE[s].fg, color: '#fff' } : { background: STATUS_STYLE[s].bg, color: STATUS_STYLE[s].fg }}
            >
              {STATUS_LABEL[s]} · {eventStats.distribution[s]}
            </Link>
          ))}
        </nav>
        <form className="ml-auto flex gap-1.5" role="search">
          {filter ? <input type="hidden" name="status" value={filter} /> : null}
          <label htmlFor="gq" className="sr-only">
            Rechercher un cadeau
          </label>
          <input id="gq" name="q" type="search" defaultValue={sp.q ?? ''} placeholder="Cadeau ou destinataire" className="input h-8 w-52" />
          <button type="submit" className="btn h-8 px-2.5" aria-label="Rechercher">
            <Icon name="search" size={14} />
          </button>
        </form>
      </div>

      {gifts.length === 0 ? (
        <Empty icon="gift" title={data.gifts.length ? 'Aucun cadeau ne correspond' : 'Aucun cadeau pour l’instant'}>
          {data.gifts.length ? 'Changez le filtre ou la recherche.' : 'Ajoutez une première idée de cadeau.'}
        </Empty>
      ) : (
        <div className="flex flex-col gap-6">
          {byStatus.map(({ status, gifts: list }) => (
            <section key={status}>
              <div className="mb-2 flex items-center gap-2">
                <StatusTag status={status} />
                <span className="text-xs text-muted">{list.length}</span>
              </div>
              <ul className="overflow-hidden rounded-[10px] border border-line">
                {list.map((g, i) => {
                  const funded = sum(g.contributions.map((c) => c.amountCents));
                  const advanced = sum(g.advances.map((a) => a.amountCents));
                  return (
                    <li key={g.id} className={i ? 'border-t border-line2' : ''}>
                      <Link href={`/events/${eventId}/gifts/${g.id}`} className="row-link flex flex-wrap items-center gap-x-4 gap-y-1 px-3.5 py-2.5">
                        <div className="min-w-[200px] flex-1">
                          <div className="font-medium">{g.name}</div>
                          <div className="flex flex-wrap gap-x-2 text-xs text-muted">
                            <span>pour {recipientsLabel(dir, g.recipientIds)}</span>
                            {g.contributions.length ? <span>· de {joinNames(g.contributions.map((c) => dir.partyName(c, true)))}</span> : null}
                            {g.purchaseMode === 'REMOTE' && g.deliveryDate ? (
                              <span className="inline-flex items-center gap-1">
                                · <Icon name="truck" size={12} /> {shortDate(g.deliveryDate)}
                              </span>
                            ) : null}
                            {advanced > 0 ? <span className="text-credit-text">· avance {formatEUR(advanced)}</span> : null}
                          </div>
                        </div>
                        <span className="text-xs text-muted">{giftPercent(g.status, g.purchaseMode)} %</span>
                        <span
                          className={`text-xs tabular ${funded === g.priceCents ? 'text-[#1F6B45]' : funded > g.priceCents ? 'text-danger' : 'text-warn-text'}`}
                          title="Financé / prix"
                        >
                          {formatEUR(funded)} financés
                        </span>
                        <span className="w-20 text-right font-semibold tabular">{formatEUR(g.priceCents)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}
