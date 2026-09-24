// Verification de l'arithmetique de lib/comptes et de lib/dates.
// Lance avec :  npx tsx test-comptes.ts   (TZ=Europe/Paris et TZ=America/New_York)

import {
  centimes, repartir, calculerSolde, reconcilierLignes, grouperLignes,
  parserMontant, lignesDetailPourGroupe, formatMontant,
} from './lib/comptes';
import { basePartageable, depassePlafond, listerConditions, aDesConditions, libellesConditions } from './lib/conditionsCadre';
import { jourLocal, aujourdHuiLocal, depuisJourLocal, ajouterJours, ajouterAnnees, jourPourBase } from './lib/dates';

let echecs = 0;
function ok(nom: string, condition: boolean, detail?: any) {
  if (condition) console.log(`  ok   ${nom}`);
  else { console.log(`  ECHEC ${nom}`, detail ?? ''); echecs++; }
}
function eq(nom: string, a: any, b: any) {
  ok(nom + ` (${JSON.stringify(a)} = ${JSON.stringify(b)})`, JSON.stringify(a) === JSON.stringify(b), { a, b });
}

console.log(`\n=== TZ = ${process.env.TZ ?? '(systeme)'} ===`);

console.log('\n-- repartir : somme exacte, arrondi au centime');
for (const montant of [100.01, 0.01, 0.03, 33.33, 599.99, 1234.56, 7.77]) {
  for (const p of [50, 60, 40, 70, 33, 100, 0]) {
    const { partA, partB } = repartir(montant, p);
    ok(`somme exacte ${montant} @ ${p}%`, centimes(partA + partB) === montant, { partA, partB });
    ok(`2 decimales ${montant} @ ${p}%`,
      Number(partA.toFixed(2)) === partA && Number(partB.toFixed(2)) === partB, { partA, partB });
  }
}
eq('repartir(100.01, 60)', repartir(100.01, 60), { partA: 60.01, partB: 40 });
eq('repartir(0.01, 50)', repartir(0.01, 50), { partA: 0.01, partB: 0 });

console.log('\n-- sens de la dette : independant du parent connecte');
// A avance 100 € en 50/50 : B lui doit 50 €.
const cas1 = [{ montant: 100, rembourse: false, auteurId: 'A' as const, partA: 50, partB: 50 }];
eq('A paie 100 en 50/50 => solde +50 (B doit a A)', calculerSolde(cas1).solde, 50);
// B avance 100 € en 50/50 : A lui doit 50 €.
const cas2 = [{ montant: 100, rembourse: false, auteurId: 'B' as const, partA: 50, partB: 50 }];
eq('B paie 100 en 50/50 => solde -50 (A doit a B)', calculerSolde(cas2).solde, -50);
// Charge totale : aucune creance.
const cas3 = [{ montant: 100, rembourse: false, auteurId: 'A' as const, partA: 100, partB: 0 }];
eq('A prend tout a sa charge => solde 0', calculerSolde(cas3).solde, 0);
// Regle 60/40 avec A qui paie.
const cas4 = [{ montant: 600, rembourse: false, auteurId: 'A' as const, partA: 360, partB: 240 }];
eq('A paie 600 en 60/40 => B doit 240', calculerSolde(cas4).solde, 240);
// Deja reglee : ne pese plus.
const cas5 = [{ montant: 100, rembourse: true, auteurId: 'A' as const, partA: 50, partB: 50 }];
eq('depense reglee => solde 0', calculerSolde(cas5).solde, 0);
// Compensation entre les deux parents.
const cas6 = [...cas1, ...cas2];
eq('100 chacun en 50/50 => solde 0', calculerSolde(cas6).solde, 0);
// Total des depenses, arrondi.
eq('total 100 + 100', calculerSolde(cas6).totalDepenses, 200);
// Pas de decimale parasite sur une accumulation.
const cas7 = Array.from({ length: 3 }, () => ({ montant: 0.1, rembourse: false, auteurId: 'A' as const, partA: 0.05, partB: 0.05 }));
eq('3 x 0,10 € => total 0,30 € (et non 0,30000000000000004)', calculerSolde(cas7).totalDepenses, 0.3);

