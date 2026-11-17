import Link from 'next/link';
import { loadEvent } from '@/lib/event-data';
import { recipientsLabel } from '@/lib/gift-form-data';
import { computeBalances } from '@/lib/domain/balances';
import { computeFlows, computePayers, type FlowLevel } from '@/lib/domain/finance';
import { formatEUR, sum } from '@/lib/domain/money';
import { STATUS_LABEL } from '@/lib/domain/status';
import { STATUS_STYLE } from '@/lib/ui';
import { Page } from '@/components/Page';
import { Avatar, Empty, PageHeader, Section, StatCard } from '@/components/ui';
import { Icon } from '@/components/icons';

export const metadata = { title: 'Finances' };

const LEVELS: { key: FlowLevel; label: string }[] = [
  { key: 'person', label: 'Personnes' },
  { key: 'couple', label: 'Couples' },
  { key: 'family', label: 'Familles' },
];

export default async function FinancesPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ level?: string }>;
}) {
  const { eventId } = await params;
  const sp = await searchParams;
  const level: FlowLevel = sp.level === 'person' || sp.level === 'couple' ? sp.level : 'family';
  const { event, data, dir, stats, eventStats: ev } = await loadEvent(eventId);
  const payers = computePayers(data, dir);
  const flows = computeFlows(data, level, dir);
  const balances = computeBalances(data, { sharedCouples: true }, dir);
  const maxPayer = Math.max(1, ...payers.map((p) => p.totalCents));
  const maxCell = Math.max(1, ...flows.cells.values());
  const overs = [...stats.values()].filter((s) => s.overReceiveCents > 0 || s.overSpendCents > 0);
  const persons = [...stats.values()].sort((a, b) => dir.personName(a.personId).localeCompare(dir.personName(b.personId), 'fr'));
  const ledger = data.gifts
    .flatMap((g) => g.contributions.map((c) => ({ c, g })))
    .sort((a, b) => b.c.amountCents - a.c.amountCents);
  const contributionCount = ledger.length;

  return (
    <Page
      crumbs={[{ href: `/events/${eventId}`, label: event.name }, { label: 'Finances' }]}
      actions={
        <Link href={`/events/${eventId}/export`} className="btn">
          <Icon name="download" size={15} />
          Exporter Excel
        </Link>
      }
    >
      <PageHeader title="Finances" subtitle={`Toutes les dépenses de ${event.name} : qui a payé, combien, et pour qui.`} />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        <StatCard label="Total engagé" value={formatEUR(ev.engagedCents)} hint={ev.plannedCents ? `sur ${formatEUR(ev.plannedCents)} prévus` : 'aucun plafond défini'} />
        <StatCard
          label="Financé"
          value={formatEUR(ev.fundedCents)}
          hint={ev.underfundedCount ? `${ev.underfundedCount} cadeau${ev.underfundedCount > 1 ? 'x' : ''} pas entièrement financé${ev.underfundedCount > 1 ? 's' : ''}` : 'Tous les cadeaux sont financés'}
          hintClass={ev.underfundedCount ? 'text-warn-text' : 'text-muted'}
        />
        <StatCard
          label="Reste au budget"
          value={ev.plannedCents ? formatEUR(ev.plannedCents - ev.engagedCents) : '—'}
          hint={
            overs.length
              ? `Plafond dépassé : ${overs
                  .map((s) => `${dir.firstName(s.personId)} (${s.overReceiveCents > 0 && s.overSpendCents > 0 ? 'reçu, dépense' : s.overReceiveCents > 0 ? 'reçu' : 'dépense'})`)
                  .join(', ')}`
              : 'Aucun plafond dépassé'
          }
          hintClass={overs.length ? 'text-danger' : 'text-muted'}
        />
        <StatCard
          label="Prix moyen d’un cadeau"
          value={ev.giftCount ? formatEUR(Math.round(ev.engagedCents / ev.giftCount)) : '—'}
          hint={`${ev.giftCount} cadeaux · ${contributionCount} participations`}
        />
        <StatCard
          label="Déjà payé"
          value={formatEUR(ev.paidCents)}
          hint={`acheté, reçu ou emballé${ev.engagedCents ? ` · ${Math.round((ev.paidCents / ev.engagedCents) * 100)} %` : ''}`}
        />
      </div>

      {balances.simplified.length > 0 ? (
        <Link
          href={`/events/${eventId}/balances`}
          className="mt-3.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 rounded-[10px] border border-[#F3D9BC] bg-[#FDF3E8] px-4 py-3.5"
        >
          <Icon name="scale" size={18} className="text-debt-text" />
          <span className="font-semibold">
            {balances.pairwise.length} remboursement{balances.pairwise.length > 1 ? 's' : ''} en attente · {formatEUR(balances.outstandingCents)}
          </span>
          {balances.simplifiedCents < balances.outstandingCents ? (
            <span className="text-[13px] text-[#5F5E5B]">{formatEUR(balances.simplifiedCents)} en simplifiant</span>
          ) : null}
          <span className="ml-auto text-[13px] font-semibold text-debt-text">Gérer les balances →</span>
        </Link>
      ) : null}

      <div className="mt-9 grid items-start gap-7 lg:grid-cols-2">
        <Section title="Qui a payé" count="seul ou en couple">
          {payers.length === 0 ? (
            <p className="text-[13px] text-muted">Aucune participation pour l’instant.</p>
          ) : (
            <>
              <ul className="flex flex-col gap-2.5">
                {payers.map((p) => (
                  <li key={p.key} className="grid grid-cols-[minmax(0,170px)_minmax(0,1fr)_84px] items-center gap-3">
                    <span className={`flex min-w-0 items-center gap-1.5 ${p.isCouple ? 'font-semibold' : 'font-medium'}`}>
                      {p.isCouple ? <Icon name="rings" size={13} strokeWidth={2} className="shrink-0 text-couple" /> : null}
                      <span className="truncate">{p.label}</span>
                    </span>
                    <span className="h-3.5 overflow-hidden rounded bg-[#F4F4F2]">
                      <span className="block h-full rounded" style={{ width: `${(p.totalCents / maxPayer) * 100}%`, background: p.isCouple ? '#1F6B52' : '#8FC1A9' }} />
                    </span>
                    <span className="text-right font-semibold tabular">{formatEUR(p.totalCents)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3.5 flex gap-4 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-pine" />
                  En couple
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-[#8FC1A9]" />
                  Seul
                </span>
              </div>
            </>
          )}
        </Section>

        <Section title="Dépensé et reçu par personne">
          <p className="-mt-1 mb-2 text-xs text-muted">Dépensé = participations seules + part des participations du couple.</p>
          <div className="overflow-hidden rounded-[10px] border border-line">
            <div className="grid grid-cols-[minmax(0,1fr)_96px_96px_80px] gap-2.5 bg-soft px-3 py-2 text-xs font-medium text-muted">
              <span>Personne</span>
              <span className="text-right">Dépensé</span>
              <span className="text-right">Reçu</span>
              <span className="text-right">Écart</span>
            </div>
            {persons.map((s) => {
              const diff = s.spentCents - s.receivedCents;
              return (
                <Link
                  key={s.personId}
                  href={`/events/${eventId}/people/${s.personId}`}
                  className="row-link grid grid-cols-[minmax(0,1fr)_96px_96px_80px] items-center gap-2.5 border-t border-line2 px-3 py-2 tabular"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Avatar initials={dir.initials(s.personId)} color={dir.person(s.personId)?.color} size={22} />
                    <span className="truncate">{dir.personName(s.personId)}</span>
                  </span>
                  <span className={`text-right font-semibold ${s.overSpendCents > 0 ? 'text-danger' : 'text-credit'}`}>
                    {formatEUR(s.spentCents)}
                    <span className="block text-[11px] font-normal text-muted">{s.spendMaxCents != null ? `max ${formatEUR(s.spendMaxCents)}` : 'sans plafond'}</span>
                  </span>
                  <span className={`text-right font-semibold ${s.overReceiveCents > 0 ? 'text-danger' : 'text-[#A55A12]'}`}>
                    {formatEUR(s.receivedCents)}
                    <span className="block text-[11px] font-normal text-muted">{s.receiveMaxCents != null ? `max ${formatEUR(s.receiveMaxCents)}` : 'sans plafond'}</span>
                  </span>
                  <span className="text-right text-muted">{formatEUR(diff, { sign: true })}</span>
                </Link>
              );
            })}
          </div>
        </Section>
      </div>

      <Section
        className="mt-9"
        title="Qui offre à qui"
        aside={
          <nav className="segmented" aria-label="Niveau de regroupement">
            {LEVELS.map((l) => (
              <Link key={l.key} href={`?level=${l.key}`} aria-current={level === l.key ? 'true' : undefined} scroll={false}>
                {l.label}
              </Link>
            ))}
          </nav>
        }
      >
        {flows.rows.length === 0 ? (
          <p className="text-[13px] text-muted">Aucune participation pour l’instant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-separate border-spacing-1 tabular">
              <thead>
                <tr>
                  <th scope="col" className="px-2 py-1 text-left text-xs font-medium text-muted">
                    De ↓ · Pour →
                  </th>
                  {flows.cols.map((c) => (
                    <th key={c.key} scope="col" className="px-2 py-1 text-right text-xs font-semibold">
                      {c.label}
                    </th>
                  ))}
                  <th scope="col" className="px-2 py-1 text-right text-xs font-semibold text-muted">
                    Total offert
                  </th>
                </tr>
              </thead>
              <tbody>
                {flows.rows.map((r) => (
                  <tr key={r.key}>
                    <th scope="row" className="whitespace-nowrap px-2 py-2 text-left font-semibold">
                      {r.label}
                    </th>
                    {flows.cols.map((c) => {
                      const v = flows.cells.get(r.key + '|' + c.key) ?? 0;
                      return (
                        <td
                          key={c.key}
                          className="rounded-md px-3 py-2 text-right font-medium"
                          style={v ? { background: `rgba(31,107,82,${(0.06 + 0.34 * (v / maxCell)).toFixed(2)})`, color: '#173F31' } : { background: '#FAFAF9', color: '#9B9A97' }}
                        >
                          {v ? formatEUR(v) : '—'}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-bold">{formatEUR(r.totalCents)}</td>
                  </tr>
                ))}
                <tr>
                  <th scope="row" className="px-2 py-2 text-left text-xs font-semibold text-muted">
                    Total reçu
                  </th>
                  {flows.cols.map((c) => (
                    <td key={c.key} className="px-3 py-2 text-right font-bold">
                      {formatEUR(c.totalCents)}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-bold text-pine">{formatEUR(flows.totalCents)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section className="mt-9" title="Toutes les participations" count={contributionCount}>
        {ledger.length === 0 ? (
          <Empty icon="wallet" title="Aucune participation">
            Les participations s’ajoutent depuis la fiche de chaque cadeau.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              <div className="grid grid-cols-[190px_150px_minmax(0,1fr)_110px_100px] gap-3 px-3 py-2 text-xs font-medium text-muted">
                <span>Payé par</span>
                <span>Pour</span>
                <span>Cadeau</span>
                <span>Statut</span>
                <span className="text-right">Montant</span>
              </div>
              {ledger.map(({ c, g }) => (
                <Link
                  key={c.id}
                  href={`/events/${eventId}/gifts/${g.id}`}
                  className="row-link grid grid-cols-[190px_150px_minmax(0,1fr)_110px_100px] items-center gap-3 border-t border-line2 px-3 py-2"
                >
                  <span className="truncate font-medium">{dir.partyName(c)}</span>
                  <span className="truncate text-[#5F5E5B]">{recipientsLabel(dir, g.recipientIds)}</span>
                  <span className="truncate">{g.name}</span>
                  <span>
                    <span className="tag" style={{ background: STATUS_STYLE[g.status].bg, color: STATUS_STYLE[g.status].fg }}>
                      {STATUS_LABEL[g.status]}
                    </span>
                  </span>
                  <span className="text-right font-semibold tabular">{formatEUR(c.amountCents, { forceCents: true })}</span>
                </Link>
              ))}
              <div className="flex justify-end border-t border-line px-3 py-2 font-bold tabular">
                {formatEUR(sum(ledger.map((x) => x.c.amountCents)))}
              </div>
            </div>
          </div>
        )}
      </Section>
    </Page>
  );
}
