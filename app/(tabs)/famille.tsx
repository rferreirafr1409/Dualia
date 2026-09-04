// app/(tabs)/famille.tsx
//
// "Famille" répond à UNE question : qui compose ma famille, et quelles
// sont les informations essentielles de mes enfants ? Pas "où puis-je
// trouver toutes les fonctions de Dualia ?" — ça, c'est déjà le rôle de
// l'accueil (routeur intelligent), de l'Agenda, du + central et de
// Messages. À traiter, Finances et Souvenirs/Journal ont donc quitté cet
// écran : ils ont déjà un point d'entrée clair ailleurs, et les dupliquer
// ici n'ajoutait que de la charge cognitive.

import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { differenceInYears, parseISO } from 'date-fns';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../../store/useStore';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, FONTS } from '../../constants/theme';
import { TRADUCTIONS } from '../../constants/i18n';
import type { ParentRole } from '../../types';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function parentDuJour(date: Date, evs: { dateDebut: string; dateFin: string; parentId: ParentRole }[]): ParentRole | null {
  for (const ev of evs) {
    const debut = new Date(ev.dateDebut);
    const fin = new Date(ev.dateFin);
    if (date >= debut && date <= fin) return ev.parentId;
  }
  return null;
}

export default function FamilleScreen() {
  const router = useRouter();
  const langue = useStore((s) => s.langue);
  const enfants = useStore((s) => s.enfants);
  const evenements = useStore((s) => s.evenements);
  const parents = useStore((s) => s.parents);
  const t = TRADUCTIONS[langue].famille;

  const roleAujourdhui = parentDuJour(new Date(), evenements);
  const nomChezQui = roleAujourdhui ? parents[roleAujourdhui]?.nom.split(' ')[0] : null;

  const age = (dateNaissance?: string) => {
    if (!dateNaissance) return null;
    return differenceInYears(new Date(), parseISO(dateNaissance));
  };

  const espaceFamilial: { icone: IoniconName; couleur: string; fond: string; titre: string; desc: string; route: string }[] = [
    { icone: 'shield-checkmark-outline', couleur: COLORS.vertProfond, fond: '#E8ECEB', titre: t.cadreFamilial, desc: t.cadreFamilialDesc, route: '/validation-cadre' },
    { icone: 'folder-outline', couleur: COLORS.ardoise, fond: '#EEF1F0', titre: t.documents, desc: t.documentsDesc, route: '/documents' },
    { icone: 'business-outline', couleur: COLORS.or, fond: '#FBF3DF', titre: t.administratif, desc: t.administratifDesc, route: '/caf' },
  ];

  return (
    <SafeAreaView style={styles.conteneur} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitre}>{t.titre}</Text>
        <Text style={styles.headerSous}>{t.sousTitre}</Text>
        {nomChezQui ? <Text style={styles.chezQui}>{t.aujourdhuiChez(nomChezQui)}</Text> : null}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {enfants.length === 0 ? (
          <Pressable style={styles.videCard} onPress={() => router.push('/enfants' as any)}>
            <Text style={styles.videTxt}>{t.aucunEnfant}</Text>
            <Text style={styles.videCta}>{t.ajouterEnfantCta}</Text>
          </Pressable>
        ) : (
          enfants.map((e) => {
            const ansEnfant = age(e.dateNaissance);
            return (
              <View key={e.id} style={styles.enfantCard}>
                <View style={styles.enfantHeader}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarTxt}>{e.prenom.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.enfantPrenom}>{e.prenom}</Text>
                    {ansEnfant !== null ? (
                      <Text style={styles.enfantAge}>{ansEnfant} {langue === 'pt' ? 'anos' : 'ans'}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.enfantLiens}>
                  <Pressable style={styles.enfantLien} onPress={() => router.push('/enfants' as any)}>
                    <Ionicons name="medkit-outline" size={15} color={COLORS.terracotta} />
                    <Text style={styles.enfantLienTxt}>{t.sante}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.enfantLien}
                    onPress={() => router.push({ pathname: '/enfant-histoire', params: { prenom: e.prenom } } as any)}
                  >
                    <Ionicons name="book-outline" size={15} color={COLORS.vert} />
                    <Text style={styles.enfantLienTxt}>{t.sonHistoire}</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}

        <Text style={styles.sectionLabel}>{t.notreFamille}</Text>
        {espaceFamilial.map((item) => (
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
  chezQui: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.vert, marginTop: 6 },

  scrollContent: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl },

  videCard: {
    backgroundColor: COLORS.blanc, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.bordure,
    borderStyle: 'dashed', padding: SPACING.xl, alignItems: 'center', marginBottom: SPACING.lg,
  },
  videTxt: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.ardoise, marginBottom: SPACING.sm },
  videCta: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.vert },

  enfantCard: {
    backgroundColor: COLORS.blanc, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  enfantHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.vert,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { fontFamily: FONTS.bodyBold, fontSize: 17, color: COLORS.blanc },
  enfantPrenom: { fontSize: TYPOGRAPHY.lg, fontWeight: TYPOGRAPHY.semibold, color: COLORS.texte },
  enfantAge: { fontSize: TYPOGRAPHY.xs, color: COLORS.ardoise, marginTop: 1 },
  enfantLiens: { flexDirection: 'row', gap: SPACING.sm },
  enfantLien: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.bordure,
  },
  enfantLienTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: TYPOGRAPHY.medium, color: COLORS.texte },

  sectionLabel: {
    fontFamily: FONTS.bodySemibold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase',
    color: COLORS.ardoise, marginTop: SPACING.lg, marginBottom: SPACING.sm, marginLeft: SPACING.xs,
  },

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