// components/MemoryAccordionRow.tsx
//
// Bandeau compact repliable, partagé entre Journal et "Son histoire" —
// même UX pour le même objet "souvenir". Fermé : miniature + titre + date
// + extrait. Ouvert : le contenu (photo complète, texte, actions) passé
// en children est révélé — jamais rendu tant que fermé.

import { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import MemoryThumbnail from './MemoryThumbnail';

interface MemoryAccordionRowProps {
  isExpanded: boolean;
  onToggle: () => void;
  photoUrl?: string;
  emoji?: string;
  titre: string;
  meta: string;
  extrait?: string;
  enfantLabel?: string;
  children: ReactNode;
}

export default function MemoryAccordionRow({
  isExpanded, onToggle, photoUrl, emoji, titre, meta, extrait, enfantLabel, children,
}: MemoryAccordionRowProps) {
  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={onToggle}>
        <MemoryThumbnail photoUrl={photoUrl} emoji={emoji} size={56} />
        <View style={styles.headerTexte}>
          <View style={styles.headerLigne}>
            <Text style={styles.titre} numberOfLines={1}>{titre}</Text>
            {enfantLabel ? (
              <View style={styles.enfantPill}>
                <Text style={styles.enfantPillTxt}>{enfantLabel}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
          {!isExpanded && extrait ? (
            <Text style={styles.extrait} numberOfLines={1}>{extrait}</Text>
          ) : null}
        </View>
        <Ionicons name={isExpanded ? 'chevron-down' : 'chevron-forward'} size={18} color={COLORS.ardoise} />
      </Pressable>
      {isExpanded ? <View style={styles.expanded}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure,
    borderRadius: RADIUS.lg, marginTop: SPACING.sm, overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.sm },
  headerTexte: { flex: 1 },
  headerLigne: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  titre: { fontFamily: FONTS.bodySemibold, fontSize: 14.5, color: COLORS.vertProfond, flexShrink: 1 },
  meta: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, marginTop: 1 },
  extrait: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.texte, marginTop: 2 },
  enfantPill: { backgroundColor: 'rgba(45,106,79,0.1)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.full },
  enfantPillTxt: { fontFamily: FONTS.bodySemibold, fontSize: 10.5, color: COLORS.vert },
  expanded: { borderTopWidth: 1, borderTopColor: COLORS.bordure },
});