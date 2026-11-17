import type { EventData } from './types';
import { Directory } from './directory';
import { equalShares, sum } from './money';

export interface PayerSummary {
  key: string;
  label: string;
  isCouple: boolean;
  totalCents: number;
  giftCount: number;
}

/** Total versé par payeur, tel que saisi (couple ou personne seule). */
export function computePayers(data: EventData, dir = new Directory(data)): PayerSummary[] {
  const map = new Map<string, PayerSummary & { gifts: Set<string> }>();
  for (const gift of data.gifts) {
    for (const c of gift.contributions) {
      const key = c.coupleId ? 'c:' + c.coupleId : 'p:' + c.personId;
      const entry =
        map.get(key) ??
        { key, label: dir.partyName(c), isCouple: !!c.coupleId, totalCents: 0, giftCount: 0, gifts: new Set<string>() };
      entry.totalCents += c.amountCents;
      entry.gifts.add(gift.id);
      map.set(key, entry);
    }
  }
  return [...map.values()]
    .map(({ gifts, ...rest }) => ({ ...rest, giftCount: gifts.size }))
    .sort((a, b) => b.totalCents - a.totalCents);
}

export type FlowLevel = 'person' | 'couple' | 'family';

export interface FlowMatrix {
  level: FlowLevel;
  rows: { key: string; label: string; totalCents: number }[];
  cols: { key: string; label: string; totalCents: number }[];
  /** cellule « ligne|colonne » -> centimes */
  cells: Map<string, number>;
  totalCents: number;
}

export function groupKey(dir: Directory, personId: string, level: FlowLevel): string {
  if (level === 'family') {
    const famId = dir.person(personId)?.familyId;
    return famId ? 'f:' + famId : 'p:' + personId;
  }
  if (level === 'couple') {
    const c = dir.coupleOf(personId);
    return c ? 'c:' + c.id : 'p:' + personId;
  }
  return 'p:' + personId;
}

export function groupLabel(dir: Directory, key: string): string {
  const id = key.slice(2);
  if (key.startsWith('f:')) return dir.family(id)?.name ?? 'Famille';
  if (key.startsWith('c:')) return dir.coupleShortName(id);
  return dir.personName(id);
}

/** Matrice « qui offre à qui » : donneurs en lignes, destinataires en colonnes. */
export function computeFlows(data: EventData, level: FlowLevel, dir = new Directory(data)): FlowMatrix {
  const cells = new Map<string, number>();
  const rowTotals = new Map<string, number>();
  const colTotals = new Map<string, number>();
  for (const gift of data.gifts) {
    const recipients = [...gift.recipientIds].sort();
    if (recipients.length === 0) continue;
    for (const c of gift.contributions) {
      for (const giver of dir.partyPersonShares(c, c.amountCents)) {
        const pieces = equalShares(giver.cents, recipients.length);
        recipients.forEach((rid, i) => {
          if (pieces[i] === 0) return;
          const r = groupKey(dir, giver.personId, level);
          const col = groupKey(dir, rid, level);
          cells.set(r + '|' + col, (cells.get(r + '|' + col) ?? 0) + pieces[i]);
          rowTotals.set(r, (rowTotals.get(r) ?? 0) + pieces[i]);
          colTotals.set(col, (colTotals.get(col) ?? 0) + pieces[i]);
        });
      }
    }
  }
  const toList = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([key, totalCents]) => ({ key, label: groupLabel(dir, key), totalCents }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  return {
    level,
    rows: toList(rowTotals),
    cols: toList(colTotals),
    cells,
    totalCents: sum([...rowTotals.values()]),
  };
}
