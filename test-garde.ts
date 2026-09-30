// Banc d'essai du mode de garde. Exécuté sur les fichiers source réels,
// compilés par tsc — pas sur une recopie.
//
//   node_modules/.bin/tsc test-garde.ts --outDir .tg --module commonjs \
//     --target es2020 --moduleResolution node --esModuleInterop \
//     --skipLibCheck --strict && TZ=Europe/Paris node .tg/test-garde.js
//
// Ce banc a déjà attrapé quatre défauts de son propre auteur, dont deux
// inversions de parent sur douze semaines. Les assertions sur les
// événements échantillonnent HEURE PAR HEURE sur les 84 jours entiers :
// un échantillonnage quotidien à midi laissait passer un trou de cinq
// heures chaque dimanche soir, pendant lequel l'écran d'accueil perdait la
// ligne « les enfants sont avec toi ».

import {
  NOTE_JUGEMENT_WEEKEND,
  NOTE_MODELE_WEEKEND,
  NOTE_MODELE_ALTERNEE,
  NOTES_JUGEMENT,
  NOTES_MODELE,
  gardeDepuisExtraction,
  datesSpecialesDepuisExtraction,
  texteOuRien,
  confianceOuRien,
  planifierGarde,
  lundiDeLaSemaine,
  weekendChezLautreParent,
  construireSemainesAlternees,
  construireSemainesWeekend,
} from './lib/gardeJugement';
import type { EvenementGarde, RegimeGardeConfirme } from './types';

let echecs = 0;
function verifier(nom: string, obtenu: unknown, attendu: unknown) {
  const a = JSON.stringify(obtenu);
  const b = JSON.stringify(attendu);
  if (a !== b) {
    echecs++;
    console.log(`ECHEC  ${nom}\n       obtenu  : ${a}\n       attendu : ${b}`);
  } else {
    console.log(`ok     ${nom}  ${a}`);
  }
}

// =========================================================================
//  Lecture du bloc garde
// =========================================================================

verifier('chaine vide -> rien', texteOuRien('   '), undefined);
verifier('nombre -> chaine', texteOuRien(350), '350');
verifier('null -> rien', texteOuRien(null), undefined);
verifier('confiance connue', confianceOuRien('Haute'), 'haute');
verifier('confiance inconnue', confianceOuRien('high'), undefined);
verifier('confiance numerique', confianceOuRien(0.82), undefined);

const gardeBackend = {
  autorite_parentale: 'Exercée conjointement',
  residence_principale: 'Au domicile de la mère',
  droit_visite_hebergement: {
    description_libre:
      'Les fins de semaine des semaines paires, du vendredi sortie des classes au dimanche 19h',
    transport_a_charge_de: 'le père',
  },
  clauses_voyage: 'Accord écrit des deux parents pour toute sortie du territoire',
  vacances_scolaires: 'Moitié des vacances, première moitié les années paires au père',
  confiance: 'haute',
  texte_source: 'ARTICLE 3 — La résidence des enfants est fixée au domicile de la mère.',
};

const garde = gardeDepuisExtraction(gardeBackend);
verifier('autorite parentale portee', garde?.autoriteParentale, 'Exercée conjointement');
verifier('residence portee', garde?.residencePrincipale, 'Au domicile de la mère');
verifier(
  'DVH aplati en camelCase',
  garde?.droitVisiteHebergementDescription,
  gardeBackend.droit_visite_hebergement.description_libre
);
verifier('transport remonte depuis le sous-objet', garde?.transportAChargeDe, 'le père');
verifier('clauses de voyage portees', garde?.clausesVoyage, gardeBackend.clauses_voyage);
verifier('vacances portees', garde?.vacancesScolaires, gardeBackend.vacances_scolaires);
verifier('confiance portee', garde?.confiance, 'haute');
verifier('citation portee', garde?.texteSource, gardeBackend.texte_source);
verifier('aucune generation a ce stade', garde?.generation, undefined);
verifier('aucun regime confirme a ce stade', garde?.regimeConfirme, undefined);

// LE POINT CENTRAL DE CE BANC.
//
// La clause ci-dessus écrit « les fins de semaine des semaines paires ». Une
// version précédente la lisait et en tirait weekendParite. Deux relectures
// indépendantes ont trouvé huit rédactions réalistes où cette lecture
// s'inverse — « récupérés au domicile de la mère les semaines paires »
// désigne le père, « la mère conservant les semaines paires » désigne la
// mère, et rien dans la forme ne les distingue. Une inversion, ici, ce sont
// douze semaines d'enfants chez le mauvais parent sous l'autorité apparente
// d'un jugement. Dualia affiche donc la clause et demande confirmation.
verifier(
  'AUCUNE parite deduite du texte, meme quand la clause l ecrit noir sur blanc',
  garde?.weekendParite,
  undefined
);
verifier('aucun calendrier tant que le parent n a pas confirme', planifierGarde(garde), {
  action: 'rien',
  motif: 'regime_non_confirme',
});