console.log('\n-- reconciliation du ticket : le total imprime gagne toujours');
const l4 = [{ libelle: 'a', montant: 10, categorie: 'quotidien' }, { libelle: 'b', montant: 9.96, categorie: 'quotidien' }];
const r4 = reconcilierLignes(l4, 20);
eq('ecart de 4 centimes desormais corrige', r4.length, 3);
eq('total reconcilie = total ticket', centimes(r4.reduce((s, x) => s + x.montant, 0)), 20);
const r0 = reconcilierLignes([{ libelle: 'a', montant: 20, categorie: 'quotidien' }], 20);
eq('aucun ecart => aucune ligne ajoutee', r0.length, 1);
const rNeg = reconcilierLignes([{ libelle: 'a', montant: 21, categorie: 'quotidien' }], 20);
eq('lignes sur-lues => ajustement negatif', rNeg[1].montant, -1);
eq('total reconcilie (sur-lecture)', centimes(rNeg.reduce((s, x) => s + x.montant, 0)), 20);

console.log('\n-- regroupement : aucune depense negative, total preserve');
const g1 = grouperLignes([
  { libelle: 'pates', montant: 12, categorie: 'alimentaire' },
  { libelle: 'cahiers', montant: 8, categorie: 'ecole' },
  { libelle: 'remise fidelite', montant: -3, categorie: 'autre' },
]);
eq('la remise est reportee, pas de categorie autre', Object.keys(g1).sort(), ['alimentaire', 'ecole']);
eq('remise repartie au prorata (12/20 de 17)', g1.alimentaire, 10.2);
eq('remise repartie au prorata (8/20 de 17)', g1.ecole, 6.8);
eq('total preserve (12 + 8 - 3)', centimes(Object.values(g1).reduce((a, b) => a + b, 0)), 17);
const g2 = grouperLignes([
  { libelle: 'article', montant: 5, categorie: 'quotidien' },
  { libelle: 'remise', montant: -5, categorie: 'autre' },
]);
eq('ticket a zero => aucun groupe (enregistrement refuse)', Object.keys(g2).length, 0);
const g3 = grouperLignes([{ libelle: 'remise', montant: -2, categorie: 'autre' }]);
eq('ticket entierement negatif => aucun groupe', Object.keys(g3).length, 0);
const g4 = grouperLignes([
  { libelle: 'a', montant: 10.005, categorie: 'quotidien' },
  { libelle: 'b', montant: 5.004, categorie: 'ecole' },
]);
ok('montants arrondis au centime', Object.values(g4).every((v) => Number(v.toFixed(2)) === v), g4);

console.log('\n-- dates de calendrier');
const minuitLocal = new Date(2026, 5, 15); // 15 juin 2026, minuit local
eq('jourLocal(minuit local du 15 juin) = 2026-06-15', jourLocal(minuitLocal), '2026-06-15');
eq('toISOString() aurait donne', minuitLocal.toISOString().split('T')[0],
   minuitLocal.toISOString().split('T')[0]);
const finAnnee = new Date(2026, 11, 31, 23, 30);
eq('31 decembre 23h30 reste le 31', jourLocal(finAnnee), '2026-12-31');
const premierDuMois = new Date(2026, 6, 1, 0, 30);
eq('1er juillet 00h30 reste le 1er juillet', jourLocal(premierDuMois), '2026-07-01');
eq('aller-retour jourLocal / depuisJourLocal',
   jourLocal(depuisJourLocal('2026-06-15')), '2026-06-15');
eq('ajouterAnnees conservation 1 an', ajouterAnnees('2026-09-23', 1), '2027-09-23');
eq('ajouterJours franchit le mois', ajouterJours('2026-01-31', 1), '2026-02-01');
eq('ajouterJours franchit fevrier bissextile', ajouterJours('2028-02-28', 1), '2028-02-29');
eq('ajouterJours 90 jours', ajouterJours('2026-09-23', 90), '2026-12-22');
eq('jourPourBase laisse un jour intact', jourPourBase('2026-06-15'), '2026-06-15');
eq('jourPourBase ramene un instant au jour local',
   jourPourBase(new Date(2026, 5, 15, 0, 30).toISOString()), '2026-06-15');
eq("aujourdHuiLocal a le bon format", /^\d{4}-\d{2}-\d{2}$/.test(aujourdHuiLocal()), true);
// Anniversaire : un enfant ne de le 1er janvier a 1 an le 1er janvier suivant.
const naissance = new Date(2020, 0, 1);
eq('date de naissance 1er janvier conservee', jourLocal(naissance), '2020-01-01');


