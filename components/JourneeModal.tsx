// components/JourneeModal.tsx

import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { isToday, parseISO, format } from 'date-fns';
import { useStore } from '../store/useStore';
import { COLORS, SPACING, FONTS, RADIUS } from '../constants/theme';
import { TRADUCTIONS } from '../constants/i18n';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function JourneeModal({ visible, onClose }: Props) {
  const langue = useStore((s) => s.langue);
  const evenementsCalendrier = useStore((s) => s.evenementsCalendrier);
  const parents = useStore((s) => s.parents);
  const t = TRADUCTIONS[langue];

  // Même source de vérité que "À venir cette semaine" et l'Agenda : les
  // vrais événements du calendrier, filtrés sur aujourd'hui — jamais une
  // liste fictive séparée.
  const evenementsAujourdhui = evenementsCalendrier
    .filter((ev) => isToday(parseISO(ev.date)))
    .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

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
            {evenementsAujourdhui.length === 0 ? (
              <Text style={styles.vide}>{t.calendrier.aucunEvenement}</Text>
            ) : (
              evenementsAujourdhui.map((ev) => {
                const d = parseISO(ev.date);
                const aUneHeure = d.getHours() !== 0 || d.getMinutes() !== 0;
                const estPasse = aUneHeure && d < new Date();
                const parent = ev.parentId ? parents[ev.parentId] : null;
                const qui = ev.enfant
                  ? parent
                    ? `${ev.enfant} · ${parent.nom}`
                    : ev.enfant
                  : parent?.nom ?? '';
                return (
                  <View key={ev.id} style={[styles.ligne, estPasse && styles.lignePassee]}>
                    <View style={[styles.dot, { backgroundColor: estPasse ? COLORS.bordure : parent?.couleur ?? COLORS.vert }]} />
                    <Text style={[styles.time, estPasse && styles.textePasse]}>{aUneHeure ? format(d, 'HH:mm') : '—'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.evTitre, estPasse && styles.textePasse]}>{ev.titre}</Text>
                      {qui ? <Text style={styles.evWho}>{qui}</Text> : null}
                    </View>
                  </View>
                );
              })
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
  lignePassee: { opacity: 0.5 },
  textePasse: { color: COLORS.ardoise },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: SPACING.sm },
  time: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.ardoise, minWidth: 46 },
  evTitre: { fontFamily: FONTS.bodyMedium, fontSize: 16, color: COLORS.texte },
  evWho: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, marginTop: 1 },
});