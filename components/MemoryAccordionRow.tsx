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
  // 'carte' (défaut) : boîte blanche bordée, comme dans le Journal.
  // 'nu' : sans boîte ni trait, vignette plus grande, titre sur deux lignes —
  // pour l'accueil, où la hiérarchie typographique suffit.
  variante?: 'carte' | 'nu';
}

export default function MemoryAccordionRow({
  isExpanded, onToggle, photoUrl, emoji, titre, meta, extrait, enfantLabel, children, variante = 'carte',
}: MemoryAccordionRowProps) {
  const nu = variante === 'nu';
  return (
    <View style={nu ? styles.nu : styles.card}>
      <Pressable style={[styles.header, nu && styles.headerNu]} onPress={onToggle}>
        <MemoryThumbnail photoUrl={photoUrl} emoji={emoji} size={nu ? 84 : 56} />
        <View style={styles.headerTexte}>
          <View style={styles.headerLigne}>
            <Text style={styles.titre} numberOfLines={nu ? 2 : 1}>{titre}</Text>
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
  nu: { marginTop: SPACING.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.sm },
  headerNu: { paddingHorizontal: 0, gap: SPACING.md },
  headerTexte: { flex: 1 },
  headerLigne: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  titre: { fontFamily: FONTS.bodySemibold, fontSize: 14.5, color: COLORS.vertProfond, flexShrink: 1 },
  meta: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, marginTop: 1 },
  extrait: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.texte, marginTop: 2 },
  enfantPill: { backgroundColor: 'rgba(45,106,79,0.1)', paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.full },
  enfantPillTxt: { fontFamily: FONTS.bodySemibold, fontSize: 10.5, color: COLORS.vert },
  expanded: { borderTopWidth: 1, borderTopColor: COLORS.bordure },
});