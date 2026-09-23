// app/personnaliser-transmission.tsx
//
// Personnalisation de la checklist de transmission : chaque item par défaut
// (constants/transmissionCatalog.ts) peut être désactivé, et la famille peut
// ajouter ses propres items. Toute modification s'écrit directement dans
// transmission_items_config (une ligne par item non-standard ou personnalisé).

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../constants/supabase';
import { useStore } from '../store/useStore';
import { TRADUCTIONS } from '../constants/i18n';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { ITEMS_TRANSMISSION_DEFAUT } from '../constants/transmissionCatalog';

type LigneConfig = { item_key: string; label: string | null; ordre: number; actif: boolean; est_personnalise: boolean };

export default function PersonnaliserTransmissionScreen() {
  const router = useRouter();
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].personnaliserTransmission;
  const familleId = useStore((s) => s.familleId);
  const parents = useStore((s) => s.parents);
  const parentActif = useStore((s) => s.parentActif);
  const parentId = parents[parentActif]?.uuid;

  const [config, setConfig] = useState<LigneConfig[]>([]);
  const [chargement, setChargement] = useState(true);
  const [nouvelItem, setNouvelItem] = useState('');

  const charger = useCallback(async () => {
    if (!familleId) { setChargement(false); return; }
    setChargement(true);
    const { data } = await supabase
      .from('transmission_items_config')
      .select('item_key, label, ordre, actif, est_personnalise')
      .eq('famille_id', familleId)
      .order('ordre', { ascending: true });
    setConfig(data ?? []);
    setChargement(false);
  }, [familleId]);

  useEffect(() => { charger(); }, [charger]);

  const configParCle = new Map(config.map((c) => [c.item_key, c]));

  async function toggleDefaut(itemKey: string, actifActuel: boolean) {
    if (!familleId) return;
    setConfig((prev) => {
      const existe = prev.some((c) => c.item_key === itemKey);
      if (existe) return prev.map((c) => (c.item_key === itemKey ? { ...c, actif: !actifActuel } : c));
      return [...prev, { item_key: itemKey, label: null, ordre: prev.length, actif: !actifActuel, est_personnalise: false }];
    });
    await supabase
      .from('transmission_items_config')
      .upsert(
        { famille_id: familleId, item_key: itemKey, actif: !actifActuel, est_personnalise: false, cree_par: parentId },
        { onConflict: 'famille_id,item_key' }
      );
  }

  async function ajouterPersonnalise() {
    const label = nouvelItem.trim();
    if (!label || !familleId) return;
    const itemKey = `perso_${Date.now()}`;
    setNouvelItem('');
    setConfig((prev) => [...prev, { item_key: itemKey, label, ordre: prev.length, actif: true, est_personnalise: true }]);
    await supabase.from('transmission_items_config').insert({
      famille_id: familleId,
      item_key: itemKey,
      label,
      ordre: config.length,
      actif: true,
      est_personnalise: true,
      cree_par: parentId,
    });
  }

  async function supprimerPersonnalise(itemKey: string) {
    setConfig((prev) => prev.filter((c) => c.item_key !== itemKey));
    if (!familleId) return;
    await supabase.from('transmission_items_config').delete().eq('famille_id', familleId).eq('item_key', itemKey);
  }

  const itemsPersonnalises = config.filter((c) => c.est_personnalise);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.vertProfond} />
        </Pressable>
        <Text style={styles.titre}>{t.titrePage}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>{t.sectionParDefaut}</Text>
        {ITEMS_TRANSMISSION_DEFAUT.map((item) => {
          const c = configParCle.get(item.id);
          const actif = c ? c.actif : true;
          return (
            <View key={item.id} style={styles.ligne}>
              <Text style={styles.ligneTexte}>{item.icone} {item.label}</Text>
              <Switch
                value={actif}
                onValueChange={() => toggleDefaut(item.id, actif)}
                trackColor={{ true: COLORS.vert, false: COLORS.ivoireFonce }}
              />
            </View>
          );
        })}

        {itemsPersonnalises.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, { marginTop: SPACING.lg }]}>{t.sectionAjoutes}</Text>
            {itemsPersonnalises.map((item) => (
              <View key={item.item_key} style={styles.ligne}>
                <Text style={styles.ligneTexte}>{item.label}</Text>
                <Pressable onPress={() => supprimerPersonnalise(item.item_key)}>
                  <Ionicons name="trash-outline" size={17} color={COLORS.terracotta} />
                </Pressable>
              </View>
            ))}
          </>
        ) : null}

        <View style={[styles.ajoutRow, { marginTop: SPACING.lg }]}>
          <TextInput
            style={styles.input}
            value={nouvelItem}
            onChangeText={setNouvelItem}
            placeholder={t.placeholderNouvelItem}
            placeholderTextColor={COLORS.ardoise}
            onSubmitEditing={ajouterPersonnalise}
          />
          <Pressable style={styles.ajoutBtn} onPress={ajouterPersonnalise}>
            <Ionicons name="add" size={18} color={COLORS.blanc} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ivoire },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.xl, paddingBottom: SPACING.sm,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  titre: { fontFamily: FONTS.displaySemibold, fontSize: 17, color: COLORS.vertProfond },
  content: { padding: SPACING.xl, paddingBottom: SPACING.xxxl },
  sectionLabel: {
    fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.ardoise,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: SPACING.sm,
  },
  ligne: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.blanc, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md,
    paddingVertical: 12, marginBottom: SPACING.xs,
  },
  ligneTexte: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.texte, flex: 1, marginRight: SPACING.sm },
  ajoutRow: { flexDirection: 'row', gap: SPACING.sm },
  input: {
    flex: 1, backgroundColor: COLORS.blanc, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.texte,
  },
  ajoutBtn: {
    width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: COLORS.vert,
    alignItems: 'center', justifyContent: 'center',
  },
});
