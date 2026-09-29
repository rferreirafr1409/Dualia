// lib/navigation.ts
//
// Revenir en arriere, y compris quand il n'y a pas d'arriere.
//
// `router.back()` poste une action a React Navigation, qui ne fait RIEN quand
// la pile est vide. Or elle l'est chaque fois qu'on ouvre une page
// directement : lien partage, favori, ou simple rechargement — ce qui est le
// cas courant sur un export statique servi par GitHub Pages.
//
// Le chevron ou la croix en haut de l'ecran devenait alors un bouton mort, et
// l'ecran un cul-de-sac dont on ne sortait qu'en rechargeant a la main.
//
// securite-compte.tsx portait deja ce contournement, seul de toute
// l'application. On le pose ici pour tous.

import type { Router } from 'expo-router';

export function retour(router: Router, repli: string) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(repli as any);
}
