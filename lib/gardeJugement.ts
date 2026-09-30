// lib/gardeJugement.ts
//
// Le mode de garde, de l'extraction du jugement jusqu'au calendrier.
//
// Pourquoi ce fichier existe : le mapping était absent. L'écran
// d'extraction affichait le mode de garde complet — autorité parentale,
// résidence principale, droit de visite et d'hébergement, transport — puis
// construireCadreFamilial ne retenait que les règles financières et la
// pension. Tout le volet garde était perdu entre l'écran qui le montrait et
// le cadre familial qui devait s'en servir : `if (cadre.garde)` était
// toujours faux dans le store, aucun calendrier de garde n'était jamais
// généré depuis un jugement, et l'écran de validation n'avait rien à
// montrer.
//
// ---------------------------------------------------------------------------
// Ce que ce fichier ne fait PAS, et pourquoi
// ---------------------------------------------------------------------------
//
// Il ne déduit pas le régime de garde du texte du jugement.
//
// Une première version le faisait : elle cherchait « résidence alternée »,
// « semaines paires », « au domicile de la mère », et en tirait un parent de
// résidence et une parité de week-ends. Deux relectures indépendantes ont
// trouvé, à elles deux, huit façons réalistes de l'inverser — et le défaut
// n'était pas dans le réglage des expressions régulières, il était dans
// l'idée.
//
// La prose d'un jugement nomme les deux parents dans la même phrase, et la
// forme ne dit pas lequel elle désigne :
//
//   « Les enfants seront récupérés au domicile de la mère les fins de
//     semaine des semaines paires »        → désigne le PÈRE
//   « La mère conservera les enfants les fins de semaine des semaines
//     paires »                             → désigne la MÈRE
//   « La demande de résidence alternée présentée par Monsieur est
//     rejetée »                            → n'accorde AUCUNE alternance
//   « du lundi au vendredi chez la mère, le père du samedi au dimanche »
//                                          → le vendredi n'est pas au père
//
// Chaque règle ajoutée pour trancher l'un de ces cas en inversait un autre.
// Et une inversion ici, ce sont douze semaines d'enfants placés chez le
// mauvais parent, présentées avec l'autorité apparente d'un jugement, dans
// un outil montré à des magistrats.
//
// Dualia affiche donc la clause telle qu'elle est écrite, et demande au
// parent de confirmer le régime à côté de la citation. C'est aussi ce qu'un
// avocat attend d'un outil : qu'il lise, qu'il montre, et qu'il ne décide
// pas. Le calendrier n'est généré qu'à partir de cette confirmation —
// jamais d'une lecture.

import type {
  CadreFamilial,
  EvenementGarde,
  NiveauConfiance,
  ParentRole,
  RegimeGardeConfirme,
  VerdictGarde,
} from '../types';
import { getISOWeek } from 'date-fns';

type BlocGarde = NonNullable<CadreFamilial['garde']>;
type DatesSpeciales = NonNullable<CadreFamilial['datesSpeciales']>;

/** Rend une chaîne non vide, ou undefined. Jamais de chaîne vide : un champ
 *  vide traverserait les `if (valeur)` du reste de l'application comme une
 *  valeur légitime, et s'afficherait sous son libellé avec rien à côté. */
export function texteOuRien(valeur: unknown): string | undefined {
  if (typeof valeur === 'string') {
    const propre = valeur.trim();
    return propre.length > 0 ? propre : undefined;
  }
  if (typeof valeur === 'number' && Number.isFinite(valeur)) return String(valeur);
  return undefined;
}

const NIVEAUX_CONFIANCE: NiveauConfiance[] = ['haute', 'moyenne', 'basse'];

/** N'accepte que les trois niveaux connus. Une valeur inattendue
 *  (« high », « 0.82 ») ne doit pas remonter jusqu'à l'affichage, qui
 *  indexe un dictionnaire de libellés et rendrait `undefined`. */
export function confianceOuRien(valeur: unknown): NiveauConfiance | undefined {
  const brut = String(valeur ?? '').trim().toLowerCase();
  return (NIVEAUX_CONFIANCE as string[]).includes(brut) ? (brut as NiveauConfiance) : undefined;
}

/** Premier champ présent parmi plusieurs graphies possibles. Le backend
 *  rend du snake_case, le cadre familial attend du camelCase, et le contrat
 *  d'interface n'est pas figé : lire les deux coûte trois lignes et évite
 *  qu'un renommage côté backend vide silencieusement l'écran. */
