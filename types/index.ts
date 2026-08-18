export type ParentRole = 'A' | 'B';

export interface Parent {
  id: ParentRole;
  nom: string;
  email: string;
  couleur: string;
}

export type TypeGarde =
  | 'résidence_principale'
  | 'résidence_alternée'
  | 'droit_de_visite'
  | 'vacances';

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

export interface JournalEntry {
  id: string;
  titre: string;
  description: string;
  emoji: string;
  auteurId: ParentRole;
  date: string;
  liked: boolean;
}

export type CategorieDepense = 'sante' | 'ecole' | 'activites' | 'quotidien' | 'vacances';

export interface Depense {
  id: string;
  categorie: CategorieDepense;
  montant: number;
  description: string;
  auteurId: ParentRole;
  date: string;
  rembourse: boolean;
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