// Une parité rendue comme DONNÉE structurée par le backend est, elle,
// retenue : ce n'est plus une lecture de prose.
verifier(
  'parite structuree du backend retenue',
  gardeDepuisExtraction({ residence_principale: 'Chez la mère', weekend_parite: 'impaires' })?.weekendParite,
  'impaires'
);
verifier(
  'valeur inattendue ignoree',
  gardeDepuisExtraction({ residence_principale: 'Chez la mère', weekend_parite: 'even' })?.weekendParite,
  undefined
);

const gardeCamel = gardeDepuisExtraction({
  autoriteParentale: 'Conjointe',
  residencePrincipale: 'Alternée, une semaine sur deux',
  droitVisiteHebergement: 'Alternance hebdomadaire',
});
verifier('camelCase lu aussi', gardeCamel?.autoriteParentale, 'Conjointe');
verifier(
  'DVH en chaine simple',
  gardeCamel?.droitVisiteHebergementDescription,
  'Alternance hebdomadaire'
);

verifier('garde absente', gardeDepuisExtraction(null), undefined);
verifier('garde vide', gardeDepuisExtraction({}), undefined);
verifier(
  'garde tout blanc',
  gardeDepuisExtraction({ autorite_parentale: '', residence_principale: '   ' }),
  undefined
);
verifier('aucune garde -> aucun plan', planifierGarde(undefined), {
  action: 'rien',
  motif: 'aucune_garde',
});

// =========================================================================
//  Le plan découle de la réponse du parent, et d'elle seule
// =========================================================================

// parentQuiCommence n'est PAS dans le gabarit : une valeur par défaut ici
// aurait masqué le défaut que ce banc doit précisément attraper. La
// première version en mettait une, et l'écran en mettait une aussi — le
// parent tapait « Résidence alternée », le parent A s'affichait coché en
// vert sans qu'il l'ait choisi, et douze semaines partaient de ce côté-là.
const confirme = (r: Partial<RegimeGardeConfirme>): RegimeGardeConfirme => ({
  residence: 'A',
  confirmeLe: '2026-10-05T10:00:00.000Z',
  ...r,
});

verifier(
  'residence chez B, week-ends paires chez A',
  planifierGarde(garde, confirme({ residence: 'B', parite: 'paires' })),
  { action: 'weekend', parentId: 'B', parite: 'paires' }
);
verifier(
  'residence chez A, week-ends impaires chez B',
  planifierGarde(garde, confirme({ residence: 'A', parite: 'impaires' })),
  { action: 'weekend', parentId: 'A', parite: 'impaires' }
);
verifier(
  'residence confirmee mais parite manquante : on ne genere pas',
  planifierGarde(garde, confirme({ residence: 'B' })),
  { action: 'rien', motif: 'regime_non_confirme' }
);
verifier(
  'residence alternee, B commence',
  planifierGarde(garde, confirme({ residence: 'alternee', parentQuiCommence: 'B' })),
  { action: 'alternee', parentId: 'B' }
);
// Le pendant du cas « parite manquante » ci-dessus, et le plus coûteux des
// deux : en alternance, se tromper de parent n'inverse pas un week-end sur
// deux mais les 84 jours.
verifier(
  'alternee sans savoir qui a les enfants cette semaine : on ne genere pas',
  planifierGarde(garde, confirme({ residence: 'alternee' })),
  { action: 'rien', motif: 'regime_non_confirme' }
);
verifier(
  'residence simple : parentQuiCommence est sans objet et n empeche rien',
  planifierGarde(garde, confirme({ residence: 'B', parite: 'paires' })),
  { action: 'weekend', parentId: 'B', parite: 'paires' }
);
verifier(
  'en alternance, la parite est sans objet et n empeche rien',
  planifierGarde(garde, confirme({ residence: 'alternee', parentQuiCommence: 'A', parite: 'paires' })),
  { action: 'alternee', parentId: 'A' }
);
// La réponse du parent prime sur ce que le backend aurait pu dire : c'est
// le sens même de la confirmation.
verifier(
  'la reponse du parent prime sur la parite du backend',
  planifierGarde({ ...garde, weekendParite: 'paires' }, confirme({ residence: 'B', parite: 'impaires' })),
  { action: 'weekend', parentId: 'B', parite: 'impaires' }
);

