import { create } from 'zustand';
import {
  EvenementGarde, Decision, Message, Parent, ParentRole,
  JournalEntry, Depense, DocumentItem,
} from '../types';
import { COLORS } from '../constants/theme';

const iso = (d: Date) => d.toISOString();

const decale = (offsetJours: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + offsetJours);
  return d;
};

const PARENTS: Record<ParentRole, Parent> = {
  A: { id: 'A', nom: 'Marie Dupont', email: 'marie@example.com', couleur: COLORS.vert },
  B: { id: 'B', nom: 'Pierre Dupont', email: 'pierre@example.com', couleur: COLORS.terracotta },
};

const genEvenementsGarde = (): EvenementGarde[] => {
  const events: EvenementGarde[] = [];
  const today = new Date();
  const jourSemaine = today.getDay() === 0 ? 6 : today.getDay() - 1;
  for (let semaine = -2; semaine <= 5; semaine++) {
    const parentId: ParentRole = semaine % 2 === 0 ? 'A' : 'B';
    const debut = decale(semaine * 7 - jourSemaine);
    const fin = decale(semaine * 7 - jourSemaine + 6);
    debut.setHours(0, 0, 0, 0);
    fin.setHours(23, 59, 59, 0);
    events.push({
      id: `garde-${semaine + 10}`,
      dateDebut: iso(debut),
      dateFin: iso(fin),
      parentId,
      type: 'résidence_alternée',
    });
  }
  return events;
};

const DECISIONS_INITIALES: Decision[] = [
  {
    id: 'd1',
    titre: "Inscription école primaire Jeanne d'Arc",
    description: "Inscrire Emma à l'école primaire Jeanne d'Arc pour la prochaine rentrée scolaire. Dossier à déposer avant le 15 du mois.",
    dateCreation: iso(decale(-15)),
    auteurId: 'A',
    statut: 'acceptée',
    horodatageEIDAS: iso(decale(-14)),
    signatureToken: 'EIDAS-2025-MVP-7F8A9B2C',
  },
  {
    id: 'd2',
    titre: 'Cours de natation le mercredi après-midi',
    description: 'Inscrire Léo aux cours de natation le mercredi de 16h à 17h30 à la piscine municipale. Coût : 120 € le trimestre.',
    dateCreation: iso(decale(-5)),
    auteurId: 'B',
    statut: 'en_attente',
  },
  {
    id: 'd3',
    titre: 'Consultation orthodontiste Dr. Leroy',
    description: "Premier rendez-vous chez l'orthodontiste pour Emma. Devis estimé entre 2 500 € et 3 200 €, prise en charge mutuelle à confirmer.",
    dateCreation: iso(decale(-2)),
    auteurId: 'A',
    statut: 'proposée',
  },
];

const MESSAGES_INITIAUX: Message[] = [
  {
    id: 'm1',
    expediteurId: 'A',
    contenu: 'Bonjour, Emma a oublié son cartable ce matin. Peux-tu le lui apporter ce soir ?',
    dateEnvoi: iso(decale(-3)),
    statut: 'lu',
  },
  {
    id: 'm2',
    expediteurId: 'B',
    contenu: "Pas de problème, je passerai vers 18h. Elle a aussi laissé son imperméable ici.",
    dateEnvoi: iso(decale(-3)),
    statut: 'lu',
  },
  {
    id: 'm3',
    expediteurId: 'A',
    contenu: "Merci. Pour le rendez-vous médecin de Léo vendredi, tu peux l'emmener ?",
    dateEnvoi: iso(decale(-1)),
    statut: 'lu',
  },
  {
    id: 'm4',
    expediteurId: 'B',
    contenu: "Oui, j'ai noté. Vendredi 14h30 chez le Dr. Moreau. Je m'en occupe.",
    dateEnvoi: iso(decale(0)),
    statut: 'envoyé',
  },
];

const JOURNAL_INITIAL: JournalEntry[] = [
  {
    id: 'j1',
    titre: "Premier jour d'école — Emma",
    description: "Emma est rentrée si fière avec son grand cartable ! Elle a adoré sa nouvelle maîtresse Mme Girard.",
    emoji: '🎒',
    auteurId: 'A',
    date: iso(decale(-45)),
    liked: true,
  },
  {
    id: 'j2',
    titre: 'Anniversaire 5 ans de Léo',
    description: "Super fête avec ses copains de la crèche. Il a soufflé ses bougies d'un coup, trop mignon !",
    emoji: '🎂',
    auteurId: 'B',
    date: iso(decale(-20)),
    liked: true,
  },
  {
    id: 'j3',
    titre: 'Grande sortie au parc de la Villette',
    description: "Journée en famille à la Villette. Les enfants ont adoré la Géode et les jeux d'eau.",
    emoji: '🌳',
    auteurId: 'A',
    date: iso(decale(-7)),
    liked: false,
  },
  {
    id: 'j4',
    titre: 'Léo apprend à faire du vélo',
    description: "Après 30 minutes d'efforts, Léo pédale tout seul sans les petites roues !",
    emoji: '🚲',
    auteurId: 'B',
    date: iso(decale(-3)),
    liked: false,
  },
];

