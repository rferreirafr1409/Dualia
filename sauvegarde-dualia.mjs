// sauvegarde-dualia.mjs
//
// Sauvegarde et restauration d'un espace familial Dualia.
//
// A copier dans le projet (dualia-mvp), parce que Node resout
// @supabase/supabase-js depuis le dossier du script lui-meme et non depuis
// celui ou tu te trouves. Laisse dans Telechargements, il s'arrete sur
// ERR_MODULE_NOT_FOUND meme lance depuis la racine du projet.
//
//   cd $env:USERPROFILE\dualia-mvp
//   Copy-Item "$env:USERPROFILE\Downloads\sauvegarde-dualia.mjs" .
//   $env:DUALIA_EMAIL = "ton adresse"
//   $env:DUALIA_MDP   = "ton mot de passe"
//
//   node sauvegarde-dualia.mjs                      # sauvegarde complete
//   node sauvegarde-dualia.mjs --lister             # les sauvegardes existantes
//   node sauvegarde-dualia.mjs --restaurer <fichier>  # remet le cadre familial
//   node sauvegarde-dualia.mjs --comparer <fichier>   # dit ce qui a change
//
// POURQUOI CE SCRIPT EXISTE
//
// synchroniserCadreFamilial ecrase le cadre familial de la famille AVANT
// toute validation, des qu'on clique « Passer a la verification » apres un
// import de jugement. Le 01/10/2026, un import de test a remplace un cadre
// valide — pension, indice INSEE, deux regles 50/50 avec leurs citations —
// par celui d'un jugement fictif. Il a fallu une sauvegarde prise a la main
// une heure plus tot pour le remettre.
//
// Lance ce script AVANT chaque essai d'import. Il prend trois secondes.
//
// CE QU'IL NE FAIT PAS
//
// Aucune cle de service, aucun contournement : il se connecte avec TON
// compte et passe par les memes regles RLS que l'application. Il ne voit
// donc que ta propre famille, et ne peut rien ecrire ailleurs.
//
// La restauration ne porte que sur les trois tables qu'un import ecrase :
// cadre_familial, regles_partage, evenements_garde. Le reste — enfants,
// messages, documents, journal — est sauvegarde pour memoire, mais un
// import n'y touche pas, et les reinserer creerait des doublons.

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const SUPABASE_URL = 'https://fnnynyztyujxvpbakvpp.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_dtbV4IR77FAKU97gj_SXUg_G_X2vVEi';

const DOSSIER = 'sauvegardes';

// La colonne `adresse` de la table foyers n'est lisible par PERSONNE : le
// droit SELECT y est accorde colonne par colonne, et celle-la en est exclue.
// L'adresse postale du domicile de l'autre parent ne sort donc pas de la
// base, quelle que soit la requete — c'est deliberе, et c'est une bonne
// chose dans une separation conflictuelle.
//
// Demander `*` fait echouer la lecture entiere sur « permission denied for
// table foyers ». On nomme donc les colonnes lisibles. La sauvegarde ne
// contient pas les adresses : elles ne sont pas recuperables ainsi, et la
// restauration ne touche de toute facon pas a cette table.
const COLONNES_FOYERS =
  'id, famille_id, nom, ville, code_postal, pays, couleur, adresse_visible, actif, cree_le, est_placeholder';

// Tables lues, et comment elles se rattachent a la famille.
//   'directe'  -> colonne famille_id
//   'cadre'    -> via cadre_familial_id
//   'foyer'    -> via foyer_id
//   'document' -> via document_id
//   'tiers'    -> via tiers_id
// Troisieme element facultatif : les colonnes a lire, quand `*` est refuse.
const TABLES = [
  ['parents', 'directe'],
  ['enfants', 'directe'],
  ['cadre_familial', 'directe'],
  ['regles_partage', 'cadre'],
  ['evenements_garde', 'directe'],
  ['evenements_calendrier', 'directe'],
  ['foyers', 'directe', COLONNES_FOYERS],
  ['foyer_enfants', 'foyer'],
  ['foyer_personnes', 'foyer'],
  ['depenses', 'directe'],
  ['messages', 'directe'],
  ['documents', 'directe'],
  ['document_enfants', 'document'],
  ['journal_entries', 'directe'],
  ['moments', 'directe'],
  ['contacts_urgence', 'directe'],
  ['agenda_scolaire', 'directe'],
  ['echeances_administratives', 'directe'],
  ['decisions', 'directe'],
  ['tiers', 'directe'],
  ['tiers_enfants', 'tiers'],
  ['propositions_repartition', 'directe'],
  ['transmission_checks', 'directe'],
  ['transmission_items_config', 'directe'],
];

// Les seules tables qu'un import de jugement ecrase, donc les seules que la
// restauration remet en place.
const TABLES_RESTAUREES = ['cadre_familial', 'regles_partage', 'evenements_garde'];

