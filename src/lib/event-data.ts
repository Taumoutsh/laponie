import { cache } from 'react';
import { notFound } from 'next/navigation';
import { prisma } from './db';
import { requireAuth } from './auth';
import { Directory } from './domain/directory';
import { computeEventStats, computeFamilyGroups, computePersonStats } from './domain/budget';
import type { DCouple, DFamily, DGift, DPerson, EventData } from './domain/types';

type GiftRow = {
  id: string;
  name: string;
  url: string | null;
  priceCents: number;
  status: DGift['status'];
  purchaseMode: DGift['purchaseMode'];
  deliveryDate: Date | null;
  note: string | null;
  createdAt: Date;
  recipients: { personId: string }[];
  contributions: { id: string; personId: string | null; coupleId: string | null; amountCents: number }[];
  advances: { id: string; payerId: string; amountCents: number; paidAt: Date; note: string | null }[];
};

export function toDGift(g: GiftRow): DGift {
  return {
    id: g.id,
    name: g.name,
    url: g.url,
    priceCents: g.priceCents,
    status: g.status,
    purchaseMode: g.purchaseMode,
    deliveryDate: g.deliveryDate,
    note: g.note,
    createdAt: g.createdAt,
    recipientIds: g.recipients.map((r) => r.personId),
    contributions: g.contributions.map((c) => ({ id: c.id, personId: c.personId, coupleId: c.coupleId, amountCents: c.amountCents })),
    advances: g.advances.map((a) => ({ id: a.id, payerId: a.payerId, amountCents: a.amountCents, paidAt: a.paidAt, note: a.note })),
  };
}

/** Carnet complet : personnes, familles, couples. */
export const loadCarnet = cache(async () => {
  await requireAuth();
  const [persons, families, couples] = await Promise.all([
    prisma.person.findMany({ orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
    prisma.family.findMany({ orderBy: { name: 'asc' } }),
    prisma.couple.findMany({ orderBy: { createdAt: 'asc' } }),
  ]);
  const p: DPerson[] = persons.map((x) => ({
    id: x.id,
    firstName: x.firstName,
    lastName: x.lastName,
    birthYear: x.birthYear,
    color: x.color,
    familyId: x.familyId,
  }));
  const f: DFamily[] = families.map((x) => ({ id: x.id, name: x.name }));
  const c: DCouple[] = couples.map((x) => ({
    id: x.id,
    personAId: x.personAId,
    personBId: x.personBId,
    splitA: x.splitA,
    sharedAccount: x.sharedAccount,
  }));
  return { persons: p, families: f, couples: c, directory: new Directory({ persons: p, families: f, couples: c }) };
});

/** Charge un événement et toutes ses données, ou renvoie une 404. */
export const loadEvent = cache(async (eventId: string) => {
  await requireAuth();
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      participants: true,
      gifts: {
        include: {
          recipients: { select: { personId: true } },
          contributions: { orderBy: { createdAt: 'asc' } },
          advances: { orderBy: { paidAt: 'asc' } },
        },
        orderBy: { createdAt: 'asc' },
      },
      repayments: { orderBy: { paidAt: 'asc' } },
    },
  });
  if (!event) notFound();
  const carnet = await loadCarnet();
  const data: EventData = {
    persons: carnet.persons,
    families: carnet.families,
    couples: carnet.couples,
    participants: event.participants.map((p) => ({
      personId: p.personId,
      receiveMaxCents: p.receiveMaxCents,
      spendMaxCents: p.spendMaxCents,
    })),
    gifts: event.gifts.map(toDGift),
    repayments: event.repayments.map((r) => ({
      id: r.id,
      from: { personId: r.fromPersonId, coupleId: r.fromCoupleId },
      to: { personId: r.toPersonId, coupleId: r.toCoupleId },
      amountCents: r.amountCents,
      paidAt: r.paidAt,
      note: r.note,
    })),
  };
  const dir = carnet.directory;
  const stats = computePersonStats(data, dir);
  return {
    event: { id: event.id, name: event.name, startDate: event.startDate, endDate: event.endDate, archived: event.archived },
    data,
    dir,
    stats,
    eventStats: computeEventStats(data),
    groups: computeFamilyGroups(data, stats, dir),
    participantIds: new Set(data.participants.map((p) => p.personId)),
  };
});

export type EventView = Awaited<ReturnType<typeof loadEvent>>;
