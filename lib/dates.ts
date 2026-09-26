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

/**
 * Transforme une heure « murale » en instant reel.
 *
 * Le detecteur d'evenements du backend rend une heure telle qu'elle est ecrite
 * dans le message — « 2026-09-25T19:00:00 », sans fuseau. Cette chaine etait
 * enregistree telle quelle. L'application la relisait comme une heure locale et
 * affichait 19:00 ; Postgres, lui, la lisait comme de l'UTC et stockait
 * 19:00+00, soit 21:00 a Paris.
 *
 * Resultat : le parent voyait 19:00, l'autre parent voyait 21:00, et le premier
 * aussi des le rechargement suivant. Un match de football decale de deux
 * heures entre deux telephones, sur l'ecran meme qui sert a se coordonner.
 *
 * On construit donc l'instant dans le fuseau de l'appareil.
 *
 * ATTENTION — cette fonction doit etre IDEMPOTENTE, et la premiere version ne
 * l'etait pas. Son motif n'etait pas ancre a la fin : « 2026-09-25T17:00:00Z »
 * en satisfaisait le debut, le « Z » etait jete, et 17:00 — qui etait de l'UTC,
 * soit 19:00 a Paris — etait relu comme une heure murale. Chaque passage
 * retirait ainsi deux heures. Appliquee a l'entree du magasin, ou la plupart
 * des valeurs sont deja des instants (toISOString() de la saisie manuelle, de
 * Noel, des vacances scolaires), elle avancait Noel au 24 decembre 23:00 et
 * reculait de deux heures chaque rendez-vous saisi a la main.
 *
 * Regle : une chaine qui porte deja un fuseau EST un instant et ne doit pas
 * etre touchee. Seule une chaine sans fuseau est une heure murale.
 */
export function instantDepuisHeureLocale(valeur: string): string {
  if (!valeur) return valeur;
  const s = String(valeur).trim();

  // Fuseau deja present (« Z » ou « +02:00 ») : c'est un instant, on le rend
  // tel quel. C'est le garde-fou qui rend la fonction idempotente, et donc
  // sans danger la ou elle est appelee plusieurs fois de suite.
  if (/[T ]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(s)) return s;

  // Heure murale, sans fuseau. Le motif est ancre a la fin : rien d'autre
  // qu'une date et une heure ne peut desormais entrer dans cette branche.
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/);
  if (!m) {
    // Date seule, sans heure : depuisJourLocal construit minuit LOCAL. Passer
    // par new Date('2026-09-25') donnerait minuit UTC — le piege decrit en
    // tete de ce fichier, et qui affiche 02:00 a Paris ou la veille a New York.
    const jourSeul = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (jourSeul) return depuisJourLocal(s).toISOString();
    const brut = new Date(s);
    return Number.isNaN(brut.getTime()) ? valeur : brut.toISOString();
  }
  const [, a, mo, j, h, mi, sec] = m;
  const d = new Date(Number(a), Number(mo) - 1, Number(j), Number(h), Number(mi), Number(sec ?? 0));
  return d.toISOString();
}

/**
 * Cette chaine pourra-t-elle etre lue par parseISO() sans lever ?
 *
 * L'application appelle parseISO(ev.date) a plus de quarante endroits, et
 * format() sur une date invalide leve une RangeError. Une seule ligne
 * illisible — un modele qui rend « vendredi prochain », un import .ics
 * malforme, une vieille ligne en base — et l'accueil devient blanc, sans
 * message, sans moyen d'en sortir.
 *
 * Plutot que de proteger quarante appels, on verifie aux TROIS portes par
 * lesquelles une date entre dans l'etat : l'ajout d'un evenement, la lecture
 * depuis la base, et la rehydratation du stockage local (la plus facile a
 * oublier — elle s'execute avant tout le reste, et ramene telles quelles les
 * donnees ecrites par une version anterieure). Ce qui ne passe pas ces
 * portes ne peut plus casser l'ecran.
 */
export function estInstantValide(valeur: unknown): boolean {
  if (typeof valeur !== 'string' || !valeur.trim()) return false;

  // parseISO exige une date ISO ; « 25/09/2026 » ou « vendredi » rendent
  // Invalid Date.
  // Le « Z » doit etre majuscule : parseISO refuse « ...T17:00:00z » la ou
  // new Date() l'accepte. Accepter ici ce que parseISO rejettera ensuite
  // viderait de son sens le seul controle qui les separe.
  if (/z$/.test(valeur)) return false;

  const m = valeur.match(/^(\d{4})-(\d{2})-(\d{2})([T ]\d{2}:\d{2}|$)/);
  if (!m) return false;

  // Le jour doit exister reellement. « 2026-02-31 » a la bonne forme, et
  // new Date() l'accepte en le reportant au 3 mars — mais parseISO, lui,
  // leve. Sans ce controle, la porte laisserait passer exactement le genre
  // de date qu'elle est censee arreter. On compare donc les composants apres
  // construction : un report change le mois ou le quantieme.
  const [, a, mo, j] = m;
  const d = new Date(Date.UTC(Number(a), Number(mo) - 1, Number(j)));
  if (d.getUTCMonth() !== Number(mo) - 1 || d.getUTCDate() !== Number(j)) return false;

  // Et l'heure, quand elle est presente, doit etre une vraie heure
  // (« T25:00 » a la bonne forme sans exister).
  return !Number.isNaN(new Date(valeur).getTime());
}

/**
 * Le fuseau de cet appareil, sous sa forme IANA (« Europe/Paris »).
 *
 * Le backend tourne en UTC et n'a aucun moyen de savoir ou vit le parent.
 * Tant qu'il l'ignorait, il disait au detecteur d'evenements la date UTC :
 * entre minuit et 2h du matin a Paris, c'est la veille. Un message ecrit a
 * 00h30 disant « demain » partait un jour trop tot, pour les deux parents.
 *
 * On l'envoie donc avec le message. La valeur est verifiee cote serveur,
 * qui retombe sur UTC si elle est absente ou douteuse.
 */
export function fuseauAppareil(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof tz === 'string' && tz ? tz : 'UTC';
  } catch {
    return 'UTC';
  }
}
