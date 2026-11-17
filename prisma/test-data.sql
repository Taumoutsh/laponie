-- =====================================================================
-- Laponie — base d'essai pour vérifier tous les affichages.
--
-- ⚠️  EFFACE TOUTES LES DONNÉES (carnet, événements, cadeaux…) avant
--     de charger le jeu d'essai. Ne pas lancer sur une base réelle.
--
-- Usage (Docker) :
--   docker compose exec -T db psql -U laponie -d laponie -v ON_ERROR_STOP=1 < prisma/test-data.sql
--
-- Les dates de livraison sont relatives au jour du chargement, pour que
-- « Livraisons attendues » reste pertinent.
-- =====================================================================

BEGIN;

TRUNCATE "GiftLog", "Repayment", "Advance", "Contribution", "GiftRecipient", "Gift",
         "EventParticipant", "Event", "Couple", "Person", "Family" CASCADE;

-- ---------- Familles ----------
INSERT INTO "Family" ("id", "name") VALUES
  ('fam_martin',  'Famille Martin'),   -- complète dans Noël 2026
  ('fam_durand',  'Famille Durand'),   -- complète
  ('fam_bernard', 'Famille Bernard'),  -- incomplète (Noé absent)
  ('fam_petit',   'Famille Petit');    -- deux adultes sans couple → suggestion

-- ---------- Personnes ----------
INSERT INTO "Person" ("id", "firstName", "lastName", "birthYear", "color", "familyId", "note") VALUES
  ('p_paul',    'Paul',    'Martin',   1978, 'blue',   'fam_martin',  NULL),
  ('p_claire',  'Claire',  'Martin',   1980, 'pink',   'fam_martin',  'Taille M, aime la céramique'),
  ('p_lea',     'Léa',     'Martin',   2014, 'purple', 'fam_martin',  NULL),
  ('p_hugo',    'Hugo',    'Martin',   2017, 'yellow', 'fam_martin',  NULL),
  ('p_marc',    'Marc',    'Durand',   1975, 'green',  'fam_durand',  NULL),
  ('p_sophie',  'Sophie',  'Durand',   1977, 'blue',   'fam_durand',  NULL),
  ('p_ines',    'Inès',    'Durand',   2010, 'pink',   'fam_durand',  NULL),
  ('p_thomas',  'Thomas',  'Bernard',  1985, 'gray',   'fam_bernard', NULL),
  ('p_camille', 'Camille', 'Bernard',  1986, 'yellow', 'fam_bernard', NULL),
  ('p_noe',     'Noé',     'Bernard',  2019, 'blue',   'fam_bernard', NULL),
  ('p_luc',     'Luc',     'Petit',    1990, 'green',  'fam_petit',   NULL),
  ('p_emma',    'Emma',    'Petit',    1991, 'purple', 'fam_petit',   NULL),
  ('p_jeanne',  'Jeanne',  'Rousseau', 1950, 'green',  NULL,          'Mamie — aime le thé'),
  ('p_arthur',  'Arthur',  'Lemoine',  1988, 'orange', NULL,          NULL);

-- ---------- Couples ----------
INSERT INTO "Couple" ("id", "personAId", "personBId", "splitA", "sharedAccount") VALUES
  ('c_pc', 'p_paul',   'p_claire',  50, true),   -- 50/50, compte commun
  ('c_ms', 'p_marc',   'p_sophie',  60, true),   -- 60/40, compte commun
  ('c_tc', 'p_thomas', 'p_camille', 50, false);  -- comptes séparés

-- ---------- Événements ----------
INSERT INTO "Event" ("id", "name", "startDate", "endDate", "archived", "createdAt") VALUES
  ('ev_noel26',   'Noël 2026',            '2026-12-24 12:00', '2026-12-25 12:00', false, now() - interval '40 days'),
  ('ev_noel25',   'Noël 2025',            '2025-12-24 12:00', '2025-12-25 12:00', true,  now() - interval '400 days'),
  ('ev_jeanne90', 'Les 90 ans de Jeanne', '2027-03-14 12:00', NULL,               false, now() - interval '5 days'),
  ('ev_vide',     'Anniversaire de Léa',  '2027-05-02 12:00', NULL,               false, now() - interval '1 day');

