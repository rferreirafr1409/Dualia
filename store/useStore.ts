import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  EvenementGarde, Decision, Message, Parent, ParentRole,
  EvenementCalendrier,
  JournalEntry, Depense, DocumentItem,
} from '../types';
import { COLORS } from '../constants/theme';
import { Langue } from '../constants/i18n';

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
      type: 'résidence_alternée' as any,
    });
  }
  return events;
};

const DECISIONS_FR: Decision[] = [
  {
    id: 'd1',
    titre: "Inscription ecole primaire Jeanne d'Arc",
    description: "Inscrire Emma a l'ecole primaire Jeanne d'Arc pour la prochaine rentree scolaire. Dossier a deposer avant le 15 du mois.",
    dateCreation: iso(decale(-15)),
    auteurId: 'A',
    statut: 'acceptée',
    horodatageEIDAS: iso(decale(-14)),
    signatureToken: 'EIDAS-2025-MVP-7F8A9B2C',
  },
  {
    id: 'd2',
    titre: 'Cours de natation le mercredi apres-midi',
    description: 'Inscrire Leo aux cours de natation le mercredi de 16h a 17h30 a la piscine municipale. Cout : 120 euros le trimestre.',
    dateCreation: iso(decale(-5)),
    auteurId: 'B',
    statut: 'en_attente',
  },
  {
    id: 'd3',
    titre: 'Consultation orthodontiste Dr. Leroy',
    description: "Premier rendez-vous chez l'orthodontiste pour Emma. Devis estime entre 2500 et 3200 euros, prise en charge mutuelle a confirmer.",
    dateCreation: iso(decale(-2)),
    auteurId: 'A',
    statut: 'proposée',
  },
];

const DECISIONS_PT: Decision[] = [
  {
    id: 'd1',
    titre: "Inscrição na escola primária Jeanne d'Arc",
    description: "Inscrever a Emma na escola primária Jeanne d'Arc para o próximo ano letivo. Processo a entregar até dia 15.",
    dateCreation: iso(decale(-15)),
    auteurId: 'A',
    statut: 'acceptée',
    horodatageEIDAS: iso(decale(-14)),
    signatureToken: 'EIDAS-2025-MVP-7F8A9B2C',
  },
  {
    id: 'd2',
    titre: 'Aulas de natação à quarta-feira à tarde',
    description: 'Inscrever o Léo nas aulas de natação à quarta-feira das 16h às 17h30 na piscina municipal. Custo: 120 euros por trimestre.',
    dateCreation: iso(decale(-5)),
    auteurId: 'B',
    statut: 'en_attente',
  },
  {
    id: 'd3',
    titre: 'Consulta de ortodontia Dr. Leroy',
    description: 'Primeira consulta de ortodontia para a Emma. Orçamento estimado entre 2500 e 3200 euros, comparticipação a confirmar.',
    dateCreation: iso(decale(-2)),
    auteurId: 'A',
    statut: 'proposée',
  },
];

const MESSAGES_FR: Message[] = [
  {
    id: 'm1',
    expediteurId: 'A',
    contenu: 'Bonjour, Emma a oublie son cartable ce matin. Peux-tu le lui apporter ce soir ?',
    dateEnvoi: iso(decale(-3)),
    statut: 'lu',
  },
  {
    id: 'm2',
    expediteurId: 'B',
    contenu: "Pas de probleme, je passerai vers 18h. Elle a aussi laisse son impermeable ici.",
    dateEnvoi: iso(decale(-3)),
    statut: 'lu',
  },
  {
    id: 'm3',
    expediteurId: 'A',
    contenu: "Merci. Pour le rendez-vous medecin de Leo vendredi, tu peux l'emmener ?",
    dateEnvoi: iso(decale(-1)),
    statut: 'lu',
  },
  {
    id: 'm4',
    expediteurId: 'B',
    contenu: "Oui, j'ai note. Vendredi 14h30 chez le Dr. Moreau. Je m'en occupe.",
    dateEnvoi: iso(decale(0)),
    statut: 'envoyé',
  },
];