// =========================================================================
//  Parité, sur le vrai numéro de semaine ISO
// =========================================================================

// Lundi 5 octobre 2026 = semaine ISO 41 (impaire) ; le 12 = 42 (paire).
const lundi5oct = new Date(2026, 9, 5, 12, 0, 0);
const lundi12oct = new Date(2026, 9, 12, 12, 0, 0);
verifier('S41 impaire, parite paires -> chez le resident', weekendChezLautreParent(lundi5oct, 0, 'paires'), false);
verifier('S42 paire, parite paires -> chez l autre', weekendChezLautreParent(lundi12oct, 1, 'paires'), true);
verifier('S41 impaire, parite impaires -> chez l autre', weekendChezLautreParent(lundi5oct, 0, 'impaires'), true);
verifier('S42 paire, parite impaires -> chez le resident', weekendChezLautreParent(lundi12oct, 1, 'impaires'), false);
// Sans parité — le modèle choisi à la main depuis l'Agenda — l'alternance
// part de la date que le parent a désignée, et pas du numéro de semaine.
verifier('sans parite : index 0 chez le resident', weekendChezLautreParent(lundi12oct, 0, undefined), false);
verifier('sans parite : index 1 chez l autre', weekendChezLautreParent(lundi5oct, 1, undefined), true);
verifier(
  'le meme demarrage donne deux plannings opposes selon la parite',
  weekendChezLautreParent(lundi5oct, 0, 'paires') === weekendChezLautreParent(lundi5oct, 0, 'impaires'),
  false
);
// 2026 compte une semaine 53 : le lundi 28/12/2026 (S53, impaire) et le
// lundi 04/01/2027 (S1, impaire) tombent du même côté, donc deux week-ends
// de suite chez le même parent au Nouvel An. C'est la lecture littérale de
// « semaines impaires », et c'est voulu — écrit ici pour que personne ne le
// « corrige » par mégarde.
verifier('S53 2026 impaire', weekendChezLautreParent(new Date(2026, 11, 28, 12, 0), 0, 'impaires'), true);
verifier('S1 2027 impaire aussi', weekendChezLautreParent(new Date(2027, 0, 4, 12, 0), 1, 'impaires'), true);

// =========================================================================
//  Lundi de la semaine
// =========================================================================

verifier('un mercredi remonte au lundi', lundiDeLaSemaine(new Date(2026, 9, 7, 15, 0)).getDate(), 5);
verifier('un dimanche reste dans sa semaine', lundiDeLaSemaine(new Date(2026, 9, 11, 15, 0)).getDate(), 5);
verifier('un lundi ne bouge pas', lundiDeLaSemaine(new Date(2026, 9, 5, 15, 0)).getDate(), 5);
verifier('minuit', lundiDeLaSemaine(new Date(2026, 9, 7, 15, 30)).getHours(), 0);
// 25 octobre 2026 : retour à l'heure d'hiver en France.
verifier('lundi apres le changement d heure', lundiDeLaSemaine(new Date(2026, 9, 28, 15, 0)).getDate(), 26);
verifier('minuit apres le changement d heure', lundiDeLaSemaine(new Date(2026, 9, 28, 15, 0)).getHours(), 0);
verifier('passage de mois', lundiDeLaSemaine(new Date(2026, 10, 1, 15, 0)).getMonth(), 9);
verifier('passage d annee', lundiDeLaSemaine(new Date(2027, 0, 1, 15, 0)).getFullYear(), 2026);

// =========================================================================
//  Les événements : chez quel parent, chaque heure
// =========================================================================

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** Les blocs qui couvrent un instant. */
function couvrants(evs: EvenementGarde[], instant: Date) {
  const t = instant.getTime();
  return evs.filter((e) => t >= new Date(e.dateDebut).getTime() && t <= new Date(e.dateFin).getTime());
}

function parentA(evs: EvenementGarde[], instant: Date) {
  return couvrants(evs, instant)[0]?.parentId ?? null;
}

/** Parcourt heure par heure les `jours` jours à partir de `depart` et rend
 *  les instants sans parent et ceux qui en ont deux. */
function balayage(evs: EvenementGarde[], depart: Date, jours: number) {
  const trous: string[] = [];
  const doubles: string[] = [];
  for (let h = 0; h < jours * 24; h++) {
    const instant = new Date(depart);
    instant.setHours(instant.getHours() + h);
    const n = couvrants(evs, instant).length;
    const etiquette = `${JOURS[instant.getDay()]} ${instant.getDate()}/${instant.getMonth() + 1} ${instant.getHours()}h`;
    if (n === 0) trous.push(etiquette);
    if (n > 1) doubles.push(etiquette);
  }
  return { trous, doubles };
}