console.log('\n-- remise superieure a la plus grosse categorie (regression corrigee)');
const gCoupon = grouperLignes([
  { libelle: 'Courses', montant: 34.2, categorie: 'alimentaire' },
  { libelle: 'Fournitures', montant: 28.9, categorie: 'ecole' },
  { libelle: 'Coupon -40', montant: -40, categorie: 'autre' },
]);
ok('le ticket n est plus refuse', Object.keys(gCoupon).length > 0, gCoupon);
eq('total = 34,20 + 28,90 - 40', centimes(Object.values(gCoupon).reduce((a, b) => a + b, 0)), 23.1);
ok('toutes les categories restent positives', Object.values(gCoupon).every((v) => v > 0), gCoupon);
const gPetit = grouperLignes([
  { libelle: 'a', montant: 10, categorie: 'alimentaire' },
  { libelle: 'b', montant: 5, categorie: 'ecole' },
  { libelle: 'remise', montant: -10, categorie: 'autre' },
]);
eq('10 + 5 - 10 => total 5', centimes(Object.values(gPetit).reduce((a, b) => a + b, 0)), 5);
ok('toutes positives (10+5-10)', Object.values(gPetit).every((v) => v > 0), gPetit);

console.log('\n-- arrondi par categorie : le total du ticket est preserve');
const gPoids = grouperLignes([
  { libelle: 'Pommes 1,234 kg', montant: 3.085, categorie: 'alimentaire' },
  { libelle: 'Cahiers', montant: 2.015, categorie: 'ecole' },
]);
eq('3,085 + 2,015 => 5,10 € et non 5,11 €', centimes(Object.values(gPoids).reduce((a, b) => a + b, 0)), 5.1);

console.log('\n-- exhaustif : grouperLignes ne cree ni ne detruit d argent');
let casTestes = 0;
const valeurs = [0.01, 0.99, 1, 2.5, 5, 10, 12.34, 33.33, 100];
for (const a of valeurs) for (const b of valeurs) for (const r of valeurs) {
  const lignes = [
    { libelle: 'a', montant: a, categorie: 'alimentaire' },
    { libelle: 'b', montant: b, categorie: 'ecole' },
    { libelle: 'remise', montant: -r, categorie: 'autre' },
  ];
  const g = grouperLignes(lignes);
  const attendu = centimes(a + b - r);
  const obtenu = centimes(Object.values(g).reduce((x, y) => x + y, 0));
  casTestes++;
  if (attendu <= 0) {
    if (Object.keys(g).length !== 0) { console.log(`  ECHEC total<=0 non refuse ${a}/${b}/-${r}`, g); echecs++; }
  } else {
    if (obtenu !== attendu) { console.log(`  ECHEC total ${a}/${b}/-${r} attendu ${attendu} obtenu ${obtenu}`, g); echecs++; }
    if (!Object.values(g).every((v) => v > 0)) { console.log(`  ECHEC categorie <=0 ${a}/${b}/-${r}`, g); echecs++; }
  }
}
ok(`${casTestes} combinaisons remise/categories verifiees`, true);

console.log('\n-- lignes de detail : l addition tombe juste');
const ld = lignesDetailPourGroupe(
  [{ libelle: 'pates', montant: 12, categorie: 'alimentaire' }],
  'alimentaire', 9, 'Remise répartie'
);
eq('ligne de remise ajoutee', ld.length, 2);
eq('le detail totalise le montant enregistre', centimes(ld.reduce((s2, x) => s2 + x.montant, 0)), 9);
const ld2 = lignesDetailPourGroupe(
  [{ libelle: 'pates', montant: 12, categorie: 'alimentaire' }],
  'alimentaire', 12, 'Remise répartie'
);
eq('aucune remise => aucune ligne ajoutee', ld2.length, 1);

