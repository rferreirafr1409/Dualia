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
  VerdictGarde, VerdictDatesSpeciales, VerdictFinalisation, VerdictVacances, RegimeGardeConfirme,
} from '../types';
import { entetesBackend } from '../lib/appelBackend';
import { proposerAcademie } from '../lib/zoneScolaire';
import { COLORS } from '../constants/theme';
import { Langue } from '../constants/i18n';
import { supabase, effacerSessionLocale } from '../constants/supabase';
import { jourPourBase, depuisJourLocal, instantDepuisHeureLocale, estInstantValide } from '../lib/dates';
import { oublierDerniereActivite } from '../lib/inactivite';
// Décision de génération du calendrier de garde : une seule
// implémentation, pure et éprouvée par test-garde.ts, partagée avec
// l'écran de validation du cadre. Elle était écrite deux fois, ici et
// là-bas, avec deux détections différentes : l'écran pouvait annoncer un
// régime que le store ne générait pas.
import {
  planifierGarde,
  lundiDeLaSemaine,
  construireSemainesAlternees,
  construireSemainesWeekend,
  NOTES_MODELE,
  NOTE_JUGEMENT_WEEKEND,
} from '../lib/gardeJugement';
import { BACKEND_URL, SUFFIXE_STOCKAGE } from '../constants/environnement';

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

// Les vacances scolaires étaient ici, écrites à la main : dix périodes, zone C
// uniquement, qui s'arrêtaient en mai 2028.
//
// Trois défauts, et le troisième est le pire :
//   - une seule zone sur trois, donc fausses pour deux familles sur trois ;
//   - une fin de validité silencieuse — en mai 2028 le calendrier n'aurait
//     plus rien affiché, sans que rien ne le signale ;
//   - chaque repère était posé avec `parentId: 'A'`, si bien que « Vacances de
//     Noël » apparaissait ATTRIBUÉ AU PÈRE. Un magistrat y lit une attribution
//     de garde. Ce n'en était pas une.
//
// Les dates viennent désormais du jeu de données officiel de l'Éducation
// nationale, par api/vacances-scolaires.js, et les repères n'appartiennent à
// aucun parent. Voir genererVacancesScolaires plus bas.

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

const ROLES: string[] = ['A', 'B'];

const MOTIFS_VERDICT = [
  'aucune_garde', 'regime_non_confirme', 'echec_enregistrement', 'non_tente',
] as const;

// La colonne `garde` est du JSONB : ce qui en revient n'a aucune garantie de
// forme. Un statut ou un motif inconnu — colonne écrite par une version plus
// récente de l'application, ou modifiée à la main — faisait afficher
// « Calendrier non généré » suivi d'une explication vide. On ne garde que ce
// qu'on sait interpréter.
const gardeDepuisDB = (brut: any): CadreFamilial['garde'] => {
  if (!brut || typeof brut !== 'object') return undefined;
  const g = { ...brut } as NonNullable<CadreFamilial['garde']>;
  const gen: any = brut.generation;
  if (!gen || (gen.statut !== 'genere' && gen.statut !== 'non_genere')) {
    delete g.generation;
    return g;
  }
  if (gen.statut === 'non_genere' && !MOTIFS_VERDICT.includes(gen.motif)) {
    g.generation = { statut: 'non_genere', motif: 'non_tente', le: gen.le };
  }
  // Le modèle et le parent décident ce que l'écran affiche, et le régime
  // confirmé décide ce qui serait régénéré : les valider aussi. Un rôle
  // inconnu produisait 24 événements attribués à un parent qui n'existe
  // pas — jours sans nom ni couleur dans l'Agenda — et un modèle absent
  // faisait afficher « en semaine chez , week-ends des — chez . ».
  if (gen.statut === 'genere' && (gen.modele !== 'alternee' && gen.modele !== 'weekend')) {
    g.generation = { statut: 'non_genere', motif: 'non_tente', le: gen.le };
  }
  if (g.generation?.statut === 'genere' && !ROLES.includes(g.generation.parentId as any)) {
    g.generation = { statut: 'non_genere', motif: 'non_tente', le: gen.le };
  }
  const r: any = g.regimeConfirme;
  const residenceValide = r && (ROLES.includes(r.residence) || r.residence === 'alternee');
  const debutValide = r?.parentQuiCommence === undefined || ROLES.includes(r.parentQuiCommence);
  const pariteValide = r?.parite === undefined || r.parite === 'paires' || r.parite === 'impaires';
  if (r && !(residenceValide && debutValide && pariteValide)) delete g.regimeConfirme;
  return g;
};

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
  garde: gardeDepuisDB(c.garde),
  datesSpeciales: c.dates_speciales ?? undefined,
  documentSource: c.document_source_type
    ? { id: c.id, type: c.document_source_type, date: c.document_source_date ?? undefined }
    : undefined,
  regles: regles.map(regleDepuisDB),
});

