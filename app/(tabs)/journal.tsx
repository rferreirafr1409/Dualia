import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../../store/useStore';
import { JournalEntry } from '../../types';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../constants/theme';

const EMOJIS_PHOTOS = ['📸', '🌟', '🎉', '🌳', '🏊', '🎂', '🚲', '🎒', '🌺', '⭐', '🎨', '🏖️'];

export default function JournalScreen() {
  const { journalEntries, parentActif, parents, ajouterJournal, likerEntree } = useStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [emojiChoisi, setEmojiChoisi] = useState('📸');

  const parent = parents[parentActif];

  const soumettre = () => {
    if (!titre.trim()) return;
    const entry: JournalEntry = {
      id: `j-${Date.now()}`,
      titre: titre.trim(),
      description: description.trim(),
      emoji: emojiChoisi,
      auteurId: parentActif,
      date: new Date().toISOString(),
      liked: false,
    };
    ajouterJournal(entry);
    setTitre('');
    setDescription('');
    setEmojiChoisi('📸');
    setModalVisible(false);
  };

  const entreesSortées = [...journalEntries].sort(
    (a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()
  );

  return (
    <SafeAreaView style={styles.conteneur} edges={['top', 'bottom']}>
      <LinearGradient colors={[COLORS.vert, '#3D8B6A']} style={styles.header}>
        <View>
          <Text style={styles.headerTitre}>Journal de famille</Text>
          <Text style={styles.headerSous}>Vos souvenirs partagés</Text>
        </View>
        <View style={[styles.parentBadge, { backgroundColor: parent.couleur }]}>
          <Text style={styles.parentBadgeTxt}>
            {parent.nom.split(' ')[0][0]}
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {entreesSortées.map((entry) => {
          const auteur = parents[entry.auteurId];
          return (
            <View key={entry.id} style={styles.carte}>
              <View style={[styles.photoSimulee, { backgroundColor: auteur.couleur + '18' }]}>
                <Text style={styles.photoEmoji}>{entry.emoji}</Text>
              </View>
              <View style={styles.contenu}>
                <View style={styles.metaRow}>
                  <View style={[styles.auteurDot, { backgroundColor: auteur.couleur }]} />
                  <Text style={styles.auteurNom}>{auteur.nom.split(' ')[0]}</Text>
                  <Text style={styles.dateText}>
                    {format(parseISO(entry.date), 'd MMM yyyy', { locale: fr })}
                  </Text>
                </View>
                <Text style={styles.entreTitre}>{entry.titre}</Text>
                {entry.description ? (
                  <Text style={styles.entreDesc}>{entry.description}</Text>
                ) : null}
                <TouchableOpacity
                  style={styles.likeBtn}
                  onPress={() => likerEntree(entry.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={entry.liked ? 'heart' : 'heart-outline'}
                    size={16}
                    color={entry.liked ? '#E74C3C' : COLORS.ardoise}
                  />
                  <Text style={[styles.likeTxt, entry.liked && styles.likeTxtActif]}>
                    {entry.liked ? 'Aimé' : 'Aimer'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bouton flottant */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <LinearGradient colors={[COLORS.vert, '#3D8B6A']} style={styles.fabGradient}>
          <Ionicons name="add" size={22} color={COLORS.blanc} />
          <Text style={styles.fabTxt}>Ajouter un souvenir</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Modal ajout */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modal}>
            <View style={styles.modalPoignee} />
            <Text style={styles.modalTitre}>Nouveau souvenir</Text>

            <Text style={styles.label}>Photo (emoji)</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.emojiRow}
            >
              {EMOJIS_PHOTOS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={[styles.emojiOpt, emojiChoisi === emoji && styles.emojiActif]}
                  onPress={() => setEmojiChoisi(emoji)}
                >
                  <Text style={styles.emojiOptTxt}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Titre</Text>
            <TextInput
              style={styles.input}
              value={titre}
              onChangeText={setTitre}
              placeholder="Ex : Premier jour d'école Emma"
              placeholderTextColor={COLORS.ardoise}
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={description}
              onChangeText={setDescription}
              placeholder="Décrivez ce beau moment..."
              placeholderTextColor={COLORS.ardoise}
              multiline
              numberOfLines={3}
            />

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.btnAnnuler}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.btnAnnulerTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnValider, !titre.trim() && styles.btnDisabled]}
                onPress={soumettre}
                disabled={!titre.trim()}
              >
                <Text style={styles.btnValiderTxt}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: COLORS.ivoire },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  headerTitre: {
    fontSize: TYPOGRAPHY.xl,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.blanc,
  },
  headerSous: {
    fontSize: TYPOGRAPHY.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: SPACING.xs,
  },
  parentBadge: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentBadgeTxt: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.blanc,
  },

  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.lg },

  carte: {
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  photoSimulee: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmoji: { fontSize: 52 },
  contenu: { padding: SPACING.lg },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  auteurDot: { width: 8, height: 8, borderRadius: RADIUS.full },
  auteurNom: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.texte,
  },
  dateText: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.ardoise,
    marginLeft: 'auto',
  },
  entreTitre: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.texte,
    marginBottom: SPACING.xs,
  },
  entreDesc: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.texteMuted,
    lineHeight: 20,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.md,
    alignSelf: 'flex-end',
  },
  likeTxt: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.ardoise,
  },
  likeTxtActif: { color: '#E74C3C' },

  fab: {
    position: 'absolute',
    bottom: SPACING.xl,
    left: SPACING.xl,
    right: SPACING.xl,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    shadowColor: COLORS.vert,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  fabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
  },
  fabTxt: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.blanc,
  },

  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modal: {
    backgroundColor: COLORS.blanc,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  modalPoignee: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.bordure,
    borderRadius: RADIUS.full,
    alignSelf: 'center',
    marginBottom: SPACING.xl,
  },
  modalTitre: {
    fontSize: TYPOGRAPHY.xl,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.texte,
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.ardoise,
    letterSpacing: 1,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
  emojiRow: { marginBottom: SPACING.lg },
  emojiOpt: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.ivoireFonce,
    marginRight: SPACING.sm,
  },
  emojiActif: {
    backgroundColor: COLORS.vert + '22',
    borderWidth: 2,
    borderColor: COLORS.vert,
  },
  emojiOptTxt: { fontSize: 24 },
  input: {
    backgroundColor: COLORS.ivoireFonce,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.texte,
    marginBottom: SPACING.lg,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  btnAnnuler: {
    flex: 1,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.ivoireFonce,
    alignItems: 'center',
  },
  btnAnnulerTxt: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.ardoise,
    fontWeight: TYPOGRAPHY.medium,
  },
  btnValider: {
    flex: 2,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.vert,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.45 },
  btnValiderTxt: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.blanc,
    fontWeight: TYPOGRAPHY.semibold,
  },
});
