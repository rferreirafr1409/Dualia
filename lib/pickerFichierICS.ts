// lib/pickerFichierICS.ts
//
// Fallback "plat" (sans suffixe de plateforme), nécessaire uniquement pour
// que TypeScript (tsc, utilisé lors de la vérification avant déploiement)
// résolve le module `../lib/pickerFichierICS` — il ne comprend pas
// nativement la convention .native.ts/.web.ts que Metro utilise à
// l'exécution. Metro continue de préférer pickerFichierICS.native.ts sur
// mobile et pickerFichierICS.web.ts sur web ; ce fichier ne sert donc
// jamais réellement à l'exécution, seulement à la vérification statique.

export { choisirFichierICS } from './pickerFichierICS.web';