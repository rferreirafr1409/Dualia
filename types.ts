// ---------- Personne / Parent / Foyer ----------
// Architecture BETA-safe : Personne est l'identité métier canonique.
// ParentRole ('A' | 'B') reste une couche de compatibilité legacy pour le
// compte/auth existant (RLS Supabase inchangées) — les nouvelles données
// utilisent personneId/foyerId, jamais A/B comme fondation.

export interface Personne {
  id: string;
  prenom: string;
  nom?: string;
  photoUrl?: string;
  email?: string;
  telephone?: string;
}

export type ConfigFoyers = 'deux_foyers' | 'foyer_commun';

export interface Foyer {
  id: string;
  nom: string;
  adresse?: string;
  ville?: string;
  codePostal?: string;
  pays?: string;
  couleur?: string;
  adresseVisible: boolean;
  actif: boolean;
  estPlaceholder: boolean;
  personneIds: string[]; // dérivé de foyer_personnes
  enfantIds: string[];   // dérivé de foyer_enfants
  // Sous-ensemble d'enfantIds dont ce foyer est la résidence principale.
  // Vide en garde alternée : l'absence de résidence principale se
  // représente par l'absence de marquage, jamais par une valeur par défaut.
  // Optionnel car les états persistés antérieurs ne le contiennent pas.
  enfantIdsResidencePrincipale?: string[]; // dérivé de foyer_enfants.residence_principale
}

export type ParentRole = 'A' | 'B';
export interface Parent {
  id: ParentRole;
  nom: string;
  email: string;
  couleur: string; // legacy — la couleur d'identification vit désormais sur Foyer
  genreParental?: 'mere' | 'pere' | 'autre';
  uuid?: string;
  personneId?: string; // lien vers Personne — identité métier canonique
}
export type TypeGarde =
  | 'résidence_principale'
  | 'résidence_alternée'
  | 'droit_de_visite'
  | 'vacances';
export interface EvenementCalendrier {
  id: string;
  titre: string;
  date: string;
  parentId: ParentRole;
  // Label d'affichage uniquement (prénom), calculé au moment de la
  // création — pas une source de vérité. Pour filtrer/relier de façon
  // fiable, utiliser enfantId.
  enfant?: string;
  enfantId?: string;
  sourceMessageId?: string;
}

export interface EvenementGarde {
  id: string;
  dateDebut: string;
  dateFin: string;
  parentId: ParentRole;
  type: TypeGarde;
  notes?: string;
  tiersId?: string;
  foyerId?: string; // nouveau — contexte réel de vie de l'enfant, prioritaire sur parentId quand présent
}
export type StatutDecision =
  | 'proposée'
  | 'acceptée'
  | 'refusée'
  | 'en_attente';
export interface Decision {
  id: string;
  titre: string;
  description: string;
  dateCreation: string;
  auteurId: ParentRole;
  statut: StatutDecision;
  horodatageEIDAS?: string;
  signatureToken?: string;
}
export type StatutMessage = 'envoyé' | 'lu';
export interface Message {
  id: string;
  expediteurId: ParentRole;
  contenu: string;
  dateEnvoi: string;
  statut: StatutMessage;
  contenuOriginal?: string;
  alerteDetectee?: boolean;
  // Piece jointe : chemin dans le bucket prive documents-familiaux.
  pieceJointeUrl?: string;
  pieceJointeNom?: string;
  pieceJointeType?: string;
}
export type EnfantTag = 'Emma' | 'Léo' | 'Tous';
export interface JournalEntry {
  id: string;
  titre: string;
  description: string;
  emoji: string;
  auteurId: ParentRole;
  date: string;
  liked: boolean;
  enfant?: EnfantTag;
  dateRevelation?: string;
  recitCroise?: string;
  photoUrl?: string;
}
export type CategorieDepense = 'sante' | 'ecole' | 'activites' | 'quotidien' | 'vacances' | 'alimentaire' | 'beaute' | 'vetements' | 'transport' | 'maison' | 'autre';
export interface Depense {
  id: string;
  categorie: CategorieDepense;
  montant: number;
  description: string;
  auteurId: ParentRole;
  date: string;
  rembourse: boolean;
  partA?: number;
  partB?: number;
  photoUri?: string;
  commercant?: string;
  lignesDetail?: { libelle: string; montant: number }[];
  // Justificatif : chemin dans le bucket prive documents-familiaux, jamais une
  // URL publique. justificatifExpireLe porte la duree de conservation d'un an
  // demandee par les parents ; elle declenche un rappel, pas une suppression.
  justificatifUrl?: string;
  justificatifNom?: string;
  justificatifType?: string;
  justificatifExpireLe?: string;
  // Conditions du jugement appliquees a cette depense.
  //
  // remboursementRecu : ce que la mutuelle ou la Securite sociale a rendu.
  // Quand la regle du cadre familial porte « deduction faite du remboursement »,
  // partA + partB valent montant - remboursementRecu, et NON montant : la
  // repartition porte sur ce qui reste reellement a la charge de la famille.
  //
  // accordPrealableConfirme : undefined quand la categorie n'exige aucun accord
  // prealable, true quand le parent declare l'avoir obtenu, false quand il a
  // enregistre sans. Dualia n'arbitre pas, il rend la situation visible.
  remboursementRecu?: number;
  accordPrealableConfirme?: boolean;
}
export type CategorieDocument = 'administratif' | 'sante' | 'ecole' | 'juridique';