function champ(source: any, ...noms: string[]): unknown {
  for (const nom of noms) {
    if (source && source[nom] !== undefined && source[nom] !== null) return source[nom];
  }
  return undefined;
}

/** Traduit le bloc garde de l'extraction. Rend undefined quand le document
 *  ne dit rien d'exploitable, pour que `if (cadre.garde)` en aval reste une
 *  question honnête. */
export function gardeDepuisExtraction(brut: any): BlocGarde | undefined {
  if (!brut || typeof brut !== 'object') return undefined;

  // Le droit de visite et d'hébergement est un objet côté backend
  // ({ description_libre, transport_a_charge_de }), mais rien ne garantit
  // qu'il ne sera pas aplati en chaîne un jour : les deux sont lus.
  const dvhBrut = champ(brut, 'droit_visite_hebergement', 'droitVisiteHebergement');
  const dvhObjet = dvhBrut && typeof dvhBrut === 'object' ? (dvhBrut as any) : null;

  const description = texteOuRien(
    dvhObjet ? champ(dvhObjet, 'description_libre', 'descriptionLibre', 'description') : dvhBrut
  );

  const transport = texteOuRien(
    champ(brut, 'transport_a_charge_de', 'transportAChargeDe') ??
      (dvhObjet ? champ(dvhObjet, 'transport_a_charge_de', 'transportAChargeDe') : undefined)
  );

  const garde: BlocGarde = {
    autoriteParentale: texteOuRien(champ(brut, 'autorite_parentale', 'autoriteParentale')),
    residencePrincipale: texteOuRien(champ(brut, 'residence_principale', 'residencePrincipale')),
    droitVisiteHebergementDescription: description,
    transportAChargeDe: transport,
    clausesVoyage: texteOuRien(champ(brut, 'clauses_voyage', 'clausesVoyage')),
    confiance: confianceOuRien(champ(brut, 'confiance', 'confidence')),
    vacancesScolaires: texteOuRien(
      champ(brut, 'vacances_scolaires', 'vacancesScolaires', 'partage_vacances')
    ),
    texteSource: texteOuRien(champ(brut, 'texte_source', 'texteSource')),
  };

  // Une parité n'est retenue que si le backend la rend comme une donnée
  // structurée. Jamais lue dans la prose : voir l'en-tête du fichier.
  const pariteBackend = String(champ(brut, 'weekend_parite', 'weekendParite') ?? '')
    .trim()
    .toLowerCase();
  if (pariteBackend === 'paires' || pariteBackend === 'impaires') {
    garde.weekendParite = pariteBackend;
  }

  const aQuelqueChose = Object.values(garde).some((v) => v !== undefined);
  return aQuelqueChose ? garde : undefined;
}

const GENRES: Record<string, 'mere' | 'pere'> = {
  mere: 'mere',
  mère: 'mere',
  maman: 'mere',
  madame: 'mere',
  mme: 'mere',
  pere: 'pere',
  père: 'pere',
  papa: 'pere',
  monsieur: 'pere',
  mr: 'pere',
  m: 'pere',
};

/** Traduit les dates spéciales de l'extraction. Le parent reste sous forme
 *  de genre : la correspondance avec A/B dépend de genreParental, que ce
 *  fichier ne connaît pas et ne doit pas supposer. */
export function datesSpecialesDepuisExtraction(brut: any): DatesSpeciales | undefined {
  const liste = champ(brut, 'dates_speciales', 'datesSpeciales');
  if (!Array.isArray(liste) || liste.length === 0) return undefined;

  const dates: DatesSpeciales = [];
  for (const entree of liste) {
    if (!entree || typeof entree !== 'object') continue;
    const occasion = texteOuRien(champ(entree, 'occasion', 'nom', 'libelle'));
    if (!occasion) continue;

    const parentBrut = String(champ(entree, 'parent', 'chez', 'parent_designe') ?? '')
      .trim()
      .toLowerCase();

    const role =
      parentBrut === 'a' || parentBrut === 'b'
        ? (parentBrut.toUpperCase() as 'A' | 'B')
        : undefined;

    dates.push({
      occasion,
      parent: role,
      parentGenre: role ? undefined : GENRES[parentBrut],
      texteSource: texteOuRien(champ(entree, 'texte_source', 'texteSource')),
    });
  }

  return dates.length > 0 ? dates : undefined;
}

