// hooks/useAnticiper.ts
//
// Combine les documents dont la date d'expiration approche (ou est déjà
// dépassée) et les échéances administratives/scolaires à venir (table
// echeances_administratives), pour alimenter le widget "À anticiper" de la
// Home. Recharge à chaque retour sur l'écran (comme useHomeWidgets), pour
// refléter les ajouts faits depuis Documents ou depuis l'écran de gestion
// des échéances.

import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../constants/supabase';
import { useStore } from '../store/useStore';

const FENETRE_JOURS = 90;

export type EcheanceAAnticiper = {
  id: string;
  titre: string;
  dateEcheance: string; // ISO (yyyy-MM-dd)
  type: 'document' | 'demarche';
  enfantId?: string | null;
};

interface UseAnticiperResult {
  echeances: EcheanceAAnticiper[];
  chargement: boolean;
  erreur: string | null;
  recharger: () => Promise<void>;
}

export function useAnticiper(): UseAnticiperResult {
  const familleId = useStore((s) => s.familleId);
  const [echeances, setEcheances] = useState<EcheanceAAnticiper[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!familleId) {
      setChargement(false);
      return;
    }
    setChargement(true);
    setErreur(null);

    const limite = new Date();
    limite.setDate(limite.getDate() + FENETRE_JOURS);
    const limiteIso = limite.toISOString().slice(0, 10);

    const [docsRes, echeancesRes] = await Promise.all([
      supabase
        .from('documents')
        .select('id, nom, date_expiration')
        .eq('famille_id', familleId)
        .not('date_expiration', 'is', null)
        .lte('date_expiration', limiteIso)
        .order('date_expiration', { ascending: true }),
      supabase
        .from('echeances_administratives')
        .select('id, titre, date_echeance, enfant_id')
        .eq('famille_id', familleId)
        .eq('statut', 'a_venir')
        .lte('date_echeance', limiteIso)
        .order('date_echeance', { ascending: true }),
    ]);

    if (docsRes.error || echeancesRes.error) {
      setErreur(docsRes.error?.message ?? echeancesRes.error?.message ?? 'Erreur inconnue');
      setChargement(false);
      return;
    }

    const docs: EcheanceAAnticiper[] = (docsRes.data ?? []).map((d: any) => ({
      id: `document:${d.id}`,
      titre: d.nom,
      dateEcheance: d.date_expiration,
      type: 'document',
    }));

    const demarches: EcheanceAAnticiper[] = (echeancesRes.data ?? []).map((e: any) => ({
      id: `echeance:${e.id}`,
      titre: e.titre,
      dateEcheance: e.date_echeance,
      type: 'demarche',
      enfantId: e.enfant_id,
    }));

    const toutes = [...docs, ...demarches].sort(
      (a, b) => new Date(a.dateEcheance).getTime() - new Date(b.dateEcheance).getTime()
    );

    setEcheances(toutes);
    setChargement(false);
  }, [familleId]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger])
  );

  return { echeances, chargement, erreur, recharger: charger };
}