async function assurerCadreFamilialDistant(familleId: string, cadre: CadreFamilial): Promise<string> {
  // Un import de jugement est une PROPOSITION. Cet upsert réécrit la ligne
  // entière : tel quel, il effaçait ce que le parent avait saisi ou confirmé
  // lui-même, sans qu'aucun écran ne le signale.
  //
  // Deux pertes, vérifiées :
  //
  //   · pension_extra.indexation.indiceInitialConfirme — l'indice INSEE de
  //     référence, tapé à la main et « verrouillé » par le parent. Une
  //     extraction fraîche (construireCadreFamilial) ne porte AUCUNE
  //     indexation : le champ partait donc à chaque réimport, et avec lui la
  //     base de toutes les revalorisations de la pension.
  //   · garde.regimeConfirme et garde.generation — la réponse du parent à
  //     « où la résidence est-elle fixée ? » et le verdict de génération du
  //     calendrier.
  //
  // C'est exactement le danger que verrouillerIndiceInitial documente pour
  // justifier son update d'une seule colonne. La leçon n'avait pas été
  // appliquée ici. On relit donc l'existant et on reporte ce que le nouveau
  // cadre n'apporte pas.
  const { data: existant } = await supabase
    .from('cadre_familial')
    .select('garde, pension_extra')
    .eq('famille_id', familleId)
    .maybeSingle();

  const extraExistant = (existant?.pension_extra ?? null) as
    | { indexation?: { indiceInitialConfirme?: number } }
    | null;
  const indiceVerrouille = extraExistant?.indexation?.indiceInitialConfirme;

  const indexationFusionnee =
    cadre.pension?.indexation?.indiceInitialConfirme === undefined && indiceVerrouille !== undefined
      ? { ...(cadre.pension?.indexation ?? {}), indiceInitialConfirme: indiceVerrouille }
      : cadre.pension?.indexation;

  // Le bloc garde, lui, ne survit que si le nouveau cadre n'en apporte pas :
  // un jugement différent impose de reposer la question du régime, et l'écran
  // de validation la repose. Conserver l'ancien régime sous de nouvelles
  // clauses produirait un calendrier justifié par le mauvais document.
  const gardeAEcrire = cadre.garde ?? existant?.garde ?? null;

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
        garde: gardeAEcrire,
        dates_speciales: cadre.datesSpeciales ?? null,
        pension_extra: cadre.pension
          ? {
              montantParEnfant: cadre.pension.montantParEnfant,
              nombreEnfantsConcernes: cadre.pension.nombreEnfantsConcernes,
              indexation: indexationFusionnee,
            }
          : extraExistant,
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

const EST_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * La purge d'un ancien planning n'est lancée que si CHAQUE événement qu'on
 * vient de poser a reçu son identifiant distant.
 *
 * Pourquoi : purgerPlanningsGeneres épargne les identifiants qu'on lui
 * passe, mais ne retient que les UUID — un identifiant local
 * (« garde-sem-1759… ») est écarté du `.not('id','in',…)`. Si la
 * réconciliation est partielle, la liste à épargner rétrécit, et le DELETE
 * emporte les lignes fraîchement insérées. L'écran, lui, annonce « 12
 * semaines générées » : le parent garde son planning sur son appareil, le
 * co-parent et le magistrat ne voient rien, et aucun rechargement ne révèle
 * la contradiction.
 *
 * En cas de doute on ne purge donc pas. Un ancien planning qui subsiste se
 * voit et se régénère ; un nouveau planning effacé en silence, non.
 */
function purgeSansRisque(poses: string[], attendus: number): boolean {
  const complet = poses.length === attendus && poses.every((id) => EST_UUID.test(id));
  if (!complet) {
    console.error(
      '[Dualia] Purge de l’ancien planning ignorée : identifiants distants incomplets ' +
        `(${poses.filter((id) => EST_UUID.test(id)).length}/${attendus}). ` +
        'Le nouveau planning est en base ; l’ancien peut subsister.'
    );
  }
  return complet;
}

const evenementCalendrierVersDB = (ev: EvenementCalendrier, familleId: string, parentUuid?: string) => ({
  famille_id: familleId,
  titre: ev.titre,
  date: ev.date,
  parent_id: parentUuid ?? null,
  enfant: ev.enfant ?? null,
  enfant_id: ev.enfantId ?? null,
  // La colonne existe et le type la porte, mais elle n'etait jamais envoyee :
  // le lien vers le message d'origine se perdait a la synchronisation, et tous
  // les evenements ressemblaient a des saisies manuelles.
  //
  // On ne l'envoie que si c'est un vrai uuid. La colonne est de type uuid avec
  // une cle etrangere vers messages, alors que l'application fabrique d'abord
  // des identifiants locaux du genre « msg-1759000000000 », remplaces par
  // l'uuid de Supabase une fois le message synchronise. Transmettre
  // l'identifiant local ferait echouer l'insertion — et comme l'evenement est
  // ajoute a l'etat local avant l'appel reseau, il resterait affiche chez ce
  // parent sans jamais parvenir a l'autre. Precisement la divergence
  // silencieuse que tout ce travail cherche a supprimer.
  source_message_id: EST_UUID.test(ev.sourceMessageId ?? '') ? ev.sourceMessageId : null,
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
  date: jourPourBase(dep.date),
  rembourse: dep.rembourse,
  part_a: dep.partA ?? null,
  part_b: dep.partB ?? null,
  commercant: dep.commercant ?? null,
  lignes_detail: dep.lignesDetail ?? null,
  justificatif_url: dep.justificatifUrl ?? null,
  justificatif_nom: dep.justificatifNom ?? null,
  justificatif_type: dep.justificatifType ?? null,
  justificatif_expire_le: dep.justificatifExpireLe ?? null,
  remboursement_recu: dep.remboursementRecu ?? null,
  accord_prealable_confirme: dep.accordPrealableConfirme ?? null,
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
  remboursementRecu: d.remboursement_recu != null ? Number(d.remboursement_recu) : undefined,
  accordPrealableConfirme: d.accord_prealable_confirme ?? undefined,
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
  fuseau_expediteur: m.fuseauExpediteur ?? null,
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
  fuseauExpediteur: row.fuseau_expediteur ?? undefined,
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
    // Le serveur dit qui a le droit d'ecrire. En son absence on suppose
    // que non : refuser a tort se repare d'un rechargement, autoriser a
    // tort affiche un formulaire dont l'enregistrement echouera.
    modifiable: f.modifiable === true,
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

/**
 * A quoi le compte connecte est-il rattache.
 *
 *   'inconnu'          : pas de reponse claire. Hors ligne, erreur reseau,
 *                        lecture refusee, chargement en cours. AUCUNE
 *                        redirection ne doit se declencher sur cette valeur.
 *   'parent'           : au moins un espace familial.
 *   'tiers'            : un acces tiers actif (nounou, grand-parent, ecole).
 *   'acces_retire'     : un acces tiers a existe et n'est plus valide.
 *                        Different de 'jamais_rattache' : proposer a cette
 *                        personne de creer un espace de coparentalite serait
 *                        absurde, et lui dire que son espace « n'a pas
 *                        encore ete cree » serait faux.
 *   'demande_en_attente' : un co-parent invite a depose sa demande et attend
 *                        la validation. Sa ligne dans `parents` n'existe pas
 *                        encore — elle nait a l'acceptation. Le confondre
 *                        avec un compte neuf lui faisait creer SON espace a
 *                        lui : les deux parents se retrouvaient chacun dans
 *                        le sien, sans un mot d'erreur.
 *   'jamais_rattache'  : compte confirme, rien de rattache, rien de revoque.
 *                        C'est le seul etat ou l'on propose de creer un
 *                        espace.
 */
type Rattachement =
  | 'inconnu'
  | 'parent'
  | 'tiers'
  | 'acces_retire'
  | 'demande_en_attente'
  | 'jamais_rattache';

/** Ce que la lecture des acces tiers a pu etablir — ou non. */
type VerdictTiers = 'tiers' | 'acces_retire' | 'aucun_acces' | 'indetermine';

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
  /** Rend les identifiants effectivement enregistrés en base, ou null en
   *  cas d'échec. La réponse est indispensable à deux titres : le verdict
   *  de génération affiché au parent ne doit jamais reposer sur un simple
   *  appel effectué, et la purge de l'ancien planning doit savoir ce
   *  qu'elle ne doit pas effacer. */
  ajouterEvenementsEnLot: (evs: EvenementGarde[]) => Promise<string[] | null>;
  supprimerEvenementGarde: (id: string) => void;
  confierGardeATiers: (dateIso: string, tiersId: string) => void;
  /** `depuisIso` borne la purge : seuls les plannings générés qui
   *  commencent à cette date ou après sont effacés. Sans borne, tout
   *  l'historique généré part, et la régénération ne reconstruit que
   *  l'avenir. */
  purgerPlanningsGeneres: (depuisIso?: string, epargner?: string[]) => Promise<void>;
  /** Rend VRAI si le planning est bien enregistré en base. */
  genererCalendrierAlterne: (
    dateDebutIso: string,
    parentQuiCommence: ParentRole,
    nombreSemaines: number
  ) => Promise<boolean>;
  /** `parite` vient du jugement (« week-ends des semaines paires ») et se lit
   *  sur le vrai numéro de semaine ISO. Sans elle, l'alternance repart de la
   *  date de départ, ce qui convient au modèle choisi à la main depuis
   *  l'Agenda mais jamais à un planning issu d'un jugement. */
  genererCalendrierGardeWeekend: (
    dateDebutIso: string,
    parentResident: ParentRole,
    nombreSemaines: number,
    parite?: 'paires' | 'impaires',
    /** Note portée par les événements créés : elle distingue le planning
     *  issu du jugement de celui que le parent compose depuis l'Agenda. */
    note?: string
  ) => Promise<boolean>;
  setGenreParental: (id: ParentRole, genre: 'mere' | 'pere' | 'autre') => void;
  verrouillerIndiceInitial: (valeur: number) => Promise<void>;
  genererDatesSpeciales: (
    dates: { occasion: string; parent?: ParentRole; parentGenre?: 'mere' | 'pere' }[],
    anneeDebut: number,
    nombreAnnees: number
  ) => VerdictDatesSpeciales;
  genererVacancesScolaires: () => Promise<VerdictVacances>;
  evenementsCalendrier: EvenementCalendrier[];
  // Rend VRAI si l'evenement a ete retenu, FAUX si sa date etait illisible et
  // qu'il a donc ete refuse. Les ecrans doivent tester cette reponse avant
  // d'annoncer quoi que ce soit au parent.
  ajouterEvenementCalendrier: (ev: EvenementCalendrier) => boolean;
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
  // Rend un VERDICT, et non un booleen : « pas de tiers » et « je n'ai pas
  // pu savoir » menaient au meme false, et ce false decidait ensuite si l'on
  // propose a quelqu'un de creer un espace familial.
  chargerEspaceTiers: () => Promise<VerdictTiers>;
  // Vide les donnees de l'espace familial gardees sur l'appareil. A appeler
  // a chaque changement d'utilisateur : le stockage local est partage par
  // tous ceux qui ouvrent l'application sur ce navigateur.
  purgerDonneesFamiliales: () => void;
  generationDonnees: number;

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
  // Rend VRAI si la base a bien supprime. FAUX si le serveur a refuse,
  // auquel cas l'enfant est remis dans la liste : l'ecran doit le dire
  // plutot que d'afficher une suppression qui n'a pas eu lieu.
  supprimerEnfant: (id: string) => Promise<boolean>;
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
  /** Rend le compte rendu de ce qui a été généré, et de ce qui ne l'a pas
   *  été. L'écran de validation l'affiche : il annonçait « calendrier
   *  généré » à la seule vue du statut « validé », y compris quand rien
   *  n'avait pu être créé faute de savoir lequel des deux parents le
   *  jugement désignait. */
  finaliserCadreFamilial: () => Promise<VerdictFinalisation>;
  /** Interne : exécute le plan de garde et enregistre son verdict. Exposé sur
   *  le store pour que la validation et la reprise partagent exactement le
   *  même chemin, verdict compris. */
  appliquerPlanGarde: (regime?: RegimeGardeConfirme) => Promise<VerdictGarde>;
  /** Le parent confirme le régime lu dans le jugement — chez qui la
   *  résidence est fixée, et la parité des week-ends — et le calendrier est
   *  généré à partir de sa réponse, jamais d'une lecture du texte. */
  confirmerRegimeGarde: (regime: RegimeGardeConfirme) => Promise<VerdictGarde>;

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
  // Rend VRAI si la base a bien enregistre. FAUX si le foyer appartient a
  // l'autre parent, ou si l'ecriture a ete refusee : l'ecran doit le dire
  // plutot que d'afficher une modification qui n'existe pas.
  modifierFoyer: (
    id: string,
    updates: Partial<Pick<Foyer, 'nom' | 'adresse' | 'ville' | 'codePostal' | 'pays' | 'couleur' | 'adresseVisible' | 'actif'>>
  ) => Promise<boolean>;
  associerEnfantAuFoyer: (foyerId: string, enfantId: string, residencePrincipale?: boolean) => Promise<void>;
  retirerEnfantDuFoyer: (foyerId: string, enfantId: string) => Promise<void>;
  definirResidencePrincipale: (foyerId: string, enfantId: string, valeur: boolean) => Promise<void>;

  espacesFamiliaux: EspaceFamilial[];
  chargerEspaceFamilial: (familleId: string) => Promise<void>;
  // Le chargement lui-meme, sans la mise en file. Reserve a
  // chargerEspaceFamilial : l'appeler directement fait perdre la garantie
  // que deux espaces ne se chargent jamais en meme temps.
  chargerEspaceFamilialSansFile: (familleId: string) => Promise<void>;
  changerEspaceFamilial: (familleId: string) => Promise<void>;

  familleId: string | null;
  chargementInitial: boolean;
  // null tant qu'on n'a pas regarde, false quand aucune session n'existe sur
  // cet appareil, true quand une session valide est presente. Le layout s'en
  // sert pour renvoyer vers la connexion : sans ce drapeau, l'application
  // affichait l'espace familial reconstitue depuis le stockage local, sans
  // qu'aucun mot de passe ait ete saisi.
  sessionActive: boolean | null;
  // Passe a true des que la question « y a-t-il une session ? » est tranchee,
  // dans TOUTES les branches — y compris celles ou la reponse est « on ne sait
  // pas ». C'est ce drapeau, et non chargementInitial, qui debloque l'affichage
  // : attendre la fin du chargement complet de l'espace familial ferait
  // patienter le parent plusieurs secondes devant un ecran vide a chaque
  // ouverture, alors qu'une seule question doit etre tranchee avant de rendre
  // quoi que ce soit.
  sessionVerifiee: boolean;
  // A quoi ce compte est-il rattache ? Quatre reponses possibles, et
  // 'inconnu' en est une : c'est tout l'objet de ce champ.
  //
  // Un compte d'authentification peut exister SANS rien : c'est l'etat d'un
  // parent qui a cree son compte, recu l'e-mail de confirmation, et dont
  // l'espace n'a jamais ete fabrique — puisque creer_famille() est appelee
  // juste apres l'inscription, session en main, et que la confirmation
  // obligatoire retire cette session. Cette personne atterrissait sur un
  // accueil vide sans aucun chemin de retour, l'ecran de creation n'etant
  // propose qu'aux visiteurs SANS session. Deux comptes reels sont deja
  // dans cet etat.
  //
  // Mais « je ne trouve rien » n'est pas « il n'y a rien » : une panne
  // reseau, un refus de lecture, un acces tiers retire donnent tous une
  // reponse vide, pour des raisons entierement differentes. Les confondre
  // proposait a une nounou de creer un espace de coparentalite parce que sa
  // 4G avait faibli. D'ou une valeur par reponse, et 'inconnu' par defaut :
  // aucune redirection ne s'appuie sur une absence de reponse.
  rattachement: Rattachement;
  initialiserSession: () => Promise<void>;
  // Rend true si la session a bien ete fermee cote serveur. false signifie
  // que l'appareil est propre mais que la session reste ouverte ailleurs :
  // l'ecran doit le dire au parent plutot que de le laisser croire le
  // contraire.
  // portee 'local' : ne ferme que cet appareil. Utilisee par la deconnexion
  // automatique — expirer sur l'ordinateur familial ne doit pas deconnecter
  // le telephone du parent, qui decouvrirait la chose le lendemain sans
  // comprendre pourquoi.
  seDeconnecter: (portee?: 'global' | 'local') => Promise<boolean>;
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

// Chargement d'espace familial en cours, s'il y en a un. Vit hors du store :
// c'est une file d'attente, pas un etat a afficher ni a persister. Voir
// chargerEspaceFamilial.
let chargementEnVol: Promise<void> | null = null;

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

    // Écriture de la seule colonne concernée, et non de la ligne entière.
    // assurerCadreFamilialDistant fait un upsert de tout le cadre, garde
    // comprise : verrouiller l'indice INSEE depuis une session dont le
    // cadre en mémoire précédait la génération du calendrier écrasait le
    // bloc garde de l'autre parent, verdict inclus.
    const { error } = await supabase
      .from('cadre_familial')
      .update({
        pension_extra: {
          montantParEnfant: cadreMisAJour.pension?.montantParEnfant,
          nombreEnfantsConcernes: cadreMisAJour.pension?.nombreEnfantsConcernes,
          indexation: cadreMisAJour.pension?.indexation,
        },
      })
      .eq('famille_id', familleId);

    if (error) console.error("[Dualia] Échec enregistrement de l'indice INSEE initial :", error);
  },

  ajouterEvenement: (ev) => {
    set((state) => ({ evenements: [...state.evenements, ev] }));

    const { familleId, parents } = get();
    if (!familleId) {
      console.error('[Dualia] Événement de garde non synchronisé : aucune famille active.');
      return;
    }
    // Un evenement sans parent est legitime : un repere de vacances scolaires
        // n'appartient a personne. La colonne parent_id est nullable.
        const parentUuid = ev.parentId ? parents[ev.parentId]?.uuid : undefined;
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
    if (evs.length === 0) return [];

    set((state) => ({ evenements: [...state.evenements, ...evs] }));

    // Retire de l'état ce qui vient d'y être ajouté. Sans ce retour en
    // arrière, un échec laissait douze semaines de planning visibles dans
    // l'Agenda alors que la base n'en contenait aucune — et l'écran de
    // validation annonçait, à raison, que rien n'avait été conservé. Les
    // deux écrans se contredisaient dans la même session.
    const annuler = () =>
      set((state) => ({
        evenements: state.evenements.filter((e) => !evs.some((ajoute) => ajoute.id === e.id)),
      }));

    const { familleId, parents } = get();
    if (!familleId) {
      console.error('[Dualia] Planning non synchronisé : aucune famille active.');
      annuler();
      return null;
    }

    const { data, error } = await supabase
      .from('evenements_garde')
      .insert(evs.map((ev) => evenementGardeVersDB(ev, familleId, parents[ev.parentId]?.uuid)))
      .select();

    // `data: []` est TRUTHY : un tableau vide passait pour une réussite, et
    // le planning était ensuite annoncé comme généré alors que la réponse ne
    // ramenait aucune ligne.
    if (error || !data || data.length === 0) {
      console.error('[Dualia] Échec synchronisation du planning :', error);
      // La réponse remonte jusqu'au verdict affiché : un planning qui
      // n'existe qu'en mémoire ne doit pas être annoncé comme généré. Il
      // disparaîtrait au rechargement suivant, après que l'écran a affirmé
      // le contraire.
      annuler();
      return null;
    }

    // Réconciliation des identifiants par date de début plutôt que par
    // position : PostgREST ne garantit pas l'ordre des lignes retournées,
    // alors qu'au sein d'un planning généré chaque date de début est unique.
    const idParDebut = new Map<string, string>();
    for (const row of data as any[]) {
      idParDebut.set(new Date(row.date_debut).getTime().toString(), row.id);
    }

    const locaux = new Map(evs.map((ev) => [ev.id, ev.dateDebut]));
    const idsPoses: string[] = [];

    set((state) => ({
      evenements: state.evenements.map((e) => {
        const debut = locaux.get(e.id);
        if (!debut) return e;
        const idDistant = idParDebut.get(new Date(debut).getTime().toString());
        idsPoses.push(idDistant ?? e.id);
        return idDistant ? { ...e, id: idDistant } : e;
      }),
    }));

    return idsPoses;
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
  purgerPlanningsGeneres: async (depuisIso, epargner) => {
    const { familleId } = get();
    const epargnes = new Set(epargner ?? []);

    // Borne dans le temps. La purge effaçait TOUS les plannings générés
    // depuis l'origine, y compris des mois de passé consignant où les
    // enfants s'étaient effectivement trouvés. Régénérer ne reconstruit
    // que l'avenir : l'historique partait définitivement. Devant un
    // magistrat, cet historique est précisément ce qui a de la valeur.
    const borne = depuisIso ? new Date(depuisIso).getTime() : null;
    // Chevauchement, et non date de début : un bloc commencé avant la borne
    // mais qui se termine après elle survivait à la purge, restait devant le
    // nouveau planning dans la liste, et le calendrier rendait ce jour-là au
    // parent de l'ancien plan.
    const aEffacer = (e: { id: string; notes?: string; dateFin: string }) =>
      !epargnes.has(e.id) &&
      NOTES_MODELE.includes(e.notes ?? '') &&
      (borne === null || new Date(e.dateFin).getTime() >= borne);

    set((state) => ({ evenements: state.evenements.filter((e) => !aEffacer(e)) }));

    if (!familleId) return;

    let requete = supabase
      .from('evenements_garde')
      .delete()
      .eq('famille_id', familleId)
      .in('notes', NOTES_MODELE);
    if (depuisIso) requete = requete.gte('date_fin', depuisIso);
    // Les identifiants qui viennent d'être posés : les effacer reviendrait
    // à supprimer le planning que l'on est en train d'installer.
    const aEpargner = (epargner ?? []).filter((id) => EST_UUID.test(id));
    if (aEpargner.length > 0) requete = requete.not('id', 'in', `(${aEpargner.join(',')})`);

    const { error } = await requete;

    if (error) console.error('[Dualia] Échec purge des plannings générés :', error);
  },

  // Poser le nouveau planning D'ABORD, effacer l'ancien ENSUITE.
  //
  // L'ordre inverse détruisait le planning existant avant de savoir si le
  // nouveau pouvait être écrit : hors ligne ou sur un refus de droits, le
  // parent lisait « le planning n'a pas pu être enregistré, rien n'a été
  // conservé » et trouvait son Agenda vidé à partir de cette semaine, sans
  // recours. Les deux plannings coexistent maintenant le temps d'un aller-
  // retour réseau, ce qui est sans conséquence, et c'est l'ancien qui
  // disparaît en dernier.
  genererCalendrierAlterne: async (dateDebutIso, parentQuiCommence, nombreSemaines) => {
    const { ajouterEvenementsEnLot, purgerPlanningsGeneres } = get();
    const evenements = construireSemainesAlternees(dateDebutIso, parentQuiCommence, nombreSemaines);
    const poses = await ajouterEvenementsEnLot(evenements);
    if (!poses) return false;
    if (!purgeSansRisque(poses, evenements.length)) return true;
    await purgerPlanningsGeneres(evenements[0]?.dateDebut, poses);
    return true;
  },

  genererCalendrierGardeWeekend: async (dateDebutIso, parentResident, nombreSemaines, parite, note) => {
    const { ajouterEvenementsEnLot, purgerPlanningsGeneres } = get();
    const evenements = construireSemainesWeekend(
      dateDebutIso,
      parentResident,
      nombreSemaines,
      parite,
      undefined,
      note
    );
    const poses = await ajouterEvenementsEnLot(evenements);
    if (!poses) return false;
    if (!purgeSansRisque(poses, evenements.length)) return true;
    await purgerPlanningsGeneres(evenements[0]?.dateDebut, poses);
    return true;
  },

  genererDatesSpeciales: (dates, anneeDebut, nombreAnnees) => {
    const { ajouterEvenementCalendrier, parents } = get();
    let genere = 0;
    const ignoreesSet = new Set<string>();
    const sansParentSet = new Set<string>();

    // Le jugement écrit « Noël chez le père ». La correspondance avec l'un
    // des deux comptes passe par genreParental, et quand elle échoue il n'y
    // a pas de repli possible : l'ancien `d.parent || 'A'` plaçait Noël chez
    // le parent A par défaut, donc chez la mère une fois sur deux, dans un
    // calendrier présenté comme issu du jugement. On ne crée rien et on le
    // dit — c'est la même règle que pour le calendrier de garde.
    const roleDe = (d: { parent?: ParentRole; parentGenre?: 'mere' | 'pere' }): ParentRole | null => {
      if (d.parent === 'A' || d.parent === 'B') return d.parent;
      if (d.parentGenre) {
        return (
          (['A', 'B'] as ParentRole[]).find((id) => parents[id].genreParental === d.parentGenre) ??
          null
        );
      }
      return null;
    };

    for (const d of dates) {
      const occasion = d.occasion.toLowerCase();
      let uneDateCalculee = false;

      const role = roleDe(d);
      if (!role) {
        sansParentSet.add(d.occasion);
        continue;
      }

      const cleFete = Object.keys(FETES_JUIVES).find((cle) => occasion.includes(cle));
      if (cleFete) {
        const table = FETES_JUIVES[cleFete];
        for (const annee of Object.keys(table).map(Number)) {
          if (annee < anneeDebut || annee >= anneeDebut + nombreAnnees) continue;
          const { debut, jours } = table[annee];
          // Meme piege : les dates des fetes sont ecrites 'AAAA-MM-JJ'.
          const dateDebutFete = depuisJourLocal(debut);
          for (let j = 0; j < jours; j++) {
            const dateJour = new Date(dateDebutFete);
            dateJour.setDate(dateJour.getDate() + j);
            // On ne compte que ce qui est effectivement retenu : le nombre
            // annonce au parent a la fin doit correspondre a ce qu'il verra
            // dans son calendrier, pas au nombre de tentatives.
            if (ajouterEvenementCalendrier({
              id: `date-speciale-${Date.now()}-${annee}-${j}-${cleFete.replace(/\s/g, '')}`,
              titre: jours > 1 ? `${d.occasion} (jour ${j + 1}/${jours})` : d.occasion,
              date: dateJour.toISOString(),
              parentId: role,
            })) genere++;
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
          if (ajouterEvenementCalendrier({
            id: `date-speciale-${Date.now()}-${a}-${occasion.replace(/\s/g, '')}`,
            titre: d.occasion,
            date: date.toISOString(),
            parentId: role,
          })) genere++;
        }
      }

      if (!uneDateCalculee) ignoreesSet.add(d.occasion);
    }

    return { genere, ignorees: Array.from(ignoreesSet), sansParent: Array.from(sansParentSet) };
  },

  genererVacancesScolaires: async () => {
    const { ajouterEvenementCalendrier, foyers, evenementsCalendrier } = get();

    // 1 — De quelle académie relève le foyer des enfants ?
    //
    // Déduit du code postal, jamais demandé : c'est ce que voulait dire
    // « quand un parent se connecte dans sa zone, tout est déjà inscrit ».
    // Mais Dualia ne décide pas de la ZONE — voir lib/zoneScolaire.ts.
    const proposition = proposerAcademie(foyers);
    if (proposition.statut !== 'proposee') {
      return {
        genere: 0,
        motif: proposition.statut,
        detail:
          proposition.statut === 'aucun_foyer'
            ? undefined
            : proposition.statut === 'code_postal_absent'
            ? proposition.foyerNom
            : `${proposition.foyerNom} — ${proposition.codePostal}`,
      };
    }

    // 2 — Les dates, au jeu de données officiel. Aucune date n'est écrite
    //     dans Dualia : une table figée devient fausse sans prévenir.
    let reponse: any;
    try {
      const r = await fetch(`${BACKEND_URL}/api/vacances-scolaires`, {
        method: 'POST',
        headers: await entetesBackend(),
        body: JSON.stringify({ academie: proposition.academie }),
      });
      reponse = await r.json();
      if (!r.ok) throw new Error(reponse?.error || `HTTP ${r.status}`);
    } catch (e: any) {
      console.error('[Dualia] Calendrier scolaire indisponible :', e);
      return {
        genere: 0,
        motif: 'service_indisponible',
        academie: proposition.academie,
        detail: e?.message,
      };
    }

    const periodes: { nom: string; debut: string; fin: string }[] = Array.isArray(reponse?.periodes)
      ? reponse.periodes
      : [];
    if (periodes.length === 0) {
      return {
        genere: 0,
        motif: 'aucune_periode',
        academie: proposition.academie,
        detail: reponse?.avertissement,
        source: reponse?.source,
        releveLe: reponse?.releveLe,
      };
    }

    // 3 — Pose des repères.
    //
    // La zone est reprise TELLE QUE les données officielles la donnent, et
    // elle figure dans l'intitulé : un tiers qui lit le calendrier doit
    // pouvoir savoir de quel calendrier scolaire il s'agit.
    const zoneCourte = String(reponse?.zone ?? '').replace(/^zone\s*/i, '').trim();
    const suffixe = zoneCourte ? ` (zone ${zoneCourte})` : '';

    // Un parent qui revalide son cadre ne doit pas voir ses vacances en
    // double. On compare sur l'intitulé et le jour, les seules choses qui
    // comptent ici.
    const dejaPose = new Set(
      evenementsCalendrier.map((e) => `${e.titre}|${String(e.date).slice(0, 10)}`)
    );

    let genere = 0;
    for (const periode of periodes) {
      const bornes: { prefixe: string; jour: string }[] = [
        { prefixe: 'Début', jour: periode.debut },
        // `fin` est le jour de REPRISE, pas le dernier jour de vacances :
        // c'est la convention du jeu de données, et celle que l'application
        // utilisait déjà.
        { prefixe: 'Reprise', jour: periode.fin },
      ];
      for (const borne of bornes) {
        const titre = `${borne.prefixe} — ${periode.nom}${suffixe}`;
        // depuisJourLocal : new Date('2026-10-17') vaut minuit UTC, donc
        // 02:00 à Paris. Les vacances s'affichaient avec une heure.
        const date = depuisJourLocal(borne.jour);
        if (dejaPose.has(`${titre}|${borne.jour}`)) continue;
        if (ajouterEvenementCalendrier({
          id: `vacances-${borne.prefixe.toLowerCase()}-${borne.jour}-${Date.now()}`,
          titre,
          date: date.toISOString(),
          // PAS DE parentId. Un repère de vacances n'appartient à personne :
          // qui a les enfants pendant les vacances, c'est le jugement qui le
          // dit. Avant, chaque repère était posé au nom du parent A.
        })) genere++;
      }
    }

    return {
      genere,
      zone: reponse?.zone ?? null,
      academie: proposition.academie,
      source: reponse?.source,
      releveLe: reponse?.releveLe,
    };
  },
      evenementsCalendrier: [],
      ajouterEvenementCalendrier: (evEntrant) => {
        // Derniere porte avant l'etat, et avant l'envoi en base. Une date
        // illisible n'a aucune valeur pour personne : elle n'apparaitrait sur
        // aucun ecran, mais partirait quand meme chez l'autre parent.
        //
        // La fonction rend VRAI si l'evenement est retenu, FAUX s'il est
        // refuse. Sans cette reponse, l'appelant fermait sa fenetre et
        // effacait la suggestion en annoncant une reussite, alors que rien
        // n'avait ete cree : un rendez-vous disparu sans un mot.
        //
        // On valide AVANT de normaliser, et c'est l'ordre qui compte : le
        // 31 fevrier a la bonne forme, et new Date(2026, 1, 31) le reporte
        // silencieusement au 3 mars. Normaliser d'abord blanchirait donc la
        // date invalide et la ferait passer le controle — un rendez-vous
        // apparaissant un jour que personne n'a jamais indique.
        if (!estInstantValide(evEntrant.date)) {
          console.error(
            '[Dualia] Événement refusé : date illisible',
            JSON.stringify(evEntrant.date)
          );
          return false;
        }
        const ev: EvenementCalendrier = {
          ...evEntrant,
          date: instantDepuisHeureLocale(evEntrant.date),
        };

        set((state) => ({ evenementsCalendrier: [...state.evenementsCalendrier, ev] }));

        const { familleId, parents } = get();
        if (!familleId) {
          // L'evenement est bien dans l'etat local : on rend VRAI. Seule la
          // synchronisation manque, et c'est un autre probleme.
          console.error('[Dualia] Événement non synchronisé : aucune famille active.');
          return true;
        }
        // Un evenement sans parent est legitime : un repere de vacances
        // scolaires n'appartient a personne. parent_id est nullable en base.
        const parentUuid = ev.parentId ? parents[ev.parentId]?.uuid : undefined;
        supabase
          .from('evenements_calendrier')
          .insert(evenementCalendrierVersDB(ev, familleId, parentUuid))
          .select()
          .single()
          .then(({ data, error }) => {
            if (error || !data) {
              console.error('[Dualia] Échec synchronisation événement calendrier :', error);
              // Retrait de l'état local. Sans ce retour en arrière, un
              // rendez-vous refusé par le serveur restait affiché chez son
              // auteur — et evenementsCalendrier est persisté, donc
              // DÉFINITIVEMENT, rechargement compris — pendant que l'autre
              // parent ne le voyait jamais. « Noël chez le père » apparaissait
              // sur un téléphone et pas sur l'autre, et le désaccord naissait
              // six semaines plus tard sans que personne ne puisse comprendre
              // pourquoi. Mieux vaut un événement qui disparaît qu'un
              // événement que l'on croit partagé.
              set((state) => ({
                evenementsCalendrier: state.evenementsCalendrier.filter(
                  (e) => !(e === ev || e.id === ev.id)
                ),
              }));
              return;
            }
            set((state) => ({
              evenementsCalendrier: state.evenementsCalendrier.map((e) =>
                e === ev || e.id === ev.id ? { ...e, id: data.id } : e
              ),
            }));
          });

        return true;
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
  // Deconnexion d'un parent. Elle n'existait que pour les tiers : un parent
  // n'avait aucun moyen de retirer ses donnees d'un ordinateur partage, ni
  // meme de quitter son espace. La purge locale vient AVANT le signOut, pour
  // que rien ne subsiste si l'appel reseau echoue.
  seDeconnecter: async (portee = 'global') => {
    oublierDerniereActivite();
    get().purgerDonneesFamiliales();
    set({ accesTiers: null, sessionActive: false, sessionVerifiee: true });

    // signOut() ne leve pas d'exception : il REND { error }. Un catch seul
    // etait du code mort, et l'erreur partait a la poubelle.
    //
    // Pire : quand le jeton d'acces a expire et que le rafraichissement
    // echoue faute de reseau, signOut() rend une erreur SANS retirer la
    // session du stockage local. Le parent voyait l'ecran de connexion,
    // pensait l'ordinateur partage propre, et le jeton de rafraichissement y
    // restait : au prochain demarrage avec du reseau, l'espace familial
    // entier revenait, sans mot de passe.
    //
    // Et repasser par signOut({ scope: 'local' }) ne sert a rien : _signOut
    // teste la portee APRES la sortie en erreur, donc le second appel suit
    // exactement le meme chemin. On retire donc la cle du stockage nous-memes.
    // signOut() vaut 'global' par defaut : il ferme la session sur TOUS les
    // appareils. Acceptable quand la personne appuie elle-meme sur le bouton,
    // pas quand un minuteur decide a sa place.
    const { error } = await supabase.auth.signOut({ scope: portee });
    if (!error) return true;

    console.error('[Dualia] Déconnexion serveur refusée :', error);
    await effacerSessionLocale();
    return false;
  },

  purgerDonneesFamiliales: () =>
    set((etat) => ({
      // Compteur de generation : chargerEspaceFamilial le capture au depart et
      // le compare avant de conclure. Sans lui, une purge (deconnexion, ou
      // evenement SIGNED_OUT) survenant pendant un chargement etait aussitot
      // recouverte par les `set` restants du chargement — et le stockage local
      // se retrouvait repeuple juste apres avoir ete vide.
      generationDonnees: etat.generationDonnees + 1,
      familleId: null,
      espacesFamiliaux: [],
      // Une purge n'est pas un verdict sur le compte : on repasse a
      // 'inconnu', sinon un changement d'espace (qui purge) ferait croire, le
      // temps du rechargement, a un compte sans espace — et declencherait la
      // redirection vers la creation d'un nouvel espace.
      rattachement: 'inconnu' as Rattachement,
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
    })),

  // Un tiers n'a pas d'espace familial : il a un acces. On ne charge donc
  // rien de la famille, seulement ce que les regles serveur lui accordent —
  // si elles refusent, les requetes reviennent vides, sans erreur.
  chargerEspaceTiers: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) return 'indetermine';

    // On lit TOUTES les lignes de cette personne, revoquees comprises, et on
    // trie ensuite. Le filtre etait pose dans la requete : un acces retire
    // rendait alors exactement la meme reponse qu'un compte qui n'a jamais
    // eu d'acces — zero ligne — alors que ce qu'il faut dire aux deux n'a
    // rien de commun.
    //
    // La regle serveur « tiers_lecture_de_soi » autorise bien la lecture de
    // ses propres lignes sans condition de statut.
    const { data: toutesMesLignes, error } = await supabase
      .from('tiers')
      .select('*')
      .eq('user_id', user.id)
      .order('cree_le', { ascending: false });

    if (error) {
      // Une panne reseau n'est pas une revocation. Sans cette distinction, on
      // annonce a une nounou que le parent lui a coupe l'acces parce que la
      // requete a echoue. On garde l'etat precedent et on ne conclut rien.
      //
      // Le verdict rendu etait « get().accesTiers !== null » : or accesTiers
      // n'est PAS persiste, donc il vaut null a chaque ouverture de page. Une
      // nounou au reseau instable etait ainsi declaree « sans aucun acces »
      // — et, depuis que cet etat declenche une redirection, invitee a creer
      // un espace de coparentalite.
      console.error('[Dualia] Échec chargement de l\'accès tiers :', error);
      set({ chargementInitial: false });
      return 'indetermine';
    }

    const lignes = toutesMesLignes ?? [];
    const mesAcces = lignes.filter((a: any) => a.statut === 'actif' && !a.revoque_le);

    if (mesAcces.length === 0) {
      // Compte sans acces actif : c'est justement le cas ou il ne faut rien
      // laisser trainer. Un tiers revoque, ou un compte cree puis abandonne,
      // heritait sinon de l'espace familial persiste par le parent precedent
      // sur ce navigateur — messages et depenses compris.
      get().purgerDonneesFamiliales();
      set({ accesTiers: null, chargementInitial: false });
      // « Retire » veut dire retire, pas « pas actif » : une ligne en
      // attente ne doit pas faire lire « votre acces a ete retire » a
      // quelqu'un dont l'acces n'a jamais encore ete ouvert.
      const retire = lignes.some((a: any) => a.revoque_le || a.statut === 'revoque');
      return retire ? 'acces_retire' : 'aucun_acces';
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
    return 'tiers';
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
    // Le reflet de l'agenda dans le calendrier peut etre refuse si la date
    // d'echeance est illisible. L'entree d'agenda, elle, est creee quand
    // meme : les deux ecrans montreraient alors des choses differentes sans
    // que personne ne le sache. On le trace au moins.
    const refletCree = ajouterEvenementCalendrier({
      id: 'cal-agenda-' + a.id,
      titre: `${LABEL_TYPE[a.type] || 'École'} : ${a.titre}`,
      date: a.dateEcheance,
      parentId: a.auteurId,
      enfant: prenomEnfant,
      enfantId: a.enfantId,
    });
    if (!refletCree) {
      console.error(
        '[Dualia] Agenda scolaire créé sans reflet au calendrier (échéance illisible) :',
        JSON.stringify(a.dateEcheance)
      );
    }

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
    // date_revelation n'etait jamais transmise : modifier la date d'ouverture
    // d'une capsule, ou decocher « capsule », semblait fonctionner puis
    // revenait au rechargement — et l'autre parent continuait de lire
    // l'ancienne date. Le test porte sur la PRESENCE de la cle, car undefined
    // est precisement la valeur qui signifie « plus de capsule ».
    if ('dateRevelation' in updatesAvecPhoto) {
      dbUpdates.date_revelation = updatesAvecPhoto.dateRevelation
        ? jourPourBase(updatesAvecPhoto.dateRevelation)
        : null;
    }
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

  // Rend VRAI si la base a bien supprime. FAUX si le serveur a refuse : dans
  // ce cas l'enfant est REMIS dans la liste, et l'ecran doit le dire.
  //
  // Cette fonction retirait l'enfant de l'affichage sans attendre la reponse
  // et se contentait de journaliser l'echec. Or la suppression etait REFUSEE
  // par Postgres des qu'un evenement ou un souvenir referencait l'enfant —
  // c'est-a-dire toujours, en usage reel. L'enfant disparaissait de l'ecran,
  // puis revenait au rechargement suivant ou sur l'appareil du co-parent.
  // Les contraintes sont corrigees en base ; ce garde-fou reste, parce qu'un
  // refus peut toujours venir d'ailleurs — droits, reseau, ligne verrouillee.
  supprimerEnfant: async (id) => {
    const avant = get().enfants;
    set((state) => ({ enfants: state.enfants.filter((e) => e.id !== id) }));

    const { error } = await supabase.from('enfants').delete().eq('id', id);
    if (error) {
      console.error('[Dualia] Suppression d’enfant refusée :', error);
      set({ enfants: avant });
      return false;
    }
    return true;
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
    // Le cadre précédent est gardé sous la main : en cas d'échec, l'écran
    // affiche « réessaie », et le parent doit retrouver l'état d'avant plutôt
    // qu'un cadre fantôme visible chez lui seul.
    const precedent = get().cadreFamilial;
    set({ cadreFamilial: cadre });

    const familleId = get().familleId;
    if (!familleId) {
      // Sortir en silence laissait un cadre purement local, que le co-parent
      // ne verrait jamais, après un écran annonçant la réussite.
      set({ cadreFamilial: precedent });
      throw new Error("Aucune famille active : le cadre familial n'a pas été enregistré.");
    }

    try {
      const cadreFamilialId = await assurerCadreFamilialDistant(familleId, cadre);

      // Les identifiants existants sont relevés AVANT toute écriture : la
      // suppression portera sur eux seuls, jamais sur ce qu'on vient de poser.
      const { data: anciennes, error: erreurLecture } = await supabase
        .from('regles_partage')
        .select('id')
        .eq('cadre_familial_id', cadreFamilialId);
      if (erreurLecture) throw erreurLecture;
      const anciensIds = (anciennes ?? []).map((r) => r.id as string);

      // ON POSE D'ABORD, ON EFFACE ENSUITE.
      //
      // L'ordre inverse — delete puis insert — détruisait les règles validées
      // avant de savoir si les nouvelles pouvaient être écrites. Si l'insert
      // échouait (réseau, refus RLS, une seule ligne invalide), la famille se
      // retrouvait avec ZÉRO règle, leur validation_statut, leur valide_le et
      // leur valide_par partis — c'est-à-dire la trace d'audit qu'un médiateur
      // vient précisément chercher — pendant que l'écran affichait
      // « Impossible d'enregistrer pour l'instant, réessaie », qui laisse
      // croire que rien n'a bougé.
      let reglesSyncees: ReglePartage[] = [];
      if (cadre.regles.length > 0) {
        const { data, error } = await supabase
          .from('regles_partage')
          .insert(cadre.regles.map((r) => regleVersDB(r, cadreFamilialId)))
          .select();
        if (error) throw error;
        reglesSyncees = (data ?? []).map(regleDepuisDB);
      }

      if (anciensIds.length > 0) {
        const { error: erreurSuppression } = await supabase
          .from('regles_partage')
          .delete()
          .in('id', anciensIds);
        if (erreurSuppression) throw erreurSuppression;
      }

      set((state) => ({
        cadreFamilial: state.cadreFamilial
          ? { ...state.cadreFamilial, id: cadreFamilialId, regles: reglesSyncees }
          : state.cadreFamilial,
      }));
    } catch (e) {
      console.error('[Dualia] Échec de la synchronisation du cadre familial :', e);
      set({ cadreFamilial: precedent });
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

  // Exécute le plan de garde et enregistre le verdict dans le cadre. Un seul
  // chemin, partagé par la validation et par une reprise ultérieure : le
  // verdict affiché à l'écran est donc forcément celui de ce qui a été fait.
  appliquerPlanGarde: async (regime) => {
    const { cadreFamilial, genererCalendrierAlterne, genererCalendrierGardeWeekend } = get();
    const garde = cadreFamilial?.garde;
    const regimeRetenu = regime ?? garde?.regimeConfirme;
    const plan = planifierGarde(garde, regimeRetenu);

    const debut = lundiDeLaSemaine(new Date()).toISOString();
    let verdict: VerdictGarde;

    // « Généré » veut dire enregistré en base, pas « la fonction de
    // génération a été appelée ». Les deux générateurs rendent désormais la
    // réponse du serveur : sans elle, une coupure réseau ou un refus RLS
    // laissait douze semaines de planning en mémoire seule, le verdict
    // annonçait une réussite, et le rechargement suivant révélait un
    // calendrier vide sous une phrase affirmant le contraire.
    if (plan.action === 'alternee') {
      const ok = await genererCalendrierAlterne(debut, plan.parentId, 12);
      verdict = ok
        ? { statut: 'genere', modele: 'alternee', parentId: plan.parentId }
        : { statut: 'non_genere', motif: 'echec_enregistrement' };
    } else if (plan.action === 'weekend') {
      const ok = await genererCalendrierGardeWeekend(
        debut,
        plan.parentId,
        12,
        plan.parite,
        NOTE_JUGEMENT_WEEKEND
      );
      verdict = ok
        ? { statut: 'genere', modele: 'weekend', parentId: plan.parentId }
        : { statut: 'non_genere', motif: 'echec_enregistrement' };
    } else {
      verdict = { statut: 'non_genere', motif: plan.motif };
      console.warn('[Dualia] Calendrier de garde non généré :', plan.motif);
    }

    // Le verdict et le régime confirmé vivent dans la colonne JSONB
    // `garde`, donc ils survivent au rechargement. Sans le verdict, l'écran
    // de validation ne pouvait que relire le texte du jugement et supposer
    // que la génération avait réussi — c'est ainsi qu'il annonçait
    // « calendrier généré » devant un calendrier vide.
    let gardeEnregistree: CadreFamilial['garde'];
    set((state) => {
      if (!state.cadreFamilial?.garde) return state;
      gardeEnregistree = {
        ...state.cadreFamilial.garde,
        // Un régime incomplet n'est pas enregistré : conservé, il devenait
        // la réponse de repli d'une session suivante, et le parent qui
        // changeait d'avis voyait régénérer son ancienne réponse pendant
        // que l'écran affichait la nouvelle.
        regimeConfirme:
          plan.action === 'rien'
            ? state.cadreFamilial.garde.regimeConfirme
            : regimeRetenu ?? state.cadreFamilial.garde.regimeConfirme,
        generation: { ...verdict, le: new Date().toISOString() },
      };
      return { cadreFamilial: { ...state.cadreFamilial, garde: gardeEnregistree } };
    });

    const id = get().cadreFamilial?.id;
    if (id && gardeEnregistree) {
      const { error } = await supabase
        .from('cadre_familial')
        .update({ garde: gardeEnregistree })
        .eq('id', id);
      if (error) console.error('[Dualia] Échec enregistrement du verdict de garde :', error);
    }

    return verdict;
  },

  confirmerRegimeGarde: async (regime) => get().appliquerPlanGarde(regime),

  finaliserCadreFamilial: async () => {
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
      const { error } = await supabase
        .from('cadre_familial')
        .update({ statut: 'valide', valide_le: valideLe })
        .eq('id', cadreFamilialId);
      if (error) console.error('[Dualia] Échec finalisation cadre familial (distant) :', error);
    } else {
      console.error('[Dualia] Finalisation locale seulement : cadre familial jamais synchronisé.');
    }

    // Un cadre déjà validé ne régénère rien de lui-même : la purge des
    // plannings générés effacerait les ajustements que les parents ont
    // faits depuis dans l'Agenda.
    if (dejaValide || !cadre) {
      // Un cadre sans garde n'a effectivement rien à générer ; un cadre
      // avec une clause de garde mais sans trace de tentative — validé
      // depuis l'appareil de l'autre parent, ou hors ligne — est un cas
      // distinct. Les confondre faisait afficher « ce document ne décrit
      // pas de mode de garde » juste sous la clause de garde affichée.
      return {
        garde:
          cadre?.garde?.generation ??
          { statut: 'non_genere', motif: cadre?.garde ? 'non_tente' : 'aucune_garde' },
        datesSpeciales: { genere: 0, ignorees: [], sansParent: [] },
        vacances: { genere: 0, motif: 'aucune_periode' },
      };
    }

    const { genererDatesSpeciales, genererVacancesScolaires, appliquerPlanGarde } = get();

    const garde = await appliquerPlanGarde();

    const datesSpeciales =
      cadre.datesSpeciales && cadre.datesSpeciales.length > 0
        ? genererDatesSpeciales(cadre.datesSpeciales, new Date().getFullYear(), 3)
        : { genere: 0, ignorees: [], sansParent: [] };

    const vacances = await genererVacancesScolaires();

    return { garde, datesSpeciales, vacances };
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
    // La lecture passe par le serveur, plus par la table.
    //
    // La rue est desormais hors de portee du client : le droit de lire la
    // colonne adresse a ete retire, et un select('*') serait refuse. La
    // fonction applique la regle — la rue n'est rendue qu'au parent qui
    // habite le foyer, ou si son proprietaire a choisi de la partager — et
    // ajoute le drapeau « modifiable » qui dit a l'ecran ce qu'il peut
    // proposer.
    // L'espace est precise : la fonction rendait sinon les foyers de TOUS
    // les espaces du compte. Une personne separee de deux co-parents
    // voyait donc, sur l'espace de l'une, le foyer de l'autre.
    const lire = async () => supabase.rpc('foyers_de_ma_famille', { p_famille_id: familleId });

    let { data: foyersDB, error: erreurFoyers } = await lire();

    // Filet : un parent rattache a aucun foyer ne pourrait plus rien
    // modifier, pas meme son propre domicile. Cet etat existe en base — un
    // second parent qui rejoint avant que la configuration des foyers soit
    // choisie n'etait rattache nulle part. On le repare ici, une fois, au
    // lieu de laisser la personne devant des champs grises sans explication.
    if (!erreurFoyers && (foyersDB ?? []).length > 0 &&
        !(foyersDB ?? []).some((f: any) => f.modifiable === true)) {
      // La famille est precisee : avec deux espaces, laisser le serveur
      // deviner reviendrait a rattacher le parent au mauvais foyer.
      const { error: erreurRattachement } = await supabase.rpc('rattacher_mon_foyer', {
        p_famille_id: familleId,
      });
      if (erreurRattachement) {
        console.error('[Dualia] Échec rattachement du parent à un foyer :', erreurRattachement);
      } else {
        ({ data: foyersDB, error: erreurFoyers } = await lire());
      }
    }

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
    const { error } = await supabase.rpc('configurer_foyers_initial', {
      p_config: config,
      p_famille_id: get().familleId,
    });
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
    // Un foyer qui ne nous appartient pas n'est plus modifiable : la base
    // refuse l'ecriture. On s'arrete donc AVANT de toucher a l'etat local,
    // sinon l'ecran afficherait une modification que le serveur n'a jamais
    // acceptee — et le parent croirait avoir corrige l'adresse de l'autre.
    const foyerVise = get().foyers.find((f) => f.id === id);
    if (foyerVise && !foyerVise.modifiable) {
      console.error('[Dualia] Modification refusée : ce foyer appartient à l’autre parent.');
      return false;
    }

    const avant = get().foyers;
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
    if (Object.keys(dbUpdates).length === 0) return true;

    // On redemande la ligne touchee. Une regle de securite qui refuse ne
    // leve pas d'erreur : elle ne renvoie simplement aucune ligne. Sans ce
    // controle, un refus serait indistinguable d'une reussite, et l'ecran
    // garderait une adresse que la base n'a pas enregistree.
    const { data, error } = await supabase
      .from('foyers')
      .update(dbUpdates)
      .eq('id', id)
      .select('id');

    if (error || !data || data.length === 0) {
      console.error('[Dualia] Modification du foyer refusée ou non enregistrée :', error);
      set({ foyers: avant });
      return false;
    }
    return true;
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

  // Deux chargements d'espace ne doivent JAMAIS s'entrelacer.
  //
  // Le chargement remplace les collections une par une, sur une quinzaine
  // d'allers-retours. Deux chargements simultanes melangeaient donc les
  // donnees de deux familles dans le store, et leurs deux controles de fin se
  // marchaient dessus : selon l'ordre d'arrivee, celui qui finissait en
  // dernier purgeait ce que l'autre venait d'ecrire. Resultat observable —
  // recharger la page puis cliquer aussitot le second espace dans le
  // selecteur (deja rempli depuis le stockage local) : tout se vide, plus
  // d'enfants, plus de messages, plus de selecteur, et aucune garde ne
  // rattrape cet etat. Il fallait recharger a la main.
  //
  // On les met donc en file : chaque chargement attend la fin du precedent.
  chargerEspaceFamilial: async (familleId: string) => {
    const precedent = chargementEnVol;
    const courant = (async () => {
      if (precedent) {
        try { await precedent; } catch { /* l'echec du precedent ne bloque pas la suite */ }
      }
      await get().chargerEspaceFamilialSansFile(familleId);
    })();

    chargementEnVol = courant;
    try {
      await courant;
    } finally {
      if (chargementEnVol === courant) chargementEnVol = null;
    }
  },

  chargerEspaceFamilialSansFile: async (familleId: string) => {
    // Generation capturee au depart : si une purge survient pendant ce
    // chargement (deconnexion, session revoquee), on ne doit pas laisser les
    // donnees fraichement lues se reinscrire dans le stockage local.
    const generationAuDepart = get().generationDonnees;
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
        // Un nom vide venu de la base se propageait tel quel, et une
        // quinzaine d'ecrans font `.nom.split(' ')[0]` pour afficher le
        // prenom : `.split` sur null leve pendant le rendu, donc ecran
        // blanc. La valeur de repli existait deja dans PARENTS, elle
        // n'etait simplement pas utilisee ici.
        nom: p.nom || PARENTS[role].nom,
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

    const roleParUuid: Record<string, ParentRole> = {};
    (tousLesParents ?? []).forEach((p: any) => {
      roleParUuid[p.id] = p.role as ParentRole;
    });


    // Les enfants d'abord, juste apres les parents.
    //
    // Ils etaient charges en quinzieme position, apres le cadre familial, les
    // regles, le calendrier, les depenses, le journal, les decisions, les
    // messages, les tiers, l'agenda, la garde et les documents — soit une
    // quinzaine d'allers-retours reseau avant que leurs photos soient signees.
    // Or les visages des enfants sont la PREMIERE chose que le parent voit en
    // ouvrant Dualia : il regardait des ronds vides pendant une demi-seconde a
    // chaque rechargement. Rien d'autre sur cet ecran n'est plus urgent.
    const { data: enfantsDB, error: erreurEnfants } = await supabase
      .from('enfants')
      .select('*')
      .eq('famille_id', familleId)
      .order('prenom', { ascending: true });
    if (erreurEnfants) {
      console.error('[Dualia] Échec chargement enfants :', erreurEnfants);
      // « Je ne trouve rien » n'est pas « il n'y a rien » : une lecture en
      // échec effaçait les enfants déjà affichés et déjà conservés en
      // local. Famille basculait alors sur « Aucun enfant enregistré ».
      // Tout le reste de cette fonction est prudent dans ce cas ; cette
      // branche ne l'était pas.
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

    // Puis le Fil de vie, pour la meme raison : le bandeau « souvenir recent »
    // de l'accueil porte une photo, et il restait vide lui aussi.
    const { data: momentsDB, error: erreurMoments } = await supabase
      .from('moments')
      .select('*')
      .eq('famille_id', familleId)
      .order('created_at', { ascending: false });
    // « Je ne trouve rien » n'est pas « il n'y a rien ».
    //
    // supabase-js rend data: null quand la requête échoue : le `?? []` qui
    // suivait écrivait donc un tableau VIDE dans l'état, et le middleware
    // persist le réécrivait aussitôt dans le stockage local. Un wifi qui
    // lâche en plein chargement ne masquait pas les données du parent, il les
    // DÉTRUISAIT sur son appareil. La branche `enfants` avait été protégée,
    // et son commentaire affirmait que « tout le reste de cette fonction est
    // prudent dans ce cas » — ce n'était pas le cas. Chaque collection est
    // désormais traitée comme elle.
    if (!erreurMoments) {
      const momentsCharges = (momentsDB ?? []).map((row: any) => momentDepuisDB(row, roleParUuid));
      const urlsMoments = await signerChemins('moments-photos', momentsCharges.map((m) => m.photoUrl));
      set({
        moments: momentsCharges.map((m) =>
          m.photoUrl && urlsMoments[m.photoUrl] ? { ...m, photoUrl: urlsMoments[m.photoUrl] } : m
        ),
      });
    }

    const { data: cadreDB, error: erreurCadre } = await supabase
      .from('cadre_familial')
      .select('*')
      .eq('famille_id', familleId)
      .maybeSingle();

    if (erreurCadre) {
      // On garde le cadre déjà connu. L'effacer sur une lecture en échec
      // faisait disparaître la pension, les règles validées et le régime de
      // garde confirmé — et, l'état étant persisté, pour de bon.
      console.error('[Dualia] Échec chargement cadre familial :', erreurCadre);
    } else if (cadreDB) {
      const { data: reglesDB } = await supabase
        .from('regles_partage')
        .select('*')
        .eq('cadre_familial_id', cadreDB.id);
      set({ cadreFamilial: cadreDepuisDB(cadreDB, reglesDB ?? []) });
    } else {
      set({ cadreFamilial: null });
    }

    const { data: evenementsDB, error: erreurEvenements } = await supabase
      .from('evenements_calendrier')
      .select('*')
      .eq('famille_id', familleId);
    if (erreurEvenements) console.error('[Dualia] Échec chargement événements calendrier :', erreurEvenements);
    // Seconde porte : les lignes deja en base. Une seule date illisible —
    // heritee d'une version anterieure, d'un import .ics malforme — suffirait
    // a rendre l'accueil blanc au chargement, avant meme que le parent ait pu
    // agir. On l'ecarte de l'affichage et on la signale dans la console plutot
    // que de faire tomber l'ecran.
    const evenementsLus = (evenementsDB ?? []).map((e: any) =>
      evenementCalendrierDepuisDB(e, roleParUuid)
    );
    const evenementsLisibles = evenementsLus.filter((e) => estInstantValide(e.date));
    if (evenementsLisibles.length !== evenementsLus.length) {
      console.error(
        '[Dualia] Événements écartés (date illisible en base) :',
        evenementsLus.filter((e) => !estInstantValide(e.date)).map((e) => ({ id: e.id, date: e.date }))
      );
    }
    if (!erreurEvenements) {
        set({ evenementsCalendrier: evenementsLisibles });
    }

    const { data: depensesDB, error: erreurDepenses } = await supabase
      .from('depenses')
      .select('*')
      .eq('famille_id', familleId)
      .order('date', { ascending: false });
    if (erreurDepenses) console.error('[Dualia] Échec chargement dépenses :', erreurDepenses);
    if (!erreurDepenses) {
        set({ depenses: (depensesDB ?? []).map((d: any) => depenseDepuisDB(d, roleParUuid)) });
    }

    const { data: journalDB, error: erreurJournal } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('famille_id', familleId)
      .order('date', { ascending: false });
    if (erreurJournal) console.error('[Dualia] Échec chargement journal :', erreurJournal);
    if (!erreurJournal) {
      const journalCharge = (journalDB ?? []).map((e: any) => journalDepuisDB(e, roleParUuid));
      const urlsJournal = await signerChemins('journal-photos', journalCharge.map((e) => e.photoUrl));
      set({
        journalEntries: journalCharge.map((e) =>
          e.photoUrl && urlsJournal[e.photoUrl] ? { ...e, photoUrl: urlsJournal[e.photoUrl] } : e
        ),
      });
    }

    const { data: decisionsDB, error: erreurDecisions } = await supabase
      .from('decisions')
      .select('*')
      .eq('famille_id', familleId)
      .order('date_creation', { ascending: false });
    if (erreurDecisions) console.error('[Dualia] Échec chargement décisions :', erreurDecisions);
    if (!erreurDecisions) {
        set({ decisions: (decisionsDB ?? []).map((row: any) => decisionDepuisDB(row, roleParUuid)) });
    }

    const { data: messagesDB, error: erreurMessages } = await supabase
      .from('messages')
      .select('*')
      .eq('famille_id', familleId)
      .order('date_envoi', { ascending: true });
    if (erreurMessages) console.error('[Dualia] Échec chargement messages :', erreurMessages);
    if (!erreurMessages) {
        set({ messages: (messagesDB ?? []).map((row: any) => messageDepuisDB(row, roleParUuid)) });
    }

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
    if (!erreurTiers) {
      set({
        tiers: (tiersDB ?? []).map((row: any) =>
          tiersDepuisDB(
            row,
            roleParUuid,
            liensTiers.filter((l) => l.tiers_id === row.id).map((l) => l.enfant_id)
          )
        ),
      });
    }

    const { data: agendaScolaireDB, error: erreurAgendaScolaire } = await supabase
      .from('agenda_scolaire')
      .select('*')
      .eq('famille_id', familleId)
      .order('date_echeance', { ascending: true });
    if (erreurAgendaScolaire) console.error('[Dualia] Échec chargement agenda scolaire :', erreurAgendaScolaire);
    if (!erreurAgendaScolaire) {
      set({ agendaScolaire: (agendaScolaireDB ?? []).map((row: any) => agendaScolaireDepuisDB(row, roleParUuid)) });
    }

    const { data: evenementsGardeDB, error: erreurEvenementsGarde } = await supabase
      .from('evenements_garde')
      .select('*')
      .eq('famille_id', familleId)
      .order('date_debut', { ascending: true });
    if (erreurEvenementsGarde) console.error('[Dualia] Échec chargement calendrier de garde :', erreurEvenementsGarde);
    if (!erreurEvenementsGarde) {
      set({ evenements: (evenementsGardeDB ?? []).map((row: any) => evenementGardeDepuisDB(row, roleParUuid)) });
    }

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
    if (!erreurDocuments) {
      set({
        documents: (documentsDB ?? []).map((row: any) =>
          documentDepuisDB(
            row,
            roleParUuid,
            liaisonsDocEnfants.filter((l) => l.document_id === row.id).map((l) => l.enfant_id)
          )
        ),
      });
    }



    await get().chargerFoyers(familleId);

    if (get().generationDonnees !== generationAuDepart) {
      // Une purge a eu lieu pendant le chargement : ce qu'on vient d'ecrire
      // appartient a une session qui n'a plus cours. On efface de nouveau.
      get().purgerDonneesFamiliales();
      set({ chargementInitial: false });
      return;
    }

    set({ chargementInitial: false });
  },

  changerEspaceFamilial: async (familleId: string) => {
    if (get().familleId === familleId) return;
    set({ chargementInitial: true });
    // On VIDE avant de charger. Le chargement remplace les collections une
    // par une, au fil d'une quinzaine d'allers-retours : sans cette purge,
    // les messages, depenses et documents de l'espace precedent restaient
    // affiches plusieurs secondes sous l'entete du nouvel espace — et une
    // reponse ecrite pendant ce laps partait vers le mauvais co-parent.
    //
    // Certaines donnees ne sont d'ailleurs jamais rechargees (les
    // propositions de repartition, par exemple) : sans purge, elles
    // passaient definitivement d'un espace a l'autre.
    //
    // La liste des espaces, elle, doit survivre : la purge l'efface aussi,
    // et seul initialiserSession la reconstruit. Sans cette precaution, le
    // selecteur disparaissait au moment precis ou l'on vient de s'en servir.
    // On attend la fin du chargement en cours AVANT de purger.
    //
    // Sinon il continue d'ecrire les donnees de l'espace precedent
    // par-dessus la purge, puis conclut — voyant la generation changee —
    // qu'une deconnexion a eu lieu : il purge une seconde fois, et la liste
    // des espaces disparait au moment precis ou l'on vient de s'en servir.
    // Plus aucune garde ne rattrape cet etat : accueil vide, sans selecteur,
    // sans redirection, jusqu'a un rechargement a la main.
    if (chargementEnVol) {
      try { await chargementEnVol; } catch { /* son echec ne nous concerne pas */ }
    }
    if (get().familleId === familleId) {
      set({ chargementInitial: false });
      return;
    }

    const espaces = get().espacesFamiliaux;
    get().purgerDonneesFamiliales();
    // Changer d'espace prouve qu'il en existe au moins un : on rend son
    // verdict au drapeau que la purge vient de remettre a 'inconnu'. Et on
    // repose chargementInitial, que le chargement attendu ci-dessus a pu
    // remettre a false en terminant.
    set({ espacesFamiliaux: espaces, rattachement: 'parent', chargementInitial: true });
    await get().chargerEspaceFamilial(familleId);
  },

  familleId: null,
  chargementInitial: true,
  sessionActive: null,
  sessionVerifiee: false,
  rattachement: 'inconnu',
  generationDonnees: 0,

  initialiserSession: async () => {
    // Sans ce drapeau, une reconnexion sur un appareil ou un familleId est
    // encore persiste laisse les redirections du layout se declencher pendant
    // le chargement : on atterrit sur la configuration de foyers d'une famille
    // a laquelle on n'appartient plus.
    //
    // rattachement repart a 'inconnu' : tant que cette execution n'a pas
    // tranche, aucune redirection ne doit s'appuyer sur la reponse de la
    // precedente.
    set({ chargementInitial: true, rattachement: 'inconnu' });

    // Capture AVANT tout appel. La verification des acces tiers purge le
    // store quand elle ne trouve rien, familleId compris : lu plus bas, ce
    // champ valait donc toujours null et la garde qui s'appuie dessus ne
    // s'executait jamais. Elle existe pour un cas precis — une regle de
    // securite qui ecarte des lignes rend une liste vide SANS erreur — et
    // elle doit donc lire l'etat d'avant.
    const familleIdPersistee = get().familleId;

    // getSession() et non getUser() : getSession lit la session stockee sur
    // l'appareil, sans aller au reseau. Une coupure de reseau ne doit pas etre
    // prise pour une absence de session et declencher la purge ci-dessous.
    // getSession() n'a ni delai maximum ni possibilite d'annulation : quand le
    // jeton doit etre rafraichi et que le reseau ne repond pas, supabase-js
    // reessaie pendant environ 25 secondes. Comme l'affichage attend cette
    // reponse, un parent qui rouvre Dualia dans le metro restait 25 secondes
    // devant un rond qui tourne — pour finalement voir ses donnees, puisque la
    // branche « on ne sait pas » les conserve. L'attente ne protegeait rien.
    //
    // Le cas qui compte pour la securite, lui, est instantane : sans session
    // stockee, supabase-js ne fait aucun appel reseau.
    const DELAI_MAX_SESSION = 2000;
    const lectureSession = await Promise.race([
      supabase.auth.getSession(),
      new Promise<'delai_depasse'>((r) => setTimeout(() => r('delai_depasse'), DELAI_MAX_SESSION)),
    ]);

    if (lectureSession === 'delai_depasse') {
      console.warn('[Dualia] Lecture de session trop lente : on conserve les données locales.');
      set({ sessionActive: null, sessionVerifiee: true, chargementInitial: false });
      return;
    }

    const { data: sessionData, error: erreurSession } = lectureSession;
    if (erreurSession) {
      // On ne sait pas. Ne rien purger, ne rien rediriger : un parent hors
      // ligne garderait sinon un ecran vide et devrait se reconnecter pour
      // consulter des donnees deja presentes sur son appareil.
      console.error('[Dualia] Impossible de lire la session :', erreurSession);
      set({ sessionActive: null, sessionVerifiee: true, chargementInitial: false });
      return;
    }
    if (!sessionData.session) {
      // Le point important de tout ce garde-fou.
      //
      // Le store est persiste (voir partialize) : messages, depenses,
      // documents, enfants, cadre familial... Sans cette purge, ouvrir Dualia
      // sur un navigateur ou un parent s'etait connecte affichait tout son
      // espace familial, reconstitue depuis le stockage local, sans aucune
      // session et sans mot de passe. Sur l'ordinateur familial d'un couple
      // separe, c'est-a-dire exactement le materiel de nos utilisateurs.
      get().purgerDonneesFamiliales();
      set({ accesTiers: null, sessionActive: false, sessionVerifiee: true, chargementInitial: false });
      return;
    }

    const { data: userData, error: erreurUser } = await supabase.auth.getUser();
    const user = userData.user;
    if (erreurUser && !user) {
      // getUser() interroge le serveur : une erreur reseau ici ne prouve rien.
      // La session locale existe, on la garde et on reessaiera au prochain
      // demarrage. C'est getSession(), ci-dessus, qui fait foi pour la purge.
      console.error('[Dualia] Session non verifiable aupres du serveur :', erreurUser);
      set({ sessionActive: null, sessionVerifiee: true, chargementInitial: false });
      return;
    }
    if (!user) {
      // Reponse claire du serveur : plus d'utilisateur derriere cette session
      // (revoquee, compte supprime). On purge.
      get().purgerDonneesFamiliales();
      set({ accesTiers: null, sessionActive: false, sessionVerifiee: true, chargementInitial: false });
      return;
    }
    set({ sessionActive: true, sessionVerifiee: true });

    const { data: mesAppartenances, error: erreurAppartenances } = await supabase
      .from('parents')
      .select('famille_id, role')
      .eq('user_id', user.id);

    // Une erreur de lecture n'est PAS une absence d'appartenance. Les deux
    // etaient traitees ensemble : une coupure de reseau au demarrage vidait
    // donc la liste des espaces d'un parent parfaitement installe — et,
    // depuis que cet etat declenche une redirection, l'aurait envoye creer
    // un nouvel espace par-dessus le sien.
    if (erreurAppartenances) {
      console.error('[Dualia] Appartenances illisibles, on conserve l’état local :', erreurAppartenances);
      set({ chargementInitial: false });
      return;
    }

    if (!mesAppartenances || mesAppartenances.length === 0) {
      // Avant de conclure a un compte orphelin : cette personne est peut-etre
      // un tiers (nounou, grand-parent, ecole). Sans ce detour, elle arrivait
      // sur un message d'erreur alors que son acces est parfaitement valide.
      const verdict = await get().chargerEspaceTiers();

      if (verdict === 'tiers') {
        set({ rattachement: 'tiers' });
        return;
      }
      if (verdict === 'indetermine') {
        // La lecture des acces a echoue : on ne sait rien de plus qu'avant.
        set({ chargementInitial: false, rattachement: 'inconnu' });
        return;
      }
      if (verdict === 'acces_retire') {
        set({ chargementInitial: false, espacesFamiliaux: [], rattachement: 'acces_retire' });
        return;
      }

      // Derniere precaution avant de conclure au compte neuf.
      //
      // PostgREST ne rend PAS d'erreur quand une regle de securite ecarte des
      // lignes : il rend une liste vide. Le jour ou une politique sur
      // `parents` changerait de forme — renommage, migration d'identites —
      // tous les parents installes deviendraient « comptes neufs », et se
      // verraient proposer de creer un espace par-dessus le leur.
      //
      // Un familleId persiste sur cet appareil signifie qu'un espace y a
      // deja ete charge pour ce compte. La deconnexion purge ce champ, donc
      // un vrai compte neuf le trouve toujours vide. Sa presence face a une
      // liste vide est donc une contradiction : on ne conclut pas.
      if (familleIdPersistee) {
        console.error(
          '[Dualia] Aucune appartenance lue alors qu’un espace est mémorisé sur cet appareil : lecture probablement refusée, aucune conclusion tirée.'
        );
        set({ chargementInitial: false, rattachement: 'inconnu' });
        return;
      }

      // Un co-parent invite qui attend la validation est exactement dans cet
      // etat : son compte existe, sa demande est deposee, et sa ligne dans
      // `parents` ne naitra qu'a l'acceptation. Sans cette question, il etait
      // envoye vers « Terminons votre espace familial — c'est la derniere
      // etape » et fabriquait SON espace. A l'acceptation, son compte en
      // avait deux, et tout ce qu'il avait saisi entre-temps se trouvait dans
      // l'espace orphelin : deux parents separes, chacun chez soi, sans le
      // moindre message.
      const { data: etatDemande, error: erreurDemande } = await supabase.rpc('etat_de_ma_demande');
      if (erreurDemande) {
        console.error('[Dualia] État de la demande illisible :', erreurDemande);
        set({ chargementInitial: false, rattachement: 'inconnu' });
        return;
      }
      if (etatDemande === 'en_attente_validation') {
        set({ chargementInitial: false, espacesFamiliaux: [], rattachement: 'demande_en_attente' });
        return;
      }

      // Reponse claire et vide : compte d'authentification sans espace ni
      // acces tiers. L'application doit proposer d'en creer un, pas afficher
      // un accueil vide.
      console.warn('[Dualia] Compte sans espace familial : reprise de la création proposée.');
      set({ chargementInitial: false, espacesFamiliaux: [], rattachement: 'jamais_rattache' });
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

    set({ espacesFamiliaux, rattachement: 'parent' });

    const familleActivePersistee = get().familleId;
    const espaceActif =
      (familleActivePersistee && espacesFamiliaux.find((e) => e.familleId === familleActivePersistee)) ||
      espacesFamiliaux[0];

    await get().chargerEspaceFamilial(espaceActif.familleId);
  },
}),
    {
      name: `dualia-storage${SUFFIXE_STOCKAGE}`,
      storage: dualiaStorage,
      partialize: (state) => ({
        decisions: state.decisions,
        messages: state.messages,
        journalEntries: state.journalEntries.map(({ photoUrl, ...rest }) => rest),
        depenses: state.depenses.map(({ photoUri, ...rest }) => rest),
        documents: state.documents,
        parentActif: state.parentActif,
        // Les prénoms des parents n'étaient PAS conservés, alors que les
        // enfants, les messages et les dépenses le sont. À chaque
        // rechargement, l'application affichait donc les vraies données
        // sous de faux noms — « Bonjour Parent », légende « Parent 1 » /
        // « Parent 2 » — jusqu'au retour du réseau. Sur un mauvais wifi,
        // c'est définitif. Rien ne signalait l'erreur : seuls les noms
        // étaient faux. La déconnexion les efface (purgerDonneesFamiliales
        // les remet à leur valeur par défaut), donc rien ne fuit d'une
        // personne à l'autre sur un ordinateur partagé.
        parents: state.parents,
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

      // Troisieme porte, et la plus facile a oublier : le stockage local.
      //
      // evenementsCalendrier est persiste, et zustand le rehydrate AVANT que
      // chargerEspaceFamilial ne s'execute. Une date illisible ecrite par une
      // version anterieure de l'application — qui n'avait aucun controle —
      // revient donc intacte au demarrage et atteint parseISO() avant que
      // quoi que ce soit ait pu l'ecarter. C'est precisement l'ecran blanc
      // sans issue que ce garde-fou existe pour empecher, et il survivait a
      // une simple mise a jour.
      merge: (persiste, courant) => {
        const recu = (persiste ?? {}) as Partial<DualiaStore>;
        const evenements = recu.evenementsCalendrier;
        if (!Array.isArray(evenements)) return { ...courant, ...recu };

        const lisibles = evenements.filter((e) => estInstantValide(e?.date));
        if (lisibles.length !== evenements.length) {
          console.error(
            '[Dualia] Événements écartés du stockage local (date illisible) :',
            evenements.length - lisibles.length
          );
        }
        return { ...courant, ...recu, evenementsCalendrier: lisibles };
      },
    }
  )
);