// ---------------------------------------------------------------------------
// Décision de génération
//
// Une seule fonction, pure, partagée par l'écran de validation et par le
// store. Elle ne lit aucun texte : elle applique le régime que le parent a
// confirmé. Deux implémentations divergentes — une dans le store, une dans
// l'écran — faisaient annoncer à l'écran un régime que le store ne générait
// pas.
// ---------------------------------------------------------------------------

export type PlanGarde =
  | { action: 'alternee'; parentId: ParentRole }
  | { action: 'weekend'; parentId: ParentRole; parite: 'paires' | 'impaires' }
  | { action: 'rien'; motif: NonNullable<VerdictGarde['motif']> };

export function planifierGarde(
  garde: CadreFamilial['garde'],
  regime?: RegimeGardeConfirme
): PlanGarde {
  if (!garde) return { action: 'rien', motif: 'aucune_garde' };
  if (!regime) return { action: 'rien', motif: 'regime_non_confirme' };

  if (regime.residence === 'alternee') {
    // Sans réponse à « chez qui les enfants se trouvent-ils cette
    // semaine ? », on ne génère rien. Une valeur par défaut avait été
    // laissée à 'A' : le parent tapait « Résidence alternée », la question
    // suivante s'affichait déjà avec le parent A coché en vert comme s'il
    // l'avait choisi, et douze semaines partaient de ce côté-là. Quand les
    // enfants étaient chez l'autre, les 84 jours étaient inversés.
    if (!regime.parentQuiCommence) return { action: 'rien', motif: 'regime_non_confirme' };
    return { action: 'alternee', parentId: regime.parentQuiCommence };
  }
  if (!regime.parite) return { action: 'rien', motif: 'regime_non_confirme' };
  return { action: 'weekend', parentId: regime.residence, parite: regime.parite };
}

/** Lundi de la semaine de la date donnée, à minuit local. Un planning issu
 *  d'un jugement démarre sur une semaine entière : commencer un mercredi
 *  produisait des blocs de garde à cheval sur deux semaines. */