-- ---------- Participants (plafonds en centimes) ----------
INSERT INTO "EventParticipant" ("id", "eventId", "personId", "receiveMaxCents", "spendMaxCents") VALUES
  -- Noël 2026
  ('ep01', 'ev_noel26', 'p_paul',    30000, 70000),
  ('ep02', 'ev_noel26', 'p_claire',  35000, 70000),
  ('ep03', 'ev_noel26', 'p_lea',     40000, NULL),   -- dépasse son plafond reçu
  ('ep04', 'ev_noel26', 'p_hugo',    45000, NULL),   -- proche du plafond (orange)
  ('ep05', 'ev_noel26', 'p_marc',    80000, 60000),
  ('ep06', 'ev_noel26', 'p_sophie',  80000, 20000),  -- dépasse son plafond de dépense
  ('ep07', 'ev_noel26', 'p_ines',    35000, 10000),
  ('ep08', 'ev_noel26', 'p_thomas',  20000, NULL),
  ('ep09', 'ev_noel26', 'p_camille', 20000, 35000),  -- dépasse son plafond de dépense
  ('ep10', 'ev_noel26', 'p_jeanne',  50000, 70000),
  ('ep11', 'ev_noel26', 'p_luc',     15000, NULL),
  ('ep12', 'ev_noel26', 'p_emma',    15000, 20000),
  -- Noël 2025 (archivé)
  ('ep20', 'ev_noel25', 'p_paul',    25000, NULL),
  ('ep21', 'ev_noel25', 'p_claire',  25000, NULL),
  ('ep22', 'ev_noel25', 'p_lea',     30000, NULL),
  ('ep23', 'ev_noel25', 'p_hugo',    30000, NULL),
  ('ep24', 'ev_noel25', 'p_jeanne',  40000, NULL),
  -- Les 90 ans de Jeanne (aucun cadeau : états vides)
  ('ep30', 'ev_jeanne90', 'p_jeanne', 40000, NULL),
  ('ep31', 'ev_jeanne90', 'p_paul',   NULL,  NULL),
  ('ep32', 'ev_jeanne90', 'p_claire', NULL,  NULL),
  ('ep33', 'ev_jeanne90', 'p_marc',   NULL,  NULL),
  ('ep34', 'ev_jeanne90', 'p_sophie', NULL,  NULL);
  -- « Anniversaire de Léa » : aucun participant

