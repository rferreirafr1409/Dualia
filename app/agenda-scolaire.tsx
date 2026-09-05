// app/agenda-scolaire.tsx
//
// Devoirs, absences, sorties et contrôles, centralisés et visibles par les
// deux foyers. Table dédiée (pas une extension du Fil de vie) — voir la
// note dans types/index.ts.

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store/useStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import type { TypeAgendaScolaire, AgendaScolaireItem } from '../types';

const TYPES: { valeur: TypeAgendaScolaire; label: string; icone: keyof typeof Ionicons.glyphMap; couleur: string }[] = [
  { valeur: 'devoir', label: 'Devoir', icone: 'book-outline', couleur: COLORS.vert },
  { valeur: 'controle', label: 'Contrôle', icone: 'alert-circle-outline', couleur: COLORS.terracotta },
  { valeur: 'sortie', label: 'Sortie', icone: 'bus-outline', couleur: COLORS.or },
  { valeur: 'absence', label: 'Absence', icone: 'close-circle-outline', couleur: COLORS.ardoise },
];

function alertCompat(titre: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${titre}\n\n${message}` : titre);
  } else {
    Alert.alert(titre, message);
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function AgendaScolaireScreen() {
  const router = useRouter();
  const agendaScolaire = useStore((s) => s.agendaScolaire);
  const enfants = useStore((s) => s.enfants);
  const parentActif = useStore((s) => s.parentActif);
  const ajouterAgendaScolaire = useStore((s) => s.ajouterAgendaScolaire);
  const basculerAgendaScolaireFait = useStore((s) => s.basculerAgendaScolaireFait);

  const [modalOuverte, setModalOuverte] = useState(false);
  const [typeChoisi, setTypeChoisi] = useState<TypeAgendaScolaire>('devoir');
  const [titre, setTitre] = useState('');
  const [dateEcheance, setDateEcheance] = useState('');
  const [enfantChoisi, setEnfantChoisi] = useState<string | undefined>(undefined);
  const [filtreEnfant, setFiltreEnfant] = useState<string | null>(null);

  const items = [...agendaScolaire]
    .filter((a) => !filtreEnfant || a.enfant === filtreEnfant)
    .sort((a, b) => (a.fait === b.fait ? a.dateEcheance.localeCompare(b.dateEcheance) : a.fait ? 1 : -1));

  const creerEntree = () => {
    if (!titre.trim() || !dateEcheance.trim()) {
      alertCompat('Champs incomplets', 'Indique au moins un titre et une date.');
      return;
    }
    const dateIso = /^\d{4}-\d{2}-\d{2}$/.test(dateEcheance.trim())
      ? new Date(dateEcheance.trim()).toISOString()
      : new Date().toISOString();
    const nouvelleEntree: AgendaScolaireItem = {
      id: 'agenda-' + Date.now(),
      type: typeChoisi,
      titre: titre.trim(),
      dateEcheance: dateIso,
      enfant: enfantChoisi,
      auteurId: parentActif,
      fait: false,
      creeLe: new Date().toISOString(),
    };
    ajouterAgendaScolaire(nouvelleEntree);
    setTitre('');
    setDateEcheance('');
    setEnfantChoisi(undefined);
    setTypeChoisi('devoir');
    setModalOuverte(false);
  };

  const typeInfo = (type: TypeAgendaScolaire) => TYPES.find((t) => t.valeur === type)!;

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={22} color={COLORS.vertProfond} />
        </Pressable>
        <Text style={styles.topbarTitre}>Agenda scolaire</Text>
        <View style={{ width: 22 }} />
      </View>

      {enfants.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtresRow} contentContainerStyle={{ paddingHorizontal: SPACING.xl, gap: 8 }}>
          <Pressable style={[styles.filtreChip, !filtreEnfant && styles.filtreChipActif]} onPress={() => setFiltreEnfant(null)}>
            <Text style={[styles.filtreChipTexte, !filtreEnfant && styles.filtreChipTexteActif]}>Tous</Text>
          </Pressable>
          {enfants.map((e) => (
            <Pressable
              key={e.id}
              style={[styles.filtreChip, filtreEnfant === e.prenom && styles.filtreChipActif]}
              onPress={() => setFiltreEnfant(e.prenom)}
            >
              <Text style={[styles.filtreChipTexte, filtreEnfant === e.prenom && styles.filtreChipTexteActif]}>{e.prenom}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <ScrollView contentContainerStyle={styles.contenu} showsVerticalScrollIndicator={false}>
        {items.length === 0 ? (
          <View style={styles.videCard}>
            <Ionicons name="school-outline" size={28} color={COLORS.ardoise} />
            <Text style={styles.videTexte}>Rien de prévu pour le moment</Text>
          </View>
        ) : (
          items.map((item) => {
            const info = typeInfo(item.type);
            return (
              <Pressable
                key={item.id}
                style={[styles.itemCard, item.fait && styles.itemCardFait]}
                onPress={() => basculerAgendaScolaireFait(item.id)}
              >
                <Ionicons
                  name={item.fait ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={item.fait ? COLORS.vert : COLORS.ardoise}
                />
                <View style={[styles.itemIconWrap, { backgroundColor: info.couleur + '22' }]}>
                  <Ionicons name={info.icone} size={16} color={info.couleur} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.itemTitre, item.fait && styles.itemTitreFait]}>{item.titre}</Text>
                  <Text style={styles.itemMeta}>
                    {info.label}{item.enfant ? ` · ${item.enfant}` : ''} · {formatDate(item.dateEcheance)}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}

        <Pressable style={styles.ajouterBtn} onPress={() => setModalOuverte(true)}>
          <Ionicons name="add" size={18} color={COLORS.blanc} />
          <Text style={styles.ajouterTexte}>Ajouter</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={modalOuverte} animationType="slide" transparent onRequestClose={() => setModalOuverte(false)}>
        <View style={styles.modalFond}>
          <View style={styles.modalCarte}>
            <Text style={styles.modalTitre}>Ajouter à l'agenda</Text>

            <View style={styles.typeRow}>
              {TYPES.map((t) => (
                <Pressable
                  key={t.valeur}
                  style={[styles.typeChip, typeChoisi === t.valeur && { borderColor: t.couleur, backgroundColor: t.couleur + '18' }]}
                  onPress={() => setTypeChoisi(t.valeur)}
                >
                  <Ionicons name={t.icone} size={15} color={typeChoisi === t.valeur ? t.couleur : COLORS.ardoise} />
                  <Text style={[styles.typeChipTexte, typeChoisi === t.valeur && { color: t.couleur }]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Titre</Text>
            <TextInput
              style={styles.input}
              value={titre}
              onChangeText={setTitre}
              placeholder="Ex. Exercices de maths p.42"
              placeholderTextColor={COLORS.ardoise}
            />

            <Text style={styles.label}>Date (AAAA-MM-JJ)</Text>
            <TextInput
              style={styles.input}
              value={dateEcheance}
              onChangeText={setDateEcheance}
              placeholder="2026-09-12"
              placeholderTextColor={COLORS.ardoise}
            />

            {enfants.length > 0 ? (
              <>
                <Text style={styles.label}>Enfant</Text>
                <View style={styles.typeRow}>
                  {enfants.map((e) => (
                    <Pressable
                      key={e.id}
                      style={[styles.typeChip, enfantChoisi === e.prenom && styles.typeChipEnfantActif]}
                      onPress={() => setEnfantChoisi(enfantChoisi === e.prenom ? undefined : e.prenom)}
                    >
                      <Text style={[styles.typeChipTexte, enfantChoisi === e.prenom && { color: COLORS.vert }]}>{e.prenom}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            <View style={styles.modalBtns}>
              <Pressable style={styles.modalBtnAnnuler} onPress={() => setModalOuverte(false)}>
                <Text style={styles.modalBtnAnnulerTexte}>Annuler</Text>
              </Pressable>
              <Pressable style={styles.modalBtnEnvoyer} onPress={creerEntree}>
                <Text style={styles.modalBtnEnvoyerTexte}>Ajouter</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ivoire },
  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl, paddingBottom: SPACING.md,
  },
  topbarTitre: { fontFamily: FONTS.display, fontSize: 18, color: COLORS.vertProfond },

  filtresRow: { flexGrow: 0, marginBottom: SPACING.sm },
  filtreChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: COLORS.bordure, backgroundColor: COLORS.blanc },
  filtreChipActif: { backgroundColor: COLORS.vert, borderColor: COLORS.vert },
  filtreChipTexte: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.ardoise },
  filtreChipTexteActif: { color: COLORS.blanc },

  contenu: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl },

  videCard: {
    backgroundColor: COLORS.blanc, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.bordure,
    borderStyle: 'dashed', padding: SPACING.xl, alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg,
  },
  videTexte: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise },

  itemCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  itemCardFait: { opacity: 0.55 },
  itemIconWrap: { width: 30, height: 30, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  itemTitre: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.vertProfond },
  itemTitreFait: { textDecorationLine: 'line-through' },
  itemMeta: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, marginTop: 1 },

  ajouterBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.vert, borderRadius: RADIUS.md, paddingVertical: 14, marginTop: SPACING.md,
  },
  ajouterTexte: { fontFamily: FONTS.bodySemibold, fontSize: 14.5, color: COLORS.blanc },

  modalFond: { flex: 1, backgroundColor: 'rgba(28,43,37,0.45)', justifyContent: 'flex-end' },
  modalCarte: {
    backgroundColor: COLORS.ivoire, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg,
    padding: SPACING.xl, maxHeight: '90%',
  },
  modalTitre: { fontFamily: FONTS.display, fontSize: 19, color: COLORS.vertProfond, marginBottom: SPACING.md },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 16, borderWidth: 1, borderColor: COLORS.bordure, backgroundColor: COLORS.blanc,
  },
  typeChipEnfantActif: { borderColor: COLORS.vert, backgroundColor: '#EEF4F1' },
  typeChipTexte: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.ardoise },
  label: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.vertProfond, marginBottom: 6, marginTop: SPACING.md },
  input: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 12, fontFamily: FONTS.body, fontSize: 15, color: COLORS.vertProfond,
  },
  modalBtns: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xl },
  modalBtnAnnuler: { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.bordure },
  modalBtnAnnulerTexte: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.ardoise },
  modalBtnEnvoyer: { flex: 2, paddingVertical: 13, alignItems: 'center', borderRadius: RADIUS.md, backgroundColor: COLORS.vert },
  modalBtnEnvoyerTexte: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.blanc },
});