export function lundiDeLaSemaine(reference: Date): Date {
  const d = new Date(reference);
  const jour = d.getDay();
  d.setDate(d.getDate() + (jour === 0 ? -6 : 1 - jour));
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Ce week-end-là est-il chez le parent non résident ?
 *
 *  « Les fins de semaine des semaines paires » désigne le numéro de semaine
 *  du calendrier, pas la deuxième semaine à compter du jour où le parent a
 *  cliqué. Le calcul précédent (index % 2) produisait donc, une fois sur
 *  deux, douze semaines de planning décalées d'une semaine : chaque
 *  week-end chez le mauvais parent.
 *
 *  Sans parité — le modèle choisi à la main depuis l'Agenda — l'alternance
 *  part de la date que le parent a lui-même désignée, ce qui est exactement
 *  ce qu'il a demandé. */
export function weekendChezLautreParent(
  lundi: Date,
  indexSemaine: number,
  parite?: 'paires' | 'impaires'
): boolean {
  if (parite === undefined) return indexSemaine % 2 === 1;
  return getISOWeek(lundi) % 2 === (parite === 'paires' ? 0 : 1);
}

// ---------------------------------------------------------------------------
// Construction des événements de garde
//
// Ces deux fonctions décident, jour par jour, chez quel parent l'enfant se
// trouve. C'est le code le plus dangereux de l'application : un décalage
// d'une semaine ou une inversion de parent produit douze semaines de
// planning faux. Elles sont donc pures, éprouvées jour par jour et heure
// par heure par test-garde.ts, et le store ne fait que les appeler et
// enregistrer leur résultat.
//
// Elles posent des JOURNÉES ENTIÈRES : semaine chez le parent de résidence,
// week-end du samedi au dimanche. Une version précédente lisait dans la
// clause « du vendredi sortie des classes au dimanche 19h » pour poser des
// blocs à l'heure ; elle inventait une heure de départ le vendredi quand le
// jugement n'en donnait pas, déplaçait une journée d'école entière d'un
// parent à l'autre sur la présence du mot « vendredi » n'importe où dans la
// clause, et laissait le dimanche soir sans parent — l'écran d'accueil
// perdait alors la ligne « les enfants sont avec toi ». Les horaires exacts
// s'ajustent dans l'Agenda, et l'écran de validation le dit.
// ---------------------------------------------------------------------------

// Trois notes, et non deux. « Généré depuis le modèle de garde » servait
// à la fois au planning issu du jugement et à celui que le parent compose
// à la main depuis l'Agenda. L'écran de validation comptait donc les
// seconds comme preuve que les premiers existaient : on remplaçait le
// planning du jugement par un modèle manuel, et l'écran continuait
// d'affirmer « 12 semaines générées : en semaine chez B, week-ends des
// semaines paires chez A » à propos d'un calendrier qui n'existait plus.
export const NOTE_MODELE_ALTERNEE = 'Généré depuis le cadre familial (jugement importé)';
export const NOTE_JUGEMENT_WEEKEND = 'Généré depuis le cadre familial (week-ends du jugement)';
export const NOTE_MODELE_WEEKEND = 'Généré depuis le modèle de garde';

/** Toutes les notes de planning généré : ce que la purge efface. */
export const NOTES_MODELE = [NOTE_MODELE_ALTERNEE, NOTE_JUGEMENT_WEEKEND, NOTE_MODELE_WEEKEND];

/** Les seules notes qui attestent d'un planning issu du jugement : ce que
 *  l'écran de validation compte avant d'affirmer qu'il existe. */
export const NOTES_JUGEMENT = [NOTE_MODELE_ALTERNEE, NOTE_JUGEMENT_WEEKEND];

/** Décalage en jours depuis un lundi de référence, à minuit ou en fin de
 *  journée. Jamais de numéro de jour ISO utilisé comme décalage : une
 *  version précédente confondait les deux et tout le planning était décalé
 *  d'un jour, les blocs se chevauchaient, et le vendredi revenait au parent
 *  de résidence alors que le jugement le donnait à l'autre. */
function aJours(lundi: Date, jours: number, finDeJournee = false): Date {
  const d = new Date(lundi);
  d.setDate(d.getDate() + jours);
  if (finDeJournee) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

export function construireSemainesAlternees(
  debutIso: string,
  parentQuiCommence: ParentRole,
  nombreSemaines: number,
  horodatage = Date.now()
): EvenementGarde[] {
  const base = lundiDeLaSemaine(new Date(debutIso));
  const autre: ParentRole = parentQuiCommence === 'A' ? 'B' : 'A';
  const evenements: EvenementGarde[] = [];

  for (let semaine = 0; semaine < nombreSemaines; semaine++) {
    evenements.push({
      id: `garde-cadre-${horodatage}-${semaine}`,
      dateDebut: aJours(base, semaine * 7).toISOString(),
      dateFin: aJours(base, semaine * 7 + 6, true).toISOString(),
      parentId: semaine % 2 === 0 ? parentQuiCommence : autre,
      type: 'résidence_alternée',
      notes: NOTE_MODELE_ALTERNEE,
    });
  }
  return evenements;
}

export function construireSemainesWeekend(
  debutIso: string,
  parentResident: ParentRole,
  nombreSemaines: number,
  parite?: 'paires' | 'impaires',
  horodatage = Date.now(),
  note: string = NOTE_MODELE_WEEKEND
): EvenementGarde[] {
  const base = lundiDeLaSemaine(new Date(debutIso));
  const autre: ParentRole = parentResident === 'A' ? 'B' : 'A';
  const evenements: EvenementGarde[] = [];

  for (let semaine = 0; semaine < nombreSemaines; semaine++) {
    const decalage = semaine * 7;
    const chezAutre = weekendChezLautreParent(aJours(base, decalage), semaine, parite);

    // Lundi 00:00 → vendredi 23:59:59.999 chez le parent de résidence.
    evenements.push({
      id: `garde-sem-${horodatage}-${semaine}`,
      dateDebut: aJours(base, decalage).toISOString(),
      dateFin: aJours(base, decalage + 4, true).toISOString(),
      parentId: parentResident,
      type: 'résidence_principale',
      notes: note,
    });

    // Samedi 00:00 → dimanche 23:59:59.999. Les deux blocs se touchent sans
    // se chevaucher : aucun instant de la semaine n'appartient à deux
    // parents, et aucun n'appartient à personne.
    evenements.push({
      id: `garde-we-${horodatage}-${semaine}`,
      dateDebut: aJours(base, decalage + 5).toISOString(),
      dateFin: aJours(base, decalage + 6, true).toISOString(),
      parentId: chezAutre ? autre : parentResident,
      type: chezAutre ? 'droit_de_visite' : 'résidence_principale',
      notes: note,
    });
  }
  return evenements;
}
