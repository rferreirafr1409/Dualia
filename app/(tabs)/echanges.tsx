// app/(tabs)/echanges.tsx

import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../../store/useStore';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, FONTS } from '../../constants/theme';
import { TRADUCTIONS } from '../../constants/i18n';

export default function EchangesScreen() {
  const router = useRouter();
  const messages = useStore((s) => s.messages);
  const decisions = useStore((s) => s.decisions);
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].echanges;

  const dernierMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const decisionsEnAttente = decisions.filter(
    (d) => d.statut === 'proposée' || d.statut === 'en_attente'
  );

  return (
    <SafeAreaView style={styles.conteneur} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitre}>{t.titre}</Text>
        <Text style={styles.headerSous}>{t.sousTitre}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Pressable style={styles.carte} onPress={() => router.push('/messagerie' as any)}>
          <View style={styles.carteHeader}>
            <View style={[styles.iconWrap, { backgroundColor: '#EEF1F0' }]}>
              <Ionicons name="chatbubbles-outline" size={20} color={COLORS.vert} />
            </View>
            <Text style={styles.carteTitre}>{t.conversations}</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.ardoise} />
          </View>
          <Text style={styles.cartePreview} numberOfLines={2}>
            {dernierMessage ? dernierMessage.contenu : t.aucunMessage}
          </Text>
        </Pressable>

        <Pressable style={styles.carte} onPress={() => router.push('/decisions' as any)}>
          <View style={styles.carteHeader}>
            <View style={[styles.iconWrap, { backgroundColor: '#F7EEE9' }]}>
              <Ionicons name="document-text-outline" size={20} color={COLORS.terracotta} />
            </View>
            <Text style={styles.carteTitre}>{t.decisions}</Text>
            {decisionsEnAttente.length > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{decisionsEnAttente.length}</Text>
              </View>
            ) : null}
            <Ionicons name="chevron-forward" size={18} color={COLORS.ardoise} />
          </View>
          <Text style={styles.cartePreview}>
            {decisionsEnAttente.length > 0
              ? t.decisionEnAttente(decisionsEnAttente.length)
              : t.aucuneDecisionAttente}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: COLORS.ivoire },
  header: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.lg },
  headerTitre: { fontFamily: FONTS.display, fontSize: 24, color: COLORS.vertProfond },
  headerSous: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, marginTop: 3 },
  scrollContent: { padding: SPACING.lg, gap: SPACING.md },
  carte: {
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  carteHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  iconWrap: {
    width: 36, height: 36, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
  },
  carteTitre: { flex: 1, fontSize: TYPOGRAPHY.md, fontWeight: TYPOGRAPHY.semibold, color: COLORS.texte },
  badge: {
    backgroundColor: COLORS.or, borderRadius: RADIUS.full,
    minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  badgeTxt: { fontSize: 11, fontWeight: TYPOGRAPHY.bold, color: COLORS.vertProfond },
  cartePreview: { fontSize: TYPOGRAPHY.sm, color: COLORS.ardoise, marginTop: SPACING.sm },
});