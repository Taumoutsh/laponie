import type { Party } from './domain/types';

/** « p:<id> » / « c:<id> » → partie (personne ou couple). */
export function parseParty(value: string | null | undefined): Party | null {
  if (!value) return null;
  if (value.startsWith('p:') && value.length > 2) return { personId: value.slice(2), coupleId: null };
  if (value.startsWith('c:') && value.length > 2) return { personId: null, coupleId: value.slice(2) };
  return null;
}

export function partyKey(p: Party): string {
  return p.coupleId ? 'c:' + p.coupleId : 'p:' + p.personId;
}