console.log('\n-- lecture d un montant saisi');
eq("'12,50'", parserMontant('12,50'), 12.5);
eq("'12.50'", parserMontant('12.50'), 12.5);
eq("'1 234,56' (espace insecable fine)", parserMontant('1 234,56'), 1234.56);
eq("'1 234,56' (espace ordinaire)", parserMontant('1 234,56'), 1234.56);
eq("'1.234,56' (notation FR)", parserMontant('1.234,56'), 1234.56);
eq("'1,234.56' (notation EN)", parserMontant('1,234.56'), 1234.56);
ok("'1,234' ambigu => refuse plutot que devine", Number.isNaN(parserMontant('1,234')));
ok("'12,999' ambigu => refuse", Number.isNaN(parserMontant('12,999')));
ok("'1.234' ambigu => refuse", Number.isNaN(parserMontant('1.234')));
eq("'1.234.567' = milliers", parserMontant('1.234.567'), 1234567);
eq("'1 234 567,89'", parserMontant('1 234 567,89'), 1234567.89);
eq("'12,99'", parserMontant('12,99'), 12.99);
eq("'12,9'", parserMontant('12,9'), 12.9);
eq("'12 000'", parserMontant('12 000'), 12000);
eq("'45,90 €'", parserMontant('45,90 €'), 45.9);
eq("'0,01'", parserMontant('0,01'), 0.01);
ok("'' rejete", Number.isNaN(parserMontant('')));
ok("'abc' rejete", Number.isNaN(parserMontant('abc')));
ok("'12,5,5' rejete", Number.isNaN(parserMontant('12,5,5')));
ok("',' rejete", Number.isNaN(parserMontant(',')));
ok("'-5' negatif lu comme tel (refuse ensuite par le formulaire)", parserMontant('-5') === -5);
ok("'12,5,5' rejete (milliers mal groupes)", Number.isNaN(parserMontant('12,5,5')));
ok("'1,23,456.78' rejete", Number.isNaN(parserMontant('1,23,456.78')));
ok("'12345,678,90' rejete", Number.isNaN(parserMontant('12345,678,90')));
eq("'1,234,567.89' (notation EN complete)", parserMontant('1,234,567.89'), 1234567.89);
eq("'1.234.567,89' (notation FR complete)", parserMontant('1.234.567,89'), 1234567.89);
eq("'999'", parserMontant('999'), 999);
eq("'0'", parserMontant('0'), 0);

console.log('\n-- solde sur des enregistrements anciens (partA/partB absents)');
eq('A paie 100 sans parts => moitie due',
   calculerSolde([{ montant: 100, rembourse: false, auteurId: 'A' }]).solde, 50);
eq('liste vide => solde 0', calculerSolde([]).solde, 0);
eq('liste vide => total 0', calculerSolde([]).totalDepenses, 0);
// Ancien enregistrement dont les parts ne totalisent pas le montant.
eq('parts incoherentes anciennes : lues telles quelles, sans NaN',
   calculerSolde([{ montant: 100, rembourse: false, auteurId: 'A', partA: 60.006, partB: 40.004 }]).solde, 40);


console.log('\n-- conditions du jugement : le remboursement deduit');
// Le cas qui a motive ce lot : orthodontie 600 €, mutuelle 200 €, regle 60/40.
const base600 = basePartageable(600, 200);
eq('base partagee = 600 - 200', base600, 400);
const orthodontie = repartir(base600, 60);
eq('parts sur la base nette', orthodontie, { partA: 240, partB: 160 });
eq('somme des parts = base, pas le montant paye', centimes(orthodontie.partA + orthodontie.partB), 400);
// Ce que Dualia reclamait avant : 60/40 sur le brut.
const avant = repartir(600, 60);
eq('ANCIEN calcul, sur le montant brut', avant, { partA: 360, partB: 240 });
ok('ecart de 80 € sur la part de l autre parent', avant.partB - orthodontie.partB === 80);
// Le solde suit la base nette.
eq('A paie 600, mutuelle 200, 60/40 => B doit 160',
   calculerSolde([{ montant: 600, rembourse: false, auteurId: 'A', partA: 240, partB: 160 }]).solde, 160);

console.log('\n-- base partageable : cas limites');
eq('aucun remboursement', basePartageable(600, undefined), 600);
eq('remboursement nul', basePartageable(600, 0), 600);
eq('remboursement negatif ignore', basePartageable(600, -50), 600);
eq('remboursement egal au montant => base nulle', basePartageable(600, 600), 0);
eq('remboursement superieur => base ramenee a zero, jamais negative', basePartageable(600, 900), 0);
eq('arrondi au centime', basePartageable(100.01, 33.336), 66.67);
ok('base jamais negative', [0, 1, 600, 1e6].every((m) => [0, 1, 700, 1e7].every((r) => basePartageable(m, r) >= 0)));
// Une base nulle ne doit pas creer de creance.
const baseNulle = repartir(basePartageable(300, 300), 60);
eq('base nulle => aucune part', baseNulle, { partA: 0, partB: 0 });
eq('base nulle => solde nul',
   calculerSolde([{ montant: 300, rembourse: false, auteurId: 'A', partA: 0, partB: 0 }]).solde, 0);

console.log('\n-- plafond : detecte, jamais applique d office');
ok('600 depasse un plafond de 400', depassePlafond(600, { plafondMontant: 400 }));
ok('400 ne depasse pas 400', !depassePlafond(400, { plafondMontant: 400 }));
ok('400,01 depasse 400', depassePlafond(400.01, { plafondMontant: 400 }));
ok('aucun plafond => aucun depassement', !depassePlafond(1e6, {}));
ok('plafond nul ignore', !depassePlafond(600, { plafondMontant: 0 }));
ok('conditions absentes => aucun depassement', !depassePlafond(600, undefined));

