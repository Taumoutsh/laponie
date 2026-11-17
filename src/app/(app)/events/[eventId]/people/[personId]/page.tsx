import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadEvent } from '@/lib/event-data';
import { joinNames, recipientsLabel } from '@/lib/gift-form-data';
import { giftView } from '@/lib/domain/budget';
import { accountLabel, accountOfPerson, computeBalances } from '@/lib/domain/balances';
import { centsToInput, formatEUR } from '@/lib/domain/money';
import { STATUSES, STATUS_LABEL, giftPercent } from '@/lib/domain/status';
import { STATUS_STYLE, shortDate } from '@/lib/ui';
import { updateParticipant } from '@/app/actions/events';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { Page } from '@/components/Page';
import { Avatar, Meter, Notice, OverChip, Section, StatusBar, StatusLegend } from '@/components/ui';
import { Icon } from '@/components/icons';

export default async function EventPersonPage({ params }: { params: Promise<{ eventId: string; personId: string }> }) {
  const { eventId, personId } = await params;
  const { event, data, dir, stats } = await loadEvent(eventId);
  const s = stats.get(personId);
  const person = dir.person(personId);
  if (!s || !person) notFound();

  const couple = dir.coupleOf(personId);
  const partner = dir.partnerOf(personId);
  const myShare = couple ? (couple.personAId === personId ? couple.splitA : 100 - couple.splitA) : 100;
  const opts = { sharedCouples: true };
  const balances = computeBalances(data, opts, dir);
  const myAccount = accountOfPerson(dir, personId, opts);
  const account = balances.accounts.find((a) => a.key === myAccount);
  const toReceive = balances.simplified.filter((t) => t.to === myAccount);
  const toPay = balances.simplified.filter((t) => t.from === myAccount);

  const received = data.gifts.filter((g) => g.recipientIds.includes(personId));
  const receivedByStatus = STATUSES.map((st) => ({ status: st, gifts: received.filter((g) => g.status === st) })).filter((x) => x.gifts.length);

  const giftsById = new Map(data.gifts.map((g) => [g.id, g]));
  const solo = s.contributions.filter((c) => !c.viaCouple);
  const viaCouple = s.contributions.filter((c) => c.viaCouple);

  const name = person.firstName;

  const contributionRow = (c: (typeof s.contributions)[number], i: number) => {
    const g = giftsById.get(c.giftId)!;
    const advancedByMe = g.advances.filter((a) => accountOfPerson(dir, a.payerId, opts) === myAccount).reduce((x, a) => x + a.amountCents, 0);
    return (
      <Link
        key={c.contributionId + personId}
        href={`/events/${eventId}/gifts/${g.id}`}
        className={`row-link grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-3.5 py-2.5 ${i ? 'border-t border-line2' : ''}`}
      >
        <div className="min-w-0">
          <div className="truncate font-medium">{g.name}</div>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
            pour {recipientsLabel(dir, g.recipientIds)} · sur {formatEUR(g.priceCents)}
            {advancedByMe > 0 ? <span className="tag h-[18px] bg-[#E7F0FA] px-1.5 text-credit-text">Avance {formatEUR(advancedByMe)}</span> : null}
          </div>
        </div>
        <span className="tag" style={{ background: STATUS_STYLE[g.status].bg, color: STATUS_STYLE[g.status].fg }}>
          {STATUS_LABEL[g.status]} · {giftPercent(g.status, g.purchaseMode)} %
        </span>
        <span className="min-w-[72px] text-right font-semibold tabular">{formatEUR(c.amountCents)}</span>
      </Link>
    );
  };

  return (
    <Page
      crumbs={[
        { href: `/events/${eventId}`, label: event.name },
        ...(person.familyId ? [{ label: dir.family(person.familyId)?.name ?? '' }] : []),
        { label: dir.personName(personId) },
      ]}
      width="max-w-[1160px]"
      actions={
        <Link href={`/events/${eventId}/gifts/new?for=${personId}`} className="btn-primary">
          <Icon name="plus" size={15} strokeWidth={2.2} />
          Cadeau pour {name}
        </Link>
      }
    >
      {/* En-tête */}
      <div className="flex flex-wrap items-center gap-4">
        <Avatar initials={dir.initials(personId)} color={person.color} size={68} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[30px] font-bold leading-tight tracking-tight md:text-[36px]">{dir.personName(personId)}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {person.familyId ? <span className="tag bg-line2 text-ink">{dir.family(person.familyId)?.name}</span> : null}
            {partner && couple ? (
              <Link href="/families" className="tag bg-couple-bg text-couple">
                <Icon name="rings" size={12} strokeWidth={2} />
                En couple avec {dir.personName(partner.id)} · {myShare} / {100 - myShare}
              </Link>
            ) : null}
            <span className="tag bg-line2 text-ink">Reçu max {s.receiveMaxCents != null ? formatEUR(s.receiveMaxCents) : '—'}</span>
            <span className="tag bg-line2 text-ink">Dépense max {s.spendMaxCents != null ? formatEUR(s.spendMaxCents) : 'aucun'}</span>
          </div>
        </div>
        <details className="relative">
          <summary className="btn cursor-pointer list-none">
            <Icon name="pencil" size={14} />
            Budgets
          </summary>
          <div className="absolute right-0 z-10 mt-1 w-72 rounded-lg border border-line bg-white p-3.5 shadow-lg">
            <ActionForm action={updateParticipant.bind(null, eventId, personId)} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="bud-r" className="text-xs text-muted">
                    Reçu max
                  </label>
                  <input id="bud-r" name="receiveMax" defaultValue={centsToInput(s.receiveMaxCents)} inputMode="decimal" className="input text-right tabular" />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="bud-s" className="text-xs text-muted">
                    Dépense max
                  </label>
                  <input id="bud-s" name="spendMax" defaultValue={centsToInput(s.spendMaxCents)} placeholder="aucun" inputMode="decimal" className="input text-right tabular" />
                </div>
              </div>
              <SubmitButton>Enregistrer</SubmitButton>
            </ActionForm>
          </div>
        </details>
      </div>

      {/* Synthèse */}
      <div className="mt-7 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <Icon name="gift" size={14} />
            Offert à {name}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[26px] font-bold tabular">{formatEUR(s.receivedCents)}</span>
            {s.receiveMaxCents != null ? <span className="text-muted">/ {formatEUR(s.receiveMaxCents)}</span> : null}
            <OverChip cents={s.overReceiveCents} />
          </div>
          <Meter value={s.receivedCents} max={s.receiveMaxCents} className="mt-2.5" />
          <div className="mt-2 text-xs text-muted">
            {received.filter((g) => g.recipientIds.length > 1).length
              ? `Dont des cadeaux communs (part de ${name} uniquement)`
              : `${received.length} cadeau${received.length > 1 ? 'x' : ''}`}
            {s.receiveMaxCents != null && s.overReceiveCents === 0 ? ` · reste ${formatEUR(s.receiveMaxCents - s.receivedCents)}` : ''}
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <Icon name="wallet" size={14} />
            Dépensé par {name}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[26px] font-bold tabular">{formatEUR(s.spentCents)}</span>
            {s.spendMaxCents != null ? <span className="text-muted">/ {formatEUR(s.spendMaxCents)}</span> : null}
            <OverChip cents={s.overSpendCents} />
          </div>
          {s.spentCents > 0 ? (
            <div className="mt-2.5 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-line2">
              <div style={{ width: `${(s.spentSoloCents / Math.max(s.spentCents, s.spendMaxCents ?? 0)) * 100}%`, background: '#9B2C55' }} />
              <div style={{ width: `${(s.spentCoupleShareCents / Math.max(s.spentCents, s.spendMaxCents ?? 0)) * 100}%`, background: '#E7B4C6' }} />
            </div>
          ) : null}
          <div className="mt-2 text-xs text-muted">
            <b className="text-couple">{formatEUR(s.spentSoloCents)}</b> seul
            {couple ? (
              <>
                {' '}
                · <b className="text-ink">{formatEUR(s.spentCoupleShareCents)}</b> ({myShare} % de {formatEUR(s.spentCoupleTotalCents)} en couple)
              </>
            ) : null}
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs font-medium text-muted">Avancement global</div>
          <div className="mt-1 text-[26px] font-bold">{s.progress != null ? `${s.progress} %` : '—'}</div>
          <StatusBar distribution={s.distribution} height={8} className="mt-2.5" />
          <StatusLegend distribution={s.distribution} className="mt-2" />
        </div>
        <Link href={`/events/${eventId}/balances`} className="card block p-4 transition hover:border-[#CFCECA]">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <Icon name="scale" size={14} />
            Balance{myAccount.startsWith('c:') ? ` · compte ${accountLabel(dir, myAccount)}` : ''}
          </div>
          <div
            className={`mt-1 text-[26px] font-bold tabular ${(account?.netCents ?? 0) > 0 ? 'text-credit-text' : (account?.netCents ?? 0) < 0 ? 'text-debt-text' : ''}`}
          >
            {formatEUR(account?.netCents ?? 0, { sign: true })}
          </div>
          <div className="mt-2 text-xs text-muted">
            {toReceive.length
              ? `À recevoir : ${toReceive.map((t) => `${accountLabel(dir, t.from)} ${formatEUR(t.amountCents)}`).join(' · ')}`
              : toPay.length
                ? `À rembourser : ${toPay.map((t) => `${accountLabel(dir, t.to)} ${formatEUR(t.amountCents)}`).join(' · ')}`
                : 'Rien à rembourser'}
          </div>
          <div className="mt-1.5 text-xs font-semibold text-pine">Voir les balances →</div>
        </Link>
      </div>

      <div className="mt-9 grid items-start gap-7 lg:grid-cols-2">
        {/* Cadeaux reçus */}
        <Section title={`Cadeaux pour ${name}`} count={received.length}>
          {received.length === 0 ? (
            <p className="text-[13px] text-muted">Aucun cadeau prévu pour l’instant.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {receivedByStatus.map(({ status, gifts }) => (
                <div key={status}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="tag" style={{ background: STATUS_STYLE[status].bg, color: STATUS_STYLE[status].fg }}>
                      {STATUS_LABEL[status]}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-2">
                    {gifts.map((g) => {
                      const gv = giftView(g);
                      const others = g.recipientIds.filter((id) => id !== personId);
                      return (
                        <li key={g.id}>
                          <Link href={`/events/${eventId}/gifts/${g.id}`} className="card row-link flex items-start gap-3 px-3.5 py-3">
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold">{g.name}</div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
                                <span>
                                  {g.contributions.length ? `de ${joinNames(g.contributions.map((c) => dir.partyName(c, true)))}` : 'aucun participant'}
                                </span>
                                {others.length ? (
                                  <span className="inline-flex items-center gap-1 text-couple">
                                    <Icon name="rings" size={12} strokeWidth={2} />
                                    avec {recipientsLabel(dir, others)}
                                  </span>
                                ) : null}
                                <span className="inline-flex items-center gap-1">
                                  <Icon name={g.purchaseMode === 'ON_SITE' ? 'store' : 'truck'} size={12} />
                                  {g.purchaseMode === 'ON_SITE'
                                    ? 'Sur place'
                                    : g.deliveryDate
                                      ? `Livraison ${shortDate(g.deliveryDate)}`
                                      : 'À distance'}
                                </span>
                                <span className="font-medium" style={{ color: STATUS_STYLE[g.status].fg }}>
                                  {gv.percent} %
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold tabular">{formatEUR(gv.shareByRecipient.get(personId) ?? 0)}</div>
                              {g.recipientIds.length > 1 ? <div className="text-xs text-muted">part sur {formatEUR(g.priceCents)}</div> : null}
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
          <Link href={`/events/${eventId}/gifts/new?for=${personId}`} className="btn-ghost mt-3">
            <Icon name="plus" size={14} />
            Ajouter un cadeau pour {name}
          </Link>
        </Section>

        {/* Participations */}
        <Section title={`Participations de ${name}`} count={s.contributions.length}>
          {s.contributions.length === 0 ? (
            <p className="text-[13px] text-muted">{name} ne participe encore à aucun cadeau.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {solo.length ? (
                <div>
                  <div className="mb-2 flex items-center gap-2 text-[13px]">
                    <span className="font-semibold">Seul</span>
                    <span className="text-xs text-muted">
                      {solo.length} cadeau{solo.length > 1 ? 'x' : ''}
                    </span>
                    <span className="ml-auto font-semibold tabular">{formatEUR(s.spentSoloCents)}</span>
                  </div>
                  <div className="overflow-hidden rounded-[10px] border border-line">{solo.map(contributionRow)}</div>
                </div>
              ) : null}
              {viaCouple.length && partner ? (
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="font-semibold">En couple avec {partner.firstName}</span>
                    <span className="text-xs text-muted">
                      {viaCouple.length} cadeau{viaCouple.length > 1 ? 'x' : ''} · part de {name} {formatEUR(s.spentCoupleShareCents)}
                    </span>
                    <span className="ml-auto font-semibold tabular">{formatEUR(s.spentCoupleTotalCents)}</span>
                  </div>
                  <div className="overflow-hidden rounded-[10px] border border-line">{viaCouple.map(contributionRow)}</div>
                </div>
              ) : null}
            </div>
          )}
          {couple ? (
            <Notice className="mt-4">
              Les participations du couple comptent pour {myShare} % dans la part de {name} (répartition réglable dans{' '}
              <Link href="/families" className="underline">
                Familles &amp; couples
              </Link>
              ).
            </Notice>
          ) : null}
        </Section>
      </div>
    </Page>
  );
}
