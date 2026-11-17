'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { AVATAR_COLORS } from '@/lib/ui';
import { bool, fail, int, list, money, ok, optStr, str, type ActionState } from '@/lib/forms';

function refresh() {
  revalidatePath('/', 'layout');
}

/** Famille choisie, ou nouvelle famille si un nom est saisi. */
async function resolveFamilyId(fd: FormData): Promise<string | null> {
  const newName = str(fd, 'newFamilyName');
  if (newName) {
    const fam = await prisma.family.create({ data: { name: newName } });
    return fam.id;
  }
  return optStr(fd, 'familyId');
}

function personFields(fd: FormData) {
  const color = str(fd, 'color');
  return {
    firstName: str(fd, 'firstName'),
    lastName: str(fd, 'lastName'),
    birthYear: int(fd, 'birthYear'),
    color: AVATAR_COLORS[color] ? color : 'gray',
    note: optStr(fd, 'note'),
  };
}

function validatePerson(f: ReturnType<typeof personFields>): string | null {
  if (!f.firstName) return 'Le prénom est obligatoire.';
  const year = new Date().getFullYear();
  if (f.birthYear != null && (f.birthYear < 1900 || f.birthYear > year)) return 'Année de naissance invalide.';
  return null;
}

// ---------- Personnes ----------

export async function createPerson(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const f = personFields(fd);
  const err = validatePerson(f);
  if (err) return fail(err);
  const familyId = await resolveFamilyId(fd);
  const person = await prisma.person.create({ data: { ...f, familyId } });

  const eventId = optStr(fd, 'addToEventId');
  if (eventId) {
    const recv = money(fd, 'receiveMax');
    const spend = money(fd, 'spendMax');
    await prisma.eventParticipant.create({
      data: {
        eventId,
        personId: person.id,
        receiveMaxCents: recv != null && !Number.isNaN(recv) ? recv : null,
        spendMaxCents: spend != null && !Number.isNaN(spend) ? spend : null,
      },
    });
  }
  refresh();
  return ok();
}

export async function updatePerson(personId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const f = personFields(fd);
  const err = validatePerson(f);
  if (err) return fail(err);
  const familyId = await resolveFamilyId(fd);
  await prisma.person.update({ where: { id: personId }, data: { ...f, familyId } });
  refresh();
  return ok();
}

export async function deletePerson(personId: string, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  await requireAuth();
  const [contribs, advances, received, repaymentsFrom, repaymentsTo, couple] = await Promise.all([
    prisma.contribution.count({ where: { personId } }),
    prisma.advance.count({ where: { payerId: personId } }),
    prisma.giftRecipient.count({ where: { personId } }),
    prisma.repayment.count({ where: { fromPersonId: personId } }),
    prisma.repayment.count({ where: { toPersonId: personId } }),
    prisma.couple.findFirst({
      where: { OR: [{ personAId: personId }, { personBId: personId }] },
      include: { _count: { select: { contributions: true, repaymentsFrom: true, repaymentsTo: true } } },
    }),
  ]);
  if (contribs + advances + received + repaymentsFrom + repaymentsTo > 0) {
    return fail('Cette personne a des cadeaux, participations, avances ou remboursements : retirez-les avant de la supprimer.');
  }
  if (couple && couple._count.contributions + couple._count.repaymentsFrom + couple._count.repaymentsTo > 0) {
    return fail('Son couple a des participations ou des remboursements : retirez-les avant de supprimer cette personne.');
  }
  await prisma.person.delete({ where: { id: personId } });
  refresh();
  redirect('/people');
}

// ---------- Familles ----------

export async function createFamily(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const name = str(fd, 'name');
  if (!name) return fail('Le nom de la famille est obligatoire.');
  const memberIds = list(fd, 'memberIds');
  await prisma.family.create({
    data: { name, members: memberIds.length ? { connect: memberIds.map((id) => ({ id })) } : undefined },
  });
  refresh();
  return ok();
}

export async function renameFamily(familyId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const name = str(fd, 'name');
  if (!name) return fail('Le nom de la famille est obligatoire.');
  await prisma.family.update({ where: { id: familyId }, data: { name } });
  refresh();
  return ok();
}

export async function deleteFamily(familyId: string, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  await requireAuth();
  // Les membres restent dans le carnet, sans famille.
  await prisma.family.delete({ where: { id: familyId } });
  refresh();
  return ok();
}

export async function addFamilyMember(familyId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const personId = str(fd, 'personId');
  if (!personId) return fail('Choisissez une personne.');
  await prisma.person.update({ where: { id: personId }, data: { familyId } });
  refresh();
  return ok();
}

export async function removeFamilyMember(personId: string, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  await requireAuth();
  await prisma.person.update({ where: { id: personId }, data: { familyId: null } });
  refresh();
  return ok();
}

// ---------- Couples ----------

function readSplit(fd: FormData): number | null {
  const preset = str(fd, 'splitPreset');
  const raw = preset && preset !== 'custom' ? Number.parseInt(preset, 10) : int(fd, 'splitA');
  if (raw == null || !Number.isFinite(raw) || raw < 0 || raw > 100) return null;
  return raw;
}

export async function createCouple(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const personAId = str(fd, 'personAId');
  const personBId = str(fd, 'personBId');
  if (!personAId || !personBId) return fail('Choisissez les deux personnes.');
  if (personAId === personBId) return fail('Un couple réunit deux personnes différentes.');
  const splitA = readSplit(fd);
  if (splitA == null) return fail('La répartition doit être comprise entre 0 et 100 %.');
  const existing = await prisma.couple.findFirst({
    where: {
      OR: [
        { personAId: { in: [personAId, personBId] } },
        { personBId: { in: [personAId, personBId] } },
      ],
    },
  });
  if (existing) return fail('Une de ces personnes est déjà en couple.');
  await prisma.couple.create({
    data: { personAId, personBId, splitA, sharedAccount: bool(fd, 'sharedAccount') },
  });
  const familyId = optStr(fd, 'familyId');
  if (familyId) {
    await prisma.person.updateMany({ where: { id: { in: [personAId, personBId] } }, data: { familyId } });
  }
  refresh();
  return ok();
}

export async function updateCouple(coupleId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const splitA = readSplit(fd);
  if (splitA == null) return fail('La répartition doit être comprise entre 0 et 100 %.');
  await prisma.couple.update({ where: { id: coupleId }, data: { splitA, sharedAccount: bool(fd, 'sharedAccount') } });
  refresh();
  return ok();
}

export async function deleteCouple(coupleId: string, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  await requireAuth();
  const c = await prisma.couple.findUnique({
    where: { id: coupleId },
    include: { _count: { select: { contributions: true, repaymentsFrom: true, repaymentsTo: true } } },
  });
  if (!c) return ok();
  if (c._count.contributions + c._count.repaymentsFrom + c._count.repaymentsTo > 0) {
    return fail('Ce couple a des participations ou des remboursements : retirez-les avant de séparer le couple.');
  }
  await prisma.couple.delete({ where: { id: coupleId } });
  refresh();
  return ok();
}
