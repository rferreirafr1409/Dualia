// lib/inactivite.ts
//
// Deconnexion automatique apres une periode sans activite.
//
// LE CAS REEL : l'ordinateur familial. Un parent consulte Dualia, ferme
// l'onglet ou laisse la page ouverte, et s'en va. La personne suivante
// s'installe — le nouveau conjoint, un adolescent, l'autre parent venu
// chercher les enfants — et se retrouve dans l'espace familial de quelqu'un
// d'autre : messages, depenses, adresses, documents de justice. Aucun mot de
// passe n'est redemande, puisque la session est encore valide.
//
// POURQUOI COMPARER DES HORODATAGES, ET NON COMPTER DES TICS : setInterval
// n'est pas fiable pour mesurer une duree. Un navigateur ralentit fortement
// les minuteurs d'un onglet en arriere-plan, et les suspend tout a fait quand
// la machine se met en veille. Un compteur qui s'incremente a chaque tic
// sous-estimerait donc massivement le temps ecoule : portable referme pendant
// trois heures, rouvert, et la session serait toujours ouverte.
//
// On ne retient donc qu'une chose — l'instant de la derniere activite — et on
// relit l'horloge a chaque verification. Le retour de veille est correct sans
// traitement particulier.

/** Delai total sans activite avant la deconnexion. */
export const DELAI_INACTIVITE_MS = 20 * 60 * 1000;

/** Duree de l'avertissement qui precede la deconnexion. */
export const DELAI_AVERTISSEMENT_MS = 60 * 1000;

/** Rythme de verification. Fin devant l'avertissement, pour que le compte a rebours soit fluide. */
export const PERIODE_VERIFICATION_MS = 5 * 1000;

export type EtatInactivite =
  | { phase: 'actif' }
  | { phase: 'avertissement'; secondesRestantes: number }
  | { phase: 'expire' };

/**
 * Ou en sommes-nous, connaissant la derniere activite et l'heure courante ?
 *
 * Fonction pure : c'est elle qui porte toute la regle, et c'est elle qu'on
 * peut eprouver sans navigateur ni horloge truquee.
 */
export function etatInactivite(
  derniereActivite: number,
  maintenant: number,
  delai: number = DELAI_INACTIVITE_MS,
  avertissement: number = DELAI_AVERTISSEMENT_MS
): EtatInactivite {
  // Une horloge qui recule (reglage systeme, changement d'heure, valeur
  // aberrante) ne doit pas deconnecter quelqu'un qui vient d'agir.
  const ecoule = Math.max(0, maintenant - derniereActivite);

  if (ecoule >= delai) return { phase: 'expire' };

  const restant = delai - ecoule;
  if (restant <= avertissement) {
    // Arrondi au superieur : afficher « 0 seconde » pendant une seconde
    // entiere avant que quoi que ce soit se passe donnerait l'impression
    // d'une application figee.
    return { phase: 'avertissement', secondesRestantes: Math.ceil(restant / 1000) };
  }

  return { phase: 'actif' };
}

/**
 * Les evenements qui valent « je suis la », et RIEN D'AUTRE.
 *
 * Volontairement larges du cote des gestes : bouger la souris suffit. Le but
 * n'est pas de mesurer un travail effectif mais de distinguer une personne
 * presente d'un poste abandonne.
 *
 * ATTENTION — ce qui NE doit pas figurer ici : `visibilitychange` et `focus`.
 * Revenir sur un onglet n'est pas une preuve de presence pendant l'absence.
 * Les traiter comme une activite remettrait le compteur a zero au retour,
 * c'est-a-dire precisement dans le cas que ce garde-fou vise : la personne
 * part, quelqu'un d'autre s'installe et rouvre l'onglet. Ces deux evenements
 * doivent au contraire declencher une VERIFICATION immediate, et ils sont
 * cables separement (voir EVENEMENTS_VERIFICATION).
 */
export const EVENEMENTS_ACTIVITE = [
  'mousedown',
  'keydown',
  'touchstart',
  'wheel',
  'scroll',
] as const;

