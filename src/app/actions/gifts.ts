'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { date, fail, list, mode, money, ok, optStr, status, str, type ActionState } from '@/lib/forms';
import { formatEUR, parseMoney, splitCents } from '@/lib/domain/money';
import { STATUS_LABEL } from '@/lib/domain/status';
import { parseParty } from '@/lib/party';
import type { Party } from '@/lib/domain/types';

function refresh() {
  revalidatePath('/', 'layout');
}

async function giftOf(eventId: string, giftId: string) {
  return prisma.gift.findFirst({ where: { id: giftId, eventId } });
}

async function partyLabel(p: Party): Promise<string> {
  if (p.coupleId) {
    const c = await prisma.couple.findUnique({ where: { id: p.coupleId }, include: { personA: true, personB: true } });
    return c ? `${c.personA.firstName} & ${c.personB.firstName}` : 'un couple';
  }
  if (p.personId) {
    const person = await prisma.person.findUnique({ where: { id: p.personId } });
    return person ? person.firstName : 'quelqu’un';
  }
  return 'quelqu’un';
}

type GiftFields = {
  name: string;
  url: string | null;
  priceCents: number;
  status: NonNullable<ReturnType<typeof status>>;
  purchaseMode: ReturnType<typeof mode>;
  deliveryDate: Date | null;
  note: string | null;
  recipientIds: string[];
};

async function readGiftFields(eventId: string, fd: FormData): Promise<GiftFields | string> {
  const name = str(fd, 'name');
  if (!name) return 'Le nom du cadeau est obligatoire.';
  const price = money(fd, 'price');
  if (price != null && (Number.isNaN(price) || price < 0)) return 'Prix invalide.';
  const st = status(fd) ?? 'IDEA';
  const purchaseMode = mode(fd);
  let url = optStr(fd, 'url');
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  const recipientIds = [...new Set(list(fd, 'recipientIds'))];
  if (recipientIds.length === 0) return 'Choisissez au moins un destinataire.';
  const valid = await prisma.eventParticipant.count({ where: { eventId, personId: { in: recipientIds } } });
  if (valid !== recipientIds.length) return 'Un destinataire ne participe pas à cet événement.';
  return {
    name,
    url,
    priceCents: price ?? 0,
    status: st,
    purchaseMode,
    deliveryDate: purchaseMode === 'REMOTE' ? date(fd, 'deliveryDate') : null,
    note: optStr(fd, 'note'),
    recipientIds,
  };
}

// ---------- Cadeaux ----------

export async function createGift(eventId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const f = await readGiftFields(eventId, fd);
  if (typeof f === 'string') return fail(f);

  // Participations saisies dans le formulaire (lignes répétées)
  const parties = fd.getAll('contribParty').map(String);
  const amounts = fd.getAll('contribAmount').map(String);
  const contributions: { personId: string | null; coupleId: string | null; amountCents: number }[] = [];
  for (let i = 0; i < parties.length; i++) {
    const party = parseParty(parties[i]);
    const raw = (amounts[i] ?? '').trim();
    if (!party && !raw) continue;
    if (!party) return fail(`Participation n° ${i + 1} : choisissez qui participe.`);
    const cents = parseMoney(raw);
    if (cents == null || cents <= 0) return fail(`Participation n° ${i + 1} : montant invalide.`);
    contributions.push({ ...party, amountCents: cents });
  }

  // Avances saisies dans le formulaire
  const payers = fd.getAll('advPayer').map(String);
  const advAmounts = fd.getAll('advAmount').map(String);
  const advDates = fd.getAll('advDate').map(String);
  const advances: { payerId: string; amountCents: number; paidAt: Date }[] = [];
  for (let i = 0; i < payers.length; i++) {
    const payerId = payers[i]?.trim();
    const raw = (advAmounts[i] ?? '').trim();
    if (!payerId && !raw) continue;
    if (!payerId) return fail(`Avance n° ${i + 1} : choisissez qui a payé.`);
    const cents = parseMoney(raw);
    if (cents == null || cents <= 0) return fail(`Avance n° ${i + 1} : montant invalide.`);
    const d = /^\d{4}-\d{2}-\d{2}$/.test(advDates[i] ?? '') ? new Date(advDates[i] + 'T12:00:00Z') : new Date();
    advances.push({ payerId, amountCents: cents, paidAt: d });
  }

  const gift = await prisma.gift.create({
    data: {
      eventId,
      name: f.name,
      url: f.url,
      priceCents: f.priceCents,
      status: f.status,
      purchaseMode: f.purchaseMode,
      deliveryDate: f.deliveryDate,
      note: f.note,
      recipients: { create: f.recipientIds.map((personId) => ({ personId })) },
      contributions: { create: contributions },
      advances: { create: advances },
      logs: { create: [{ message: `Cadeau créé (${STATUS_LABEL[f.status]})` }] },
    },
  });
  refresh();
  redirect(`/events/${eventId}/gifts/${gift.id}`);
}

