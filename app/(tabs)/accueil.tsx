// app/(tabs)/accueil.tsx
//
// Le "cockpit familial" — reconstruit pour répondre en 3 secondes, sans
// scroller, à quatre questions : où sont mes enfants, qu'est-ce que j'ai
// aujourd'hui, qu'est-ce qui nécessite mon attention, quel est le prochain
// changement de garde. Tout le reste (souvenir, détail de l'agenda) est
// volontairement discret et secondaire.
//
// Échelle typographique strictement limitée à 4 niveaux :
//   28 — titre principal ("Bonjour Ricardo")
//   20 — titre de carte / valeur des cartes cockpit
//   16 — contenu / action
//   13.5 — labels / métadonnées

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../../store/useStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { BrandMark } from '../../components/icons';
import { TRADUCTIONS } from '../../constants/i18n';
import type { JournalEntry, ParentRole } from '../../types';

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
  const nbATraiter = decisionsEnAttente.length + (depensesNonReglees.length > 0 ? 1 : 0);

  const souvenir = trouverSouvenir(journalEntries);
  const prochainEvenement = todayEvents.length > 0 ? todayEvents[0] : null;

  return (
    <View style={styles.screen}>
      {/* 1. Header très compact */}
      <View style={styles.topbar}>
        <View style={styles.brand}>
          <View style={styles.brandMarkWrap}>
            <BrandMark size={13} color={COLORS.ivoire} />
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
              <Text style={styles.avatarText}>{initialeMoi}</Text>
            </View>
            <View style={[styles.avatar, styles.avatarSecond, { backgroundColor: COLORS.terracotta }]}>
              <Text style={styles.avatarText}>{initialeAutre}</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 2. Promesse Dualia — compacte, fond ivoire + accent vert, jamais un aplat sombre */}
        <View style={styles.promesse}>
          <Text style={styles.promesseTitre}>{t.accueil.bannerTitre}</Text>
          <Text style={styles.promesseSous}>
            {familyCard.enfants} · {familyCard.localisation}
          </Text>
          <Text style={styles.promesseMeta}>{familyCard.prochainEchange}</Text>
        </View>

        {/* 3. La vraie zone "maintenant" */}
        <Text style={styles.bonjour}>{t.accueil.bonjour} {prenom}</Text>
        <Text style={styles.sousBonjour}>{t.accueil.cockpitSousTitre}</Text>

        <View style={styles.trio}>
          <Pressable style={styles.trioCard} onPress={() => router.push('/echanges' as any)}>
            <Text style={styles.trioLabel} numberOfLines={1}>{t.accueil.cockpitATraiter}</Text>
            <Text style={styles.trioValeur}>{nbATraiter}</Text>
            <Text style={styles.trioCaption}>{t.accueil.cockpitAExaminer}</Text>
          </Pressable>

          <Pressable style={styles.trioCard} onPress={() => router.push('/calendrier' as any)}>
            <Text style={styles.trioLabel} numberOfLines={1}>{t.accueil.cockpitAujourdhui}</Text>
            <Text style={styles.trioValeur}>{todayEvents.length}</Text>
            <Text style={styles.trioCaption} numberOfLines={1}>
              {prochainEvenement ? t.accueil.cockpitProchain(prochainEvenement.time) : t.accueil.cockpitEvenements(todayEvents.length)}
            </Text>
          </Pressable>

          <Pressable style={styles.trioCard} onPress={() => router.push('/finances' as any)}>
            <Text style={styles.trioLabel} numberOfLines={1}>{t.accueil.attention.financesTitre}</Text>
            <Text style={styles.trioValeur} numberOfLines={1} adjustsFontSizeToFit>
              {totalARegulariser > 0 ? `${totalARegulariser.toFixed(0)} €` : '0 €'}
            </Text>
            <Text style={styles.trioCaption} numberOfLines={1}>
              {totalARegulariser > 0 ? t.accueil.attention.aRegulariser : t.accueil.organisationAJour}
            </Text>
          </Pressable>
        </View>

        {/* 4. Agenda ultra-condensé — un seul événement, pas trois */}
        {prochainEvenement ? (
          <Pressable style={styles.agendaLigne} onPress={() => router.push('/calendrier' as any)}>
            <View style={styles.agendaDot} />
            <Text style={styles.agendaTime}>{prochainEvenement.time}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.agendaTitre}>{prochainEvenement.title}</Text>
              <Text style={styles.agendaWho}>{prochainEvenement.who}</Text>
            </View>
            <Text style={styles.agendaLien}>{t.accueil.voirLaJournee} →</Text>
          </Pressable>
        ) : null}

        {/* 5. Un souvenir — discret */}
        {souvenir ? (
          <Pressable style={styles.souvenirLigne} onPress={() => router.push('/journal' as any)}>
            <Ionicons name="heart-outline" size={16} color={COLORS.terracotta} />
            <View style={{ flex: 1, marginLeft: SPACING.sm }}>
              <Text style={styles.souvenirEyebrow}>
                {souvenir.ilYaUnAn ? t.accueil.souvenirIlYaUnAn : t.accueil.souvenirRecent}
              </Text>
              <Text style={styles.souvenirTitre} numberOfLines={1}>{souvenir.entry.titre}</Text>
            </View>
            <Text style={styles.souvenirLien}>{t.accueil.revoir} →</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ivoire },

  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  brandMarkWrap: {
    width: 22, height: 22, borderRadius: 7,
    backgroundColor: COLORS.vert, alignItems: 'center', justifyContent: 'center',
  },
  brandName: { fontFamily: FONTS.display, fontSize: 16, color: COLORS.vertProfond, letterSpacing: 0.2 },
  rightRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  langSwitch: {
    flexDirection: 'row', backgroundColor: COLORS.blanc, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.bordure, padding: 2,
  },
  langBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  langBtnActive: { backgroundColor: COLORS.vertProfond },
  langBtnText: { fontFamily: FONTS.bodyBold, fontSize: 10, color: COLORS.ardoise },
  langBtnTextActive: { color: COLORS.ivoire },
  avatarPair: { flexDirection: 'row' },
  avatar: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: COLORS.ivoire,
  },
  avatarSecond: { marginLeft: -9 },
  avatarText: { fontFamily: FONTS.bodySemibold, fontSize: 10, color: COLORS.blanc },

  content: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm, paddingBottom: SPACING.xxxl * 2 },

  // Promesse : fond ivoire (pas d'aplat sombre en ouverture), simple accent
  // vert à gauche — le vertProfond reste en réserve pour bouton/accent.
  promesse: {
    backgroundColor: 'rgba(45, 106, 79, 0.06)',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.vert,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xl,
  },
  promesseTitre: { fontFamily: FONTS.bodySemibold, fontSize: 16, color: COLORS.vertProfond, marginBottom: 3 },
  promesseSous: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.texte },
  promesseMeta: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, marginTop: 1 },

  bonjour: { fontFamily: FONTS.display, fontSize: 28, color: COLORS.vertProfond },
  sousBonjour: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, marginTop: 2, marginBottom: SPACING.lg },

  trio: { flexDirection: 'row', gap: SPACING.sm },
  trioCard: {
    flex: 1,
    backgroundColor: COLORS.blanc,
    borderWidth: 1,
    borderColor: COLORS.bordure,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    minHeight: 92,
    justifyContent: 'center',
  },
  trioLabel: {
    fontFamily: FONTS.bodySemibold, fontSize: 11, color: COLORS.ardoise,
    textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6, textAlign: 'center',
  },
  trioValeur: { fontFamily: FONTS.display, fontSize: 20, color: COLORS.vertProfond },
  trioCaption: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, marginTop: 3, textAlign: 'center' },

  agendaLigne: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure,
    borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.lg,
  },
  agendaDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.vert, marginRight: SPACING.sm },
  agendaTime: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.ardoise, marginRight: SPACING.sm, minWidth: 42 },
  agendaTitre: { fontFamily: FONTS.bodyMedium, fontSize: 16, color: COLORS.texte },
  agendaWho: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, marginTop: 1 },
  agendaLien: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.vert, marginLeft: SPACING.sm },

  souvenirLigne: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.ivoireFonce, borderRadius: RADIUS.md,
    padding: SPACING.md, marginTop: SPACING.md,
  },
  souvenirEyebrow: {
    fontFamily: FONTS.bodySemibold, fontSize: 11, color: COLORS.terracotta,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  souvenirTitre: { fontFamily: FONTS.bodyMedium, fontSize: 16, color: COLORS.texte, marginTop: 1 },
  souvenirLien: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.vert, marginLeft: SPACING.sm },
});