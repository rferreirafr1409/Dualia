// lib/pickerFichierPDF.native.ts
//
// Implémentation mobile (iOS/Android) du sélecteur de fichier PDF, via
// expo-document-picker. Même principe que lib/pickerFichierICS.native.ts —
// voir ce fichier pour l'explication complète de pourquoi la résolution
// par extension (.native.ts / .web.ts) est nécessaire plutôt qu'un simple
// import() dynamique.

import * as DocumentPicker from 'expo-document-picker';

export async function choisirFichierPDF(): Promise<{ uri: string } | null> {
  const resultat = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
  });
  if (resultat.canceled || !resultat.assets?.[0]) return null;
  return { uri: resultat.assets[0].uri };
}