-- ---------- Cadeaux de Noël 2026 ----------
INSERT INTO "Gift" ("id", "eventId", "name", "url", "priceCents", "status", "purchaseMode", "deliveryDate", "note", "createdAt", "updatedAt") VALUES
  ('g01', 'ev_noel26', 'Console Switch 2', 'https://www.exemple-boutique.fr/console-switch-2', 46900, 'BOUGHT', 'REMOTE', (CURRENT_DATE + 25) + time '12:00', 'Version avec la manette supplémentaire', now() - interval '30 days', now()),
  ('g02', 'ev_noel26', 'Téléviseur OLED 55"', NULL, 119000, 'FOUND', 'REMOTE', NULL, NULL, now() - interval '29 days', now()),
  ('g03', 'ev_noel26', 'Week-end spa pour deux', NULL, 26000, 'BOUGHT', 'ON_SITE', NULL, 'Bon cadeau', now() - interval '28 days', now()),
  ('g04', 'ev_noel26', 'Appareil photo instantané', NULL, 12900, 'BOUGHT', 'REMOTE', (CURRENT_DATE + 8) + time '12:00', NULL, now() - interval '27 days', now()),
  ('g05', 'ev_noel26', 'Sac à dos', NULL, 5500, 'FOUND', 'REMOTE', NULL, NULL, now() - interval '26 days', now()),
  ('g06', 'ev_noel26', 'Kit d’aquarelle', NULL, 4500, 'RECEIVED', 'REMOTE', (CURRENT_DATE - 6) + time '12:00', NULL, now() - interval '25 days', now()),
  ('g07', 'ev_noel26', 'Casque audio sans fil', NULL, 8900, 'IDEA', 'REMOTE', NULL, NULL, now() - interval '24 days', now()),
  ('g08', 'ev_noel26', 'Écharpe', NULL, 2500, 'WRAPPED', 'REMOTE', NULL, NULL, now() - interval '23 days', now()),
  ('g09', 'ev_noel26', 'Lego Technic', NULL, 12000, 'BOUGHT', 'ON_SITE', NULL, NULL, now() - interval '22 days', now()),
  ('g10', 'ev_noel26', 'Manette pour console Switch', NULL, 7500, 'IDEA', 'REMOTE', NULL, 'Personne n’a encore participé', now() - interval '21 days', now()),
  ('g11', 'ev_noel26', 'Cours de céramique', NULL, 8500, 'IDEA', 'REMOTE', NULL, NULL, now() - interval '20 days', now()),
  ('g12', 'ev_noel26', 'Plaid en laine', NULL, 6900, 'WRAPPED', 'REMOTE', NULL, NULL, now() - interval '19 days', now()),
  ('g13', 'ev_noel26', 'Coffret de thés', NULL, 3200, 'RECEIVED', 'REMOTE', (CURRENT_DATE - 2) + time '12:00', NULL, now() - interval '18 days', now()),
  ('g14', 'ev_noel26', 'Parfum', NULL, 6800, 'FOUND', 'ON_SITE', NULL, NULL, now() - interval '17 days', now()),
  ('g15', 'ev_noel26', 'Livre de cuisine', NULL, 2800, 'WRAPPED', 'ON_SITE', NULL, NULL, now() - interval '16 days', now()),
  ('g16', 'ev_noel26', 'Montre connectée', NULL, 18000, 'IDEA', 'REMOTE', NULL, NULL, now() - interval '15 days', now()),
  ('g17', 'ev_noel26', 'Machine à café', NULL, 12000, 'RECEIVED', 'REMOTE', (CURRENT_DATE - 10) + time '12:00', NULL, now() - interval '14 days', now()),
  ('g18', 'ev_noel26', 'Jeu de société coopératif', NULL, 3900, 'BOUGHT', 'REMOTE', (CURRENT_DATE + 3) + time '12:00', 'Pour les trois enfants', now() - interval '13 days', now()),
  ('g19', 'ev_noel26', 'Bougie parfumée', NULL, 0, 'IDEA', 'REMOTE', NULL, 'Prix à trouver', now() - interval '12 days', now()),
  ('g20', 'ev_noel26', 'Vélo d’appartement', 'https://www.exemple-boutique.fr/velo', 34900, 'BOUGHT', 'REMOTE', (CURRENT_DATE + 18) + time '12:00', NULL, now() - interval '11 days', now()),
  ('g21', 'ev_noel26', 'Coffret vinyles', NULL, 9500, 'FOUND', 'REMOTE', NULL, NULL, now() - interval '10 days', now()),
  ('g22', 'ev_noel26', 'Plante d’intérieur', NULL, 3500, 'WRAPPED', 'ON_SITE', NULL, NULL, now() - interval '9 days', now()),
  ('g23', 'ev_noel26', 'Pull en laine mérinos', NULL, 7900, 'IDEA', 'REMOTE', NULL, NULL, now() - interval '8 days', now()),
  ('g24', 'ev_noel26', 'Gants de jardinage', NULL, 2200, 'WRAPPED', 'ON_SITE', NULL, 'Offert par les enfants', now() - interval '7 days', now()),
  ('g25', 'ev_noel26', 'Cadre photo numérique', NULL, 11000, 'FOUND', 'REMOTE', NULL, NULL, now() - interval '6 days', now()),
  ('g26', 'ev_noel26', 'Abonnement BD', NULL, 6000, 'IDEA', 'REMOTE', NULL, NULL, now() - interval '5 days', now()),
  -- Noël 2025 (archivé) : pour l’alerte « déjà offert »
  ('h01', 'ev_noel25', 'Jeu vidéo Mario Kart', NULL, 6000, 'WRAPPED', 'REMOTE', NULL, NULL, now() - interval '380 days', now()),
  ('h02', 'ev_noel25', 'Livre de cuisine italienne', NULL, 3200, 'WRAPPED', 'ON_SITE', NULL, NULL, now() - interval '379 days', now()),
  ('h03', 'ev_noel25', 'Console rétro portable', NULL, 7900, 'WRAPPED', 'REMOTE', NULL, NULL, now() - interval '378 days', now());

