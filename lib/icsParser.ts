// lib/icsParser.ts
//
// Parser .ics minimal, sans dépendance externe. Le format iCalendar (RFC
// 5545) est en réalité assez simple pour le cas d'usage courant (calendrier
// d'école, de club) : on extrait les blocs VEVENT et leurs champs DTSTART /
// DTEND / SUMMARY / UID / LOCATION.
//
// Limites assumées pour ce v1 :
// - Pas de gestion des règles de récurrence (RRULE) : seuls les événements
//   explicites du fichier sont importés. Pour un calendrier scolaire ou de
//   club, la plupart des outils exportent déjà chaque occurrence.
// - Pas de gestion des fuseaux horaires custom (VTIMEZONE) : on utilise
//   l'heure telle que fournie, ou UTC si le suffixe Z est présent.
// Si ça s'avère insuffisant en pratique, on basculera sur une vraie
// librairie (ical.js) — poser le v1 simple permet de livrer vite et de
// voir si ces limites posent réellement problème.

export interface EvenementICS {
  uid: string;
  titre: string;
  dateDebut: string; // ISO 8601
  dateFin: string | null; // ISO 8601
  touteJournee: boolean;
  lieu: string | null;
}

// Déplie les lignes repliées selon la RFC (une ligne continuée commence par
// un espace ou une tabulation) avant de découper en lignes logiques.
function deplierLignes(texteBrut: string): string[] {
  const lignesBrutes = texteBrut.split(/\r\n|\n|\r/);
  const lignes: string[] = [];
  for (const ligne of lignesBrutes) {
    if ((ligne.startsWith(' ') || ligne.startsWith('\t')) && lignes.length > 0) {
      lignes[lignes.length - 1] += ligne.slice(1);
    } else {
      lignes.push(ligne);
    }
  }
  return lignes;
}

// Convertit une valeur DTSTART/DTEND au format iCalendar (ex. "20260917T140000Z"
// ou "20260917" pour un événement journée entière) en ISO 8601.
function parserDate(valeurBrute: string, params: string): { iso: string; touteJournee: boolean } {
  const estToutJour = params.includes('VALUE=DATE') || /^\d{8}$/.test(valeurBrute);

  if (estToutJour) {
    const annee = valeurBrute.slice(0, 4);
    const mois = valeurBrute.slice(4, 6);
    const jour = valeurBrute.slice(6, 8);
    return { iso: `${annee}-${mois}-${jour}T00:00:00.000Z`, touteJournee: true };
  }

  // Format "20260917T140000Z" ou "20260917T140000" (heure locale, traitée comme UTC en v1)
  const correspondance = valeurBrute.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!correspondance) {
    return { iso: new Date().toISOString(), touteJournee: false };
  }
  const [, annee, mois, jour, heure, minute, seconde] = correspondance;
  return {
    iso: `${annee}-${mois}-${jour}T${heure}:${minute}:${seconde}.000Z`,
    touteJournee: false,
  };
}

export function parserICS(contenuICS: string): EvenementICS[] {
  const lignes = deplierLignes(contenuICS);
  const evenements: EvenementICS[] = [];

  let blocEnCours: Record<string, { valeur: string; params: string }> | null = null;

  for (const ligne of lignes) {
    if (ligne.trim() === 'BEGIN:VEVENT') {
      blocEnCours = {};
      continue;
    }
    if (ligne.trim() === 'END:VEVENT') {
      if (blocEnCours) {
        const uid = blocEnCours['UID']?.valeur ?? `sans-uid-${evenements.length}`;
        const titre = blocEnCours['SUMMARY']?.valeur ?? '(Sans titre)';
        const dtstart = blocEnCours['DTSTART'];
        const dtend = blocEnCours['DTEND'];
        const lieu = blocEnCours['LOCATION']?.valeur ?? null;

        if (dtstart) {
          const debut = parserDate(dtstart.valeur, dtstart.params);
          const fin = dtend ? parserDate(dtend.valeur, dtend.params) : null;
          evenements.push({
            uid,
            titre,
            dateDebut: debut.iso,
            dateFin: fin ? fin.iso : null,
            touteJournee: debut.touteJournee,
            lieu,
          });
        }
      }
      blocEnCours = null;
      continue;
    }
    if (!blocEnCours) continue;

    // Une ligne de propriété ressemble à "DTSTART;VALUE=DATE:20260917"
    // ou "SUMMARY:Cours de natation". On sépare la clé (avec ses
    // paramètres) de la valeur au premier ':' non échappé.
    const indexDeuxPoints = ligne.indexOf(':');
    if (indexDeuxPoints === -1) continue;
    const clePartie = ligne.slice(0, indexDeuxPoints);
    const valeur = ligne.slice(indexDeuxPoints + 1).replace(/\\,/g, ',').replace(/\\n/gi, ' ');
    const [cleNom, ...params] = clePartie.split(';');

    blocEnCours[cleNom.toUpperCase()] = { valeur, params: params.join(';') };
  }

  return evenements;
}