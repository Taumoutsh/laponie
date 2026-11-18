import Link from 'next/link';
import type { EventView } from '@/lib/event-data';
import type { DGift, GiftStatus } from '@/lib/domain/types';
import { giftView } from '@/lib/domain/budget';
import { formatEUR, sum } from '@/lib/domain/money';
import { statusRank } from '@/lib/domain/status';
import { normalize } from '@/lib/domain/duplicates';
import { plural, shortDate } from '@/lib/ui';
import { joinNames } from '@/lib/gift-form-data';
import { Avatar, Empty, StatusBar, StatusTag } from './ui';
import { Icon } from './icons';

interface Row {
  gift: DGift;
  shareCents: number;
  others: string[];
  note: { text: string; tone: 'muted' | 'warn' } | null;
}

function giftNote(g: DGift): Row['note'] {
  const funded = sum(g.contributions.map((c) => c.amountCents));
  if (g.priceCents === 0) return { text: 'Prix à définir', tone: 'muted' };
  if (funded === 0) return { text: 'Non financé', tone: 'warn' };
  if (funded < g.priceCents) return { text: 'Sous-financé', tone: 'warn' };
  if (g.purchaseMode === 'REMOTE' && g.deliveryDate) return { text: `Livraison ${shortDate(g.deliveryDate)}`, tone: 'muted' };
  if (g.purchaseMode === 'ON_SITE') return { text: 'Sur place', tone: 'muted' };
  return null;
}

/** Vue « Par personne » : une carte par participant, ses cadeaux triés par statut. */
export function GiftsByPerson({
  view,
  statuses,
  q,
  fam,
}: {
  view: EventView;
  statuses: GiftStatus[];
  q: string;
  fam: string;
}) {
  const { event, data, dir, stats, groups } = view;
  const base = `/events/${event.id}`;
  const nq = normalize(q);
  const filtering = statuses.length > 0 || nq.length > 0;

  const giftsOf = new Map<string, DGift[]>();
  for (const g of data.gifts) {
    for (const id of g.recipientIds) {
      const list = giftsOf.get(id) ?? [];
      list.push(g);
      giftsOf.set(id, list);
    }
  }

  const families = groups
    .filter((grp) => !fam || (fam === 'none' ? grp.familyId === null : grp.familyId === fam))
    .map((grp) => {
      const people = grp.memberIds
        .map((id) => {
          const all = giftsOf.get(id) ?? [];
          const personMatches = nq.length > 0 && normalize(dir.personName(id)).includes(nq);
          const rows: Row[] = all
            .filter((g) => statuses.length === 0 || statuses.includes(g.status))
            .filter((g) => !nq || personMatches || normalize(g.name).includes(nq))
            .sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.name.localeCompare(b.name, 'fr'))
            .map((g) => ({
              gift: g,
              shareCents: giftView(g).shareByRecipient.get(id) ?? g.priceCents,
              others: g.recipientIds.filter((r) => r !== id).map((r) => dir.firstName(r)),
              note: giftNote(g),
            }));
          return { id, total: all.length, rows };
        })
        .filter((p) => !filtering || p.rows.length > 0);
      return { ...grp, people };
    })
    .filter((grp) => grp.people.length > 0);

  if (families.length === 0) {
    return (
      <Empty icon="gift" title={data.participants.length ? 'Aucun cadeau ne correspond' : 'Aucun participant'}>
        {data.participants.length ? 'Changez les statuts, la famille ou la recherche.' : 'Ajoutez des participants à l’événement.'}
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {families.map((grp) => {
        const giftIds = new Set(grp.people.flatMap((p) => p.rows.map((r) => r.gift.id)));
        return (
          <section key={grp.key}>
            <div className="mb-3 flex flex-wrap items-baseline gap-x-2 border-b border-line pb-2">
              <h2 className="text-[16px] font-semibold">{grp.name}</h2>
              <span className="text-xs text-muted">
                {plural(grp.people.length, 'personne', 'personnes')} · {plural(giftIds.size, 'cadeau', 'cadeaux')}
              </span>
            </div>
            <div className="grid items-start gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]">
              {grp.people.map(({ id, total, rows }) => {
                const s = stats.get(id);
                const person = dir.person(id);
                const count = rows.length === total ? plural(total, 'cadeau', 'cadeaux') : `${rows.length} sur ${total}`;
                return (
                  <article key={id} className="overflow-hidden rounded-[10px] border border-line bg-white">
                    <Link
                      href={`${base}/people/${id}`}
                      className="group block border-b border-line2 bg-[#FBFBFA] px-3.5 py-3 transition-colors hover:bg-[#F4F4F2]"
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar initials={dir.initials(id)} color={person?.color} size={32} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold group-hover:underline group-hover:underline-offset-[3px]">{dir.personName(id)}</div>
                          <div className="text-xs text-muted tabular">
                            {count} · reçoit {formatEUR(s?.receivedCents ?? 0)}
                            {s?.receiveMaxCents != null ? ` / ${formatEUR(s.receiveMaxCents)}` : ''}
                          </div>
                        </div>
                        {s?.progress != null ? <span className="text-[13px] font-semibold">{s.progress} %</span> : null}
                        <Icon name="chevronRight" size={15} className="text-muted" />
                      </div>
                      {s && total > 0 ? <StatusBar distribution={s.distribution} height={5} gap={1} className="mt-2.5" /> : null}
                    </Link>
                    {rows.length === 0 ? (
                      <div className="flex items-center justify-between gap-2 px-3.5 py-3 text-[13px] text-muted">
                        Aucun cadeau pour l’instant
                        <Link href={`${base}/gifts/new?for=${id}`} className="btn-ghost h-7 text-pine">
                          <Icon name="plus" size={13} strokeWidth={2.2} />
                          Ajouter
                        </Link>
                      </div>
                    ) : (
                      <ul>
                        {rows.map((r, i) => (
                          <li key={r.gift.id} className={i ? 'border-t border-line2' : ''}>
                            <Link
                              href={`${base}/gifts/${r.gift.id}`}
                              className="row-link grid min-h-[44px] grid-cols-[66px_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 md:grid-cols-[72px_minmax(0,1fr)_auto] md:gap-2.5 md:px-3.5"
                            >
                              <StatusTag status={r.gift.status} className="justify-self-start px-1.5 text-[11px] md:px-2 md:text-xs" />
                              <div className="min-w-0">
                                <div className="text-[13px] font-medium leading-snug">{r.gift.name}</div>
                                {r.others.length || r.note ? (
                                  <div className="flex flex-wrap items-center gap-x-1 text-[11px] leading-snug">
                                    {r.others.length ? (
                                      <span className="inline-flex items-center gap-1 text-couple">
                                        <Icon name="rings" size={11} />
                                        Avec {joinNames(r.others)} · part sur {formatEUR(r.gift.priceCents)}
                                      </span>
                                    ) : null}
                                    {r.others.length && r.note ? <span className="text-muted">·</span> : null}
                                    {r.note ? <span className={r.note.tone === 'warn' ? 'text-warn-text' : 'text-muted'}>{r.note.text}</span> : null}
                                  </div>
                                ) : null}
                              </div>
                              <span className="text-[13px] font-semibold tabular">{r.gift.priceCents === 0 ? '—' : formatEUR(r.shareCents)}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Icon name="rings" size={12} className="text-couple" />
        Un cadeau partagé apparaît chez chaque destinataire, avec sa part.
      </p>
    </div>
  );
}
