// app/semaine-activites.tsx

import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isToday, parseISO, format,
} from 'date-fns';
import { fr, pt } from 'date-fns/locale';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store/useStore';
import { COLORS, SPACING, FONTS, RADIUS } from '../constants/theme';
import { TRADUCTIONS } from '../constants/i18n';

const LOCALES = { fr, pt };

export default function SemaineActivitesScreen() {
  const router = useRouter();
  const langue = useStore((s) => s.langue);
  const evenementsCalendrier = useStore((s) => s.evenementsCalendrier);
  const parents = useStore((s) => s.parents);
  const t = TRADUCTIONS[langue];
  const dateLocale = LOCALES[langue];

  const debutSemaine = startOfWeek(new Date(), { weekStartsOn: 1 });
  const finSemaine = endOfWeek(new Date(), { weekStartsOn: 1 });
  const joursSemaine = eachDayOfInterval({ start: debutSemaine, end: finSemaine });

  return (
    <SafeAreaView style={styles.conteneur} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.retourBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.vertProfond} />
        </Pressable>
        <Text style={styles.headerTitre}>{t.semaine.titre}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {joursSemaine.map((jour) => {
          const evsJour = evenementsCalendrier
            .filter((ev) => isSameDay(parseISO(ev.date), jour))
            .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
          const aujourdhui = isToday(jour);

          return (
            <View key={jour.toISOString()} style={styles.jourBloc}>
              <View style={styles.jourHeader}>
                <Text style={[styles.jourNom, aujourdhui && styles.jourNomAujourdhui]}>
                  {format(jour, 'EEEE d MMMM', { locale: dateLocale })}
                </Text>
                {aujourdhui ? (
                  <View style={styles.badgeAujourdhui}>
                    <Text style={styles.badgeAujourdhuiTxt}>{t.semaine.aujourdhuiLabel}</Text>
                  </View>
                ) : null}
              </View>

              {evsJour.length === 0 ? (
                <Text style={styles.videTxt}>{t.semaine.aucuneActivite}</Text>
              ) : (
                evsJour.map((ev) => {
                  const d = parseISO(ev.date);
                  const aUneHeure = d.getHours() !== 0 || d.getMinutes() !== 0;
                  const parent = ev.parentId ? parents[ev.parentId] : null;
                  return (
                    <View key={ev.id} style={styles.evLigne}>
                      <View style={[styles.evDot, { backgroundColor: parent?.couleur ?? COLORS.ardoise }]} />
                      <Text style={styles.evHeure}>{aUneHeure ? format(d, 'HH:mm') : '—'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.evTitre}>{ev.titre}</Text>
                        {parent ? <Text style={styles.evParent}>{parent.nom}</Text> : null}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          );
        })}
        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: COLORS.ivoire },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.md,
  },
  retourBtn: { padding: SPACING.xs },
  headerTitre: { fontFamily: FONTS.display, fontSize: 18, color: COLORS.vertProfond },

  content: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm },

  jourBloc: { marginBottom: SPACING.xl },
  jourHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  jourNom: {
    fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.texte, textTransform: 'capitalize',
  },
  jourNomAujourdhui: { color: COLORS.vertProfond },
  badgeAujourdhui: { backgroundColor: COLORS.or, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  badgeAujourdhuiTxt: { fontFamily: FONTS.bodyBold, fontSize: 10, color: COLORS.vertProfond },

  videTxt: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, fontStyle: 'italic', paddingLeft: SPACING.sm },

  evLigne: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.blanc, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.bordure,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  evDot: { width: 8, height: 8, borderRadius: 4, marginRight: SPACING.sm },
  evHeure: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.ardoise, minWidth: 46 },
  evTitre: { fontFamily: FONTS.bodyMedium, fontSize: 16, color: COLORS.texte },
  evParent: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.ardoise, marginTop: 1 },
});