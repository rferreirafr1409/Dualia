// app/(tabs)/accueil.tsx

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../../store/useStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { ShieldIcon, JournalIcon, FinanceIcon, DocumentIcon, InstitutionIcon, SealMark, BrandMark } from '../../components/icons';
import { TRADUCTIONS } from '../../constants/i18n';

export default function AccueilScreen() {
  const router = useRouter();
  const langue = useStore((s) => s.langue);
  const setLangue = useStore((s) => s.setLangue);
  const todayEvents = useStore((s) => s.todayEvents);
  const familyCard = useStore((s) => s.familyCard);
  const t = TRADUCTIONS[langue];

  const MODULES = [
    { key: 'journal', title: t.accueil.journal, subtitle: t.accueil.journalSub, route: 'journal', icon: JournalIcon, bg: 'rgba(201,168,76,0.16)', color: COLORS.or },
    { key: 'finances', title: t.accueil.finances, subtitle: t.accueil.financesSub, route: 'finances', icon: FinanceIcon, bg: 'rgba(45,106,79,0.12)', color: COLORS.vert },
    { key: 'documents', title: t.accueil.documents, subtitle: t.accueil.documentsSub, route: 'documents', icon: DocumentIcon, bg: 'rgba(107,127,122,0.12)', color: COLORS.ardoise },
    { key: 'caf', title: t.accueil.caf, subtitle: t.accueil.cafSub, route: 'caf', icon: InstitutionIcon, bg: 'rgba(181,146,124,0.18)', color: COLORS.terracotta },
  ];

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <View style={styles.brandRow}>
          <View style={styles.brand}>
            <View style={styles.brandMarkWrap}>
              <BrandMark size={16} color={COLORS.ivoire} />
            </View>
            <Text style={styles.brandName}>{t.brand}</Text>
          </View>
          <View style={styles.rightRow}>
            <View style={styles.langSwitch}>
              <Pressable onPress={() => setLangue('fr')} style={[styles.langBtn, langue === 'fr' && styles.langBtnActive]}>
                <Text style={[styles.langBtnText, langue === 'fr' && styles.langBtnTextActive]}>FR</Text>
              </Pressable>
              <Pressable onPress={() => setLangue('pt')} style={[styles.langBtn, langue === 'pt' && styles.langBtnActive]}>
                <Text style={[styles.langBtnText, langue === 'pt' && styles.langBtnTextActive]}>PT</Text>
              </Pressable>
            </View>
            <View style={styles.avatarPair}>
              <View style={[styles.avatar, { backgroundColor: COLORS.vert }]}>
                <Text style={styles.avatarText}>MD</Text>
              </View>
              <View style={[styles.avatar, styles.avatarSecond, { backgroundColor: COLORS.terracotta }]}>
                <Text style={styles.avatarText}>P</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.familyCard}>
          <View style={styles.sealWrap}>
            <SealMark size={90} />
          </View>
          <Text style={styles.eyebrow}>{t.accueil.eyebrowEnfants}</Text>
          <Text style={styles.names}>{familyCard.enfants}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{familyCard.localisation}</Text>
            <View style={styles.dot} />
            <Text style={styles.metaText}>{familyCard.prochainEchange}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t.accueil.aujourdhui}</Text>
        <View style={styles.timeline}>
          <View style={styles.timelineRail} />
          {todayEvents.map((event) => (
            <View key={event.id} style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <Text style={styles.timelineTime}>{event.time}</Text>
              <View style={styles.timelineBody}>
                <Text style={styles.timelineTitle}>{event.title}</Text>
                <Text style={styles.timelineWho}>{event.who}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>{t.accueil.accesRapide}</Text>
        <View style={styles.grid}>
          {MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <Pressable
                key={m.key}
                onPress={() => router.push(`/${m.route}` as any)}
                style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
              >
                <View style={[styles.iconWrap, { backgroundColor: m.bg }]}>
                  <Icon size={14} color={m.color} />
                </View>
                <Text style={styles.tileTitle}>{m.title}</Text>
                <Text style={styles.tileSubtitle}>{m.subtitle}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.trustStrip}>
          <ShieldIcon size={14} color={COLORS.vert} strokeWidth={2} />
          <Text style={styles.trustText}>{t.accueil.trustStrip}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ivoire },
  topbar: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.sm },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandMarkWrap: {
    width: 30, height: 30, borderRadius: 9,
    backgroundColor: COLORS.vert, alignItems: 'center', justifyContent: 'center',
  },
  brandName: { fontFamily: FONTS.display, fontSize: 19, color: COLORS.vertProfond, letterSpacing: 0.2 },
  rightRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  langSwitch: {
    flexDirection: 'row', backgroundColor: COLORS.blanc, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.bordure, padding: 2,
  },
  langBtn: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: RADIUS.full },
  langBtnActive: { backgroundColor: COLORS.vertProfond },
  langBtnText: { fontFamily: FONTS.bodyBold, fontSize: 10.5, color: COLORS.ardoise },
  langBtnTextActive: { color: COLORS.ivoire },
  avatarPair: { flexDirection: 'row' },
  avatar: {
    width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.ivoire,
  },
  avatarSecond: { marginLeft: -10 },
  avatarText: { fontFamily: FONTS.bodySemibold, fontSize: 11, color: COLORS.blanc },
  content: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl * 2 },
  familyCard: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.vertProfond,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    overflow: 'hidden',
  },
  sealWrap: { position: 'absolute', top: -18, right: -18 },
  eyebrow: { fontFamily: FONTS.bodySemibold, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: COLORS.or },
  names: { fontFamily: FONTS.display, fontSize: 20, color: COLORS.ivoire, marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md, flexWrap: 'wrap' },
  metaText: { fontFamily: FONTS.body, fontSize: 12.5, color: 'rgba(248, 246, 242, 0.75)' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(248, 246, 242, 0.4)' },
  sectionLabel: {
    fontFamily: FONTS.bodySemibold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: COLORS.ardoise,
    marginTop: SPACING.xxxl - 4,
    marginBottom: SPACING.md,
  },
  timeline: { paddingLeft: SPACING.lg, position: 'relative' },
  timelineRail: { position: 'absolute', left: 8, top: 8, bottom: 8, width: 1, backgroundColor: COLORS.bordure },
  timelineItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.lg },
  timelineDot: {
    position: 'absolute', left: -14, top: 4,
    width: 9, height: 9, aspectRatio: 1, borderRadius: 4.5,
    backgroundColor: COLORS.vert, borderWidth: 2, borderColor: COLORS.ivoire,
  },
  timelineTime: { fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.ardoise, minWidth: 44 },
  timelineBody: { flex: 1, marginLeft: SPACING.sm },
  timelineTitle: { fontFamily: FONTS.bodyMedium, fontSize: 14.5, color: COLORS.vertProfond },
  timelineWho: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, marginTop: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md - 1 },
  tile: {
    width: '48%', backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure,
    borderRadius: 15, padding: SPACING.lg - 1,
  },
  tilePressed: { opacity: 0.85 },
  iconWrap: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md + 4 },
  tileTitle: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.vertProfond },
  tileSubtitle: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, marginTop: 2 },
  trustStrip: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.xl,
    padding: SPACING.md, backgroundColor: 'rgba(45, 106, 79, 0.08)', borderRadius: RADIUS.md,
  },
  trustText: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 11.5, color: COLORS.vert },
});
