import Link from 'next/link';
import type { Directory } from '@/lib/domain/directory';
import type { PersonStats } from '@/lib/domain/budget';
import { formatEUR } from '@/lib/domain/money';
import { Avatar, Meter, OverChip, StatusBar } from './ui';
import { Icon } from './icons';

export function personSubtitle(dir: Directory, personId: string): { text: string; couple: boolean } {
  const partner = dir.partnerOf(personId);
  if (partner) return { text: `En couple avec ${partner.firstName}`, couple: true };
  const age = dir.age(personId);
  return { text: age != null ? `${age} ans` : '', couple: false };
}

export function PersonCard({ eventId, personId, dir, stats }: { eventId: string; personId: string; dir: Directory; stats: PersonStats }) {
  const p = dir.person(personId);
  const sub = personSubtitle(dir, personId);
  const giftCount = stats.receivedGiftIds.length;
  return (
    <Link
      href={`/events/${eventId}/people/${personId}`}
      className="card block p-3.5 transition hover:border-[#CFCECA] hover:shadow-[0_2px_8px_rgba(15,15,15,0.06)]"
    >
      <div className="flex items-center gap-2.5">
        <Avatar initials={dir.initials(personId)} color={p?.color} size={34} />
        <div className="min-w-0">
          <div className="truncate font-semibold">{dir.personName(personId)}</div>
          <div className="flex items-center gap-1 text-xs text-muted">
            {sub.couple ? <Icon name="rings" size={12} strokeWidth={2} /> : null}
            {sub.text}
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex items-baseline gap-1.5 text-[13px]">
        <span className="w-[58px] shrink-0 text-xs text-muted">Reçoit</span>
        <span className="font-semibold tabular">
          {formatEUR(stats.receivedCents)}
          <span className="font-normal text-muted"> {stats.receiveMaxCents != null ? `/ ${formatEUR(stats.receiveMaxCents)}` : '· sans plafond'}</span>
        </span>
        <span className="ml-auto">
          <OverChip cents={stats.overReceiveCents} />
        </span>
      </div>
      <Meter value={stats.receivedCents} max={stats.receiveMaxCents} height={5} className="mt-1.5" />

      <div className="mt-2.5 flex items-baseline gap-1.5 text-[13px]">
        <span className="w-[58px] shrink-0 text-xs text-muted">Dépense</span>
        <span className="font-semibold tabular">
          {formatEUR(stats.spentCents)}
          <span className="font-normal text-muted"> {stats.spendMaxCents != null ? `/ ${formatEUR(stats.spendMaxCents)}` : '· sans plafond'}</span>
        </span>
        <span className="ml-auto">
          <OverChip cents={stats.overSpendCents} />
        </span>
      </div>
      <Meter value={stats.spentCents} max={stats.spendMaxCents} height={5} className="mt-1.5" />

      <div className="mt-3 flex items-center gap-2 text-xs text-muted">
        <Icon name="gift" size={13} />
        <span className="whitespace-nowrap">
          {giftCount} cadeau{giftCount > 1 ? 'x' : ''}
        </span>
        <StatusBar distribution={stats.distribution} height={6} gap={1} className="flex-1" />
        <span className="font-semibold text-ink">{stats.progress != null ? `${stats.progress} %` : '—'}</span>
      </div>
    </Link>
  );
}
