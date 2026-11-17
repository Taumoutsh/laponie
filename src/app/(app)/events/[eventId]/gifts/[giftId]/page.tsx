import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { loadEvent } from '@/lib/event-data';
import { recipientsLabel } from '@/lib/gift-form-data';
import { giftView } from '@/lib/domain/budget';
import { accountLabel, accountOfPerson, computeBalances, partyAccounts } from '@/lib/domain/balances';
import { centsToInput, formatEUR, sum } from '@/lib/domain/money';
import { STATUS_LABEL, giftPercent, stepsFor } from '@/lib/domain/status';
import { STATUS_STYLE, daysUntil, longDate, shortDate } from '@/lib/ui';
import {
  addAdvance,
  addContribution,
  deleteAdvance,
  deleteContribution,
  deleteGift,
  duplicateGift,
  scaleContributionsToPrice,
  setGiftStatus,
  setPurchaseMode,
  updateContribution,
} from '@/app/actions/gifts';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { ConfirmButton } from '@/components/ConfirmButton';
import { Page } from '@/components/Page';
import { Avatar, AvatarPair, Notice, Section } from '@/components/ui';
import { Icon } from '@/components/icons';

const SHARE_COLORS = ['#1F6B52', '#5FA383', '#A9D3BD', '#2F6FB0', '#8FB8E0', '#C98A1B', '#E0B33E', '#8A5CC2'];