// Portee : QUI le document concerne. Axe distinct de la categorie, qui dit
// DE QUOI il s'agit. Les deux se croisent ("Marlon + Sante", "Famille +
// Juridique") sans jamais se confondre.
//   enfant  -> un ou plusieurs enfants, listes dans enfantIds
//   famille -> l'organisation familiale (livret, jugement, assurance...)
//   parent  -> un document propre a un parent
export type DocumentPortee = 'enfant' | 'famille' | 'parent';

export interface DocumentItem {
  id: string;
  nom: string;
  categorie: CategorieDocument;
  auteurId: ParentRole;
  date: string;
  certifie: boolean;
  note?: string;
  // Chemin dans le bucket prive documents-familiaux, pas une URL publique :
  // la lecture passe par une URL signee a duree limitee.
  fichierUrl?: string;
  dateExpiration?: string;
  portee: DocumentPortee;
  enfantIds: string[]; // derive de document_enfants
}

// ---------- Cadre familial (règles financières issues de la convention) ----------

export type CategorieRegle = 'fraisMedicaux' | 'fraisScolaires' | 'activitesExtra' | 'autre';
export type NiveauConfiance = 'haute' | 'moyenne' | 'basse';
export type StatutValidation = 'a_verifier' | 'validee' | 'rejetee';

export interface ClauseSource {
  reference?: string;
  extrait?: string;
  page?: number;
}

export interface ReglePartage {
  id: string;
  categorie: CategorieRegle;
  partA: number;
  partB: number;
  clauseSource?: ClauseSource;
  conditions?: {
    accordPrealable?: boolean;
    plafondMontant?: number;
    justificatifObligatoire?: boolean;
    remboursementAssuranceDeduit?: boolean;
  };
  detection: {
    confiance: NiveauConfiance;
    source: 'ia' | 'manuel';
  };
  validation: {
    statut: StatutValidation;
    valideLe?: string;
    validePar?: string;
  };
}

export interface CadreFamilial {
  id?: string;
  regles: ReglePartage[];
  pension?: {
    montant: number;
    montantParEnfant?: number;
    nombreEnfantsConcernes?: number;
    periodicite: 'mensuelle' | 'trimestrielle' | 'autre';
    clauseSource?: ClauseSource;
    indexation?: {
      indiceReference?: string;
      dateRevisionAnnuelle?: string;
      formuleTexteSource?: string;
      indiceInitialConfirme?: number;
    };
  };
  garde?: {
    autoriteParentale?: string;
    residencePrincipale?: string;
    droitVisiteHebergementDescription?: string;
    transportAChargeDe?: string;
    confiance?: NiveauConfiance;
    weekendParite?: 'paires' | 'impaires';
    weekendJourDebut?: string;
    weekendJourFin?: string;
    vacancesScolaires?: string;
  };
  datesSpeciales?: {
    occasion: string;
    parent?: ParentRole;
    texteSource?: string;
  }[];
  documentSource?: {
    id: string;
    type: 'jugement' | 'convention';
    date?: string;
  };
  statut: 'analyse_en_cours' | 'a_verifier' | 'valide';
  valideLe?: string;
}

