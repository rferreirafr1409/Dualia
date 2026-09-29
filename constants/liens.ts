// constants/liens.ts
//
// L'adresse publique de l'application, en un seul endroit.
//
// Supabase envoie des e-mails qui ramenent ici : confirmation d'adresse,
// reinitialisation de mot de passe. Chaque destination doit etre declaree
// dans Supabase -> Authentication -> URL Configuration -> Redirect URLs,
// sinon Supabase IGNORE l'adresse demandee et redirige vers la « Site URL »
// du projet — silencieusement, sans erreur. Une entree avec joker
// (https://.../Dualia/**) couvre toutes les pages d'un coup.
//
// Cette base etait recopiee a la main dans les ecrans qui en avaient besoin.
// Le jour ou l'application demenagera sur dualia.app, une seule ligne sera
// a changer ici — au lieu de laisser derriere soi une reinitialisation de
// mot de passe qui pointe encore vers l'ancienne adresse.

// Sans barre oblique finale : elle est ajoutee par lienApplication().
export const URL_BASE_APPLICATION = 'https://rferreirafr1409.github.io/Dualia';

/**
 * Fabrique une URL absolue vers une page de l'application.
 *
 *   lienApplication('rejoindre', { token: 'abc' })
 *     -> https://rferreirafr1409.github.io/Dualia/rejoindre?token=abc
 *
 * Les parametres vides ou absents sont ecartes : un `?token=undefined`
 * ramenerait la personne sur un ecran qui refuse un jeton illisible.
 */
export function lienApplication(
  chemin: string,
  parametres?: Record<string, string | undefined | null>
): string {
  const page = String(chemin ?? '').replace(/^\/+/, '');
  const base = `${URL_BASE_APPLICATION}/${page}`;

  if (!parametres) return base;

  const query = new URLSearchParams();
  for (const [cle, valeur] of Object.entries(parametres)) {
    if (valeur === undefined || valeur === null || valeur === '') continue;
    query.append(cle, String(valeur));
  }

  const suffixe = query.toString();
  return suffixe ? `${base}?${suffixe}` : base;
}