const MESSAGES_PT: Message[] = [
  {
    id: 'm1',
    expediteurId: 'A',
    contenu: 'Bom dia, a Emma esqueceu-se da mochila esta manhã. Podes levar-lha hoje à noite?',
    dateEnvoi: iso(decale(-3)),
    statut: 'lu',
  },
  {
    id: 'm2',
    expediteurId: 'B',
    contenu: 'Sem problema, passo por volta das 18h. Ela também deixou o impermeável aqui.',
    dateEnvoi: iso(decale(-3)),
    statut: 'lu',
  },
  {
    id: 'm3',
    expediteurId: 'A',
    contenu: 'Obrigada. Para a consulta do Léo sexta-feira, podes levá-lo?',
    dateEnvoi: iso(decale(-1)),
    statut: 'lu',
  },
  {
    id: 'm4',
    expediteurId: 'B',
    contenu: 'Sim, já tomei nota. Sexta-feira às 14h30 no Dr. Moreau. Eu trato disso.',
    dateEnvoi: iso(decale(0)),
    statut: 'envoyé',
  },
];

const JOURNAL_FR: JournalEntry[] = [
  {
    id: 'j1',
    titre: "Premier jour d'ecole — Emma",
    description: "Emma est rentree si fiere avec son grand cartable ! Elle a adore sa nouvelle maitresse Mme Girard.",
    emoji: '🎒',
    auteurId: 'A',
    date: iso(decale(-45)),
    liked: true,
    enfant: 'Emma',
    recitCroise: "Elle m'a raconte sa journee au telephone le soir meme, les yeux qui brillaient. Je n'ai jamais vu Emma aussi excitee.",
  },
  {
    id: 'j2',
    titre: 'Anniversaire 5 ans de Leo',
    description: "Super fete avec ses copains de la creche. Il a souffle ses bougies d'un coup, trop mignon !",
    emoji: '🎂',
    auteurId: 'B',
    date: iso(decale(-20)),
    liked: true,
    enfant: 'Léo',
  },
  {
    id: 'j3',
    titre: 'Grande sortie au parc de la Villette',
    description: "Journee en famille a la Villette. Les enfants ont adore la Geode et les jeux d'eau.",
    emoji: '🌳',
    auteurId: 'A',
    date: iso(decale(-7)),
    liked: false,
    enfant: 'Tous',
  },
  {
    id: 'j4',
    titre: 'Leo apprend a faire du velo',
    description: "Apres 30 minutes d'efforts, Leo pedale tout seul sans les petites roues !",
    emoji: '🚲',
    auteurId: 'B',
    date: iso(decale(-3)),
    liked: false,
    enfant: 'Léo',
  },
  {
    id: 'j5',
    titre: 'Pour Emma, le jour de tes 18 ans',
    description: "Une lettre que je t'ecris aujourd'hui, a decouvrir dans quelques annees. Ce que je voulais te dire...",
    emoji: '💌',
    auteurId: 'A',
    date: iso(decale(-10)),
    liked: false,
    enfant: 'Emma',
    dateRevelation: iso(decale(200)),
  },
];

const JOURNAL_PT: JournalEntry[] = [
  {
    id: 'j1',
    titre: 'Primeiro dia de escola — Emma',
    description: 'A Emma voltou tão orgulhosa com a sua mochila grande! Adorou a nova professora, a Sra. Girard.',
    emoji: '🎒',
    auteurId: 'A',
    date: iso(decale(-45)),
    liked: true,
    enfant: 'Emma',
    recitCroise: 'Ela contou-me o dia dela ao telefone nessa noite, com os olhos a brilhar. Nunca a vi tão entusiasmada.',
  },
  {
    id: 'j2',
    titre: '5 anos do Léo',
    description: 'Ótima festa com os amigos da creche. Apagou as velas de uma só vez, tão fofo!',
    emoji: '🎂',
    auteurId: 'B',
    date: iso(decale(-20)),
    liked: true,
    enfant: 'Léo',
  },
  {
    id: 'j3',
    titre: 'Passeio em família ao Parc de la Villette',
    description: 'Dia em família na Villette. As crianças adoraram a Géode e os jogos de água.',
    emoji: '🌳',
    auteurId: 'A',
    date: iso(decale(-7)),
    liked: false,
    enfant: 'Tous',
  },
  {
    id: 'j4',
    titre: 'O Léo aprende a andar de bicicleta',
    description: 'Depois de 30 minutos de esforço, o Léo pedala sozinho sem as rodinhas!',
    emoji: '🚲',
    auteurId: 'B',
    date: iso(decale(-3)),
    liked: false,
    enfant: 'Léo',
  },
  {
    id: 'j5',
    titre: 'Para a Emma, no dia em que fizeres 18 anos',
    description: 'Uma carta que te escrevo hoje, para descobrires daqui a uns anos. O que eu queria dizer-te...',
    emoji: '💌',
    auteurId: 'A',
    date: iso(decale(-10)),
    liked: false,
    enfant: 'Emma',
    dateRevelation: iso(decale(200)),
  },
];

