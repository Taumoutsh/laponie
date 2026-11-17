import { prisma } from './db';
import type { EventView } from './event-data';
import type { Directory } from './domain/directory';
import type { GiftFormCandidate, GiftFormCouple, GiftFormPerson } from '@/components/GiftForm';

/** « Léa & Hugo », « Léa, Hugo & Inès » */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1];
}

export function recipientsLabel(dir: Directory, ids: string[]): string {
  return joinNames(ids.map((id) => dir.firstName(id)));
}

export async function giftFormData(view: EventView) {
  const { data, dir, participantIds, event } = view;

  const people: GiftFormPerson[] = data.participants
    .map((p) => {
      const person = dir.person(p.personId);
      return {
        id: p.personId,
        name: dir.personName(p.personId),
        firstName: person?.firstName ?? '',
        initials: dir.initials(p.personId),
        color: person?.color ?? 'gray',
        group: person?.familyId ? (dir.family(person.familyId)?.name ?? 'Famille') : 'Sans famille',
      };
    })
    .sort((a, b) =>
      a.group === b.group
        ? a.name.localeCompare(b.name, 'fr')
        : a.group === 'Sans famille'
          ? 1
          : b.group === 'Sans famille'
            ? -1
            : a.group.localeCompare(b.group, 'fr'),
    );

  const couples: GiftFormCouple[] = data.couples
    .filter((c) => participantIds.has(c.personAId) || participantIds.has(c.personBId))
    .map((c) => ({ id: c.id, label: dir.coupleFullName(c.id) }));

  const current: GiftFormCandidate[] = data.gifts.map((g) => ({
    id: g.id,
    name: g.name,
    recipientIds: g.recipientIds,
    current: true,
    status: g.status,
    priceCents: g.priceCents,
    recipientsLabel: recipientsLabel(dir, g.recipientIds),
    contributorsLabel: joinNames(g.contributions.map((c) => dir.partyName(c, true))),
    href: `/events/${event.id}/gifts/${g.id}`,
  }));

  const previousRows = await prisma.gift.findMany({
    where: { eventId: { not: event.id }, recipients: { some: { personId: { in: [...participantIds] } } } },
    select: {
      id: true,
      name: true,
      status: true,
      priceCents: true,
      eventId: true,
      event: { select: { name: true } },
      recipients: { select: { personId: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 400,
  });
  const previous: GiftFormCandidate[] = previousRows.map((g) => ({
    id: g.id,
    name: g.name,
    recipientIds: g.recipients.map((r) => r.personId),
    current: false,
    eventName: g.event.name,
    status: g.status,
    priceCents: g.priceCents,
    recipientsLabel: recipientsLabel(dir, g.recipients.map((r) => r.personId)),
    contributorsLabel: '',
    href: `/events/${g.eventId}/gifts/${g.id}`,
  }));

  return { people, couples, candidates: [...current, ...previous] };
}
