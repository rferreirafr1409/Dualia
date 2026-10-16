// lib/erreursBackend.ts
//
// Traduit les codes d'erreur rendus par la garde du backend (dualia-backend,
// lib/garde.cjs) en phrases lisibles par le parent, dans sa langue.
//
// La garde repond avec un code stable dans le champ `error` :
//   401 session_requise           — jeton absent ou expire
//   403 espace_familial_requis    — compte connecte, mais rattache a aucun
//                                   espace familial (DUA-088)
//   429 plafond_journalier_atteint — plafond du jour atteint pour cet endpoint
//
// Avant ce fichier, plusieurs ecrans affichaient `error` tel quel : un parent
// y lisait « plafond_journalier_atteint », et un compte sans espace familial
// lisait meme « plafond atteint » alors que son compteur etait a zero. Les
// endpoints qui envoient deja une phrase (extraction du jugement, moderation)
// ne sont pas touches : une chaine inconnue est rendue telle quelle.

import type { Langue } from '../constants/i18n';

export type CodeErreurBackend = 'session_requise' | 'espace_familial_requis' | 'plafond_journalier_atteint';

const PHRASES: Record<Langue, Record<CodeErreurBackend, string>> = {
  fr: {
    session_requise: 'Votre session a expiré. Reconnectez-vous puis réessayez.',
    espace_familial_requis:
      "Votre compte n'est rattaché à aucun espace familial. Créez votre espace ou rejoignez celui de votre co-parent pour utiliser cette fonction.",
    plafond_journalier_atteint: "Vous avez atteint le nombre d'utilisations autorisées aujourd'hui. Le compteur repart demain.",
  },
  es: {
    session_requise: 'Tu sesión ha caducado. Vuelve a iniciar sesión e inténtalo de nuevo.',
    espace_familial_requis:
      'Tu cuenta no está vinculada a ningún espacio familiar. Crea tu espacio o únete al de tu coparental para usar esta función.',
    plafond_journalier_atteint: 'Has alcanzado el número de usos permitidos hoy. El contador se reinicia mañana.',
  },
  pt: {
    session_requise: 'A sua sessão expirou. Volte a iniciar sessão e tente novamente.',
    espace_familial_requis:
      'A sua conta não está ligada a nenhum espaço familiar. Crie o seu espaço ou junte-se ao do outro progenitor para usar esta função.',
    plafond_journalier_atteint: 'Atingiu o número de utilizações permitidas hoje. O contador recomeça amanhã.',
  },
  en: {
    session_requise: 'Your session has expired. Sign in again and retry.',
    espace_familial_requis:
      'Your account is not linked to any family space. Create your space or join your co-parent’s to use this feature.',
    plafond_journalier_atteint: 'You have reached today’s allowed number of uses. The counter resets tomorrow.',
  },
};

/** Vrai si `code` est l'un des codes connus de la garde. */
export function estCodeErreurBackend(code: unknown): code is CodeErreurBackend {
  return typeof code === 'string' && code in PHRASES.fr;
}

/**
 * La phrase a montrer au parent pour le champ `error` d'une reponse du
 * backend. Un code connu est traduit ; toute autre chaine (une phrase deja
 * ecrite par l'endpoint) est rendue telle quelle ; sinon `null`.
 */
export function messageErreurBackend(erreur: unknown, langue: Langue): string | null {
  if (estCodeErreurBackend(erreur)) return (PHRASES[langue] ?? PHRASES.fr)[erreur];
  return typeof erreur === 'string' && erreur.trim() ? erreur : null;
}

/**
 * Lit le corps d'une reponse en echec et en tire la phrase a afficher, ou
 * `null` si le corps n'en dit rien. Ne jette jamais : un corps vide ou non
 * JSON rend `null`.
 */
export async function lireErreurBackend(reponse: Response, langue: Langue): Promise<string | null> {
  try {
    const corps = await reponse.json();
    return messageErreurBackend(corps?.error, langue);
  } catch {
    return null;
  }
}
