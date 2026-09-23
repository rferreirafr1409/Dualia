// lib/pickerFichierDocument.web.ts
//
// Sélecteur de pièce jointe du web. Distinct de pickerFichierPDF, qui reste
// volontairement limité au PDF : il sert à l'import du jugement, dont
// l'analyse attend un PDF et rien d'autre.

import { ACCEPT_WEB, FichierChoisi, verifierFichier } from './typesFichier';

export async function choisirFichierDocument(): Promise<FichierChoisi | null> {
  if (typeof document === 'undefined') return null;

  const fichier = await new Promise<File | null>((resolve) => {
    let resolu = false;
    const terminer = (valeur: File | null) => {
      if (resolu) return;
      resolu = true;
      window.removeEventListener('focus', surRetourFocus);
      input.remove();
      resolve(valeur);
    };

    // Annulation : le navigateur ne déclenche pas toujours 'cancel' (Safari
    // ancien, certains gestionnaires de fichiers). Sans ce filet, la promesse
    // ne se résout jamais et le formulaire reste bloqué sur son indicateur
    // de chargement.
    //
    // Le délai est volontairement large : un fichier pris sur iCloud, OneDrive
    // ou un lecteur réseau met parfois plus d'une seconde à être remis au
    // navigateur. Trop court, ce filet conclurait à une annulation et le
    // bouton ne ferait rien, sans message. On vérifie deux fois.
    const surRetourFocus = () => {
      const verifier = (dernierEssai: boolean) => {
        if (input.files && input.files.length > 0) return;
        if (dernierEssai) terminer(null);
        else setTimeout(() => verifier(true), 1500);
      };
      setTimeout(() => verifier(false), 1500);
    };

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = ACCEPT_WEB;
    input.multiple = false;
    input.style.display = 'none';
    input.onchange = () => terminer(input.files?.[0] ?? null);
    input.oncancel = () => terminer(null);

    document.body.appendChild(input);
    window.addEventListener('focus', surRetourFocus);
    input.click();
  });

  if (!fichier) return null;

  const uri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('fichier_illisible'));
    reader.readAsDataURL(fichier);
  });

  return verifierFichier({
    uri,
    name: fichier.name || 'document',
    mimeType: fichier.type || '',
    size: fichier.size,
  });
}
