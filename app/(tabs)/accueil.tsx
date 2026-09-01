// app/(tabs)/accueil.tsx

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../../store/useStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { ShieldIcon, SealMark, BrandMark } from '../../components/icons';
import { TRADUCTIONS } from '../../constants/i18n';
import type { JournalEntry, ParentRole } from '../../types';

// Repère un souvenir publié il y a environ un an (fenêtre de 15 jours autour
// de la date anniversaire). À défaut, on retombe sur le souvenir le plus
// récent plutôt que d'inventer une ancienneté qui ne correspond à rien.
function trouverSouvenir(journalEntries: JournalEntry[]) {
  if (journalEntries.length === 0) return null;
  const maintenant = Date.now();
  const unAn = 365 * 24 * 60 * 60 * 1000;
  const fenetre = 15 * 24 * 60 * 60 * 1000;
  const anniversaire = journalEntries.find((e) => {
    const age = maintenant - new Date(e.date).getTime();
    return Math.abs(age - unAn) < fenetre;
  });
  if (anniversaire) return { entry: anniversaire, ilYaUnAn: true };
  const plusRecent = [...journalEntries].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0];
  return { entry: plusRecent, ilYaUnAn: false };
}

// Initiale d'affichage pour l'avatar d'un parent.
function initialeParent(nomComplet: string | undefined): string {
  const prenom = nomComplet?.trim().split(' ')[0] ?? '';
  return prenom.length > 0 ? prenom.charAt(0).toUpperCase() : '?';
}

