import * as ExcelJS from 'exceljs';
import type { EventView } from './event-data';
import { giftView } from './domain/budget';
import { accountLabel, computeBalances } from './domain/balances';
import { computeFlows } from './domain/finance';
import { STATUS_LABEL, giftPercent } from './domain/status';
import type { DGift } from './domain/types';

export type ExportGroup = 'person' | 'couple' | 'family';
export type ExportOptions = {
  group: ExportGroup;
  coupleMode: 'split' | 'column';
  perPerson: boolean;
  groups: boolean;
  balances: boolean;
  flows: boolean;
  colStatus: boolean;
  colLink: boolean;
  colAdvance: boolean;
};

const EUR = '#,##0.00 "€"';
const FILL_GROUP = 'FFE8F1EC';
const FILL_PERSON = 'FFF4F8F5';
const FILL_SUBTOTAL = 'FFF7F7F5';
const FILL_HEADER = 'FF1F6B52';

const euros = (cents: number | null | undefined) => (cents ? cents / 100 : null);

function styleRow(row: ExcelJS.Row, count: number, fill: string, bold = true, color?: string) {
  for (let i = 1; i <= count; i++) {
    const cell = row.getCell(i);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    cell.font = { bold, color: color ? { argb: color } : undefined };
  }
}

function headerRow(ws: ExcelJS.Worksheet, values: string[]) {
  const row = ws.addRow(values);
  styleRow(row, values.length, FILL_HEADER, true, 'FFFFFFFF');
  return row;
}

