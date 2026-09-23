// lib/pickerFichierICS.native.ts
//
// Implémentation mobile (iOS/Android) du sélecteur de fichier .ics, via
// expo-document-picker. Grâce à l'extension .native.ts, Metro ne résout ce
// fichier QUE pour les builds natifs — jamais pour le bundle web, où
// pickerFichierICS.web.ts (sans aucune dépendance à expo-document-picker)
// est utilisé à la place. C'est cette résolution par extension, faite au
// moment du build, qui évite le crash "import.meta" que provoque
// expo-document-picker dès qu'il est ne serait-ce que chargé côté web —
// un simple import() dynamique ne suffit pas, Metro l'inclut quand même
// dans le bundle web par analyse statique.

import * as DocumentPicker from 'expo-document-picker';

export async function choisirFichierICS(): Promise<{ uri: string } | null> {
  const resultat = await DocumentPicker.getDocumentAsync({
    type: ['text/calendar', '*/*'],
    copyToCacheDirectory: true,
  });
  if (resultat.canceled || !resultat.assets?.[0]) return null;
  return { uri: resultat.assets[0].uri };
}