INSERT INTO "GiftRecipient" ("giftId", "personId") VALUES
  ('g01', 'p_lea'), ('g01', 'p_hugo'),
  ('g02', 'p_marc'), ('g02', 'p_sophie'),
  ('g03', 'p_paul'), ('g03', 'p_claire'),
  ('g04', 'p_ines'),
  ('g05', 'p_lea'), ('g06', 'p_lea'), ('g07', 'p_lea'), ('g08', 'p_lea'),
  ('g09', 'p_hugo'), ('g10', 'p_hugo'),
  ('g11', 'p_claire'), ('g12', 'p_claire'), ('g13', 'p_claire'),
  ('g14', 'p_sophie'),
  ('g15', 'p_jeanne'),
  ('g16', 'p_ines'),
  ('g17', 'p_jeanne'),
  ('g18', 'p_lea'), ('g18', 'p_hugo'), ('g18', 'p_ines'),
  ('g19', 'p_emma'),
  ('g20', 'p_jeanne'),
  ('g21', 'p_luc'),
  ('g22', 'p_emma'),
  ('g23', 'p_paul'), ('g24', 'p_paul'),
  ('g25', 'p_thomas'), ('g25', 'p_camille'),
  ('g26', 'p_camille'),
  ('h01', 'p_hugo'), ('h02', 'p_jeanne'), ('h03', 'p_lea');

-- ---------- Participations ----------
INSERT INTO "Contribution" ("id", "giftId", "personId", "coupleId", "amountCents", "createdAt") VALUES
  ('k01', 'g01', NULL,       'c_pc', 26900, now() - interval '30 days'),
  ('k02', 'g01', 'p_jeanne', NULL,   12000, now() - interval '29 days'),
  ('k03', 'g01', NULL,       'c_ms',  8000, now() - interval '28 days'),
  ('k04', 'g02', NULL,       'c_pc', 50000, now() - interval '29 days'),
  ('k05', 'g02', 'p_jeanne', NULL,   30000, now() - interval '29 days'),
  ('k06', 'g02', NULL,       'c_tc', 39000, now() - interval '29 days'),
  ('k07', 'g03', NULL,       'c_ms', 16000, now() - interval '28 days'),
  ('k08', 'g03', NULL,       'c_tc', 10000, now() - interval '28 days'),
  ('k09', 'g04', 'p_jeanne', NULL,    6000, now() - interval '27 days'),
  ('k10', 'g04', NULL,       'c_ms',  6900, now() - interval '27 days'),
  ('k11', 'g05', NULL,       'c_tc',  5500, now() - interval '26 days'),
  ('k12', 'g06', 'p_jeanne', NULL,    4500, now() - interval '25 days'),
  ('k13', 'g07', NULL,       'c_ms',  8900, now() - interval '24 days'),
  ('k14', 'g08', 'p_ines',   NULL,    2500, now() - interval '23 days'),
  ('k15', 'g09', NULL,       'c_tc', 12000, now() - interval '22 days'),
  -- g10 : aucune participation
  ('k16', 'g11', 'p_jeanne', NULL,    8500, now() - interval '20 days'),
  ('k17', 'g12', NULL,       'c_ms',  6900, now() - interval '19 days'),
  ('k18', 'g13', 'p_ines',   NULL,    3200, now() - interval '18 days'),
  ('k19', 'g14', 'p_claire', NULL,    6800, now() - interval '17 days'),
  ('k20', 'g15', 'p_claire', NULL,    2800, now() - interval '16 days'),
  ('k21', 'g16', NULL,       'c_pc', 18000, now() - interval '15 days'),
  ('k22', 'g17', NULL,       'c_pc', 12000, now() - interval '14 days'),
  ('k23', 'g18', 'p_luc',    NULL,    2000, now() - interval '13 days'),   -- 40 € pour 39 € : dépassement
  ('k24', 'g18', 'p_emma',   NULL,    2000, now() - interval '13 days'),
  -- g19 : prix 0, aucune participation
  ('k25', 'g20', NULL,       'c_ms', 15000, now() - interval '11 days'),   -- 250 € sur 349 € : sous-financé
  ('k26', 'g20', NULL,       'c_tc', 10000, now() - interval '11 days'),
  ('k27', 'g21', 'p_emma',   NULL,    9500, now() - interval '10 days'),
  ('k28', 'g22', 'p_luc',    NULL,    3500, now() - interval '9 days'),
  ('k29', 'g23', NULL,       'c_ms',  4000, now() - interval '8 days'),
  ('k30', 'g23', 'p_jeanne', NULL,    3900, now() - interval '8 days'),
  ('k31', 'g24', 'p_hugo',   NULL,    1200, now() - interval '7 days'),   -- les enfants participent
  ('k32', 'g24', 'p_lea',    NULL,    1000, now() - interval '7 days'),
  ('k33', 'g25', NULL,       'c_pc', 11000, now() - interval '6 days'),
  ('k34', 'g26', 'p_ines',   NULL,    1400, now() - interval '5 days'),   -- 14 € sur 60 €
  -- Noël 2025
  ('k90', 'h01', NULL,       'c_pc',  6000, now() - interval '380 days'),
  ('k91', 'h02', 'p_claire', NULL,    3200, now() - interval '379 days'),
  ('k92', 'h03', 'p_jeanne', NULL,    7900, now() - interval '378 days');

