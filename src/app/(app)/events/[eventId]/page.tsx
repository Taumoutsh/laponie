import Link from 'next/link';
import { loadEvent } from '@/lib/event-data';
import { computeBalances } from '@/lib/domain/balances';
import { formatEUR } from '@/lib/domain/money';
import { STATUSES, STATUS_LABEL } from '@/lib/domain/status';
import { STATUS_STYLE, dateRange, daysUntil, shortDate } from '@/lib/ui';
import { addOneParticipant } from '@/app/actions/events';
import { Page } from '@/components/Page';
import { PersonCard } from '@/components/PersonCard';
import { Avatar, Empty, Meter, PageHeader, StatCard, StatusBar } from '@/components/ui';
import { Icon } from '@/components/icons';

export async function generateMetadata({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event } = await loadEvent(eventId);
  return { title: event.name };
}

export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { event, data, dir, stats, eventStats: ev, groups } = await loadEvent(eventId);
  const balances = computeBalances(data, { sharedCouples: true }, dir);
  const coupleCount = data.couples.filter((c) => stats.has(c.personAId) || stats.has(c.personBId)).length;
  const familyCount = groups.filter((g) => g.familyId).length;
  const wrapped = ev.distribution.WRAPPED;
  const next = ev.upcomingDeliveries[0];

  const actions = (
    <>
      <Link href={`/events/${eventId}/export`} className="btn">
        <Icon name="download" size={15} />
        Exporter Excel
      </Link>
      <Link href={`/events/${eventId}/participants`} className="btn">
        <Icon name="userPlus" size={15} />
        Participants
      </Link>
      <Link href={`/events/${eventId}/gifts/new`} className="btn-primary">
        <Icon name="plus" size={15} strokeWidth={2.2} />
        Nouveau cadeau
      </Link>
    </>
  );

  return (
    <Page crumbs={[{ href: '/', label: 'Événements' }, { label: event.name }]} actions={actions}>
      <PageHeader
        icon="gift"
        title={
          <span className="flex flex-wrap items-center gap-3">
            {event.name}
            {event.archived ? <span className="tag bg-line2 text-muted">Archivé</span> : null}
          </span>
        }
      >
        <dl className="mt-4 grid max-w-xl grid-cols-[150px_minmax(0,1fr)] gap-y-1.5 text-sm">
          <dt className="flex items-center gap-2 text-muted">
            <Icon name="calendar" size={15} />
            Date
          </dt>
          <dd>{dateRange(event.startDate, event.endDate)}</dd>
          <dt className="flex items-center gap-2 text-muted">
            <Icon name="users" size={15} />
            Participants
          </dt>
          <dd>
            {data.participants.length} personnes · {familyCount} famille{familyCount > 1 ? 's' : ''} · {coupleCount} couple{coupleCount > 1 ? 's' : ''}
          </dd>
          <dt className="flex items-center gap-2 text-muted">
            <Icon name="money" size={15} />
            Budget prévu
          </dt>
          <dd>
            {formatEUR(ev.plannedCents)} <span className="text-muted">(somme des plafonds reçus)</span>
          </dd>
        </dl>
      </PageHeader>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
        <StatCard label="Engagé" value={formatEUR(ev.engagedCents)} hint={ev.plannedCents ? `${Math.round((ev.engagedCents / ev.plannedCents) * 100)} % du budget prévu` : 'Aucun plafond défini'}>
          <Meter value={ev.engagedCents} max={ev.plannedCents || null} className="mt-2.5" />
        </StatCard>
        <StatCard
          label="Cadeaux"
          value={ev.giftCount}
          hint={ev.sharedGiftCount ? `dont ${ev.sharedGiftCount} partagé${ev.sharedGiftCount > 1 ? 's' : ''} entre plusieurs personnes` : 'Aucun cadeau partagé'}
          href={`/events/${eventId}/gifts`}
        />
        <StatCard label="Avancement global" value={ev.progress != null ? `${ev.progress} %` : '—'} hint={`${wrapped} emballé${wrapped > 1 ? 's' : ''} sur ${ev.giftCount}`}>
          <StatusBar distribution={ev.distribution} height={6} className="mt-2.5" />
        </StatCard>
        <StatCard
          label="Livraisons attendues"
          value={ev.upcomingDeliveries.length}
          hint={next ? `Prochaine : ${shortDate(next.deliveryDate)} · ${next.name}` : 'Aucune livraison en attente'}
        />
        <StatCard
          label="À rembourser"
          value={formatEUR(balances.simplifiedCents)}
          hint={balances.simplified.length ? `${balances.simplified.length} remboursement${balances.simplified.length > 1 ? 's' : ''} en attente` : 'Tout est soldé'}
          hintClass={balances.simplified.length ? 'font-medium text-debt-text' : 'text-muted'}
          href={`/events/${eventId}/balances`}
        />
      </div>

      {ev.giftCount > 0 ? (
        <div className="card mt-5 px-4 py-3.5">
          <StatusBar distribution={ev.distribution} height={10} />
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            {STATUSES.map((s) => (
              <span key={s} className="flex items-center gap-2 text-[13px]">
                <span className="tag" style={{ background: STATUS_STYLE[s].bg, color: STATUS_STYLE[s].fg }}>
                  {STATUS_LABEL[s]}
                </span>
                <span className="text-muted">{ev.distribution[s]}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {ev.upcomingDeliveries.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
          {ev.upcomingDeliveries.slice(0, 4).map((g) => (
            <Link key={g.id} href={`/events/${eventId}/gifts/${g.id}`} className="tag h-7 bg-soft text-[#5F5E5B] hover:bg-line2">
              <Icon name="truck" size={13} />
              {g.name} · {shortDate(g.deliveryDate)} ({daysUntil(g.deliveryDate!)} j)
            </Link>
          ))}
        </div>
      ) : null}

      <h2 className="mt-9 border-b border-line pb-2.5 text-[17px] font-semibold">Participants par famille</h2>

      {groups.length === 0 ? (
        <div className="mt-5">
          <Empty icon="userPlus" title="Aucun participant">
            Ajoutez des personnes depuis le carnet, une par une ou par famille entière.
            <div className="mt-4">
              <Link href={`/events/${eventId}/participants`} className="btn-primary">
                Ajouter des participants
              </Link>
            </div>
          </Empty>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="mt-7">
            <div className="mb-3 flex flex-wrap items-center gap-2.5">
              <h3 className="text-[16px] font-semibold">{g.name}</h3>
              {g.familyId ? (
                <span
                  className="tag"
                  style={g.complete ? { background: '#E3F1E9', color: '#1F6B45' } : { background: '#FBF3DB', color: '#7A5C12' }}
                >
                  {g.complete ? 'Complète' : 'Incomplète'} · {g.memberIds.length}/{g.memberIds.length + g.missingIds.length}
                </span>
              ) : (
                <span className="tag bg-line2 text-[#5F5E5B]">{g.memberIds.length} pers.</span>
              )}
              <span className="ml-auto text-[13px] text-muted">
                Reçoit <b className="text-ink tabular">{formatEUR(g.receivedCents)}</b>
              </span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
              {g.memberIds.map((id) => (
                <PersonCard key={id} eventId={eventId} personId={id} dir={dir} stats={stats.get(id)!} />
              ))}
              {g.missingIds.map((id) => (
                <form key={id} action={addOneParticipant.bind(null, eventId, id)}>
                  <button
                    type="submit"
                    className="flex h-full min-h-[120px] w-full flex-col justify-center gap-2 rounded-[10px] border border-dashed border-[#D3D2CE] p-3.5 text-left text-muted transition hover:border-pine hover:bg-soft"
                  >
                    <span className="flex items-center gap-2.5">
                      <Avatar initials={dir.initials(id)} color="gray" size={34} className="opacity-70" />
                      <span>
                        <span className="block font-semibold text-[#5F5E5B]">{dir.personName(id)}</span>
                        <span className="text-xs">Pas dans cet événement</span>
                      </span>
                    </span>
                    <span className="flex items-center gap-1 text-xs font-medium text-pine">
                      <Icon name="plus" size={13} strokeWidth={2.2} />
                      Ajouter à {event.name}
                    </span>
                  </button>
                </form>
              ))}
            </div>
          </section>
        ))
      )}
    </Page>
  );
}
