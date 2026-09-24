// lib/comptes.ts
//
// Arithmetique de l'argent partage. Isolee ici pour une raison simple : c'est
// la seule partie de Dualia ou une erreur se traduit directement en euros
// reclames a tort entre deux parents. Ces fonctions sont pures et testables,
// et elles le sont (voir scripts-backup/test-comptes).
//
// Trois invariants tenus par ce fichier :
//  1. tout montant stocke est arrondi au centime ;
//  2. partA + partB vaut EXACTEMENT la base de partage de la depense —
//     c'est-a-dire son montant, diminue du remboursement de la mutuelle quand
//     la regle du jugement le prevoit (voir lib/conditionsCadre). Sans
//     remboursement, base = montant. Ne jamais redériver une part depuis
//     `montant` : passer par basePartageable() ;
//  3. la somme des depenses creees depuis un ticket vaut le total du ticket.

export type LigneTicket = { libelle: string; montant: number; categorie: string };

/**
 * Mise en forme d'un montant, dans la langue du parent.
 *
 * Toutes les langues de Dualia sauf l'anglais ecrivent la decimale avec une
 * virgule : `${n.toFixed(2)} €` affichait « 1234.56 € » a un parent francais.
 * Une seule fonction pour toute l'application, pour qu'un plafond se lise a
 * l'identique la ou on le valide et la ou on l'applique.
 */
export function formatMontant(n: number, langue: 'fr' | 'pt' | 'es' | 'en' = 'fr'): string {
  const locale = langue === 'pt' ? 'pt-PT' : langue === 'es' ? 'es-ES' : langue === 'en' ? 'en-GB' : 'fr-FR';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(centimes(n));
  } catch {
    return `${centimes(n).toFixed(2)} €`;
  }
}

