// lib/tuilesTicket.ts
//
// Decoupe une photo de ticket de caisse en morceaux lisibles avant l'envoi au
// scan (DUA-142).
//
// POURQUOI
//
// Un ticket de supermarche est une bande de papier de 7 cm de large sur 50 de
// long, photographiee sur un fond sombre. Sur la photo, le ticket occupe un
// quart de la largeur ; une fois l'image ramenee a 1600 px de haut, les
// caracteres font 5 px. Le modele lisait « 133,00 » pour « 133,08 », perdait
// ou inventait des lignes, et deux lectures ne faisaient jamais les memes
// erreurs. Ce n'etait pas un probleme de prompt : il n'y avait rien a lire.
//
// COMMENT
//
// 1. On repere la zone claire (le papier) sur une version reduite de la
//    photo : les colonnes puis les lignes de pixels majoritairement clairs.
//    Si rien ne se detache (fond blanc, ticket plein cadre), on garde tout.
// 2. On decoupe cette zone en morceaux de haut en bas, chacun au plus 2,2 fois
//    plus haut que large, avec un leger chevauchement pour ne couper aucune
//    ligne. Chaque morceau part a pleine resolution : le texte redevient
//    lisible.
//
// Les fonctions de detection sont pures (un tableau de luminances), pour
// etre testables sans navigateur. Seule `decouperTicket` touche au canvas.

export interface Zone {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}

export interface Tuile {
  base64: string;
  mediaType: 'image/jpeg';
}

/** Luminance a partir de laquelle un pixel est « papier ». */
export const SEUIL_PAPIER = 165;
/** Part de pixels clairs pour qu'une colonne ou une ligne soit « papier ». */
const PART_COLONNE = 0.45;
const PART_LIGNE = 0.45;
/** Trous toleres (en pixels de l'image reduite) dans une bande de papier. */
const TROU_MAX = 3;
/** Rapport hauteur/largeur maximal d'un morceau envoye au modele. */
export const RAPPORT_MAX = 2.2;
/** Chevauchement entre deux morceaux, en part de la hauteur du morceau. */
const CHEVAUCHEMENT = 0.06;
/** Largeur de l'image reduite servant a la detection. */
const LARGEUR_ANALYSE = 200;
/** Cote maximal d'un morceau envoye. */
const COTE_MAX_TUILE = 1600;
const QUALITE_TUILE = 0.82;

/** La plus longue serie d'indices « vrais », en tolerant de petits trous. */
export function plusLongueSerie(valeurs: boolean[], trouMax = TROU_MAX): [number, number] | null {
  let meilleur: [number, number] | null = null;
  let debut = -1;
  let dernierVrai = -1;
  for (let i = 0; i <= valeurs.length; i++) {
    const vrai = i < valeurs.length && valeurs[i];
    if (vrai) {
      if (debut === -1) debut = i;
      dernierVrai = i;
    } else if (debut !== -1 && (i - dernierVrai > trouMax || i === valeurs.length)) {
      if (!meilleur || dernierVrai - debut > meilleur[1] - meilleur[0]) meilleur = [debut, dernierVrai];
      debut = -1;
    }
  }
  return meilleur;
}

/**
 * La zone claire d'une image, a partir de ses luminances (0-255, ligne par
 * ligne). Rend null quand rien ne se detache : zone trop etroite, ou qui
 * couvre presque toute l'image.
 */
export function detecterZonePapier(lum: ArrayLike<number>, largeur: number, hauteur: number): Zone | null {
  const colonnes: boolean[] = [];
  for (let x = 0; x < largeur; x++) {
    let clairs = 0;
    for (let y = 0; y < hauteur; y++) if (lum[y * largeur + x] >= SEUIL_PAPIER) clairs++;
    colonnes.push(clairs / hauteur >= PART_COLONNE);
  }
  const bandeX = plusLongueSerie(colonnes);
  if (!bandeX) return null;
  const [x0, x1] = bandeX;
  const largeurBande = x1 - x0 + 1;

  // Les lignes se jugent DANS la bande de colonnes : sur un ticket etroit,
  // une ligne entiere n'est claire qu'a 25 %.
  const lignes: boolean[] = [];
  for (let y = 0; y < hauteur; y++) {
    let clairs = 0;
    for (let x = x0; x <= x1; x++) if (lum[y * largeur + x] >= SEUIL_PAPIER) clairs++;
    lignes.push(clairs / largeurBande >= PART_LIGNE);
  }
  const bandeY = plusLongueSerie(lignes);
  if (!bandeY) return null;
  const [y0, y1] = bandeY;
  const hauteurBande = y1 - y0 + 1;

  if (largeurBande < largeur * 0.08 || hauteurBande < hauteur * 0.08) return null;
  if (largeurBande > largeur * 0.9 && hauteurBande > hauteur * 0.9) return null;

  return { x: x0, y: y0, largeur: largeurBande, hauteur: hauteurBande };
}