const DEPENSES_INITIALES: Depense[] = [
  {
    id: 'dep1',
    categorie: 'sante',
    montant: 45.50,
    description: 'Médicaments ordonnance Léo',
    auteurId: 'A',
    date: iso(decale(-5)),
    rembourse: true,
  },
  {
    id: 'dep2',
    categorie: 'ecole',
    montant: 89,
    description: 'Fournitures scolaires Emma — rentrée',
    auteurId: 'B',
    date: iso(decale(-8)),
    rembourse: false,
  },
  {
    id: 'dep3',
    categorie: 'activites',
    montant: 120,
    description: 'Cours de natation — trimestre Léo',
    auteurId: 'A',
    date: iso(decale(-12)),
    rembourse: false,
  },
  {
    id: 'dep4',
    categorie: 'quotidien',
    montant: 67.30,
    description: 'Courses alimentaires semaine',
    auteurId: 'B',
    date: iso(decale(-2)),
    rembourse: false,
  },
  {
    id: 'dep5',
    categorie: 'ecole',
    montant: 35,
    description: 'Sortie scolaire musée — Emma',
    auteurId: 'A',
    date: iso(decale(-1)),
    rembourse: false,
  },
];

const DOCUMENTS_INITIAUX: DocumentItem[] = [
  {
    id: 'doc1',
    nom: 'Carnet de santé — Emma',
    categorie: 'sante',
    auteurId: 'A',
    date: iso(decale(-60)),
    certifie: true,
  },
  {
    id: 'doc2',
    nom: 'Ordonnance Dr. Moreau — Léo',
    categorie: 'sante',
    auteurId: 'B',
    date: iso(decale(-5)),
    certifie: false,
  },
  {
    id: 'doc3',
    nom: 'Bulletin scolaire T1 — Emma',
    categorie: 'ecole',
    auteurId: 'A',
    date: iso(decale(-30)),
    certifie: true,
  },
  {
    id: 'doc4',
    nom: 'Convention parentale',
    categorie: 'juridique',
    auteurId: 'A',
    date: iso(decale(-90)),
    certifie: true,
  },
  {
    id: 'doc5',
    nom: 'Acte de naissance — Emma',
    categorie: 'administratif',
    auteurId: 'A',
    date: iso(decale(-365 * 8)),
    certifie: true,
  },
  {
    id: 'doc6',
    nom: 'Acte de naissance — Léo',
    categorie: 'administratif',
    auteurId: 'B',
    date: iso(decale(-365 * 5)),
    certifie: true,
  },
];

interface DualiaStore {
  parents: Record<ParentRole, Parent>;
  evenements: EvenementGarde[];
  decisions: Decision[];
  messages: Message[];
  journalEntries: JournalEntry[];
  depenses: Depense[];
  documents: DocumentItem[];
  parentActif: ParentRole;

  setParentActif: (id: ParentRole) => void;
  ajouterEvenement: (ev: EvenementGarde) => void;
  supprimerEvenement: (id: string) => void;
  ajouterDecision: (d: Decision) => void;
  mettreAJourDecision: (id: string, updates: Partial<Decision>) => void;
  ajouterMessage: (m: Message) => void;
  horodaterDecision: (id: string) => void;
  ajouterJournal: (entry: JournalEntry) => void;
  likerEntree: (id: string) => void;
  ajouterDepense: (dep: Depense) => void;
  ajouterDocument: (doc: DocumentItem) => void;
}

export const useStore = create<DualiaStore>()((set) => ({
  parents: PARENTS,
  evenements: genEvenementsGarde(),
  decisions: DECISIONS_INITIALES,
  messages: MESSAGES_INITIAUX,
  journalEntries: JOURNAL_INITIAL,
  depenses: DEPENSES_INITIALES,
  documents: DOCUMENTS_INITIAUX,
  parentActif: 'A',

  setParentActif: (id) => set({ parentActif: id }),

  ajouterEvenement: (ev) =>
    set((state) => ({ evenements: [...state.evenements, ev] })),

  supprimerEvenement: (id) =>
    set((state) => ({ evenements: state.evenements.filter((e) => e.id !== id) })),

  ajouterDecision: (d) =>
    set((state) => ({ decisions: [d, ...state.decisions] })),

  mettreAJourDecision: (id, updates) =>
    set((state) => ({
      decisions: state.decisions.map((d) =>
        d.id === id ? { ...d, ...updates } : d
      ),
    })),

  ajouterMessage: (m) =>
    set((state) => ({ messages: [...state.messages, m] })),

  horodaterDecision: (id) => {
    const token = `EIDAS-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    set((state) => ({
      decisions: state.decisions.map((d) =>
        d.id === id
          ? {
              ...d,
              horodatageEIDAS: new Date().toISOString(),
              signatureToken: token,
              statut: 'acceptée' as const,
            }
          : d
      ),
    }));
  },

  ajouterJournal: (entry) =>
    set((state) => ({ journalEntries: [entry, ...state.journalEntries] })),

  likerEntree: (id) =>
    set((state) => ({
      journalEntries: state.journalEntries.map((e) =>
        e.id === id ? { ...e, liked: !e.liked } : e
      ),
    })),

  ajouterDepense: (dep) =>
    set((state) => ({ depenses: [dep, ...state.depenses] })),

  ajouterDocument: (doc) =>
    set((state) => ({ documents: [doc, ...state.documents] })),
}));
