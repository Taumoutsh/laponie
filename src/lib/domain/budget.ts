import type { DGift, EventData, GiftStatus } from './types';
import { Directory } from './directory';
import { equalShares, splitCents, sum } from './money';
import { averagePercent, distributionOf, giftPercent, isPaid, type Distribution } from './status';

export interface GiftView {
  gift: DGift;
  percent: number;
  fundedCents: number;
  remainingCents: number;
  advancedCents: number;
  /** Part de chaque destinataire (parts égales). */
  shareByRecipient: Map<string, number>;
}

export function giftView(gift: DGift): GiftView {
  const recipients = [...gift.recipientIds].sort();
  const shares = equalShares(gift.priceCents, recipients.length);
  const shareByRecipient = new Map<string, number>();
  recipients.forEach((id, i) => shareByRecipient.set(id, shares[i]));
  const fundedCents = sum(gift.contributions.map((c) => c.amountCents));
  return {
    gift,
    percent: giftPercent(gift.status, gift.purchaseMode),
    fundedCents,
    remainingCents: gift.priceCents - fundedCents,
    advancedCents: sum(gift.advances.map((a) => a.amountCents)),
    shareByRecipient,
  };
}

export interface ContributionLine {
  giftId: string;
  contributionId: string;
  /** Montant total de la participation (personne seule ou couple). */
  amountCents: number;
  /** Part imputée à la personne. */
  shareCents: number;
  viaCouple: boolean;
}

export interface PersonStats {
  personId: string;
  receiveMaxCents: number | null;
  spendMaxCents: number | null;
  /** Valeur des cadeaux reçus (part de chaque cadeau partagé). */
  receivedCents: number;
  receivedGiftIds: string[];
  /** Dépenses seules. */
  spentSoloCents: number;
  /** Total des participations du couple. */
  spentCoupleTotalCents: number;
  /** Part de la personne dans les participations du couple. */
  spentCoupleShareCents: number;
  /** Dépense imputée = seule + part du couple. */
  spentCents: number;
  contributions: ContributionLine[];
  progress: number | null;
  distribution: Distribution;
  /** Dépassement (centimes > 0) du plafond reçu / dépense, sinon 0. */
  overReceiveCents: number;
  overSpendCents: number;
}

export function computePersonStats(data: EventData, dir = new Directory(data)): Map<string, PersonStats> {
  const result = new Map<string, PersonStats>();
  for (const part of data.participants) {
    result.set(part.personId, {
      personId: part.personId,
      receiveMaxCents: part.receiveMaxCents,
      spendMaxCents: part.spendMaxCents,
      receivedCents: 0,
      receivedGiftIds: [],
      spentSoloCents: 0,
      spentCoupleTotalCents: 0,
      spentCoupleShareCents: 0,
      spentCents: 0,
      contributions: [],
      progress: null,
      distribution: distributionOf([]),
      overReceiveCents: 0,
      overSpendCents: 0,
    });
  }

  const receivedStatuses = new Map<string, { status: GiftStatus; purchaseMode: DGift['purchaseMode'] }[]>();

  for (const gift of data.gifts) {
    const view = giftView(gift);
    for (const [personId, share] of view.shareByRecipient) {
      const s = result.get(personId);
      if (!s) continue;
      s.receivedCents += share;
      s.receivedGiftIds.push(gift.id);
      const list = receivedStatuses.get(personId) ?? [];
      list.push({ status: gift.status, purchaseMode: gift.purchaseMode });
      receivedStatuses.set(personId, list);
    }
    for (const c of gift.contributions) {
      if (c.coupleId) {
        const couple = dir.couple(c.coupleId);
        if (!couple) continue;
        const [a, b] = splitCents(c.amountCents, [couple.splitA, 100 - couple.splitA]);
        for (const [pid, share] of [
          [couple.personAId, a],
          [couple.personBId, b],
        ] as const) {
          const s = result.get(pid);
          if (!s) continue;
          s.spentCoupleTotalCents += c.amountCents;
          s.spentCoupleShareCents += share;
          s.contributions.push({ giftId: gift.id, contributionId: c.id, amountCents: c.amountCents, shareCents: share, viaCouple: true });
        }
      } else if (c.personId) {
        const s = result.get(c.personId);
        if (!s) continue;
        s.spentSoloCents += c.amountCents;
        s.contributions.push({ giftId: gift.id, contributionId: c.id, amountCents: c.amountCents, shareCents: c.amountCents, viaCouple: false });
      }
    }
  }

  for (const s of result.values()) {
    s.spentCents = s.spentSoloCents + s.spentCoupleShareCents;
    const items = receivedStatuses.get(s.personId) ?? [];
    s.progress = averagePercent(items);
    s.distribution = distributionOf(items.map((i) => i.status));
    s.overReceiveCents = s.receiveMaxCents != null ? Math.max(0, s.receivedCents - s.receiveMaxCents) : 0;
    s.overSpendCents = s.spendMaxCents != null ? Math.max(0, s.spentCents - s.spendMaxCents) : 0;
  }
  return result;
}

