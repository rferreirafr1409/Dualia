// lib/typesFichier.ts
//
// Source unique des formats acceptés en pièce jointe, partagée par les
// sélecteurs (web et natif), l'écran Documents, Finances et la messagerie.
// Une liste écrite à trois endroits finit toujours par diverger : un format
// accepté par le sélecteur mais refusé à l'envoi, et l'utilisateur ne
// comprend pas pourquoi.

export type FichierChoisi = {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
};

// Poids maximum d'une pièce jointe, avant encodage. Le base64 gonfle le
// fichier d'environ un tiers ; la marge est prise dans TAILLE_MAX_BASE64.
export const TAILLE_MAX_FICHIER = 10 * 1024 * 1024;
export const TAILLE_MAX_BASE64 = 14 * 1024 * 1024;

// Extension -> type MIME. Sert aussi bien à deviner le type d'un fichier que
// le sélecteur n'a pas su qualifier (fréquent sur Android) qu'à reconstruire
// l'extension de stockage côté Supabase.
export const MIME_PAR_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  csv: 'text/csv',
};

// HEIC est volontairement absent : le format par défaut de l'iPhone n'est
// lisible ni par Windows ni par la plupart des navigateurs. L'accepter
// reviendrait à laisser un parent déposer une pièce que l'autre ne pourra
// pas ouvrir — et à le découvrir le jour où elle compte.
export const TYPES_ACCEPTES: string[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

// Attribut accept d'un <input type="file"> : on ajoute les extensions, car
// Windows ne renseigne pas toujours le type MIME des fichiers Office.
export const ACCEPT_WEB = [
  ...TYPES_ACCEPTES,
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.txt',
  '.csv',
].join(',');

export const extensionDe = (nomFichier: string): string => {
  const morceaux = (nomFichier || '').split('.');
  return morceaux.length > 1 ? morceaux[morceaux.length - 1].toLowerCase() : '';
};

export const normaliserType = (mimeType: string | null | undefined, nomFichier: string): string => {
  const brut = (mimeType || '').toLowerCase().split(';')[0].trim();
  if (brut && brut !== 'application/octet-stream') return brut;
  return MIME_PAR_EXTENSION[extensionDe(nomFichier)] ?? '';
};

export const estHeic = (mimeType: string, nomFichier: string): boolean => {
  const type = (mimeType || '').toLowerCase();
  return type.includes('heic') || type.includes('heif') || /\.hei[cf]$/i.test(nomFichier || '');
};

export const estUneImage = (mimeType: string): boolean => (mimeType || '').startsWith('image/');

// Ramene le type d'une image au format sous lequel elle sera reellement
// stockee. Sans ce passage, un WebP choisi dans la galerie repartait etiquete
// image/jpeg, donc range en .jpg avec des octets WebP : le fichier telecharge
// ne s'ouvrait dans aucune visionneuse.
export const typeImageStocke = (mimeType: string | null | undefined): string => {
  const brut = (mimeType || '').toLowerCase().split(';')[0].trim();
  if (brut === 'image/png') return 'image/png';
  if (brut === 'image/webp') return 'image/webp';
  return 'image/jpeg';
};

// Lève une erreur porteuse d'un code, que l'écran traduit dans la langue du
// parent. Renvoyer un message déjà rédigé ici obligerait la bibliothèque à
// connaître la langue courante.
export const verifierFichier = (fichier: FichierChoisi): FichierChoisi => {
  const mimeType = normaliserType(fichier.mimeType, fichier.name);
  if (estHeic(mimeType, fichier.name)) throw new Error('fichier_heic');
  if (!TYPES_ACCEPTES.includes(mimeType)) throw new Error('type_non_supporte');
  if (typeof fichier.size === 'number' && fichier.size > TAILLE_MAX_FICHIER) {
    throw new Error('fichier_trop_volumineux');
  }
  return { ...fichier, mimeType };
};
