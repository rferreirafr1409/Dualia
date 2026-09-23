import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  EvenementGarde, Decision, Message, Parent, ParentRole,
  EvenementCalendrier,
  JournalEntry, Depense, DocumentItem,
  CadreFamilial, ReglePartage, PropositionRepartition,
  Enfant, ContactUrgence, Moment, Tiers, AgendaScolaireItem,
  Foyer, ConfigFoyers, DocumentPortee, AccesTiersActif,
} from '../types';
import { COLORS } from '../constants/theme';
import { Langue } from '../constants/i18n';
import { supabase } from '../constants/supabase';

const dernierDimancheDeMai = (annee: number): Date => {
  const d = new Date(annee, 4, 31);
  while (d.getDay() !== 0) d.setDate(d.getDate() - 1);
  return d;
};

const troisiemeDimancheDeJuin = (annee: number): Date => {
  const d = new Date(annee, 5, 1);
  while (d.getDay() !== 0) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + 14);
  return d;
};

const FETES_JUIVES: Record<string, Record<number, { debut: string; jours: number }>> = {
  'roch hachana': { 2026: { debut: '2026-09-12', jours: 2 }, 2027: { debut: '2027-10-02', jours: 2 }, 2028: { debut: '2028-09-21', jours: 2 } },
  'rosh hashana': { 2026: { debut: '2026-09-12', jours: 2 }, 2027: { debut: '2027-10-02', jours: 2 }, 2028: { debut: '2028-09-21', jours: 2 } },
  'kippour': { 2026: { debut: '2026-09-21', jours: 1 }, 2027: { debut: '2027-10-11', jours: 1 }, 2028: { debut: '2028-09-30', jours: 1 } },
  'yom kippour': { 2026: { debut: '2026-09-21', jours: 1 }, 2027: { debut: '2027-10-11', jours: 1 }, 2028: { debut: '2028-09-30', jours: 1 } },
  'souccot': { 2026: { debut: '2026-09-26', jours: 7 }, 2027: { debut: '2027-10-16', jours: 7 }, 2028: { debut: '2028-10-05', jours: 7 } },
  'souccoth': { 2026: { debut: '2026-09-26', jours: 7 }, 2027: { debut: '2027-10-16', jours: 7 }, 2028: { debut: '2028-10-05', jours: 7 } },
};

const VACANCES_ZONE_C: { nom: string; debut: string; fin: string }[] = [
  { nom: 'Vacances de la Toussaint', debut: '2026-10-17', fin: '2026-11-02' },
  { nom: 'Vacances de Noël', debut: '2026-12-19', fin: '2027-01-04' },
  { nom: "Vacances d'Hiver", debut: '2027-02-06', fin: '2027-02-22' },
  { nom: 'Vacances de Printemps', debut: '2027-04-03', fin: '2027-04-19' },
  { nom: "Pont de l'Ascension", debut: '2027-05-05', fin: '2027-05-10' },
  { nom: "Vacances d'Été", debut: '2027-07-03', fin: '2027-08-31' },
  { nom: 'Vacances de la Toussaint', debut: '2027-10-23', fin: '2027-11-08' },
  { nom: 'Vacances de Noël', debut: '2027-12-18', fin: '2028-01-03' },
  { nom: "Vacances d'Hiver", debut: '2028-02-12', fin: '2028-02-28' },
  { nom: 'Vacances de Printemps', debut: '2028-04-15', fin: '2028-05-02' },
];

// Repli utilisé tant que les vrais parents ne sont pas chargés depuis
// Supabase (et si ce chargement échoue). Aucun nom fictif : un bêta-testeur
// ne doit jamais voir apparaître une identité inventée à la place de la sienne.
// ---------- Photos : buckets prives et URL signees ----------
// La base stocke le CHEMIN du fichier dans le bucket, jamais une URL. Les URL
// sont signees a la volee, avec une duree de validite limitee : un lien qui
// fuite cesse de fonctionner, contrairement a une URL publique.
//
// Duree volontairement longue (12 h) car la signature est faite une seule fois,
// au chargement de l'espace familial, et non a chaque affichage. Une session
// laissee ouverte au-dela devra etre rechargee pour revoir les images.
const DUREE_SIGNATURE_SECONDES = 12 * 60 * 60;

// Tolere les deux formats pendant la transition : une valeur deja sous forme
// d'URL (ancienne donnee publique) est laissee telle quelle, seule une valeur
// qui ressemble a un chemin est signee.
const estUneUrl = (valeur?: string) => !!valeur && /^https?:\/\//i.test(valeur);

// Signe en une seule requete tous les chemins d'un bucket, plutot qu'une
// requete par image.
const signerChemins = async (
  bucket: string,
  chemins: (string | undefined)[]
): Promise<Record<string, string>> => {
  const aSigner = Array.from(
    new Set(chemins.filter((c): c is string => !!c && !estUneUrl(c)))
  );
  if (aSigner.length === 0) return {};
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(aSigner, DUREE_SIGNATURE_SECONDES);
    if (error || !data) {
      console.error(`[Dualia] Échec signature des photos (${bucket}) :`, error);
      return {};
    }
    const table: Record<string, string> = {};
    data.forEach((entree: any) => {
      if (entree?.path && entree?.signedUrl) table[entree.path] = entree.signedUrl;
    });
    return table;
  } catch (err) {
    console.error(`[Dualia] Échec signature des photos (${bucket}) :`, err);
    return {};
  }
};

// Signe un chemin isole — utilise juste apres un envoi, pour afficher
// immediatement la photo sans attendre le prochain chargement.
const signerUnChemin = async (bucket: string, chemin: string): Promise<string | undefined> => {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(chemin, DUREE_SIGNATURE_SECONDES);
    if (error || !data?.signedUrl) return undefined;
    return data.signedUrl;
  } catch {
    return undefined;
  }
};

