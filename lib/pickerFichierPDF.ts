    // lib/pickerFichierPDF.ts
    //
    // Fallback "plat" (sans suffixe de plateforme) — voir le commentaire dans
    // lib/pickerFichierICS.ts pour l'explication complète. Sert uniquement à
    // satisfaire la vérification TypeScript avant déploiement ; Metro continue
    // d'utiliser pickerFichierPDF.native.ts / pickerFichierPDF.web.ts à
    // l'exécution.

    export { choisirFichierPDF } from './pickerFichierPDF.web';