/** Arrondi au centime. 60 % de 100,01 € vaut 60,006 € : inacceptable en base. */
export function centimes(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Repartit un montant en deux parts qui totalisent EXACTEMENT le montant.
 * partB absorbe le reste d'arrondi : a un centime pres, c'est toujours mieux
 * qu'un solde qui ne se referme pas.
 */
export function repartir(montant: number, pourcentA: number): { partA: number; partB: number } {
  const partA = centimes(montant * (pourcentA / 100));
  return { partA, partB: centimes(montant - partA) };
}

/**
 * Sens de la dette a partir des depenses non reglees.
 * Positif => B doit a A. Negatif => A doit a B.
 *
 * Ne depend PAS du parent connecte : le sens de la dette est une propriete des
 * depenses, pas du point de vue de celui qui regarde l'ecran. L'affichage
 * precedent nommait les parents depuis parentActif, si bien que chacun lisait
 * que l'autre lui devait de l'argent.
 */
export function calculerSolde(
  depenses: { montant: number; rembourse: boolean; auteurId: 'A' | 'B'; partA?: number; partB?: number }[]
): { totalDepenses: number; solde: number } {
  const totalDepenses = centimes(depenses.reduce((s, d) => s + d.montant, 0));
  let duAVersB = 0;
  let duBVersA = 0;
  depenses
    .filter((d) => !d.rembourse)
    .forEach((d) => {
      const partA = d.partA ?? d.montant / 2;
      const partB = d.partB ?? d.montant / 2;
      if (d.auteurId === 'A') duBVersA += partB;
      else duAVersB += partA;
    });
  return { totalDepenses, solde: centimes(duBVersA - duAVersB) };
}

/**
 * Sur les tickets complexes (remises par article, poids, consigne...), l'IA
 * peut manquer une ligne. Le total imprime, lui, est un chiffre unique presque
 * toujours lu correctement : on l'impose en ajoutant une ligne d'ajustement.
 *
 * Seuil au demi-centime, et non a cinq centimes : avec l'ancienne tolerance, un
 * ecart de 4 centimes etait abandonne en silence et le total enregistre ne
 * correspondait plus au ticket — exactement ce que cette fonction garantit.
 */
export function reconcilierLignes(
  lignes: LigneTicket[],
  montantTotal: number | null | undefined,
  libelleAjustement = 'Ajustement (écart de lecture)'
): LigneTicket[] {
  if (!Array.isArray(lignes) || lignes.length === 0 || typeof montantTotal !== 'number') {
    return lignes;
  }
  const somme = lignes.reduce((acc, l) => acc + (Number(l.montant) || 0), 0);
  const ecart = centimes(montantTotal - somme);
  if (Math.abs(ecart) < 0.005) return lignes;
  return [...lignes, { libelle: libelleAjustement, montant: ecart, categorie: 'autre' }];
}

/**
 * Lit un montant saisi a la main, dans les notations que les parents utilisent
 * reellement.
 *
 * parseFloat seul est un piege : parseFloat('1 234,56'.replace(',','.')) vaut 1,
 * et parseFloat('1.234,56') vaut 1,234. Une facture de 1 234,56 € collee depuis
 * un mail entrait donc dans les comptes a 1,00 €. Le clavier decimal de
 * react-native-web n'est qu'une indication : il ne filtre pas un collage.
 *
 * Renvoie NaN si la valeur n'est pas exploitable — l'appelant refuse alors la
 * saisie plutot que d'enregistrer un montant devine.
 */
export function parserMontant(saisie: string): number {
  if (typeof saisie !== 'string') return NaN;
  // Espaces ordinaires, insecables et insecables fines (separateurs de milliers
  // en francais), plus le symbole monetaire s'il a ete colle avec.
  let s = saisie.replace(/[\s   ]/g, '').replace(/[€$£]/g, '');
  if (!s) return NaN;
  if (!/^-?[\d.,]+$/.test(s)) return NaN;

  // Un separateur de milliers ne peut grouper que des tranches de 3 chiffres.
  // Sans ce controle, '12,5,5' etait lu 1255 € au lieu d'etre refuse.
  const milliersValides = (partieEntiere: string, sep: string): boolean => {
    const tranches = partieEntiere.replace('-', '').split(sep);
    if (tranches.length === 1) return true;
    if (tranches[0].length < 1 || tranches[0].length > 3) return false;
    return tranches.slice(1).every((t) => t.length === 3);
  };

  const dernierPoint = s.lastIndexOf('.');
  const derniereVirgule = s.lastIndexOf(',');

  if (dernierPoint !== -1 && derniereVirgule !== -1) {
    // Les deux presents : le dernier des deux est le separateur decimal,
    // l'autre separe les milliers. Lit correctement '1.234,56' (notation
    // francaise) comme '1,234.56' (notation anglo-saxonne).
    if (derniereVirgule > dernierPoint) {
      if (!milliersValides(s.slice(0, derniereVirgule), '.')) return NaN;
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      if (!milliersValides(s.slice(0, dernierPoint), ',')) return NaN;
      s = s.replace(/,/g, '');
    }
  } else {
    const sep = derniereVirgule !== -1 ? ',' : dernierPoint !== -1 ? '.' : null;
    if (sep) {
      const morceaux = s.split(sep);
      const decimales = morceaux[morceaux.length - 1].length;
      if (morceaux.length > 2) {
        // '1.234.567' : plusieurs separateurs identiques = milliers.
        if (!milliersValides(s, sep)) return NaN;
        s = s.split(sep).join('');
      } else if (decimales === 3) {
        // AMBIGU, et on ne devine pas quand il s'agit d'argent.
        // '1,234' vaut 1,234 € pour un anglophone et 1 234 € pour un
        // francophone : un facteur mille. '12,999' est tout aussi ambigu.
        // Plutot que de choisir a la place du parent, on refuse la saisie ;
        // l'ecran lui demande deux decimales ou un separateur de milliers
        // explicite. Une erreur de facteur mille sur l'ecran qui dit qui doit
        // combien a qui ne se rattrape pas.
        return NaN;
      } else {
        s = s.replace(sep, '.');
      }
    }
  }

  if (!/^-?\d*\.?\d*$/.test(s) || s === '.' || s === '-' || s === '') return NaN;
  const n = parseFloat(s);
  return Number.isFinite(n) ? centimes(n) : NaN;
}

/**
 * Regroupe les lignes d'un ticket par categorie, en garantissant que chaque
 * depense creee porte un montant strictement positif ET que la somme des
 * depenses creees vaut EXACTEMENT le total des lignes.
 *
 * Un ticket comporte des remises, des bons de reduction, une consigne rendue :
 * l'IA les lit comme des lignes negatives, et il arrive qu'une categorie
 * devienne nulle ou negative une fois cumulee. Enregistrer une depense a
 * -3,20 € inverserait le sens de la dette pour cette ligne — le chemin manuel
 * refuse d'ailleurs deja tout montant negatif.
 *
 * On ne peut pas non plus jeter ces lignes : le total enregistre ne
 * correspondrait plus au ticket. La remise est donc repartie au prorata sur les
 * categories positives — un bon de reduction porte sur l'ensemble des achats —
 * et le reste d'arrondi est absorbe par la plus grosse, si bien que le total
 * retombe au centime sur celui du ticket.
 *
 * Une premiere version ne reportait la remise que sur la plus grosse categorie :
 * un coupon de 40 € sur 34,20 € de courses et 28,90 € de fournitures rendait un
 * resultat vide, et le parent lisait « le total du ticket est nul ou negatif »
 * pour un ticket de 23,10 €.
 *
 * Renvoie {} seulement si le total du ticket est reellement nul ou negatif.
 */
export function grouperLignes(lignes: LigneTicket[]): Record<string, number> {
  const bruts: Record<string, number> = {};
  lignes.forEach((ligne) => {
    const cat = ligne.categorie || 'autre';
    bruts[cat] = (bruts[cat] || 0) + (Number(ligne.montant) || 0);
  });

  // La cible est le total des lignes arrondi UNE SEULE FOIS. La calculer en
  // additionnant des categories deja arrondies la fausse : un ticket au poids
  // a 3,085 € + 2,015 € (total imprime 5,10 €) donnait 3,09 + 2,02 = 5,11 €.
  // Un centime cree, sur l'ecran de l'argent.
  const cible = centimes(Object.values(bruts).reduce((a, b) => a + b, 0));
  if (cible <= 0) return {};

  const positifs: Record<string, number> = {};
  let sommePositifs = 0;
  Object.entries(bruts).forEach(([cat, total]) => {
    if (total > 0) {
      positifs[cat] = total;
      sommePositifs += total;
    }
  });
  if (sommePositifs <= 0) return {};

  // Les categories negatives (remises, bons, consignes) sont reparties au
  // prorata sur les categories positives : un bon de reduction porte sur
  // l'ensemble des achats, pas sur la plus grosse ligne seule.
  const facteur = cible / sommePositifs;
  const repartis: Record<string, number> = {};
  Object.entries(positifs).forEach(([cat, montant]) => {
    const reduit = centimes(montant * facteur);
    // Une categorie ramenee a 0,00 € n'a plus de sens comme depense : son
    // reliquat est repris par l'ajustement final.
    if (reduit > 0) repartis[cat] = reduit;
  });
  if (Object.keys(repartis).length === 0) return {};

  return ajusterAuTotal(repartis, cible);
}

/**
 * Force la somme des groupes a valoir exactement `cible`, en imputant le reste
 * d'arrondi a la plus grosse categorie. Sans cela, l'arrondi categorie par
 * categorie cree ou detruit jusqu'a un demi-centime par categorie : un ticket de
 * 5,10 € au poids ressortait a 5,11 €.
 */
function ajusterAuTotal(groupes: Record<string, number>, cible: number): Record<string, number> {
  const cles = Object.keys(groupes);
  if (cles.length === 0) return {};
  const plusGros = cles.reduce((a, b) => (groupes[b] > groupes[a] ? b : a), cles[0]);
  const autres = centimes(cles.reduce((s, c) => (c === plusGros ? s : s + groupes[c]), 0));
  const ajuste = centimes(cible - autres);
  if (ajuste <= 0) {
    // Cas extreme : la plus grosse categorie ne peut pas absorber le reste.
    // On la retire et on recommence sur les autres, plutot que d'enregistrer
    // une depense nulle ou negative.
    const reste = { ...groupes };
    delete reste[plusGros];
    return Object.keys(reste).length === 0 ? {} : ajusterAuTotal(reste, cible);
  }
  return { ...groupes, [plusGros]: ajuste };
}

/**
 * Lignes de detail a attacher a une depense issue d'un ticket : ses propres
 * lignes, plus une ligne d'ajustement explicite si la remise repartie fait que
 * leur somme ne vaut pas le montant enregistre.
 *
 * Sans cette ligne, le detail affichait « pates 12,00 € » au-dessus d'un total
 * de 9,00 € : une addition qui ne tombe pas juste, sur l'ecran qui dit a deux
 * parents qui doit combien a qui.
 */
export function lignesDetailPourGroupe(
  lignes: LigneTicket[],
  categorie: string,
  montantEnregistre: number,
  libelleRemise: string
): { libelle: string; montant: number }[] {
  const propres = lignes
    .filter((l) => (l.categorie || 'autre') === categorie)
    .map((l) => ({ libelle: l.libelle, montant: centimes(Number(l.montant) || 0) }));
  const somme = centimes(propres.reduce((s, l) => s + l.montant, 0));
  const ecart = centimes(montantEnregistre - somme);
  if (Math.abs(ecart) < 0.005) return propres;
  return [...propres, { libelle: libelleRemise, montant: ecart }];
}