export default async function GiftPage({ params }: { params: Promise<{ eventId: string; giftId: string }> }) {
  const { eventId, giftId } = await params;
  const view = await loadEvent(eventId);
  const { data, dir, event } = view;
  const gift = data.gifts.find((g) => g.id === giftId);
  if (!gift) notFound();
  const gv = giftView(gift);
  const opts = { sharedCouples: true };
  const balances = computeBalances(data, opts, dir);
  const lines = balances.lines.filter((l) => l.giftId === giftId);
  const remainingDue = sum(lines.map((l) => l.remainingCents));
  const payerAccounts = new Set(gift.advances.map((a) => accountOfPerson(dir, a.payerId, opts)));
  const logs = await prisma.giftLog.findMany({ where: { giftId }, orderBy: { createdAt: 'desc' }, take: 30 });
  const participants = data.participants.map((p) => p.personId).sort((a, b) => dir.personName(a).localeCompare(dir.personName(b), 'fr'));
  const couples = data.couples.filter((c) => view.participantIds.has(c.personAId) || view.participantIds.has(c.personBId));
  const base = `/events/${eventId}/gifts/${giftId}`;
  const priceRef = gift.priceCents || gv.fundedCents || 1;

  function refundState(party: { personId: string | null; coupleId: string | null }) {
    const accs = partyAccounts(dir, party, opts).map((a) => a.key);
    if (accs.some((k) => payerAccounts.has(k))) {
      const advanced = sum(gift!.advances.filter((a) => accs.includes(accountOfPerson(dir, a.payerId, opts))).map((a) => a.amountCents));
      return { label: `A avancé ${formatEUR(advanced)}`, bg: '#E7F0FA', fg: '#245A93' };
    }
    if (gift!.advances.length === 0) return { label: 'Pas d’avance', bg: '#F1F1EF', fg: '#6F6E69' };
    const mine = lines.filter((l) => accs.includes(l.debtor));
    const left = sum(mine.map((l) => l.remainingCents));
    if (mine.length === 0) return { label: '—', bg: '#F1F1EF', fg: '#6F6E69' };
    if (left === 0) return { label: 'Remboursé', bg: '#E3F1E9', fg: '#1F6B45' };
    const to = [...new Set(mine.filter((l) => l.remainingCents > 0).map((l) => accountLabel(dir, l.creditor)))].join(', ');
    return { label: `Doit ${formatEUR(left)} à ${to}`, bg: '#FCEBD9', fg: '#8F4A0E' };
  }

  const steps = stepsFor(gift.purchaseMode);

  return (
    <Page
      crumbs={[
        { href: `/events/${eventId}`, label: event.name },
        { href: `/events/${eventId}/gifts`, label: 'Cadeaux' },
        { label: gift.name },
      ]}
      width="max-w-[960px]"
      actions={
        <>
          <Link href={`${base}/edit`} className="btn">
            <Icon name="pencil" size={14} />
            Modifier
          </Link>
          <form action={duplicateGift.bind(null, eventId, giftId)}>
            <button type="submit" className="btn">
              <Icon name="copy" size={14} />
              Dupliquer
            </button>
          </form>
          <form action={deleteGift.bind(null, eventId, giftId)}>
            <ConfirmButton message={`Supprimer « ${gift.name} » et ses participations ?`} className="btn-danger" ariaLabel="Supprimer le cadeau">
              <Icon name="trash" size={14} />
            </ConfirmButton>
          </form>
        </>
      }
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: STATUS_STYLE[gift.status].bg, color: STATUS_STYLE[gift.status].fg }}>
        <Icon name="gift" size={30} strokeWidth={1.5} />
      </div>
      <h1 className="mb-5 text-[30px] font-bold leading-tight tracking-tight md:text-[36px]">{gift.name}</h1>

      {/* Propriétés */}
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-[170px_minmax(0,1fr)] sm:items-center">
        <dt className="flex items-center gap-2 text-muted">
          <Icon name="clock" size={15} />
          Statut
        </dt>
        <dd>
          <form action={setGiftStatus} className="flex flex-wrap gap-1.5" aria-label="Changer le statut">
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="giftId" value={giftId} />
            {steps.map((s) => {
              const on = gift.status === s;
              return (
                <button
                  key={s}
                  type="submit"
                  name="status"
                  value={s}
                  aria-pressed={on}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] transition-colors hover:bg-soft"
                  style={on ? { background: STATUS_STYLE[s].bg, color: STATUS_STYLE[s].fg, borderColor: STATUS_STYLE[s].fg, fontWeight: 600 } : { borderColor: '#E3E2DF', color: '#5F5E5B' }}
                >
                  <span className="h-[7px] w-[7px] rounded-full" style={{ background: STATUS_STYLE[s].bar }} />
                  {STATUS_LABEL[s]}
                  <span className="text-[11px] opacity-80">{giftPercent(s, gift.purchaseMode)} %</span>
                </button>
              );
            })}
          </form>
        </dd>

        <dt className="flex items-center gap-2 text-muted">
          <Icon name="users" size={15} />
          Pour
        </dt>
        <dd className="flex flex-wrap items-center gap-1.5">
          {gift.recipientIds.map((id) => (
            <Link key={id} href={`/events/${eventId}/people/${id}`} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-line2 pl-1 pr-2.5 text-[13px] font-medium hover:bg-hover">
              <Avatar initials={dir.initials(id)} color={dir.person(id)?.color} size={20} />
              {dir.personName(id)}
            </Link>
          ))}
          {gift.recipientIds.length > 1 ? (
            <span className="ml-1 text-xs text-muted">{formatEUR(gv.shareByRecipient.get(gift.recipientIds[0]) ?? 0)} environ chacun</span>
          ) : null}
        </dd>

        <dt className="flex items-center gap-2 text-muted">
          <Icon name="money" size={15} />
          Prix
        </dt>
        <dd className="font-semibold tabular">{formatEUR(gift.priceCents, { forceCents: true })}</dd>

        {gift.url ? (
          <>
            <dt className="flex items-center gap-2 text-muted">
              <Icon name="link" size={15} />
              Lien
            </dt>
            <dd className="min-w-0">
              <a href={gift.url} target="_blank" rel="noopener noreferrer" className="block truncate underline decoration-[#D3D2CE] underline-offset-[3px] hover:text-pine">
                {gift.url.replace(/^https?:\/\//, '')}
              </a>
            </dd>
          </>
        ) : null}

        <dt className="flex items-center gap-2 text-muted">
          <Icon name="store" size={15} />
          Achat
        </dt>
        <dd className="flex flex-wrap items-center gap-2.5">
          <form action={setPurchaseMode} className="segmented" aria-label="Mode d’achat">
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="giftId" value={giftId} />
            <button type="submit" name="purchaseMode" value="ON_SITE" aria-pressed={gift.purchaseMode === 'ON_SITE'}>
              <Icon name="store" size={14} />
              Sur place
            </button>
            <button type="submit" name="purchaseMode" value="REMOTE" aria-pressed={gift.purchaseMode === 'REMOTE'}>
              <Icon name="truck" size={14} />
              À distance
            </button>
          </form>
          <span className="text-xs text-muted">
            {gift.purchaseMode === 'ON_SITE' ? 'Pas d’étape « Reçu » : Acheté = 67 %.' : '5 étapes : Acheté = 50 %, Reçu = 75 %.'}
          </span>
        </dd>

        {gift.purchaseMode === 'REMOTE' ? (
          <>
            <dt className="flex items-center gap-2 text-muted">
              <Icon name="calendar" size={15} />
              Livraison prévue
            </dt>
            <dd>
              {gift.deliveryDate ? (
                <>
                  {longDate(gift.deliveryDate)}{' '}
                  <span className="text-muted">
                    {(() => {
                      const d = daysUntil(gift.deliveryDate);
                      return d > 0 ? `· dans ${d} jour${d > 1 ? 's' : ''}` : d === 0 ? '· aujourd’hui' : '· date passée';
                    })()}
                  </span>
                </>
              ) : (
                <Link href={`${base}/edit`} className="text-muted underline">
                  Renseigner une date
                </Link>
              )}
            </dd>
          </>
        ) : null}

        {gift.note ? (
          <>
            <dt className="flex items-center gap-2 text-muted">
              <Icon name="pencil" size={15} />
              Note
            </dt>
            <dd className="text-[#5F5E5B]">{gift.note}</dd>
          </>
        ) : null}
      </dl>

      {/* Avances */}
      <Section
        className="mt-9"
        title="Avances"
        aside={
          <span className="text-[13px] text-muted">
            Avancé{' '}
            <b className="text-credit-text tabular">
              {formatEUR(gv.advancedCents)} / {formatEUR(gift.priceCents)}
            </b>
          </span>
        }
      >
        <p className="-mt-1 mb-3 text-[13px] text-muted">Qui a payé le cadeau en attendant que chacun rembourse sa part.</p>
        <div className="overflow-hidden rounded-[10px] border border-line">
          {gift.advances.map((a, i) => {
            const acc = accountOfPerson(dir, a.payerId, opts);
            return (
              <div key={a.id} className={`flex flex-wrap items-center gap-3 px-3.5 py-3 ${i ? 'border-t border-line2' : ''}`}>
                <Avatar initials={dir.initials(a.payerId)} color={dir.person(a.payerId)?.color} size={30} />
                <div className="min-w-[180px] flex-1">
                  <div className="font-semibold">{dir.personName(a.payerId)}</div>
                  <div className="text-xs text-muted">
                    {acc.startsWith('c:') ? `pour le compte ${accountLabel(dir, acc)} · ` : ''}payé le {shortDate(a.paidAt)}
                    {a.note ? ` · ${a.note}` : ''}
                  </div>
                </div>
                <span className="font-bold text-credit-text tabular">{formatEUR(a.amountCents, { forceCents: true })}</span>
                <form action={deleteAdvance.bind(null, eventId, giftId, a.id)}>
                  <ConfirmButton message="Retirer cette avance ?" className="icon-btn" ariaLabel={`Retirer l’avance de ${dir.firstName(a.payerId)}`}>
                    <Icon name="trash" size={14} />
                  </ConfirmButton>
                </form>
              </div>
            );
          })}
          <details className={gift.advances.length ? 'border-t border-line2' : ''} open={gift.advances.length === 0 && gift.status !== 'IDEA'}>
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-[13px] text-muted hover:bg-soft">
              <Icon name="plus" size={14} />
              {gift.advances.length ? 'Ajouter une avance (plusieurs payeurs, paiement en plusieurs fois…)' : 'Quelqu’un a avancé l’argent'}
            </summary>
            <ActionForm action={addAdvance.bind(null, eventId, giftId)} resetOnSuccess className="flex flex-wrap items-end gap-2 border-t border-line2 bg-soft px-3.5 py-3">
              <div className="flex min-w-[170px] flex-1 flex-col gap-1">
                <label htmlFor="adv-payer" className="text-xs text-muted">
                  Payé par
                </label>
                <select id="adv-payer" name="payerId" className="input" defaultValue="" required>
                  <option value="" disabled>
                    Choisir…
                  </option>
                  {participants.map((id) => (
                    <option key={id} value={id}>
                      {dir.personName(id)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex w-28 flex-col gap-1">
                <label htmlFor="adv-amount" className="text-xs text-muted">
                  Montant
                </label>
                <input
                  id="adv-amount"
                  name="amount"
                  inputMode="decimal"
                  defaultValue={centsToInput(Math.max(0, gift.priceCents - gv.advancedCents)) || ''}
                  className="input text-right tabular"
                  required
                />
              </div>
              <div className="flex w-36 flex-col gap-1">
                <label htmlFor="adv-date" className="text-xs text-muted">
                  Le
                </label>
                <input id="adv-date" name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
              </div>
              <div className="flex min-w-[140px] flex-1 flex-col gap-1">
                <label htmlFor="adv-note" className="text-xs text-muted">
                  Note
                </label>
                <input id="adv-note" name="note" className="input" placeholder="carte, espèces…" />
              </div>
              <SubmitButton>Ajouter</SubmitButton>
            </ActionForm>
          </details>
        </div>
        {gift.advances.length > 0 ? (
          <Notice tone={remainingDue > 0 ? 'credit' : 'ok'} className="mt-2.5">
            {remainingDue > 0 ? (
              <>
                Reste dû sur ce cadeau : <b>{formatEUR(remainingDue)}</b>{' '}
                ({[...new Set(lines.filter((l) => l.remainingCents > 0).map((l) => `${accountLabel(dir, l.debtor)} → ${accountLabel(dir, l.creditor)}`))].join(' ; ')}).{' '}
              </>
            ) : lines.length ? (
              'Tout le monde a remboursé sa part de ce cadeau. '
            ) : (
              'Aucun remboursement attendu : seuls les payeurs participent. '
            )}
            <Link href={`/events/${eventId}/balances`} className="font-semibold underline underline-offset-2">
              Voir les balances
            </Link>
          </Notice>
        ) : null}
        {balances.uncovered.find((u) => u.giftId === giftId) ? (
          <Notice tone="warn" className="mt-2.5">
            {formatEUR(balances.uncovered.find((u) => u.giftId === giftId)!.cents)} d’avance ne sont couverts par aucune participation : ajoutez des participations pour les répartir.
          </Notice>
        ) : null}
      </Section>

      {/* Participations */}
      <Section
        className="mt-9"
        title="Répartition des participations"
        aside={
          <span className="text-[13px] text-muted">
            Financé{' '}
            <b className={`tabular ${gv.fundedCents === gift.priceCents ? 'text-[#1F6B45]' : gv.fundedCents > gift.priceCents ? 'text-danger' : 'text-warn-text'}`}>
              {formatEUR(gv.fundedCents)} / {formatEUR(gift.priceCents)}
            </b>
          </span>
        }
      >
        <span id="participer" />
        {gift.contributions.length > 0 ? (
          <div className="mb-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-line2" role="img" aria-label="Répartition des participations">
            {gift.contributions.map((c, i) => (
              <div key={c.id} style={{ width: `${Math.min(100, (c.amountCents / Math.max(priceRef, gv.fundedCents)) * 100)}%`, background: SHARE_COLORS[i % SHARE_COLORS.length] }} />
            ))}
          </div>
        ) : null}
        <div className="rounded-[10px] border border-line">
          {gift.contributions.length === 0 ? (
            <p className="px-3.5 py-3 text-[13px] text-muted">Personne ne participe encore à ce cadeau.</p>
          ) : (
            gift.contributions.map((c, i) => {
              const r = refundState(c);
              const couple = c.coupleId ? dir.couple(c.coupleId) : undefined;
              const pa = couple ? dir.person(couple.personAId) : undefined;
              const pb = couple ? dir.person(couple.personBId) : undefined;
              return (
                <div key={c.id} className={i ? 'border-t border-line2' : ''}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: SHARE_COLORS[i % SHARE_COLORS.length] }} />
                    {couple && pa && pb ? (
                      <AvatarPair a={{ initials: dir.initials(pa.id), color: pa.color }} b={{ initials: dir.initials(pb.id), color: pb.color }} />
                    ) : c.personId ? (
                      <Avatar initials={dir.initials(c.personId)} color={dir.person(c.personId)?.color} size={26} />
                    ) : null}
                    <span className="min-w-[140px] flex-1 font-medium">{dir.partyName(c)}</span>
                    <span className="w-16 text-xs text-muted">{couple ? 'Couple' : 'Personne'}</span>
                    <span className="tag" style={{ background: r.bg, color: r.fg }}>
                      {r.label}
                    </span>
                    <span className="w-24 text-right font-semibold tabular">{formatEUR(c.amountCents, { forceCents: true })}</span>
                    <span className="w-12 text-right text-muted tabular">{Math.round((c.amountCents / priceRef) * 100)} %</span>
                    <details className="relative">
                      <summary className="icon-btn cursor-pointer list-none" aria-label={`Modifier la participation de ${dir.partyName(c, true)}`}>
                        <Icon name="pencil" size={14} />
                      </summary>
                      <div className="absolute right-0 z-10 mt-1 w-64 rounded-lg border border-line bg-white p-3 shadow-lg">
                        <ActionForm action={updateContribution.bind(null, eventId, giftId, c.id)} className="flex items-end gap-2">
                          <div className="flex flex-1 flex-col gap-1">
                            <label htmlFor={`ca-${c.id}`} className="text-xs text-muted">
                              Nouveau montant
                            </label>
                            <input id={`ca-${c.id}`} name="amount" defaultValue={centsToInput(c.amountCents)} inputMode="decimal" className="input text-right tabular" />
                          </div>
                          <SubmitButton>OK</SubmitButton>
                        </ActionForm>
                      </div>
                    </details>
                    <form action={deleteContribution.bind(null, eventId, giftId, c.id)}>
                      <ConfirmButton message={`Retirer la participation de ${dir.partyName(c, true)} ?`} className="icon-btn" ariaLabel={`Supprimer la participation de ${dir.partyName(c, true)}`}>
                        <Icon name="trash" size={14} />
                      </ConfirmButton>
                    </form>
                  </div>
                </div>
              );
            })
          )}

          <div className="rounded-b-[10px] border-t border-line bg-[#FBFBFA] px-3.5 py-3.5">
            <div className="mb-2.5 text-[13px] font-semibold">Ajouter une participation</div>
            <ActionForm action={addContribution.bind(null, eventId, giftId)} resetOnSuccess className="flex flex-wrap items-end gap-2">
              <div className="flex min-w-[200px] flex-1 flex-col gap-1">
                <label htmlFor="ct-party" className="text-xs text-muted">
                  Qui participe (personne ou couple)
                </label>
                <select id="ct-party" name="party" className="input" defaultValue="" required>
                  <option value="" disabled>
                    Choisir…
                  </option>
                  {couples.length ? (
                    <optgroup label="Couples">
                      {couples.map((c) => (
                        <option key={c.id} value={`c:${c.id}`}>
                          {dir.coupleFullName(c.id)}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  <optgroup label="Personnes">
                    {participants.map((id) => (
                      <option key={id} value={`p:${id}`}>
                        {dir.personName(id)}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div className="flex w-32 flex-col gap-1">
                <label htmlFor="ct-amount" className="text-xs text-muted">
                  Montant
                </label>
                <input
                  id="ct-amount"
                  name="amount"
                  inputMode="decimal"
                  defaultValue={gv.remainingCents > 0 ? centsToInput(gv.remainingCents) : ''}
                  placeholder="0,00"
                  className="input text-right tabular"
                  required
                />
              </div>
              <SubmitButton>Ajouter</SubmitButton>
            </ActionForm>
            {gv.remainingCents > 0 ? (
              <p className="mt-2 text-xs text-muted">Reste à financer : {formatEUR(gv.remainingCents)} (montant proposé par défaut).</p>
            ) : null}
            {gv.remainingCents < 0 ? (
              <form action={scaleContributionsToPrice.bind(null, eventId, giftId)} className="mt-2.5">
                <Notice tone="warn">
                  Les participations dépassent le prix de {formatEUR(-gv.remainingCents)}.{' '}
                  <button type="submit" className="font-semibold underline underline-offset-2">
                    Réduire les parts au prorata
                  </button>
                </Notice>
              </form>
            ) : null}
          </div>
        </div>
      </Section>

      {/* Historique */}
      {logs.length > 0 ? (
        <Section className="mt-9" title="Historique">
          <ul className="flex flex-col">
            {logs.map((l) => (
              <li key={l.id} className="flex gap-2.5 py-1.5 text-[13px]">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#B9B8B3]" />
                <span className="text-[#5F5E5B]">{l.message}</span>
                <span className="ml-auto whitespace-nowrap text-muted">{shortDate(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <p className="mt-8 text-xs text-muted">
        Pour {recipientsLabel(dir, gift.recipientIds)} · {STATUS_LABEL[gift.status]} ({gv.percent} %)
      </p>
    </Page>
  );
}
