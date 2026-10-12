// lib/invitationEnAttente.ts
//
// Le lien d'invitation d'un co-parent survit aux detours.
//
// Le 10 octobre 2026, un co-parent invite a ouvert le lien, cree son compte,
// confirme son adresse, puis s'est connecte par l'ecran ordinaire : n'ayant
// pas encore de famille, l'application l'a envoye « creer son espace », et
// il s'est retrouve avec un espace a lui au lieu de rejoindre celui de
// l'autre parent. Le meme jour, au retour par le lien de l'e-mail, le
// formulaire etait vide et redemandait tout.
//
// On memorise donc, sur l'appareil, le jeton du dernier lien ouvert et ce
// que la personne a deja saisi (prenom, e-mail — jamais le mot de passe ni
// le code). Tant que la demande n'est pas deposee, chaque chemin qui menerait
// vers la creation d'un espace repasse d'abord par ce lien.

import AsyncStorage from '@react-native-async-storage/async-storage';

const CLE = 'dualia_invitation_en_attente';

export type InvitationEnAttente = {
  token: string;
  prenom?: string;
  email?: string;
};

export async function lireInvitationEnAttente(): Promise<InvitationEnAttente | null> {
  try {
    const brut = await AsyncStorage.getItem(CLE);
    if (!brut) return null;
    const valeur = JSON.parse(brut);
    return valeur && typeof valeur.token === 'string' && valeur.token ? valeur : null;
  } catch {
    return null;
  }
}

/** Fusionne avec ce qui est deja memorise pour ce meme jeton. */
export async function memoriserInvitationEnAttente(valeur: InvitationEnAttente): Promise<void> {
  try {
    const existante = await lireInvitationEnAttente();
    const fusion =
      existante && existante.token === valeur.token ? { ...existante, ...valeur } : valeur;
    await AsyncStorage.setItem(CLE, JSON.stringify(fusion));
  } catch {
    // Stockage indisponible (navigation privee, quota...) : on fait sans.
  }
}

export async function oublierInvitationEnAttente(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CLE);
  } catch {
    // idem
  }
}

/** Le chemin vers lequel renvoyer une personne sans famille, si un lien attend. */
export async function cheminInvitationEnAttente(): Promise<string | null> {
  const invitation = await lireInvitationEnAttente();
  return invitation ? `/rejoindre?token=${encodeURIComponent(invitation.token)}` : null;
}