export async function updateGift(eventId: string, giftId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const before = await giftOf(eventId, giftId);
  if (!before) return fail('Cadeau introuvable.');
  const f = await readGiftFields(eventId, fd);
  if (typeof f === 'string') return fail(f);
  const changes: string[] = [];
  if (before.name !== f.name) changes.push(`nom « ${f.name} »`);
  if (before.priceCents !== f.priceCents) changes.push(`prix ${formatEUR(before.priceCents)} → ${formatEUR(f.priceCents)}`);
  if (before.status !== f.status) changes.push(`statut ${STATUS_LABEL[f.status]}`);
  if (before.purchaseMode !== f.purchaseMode) changes.push(f.purchaseMode === 'ON_SITE' ? 'achat sur place' : 'achat à distance');

  await prisma.$transaction([
    prisma.gift.update({
      where: { id: giftId },
      data: {
        name: f.name,
        url: f.url,
        priceCents: f.priceCents,
        status: f.status,
        purchaseMode: f.purchaseMode,
        deliveryDate: f.deliveryDate,
        note: f.note,
      },
    }),
    prisma.giftRecipient.deleteMany({ where: { giftId } }),
    prisma.giftRecipient.createMany({ data: f.recipientIds.map((personId) => ({ giftId, personId })) }),
    prisma.giftLog.create({ data: { giftId, message: changes.length ? `Modifié : ${changes.join(', ')}` : 'Cadeau modifié' } }),
  ]);
  refresh();
  redirect(`/events/${eventId}/gifts/${giftId}`);
}

export async function setGiftStatus(fd: FormData): Promise<void> {
  await requireAuth();
  const eventId = str(fd, 'eventId');
  const giftId = str(fd, 'giftId');
  const st = status(fd);
  const gift = await giftOf(eventId, giftId);
  if (!gift || !st || gift.status === st) return;
  await prisma.$transaction([
    prisma.gift.update({ where: { id: giftId }, data: { status: st } }),
    prisma.giftLog.create({ data: { giftId, message: `Statut : ${STATUS_LABEL[gift.status]} → ${STATUS_LABEL[st]}` } }),
  ]);
  refresh();
}

export async function setPurchaseMode(fd: FormData): Promise<void> {
  await requireAuth();
  const eventId = str(fd, 'eventId');
  const giftId = str(fd, 'giftId');
  const m = mode(fd);
  const gift = await giftOf(eventId, giftId);
  if (!gift || gift.purchaseMode === m) return;
  await prisma.$transaction([
    prisma.gift.update({
      where: { id: giftId },
      data: { purchaseMode: m, deliveryDate: m === 'ON_SITE' ? null : gift.deliveryDate },
    }),
    prisma.giftLog.create({ data: { giftId, message: m === 'ON_SITE' ? 'Achat sur place' : 'Achat à distance' } }),
  ]);
  refresh();
}

export async function duplicateGift(eventId: string, giftId: string): Promise<void> {
  await requireAuth();
  const g = await prisma.gift.findFirst({ where: { id: giftId, eventId }, include: { recipients: true } });
  if (!g) return;
  const copy = await prisma.gift.create({
    data: {
      eventId,
      name: `${g.name} (copie)`,
      url: g.url,
      priceCents: g.priceCents,
      purchaseMode: g.purchaseMode,
      note: g.note,
      recipients: { create: g.recipients.map((r) => ({ personId: r.personId })) },
      logs: { create: [{ message: `Dupliqué depuis « ${g.name} »` }] },
    },
  });
  refresh();
  redirect(`/events/${eventId}/gifts/${copy.id}/edit`);
}

export async function deleteGift(eventId: string, giftId: string): Promise<void> {
  await requireAuth();
  const g = await giftOf(eventId, giftId);
  if (g) await prisma.gift.delete({ where: { id: giftId } });
  refresh();
  redirect(`/events/${eventId}/gifts`);
}

// ---------- Participations ----------

