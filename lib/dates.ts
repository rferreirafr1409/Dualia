// lib/dates.ts
//
// Un jour de calendrier n'est pas un instant.
//
// « Le 15 juin » est une date du calendrier du parent. toISOString() rend un
// instant UTC : minuit du 15 juin a Paris vaut 22h00 le 14 juin en UTC. En
// passant par .split('T')[0] pour alimenter une colonne `date` de Postgres, on
// enregistre donc le 14. Une depense du 1er du mois bascule au mois precedent,
// une date de naissance recule d'un jour, et l'age affiche est faux le jour de
// l'anniversaire.
//
// Le symetrique est aussi vrai : new Date('2026-06-15') rend minuit UTC, qui
// s'affiche le 14 dans tout fuseau negatif. Un parent a Paris et le meme parent
// en deplacement a Montreal ne voient alors pas la meme date pour la meme
// depense.
//
// Regle : une date de calendrier circule sous la forme 'AAAA-MM-JJ' et ne
// repasse jamais par toISOString(). Les fonctions ci-dessous sont les seules
// portes d'entree et de sortie.
//
// Colonnes concernees cote Supabase (type `date`, donc sensibles au decalage) :
// depenses.date, depenses.justificatif_expire_le, enfants.date_naissance,
// journal_entries.date, journal_entries.date_revelation, documents.date,
// documents.date_expiration, echeances_administratives.date_echeance,
// transmission_checks.date_passage.
// Les colonnes `timestamptz` (evenements_garde, messages, decisions...) portent
// de vrais instants : toISOString() y est correct et doit y rester.

/** Date du calendrier local, au format AAAA-MM-JJ. */
export function jourLocal(d: Date): string {
  const mois = String(d.getMonth() + 1).padStart(2, '0');
  const jour = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mois}-${jour}`;
}

/** Aujourd'hui, dans le calendrier du parent. */
export function aujourdHuiLocal(): string {
  return jourLocal(new Date());
}

/**
 * Reconstruit un Date a minuit LOCAL a partir d'une date de calendrier.
 * Accepte aussi bien 'AAAA-MM-JJ' qu'un ISO complet, ce qui permet de relire
 * sans precaution les valeurs enregistrees avant cette correction.
 */
export function depuisJourLocal(valeur: string): Date {
  const [partieJour] = (valeur || '').split('T');
  const [a, m, j] = partieJour.split('-').map(Number);
  if (!a || !m || !j) return new Date(valeur);
  return new Date(a, m - 1, j);
}

/**
 * Normalise une valeur avant ecriture dans une colonne `date`.
 * - 'AAAA-MM-JJ' est renvoye tel quel (c'est deja un jour de calendrier) ;
 * - un instant ISO complet est ramene au jour du calendrier LOCAL, pas au jour
 *   UTC : c'est exactement ce que .split('T')[0] faisait de travers.
 */
export function jourPourBase(valeur: string): string {
  if (!valeur) return valeur;
  if (/^\d{4}-\d{2}-\d{2}$/.test(valeur)) return valeur;
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return valeur.split('T')[0];
  return jourLocal(d);
}

/** Met en forme une date de calendrier sans jamais la decaler. */
export function formatJourLocal(
  valeur: string,
  locale: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
): string {
  if (!valeur) return '';
  return depuisJourLocal(valeur).toLocaleDateString(locale, options);
}

/** Ajoute des jours a une date de calendrier, sans passer par UTC. */
export function ajouterJours(valeur: string, nombre: number): string {
  const d = depuisJourLocal(valeur);
  d.setDate(d.getDate() + nombre);
  return jourLocal(d);
}

/** Ajoute des annees a une date de calendrier. */
export function ajouterAnnees(valeur: string, nombre: number): string {
  const d = depuisJourLocal(valeur);
  d.setFullYear(d.getFullYear() + nombre);
  return jourLocal(d);
}
