// components/AjoutRapideModal.tsx

import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store/useStore';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, FONTS } from '../constants/theme';
import { TRADUCTIONS } from '../constants/i18n';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function AjoutRapideModal({ visible, onClose }: Props) {
  const router = useRouter();
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].echanges;
  const tFil = TRADUCTIONS[langue].filDeVie;

  // "Partager un moment" est volontairement mis en avant, en premier : ce
  // n'est pas seulement une appli pour déclarer des problèmes et des
  // dépenses — Dualia raconte aussi ce que vivent les enfants au quotidien.
  const options: { icone: IoniconName; label: string; route: string }[] = [
    { icone: 'calendar-outline', label: t.ajoutEvenement, route: '/calendrier' },
    { icone: 'checkmark-circle-outline', label: t.ajoutDecision, route: '/decisions' },
    { icone: 'wallet-outline', label: t.ajoutDepense, route: '/finances' },
    { icone: 'heart-outline', label: t.ajoutSouvenir, route: '/journal' },
    { icone: 'document-text-outline', label: t.ajoutDocument, route: '/documents' },
  ];

  const choisir = (route: string) => {
    onClose();
    router.push(route as any);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.carte} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.titre}>{t.quickAjout}</Text>

          <Pressable style={styles.momentBtn} onPress={() => choisir('/partager-moment')}>
            <View style={styles.momentIcone}>
              <Ionicons name="camera" size={20} color={COLORS.blanc} />
            </View>
            <Text style={styles.momentTxt}>{tFil.partager}</Text>
          </Pressable>

          <View style={styles.grille}>
            {options.map((opt) => (
              <Pressable key={opt.route} style={styles.option} onPress={() => choisir(opt.route)}>
                <View style={styles.optionIcone}>
                  <Ionicons name={opt.icone} size={22} color={COLORS.vertProfond} />
                </View>
                <Text style={styles.optionLabel}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.fermer} onPress={onClose}>
            <Ionicons name="close" size={20} color={COLORS.ardoise} />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(28,43,37,0.5)', alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  carte: {
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 360,
  },
  titre: { fontFamily: FONTS.display, fontSize: 18, color: COLORS.vertProfond, textAlign: 'center', marginBottom: SPACING.lg },

  momentBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.terracotta, borderRadius: RADIUS.md,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg, marginBottom: SPACING.lg,
  },
  momentIcone: {
    width: 32, height: 32, borderRadius: RADIUS.full, backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center', justifyContent: 'center',
  },
  momentTxt: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.blanc },

  grille: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  option: { width: '30%', alignItems: 'center', marginBottom: SPACING.lg },
  optionIcone: {
    width: 52, height: 52, borderRadius: RADIUS.full,
    backgroundColor: COLORS.ivoireFonce, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.xs,
  },
  optionLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.texte, textAlign: 'center', fontWeight: TYPOGRAPHY.medium },
  fermer: { alignSelf: 'center', padding: SPACING.sm, marginTop: SPACING.xs },
});