// Jugement : résidence chez le parent B, week-ends du parent A les semaines
// PAIRES. Départ demandé un mercredi : doit se caler sur le lundi 5.
const semainesWE = construireSemainesWeekend(new Date(2026, 9, 7, 11, 0).toISOString(), 'B', 12, 'paires', 1);

verifier('12 semaines, 2 blocs chacune', semainesWE.length, 24);
verifier('demarre le lundi 5', new Date(semainesWE[0].dateDebut).getDate(), 5);
verifier('identifiants uniques', new Set(semainesWE.map((e) => e.id)).size, 24);

// Semaine 41, impaire : le week-end reste chez le parent de résidence B.
verifier('S41 vendredi soir chez B', parentA(semainesWE, new Date(2026, 9, 9, 20, 0)), 'B');
verifier('S41 samedi chez B', parentA(semainesWE, new Date(2026, 9, 10, 12, 0)), 'B');
verifier('S41 dimanche chez B', parentA(semainesWE, new Date(2026, 9, 11, 12, 0)), 'B');
// Semaine 42, paire : le week-end passe chez A.
verifier('S42 jeudi chez B', parentA(semainesWE, new Date(2026, 9, 15, 12, 0)), 'B');
verifier('S42 vendredi matin chez B', parentA(semainesWE, new Date(2026, 9, 16, 8, 0)), 'B');
verifier('S42 vendredi 23h chez B', parentA(semainesWE, new Date(2026, 9, 16, 23, 0)), 'B');
verifier('S42 samedi chez A', parentA(semainesWE, new Date(2026, 9, 17, 12, 0)), 'A');
verifier('S42 dimanche 23h chez A', parentA(semainesWE, new Date(2026, 9, 18, 23, 0)), 'A');
verifier('S42 lundi suivant chez B', parentA(semainesWE, new Date(2026, 9, 19, 0, 30)), 'B');
// Le type de l'événement doit s'accorder au parent : un bloc chez le parent
// non résident est un droit de visite, pas une résidence principale.
verifier(
  'type accorde au parent, sur les 24 blocs',
  semainesWE.filter((e) => (e.parentId === 'B') !== (e.type === 'résidence_principale')).length,
  0
);
verifier(
  'les blocs du parent visiteur sont tous des droits de visite',
  semainesWE.filter((e) => e.parentId === 'A' && e.type !== 'droit_de_visite').length,
  0
);

// Couverture : aucune heure sans parent, aucune heure à deux parents, sur
// les 84 jours entiers. C'est ce balayage qui a révélé qu'une version
// précédente laissait le dimanche de 19h à minuit sans personne.
const balayageWE = balayage(semainesWE, new Date(2026, 9, 5, 0, 0), 84);
verifier('aucune heure sans parent (12 semaines)', balayageWE.trous.slice(0, 5), []);
verifier('aucune heure a deux parents (12 semaines)', balayageWE.doubles.slice(0, 5), []);

// Le même jugement lu « impaires » donne le planning opposé : c'est
// exactement le dégât qu'une inversion de parité produit.
const semainesImpaires = construireSemainesWeekend(
  new Date(2026, 9, 5, 11, 0).toISOString(),
  'B',
  12,
  'impaires',
  2
);
verifier('S41 impaire : samedi chez A', parentA(semainesImpaires, new Date(2026, 9, 10, 12, 0)), 'A');
verifier('S42 paire : samedi chez B', parentA(semainesImpaires, new Date(2026, 9, 17, 12, 0)), 'B');
const balayageImpaires = balayage(semainesImpaires, new Date(2026, 9, 5, 0, 0), 84);
verifier('impaires : aucun trou', balayageImpaires.trous.slice(0, 5), []);
verifier('impaires : aucun chevauchement', balayageImpaires.doubles.slice(0, 5), []);

// Traversée du changement d'heure du 25 octobre 2026.
const balayageHeureHiver = balayage(semainesWE, new Date(2026, 9, 19, 0, 0), 21);
verifier('changement d heure : aucun trou', balayageHeureHiver.trous.slice(0, 5), []);
verifier('changement d heure : aucun chevauchement', balayageHeureHiver.doubles.slice(0, 5), []);
verifier(
  'aucun bloc dont la fin precede le debut',
  semainesWE.filter((e) => new Date(e.dateFin).getTime() <= new Date(e.dateDebut).getTime()).length,
  0
);

