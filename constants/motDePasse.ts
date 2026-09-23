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

export const AIDE_MOT_DE_PASSE =
  '10 caractères minimum, avec au moins une lettre, un chiffre et un symbole.';

/**
 * Renvoie un message d'erreur en français si le mot de passe ne convient pas,
 * ou null s'il est valide.
 */
export function validerMotDePasse(motDePasse: string): string | null {
  if (motDePasse.length < LONGUEUR_MINIMALE) {
    return `Le mot de passe doit contenir au moins ${LONGUEUR_MINIMALE} caractères.`;
  }
  if (!/[a-zA-Zà-üÀ-Ü]/.test(motDePasse)) {
    return 'Le mot de passe doit contenir au moins une lettre.';
  }
  if (!/[0-9]/.test(motDePasse)) {
    return 'Le mot de passe doit contenir au moins un chiffre.';
  }
  if (!/[^a-zA-Z0-9à-üÀ-Ü]/.test(motDePasse)) {
    return 'Le mot de passe doit contenir au moins un symbole (par exemple ! ? # ou -).';
  }
  return null;
}

/**
 * Traduit les erreurs de mot de passe renvoyées par Supabase, qui arrivent
 * en anglais et sont incompréhensibles pour un parent.
 */
export function traduireErreurAuth(message?: string): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('pwned') || m.includes('leaked') || m.includes('compromised')) {
    return "Ce mot de passe figure dans une fuite de données connue. Choisissez-en un autre, utilisé nulle part ailleurs.";
  }
  if (m.includes('password') && m.includes('short')) {
    return `Le mot de passe doit contenir au moins ${LONGUEUR_MINIMALE} caractères.`;
  }
  if (m.includes('password') && (m.includes('weak') || m.includes('requirements'))) {
    return AIDE_MOT_DE_PASSE;
  }
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'Un compte existe déjà avec cette adresse email.';
  }
  if (m.includes('invalid') && m.includes('email')) {
    return "Cette adresse email n'est pas valide.";
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Trop de tentatives. Réessayez dans quelques minutes.';
  }
  return message ?? 'Une erreur est survenue.';
}