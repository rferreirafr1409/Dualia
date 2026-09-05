import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  EvenementGarde, Decision, Message, Parent, ParentRole,
  EvenementCalendrier,
  JournalEntry, Depense, DocumentItem,
  CadreFamilial, ReglePartage, PropositionRepartition,
  Enfant, ContactUrgence, Moment, Tiers,
} from '../types';
import { COLORS } from '../constants/theme';
import { Langue } from '../constants/i18n';
import { supabase } from '../constants/supabase';

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

const regleVersDB = (regle: ReglePartage, cadreFamilialId: string) => ({
  cadre_familial_id: cadreFamilialId,
  categorie: regle.categorie,
  part_a: regle.partA,
  part_b: regle.partB,
  clause_reference: regle.clauseSource?.reference ?? null,
  clause_extrait: regle.clauseSource?.extrait ?? null,
  clause_page: regle.clauseSource?.page ?? null,
  accord_prealable: regle.conditions?.accordPrealable ?? null,
  plafond_montant: regle.conditions?.plafondMontant ?? null,
  justificatif_obligatoire: regle.conditions?.justificatifObligatoire ?? null,
  remboursement_assurance_deduit: regle.conditions?.remboursementAssuranceDeduit ?? null,
  confiance: regle.detection.confiance,
  detection_source: regle.detection.source,
  validation_statut: regle.validation.statut,
  valide_le: regle.validation.valideLe ?? null,
  valide_par: regle.validation.validePar ?? null,
});

const regleDepuisDB = (r: any): ReglePartage => ({
  id: r.id,
  categorie: r.categorie,
  partA: r.part_a,
  partB: r.part_b,
  clauseSource:
    r.clause_reference || r.clause_extrait || r.clause_page
      ? { reference: r.clause_reference ?? undefined, extrait: r.clause_extrait ?? undefined, page: r.clause_page ?? undefined }
      : undefined,
  conditions: {
    accordPrealable: r.accord_prealable ?? undefined,
    plafondMontant: r.plafond_montant ?? undefined,
    justificatifObligatoire: r.justificatif_obligatoire ?? undefined,
    remboursementAssuranceDeduit: r.remboursement_assurance_deduit ?? undefined,
  },
  detection: { confiance: r.confiance, source: r.detection_source },
  validation: { statut: r.validation_statut, valideLe: r.valide_le ?? undefined, validePar: r.valide_par ?? undefined },
});

const cadreDepuisDB = (c: any, regles: any[]): CadreFamilial => ({
  id: c.id,
  statut: c.statut,
  valideLe: c.valide_le ?? undefined,
  pension:
    c.pension_montant != null
      ? { montant: c.pension_montant, periodicite: c.pension_periodicite ?? 'autre' }
      : undefined,
  documentSource: c.document_source_type
    ? { id: c.id, type: c.document_source_type, date: c.document_source_date ?? undefined }
    : undefined,
  regles: regles.map(regleDepuisDB),
});

async function assurerCadreFamilialDistant(familleId: string, cadre: CadreFamilial): Promise<string> {
  const { data, error } = await supabase
    .from('cadre_familial')
    .upsert(
      {
        famille_id: familleId,
        pension_montant: cadre.pension?.montant ?? null,
        pension_periodicite: cadre.pension?.periodicite ?? null,
        document_source_type: cadre.documentSource?.type ?? null,
        document_source_date: cadre.documentSource?.date ?? null,
        statut: cadre.statut,
        valide_le: cadre.valideLe ?? null,
      },
      { onConflict: 'famille_id' }
    )
    .select('id')
    .single();

  if (error || !data) {
    throw error ?? new Error('Échec de la création du cadre familial distant');
  }
  return data.id as string;
}

const evenementCalendrierVersDB = (ev: EvenementCalendrier, familleId: string, parentUuid?: string) => ({
  famille_id: familleId,
  titre: ev.titre,
  date: ev.date,
  parent_id: parentUuid ?? null,
});

const evenementCalendrierDepuisDB = (e: any, roleParUuid: Record<string, ParentRole>): EvenementCalendrier => ({
  id: e.id,
  titre: e.titre,
  date: e.date,
  parentId: (e.parent_id && roleParUuid[e.parent_id]) || 'A',
  sourceMessageId: e.source_message_id ?? undefined,
});

const depenseVersDB = (dep: Depense, familleId: string, auteurUuid?: string) => ({
  famille_id: familleId,
  categorie: dep.categorie,
  montant: dep.montant,
  description: dep.description || null,
  auteur_id: auteurUuid ?? null,
  date: dep.date.split('T')[0],
  rembourse: dep.rembourse,
  part_a: dep.partA ?? null,
  part_b: dep.partB ?? null,
  commercant: dep.commercant ?? null,
  lignes_detail: dep.lignesDetail ?? null,
});

const depenseDepuisDB = (d: any, roleParUuid: Record<string, ParentRole>): Depense => ({
  id: d.id,
  categorie: d.categorie,
  montant: Number(d.montant),
  description: d.description ?? '',
  auteurId: (d.auteur_id && roleParUuid[d.auteur_id]) || 'A',
  date: d.date,
  rembourse: d.rembourse ?? false,
  partA: d.part_a != null ? Number(d.part_a) : undefined,
  partB: d.part_b != null ? Number(d.part_b) : undefined,
  commercant: d.commercant ?? undefined,
  lignesDetail: d.lignes_detail ?? undefined,
});

const journalVersDB = (entry: JournalEntry, familleId: string, auteurUuid?: string) => ({
  famille_id: familleId,
  titre: entry.titre,
  description: entry.description || null,
  emoji: entry.emoji || null,
  auteur_id: auteurUuid ?? null,
  date: entry.date.split('T')[0],
  liked: entry.liked,
  date_revelation: entry.dateRevelation ? entry.dateRevelation.split('T')[0] : null,
  recit_croise: entry.recitCroise ?? null,
});

const journalDepuisDB = (e: any, roleParUuid: Record<string, ParentRole>): JournalEntry => ({
  id: e.id,
  titre: e.titre,
  description: e.description ?? '',
  emoji: e.emoji ?? '',
  auteurId: (e.auteur_id && roleParUuid[e.auteur_id]) || 'A',
  date: e.date,
  liked: e.liked ?? false,
  dateRevelation: e.date_revelation ?? undefined,
  recitCroise: e.recit_croise ?? undefined,
});

