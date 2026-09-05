export type ParentRole = 'A' | 'B';
export interface Parent {
  id: ParentRole;
  nom: string;
  email: string;
  couleur: string;
  // Identifiant réel Supabase (auth.users.id), utilisé en interne par le
  // store pour les écritures (clé étrangère auteur_id). N'est jamais
  // affiché à l'écran — les composants continuent d'utiliser id: ParentRole
  // comme avant.
  uuid?: string;
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
  enfant?: string;
  sourceMessageId?: string;
}

export interface EvenementGarde {
  id: string;
  dateDebut: string;
  dateFin: string;
  parentId: ParentRole;
  type: TypeGarde;
  notes?: string;
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
  // ---- Modération à l'envoi (filtre + reformulation IA) ----
  // contenuOriginal n'est renseigné que si l'expéditeur a choisi la
  // reformulation proposée : contenu devient alors le texte adouci envoyé,
  // et contenuOriginal garde une trace de ce qui avait été tapé au départ.
  contenuOriginal?: string;
  alerteDetectee?: boolean;
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
}
export type CategorieDocument = 'administratif' | 'sante' | 'ecole' | 'juridique';
export interface DocumentItem {
  id: string;
  nom: string;
  categorie: CategorieDocument;
  auteurId: ParentRole;
  date: string;
  certifie: boolean;
  note?: string;
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
  partA: number; // %
  partB: number; // %
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
  /** Identifiant réel de la ligne cadre_familial en base — absent tant que rien n'a encore été synchronisé. */
  id?: string;
  regles: ReglePartage[];
  pension?: {
    montant: number;
    periodicite: 'mensuelle' | 'trimestrielle' | 'autre';
    clauseSource?: ClauseSource;
  };
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
  enfant?: string;
  texte?: string;
  photoUrl?: string;
  aimePar: ParentRole[];
  createdAt: string;
}

// ---------- Accès tiers (grands-parents, nounous, école) ----------
// Volontairement 3 rôles prédéfinis en V1 plutôt que des permissions
// personnalisables : plus simple à comprendre pour l'utilisateur, plus
// simple à sécuriser côté RLS Supabase.

export type RoleTiers = 'grand_parent' | 'nounou' | 'ecole_tiers';
export type StatutTiers = 'invite' | 'actif' | 'revoque';

export interface Tiers {
  id: string;
  nom: string;
  email: string;
  role: RoleTiers;
  statut: StatutTiers;
  invitePar: ParentRole;
  creeLe: string;
}