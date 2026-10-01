// seed-demo.mjs — jeu de démonstration Dualia, famille entièrement fictive.
//
//   node seed-demo.mjs                 remplit l'espace de démonstration
//   node seed-demo.mjs --vider         efface le contenu de CET espace, et rien d'autre
//   node seed-demo.mjs --etat          affiche ce qu'il contient, sans rien écrire
//
// Variables d'environnement :
//   DEMO_MDP      mot de passe des deux comptes de démonstration (obligatoire)
//   DEMO_BASE     ton adresse Gmail, pour dériver les alias (défaut ci-dessous)
//   DEMO_EMAIL_A  impose l'adresse du parent A, au lieu de la dériver
//   DEMO_EMAIL_B  idem pour le parent B — utile pour réemployer un compte
//                 déjà confirmé quand le quota d'envoi d'e-mails est atteint
//
// ---------------------------------------------------------------------------
// Ce que ce script ne fait pas
// ---------------------------------------------------------------------------
//
// Il n'écrit que dans l'espace de démonstration, qu'il retrouve par une clé
// de création fixe. Trois garde-fous, dans cet ordre :
//
//   1. Il refuse de tourner si le compte connecté n'est pas l'une des deux
//      adresses de démonstration.
//   2. Il refuse d'écrire dans une famille dont la clé de création n'est pas
//      celle-ci — donc jamais dans un espace réel, même par erreur d'alias.
//   3. --vider ne supprime que les lignes de cette famille, jamais un compte.
//
// Il passe par la clé publique et par l'authentification normale : tout ce
// qu'il écrit passe donc par les mêmes règles RLS que l'application. Aucune
// clé de service, aucun contournement. Si une politique refuse une écriture,
// le script s'arrête et le dit — c'est une information utile, pas un obstacle
// à écarter.
//
// Ce qu'il laisse VOLONTAIREMENT vide : le cadre familial et le calendrier de
// garde. C'est la démonstration elle-même — importer le jugement fictif,
// confirmer le régime, voir le calendrier apparaître.

import { createClient } from '@supabase/supabase-js';

// Clés publiques, déjà présentes dans le bundle de l'application.
const URL_SUPABASE = 'https://fnnynyztyujxvpbakvpp.supabase.co';
const CLE_PUBLIABLE = 'sb_publishable_dtbV4IR77FAKU97gj_SXUg_G_X2vVEi';

// Clé de création fixe : c'est elle qui rend ce script rejouable et qui
// interdit qu'il touche un autre espace. Ne pas la changer.
const CLE_CREATION = '11111111-2222-4333-8444-555555555555';

const BASE = process.env.DEMO_BASE || 'rferreirafr@gmail.com';
const MDP = process.env.DEMO_MDP;

const [nomBoite, domaine] = BASE.split('@');

// Les deux adresses de démonstration. Elles se dérivent de DEMO_BASE, mais
// chacune peut être imposée — DEMO_EMAIL_A / DEMO_EMAIL_B — pour réemployer
// un compte qui existe déjà.
//
// Ce n'est pas du confort. La confirmation d'e-mail est activée sur ce
// projet et le mailer intégré de Supabase plafonne à quelques envois par
// heure : une fois le quota atteint, plus aucun compte ne peut être créé
// avant l'heure suivante. Pouvoir désigner un compte existant est la
// différence entre préparer sa démonstration maintenant et attendre.
const EMAIL_JULIEN = process.env.DEMO_EMAIL_A || `${nomBoite}+julien@${domaine}`;
const EMAIL_CLAIRE = process.env.DEMO_EMAIL_B || `${nomBoite}+claire@${domaine}`;
const EMAILS_AUTORISES = [EMAIL_JULIEN, EMAIL_CLAIRE];

if (EMAIL_JULIEN === EMAIL_CLAIRE) {
  console.error('\n  ARRÊT : les deux parents ne peuvent pas être le même compte.\n');
  process.exit(1);
}

const mode = process.argv.includes('--vider')
  ? 'vider'
  : process.argv.includes('--etat')
  ? 'etat'
  : 'remplir';

