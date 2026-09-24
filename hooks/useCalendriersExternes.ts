// hooks/useCalendriersExternes.ts
//
// Gère les abonnements à des calendriers externes (.ics) : ajout via URL ou
// contenu de fichier, synchronisation (re-parse + remplace le cache
// d'événements), suppression, et lecture des événements pour affichage.
// Les événements externes restent une source à part de evenementsCalendrier
// (natif Dualia) — jamais fusionnés en base, seulement à l'affichage, avec
// leur origine (calendrier + couleur) toujours visible.
//
// Récupération des liens .ics : passe par le proxy backend
// (api/fetch-ics.js sur dualia-backend) plutôt qu'un fetch() direct, pour
// contourner les restrictions CORS des fournisseurs (Google, Outlook...)
// qui bloquent sinon la lecture depuis le navigateur.
//
// Si la session n'est pas encore chargée (parentUuid/familleId absents —
// typiquement en arrivant directement sur cet écran par URL, sans passer
// par le flux normal de connexion qui appelle initialiserSession() plus
// haut dans l'arbre), ce hook déclenche lui-même initialiserSession() une
// fois, pour ne pas bloquer l'utilisateur sur "Session non initialisée"
// alors qu'il est bien connecté.

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../constants/supabase';
import { useStore } from '../store/useStore';
import { entetesBackend } from '../lib/appelBackend';
import { parserICS, type EvenementICS } from '../lib/icsParser';

const BACKEND_URL = 'https://dualia-backend.vercel.app';

export interface CalendrierExterne {
  id: string;
  nom: string;
  type: 'url' | 'fichier';
  source: string;
  couleur: string;
  actif: boolean;
  derniereSync: string | null;
}

export interface EvenementExterne {
  id: string;
  calendrierExterneId: string;
  calendrierNom: string;
  calendrierCouleur: string;
  titre: string;
  dateDebut: string;
  dateFin: string | null;
  touteJournee: boolean;
  lieu: string | null;
}

interface UseCalendriersExternesResult {
  calendriers: CalendrierExterne[];
  evenementsExternes: EvenementExterne[];
  chargement: boolean;
  erreur: string | null;
  ajouterParUrl: (nom: string, url: string, couleur: string) => Promise<{ ok: boolean; erreur?: string }>;
  ajouterParFichier: (nom: string, contenuICS: string, couleur: string) => Promise<{ ok: boolean; erreur?: string }>;
  resynchroniser: (calendrierId: string) => Promise<{ ok: boolean; erreur?: string }>;
  toggleActif: (calendrierId: string) => Promise<void>;
  supprimer: (calendrierId: string) => Promise<void>;
}

// Récupère le contenu d'un calendrier .ics distant via le proxy backend,
// pour éviter les blocages CORS des fournisseurs (Google, Outlook...).
async function recupererICSDistant(url: string): Promise<{ ok: true; contenu: string } | { ok: false; erreur: string }> {
  try {
    const reponse = await fetch(`${BACKEND_URL}/api/fetch-ics?url=${encodeURIComponent(url)}`, {
      headers: await entetesBackend(),
    });
    if (!reponse.ok) {
      const corps = await reponse.json().catch(() => null);
      return { ok: false, erreur: corps?.error ?? `Le serveur a répondu avec le statut ${reponse.status}` };
    }
    const contenu = await reponse.text();
    return { ok: true, contenu };
  } catch (e: any) {
    return { ok: false, erreur: "Impossible de contacter le serveur pour récupérer ce calendrier." };
  }
}

