import type { EventData, Party } from './types';
import { Directory } from './directory';
import { splitCents, sum } from './money';

/** Clé de compte : « p:<personId> » ou « c:<coupleId> » (couple en compte commun). */
export type AccountKey = string;

export interface BalanceOptions {
  /** Regrouper les couples en compte commun (selon le réglage de chaque couple). */
  sharedCouples: boolean;
}

export interface Account {
  key: AccountKey;
  label: string;
  isCouple: boolean;
  netCents: number;
}

export interface DebtLine {
  giftId: string;
  debtor: AccountKey;
  creditor: AccountKey;
  amountCents: number;
  repaidCents: number;
  remainingCents: number;
}

export interface Transfer {
  from: AccountKey;
  to: AccountKey;
  amountCents: number;
}

export interface BalanceResult {
  accounts: Account[];
  lines: DebtLine[];
  /** Dettes restantes compte à compte (non simplifiées). */
  pairwise: Transfer[];
  /** Virements minimaux pour solder tous les comptes. */
  simplified: Transfer[];
  totalAdvancedCents: number;
  totalRepaidCents: number;
  outstandingCents: number;
  simplifiedCents: number;
  /** Part d'avance non couverte par des participations (le payeur l'assume). */
  uncovered: { giftId: string; cents: number }[];
}

export function accountOfPerson(dir: Directory, personId: string, opts: BalanceOptions): AccountKey {
  const c = dir.coupleOf(personId);
  return opts.sharedCouples && c && c.sharedAccount ? 'c:' + c.id : 'p:' + personId;
}

/** Comptes concernés par une partie, avec leur poids. */
export function partyAccounts(dir: Directory, party: Party, opts: BalanceOptions): { key: AccountKey; weight: number }[] {
  if (party.coupleId) {
    const c = dir.couple(party.coupleId);
    if (!c) return [];
    if (opts.sharedCouples && c.sharedAccount) return [{ key: 'c:' + c.id, weight: 1 }];
    return [
      { key: 'p:' + c.personAId, weight: c.splitA },
      { key: 'p:' + c.personBId, weight: 100 - c.splitA },
    ];
  }
  if (party.personId) return [{ key: accountOfPerson(dir, party.personId, opts), weight: 1 }];
  return [];
}

/** Partie (personne ou couple) correspondant à une clé de compte. */
export function accountToParty(key: AccountKey): Party {
  if (key.startsWith('c:')) return { personId: null, coupleId: key.slice(2) };
  return { personId: key.slice(2), coupleId: null };
}

export function accountLabel(dir: Directory, key: AccountKey): string {
  if (key.startsWith('c:')) return dir.coupleShortName(key.slice(2));
  return dir.personName(key.slice(2));
}

function add(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
}

function allocate(map: Map<AccountKey, number>, accounts: { key: AccountKey; weight: number }[], cents: number) {
  const parts = splitCents(cents, accounts.map((a) => a.weight));
  accounts.forEach((a, i) => add(map, a.key, parts[i]));
}

/**
 * Calcule les balances d'un événement à partir des avances et des participations.
 *
 * Pour chaque cadeau ayant une avance : la somme couverte (min(avances, participations))
 * est due par chaque participant au prorata de sa participation, et revient à chaque
 * payeur au prorata de son avance. Les remboursements viennent ensuite en déduction.
 */
