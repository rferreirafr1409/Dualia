// app/fil-de-vie.tsx

import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { isToday, isYesterday, parseISO, format } from 'date-fns';
import { fr, pt } from 'date-fns/locale';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store/useStore';
import { COLORS, SPACING, FONTS, RADIUS } from '../constants/theme';
import { TRADUCTIONS } from '../constants/i18n';

const LOCALES = { fr, pt };

export default function FilDeVieScreen() {
  const router = useRouter();
  const langue = useStore((s) => s.langue);
  const dateLocale = LOCALES[langue];
  const moments = useStore((s) => s.moments);
  const enfants = useStore((s) => s.enfants);
  const parents = useStore((s) => s.parents);
  const parentActif = useStore((s) => s.parentActif);
  const reagirMoment = useStore((s) => s.reagirMoment);
  const t = TRADUCTIONS[langue].filDeVie;

  const [filtre, setFiltre] = useState<string | null>(null);

  const filtres = [t.tous, ...enfants.map((e) => e.prenom)];

  const filtered = useMemo(() => {
    if (!filtre || filtre === t.tous) return moments;
    return moments.filter((m) => m.enfant === filtre);
  }, [moments, filtre, t.tous]);

  const labelJour = (iso: string) => {
    const d = parseISO(iso);
    if (isToday(d)) return t.aujourdhui;
    if (isYesterday(d)) return t.hier;
    return format(d, 'EEEE d MMMM', { locale: dateLocale });
  };

  return (
    <SafeAreaView style={styles.conteneur} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.retourBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.vertProfond} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitre}>{t.titre}</Text>
          <Text style={styles.headerSous}>{t.sousTitre}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtresScroll} contentContainerStyle={styles.filtresContent}>
        {filtres.map((f) => {
          const actif = filtre === f || (!filtre && f === t.tous);
          return (
            <Pressable
              key={f}
              style={[styles.filtrePill, actif && styles.filtrePillActif]}
              onPress={() => setFiltre(f === t.tous ? null : f)}
            >
              <Text style={[styles.filtrePillTxt, actif && styles.filtrePillTxtActif]}>{f}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <Text style={styles.vide}>{t.aucunMoment}</Text>
        ) : (
          filtered.map((m) => {
            const auteur = parents[m.auteurId]?.nom.split(' ')[0] ?? '';
            const jaime = m.aimePar.includes(parentActif);
            return (
              <View key={m.id} style={styles.carte}>
                {m.photoUrl ? (
                  <Image source={{ uri: m.photoUrl }} style={styles.photo} />
                ) : null}
                <View style={styles.carteCorps}>
                  <View style={styles.carteHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.carteMeta}>
                        {labelJour(m.createdAt)} · {t.partagePar(auteur)}
                      </Text>
                    </View>
                    {m.enfant ? (
                      <View style={styles.enfantPill}>
                        <Text style={styles.enfantPillTxt}>{m.enfant}</Text>
                      </View>
                    ) : null}
                  </View>
                  {m.texte ? <Text style={styles.carteTexte}>{m.texte}</Text> : null}
                  <Pressable style={styles.reagirBtn} onPress={() => reagirMoment(m.id)}>
                    <Ionicons
                      name={jaime ? 'heart' : 'heart-outline'}
                      size={18}
                      color={jaime ? COLORS.terracotta : COLORS.ardoise}
                    />
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => router.push('/partager-moment' as any)}>
        <Ionicons name="add" size={20} color={COLORS.blanc} />
        <Text style={styles.fabTxt}>{t.partager}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: COLORS.ivoire },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm,
  },
  retourBtn: { padding: SPACING.xs, marginTop: 2 },
  headerTitre: { fontFamily: FONTS.display, fontSize: 20, color: COLORS.vertProfond },
  headerSous: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, marginTop: 2 },

  filtresScroll: { flexGrow: 0, marginBottom: SPACING.md },
  filtresContent: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  filtrePill: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.bordure, backgroundColor: COLORS.blanc, marginRight: SPACING.sm,
  },
  filtrePillActif: { backgroundColor: COLORS.vert, borderColor: COLORS.vert },
  filtrePillTxt: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.texte },
  filtrePillTxtActif: { color: COLORS.blanc },

  content: { paddingHorizontal: SPACING.xl, paddingBottom: 100 },
  vide: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.ardoise, textAlign: 'center', paddingVertical: SPACING.xxxl },

  carte: {
    backgroundColor: COLORS.blanc, borderRadius: RADIUS.lg, overflow: 'hidden',
    marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.bordure,
  },
  photo: { width: '100%', height: 240, backgroundColor: COLORS.ivoireFonce },
  carteCorps: { padding: SPACING.lg },
  carteHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.xs },
  carteMeta: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.ardoise },
  enfantPill: { backgroundColor: COLORS.ivoireFonce, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  enfantPillTxt: { fontFamily: FONTS.bodySemibold, fontSize: 11, color: COLORS.vertProfond },
  carteTexte: { fontFamily: FONTS.bodyMedium, fontSize: 15.5, color: COLORS.texte, lineHeight: 21, marginBottom: SPACING.sm },
  reagirBtn: { alignSelf: 'flex-start', padding: SPACING.xs },

  fab: {
    position: 'absolute', bottom: SPACING.xl, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.vert, borderRadius: RADIUS.full,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5,
  },
  fabTxt: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.blanc },
});