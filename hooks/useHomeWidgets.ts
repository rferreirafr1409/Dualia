// hooks/useHomeWidgets.ts
//
// Charge et persiste la configuration des widgets de la Home
// (visibilité + ordre) pour le parent et l'espace familial actifs, via la
// table Supabase home_widgets_config. Ne connaît rien du rendu des widgets
// eux-mêmes — fournit juste la liste ordonnée des WidgetId visibles et des
// fonctions pour la modifier.
//
// Recharge à chaque focus (useFocusEffect), pas seulement au montage :
// l'écran Home (app/(tabs)/accueil.tsx) reste monté en mémoire quand on
// navigue vers /personnaliser-home puis qu'on revient en arrière (stack
// navigation par-dessus les tabs) — sans ce rechargement au focus, un
// changement de visibilité/ordre fait sur l'écran de réglages n'apparaît
// jamais sur la Home tant qu'on ne force pas un rechargement complet de
// la page.
//
// Usage dans accueil.tsx :
//   const { widgetsVisibles, chargement } = useHomeWidgets();
//   widgetsVisibles.map((widgetId) => { switch (widgetId) { case 'aujourdhui': ... } })
//
// Usage dans l'écran de personnalisation :
//   const { configComplete, toggleVisibilite, reordonner, chargement } = useHomeWidgets();

import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../constants/supabase';
import { useStore } from '../store/useStore';
import { WIDGETS_CATALOGUE, CONFIG_WIDGETS_PAR_DEFAUT, type WidgetId } from '../constants/widgetsCatalog';

export interface WidgetConfigLigne {
  widgetId: WidgetId;
  position: number;
  visible: boolean;
}

interface UseHomeWidgetsResult {
  configComplete: WidgetConfigLigne[]; // tous les widgets du catalogue, avec leur état actuel, triés par position
  widgetsVisibles: WidgetId[]; // uniquement les widgets visibles, triés par position — pour le rendu direct
  chargement: boolean;
  erreur: string | null;
  toggleVisibilite: (widgetId: WidgetId) => Promise<void>;
  reordonner: (nouvelOrdre: WidgetId[]) => Promise<void>;
}

export function useHomeWidgets(): UseHomeWidgetsResult {
  const parentActif = useStore((s) => s.parentActif);
  const parents = useStore((s) => s.parents);
  const familleId = useStore((s) => s.familleId);

  const [configComplete, setConfigComplete] = useState<WidgetConfigLigne[]>(
    CONFIG_WIDGETS_PAR_DEFAUT.map((c) => ({ widgetId: c.widgetId, position: c.position, visible: c.visible }))
  );
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const parentId = parents[parentActif]?.uuid;

  const charger = useCallback(async () => {
    if (!parentId || !familleId) {
      setChargement(false);
      return;
    }
    setChargement(true);
    setErreur(null);

    const { data, error } = await supabase
      .from('home_widgets_config')
      .select('widget_id, position, visible')
      .eq('parent_id', parentId)
      .eq('famille_id', familleId)
      .order('position', { ascending: true });

    if (error) {
      setErreur(error.message);
      setChargement(false);
      return;
    }

    if (!data || data.length === 0) {
      // Pas encore de config personnalisée : on garde les valeurs par défaut,
      // et on les persiste pour que les prochaines lectures les trouvent directement.
      setConfigComplete(CONFIG_WIDGETS_PAR_DEFAUT);
      const lignesParDefaut = CONFIG_WIDGETS_PAR_DEFAUT.map((c) => ({
        parent_id: parentId,
        famille_id: familleId,
        widget_id: c.widgetId,
        position: c.position,
        visible: c.visible,
      }));
      await supabase.from('home_widgets_config').insert(lignesParDefaut);
      setChargement(false);
      return;
    }

    // Fusion avec le catalogue : un widget ajouté au catalogue après la
    // dernière personnalisation de l'utilisateur doit apparaître (visible,
    // en fin de liste) même s'il n'a pas encore de ligne en base.
    const widgetsConnus = new Set(data.map((d) => d.widget_id));
    const configDepuisBase: WidgetConfigLigne[] = data.map((d) => ({
      widgetId: d.widget_id as WidgetId,
      position: d.position,
      visible: d.visible,
    }));
    const widgetsManquants = WIDGETS_CATALOGUE.filter((w) => !widgetsConnus.has(w.id)).map((w, i) => ({
      widgetId: w.id,
      position: configDepuisBase.length + i,
      visible: true,
    }));

    setConfigComplete([...configDepuisBase, ...widgetsManquants].sort((a, b) => a.position - b.position));
    setChargement(false);
  }, [parentId, familleId]);

  // Recharge à chaque fois que cet écran reprend le focus (pas seulement au
  // premier montage) — voir l'explication en tête de fichier.
  useFocusEffect(
    useCallback(() => {
      charger();
    }, [charger])
  );

  const toggleVisibilite = useCallback(
    async (widgetId: WidgetId) => {
      if (!parentId || !familleId) return;
      const ligneActuelle = configComplete.find((c) => c.widgetId === widgetId);
      const nouvelleVisibilite = !(ligneActuelle?.visible ?? true);

      setConfigComplete((prev) =>
        prev.map((c) => (c.widgetId === widgetId ? { ...c, visible: nouvelleVisibilite } : c))
      );

      const { error } = await supabase
        .from('home_widgets_config')
        .upsert(
          {
            parent_id: parentId,
            famille_id: familleId,
            widget_id: widgetId,
            position: ligneActuelle?.position ?? 0,
            visible: nouvelleVisibilite,
          },
          { onConflict: 'parent_id,famille_id,widget_id' }
        );

      if (error) setErreur(error.message);
    },
    [parentId, familleId, configComplete]
  );

  const reordonner = useCallback(
    async (nouvelOrdre: WidgetId[]) => {
      if (!parentId || !familleId) return;

      const nouvelleConfig = nouvelOrdre.map((widgetId, position) => {
        const existant = configComplete.find((c) => c.widgetId === widgetId);
        return { widgetId, position, visible: existant?.visible ?? true };
      });
      setConfigComplete(nouvelleConfig);

      const lignes = nouvelleConfig.map((c) => ({
        parent_id: parentId,
        famille_id: familleId,
        widget_id: c.widgetId,
        position: c.position,
        visible: c.visible,
      }));

      const { error } = await supabase
        .from('home_widgets_config')
        .upsert(lignes, { onConflict: 'parent_id,famille_id,widget_id' });

      if (error) setErreur(error.message);
    },
    [parentId, familleId, configComplete]
  );

  const widgetsVisibles = configComplete
    .filter((c) => c.visible)
    .sort((a, b) => a.position - b.position)
    .map((c) => c.widgetId);

  return { configComplete, widgetsVisibles, chargement, erreur, toggleVisibilite, reordonner };
}