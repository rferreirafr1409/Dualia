// lib/ouvrirFichierStocke.ts
//
// Ouverture d'une pièce conservée dans le bucket privé documents-familiaux.
// Le bucket n'est jamais public : on signe le chemin au moment du clic, pour
// une heure, et on ouvre l'URL obtenue.
//
// Le détour par un onglet ouvert AVANT la signature n'est pas une coquetterie.
// Sur le web, Linking.openURL appelle window.open ; un navigateur n'autorise
// window.open que pendant le geste de l'utilisateur. Or la signature est un
// aller-retour réseau : appelé après, window.open est bloqué en silence par
// Safari et Firefox — le parent clique sur « Ouvrir » et rien ne se passe,
// sans même un message. On réserve donc l'onglet dans le geste, puis on lui
// donne son adresse une fois l'URL signée obtenue.

import { Linking, Platform } from 'react-native';
import { supabase } from '../constants/supabase';

const BUCKET = 'documents-familiaux';
const DUREE_SIGNATURE = 3600;

export async function ouvrirFichierStocke(chemin: string): Promise<void> {
  if (!chemin) return;

  const surLeWeb = Platform.OS === 'web' && typeof window !== 'undefined';
  const onglet = surLeWeb ? window.open('', '_blank') : null;

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(chemin, DUREE_SIGNATURE);

    if (error || !data?.signedUrl) throw error ?? new Error('URL indisponible');

    if (onglet && !onglet.closed) {
      onglet.location.href = data.signedUrl;
      return;
    }
    // Onglet refusé malgré tout (bloqueur strict) ou plateforme native.
    await Linking.openURL(data.signedUrl);
  } catch (err) {
    if (onglet && !onglet.closed) onglet.close();
    throw err;
  }
}