// ---------- Décisions : correspondance avec Supabase ----------
// IMPORTANT — honnêteté sur horodatageEIDAS/signatureToken : malgré leur
// nom, ce ne sont PAS des horodatages eIDAS/QTSP certifiés. Le token est
// généré côté client (Date.now() + chaîne aléatoire), sans passer par un
// prestataire de confiance qualifié. C'est un horodatage interne simple —
// utile pour tracer qui a accepté quoi et quand, mais qui n'a aucune valeur
// probante légale au sens du règlement eIDAS. Ne jamais présenter ce champ
// comme une signature électronique qualifiée dans un pitch, une doc client
// ou un support investisseur tant qu'un vrai prestataire n'est pas branché.

const decisionVersDB = (d: Decision, familleId: string, auteurUuid?: string) => ({
  famille_id: familleId,
  titre: d.titre,
  description: d.description || null,
  date_creation: d.dateCreation,
  auteur_id: auteurUuid ?? null,
  statut: d.statut,
  horodatage_eidas: d.horodatageEIDAS ?? null,
  signature_token: d.signatureToken ?? null,
});

const decisionDepuisDB = (row: any, roleParUuid: Record<string, ParentRole>): Decision => ({
  id: row.id,
  titre: row.titre,
  description: row.description ?? '',
  dateCreation: row.date_creation,
  auteurId: (row.auteur_id && roleParUuid[row.auteur_id]) || 'A',
  statut: row.statut,
  horodatageEIDAS: row.horodatage_eidas ?? undefined,
  signatureToken: row.signature_token ?? undefined,
});

const decisionUpdatesVersDB = (updates: Partial<Decision>) => {
  const out: Record<string, any> = {};
  if (updates.titre !== undefined) out.titre = updates.titre;
  if (updates.description !== undefined) out.description = updates.description;
  if (updates.statut !== undefined) out.statut = updates.statut;
  if (updates.horodatageEIDAS !== undefined) out.horodatage_eidas = updates.horodatageEIDAS;
  if (updates.signatureToken !== undefined) out.signature_token = updates.signatureToken;
  return out;
};

// ---------- Messages : correspondance avec Supabase ----------

const messageVersDB = (m: Message, familleId: string, expediteurUuid?: string) => ({
  famille_id: familleId,
  expediteur_id: expediteurUuid ?? null,
  contenu: m.contenu,
  date_envoi: m.dateEnvoi,
  statut: m.statut,
  contenu_original: m.contenuOriginal ?? null,
  alerte_detectee: m.alerteDetectee ?? false,
});

const messageDepuisDB = (row: any, roleParUuid: Record<string, ParentRole>): Message => ({
  id: row.id,
  expediteurId: (row.expediteur_id && roleParUuid[row.expediteur_id]) || 'A',
  contenu: row.contenu,
  dateEnvoi: row.date_envoi,
  statut: row.statut,
  contenuOriginal: row.contenu_original ?? undefined,
  alerteDetectee: row.alerte_detectee ?? false,
});

// ---------- Documents : correspondance avec Supabase ----------
// Comme les autres écrans "métadonnées seules" (pas de vrai fichier
// uploadé ici, juste un nom + catégorie + statut), la synchronisation
// est directe, sans champ à exclure.

const documentVersDB = (doc: DocumentItem, familleId: string, auteurUuid?: string) => ({
  famille_id: familleId,
  nom: doc.nom,
  categorie: doc.categorie,
  auteur_id: auteurUuid ?? null,
  date: doc.date.split('T')[0],
  certifie: doc.certifie,
  note: doc.note ?? null,
});

const documentDepuisDB = (row: any, roleParUuid: Record<string, ParentRole>): DocumentItem => ({
  id: row.id,
  nom: row.nom,
  categorie: row.categorie,
  auteurId: (row.auteur_id && roleParUuid[row.auteur_id]) || 'A',
  date: row.date,
  certifie: row.certifie ?? false,
  note: row.note ?? undefined,
});

// ---------- Tiers (accès grands-parents / nounous / école) : correspondance avec Supabase ----------

const tiersVersDB = (tr: Tiers, familleId: string, inviteParUuid?: string) => ({
  famille_id: familleId,
  nom: tr.nom,
  email: tr.email,
  role: tr.role,
  statut: tr.statut,
  invite_par: inviteParUuid ?? null,
  cree_le: tr.creeLe,
});

const tiersDepuisDB = (row: any, roleParUuid: Record<string, ParentRole>): Tiers => ({
  id: row.id,
  nom: row.nom,
  email: row.email,
  role: row.role,
  statut: row.statut,
  invitePar: (row.invite_par && roleParUuid[row.invite_par]) || 'A',
  creeLe: row.cree_le,
});

// ---------- Essentiel de l'enfant : correspondance avec Supabase ----------

const enfantVersDB = (e: Enfant, familleId: string) => ({
  famille_id: familleId,
  prenom: e.prenom,
  date_naissance: e.dateNaissance ? e.dateNaissance.split('T')[0] : null,
  ecole: e.ecole || null,
  medecin_traitant: e.medecinTraitant || null,
  medecin_telephone: e.medecinTelephone || null,
  allergies: e.allergies || null,
  groupe_sanguin: e.groupeSanguin || null,
  mutuelle: e.mutuelle || null,
  photo_url: e.photoUrl || null,
});

const enfantDepuisDB = (row: any, contacts: ContactUrgence[]): Enfant => ({
  id: row.id,
  prenom: row.prenom,
  dateNaissance: row.date_naissance ?? undefined,
  ecole: row.ecole ?? undefined,
  medecinTraitant: row.medecin_traitant ?? undefined,
  medecinTelephone: row.medecin_telephone ?? undefined,
  allergies: row.allergies ?? undefined,
  groupeSanguin: row.groupe_sanguin ?? undefined,
  mutuelle: row.mutuelle ?? undefined,
  photoUrl: row.photo_url ?? undefined,
  contactsUrgence: contacts,
});