const DEPENSES_FR: Depense[] = [
  { id: 'dep1', categorie: 'sante', montant: 45.50, description: 'Medicaments ordonnance Leo', auteurId: 'A', date: iso(decale(-5)), rembourse: true },
  { id: 'dep2', categorie: 'ecole', montant: 89, description: 'Fournitures scolaires Emma — rentree', auteurId: 'B', date: iso(decale(-8)), rembourse: false },
  { id: 'dep3', categorie: 'activites', montant: 120, description: 'Cours de natation — trimestre Leo', auteurId: 'A', date: iso(decale(-12)), rembourse: false },
  { id: 'dep4', categorie: 'quotidien', montant: 67.30, description: 'Courses alimentaires semaine', auteurId: 'B', date: iso(decale(-2)), rembourse: false },
  { id: 'dep5', categorie: 'ecole', montant: 35, description: 'Sortie scolaire musee — Emma', auteurId: 'A', date: iso(decale(-1)), rembourse: false },
];

const DEPENSES_PT: Depense[] = [
  { id: 'dep1', categorie: 'sante', montant: 45.50, description: 'Medicamentos receitados para o Léo', auteurId: 'A', date: iso(decale(-5)), rembourse: true },
  { id: 'dep2', categorie: 'ecole', montant: 89, description: 'Material escolar Emma — início do ano', auteurId: 'B', date: iso(decale(-8)), rembourse: false },
  { id: 'dep3', categorie: 'activites', montant: 120, description: 'Aulas de natação — trimestre do Léo', auteurId: 'A', date: iso(decale(-12)), rembourse: false },
  { id: 'dep4', categorie: 'quotidien', montant: 67.30, description: 'Compras semanais', auteurId: 'B', date: iso(decale(-2)), rembourse: false },
  { id: 'dep5', categorie: 'ecole', montant: 35, description: 'Visita de estudo ao museu — Emma', auteurId: 'A', date: iso(decale(-1)), rembourse: false },
];

const DOCUMENTS_FR: DocumentItem[] = [
  { id: 'doc1', nom: 'Carnet de sante — Emma', categorie: 'sante', auteurId: 'A', date: iso(decale(-60)), certifie: true },
  { id: 'doc2', nom: 'Ordonnance Dr. Moreau — Leo', categorie: 'sante', auteurId: 'B', date: iso(decale(-5)), certifie: false },
  { id: 'doc3', nom: 'Bulletin scolaire T1 — Emma', categorie: 'ecole', auteurId: 'A', date: iso(decale(-30)), certifie: true },
  { id: 'doc4', nom: 'Convention parentale', categorie: 'juridique', auteurId: 'A', date: iso(decale(-90)), certifie: true },
  { id: 'doc5', nom: 'Acte de naissance — Emma', categorie: 'administratif', auteurId: 'A', date: iso(decale(-365 * 8)), certifie: true },
  { id: 'doc6', nom: 'Acte de naissance — Leo', categorie: 'administratif', auteurId: 'B', date: iso(decale(-365 * 5)), certifie: true },
];

