// constants/motDePasse.ts
//
// Règle unique de validation du mot de passe, partagée par tous les écrans
// qui en demandent un (création d'espace, invitation, réinitialisation).
//
// Elle doit rester alignée sur la configuration Supabase :
//   Authentication → Sign In / Providers → Email
//     · Minimum password length          : 10
//     · Password requirements            : lettres, chiffres et symboles
//     · Prevent use of leaked passwords  : activé
//
// Sans cet alignement, l'écran accepte un mot de passe que Supabase refuse
// ensuite, et l'utilisateur reçoit une erreur brute en anglais sans
// comprendre ce qu'on attend de lui.
//
// La vérification contre les mots de passe ayant fuité reste faite côté
// Supabase : elle ne peut pas l'être ici, et c'est la protection la plus
// efficace des trois.

export const LONGUEUR_MINIMALE = 10;

import { TRADUCTIONS, type Langue } from './i18n';

const libelles = (langue?: Langue) => (TRADUCTIONS[langue ?? 'fr'] ?? TRADUCTIONS.fr).motDePasse;

/** Consigne affichée sous le champ, dans la langue de l'appareil. */
export function aideMotDePasse(langue?: Langue): string {
  return libelles(langue).aide;
}

/**
 * Renvoie un message d'erreur dans la langue demandée si le mot de passe ne
 * convient pas, ou null s'il est valide.
 */
export function validerMotDePasse(motDePasse: string, langue?: Langue): string | null {
  const l = libelles(langue);
  if (motDePasse.length < LONGUEUR_MINIMALE) {
    return l.tropCourt(LONGUEUR_MINIMALE);
  }
  if (!/[a-zA-Zà-üÀ-Ü]/.test(motDePasse)) {
    return l.sansLettre;
  }
  if (!/[0-9]/.test(motDePasse)) {
    return l.sansChiffre;
  }
  if (!/[^a-zA-Z0-9à-üÀ-Ü]/.test(motDePasse)) {
    return l.sansSymbole;
  }
  return null;
}

/**
 * Traduit les erreurs de mot de passe renvoyées par Supabase, qui arrivent
 * en anglais et sont incompréhensibles pour un parent.
 */
export function traduireErreurAuth(message?: string, langue?: Langue): string {
  const l = libelles(langue);
  const m = (message ?? '').toLowerCase();
  if (m.includes('pwned') || m.includes('leaked') || m.includes('compromised')) {
    return l.fuite;
  }
  if (m.includes('password') && m.includes('short')) {
    return l.tropCourt(LONGUEUR_MINIMALE);
  }
  if (m.includes('password') && (m.includes('weak') || m.includes('requirements'))) {
    return l.aide;
  }
  if (m.includes('already registered') || m.includes('already been registered')) {
    return l.compteExistant;
  }
  if (m.includes('invalid') && m.includes('email')) {
    return l.emailInvalide;
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return l.tropDeTentatives;
  }
  return message ?? l.erreurGenerique;
}
