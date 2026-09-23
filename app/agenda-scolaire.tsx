// app/agenda-scolaire.tsx
//
// Devoirs, absences, sorties et contrôles, centralisés et visibles par les
// deux foyers. Table dédiée (pas une extension du Fil de vie) — voir la
// note dans types/index.ts.
//
// Filtre par enfant basé sur enfantId (identifiant technique), plus fiable
// que le prénom : deux enfants peuvent partager un prénom, et un prénom
// peut être modifié. Le prénom ne sert plus qu'à l'affichage.
//
// Deux façons d'arriver filtré sur un enfant :
// - via la route (?enfant=id), depuis la fiche "L'Essentiel" d'un enfant
// - via les chips manuels si l'utilisateur veut changer de filtre sur place

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal, Platform, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store/useStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { TRADUCTIONS } from '../constants/i18n';
import DatePickerField from '../components/DatePickerField';
import type { TypeAgendaScolaire, AgendaScolaireItem } from '../types';

function alertCompat(titre: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${titre}\n\n${message}` : titre);
  } else {
    Alert.alert(titre, message);
  }
}

function formatDate(iso: string, langue: 'fr' | 'pt' | 'es' | 'en') {
  const d = new Date(iso);
  return d.toLocaleDateString(
    langue === 'pt' ? 'pt-PT' : langue === 'es' ? 'es-ES' : langue === 'en' ? 'en-GB' : 'fr-FR',
    { day: 'numeric', month: 'short' }
  );
}

export default function AgendaScolaireScreen() {
  const router = useRouter();
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].agendaScolaire;

  // enfant : enfantId passé depuis la fiche "L'Essentiel" pour arriver
  // directement filtré sur cet enfant.
  const params = useLocalSearchParams<{ enfant?: string }>();

  const TYPES: { valeur: TypeAgendaScolaire; label: string; icone: keyof typeof Ionicons.glyphMap; couleur: string }[] = [
    { valeur: 'devoir', label: t.typeDevoir, icone: 'book-outline', couleur: COLORS.vert },
    { valeur: 'controle', label: t.typeControle, icone: 'alert-circle-outline', couleur: COLORS.terracotta },
    { valeur: 'sortie', label: t.typeSortie, icone: 'bus-outline', couleur: COLORS.or },
    { valeur: 'absence', label: t.typeAbsence, icone: 'close-circle-outline', couleur: COLORS.ardoise },
  ];

  const agendaScolaire = useStore((s) => s.agendaScolaire);
  const enfants = useStore((s) => s.enfants);
  const parentActif = useStore((s) => s.parentActif);
  const ajouterAgendaScolaire = useStore((s) => s.ajouterAgendaScolaire);
  const basculerAgendaScolaireFait = useStore((s) => s.basculerAgendaScolaireFait);

  const [modalOuverte, setModalOuverte] = useState(false);
  const [typeChoisi, setTypeChoisi] = useState<TypeAgendaScolaire>('devoir');
  const [titre, setTitre] = useState('');
  const [dateChoisie, setDateChoisie] = useState<Date | null>(null);
  const [enfantChoisi, setEnfantChoisi] = useState<string | undefined>(undefined);
  const [filtreEnfantId, setFiltreEnfantId] = useState<string | null>(params.enfant ?? null);

  const enfantFiltre = filtreEnfantId ? enfants.find((e) => e.id === filtreEnfantId) ?? null : null;
  const arriveDepuisRoute = !!params.enfant;

  const items = [...agendaScolaire]
    .filter((a) => !filtreEnfantId || a.enfantId === filtreEnfantId)
    .sort((a, b) => (a.fait === b.fait ? a.dateEcheance.localeCompare(b.dateEcheance) : a.fait ? 1 : -1));

  const reinitialiserFormulaire = () => {
    setTitre('');
    setDateChoisie(null);
    setEnfantChoisi(enfantFiltre?.id);
    setTypeChoisi('devoir');
  };

  const creerEntree = () => {
    if (!titre.trim() || !dateChoisie) {
      alertCompat(t.erreurTitreLabel, t.erreurTitreMessage);
      return;
    }
    const nouvelleEntree: AgendaScolaireItem = {
      id: 'agenda-' + Date.now(),
      type: typeChoisi,
      titre: titre.trim(),
      dateEcheance: dateChoisie.toISOString(),
      enfantId: enfantChoisi,
      auteurId: parentActif,
      fait: false,
      creeLe: new Date().toISOString(),
    };
    ajouterAgendaScolaire(nouvelleEntree);
    reinitialiserFormulaire();
    setModalOuverte(false);
  };

  const typeInfo = (type: TypeAgendaScolaire) => TYPES.find((tp) => tp.valeur === type)!;
  const prenomDe = (enfantId?: string) => (enfantId ? enfants.find((e) => e.id === enfantId)?.prenom : undefined);

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={22} color={COLORS.vertProfond} />
        </Pressable>
        <Text style={styles.topbarTitre}>{t.titre}</Text>
        <View style={{ width: 22 }} />
      </View>

      {arriveDepuisRoute && enfantFiltre ? (
        <View style={styles.filtreEnfantBanner}>
          <Ionicons name="funnel-outline" size={14} color={COLORS.vertProfond} />
          <Text style={styles.filtreEnfantBannerTexte}>{enfantFiltre.prenom}</Text>
          <Pressable
            onPress={() => {
              router.setParams({ enfant: undefined });
              setFiltreEnfantId(null);
            }}
            hitSlop={8}
          >
            <Ionicons name="close-circle" size={16} color={COLORS.ardoise} />
          </Pressable>
        </View>
      ) : enfants.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtresRow} contentContainerStyle={{ paddingHorizontal: SPACING.xl, gap: 8 }}>
          <Pressable style={[styles.filtreChip, !filtreEnfantId && styles.filtreChipActif]} onPress={() => setFiltreEnfantId(null)}>
            <Text style={[styles.filtreChipTexte, !filtreEnfantId && styles.filtreChipTexteActif]}>{t.tous}</Text>
          </Pressable>
          {enfants.map((e) => (
            <Pressable
              key={e.id}
              style={[styles.filtreChip, filtreEnfantId === e.id && styles.filtreChipActif]}
              onPress={() => setFiltreEnfantId(e.id)}
            >
              <Text style={[styles.filtreChipTexte, filtreEnfantId === e.id && styles.filtreChipTexteActif]}>{e.prenom}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <ScrollView contentContainerStyle={styles.contenu} showsVerticalScrollIndicator={false}>
        {items.length === 0 ? (
          <View style={styles.videCard}>
            <Ionicons name="school-outline" size={28} color={COLORS.ardoise} />
            <Text style={styles.videTexte}>{t.vide}</Text>
          </View>
        ) : (
          items.map((item) => {
            const info = typeInfo(item.type);
            const prenom = prenomDe(item.enfantId);
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
                    {info.label}{prenom ? ` · ${prenom}` : ''} · {formatDate(item.dateEcheance, langue)}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}

        <Pressable style={styles.ajouterBtn} onPress={() => { reinitialiserFormulaire(); setModalOuverte(true); }}>
          <Ionicons name="add" size={18} color={COLORS.blanc} />
          <Text style={styles.ajouterTexte}>{t.ajouter}</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={modalOuverte} animationType="slide" transparent onRequestClose={() => setModalOuverte(false)}>
        <View style={styles.modalFond}>
          <View style={styles.modalCarte}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitre}>{t.modalTitre}</Text>

              <View style={styles.typeRow}>
                {TYPES.map((tp) => (
                  <Pressable
                    key={tp.valeur}
                    style={[styles.typeChip, typeChoisi === tp.valeur && { borderColor: tp.couleur, backgroundColor: tp.couleur + '18' }]}
                    onPress={() => setTypeChoisi(tp.valeur)}
                  >
                    <Ionicons name={tp.icone} size={15} color={typeChoisi === tp.valeur ? tp.couleur : COLORS.ardoise} />
                    <Text style={[styles.typeChipTexte, typeChoisi === tp.valeur && { color: tp.couleur }]}>{tp.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>{t.champTitre}</Text>
              <TextInput
                style={styles.input}
                value={titre}
                onChangeText={setTitre}
                placeholder={t.placeholderTitre}
                placeholderTextColor={COLORS.ardoise}
              />

              <View style={{ height: SPACING.md }} />
              <DatePickerField label={t.champDate} value={dateChoisie} onChange={setDateChoisie} />

              {enfants.length > 0 ? (
                <>
                  <Text style={styles.label}>{t.champEnfant}</Text>
                  <View style={styles.typeRow}>
                    {enfants.map((e) => (
                      <Pressable
                        key={e.id}
                        style={[styles.typeChip, enfantChoisi === e.id && styles.typeChipEnfantActif]}
                        onPress={() => setEnfantChoisi(enfantChoisi === e.id ? undefined : e.id)}
                      >
                        <Text style={[styles.typeChipTexte, enfantChoisi === e.id && { color: COLORS.vert }]}>{e.prenom}</Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}

              <View style={styles.modalBtns}>
                <Pressable style={styles.modalBtnAnnuler} onPress={() => setModalOuverte(false)}>
                  <Text style={styles.modalBtnAnnulerTexte}>{t.annuler}</Text>
                </Pressable>
                <Pressable style={styles.modalBtnEnvoyer} onPress={creerEntree}>
                  <Text style={styles.modalBtnEnvoyerTexte}>{t.ajouter}</Text>
                </Pressable>
              </View>
            </ScrollView>
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

  filtreEnfantBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EEF4F1', marginHorizontal: SPACING.xl, marginBottom: SPACING.sm,
    borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 6, alignSelf: 'flex-start',
  },
  filtreEnfantBannerTexte: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.vertProfond },

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