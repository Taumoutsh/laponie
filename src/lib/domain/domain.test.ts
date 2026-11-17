import { test } from 'node:test';
import assert from 'node:assert/strict';
import { centsToInput, equalShares, formatEUR, parseMoney, splitCents } from './money';
import { averagePercent, giftPercent } from './status';
import { Directory } from './directory';
import { computeEventStats, computeFamilyGroups, computePersonStats } from './budget';
import { computeBalances, simplifyTransfers } from './balances';
import { computeFlows, computePayers } from './finance';
import { findDuplicates, similarity } from './duplicates';
import type { DGift, EventData } from './types';

// ---------- Jeu de données (repris des maquettes) ----------
const P = (id: string, firstName: string, lastName: string, familyId: string | null, birthYear: number | null = 1980) => ({
  id, firstName, lastName, familyId, birthYear, color: 'gray',
});

let seq = 0;
const gift = (g: Partial<DGift> & Pick<DGift, 'id' | 'name' | 'priceCents' | 'recipientIds'>): DGift => ({
  url: null, status: 'IDEA', purchaseMode: 'REMOTE', deliveryDate: null, note: null,
  createdAt: new Date(2026, 9, 1 + seq++), contributions: [], advances: [], ...g,
});
const pc = (id: string, personId: string, amountCents: number) => ({ id, personId, coupleId: null, amountCents });
const cc = (id: string, coupleId: string, amountCents: number) => ({ id, personId: null, coupleId, amountCents });
const adv = (id: string, payerId: string, amountCents: number) => ({ id, payerId, amountCents, paidAt: new Date(2026, 10, 2), note: null });

function fixture(): EventData {
  return {
    families: [
      { id: 'fm', name: 'Famille Martin' },
      { id: 'fd', name: 'Famille Durand' },
      { id: 'fb', name: 'Famille Bernard' },
    ],
    persons: [
      P('paul', 'Paul', 'Martin', 'fm', 1978), P('claire', 'Claire', 'Martin', 'fm', 1980),
      P('lea', 'Léa', 'Martin', 'fm', 2014), P('hugo', 'Hugo', 'Martin', 'fm', 2017),
      P('marc', 'Marc', 'Durand', 'fd', 1975), P('sophie', 'Sophie', 'Durand', 'fd', 1977), P('ines', 'Inès', 'Durand', 'fd', 2010),
      P('thomas', 'Thomas', 'Bernard', 'fb', 1985), P('camille', 'Camille', 'Bernard', 'fb', 1986), P('noe', 'Noé', 'Bernard', 'fb', 2019),
      P('jeanne', 'Jeanne', 'Rousseau', null, 1950),
    ],
    couples: [
      { id: 'pc', personAId: 'paul', personBId: 'claire', splitA: 50, sharedAccount: true },
      { id: 'ms', personAId: 'marc', personBId: 'sophie', splitA: 50, sharedAccount: true },
      { id: 'tc', personAId: 'thomas', personBId: 'camille', splitA: 50, sharedAccount: true },
    ],
    participants: [
      { personId: 'paul', receiveMaxCents: 30000, spendMaxCents: 70000 },
      { personId: 'claire', receiveMaxCents: 35000, spendMaxCents: 70000 },
      { personId: 'lea', receiveMaxCents: 40000, spendMaxCents: null },
      { personId: 'hugo', receiveMaxCents: 40000, spendMaxCents: null },
      { personId: 'marc', receiveMaxCents: 80000, spendMaxCents: 60000 },
      { personId: 'sophie', receiveMaxCents: 80000, spendMaxCents: 60000 },
      { personId: 'ines', receiveMaxCents: 25000, spendMaxCents: 10000 },
      { personId: 'thomas', receiveMaxCents: 20000, spendMaxCents: null },
      { personId: 'camille', receiveMaxCents: 20000, spendMaxCents: 35000 },
      { personId: 'jeanne', receiveMaxCents: 50000, spendMaxCents: 60000 },
    ],
    gifts: [
      gift({
        id: 'switch', name: 'Console Switch 2', priceCents: 46900, recipientIds: ['lea', 'hugo'], status: 'BOUGHT',
        contributions: [cc('c1', 'pc', 26900), pc('c2', 'jeanne', 12000), cc('c3', 'ms', 8000)],
        advances: [adv('a1', 'claire', 46900)],
      }),
      gift({
        id: 'spa', name: 'Week-end spa pour deux', priceCents: 26000, recipientIds: ['paul', 'claire'], status: 'BOUGHT', purchaseMode: 'ON_SITE',
        contributions: [cc('c4', 'ms', 16000), cc('c5', 'tc', 10000)],
        advances: [adv('a2', 'thomas', 26000)],
      }),
      gift({
        id: 'photo', name: 'Appareil photo instantané', priceCents: 12900, recipientIds: ['ines'], status: 'BOUGHT',
        contributions: [pc('c6', 'jeanne', 6000), cc('c7', 'ms', 6900)],
        advances: [adv('a3', 'sophie', 12900)],
      }),
      gift({ id: 'plaid', name: 'Plaid en laine', priceCents: 6900, recipientIds: ['claire'], status: 'WRAPPED', contributions: [cc('c8', 'ms', 6900)] }),
      gift({ id: 'ceram', name: 'Cours de céramique', priceCents: 8500, recipientIds: ['claire'], status: 'IDEA', contributions: [pc('c9', 'jeanne', 8500)] }),
    ],
    repayments: [
      { id: 'r1', from: { personId: 'jeanne', coupleId: null }, to: { personId: null, coupleId: 'pc' }, amountCents: 12000, paidAt: new Date(2026, 10, 5), note: null },
    ],
  };
}