/** Decoupe verticale d'une zone en morceaux d'au plus RAPPORT_MAX, avec chevauchement. */
export function decouperEnBandes(zone: Zone): Zone[] {
  const hauteurMax = zone.largeur * RAPPORT_MAX;
  if (zone.hauteur <= hauteurMax) return [zone];
  const n = Math.ceil(zone.hauteur / hauteurMax);
  const pas = zone.hauteur / n;
  const marge = pas * CHEVAUCHEMENT;
  const bandes: Zone[] = [];
  for (let i = 0; i < n; i++) {
    const y0 = Math.max(zone.y, Math.round(zone.y + i * pas - marge));
    const y1 = Math.min(zone.y + zone.hauteur, Math.round(zone.y + (i + 1) * pas + marge));
    bandes.push({ x: zone.x, y: y0, largeur: zone.largeur, hauteur: y1 - y0 });
  }
  return bandes;
}

/** Zone agrandie d'une marge relative, bornee a l'image. */
export function avecMarge(zone: Zone, largeur: number, hauteur: number, part = 0.02): Zone {
  const mx = Math.round(zone.largeur * part);
  const my = Math.round(zone.hauteur * part);
  const x = Math.max(0, zone.x - mx);
  const y = Math.max(0, zone.y - my);
  return {
    x,
    y,
    largeur: Math.min(largeur - x, zone.largeur + 2 * mx),
    hauteur: Math.min(hauteur - y, zone.hauteur + 2 * my),
  };
}

function chargerImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image_load_failed'));
    img.src = dataUrl;
  });
}

/**
 * Les morceaux a envoyer au scan pour une photo (data URL), de haut en bas.
 * Web uniquement (canvas). En cas d'echec de l'analyse, rend un seul morceau :
 * la photo entiere, ramenee a COTE_MAX_TUILE.
 */
export async function decouperTicket(dataUrl: string): Promise<Tuile[]> {
  const img = await chargerImage(dataUrl);
  const { width: W, height: H } = img;

  const rendre = (zone: Zone): Tuile => {
    const echelle = Math.min(1, COTE_MAX_TUILE / Math.max(zone.largeur, zone.hauteur));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(zone.largeur * echelle));
    canvas.height = Math.max(1, Math.round(zone.hauteur * echelle));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas_unavailable');
    ctx.drawImage(img, zone.x, zone.y, zone.largeur, zone.hauteur, 0, 0, canvas.width, canvas.height);
    return { base64: canvas.toDataURL('image/jpeg', QUALITE_TUILE).split(',')[1], mediaType: 'image/jpeg' };
  };

  let zone: Zone = { x: 0, y: 0, largeur: W, hauteur: H };
  try {
    const la = LARGEUR_ANALYSE;
    const ha = Math.max(1, Math.round((H * la) / W));
    const petit = document.createElement('canvas');
    petit.width = la;
    petit.height = ha;
    const ctx = petit.getContext('2d');
    if (!ctx) throw new Error('canvas_unavailable');
    ctx.drawImage(img, 0, 0, la, ha);
    const px = ctx.getImageData(0, 0, la, ha).data;
    const lum = new Uint8ClampedArray(la * ha);
    for (let i = 0; i < lum.length; i++) {
      lum[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
    }
    const trouvee = detecterZonePapier(lum, la, ha);
    if (trouvee) {
      const r = W / la;
      zone = avecMarge(
        { x: trouvee.x * r, y: trouvee.y * r, largeur: trouvee.largeur * r, hauteur: trouvee.hauteur * r },
        W,
        H
      );
      zone = { x: Math.round(zone.x), y: Math.round(zone.y), largeur: Math.round(zone.largeur), hauteur: Math.round(zone.hauteur) };
    }
  } catch (e) {
    console.error('[Dualia] Detection du ticket impossible, photo entiere envoyee :', e);
  }

  return decouperEnBandes(zone).map(rendre);
}
