// lib/zoneScolaire.ts
//
// Du code postal d'un foyer vers l'ACADÉMIE dont il relève.
//
// Ce fichier s'arrête là, volontairement. Il ne dit PAS dans quelle zone
// (A, B ou C) se trouve cette académie, et c'est le point important :
//
//   le découpage des zones change — il a changé en 2016, et une académie
//   peut en changer d'une année sur l'autre. Une table zone écrite de
//   mémoire dans Dualia serait fausse un jour, et fausse en silence : des
//   vacances affichées aux mauvaises dates sur le calendrier d'un parent,
//   sans que rien ne signale l'erreur.
//
//   La zone est donc LUE dans le jeu de données officiel de l'Éducation
//   nationale, par api/vacances-scolaires.js, à qui l'on passe le nom de
//   l'académie. Ce que rend ce fichier est une PROPOSITION, que le parent
//   confirme — le même principe que l'indice INSEE initial et que le régime
//   de garde : Dualia propose, le parent valide, la base garde la trace.
//
// Le découpage administratif des départements entre académies, lui, est
// stable et public. C'est tout ce qui est écrit ici.

/** Académie telle que le jeu de données officiel l'orthographie dans son
 *  champ `location`. Les accents comptent : « Besançon », pas « Besancon ». */
export type Academie = string;

const ACADEMIE_PAR_DEPARTEMENT: Record<string, Academie> = {
  // Aix-Marseille
  '04': 'Aix-Marseille', '05': 'Aix-Marseille', '13': 'Aix-Marseille', '84': 'Aix-Marseille',
  // Amiens
  '02': 'Amiens', '60': 'Amiens', '80': 'Amiens',
  // Besançon
  '25': 'Besançon', '39': 'Besançon', '70': 'Besançon', '90': 'Besançon',
  // Bordeaux
  '24': 'Bordeaux', '33': 'Bordeaux', '40': 'Bordeaux', '47': 'Bordeaux', '64': 'Bordeaux',
  // Clermont-Ferrand
  '03': 'Clermont-Ferrand', '15': 'Clermont-Ferrand', '43': 'Clermont-Ferrand', '63': 'Clermont-Ferrand',
  // Corse — les deux départements relèvent de la même académie, ce qui évite
  // d'avoir à trancher 2A/2B à partir du code postal (20xxx).
  '2A': 'Corse', '2B': 'Corse', '20': 'Corse',
  // Créteil
  '77': 'Créteil', '93': 'Créteil', '94': 'Créteil',
  // Dijon
  '21': 'Dijon', '58': 'Dijon', '71': 'Dijon', '89': 'Dijon',
  // Grenoble
  '07': 'Grenoble', '26': 'Grenoble', '38': 'Grenoble', '73': 'Grenoble', '74': 'Grenoble',
  // Lille
  '59': 'Lille', '62': 'Lille',
  // Limoges
  '19': 'Limoges', '23': 'Limoges', '87': 'Limoges',
  // Lyon
  '01': 'Lyon', '42': 'Lyon', '69': 'Lyon',
  // Montpellier
  '11': 'Montpellier', '30': 'Montpellier', '34': 'Montpellier', '48': 'Montpellier', '66': 'Montpellier',
  // Nancy-Metz
  '54': 'Nancy-Metz', '55': 'Nancy-Metz', '57': 'Nancy-Metz', '88': 'Nancy-Metz',
  // Nantes
  '44': 'Nantes', '49': 'Nantes', '53': 'Nantes', '72': 'Nantes', '85': 'Nantes',
  // Nice
  '06': 'Nice', '83': 'Nice',
  // Normandie (fusion de Caen et Rouen, 2020)
  '14': 'Normandie', '27': 'Normandie', '50': 'Normandie', '61': 'Normandie', '76': 'Normandie',
  // Orléans-Tours
  '18': 'Orléans-Tours', '28': 'Orléans-Tours', '36': 'Orléans-Tours',
  '37': 'Orléans-Tours', '41': 'Orléans-Tours', '45': 'Orléans-Tours',
  // Paris
  '75': 'Paris',
  // Poitiers
  '16': 'Poitiers', '17': 'Poitiers', '79': 'Poitiers', '86': 'Poitiers',
  // Reims
  '08': 'Reims', '10': 'Reims', '51': 'Reims', '52': 'Reims',
  // Rennes
  '22': 'Rennes', '29': 'Rennes', '35': 'Rennes', '56': 'Rennes',
  // Strasbourg
  '67': 'Strasbourg', '68': 'Strasbourg',
  // Toulouse
  '09': 'Toulouse', '12': 'Toulouse', '31': 'Toulouse', '32': 'Toulouse',
  '46': 'Toulouse', '65': 'Toulouse', '81': 'Toulouse', '82': 'Toulouse',
  // Versailles
  '78': 'Versailles', '91': 'Versailles', '92': 'Versailles', '95': 'Versailles',
  // Outre-mer — calendriers propres, sans rapport avec les zones A/B/C de
  // métropole. L'endpoint rendra ce que les données officielles portent pour
  // ces académies, y compris rien.
  '971': 'Guadeloupe',
  '972': 'Martinique',
  '973': 'Guyane',
  '974': 'La Réunion',
  '976': 'Mayotte',
};

