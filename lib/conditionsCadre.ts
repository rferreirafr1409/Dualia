// lib/conditionsCadre.ts
//
// Les conditions attachees a une regle du cadre familial : plafond, accord
// prealable, justificatif obligatoire, deduction du remboursement de la
// mutuelle.
//
// Ces quatre conditions sont extraites du jugement, enregistrees en base... et
// n'etaient lues par personne : ni montrees au parent qui valide le cadre, ni
// appliquees au calcul. Le parent validait une repartition sans voir les
// conditions qui l'accompagnent.
//
// ETAT REEL DU LECTEUR DE JUGEMENT, a lire avant de raisonner sur ce fichier :
// construireCadreFamilial (components/JugementUpload.tsx) ne cree aujourd'hui
// qu'UNE regle, 'activitesExtra', et ne renseigne qu'UNE condition,
// accordPrealable. Aucune regle 'fraisMedicaux' ni 'fraisScolaires' n'est
// produite, et ni le plafond, ni le justificatif obligatoire, ni la deduction
// du remboursement ne sont jamais poses. Le plafond, le justificatif et le
// remboursement sont donc, a ce jour, du code qui ne s'execute pas : il est
// juste et teste, mais il attend que le lecteur de jugement sache extraire ces
// clauses. Ne pas confondre « implemente » et « atteignable ».
//
// Deux regles de conduite, et elles ne sont pas negociables :
//
//  1. Une condition n'est JAMAIS cachee. Partout ou une regle est montree —
//     ecran de validation, formulaire de depense, detail d'une depense — ses
//     conditions sont montrees avec elle. Valider une regle dont on ne voit pas
//     les conditions, ce n'est pas valider.
//
//  2. Dualia ne tranche que ce qui est arithmetique. Deduire un remboursement
//     est un calcul : Dualia le fait, en montrant sa base. Un plafond, un
//     accord prealable, un justificatif exige sont des questions de droit et de
//     fait — « 400 € » par an, par enfant, par depense ? l'accord a-t-il ete
//     donne ? Dualia previent le parent et le laisse decider. Un logiciel qui
//     arbitrerait ca a la place des parents, avec l'autorite d'un chiffre
//     affiche, serait plus dangereux qu'utile.

import { centimes } from './comptes';

export type ConditionsRegle = {
  accordPrealable?: boolean;
  plafondMontant?: number;
  justificatifObligatoire?: boolean;
  remboursementAssuranceDeduit?: boolean;
};

export type LangueDualia = 'fr' | 'pt' | 'es' | 'en';

type Libelles = {
  titre: string;
  plafond: (montant: string) => string;
  accordPrealable: string;
  justificatifObligatoire: string;
  remboursementDeduit: string;
  /** Avertissements au moment d'enregistrer une depense. */
  plafondDepasse: (plafond: string) => string;
  accordQuestion: string;
  accordOui: string;
  accordNon: string;
  accordNonNote: string;
  justificatifManquant: string;
  /** Champ de saisie du remboursement. */
  remboursementLabel: string;
  remboursementAide: string;
  basePartagee: (base: string) => string;
  baseLabel: string;
  remboursementIllisible: string;
  remboursementSuperieur: string;
  accordSansReponse: string;
  partDe: (prenom: string) => string;
  montantPaye: string;
  rembourse: string;
};

