'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { bool, date, fail, list, money, ok, optStr, str, type ActionState } from '@/lib/forms';

function refresh() {
  revalidatePath('/', 'layout');
}

function capOrNull(cents: number | null): number | null | 'invalid' {
  if (cents == null) return null;
  if (Number.isNaN(cents) || cents < 0) return 'invalid';
  return cents;
}

// ---------- Événements ----------

export async function createEvent(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const name = str(fd, 'name');
  if (!name) return fail('Le nom de l’événement est obligatoire.');
  const startDate = date(fd, 'startDate');
  const endDate = date(fd, 'endDate');
  if (startDate && endDate && endDate < startDate) return fail('La date de fin précède la date de début.');
  const event = await prisma.event.create({ data: { name, startDate, endDate } });

  const copyFrom = optStr(fd, 'copyFrom');
  if (copyFrom) {
    const previous = await prisma.eventParticipant.findMany({ where: { eventId: copyFrom } });
    if (previous.length) {
      await prisma.eventParticipant.createMany({
        data: previous.map((p) => ({
          eventId: event.id,
          personId: p.personId,
          receiveMaxCents: bool(fd, 'copyCaps') ? p.receiveMaxCents : null,
          spendMaxCents: bool(fd, 'copyCaps') ? p.spendMaxCents : null,
        })),
        skipDuplicates: true,
      });
    }
  }
  refresh();
  redirect(copyFrom ? `/events/${event.id}` : `/events/${event.id}/participants`);
}

export async function updateEvent(eventId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const name = str(fd, 'name');
  if (!name) return fail('Le nom de l’événement est obligatoire.');
  const startDate = date(fd, 'startDate');
  const endDate = date(fd, 'endDate');
  if (startDate && endDate && endDate < startDate) return fail('La date de fin précède la date de début.');
  await prisma.event.update({ where: { id: eventId }, data: { name, startDate, endDate } });
  refresh();
  return ok();
}

export async function setEventArchived(eventId: string, archived: boolean): Promise<void> {
  await requireAuth();
  await prisma.event.update({ where: { id: eventId }, data: { archived } });
  refresh();
}

export async function deleteEvent(eventId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) redirect('/');
  if (str(fd, 'confirmName') !== event.name) return fail('Recopiez exactement le nom de l’événement pour confirmer.');
  await prisma.event.delete({ where: { id: eventId } });
  refresh();
  redirect('/');
}

// ---------- Participants ----------

export async function addParticipants(eventId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const personIds = [...new Set(list(fd, 'personIds'))];
  if (personIds.length === 0) return fail('Sélectionnez au moins une personne.');
  const defRecv = capOrNull(money(fd, 'receiveMax'));
  const defSpend = capOrNull(money(fd, 'spendMax'));
  if (defRecv === 'invalid' || defSpend === 'invalid') return fail('Montant de budget invalide.');
  await prisma.eventParticipant.createMany({
    data: personIds.map((personId) => ({
      eventId,
      personId,
      receiveMaxCents: defRecv,
      spendMaxCents: defSpend,
    })),
    skipDuplicates: true,
  });
  refresh();
  return ok();
}

export async function addOneParticipant(eventId: string, personId: string): Promise<void> {
  await requireAuth();
  await prisma.eventParticipant.createMany({ data: [{ eventId, personId }], skipDuplicates: true });
  refresh();
}

export async function updateParticipant(eventId: string, personId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const recv = capOrNull(money(fd, 'receiveMax'));
  const spend = capOrNull(money(fd, 'spendMax'));
  if (recv === 'invalid' || spend === 'invalid') return fail('Montant de budget invalide.');
  await prisma.eventParticipant.update({
    where: { eventId_personId: { eventId, personId } },
    data: { receiveMaxCents: recv, spendMaxCents: spend },
  });
  refresh();
  return ok();
}

export async function removeParticipant(eventId: string, personId: string, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  await requireAuth();
  const [received, contributed, advanced] = await Promise.all([
    prisma.giftRecipient.count({ where: { personId, gift: { eventId } } }),
    prisma.contribution.count({ where: { personId, gift: { eventId } } }),
    prisma.advance.count({ where: { payerId: personId, gift: { eventId } } }),
  ]);
  if (received + contributed + advanced > 0) {
    return fail('Cette personne reçoit, participe ou a avancé de l’argent dans cet événement : retirez d’abord ces éléments.');
  }
  await prisma.eventParticipant.delete({ where: { eventId_personId: { eventId, personId } } });
  refresh();
  return ok();
}
