// Données de démonstration (reprises des maquettes).
// Usage : npm run db:seed   (ou, dans Docker : docker compose exec app npm run db:seed)
// Ne fait rien si le carnet contient déjà des personnes.
import pkg from '@prisma/client';

const { PrismaClient } = pkg;
const prisma = new PrismaClient();
const eur = (n) => Math.round(n * 100);
const day = (s) => new Date(s + 'T12:00:00Z');

async function main() {
  if ((await prisma.person.count()) > 0) {
    console.log('Le carnet n’est pas vide : rien à faire.');
    return;
  }

  const [martin, durand, bernard] = await Promise.all(
    ['Famille Martin', 'Famille Durand', 'Famille Bernard'].map((name) => prisma.family.create({ data: { name } })),
  );
  const P = (firstName, lastName, familyId, birthYear, color) =>
    prisma.person.create({ data: { firstName, lastName, familyId, birthYear, color } });

  const paul = await P('Paul', 'Martin', martin.id, 1978, 'blue');
  const claire = await P('Claire', 'Martin', martin.id, 1980, 'pink');
  const lea = await P('Léa', 'Martin', martin.id, 2014, 'purple');
  const hugo = await P('Hugo', 'Martin', martin.id, 2017, 'yellow');
  const marc = await P('Marc', 'Durand', durand.id, 1975, 'green');
  const sophie = await P('Sophie', 'Durand', durand.id, 1977, 'blue');
  const ines = await P('Inès', 'Durand', durand.id, 2010, 'pink');
  const thomas = await P('Thomas', 'Bernard', bernard.id, 1985, 'gray');
  const camille = await P('Camille', 'Bernard', bernard.id, 1986, 'yellow');
  await P('Noé', 'Bernard', bernard.id, 2019, 'blue');
  const jeanne = await P('Jeanne', 'Rousseau', null, 1950, 'green');

  const pc = await prisma.couple.create({ data: { personAId: paul.id, personBId: claire.id } });
  const ms = await prisma.couple.create({ data: { personAId: marc.id, personBId: sophie.id } });
  const tc = await prisma.couple.create({ data: { personAId: thomas.id, personBId: camille.id } });

  const event = await prisma.event.create({ data: { name: 'Noël 2026', startDate: day('2026-12-24'), endDate: day('2026-12-25') } });
  const caps = [
    [paul, 300, 700], [claire, 350, 700], [lea, 400, null], [hugo, 400, null], [marc, 800, 600],
    [sophie, 800, 600], [ines, 250, 100], [thomas, 200, null], [camille, 200, 350], [jeanne, 500, 600],
  ];
  await prisma.eventParticipant.createMany({
    data: caps.map(([p, r, s]) => ({ eventId: event.id, personId: p.id, receiveMaxCents: eur(r), spendMaxCents: s == null ? null : eur(s) })),
  });

  const gift = (g) =>
    prisma.gift.create({
      data: {
        eventId: event.id,
        name: g.name,
        priceCents: eur(g.price),
        status: g.status,
        purchaseMode: g.mode ?? 'REMOTE',
        deliveryDate: g.delivery ? day(g.delivery) : null,
        note: g.note ?? null,
        recipients: { create: g.to.map((p) => ({ personId: p.id })) },
        contributions: {
          create: g.from.map(([who, amount]) => (who.personAId ? { coupleId: who.id, amountCents: eur(amount) } : { personId: who.id, amountCents: eur(amount) })),
        },
        advances: { create: (g.adv ?? []).map(([p, amount, d]) => ({ payerId: p.id, amountCents: eur(amount), paidAt: day(d) })) },
        logs: { create: [{ message: 'Cadeau créé (démo)' }] },
      },
    });

  const sw = await gift({ name: 'Console Switch 2', price: 469, to: [lea, hugo], status: 'BOUGHT', delivery: '2026-12-12', note: 'Version avec la manette supplémentaire', from: [[pc, 269], [jeanne, 120], [ms, 80]], adv: [[claire, 469, '2026-11-02']] });
  await gift({ name: 'Téléviseur OLED 55"', price: 1190, to: [marc, sophie], status: 'FOUND', from: [[pc, 500], [jeanne, 300], [tc, 390]] });
  await gift({ name: 'Week-end spa pour deux', price: 260, to: [paul, claire], status: 'BOUGHT', mode: 'ON_SITE', from: [[ms, 160], [tc, 100]], adv: [[thomas, 260, '2026-11-04']] });
  await gift({ name: 'Appareil photo instantané', price: 129, to: [ines], status: 'BOUGHT', delivery: '2026-12-15', from: [[jeanne, 60], [ms, 69]], adv: [[sophie, 129, '2026-11-06']] });
  await gift({ name: 'Sac à dos', price: 55, to: [lea], status: 'FOUND', from: [[tc, 55]] });
  await gift({ name: 'Kit d’aquarelle', price: 45, to: [lea], status: 'RECEIVED', from: [[jeanne, 45]] });
  await gift({ name: 'Casque audio sans fil', price: 89, to: [lea], status: 'IDEA', from: [[ms, 89]] });
  await gift({ name: 'Écharpe', price: 25, to: [lea], status: 'WRAPPED', from: [[ines, 25]] });
  await gift({ name: 'Lego Technic', price: 120, to: [hugo], status: 'BOUGHT', mode: 'ON_SITE', from: [[tc, 120]] });
  await gift({ name: 'Cours de céramique', price: 85, to: [claire], status: 'IDEA', from: [[jeanne, 85]] });
  await gift({ name: 'Plaid en laine', price: 69, to: [claire], status: 'WRAPPED', from: [[ms, 69]] });
  await gift({ name: 'Coffret de thés', price: 32, to: [claire], status: 'RECEIVED', from: [[ines, 32]] });
  await gift({ name: 'Parfum', price: 68, to: [sophie], status: 'FOUND', from: [[claire, 68]] });
  await gift({ name: 'Livre de cuisine', price: 28, to: [jeanne], status: 'WRAPPED', from: [[claire, 28]] });
  await gift({ name: 'Montre connectée', price: 180, to: [ines], status: 'IDEA', from: [[pc, 180]] });
  await gift({ name: 'Machine à café', price: 120, to: [jeanne], status: 'RECEIVED', from: [[pc, 120]] });

  await prisma.repayment.create({
    data: { eventId: event.id, fromPersonId: jeanne.id, toCoupleId: pc.id, amountCents: eur(120), paidAt: day('2026-11-05'), note: 'virement' },
  });
  await prisma.giftLog.create({ data: { giftId: sw.id, message: 'Jeanne a remboursé 120 € à Paul & Claire' } });
  console.log('Démo créée : Noël 2026.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