// `mousemove` a ete retire volontairement. Un pixel de tremblement d'une
// souris optique, une souris Bluetooth qui se reveille, un chat sur le
// bureau : chacun achetait vingt minutes de plus a un poste vide. Pire, les
// navigateurs emettent des deplacements de souris synthetiques apres certains
// changements de mise en page — et l'apparition de la fenetre d'avertissement
// en est un. Le garde-fou aurait pu s'annuler lui-meme, en boucle, devant une
// chaise vide. On exige donc un geste franc : clic, touche, molette, contact.

/**
 * Evenements qui doivent provoquer une verification tout de suite.
 *
 * Un navigateur ralentit fortement les minuteurs d'un onglet en arriere-plan
 * et les suspend en veille : au retour, il ne faut pas attendre le prochain
 * tic pour constater que le delai est depasse.
 *
 * `visibilitychange` est emis sur `document`, pas sur `window`.
 */
export const EVENEMENTS_VERIFICATION = ['visibilitychange', 'focus'] as const;

// ---------------------------------------------------------------------------
// Persistance de la derniere activite
// ---------------------------------------------------------------------------
//
// SANS CECI, TOUT LE RESTE EST DECORATIF. Un compteur garde en memoire vive
// repart a zero a chaque montage de la page. Or le scenario meme que ce
// garde-fou vise — la personne suivante s'installe — passe presque toujours
// par un rechargement : onglet rouvert, favori clique, navigateur relance,
// onglet recycle par le navigateur faute de memoire. Dans tous ces cas la
// session Supabase est toujours valide dans le stockage local, et un compteur
// neuf offrait vingt minutes de plus a quelqu'un qui n'aurait jamais du
// entrer.
//
// L'horodatage vit donc dans le stockage local, a cote de la session qu'il
// protege. Effet secondaire utile : deux onglets ouverts partagent la meme
// valeur, donc l'activite dans l'un repousse l'echeance de l'autre, et un
// onglet oublie en arriere-plan ne deconnecte plus un onglet en cours
// d'utilisation.

const CLE_ACTIVITE = 'dualia-derniere-activite';

/** Intervalle minimal entre deux ecritures, pour ne pas solliciter le stockage a chaque geste. */
const PAS_ECRITURE_MS = 5 * 1000;

let derniereEcriture = 0;

function stockage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    // Stockage refuse (navigation privee verrouillee, cookies tiers bloques).
    return null;
  }
}

/** Rend l'horodatage conserve, ou null si rien n'est lisible. */
export function lireDerniereActivite(): number | null {
  const s = stockage();
  if (!s) return null;
  try {
    const brut = s.getItem(CLE_ACTIVITE);
    if (!brut) return null;
    const valeur = Number(brut);
    return Number.isFinite(valeur) && valeur > 0 ? valeur : null;
  } catch {
    return null;
  }
}

/** Conserve l'horodatage. `force` contourne le pas d'ecriture. */
export function ecrireDerniereActivite(instant: number, force = false): void {
  if (!force && instant - derniereEcriture < PAS_ECRITURE_MS) return;
  derniereEcriture = instant;
  const s = stockage();
  if (!s) return;
  try {
    s.setItem(CLE_ACTIVITE, String(instant));
  } catch {
    // Quota plein ou stockage en lecture seule : on continue en memoire.
  }
}

/** Efface l'horodatage. Appele a la deconnexion, pour repartir propre. */
export function oublierDerniereActivite(): void {
  derniereEcriture = 0;
  const s = stockage();
  if (!s) return;
  try {
    s.removeItem(CLE_ACTIVITE);
  } catch {
    // sans consequence
  }
}

/** Marqueur lu par l'ecran de connexion pour expliquer la deconnexion. */
export const CLE_MOTIF_DECONNEXION = 'dualia-deconnexion-inactivite';

export function signalerDeconnexionInactivite(): void {
  const s = stockage();
  if (!s) return;
  try {
    s.setItem(CLE_MOTIF_DECONNEXION, '1');
  } catch {
    // sans consequence : le message est un confort, pas une condition
  }
}

/** Rend vrai une seule fois, puis oublie. */
export function consommerMotifInactivite(): boolean {
  const s = stockage();
  if (!s) return false;
  try {
    const present = s.getItem(CLE_MOTIF_DECONNEXION) === '1';
    if (present) s.removeItem(CLE_MOTIF_DECONNEXION);
    return present;
  } catch {
    return false;
  }
}