/** Département déduit d'un code postal français.
 *
 *  Règle : les deux premiers chiffres, sauf l'outre-mer (97x, 98x) qui en
 *  prend trois. La Corse (20xxx) rend '20', qui suffit puisque les deux
 *  départements corses relèvent d'une seule académie.
 *
 *  Rend null si la chaîne n'a pas la forme d'un code postal français : un
 *  code étranger, une saisie partielle, un champ vide. Ricardo vit à
 *  Lisbonne, et un foyer portugais ne doit pas se voir attribuer une
 *  académie française au prétexte que la chaîne commence par deux chiffres. */
export function departementDepuisCodePostal(codePostal?: string | null): string | null {
  const propre = String(codePostal ?? '').replace(/\s/g, '');
  if (!/^\d{5}$/.test(propre)) return null;
  if (propre.startsWith('97') || propre.startsWith('98')) return propre.slice(0, 3);
  return propre.slice(0, 2);
}

/** Académie proposée pour un code postal. null si inconnue. */
export function academieDepuisCodePostal(codePostal?: string | null): Academie | null {
  const departement = departementDepuisCodePostal(codePostal);
  if (!departement) return null;
  return ACADEMIE_PAR_DEPARTEMENT[departement] ?? null;
}

/** Ce que l'écran a besoin de savoir pour parler au parent sans mentir. */
export type PropositionAcademie =
  | { statut: 'proposee'; academie: Academie; codePostal: string; foyerNom: string }
  | { statut: 'aucun_foyer' }
  | { statut: 'code_postal_absent'; foyerNom: string }
  | { statut: 'hors_france'; codePostal: string; foyerNom: string };

type FoyerMinimal = {
  nom: string;
  codePostal?: string;
  actif?: boolean;
  estPlaceholder?: boolean;
  enfantIdsResidencePrincipale?: string[];
};

/** Choisit le foyer qui porte le calendrier scolaire des enfants.
 *
 *  Les vacances suivent l'ÉCOLE, pas le parent. Après une séparation les deux
 *  parents peuvent vivre dans deux zones différentes — un père à Créteil
 *  (zone C) et une mère à Bordeaux (zone A) n'ont pas les mêmes dates, mais
 *  leurs enfants n'ont qu'un seul calendrier. On privilégie donc le foyer
 *  désigné comme résidence principale ; à défaut, le premier foyer actif, et
 *  l'écran dit lequel a été retenu pour que le parent puisse corriger. */
export function proposerAcademie(foyers: FoyerMinimal[]): PropositionAcademie {
  const utilisables = (foyers ?? []).filter((f) => f.actif !== false && !f.estPlaceholder);
  if (utilisables.length === 0) return { statut: 'aucun_foyer' };

  const avecResidence = utilisables.filter(
    (f) => (f.enfantIdsResidencePrincipale?.length ?? 0) > 0
  );
  const retenu = avecResidence[0] ?? utilisables[0];

  const codePostal = String(retenu.codePostal ?? '').replace(/\s/g, '');
  if (!codePostal) return { statut: 'code_postal_absent', foyerNom: retenu.nom };

  const academie = academieDepuisCodePostal(codePostal);
  if (!academie) return { statut: 'hors_france', codePostal, foyerNom: retenu.nom };

  return { statut: 'proposee', academie, codePostal, foyerNom: retenu.nom };
}
