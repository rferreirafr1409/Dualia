// components/JourneeModal.tsx

import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store/useStore';
import { COLORS, SPACING, FONTS, RADIUS } from '../constants/theme';
import { TRADUCTIONS } from '../constants/i18n';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function JourneeModal({ visible, onClose }: Props) {
  const langue = useStore((s) => s.langue);
  const todayEvents = useStore((s) => s.todayEvents);
  const t = TRADUCTIONS[langue];

  const dateAujourdhui = new Date().toLocaleDateString(langue === 'pt' ? 'pt-PT' : 'fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.carte} onPress={(e) => e.stopPropagation()}>
          <View style={styles.poignee} />
          <View style={styles.header}>
            <View>
              <Text style={styles.titre}>{t.accueil.aujourdhui}</Text>
              <Text style={styles.date}>{dateAujourdhui}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.fermerBtn}>
              <Ionicons name="close" size={20} color={COLORS.ardoise} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 360 }}>
            {todayEvents.length === 0 ? (
              <Text style={styles.vide}>{t.calendrier.aucunEvenement}</Text>
            ) : (
              todayEvents.map((event) => (
                <View key={event.id} style={styles.ligne}>
                  <View style={styles.dot} />
                  <Text style={styles.time}>{event.time}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.evTitre}>{event.title}</Text>
                    <Text style={styles.evWho}>{event.who}</Text>
                  </View>
                </View>
              ))
            )}
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
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: SPACING.lg },
  titre: { fontFamily: FONTS.display, fontSize: 20, color: COLORS.vertProfond },
  date: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, marginTop: 2, textTransform: 'capitalize' },
  fermerBtn: { padding: SPACING.xs },
  vide: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.ardoise, textAlign: 'center', paddingVertical: SPACING.xl },
  ligne: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.bordure,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.vert, marginRight: SPACING.sm },
  time: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.ardoise, minWidth: 46 },
  evTitre: { fontFamily: FONTS.bodyMedium, fontSize: 16, color: COLORS.texte },
  evWho: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, marginTop: 1 },
});