const LIBELLES: Record<LangueDualia, Libelles> = {
  fr: {
    titre: 'Conditions du jugement',
    plafond: (m) => `Plafond : ${m}`,
    accordPrealable: "Accord préalable de l'autre parent requis",
    justificatifObligatoire: 'Justificatif obligatoire',
    remboursementDeduit: 'Part calculée après déduction du remboursement',
    plafondDepasse: (p) =>
      `Le jugement mentionne un plafond de ${p} pour cette catégorie. Dualia ne sait pas s'il s'applique par dépense, par an ou par enfant : à vous de décider de la répartition.`,
    accordQuestion: "Le jugement demande l'accord préalable de l'autre parent pour cette catégorie.",
    accordOui: "J'ai son accord",
    accordNon: 'Pas encore',
    accordNonNote: "Enregistré sans accord préalable — l'autre parent le verra.",
    justificatifManquant:
      'Le jugement demande un justificatif pour cette catégorie. Vous pouvez en joindre un maintenant.',
    remboursementLabel: 'Remboursé (mutuelle, Sécu)',
    remboursementAide: 'Laissez vide si vous ne savez pas encore : vous pourrez le renseigner plus tard.',
    basePartagee: (b) => `Base partagée : ${b}`,
    baseLabel: 'Base partagée',
    remboursementIllisible: 'Remboursement illisible. Écrivez-le avec deux décimales, par exemple 200,00.',
    remboursementSuperieur: 'Le remboursement ne peut pas dépasser le montant payé.',
    accordSansReponse: "Indiquez si vous avez l'accord préalable de l'autre parent avant d'enregistrer.",
    partDe: (p) => `Part de ${p}`,
    montantPaye: 'Payé',
    rembourse: 'Remboursé',
    },
  pt: {
    titre: 'Condições da decisão',
    plafond: (m) => `Limite: ${m}`,
    accordPrealable: 'Acordo prévio do outro progenitor necessário',
    justificatifObligatoire: 'Comprovativo obrigatório',
    remboursementDeduit: 'Parte calculada após dedução do reembolso',
    plafondDepasse: (p) =>
      `A decisão menciona um limite de ${p} para esta categoria. A Dualia não sabe se se aplica por despesa, por ano ou por criança: a divisão é a sua decisão.`,
    accordQuestion: 'A decisão exige o acordo prévio do outro progenitor para esta categoria.',
    accordOui: 'Tenho o acordo dele',
    accordNon: 'Ainda não',
    accordNonNote: 'Guardado sem acordo prévio — o outro progenitor irá vê-lo.',
    justificatifManquant:
      'A decisão exige um comprovativo para esta categoria. Pode anexar um agora.',
    remboursementLabel: 'Reembolsado (seguro, saúde)',
    remboursementAide: 'Deixe vazio se ainda não souber: pode preencher mais tarde.',
    basePartagee: (b) => `Base dividida: ${b}`,
    baseLabel: 'Base dividida',
    remboursementIllisible: 'Reembolso ilegível. Escreva-o com duas decimais, por exemplo 200,00.',
    remboursementSuperieur: 'O reembolso não pode exceder o montante pago.',
    accordSansReponse: 'Indique se tem o acordo prévio do outro progenitor antes de guardar.',
    partDe: (p) => `Parte de ${p}`,
    montantPaye: 'Pago',
    rembourse: 'Reembolsado',
    },
  es: {
    titre: 'Condiciones de la sentencia',
    plafond: (m) => `Límite: ${m}`,
    accordPrealable: 'Se requiere el acuerdo previo del otro progenitor',
    justificatifObligatoire: 'Justificante obligatorio',
    remboursementDeduit: 'Parte calculada tras deducir el reembolso',
    plafondDepasse: (p) =>
      `La sentencia menciona un límite de ${p} para esta categoría. Dualia no sabe si se aplica por gasto, por año o por hijo: el reparto lo decides tú.`,
    accordQuestion: 'La sentencia exige el acuerdo previo del otro progenitor para esta categoría.',
    accordOui: 'Tengo su acuerdo',
    accordNon: 'Todavía no',
    accordNonNote: 'Guardado sin acuerdo previo — el otro progenitor lo verá.',
    justificatifManquant:
      'La sentencia exige un justificante para esta categoría. Puedes adjuntar uno ahora.',
    remboursementLabel: 'Reembolsado (mutua, seguridad social)',
    remboursementAide: 'Déjalo vacío si aún no lo sabes: podrás indicarlo más tarde.',
    basePartagee: (b) => `Base repartida: ${b}`,
    baseLabel: 'Base repartida',
    remboursementIllisible: 'Reembolso ilegible. Escríbelo con dos decimales, por ejemplo 200,00.',
    remboursementSuperieur: 'El reembolso no puede superar el importe pagado.',
    accordSansReponse: 'Indica si tienes el acuerdo previo del otro progenitor antes de guardar.',
    partDe: (p) => `Parte de ${p}`,
    montantPaye: 'Pagado',
    rembourse: 'Reembolsado',
    },
  en: {
    titre: 'Conditions in the judgment',
    plafond: (m) => `Cap: ${m}`,
    accordPrealable: "The other parent's prior agreement is required",
    justificatifObligatoire: 'Receipt required',
    remboursementDeduit: 'Share calculated after the reimbursement is deducted',
    plafondDepasse: (p) =>
      `The judgment mentions a cap of ${p} for this category. Dualia cannot tell whether it applies per expense, per year or per child: the split is your decision.`,
    accordQuestion: "The judgment requires the other parent's prior agreement for this category.",
    accordOui: 'I have their agreement',
    accordNon: 'Not yet',
    accordNonNote: 'Saved without prior agreement — the other parent will see this.',
    justificatifManquant:
      'The judgment requires a receipt for this category. You can attach one now.',
    remboursementLabel: 'Reimbursed (insurance, health cover)',
    remboursementAide: 'Leave empty if you do not know yet: you can fill it in later.',
    basePartagee: (b) => `Shared base: ${b}`,
    baseLabel: 'Shared base',
    remboursementIllisible: 'Reimbursement unreadable. Write it with two decimals, for example 200.00.',
    remboursementSuperieur: 'The reimbursement cannot exceed the amount paid.',
    accordSansReponse: "State whether you have the other parent's prior agreement before saving.",
    partDe: (p) => `${p}'s share`,
    montantPaye: 'Paid',
    rembourse: 'Reimbursed',
    },
};

