import type { GiftStatus, PurchaseMode } from './types';

export const STATUSES: GiftStatus[] = ['IDEA', 'FOUND', 'BOUGHT', 'RECEIVED', 'WRAPPED'];

export const STATUS_LABEL: Record<GiftStatus, string> = {
  IDEA: 'Idée',
  FOUND: 'Trouvé',
  BOUGHT: 'Acheté',
  RECEIVED: 'Reçu',
  WRAPPED: 'Emballé',
};

export const MODE_LABEL: Record<PurchaseMode, string> = {
  ON_SITE: 'Sur place',
  REMOTE: 'À distance',
};

/** Étapes à parcourir selon le mode d'achat (sur place : pas d'étape « Reçu »). */
export function stepsFor(mode: PurchaseMode): GiftStatus[] {
  return mode === 'ON_SITE' ? ['IDEA', 'FOUND', 'BOUGHT', 'WRAPPED'] : STATUSES;
}

/**
 * Pourcentage d'avancement d'un cadeau : rang de l'étape / (nombre d'étapes − 1).
 * À distance : 0, 25, 50, 75, 100. Sur place : 0, 33, 67, 100.
 * Un cadeau « Reçu » passé ensuite en « sur place » compte comme « Acheté ».
 */
export function giftPercent(status: GiftStatus, mode: PurchaseMode): number {
  const steps = stepsFor(mode);
  let idx = steps.indexOf(status);
  if (idx < 0) idx = steps.indexOf('BOUGHT');
  return Math.round((idx / (steps.length - 1)) * 100);
}

/** Rang absolu du statut (0 = idée … 4 = emballé), pour trier. */
export function statusRank(status: GiftStatus): number {
  return STATUSES.indexOf(status);
}

/** Le cadeau est-il déjà payé (acheté, reçu ou emballé) ? */
export function isPaid(status: GiftStatus): boolean {
  return statusRank(status) >= statusRank('BOUGHT');
}

export type Distribution = Record<GiftStatus, number>;

export function emptyDistribution(): Distribution {
  return { IDEA: 0, FOUND: 0, BOUGHT: 0, RECEIVED: 0, WRAPPED: 0 };
}

export function distributionOf(statuses: GiftStatus[]): Distribution {
  const d = emptyDistribution();
  for (const s of statuses) d[s] += 1;
  return d;
}

/** Moyenne des pourcentages, arrondie ; null s'il n'y a aucun cadeau. */
export function averagePercent(items: { status: GiftStatus; purchaseMode: PurchaseMode }[]): number | null {
  if (items.length === 0) return null;
  const total = items.reduce((a, g) => a + giftPercent(g.status, g.purchaseMode), 0);
  return Math.round(total / items.length);
}