const contactUrgenceVersDB = (c: ContactUrgence, familleId: string) => ({
  famille_id: familleId,
  enfant_id: c.enfantId,
  nom: c.nom,
  relation: c.relation || null,
  telephone: c.telephone,
  priorite: c.priorite,
});

const contactUrgenceDepuisDB = (row: any): ContactUrgence => ({
  id: row.id,
  enfantId: row.enfant_id,
  nom: row.nom,
  relation: row.relation ?? undefined,
  telephone: row.telephone,
  priorite: row.priorite ?? 0,
});

// ---------- Le Fil de vie : correspondance avec Supabase ----------
// aime_par est stocké en base comme un tableau d'uuids (parents.id) ; on le
// traduit en ParentRole[] via roleParUuid, comme pour les autres tables.

const momentDepuisDB = (row: any, roleParUuid: Record<string, ParentRole>): Moment => ({
  id: row.id,
  auteurId: (row.auteur_id && roleParUuid[row.auteur_id]) || 'A',
  enfant: row.enfant ?? undefined,
  texte: row.texte ?? undefined,
  photoUrl: row.photo_url ?? undefined,
  aimePar: (row.aime_par ?? [])
    .map((uuid: string) => roleParUuid[uuid])
    .filter((role: ParentRole | undefined): role is ParentRole => !!role),
  createdAt: row.created_at,
});

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

const FAMILY_CARD_FR = {
  enfants: 'Emma & Léo',
  localisation: 'En famille — Paris',
};

const FAMILY_CARD_PT = {
  enfants: 'Emma & Léo',
  localisation: 'Em família — Lisboa',
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
  familyCard: typeof FAMILY_CARD_FR;

  setParentActif: (id: ParentRole) => void;
  ajouterEvenement: (ev: EvenementGarde) => void;
  evenementsCalendrier: EvenementCalendrier[];
  ajouterEvenementCalendrier: (ev: EvenementCalendrier) => void;
  ignorerSuggestion: (messageId: string) => void;
  messagesAnalyses: string[];
  marquerMessageAnalyse: (id: string) => void;
  // Suggestions d'événement détectées par l'IA dans un message (en attente
  // de Confirmer/Ignorer) — vit dans le store global (pas en state local de
  // l'écran Messages) pour que le compteur "À traiter" de l'accueil puisse
  // les voir même sans avoir ouvert l'écran Messages dans cette session.
  suggestionsMessages: Record<string, { titre: string; date: string; enfant: string | null }>;
  ajouterSuggestionMessage: (msgId: string, sug: { titre: string; date: string; enfant: string | null }) => void;
  retirerSuggestionMessage: (msgId: string) => void;
  supprimerEvenement: (id: string) => void;
  ajouterDecision: (d: Decision) => void;
  mettreAJourDecision: (id: string, updates: Partial<Decision>) => void;
  ajouterMessage: (m: Message) => void;

  // ---------- Accès tiers (grands-parents, nounous, école) ----------
  tiers: Tiers[];
  inviterTiers: (tr: Tiers) => void;
  revoquerTiers: (id: string) => void;
  horodaterDecision: (id: string) => void;
  ajouterJournal: (entry: JournalEntry) => void;
  likerEntree: (id: string) => void;
  ajouterRecitCroise: (id: string, texte: string) => void;
  ajouterDepense: (dep: Depense) => void;
  reglerDepense: (id: string) => void;
  ajouterDocument: (doc: DocumentItem) => void;
  setNouvelleDecisionDraft: (texte: string | null) => void;
  setLangue: (langue: Langue) => void;

  // Essentiel de l'enfant — fiche + contacts d'urgence, un jeu par enfant.
  enfants: Enfant[];
  ajouterEnfant: (e: Enfant, photoUri?: string) => Promise<void>;
  modifierEnfant: (id: string, updates: Partial<Enfant>, photoUri?: string) => Promise<void>;
  supprimerEnfant: (id: string) => void;
  ajouterContactUrgence: (c: ContactUrgence) => void;
  modifierContactUrgence: (id: string, updates: Partial<ContactUrgence>) => void;
  supprimerContactUrgence: (id: string) => void;

  // Le Fil de vie — moments partagés au quotidien.
  moments: Moment[];
  ajouterMoment: (params: { texte?: string; enfant?: string; photoUri?: string }) => Promise<void>;
  reagirMoment: (momentId: string) => void;

  cadreFamilial: CadreFamilial | null;
  setCadreFamilial: (cadre: CadreFamilial) => void;
  synchroniserCadreFamilial: (cadre: CadreFamilial) => Promise<void>;
  validerRegle: (regleId: string, validePar?: string) => void;
  rejeterRegle: (regleId: string) => void;
  ajouterRegleManuelle: (regle: ReglePartage) => void;
  modifierRegle: (regleId: string, updates: { partA: number; partB: number }) => void;
  finaliserCadreFamilial: () => void;

  propositionsRepartition: PropositionRepartition[];
  creerProposition: (proposition: PropositionRepartition) => void;
  confirmerProposition: (id: string, confirmePar?: string) => void;
  modifierProposition: (
    id: string,
    repartitionFinale: { partA: number; partB: number; montantPartA: number; montantPartB: number },
    confirmePar?: string
  ) => void;
  refuserProposition: (id: string) => void;

  familleId: string | null;
  chargementInitial: boolean;
  initialiserSession: () => Promise<void>;
}

const rawStorage =
  Platform.OS === 'web'
    ? (typeof window !== 'undefined' ? localStorage : {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      })
    : AsyncStorage;