export interface EventStats {
  giftCount: number;
  sharedGiftCount: number;
  /** Somme des prix des cadeaux. */
  engagedCents: number;
  /** Somme des participations. */
  fundedCents: number;
  /** Somme des plafonds « reçu ». */
  plannedCents: number;
  /** Somme des prix des cadeaux achetés, reçus ou emballés. */
  paidCents: number;
  progress: number | null;
  distribution: Distribution;
  underfundedCount: number;
  upcomingDeliveries: DGift[];
}

export function computeEventStats(data: EventData, now = new Date()): EventStats {
  const gifts = data.gifts;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return {
    giftCount: gifts.length,
    sharedGiftCount: gifts.filter((g) => g.recipientIds.length > 1).length,
    engagedCents: sum(gifts.map((g) => g.priceCents)),
    fundedCents: sum(gifts.flatMap((g) => g.contributions.map((c) => c.amountCents))),
    plannedCents: sum(data.participants.map((p) => p.receiveMaxCents ?? 0)),
    paidCents: sum(gifts.filter((g) => isPaid(g.status)).map((g) => g.priceCents)),
    progress: averagePercent(gifts),
    distribution: distributionOf(gifts.map((g) => g.status)),
    underfundedCount: gifts.filter((g) => sum(g.contributions.map((c) => c.amountCents)) < g.priceCents).length,
    upcomingDeliveries: gifts
      .filter((g) => g.purchaseMode === 'REMOTE' && g.status === 'BOUGHT' && g.deliveryDate && g.deliveryDate >= today)
      .sort((a, b) => (a.deliveryDate!.getTime() - b.deliveryDate!.getTime())),
  };
}

export interface FamilyGroup {
  key: string;
  familyId: string | null;
  name: string;
  memberIds: string[];
  /** Membres de la famille absents de l'événement. */
  missingIds: string[];
  complete: boolean;
  receivedCents: number;
}

/** Regroupe les participants par famille (complètes ou incomplètes). */
export function computeFamilyGroups(
  data: EventData,
  stats: Map<string, PersonStats>,
  dir = new Directory(data),
): FamilyGroup[] {
  const inEvent = new Set(data.participants.map((p) => p.personId));
  const order = (ids: string[]) =>
    [...ids].sort((a, b) => {
      const pa = dir.person(a);
      const pb = dir.person(b);
      const ya = pa?.birthYear ?? 0;
      const yb = pb?.birthYear ?? 0;
      if (ya !== yb) return ya - yb;
      return (pa?.firstName ?? '').localeCompare(pb?.firstName ?? '', 'fr');
    });

  const groups: FamilyGroup[] = [];
  for (const fam of data.families) {
    const all = data.persons.filter((p) => p.familyId === fam.id).map((p) => p.id);
    const present = all.filter((id) => inEvent.has(id));
    if (present.length === 0) continue;
    groups.push({
      key: 'f:' + fam.id,
      familyId: fam.id,
      name: fam.name,
      memberIds: order(present),
      missingIds: order(all.filter((id) => !inEvent.has(id))),
      complete: present.length === all.length,
      receivedCents: sum(present.map((id) => stats.get(id)?.receivedCents ?? 0)),
    });
  }
  groups.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  const loners = data.participants.map((p) => p.personId).filter((id) => !dir.person(id)?.familyId);
  if (loners.length > 0) {
    groups.push({
      key: 'none',
      familyId: null,
      name: 'Sans famille',
      memberIds: order(loners),
      missingIds: [],
      complete: true,
      receivedCents: sum(loners.map((id) => stats.get(id)?.receivedCents ?? 0)),
    });
  }
  return groups;
}
