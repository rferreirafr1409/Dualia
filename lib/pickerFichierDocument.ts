// lib/pickerFichierDocument.ts
//
// Fallback "plat" (sans suffixe de plateforme) — même convention que
// pickerFichierPDF.ts et pickerFichierICS.ts. Sert uniquement à satisfaire la
// vérification TypeScript avant déploiement ; Metro continue d'utiliser
// pickerFichierDocument.native.ts / pickerFichierDocument.web.ts à
// l'exécution.

export { choisirFichierDocument } from './pickerFichierDocument.web';
