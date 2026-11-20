// lib/tuilesTicketMobile.ts
//
// Prepare la photo d'un ticket pour le scan sur l'application mobile (DUA-153).
//
// POURQUOI
//
// Sur iPhone, la photo partait telle quelle : 12 a 48 mpx, plusieurs Mo en
// base64. Au-dela de 4,5 Mo, Vercel refuse la requete avant meme d'appeler le
// serveur (413), et au-dela de 5 Mo l'API d'analyse refuse l'image : le parent
// ne voyait que « scan impossible », photo prise ou importee. Une image de
// plus de 1600 px ne sert de toute facon a rien : le modele la reduit.
//
// COMMENT
//
// Comme sur le web (lib/tuilesTicket.ts, DUA-142), la photo est decoupee de
// haut en bas en morceaux d'au plus 2,2 fois plus hauts que larges, avec un
// leger chevauchement, et chaque morceau est ramene a 1600 px au plus et
// recompresse en JPEG. Une photo ordinaire donne un seul morceau ; un long
// ticket photographie en entier en donne plusieurs, envoyes ensemble.
//
// La detection de la zone claire du web n'est pas reprise : elle lit les
// pixels, ce que le mobile ne permet pas sans module supplementaire.
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { decouperEnBandes, Tuile, Zone } from './tuilesTicket';

const COTE_MAX = 1600;
const QUALITE = 0.82;
/** Largeur de travail : assez pour lire un ticket, assez petit pour la memoire. */
const LARGEUR_TRAVAIL = 2000;
/** Au-dela, le serveur ne garde que les 8 premiers morceaux. */
const MORCEAUX_MAX = 8;

function dimensionsReduites(largeur: number, hauteur: number, coteMax: number) {
  const plusGrand = Math.max(largeur, hauteur);
  if (plusGrand <= coteMax) return null;
  const r = coteMax / plusGrand;
  return { width: Math.max(1, Math.round(largeur * r)), height: Math.max(1, Math.round(hauteur * r)) };
}

/**
 * Les morceaux de la photo `uri`, en JPEG base64, prets pour /api/scan-ticket.
 */
export async function preparerTicketMobile(uri: string): Promise<Tuile[]> {
  // 1. Une premiere passe donne les vraies dimensions (orientation appliquee)
  //    et ramene la largeur a LARGEUR_TRAVAIL au plus.
  let base = await manipulateAsync(uri, [], { format: SaveFormat.JPEG, compress: 0.95 });
  if (base.width > LARGEUR_TRAVAIL) {
    base = await manipulateAsync(base.uri, [{ resize: { width: LARGEUR_TRAVAIL } }], {
      format: SaveFormat.JPEG,
      compress: 0.95,
    });
  }

  // 2. Decoupe verticale, puis chaque morceau reduit et compresse.
  const zone: Zone = { x: 0, y: 0, largeur: base.width, hauteur: base.height };
  const bandes = decouperEnBandes(zone).slice(0, MORCEAUX_MAX);
  const tuiles: Tuile[] = [];
  for (const b of bandes) {
    const actions: any[] = [];
    if (bandes.length > 1) {
      actions.push({ crop: { originX: b.x, originY: b.y, width: b.largeur, height: b.hauteur } });
    }
    const reduite = dimensionsReduites(b.largeur, b.hauteur, COTE_MAX);
    if (reduite) actions.push({ resize: reduite });
    const r = await manipulateAsync(base.uri, actions, { format: SaveFormat.JPEG, compress: QUALITE, base64: true });
    if (r.base64) tuiles.push({ base64: r.base64, mediaType: 'image/jpeg' });
  }
  if (tuiles.length === 0) throw new Error('preparation_impossible');
  return tuiles;
}
