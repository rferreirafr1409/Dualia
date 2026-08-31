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