// ---------- Argent ----------
test('splitCents conserve exactement le total', () => {
  assert.deepEqual(splitCents(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(splitCents(46900, [1, 1]), [23450, 23450]);
  assert.deepEqual(splitCents(1001, [50, 50]), [501, 500]);
  assert.deepEqual(splitCents(-100, [1, 1, 1]), [-34, -33, -33]);
  assert.deepEqual(splitCents(10, [0, 0]), [5, 5]);
  assert.deepEqual(splitCents(0, [3, 1]), [0, 0]);
  for (const total of [1, 7, 99, 12345]) {
    const r = splitCents(total, [3, 5, 7, 11]);
    assert.equal(r.reduce((a, b) => a + b, 0), total);
  }
  assert.deepEqual(equalShares(100, 3), [34, 33, 33]);
});

test('parseMoney lit les montants saisis en français', () => {
  assert.equal(parseMoney('20'), 2000);
  assert.equal(parseMoney('20,5'), 2050);
  assert.equal(parseMoney('1 234,56 €'), 123456);
  assert.equal(parseMoney('1.234,56'), 123456);
  assert.equal(parseMoney('12.345'), 1235);
  assert.equal(parseMoney(''), null);
  assert.equal(parseMoney('abc'), null);
  assert.equal(centsToInput(23450), '234,50');
  assert.equal(centsToInput(46900), '469');
});

test('formatEUR', () => {
  const nb = (s: string) => s.replace(/[  ]/g, ' ');
  assert.equal(nb(formatEUR(46900)), '469 €');
  assert.equal(nb(formatEUR(23450)), '234,50 €');
  assert.equal(nb(formatEUR(8000, { sign: true })), '+80 €');
  assert.equal(nb(formatEUR(-6000)), '−60 €');
});

// ---------- Statuts ----------
test('pourcentage d’avancement selon le mode d’achat', () => {
  assert.deepEqual(['IDEA', 'FOUND', 'BOUGHT', 'RECEIVED', 'WRAPPED'].map((s) => giftPercent(s as never, 'REMOTE')), [0, 25, 50, 75, 100]);
  assert.deepEqual(['IDEA', 'FOUND', 'BOUGHT', 'WRAPPED'].map((s) => giftPercent(s as never, 'ON_SITE')), [0, 33, 67, 100]);
  assert.equal(giftPercent('RECEIVED', 'ON_SITE'), 67);
  assert.equal(averagePercent([]), null);
});

// ---------- Budgets ----------
test('statistiques par personne : reçu (parts égales) et dépense (part du couple)', () => {
  const data = fixture();
  const stats = computePersonStats(data);
  const claire = stats.get('claire')!;
  // spa 260/2 + plaid 69 + céramique 85
  assert.equal(claire.receivedCents, 13000 + 6900 + 8500);
  // Claire : 50 % de 269 € (Switch)
  assert.equal(claire.spentSoloCents, 0);
  assert.equal(claire.spentCoupleTotalCents, 26900);
  assert.equal(claire.spentCoupleShareCents, 13450);
  assert.equal(claire.spentCents, 13450);
  const lea = stats.get('lea')!;
  assert.equal(lea.receivedCents, 23450);
  assert.equal(lea.distribution.BOUGHT, 1);
  assert.equal(lea.progress, 50);
  // Inès : plafond dépense 100 €, ne dépense rien ; reçoit 129 €
  assert.equal(stats.get('ines')!.overReceiveCents, 0);
  // Jeanne dépense 120 + 60 + 85 = 265 €
  assert.equal(stats.get('jeanne')!.spentCents, 26500);
  // Le plafond de dépense est respecté
  assert.equal(stats.get('jeanne')!.overSpendCents, 0);
  // Couple 60/40 : la part suit la répartition
  data.couples[1].splitA = 60;
  const s2 = computePersonStats(data);
  assert.equal(s2.get('marc')!.spentCoupleShareCents + s2.get('sophie')!.spentCoupleShareCents, 8000 + 16000 + 6900 + 6900);
  assert.equal(s2.get('marc')!.spentCoupleShareCents, Math.round(0.6 * 8000) + Math.round(0.6 * 16000) + Math.round(0.6 * 6900) + Math.round(0.6 * 6900));
});

test('dépassement des plafonds', () => {
  const data = fixture();
  data.participants.find((p) => p.personId === 'claire')!.receiveMaxCents = 20000;
  data.participants.find((p) => p.personId === 'jeanne')!.spendMaxCents = 20000;
  const stats = computePersonStats(data);
  assert.equal(stats.get('claire')!.overReceiveCents, 28400 - 20000);
  assert.equal(stats.get('jeanne')!.overSpendCents, 6500);
});

test('statistiques d’événement et familles', () => {
  const data = fixture();
  const ev = computeEventStats(data, new Date(2026, 10, 17));
  assert.equal(ev.giftCount, 5);
  assert.equal(ev.sharedGiftCount, 2);
  assert.equal(ev.engagedCents, 46900 + 26000 + 12900 + 6900 + 8500);
  assert.equal(ev.paidCents, 46900 + 26000 + 12900 + 6900);
  const groups = computeFamilyGroups(data, computePersonStats(data));
  const bernard = groups.find((g) => g.familyId === 'fb')!;
  assert.equal(bernard.complete, false);
  assert.deepEqual(bernard.missingIds, ['noe']);
  assert.equal(groups[groups.length - 1].name, 'Sans famille');
  // tri des membres par année de naissance
  assert.deepEqual(groups.find((g) => g.familyId === 'fm')!.memberIds, ['paul', 'claire', 'lea', 'hugo']);
});

// ---------- Balances ----------
test('balances : avances, remboursements et simplification (exemple des maquettes)', () => {
  const data = fixture();
  const dir = new Directory(data);
  const b = computeBalances(data, { sharedCouples: true }, dir);
  const net = Object.fromEntries(b.accounts.map((a) => [a.key, a.netCents]));
  assert.equal(net['c:pc'], 8000);
  assert.equal(net['c:ms'], -18000);
  assert.equal(net['c:tc'], 16000);
  assert.equal(net['p:jeanne'], -6000);
  assert.equal(b.accounts.reduce((a, x) => a + x.netCents, 0), 0);
  assert.equal(b.totalRepaidCents, 12000);
  assert.equal(b.outstandingCents, 30000);
  assert.equal(b.simplifiedCents, 24000);
  assert.equal(b.simplified.length, 3);
  const jeanneLine = b.lines.find((l) => l.giftId === 'switch' && l.debtor === 'p:jeanne')!;
  assert.equal(jeanneLine.repaidCents, 12000);
  assert.equal(jeanneLine.remainingCents, 0);
  assert.equal(b.uncovered.length, 0);
});

test('balances sans compte commun : chaque membre du couple a son compte', () => {
  const data = fixture();
  const b = computeBalances(data, { sharedCouples: false });
  const net = Object.fromEntries(b.accounts.map((a) => [a.key, a.netCents]));
  // Claire a avancé 469 €, sa part du couple est 134,50 €, et a reçu 120 € (moitié imputée à Paul et Claire)
  assert.equal(net['p:claire'] + net['p:paul'], 8000);
  assert.equal(b.accounts.reduce((a, x) => a + x.netCents, 0), 0);
});

test('avance non couverte et avances multiples', () => {
  const data = fixture();
  data.gifts.push(gift({
    id: 'tv', name: 'Téléviseur', priceCents: 100000, recipientIds: ['marc', 'sophie'], status: 'BOUGHT',
    contributions: [pc('t1', 'jeanne', 30000), cc('t2', 'pc', 50000)],
    advances: [adv('t3', 'paul', 60000), adv('t4', 'thomas', 40000)],
  }));
  const b = computeBalances(data, { sharedCouples: true });
  assert.deepEqual(b.uncovered, [{ giftId: 'tv', cents: 20000 }]);
  assert.equal(b.accounts.reduce((a, x) => a + x.netCents, 0), 0);
});

test('simplifyTransfers solde tous les comptes', () => {
  const net = new Map([['a', 500], ['b', -300], ['c', -200], ['d', 0]]);
  const t = simplifyTransfers(net);
  assert.deepEqual(t, [
    { from: 'b', to: 'a', amountCents: 300 },
    { from: 'c', to: 'a', amountCents: 200 },
  ]);
});

// ---------- Finances ----------
test('payeurs et matrice qui offre à qui', () => {
  const data = fixture();
  const payers = computePayers(data);
  assert.equal(payers[0].key, 'c:ms');
  assert.equal(payers[0].totalCents, 8000 + 16000 + 6900 + 6900);
  const flows = computeFlows(data, 'family');
  assert.equal(flows.totalCents, 46900 + 26000 + 12900 + 6900 + 8500);
  const martinCol = flows.cols.find((c) => c.key === 'f:fm')!;
  assert.equal(martinCol.totalCents, 46900 + 26000 + 6900 + 8500);
  const persons = computeFlows(data, 'person');
  assert.equal(persons.cells.get('p:jeanne|p:lea'), 6000);
});

// ---------- Doublons ----------
test('détection des doublons', () => {
  assert.ok(similarity('Console Switch', 'Console Switch 2') > 0.6);
  assert.ok(similarity('Livres', 'Livre de cuisine') >= 0.4);
  assert.ok(similarity('Parfum', 'Lego Technic') < 0.4);
  const candidates = [
    { id: 'g1', name: 'Console Switch 2', recipientIds: ['lea', 'hugo'], current: true },
    { id: 'g2', name: 'Manette pour la console Switch', recipientIds: ['hugo'], current: true },
    { id: 'g3', name: 'Console Switch 2', recipientIds: ['ines'], current: true },
    { id: 'g4', name: 'Jeu Switch', recipientIds: ['hugo'], current: false, eventName: 'Noël 2025' },
  ];
  const m = findDuplicates('console switch', ['hugo'], candidates);
  assert.equal(m[0].candidate.id, 'g1');
  assert.equal(m[0].level, 'strong');
  assert.ok(!m.some((x) => x.candidate.id === 'g3'));
  assert.ok(m.some((x) => x.candidate.id === 'g2'));
  assert.deepEqual(findDuplicates('co', ['hugo'], candidates), []);
  assert.deepEqual(findDuplicates('console switch', ['hugo'], candidates, { excludeId: 'g1' })[0].candidate.id, 'g2');
});