const DOCUMENTS_PT: DocumentItem[] = [
  { id: 'doc1', nom: 'Boletim de saúde — Emma', categorie: 'sante', auteurId: 'A', date: iso(decale(-60)), certifie: true },
  { id: 'doc2', nom: 'Receita Dr. Moreau — Léo', categorie: 'sante', auteurId: 'B', date: iso(decale(-5)), certifie: false },
  { id: 'doc3', nom: 'Boletim escolar T1 — Emma', categorie: 'ecole', auteurId: 'A', date: iso(decale(-30)), certifie: true },
  { id: 'doc4', nom: 'Acordo parental', categorie: 'juridique', auteurId: 'A', date: iso(decale(-90)), certifie: true },
  { id: 'doc5', nom: 'Certidão de nascimento — Emma', categorie: 'administratif', auteurId: 'A', date: iso(decale(-365 * 8)), certifie: true },
  { id: 'doc6', nom: 'Certidão de nascimento — Léo', categorie: 'administratif', auteurId: 'B', date: iso(decale(-365 * 5)), certifie: true },
];

const TODAY_EVENTS_FR = [
  { id: '1', time: '09h00', title: 'Natation', who: 'Emma · avec Marie' },
  { id: '2', time: '16h30', title: 'Devoirs', who: 'Léo · avec Pierre' },
  { id: '3', time: '19h00', title: 'Repas en famille', who: 'Ensemble' },
];

const TODAY_EVENTS_PT = [
  { id: '1', time: '09h00', title: 'Natação', who: 'Emma · com a Marie' },
  { id: '2', time: '16h30', title: 'Trabalhos de casa', who: 'Léo · com o Pierre' },
  { id: '3', time: '19h00', title: 'Jantar em família', who: 'Juntos' },
];

const FAMILY_CARD_FR = {
  enfants: 'Emma & Léo',
  localisation: 'En famille — Paris',
  prochainEchange: 'Prochain échange dans 7 j, chez Pierre',
};

const FAMILY_CARD_PT = {
  enfants: 'Emma & Léo',
  localisation: 'Em família — Lisboa',
  prochainEchange: 'Próxima troca em 7 dias, com o Pierre',
};

interface DualiaStore {
  parents: Record<ParentRole, Parent>;
  evenements: EvenementGarde[];
  decisions: Decision[];
  messages: Message[];
  journalEntries: JournalEntry[];
  depenses: Depense[];
  documents: DocumentItem[];
  parentActif: ParentRole;
  nouvelleDecisionDraft: string | null;
  langue: Langue;
  todayEvents: typeof TODAY_EVENTS_FR;
  familyCard: typeof FAMILY_CARD_FR;

  setParentActif: (id: ParentRole) => void;
  ajouterEvenement: (ev: EvenementGarde) => void;
  evenementsCalendrier: EvenementCalendrier[];
  ajouterEvenementCalendrier: (ev: EvenementCalendrier) => void;
  ignorerSuggestion: (messageId: string) => void;
  messagesAnalyses: string[];
  marquerMessageAnalyse: (id: string) => void;
  supprimerEvenement: (id: string) => void;
  ajouterDecision: (d: Decision) => void;
  mettreAJourDecision: (id: string, updates: Partial<Decision>) => void;
  ajouterMessage: (m: Message) => void;
  horodaterDecision: (id: string) => void;
  ajouterJournal: (entry: JournalEntry) => void;
  likerEntree: (id: string) => void;
  ajouterRecitCroise: (id: string, texte: string) => void;
  ajouterDepense: (dep: Depense) => void;
  reglerDepense: (id: string) => void;
  ajouterDocument: (doc: DocumentItem) => void;
  setNouvelleDecisionDraft: (texte: string | null) => void;
  setLangue: (langue: Langue) => void;
}

const rawStorage = Platform.OS === 'web' ? localStorage : AsyncStorage;

// Enveloppe le storage pour ne jamais échouer silencieusement : si l'écriture
// dépasse le quota (ex. localStorage plein), on log une erreur explicite au
// lieu de perdre les données sans que personne ne le sache.
const storageAvecAlerte = {
  getItem: (name: string) => rawStorage.getItem(name),
  removeItem: (name: string) => rawStorage.removeItem(name),
  setItem: (name: string, value: string) => {
    try {
      const resultat = rawStorage.setItem(name, value);
      // AsyncStorage.setItem renvoie une Promise ; localStorage.setItem est synchrone.
      if (resultat && typeof (resultat as any).catch === 'function') {
        (resultat as Promise<void>).catch((e) => {
          console.error('[Dualia] Échec sauvegarde (AsyncStorage) :', e);
        });
      }
      return resultat;
    } catch (e) {
      console.error('[Dualia] Échec sauvegarde — données non enregistrées :', e);
      if (Platform.OS === 'web') {
        window.alert(
          "Attention : l'espace de stockage du navigateur est plein, cet ajout n'a pas pu être sauvegardé. Essaie de libérer de l'espace ou contacte le support."
        );
      }
    }
  },
};

