import Link from 'next/link';
import { loadEvent } from '@/lib/event-data';
import { accountLabel, computeBalances, type AccountKey } from '@/lib/domain/balances';
import { centsToInput, formatEUR } from '@/lib/domain/money';
import { shortDate } from '@/lib/ui';
import { addRepayment, deleteRepayment, settleTransfer } from '@/app/actions/balances';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { ConfirmButton } from '@/components/ConfirmButton';
import { Page } from '@/components/Page';
import { Empty, Notice, PageHeader, Section, StatCard } from '@/components/ui';
import { Icon } from '@/components/icons';

export const metadata = { title: 'Balances' };

export default async function BalancesPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ shared?: string; simplify?: string }>;
}) {
  const { eventId } = await params;
  const sp = await searchParams;
  const sharedCouples = sp.shared !== '0';
  const simplify = sp.simplify !== '0';
  const { event, data, dir } = await loadEvent(eventId);
  const b = computeBalances(data, { sharedCouples }, dir);
  const transfers = simplify ? b.simplified : b.pairwise;
  const maxAbs = Math.max(1, ...b.accounts.map((a) => Math.abs(a.netCents)));
  const giftName = new Map(data.gifts.map((g) => [g.id, g.name]));
  const label = (k: AccountKey) => accountLabel(dir, k);
  const zero = b.accounts.filter((a) => a.netCents === 0);
  const nonZero = b.accounts.filter((a) => a.netCents !== 0);

  // Comptes proposés pour une saisie libre
  const accountKeys = new Set<string>();
  for (const p of data.participants) {
    const c = dir.coupleOf(p.personId);
    accountKeys.add(sharedCouples && c?.sharedAccount ? 'c:' + c.id : 'p:' + p.personId);
  }
  const accountOptions = [...accountKeys].map((k) => ({ key: k, label: label(k) })).sort((x, y) => x.label.localeCompare(y.label, 'fr'));

  const toggle = (key: 'shared' | 'simplify', on: boolean) => {
    const p = new URLSearchParams();
    if (key === 'shared' ? !on : !sharedCouples) p.set('shared', '0');
    if (key === 'simplify' ? !on : !simplify) p.set('simplify', '0');
    const s = p.toString();
    return s ? `?${s}` : '?';
  };

  return (
    <Page crumbs={[{ href: `/events/${eventId}`, label: event.name }, { label: 'Balances' }]}>
      <PageHeader title="Balances" subtitle="Qui a avancé de l’argent, qui doit combien à qui, et ce qui a déjà été remboursé." />

      <div className="-mt-2 mb-5 flex flex-wrap gap-2">
        <Link href={toggle('shared', !sharedCouples)} scroll={false} className="tag h-8 gap-2 bg-soft px-3 text-[13px] text-ink hover:bg-line2">
          <span className={`flex h-4 w-4 items-center justify-center rounded ${sharedCouples ? 'bg-pine text-white' : 'border border-[#B9B8B3] bg-white'}`}>
            {sharedCouples ? <Icon name="check" size={11} strokeWidth={3} /> : null}
          </span>
          Couples en compte commun<span className="sr-only">{sharedCouples ? ' (activé)' : ' (désactivé)'}</span>
        </Link>
        <Link href={toggle('simplify', !simplify)} scroll={false} className="tag h-8 gap-2 bg-soft px-3 text-[13px] text-ink hover:bg-line2">
          <span className={`flex h-4 w-4 items-center justify-center rounded ${simplify ? 'bg-pine text-white' : 'border border-[#B9B8B3] bg-white'}`}>
            {simplify ? <Icon name="check" size={11} strokeWidth={3} /> : null}
          </span>
          Simplifier les remboursements<span className="sr-only">{simplify ? ' (activé)' : ' (désactivé)'}</span>
        </Link>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <StatCard label="Avances" value={<span className="text-credit-text">{formatEUR(b.totalAdvancedCents)}</span>} hint={`sur ${data.gifts.filter((g) => g.advances.length).length} cadeau(x)`} />
        <StatCard label="Déjà remboursé" value={<span className="text-[#1F6B45]">{formatEUR(b.totalRepaidCents)}</span>} hint={`${data.repayments.length} remboursement(s) enregistré(s)`} />
        <StatCard label="Reste à rembourser" value={<span className="text-debt-text">{formatEUR(b.outstandingCents)}</span>} hint={`${b.pairwise.length} dette(s) entre comptes`} />
        <div className="rounded-[10px] border border-[#CFE2D7] bg-[#F3F8F5] p-4">
          <div className="text-xs font-semibold text-[#1F6B45]">Après simplification</div>
          <div className="mt-1 text-[26px] font-bold tabular">{formatEUR(b.simplifiedCents)}</div>
          <div className="mt-2 text-xs text-[#5F5E5B]">
            {b.simplified.length} virement(s)
            {b.outstandingCents > b.simplifiedCents ? ` · ${formatEUR(b.outstandingCents - b.simplifiedCents)} de moins à faire circuler` : ''}
          </div>
        </div>
      </div>

      {b.uncovered.length > 0 ? (
        <Notice tone="warn" className="mt-4">
          Avances non couvertes par des participations :{' '}
          {b.uncovered.map((u, i) => (
            <span key={u.giftId}>
              {i ? ', ' : ''}
              <Link href={`/events/${eventId}/gifts/${u.giftId}`} className="underline">
                {giftName.get(u.giftId)}
              </Link>{' '}
              ({formatEUR(u.cents)})
            </span>
          ))}
          . Cette part reste à la charge du payeur tant qu’aucune participation ne la couvre.
        </Notice>
      ) : null}

      {b.accounts.length === 0 ? (
        <div className="mt-8">
          <Empty icon="scale" title="Aucune avance pour l’instant">
            Quand quelqu’un paie un cadeau pour les autres, notez une avance sur la fiche du cadeau : les dettes de chacun apparaîtront ici.
          </Empty>
        </div>
      ) : (
        <div className="mt-9 grid items-start gap-7 lg:grid-cols-2">
          <Section title="Solde par compte">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-debt-text">← doit de l’argent</span>
              <span className="text-credit-text">on lui doit →</span>
            </div>
            <ul className="mt-2.5 flex flex-col gap-3">
              {nonZero.map((a) => (
                <li key={a.key}>
                  <div className="flex items-baseline gap-1.5 text-[13px]">
                    {a.isCouple ? <Icon name="rings" size={12} strokeWidth={2} className="text-couple" label="couple" /> : null}
                    <span className="font-semibold">{a.label}</span>
                    <span className={`ml-auto font-bold tabular ${a.netCents > 0 ? 'text-credit-text' : 'text-debt-text'}`}>{formatEUR(a.netCents, { sign: true })}</span>
                  </div>
                  <div className="mt-1 grid h-3 grid-cols-2">
                    <div className="flex justify-end border-r border-[#B9B8B3]">
                      {a.netCents < 0 ? <div className="rounded-l bg-debt" style={{ width: `${(-a.netCents / maxAbs) * 100}%` }} /> : null}
                    </div>
                    <div className="flex">
                      {a.netCents > 0 ? <div className="rounded-r bg-credit" style={{ width: `${(a.netCents / maxAbs) * 100}%` }} /> : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {zero.length ? <p className="mt-3.5 text-xs text-muted">À 0 € : {zero.map((a) => a.label).join(', ')}.</p> : null}
          </Section>

          <Section title="Remboursements à faire" count={`${transfers.length} · ${simplify ? 'simplifiés' : 'détaillés'}`}>
            {transfers.length === 0 ? (
              <Notice tone="ok">Tout est soldé.</Notice>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {transfers.map((t) => (
                  <li key={t.from + t.to} className="card p-3.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-semibold">{label(t.from)}</span>
                      <Icon name="arrowRight" size={17} className="text-muted" label="doit à" />
                      <span className="font-semibold">{label(t.to)}</span>
                      <span className="ml-auto text-lg font-bold tabular">{formatEUR(t.amountCents)}</span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-start gap-2">
                      <ActionForm action={settleTransfer.bind(null, eventId)}>
                        <input type="hidden" name="from" value={t.from} />
                        <input type="hidden" name="to" value={t.to} />
                        <input type="hidden" name="amountCents" value={t.amountCents} />
                        <SubmitButton className="btn-primary h-8 px-3" pendingLabel="…">
                          <Icon name="check" size={14} strokeWidth={2.6} />
                          Marquer comme remboursé
                        </SubmitButton>
                      </ActionForm>
                      <details>
                        <summary className="btn h-8 cursor-pointer list-none">Remboursement partiel</summary>
                        <ActionForm action={settleTransfer.bind(null, eventId)} resetOnSuccess className="mt-2 flex items-end gap-2">
                          <input type="hidden" name="from" value={t.from} />
                          <input type="hidden" name="to" value={t.to} />
                          <input type="hidden" name="amountCents" value={t.amountCents} />
                          <div className="flex flex-col gap-1">
                            <label htmlFor={`partial-${t.from}-${t.to}`} className="text-xs text-muted">
                              Montant
                            </label>
                            <input id={`partial-${t.from}-${t.to}`} name="partialAmount" inputMode="decimal" placeholder={centsToInput(t.amountCents)} className="input h-8 w-28 text-right tabular" />
                          </div>
                          <SubmitButton className="btn h-8">OK</SubmitButton>
                        </ActionForm>
                      </details>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {simplify && b.simplified.length > 0 ? (
              <p className="mt-3 text-xs text-muted">
                Les virements simplifiés soldent tous les comptes avec le moins de mouvements possible : une personne peut rembourser quelqu’un d’autre que celui qui a avancé pour son cadeau.
              </p>
            ) : null}
          </Section>
        </div>
      )}

      {b.lines.length > 0 ? (
        <Section className="mt-9" title="Origine des dettes, cadeau par cadeau">
          {/* Mobile : une carte par dette */}
          <ul className="flex flex-col gap-2 md:hidden">
            {b.lines.map((l, i) => (
              <li key={i}>
                <Link href={`/events/${eventId}/gifts/${l.giftId}`} className="card row-link block px-3.5 py-3 tabular">
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 font-semibold">{giftName.get(l.giftId)}</span>
                    <span className={`tag shrink-0 ${l.remainingCents === 0 ? 'bg-[#E3F1E9] text-[#1F6B45]' : 'bg-debt-bg text-debt-text'}`}>
                      {l.remainingCents === 0 ? 'Remboursé' : 'En attente'}
                    </span>
                  </div>
                  <div className="mt-1 text-[13px] text-[#5F5E5B]">
                    {label(l.debtor)} doit à <span className="text-credit-text">{label(l.creditor)}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-[13px]">
                    <span>
                      <span className="block text-[11px] text-muted">Part</span>
                      {formatEUR(l.amountCents)}
                    </span>
                    <span className="text-[#1F6B45]">
                      <span className="block text-[11px] text-muted">Remboursé</span>
                      {l.repaidCents ? formatEUR(l.repaidCents) : '—'}
                    </span>
                    <span className="font-semibold">
                      <span className="block text-[11px] font-normal text-muted">Reste</span>
                      {formatEUR(l.remainingCents)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <div>
              <div className="grid grid-cols-[minmax(140px,1fr)_150px_150px_84px_90px_84px_110px] gap-3 px-3 py-2 text-xs font-medium text-muted">
                <span>Cadeau</span>
                <span>Avancé par</span>
                <span>Doit</span>
                <span className="text-right">Part</span>
                <span className="text-right">Remboursé</span>
                <span className="text-right">Reste</span>
                <span>État</span>
              </div>
              {b.lines.map((l, i) => (
                <Link
                  key={i}
                  href={`/events/${eventId}/gifts/${l.giftId}`}
                  className="row-link grid grid-cols-[minmax(140px,1fr)_150px_150px_84px_90px_84px_110px] items-center gap-3 border-t border-line2 px-3 py-2 tabular"
                >
                  <span className="truncate font-medium">{giftName.get(l.giftId)}</span>
                  <span className="truncate text-credit-text">{label(l.creditor)}</span>
                  <span className="truncate">{label(l.debtor)}</span>
                  <span className="text-right">{formatEUR(l.amountCents)}</span>
                  <span className="text-right text-[#1F6B45]">{l.repaidCents ? formatEUR(l.repaidCents) : '—'}</span>
                  <span className="text-right font-semibold">{formatEUR(l.remainingCents)}</span>
                  <span>
                    <span className={`tag ${l.remainingCents === 0 ? 'bg-[#E3F1E9] text-[#1F6B45]' : 'bg-debt-bg text-debt-text'}`}>
                      {l.remainingCents === 0 ? 'Remboursé' : 'En attente'}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </Section>
      ) : null}

      <div className="mt-9 grid items-start gap-7 lg:grid-cols-2">
        <Section title="Remboursements enregistrés" count={data.repayments.length}>
          {data.repayments.length === 0 ? (
            <p className="text-[13px] text-muted">Aucun remboursement enregistré.</p>
          ) : (
            <ul className="flex flex-col">
              {[...data.repayments].reverse().map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line2 py-2.5 last:border-0">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E3F1E9] text-[#1F6B45]">
                    <Icon name="check" size={14} strokeWidth={2.6} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="font-semibold">{dir.partyName(r.from, true)}</b> a remboursé <b className="font-semibold">{dir.partyName(r.to, true)}</b>
                    <span className="block text-xs text-muted">
                      {shortDate(r.paidAt)}
                      {r.note ? ` · ${r.note}` : ''}
                    </span>
                  </span>
                  <span className="font-bold text-[#1F6B45] tabular">{formatEUR(r.amountCents)}</span>
                  <form action={deleteRepayment.bind(null, eventId, r.id)}>
                    <ConfirmButton message="Annuler ce remboursement ?" className="btn-ghost h-7">
                      Annuler
                    </ConfirmButton>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Enregistrer un remboursement">
          {accountOptions.length < 2 ? (
            <p className="text-[13px] text-muted">Il faut au moins deux comptes dans l’événement.</p>
          ) : (
            <ActionForm action={addRepayment.bind(null, eventId)} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="rp-from" className="label">
                  Qui rembourse
                </label>
                <select id="rp-from" name="from" className="input" defaultValue="" required>
                  <option value="" disabled>
                    Choisir…
                  </option>
                  {accountOptions.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="rp-to" className="label">
                  À qui
                </label>
                <select id="rp-to" name="to" className="input" defaultValue="" required>
                  <option value="" disabled>
                    Choisir…
                  </option>
                  {accountOptions.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="rp-amount" className="label">
                  Montant
                </label>
                <input id="rp-amount" name="amount" inputMode="decimal" className="input text-right tabular" required />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="rp-date" className="label">
                  Date
                </label>
                <input id="rp-date" name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="input" />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label htmlFor="rp-note" className="label">
                  Note
                </label>
                <input id="rp-note" name="note" className="input" placeholder="virement, espèces…" />
              </div>
              <div className="sm:col-span-2">
                <SubmitButton>Enregistrer</SubmitButton>
              </div>
            </ActionForm>
          )}
        </Section>
      </div>
    </Page>
  );
}
