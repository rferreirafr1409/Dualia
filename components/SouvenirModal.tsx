// components/SouvenirModal.tsx

import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store/useStore';
import { COLORS, SPACING, FONTS, RADIUS } from '../constants/theme';
import { TRADUCTIONS } from '../constants/i18n';
import type { JournalEntry } from '../types';

type Props = {
  visible: boolean;
  onClose: () => void;
  entry: JournalEntry | null;
  ilYaUnAn: boolean;
};

export default function SouvenirModal({ visible, onClose, entry, ilYaUnAn }: Props) {
  const langue = useStore((s) => s.langue);
  const parents = useStore((s) => s.parents);
  const t = TRADUCTIONS[langue];

  if (!entry) return null;

  const dateEntry = new Date(entry.date).toLocaleDateString(langue === 'pt' ? 'pt-PT' : 'fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const auteurNom = parents[entry.auteurId]?.nom.split(' ')[0] ?? '';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.carte} onPress={(e) => e.stopPropagation()}>
          <View style={styles.poignee} />
          <View style={styles.header}>
            <Text style={styles.eyebrow}>
              {ilYaUnAn ? t.accueil.souvenirIlYaUnAn : t.accueil.souvenirRecent}
            </Text>
            <Pressable onPress={onClose} style={styles.fermerBtn}>
              <Ionicons name="close" size={20} color={COLORS.ardoise} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 420 }}>
            <Text style={styles.emoji}>{entry.emoji}</Text>
            <Text style={styles.titre}>{entry.titre}</Text>
            <Text style={styles.meta}>{dateEntry} · {auteurNom}</Text>
            <Text style={styles.description}>{entry.description}</Text>

            {entry.recitCroise ? (
              <View style={styles.recitBloc}>
                <Text style={styles.recitEyebrow}>{t.journal.regardCroise}</Text>
                <Text style={styles.recitTexte}>{entry.recitCroise}</Text>
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(28,43,37,0.5)', justifyContent: 'flex-end' },
  carte: {
    backgroundColor: COLORS.blanc,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  poignee: { width: 36, height: 4, backgroundColor: COLORS.bordure, borderRadius: RADIUS.full, alignSelf: 'center', marginBottom: SPACING.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: SPACING.sm },
  eyebrow: {
    fontFamily: FONTS.bodySemibold, fontSize: 11, color: COLORS.terracotta,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  fermerBtn: { padding: SPACING.xs },
  emoji: { fontSize: 34, marginBottom: SPACING.sm },
  titre: { fontFamily: FONTS.display, fontSize: 20, color: COLORS.vertProfond, marginBottom: 4 },
  meta: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, marginBottom: SPACING.md },
  description: { fontFamily: FONTS.body, fontSize: 16, color: COLORS.texte, lineHeight: 22 },
  recitBloc: { marginTop: SPACING.lg, padding: SPACING.md, backgroundColor: COLORS.ivoireFonce, borderRadius: RADIUS.md },
  recitEyebrow: {
    fontFamily: FONTS.bodySemibold, fontSize: 11, color: COLORS.vert,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4,
  },
  recitTexte: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.texte, lineHeight: 20 },
});