// app/(tabs)/journal.tsx

import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal, Alert, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useStore } from '../../store/useStore';
import { jourLocal, aujourdHuiLocal, depuisJourLocal } from '../../lib/dates';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { LockIcon, HeartIcon } from '../../components/icons';
import Ionicons from '@expo/vector-icons/Ionicons';
import DatePickerField from '../../components/DatePickerField';
import JournalMemoryImage from '../../components/JournalMemoryImage';
import { TRADUCTIONS } from '../../constants/i18n';
import { JournalEntry } from '../../types';

let ImagePicker: typeof import('expo-image-picker') | null = null;
try {
  ImagePicker = require('expo-image-picker');
} catch {
  ImagePicker = null;
}

const EMOJIS = ['📸', '🎒', '🎂', '🌳', '🚲', '💌', '⚽', '🎨', '🏖️', '🎓', '🎄', '🌟'];
const TOUS = 'Tous';

// depuisJourLocal : journal_entries.date et date_revelation sont des colonnes
// `date`. new Date('2026-12-25') vaut minuit UTC, soit le 24 decembre au soir
// pour un parent en fuseau negatif.
function formatDate(isoDate: string, langue: 'fr' | 'pt' | 'es' | 'en') {
  if (!isoDate) return '';
  const d = depuisJourLocal(isoDate);
  return d.toLocaleDateString(
    langue === 'pt' ? 'pt-PT' : langue === 'es' ? 'es-ES' : langue === 'en' ? 'en-GB' : 'fr-FR',
    { day: 'numeric', month: 'long', year: 'numeric' }
  );
}