export async function addContribution(eventId: string, giftId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const gift = await giftOf(eventId, giftId);
  if (!gift) return fail('Cadeau introuvable.');
  const party = parseParty(str(fd, 'party'));
  if (!party) return fail('Choisissez qui participe.');
  const cents = money(fd, 'amount');
  if (cents == null || Number.isNaN(cents) || cents <= 0) return fail('Montant invalide.');
  const existing = await prisma.contribution.findFirst({
    where: { giftId, personId: party.personId, coupleId: party.coupleId },
  });
  const label = await partyLabel(party);
  if (existing) {
    await prisma.$transaction([
      prisma.contribution.update({ where: { id: existing.id }, data: { amountCents: existing.amountCents + cents } }),
      prisma.giftLog.create({ data: { giftId, message: `${label} ajoute ${formatEUR(cents)} à sa participation` } }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.contribution.create({ data: { giftId, ...party, amountCents: cents } }),
      prisma.giftLog.create({ data: { giftId, message: `${label} participe à hauteur de ${formatEUR(cents)}` } }),
    ]);
  }
  refresh();
  return ok();
}

export async function updateContribution(
  eventId: string,
  giftId: string,
  contributionId: string,
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  await requireAuth();
  const c = await prisma.contribution.findFirst({ where: { id: contributionId, giftId, gift: { eventId } } });
  if (!c) return fail('Participation introuvable.');
  const cents = money(fd, 'amount');
  if (cents == null || Number.isNaN(cents) || cents <= 0) return fail('Montant invalide.');
  const label = await partyLabel(c);
  await prisma.$transaction([
    prisma.contribution.update({ where: { id: c.id }, data: { amountCents: cents } }),
    prisma.giftLog.create({ data: { giftId, message: `Participation de ${label} : ${formatEUR(c.amountCents)} → ${formatEUR(cents)}` } }),
  ]);
  refresh();
  return ok();
}

export async function deleteContribution(eventId: string, giftId: string, contributionId: string): Promise<void> {
  await requireAuth();
  const c = await prisma.contribution.findFirst({ where: { id: contributionId, giftId, gift: { eventId } } });
  if (!c) return;
  const label = await partyLabel(c);
  await prisma.$transaction([
    prisma.contribution.delete({ where: { id: c.id } }),
    prisma.giftLog.create({ data: { giftId, message: `Participation de ${label} retirée (${formatEUR(c.amountCents)})` } }),
  ]);
  refresh();
}

/** Ramène les participations au prix du cadeau, au prorata. */
export async function scaleContributionsToPrice(eventId: string, giftId: string): Promise<void> {
  await requireAuth();
  const g = await prisma.gift.findFirst({ where: { id: giftId, eventId }, include: { contributions: { orderBy: { createdAt: 'asc' } } } });
  if (!g || g.contributions.length === 0) return;
  const parts = splitCents(g.priceCents, g.contributions.map((c) => c.amountCents));
  await prisma.$transaction([
    ...g.contributions.map((c, i) => prisma.contribution.update({ where: { id: c.id }, data: { amountCents: parts[i] } })),
    prisma.giftLog.create({ data: { giftId, message: `Participations ajustées au prix (${formatEUR(g.priceCents)})` } }),
  ]);
  refresh();
}

// ---------- Avances ----------

export async function addAdvance(eventId: string, giftId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const gift = await giftOf(eventId, giftId);
  if (!gift) return fail('Cadeau introuvable.');
  const payerId = str(fd, 'payerId');
  if (!payerId) return fail('Choisissez qui a payé.');
  const cents = money(fd, 'amount');
  if (cents == null || Number.isNaN(cents) || cents <= 0) return fail('Montant invalide.');
  const paidAt = date(fd, 'paidAt') ?? new Date();
  const payer = await prisma.person.findUnique({ where: { id: payerId } });
  if (!payer) return fail('Personne introuvable.');
  await prisma.$transaction([
    prisma.advance.create({ data: { giftId, payerId, amountCents: cents, paidAt, note: optStr(fd, 'note') } }),
    prisma.giftLog.create({ data: { giftId, message: `${payer.firstName} a avancé ${formatEUR(cents)}` } }),
  ]);
  refresh();
  return ok();
}

export async function deleteAdvance(eventId: string, giftId: string, advanceId: string): Promise<void> {
  await requireAuth();
  const a = await prisma.advance.findFirst({ where: { id: advanceId, giftId, gift: { eventId } }, include: { payer: true } });
  if (!a) return;
  await prisma.$transaction([
    prisma.advance.delete({ where: { id: a.id } }),
    prisma.giftLog.create({ data: { giftId, message: `Avance de ${a.payer.firstName} retirée (${formatEUR(a.amountCents)})` } }),
  ]);
  refresh();
}
