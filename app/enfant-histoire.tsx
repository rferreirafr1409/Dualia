// app/enfant-histoire.tsx

import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { fr, pt } from 'date-fns/locale';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store/useStore';
import { COLORS, SPACING, FONTS, RADIUS } from '../constants/theme';
import { TRADUCTIONS } from '../constants/i18n';
import { LockIcon, HeartIcon } from '../components/icons';

const LOCALES = { fr, pt };

function formatDate(isoDate: string, langue: 'fr' | 'pt') {
  const d = new Date(isoDate);
  return d.toLocaleDateString(langue === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function EnfantHistoireScreen() {
  const router = useRouter();
  const { prenom } = useLocalSearchParams<{ prenom: string }>();
  const langue = useStore((s) => s.langue);
  const dateLocale = LOCALES[langue];
  const entries = useStore((s) => s.journalEntries);
  const parents = useStore((s) => s.parents);
  const t = TRADUCTIONS[langue].histoireEnfant;

  const [onglet, setOnglet] = useState<'chronologie' | 'capsules'>('chronologie');

  // Un enfant voit aussi les souvenirs marqués "Tous" (les deux enfants) —
  // pas seulement ceux qui portent son prénom exact.
  const entreesEnfant = useMemo(
    () => entries.filter((e) => e.enfant === prenom || e.enfant === 'Tous'),
    [entries, prenom]
  );

  const maintenant = new Date();

  const chronologie = useMemo(
    () =>
      entreesEnfant
        .filter((e) => !e.dateRevelation || new Date(e.dateRevelation) <= maintenant)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [entreesEnfant]
  );

  const capsules = useMemo(
    () =>
      entreesEnfant
        .filter((e) => !!e.dateRevelation)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [entreesEnfant]
  );

  const liste = onglet === 'chronologie' ? chronologie : capsules;

  // Regroupe par mois ("Septembre 2026"), dans l'ordre où les entrées
  // arrivent (déjà triées du plus récent au plus ancien).
  const groupes = useMemo(() => {
    const map = new Map<string, typeof liste>();
    liste.forEach((entry) => {
      const cle = format(parseISO(entry.date), 'MMMM yyyy', { locale: dateLocale });
      if (!map.has(cle)) map.set(cle, []);
      map.get(cle)!.push(entry);
    });
    return Array.from(map.entries());
  }, [liste, dateLocale]);

  return (
    <SafeAreaView style={styles.conteneur} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.retourBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.vertProfond} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitre}>{t.titre(prenom ?? '')}</Text>
          <Text style={styles.headerSous}>{t.sousTitre}</Text>
        </View>
      </View>

      <View style={styles.onglets}>
        <Pressable
          style={[styles.onglet, onglet === 'chronologie' && styles.ongletActif]}
          onPress={() => setOnglet('chronologie')}
        >
          <Text style={[styles.ongletTxt, onglet === 'chronologie' && styles.ongletTxtActif]}>{t.chronologie}</Text>
        </Pressable>
        <Pressable
          style={[styles.onglet, onglet === 'capsules' && styles.ongletActif]}
          onPress={() => setOnglet('capsules')}
        >
          <Text style={[styles.ongletTxt, onglet === 'capsules' && styles.ongletTxtActif]}>{t.capsules}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {liste.length === 0 ? (
          <Text style={styles.vide}>{onglet === 'chronologie' ? t.aucunSouvenir : t.aucuneCapsule}</Text>
        ) : (
          groupes.map(([mois, entriesDuMois]) => (
            <View key={mois} style={styles.moisBloc}>
              <Text style={styles.moisTitre}>{mois}</Text>
              {entriesDuMois.map((entry) => {
                const isLocked = !!entry.dateRevelation && new Date(entry.dateRevelation) > maintenant;
                const author = parents[entry.auteurId]?.nom.split(' ')[0] ?? entry.auteurId;

                if (isLocked) {
                  return (
                    <View key={entry.id} style={styles.ligneLocked}>
                      <View style={styles.iconWrapLocked}>
                        <LockIcon size={16} color={COLORS.ardoise} strokeWidth={1.8} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ligneTitreLocked}>{t.capsules}</Text>
                        <Text style={styles.ligneMeta}>
                          {author} · révélation le {formatDate(entry.dateRevelation!, langue)}
                        </Text>
                      </View>
                    </View>
                  );
                }

                return (
                  <View key={entry.id} style={styles.ligne}>
                    <View style={styles.iconWrap}>
                      <Text style={styles.emoji}>{entry.emoji}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ligneTitre}>{entry.titre}</Text>
                      <Text style={styles.ligneMeta}>
                        {formatDate(entry.date, langue)} · {author}
                      </Text>
                    </View>
                    {entry.liked ? <HeartIcon size={15} color={COLORS.terracotta} filled strokeWidth={1.8} /> : null}
                  </View>
                );
              })}
            </View>
          ))
        )}
        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: COLORS.ivoire },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.md,
  },
  retourBtn: { padding: SPACING.xs, marginTop: 2 },
  headerTitre: { fontFamily: FONTS.display, fontSize: 20, color: COLORS.vertProfond },
  headerSous: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, marginTop: 2 },

  onglets: {
    flexDirection: 'row', marginHorizontal: SPACING.lg, marginBottom: SPACING.md,
    backgroundColor: COLORS.ivoireFonce, borderRadius: RADIUS.md, padding: 3,
  },
  onglet: { flex: 1, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm, alignItems: 'center' },
  ongletActif: { backgroundColor: COLORS.blanc },
  ongletTxt: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.ardoise },
  ongletTxtActif: { color: COLORS.vertProfond },

  content: { paddingHorizontal: SPACING.xl },
  vide: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.ardoise, textAlign: 'center', paddingVertical: SPACING.xxxl },

  moisBloc: { marginBottom: SPACING.lg },
  moisTitre: {
    fontFamily: FONTS.bodySemibold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase',
    color: COLORS.ardoise, marginBottom: SPACING.sm,
  },

  ligne: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure,
    borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: RADIUS.md, backgroundColor: COLORS.ivoireFonce,
    alignItems: 'center', justifyContent: 'center',
  },
  emoji: { fontSize: 18 },
  ligneTitre: { fontFamily: FONTS.bodyMedium, fontSize: 15, color: COLORS.texte },
  ligneMeta: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.ardoise, marginTop: 1 },

  ligneLocked: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.ivoireFonce, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm,
  },
  iconWrapLocked: {
    width: 38, height: 38, borderRadius: RADIUS.md, backgroundColor: COLORS.blanc,
    alignItems: 'center', justifyContent: 'center',
  },
  ligneTitreLocked: { fontFamily: FONTS.bodyMedium, fontSize: 15, color: COLORS.ardoise, fontStyle: 'italic' },
});