export default function JournalScreen() {
  // enfant : prénom d'un enfant, passé depuis la fiche "L'Essentiel" pour
  // pré-filtrer le journal sur ses souvenirs.
  const params = useLocalSearchParams<{ enfant?: string }>();
  const entries = useStore((s) => s.journalEntries);
  const enfants = useStore((s) => s.enfants);
  const parents = useStore((s) => s.parents);
  const parentActif = useStore((s) => s.parentActif);
  const ajouterJournal = useStore((s) => s.ajouterJournal);
  const modifierJournal = useStore((s) => s.modifierJournal);
  const supprimerJournal = useStore((s) => s.supprimerJournal);
  const likerEntree = useStore((s) => s.likerEntree);
  const ajouterRecitCroise = useStore((s) => s.ajouterRecitCroise);
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].journal;

  // Prénoms réels des enfants du foyer, plus "Tous" et le filtre capsules —
  // remplace l'ancienne liste figée ('Emma'/'Léo') par les vrais enfants.
  const FILTRES: { key: string; label: string }[] = [
    { key: TOUS, label: t.filtreTous },
    ...enfants.map((e) => ({ key: e.prenom, label: e.prenom })),
    { key: 'capsules', label: t.filtreCapsules },
  ];

  const [filtre, setFiltre] = useState<string>(params.enfant || 'tous');

  // Comportement accordéon : un seul souvenir ouvert à la fois. Ouvrir un
  // souvenir referme automatiquement le précédent — évite d'empiler
  // plusieurs grandes photos les unes sous les autres.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formTitre, setFormTitre] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formEmoji, setFormEmoji] = useState(EMOJIS[0]);
  const [formEnfant, setFormEnfant] = useState<string>(TOUS);
  const [formCapsule, setFormCapsule] = useState(false);
  const [formDateRevelation, setFormDateRevelation] = useState<Date | null>(null);
  const [formPhotoUri, setFormPhotoUri] = useState<string | null>(null);
  const [formPhotoUrlExistante, setFormPhotoUrlExistante] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const [recitModalId, setRecitModalId] = useState<string | null>(null);
  const [recitTexte, setRecitTexte] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const maintenant = new Date();

  const filtered = useMemo(() => {
    if (filtre === 'tous') return entries;
    if (filtre === 'capsules') return entries.filter((e) => !!e.dateRevelation);
    return entries.filter((e) => e.enfant === filtre);
  }, [entries, filtre]);

  const toggleExpand = (id: string) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  const openModal = () => {
    setEditId(null);
    setFormTitre('');
    setFormDescription('');
    setFormEmoji(EMOJIS[0]);
    // Reprend le filtre actif (ex. "Marlon") plutôt que de toujours revenir
    // à "Tous" — si tu es en train de consulter les souvenirs de Marlon,
    // le nouveau souvenir doit logiquement lui être associé par défaut.
    setFormEnfant(filtre !== 'tous' && filtre !== 'capsules' ? filtre : TOUS);
    setFormCapsule(false);
    setFormDateRevelation(null);
    setFormPhotoUri(null);
    setFormPhotoUrlExistante(null);
    setModalVisible(true);
  };

  const openEditModal = (entry: JournalEntry) => {
    setEditId(entry.id);
    setFormTitre(entry.titre);
    setFormDescription(entry.description);
    setFormEmoji(entry.emoji || EMOJIS[0]);
    setFormEnfant((entry.enfant as string) || TOUS);
    setFormCapsule(!!entry.dateRevelation);
    setFormDateRevelation(entry.dateRevelation ? depuisJourLocal(entry.dateRevelation) : null);
    setFormPhotoUri(null);
    setFormPhotoUrlExistante(entry.photoUrl ?? null);
    setModalVisible(true);
  };

  const choisirPhoto = async () => {
    if (!ImagePicker) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const resultat = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (!resultat.canceled && resultat.assets[0]) {
      setFormPhotoUri(resultat.assets[0].uri);
      setFormPhotoUrlExistante(null);
    }
  };

  const submitEntry = async () => {
    if (!formTitre.trim()) {
      Alert.alert(t.titreRequisTitre, t.titreRequisMsg);
      return;
    }
    if (formCapsule && !formDateRevelation) {
      Alert.alert(t.dateRequiseTitre, t.dateRequiseMsg);
      return;
    }
    setEnvoi(true);
    try {
      if (editId) {
        await modifierJournal(
          editId,
          {
            titre: formTitre.trim(),
            description: formDescription.trim(),
            emoji: formEmoji,
            enfant: formEnfant as any,
            dateRevelation: formCapsule && formDateRevelation ? jourLocal(formDateRevelation) : undefined,
          },
          formPhotoUri ?? undefined
        );
      } else {
        await ajouterJournal(
          {
            id: `j-${Date.now()}`,
            titre: formTitre.trim(),
            description: formDescription.trim(),
            emoji: formEmoji,
            auteurId: parentActif,
            date: aujourdHuiLocal(),
            liked: false,
            enfant: formEnfant as any,
            dateRevelation: formCapsule && formDateRevelation ? jourLocal(formDateRevelation) : undefined,
          },
          formPhotoUri ?? undefined
        );
      }
      setModalVisible(false);
    } finally {
      setEnvoi(false);
    }
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

  const confirmerSuppression = () => {
    if (!confirmDeleteId) return;
    supprimerJournal(confirmDeleteId);
    if (expandedId === confirmDeleteId) setExpandedId(null);
    setConfirmDeleteId(null);
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

        <View style={styles.filterAndCollapseRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={styles.filterRowContent}>
            {FILTRES.map((f) => {
              const active = filtre === f.key || (filtre === 'tous' && f.key === TOUS);
              return (
                <Pressable
                  key={f.key}
                  onPress={() => setFiltre(f.key === TOUS ? 'tous' : f.key)}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                >
                  <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {expandedId ? (
            <Pressable style={styles.collapseAllBtn} onPress={() => setExpandedId(null)}>
              <Text style={styles.collapseAllBtnText}>Tout replier</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <Text style={styles.emptyText}>{t.vide}</Text>
        ) : null}

        {filtered.map((entry) => {
          const author = parents[entry.auteurId]?.nom.split(' ')[0] ?? entry.auteurId;
          const isLocked = !!entry.dateRevelation && depuisJourLocal(entry.dateRevelation) > maintenant;

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

          const isExpanded = expandedId === entry.id;

          if (!isExpanded) {
            // Souvenir replié : vignette carrée (cover, aperçu uniquement),
            // titre, date, enfant, auteur, et un extrait du texte.
            return (
              <Pressable key={entry.id} style={styles.rowCollapsed} onPress={() => toggleExpand(entry.id)}>
                {entry.photoUrl ? (
                  <Image source={{ uri: entry.photoUrl }} style={styles.thumbnail} resizeMode="cover" />
                ) : (
                  <View style={styles.thumbnailEmoji}>
                    <Text style={styles.emoji}>{entry.emoji}</Text>
                  </View>
                )}
                <View style={styles.rowCollapsedTexte}>
                  <View style={styles.rowCollapsedHeader}>
                    <Text style={styles.rowCollapsedTitre} numberOfLines={1}>{entry.titre}</Text>
                    {entry.enfant ? (
                      <View style={styles.enfantPillSmall}>
                        <Text style={styles.enfantPillText}>{entry.enfant}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.rowCollapsedMeta} numberOfLines={1}>
                    {formatDate(entry.date, langue)} · {author}
                  </Text>
                  {entry.description ? (
                    <Text style={styles.rowCollapsedExtrait} numberOfLines={1}>{entry.description}</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={18} color={COLORS.ardoise} />
              </Pressable>
            );
          }

          return (
            <Pressable key={entry.id} style={styles.card} onPress={() => toggleExpand(entry.id)}>
              {entry.photoUrl ? (
                <View style={styles.cardPhotoWrap}>
                  <JournalMemoryImage uri={entry.photoUrl} maxHeight={420} borderRadius={0} />
                </View>
              ) : null}
              <View style={styles.cardBody}>
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
                  <Pressable
                    style={styles.recitBtn}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      openRecitModal(entry.id);
                    }}
                  >
                    <Text style={styles.recitBtnText}>{t.ajouterRegard}</Text>
                  </Pressable>
                )}

                <View style={styles.cardFoot}>
                  <Pressable
                    style={styles.likeBtn}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      likerEntree(entry.id);
                    }}
                  >
                    <HeartIcon size={16} color={entry.liked ? COLORS.terracotta : COLORS.ardoise} filled={entry.liked} strokeWidth={1.8} />
                    <Text style={[styles.likeText, entry.liked && { color: COLORS.terracotta }]}>
                      {entry.liked ? t.jaime : t.aimer}
                    </Text>
                  </Pressable>
                  <View style={styles.cardFootActions}>
                    {entry.dateRevelation ? (
                      <Text style={styles.wasCapsuleText}>{t.capsuleOuverte(formatDate(entry.dateRevelation, langue))}</Text>
                    ) : null}
                    <Pressable
                      style={styles.iconActionBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        openEditModal(entry);
                      }}
                      hitSlop={8}
                    >
                      <Ionicons name="pencil-outline" size={16} color={COLORS.ardoise} />
                    </Pressable>
                    <Pressable
                      style={styles.iconActionBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        setConfirmDeleteId(entry.id);
                      }}
                      hitSlop={8}
                    >
                      <Ionicons name="trash-outline" size={16} color={COLORS.ardoise} />
                    </Pressable>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>{editId ? 'Modifier le souvenir' : t.modalTitre}</Text>

              <Text style={styles.fieldLabel}>Photo (optionnel)</Text>
              {formPhotoUri || formPhotoUrlExistante ? (
                <View style={styles.photoWrap}>
                  <JournalMemoryImage uri={formPhotoUri ?? formPhotoUrlExistante!} maxHeight={260} />
                  <Pressable
                    style={styles.photoRetirer}
                    onPress={() => {
                      setFormPhotoUri(null);
                      setFormPhotoUrlExistante(null);
                    }}
                  >
                    <Ionicons name="trash-outline" size={16} color={COLORS.blanc} />
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.photoBtn} onPress={choisirPhoto}>
                  <Ionicons name="camera-outline" size={22} color={COLORS.vert} />
                  <Text style={styles.photoBtnTxt}>Ajouter une photo</Text>
                </Pressable>
              )}

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
                {[TOUS, ...enfants.map((e) => e.prenom)].map((tag) => {
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
                <Pressable style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setModalVisible(false)} disabled={envoi}>
                  <Text style={styles.modalBtnCancelText}>{t.annuler}</Text>
                </Pressable>
                <Pressable style={[styles.modalBtn, styles.modalBtnSubmit, envoi && { opacity: 0.6 }]} onPress={submitEntry} disabled={envoi}>
                  {envoi ? <ActivityIndicator color={COLORS.blanc} /> : <Text style={styles.modalBtnSubmitText}>{editId ? 'Enregistrer' : t.publier}</Text>}
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

      <Modal visible={!!confirmDeleteId} animationType="fade" transparent onRequestClose={() => setConfirmDeleteId(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.modalTitle}>Supprimer ce souvenir ?</Text>
            <Text style={styles.recitHint}>Cette action est définitive et ne peut pas être annulée.</Text>
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setConfirmDeleteId(null)}>
                <Text style={styles.modalBtnCancelText}>{t.annuler}</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalBtnDelete]} onPress={confirmerSuppression}>
                <Text style={styles.modalBtnSubmitText}>Supprimer</Text>
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
  filterAndCollapseRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.md, gap: SPACING.sm },
  filterRow: { flexGrow: 0, flexShrink: 1 },
  filterRowContent: { gap: SPACING.sm, paddingRight: SPACING.xl },
  filterPill: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.full,
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure,
  },
  filterPillActive: { backgroundColor: COLORS.vertProfond, borderColor: COLORS.vertProfond },
  filterPillText: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.ardoise },
  filterPillTextActive: { color: COLORS.ivoire },
  collapseAllBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full,
    backgroundColor: COLORS.ivoireFonce,
  },
  collapseAllBtnText: { fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.ardoise },
  content: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl * 2 },
  emptyText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise, marginTop: SPACING.xl, textAlign: 'center' },

  // Ligne repliée : vignette + texte + chevron
  rowCollapsed: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure,
    borderRadius: RADIUS.lg, padding: SPACING.sm, marginTop: SPACING.sm,
  },
  thumbnail: { width: 56, height: 56, borderRadius: RADIUS.md, backgroundColor: COLORS.ivoireFonce },
  thumbnailEmoji: {
    width: 56, height: 56, borderRadius: RADIUS.md, backgroundColor: 'rgba(201,168,76,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  rowCollapsedTexte: { flex: 1 },
  rowCollapsedHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  rowCollapsedTitre: { fontFamily: FONTS.bodySemibold, fontSize: 14.5, color: COLORS.vertProfond, flexShrink: 1 },
  rowCollapsedMeta: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, marginTop: 1 },
  rowCollapsedExtrait: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.texte, marginTop: 2 },
  enfantPillSmall: { backgroundColor: 'rgba(45,106,79,0.1)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.full },

  // Carte déployée
  card: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure,
    borderRadius: RADIUS.lg, marginTop: SPACING.sm, overflow: 'hidden',
  },
  cardPhotoWrap: { width: '100%' },
  cardBody: { padding: SPACING.lg + 1 },
  cardLocked: { alignItems: 'center', paddingVertical: SPACING.xl, backgroundColor: 'rgba(107,127,122,0.06)', marginTop: SPACING.sm, borderRadius: RADIUS.lg },
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
  cardFootActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  iconActionBtn: { padding: 2 },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  likeText: { fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.ardoise },
  wasCapsuleText: { fontFamily: FONTS.body, fontSize: 10.5, color: COLORS.or },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(28,43,37,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.ivoire, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl, paddingBottom: SPACING.xxxl, maxHeight: '85%',
  },
  confirmCard: {
    backgroundColor: COLORS.ivoire, borderRadius: RADIUS.xl, margin: SPACING.xl, padding: SPACING.xl,
  },
  modalTitle: { fontFamily: FONTS.display, fontSize: 19, color: COLORS.vertProfond },
  recitHint: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.ardoise, marginTop: 4 },
  fieldLabel: { fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.ardoise, marginTop: SPACING.lg, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10, fontFamily: FONTS.body, fontSize: 14, color: COLORS.vertProfond,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  photoBtn: {
    height: 120, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.bordure, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.blanc,
  },
  photoBtnTxt: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.vert },
  photoWrap: { borderRadius: RADIUS.md, overflow: 'hidden' },
  photoRetirer: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(28,43,37,0.6)', borderRadius: RADIUS.full, padding: 6,
  },
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
  modalBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: RADIUS.md, minHeight: 44 },
  modalBtnCancel: { borderWidth: 1, borderColor: COLORS.bordure },
  modalBtnCancelText: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.ardoise },
  modalBtnSubmit: { backgroundColor: COLORS.vert },
  modalBtnDelete: { backgroundColor: COLORS.terracotta },
  modalBtnSubmitText: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.blanc },
});