// Détection de cadeaux similaires déjà prévus pour un même destinataire.

const STOPWORDS = new Set([
  'le', 'la', 'les', 'l', 'un', 'une', 'des', 'de', 'du', 'd', 'et', 'en', 'a', 'au', 'aux',
  'pour', 'avec', 'sans', 'sur', 'par', 'the', 'of', 'and',
]);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokens(text: string): string[] {
  return normalize(text)
    .split(' ')
    .filter((t) => t && !STOPWORDS.has(t))
    // pluriel simple : « livres » ~ « livre »
    .map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t));
}

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  const compact = s.replace(/ /g, '');
  for (let i = 0; i < compact.length - 1; i++) {
    const g = compact.slice(i, i + 2);
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

/** Coefficient de Dice sur les bigrammes de caractères (0–1). */
export function dice(a: string, b: string): number {
  const A = bigrams(normalize(a));
  const B = bigrams(normalize(b));
  const total = [...A.values()].reduce((x, y) => x + y, 0) + [...B.values()].reduce((x, y) => x + y, 0);
  if (total === 0) return 0;
  let inter = 0;
  for (const [g, n] of A) inter += Math.min(n, B.get(g) ?? 0);
  return (2 * inter) / total;
}

/** Recouvrement de mots : part des mots du plus court présents dans l'autre. */
export function tokenOverlap(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.min(ta.size, tb.size);
}

export function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  return Math.max(dice(na, nb), tokenOverlap(na, nb) * 0.9);
}

export interface DuplicateCandidate {
  id: string;
  name: string;
  recipientIds: string[];
  /** true : événement en cours ; false : événement passé. */
  current: boolean;
  eventName?: string;
}

export interface DuplicateMatch<T extends DuplicateCandidate = DuplicateCandidate> {
  candidate: T;
  score: number;
  level: 'strong' | 'near';
  sharedRecipientIds: string[];
}

/**
 * Cherche les cadeaux proches du nom saisi, offerts à au moins un des destinataires.
 * Seuils : ≥ 0,6 « probable doublon », ≥ 0,4 « proche ».
 */
export function findDuplicates<T extends DuplicateCandidate>(
  name: string,
  recipientIds: string[],
  candidates: T[],
  opts: { excludeId?: string; limit?: number } = {},
): DuplicateMatch<T>[] {
  if (normalize(name).length < 3 || recipientIds.length === 0) return [];
  const wanted = new Set(recipientIds);
  const out: DuplicateMatch<T>[] = [];
  for (const c of candidates) {
    if (c.id === opts.excludeId) continue;
    const shared = c.recipientIds.filter((id) => wanted.has(id));
    if (shared.length === 0) continue;
    const score = similarity(name, c.name);
    if (score < 0.4) continue;
    out.push({ candidate: c, score, level: score >= 0.6 && c.current ? 'strong' : 'near', sharedRecipientIds: shared });
  }
  out.sort((a, b) => Number(b.candidate.current) - Number(a.candidate.current) || b.score - a.score);
  return out.slice(0, opts.limit ?? 5);
}