function sortir(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

function horodatage() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}h${p(d.getMinutes())}m${p(d.getSeconds())}`;
}

async function connecter() {
  const email = process.env.DUALIA_EMAIL;
  const mdp = process.env.DUALIA_MDP;
  if (!email || !mdp) {
    sortir(
      'Il manque les identifiants.\n' +
        '    $env:DUALIA_EMAIL = "ton adresse"\n' +
        '    $env:DUALIA_MDP   = "ton mot de passe"'
    );
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await sb.auth.signInWithPassword({ email, password: mdp });
  if (error) sortir(`Connexion refusee : ${error.message}`);

  // La famille est deduite de TA fiche parent. Elle n'est jamais passee en
  // parametre : impossible de viser la famille de quelqu'un d'autre par
  // inadvertance, et de toute facon les regles RLS l'interdiraient.
  const { data: fiches, error: e2 } = await sb
    .from('parents')
    .select('famille_id, nom, role')
    .eq('user_id', data.user.id);
  if (e2) sortir(`Lecture de ta fiche parent impossible : ${e2.message}`);
  if (!fiches || fiches.length === 0) sortir("Ce compte n'est parent d'aucune famille.");
  if (fiches.length > 1) {
    sortir(
      'Ce compte est parent de plusieurs familles. Ce script ne sait pas\n' +
        '    choisir a ta place — dis-le moi et je le fais evoluer.'
    );
  }

  return { sb, famille: fiches[0].famille_id, moi: fiches[0] };
}

async function lireTout(sb, famille) {
  const contenu = {};

  const { data: cadres } = await sb.from('cadre_familial').select('id').eq('famille_id', famille);
  const idsCadre = (cadres || []).map((c) => c.id);

  const { data: foyers } = await sb.from('foyers').select('id').eq('famille_id', famille);
  const idsFoyer = (foyers || []).map((f) => f.id);

  const { data: docs } = await sb.from('documents').select('id').eq('famille_id', famille);
  const idsDoc = (docs || []).map((d) => d.id);

  const { data: lesTiers } = await sb.from('tiers').select('id').eq('famille_id', famille);
  const idsTiers = (lesTiers || []).map((t) => t.id);

  for (const [table, rattachement, colonnes] of TABLES) {
    let q = sb.from(table).select(colonnes || '*');
    if (rattachement === 'directe') q = q.eq('famille_id', famille);
    else if (rattachement === 'cadre') q = q.in('cadre_familial_id', idsCadre.length ? idsCadre : ['00000000-0000-0000-0000-000000000000']);
    else if (rattachement === 'foyer') q = q.in('foyer_id', idsFoyer.length ? idsFoyer : ['00000000-0000-0000-0000-000000000000']);
    else if (rattachement === 'document') q = q.in('document_id', idsDoc.length ? idsDoc : ['00000000-0000-0000-0000-000000000000']);
    else if (rattachement === 'tiers') q = q.in('tiers_id', idsTiers.length ? idsTiers : ['00000000-0000-0000-0000-000000000000']);

    const { data, error } = await q;
    if (error) {
      // Une table inaccessible n'arrete pas la sauvegarde : on la note.
      contenu[table] = { erreur: error.message };
      console.log(`    ${table.padEnd(28)} — illisible (${error.message})`);
      continue;
    }
    contenu[table] = data || [];
  }

  return contenu;
}

function resumer(contenu) {
  const lignes = [];
  for (const [table, valeur] of Object.entries(contenu)) {
    if (Array.isArray(valeur) && valeur.length > 0) {
      lignes.push(`    ${table.padEnd(28)} ${String(valeur.length).padStart(4)}`);
    }
  }
  return lignes;
}

async function sauvegarder() {
  const { sb, famille, moi } = await connecter();
  console.log(`\n  Espace familial de ${moi.nom} (parent ${moi.role})`);
  console.log(`  famille ${famille}\n`);

  const contenu = await lireTout(sb, famille);

  fs.mkdirSync(DOSSIER, { recursive: true });
  const fichier = path.join(DOSSIER, `dualia-${horodatage()}.json`);
  fs.writeFileSync(
    fichier,
    JSON.stringify(
      { releve_le: new Date().toISOString(), famille_id: famille, parent: moi, contenu },
      null,
      2
    ),
    'utf8'
  );

  console.log(resumer(contenu).join('\n'));
  console.log(`\n  Ecrit dans ${fichier}\n`);
}

function charger(fichier) {
  if (!fs.existsSync(fichier)) sortir(`Fichier introuvable : ${fichier}`);
  const brut = JSON.parse(fs.readFileSync(fichier, 'utf8'));
  if (!brut.famille_id || !brut.contenu) sortir(`Ce fichier n'est pas une sauvegarde Dualia.`);
  return brut;
}

