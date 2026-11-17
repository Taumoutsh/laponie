/**
 * Répartit un montant entier (centimes) selon des poids, sans perte :
 * la somme du résultat vaut toujours exactement `total`
 * (méthode du plus fort reste, départage par ordre des poids).
 */
export function splitCents(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  if (total < 0) return splitCents(-total, weights).map((v) => -v);
  let w = weights.map((x) => (Number.isFinite(x) && x > 0 ? x : 0));
  let sum = w.reduce((a, b) => a + b, 0);
  if (sum === 0) {
    w = weights.map(() => 1);
    sum = n;
  }
  const raw = w.map((x) => (total * x) / sum);
  const base = raw.map((r) => Math.floor(r + 1e-9));
  let rest = total - base.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r + 1e-9) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; rest > 0 && n > 0; k = (k + 1) % n) {
    base[order[k].i] += 1;
    rest -= 1;
  }
  return base;
}

/** Part égale entre `n` destinataires. */
export function equalShares(total: number, n: number): number[] {
  return splitCents(total, Array.from({ length: n }, () => 1));
}

/**
 * Lit un montant saisi en français : « 1 234,56 € », « 20 », « 12.5 ».
 * Renvoie des centimes, ou null si la saisie est vide ou invalide.
 */
export function parseMoney(input: string | null | undefined): number | null {
  if (input == null) return null;
  let s = String(input).trim();
  if (!s) return null;
  s = s.replace(/[€\s  ]/g, '');
  if (s.includes(',') && s.includes('.')) {
    // « 1.234,56 » → séparateur de milliers en point
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(',', '.');
  }
  if (!/^-?\d+(\.\d{0,2})?$/.test(s)) {
    // plus de 2 décimales : on arrondit
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  }
  const value = Number(s);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

const eurWhole = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const eurCents = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formate des centimes : « 469 € », « 234,50 € ». */
export function formatEUR(cents: number, opts: { sign?: boolean; forceCents?: boolean } = {}): string {
  const abs = Math.abs(cents);
  const f = opts.forceCents || abs % 100 !== 0 ? eurCents : eurWhole;
  const txt = f.format(abs / 100);
  if (cents < 0) return '−' + txt;
  if (opts.sign && cents > 0) return '+' + txt;
  return txt;
}

/** Valeur à afficher dans un champ de saisie : « 234,50 ». */
export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return '';
  const v = (cents / 100).toFixed(2).replace('.', ',');
  return v.endsWith(',00') ? v.slice(0, -3) : v;
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