export interface PropositionRepartition {
  id: string;
  depenseId: string;
  regleId?: string;
  categorieProposee: CategorieRegle;
  confianceClassification: NiveauConfiance;
  montantTotal: number;
  propositionInitiale: {
    partA: number;
    partB: number;
    montantPartA: number;
    montantPartB: number;
  };
  repartitionFinale?: {
    partA: number;
    partB: number;
    montantPartA: number;
    montantPartB: number;
  };
  statut: 'a_confirmer' | 'confirmee' | 'modifiee' | 'refusee';
  confirmeLe?: string;
  confirmePar?: string;
}

// ---------- Essentiel de l'enfant (fiche + contacts d'urgence) ----------

export interface ContactUrgence {
  id: string;
  enfantId: string;
  nom: string;
  relation?: string;
  telephone: string;
  priorite: number;
}

export interface Enfant {
  id: string;
  prenom: string;
  dateNaissance?: string;
  ecole?: string;
  medecinTraitant?: string;
  medecinTelephone?: string;
  allergies?: string;
  groupeSanguin?: string;
  mutuelle?: string;
  photoUrl?: string;
  contactsUrgence: ContactUrgence[];
}

// ---------- Le Fil de vie (moments du quotidien, présent) ----------
// Volontairement simple : pas de commentaires, pas de compteur public —
// juste une réaction cœur (aimePar, la liste des parents qui ont réagi).

export interface Moment {
  id: string;
  auteurId: ParentRole;
  // Identifiant technique de l'enfant concerné (remplace l'ancien champ
  // "enfant" en texte libre) — permet un filtrage fiable par enfant sur
  // le Fil de vie / "Son histoire", cohérent avec Documents et Agenda
  // scolaire. Le prénom affiché est retrouvé via
  // enfants.find(e => e.id === enfantId).
  enfantId?: string;
  texte?: string;
  photoUrl?: string;
  aimePar: ParentRole[];
  createdAt: string;
}

// ---------- Accès tiers (grands-parents, nounous, école) ----------

export type RoleTiers = 'grand_parent' | 'nounou' | 'ecole_tiers';
export type StatutTiers = 'invite' | 'actif' | 'revoque';

export interface Tiers {
  id: string;
  nom: string;
  email: string;
  role: RoleTiers;
  statut: StatutTiers;
  // Parent qui a invite ce tiers. Ancre du perimetre : le tiers ne voit que
  // le cote de ce parent. Chaque parent invite les siens.
  invitePar: ParentRole;
  creeLe: string;
  peutEtreGardien: boolean;
  // Jeton du lien d'invitation, genere par la base. Le parent transmet le
  // lien comme il veut ; Dualia n'envoie aucun e-mail.
  token?: string;
  expireLe?: string;
  accepteLe?: string;
  revoqueLe?: string;
  // Enfants auxquels ce tiers est rattache. Jamais "tous" par defaut.
  enfantIds: string[];
}

// Espace d'un tiers connecte. Volontairement pauvre : c'est la liste
// exhaustive de ce qu'il peut voir, et elle est verrouillee cote serveur —
// l'ecran ne fait que rendre ce que la base a bien voulu lui donner.
export interface AccesTiersActif {
  tiersId: string;
  nom: string;
  role: RoleTiers;
  peutEtreGardien: boolean;
  parentReferentNom: string;
  enfants: Enfant[];
  gardes: EvenementGarde[];
}

// ---------- Agenda scolaire (devoirs, absences, sorties, contrôles) ----------

export type TypeAgendaScolaire = 'devoir' | 'absence' | 'sortie' | 'controle';

export interface AgendaScolaireItem {
  id: string;
  type: TypeAgendaScolaire;
  titre: string;
  description?: string;
  dateEcheance: string;
  enfantId?: string;
  auteurId: ParentRole;
  fait: boolean;
  creeLe: string;
}
