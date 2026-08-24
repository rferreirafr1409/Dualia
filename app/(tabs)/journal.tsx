// app/(tabs)/journal.tsx

import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal, Alert } from 'react-native';
import { useStore } from '../../store/useStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { LockIcon, HeartIcon } from '../../components/icons';
import DatePickerField from '../../components/DatePickerField';
import { EnfantTag } from '../../types';
import { TRADUCTIONS } from '../../constants/i18n';

const EMOJIS = ['📸', '🎒', '🎂', '🌳', '🚲', '💌', '⚽', '🎨', '🏖️', '🎓', '🎄', '🌟'];

function formatDate(isoDate: string, langue: 'fr' | 'pt') {
  const d = new Date(isoDate);
  return d.toLocaleDateString(langue === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function JournalScreen() {
  const entries = useStore((s) => s.journalEntries);
  const parents = useStore((s) => s.parents);
  const parentActif = useStore((s) => s.parentActif);
  const ajouterJournal = useStore((s) => s.ajouterJournal);
  const likerEntree = useStore((s) => s.likerEntree);
  const ajouterRecitCroise = useStore((s) => s.ajouterRecitCroise);
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].journal;

  const FILTRES: { key: 'tous' | EnfantTag | 'capsules'; label: string }[] = [
    { key: 'tous', label: t.filtreTous },
    { key: 'Emma', label: 'Emma' },
    { key: 'Léo', label: 'Léo' },
    { key: 'capsules', label: t.filtreCapsules },
  ];

  const [filtre, setFiltre] = useState<'tous' | EnfantTag | 'capsules'>('tous');
  const [modalVisible, setModalVisible] = useState(false);
  const [formTitre, setFormTitre] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formEmoji, setFormEmoji] = useState(EMOJIS[0]);
  const [formEnfant, setFormEnfant] = useState<EnfantTag>('Tous');
  const [formCapsule, setFormCapsule] = useState(false);
  const [formDateRevelation, setFormDateRevelation] = useState<Date | null>(null);

  const [recitModalId, setRecitModalId] = useState<string | null>(null);
  const [recitTexte, setRecitTexte] = useState('');

  const maintenant = new Date();

  const filtered = useMemo(() => {
    if (filtre === 'tous') return entries;
    if (filtre === 'capsules') return entries.filter((e) => !!e.dateRevelation);
    return entries.filter((e) => e.enfant === filtre);
  }, [entries, filtre]);

  const openModal = () => {
    setFormTitre('');
    setFormDescription('');
    setFormEmoji(EMOJIS[0]);
    setFormEnfant('Tous');
    setFormCapsule(false);
    setFormDateRevelation(null);
    setModalVisible(true);
  };

  const submitEntry = () => {
    if (!formTitre.trim()) {
      Alert.alert(t.titreRequisTitre, t.titreRequisMsg);
      return;
    }
    if (formCapsule && !formDateRevelation) {
      Alert.alert(t.dateRequiseTitre, t.dateRequiseMsg);
      return;
    }
    ajouterJournal({
      id: `j-${Date.now()}`,
      titre: formTitre.trim(),
      description: formDescription.trim(),
      emoji: formEmoji,
      auteurId: parentActif,
      date: new Date().toISOString(),
      liked: false,
      enfant: formEnfant,
      dateRevelation: formCapsule && formDateRevelation ? formDateRevelation.toISOString() : undefined,
    });
    setModalVisible(false);
  };

  const openRecitModal = (id: string) => {
    setRecitTexte('');
    setRecitModalId(id);
  };

  const submitRecit = () => {
    if (!recitTexte.trim() || !recitModalId) return;
    ajouterRecitCroise(recitModalId, recitTexte.trim());
    setRecitModalId(null);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <View style={styles.topbarRow}>
          <View>
            <Text style={styles.title}>{t.titre}</Text>
            <Text style={styles.subtitle}>{t.sousTitre}</Text>
          </View>
          <Pressable style={styles.newBtn} onPress={openModal}>
            <Text style={styles.newBtnText}>{t.nouveau}</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
          {FILTRES.map((f) => {
            const active = filtre === f.key;
            return (
              <Pressable key={f.key} onPress={() => setFiltre(f.key)} style={[styles.filterPill, active && styles.filterPillActive]}>
                <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <Text style={styles.emptyText}>{t.vide}</Text>
        ) : null}

        {filtered.map((entry) => {
          const author = parents[entry.auteurId]?.nom.split(' ')[0] ?? entry.auteurId;
          const isLocked = !!entry.dateRevelation && new Date(entry.dateRevelation) > maintenant;

          if (isLocked) {
            return (
              <View key={entry.id} style={[styles.card, styles.cardLocked]}>
                <View style={styles.lockedIconWrap}>
                  <LockIcon size={20} color={COLORS.ardoise} strokeWidth={1.8} />
                </View>
                <Text style={styles.lockedTitle}>{t.capsuleTitre}</Text>
                <Text style={styles.lockedText}>
                  {t.capsuleAttente(author, formatDate(entry.dateRevelation!, langue))}
                </Text>
              </View>
            );
          }

          return (
            <View key={entry.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.emojiWrap}>
                  <Text style={styles.emoji}>{entry.emoji}</Text>
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle}>{entry.titre}</Text>
                  <Text style={styles.cardMeta}>{author} . {formatDate(entry.date, langue)}</Text>
                </View>
                {entry.enfant ? (
                  <View style={styles.enfantPill}>
                    <Text style={styles.enfantPillText}>{entry.enfant}</Text>
                  </View>
                ) : null}
              </View>

              {entry.description ? (
                <Text style={styles.cardDescription}>{entry.description}</Text>
              ) : null}

              {entry.recitCroise ? (
                <View style={styles.recitBox}>
                  <Text style={styles.recitLabel}>{t.regardCroise}</Text>
                  <Text style={styles.recitText}>{entry.recitCroise}</Text>
                </View>
              ) : (
                <Pressable style={styles.recitBtn} onPress={() => openRecitModal(entry.id)}>
                  <Text style={styles.recitBtnText}>{t.ajouterRegard}</Text>
                </Pressable>
              )}

              <View style={styles.cardFoot}>
                <Pressable style={styles.likeBtn} onPress={() => likerEntree(entry.id)}>
                  <HeartIcon size={16} color={entry.liked ? COLORS.terracotta : COLORS.ardoise} filled={entry.liked} strokeWidth={1.8} />
                  <Text style={[styles.likeText, entry.liked && { color: COLORS.terracotta }]}>
                    {entry.liked ? t.jaime : t.aimer}
                  </Text>
                </Pressable>
                {entry.dateRevelation ? (
                  <Text style={styles.wasCapsuleText}>{t.capsuleOuverte(formatDate(entry.dateRevelation, langue))}</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{t.modalTitre}</Text>

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

              <Text style={styles.fieldLabel}>{t.emoji}</Text>
              <View style={styles.emojiGrid}>
                {EMOJIS.map((e) => {
                  const active = formEmoji === e;
                  return (
                    <Pressable key={e} onPress={() => setFormEmoji(e)} style={[styles.emojiOption, active && styles.emojiOptionActive]}>
                      <Text style={styles.emojiOptionText}>{e}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>{t.concerne}</Text>
              <View style={styles.pillRow}>
                {(['Tous', 'Emma', 'Léo'] as EnfantTag[]).map((tag) => {
                  const active = formEnfant === tag;
                  return (
                    <Pressable key={tag} onPress={() => setFormEnfant(tag)} style={[styles.pill, active && styles.pillActive]}>
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>{tag}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable style={styles.capsuleToggle} onPress={() => setFormCapsule((v) => !v)}>
                <View style={[styles.checkbox, formCapsule && styles.checkboxActive]}>
                  {formCapsule ? <Text style={styles.checkboxMark}>✓</Text> : null}
                </View>
                <Text style={styles.capsuleToggleText}>{t.capsuleToggle}</Text>
              </Pressable>

              {formCapsule ? (
                <DatePickerField label={t.dateRevelation} value={formDateRevelation} onChange={setFormDateRevelation} minDate={new Date()} />
              ) : null}

              <View style={styles.modalActions}>
                <Pressable style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setModalVisible(false)}>
                  <Text style={styles.modalBtnCancelText}>{t.annuler}</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, styles.modalBtnSubmit]} onPress={submitEntry}>
                  <Text style={styles.modalBtnSubmitText}>{t.publier}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!recitModalId} animationType="fade" transparent onRequestClose={() => setRecitModalId(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.recitModalTitre}</Text>
            <Text style={styles.recitHint}>{t.recitHint}</Text>
            <TextInput
              value={recitTexte}
              onChangeText={setRecitTexte}
              placeholder={t.recitPlaceholder}
              placeholderTextColor={COLORS.ardoise}
              style={[styles.input, styles.inputMultiline]}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setRecitModalId(null)}>
                <Text style={styles.modalBtnCancelText}>{t.annuler}</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalBtnSubmit]} onPress={submitRecit}>
                <Text style={styles.modalBtnSubmitText}>{t.ajouter}</Text>
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
  topbarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontFamily: FONTS.display, fontSize: 24, color: COLORS.vertProfond },
  subtitle: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise, marginTop: 3 },
  newBtn: { backgroundColor: COLORS.vertProfond, paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.full },
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
  emptyText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise, marginTop: SPACING.xl, textAlign: 'center' },
  card: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure,
    borderRadius: RADIUS.lg, padding: SPACING.lg + 1, marginTop: SPACING.md,
  },
  cardLocked: { alignItems: 'center', paddingVertical: SPACING.xl, backgroundColor: 'rgba(107,127,122,0.06)' },
  lockedIconWrap: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.blanc,
    alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.bordure,
  },
  lockedTitle: { fontFamily: FONTS.display, fontSize: 15, color: COLORS.ardoise },
  lockedText: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.ardoise, textAlign: 'center', marginTop: 4, paddingHorizontal: SPACING.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  emojiWrap: {
    width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(201,168,76,0.14)',
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm,
  },
  emoji: { fontSize: 21 },
  cardHeaderText: { flex: 1 },
  cardTitle: { fontFamily: FONTS.display, fontSize: 15.5, color: COLORS.vertProfond },
  cardMeta: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, marginTop: 2 },
  enfantPill: { backgroundColor: 'rgba(45,106,79,0.1)', paddingHorizontal: 9, paddingVertical: 3, borderRadius: RADIUS.full },
  enfantPillText: { fontFamily: FONTS.bodySemibold, fontSize: 10.5, color: COLORS.vert },
  cardDescription: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.vertProfond, marginTop: SPACING.sm, lineHeight: 19 },
  recitBox: {
    marginTop: SPACING.md, padding: SPACING.md, backgroundColor: 'rgba(181,146,124,0.1)', borderRadius: RADIUS.md,
    borderLeftWidth: 3, borderLeftColor: COLORS.terracotta,
  },
  recitLabel: { fontFamily: FONTS.bodySemibold, fontSize: 10.5, color: COLORS.terracotta, textTransform: 'uppercase', letterSpacing: 0.4 },
  recitText: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.vertProfond, marginTop: 4, fontStyle: 'italic', lineHeight: 18 },
  recitBtn: { marginTop: SPACING.md },
  recitBtnText: { fontFamily: FONTS.bodySemibold, fontSize: 11.5, color: COLORS.vert },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.md },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  likeText: { fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.ardoise },
  wasCapsuleText: { fontFamily: FONTS.body, fontSize: 10.5, color: COLORS.or },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(28,43,37,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.ivoire, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl, paddingBottom: SPACING.xxxl, maxHeight: '85%',
  },
  modalTitle: { fontFamily: FONTS.display, fontSize: 19, color: COLORS.vertProfond },
  recitHint: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.ardoise, marginTop: 4 },
  fieldLabel: { fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.ardoise, marginTop: SPACING.lg, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10, fontFamily: FONTS.body, fontSize: 14, color: COLORS.vertProfond,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  emojiOption: {
    width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure,
  },
  emojiOptionActive: { borderColor: COLORS.vert, borderWidth: 2, backgroundColor: 'rgba(45,106,79,0.08)' },
  emojiOptionText: { fontSize: 20 },
  pillRow: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full,
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure,
  },
  pillActive: { backgroundColor: COLORS.vertProfond, borderColor: COLORS.vertProfond },
  pillText: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.ardoise },
  pillTextActive: { color: COLORS.ivoire },
  capsuleToggle: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.lg },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: COLORS.bordure,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: COLORS.vert, borderColor: COLORS.vert },
  checkboxMark: { color: COLORS.blanc, fontSize: 12, fontFamily: FONTS.bodyBold },
  capsuleToggleText: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.vertProfond },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xl },
  modalBtn: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: RADIUS.md },
  modalBtnCancel: { borderWidth: 1, borderColor: COLORS.bordure },
  modalBtnCancelText: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.ardoise },
  modalBtnSubmit: { backgroundColor: COLORS.vert },
  modalBtnSubmitText: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.blanc },
});
