// lib/pickerFichierPDF.web.ts
//
// Contrepartie web de pickerFichierPDF.native.ts. Crée un <input
// type="file"> HTML temporaire, déclenché par programme, sans jamais
// importer expo-document-picker (dont le code casse le bundle web — voir
// lib/pickerFichierICS.web.ts pour l'explication complète).
//
// Le fichier choisi est exposé via une Object URL (URL.createObjectURL),
// que le composant appelant peut ensuite lire avec fetch(uri) exactement
// comme une URI native — c'est déjà ce que fait JugementUpload.tsx sur web.

export async function choisirFichierPDF(): Promise<{ uri: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,.pdf';
    input.style.display = 'none';

    input.onchange = () => {
      const fichier = input.files?.[0];
      document.body.removeChild(input);
      if (!fichier) {
        resolve(null);
        return;
      }
      resolve({ uri: URL.createObjectURL(fichier) });
    };

    document.body.appendChild(input);
    input.click();
  });
}