// ---------------------------------------------------------------------------
// La famille fictive
// ---------------------------------------------------------------------------
//
// Conforme au jugement fictif jugement-fictif-MARCHAND.pdf : résidence chez
// la mère (Claire, parent B), week-ends du père les semaines paires.
//
// Le choix de mettre la résidence chez le parent B n'est pas anodin : c'est
// exactement la configuration où l'ancien code produisait un calendrier
// faux, en retombant silencieusement sur le parent A. La démonstration passe
// donc par le cas qui cassait.

const ENFANTS = [
  {
    prenom: 'Léa',
    date_naissance: '2015-03-12',
    ecole: 'École élémentaire Victor Hugo — Créteil',
    medecin_traitant: 'Dr Samir Ameur',
    medecin_telephone: '01 48 99 21 04',
    allergies: 'Arachide (trousse d\'urgence à l\'école)',
    groupe_sanguin: 'A+',
    mutuelle: 'Harmonie Mutuelle — n° 74 118 220',
  },
  {
    prenom: 'Tom',
    date_naissance: '2018-11-08',
    ecole: 'École maternelle des Buttes — Créteil',
    medecin_traitant: 'Dr Samir Ameur',
    medecin_telephone: '01 48 99 21 04',
    allergies: null,
    groupe_sanguin: 'O+',
    mutuelle: 'Harmonie Mutuelle — n° 74 118 221',
  },
];

const CONTACTS = [
  { pour: 'Léa', nom: 'Dr Samir Ameur', relation: 'Médecin traitant', telephone: '01 48 99 21 04', priorite: 1 },
  { pour: 'Léa', nom: 'Fatima Benali', relation: 'Nourrice', telephone: '06 42 18 77 30', priorite: 2 },
  { pour: 'Léa', nom: 'Monique Besson', relation: 'Grand-mère maternelle', telephone: '01 43 77 02 15', priorite: 3 },
  { pour: 'Tom', nom: 'Dr Samir Ameur', relation: 'Médecin traitant', telephone: '01 48 99 21 04', priorite: 1 },
  { pour: 'Tom', nom: 'Fatima Benali', relation: 'Nourrice', telephone: '06 42 18 77 30', priorite: 2 },
];

// Dépenses réparties sur trois mois, 50/50 comme le prévoit l'article 7 du
// jugement. Deux déjà remboursées, une en attente d'accord préalable.
const DEPENSES = [
  { jours: -74, categorie: 'activites', montant: 168, description: 'Judo — licence et cotisation annuelle (Tom)', commercant: 'Judo Club de Créteil', part_a: 50, part_b: 50, rembourse: true, accord_prealable_confirme: true },
  { jours: -71, categorie: 'activites', montant: 245, description: 'Danse classique — année (Léa)', commercant: 'Conservatoire de Créteil', part_a: 50, part_b: 50, rembourse: true, accord_prealable_confirme: true },
  { jours: -52, categorie: 'sante', montant: 312.4, description: 'Orthodontie — 1re série de gouttières (Léa)', commercant: 'Cabinet Dr Lemoine', part_a: 50, part_b: 50, rembourse: false, remboursement_recu: 96.2 },
  { jours: -38, categorie: 'ecole', montant: 89.5, description: 'Fournitures et manuels de rentrée', commercant: 'Librairie du Centre', part_a: 50, part_b: 50, rembourse: false },
  { jours: -21, categorie: 'sante', montant: 47, description: 'Consultation ORL — dépassement non remboursé (Tom)', commercant: 'Dr Perrin', part_a: 50, part_b: 50, rembourse: false, remboursement_recu: 0 },
  { jours: -12, categorie: 'ecole', montant: 138, description: 'Classe de découverte — acompte (Léa)', commercant: 'École Victor Hugo', part_a: 50, part_b: 50, rembourse: false, accord_prealable_confirme: false },
  { jours: -5, categorie: 'vetements', montant: 64.9, description: 'Chaussures de sport (Tom)', commercant: 'Décathlon Créteil', part_a: 50, part_b: 50, rembourse: false },
];