const dualiaStorage = createJSONStorage(() => storageAvecAlerte as any);

export const useStore = create<DualiaStore>()(
  persist(
    (set) => ({
  parents: PARENTS,
  evenements: genEvenementsGarde(),
  decisions: DECISIONS_FR,
  messages: MESSAGES_FR,
  journalEntries: JOURNAL_FR,
  depenses: DEPENSES_FR,
  documents: DOCUMENTS_FR,
  parentActif: 'A',
  nouvelleDecisionDraft: null,
  langue: 'fr',
  todayEvents: TODAY_EVENTS_FR,
  familyCard: FAMILY_CARD_FR,

  setParentActif: (id) => set({ parentActif: id }),

  ajouterEvenement: (ev) =>
    set((state) => ({ evenements: [...state.evenements, ev] })),
      evenementsCalendrier: [],
      ajouterEvenementCalendrier: (ev) =>
        set((state) => ({ evenementsCalendrier: [...state.evenementsCalendrier, ev] })),
      ignorerSuggestion: (messageId) =>
        set((state) => ({ messagesAnalyses: [...state.messagesAnalyses, messageId] })),
      messagesAnalyses: [],
      marquerMessageAnalyse: (id) =>
        set((state) => ({ messagesAnalyses: [...state.messagesAnalyses, id] })),

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

  ajouterRecitCroise: (id, texte) =>
    set((state) => ({
      journalEntries: state.journalEntries.map((e) =>
        e.id === id ? { ...e, recitCroise: texte } : e
      ),
    })),

  ajouterDepense: (dep) =>
    set((state) => ({ depenses: [dep, ...state.depenses] })),

  ajouterDocument: (doc) =>
    set((state) => ({ documents: [doc, ...state.documents] })),

  setNouvelleDecisionDraft: (texte) => set({ nouvelleDecisionDraft: texte }),

  setLangue: (langue) => {
    if (langue === 'pt') {
      set({
        langue: 'pt',
        decisions: DECISIONS_PT,
        messages: MESSAGES_PT,
        journalEntries: JOURNAL_PT,
        depenses: DEPENSES_PT,
        documents: DOCUMENTS_PT,
        todayEvents: TODAY_EVENTS_PT,
        familyCard: FAMILY_CARD_PT,
      });
    } else {
      set({
        langue: 'fr',
        decisions: DECISIONS_FR,
        messages: MESSAGES_FR,
        journalEntries: JOURNAL_FR,
        depenses: DEPENSES_FR,
        documents: DOCUMENTS_FR,
        todayEvents: TODAY_EVENTS_FR,
        familyCard: FAMILY_CARD_FR,
      });
    }
  },

  reglerDepense: (id) =>
    set((state) => ({
      depenses: state.depenses.map((d) =>
        d.id === id ? { ...d, rembourse: true } : d
      ),
    })),
}),
    {
      name: 'dualia-storage',
      storage: dualiaStorage,
      partialize: (state) => ({
        decisions: state.decisions,
        messages: state.messages,
        journalEntries: state.journalEntries,
        // On retire photoUri avant de persister : ce sont des images en
        // base64 (souvent 1-3 Mo chacune) qui saturent le quota de
        // localStorage (~5-10 Mo). Une fois le quota dépassé, l'écriture
        // échoue silencieusement et plus AUCUNE dépense n'est sauvegardée
        // (ce qui explique pourquoi seuls les derniers ajouts disparaissent).
        depenses: state.depenses.map(({ photoUri, ...rest }) => rest),
        documents: state.documents,
        parentActif: state.parentActif,
        langue: state.langue,
        evenements: state.evenements,
        evenementsCalendrier: state.evenementsCalendrier,
        messagesAnalyses: state.messagesAnalyses,
      }),
    }
  )
);
