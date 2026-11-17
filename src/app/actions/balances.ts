'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { date, fail, money, ok, optStr, str, type ActionState } from '@/lib/forms';
import { parseParty } from '@/lib/party';
import { parseMoney } from '@/lib/domain/money';

function refresh() {
  revalidatePath('/', 'layout');
}

async function createRepayment(eventId: string, fromKey: string, toKey: string, cents: number, paidAt: Date, note: string | null) {
  const from = parseParty(fromKey);
  const to = parseParty(toKey);
  if (!from || !to) return 'Choisissez qui rembourse et qui est remboursé.';
  if (fromKey === toKey) return 'Le remboursement doit aller d’un compte à un autre.';
  if (!Number.isFinite(cents) || cents <= 0) return 'Montant invalide.';
  await prisma.repayment.create({
    data: {
      eventId,
      fromPersonId: from.personId,
      fromCoupleId: from.coupleId,
      toPersonId: to.personId,
      toCoupleId: to.coupleId,
      amountCents: cents,
      paidAt,
      note,
    },
  });
  return null;
}

/** Saisie libre d'un remboursement. */
export async function addRepayment(eventId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const cents = money(fd, 'amount');
  const err = await createRepayment(
    eventId,
    str(fd, 'from'),
    str(fd, 'to'),
    cents == null ? Number.NaN : cents,
    date(fd, 'paidAt') ?? new Date(),
    optStr(fd, 'note'),
  );
  if (err) return fail(err);
  refresh();
  return ok();
}

/** « Marquer comme remboursé » (total ou partiel) depuis un virement proposé. */
export async function settleTransfer(eventId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  await requireAuth();
  const partial = str(fd, 'partialAmount');
  const cents = partial ? parseMoney(partial) : Number.parseInt(str(fd, 'amountCents'), 10);
  const max = Number.parseInt(str(fd, 'amountCents'), 10);
  if (cents == null || !Number.isFinite(cents) || cents <= 0) return fail('Montant invalide.');
  if (Number.isFinite(max) && cents > max) return fail('Le montant dépasse ce qui reste dû.');
  const err = await createRepayment(eventId, str(fd, 'from'), str(fd, 'to'), cents, new Date(), optStr(fd, 'note'));
  if (err) return fail(err);
  refresh();
  return ok();
}

export async function deleteRepayment(eventId: string, repaymentId: string): Promise<void> {
  await requireAuth();
  await prisma.repayment.deleteMany({ where: { id: repaymentId, eventId } });
  refresh();
}