// Un échange bref et civil : c'est le ton pour lequel Dualia existe, et ce
// qu'un magistrat regardera en premier.
const MESSAGES = [
  { jours: -16, de: 'B', contenu: "Bonjour Julien. Le rendez-vous d'orthodontie de Léa est déplacé au jeudi 15 à 17h30. Tu peux l'emmener ou je m'en occupe ?" },
  { jours: -16, de: 'A', contenu: "Bonjour Claire. Je peux m'en occuper, je termine à 16h ce jeudi-là. Je la ramène après." },
  { jours: -15, de: 'B', contenu: 'Parfait, merci. Je préviens le cabinet.' },
  { jours: -9, de: 'A', contenu: "L'école a envoyé le dossier pour la classe de découverte de Léa. L'acompte est de 138 €, à régler avant le 20. Je le mets dans les dépenses, on partage par moitié comme d'habitude ?" },
  { jours: -9, de: 'B', contenu: "D'accord pour la moitié. Tu peux avancer et je te rembourse en fin de mois." },
  { jours: -4, de: 'B', contenu: "Tom a de la fièvre depuis hier soir, 38,5. Rendez-vous chez le Dr Ameur demain matin. Je te tiens au courant." },
  { jours: -3, de: 'A', contenu: 'Merci de m\'avoir prévenu. Dis-moi ce que dit le médecin. Si ça ne va pas mieux vendredi, on décale le week-end.' },
  { jours: -3, de: 'B', contenu: 'Angine, antibiotiques pour six jours. Il sera d\'aplomb vendredi, pas d\'inquiétude.' },
];

const DOCUMENTS = [
  { jours: -230, nom: 'Jugement JAF du 14 février 2025', categorie: 'juridique', portee: 'famille', note: 'Tribunal judiciaire de Créteil — RG 24/03871', certifie: false },
  { jours: -230, nom: 'Jugement de divorce du 9 mars 2022', categorie: 'juridique', portee: 'famille', note: 'Pièce antérieure, conservée pour référence', certifie: false },
  { jours: -95, nom: 'Carnet de santé — pages vaccinations (Léa)', categorie: 'sante', portee: 'enfant', note: 'DTP à jour, rappel prévu en 2027', certifie: false },
  { jours: -40, nom: 'Certificat de scolarité 2025-2026 (Tom)', categorie: 'ecole', portee: 'enfant', note: null, certifie: false, date_expiration_jours: 300 },
  { jours: -33, nom: 'Attestation de mutuelle — Harmonie', categorie: 'administratif', portee: 'famille', note: 'Valable jusqu\'au 31/12', certifie: false },
];

const EVENEMENTS = [
  { jours: 2, heure: 17, minute: 30, titre: 'Orthodontiste — Léa', pour: 'Léa', de: 'A' },
  { jours: 6, heure: 18, minute: 0, titre: 'Réunion parents-professeurs', pour: 'Léa', de: 'B' },
  { jours: 9, heure: 10, minute: 30, titre: 'Judo — tournoi départemental', pour: 'Tom', de: 'A' },
  { jours: 15, heure: 9, minute: 0, titre: 'Rappel vaccin — Tom', pour: 'Tom', de: 'B' },
];

const JOURNAL = [
  { jours: -60, titre: 'Premier spectacle de danse', description: 'Léa a dansé devant deux cents personnes sans trembler. Elle a cherché nos deux visages dans la salle.', emoji: '💃', pour: 'Léa', de: 'A' },
  { jours: -27, titre: 'Vélo sans roulettes', description: "Tom a lâché les roulettes au parc. Trente mètres, puis la haie. Il veut recommencer demain.", emoji: '🚲', pour: 'Tom', de: 'B' },
];

const MOMENTS = [
  { jours: -11, texte: 'Tom a perdu sa première dent. Il l\'a mise dans une boîte d\'allumettes pour te la montrer.', pour: 'Tom', de: 'B' },
  { jours: -6, texte: 'Léa a eu 18 à son exposé sur les volcans. Elle a insisté pour que je te le dise.', pour: 'Léa', de: 'A' },
];

// ---------------------------------------------------------------------------

