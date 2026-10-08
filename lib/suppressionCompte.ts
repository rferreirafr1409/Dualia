// lib/suppressionCompte.ts
//
// Suppression du compte connecte, depuis l'application (DUA-089).
//
// Apple refuse toute application qui permet de creer un compte sans permettre
// de le supprimer depuis l'application elle-meme, et le RGPD donne de toute
// facon ce droit a chaque parent.
//
// Le gros du travail se fait en base, dans la fonction supprimer_mon_compte
// (supabase/migrations/20261008_supprimer_mon_compte.sql) : detacher le parent
// des espaces ou l'autre parent reste, supprimer les espaces ou il etait seul,
// puis supprimer le compte lui-meme. Elle s'execute avec les droits du serveur,
// ce qu'un client ne peut pas faire — supprimer une ligne de auth.users en
// particulier.
//
// Les fichiers (photos, documents) sont retires ICI, avant l'appel : une
// suppression dans storage.objects depuis SQL ne retire pas le fichier
// physique, seule l'API de stockage le fait. Et il faut encore etre membre de
// la famille pour y etre autorise, donc avant que la fonction ne retire la
// fiche du parent.

import { supabase } from '../constants/supabase';

const BUCKETS = ['documents-familiaux', 'enfants-photos', 'journal-photos', 'moments-photos'];

/** Les espaces familiaux ou le compte connecte est le seul parent. */
async function famillesOuJeSuisSeul(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('parents').select('famille_id, user_id');
  if (error) throw error;
  const parParFamille = new Map<string, { moi: boolean; total: number }>();
  for (const p of data ?? []) {
    const entree = parParFamille.get(p.famille_id) ?? { moi: false, total: 0 };
    entree.total += 1;
    if (p.user_id === userId) entree.moi = true;
    parParFamille.set(p.famille_id, entree);
  }
  return [...parParFamille.entries()].filter(([, e]) => e.moi && e.total === 1).map(([id]) => id);
}

/**
 * Retire tous les fichiers d'une famille dans un bucket. list() rend au plus
 * une page : on boucle jusqu'a ce qu'elle soit vide.
 */
async function viderDossier(bucket: string, familleId: string): Promise<void> {
  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(familleId, { limit: 1000 });
    if (error) throw error;
    const chemins = (data ?? []).filter((f) => f.name).map((f) => `${familleId}/${f.name}`);
    if (chemins.length === 0) return;
    const { error: erreurSuppression } = await supabase.storage.from(bucket).remove(chemins);
    if (erreurSuppression) throw erreurSuppression;
    if (chemins.length < 1000) return;
  }
}

/**
 * Supprime le compte connecte et tout ce qui n'appartient qu'a lui.
 *
 * Leve une erreur si quelque chose a echoue AVANT la suppression du compte :
 * dans ce cas le compte existe encore et le parent peut reessayer. Apres un
 * retour sans erreur, la session n'est plus valable : l'appelant efface les
 * donnees locales et renvoie vers l'ecran de connexion.
 */
export async function supprimerMonCompte(): Promise<void> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error('session_requise');

  const familles = await famillesOuJeSuisSeul(data.user.id);
  for (const familleId of familles) {
    for (const bucket of BUCKETS) {
      await viderDossier(bucket, familleId);
    }
  }

  const { error: erreurRpc } = await supabase.rpc('supprimer_mon_compte');
  if (erreurRpc) throw erreurRpc;
}