export async function buildWorkbook(view: EventView, opts: ExportOptions): Promise<ArrayBuffer> {
  const { data, dir, stats, groups: familyGroups } = view;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Laponie';
  wb.created = new Date();

  // ---------- Colonnes « payeurs » ----------
  const participantOrder = familyGroups.flatMap((g) => g.memberIds);
  type Col = { key: string; label: string };
  const cols: Col[] = [];
  if (opts.coupleMode === 'column') {
    const seen = new Set<string>();
    for (const pid of participantOrder) {
      const c = dir.coupleOf(pid);
      if (c && !seen.has(c.id)) {
        seen.add(c.id);
        cols.push({ key: 'c:' + c.id, label: dir.coupleShortName(c.id) });
      }
    }
  }
  for (const pid of participantOrder) cols.push({ key: 'p:' + pid, label: dir.personName(pid) });
  const colIndex = new Map(cols.map((c, i) => [c.key, i]));

  const giftValues = (g: DGift): number[] => {
    const v = new Array(cols.length + 1).fill(0) as number[]; // dernière case : « Autres »
    for (const c of g.contributions) {
      if (opts.coupleMode === 'column' && c.coupleId) {
        const i = colIndex.get('c:' + c.coupleId);
        v[i ?? cols.length] += c.amountCents;
      } else {
        for (const share of dir.partyPersonShares(c, c.amountCents)) {
          const i = colIndex.get('p:' + share.personId);
          v[i ?? cols.length] += share.cents;
        }
      }
    }
    return v;
  };
  const hasOthers = data.gifts.some((g) => giftValues(g)[cols.length] !== 0);

  // ---------- Feuille 1 : cadeaux × participants ----------
  const ws = wb.addWorksheet('Cadeaux × participants', { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] });
  const fixed: { label: string; width: number; money?: boolean }[] = [
    { label: 'Cadeau', width: 34 },
    { label: 'Destinataire(s)', width: 22 },
  ];
  if (opts.colStatus) fixed.push({ label: 'Statut', width: 11 }, { label: 'Avancement', width: 11 });
  if (opts.colLink) fixed.push({ label: 'Lien', width: 30 }, { label: 'Livraison', width: 12 });
  if (opts.colAdvance) fixed.push({ label: 'Avancé par', width: 18 }, { label: 'Avance', width: 11, money: true });
  fixed.push({ label: 'Prix', width: 11, money: true });
  const payerCols = [...cols.map((c) => c.label), ...(hasOthers ? ['Autres'] : [])];
  const headers = [...fixed.map((f) => f.label), ...payerCols, 'Total participations'];
  headerRow(ws, headers);
  fixed.forEach((f, i) => {
    ws.getColumn(i + 1).width = f.width;
    if (f.money) ws.getColumn(i + 1).numFmt = EUR;
  });
  for (let i = fixed.length + 1; i <= headers.length; i++) {
    ws.getColumn(i).width = 13;
    ws.getColumn(i).numFmt = EUR;
  }
  const nCols = headers.length;
  const valueSlice = (v: number[]) => (hasOthers ? v : v.slice(0, cols.length));

  // groupes de lignes
  let rowGroups: { label: string; personIds: string[] }[];
  if (opts.group === 'family') {
    rowGroups = familyGroups.map((g) => ({ label: g.name, personIds: g.memberIds }));
  } else if (opts.group === 'couple') {
    const seen = new Set<string>();
    rowGroups = [];
    for (const pid of participantOrder) {
      if (seen.has(pid)) continue;
      const c = dir.coupleOf(pid);
      const members = c ? [c.personAId, c.personBId].filter((id) => view.participantIds.has(id)) : [pid];
      members.forEach((id) => seen.add(id));
      rowGroups.push({ label: c && members.length > 1 ? dir.coupleFullName(c.id) : dir.personName(pid), personIds: members });
    }
  } else {
    rowGroups = participantOrder.map((pid) => ({ label: dir.personName(pid), personIds: [pid] }));
  }

  const blanks = (n: number) => new Array(n).fill('') as string[];
  for (const grp of rowGroups) {
    const groupTotals = new Array(cols.length + 1).fill(0) as number[];
    let groupReceived = 0;
    const groupRow = ws.addRow([grp.label, ...blanks(nCols - 1)]);
    styleRow(groupRow, nCols, FILL_GROUP);

    for (const pid of grp.personIds) {
      const personGifts = data.gifts.filter((g) => g.recipientIds.includes(pid));
      if (grp.personIds.length > 1) {
        const pr = ws.addRow(['  ' + dir.personName(pid), ...blanks(nCols - 1)]);
        styleRow(pr, nCols, FILL_PERSON);
      }
      const personTotals = new Array(cols.length + 1).fill(0) as number[];
      let received = 0;
      for (const g of personGifts) {
        const gv = giftView(g);
        const share = gv.shareByRecipient.get(pid) ?? 0;
        const fraction = g.priceCents > 0 ? share / g.priceCents : 1 / g.recipientIds.length;
        received += share;
        const values = giftValues(g);
        values.forEach((v, i) => (personTotals[i] += Math.round(v * fraction)));
        const label = g.recipientIds.length > 1 ? `${g.name} (part ${g.recipientIds.length > 2 ? `1/${g.recipientIds.length}` : '½'})` : g.name;
        const cells: (string | number | null)[] = [label, g.recipientIds.map((id) => dir.firstName(id)).join(', ')];
        if (opts.colStatus) cells.push(STATUS_LABEL[g.status], `${giftPercent(g.status, g.purchaseMode)} %`);
        if (opts.colLink) cells.push(g.url ?? '', g.deliveryDate ? g.deliveryDate.toISOString().slice(0, 10) : '');
        if (opts.colAdvance) {
          cells.push(
            [...new Set(g.advances.map((a) => dir.personName(a.payerId)))].join(', '),
            euros(g.advances.reduce((x, a) => x + a.amountCents, 0)),
          );
        }
        cells.push(euros(g.priceCents), ...valueSlice(values).map(euros), euros(values.reduce((a, b) => a + b, 0)));
        ws.addRow(cells);
      }
      const subCells: (string | number | null)[] = [
        `Sous-total ${dir.firstName(pid)} (reçu ${(received / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €)`,
        ...blanks(fixed.length - 2),
        euros(received),
        ...valueSlice(personTotals).map(euros),
        euros(personTotals.reduce((a, b) => a + b, 0)),
      ];
      const sub = ws.addRow(subCells.slice(0, nCols));
      styleRow(sub, nCols, FILL_SUBTOTAL);
      personTotals.forEach((v, i) => (groupTotals[i] += v));
      groupReceived += received;
    }
    if (grp.personIds.length > 1) {
      const tot = ws.addRow([
        `Total ${grp.label}`,
        ...blanks(fixed.length - 2),
        euros(groupReceived),
        ...valueSlice(groupTotals).map(euros),
        euros(groupTotals.reduce((a, b) => a + b, 0)),
      ]);
      styleRow(tot, nCols, FILL_GROUP);
    }
    ws.addRow([]);
  }
  ws.addRow([`Un cadeau partagé apparaît sous chaque destinataire ; seule sa part compte dans les sous-totaux. Export du ${new Date().toLocaleDateString('fr-FR')}.`]).font = {
    italic: true,
    color: { argb: 'FF6F6E69' },
  };

  // ---------- Feuille 2 : par personne ----------
  if (opts.perPerson) {
    const s2 = wb.addWorksheet('Par personne', { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] });
    const h = [
      'Personne', 'Famille', 'Couple', 'Reçu', 'Plafond reçu', 'Dépassement reçu', 'Dépensé seul',
      'Part des dépenses du couple', 'Dépensé total', 'Plafond dépense', 'Dépassement dépense', 'Cadeaux reçus', 'Avancement',
    ];
    headerRow(s2, h);
    [24, 18, 22, 12, 12, 14, 12, 16, 12, 14, 16, 12, 12].forEach((w, i) => (s2.getColumn(i + 1).width = w));
    [4, 5, 6, 7, 8, 9, 10, 11].forEach((i) => (s2.getColumn(i).numFmt = EUR));
    for (const pid of participantOrder) {
      const s = stats.get(pid)!;
      const p = dir.person(pid);
      const c = dir.coupleOf(pid);
      s2.addRow([
        dir.personName(pid),
        p?.familyId ? (dir.family(p.familyId)?.name ?? '') : '',
        c ? dir.coupleShortName(c.id) : '',
        euros(s.receivedCents),
        euros(s.receiveMaxCents),
        euros(s.overReceiveCents),
        euros(s.spentSoloCents),
        euros(s.spentCoupleShareCents),
        euros(s.spentCents),
        euros(s.spendMaxCents),
        euros(s.overSpendCents),
        s.receivedGiftIds.length,
        s.progress != null ? `${s.progress} %` : '',
      ]);
    }
  }

  // ---------- Feuille 3 : couples & familles ----------
  if (opts.groups) {
    const s3 = wb.addWorksheet('Couples & familles');
    [26, 16, 18, 16, 14, 14].forEach((w, i) => (s3.getColumn(i + 1).width = w));
    headerRow(s3, ['Couple', 'Répartition', 'Balances', 'Participations du couple', 'Part A', 'Part B']);
    for (const c of data.couples) {
      if (!view.participantIds.has(c.personAId) && !view.participantIds.has(c.personBId)) continue;
      const total = data.gifts.flatMap((g) => g.contributions).filter((x) => x.coupleId === c.id).reduce((a, x) => a + x.amountCents, 0);
      const r = s3.addRow([
        dir.coupleFullName(c.id),
        `${dir.firstName(c.personAId)} ${c.splitA} % / ${dir.firstName(c.personBId)} ${100 - c.splitA} %`,
        c.sharedAccount ? 'Compte commun' : 'Comptes séparés',
        euros(total),
        euros(Math.round((total * c.splitA) / 100)),
        euros(total - Math.round((total * c.splitA) / 100)),
      ]);
      [4, 5, 6].forEach((i) => (r.getCell(i).numFmt = EUR));
    }
    s3.addRow([]);
    headerRow(s3, ['Famille', 'Présents', 'Complète', 'Reçu', 'Dépensé', '']);
    for (const g of familyGroups) {
      const spent = g.memberIds.reduce((a, id) => a + (stats.get(id)?.spentCents ?? 0), 0);
      const r = s3.addRow([
        g.name,
        `${g.memberIds.length}/${g.memberIds.length + g.missingIds.length}`,
        g.familyId ? (g.complete ? 'Oui' : 'Non') : '',
        euros(g.receivedCents),
        euros(spent),
      ]);
      [4, 5].forEach((i) => (r.getCell(i).numFmt = EUR));
    }
  }

  // ---------- Feuille 4 : balances ----------
  if (opts.balances) {
    const b = computeBalances(data, { sharedCouples: true }, dir);
    const s4 = wb.addWorksheet('Balances');
    [28, 28, 26, 12, 12, 12].forEach((w, i) => (s4.getColumn(i + 1).width = w));
    headerRow(s4, ['Compte', 'Solde (+ : on lui doit)', '', '', '', '']);
    for (const a of b.accounts) {
      const r = s4.addRow([a.label, a.netCents / 100]);
      r.getCell(2).numFmt = EUR;
    }
    s4.addRow([]);
    headerRow(s4, ['Remboursements à faire (simplifiés)', 'À', 'Montant', '', '', '']);
    for (const t of b.simplified) {
      const r = s4.addRow([accountLabel(dir, t.from), accountLabel(dir, t.to), t.amountCents / 100]);
      r.getCell(3).numFmt = EUR;
    }
    s4.addRow([]);
    headerRow(s4, ['Cadeau', 'Avancé par', 'Doit', 'Part', 'Remboursé', 'Reste']);
    const giftName = new Map(data.gifts.map((g) => [g.id, g.name]));
    for (const l of b.lines) {
      const r = s4.addRow([giftName.get(l.giftId) ?? '', accountLabel(dir, l.creditor), accountLabel(dir, l.debtor), l.amountCents / 100, l.repaidCents / 100, l.remainingCents / 100]);
      [4, 5, 6].forEach((i) => (r.getCell(i).numFmt = EUR));
    }
    s4.addRow([]);
    headerRow(s4, ['Remboursement enregistré', 'À', 'Date', 'Montant', 'Note', '']);
    for (const rp of data.repayments) {
      const r = s4.addRow([dir.partyName(rp.from), dir.partyName(rp.to), rp.paidAt.toISOString().slice(0, 10), rp.amountCents / 100, rp.note ?? '']);
      r.getCell(4).numFmt = EUR;
    }
  }

  // ---------- Feuille 5 : qui offre à qui ----------
  if (opts.flows) {
    const f = computeFlows(data, 'family', dir);
    const s5 = wb.addWorksheet('Qui offre à qui');
    headerRow(s5, ['De ↓ / Pour →', ...f.cols.map((c) => c.label), 'Total offert']);
    s5.getColumn(1).width = 24;
    for (let i = 2; i <= f.cols.length + 2; i++) {
      s5.getColumn(i).width = 16;
      s5.getColumn(i).numFmt = EUR;
    }
    for (const r of f.rows) {
      s5.addRow([r.label, ...f.cols.map((c) => euros(f.cells.get(r.key + '|' + c.key) ?? 0)), euros(r.totalCents)]);
    }
    const tot = s5.addRow(['Total reçu', ...f.cols.map((c) => euros(c.totalCents)), euros(f.totalCents)]);
    styleRow(tot, f.cols.length + 2, FILL_SUBTOTAL);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}
