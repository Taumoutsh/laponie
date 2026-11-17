import type { GiftStatus } from './domain/types';

export const STATUS_STYLE: Record<GiftStatus, { bg: string; fg: string; bar: string }> = {
  IDEA: { bg: '#EDEDEC', fg: '#5F5E5B', bar: '#A8A7A3' },
  FOUND: { bg: '#FBF3DB', fg: '#7A5C12', bar: '#E0B33E' },
  BOUGHT: { bg: '#E1EEF8', fg: '#1F5A8A', bar: '#3B7DD8' },
  RECEIVED: { bg: '#EEE6F7', fg: '#6B3FA0', bar: '#8A5CC2' },
  WRAPPED: { bg: '#E3F1E9', fg: '#1F6B45', bar: '#1F6B45' },
};

export const AVATAR_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  gray: { bg: '#EDEDEC', fg: '#5F5E5B', label: 'Gris' },
  blue: { bg: '#E1EEF8', fg: '#1F5A8A', label: 'Bleu' },
  green: { bg: '#E3F1E9', fg: '#1F6B45', label: 'Vert' },
  yellow: { bg: '#FBF3DB', fg: '#7A5C12', label: 'Jaune' },
  purple: { bg: '#EEE6F7', fg: '#6B3FA0', label: 'Violet' },
  pink: { bg: '#F9E4EC', fg: '#9B2C55', label: 'Rose' },
  orange: { bg: '#FCEBD9', fg: '#8F4A0E', label: 'Orange' },
  red: { bg: '#FDECEA', fg: '#B42318', label: 'Rouge' },
};

export function avatarColor(color: string | null | undefined) {
  return AVATAR_COLORS[color ?? 'gray'] ?? AVATAR_COLORS.gray;
}

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' });
const dateLongFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });

export function shortDate(d: Date | null | undefined): string {
  return d ? dateFmt.format(new Date(d)) : '';
}

export function longDate(d: Date | null | undefined): string {
  return d ? dateLongFmt.format(new Date(d)) : '';
}

export function dateRange(start: Date | null, end: Date | null): string {
  if (!start) return 'Date à définir';
  if (!end || end.getTime() === start.getTime()) return longDate(start);
  return `${shortDate(start)} – ${longDate(end)}`;
}

export function daysUntil(d: Date, now = new Date()): number {
  const a = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const b = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((b - a) / 86400000);
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}