export function useCalendriersExternes(): UseCalendriersExternesResult {
  const parentActif = useStore((s) => s.parentActif);
  const parents = useStore((s) => s.parents);
  const familleId = useStore((s) => s.familleId);
  const initialiserSession = useStore((s) => s.initialiserSession);
  const parentUuid = parents[parentActif]?.uuid;

  const [calendriers, setCalendriers] = useState<CalendrierExterne[]>([]);
  const [evenementsExternes, setEvenementsExternes] = useState<EvenementExterne[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  // Ne tente initialiserSession() qu'une seule fois, pour éviter une boucle
  // si la session échoue réellement à se charger (ex. utilisateur non connecté).
  const tentativeSessionFaite = useRef(false);

  const assurerSession = useCallback(async (): Promise<{ parentUuid?: string; familleId?: string }> => {
    const etat = useStore.getState();
    const uuidActuel = etat.parents[etat.parentActif]?.uuid;
    if (uuidActuel && etat.familleId) {
      return { parentUuid: uuidActuel, familleId: etat.familleId ?? undefined };
    }
    if (!tentativeSessionFaite.current) {
      tentativeSessionFaite.current = true;
      try {
        await initialiserSession();
      } catch {
        // Si la session ne peut pas s'initialiser (ex. utilisateur non
        // connecté), on laisse l'appelant gérer l'absence de session.
      }
    }
    const etatApres = useStore.getState();
    return {
      parentUuid: etatApres.parents[etatApres.parentActif]?.uuid,
      familleId: etatApres.familleId ?? undefined,
    };
  }, [initialiserSession]);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);

    const session = await assurerSession();
    if (!session.parentUuid || !session.familleId) {
      setChargement(false);
      return;
    }

    const { data: calendriersData, error: erreurCalendriers } = await supabase
      .from('calendriers_externes')
      .select('id, nom, type, source, couleur, actif, derniere_sync')
      .eq('parent_id', session.parentUuid)
      .eq('famille_id', session.familleId)
      .order('created_at', { ascending: true });

    if (erreurCalendriers) {
      setErreur(erreurCalendriers.message);
      setChargement(false);
      return;
    }

    const calendriersFormates: CalendrierExterne[] = (calendriersData ?? []).map((c) => ({
      id: c.id,
      nom: c.nom,
      type: c.type,
      source: c.source,
      couleur: c.couleur,
      actif: c.actif,
      derniereSync: c.derniere_sync,
    }));
    setCalendriers(calendriersFormates);

    const { data: evenementsData, error: erreurEvenements } = await supabase
      .from('evenements_externes')
      .select('id, calendrier_externe_id, titre, date_debut, date_fin, toute_journee, lieu')
      .eq('parent_id', session.parentUuid)
      .eq('famille_id', session.familleId)
      .order('date_debut', { ascending: true });

    if (erreurEvenements) {
      setErreur(erreurEvenements.message);
      setChargement(false);
      return;
    }

    const parCalendrierId = new Map(calendriersFormates.map((c) => [c.id, c]));
    const evenementsFormates: EvenementExterne[] = (evenementsData ?? [])
      .filter((e) => parCalendrierId.get(e.calendrier_externe_id)?.actif)
      .map((e) => {
        const cal = parCalendrierId.get(e.calendrier_externe_id)!;
        return {
          id: e.id,
          calendrierExterneId: e.calendrier_externe_id,
          calendrierNom: cal.nom,
          calendrierCouleur: cal.couleur,
          titre: e.titre,
          dateDebut: e.date_debut,
          dateFin: e.date_fin,
          touteJournee: e.toute_journee,
          lieu: e.lieu,
        };
      });
    setEvenementsExternes(evenementsFormates);
    setChargement(false);
  }, [assurerSession]);

  useEffect(() => {
    charger();
  }, [charger]);

  const remplacerEvenements = useCallback(
    async (calendrierId: string, contenuICS: string, parentUuidCourant: string, familleIdCourant: string): Promise<{ ok: boolean; erreur?: string }> => {
      let evenementsParsés: EvenementICS[];
      try {
        evenementsParsés = parserICS(contenuICS);
      } catch (e: any) {
        return { ok: false, erreur: `Fichier .ics illisible : ${e.message ?? e}` };
      }

      const { error: erreurSuppression } = await supabase
        .from('evenements_externes')
        .delete()
        .eq('calendrier_externe_id', calendrierId);
      if (erreurSuppression) return { ok: false, erreur: erreurSuppression.message };

      if (evenementsParsés.length > 0) {
        const lignes = evenementsParsés.map((e) => ({
          calendrier_externe_id: calendrierId,
          parent_id: parentUuidCourant,
          famille_id: familleIdCourant,
          uid_ics: e.uid,
          titre: e.titre,
          date_debut: e.dateDebut,
          date_fin: e.dateFin,
          toute_journee: e.touteJournee,
          lieu: e.lieu,
        }));
        const { error: erreurInsertion } = await supabase.from('evenements_externes').insert(lignes);
        if (erreurInsertion) return { ok: false, erreur: erreurInsertion.message };
      }

      await supabase
        .from('calendriers_externes')
        .update({ derniere_sync: new Date().toISOString() })
        .eq('id', calendrierId);

      return { ok: true };
    },
    []
  );

  const ajouterParUrl = useCallback(
    async (nom: string, url: string, couleur: string): Promise<{ ok: boolean; erreur?: string }> => {
      const session = await assurerSession();
      if (!session.parentUuid || !session.familleId) {
        return { ok: false, erreur: 'Tu dois être connecté pour ajouter un calendrier.' };
      }

      const recuperation = await recupererICSDistant(url);
      if (!recuperation.ok) return { ok: false, erreur: recuperation.erreur };

      const { data: nouveauCalendrier, error: erreurCreation } = await supabase
        .from('calendriers_externes')
        .insert({ parent_id: session.parentUuid, famille_id: session.familleId, nom, type: 'url', source: url, couleur })
        .select('id')
        .single();
      if (erreurCreation || !nouveauCalendrier) return { ok: false, erreur: erreurCreation?.message ?? 'Erreur inconnue' };

      const resultat = await remplacerEvenements(nouveauCalendrier.id, recuperation.contenu, session.parentUuid, session.familleId);
      await charger();
      return resultat;
    },
    [assurerSession, remplacerEvenements, charger]
  );

  const ajouterParFichier = useCallback(
    async (nom: string, contenuICS: string, couleur: string): Promise<{ ok: boolean; erreur?: string }> => {
      const session = await assurerSession();
      if (!session.parentUuid || !session.familleId) {
        return { ok: false, erreur: 'Tu dois être connecté pour ajouter un calendrier.' };
      }

      const { data: nouveauCalendrier, error: erreurCreation } = await supabase
        .from('calendriers_externes')
        .insert({ parent_id: session.parentUuid, famille_id: session.familleId, nom, type: 'fichier', source: contenuICS, couleur })
        .select('id')
        .single();
      if (erreurCreation || !nouveauCalendrier) return { ok: false, erreur: erreurCreation?.message ?? 'Erreur inconnue' };

      const resultat = await remplacerEvenements(nouveauCalendrier.id, contenuICS, session.parentUuid, session.familleId);
      await charger();
      return resultat;
    },
    [assurerSession, remplacerEvenements, charger]
  );

  const resynchroniser = useCallback(
    async (calendrierId: string): Promise<{ ok: boolean; erreur?: string }> => {
      const session = await assurerSession();
      if (!session.parentUuid || !session.familleId) {
        return { ok: false, erreur: 'Tu dois être connecté pour synchroniser.' };
      }

      const calendrier = calendriers.find((c) => c.id === calendrierId);
      if (!calendrier) return { ok: false, erreur: 'Calendrier introuvable' };

      let contenuICS: string;
      if (calendrier.type === 'url') {
        const recuperation = await recupererICSDistant(calendrier.source);
        if (!recuperation.ok) return { ok: false, erreur: recuperation.erreur };
        contenuICS = recuperation.contenu;
      } else {
        // Un calendrier importé par fichier est un instantané figé : la
        // "resynchronisation" relit simplement le contenu déjà stocké.
        contenuICS = calendrier.source;
      }

      const resultat = await remplacerEvenements(calendrierId, contenuICS, session.parentUuid, session.familleId);
      await charger();
      return resultat;
    },
    [calendriers, assurerSession, remplacerEvenements, charger]
  );

  const toggleActif = useCallback(
    async (calendrierId: string) => {
      const calendrier = calendriers.find((c) => c.id === calendrierId);
      if (!calendrier) return;
      await supabase.from('calendriers_externes').update({ actif: !calendrier.actif }).eq('id', calendrierId);
      await charger();
    },
    [calendriers, charger]
  );

  const supprimer = useCallback(
    async (calendrierId: string) => {
      await supabase.from('calendriers_externes').delete().eq('id', calendrierId);
      await charger();
    },
    [charger]
  );

  return {
    calendriers,
    evenementsExternes,
    chargement,
    erreur,
    ajouterParUrl,
    ajouterParFichier,
    resynchroniser,
    toggleActif,
    supprimer,
  };
}