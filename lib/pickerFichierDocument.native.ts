// lib/pickerFichierDocument.native.ts
//
// Sélecteur de pièce jointe sur iOS et Android. On ouvre volontairement sur
// tous les types : passer une longue liste de types MIME à getDocumentAsync
// fait disparaître des fichiers pourtant valides du sélecteur iOS (les types
// Office sont convertis en UTI de façon inégale selon les versions). Mieux
// vaut laisser le parent voir tous ses fichiers, puis refuser clairement un
// format non supporté, que de lui présenter un dossier qui semble vide.

import * as DocumentPicker from 'expo-document-picker';
import { FichierChoisi, verifierFichier } from './typesFichier';

export async function choisirFichierDocument(): Promise<FichierChoisi | null> {
  const resultat = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    multiple: false,
    copyToCacheDirectory: true,
  });

  if (resultat.canceled) return null;
  const asset = resultat.assets?.[0];
  if (!asset) return null;

  return verifierFichier({
    uri: asset.uri,
    name: asset.name || 'document',
    mimeType: asset.mimeType || '',
    size: typeof asset.size === 'number' ? asset.size : undefined,
  });
}
