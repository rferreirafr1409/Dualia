// app/(tabs)/decisions.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../../store/useStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { ShieldIcon, ExportIcon } from '../../components/icons';
import { StatutDecision } from '../../types';
import { TRADUCTIONS } from '../../constants/i18n';
import JugementUpload from '../../components/JugementUpload';

function formatDate(isoDate: string, langue: 'fr' | 'pt') {
  const d = new Date(isoDate);
  return d.toLocaleDateString(langue === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'short' });
}

function formatDateTime(isoDate: string, langue: 'fr' | 'pt') {
  const d = new Date(isoDate);
  const date = d.toLocaleDateString(langue === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const time = d.toLocaleTimeString(langue === 'pt' ? 'pt-PT' : 'fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${date} . ${time}`;
}

export default function DecisionsScreen() {
  const router = useRouter();
  const decisions = useStore((s) => s.decisions);
  const parents = useStore((s) => s.parents);
  const parentActif = useStore((s) => s.parentActif);
  const ajouterDecision = useStore((s) => s.ajouterDecision);
  const mettreAJourDecision = useStore((s) => s.mettreAJourDecision);
  const horodaterDecision = useStore((s) => s.horodaterDecision);
  const draft = useStore((s) => s.nouvelleDecisionDraft);
  const setDraft = useStore((s) => s.setNouvelleDecisionDraft);
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].decisions;

  // Catégories proposées pour l'ajout manuel d'une décision liée au jugement
  // de divorce. Elles reprennent les capsules affichées par JugementUpload
  // (garde, pension, réévaluation, divers) pour rester cohérent visuellement.
  const CATEGORIES_JUGEMENT = [
    { key: 'garde', label: t.categorieGarde },
    { key: 'pension', label: t.categoriePension },
    { key: 'reevaluation', label: t.categorieReevaluation },
    { key: 'divers', label: t.categorieDivers },
  ];

  const STATUS_LABEL: Record<StatutDecision, string> = {
    'proposée': t.statutPropose,
    'en_attente': t.statutAttente,
    'acceptée': t.statutAcceptee,
    'refusée': t.statutRefusee,
  };

  const STATUS_COLOR: Record<StatutDecision, string> = {
    'proposée': COLORS.terracotta,
    'en_attente': COLORS.terracotta,
    'acceptée': COLORS.vert,
    'refusée': COLORS.ardoise,
  };

  const FILTERS: { key: 'toutes' | StatutDecision; label: string }[] = [
    { key: 'toutes', label: t.filtreToutes },
    { key: 'en_attente', label: t.filtreAttente },
    { key: 'acceptée', label: t.filtreAcceptees },
    { key: 'refusée', label: t.filtreRefusees },
  ];

  const [filter, setFilter] = useState<'toutes' | StatutDecision>('toutes');
  const [modalVisible, setModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [formTitre, setFormTitre] = useState('');
  const [formDescription, setFormDescription] = useState('');

  useEffect(() => {
    if (draft) {
      setFormDescription(draft);
      setFormTitre('');
      setModalVisible(true);
    }
  }, [draft]);

  const openNewDecision = () => {
    setFormTitre('');
    setFormDescription('');
    setModalVisible(true);
  };

  const openCategoryPicker = () => {
    setCategoryModalVisible(true);
  };

  const chooseCategory = (label: string) => {
    setCategoryModalVisible(false);
    setFormTitre(`${label} — `);
    setFormDescription('');
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setDraft(null);
    setFormTitre('');
    setFormDescription('');
  };

  const submitDecision = () => {
    if (!formTitre.trim()) {
      Alert.alert(t.titreRequisTitre, t.titreRequisMsg);
      return;
    }
    ajouterDecision({
      id: `d-${Date.now()}`,
      titre: formTitre.trim(),
      description: formDescription.trim(),
      dateCreation: new Date().toISOString(),
      auteurId: parentActif,
      statut: 'proposée',
    });
    closeModal();
  };

  // Renvoie vers la Messagerie pour discuter d'une décision avant de trancher,
  // plutôt que de forcer un choix binaire Accepter / Refuser.
  const discuterDecision = () => {
    router.push('/messagerie' as any);
  };

  const filtered = filter === 'toutes' ? decisions : decisions.filter((d) => d.statut === filter);

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <View style={styles.topbarRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t.titre}</Text>
            <Text style={styles.subtitle}>{t.sousTitre}</Text>
          </View>
          <Pressable style={styles.newBtn} onPress={openNewDecision}>
            <Text style={styles.newBtnText}>{t.nouvelle}</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.filterPill, active && styles.filterPillActive]}
              >
                <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Section Jugement de divorce — extraction automatique + capsules */}
        <Text style={styles.sectionTitle}>{t.jugementSectionTitre}</Text>
        <JugementUpload />

        {filtered.length === 0 ? (
          <Text style={styles.emptyText}>{t.vide}</Text>
        ) : null}

        {filtered.map((decision) => {
          const needsAction = decision.statut === 'en_attente' || decision.statut === 'proposée';
          const canExport = decision.statut === 'acceptée';
          const author = parents[decision.auteurId]?.nom ?? decision.auteurId;

          return (
            <View key={decision.id} style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={[styles.statusText, { color: STATUS_COLOR[decision.statut] }]}>
                  {STATUS_LABEL[decision.statut]}
                </Text>
              </View>

              <Text style={styles.cardTitle}>{decision.titre}</Text>
              {decision.description ? (
                <Text style={styles.cardDescription}>{decision.description}</Text>
              ) : null}

              {needsAction ? (
                <View style={styles.actions}>
                  <Pressable style={[styles.btn, styles.btnAccept]} onPress={() => horodaterDecision(decision.id)}>
                    <Text style={styles.btnAcceptéext}>{t.accepter}</Text>
                  </Pressable>
                  <Pressable style={[styles.btn, styles.btnDiscuss]} onPress={discuterDecision}>
                    <Text style={styles.btnDiscussText}>{t.discuter}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btn, styles.btnRefuse]}
                    onPress={() => mettreAJourDecision(decision.id, { statut: 'refusée' })}
                  >
                    <Text style={styles.btnRefuseText}>{t.refuser}</Text>
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.cardFoot}>
                <View style={styles.sealRow}>
                  <ShieldIcon size={12} color={decision.horodatageEIDAS ? COLORS.or : COLORS.ardoise} strokeWidth={2} />
                  <Text style={[styles.sealText, { color: decision.horodatageEIDAS ? COLORS.or : COLORS.ardoise }]}>
                    {decision.horodatageEIDAS ? formatDateTime(decision.horodatageEIDAS, langue) : `${t.creeLe} ${formatDate(decision.dateCreation, langue)}`}
                  </Text>
                </View>
                <Text style={styles.authorText}>{author}</Text>
              </View>

              {canExport ? (
                <Pressable
                  style={styles.exportBtn}
                  onPress={() => Alert.alert(t.exportTitre, t.exportMsg)}
                >
                  <ExportIcon size={13} color={COLORS.vert} strokeWidth={2} />
                  <Text style={styles.exportBtnText}>{t.exporterPdf}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      {/* Bouton flottant, même position/style que celui de l'écran Finances */}
      <Pressable style={styles.fab} onPress={openCategoryPicker}>
        <Text style={styles.fabText}>{t.fabAjouter}</Text>
      </Pressable>

      {/* Sélecteur de catégorie, ouvert par le bouton flottant */}
      <Modal visible={categoryModalVisible} animationType="fade" transparent onRequestClose={() => setCategoryModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCategoryModalVisible(false)}>
          <View style={styles.categoryCard}>
            <Text style={styles.modalTitle}>{t.categoryModalTitre}</Text>
            <Text style={styles.modalHint}>{t.categoryModalHint}</Text>
            {CATEGORIES_JUGEMENT.map((c) => (
              <Pressable key={c.key} style={styles.categoryRow} onPress={() => chooseCategory(c.label)}>
                <Text style={styles.categoryRowText}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.modalTitre}</Text>
            {draft ? (
              <Text style={styles.modalHint}>{t.modalHint}</Text>
            ) : null}

            <Text style={styles.fieldLabel}>{t.champTitre}</Text>
            <TextInput
              value={formTitre}
              onChangeText={setFormTitre}
              placeholder={t.placeholderTitre}
              placeholderTextColor={COLORS.ardoise}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>{t.champDescription}</Text>
            <TextInput
              value={formDescription}
              onChangeText={setFormDescription}
              placeholder={t.placeholderDescription}
              placeholderTextColor={COLORS.ardoise}
              style={[styles.input, styles.inputMultiline]}
              multiline
              numberOfLines={4}
            />

            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, styles.modalBtnCancel]} onPress={closeModal}>
                <Text style={styles.modalBtnCancelText}>{t.annuler}</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalBtnSubmit]} onPress={submitDecision}>
                <Text style={styles.modalBtnSubmitText}>{t.proposer}</Text>
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
  topbar: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
  topbarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  title: { fontFamily: FONTS.display, fontSize: 24, color: COLORS.vertProfond },
  subtitle: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise, marginTop: 3 },
  newBtn: { backgroundColor: COLORS.vertProfond, paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.full, flexShrink: 0 },
  newBtnText: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.ivoire },
  filterRow: { marginTop: SPACING.md },
  filterRowContent: { gap: SPACING.sm, paddingRight: SPACING.xl },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full,
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure,
  },
  filterPillActive: { backgroundColor: COLORS.vertProfond, borderColor: COLORS.vertProfond },
  filterPillText: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.ardoise },
  filterPillTextActive: { color: COLORS.ivoire },
  content: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl * 2 },
  sectionTitle: {
    fontFamily: FONTS.display, fontSize: 17, color: COLORS.vertProfond,
    marginTop: SPACING.sm, marginBottom: SPACING.sm,
  },
  emptyText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise, marginTop: SPACING.xl, textAlign: 'center' },
  card: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure,
    borderRadius: RADIUS.lg, padding: SPACING.lg + 1, marginTop: SPACING.md,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'flex-end' },
  statusText: { fontFamily: FONTS.bodySemibold, fontSize: 11 },
  cardTitle: { fontFamily: FONTS.display, fontSize: 15.5, color: COLORS.vertProfond, marginTop: 4 },
  cardDescription: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.ardoise, marginTop: 5, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  btn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  btnAccept: { backgroundColor: COLORS.vert },
  btnAcceptéext: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.blanc },
  btnDiscuss: { borderWidth: 1, borderColor: COLORS.vertProfond },
  btnDiscussText: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.vertProfond },
  btnRefuse: { borderWidth: 1, borderColor: COLORS.bordure },
  btnRefuseText: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.ardoise },
  cardFoot: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.bordure,
  },
  sealRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sealText: { fontFamily: FONTS.bodySemibold, fontSize: 10.5 },
  authorText: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.ardoise },
  exportBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: SPACING.sm, paddingVertical: 8, borderRadius: 9,
    backgroundColor: 'rgba(45, 106, 79, 0.08)',
  },
  exportBtnText: { fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.vert },
  fab: {
    position: 'absolute',
    right: SPACING.xl,
    bottom: SPACING.xl,
    backgroundColor: COLORS.vert,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: RADIUS.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  fabText: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.blanc },
  categoryCard: {
    backgroundColor: COLORS.ivoire, borderRadius: RADIUS.xl,
    padding: SPACING.xl, margin: SPACING.xl, marginBottom: SPACING.xxxl,
  },
  categoryRow: {
    paddingVertical: 13, borderTopWidth: 1, borderTopColor: COLORS.bordure, marginTop: 8,
  },
  categoryRowText: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.vertProfond },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(28,43,37,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.ivoire, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl, paddingBottom: SPACING.xxxl,
  },
  modalTitle: { fontFamily: FONTS.display, fontSize: 19, color: COLORS.vertProfond },
  modalHint: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.terracotta, marginTop: 4 },
  fieldLabel: { fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.ardoise, marginTop: SPACING.lg, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10, fontFamily: FONTS.body, fontSize: 14, color: COLORS.vertProfond,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xl },
  modalBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: RADIUS.md },
  modalBtnCancel: { borderWidth: 1, borderColor: COLORS.bordure },
  modalBtnCancelText: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.ardoise },
  modalBtnSubmit: { backgroundColor: COLORS.vert },
  modalBtnSubmitText: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.blanc },
});