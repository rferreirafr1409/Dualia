// lib/appelBackend.ts
//
// En-tetes pour les appels aux fonctions serverless de Dualia
// (dualia-backend.vercel.app).
//
// Ces endpoints n'exigeaient rien : ni origine, ni identite. Quatre d'entre eux
// appellent un modele et coutent donc de l'argent a chaque requete. Ils
// verifient desormais que l'appelant presente une session Dualia valide, et
// cette session voyage dans l'en-tete Authorization.
//
// La fonction ne leve pas d'erreur en l'absence de session : elle renvoie
// simplement les en-tetes sans jeton, et c'est le serveur qui repond 401. Les
// ecrans concernes sont de toute facon inaccessibles sans session depuis la
// garde posee dans app/_layout.tsx — ce cas ne devrait donc pas se produire, et
// s'il se produit on prefere une erreur serveur claire a une exception
// inattendue au milieu d'un scan de ticket.

import { supabase } from '../constants/supabase';

export async function entetesBackend(): Promise<Record<string, string>> {
  const base: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { data } = await supabase.auth.getSession();
    const jeton = data.session?.access_token;
    if (jeton) base.Authorization = `Bearer ${jeton}`;
  } catch (e) {
    console.error('[Dualia] Session illisible avant un appel au backend :', e);
  }
  return base;
}