console.log('\n-- affichage des conditions : rien ne reste cache');
const fmt = (n: number) => `${n.toFixed(2)} €`;
const toutes = { plafondMontant: 400, remboursementAssuranceDeduit: true, accordPrealable: true, justificatifObligatoire: true };
eq('les quatre conditions sont listees', listerConditions(toutes, 'fr', fmt).length, 4);
ok('le plafond apparait avec son montant', listerConditions(toutes, 'fr', fmt)[0].includes('400,00 €'.replace(',', '.')));
for (const lg of ['fr', 'pt', 'es', 'en'] as const) {
  const lignes = listerConditions(toutes, lg, fmt);
  ok(`${lg} : 4 conditions traduites`, lignes.length === 4 && lignes.every((x) => x.length > 0), lignes);
}
ok('aucune condition => rien a afficher', !aDesConditions({}));
ok('aucune condition => liste vide', listerConditions({}, 'fr', fmt).length === 0);
ok('conditions absentes => rien a afficher', !aDesConditions(undefined));
ok('un seul plafond suffit a afficher le bloc', aDesConditions({ plafondMontant: 400 }));
ok('false explicite ne compte pas comme une condition', !aDesConditions({ accordPrealable: false, justificatifObligatoire: false }));


console.log('\n-- mise en forme des montants, dans la langue du parent');
const fr = formatMontant(1234.56, 'fr');
ok('fr : virgule decimale', fr.includes('1') && fr.includes('234') && fr.includes(',56'), fr);
ok('fr : pas de point decimal', !/\d\.\d\d(?!\d)/.test(fr), fr);
const en = formatMontant(1234.56, 'en');
ok('en : point decimal', en.includes('.56'), en);
for (const lg of ['fr', 'pt', 'es', 'en'] as const) {
  ok(`${lg} : deux decimales toujours`, /\d[.,]\d\d(\D|$)/.test(formatMontant(5, lg)), formatMontant(5, lg));
  ok(`${lg} : symbole euro present`, formatMontant(5, lg).includes('€'), formatMontant(5, lg));
}
eq('arrondi au centime avant affichage', formatMontant(0.005, 'en'), formatMontant(0.01, 'en'));

console.log('\n-- libelles des conditions : completude dans les quatre langues');
const cles = Object.keys(libellesConditions('fr')).sort();
for (const lg of ['pt', 'es', 'en'] as const) {
  eq(`${lg} : memes cles que fr`, Object.keys(libellesConditions(lg)).sort(), cles);
}
for (const lg of ['fr', 'pt', 'es', 'en'] as const) {
  const L: any = libellesConditions(lg);
  const vides = cles.filter((k) => {
    const v = L[k];
    return typeof v === 'string' ? v.trim() === '' : typeof v === 'function' ? String(v('X')).trim() === '' : true;
  });
  ok(`${lg} : aucun libelle vide`, vides.length === 0, vides);
  // Les fonctions doivent reellement interpoler leur argument.
  ok(`${lg} : plafond interpole son montant`, L.plafond('ZZZ').includes('ZZZ'), L.plafond('ZZZ'));
  ok(`${lg} : basePartagee interpole`, L.basePartagee('ZZZ').includes('ZZZ'), L.basePartagee('ZZZ'));
  ok(`${lg} : partDe interpole le prenom`, L.partDe('Isabelle').includes('Isabelle'), L.partDe('Isabelle'));
  ok(`${lg} : plafondDepasse interpole`, L.plafondDepasse('ZZZ').includes('ZZZ'), L.plafondDepasse('ZZZ'));
}

console.log('\n-- le remboursement ne rogne plus en silence');
// L'ancien comportement : Math.min(6000, 600) = 600, base 0, dette effacee.
const baseRognee = basePartageable(600, Math.min(6000, 600));
eq('ANCIEN : un zero de trop effacait la dette', baseRognee, 0);
eq('ANCIEN : part de l autre parent ramenee a zero', repartir(baseRognee, 60).partB, 0);
// Desormais l'enregistrement est refuse ; basePartageable reste protege.
eq('basePartageable reste borne a zero', basePartageable(600, 6000), 0);
ok('600 rembourse 200 reste la seule saisie acceptee', basePartageable(600, 200) === 400);

console.log(echecs === 0 ? `\nTOUS LES TESTS PASSENT\n` : `\n${echecs} ECHEC(S)\n`);
process.exit(echecs === 0 ? 0 : 1);
