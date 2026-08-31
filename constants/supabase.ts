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

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: estNavigateurReel ? AsyncStorage : storageFactice,
    autoRefreshToken: estNavigateurReel,
    persistSession: estNavigateurReel,
    detectSessionInUrl: false,
  },
});