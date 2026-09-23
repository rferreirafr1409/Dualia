// lib/pickerFichierICS.web.ts
//
// Contrepartie web de pickerFichierICS.native.ts — voir ce fichier pour
// l'explication complète. Sur web, la sélection de fichier passe par un
// <input type="file"> HTML géré directement dans calendriers-externes.tsx
// (déclenché via une ref), donc cette fonction n'est jamais réellement
// appelée sur web. Elle existe uniquement pour que l'import
// `from '../lib/pickerFichierICS'` (sans extension) reste valide sur les
// deux plateformes — c'est le fait que ce fichier n'importe JAMAIS
// expo-document-picker qui garantit que le bundle web reste sain.

export async function choisirFichierICS(): Promise<{ uri: string } | null> {
  return null;
}