-- ---------- Avances ----------
INSERT INTO "Advance" ("id", "giftId", "payerId", "amountCents", "paidAt", "note") VALUES
  ('a01', 'g01', 'p_claire',  46900, now() - interval '15 days', 'carte'),         -- compte commun Paul & Claire
  ('a02', 'g03', 'p_thomas',  26000, now() - interval '13 days', NULL),            -- comptes séparés Thomas / Camille
  ('a03', 'g04', 'p_sophie',  12900, now() - interval '11 days', NULL),
  ('a04', 'g09', 'p_camille', 12000, now() - interval '10 days', 'en magasin'),    -- Thomas doit sa moitié à Camille
  ('a05', 'g18', 'p_luc',      3900, now() - interval '9 days',  NULL),
  ('a06', 'g20', 'p_marc',    20000, now() - interval '8 days',  'acompte'),       -- deux payeurs
  ('a07', 'g20', 'p_thomas',  14900, now() - interval '7 days',  'solde');         -- 349 € avancés pour 250 € financés : 99 € non couverts

-- ---------- Remboursements ----------
INSERT INTO "Repayment" ("id", "eventId", "fromPersonId", "fromCoupleId", "toPersonId", "toCoupleId", "amountCents", "paidAt", "note") VALUES
  ('r01', 'ev_noel26', 'p_jeanne', NULL,  NULL,      'c_pc', 12000, now() - interval '12 days', 'virement'),        -- total (Switch)
  ('r02', 'ev_noel26', NULL,       'c_ms', 'p_thomas', NULL,  8000, now() - interval '6 days',  'partiel, spa'),    -- partiel
  ('r03', 'ev_noel26', 'p_emma',   NULL,  'p_luc',   NULL,     1000, now() - interval '3 days',  'espèces');         -- partiel

-- ---------- Historique ----------
INSERT INTO "GiftLog" ("id", "giftId", "message", "createdAt") VALUES
  ('l01', 'g01', 'Cadeau créé (Idée)',                                   now() - interval '30 days'),
  ('l02', 'g01', 'Paul & Claire participe à hauteur de 269 €',           now() - interval '30 days'),
  ('l03', 'g01', 'Jeanne participe à hauteur de 120 €',                  now() - interval '29 days'),
  ('l04', 'g01', 'Marc & Sophie participe à hauteur de 80 €',            now() - interval '28 days'),
  ('l05', 'g01', 'Statut : Trouvé → Acheté',                             now() - interval '15 days'),
  ('l06', 'g01', 'Claire a avancé 469 €',                                now() - interval '15 days'),
  ('l07', 'g20', 'Marc a avancé 200 €',                                  now() - interval '8 days'),
  ('l08', 'g20', 'Thomas a avancé 149 €',                                now() - interval '7 days');

COMMIT;
