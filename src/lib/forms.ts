import { parseMoney } from './domain/money';
import type { GiftStatus, PurchaseMode } from './domain/types';
import { STATUSES } from './domain/status';

export type ActionState = { error?: string; ok?: boolean; at?: number } | undefined;

export const fail = (error: string): ActionState => ({ error });
export const ok = (): ActionState => ({ ok: true, at: Date.now() });

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

export function optStr(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v ? v : null;
}

export function int(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

/** Montant en centimes ; null si vide ; NaN si invalide. */
export function money(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (!v) return null;
  const cents = parseMoney(v);
  return cents == null ? Number.NaN : cents;
}

/** Date issue d'un champ <input type="date"> (midi UTC pour éviter les décalages). */
export function date(fd: FormData, key: string): Date | null {
  const v = str(fd, key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v + 'T12:00:00Z');
  return Number.isNaN(d.getTime()) ? null : d;
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === 'on' || v === 'true' || v === '1';
}

export function list(fd: FormData, key: string): string[] {
  return fd
    .getAll(key)
    .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    .map((v) => v.trim());
}

export function status(fd: FormData, key = 'status'): GiftStatus | null {
  const v = str(fd, key) as GiftStatus;
  return STATUSES.includes(v) ? v : null;
}

export function mode(fd: FormData, key = 'purchaseMode'): PurchaseMode {
  return str(fd, key) === 'ON_SITE' ? 'ON_SITE' : 'REMOTE';
}

/** Valeur pour <input type="date"> à partir d'une date. */
export function toDateInput(d: Date | null | undefined): string {
  if (!d) return '';
  return new Date(d).toISOString().slice(0, 10);
}
