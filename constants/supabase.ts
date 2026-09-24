// constants/supabase.ts
// Configuration de connexion à la base de données partagée. La clé
// "publishable" est conçue pour être visible côté client (protégée par les
// règles de sécurité RLS définies dans la base) — ce n'est pas un secret.
//
// Avec web.output "static" (voir app.json), Expo pré-rend chaque page côté
// serveur (Node) au moment du build, dans un environnement sans `window` ni
// DOM. Le client Supabase, configuré avec AsyncStorage, tentait d'accéder à
// window dès sa création pour charger une session existante — ce qui
// faisait planter le pré-rendu ("window is not defined"). On fournit donc
// un storage "factice" (no-op) tant qu'on n'est pas dans un vrai
// navigateur, et on désactive la persistance de session dans ce cas — elle
// n'a de toute façon aucun sens côté serveur.

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SUPABASE_URL = 'https://fnnynyztyujxvpbakvpp.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_dtbV4IR77FAKU97gj_SXUg_G_X2vVEi';

const estNavigateurReel = Platform.OS !== 'web' || typeof window !== 'undefined';

const storageFactice = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

const stockageAuth = estNavigateurReel ? AsyncStorage : storageFactice;

// Cle sous laquelle supabase-js range la session. Derivee de l'URL du projet,
// comme le fait la bibliotheque elle-meme, plutot qu'ecrite en dur : si le
// projet change un jour, cette constante suit.
export const CLE_SESSION_SUPABASE = `sb-${SUPABASE_URL.split('//')[1].split('.')[0]}-auth-token`;

/**
 * Efface la session de CET appareil, sans passer par le serveur.
 *
 * supabase.auth.signOut() ne retire pas toujours la session du stockage : quand
 * le jeton d'acces a expire et que le rafraichissement echoue faute de reseau,
 * _signOut sort en erreur AVANT d'appeler removeCurrentSession — et la portee
 * 'local' ne change rien, car le test de portee vient apres cette sortie. Le
 * jeton de rafraichissement restait donc vivant sur le poste.
 *
 * Sur un ordinateur familial partage par un couple separe, c'est la seule
 * chose qui compte vraiment : mieux vaut une session encore ouverte cote
 * serveur qu'un jeton exploitable sur la machine.
 */
export async function effacerSessionLocale(): Promise<boolean> {
  try {
    await stockageAuth.removeItem(CLE_SESSION_SUPABASE);
    return true;
  } catch (e) {
    console.error('[Dualia] Impossible d’effacer la session locale :', e);
    return false;
  }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: stockageAuth,
    autoRefreshToken: estNavigateurReel,
    persistSession: estNavigateurReel,
    detectSessionInUrl: false,
  },
});