const jour = (decalage) => {
  const d = new Date();
  d.setDate(d.getDate() + decalage);
  return d.toISOString().slice(0, 10);
};

const instant = (decalage, heure = 9, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + decalage);
  d.setHours(heure, minute, 0, 0);
  return d.toISOString();
};

function client() {
  return createClient(URL_SUPABASE, CLE_PUBLIABLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function stop(message) {
  console.error('\n  ARRÊT : ' + message + '\n');
  process.exit(1);
}

function verifier(etiquette, { error }) {
  if (error) stop(`${etiquette} — ${error.message}${error.hint ? ' (' + error.hint + ')' : ''}`);
}

/** Connexion, avec création du compte s'il n'existe pas encore.
 *
 *  La confirmation d'e-mail est activée sur ce projet : signUp crée bien le
 *  compte mais ne rend aucune session tant que l'adresse n'est pas
 *  confirmée. On ne s'arrête donc PAS ici — sinon le premier compte bloque
 *  la création du second, et il faut deux allers-retours au lieu d'un. On
 *  signale, et l'appelant décide. */
async function connecter(email) {
  if (!EMAILS_AUTORISES.includes(email)) {
    stop(`adresse ${email} hors de la liste de démonstration — le script refuse d'agir.`);
  }
  const sb = client();
  let { data, error } = await sb.auth.signInWithPassword({ email, password: MDP });
  if (!error) {
    console.log(`  connecté      ${email}`);
    return { sb, userId: data.user.id };
  }

  const inscription = await sb.auth.signUp({ email, password: MDP });
  if (inscription.error) stop(`connexion ${email} — ${inscription.error.message}`);

  if (!inscription.data.session) {
    console.log(`  compte créé   ${email}  — en attente de confirmation`);
    return { aConfirmer: true };
  }

  console.log(`  compte créé   ${email}`);
  return { sb, userId: inscription.data.user.id };
}

/** Les deux comptes, ou la liste de ce qu'il reste à confirmer. */
async function preparerComptes() {
  const sessions = {};
  const aConfirmer = [];
  for (const email of EMAILS_AUTORISES) {
    const r = await connecter(email);
    if (r.aConfirmer) aConfirmer.push(email);
    else sessions[email] = r;
  }
  if (aConfirmer.length > 0) {
    stop(
      "la confirmation d'e-mail est activée sur ce projet.\n\n" +
        '           Ouvre ta boîte et clique le lien de confirmation pour :\n' +
        aConfirmer.map((e) => '             · ' + e).join('\n') +
        '\n\n           Puis relance la même commande. Les comptes sont déjà créés,\n' +
        '           le script reprendra où il en était.\n\n' +
        "           Si l'e-mail n'arrive pas — le mailer intégré de Supabase\n" +
        '           plafonne à quelques envois par heure — désigne un compte\n' +
        '           déjà confirmé :  $env:DEMO_EMAIL_B = "une+adresse@existante"'
    );
  }
  return sessions;
}

/** L'espace de démonstration, et lui seul. */
async function espaceDemo(sb) {
  const { data, error } = await sb.rpc('creer_famille', {
    p_nom: 'Julien',
    p_cle_creation: CLE_CREATION,
  });
  if (error) stop(`creer_famille — ${error.message}`);
  const familleId = Array.isArray(data) ? data[0]?.famille_id : data?.famille_id;
  if (!familleId) stop('creer_famille n\'a rendu aucun identifiant de famille.');

  // Garde-fou : on relit la clé depuis la base. Si cette famille n'est pas
  // celle de la démonstration, on n'y touche pas.
  const { data: f, error: e2 } = await sb
    .from('familles')
    .select('id, cle_creation')
    .eq('id', familleId)
    .single();
  if (e2) stop(`relecture de la famille — ${e2.message}`);
  if (f.cle_creation !== CLE_CREATION) {
    stop(
      `la famille ${familleId} ne porte pas la clé de démonstration. ` +
        'Le script refuse d\'écrire dans un espace réel.'
    );
  }
  return familleId;
}

async function parents(sb, familleId) {
  const { data, error } = await sb
    .from('parents')
    .select('id, role, nom, user_id')
    .eq('famille_id', familleId);
  verifier('lecture des parents', { error });
  return data;
}

async function rattacherClaire(sb, sbClaire, familleId) {
  const { data: inv, error } = await sb.rpc('creer_invitation', { p_famille_id: familleId });
  if (error) stop(`creer_invitation — ${error.message}`);
  const ligne = Array.isArray(inv) ? inv[0] : inv;
  console.log(`  invitation    code ${ligne.code}`);

  const { data: reponse, error: e2 } = await sbClaire.rpc('demander_a_rejoindre', {
    p_token: ligne.token,
    p_code: ligne.code,
    p_nom: 'Claire',
  });
  if (e2) stop(`demander_a_rejoindre — ${e2.message}`);
  if (reponse !== 'en_attente_validation' && reponse !== 'deja_membre') {
    stop(`demander_a_rejoindre a répondu « ${reponse} »`);
  }

  if (reponse === 'en_attente_validation') {
    const { data: demandes, error: e3 } = await sb.rpc('demandes_en_attente', {
      p_famille_id: familleId,
    });
    if (e3) stop(`demandes_en_attente — ${e3.message}`);
    const demande = (demandes ?? [])[0];
    if (!demande) stop('aucune demande en attente alors qu\'une vient d\'être déposée.');
    const { data: verdict, error: e4 } = await sb.rpc('repondre_demande', {
      p_invitation: demande.invitation_id,
      p_accepter: true,
    });
    if (e4) stop(`repondre_demande — ${e4.message}`);
    if (verdict !== 'acceptee' && verdict !== 'deja_membre') {
      stop(`repondre_demande a répondu « ${verdict} »`);
    }
    console.log('  rattachement  Claire acceptée comme parent B');
  }
}

async function etat(sb, familleId) {
  const tables = [
    'parents', 'enfants', 'contacts_urgence', 'foyers', 'depenses', 'messages',
    'documents', 'tiers', 'journal_entries', 'moments', 'evenements_calendrier',
    'evenements_garde', 'cadre_familial',
  ];
  console.log('\n  Contenu de l\'espace de démonstration :');
  for (const t of tables) {
    const { count, error } = await sb
      .from(t)
      .select('*', { count: 'exact', head: true })
      .eq('famille_id', familleId);
    console.log(`    ${String(count ?? (error ? '?' : 0)).padStart(4)}  ${t}${error ? '  (' + error.message + ')' : ''}`);
  }
  console.log();
}

async function vider(sb, familleId) {
  // Les règles de partage d'abord, et par leur cadre : elles ne portent pas
  // de famille_id, et leur clé étrangère vers cadre_familial est en
  // NO ACTION — supprimer le cadre avant elles échoue, sans que rien ne le
  // dise. Même piège que celui rencontré sur la suppression d'un enfant.
  const { data: cadres } = await sb
    .from('cadre_familial')
    .select('id')
    .eq('famille_id', familleId);

  for (const c of cadres ?? []) {
    const { error } = await sb.from('regles_partage').delete().eq('cadre_familial_id', c.id);
    if (error) console.log(`    regles_partage : ${error.message}`);
  }
  if (cadres?.length) console.log(`    vidé  regles_partage (${cadres.length} cadre(s))`);

  // Ni familles, ni parents, ni foyers, ni comptes : on vide le contenu, on
  // ne défait pas l'espace. contacts_urgence et foyer_enfants partent en
  // cascade avec les enfants, mais on les nomme pour que la sortie dise la
  // vérité sur ce qui a été traité.
  const ordre = [
    'evenements_calendrier', 'evenements_garde', 'journal_entries', 'moments',
    'depenses', 'messages', 'documents', 'tiers', 'cadre_familial',
    'contacts_urgence', 'enfants',
  ];
  for (const t of ordre) {
    const { error } = await sb.from(t).delete().eq('famille_id', familleId);
    if (error) console.log(`    ${t} : ${error.message}`);
    else console.log(`    vidé  ${t}`);
  }
  console.log('\n  Espace de démonstration vidé. Les deux comptes existent toujours.');
  console.log('  Relance sans option pour le remplir à nouveau.\n');
}

async function remplir(sbJulien, sbClaire, familleId, parentA, parentB) {
  // --- Genres : chacun renseigne le sien, pour que les dates spéciales du
  //     jugement puissent être rattachées au bon parent.
  verifier(
    'genre parental A',
    await sbJulien.from('parents').update({ genre_parental: 'pere' }).eq('id', parentA.id)
  );
  verifier(
    'genre parental B',
    await sbClaire.from('parents').update({ genre_parental: 'mere' }).eq('id', parentB.id)
  );

  // --- Enfants
  const { data: dejaLa } = await sbJulien.from('enfants').select('id, prenom').eq('famille_id', familleId);
  const parPrenom = new Map((dejaLa ?? []).map((e) => [e.prenom, e.id]));

  for (const enfant of ENFANTS) {
    if (parPrenom.has(enfant.prenom)) continue;
    const { data, error } = await sbJulien
      .from('enfants')
      .insert({ famille_id: familleId, ...enfant })
      .select('id, prenom')
      .single();
    verifier(`enfant ${enfant.prenom}`, { error });
    parPrenom.set(data.prenom, data.id);
  }
  console.log(`  enfants       ${parPrenom.size}`);

  // --- Foyers : adresses, couleurs, et la résidence principale chez Claire.
  const { data: foyers, error: eFoyers } = await sbJulien
    .from('foyers')
    .select('id, nom, est_placeholder, cree_le')
    .eq('famille_id', familleId)
    .order('cree_le');
  verifier('lecture des foyers', { error: eFoyers });

  const foyerJulien = foyers.find((f) => f.nom.includes('Julien')) ?? foyers[0];
  const foyerClaire = foyers.find((f) => f.nom.includes('Claire')) ?? foyers[1];

  if (foyerJulien) {
    verifier(
      'foyer Julien',
      await sbJulien
        .from('foyers')
        .update({
          nom: 'Chez Julien',
          adresse: '8 avenue du Général Leclerc',
          ville: 'Vincennes',
          code_postal: '94300',
          pays: 'France',
          couleur: '#2D6A4F',
          est_placeholder: false,
        })
        .eq('id', foyerJulien.id)
    );
  }
  if (foyerClaire) {
    verifier(
      'foyer Claire',
      await sbClaire
        .from('foyers')
        .update({
          nom: 'Chez Claire',
          adresse: '14 rue des Lilas',
          ville: 'Créteil',
          code_postal: '94000',
          pays: 'France',
          couleur: '#B5927C',
          est_placeholder: false,
        })
        .eq('id', foyerClaire.id)
    );
  }

  // Les deux enfants rattachés aux deux foyers, résidence principale chez
  // Claire — c'est ce que dit l'article 2 du jugement.
  for (const enfantId of parPrenom.values()) {
    for (const [foyer, principale] of [
      [foyerJulien, false],
      [foyerClaire, true],
    ]) {
      if (!foyer) continue;
      const { error } = await sbJulien
        .from('foyer_enfants')
        .upsert(
          { foyer_id: foyer.id, enfant_id: enfantId, residence_principale: principale },
          { onConflict: 'foyer_id,enfant_id' }
        );
      if (error) console.log(`    rattachement foyer : ${error.message}`);
    }
  }
  console.log('  foyers        Vincennes (Julien) · Créteil (Claire, résidence principale)');

  // --- Contacts d'urgence
  const { count: nbContacts } = await sbJulien
    .from('contacts_urgence')
    .select('*', { count: 'exact', head: true })
    .eq('famille_id', familleId);
  if (!nbContacts) {
    const lignes = CONTACTS.map((c) => ({
      famille_id: familleId,
      enfant_id: parPrenom.get(c.pour),
      nom: c.nom,
      relation: c.relation,
      telephone: c.telephone,
      priorite: c.priorite,
    })).filter((c) => c.enfant_id);
    verifier('contacts d\'urgence', await sbJulien.from('contacts_urgence').insert(lignes));
    console.log(`  contacts      ${lignes.length}`);
  }

  // --- Dépenses
  const { count: nbDepenses } = await sbJulien
    .from('depenses')
    .select('*', { count: 'exact', head: true })
    .eq('famille_id', familleId);
  if (!nbDepenses) {
    const lignes = DEPENSES.map((d, i) => {
      const { jours, ...reste } = d;
      return {
        famille_id: familleId,
        date: jour(jours),
        // Alternance des auteurs : les deux parents avancent des frais.
        auteur_id: i % 2 === 0 ? parentA.id : parentB.id,
        ...reste,
      };
    });
    verifier('dépenses', await sbJulien.from('depenses').insert(lignes));
    console.log(`  dépenses      ${lignes.length}`);
  }

  // --- Messages : chacun envoie les siens, sous sa propre identité.
  const { count: nbMessages } = await sbJulien
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('famille_id', familleId);
  if (!nbMessages) {
    for (const m of MESSAGES) {
      const sb = m.de === 'A' ? sbJulien : sbClaire;
      const expediteur = m.de === 'A' ? parentA.id : parentB.id;
      verifier(
        'message',
        await sb.from('messages').insert({
          famille_id: familleId,
          expediteur_id: expediteur,
          contenu: m.contenu,
          date_envoi: instant(m.jours, 9 + (MESSAGES.indexOf(m) % 10), 15),
          statut: 'lu',
          fuseau_expediteur: 'Europe/Paris',
        })
      );
    }
    console.log(`  messages      ${MESSAGES.length}`);
  }

  // --- Documents
  const { count: nbDocs } = await sbJulien
    .from('documents')
    .select('*', { count: 'exact', head: true })
    .eq('famille_id', familleId);
  if (!nbDocs) {
    const lignes = DOCUMENTS.map((d) => ({
      famille_id: familleId,
      nom: d.nom,
      categorie: d.categorie,
      portee: d.portee,
      note: d.note,
      certifie: d.certifie,
      date: jour(d.jours),
      date_expiration: d.date_expiration_jours ? jour(d.date_expiration_jours) : null,
      auteur_id: parentA.id,
    }));
    verifier('documents', await sbJulien.from('documents').insert(lignes));
    console.log(`  documents     ${lignes.length}`);
  }

  // --- Tiers : la nourrice, invitée mais pas encore rattachée. C'est un
  //     état réel du produit, et il montre l'accès révocable.
  const { count: nbTiers } = await sbJulien
    .from('tiers')
    .select('*', { count: 'exact', head: true })
    .eq('famille_id', familleId);
  if (!nbTiers) {
    verifier(
      'tiers',
      await sbJulien.from('tiers').insert({
        famille_id: familleId,
        nom: 'Fatima Benali',
        email: `${nomBoite}+nourrice@${domaine}`,
        role: 'nounou',
        statut: 'invite',
        peut_etre_gardien: true,
        invite_par: parentA.id,
      })
    );
    console.log('  tiers         Fatima Benali (nourrice, invitation en attente)');
  }

  // --- Journal et moments
  const { count: nbJournal } = await sbJulien
    .from('journal_entries')
    .select('*', { count: 'exact', head: true })
    .eq('famille_id', familleId);
  if (!nbJournal) {
    for (const j of JOURNAL) {
      const sb = j.de === 'A' ? sbJulien : sbClaire;
      verifier(
        'journal',
        await sb.from('journal_entries').insert({
          famille_id: familleId,
          titre: j.titre,
          description: j.description,
          emoji: j.emoji,
          date: jour(j.jours),
          enfant_id: parPrenom.get(j.pour) ?? null,
          enfant: j.pour,
          auteur_id: j.de === 'A' ? parentA.id : parentB.id,
        })
      );
    }
    console.log(`  journal       ${JOURNAL.length}`);
  }

  const { count: nbMoments } = await sbJulien
    .from('moments')
    .select('*', { count: 'exact', head: true })
    .eq('famille_id', familleId);
  if (!nbMoments) {
    for (const m of MOMENTS) {
      const sb = m.de === 'A' ? sbJulien : sbClaire;
      verifier(
        'moment',
        await sb.from('moments').insert({
          famille_id: familleId,
          texte: m.texte,
          enfant_id: parPrenom.get(m.pour) ?? null,
          enfant: m.pour,
          auteur_id: m.de === 'A' ? parentA.id : parentB.id,
          created_at: instant(m.jours, 20, 0),
        })
      );
    }
    console.log(`  moments       ${MOMENTS.length}`);
  }

  // --- Rendez-vous à venir
  const { count: nbEv } = await sbJulien
    .from('evenements_calendrier')
    .select('*', { count: 'exact', head: true })
    .eq('famille_id', familleId);
  if (!nbEv) {
    for (const e of EVENEMENTS) {
      const sb = e.de === 'A' ? sbJulien : sbClaire;
      verifier(
        'rendez-vous',
        await sb.from('evenements_calendrier').insert({
          famille_id: familleId,
          titre: e.titre,
          date: instant(e.jours, e.heure, e.minute),
          parent_id: e.de === 'A' ? parentA.id : parentB.id,
          enfant_id: parPrenom.get(e.pour) ?? null,
          enfant: e.pour,
        })
      );
    }
    console.log(`  rendez-vous   ${EVENEMENTS.length}`);
  }
}

// ---------------------------------------------------------------------------

async function principal() {
  if (!MDP) {
    stop(
      'mot de passe absent. Lance le script ainsi :\n' +
        '           $env:DEMO_MDP = "un-mot-de-passe-de-demonstration"\n' +
        '           node seed-demo.mjs'
    );
  }
  if (MDP.length < 8) stop('mot de passe trop court : Supabase en exige au moins 8 caractères.');

  console.log('\n  Espace de démonstration Dualia — famille MARCHAND (fictive)\n');
  console.log(`  Parent A      ${EMAIL_JULIEN}   (Julien, le père)`);
  console.log(`  Parent B      ${EMAIL_CLAIRE}   (Claire, la mère)\n`);

  const sessions = await preparerComptes();
  const sbJulien = sessions[EMAIL_JULIEN].sb;
  const sbClaire = sessions[EMAIL_CLAIRE].sb;

  const familleId = await espaceDemo(sbJulien);
  console.log(`  espace        ${familleId}`);

  if (mode === 'etat') {
    await etat(sbJulien, familleId);
    return;
  }
  if (mode === 'vider') {
    console.log();
    await vider(sbJulien, familleId);
    return;
  }

  verifier(
    'configuration des foyers',
    await sbJulien.rpc('configurer_foyers_initial', {
      p_config: 'deux_foyers',
      p_famille_id: familleId,
    })
  );

  let liste = await parents(sbJulien, familleId);
  if (liste.length < 2) {
    await rattacherClaire(sbJulien, sbClaire, familleId);
    liste = await parents(sbJulien, familleId);
  }

  const parentA = liste.find((p) => p.role === 'A');
  const parentB = liste.find((p) => p.role === 'B');
  if (!parentA || !parentB) stop('les deux parents ne sont pas en place.');

  // Le prénom affiché vient de la demande de rattachement ; on le fixe pour
  // que la démonstration soit identique à chaque fois.
  if (parentA.nom !== 'Julien') {
    await sbJulien.from('parents').update({ nom: 'Julien' }).eq('id', parentA.id);
  }
  if (parentB.nom !== 'Claire') {
    await sbClaire.from('parents').update({ nom: 'Claire' }).eq('id', parentB.id);
  }

  await remplir(sbJulien, sbClaire, familleId, parentA, parentB);

  console.log('\n  Volontairement laissés VIDES, ce sont eux la démonstration :');
  console.log('    · le cadre familial   → à créer en important le jugement fictif');
  console.log('    · le calendrier de garde → à générer en confirmant le régime\n');
  console.log('  Connecte-toi sur https://rferreirafr1409.github.io/Dualia/ avec');
  console.log(`  ${EMAIL_JULIEN} et le mot de passe que tu viens d'utiliser.\n`);
}

principal().catch((e) => stop(e?.message ?? String(e)));
