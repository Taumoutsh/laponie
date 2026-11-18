import type { GiftStatus } from './domain/types';
import { STATUSES } from './domain/status';

export type GiftsMode = 'status' | 'person';

/** État de la page Cadeaux, lu depuis l'URL et réécrit dans les liens. */
export interface GiftsQuery {
  mode: GiftsMode;
  /** Statuts sélectionnés ; vide = tous. */
  statuses: GiftStatus[];
  q: string;
  /** Famille (id) ou « none » pour « Sans famille » ; vide = toutes. Vue par personne seulement. */
  fam: string;
}

type Raw = { vue?: string | string[]; status?: string | string[]; q?: string | string[]; fam?: string | string[] };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export function parseGiftsQuery(sp: Raw): GiftsQuery {
  const rawStatuses = (Array.isArray(sp.status) ? sp.status : [sp.status ?? ''])
    .flatMap((s) => s.split(','))
    .map((s) => s.trim().toUpperCase());
  const picked = STATUSES.filter((s) => rawStatuses.includes(s));
  return {
    mode: first(sp.vue) === 'personne' ? 'person' : 'status',
    // Tous les statuts cochés équivaut à « Tous ».
    statuses: picked.length === STATUSES.length ? [] : picked,
    q: first(sp.q),
    fam: first(sp.fam),
  };
}

export function giftsHref(base: string, query: GiftsQuery, patch: Partial<GiftsQuery> = {}): string {
  const next = { ...query, ...patch };
  const p = new URLSearchParams();
  if (next.mode === 'person') p.set('vue', 'personne');
  const statuses = next.statuses.length === STATUSES.length ? [] : next.statuses;
  if (statuses.length) p.set('status', STATUSES.filter((s) => statuses.includes(s)).join(','));
  if (next.q) p.set('q', next.q);
  if (next.mode === 'person' && next.fam) p.set('fam', next.fam);
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

/** Ajoute ou retire un statut de la sélection. */
export function toggleStatus(statuses: GiftStatus[], status: GiftStatus): GiftStatus[] {
  return statuses.includes(status) ? statuses.filter((s) => s !== status) : [...statuses, status];
}