export function libellesConditions(langue: LangueDualia): Libelles {
  return LIBELLES[langue] ?? LIBELLES.fr;
}

/** Vrai si la regle porte au moins une condition a montrer. */
export function aDesConditions(c?: ConditionsRegle): boolean {
  if (!c) return false;
  return (
    c.accordPrealable === true ||
    c.justificatifObligatoire === true ||
    c.remboursementAssuranceDeduit === true ||
    (typeof c.plafondMontant === 'number' && c.plafondMontant > 0)
  );
}

/**
 * Les conditions d'une regle, en phrases, dans l'ordre ou elles comptent pour
 * le parent. `formatMontant` est passe par l'appelant pour que le plafond
 * s'affiche comme partout ailleurs dans l'ecran.
 */
export function listerConditions(
  c: ConditionsRegle | undefined,
  langue: LangueDualia,
  formatMontant: (n: number) => string
): string[] {
  if (!c) return [];
  const l = libellesConditions(langue);
  const lignes: string[] = [];
  if (typeof c.plafondMontant === 'number' && c.plafondMontant > 0) {
    lignes.push(l.plafond(formatMontant(c.plafondMontant)));
  }
  if (c.remboursementAssuranceDeduit === true) lignes.push(l.remboursementDeduit);
  if (c.accordPrealable === true) lignes.push(l.accordPrealable);
  if (c.justificatifObligatoire === true) lignes.push(l.justificatifObligatoire);
  return lignes;
}

/**
 * Montant sur lequel la repartition s'applique.
 *
 * C'est la seule condition que Dualia calcule lui-meme, parce qu'elle ne
 * demande aucune interpretation : « deduction faite du remboursement » veut
 * dire que la part de chacun porte sur ce qui reste a la charge de la famille.
 *
 * La depense conserve son montant paye (c'est ce qu'il y a sur la facture) ;
 * c'est la base de partage qui change. partA + partB vaut donc la base, et non
 * le montant — le detail de la depense montre les trois chiffres.
 */
export function basePartageable(montant: number, remboursement?: number): number {
  const r = typeof remboursement === 'number' && remboursement > 0 ? remboursement : 0;
  return Math.max(0, centimes(montant - r));
}

/** Vrai si le montant depasse le plafond mentionne dans le jugement. */
export function depassePlafond(montant: number, c?: ConditionsRegle): boolean {
  if (!c || typeof c.plafondMontant !== 'number' || c.plafondMontant <= 0) return false;
  return centimes(montant) > centimes(c.plafondMontant);
}