// Nom de fichier volontairement non devinable. Les buckets de photos sont
// encore publics : un chemin construit sur un horodatage se parcourt, un
// suffixe aleatoire non. Mesure d'attenuation, PAS un controle d'acces —
// celui-ci viendra avec les URL signees et le passage des buckets en prive.
const nomFichierUnique = (extension: string) =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}.${extension}`;

// L'extension du fichier stocke doit correspondre a son type reel : le
// Content-Type suffit au navigateur, mais pas a un telechargement (le fichier
// arrive alors nomme .bin et ne s'ouvre nulle part). Un coffre-fort familial
// doit rendre les pieces telles qu'elles ont ete deposees.
const EXTENSIONS_FICHIER: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
  'text/csv': 'csv',
};

const extensionDepuisType = (contentType: string) =>
  EXTENSIONS_FICHIER[(contentType || '').toLowerCase().split(';')[0].trim()] ?? 'bin';

const PARENTS: Record<ParentRole, Parent> = {
  A: { id: 'A', nom: 'Parent 1', email: '', couleur: COLORS.vert },
  B: { id: 'B', nom: 'Parent 2', email: '', couleur: COLORS.terracotta },
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
      ? {
          montant: c.pension_montant,
          periodicite: c.pension_periodicite ?? 'autre',
          montantParEnfant: c.pension_extra?.montantParEnfant ?? undefined,
          nombreEnfantsConcernes: c.pension_extra?.nombreEnfantsConcernes ?? undefined,
          indexation: c.pension_extra?.indexation ?? undefined,
        }
      : undefined,
  garde: c.garde ?? undefined,
  datesSpeciales: c.dates_speciales ?? undefined,
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
        garde: cadre.garde ?? null,
        dates_speciales: cadre.datesSpeciales ?? null,
        pension_extra: cadre.pension
          ? {
              montantParEnfant: cadre.pension.montantParEnfant,
              nombreEnfantsConcernes: cadre.pension.nombreEnfantsConcernes,
              indexation: cadre.pension.indexation,
            }
          : null,
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
  enfant: ev.enfant ?? null,
  enfant_id: ev.enfantId ?? null,
});

// Notes apposées aux événements produits par un modèle de garde.
//
// Elles servent à les retrouver lors d'une régénération, pour remplacer
// l'ancien planning au lieu de l'empiler. On ne peut pas se fier au préfixe
// de l'identifiant (`garde-cadre-`, `garde-sem-`, `garde-we-`) : dès que
// l'insertion Supabase répond, ajouterEvenement remplace l'identifiant local
// par celui de la base et le préfixe disparaît. Le champ notes, lui, fait
// l'aller-retour intact.
//
// Les journées confiées à un tiers portent une autre note : elles survivent
// donc à la purge, comme tout événement saisi à la main.
const NOTE_MODELE_ALTERNEE = 'Généré depuis le cadre familial (jugement importé)';
const NOTE_MODELE_WEEKEND = 'Généré depuis le modèle de garde';
const NOTES_MODELE = [NOTE_MODELE_ALTERNEE, NOTE_MODELE_WEEKEND];

const evenementGardeVersDB = (ev: EvenementGarde, familleId: string, parentUuid?: string) => ({
  famille_id: familleId,
  date_debut: ev.dateDebut,
  date_fin: ev.dateFin,
  parent_id: parentUuid ?? null,
  type: ev.type,
  notes: ev.notes ?? null,
  tiers_id: ev.tiersId ?? null,
  foyer_id: ev.foyerId ?? null,
});

const evenementGardeDepuisDB = (row: any, roleParUuid: Record<string, ParentRole>): EvenementGarde => ({
  id: row.id,
  dateDebut: row.date_debut,
  dateFin: row.date_fin,
  parentId: (row.parent_id && roleParUuid[row.parent_id]) || 'A',
  type: row.type,
  notes: row.notes ?? undefined,
  tiersId: row.tiers_id ?? undefined,
  foyerId: row.foyer_id ?? undefined,
});

const evenementCalendrierDepuisDB = (e: any, roleParUuid: Record<string, ParentRole>): EvenementCalendrier => ({
  id: e.id,
  titre: e.titre,
  date: e.date,
  parentId: (e.parent_id && roleParUuid[e.parent_id]) || 'A',
  sourceMessageId: e.source_message_id ?? undefined,
  enfant: e.enfant ?? undefined,
  enfantId: e.enfant_id ?? undefined,
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
  justificatif_url: dep.justificatifUrl ?? null,
  justificatif_nom: dep.justificatifNom ?? null,
  justificatif_type: dep.justificatifType ?? null,
  justificatif_expire_le: dep.justificatifExpireLe ?? null,
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
  justificatifUrl: d.justificatif_url ?? undefined,
  justificatifNom: d.justificatif_nom ?? undefined,
  justificatifType: d.justificatif_type ?? undefined,
  justificatifExpireLe: d.justificatif_expire_le ?? undefined,
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
  photo_url: entry.photoUrl ?? null,
  enfant: entry.enfant ?? null,
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
  photoUrl: e.photo_url ?? undefined,
  enfant: e.enfant ?? undefined,
});

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

const messageVersDB = (m: Message, familleId: string, expediteurUuid?: string) => ({
  famille_id: familleId,
  expediteur_id: expediteurUuid ?? null,
  contenu: m.contenu,
  date_envoi: m.dateEnvoi,
  statut: m.statut,
  contenu_original: m.contenuOriginal ?? null,
  alerte_detectee: m.alerteDetectee ?? false,
  piece_jointe_url: m.pieceJointeUrl ?? null,
  piece_jointe_nom: m.pieceJointeNom ?? null,
  piece_jointe_type: m.pieceJointeType ?? null,
});

const messageDepuisDB = (row: any, roleParUuid: Record<string, ParentRole>): Message => ({
  id: row.id,
  expediteurId: (row.expediteur_id && roleParUuid[row.expediteur_id]) || 'A',
  // Un message reduit a sa piece jointe n'a pas de texte : contenu peut
  // arriver vide, et un NULL ferait planter tout l'ecran au premier .trim().
  contenu: row.contenu ?? '',
  dateEnvoi: row.date_envoi,
  statut: row.statut,
  contenuOriginal: row.contenu_original ?? undefined,
  alerteDetectee: row.alerte_detectee ?? false,
  pieceJointeUrl: row.piece_jointe_url ?? undefined,
  pieceJointeNom: row.piece_jointe_nom ?? undefined,
  pieceJointeType: row.piece_jointe_type ?? undefined,
});

const documentVersDB = (doc: DocumentItem, familleId: string, auteurUuid?: string) => ({
  famille_id: familleId,
  nom: doc.nom,
  categorie: doc.categorie,
  auteur_id: auteurUuid ?? null,
  date: doc.date.split('T')[0],
  certifie: doc.certifie,
  note: doc.note ?? null,
  fichier_url: doc.fichierUrl ?? null,
  date_expiration: doc.dateExpiration ? doc.dateExpiration.split('T')[0] : null,
  portee: doc.portee ?? 'enfant',
  // Les enfants concernes ne sont PAS une colonne : ils vivent dans la table
  // de liaison document_enfants, ecrite juste apres l'insertion.
});

const documentDepuisDB = (
  row: any,
  roleParUuid: Record<string, ParentRole>,
  enfantIds: string[] = []
): DocumentItem => ({
  id: row.id,
  nom: row.nom,
  categorie: row.categorie,
  auteurId: (row.auteur_id && roleParUuid[row.auteur_id]) || 'A',
  date: row.date,
  fichierUrl: row.fichier_url ?? undefined,
  certifie: row.certifie ?? false,
  note: row.note ?? undefined,
  dateExpiration: row.date_expiration ?? undefined,
  portee: (row.portee as DocumentPortee) ?? 'enfant',
  enfantIds,
});

const tiersVersDB = (tr: Tiers, familleId: string, inviteParUuid?: string) => ({
  famille_id: familleId,
  nom: tr.nom,
  email: tr.email,
  role: tr.role,
  statut: tr.statut,
  invite_par: inviteParUuid ?? null,
  cree_le: tr.creeLe,
  peut_etre_gardien: tr.peutEtreGardien,
  // token et expire_le ne sont JAMAIS envoyes par le client : la base les
  // genere elle-meme. Un jeton choisi cote application serait un jeton
  // devinable.
});

const tiersDepuisDB = (
  row: any,
  roleParUuid: Record<string, ParentRole>,
  enfantIds: string[] = []
): Tiers => ({
  id: row.id,
  nom: row.nom,
  email: row.email,
  role: row.role,
  statut: row.statut,
  invitePar: (row.invite_par && roleParUuid[row.invite_par]) || 'A',
  creeLe: row.cree_le,
  peutEtreGardien: row.peut_etre_gardien ?? false,
  token: row.token ?? undefined,
  expireLe: row.expire_le ?? undefined,
  accepteLe: row.accepte_le ?? undefined,
  revoqueLe: row.revoque_le ?? undefined,
  enfantIds,
});

const agendaScolaireVersDB = (a: AgendaScolaireItem, familleId: string, auteurUuid?: string) => ({
  famille_id: familleId,
  type: a.type,
  titre: a.titre,
  description: a.description ?? null,
  date_echeance: a.dateEcheance,
  enfant_id: a.enfantId ?? null,
  auteur_id: auteurUuid ?? null,
  fait: a.fait,
  cree_le: a.creeLe,
});

const agendaScolaireDepuisDB = (row: any, roleParUuid: Record<string, ParentRole>): AgendaScolaireItem => ({
  id: row.id,
  type: row.type,
  titre: row.titre,
  description: row.description ?? undefined,
  dateEcheance: row.date_echeance,
  enfantId: row.enfant_id ?? undefined,
  auteurId: (row.auteur_id && roleParUuid[row.auteur_id]) || 'A',
  fait: row.fait ?? false,
  creeLe: row.cree_le,
});

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

const momentDepuisDB = (row: any, roleParUuid: Record<string, ParentRole>): Moment => ({
  id: row.id,
  auteurId: (row.auteur_id && roleParUuid[row.auteur_id]) || 'A',
  enfantId: row.enfant_id ?? undefined,
  texte: row.texte ?? undefined,
  photoUrl: row.photo_url ?? undefined,
  aimePar: (row.aime_par ?? [])
    .map((uuid: string) => roleParUuid[uuid])
    .filter((role: ParentRole | undefined): role is ParentRole => !!role),
  createdAt: row.created_at,
});

// ---------- Foyer : construit un Foyer[] à partir des trois tables
// (foyers, foyer_personnes, foyer_enfants) — personneIds/enfantIds sont
// des vues dérivées des relations, pas des colonnes stockées.
const construireFoyers = (
  foyersDB: any[],
  personnesDB: any[],
  enfantsDB: any[]
): Foyer[] =>
  foyersDB.map((f) => ({
    id: f.id,
    nom: f.nom,
    adresse: f.adresse ?? undefined,
    ville: f.ville ?? undefined,
    codePostal: f.code_postal ?? undefined,
    pays: f.pays ?? undefined,
    couleur: f.couleur ?? undefined,
    adresseVisible: f.adresse_visible ?? false,
    actif: f.actif ?? true,
    estPlaceholder: f.est_placeholder ?? false,
    personneIds: personnesDB.filter((p) => p.foyer_id === f.id).map((p) => p.parent_id),
    enfantIds: enfantsDB.filter((e) => e.foyer_id === f.id).map((e) => e.enfant_id),
    enfantIdsResidencePrincipale: enfantsDB
      .filter((e) => e.foyer_id === f.id && e.residence_principale)
      .map((e) => e.enfant_id),
  }));

// Repli affiché tant qu'aucun enfant n'est chargé depuis Supabase.
// Volontairement générique : aucun prénom fictif ne doit apparaître.
const FAMILY_CARD_FR = { enfants: 'Vos enfants', localisation: 'Votre famille' };
const FAMILY_CARD_PT = { enfants: 'Os seus filhos', localisation: 'A sua família' };
const FAMILY_CARD_ES = { enfants: 'Sus hijos', localisation: 'Su familia' };
const FAMILY_CARD_EN = { enfants: 'Your children', localisation: 'Your family' };

interface EspaceFamilial {
  familleId: string;
  label: string;
  monRole: ParentRole;
}

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
  ajouterEvenementsEnLot: (evs: EvenementGarde[]) => Promise<void>;
  supprimerEvenementGarde: (id: string) => void;
  confierGardeATiers: (dateIso: string, tiersId: string) => void;
  purgerPlanningsGeneres: () => Promise<void>;
  genererCalendrierAlterne: (dateDebutIso: string, parentQuiCommence: ParentRole, nombreSemaines: number) => Promise<void>;
  genererCalendrierGardeWeekend: (dateDebutIso: string, parentResident: ParentRole, nombreSemaines: number) => Promise<void>;
  setGenreParental: (id: ParentRole, genre: 'mere' | 'pere' | 'autre') => void;
  verrouillerIndiceInitial: (valeur: number) => Promise<void>;
  genererDatesSpeciales: (
    dates: { occasion: string; parent?: ParentRole }[],
    anneeDebut: number,
    nombreAnnees: number
  ) => { genere: number; ignorees: string[] };
  genererVacancesScolaires: () => { genere: number };
  evenementsCalendrier: EvenementCalendrier[];
  ajouterEvenementCalendrier: (ev: EvenementCalendrier) => void;
  ignorerSuggestion: (messageId: string) => void;
  messagesAnalyses: string[];
  marquerMessageAnalyse: (id: string) => void;
  suggestionsMessages: Record<string, { titre: string; date: string; enfant: string | null }>;
  ajouterSuggestionMessage: (msgId: string, sug: { titre: string; date: string; enfant: string | null }) => void;
  retirerSuggestionMessage: (msgId: string) => void;
  supprimerEvenement: (id: string) => void;
  ajouterDecision: (d: Decision) => void;
  mettreAJourDecision: (id: string, updates: Partial<Decision>) => void;
  ajouterMessage: (m: Message) => void;

  tiers: Tiers[];
  // Rend le jeton du lien d'invitation, genere par la base : c'est ce lien
  // que le parent transmet lui-meme. Rien n'est envoye par Dualia.
  inviterTiers: (tr: Tiers, enfantIds: string[]) => Promise<string | null>;
  // Rend false si le serveur a refuse : sans ca, la carte disparait de la
  // liste et le parent croit l'acces retire alors que le tiers voit tout.
  revoquerTiers: (id: string) => Promise<boolean>;

  // Session d'un tiers (nounou, grand-parent, ecole). Renseigne uniquement
  // quand l'utilisateur connecte n'est parent d'aucun espace.
  accesTiers: AccesTiersActif | null;
  chargerEspaceTiers: () => Promise<boolean>;
  // Vide les donnees de l'espace familial gardees sur l'appareil. A appeler
  // a chaque changement d'utilisateur : le stockage local est partage par
  // tous ceux qui ouvrent l'application sur ce navigateur.
  purgerDonneesFamiliales: () => void;

  langueDetectee: boolean;
  detecterLangueAuto: () => void;

  agendaScolaire: AgendaScolaireItem[];
  ajouterAgendaScolaire: (a: AgendaScolaireItem) => void;
  basculerAgendaScolaireFait: (id: string) => void;
  horodaterDecision: (id: string) => void;
  ajouterJournal: (entry: JournalEntry, photoUri?: string) => Promise<void>;
  modifierJournal: (id: string, updates: Partial<JournalEntry>, photoUri?: string) => Promise<void>;
  supprimerJournal: (id: string) => void;
  likerEntree: (id: string) => void;
  ajouterRecitCroise: (id: string, texte: string) => void;
  ajouterDepense: (dep: Depense) => void;
  reglerDepense: (id: string) => void;
  // Televerse un fichier une seule fois et rend son chemin : le recapitulatif
  // d'un ticket peut creer trois depenses, qui partagent alors le meme
  // justificatif au lieu d'en envoyer trois copies.
  televerserPieceJointe: (fichier: {
    base64: string;
    contentType: string;
    nom: string;
  }) => Promise<{ chemin: string; nom: string; type: string } | null>;
  // Prend le CHEMIN du fichier, pas l'identifiant de la depense : une
  // depense tout juste creee porte encore son id local tant que la
  // synchronisation n'a pas rendu l'id Supabase, et plusieurs depenses issues
  // d'un meme ticket partagent un seul justificatif.
  supprimerJustificatif: (chemin: string) => Promise<void>;
  ajouterDocument: (doc: DocumentItem, fichier?: { base64: string; contentType: string }) => Promise<void>;
  modifierDocument: (id: string, updates: Partial<DocumentItem>) => Promise<void>;
  supprimerDocument: (id: string) => void;
  setNouvelleDecisionDraft: (texte: string | null) => void;
  setLangue: (langue: Langue) => void;

  enfants: Enfant[];
  ajouterEnfant: (e: Enfant, photoUri?: string) => Promise<void>;
  modifierEnfant: (id: string, updates: Partial<Enfant>, photoUri?: string) => Promise<void>;
  supprimerEnfant: (id: string) => void;
  ajouterContactUrgence: (c: ContactUrgence) => void;
  modifierContactUrgence: (id: string, updates: Partial<ContactUrgence>) => void;
  supprimerContactUrgence: (id: string) => void;

  moments: Moment[];
  ajouterMoment: (params: { texte?: string; enfantId?: string; photoUri?: string }) => Promise<void>;
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

  // ---------- Personne / Foyer (BETA-safe) ----------
  foyers: Foyer[];
  configFoyers: ConfigFoyers | null;
  chargerFoyers: (familleId: string) => Promise<void>;
  configurerFoyersInitial: (config: ConfigFoyers) => Promise<void>;
  modifierFoyer: (
    id: string,
    updates: Partial<Pick<Foyer, 'nom' | 'adresse' | 'ville' | 'codePostal' | 'pays' | 'couleur' | 'adresseVisible' | 'actif'>>
  ) => Promise<void>;
  associerEnfantAuFoyer: (foyerId: string, enfantId: string, residencePrincipale?: boolean) => Promise<void>;
  retirerEnfantDuFoyer: (foyerId: string, enfantId: string) => Promise<void>;
  definirResidencePrincipale: (foyerId: string, enfantId: string, valeur: boolean) => Promise<void>;

  espacesFamiliaux: EspaceFamilial[];
  chargerEspaceFamilial: (familleId: string) => Promise<void>;
  changerEspaceFamilial: (familleId: string) => Promise<void>;

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
  // Tous les contenus démarrent vides : ils sont remplis par
  // chargerEspaceFamilial depuis Supabase. Aucune donnée de démonstration
  // ne doit pouvoir s'afficher à la place des données réelles d'une famille.
  evenements: [],
  decisions: [],
  messages: [],
  journalEntries: [],
  depenses: [],
  documents: [],
  parentActif: 'A',
  nouvelleDecisionDraft: null,
  langue: 'fr',
  familyCard: FAMILY_CARD_FR,
  espacesFamiliaux: [],

  setParentActif: (id) => set({ parentActif: id }),

  setGenreParental: (id, genre) => {
    set((state) => ({
      parents: { ...state.parents, [id]: { ...state.parents[id], genreParental: genre } },
    }));
    const uuid = get().parents[id]?.uuid;
    if (!uuid) return;
    supabase
      .from('parents')
      .update({ genre_parental: genre })
      .eq('id', uuid)
      .then(({ error }) => {
        if (error) console.error('[Dualia] Échec enregistrement genre parental :', error);
      });
  },

  verrouillerIndiceInitial: async (valeur) => {
    const cadre = get().cadreFamilial;
    const familleId = get().familleId;
    if (!cadre || !cadre.pension || !familleId) return;

    const cadreMisAJour: CadreFamilial = {
      ...cadre,
      pension: {
        ...cadre.pension,
        indexation: { ...cadre.pension.indexation, indiceInitialConfirme: valeur },
      },
    };
    set({ cadreFamilial: cadreMisAJour });

    try {
      await assurerCadreFamilialDistant(familleId, cadreMisAJour);
    } catch (err) {
      console.error("[Dualia] Échec enregistrement de l'indice INSEE initial :", err);
    }
  },

  ajouterEvenement: (ev) => {
    set((state) => ({ evenements: [...state.evenements, ev] }));

    const { familleId, parents } = get();
    if (!familleId) {
      console.error('[Dualia] Événement de garde non synchronisé : aucune famille active.');
      return;
    }
    const parentUuid = parents[ev.parentId]?.uuid;
    supabase
      .from('evenements_garde')
      .insert(evenementGardeVersDB(ev, familleId, parentUuid))
      .select()
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          console.error('[Dualia] Échec synchronisation événement de garde :', error);
          return;
        }
        set((state) => ({
          evenements: state.evenements.map((e) => (e === ev || e.id === ev.id ? { ...e, id: data.id } : e)),
        }));
      });
  },

  // Insertion groupée, utilisée par les générateurs de planning.
  //
  // Un modèle produit 12 événements en garde alternée, 24 en garde week-end.
  // Les créer un par un, c'est autant d'allers-retours réseau : plusieurs
  // secondes sur une connexion mobile, et surtout un échec partiel possible —
  // la moitié du planning en base, l'autre non, sans que rien ne le signale.
  // Une seule requête réussit ou échoue d'un bloc.
  ajouterEvenementsEnLot: async (evs) => {
    if (evs.length === 0) return;

    set((state) => ({ evenements: [...state.evenements, ...evs] }));

    const { familleId, parents } = get();
    if (!familleId) {
      console.error('[Dualia] Planning non synchronisé : aucune famille active.');
      return;
    }

    const { data, error } = await supabase
      .from('evenements_garde')
      .insert(evs.map((ev) => evenementGardeVersDB(ev, familleId, parents[ev.parentId]?.uuid)))
      .select();

    if (error || !data) {
      console.error('[Dualia] Échec synchronisation du planning :', error);
      return;
    }

    // Réconciliation des identifiants par date de début plutôt que par
    // position : PostgREST ne garantit pas l'ordre des lignes retournées,
    // alors qu'au sein d'un planning généré chaque date de début est unique.
    const idParDebut = new Map<string, string>();
    for (const row of data as any[]) {
      idParDebut.set(new Date(row.date_debut).getTime().toString(), row.id);
    }

    const locaux = new Map(evs.map((ev) => [ev.id, ev.dateDebut]));

    set((state) => ({
      evenements: state.evenements.map((e) => {
        const debut = locaux.get(e.id);
        if (!debut) return e;
        const idDistant = idParDebut.get(new Date(debut).getTime().toString());
        return idDistant ? { ...e, id: idDistant } : e;
      }),
    }));
  },

  supprimerEvenementGarde: (id) => {
    set((state) => ({ evenements: state.evenements.filter((e) => e.id !== id) }));
    supabase
      .from('evenements_garde')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('[Dualia] Échec suppression événement de garde (distant) :', error);
      });
  },

  confierGardeATiers: (dateIso, tiersId) => {
    const { ajouterEvenement, parentActif, evenements } = get();
    const jour = new Date(dateIso);
    jour.setHours(0, 0, 0, 0);
    const finJour = new Date(jour);
    finJour.setHours(23, 59, 59, 0);

    const evenementExistant = evenements.find((ev) => {
      const debut = new Date(ev.dateDebut);
      const fin = new Date(ev.dateFin);
      return jour >= debut && jour <= fin;
    });

    ajouterEvenement({
      id: `garde-tiers-${Date.now()}`,
      dateDebut: jour.toISOString(),
      dateFin: finJour.toISOString(),
      parentId: evenementExistant?.parentId ?? parentActif,
      type: evenementExistant?.type ?? 'droit_de_visite',
      notes: 'Confié à un tiers',
      tiersId,
    });
  },

  // Efface les plannings issus d'un modèle, localement et en base, pour
  // qu'une régénération remplace au lieu d'empiler.
  //
  // Sans cela, relancer « Modèle de garde » ajoutait un second jeu
  // d'événements par-dessus le premier. Comme parentDuJour retient la
  // première correspondance trouvée dans le tableau, c'est l'ancien planning
  // qui restait affiché : le nouveau paraissait sans effet, et la base
  // accumulait des lignes qui se contredisaient.
  //
  // L'attente de la réponse Supabase n'est pas facultative : les générateurs
  // insèrent aussitôt après, et une suppression encore en vol emporterait les
  // événements fraîchement créés.
  purgerPlanningsGeneres: async () => {
    const { familleId } = get();

    set((state) => ({
      evenements: state.evenements.filter((e) => !NOTES_MODELE.includes(e.notes ?? '')),
    }));

    if (!familleId) return;

    const { error } = await supabase
      .from('evenements_garde')
      .delete()
      .eq('famille_id', familleId)
      .in('notes', NOTES_MODELE);

    if (error) console.error('[Dualia] Échec purge des plannings générés :', error);
  },

  genererCalendrierAlterne: async (dateDebutIso, parentQuiCommence, nombreSemaines) => {
    const { ajouterEvenementsEnLot, purgerPlanningsGeneres } = get();
    await purgerPlanningsGeneres();

    const debutBase = new Date(dateDebutIso);
    debutBase.setHours(0, 0, 0, 0);
    const autreParent: ParentRole = parentQuiCommence === 'A' ? 'B' : 'A';
    const horodatage = Date.now();

    const evenements: EvenementGarde[] = [];
    for (let semaine = 0; semaine < nombreSemaines; semaine++) {
      const debut = new Date(debutBase);
      debut.setDate(debut.getDate() + semaine * 7);
      const fin = new Date(debut);
      fin.setDate(fin.getDate() + 6);
      fin.setHours(23, 59, 59, 0);

      evenements.push({
        id: `garde-cadre-${horodatage}-${semaine}`,
        dateDebut: debut.toISOString(),
        dateFin: fin.toISOString(),
        parentId: semaine % 2 === 0 ? parentQuiCommence : autreParent,
        type: 'résidence_alternée',
        notes: NOTE_MODELE_ALTERNEE,
      });
    }

    await ajouterEvenementsEnLot(evenements);
  },

  genererCalendrierGardeWeekend: async (dateDebutIso, parentResident, nombreSemaines) => {
    const { ajouterEvenementsEnLot, purgerPlanningsGeneres } = get();
    await purgerPlanningsGeneres();

    const autreParent: ParentRole = parentResident === 'A' ? 'B' : 'A';
    const horodatage = Date.now();

    const debutBase = new Date(dateDebutIso);
    const jourSemaineISO = debutBase.getDay();
    const decalageVersLundi = jourSemaineISO === 0 ? -6 : 1 - jourSemaineISO;
    debutBase.setDate(debutBase.getDate() + decalageVersLundi);
    debutBase.setHours(0, 0, 0, 0);

    const evenements: EvenementGarde[] = [];
    for (let semaine = 0; semaine < nombreSemaines; semaine++) {
      const lundi = new Date(debutBase);
      lundi.setDate(lundi.getDate() + semaine * 7);
      const vendredi = new Date(lundi);
      vendredi.setDate(vendredi.getDate() + 4);
      vendredi.setHours(23, 59, 59, 0);
      const samedi = new Date(lundi);
      samedi.setDate(samedi.getDate() + 5);
      const dimanche = new Date(lundi);
      dimanche.setDate(dimanche.getDate() + 6);
      dimanche.setHours(23, 59, 59, 0);

      evenements.push({
        id: `garde-sem-${horodatage}-${semaine}`,
        dateDebut: lundi.toISOString(),
        dateFin: vendredi.toISOString(),
        parentId: parentResident,
        type: 'résidence_principale',
        notes: NOTE_MODELE_WEEKEND,
      });

      const weekendChezAutre = semaine % 2 === 1;
      evenements.push({
        id: `garde-we-${horodatage}-${semaine}`,
        dateDebut: samedi.toISOString(),
        dateFin: dimanche.toISOString(),
        parentId: weekendChezAutre ? autreParent : parentResident,
        type: weekendChezAutre ? 'droit_de_visite' : 'résidence_principale',
        notes: NOTE_MODELE_WEEKEND,
      });
    }

    await ajouterEvenementsEnLot(evenements);
  },

  genererDatesSpeciales: (dates, anneeDebut, nombreAnnees) => {
    const { ajouterEvenementCalendrier } = get();
    let genere = 0;
    const ignoreesSet = new Set<string>();

    for (const d of dates) {
      const occasion = d.occasion.toLowerCase();
      let uneDateCalculee = false;

      const cleFete = Object.keys(FETES_JUIVES).find((cle) => occasion.includes(cle));
      if (cleFete) {
        const table = FETES_JUIVES[cleFete];
        for (const annee of Object.keys(table).map(Number)) {
          if (annee < anneeDebut || annee >= anneeDebut + nombreAnnees) continue;
          const { debut, jours } = table[annee];
          const dateDebutFete = new Date(debut);
          for (let j = 0; j < jours; j++) {
            const dateJour = new Date(dateDebutFete);
            dateJour.setDate(dateJour.getDate() + j);
            ajouterEvenementCalendrier({
              id: `date-speciale-${Date.now()}-${annee}-${j}-${cleFete.replace(/\s/g, '')}`,
              titre: jours > 1 ? `${d.occasion} (jour ${j + 1}/${jours})` : d.occasion,
              date: dateJour.toISOString(),
              parentId: d.parent || 'A',
            });
            genere++;
          }
          uneDateCalculee = true;
        }
        if (uneDateCalculee) continue;
      }

      for (let a = 0; a < nombreAnnees; a++) {
        const annee = anneeDebut + a;
        let date: Date | null = null;

        if (occasion.includes('noël') || occasion.includes('noel')) {
          date = new Date(annee, 11, 25);
        } else if (occasion.includes('fête des mères') || occasion.includes('fete des meres')) {
          date = dernierDimancheDeMai(annee);
        } else if (occasion.includes('fête des pères') || occasion.includes('fete des peres')) {
          date = troisiemeDimancheDeJuin(annee);
        } else if (occasion.includes("jour de l'an") || occasion.includes('nouvel an')) {
          date = new Date(annee, 0, 1);
        }

        if (date) {
          uneDateCalculee = true;
          ajouterEvenementCalendrier({
            id: `date-speciale-${Date.now()}-${a}-${occasion.replace(/\s/g, '')}`,
            titre: d.occasion,
            date: date.toISOString(),
            parentId: d.parent || 'A',
          });
          genere++;
        }
      }

      if (!uneDateCalculee) ignoreesSet.add(d.occasion);
    }

    return { genere, ignorees: Array.from(ignoreesSet) };
  },

  genererVacancesScolaires: () => {
    const { ajouterEvenementCalendrier } = get();
    for (const periode of VACANCES_ZONE_C) {
      ajouterEvenementCalendrier({
        id: `vacances-debut-${Date.now()}-${periode.debut}`,
        titre: `Début — ${periode.nom}`,
        date: new Date(periode.debut).toISOString(),
        parentId: 'A',
      });
      ajouterEvenementCalendrier({
        id: `vacances-fin-${Date.now()}-${periode.fin}`,
        titre: `Reprise — ${periode.nom}`,
        date: new Date(periode.fin).toISOString(),
        parentId: 'A',
      });
    }
    return { genere: VACANCES_ZONE_C.length * 2 };
  },
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

  langueDetectee: false,

  detecterLangueAuto: () => {
    const { langueDetectee, setLangue } = get();
    if (langueDetectee) return;
    set({ langueDetectee: true });

    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return;

    const code = (navigator.language || '').toLowerCase();
    if (code.startsWith('es')) setLangue('es');
    else if (code.startsWith('pt')) setLangue('pt');
    else if (code.startsWith('en')) setLangue('en');
  },

  inviterTiers: async (tr, enfantIds) => {
    const { familleId, parents } = get();
    if (!familleId) {
      console.error('[Dualia] Accès tiers non créé : aucune famille active.');
      return null;
    }
    const inviteParUuid = parents[tr.invitePar]?.uuid;
    if (!inviteParUuid) {
      // invite_par est l'ancre du perimetre : sans lui, l'acces n'appartient a
      // personne, le tiers ne verrait pas qui l'a invite et n'importe quel
      // parent pourrait le revoquer.
      console.error('[Dualia] Accès tiers non créé : parent invitant non identifié.');
      return null;
    }

    // Pas d'ajout optimiste ici, contrairement au reste du store : tant que
    // la base n'a pas rendu le jeton, il n'y a pas de lien à transmettre —
    // afficher l'accès dans la liste laisserait croire qu'il est utilisable.
    const { data, error } = await supabase
      .from('tiers')
      .insert(tiersVersDB(tr, familleId, inviteParUuid))
      .select()
      .single();

    if (error || !data) {
      console.error('[Dualia] Échec création de l\'accès tiers :', error);
      return null;
    }

    if (enfantIds.length > 0) {
      const { error: erreurLiens } = await supabase
        .from('tiers_enfants')
        .insert(enfantIds.map((enfantId) => ({ tiers_id: data.id, enfant_id: enfantId })));
      if (erreurLiens) {
        // Un accès sans enfant rattaché ne montre rien : plutôt que de le
        // laisser en place et incompréhensible, on annule.
        console.error('[Dualia] Échec rattachement des enfants, accès annulé :', erreurLiens);
        await supabase.from('tiers').delete().eq('id', data.id);
        return null;
      }
    }

    const roleParUuid: Record<string, ParentRole> = {};
    (Object.values(parents) as Parent[]).forEach((p) => {
      if (p.uuid) roleParUuid[p.uuid] = p.id;
    });

    set((state) => ({ tiers: [tiersDepuisDB(data, roleParUuid, enfantIds), ...state.tiers] }));
    return data.token ?? null;
  },

  revoquerTiers: async (id) => {
    const horodatage = new Date().toISOString();
    const avant = get().tiers;

    set((state) => ({
      tiers: state.tiers.map((t) =>
        t.id === id ? { ...t, statut: 'revoque', revoqueLe: horodatage } : t
      ),
    }));

    const { error } = await supabase
      .from('tiers')
      .update({ statut: 'revoque', revoque_le: horodatage })
      .eq('id', id);

    if (error) {
      // Retirer un accès est une action qu'on ne peut pas se permettre
      // d'afficher à tort : on remet la liste dans son état réel.
      console.error('[Dualia] Échec révocation accès tiers (distant) :', error);
      set({ tiers: avant });
      return false;
    }
    return true;
  },

  accesTiers: null,

  // Le store est persiste (voir partialize) : messages, depenses, documents et
  // enfants survivent a la fermeture de l'application. C'est voulu pour un
  // parent qui rouvre son espace, mais sur un navigateur partage rien ne
  // remplacerait ces donnees lorsqu'un TIERS se connecte ensuite : la famille
  // resterait en memoire sous un compte qui n'y a aucun droit. On vide donc
  // explicitement.
  purgerDonneesFamiliales: () =>
    set({
      familleId: null,
      espacesFamiliaux: [],
      parents: { ...PARENTS },
      parentActif: 'A',
      decisions: [],
      messages: [],
      messagesAnalyses: [],
      suggestionsMessages: {},
      journalEntries: [],
      depenses: [],
      documents: [],
      enfants: [],
      moments: [],
      evenements: [],
      evenementsCalendrier: [],
      cadreFamilial: null,
      propositionsRepartition: [],
      tiers: [],
      agendaScolaire: [],
      foyers: [],
      configFoyers: null,
    }),

  // Un tiers n'a pas d'espace familial : il a un acces. On ne charge donc
  // rien de la famille, seulement ce que les regles serveur lui accordent —
  // si elles refusent, les requetes reviennent vides, sans erreur.
  chargerEspaceTiers: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return false;

    const { data: mesAcces, error } = await supabase
      .from('tiers')
      .select('*')
      .eq('user_id', user.id)
      .eq('statut', 'actif')
      .is('revoque_le', null)
      .order('cree_le', { ascending: false });

    if (error) {
      // Une panne reseau n'est pas une revocation. Sans cette distinction, on
      // annonce a une nounou que le parent lui a coupe l'acces parce que la
      // requete a echoue. On garde l'etat precedent et on ne conclut rien.
      console.error('[Dualia] Échec chargement de l\'accès tiers :', error);
      set({ chargementInitial: false });
      return get().accesTiers !== null;
    }

    if (!mesAcces || mesAcces.length === 0) {
      // Compte sans acces : c'est justement le cas ou il ne faut rien laisser
      // trainer. Un tiers revoque, ou un compte cree puis abandonne, heritait
      // sinon de l'espace familial persiste par le parent precedent sur ce
      // navigateur — messages et depenses compris.
      get().purgerDonneesFamiliales();
      set({ accesTiers: null, chargementInitial: false });
      return false;
    }

    const acces = mesAcces[0];

    get().purgerDonneesFamiliales();

    // Une meme personne peut avoir plusieurs acces actifs : les deux parents
    // peuvent inviter la meme nounou, chacun de son cote. On reunit les
    // perimetres plutot que d'en ignorer un en silence — sinon un parent croit
    // sa nounou informee alors qu'elle ne voit rien de ses enfants a lui.
    const idsAcces = mesAcces.map((a: any) => a.id);

    const { data: liens } = await supabase
      .from('tiers_enfants')
      .select('enfant_id')
      .in('tiers_id', idsAcces);
    const enfantIds = Array.from(new Set((liens ?? []).map((l: any) => l.enfant_id)));

    let enfants: Enfant[] = [];
    if (enfantIds.length > 0) {
      const { data: enfantsDB } = await supabase.from('enfants').select('*').in('id', enfantIds);
      const { data: contactsDB } = await supabase
        .from('contacts_urgence')
        .select('*')
        .in('enfant_id', enfantIds)
        .order('priorite', { ascending: true });
      enfants = (enfantsDB ?? []).map((row: any) =>
        enfantDepuisDB(
          row,
          (contactsDB ?? []).filter((c: any) => c.enfant_id === row.id).map(contactUrgenceDepuisDB)
        )
      );
    }

    // Uniquement les creneaux ou ce tiers est designe : la regle serveur le
    // garantit deja, le filtre ici n'est qu'une commodite de lecture.
    const { data: gardesDB } = await supabase
      .from('evenements_garde')
      .select('*')
      .in('tiers_id', idsAcces)
      .order('date_debut', { ascending: true });
    // La correspondance uuid -> role est vide : un tiers ne voit pas les deux
    // parents, et le role du parent ne lui sert a rien.
    const gardes = (gardesDB ?? []).map((row: any) => evenementGardeDepuisDB(row, {}));

    const idsParents = Array.from(
      new Set(mesAcces.map((a: any) => a.invite_par).filter(Boolean))
    );
    let parentReferentNom = '';
    if (idsParents.length > 0) {
      const { data: parentsDB } = await supabase.from('parents').select('nom').in('id', idsParents);
      parentReferentNom = (parentsDB ?? []).map((p: any) => p.nom).filter(Boolean).join(' et ');
    }

    set({
      accesTiers: {
        tiersId: acces.id,
        nom: acces.nom,
        role: acces.role,
        peutEtreGardien: acces.peut_etre_gardien ?? false,
        parentReferentNom,
        enfants,
        gardes,
      },
      chargementInitial: false,
    });
    return true;
  },

  agendaScolaire: [],

  ajouterAgendaScolaire: (a) => {
    set((state) => ({ agendaScolaire: [...state.agendaScolaire, a] }));

    const { familleId, parents, ajouterEvenementCalendrier, enfants } = get();
    if (!familleId) {
      console.error('[Dualia] Agenda scolaire non synchronisé : aucune famille active.');
      return;
    }

    const LABEL_TYPE: Record<string, string> = {
      devoir: 'Devoir',
      controle: 'Contrôle',
      sortie: 'Sortie scolaire',
      absence: 'Absence',
    };
    const prenomEnfant = a.enfantId ? enfants.find((e) => e.id === a.enfantId)?.prenom : undefined;
    ajouterEvenementCalendrier({
      id: 'cal-agenda-' + a.id,
      titre: `${LABEL_TYPE[a.type] || 'École'} : ${a.titre}`,
      date: a.dateEcheance,
      parentId: a.auteurId,
      enfant: prenomEnfant,
      enfantId: a.enfantId,
    });

    const auteurUuid = parents[a.auteurId]?.uuid;
    supabase
      .from('agenda_scolaire')
      .insert(agendaScolaireVersDB(a, familleId, auteurUuid))
      .select()
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          console.error('[Dualia] Échec synchronisation agenda scolaire :', error);
          return;
        }
        set((state) => ({
          agendaScolaire: state.agendaScolaire.map((item) =>
            item === a || item.id === a.id ? { ...item, id: data.id } : item
          ),
        }));
      });
  },

  basculerAgendaScolaireFait: (id) => {
    const item = get().agendaScolaire.find((a) => a.id === id);
    if (!item) return;
    const nouveauFait = !item.fait;
    set((state) => ({
      agendaScolaire: state.agendaScolaire.map((a) => (a.id === id ? { ...a, fait: nouveauFait } : a)),
    }));
    supabase
      .from('agenda_scolaire')
      .update({ fait: nouveauFait })
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('[Dualia] Échec mise à jour agenda scolaire (distant) :', error);
      });
  },

  // Enregistrement daté d'une décision : la date et l'identifiant sont
  // produits par Dualia, pas par un tiers de confiance. Le préfixe "EIDAS-"
  // utilisé auparavant laissait croire à un horodatage qualifié au sens du
  // règlement (UE) 910/2014, alors qu'aucun contrat avec un prestataire
  // qualifié (QTSP) n'est signé : un parent aurait pu s'en prévaloir devant
  // un juge avec un jeton sans aucune valeur probatoire.
  // À rétablir le jour où le contrat QTSP est effectif.
  horodaterDecision: (id) => {
    const token = `DUALIA-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
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

  ajouterJournal: async (entry, photoUri) => {
    const { familleId, parents } = get();

    let entryAvecPhoto = entry;
    // entryPourAffichage porte l'URL signee ; entryAvecPhoto porte le chemin
    // qui part en base. Les deux ne doivent jamais etre confondus.
    let entryPourAffichage = entry;
    if (photoUri && familleId) {
      try {
        const reponse = await fetch(photoUri);
        const blob = await reponse.blob();
        const nomFichier = `${familleId}/${nomFichierUnique('jpg')}`;
        const { error: erreurUpload } = await supabase.storage
          .from('journal-photos')
          .upload(nomFichier, blob, { contentType: 'image/jpeg' });
        if (erreurUpload) {
          console.error('[Dualia] Échec envoi photo journal :', erreurUpload);
        } else {
          // Le chemin part en base ; l'URL signee ne sert qu'a l'affichage local.
          entryAvecPhoto = { ...entry, photoUrl: nomFichier };
          const signee = await signerUnChemin('journal-photos', nomFichier);
          if (signee) entryPourAffichage = { ...entry, photoUrl: signee };
        }
      } catch (err) {
        console.error('[Dualia] Échec traitement photo journal :', err);
      }
    }

    set((state) => ({ journalEntries: [entryPourAffichage, ...state.journalEntries] }));

    if (!familleId) {
      console.error('[Dualia] Entrée de journal non synchronisée : aucune famille active.');
      return;
    }
    const auteurUuid = parents[entryAvecPhoto.auteurId]?.uuid;
    supabase
      .from('journal_entries')
      .insert(journalVersDB(entryAvecPhoto, familleId, auteurUuid))
      .select()
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          console.error('[Dualia] Échec synchronisation entrée de journal :', error);
          return;
        }
        set((state) => ({
          journalEntries: state.journalEntries.map((e) =>
            e === entryPourAffichage || e.id === entryPourAffichage.id ? { ...e, id: data.id } : e
          ),
        }));
      });
  },

  modifierJournal: async (id, updates, photoUri) => {
    const familleId = get().familleId;
    let photoUrl = updates.photoUrl;
    // Chemin en base, URL signee a l'ecran.
    let photoUrlAffichage: string | undefined;
    if (photoUri && familleId) {
      try {
        const reponse = await fetch(photoUri);
        const blob = await reponse.blob();
        const nomFichier = `${familleId}/${nomFichierUnique('jpg')}`;
        const { error: erreurUpload } = await supabase.storage
          .from('journal-photos')
          .upload(nomFichier, blob, { contentType: 'image/jpeg' });
        if (erreurUpload) {
          console.error('[Dualia] Échec envoi photo journal (modification) :', erreurUpload);
        } else {
          photoUrl = nomFichier;
          photoUrlAffichage = await signerUnChemin('journal-photos', nomFichier);
        }
      } catch (err) {
        console.error('[Dualia] Échec traitement photo journal (modification) :', err);
      }
    }
    const updatesAvecPhoto = photoUrl !== undefined ? { ...updates, photoUrl } : updates;
    const updatesAffichage =
      photoUrlAffichage !== undefined ? { ...updatesAvecPhoto, photoUrl: photoUrlAffichage } : updatesAvecPhoto;

    set((state) => ({
      journalEntries: state.journalEntries.map((e) => (e.id === id ? { ...e, ...updatesAffichage } : e)),
    }));

    const dbUpdates: Record<string, any> = {};
    if (updatesAvecPhoto.titre !== undefined) dbUpdates.titre = updatesAvecPhoto.titre;
    if (updatesAvecPhoto.description !== undefined) dbUpdates.description = updatesAvecPhoto.description || null;
    if (updatesAvecPhoto.emoji !== undefined) dbUpdates.emoji = updatesAvecPhoto.emoji || null;
    if (updatesAvecPhoto.enfant !== undefined) dbUpdates.enfant = updatesAvecPhoto.enfant || null;
    if (updatesAvecPhoto.photoUrl !== undefined) dbUpdates.photo_url = updatesAvecPhoto.photoUrl || null;
    if (Object.keys(dbUpdates).length === 0) return;

    const { error } = await supabase.from('journal_entries').update(dbUpdates).eq('id', id);
    if (error) console.error('[Dualia] Échec sync modification entrée journal (distant) :', error);
  },

  supprimerJournal: (id) => {
    set((state) => ({ journalEntries: state.journalEntries.filter((e) => e.id !== id) }));
    supabase
      .from('journal_entries')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('[Dualia] Échec suppression entrée journal (distant) :', error);
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

  televerserPieceJointe: async ({ base64, contentType, nom }) => {
    const { familleId } = get();
    if (!familleId) {
      // On relance au lieu de rendre null : renvoyer null ferait enregistrer
      // la dépense ou le message SANS sa pièce, sans un mot — le parent
      // croirait avoir joint sa preuve.
      console.error('[Dualia] Pièce jointe non envoyée : aucune famille active.');
      throw new Error('famille_absente');
    }
    const reponse = await fetch(`data:${contentType};base64,${base64}`);
    const blob = await reponse.blob();
    const chemin = `${familleId}/${nomFichierUnique(extensionDepuisType(contentType))}`;
    const { error } = await supabase.storage
      .from('documents-familiaux')
      .upload(chemin, blob, { contentType });
    if (error) {
      // On relance : un message ou une dépense enregistrés sans leur pièce
      // jointe laisseraient croire qu'elle est arrivée.
      console.error('[Dualia] Échec envoi de la pièce jointe :', error);
      throw error;
    }
    return { chemin, nom, type: contentType };
  },

  supprimerJustificatif: async (chemin) => {
    if (!chemin) return;

    // Le recapitulatif d'un ticket cree plusieurs depenses qui partagent un
    // seul fichier : on detache TOUTES celles qui pointent dessus. Ne vider
    // qu'une ligne laisserait les autres renvoyer vers un fichier supprime.
    set((state) => ({
      depenses: state.depenses.map((d) =>
        d.justificatifUrl === chemin
          ? {
              ...d,
              justificatifUrl: undefined,
              justificatifNom: undefined,
              justificatifType: undefined,
              justificatifExpireLe: undefined,
            }
          : d
      ),
    }));

    // Le fichier d'abord, la ligne ensuite : une ligne vidée alors que le
    // fichier reste dans le bucket laisse un document que plus personne ne
    // peut ni consulter ni supprimer — exactement ce qu'une demande
    // d'effacement doit éviter.
    const { error: erreurFichier } = await supabase.storage
      .from('documents-familiaux')
      .remove([chemin]);
    if (erreurFichier) {
      console.error('[Dualia] Échec suppression du fichier justificatif :', erreurFichier);
    }

    // On cible le chemin, pas l'identifiant : une depense tout juste creee
    // porte encore son id local (dep-...) tant que la synchronisation n'a pas
    // rendu l'id Supabase, et la mise a jour ne toucherait aucune ligne.
    const { familleId } = get();
    if (!familleId) return;
    const { error } = await supabase
      .from('depenses')
      .update({
        justificatif_url: null,
        justificatif_nom: null,
        justificatif_type: null,
        justificatif_expire_le: null,
      })
      .eq('famille_id', familleId)
      .eq('justificatif_url', chemin);
    if (error) console.error('[Dualia] Échec mise à jour de la dépense :', error);
  },

  ajouterDocument: async (doc, fichier) => {
    const { familleId, parents } = get();

    let docAvecFichier = doc;
    if (fichier && familleId) {
      try {
        const reponse = await fetch(`data:${fichier.contentType};base64,${fichier.base64}`);
        const blob = await reponse.blob();
        const extension = extensionDepuisType(fichier.contentType);
        const nomFichier = `${familleId}/${nomFichierUnique(extension)}`;
        const { error: erreurUpload } = await supabase.storage
          .from('documents-familiaux')
          .upload(nomFichier, blob, { contentType: fichier.contentType });
        if (erreurUpload) {
          console.error('[Dualia] Échec envoi fichier document :', erreurUpload);
          // On relance : un document enregistré sans sa pièce jointe est un
          // document vide. L'écran doit pouvoir le dire à l'utilisateur au
          // lieu de laisser croire que tout s'est bien passé.
          throw erreurUpload;
        }
        // On stocke le CHEMIN dans le bucket, pas une URL publique : le bucket
        // est privé, la lecture se fait par URL signée à durée limitée au
        // moment de l'ouverture (voir ouvrirDocument dans documents.tsx).
        docAvecFichier = { ...doc, fichierUrl: nomFichier };
      } catch (err) {
        console.error('[Dualia] Échec traitement fichier document :', err);
        throw err;
      }
    }

    set((state) => ({ documents: [docAvecFichier, ...state.documents] }));

    if (!familleId) {
      console.error('[Dualia] Document non synchronisé : aucune famille active.');
      return;
    }
    const auteurUuid = parents[docAvecFichier.auteurId]?.uuid;
    const { data, error } = await supabase
      .from('documents')
      .insert(documentVersDB(docAvecFichier, familleId, auteurUuid))
      .select()
      .single();

    if (error || !data) {
      console.error('[Dualia] Échec synchronisation document :', error);
      // Sans ligne en base, le document n'existe pour personne : le laisser
      // dans la liste afficherait une erreur ET le document, et le fichier
      // resterait dans le bucket sans aucun chemin connu pour le retrouver.
      set((state) => ({ documents: state.documents.filter((d) => d !== docAvecFichier) }));
      if (docAvecFichier.fichierUrl) {
        const { error: erreurNettoyage } = await supabase.storage
          .from('documents-familiaux')
          .remove([docAvecFichier.fichierUrl]);
        if (erreurNettoyage) {
          console.error('[Dualia] Échec nettoyage du fichier orphelin :', erreurNettoyage);
        }
      }
      throw error ?? new Error('Échec de création du document');
    }

    set((state) => ({
      documents: state.documents.map((d) =>
        d === docAvecFichier || d.id === docAvecFichier.id ? { ...d, id: data.id } : d
      ),
    }));

    // Rattachement aux enfants concernés, dans la table de liaison.
    const enfantIds = docAvecFichier.enfantIds ?? [];
    if (enfantIds.length > 0) {
      const { error: erreurLiaisons } = await supabase
        .from('document_enfants')
        .insert(enfantIds.map((enfantId) => ({ document_id: data.id, enfant_id: enfantId })));
      if (erreurLiaisons) console.error('[Dualia] Échec rattachement document-enfant :', erreurLiaisons);
    }
  },

  // Modification d'un document : les champs simples partent dans la table
  // documents, les enfants concernés dans la table de liaison, qui est
  // remplacée en bloc (supprimer puis réinsérer) plutôt que calculée en
  // différentiel — la liste est courte et le remplacement est sans ambiguïté.
  modifierDocument: async (id, updates) => {
    set((state) => ({
      documents: state.documents.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    }));

    const dbUpdates: Record<string, any> = {};
    if (updates.nom !== undefined) dbUpdates.nom = updates.nom;
    if (updates.categorie !== undefined) dbUpdates.categorie = updates.categorie;
    if (updates.note !== undefined) dbUpdates.note = updates.note || null;
    if (updates.portee !== undefined) dbUpdates.portee = updates.portee;
    if (updates.dateExpiration !== undefined)
      dbUpdates.date_expiration = updates.dateExpiration ? updates.dateExpiration.split('T')[0] : null;

    if (Object.keys(dbUpdates).length > 0) {
      const { error } = await supabase.from('documents').update(dbUpdates).eq('id', id);
      if (error) {
        console.error('[Dualia] Échec modification document (distant) :', error);
        throw error;
      }
    }

    if (updates.enfantIds !== undefined) {
      const { error: erreurSuppression } = await supabase
        .from('document_enfants')
        .delete()
        .eq('document_id', id);
      if (erreurSuppression) {
        console.error('[Dualia] Échec remise à plat document_enfants :', erreurSuppression);
        throw erreurSuppression;
      }
      if (updates.enfantIds.length > 0) {
        const { error: erreurInsertion } = await supabase
          .from('document_enfants')
          .insert(updates.enfantIds.map((enfantId) => ({ document_id: id, enfant_id: enfantId })));
        if (erreurInsertion) {
          console.error('[Dualia] Échec rattachement document-enfant :', erreurInsertion);
          throw erreurInsertion;
        }
      }
    }
  },

  supprimerDocument: (id) => {
    // Le chemin du fichier doit etre lu AVANT de retirer la ligne : une fois
    // la ligne partie, plus personne ne sait ou se trouve le fichier, et il
    // reste dans le bucket sans que l'application puisse le supprimer. Une
    // demande d'effacement laisserait alors le document en place.
    const chemin = get().documents.find((d) => d.id === id)?.fichierUrl;

    set((state) => ({ documents: state.documents.filter((d) => d.id !== id) }));

    if (chemin) {
      supabase.storage
        .from('documents-familiaux')
        .remove([chemin])
        .then(({ error }) => {
          if (error) console.error('[Dualia] Échec suppression du fichier document :', error);
        });
    }

    supabase
      .from('documents')
      .delete()
      .eq('id', id)
      .then(({ error }) => {
        if (error) console.error('[Dualia] Échec suppression document (distant) :', error);
      });
  },

  setNouvelleDecisionDraft: (texte) => set({ nouvelleDecisionDraft: texte }),

  // Changer de langue ne touche QU'À la langue. Cette fonction réinjectait
  // auparavant des jeux de données de démonstration, ce qui remplaçait les
  // décisions, messages, entrées de journal, dépenses et documents réels de
  // la famille à chaque changement de langue. Les textes d'interface sont
  // traduits via TRADUCTIONS, jamais via le contenu du store.
  setLangue: (langue) => {
    const cartes = { fr: FAMILY_CARD_FR, pt: FAMILY_CARD_PT, es: FAMILY_CARD_ES, en: FAMILY_CARD_EN };
    set({ langue, familyCard: cartes[langue] ?? FAMILY_CARD_FR });
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

  enfants: [],

  ajouterEnfant: async (e, photoUri) => {
    const familleId = get().familleId;

    let photoUrl = e.photoUrl;
    // Chemin en base, URL signee a l'ecran.
    let photoUrlAffichage: string | undefined;
    if (photoUri && familleId) {
      try {
        const reponse = await fetch(photoUri);
        const blob = await reponse.blob();
        const nomFichier = `${familleId}/${nomFichierUnique('jpg')}`;
        const { error: erreurUpload } = await supabase.storage
          .from('enfants-photos')
          .upload(nomFichier, blob, { contentType: 'image/jpeg' });
        if (erreurUpload) {
          console.error('[Dualia] Échec envoi photo enfant :', erreurUpload);
        } else {
          photoUrl = nomFichier;
          photoUrlAffichage = await signerUnChemin('enfants-photos', nomFichier);
        }
      } catch (err) {
        console.error('[Dualia] Échec traitement photo enfant :', err);
      }
    }

    const enfantAvecPhoto = { ...e, photoUrl };
    const enfantPourAffichage = { ...e, photoUrl: photoUrlAffichage ?? photoUrl };
    set((state) => ({ enfants: [...state.enfants, enfantPourAffichage] }));

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
        en === enfantPourAffichage || en.id === e.id ? { ...en, id: data.id } : en
      ),
    }));

    // Rattachement aux foyers. Sans cette étape, l'enfant n'existe pour aucun
    // module qui raisonne par foyer : garde, transmission, calendrier.
    const { foyers, configFoyers, associerEnfantAuFoyer } = get();
    const foyersActifs = foyers.filter((f) => f.actif);
    if (foyersActifs.length === 0) {
      console.error('[Dualia] Enfant non rattaché : aucun foyer sur cet espace familial.');
      return;
    }
    // Foyer commun : un seul foyer, c'est la résidence principale.
    // Deux foyers : rattaché aux deux, aucune résidence principale — l'alternance
    // est le défaut, l'exclusive sera marquée depuis le cadre familial.
    const residencePrincipale = configFoyers === 'foyer_commun';
    for (const foyer of foyersActifs) {
      await associerEnfantAuFoyer(foyer.id, data.id, residencePrincipale);
    }
  },

  modifierEnfant: async (id, updates, photoUri) => {
    const familleId = get().familleId;
    let photoUrl = updates.photoUrl;
    // Chemin en base, URL signee a l'ecran.
    let photoUrlAffichage: string | undefined;
    if (photoUri && familleId) {
      try {
        const reponse = await fetch(photoUri);
        const blob = await reponse.blob();
        const nomFichier = `${familleId}/${nomFichierUnique('jpg')}`;
        const { error: erreurUpload } = await supabase.storage
          .from('enfants-photos')
          .upload(nomFichier, blob, { contentType: 'image/jpeg' });
        if (erreurUpload) {
          console.error('[Dualia] Échec envoi photo enfant :', erreurUpload);
        } else {
          photoUrl = nomFichier;
          photoUrlAffichage = await signerUnChemin('enfants-photos', nomFichier);
        }
      } catch (err) {
        console.error('[Dualia] Échec traitement photo enfant :', err);
      }
    }
    const updatesAvecPhoto = photoUrl !== undefined ? { ...updates, photoUrl } : updates;
    const updatesAffichage =
      photoUrlAffichage !== undefined ? { ...updatesAvecPhoto, photoUrl: photoUrlAffichage } : updatesAvecPhoto;

    set((state) => ({
      enfants: state.enfants.map((e) => (e.id === id ? { ...e, ...updatesAffichage } : e)),
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

  moments: [],

  ajouterMoment: async ({ texte, enfantId, photoUri }) => {
    const { familleId, parentActif, parents } = get();
    if (!familleId) {
      console.error('[Dualia] Moment non synchronisé : aucune famille active.');
      return;
    }

    let photoUrl: string | undefined;
    // Chemin en base, URL signee a l'ecran.
    let photoUrlAffichage: string | undefined;
    if (photoUri) {
      try {
        const reponse = await fetch(photoUri);
        const blob = await reponse.blob();
        const nomFichier = `${familleId}/${nomFichierUnique('jpg')}`;
        const { error: erreurUpload } = await supabase.storage
          .from('moments-photos')
          .upload(nomFichier, blob, { contentType: 'image/jpeg' });
        if (erreurUpload) {
          console.error('[Dualia] Échec envoi photo du moment :', erreurUpload);
        } else {
          photoUrl = nomFichier;
          photoUrlAffichage = await signerUnChemin('moments-photos', nomFichier);
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
        enfant_id: enfantId || null,
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

    // On affiche l'URL signee, tandis que la base conserve le chemin.
    const momentAffiche = momentDepuisDB(data, roleParUuidLocal);
    set((state) => ({
      moments: [
        photoUrlAffichage ? { ...momentAffiche, photoUrl: photoUrlAffichage } : momentAffiche,
        ...state.moments,
      ],
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
    const cadre = get().cadreFamilial;
    const dejaValide = cadre?.statut === 'valide';
    const valideLe = new Date().toISOString();
    const cadreFamilialId = cadre?.id;
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

    if (!dejaValide && cadre) {
      const { parents, genererCalendrierAlterne, genererCalendrierGardeWeekend, genererDatesSpeciales, genererVacancesScolaires } = get();

      if (cadre.garde) {
        const texteGarde = `${cadre.garde.residencePrincipale || ''} ${cadre.garde.droitVisiteHebergementDescription || ''}`.toLowerCase();
        const alternee = texteGarde.includes('altern');
        const genre: 'mere' | 'pere' | null = texteGarde.includes('mère') || texteGarde.includes('mere')
          ? 'mere'
          : texteGarde.includes('père') || texteGarde.includes('pere')
          ? 'pere'
          : null;
        const parentResident: ParentRole = genre
          ? ((['A', 'B'] as ParentRole[]).find((id) => parents[id].genreParental === genre) ?? 'A')
          : 'A';

        if (alternee) {
          genererCalendrierAlterne(new Date().toISOString(), parentResident, 12);
        } else if (cadre.garde.weekendParite) {
          genererCalendrierGardeWeekend(new Date().toISOString(), parentResident, 12);
        }
      }

      if (cadre.datesSpeciales && cadre.datesSpeciales.length > 0) {
        genererDatesSpeciales(cadre.datesSpeciales, new Date().getFullYear(), 3);
      }

      genererVacancesScolaires();
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

  // ---------- Personne / Foyer ----------

  foyers: [],
  configFoyers: null,

  chargerFoyers: async (familleId) => {
    const { data: foyersDB, error: erreurFoyers } = await supabase
      .from('foyers')
      .select('*')
      .eq('famille_id', familleId)
      .order('cree_le', { ascending: true });
    if (erreurFoyers) {
      console.error('[Dualia] Échec chargement foyers :', erreurFoyers);
      set({ foyers: [] });
      return;
    }

    const foyerIds = (foyersDB ?? []).map((f: any) => f.id);
    let personnesDB: any[] = [];
    let enfantsDB: any[] = [];
    if (foyerIds.length > 0) {
      const [{ data: pData, error: pErr }, { data: eData, error: eErr }] = await Promise.all([
        supabase.from('foyer_personnes').select('*').in('foyer_id', foyerIds),
        supabase.from('foyer_enfants').select('*').in('foyer_id', foyerIds),
      ]);
      if (pErr) console.error('[Dualia] Échec chargement foyer_personnes :', pErr);
      if (eErr) console.error('[Dualia] Échec chargement foyer_enfants :', eErr);
      personnesDB = pData ?? [];
      enfantsDB = eData ?? [];
    }

    const { data: familleDB, error: erreurFamille } = await supabase
      .from('familles')
      .select('config_foyers')
      .eq('id', familleId)
      .maybeSingle();
    if (erreurFamille) console.error('[Dualia] Échec lecture config_foyers :', erreurFamille);

    set({
      foyers: construireFoyers(foyersDB ?? [], personnesDB, enfantsDB),
      configFoyers: (familleDB?.config_foyers as ConfigFoyers) ?? null,
    });
  },

  configurerFoyersInitial: async (config) => {
    const { error } = await supabase.rpc('configurer_foyers_initial', { p_config: config });
    if (error) {
      console.error('[Dualia] Échec configuration initiale des foyers :', error);
      throw error;
    }
    set({ configFoyers: config });

    const familleId = get().familleId;
    if (familleId) {
      await get().chargerFoyers(familleId);
    }
  },

  modifierFoyer: async (id, updates) => {
    set((state) => ({
      foyers: state.foyers.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    }));

    const dbUpdates: Record<string, any> = {};
    if (updates.nom !== undefined) dbUpdates.nom = updates.nom;
    if (updates.adresse !== undefined) dbUpdates.adresse = updates.adresse || null;
    if (updates.ville !== undefined) dbUpdates.ville = updates.ville || null;
    if (updates.codePostal !== undefined) dbUpdates.code_postal = updates.codePostal || null;
    if (updates.pays !== undefined) dbUpdates.pays = updates.pays || null;
    if (updates.couleur !== undefined) dbUpdates.couleur = updates.couleur || null;
    if (updates.adresseVisible !== undefined) dbUpdates.adresse_visible = updates.adresseVisible;
    if (updates.actif !== undefined) dbUpdates.actif = updates.actif;
    if (Object.keys(dbUpdates).length === 0) return;

    const { error } = await supabase.from('foyers').update(dbUpdates).eq('id', id);
    if (error) console.error('[Dualia] Échec sync modification foyer (distant) :', error);
  },

  associerEnfantAuFoyer: async (foyerId, enfantId, residencePrincipale = false) => {
    set((state) => ({
      foyers: state.foyers.map((f) => {
        if (f.id !== foyerId) return f;
        const dejaResidence = f.enfantIdsResidencePrincipale ?? [];
        return {
          ...f,
          enfantIds: f.enfantIds.includes(enfantId) ? f.enfantIds : [...f.enfantIds, enfantId],
          enfantIdsResidencePrincipale:
            residencePrincipale && !dejaResidence.includes(enfantId)
              ? [...dejaResidence, enfantId]
              : dejaResidence,
        };
      }),
    }));
    const { error } = await supabase
      .from('foyer_enfants')
      .insert({ foyer_id: foyerId, enfant_id: enfantId, residence_principale: residencePrincipale });
    if (error) console.error('[Dualia] Échec association enfant-foyer (distant) :', error);
  },

  retirerEnfantDuFoyer: async (foyerId, enfantId) => {
    set((state) => ({
      foyers: state.foyers.map((f) =>
        f.id === foyerId
          ? {
              ...f,
              enfantIds: f.enfantIds.filter((id) => id !== enfantId),
              enfantIdsResidencePrincipale: (f.enfantIdsResidencePrincipale ?? []).filter(
                (id) => id !== enfantId
              ),
            }
          : f
      ),
    }));
    const { error } = await supabase
      .from('foyer_enfants')
      .delete()
      .eq('foyer_id', foyerId)
      .eq('enfant_id', enfantId);
    if (error) console.error('[Dualia] Échec retrait enfant-foyer (distant) :', error);
  },

  // Résidence principale : pertinente en garde exclusive, absente en garde
  // alternée. Un enfant ne peut en avoir qu'une seule — la base le garantit
  // par un index unique partiel. On efface donc toujours l'ancienne avant
  // d'écrire la nouvelle, sinon Postgres rejette l'écriture.
  definirResidencePrincipale: async (foyerId, enfantId, valeur) => {
    set((state) => ({
      foyers: state.foyers.map((f) => {
        const sansCetEnfant = (f.enfantIdsResidencePrincipale ?? []).filter((id) => id !== enfantId);
        return {
          ...f,
          enfantIdsResidencePrincipale:
            f.id === foyerId && valeur ? [...sansCetEnfant, enfantId] : sansCetEnfant,
        };
      }),
    }));

    const { error: erreurEffacement } = await supabase
      .from('foyer_enfants')
      .update({ residence_principale: false })
      .eq('enfant_id', enfantId)
      .eq('residence_principale', true);
    if (erreurEffacement) {
      console.error('[Dualia] Échec effacement résidence principale (distant) :', erreurEffacement);
      return;
    }

    if (!valeur) return;

    const { error } = await supabase
      .from('foyer_enfants')
      .update({ residence_principale: true })
      .eq('foyer_id', foyerId)
      .eq('enfant_id', enfantId);
    if (error) console.error('[Dualia] Échec définition résidence principale (distant) :', error);
  },

  chargerEspaceFamilial: async (familleId: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      set({ chargementInitial: false });
      return;
    }

    const { data: moi, error: erreurMoi } = await supabase
      .from('parents')
      .select('id, famille_id, nom, role, couleur')
      .eq('user_id', user.id)
      .eq('famille_id', familleId)
      .single();

    if (erreurMoi || !moi) {
      console.error('[Dualia] Impossible de charger le profil parent pour cet espace :', erreurMoi);
      set({ chargementInitial: false });
      return;
    }

    let tousLesParents: any[] | null = null;
    const essaiAvecGenre = await supabase
      .from('parents')
      .select('id, nom, role, couleur, genre_parental')
      .eq('famille_id', familleId);

    if (essaiAvecGenre.error) {
      console.error('[Dualia] Colonne genre_parental indisponible, repli sans elle :', essaiAvecGenre.error);
      const essaiSansGenre = await supabase
        .from('parents')
        .select('id, nom, role, couleur')
        .eq('famille_id', familleId);
      if (essaiSansGenre.error) {
        console.error('[Dualia] Échec chargement des parents (les deux tentatives) :', essaiSansGenre.error);
      }
      tousLesParents = essaiSansGenre.data;
    } else {
      tousLesParents = essaiAvecGenre.data;
    }

    const parentsMap: Record<ParentRole, Parent> = { ...PARENTS };
    (tousLesParents ?? []).forEach((p: any) => {
      const role = p.role as ParentRole;
      parentsMap[role] = {
        id: role,
        nom: p.nom,
        email: '',
        couleur: p.couleur ?? PARENTS[role].couleur,
        uuid: p.id,
        genreParental: p.genre_parental ?? undefined,
      };
    });

    set({
      familleId,
      parentActif: moi.role as ParentRole,
      parents: parentsMap,
      // On repart d'une session de parent : toute trace d'un espace tiers
      // precedent doit disparaitre.
      accesTiers: null,
    });

    const { data: cadreDB, error: erreurCadre } = await supabase
      .from('cadre_familial')
      .select('*')
      .eq('famille_id', familleId)
      .maybeSingle();

    if (erreurCadre) {
      console.error('[Dualia] Échec chargement cadre familial :', erreurCadre);
      set({ cadreFamilial: null });
    } else if (cadreDB) {
      const { data: reglesDB } = await supabase
        .from('regles_partage')
        .select('*')
        .eq('cadre_familial_id', cadreDB.id);
      set({ cadreFamilial: cadreDepuisDB(cadreDB, reglesDB ?? []) });
    } else {
      set({ cadreFamilial: null });
    }

    const roleParUuid: Record<string, ParentRole> = {};
    (tousLesParents ?? []).forEach((p: any) => {
      roleParUuid[p.id] = p.role as ParentRole;
    });

    const { data: evenementsDB, error: erreurEvenements } = await supabase
      .from('evenements_calendrier')
      .select('*')
      .eq('famille_id', familleId);
    if (erreurEvenements) console.error('[Dualia] Échec chargement événements calendrier :', erreurEvenements);
    set({ evenementsCalendrier: (evenementsDB ?? []).map((e: any) => evenementCalendrierDepuisDB(e, roleParUuid)) });

    const { data: depensesDB, error: erreurDepenses } = await supabase
      .from('depenses')
      .select('*')
      .eq('famille_id', familleId)
      .order('date', { ascending: false });
    if (erreurDepenses) console.error('[Dualia] Échec chargement dépenses :', erreurDepenses);
    set({ depenses: (depensesDB ?? []).map((d: any) => depenseDepuisDB(d, roleParUuid)) });

    const { data: journalDB, error: erreurJournal } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('famille_id', familleId)
      .order('date', { ascending: false });
    if (erreurJournal) console.error('[Dualia] Échec chargement journal :', erreurJournal);
    const journalCharge = (journalDB ?? []).map((e: any) => journalDepuisDB(e, roleParUuid));
    const urlsJournal = await signerChemins('journal-photos', journalCharge.map((e) => e.photoUrl));
    set({
      journalEntries: journalCharge.map((e) =>
        e.photoUrl && urlsJournal[e.photoUrl] ? { ...e, photoUrl: urlsJournal[e.photoUrl] } : e
      ),
    });

    const { data: decisionsDB, error: erreurDecisions } = await supabase
      .from('decisions')
      .select('*')
      .eq('famille_id', familleId)
      .order('date_creation', { ascending: false });
    if (erreurDecisions) console.error('[Dualia] Échec chargement décisions :', erreurDecisions);
    set({ decisions: (decisionsDB ?? []).map((row: any) => decisionDepuisDB(row, roleParUuid)) });

    const { data: messagesDB, error: erreurMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('famille_id', familleId)
      .order('date_envoi', { ascending: true });
    if (erreurMessages) console.error('[Dualia] Échec chargement messages :', erreurMessages);
    set({ messages: (messagesDB ?? []).map((row: any) => messageDepuisDB(row, roleParUuid)) });

    const { data: tiersDB, error: erreurTiers } = await supabase
      .from('tiers')
      .select('*')
      .eq('famille_id', familleId)
      .order('cree_le', { ascending: false });
    if (erreurTiers) console.error('[Dualia] Échec chargement accès tiers :', erreurTiers);

    const idsTiers = (tiersDB ?? []).map((row: any) => row.id);
    let liensTiers: any[] = [];
    if (idsTiers.length > 0) {
      const { data: liensDB, error: erreurLiens } = await supabase
        .from('tiers_enfants')
        .select('tiers_id, enfant_id')
        .in('tiers_id', idsTiers);
      if (erreurLiens) console.error('[Dualia] Échec chargement des rattachements tiers :', erreurLiens);
      liensTiers = liensDB ?? [];
    }
    set({
      tiers: (tiersDB ?? []).map((row: any) =>
        tiersDepuisDB(
          row,
          roleParUuid,
          liensTiers.filter((l) => l.tiers_id === row.id).map((l) => l.enfant_id)
        )
      ),
    });

    const { data: agendaScolaireDB, error: erreurAgendaScolaire } = await supabase
      .from('agenda_scolaire')
      .select('*')
      .eq('famille_id', familleId)
      .order('date_echeance', { ascending: true });
    if (erreurAgendaScolaire) console.error('[Dualia] Échec chargement agenda scolaire :', erreurAgendaScolaire);
    set({ agendaScolaire: (agendaScolaireDB ?? []).map((row: any) => agendaScolaireDepuisDB(row, roleParUuid)) });

    const { data: evenementsGardeDB, error: erreurEvenementsGarde } = await supabase
      .from('evenements_garde')
      .select('*')
      .eq('famille_id', familleId)
      .order('date_debut', { ascending: true });
    if (erreurEvenementsGarde) console.error('[Dualia] Échec chargement calendrier de garde :', erreurEvenementsGarde);
    set({ evenements: (evenementsGardeDB ?? []).map((row: any) => evenementGardeDepuisDB(row, roleParUuid)) });

    const { data: documentsDB, error: erreurDocuments } = await supabase
      .from('documents')
      .select('*')
      .eq('famille_id', familleId)
      .order('date', { ascending: false });
    if (erreurDocuments) console.error('[Dualia] Échec chargement documents :', erreurDocuments);

    // Enfants concernés : table de liaison, chargée en une seule requête pour
    // tous les documents de la famille plutôt qu'une requête par document.
    const documentIds = (documentsDB ?? []).map((d: any) => d.id);
    let liaisonsDocEnfants: any[] = [];
    if (documentIds.length > 0) {
      const { data: liaisons, error: erreurLiaisons } = await supabase
        .from('document_enfants')
        .select('*')
        .in('document_id', documentIds);
      if (erreurLiaisons) console.error('[Dualia] Échec chargement document_enfants :', erreurLiaisons);
      liaisonsDocEnfants = liaisons ?? [];
    }
    set({
      documents: (documentsDB ?? []).map((row: any) =>
        documentDepuisDB(
          row,
          roleParUuid,
          liaisonsDocEnfants.filter((l) => l.document_id === row.id).map((l) => l.enfant_id)
        )
      ),
    });

    const { data: enfantsDB, error: erreurEnfants } = await supabase
      .from('enfants')
      .select('*')
      .eq('famille_id', familleId)
      .order('prenom', { ascending: true });
    if (erreurEnfants) {
      console.error('[Dualia] Échec chargement enfants :', erreurEnfants);
      set({ enfants: [] });
    } else {
      const { data: contactsDB, error: erreurContacts } = await supabase
        .from('contacts_urgence')
        .select('*')
        .eq('famille_id', familleId)
        .order('priorite', { ascending: true });
      if (erreurContacts) console.error("[Dualia] Échec chargement contacts d'urgence :", erreurContacts);

      const enfantsCharges = (enfantsDB ?? []).map((row: any) =>
        enfantDepuisDB(
          row,
          (contactsDB ?? []).filter((c: any) => c.enfant_id === row.id).map(contactUrgenceDepuisDB)
        )
      );
      // Les photos sont stockees sous forme de chemin : on les signe en une
      // requete pour l'ensemble des enfants.
      const urlsEnfants = await signerChemins('enfants-photos', enfantsCharges.map((e) => e.photoUrl));
      set({
        enfants: enfantsCharges.map((e) =>
          e.photoUrl && urlsEnfants[e.photoUrl] ? { ...e, photoUrl: urlsEnfants[e.photoUrl] } : e
        ),
      });
    }

    const { data: momentsDB, error: erreurMoments } = await supabase
      .from('moments')
      .select('*')
      .eq('famille_id', familleId)
      .order('created_at', { ascending: false });
    if (erreurMoments) console.error('[Dualia] Échec chargement Fil de vie :', erreurMoments);
    const momentsCharges = (momentsDB ?? []).map((row: any) => momentDepuisDB(row, roleParUuid));
    const urlsMoments = await signerChemins('moments-photos', momentsCharges.map((m) => m.photoUrl));
    set({
      moments: momentsCharges.map((m) =>
        m.photoUrl && urlsMoments[m.photoUrl] ? { ...m, photoUrl: urlsMoments[m.photoUrl] } : m
      ),
    });

    await get().chargerFoyers(familleId);

    set({ chargementInitial: false });
  },

  changerEspaceFamilial: async (familleId: string) => {
    if (get().familleId === familleId) return;
    set({ chargementInitial: true });
    await get().chargerEspaceFamilial(familleId);
  },

  familleId: null,
  chargementInitial: true,

  initialiserSession: async () => {
    // Sans ce drapeau, une reconnexion sur un appareil ou un familleId est
    // encore persiste laisse les redirections du layout se declencher pendant
    // le chargement : on atterrit sur la configuration de foyers d'une famille
    // a laquelle on n'appartient plus.
    set({ chargementInitial: true });

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      set({ chargementInitial: false });
      return;
    }

    const { data: mesAppartenances, error: erreurAppartenances } = await supabase
      .from('parents')
      .select('famille_id, role')
      .eq('user_id', user.id);

    if (erreurAppartenances || !mesAppartenances || mesAppartenances.length === 0) {
      // Avant de conclure a un compte orphelin : cette personne est peut-etre
      // un tiers (nounou, grand-parent, ecole). Sans ce detour, elle arrivait
      // sur un message d'erreur alors que son acces est parfaitement valide.
      const estUnTiers = await get().chargerEspaceTiers();
      if (estUnTiers) return;

      console.error('[Dualia] Aucun espace familial trouvé pour cet utilisateur :', erreurAppartenances);
      set({ chargementInitial: false, espacesFamiliaux: [] });
      return;
    }

    const familleIds = mesAppartenances.map((a: any) => a.famille_id);
    const { data: autresParents } = await supabase
      .from('parents')
      .select('famille_id, nom, user_id')
      .in('famille_id', familleIds);

    const espacesFamiliaux: EspaceFamilial[] = mesAppartenances.map((a: any) => {
      const autre = (autresParents ?? []).find(
        (p: any) => p.famille_id === a.famille_id && p.user_id !== user.id
      );
      return {
        familleId: a.famille_id,
        label: autre?.nom ? `Avec ${autre.nom}` : 'Espace familial',
        monRole: a.role as ParentRole,
      };
    });

    set({ espacesFamiliaux });

    const familleActivePersistee = get().familleId;
    const espaceActif =
      (familleActivePersistee && espacesFamiliaux.find((e) => e.familleId === familleActivePersistee)) ||
      espacesFamiliaux[0];

    await get().chargerEspaceFamilial(espaceActif.familleId);
  },
}),
    {
      name: 'dualia-storage',
      storage: dualiaStorage,
      partialize: (state) => ({
        decisions: state.decisions,
        messages: state.messages,
        journalEntries: state.journalEntries.map(({ photoUrl, ...rest }) => rest),
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
        // Les URL signees expirent : on ne les persiste pas, sinon une session
        // rouverte le lendemain afficherait des images mortes. Elles sont
        // resignees a chaque chargement de l'espace familial.
        enfants: state.enfants.map(({ photoUrl, ...rest }) => rest),
        moments: state.moments.map(({ photoUrl, ...rest }) => rest),
        familleId: state.familleId,
        espacesFamiliaux: state.espacesFamiliaux,
        foyers: state.foyers,
        configFoyers: state.configFoyers,
      }),
    }
  )
);