const storageAvecAlerte = {
  getItem: (name: string) => rawStorage.getItem(name),
  removeItem: (name: string) => rawStorage.removeItem(name),
  setItem: (name: string, value: string) => {
    try {
      const resultat = rawStorage.setItem(name, value);
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
    (set, get) => ({
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
  familyCard: FAMILY_CARD_FR,

  setParentActif: (id) => set({ parentActif: id }),

  ajouterEvenement: (ev) =>
    set((state) => ({ evenements: [...state.evenements, ev] })),
      evenementsCalendrier: [],
      ajouterEvenementCalendrier: (ev) => {
        set((state) => ({ evenementsCalendrier: [...state.evenementsCalendrier, ev] }));

        const { familleId, parents } = get();
        if (!familleId) {
          console.error('[Dualia] Événement non synchronisé : aucune famille active.');
          return;
        }
        const parentUuid = parents[ev.parentId]?.uuid;
        supabase
          .from('evenements_calendrier')
          .insert(evenementCalendrierVersDB(ev, familleId, parentUuid))
          .select()
          .single()
          .then(({ data, error }) => {
            if (error || !data) {
              console.error('[Dualia] Échec synchronisation événement calendrier :', error);
              return;
            }
            set((state) => ({
              evenementsCalendrier: state.evenementsCalendrier.map((e) =>
                e === ev || e.id === ev.id ? { ...e, id: data.id } : e
              ),
            }));
          });
      },
      ignorerSuggestion: (messageId) =>
        set((state) => ({ messagesAnalyses: [...state.messagesAnalyses, messageId] })),
      messagesAnalyses: [],
      marquerMessageAnalyse: (id) =>
        set((state) => ({ messagesAnalyses: [...state.messagesAnalyses, id] })),
      suggestionsMessages: {},
      ajouterSuggestionMessage: (msgId, sug) =>
        set((state) => ({ suggestionsMessages: { ...state.suggestionsMessages, [msgId]: sug } })),
      retirerSuggestionMessage: (msgId) =>
        set((state) => {
          const next = { ...state.suggestionsMessages };
          delete next[msgId];
          return { suggestionsMessages: next };
        }),

  supprimerEvenement: (id) =>
    set((state) => ({ evenements: state.evenements.filter((e) => e.id !== id) })),

  ajouterDecision: (d) => {
    set((state) => ({ decisions: [d, ...state.decisions] }));

    const { familleId, parents } = get();
    if (!familleId) {
      console.error('[Dualia] Décision non synchronisée : aucune famille active.');
      return;
    }
    const auteurUuid = parents[d.auteurId]?.uuid;
    supabase
      .from('decisions')
      .insert(decisionVersDB(d, familleId, auteurUuid))
      .select()
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          console.error('[Dualia] Échec synchronisation décision :', error);
          return;
        }
        set((state) => ({
          decisions: state.decisions.map((dec) =>
            dec === d || dec.id === d.id ? { ...dec, id: data.id } : dec
          ),
        }));
      });
  },

  mettreAJourDecision: (id, updates) => {
    set((state) => ({
      decisions: state.decisions.map((d) =>
        d.id === id ? { ...d, ...updates } : d
      ),
    }));
    const dbUpdates = decisionUpdatesVersDB(updates);
    if (Object.keys(dbUpdates).length === 0) return;
    supabase
      .from('decisions')
      .update(dbUpdates)
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('[Dualia] Échec sync mise à jour décision (distant) :', error);
      });
  },

  ajouterMessage: (m) => {
    set((state) => ({ messages: [...state.messages, m] }));

    const { familleId, parents } = get();
    if (!familleId) {
      console.error('[Dualia] Message non synchronisé : aucune famille active.');
      return;
    }
    const expediteurUuid = parents[m.expediteurId]?.uuid;
    supabase
      .from('messages')
      .insert(messageVersDB(m, familleId, expediteurUuid))
      .select()
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          console.error('[Dualia] Échec synchronisation message :', error);
          return;
        }
        set((state) => ({
          messages: state.messages.map((msg) =>
            msg === m || msg.id === m.id ? { ...msg, id: data.id } : msg
          ),
        }));
      });
  },

  tiers: [],

  inviterTiers: (tr) => {
    set((state) => ({ tiers: [...state.tiers, tr] }));

    const { familleId, parents } = get();
    if (!familleId) {
      console.error('[Dualia] Accès tiers non synchronisé : aucune famille active.');
      return;
    }
    const inviteParUuid = parents[tr.invitePar]?.uuid;
    supabase
      .from('tiers')
      .insert(tiersVersDB(tr, familleId, inviteParUuid))
      .select()
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          console.error('[Dualia] Échec synchronisation accès tiers :', error);
          return;
        }
        set((state) => ({
          tiers: state.tiers.map((t) => (t === tr || t.id === tr.id ? { ...t, id: data.id } : t)),
        }));
      });
  },

  revoquerTiers: (id) => {
    set((state) => ({
      tiers: state.tiers.map((t) => (t.id === id ? { ...t, statut: 'revoque' } : t)),
    }));
    supabase
      .from('tiers')
      .update({ statut: 'revoque' })
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('[Dualia] Échec révocation accès tiers (distant) :', error);
      });
  },

  horodaterDecision: (id) => {
    const token = `EIDAS-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const horodatageEIDAS = new Date().toISOString();
    set((state) => ({
      decisions: state.decisions.map((d) =>
        d.id === id
          ? {
              ...d,
              horodatageEIDAS,
              signatureToken: token,
              statut: 'acceptée' as const,
            }
          : d
      ),
    }));
    supabase
      .from('decisions')
      .update({ horodatage_eidas: horodatageEIDAS, signature_token: token, statut: 'acceptée' })
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('[Dualia] Échec sync horodatage décision (distant) :', error);
      });
  },

  ajouterJournal: (entry) => {
    set((state) => ({ journalEntries: [entry, ...state.journalEntries] }));

    const { familleId, parents } = get();
    if (!familleId) {
      console.error('[Dualia] Entrée de journal non synchronisée : aucune famille active.');
      return;
    }
    const auteurUuid = parents[entry.auteurId]?.uuid;
    supabase
      .from('journal_entries')
      .insert(journalVersDB(entry, familleId, auteurUuid))
      .select()
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          console.error('[Dualia] Échec synchronisation entrée de journal :', error);
          return;
        }
        set((state) => ({
          journalEntries: state.journalEntries.map((e) =>
            e === entry || e.id === entry.id ? { ...e, id: data.id } : e
          ),
        }));
      });
  },

  likerEntree: (id) => {
    const entreeActuelle = get().journalEntries.find((e) => e.id === id);
    if (!entreeActuelle) return;
    const nouveauLike = !entreeActuelle.liked;
    set((state) => ({
      journalEntries: state.journalEntries.map((e) =>
        e.id === id ? { ...e, liked: nouveauLike } : e
      ),
    }));
    supabase
      .from('journal_entries')
      .update({ liked: nouveauLike })
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('[Dualia] Échec sync like entrée journal (distant) :', error);
      });
  },

  ajouterRecitCroise: (id, texte) => {
    set((state) => ({
      journalEntries: state.journalEntries.map((e) =>
        e.id === id ? { ...e, recitCroise: texte } : e
      ),
    }));
    supabase
      .from('journal_entries')
      .update({ recit_croise: texte })
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('[Dualia] Échec sync récit croisé (distant) :', error);
      });
  },

  ajouterDepense: (dep) => {
    set((state) => ({ depenses: [dep, ...state.depenses] }));

    const { familleId, parents } = get();
    if (!familleId) {
      console.error('[Dualia] Dépense non synchronisée : aucune famille active.');
      return;
    }
    const auteurUuid = parents[dep.auteurId]?.uuid;
    supabase
      .from('depenses')
      .insert(depenseVersDB(dep, familleId, auteurUuid))
      .select()
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          console.error('[Dualia] Échec synchronisation dépense :', error);
          return;
        }
        set((state) => ({
          depenses: state.depenses.map((d) =>
            d === dep || d.id === dep.id ? { ...d, id: data.id } : d
          ),
        }));
      });
  },

  ajouterDocument: (doc) => {
    set((state) => ({ documents: [doc, ...state.documents] }));

    const { familleId, parents } = get();
    if (!familleId) {
      console.error('[Dualia] Document non synchronisé : aucune famille active.');
      return;
    }
    const auteurUuid = parents[doc.auteurId]?.uuid;
    supabase
      .from('documents')
      .insert(documentVersDB(doc, familleId, auteurUuid))
      .select()
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          console.error('[Dualia] Échec synchronisation document :', error);
          return;
        }
        set((state) => ({
          documents: state.documents.map((d) =>
            d === doc || d.id === doc.id ? { ...d, id: data.id } : d
          ),
        }));
      });
  },

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
        familyCard: FAMILY_CARD_FR,
      });
    }
  },

  reglerDepense: (id) => {
    set((state) => ({
      depenses: state.depenses.map((d) =>
        d.id === id ? { ...d, rembourse: true } : d
      ),
    }));
    supabase
      .from('depenses')
      .update({ rembourse: true })
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('[Dualia] Échec sync règlement dépense (distant) :', error);
      });
  },

  // ---------- Essentiel de l'enfant ----------
  enfants: [],

  ajouterEnfant: async (e, photoUri) => {
    const familleId = get().familleId;

    // Téléverse la photo AVANT l'insertion, comme pour un moment du Fil de
    // vie : on n'a pas besoin de l'id réel de l'enfant pour ça, juste du
    // nom du fichier.
    let photoUrl = e.photoUrl;
    if (photoUri && familleId) {
      try {
        const reponse = await fetch(photoUri);
        const blob = await reponse.blob();
        const nomFichier = `${familleId}/${Date.now()}.jpg`;
        const { error: erreurUpload } = await supabase.storage
          .from('enfants-photos')
          .upload(nomFichier, blob, { contentType: 'image/jpeg' });
        if (erreurUpload) {
          console.error('[Dualia] Échec envoi photo enfant :', erreurUpload);
        } else {
          const { data } = supabase.storage.from('enfants-photos').getPublicUrl(nomFichier);
          photoUrl = data.publicUrl;
        }
      } catch (err) {
        console.error('[Dualia] Échec traitement photo enfant :', err);
      }
    }

    const enfantAvecPhoto = { ...e, photoUrl };
    set((state) => ({ enfants: [...state.enfants, enfantAvecPhoto] }));

    if (!familleId) {
      console.error("[Dualia] Enfant non synchronisé : aucune famille active.");
      return;
    }
    const { data, error } = await supabase
      .from('enfants')
      .insert(enfantVersDB(enfantAvecPhoto, familleId))
      .select()
      .single();

    if (error || !data) {
      console.error('[Dualia] Échec synchronisation enfant :', error);
      return;
    }
    set((state) => ({
      enfants: state.enfants.map((en) =>
        en === enfantAvecPhoto || en.id === e.id ? { ...en, id: data.id } : en
      ),
    }));
  },

  modifierEnfant: async (id, updates, photoUri) => {
    const familleId = get().familleId;
    let photoUrl = updates.photoUrl;
    if (photoUri && familleId) {
      try {
        const reponse = await fetch(photoUri);
        const blob = await reponse.blob();
        const nomFichier = `${familleId}/${Date.now()}.jpg`;
        const { error: erreurUpload } = await supabase.storage
          .from('enfants-photos')
          .upload(nomFichier, blob, { contentType: 'image/jpeg' });
        if (erreurUpload) {
          console.error('[Dualia] Échec envoi photo enfant :', erreurUpload);
        } else {
          const { data } = supabase.storage.from('enfants-photos').getPublicUrl(nomFichier);
          photoUrl = data.publicUrl;
        }
      } catch (err) {
        console.error('[Dualia] Échec traitement photo enfant :', err);
      }
    }
    const updatesAvecPhoto = photoUrl !== undefined ? { ...updates, photoUrl } : updates;

    set((state) => ({
      enfants: state.enfants.map((e) => (e.id === id ? { ...e, ...updatesAvecPhoto } : e)),
    }));
    const dbUpdates: Record<string, any> = {};
    if (updatesAvecPhoto.prenom !== undefined) dbUpdates.prenom = updatesAvecPhoto.prenom;
    if (updatesAvecPhoto.dateNaissance !== undefined)
      dbUpdates.date_naissance = updatesAvecPhoto.dateNaissance ? updatesAvecPhoto.dateNaissance.split('T')[0] : null;
    if (updatesAvecPhoto.ecole !== undefined) dbUpdates.ecole = updatesAvecPhoto.ecole || null;
    if (updatesAvecPhoto.medecinTraitant !== undefined) dbUpdates.medecin_traitant = updatesAvecPhoto.medecinTraitant || null;
    if (updatesAvecPhoto.medecinTelephone !== undefined) dbUpdates.medecin_telephone = updatesAvecPhoto.medecinTelephone || null;
    if (updatesAvecPhoto.allergies !== undefined) dbUpdates.allergies = updatesAvecPhoto.allergies || null;
    if (updatesAvecPhoto.groupeSanguin !== undefined) dbUpdates.groupe_sanguin = updatesAvecPhoto.groupeSanguin || null;
    if (updatesAvecPhoto.mutuelle !== undefined) dbUpdates.mutuelle = updatesAvecPhoto.mutuelle || null;
    if (updatesAvecPhoto.photoUrl !== undefined) dbUpdates.photo_url = updatesAvecPhoto.photoUrl || null;
    if (Object.keys(dbUpdates).length === 0) return;
    const { error } = await supabase.from('enfants').update(dbUpdates).eq('id', id);
    if (error) console.error('[Dualia] Échec sync mise à jour enfant (distant) :', error);
  },

  supprimerEnfant: (id) => {
    set((state) => ({ enfants: state.enfants.filter((e) => e.id !== id) }));
    supabase
      .from('enfants')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('[Dualia] Échec sync suppression enfant (distant) :', error);
      });
  },

  ajouterContactUrgence: (c) => {
    set((state) => ({
      enfants: state.enfants.map((e) =>
        e.id === c.enfantId ? { ...e, contactsUrgence: [...e.contactsUrgence, c] } : e
      ),
    }));

    const familleId = get().familleId;
    if (!familleId) {
      console.error("[Dualia] Contact d'urgence non synchronisé : aucune famille active.");
      return;
    }
    supabase
      .from('contacts_urgence')
      .insert(contactUrgenceVersDB(c, familleId))
      .select()
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          console.error("[Dualia] Échec synchronisation contact d'urgence :", error);
          return;
        }
        set((state) => ({
          enfants: state.enfants.map((e) =>
            e.id === c.enfantId
              ? {
                  ...e,
                  contactsUrgence: e.contactsUrgence.map((ct) =>
                    ct === c || ct.id === c.id ? { ...ct, id: data.id } : ct
                  ),
                }
              : e
          ),
        }));
      });
  },

  modifierContactUrgence: (id, updates) => {
    set((state) => ({
      enfants: state.enfants.map((e) => ({
        ...e,
        contactsUrgence: e.contactsUrgence.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      })),
    }));
    const dbUpdates: Record<string, any> = {};
    if (updates.nom !== undefined) dbUpdates.nom = updates.nom;
    if (updates.relation !== undefined) dbUpdates.relation = updates.relation || null;
    if (updates.telephone !== undefined) dbUpdates.telephone = updates.telephone;
    if (updates.priorite !== undefined) dbUpdates.priorite = updates.priorite;
    if (Object.keys(dbUpdates).length === 0) return;
    supabase
      .from('contacts_urgence')
      .update(dbUpdates)
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('[Dualia] Échec sync mise à jour contact urgence (distant) :', error);
      });
  },

  supprimerContactUrgence: (id) => {
    set((state) => ({
      enfants: state.enfants.map((e) => ({
        ...e,
        contactsUrgence: e.contactsUrgence.filter((c) => c.id !== id),
      })),
    }));
    supabase
      .from('contacts_urgence')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('[Dualia] Échec sync suppression contact urgence (distant) :', error);
      });
  },

  // ---------- Le Fil de vie ----------
  moments: [],

  ajouterMoment: async ({ texte, enfant, photoUri }) => {
    const { familleId, parentActif, parents } = get();
    if (!familleId) {
      console.error('[Dualia] Moment non synchronisé : aucune famille active.');
      return;
    }

    let photoUrl: string | undefined;
    if (photoUri) {
      try {
        const reponse = await fetch(photoUri);
        const blob = await reponse.blob();
        const nomFichier = `${familleId}/${Date.now()}.jpg`;
        const { error: erreurUpload } = await supabase.storage
          .from('moments-photos')
          .upload(nomFichier, blob, { contentType: 'image/jpeg' });
        if (erreurUpload) {
          console.error('[Dualia] Échec envoi photo du moment :', erreurUpload);
        } else {
          const { data } = supabase.storage.from('moments-photos').getPublicUrl(nomFichier);
          photoUrl = data.publicUrl;
        }
      } catch (e) {
        console.error('[Dualia] Échec traitement photo du moment :', e);
      }
    }

    const auteurUuid = parents[parentActif]?.uuid;
    const { data, error } = await supabase
      .from('moments')
      .insert({
        famille_id: familleId,
        auteur_id: auteurUuid ?? null,
        enfant: enfant || null,
        texte: texte || null,
        photo_url: photoUrl || null,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('[Dualia] Échec synchronisation moment :', error);
      throw error ?? new Error('Échec de création du moment');
    }

    const roleParUuidLocal: Record<string, ParentRole> = {};
    Object.values(parents).forEach((p) => {
      if (p.uuid) roleParUuidLocal[p.uuid] = p.id;
    });

    set((state) => ({
      moments: [momentDepuisDB(data, roleParUuidLocal), ...state.moments],
    }));
  },

  reagirMoment: (momentId) => {
    const { parentActif, parents } = get();
    set((state) => ({
      moments: state.moments.map((m) => {
        if (m.id !== momentId) return m;
        const dejaAime = m.aimePar.includes(parentActif);
        return {
          ...m,
          aimePar: dejaAime ? m.aimePar.filter((r) => r !== parentActif) : [...m.aimePar, parentActif],
        };
      }),
    }));

    const monUuid = parents[parentActif]?.uuid;
    if (!monUuid) return;
    supabase
      .rpc('toggle_aime_moment', { p_moment_id: momentId, p_parent_id: monUuid })
      .then(({ error }: { error: any }) => {
        if (error) console.error('[Dualia] Échec sync réaction moment (distant) :', error);
      });
  },

  cadreFamilial: null,

  setCadreFamilial: (cadre) => set({ cadreFamilial: cadre }),

  synchroniserCadreFamilial: async (cadre) => {
    set({ cadreFamilial: cadre });

    const familleId = get().familleId;
    if (!familleId) {
      console.error('[Dualia] Cadre familial non synchronisé : aucune famille active.');
      return;
    }

    try {
      const cadreFamilialId = await assurerCadreFamilialDistant(familleId, cadre);

      const { error: erreurSuppression } = await supabase
        .from('regles_partage')
        .delete()
        .eq('cadre_familial_id', cadreFamilialId);
      if (erreurSuppression) throw erreurSuppression;

      let reglesSyncees: ReglePartage[] = [];
      if (cadre.regles.length > 0) {
        const { data, error } = await supabase
          .from('regles_partage')
          .insert(cadre.regles.map((r) => regleVersDB(r, cadreFamilialId)))
          .select();
        if (error) throw error;
        reglesSyncees = (data ?? []).map(regleDepuisDB);
      }

      set((state) => ({
        cadreFamilial: state.cadreFamilial
          ? { ...state.cadreFamilial, id: cadreFamilialId, regles: reglesSyncees }
          : state.cadreFamilial,
      }));
    } catch (e) {
      console.error('[Dualia] Échec de la synchronisation du cadre familial :', e);
      throw e;
    }
  },

  validerRegle: (regleId, validePar) => {
    const valideLe = new Date().toISOString();
    set((state) => {
      if (!state.cadreFamilial) return state;
      return {
        cadreFamilial: {
          ...state.cadreFamilial,
          regles: state.cadreFamilial.regles.map((r) =>
            r.id === regleId
              ? { ...r, validation: { statut: 'validee' as const, valideLe, validePar } }
              : r
          ),
        },
      };
    });
    supabase
      .from('regles_partage')
      .update({ validation_statut: 'validee', valide_le: valideLe, valide_par: validePar ?? null })
      .eq('id', regleId)
      .then(({ error }) => {
        if (error) console.error('[Dualia] Échec validation règle (distant) :', error);
      });
  },

  rejeterRegle: (regleId) => {
    set((state) => {
      if (!state.cadreFamilial) return state;
      return {
        cadreFamilial: {
          ...state.cadreFamilial,
          regles: state.cadreFamilial.regles.map((r) =>
            r.id === regleId ? { ...r, validation: { ...r.validation, statut: 'rejetee' as const } } : r
          ),
        },
      };
    });
    supabase
      .from('regles_partage')
      .update({ validation_statut: 'rejetee' })
      .eq('id', regleId)
      .then(({ error }) => {
        if (error) console.error('[Dualia] Échec rejet règle (distant) :', error);
      });
  },

  ajouterRegleManuelle: (regle) =>
    set((state) => {
      const base: CadreFamilial = state.cadreFamilial ?? { regles: [], statut: 'a_verifier' };
      return { cadreFamilial: { ...base, regles: [...base.regles, regle] } };
    }),

  modifierRegle: (regleId, updates) => {
    set((state) => {
      if (!state.cadreFamilial) return state;
      return {
        cadreFamilial: {
          ...state.cadreFamilial,
          regles: state.cadreFamilial.regles.map((r) =>
            r.id === regleId ? { ...r, partA: updates.partA, partB: updates.partB } : r
          ),
        },
      };
    });
    supabase
      .from('regles_partage')
      .update({ part_a: updates.partA, part_b: updates.partB })
      .eq('id', regleId)
      .then(({ error }) => {
        if (error) console.error('[Dualia] Échec modification règle (distant) :', error);
      });
  },

  finaliserCadreFamilial: () => {
    const valideLe = new Date().toISOString();
    const cadreFamilialId = get().cadreFamilial?.id;
    set((state) => {
      if (!state.cadreFamilial) return state;
      return {
        cadreFamilial: {
          ...state.cadreFamilial,
          statut: 'valide',
          valideLe,
        },
      };
    });
    if (cadreFamilialId) {
      supabase
        .from('cadre_familial')
        .update({ statut: 'valide', valide_le: valideLe })
        .eq('id', cadreFamilialId)
        .then(({ error }) => {
          if (error) console.error('[Dualia] Échec finalisation cadre familial (distant) :', error);
        });
    } else {
      console.error('[Dualia] Finalisation locale seulement : cadre familial jamais synchronisé.');
    }
  },

  propositionsRepartition: [],

  creerProposition: (proposition) =>
    set((state) => ({ propositionsRepartition: [proposition, ...state.propositionsRepartition] })),

  confirmerProposition: (id, confirmePar) =>
    set((state) => ({
      propositionsRepartition: state.propositionsRepartition.map((p) =>
        p.id === id
          ? {
              ...p,
              statut: 'confirmee' as const,
              repartitionFinale: { ...p.propositionInitiale },
              confirmeLe: new Date().toISOString(),
              confirmePar,
            }
          : p
      ),
    })),

  modifierProposition: (id, repartitionFinale, confirmePar) =>
    set((state) => ({
      propositionsRepartition: state.propositionsRepartition.map((p) =>
        p.id === id
          ? {
              ...p,
              statut: 'modifiee' as const,
              repartitionFinale,
              confirmeLe: new Date().toISOString(),
              confirmePar,
            }
          : p
      ),
    })),

  refuserProposition: (id) =>
    set((state) => ({
      propositionsRepartition: state.propositionsRepartition.map((p) =>
        p.id === id ? { ...p, statut: 'refusee' as const } : p
      ),
    })),

  familleId: null,
  chargementInitial: true,

  initialiserSession: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      set({ chargementInitial: false });
      return;
    }

    const { data: moi, error: erreurMoi } = await supabase
      .from('parents')
      .select('id, famille_id, nom, role, couleur')
      .eq('id', user.id)
      .single();

    if (erreurMoi || !moi) {
      console.error('[Dualia] Impossible de charger le profil parent :', erreurMoi);
      set({ chargementInitial: false });
      return;
    }

    const { data: tousLesParents } = await supabase
      .from('parents')
      .select('id, nom, role, couleur')
      .eq('famille_id', moi.famille_id);

    const parentsMap: Record<ParentRole, Parent> = { ...PARENTS };
    (tousLesParents ?? []).forEach((p: any) => {
      const role = p.role as ParentRole;
      parentsMap[role] = {
        id: role,
        nom: p.nom,
        email: '',
        couleur: p.couleur ?? PARENTS[role].couleur,
        uuid: p.id,
      };
    });

    set({
      familleId: moi.famille_id,
      parentActif: moi.role as ParentRole,
      parents: parentsMap,
      chargementInitial: false,
    });

    const { data: cadreDB, error: erreurCadre } = await supabase
      .from('cadre_familial')
      .select('*')
      .eq('famille_id', moi.famille_id)
      .maybeSingle();

    if (erreurCadre) {
      console.error('[Dualia] Échec chargement cadre familial :', erreurCadre);
    } else if (cadreDB) {
      const { data: reglesDB } = await supabase
        .from('regles_partage')
        .select('*')
        .eq('cadre_familial_id', cadreDB.id);
      set({ cadreFamilial: cadreDepuisDB(cadreDB, reglesDB ?? []) });
    }

    const roleParUuid: Record<string, ParentRole> = {};
    (tousLesParents ?? []).forEach((p: any) => {
      roleParUuid[p.id] = p.role as ParentRole;
    });
    const { data: evenementsDB, error: erreurEvenements } = await supabase
      .from('evenements_calendrier')
      .select('*')
      .eq('famille_id', moi.famille_id);

    if (erreurEvenements) {
      console.error('[Dualia] Échec chargement événements calendrier :', erreurEvenements);
    } else if (evenementsDB && evenementsDB.length > 0) {
      set({
        evenementsCalendrier: evenementsDB.map((e: any) => evenementCalendrierDepuisDB(e, roleParUuid)),
      });
    }

    const { data: depensesDB, error: erreurDepenses } = await supabase
      .from('depenses')
      .select('*')
      .eq('famille_id', moi.famille_id)
      .order('date', { ascending: false });

    if (erreurDepenses) {
      console.error('[Dualia] Échec chargement dépenses :', erreurDepenses);
    } else if (depensesDB && depensesDB.length > 0) {
      set({
        depenses: depensesDB.map((d: any) => depenseDepuisDB(d, roleParUuid)),
      });
    }

    const { data: journalDB, error: erreurJournal } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('famille_id', moi.famille_id)
      .order('date', { ascending: false });

    if (erreurJournal) {
      console.error('[Dualia] Échec chargement journal :', erreurJournal);
    } else if (journalDB && journalDB.length > 0) {
      set({
        journalEntries: journalDB.map((e: any) => journalDepuisDB(e, roleParUuid)),
      });
    }

    const { data: decisionsDB, error: erreurDecisions } = await supabase
      .from('decisions')
      .select('*')
      .eq('famille_id', moi.famille_id)
      .order('date_creation', { ascending: false });

    if (erreurDecisions) {
      console.error('[Dualia] Échec chargement décisions :', erreurDecisions);
    } else if (decisionsDB && decisionsDB.length > 0) {
      set({
        decisions: decisionsDB.map((row: any) => decisionDepuisDB(row, roleParUuid)),
      });
    }

    const { data: messagesDB, error: erreurMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('famille_id', moi.famille_id)
      .order('date_envoi', { ascending: true });

    if (erreurMessages) {
      console.error('[Dualia] Échec chargement messages :', erreurMessages);
    } else if (messagesDB && messagesDB.length > 0) {
      set({
        messages: messagesDB.map((row: any) => messageDepuisDB(row, roleParUuid)),
      });
    }

    const { data: tiersDB, error: erreurTiers } = await supabase
      .from('tiers')
      .select('*')
      .eq('famille_id', moi.famille_id)
      .order('cree_le', { ascending: false });

    if (erreurTiers) {
      console.error('[Dualia] Échec chargement accès tiers :', erreurTiers);
    } else if (tiersDB && tiersDB.length > 0) {
      set({
        tiers: tiersDB.map((row: any) => tiersDepuisDB(row, roleParUuid)),
      });
    }

    const { data: documentsDB, error: erreurDocuments } = await supabase
      .from('documents')
      .select('*')
      .eq('famille_id', moi.famille_id)
      .order('date', { ascending: false });

    if (erreurDocuments) {
      console.error('[Dualia] Échec chargement documents :', erreurDocuments);
    } else if (documentsDB && documentsDB.length > 0) {
      set({
        documents: documentsDB.map((row: any) => documentDepuisDB(row, roleParUuid)),
      });
    }

    const { data: enfantsDB, error: erreurEnfants } = await supabase
      .from('enfants')
      .select('*')
      .eq('famille_id', moi.famille_id)
      .order('prenom', { ascending: true });

    if (erreurEnfants) {
      console.error('[Dualia] Échec chargement enfants :', erreurEnfants);
    } else if (enfantsDB && enfantsDB.length > 0) {
      const { data: contactsDB, error: erreurContacts } = await supabase
        .from('contacts_urgence')
        .select('*')
        .eq('famille_id', moi.famille_id)
        .order('priorite', { ascending: true });

      if (erreurContacts) {
        console.error("[Dualia] Échec chargement contacts d'urgence :", erreurContacts);
      }

      set({
        enfants: enfantsDB.map((row: any) =>
          enfantDepuisDB(
            row,
            (contactsDB ?? []).filter((c: any) => c.enfant_id === row.id).map(contactUrgenceDepuisDB)
          )
        ),
      });
    }

    // Charge le Fil de vie — les moments les plus récents en premier.
    const { data: momentsDB, error: erreurMoments } = await supabase
      .from('moments')
      .select('*')
      .eq('famille_id', moi.famille_id)
      .order('created_at', { ascending: false });

    if (erreurMoments) {
      console.error('[Dualia] Échec chargement Fil de vie :', erreurMoments);
    } else if (momentsDB && momentsDB.length > 0) {
      set({
        moments: momentsDB.map((row: any) => momentDepuisDB(row, roleParUuid)),
      });
    }
  },
}),
    {
      name: 'dualia-storage',
      storage: dualiaStorage,
      partialize: (state) => ({
        decisions: state.decisions,
        messages: state.messages,
        journalEntries: state.journalEntries,
        depenses: state.depenses.map(({ photoUri, ...rest }) => rest),
        documents: state.documents,
        parentActif: state.parentActif,
        langue: state.langue,
        evenements: state.evenements,
        evenementsCalendrier: state.evenementsCalendrier,
        messagesAnalyses: state.messagesAnalyses,
        suggestionsMessages: state.suggestionsMessages,
        cadreFamilial: state.cadreFamilial,
        propositionsRepartition: state.propositionsRepartition,
        enfants: state.enfants,
        moments: state.moments,
      }),
    }
  )
);