// --- Les notes distinguent le jugement du modèle fait à la main ---------
// L'écran de validation compte les événements du jugement pour vérifier
// qu'un calendrier qu'il annonce existe encore. Avec une note commune, un
// modèle composé depuis l'Agenda passait pour le planning du jugement.
verifier('la note du modele manuel n atteste pas le jugement', NOTES_JUGEMENT.includes(NOTE_MODELE_WEEKEND), false);
verifier('celle du jugement, si', NOTES_JUGEMENT.includes(NOTE_JUGEMENT_WEEKEND), true);
verifier('celle de l alternance aussi', NOTES_JUGEMENT.includes(NOTE_MODELE_ALTERNEE), true);
verifier(
  'la purge, elle, efface les trois',
  [NOTE_MODELE_ALTERNEE, NOTE_JUGEMENT_WEEKEND, NOTE_MODELE_WEEKEND].every((n) => NOTES_MODELE.includes(n)),
  true
);
verifier('trois notes distinctes', new Set(NOTES_MODELE).size, 3);
verifier(
  'le planning du jugement porte sa note',
  new Set(
    construireSemainesWeekend(new Date(2026, 9, 5).toISOString(), 'B', 2, 'paires', 9, NOTE_JUGEMENT_WEEKEND).map(
      (e) => e.notes
    )
  ).size,
  1
);
verifier(
  'et c est bien celle du jugement',
  construireSemainesWeekend(new Date(2026, 9, 5).toISOString(), 'B', 2, 'paires', 9, NOTE_JUGEMENT_WEEKEND)[0].notes,
  NOTE_JUGEMENT_WEEKEND
);
verifier(
  'par defaut, celle du modele manuel',
  construireSemainesWeekend(new Date(2026, 9, 5).toISOString(), 'B', 2, 'paires', 9)[0].notes,
  NOTE_MODELE_WEEKEND
);

// --- Résidence alternée -------------------------------------------------
const alternees = construireSemainesAlternees(new Date(2026, 9, 7, 11, 0).toISOString(), 'A', 12, 4);
verifier('12 semaines', alternees.length, 12);
verifier('cale sur le lundi 5', new Date(alternees[0].dateDebut).getDate(), 5);
verifier('semaine 1 chez A', alternees[0].parentId, 'A');
verifier('semaine 2 chez B', alternees[1].parentId, 'B');
verifier('semaine 3 chez A', alternees[2].parentId, 'A');
verifier(
  'type residence alternee partout',
  alternees.filter((e) => e.type !== 'résidence_alternée').length,
  0
);
verifier(
  'six semaines chacun',
  [alternees.filter((e) => e.parentId === 'A').length, alternees.filter((e) => e.parentId === 'B').length],
  [6, 6]
);
const balayageAlt = balayage(alternees, new Date(2026, 9, 5, 0, 0), 84);
verifier('alternance : aucune heure sans parent', balayageAlt.trous.slice(0, 5), []);
verifier('alternance : aucune heure a deux parents', balayageAlt.doubles.slice(0, 5), []);

// =========================================================================
//  Dates spéciales
// =========================================================================

const dates = datesSpecialesDepuisExtraction({
  dates_speciales: [
    { occasion: 'Noël', parent: 'père', texte_source: 'Noël chez le père les années paires' },
    { occasion: 'Fête des mères', parent: 'Madame' },
    { occasion: '', parent: 'père' },
    { occasion: 'Anniversaire', parent: 'A' },
    { occasion: 'Kippour' },
  ],
});
verifier(
  'occasion vide ecartee',
  dates?.map((d) => d.occasion),
  ['Noël', 'Fête des mères', 'Anniversaire', 'Kippour']
);
verifier('genre conserve, pas de role invente', dates?.[0], {
  occasion: 'Noël',
  parentGenre: 'pere',
  texteSource: 'Noël chez le père les années paires',
});
verifier('Madame reconnue comme la mere', dates?.[1]?.parentGenre, 'mere');
verifier('role explicite conserve', dates?.[2]?.parent, 'A');
verifier('role explicite : pas de genre en double', dates?.[2]?.parentGenre, undefined);
verifier('parent inconnu -> ni role ni genre', dates?.[3], { occasion: 'Kippour' });
verifier('liste absente', datesSpecialesDepuisExtraction({}), undefined);

console.log(echecs === 0 ? '\nTOUT PASSE' : `\n${echecs} ECHEC(S)`);
process.exit(echecs === 0 ? 0 : 1);
