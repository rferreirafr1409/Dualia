// app/(tabs)/famille.tsx

import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../../store/useStore';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, FONTS } from '../../constants/theme';
import { TRADUCTIONS } from '../../constants/i18n';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function FamilleScreen() {
  const router = useRouter();
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].famille;

  const items: { icone: IoniconName; couleur: string; fond: string; titre: string; desc: string; route: string }[] = [
    { icone: 'checkmark-circle-outline', couleur: COLORS.or, fond: '#FBF3DF', titre: t.decisions, desc: t.decisionsDesc, route: '/decisions' },
    { icone: 'book-outline', couleur: COLORS.vert, fond: '#EEF1F0', titre: t.journal, desc: t.journalDesc, route: '/journal' },
    { icone: 'medkit-outline', couleur: COLORS.terracotta, fond: '#F7EEE9', titre: t.sante, desc: t.santeDesc, route: '/enfants' },
    { icone: 'wallet-outline', couleur: COLORS.or, fond: '#FBF3DF', titre: t.finances, desc: t.financesDesc, route: '/finances' },
    { icone: 'folder-outline', couleur: COLORS.ardoise, fond: '#EEF1F0', titre: t.documents, desc: t.documentsDesc, route: '/documents' },
    { icone: 'business-outline', couleur: COLORS.vertProfond, fond: '#E8ECEB', titre: t.administratif, desc: t.administratifDesc, route: '/caf' },
  ];

  return (
    <SafeAreaView style={styles.conteneur} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitre}>{t.titre}</Text>
        <Text style={styles.headerSous}>{t.sousTitre}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {items.map((item) => (
          <Pressable key={item.route} style={styles.ligne} onPress={() => router.push(item.route as any)}>
            <View style={[styles.iconWrap, { backgroundColor: item.fond }]}>
              <Ionicons name={item.icone} size={20} color={item.couleur} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ligneTitre}>{item.titre}</Text>
              <Text style={styles.ligneDesc}>{item.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.ardoise} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: COLORS.ivoire },
  header: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.lg },
  headerTitre: { fontFamily: FONTS.display, fontSize: 24, color: COLORS.vertProfond },
  headerSous: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, marginTop: 3 },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
  },
  ligneTitre: { fontSize: TYPOGRAPHY.md, fontWeight: TYPOGRAPHY.semibold, color: COLORS.texte },
  ligneDesc: { fontSize: TYPOGRAPHY.xs, color: COLORS.ardoise, marginTop: 2 },
});