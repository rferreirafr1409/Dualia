/**
 * Sauvegarde des buckets Supabase Storage de Dualia.
 *
 * IMPORTANT : ce fichier ne contient AUCUNE clé. Les identifiants doivent
 * être fournis via des variables d'environnement à chaque lancement,
 * jamais écrits ici, jamais commités sur Git.
 *
 * UTILISATION (PowerShell, à chaque lancement) :
 *
 *   $env:SUPABASE_URL = "https://fnnynyztyujxvpbakvpp.supabase.co"
 *   $env:SUPABASE_SECRET_KEY = "colle-ta-cle-secrete-ici"
 *   node backup-storage-dualia.js
 *
 * La clé (sb_secret_...) se trouve dans Supabase > Settings > API Keys > Secret keys.
 * Ne jamais la coller directement dans ce fichier.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const BUCKETS = ['documents-familiaux', 'enfants-photos', 'moments-photos'];
const DOSSIER_SORTIE = path.join(__dirname, 'backups-storage');

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('❌ Variables manquantes. Lance d\'abord :');
  console.error('   $env:SUPABASE_URL = "https://ton-projet.supabase.co"');
  console.error('   $env:SUPABASE_SECRET_KEY = "ta-cle-secrete"');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY);

async function listerFichiers(bucket, dossier = '') {
  const { data, error } = await supabase.storage.from(bucket).list(dossier, { limit: 1000 });
  if (error) return [];

  let fichiers = [];
  for (const item of data || []) {
    const chemin = dossier ? `${dossier}/${item.name}` : item.name;
    if (item.id === null) {
      fichiers = fichiers.concat(await listerFichiers(bucket, chemin));
    } else {
      fichiers.push(chemin);
    }
  }
  return fichiers;
}

async function sauvegarderBucket(bucket, dossierDate) {
  const fichiers = await listerFichiers(bucket);
  console.log(`📦 ${bucket} : ${fichiers.length} fichier(s)`);

  let ok = 0;
  for (const chemin of fichiers) {
    const { data, error } = await supabase.storage.from(bucket).download(chemin);
    if (error) {
      console.log(`  ❌ ${chemin} : ${error.message}`);
      continue;
    }
    const destination = path.join(dossierDate, bucket, chemin);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, Buffer.from(await data.arrayBuffer()));
    ok++;
  }
  console.log(`  ✅ ${ok}/${fichiers.length} sauvegardé(s)`);
}

async function main() {
  const date = new Date().toISOString().slice(0, 10);
  const dossierDate = path.join(DOSSIER_SORTIE, date);
  fs.mkdirSync(dossierDate, { recursive: true });

  console.log(`🔒 Sauvegarde Dualia — ${date}\n`);
  for (const bucket of BUCKETS) {
    await sauvegarderBucket(bucket, dossierDate);
  }
  console.log(`\n📁 Terminé : ${dossierDate}`);
}

main();