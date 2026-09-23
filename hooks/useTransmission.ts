// hooks/useTransmission.ts
//
// Calcule le prochain passage (date + parent en charge) à partir du planning
// de garde déjà chargé dans le store (`evenements`, alimenté depuis
// evenements_garde — même logique que le "prochain échange" affiché en tête
// de Home), et gère la checklist de transmission pour ce passage précis :
// items par défaut (constants/transmissionCatalog.ts) + items personnalisés
// + désactivations, avec leur état coché propre à la date du passage
// (table transmission_checks — une checklist "fraîche" à chaque échange).

import { useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../constants/supabase';
import { useStore } from '../store/useStore';
import { ITEMS_TRANSMISSION_DEFAUT } from '../constants/transmissionCatalog';
import type { ParentRole } from '../types';

function parentDuJour(
  date: Date,
  evs: { dateDebut: string; dateFin: string; parentId: ParentRole }[]
): ParentRole | null {
  for (const ev of evs) {
    const debut = new Date(ev.dateDebut);
    const fin = new Date(ev.dateFin);
    if (date >= debut && date <= fin) return ev.parentId;
  }
  return null;
}

export type ItemChecklist = {
  key: string;
  label: string;
  actif: boolean;
  personnalise: boolean;
  coche: boolean;
};

type LigneConfig = { item_key: string; label: string | null; ordre: number; actif: boolean; est_personnalise: boolean };

interface UseTransmissionResult {
  prochainPassage: { date: Date; role: ParentRole } | null;
  nomProchainParent: string;
  items: ItemChecklist[];
  toutCoche: boolean;
  toggleCoche: (itemKey: string) => Promise<void>;
  chargement: boolean;
}

export function useTransmission(): UseTransmissionResult {
  const familleId = useStore((s) => s.familleId);
  const parents = useStore((s) => s.parents);
  const evenements = useStore((s) => s.evenements);

  const [config, setConfig] = useState<LigneConfig[]>([]);
  const [checksCoches, setChecksCoches] = useState<Set<string>>(new Set());
  const [chargement, setChargement] = useState(true);

  // Premier jour, dans les 30 prochains, où le parent en charge change
  // par rapport à aujourd'hui — identique à la logique du bandeau d'accueil.
  const prochainPassage = useMemo(() => {
    const roleAujourdhui = parentDuJour(new Date(), evenements);
    for (let i = 1; i <= 30; i++) {
      const jour = new Date();
      jour.setDate(jour.getDate() + i);
      jour.setHours(0, 0, 0, 0);
      const role = parentDuJour(jour, evenements);
      if (role && role !== roleAujourdhui) {
        return { date: jour, role };
      }
    }
    return null;
  }, [evenements]);

  const datePassageIso = prochainPassage ? prochainPassage.date.toISOString().slice(0, 10) : null;

  const charger = useCallback(async () => {
    if (!familleId || !datePassageIso) {
      setChargement(false);
      return;
    }
    setChargement(true);

    const [configRes, checksRes] = await Promise.all([
      supabase
        .from('transmission_items_config')
        .select('item_key, label, ordre, actif, est_personnalise')
        .eq('famille_id', familleId)
        .order('ordre', { ascending: true }),
      supabase
        .from('transmission_checks')
        .select('item_key')
        .eq('famille_id', familleId)
        .eq('date_passage', datePassageIso),
    ]);

    setConfig(configRes.data ?? []);
    setChecksCoches(new Set((checksRes.data ?? []).map((c: any) => c.item_key)));
    setChargement(false);
  }, [familleId, datePassageIso]);

  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger])
  );

  // Fusionne le catalogue par défaut avec la config famille : un item par
  // défaut sans ligne en base garde son libellé et reste actif ; une ligne
  // en base peut le désactiver ou le réordonner. Les items personnalisés
  // n'existent qu'en base.
  const items: ItemChecklist[] = useMemo(() => {
    const configParCle = new Map(config.map((c) => [c.item_key, c]));
    const defauts: ItemChecklist[] = ITEMS_TRANSMISSION_DEFAUT.map((d) => {
      const c = configParCle.get(d.id);
      return {
        key: d.id,
        label: `${d.icone} ${d.label}`,
        actif: c ? c.actif : true,
        personnalise: false,
        coche: checksCoches.has(d.id),
      };
    });
    const personnalises: ItemChecklist[] = config
      .filter((c) => c.est_personnalise)
      .map((c) => ({
        key: c.item_key,
        label: c.label ?? '',
        actif: c.actif,
        personnalise: true,
        coche: checksCoches.has(c.item_key),
      }));
    return [...defauts, ...personnalises].filter((i) => i.actif);
  }, [config, checksCoches]);

  const toggleCoche = useCallback(
    async (itemKey: string) => {
      if (!familleId || !datePassageIso) return;
      const dejaCoche = checksCoches.has(itemKey);
      setChecksCoches((prev) => {
        const next = new Set(prev);
        if (dejaCoche) next.delete(itemKey);
        else next.add(itemKey);
        return next;
      });
      if (dejaCoche) {
        await supabase
          .from('transmission_checks')
          .delete()
          .eq('famille_id', familleId)
          .eq('item_key', itemKey)
          .eq('date_passage', datePassageIso);
      } else {
        await supabase
          .from('transmission_checks')
          .insert({ famille_id: familleId, item_key: itemKey, date_passage: datePassageIso });
      }
    },
    [familleId, datePassageIso, checksCoches]
  );

  const nomProchainParent = prochainPassage ? parents[prochainPassage.role]?.nom.split(' ')[0] ?? '' : '';
  const toutCoche = items.length > 0 && items.every((i) => i.coche);

  return { prochainPassage, nomProchainParent, items, toutCoche, toggleCoche, chargement };
}