export function computeBalances(data: EventData, opts: BalanceOptions, dir = new Directory(data)): BalanceResult {
  const net = new Map<AccountKey, number>();
  const debt = new Map<string, number>(); // « débiteur|créancier » -> centimes
  const lines: DebtLine[] = [];
  const uncovered: { giftId: string; cents: number }[] = [];
  let totalAdvanced = 0;

  const gifts = [...data.gifts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const gift of gifts) {
    const advTotal = sum(gift.advances.map((a) => a.amountCents));
    const shareTotal = sum(gift.contributions.map((c) => c.amountCents));
    if (advTotal <= 0) continue;
    totalAdvanced += advTotal;
    const covered = Math.min(advTotal, shareTotal);
    if (advTotal > covered) uncovered.push({ giftId: gift.id, cents: advTotal - covered });
    if (covered <= 0) continue;

    const creditors = new Map<AccountKey, number>();
    const advAlloc = splitCents(covered, gift.advances.map((a) => a.amountCents));
    gift.advances.forEach((a, i) => add(creditors, accountOfPerson(dir, a.payerId, opts), advAlloc[i]));

    const debtors = new Map<AccountKey, number>();
    const contribAlloc = splitCents(covered, gift.contributions.map((c) => c.amountCents));
    gift.contributions.forEach((c, i) => allocate(debtors, partyAccounts(dir, c, opts), contribAlloc[i]));

    for (const [k, v] of creditors) add(net, k, v);
    for (const [k, v] of debtors) add(net, k, -v);

    const credKeys = [...creditors.keys()];
    const credVals = credKeys.map((k) => creditors.get(k)!);
    for (const [dk, owed] of debtors) {
      const parts = splitCents(owed, credVals);
      credKeys.forEach((ck, j) => {
        if (ck === dk || parts[j] === 0) return;
        add(debt, dk + '|' + ck, parts[j]);
        lines.push({ giftId: gift.id, debtor: dk, creditor: ck, amountCents: parts[j], repaidCents: 0, remainingCents: parts[j] });
      });
    }
  }

  // Remboursements
  const repaidByPair = new Map<string, number>();
  let totalRepaid = 0;
  for (const r of data.repayments) {
    totalRepaid += r.amountCents;
    const fromAccs = partyAccounts(dir, r.from, opts);
    const toAccs = partyAccounts(dir, r.to, opts);
    const fromParts = splitCents(r.amountCents, fromAccs.map((a) => a.weight));
    fromAccs.forEach((fa, i) => {
      const toParts = splitCents(fromParts[i], toAccs.map((a) => a.weight));
      toAccs.forEach((ta, j) => {
        const v = toParts[j];
        if (v === 0 || fa.key === ta.key) return;
        add(net, fa.key, v);
        add(net, ta.key, -v);
        add(debt, fa.key + '|' + ta.key, -v);
        add(repaidByPair, fa.key + '|' + ta.key, v);
      });
    });
  }

  // Remboursements imputés aux lignes de dette, dans l'ordre des cadeaux
  for (const line of lines) {
    const pair = line.debtor + '|' + line.creditor;
    const available = repaidByPair.get(pair) ?? 0;
    const used = Math.min(available, line.amountCents);
    line.repaidCents = used;
    line.remainingCents = line.amountCents - used;
    repaidByPair.set(pair, available - used);
  }

  // Dettes compte à compte, compensées dans les deux sens
  const pairwise: Transfer[] = [];
  const seen = new Set<string>();
  for (const key of debt.keys()) {
    const [a, b] = key.split('|');
    const id = a < b ? a + '|' + b : b + '|' + a;
    if (seen.has(id)) continue;
    seen.add(id);
    const d = (debt.get(a + '|' + b) ?? 0) - (debt.get(b + '|' + a) ?? 0);
    if (d > 0) pairwise.push({ from: a, to: b, amountCents: d });
    else if (d < 0) pairwise.push({ from: b, to: a, amountCents: -d });
  }
  pairwise.sort((x, y) => y.amountCents - x.amountCents);

  const simplified = simplifyTransfers(net);

  const accounts: Account[] = [...net.entries()]
    .map(([key, netCents]) => ({ key, netCents, label: accountLabel(dir, key), isCouple: key.startsWith('c:') }))
    .sort((a, b) => b.netCents - a.netCents || a.label.localeCompare(b.label, 'fr'));

  return {
    accounts,
    lines,
    pairwise,
    simplified,
    totalAdvancedCents: totalAdvanced,
    totalRepaidCents: totalRepaid,
    outstandingCents: sum(pairwise.map((t) => t.amountCents)),
    simplifiedCents: sum(simplified.map((t) => t.amountCents)),
    uncovered,
  };
}

/** Règlement glouton : le plus gros débiteur paie le plus gros créancier, etc. */
export function simplifyTransfers(net: Map<AccountKey, number>): Transfer[] {
  const creditors = [...net.entries()].filter(([, v]) => v > 0).map(([k, v]) => ({ k, v }));
  const debtors = [...net.entries()].filter(([, v]) => v < 0).map(([k, v]) => ({ k, v: -v }));
  const byAmount = (x: { k: string; v: number }, y: { k: string; v: number }) => y.v - x.v || (x.k < y.k ? -1 : 1);
  creditors.sort(byAmount);
  debtors.sort(byAmount);
  const out: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].v, creditors[j].v);
    if (amount > 0) out.push({ from: debtors[i].k, to: creditors[j].k, amountCents: amount });
    debtors[i].v -= amount;
    creditors[j].v -= amount;
    if (debtors[i].v === 0) i++;
    if (creditors[j].v === 0) j++;
  }
  return out;
}