async function restaurer(fichier) {
  const sauvegarde = charger(fichier);
  const { sb, famille, moi } = await connecter();

  if (sauvegarde.famille_id !== famille) {
    sortir(
      `Cette sauvegarde concerne une autre famille.\n` +
        `    sauvegarde : ${sauvegarde.famille_id}\n` +
        `    ton espace : ${famille}`
    );
  }

  console.log(`\n  Restauration dans l'espace de ${moi.nom}`);
  console.log(`  d'apres ${fichier}`);
  console.log(`  releve le ${sauvegarde.releve_le}\n`);

  const c = sauvegarde.contenu;

  // 1 — Les evenements de garde. On efface avant de reposer : ce sont des
  // lignes generees, pas de l'historique saisi a la main.
  const { error: eSupprGarde } = await sb
    .from('evenements_garde')
    .delete()
    .eq('famille_id', famille);
  if (eSupprGarde) sortir(`Suppression des evenements de garde : ${eSupprGarde.message}`);

  const garde = Array.isArray(c.evenements_garde) ? c.evenements_garde : [];
  if (garde.length > 0) {
    const { error } = await sb.from('evenements_garde').insert(garde);
    if (error) sortir(`Reinsertion des evenements de garde : ${error.message}`);
  }
  console.log(`    evenements_garde             ${String(garde.length).padStart(4)} remis`);

  // 2 — Les regles de partage, rattachees au cadre.
  const cadres = Array.isArray(c.cadre_familial) ? c.cadre_familial : [];
  const idsCadre = cadres.map((x) => x.id);
  if (idsCadre.length > 0) {
    const { error } = await sb.from('regles_partage').delete().in('cadre_familial_id', idsCadre);
    if (error) sortir(`Suppression des regles de partage : ${error.message}`);
  }

  const regles = Array.isArray(c.regles_partage) ? c.regles_partage : [];
  if (regles.length > 0) {
    const { error } = await sb.from('regles_partage').insert(regles);
    if (error) sortir(`Reinsertion des regles de partage : ${error.message}`);
  }
  console.log(`    regles_partage               ${String(regles.length).padStart(4)} remises`);

  // 3 — Le cadre familial lui-meme, par mise a jour : la ligne existe
  // toujours (l'import l'ecrase, il ne la supprime pas), et son id est
  // reference par les regles qu'on vient de reposer.
  for (const cadre of cadres) {
    const { id, ...champs } = cadre;
    const { error } = await sb.from('cadre_familial').update(champs).eq('id', id);
    if (error) sortir(`Mise a jour du cadre familial : ${error.message}`);
  }
  console.log(`    cadre_familial               ${String(cadres.length).padStart(4)} remis`);

  console.log(`\n  Fait. Les autres tables n'ont pas ete touchees.\n`);
}

async function comparer(fichier) {
  const sauvegarde = charger(fichier);
  const { sb, famille } = await connecter();

  if (sauvegarde.famille_id !== famille) sortir('Cette sauvegarde concerne une autre famille.');

  const actuel = await lireTout(sb, famille);

  console.log(`\n  Ecarts avec ${fichier}\n`);
  let ecarts = 0;

  for (const [table] of TABLES) {
    const avant = Array.isArray(sauvegarde.contenu[table]) ? sauvegarde.contenu[table] : [];
    const apres = Array.isArray(actuel[table]) ? actuel[table] : [];
    const a = JSON.stringify(avant.map((x) => x.id ?? x).sort());
    const b = JSON.stringify(apres.map((x) => x.id ?? x).sort());
    const memeContenu = JSON.stringify(avant) === JSON.stringify(apres);

    if (avant.length !== apres.length || a !== b || !memeContenu) {
      ecarts++;
      const signe = apres.length === avant.length ? '~' : apres.length > avant.length ? '+' : '-';
      console.log(`    ${signe} ${table.padEnd(28)} ${avant.length} -> ${apres.length}`);
    }
  }

  if (ecarts === 0) console.log('    aucun — la base est identique a la sauvegarde');
  console.log('');
}

function lister() {
  if (!fs.existsSync(DOSSIER)) {
    console.log(`\n  Aucune sauvegarde (le dossier ${DOSSIER} n'existe pas encore).\n`);
    return;
  }
  const fichiers = fs
    .readdirSync(DOSSIER)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse();
  if (fichiers.length === 0) {
    console.log(`\n  Aucune sauvegarde dans ${DOSSIER}.\n`);
    return;
  }
  console.log(`\n  ${fichiers.length} sauvegarde(s), la plus recente en tete :\n`);
  for (const f of fichiers) {
    const taille = (fs.statSync(path.join(DOSSIER, f)).size / 1024).toFixed(0);
    console.log(`    ${f}   ${taille} Ko`);
  }
  console.log('');
}

const args = process.argv.slice(2);

if (args[0] === '--lister') {
  lister();
} else if (args[0] === '--restaurer') {
  if (!args[1]) sortir('Indique le fichier : node sauvegarde-dualia.mjs --restaurer sauvegardes/dualia-....json');
  await restaurer(args[1]);
} else if (args[0] === '--comparer') {
  if (!args[1]) sortir('Indique le fichier : node sauvegarde-dualia.mjs --comparer sauvegardes/dualia-....json');
  await comparer(args[1]);
} else if (args.length === 0) {
  await sauvegarder();
} else {
  sortir(
    'Usage :\n' +
      '    node sauvegarde-dualia.mjs\n' +
      '    node sauvegarde-dualia.mjs --lister\n' +
      '    node sauvegarde-dualia.mjs --comparer <fichier>\n' +
      '    node sauvegarde-dualia.mjs --restaurer <fichier>'
  );
}
