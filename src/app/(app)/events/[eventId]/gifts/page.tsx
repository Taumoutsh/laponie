import Link from 'next/link';
import { loadEvent } from '@/lib/event-data';
import { recipientsLabel, joinNames } from '@/lib/gift-form-data';
import { formatEUR, sum } from '@/lib/domain/money';
import { STATUSES, STATUS_LABEL, giftPercent, statusRank } from '@/lib/domain/status';
import { STATUS_STYLE, shortDate } from '@/lib/ui';
import { normalize } from '@/lib/domain/duplicates';
import { Page } from '@/components/Page';
import { Empty, PageHeader, StatusBar, StatusTag } from '@/components/ui';
import { Icon } from '@/components/icons';
import { GiftsByPerson } from '@/components/GiftsByPerson';
import { giftsHref, parseGiftsQuery, toggleStatus, type GiftsQuery } from '@/lib/gifts-view';

export const metadata = { title: 'Cadeaux' };

export default async function GiftsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ vue?: string | string[]; status?: string | string[]; q?: string | string[]; fam?: string | string[] }>;
}) {
  const { eventId } = await params;
  const query = parseGiftsQuery(await searchParams);
  const view = await loadEvent(eventId);
  const { event, data, dir, eventStats, groups } = view;
  const base = `/events/${eventId}/gifts`;
  const href = (patch: Partial<GiftsQuery>) => giftsHref(base, query, patch);
  const { mode, statuses } = query;
  const q = normalize(query.q);

  const gifts = data.gifts
    .filter((g) => statuses.length === 0 || statuses.includes(g.status))
    .filter((g) => !q || normalize(g.name).includes(q) || normalize(recipientsLabel(dir, g.recipientIds)).includes(q))
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.name.localeCompare(b.name, 'fr'));

  const byStatus = STATUSES.map((s) => ({ status: s, gifts: gifts.filter((g) => g.status === s) })).filter((x) => x.gifts.length > 0);
  const famOptions = groups.map((g) => ({ value: g.familyId ?? 'none', label: g.name }));
  const famLabel = famOptions.find((o) => o.value === query.fam)?.label ?? 'toutes';

  return (
    <Page
      width={mode === 'person' ? 'max-w-[1240px]' : undefined}
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

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Affichage" className="flex w-full gap-0.5 rounded-lg bg-line2 p-[3px] sm:inline-flex sm:w-auto">
          {(
            [
              ['status', 'Par statut', 'list'],
              ['person', 'Par personne', 'users'],
            ] as const
          ).map(([m, label, icon]) => (
            <Link
              key={m}
              href={href({ mode: m })}
              aria-current={mode === m ? 'true' : undefined}
              className={`inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-[13px] sm:flex-none ${
                mode === m ? 'bg-white font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'text-muted hover:text-ink'
              }`}
            >
              <Icon name={icon} size={14} className="hidden sm:block" />
              {label}
            </Link>
          ))}
        </div>
        {mode === 'person' && famOptions.length > 1 ? (
          <details key={query.fam || 'all'} className="relative">
            <summary className="btn h-8 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <Icon name="rings" size={14} />
              Famille : {famLabel}
              <Icon name="chevronDown" size={12} strokeWidth={2.2} />
            </summary>
            <div className="absolute left-0 z-20 mt-1 min-w-[200px] rounded-lg border border-line bg-white p-1 shadow-[0_8px_24px_rgba(15,15,15,.12)]">
              {[{ value: '', label: 'Toutes' }, ...famOptions].map((o) => (
                <Link
                  key={o.value || 'all'}
                  href={href({ fam: o.value })}
                  aria-current={query.fam === o.value ? 'true' : undefined}
                  className={`flex h-9 items-center justify-between gap-3 rounded-md px-2.5 text-[13px] hover:bg-line2 ${query.fam === o.value ? 'font-semibold' : ''}`}
                >
                  {o.label}
                  {query.fam === o.value ? <Icon name="check" size={14} className="text-pine" /> : null}
                </Link>
              ))}
            </div>
          </details>
        ) : null}
        <form className="flex w-full gap-1.5 sm:ml-auto sm:w-auto" role="search">
          {mode === 'person' ? <input type="hidden" name="vue" value="personne" /> : null}
          {statuses.length ? <input type="hidden" name="status" value={statuses.join(',')} /> : null}
          {mode === 'person' && query.fam ? <input type="hidden" name="fam" value={query.fam} /> : null}
          <label htmlFor="gq" className="sr-only">
            Rechercher un cadeau
          </label>
          <input
            id="gq"
            name="q"
            type="search"
            defaultValue={query.q}
            placeholder={mode === 'person' ? 'Cadeau ou personne' : 'Cadeau ou destinataire'}
            className="input h-8 min-w-0 flex-1 sm:w-56 sm:flex-none"
          />
          <button type="submit" className="btn h-8 px-2.5" aria-label="Rechercher">
            <Icon name="search" size={14} />
          </button>
        </form>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <nav
          aria-label="Filtrer par statut (plusieurs choix possibles)"
          className="flex w-full min-w-0 max-w-full gap-1.5 overflow-x-auto pb-0.5 md:w-auto md:flex-wrap"
        >
          <Link
            href={href({ statuses: [] })}
            aria-current={statuses.length === 0 ? 'true' : undefined}
            className={`inline-flex h-7 shrink-0 items-center rounded-full border px-2.5 text-xs font-medium md:h-[30px] md:px-3 ${
              statuses.length === 0 ? 'border-ink bg-ink text-white' : 'border-[#E3E2DF] bg-white text-muted hover:bg-line2'
            }`}
          >
            Tous · {data.gifts.length}
          </Link>
          {STATUSES.map((s) => {
            const on = statuses.includes(s);
            const st = STATUS_STYLE[s];
            return (
              <Link
                key={s}
                href={href({ statuses: toggleStatus(statuses, s) })}
                className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-xs font-medium md:h-[30px] md:px-3 ${
                  on ? '' : 'border-[#E3E2DF] bg-white text-muted hover:bg-line2'
                }`}
                style={on ? { background: st.bg, color: st.fg, borderColor: st.bar } : undefined}
              >
                {on ? <Icon name="check" size={12} strokeWidth={2.6} /> : null}
                {STATUS_LABEL[s]} <span className="opacity-70">{eventStats.distribution[s]}</span>
                <span className="sr-only">{on ? '(sélectionné)' : '(non sélectionné)'}</span>
              </Link>
            );
          })}
        </nav>
        {statuses.length || query.q || query.fam ? (
          <Link href={href({ statuses: [], q: '', fam: '' })} className="text-xs font-medium text-pine hover:underline">
            Réinitialiser
          </Link>
        ) : null}
        {mode === 'status' && (statuses.length || q) ? (
          <span className="text-xs text-muted md:ml-auto">
            {gifts.length} cadeau{gifts.length > 1 ? 'x' : ''} sur {data.gifts.length}
          </span>
        ) : null}
      </div>

      {mode === 'person' ? (
        <GiftsByPerson view={view} statuses={statuses} q={query.q} fam={query.fam} />
      ) : gifts.length === 0 ? (
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