export default function AccueilScreen() {
  const router = useRouter();
  const langue = useStore((s) => s.langue);
  const setLangue = useStore((s) => s.setLangue);
  const todayEvents = useStore((s) => s.todayEvents);
  const familyCard = useStore((s) => s.familyCard);
  const decisions = useStore((s) => s.decisions);
  const depenses = useStore((s) => s.depenses);
  const journalEntries = useStore((s) => s.journalEntries);
  const parents = useStore((s) => s.parents);
  const parentActif = useStore((s) => s.parentActif);
  const t = TRADUCTIONS[langue];
  const prenom = parents[parentActif]?.nom.split(' ')[0] ?? '';

  const autreRole: ParentRole = parentActif === 'A' ? 'B' : 'A';
  const initialeMoi = initialeParent(parents[parentActif]?.nom);
  const initialeAutre = initialeParent(parents[autreRole]?.nom);

  const decisionsEnAttente = decisions.filter(
    (d) => d.statut === 'proposée' || d.statut === 'en_attente'
  );
  const depensesNonReglees = depenses.filter((d) => !d.rembourse);
  const totalARegulariser = depensesNonReglees.reduce((s, d) => s + d.montant, 0);
  const nbElementsAttention = decisionsEnAttente.length + (depensesNonReglees.length > 0 ? 1 : 0);
  const aDesElementsAttention = nbElementsAttention > 0;

  const souvenir = trouverSouvenir(journalEntries);

  const dateAujourdhui = new Date().toLocaleDateString(langue === 'pt' ? 'pt-PT' : 'fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <View style={styles.brandRow}>
          <View style={styles.brand}>
            <View style={styles.brandMarkWrap}>
              <BrandMark size={16} color={COLORS.ivoire} />
            </View>
            <View>
              <Text style={styles.brandName}>{t.brand}</Text>
              <Text style={styles.tagline}>{t.accueil.tagline}</Text>
            </View>
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
                <Text style={styles.avatarText}>{initialeMoi}</Text>
              </View>
              <View style={[styles.avatar, styles.avatarSecond, { backgroundColor: COLORS.terracotta }]}>
                <Text style={styles.avatarText}>{initialeAutre}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.bonjour}>{t.accueil.bonjour} {prenom}</Text>
        <Text style={styles.statutLigne}>
          {aDesElementsAttention ? t.accueil.elementsAttention(nbElementsAttention) : t.accueil.tousAJour}
        </Text>

        <View style={styles.familyCard}>
          <View style={styles.sealWrap}>
            <SealMark size={90} />
          </View>
          <View style={styles.familyCardTop}>
            <Text style={styles.eyebrow}>{t.accueil.eyebrowEnfants}</Text>
            <Ionicons name="heart-outline" size={16} color={COLORS.or} />
          </View>
          <Text style={styles.names}>{familyCard.enfants}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{familyCard.localisation}</Text>
            <View style={styles.dot} />
            <Text style={styles.metaText}>{familyCard.prochainEchange}</Text>
          </View>
        </View>

        {/* À votre attention + Finances côte à côte, comme dans la maquette */}
        <View style={styles.duoRow}>
          <View style={styles.duoCard}>
            <View style={styles.duoHeader}>
              <View style={[styles.duoIcon, { backgroundColor: '#FBF3DF' }]}>
                <Ionicons name="notifications-outline" size={16} color={COLORS.or} />
              </View>
              <Text style={styles.duoTitre} numberOfLines={1}>{t.accueil.attention.titre}</Text>
              {nbElementsAttention > 0 ? (
                <View style={styles.duoBadge}>
                  <Text style={styles.duoBadgeTxt}>{nbElementsAttention}</Text>
                </View>
              ) : null}
            </View>
            {decisionsEnAttente.slice(0, 2).map((d) => (
              <Pressable key={d.id} onPress={() => router.push('/decisions' as any)} style={styles.duoRowItem}>
                <Text style={styles.duoRowItemTitle} numberOfLines={1}>{d.titre}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => router.push('/echanges' as any)}>
              <Text style={styles.duoLien}>{t.accueil.attention.toutExaminer} →</Text>
            </Pressable>
          </View>

          <View style={styles.duoCard}>
            <View style={styles.duoHeader}>
              <View style={[styles.duoIcon, { backgroundColor: '#EEF1F0' }]}>
                <Ionicons name="wallet-outline" size={16} color={COLORS.vert} />
              </View>
              <Text style={styles.duoTitre}>{t.accueil.attention.financesTitre}</Text>
            </View>
            <Text style={styles.duoMontant}>
              {totalARegulariser > 0 ? `${totalARegulariser.toFixed(2)} €` : '0,00 €'}
            </Text>
            <Text style={styles.duoSousTexte}>
              {totalARegulariser > 0 ? t.accueil.attention.aRegulariser : t.accueil.organisationAJour}
            </Text>
            <Pressable onPress={() => router.push('/finances' as any)}>
              <Text style={styles.duoLien}>{t.accueil.attention.voirSolde} →</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.aujourdhuiHeader}>
          <Text style={styles.sectionLabel}>{t.accueil.aujourdhui}</Text>
          <Text style={styles.dateTxt}>{dateAujourdhui}</Text>
        </View>
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
        <Pressable onPress={() => router.push('/calendrier' as any)}>
          <Text style={styles.duoLien}>{t.accueil.voirAgendaComplet}</Text>
        </Pressable>

        <Pressable style={styles.banner} onPress={() => {}}>
          <Ionicons name="heart" size={26} color={COLORS.or} style={{ marginRight: SPACING.md }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitre}>{t.accueil.bannerTitre}</Text>
            <Text style={styles.bannerTexte}>{t.accueil.bannerTexte}</Text>
          </View>
        </Pressable>

        {souvenir ? (
          <>
            <Text style={styles.sectionLabel}>{t.accueil.unSouvenir}</Text>
            <Pressable style={styles.souvenirCard} onPress={() => router.push('/journal' as any)}>
              <Text style={styles.souvenirEyebrow}>
                {souvenir.ilYaUnAn ? t.accueil.souvenirIlYaUnAn : t.accueil.souvenirRecent}
              </Text>
              <Text style={styles.souvenirTitle}>{souvenir.entry.titre}</Text>
              <Text style={styles.souvenirLink}>{t.accueil.revoir} →</Text>
            </Pressable>
          </>
        ) : null}

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
  tagline: { fontFamily: FONTS.body, fontSize: 10, fontStyle: 'italic', color: COLORS.ardoise, marginTop: -1 },
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

  bonjour: { fontFamily: FONTS.display, fontSize: 22, color: COLORS.vertProfond, marginTop: SPACING.lg },
  statutLigne: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, marginTop: 3, marginBottom: SPACING.lg },

  familyCard: {
    backgroundColor: COLORS.vertProfond,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    overflow: 'hidden',
  },
  sealWrap: { position: 'absolute', top: -18, right: -18 },
  familyCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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

  duoRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xl },
  duoCard: {
    flex: 1, backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure,
    borderRadius: 15, padding: SPACING.md,
  },
  duoHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.sm },
  duoIcon: { width: 26, height: 26, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  duoTitre: { flex: 1, fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.vertProfond },
  duoBadge: { backgroundColor: COLORS.or, borderRadius: RADIUS.full, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  duoBadgeTxt: { fontSize: 10, fontFamily: FONTS.bodyBold, color: COLORS.vertProfond },
  duoRowItem: { marginBottom: 6 },
  duoRowItemTitle: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.texte },
  duoMontant: { fontFamily: FONTS.display, fontSize: 18, color: COLORS.vertProfond, marginBottom: 2 },
  duoSousTexte: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.ardoise, marginBottom: 8 },
  duoLien: { fontFamily: FONTS.bodySemibold, fontSize: 11.5, color: COLORS.vert, marginTop: 4 },

  aujourdhuiHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: SPACING.xxxl - 4, marginBottom: SPACING.md },
  dateTxt: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, textTransform: 'capitalize' },

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

  banner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F3ECDF', borderRadius: RADIUS.lg, padding: SPACING.lg,
    marginTop: SPACING.xl,
  },
  bannerTitre: { fontFamily: FONTS.display, fontSize: 15, color: COLORS.vertProfond, marginBottom: 2 },
  bannerTexte: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.ardoise },

  souvenirCard: {
    backgroundColor: COLORS.ivoireFonce, borderRadius: 15, padding: SPACING.lg,
  },
  souvenirEyebrow: { fontFamily: FONTS.bodySemibold, fontSize: 10.5, color: COLORS.terracotta, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  souvenirTitle: { fontFamily: FONTS.display, fontSize: 15.5, color: COLORS.vertProfond, marginBottom: 6 },
  souvenirLink: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.vert },

  trustStrip: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.xl,
    padding: SPACING.md, backgroundColor: 'rgba(45, 106, 79, 0.08)', borderRadius: RADIUS.md,
  },
  trustText: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 11.5, color: COLORS.vert },
});