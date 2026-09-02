// app/(tabs)/accueil.tsx
//
// Le "cockpit familial" — répond en 3 secondes, sans scroller, à quatre
// questions : où sont mes enfants, qu'est-ce que j'ai aujourd'hui,
// qu'est-ce qui nécessite mon attention, quel est le prochain changement
// de garde. Trois niveaux d'information distincts, sans doublon :
//   AUJOURD'HUI (carte cockpit) = ce qui m'attend maintenant
//   À VENIR CETTE SEMAINE = ce que je dois anticiper (hors aujourd'hui)
//   AGENDA (onglet séparé) = consulter/gérer tout le calendrier
// Chaque lien montre exactement ce qu'il promet — jamais un module
// entier : "Revoir" ouvre le seul souvenir concerné (pas tout le journal).
//
// Échelle typographique strictement limitée à 4 niveaux :
//   28 — titre principal ("Bonjour Ricardo")
//   20 — titre de carte / valeur des cartes cockpit
//   16 — contenu / action
//   13.5 — labels / métadonnées

import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { startOfWeek, endOfWeek, isToday, parseISO, format } from 'date-fns';
import { fr, pt } from 'date-fns/locale';
import { useStore } from '../../store/useStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { BrandMark } from '../../components/icons';
import { TRADUCTIONS } from '../../constants/i18n';
import SouvenirModal from '../../components/SouvenirModal';
import type { JournalEntry, ParentRole } from '../../types';

const LOCALES = { fr, pt };

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
  const evenementsCalendrier = useStore((s) => s.evenementsCalendrier);
  const parents = useStore((s) => s.parents);
  const parentActif = useStore((s) => s.parentActif);
  const t = TRADUCTIONS[langue];
  const dateLocale = LOCALES[langue];
  const prenom = parents[parentActif]?.nom.split(' ')[0] ?? '';

  const [souvenirVisible, setSouvenirVisible] = useState(false);

  const autreRole: ParentRole = parentActif === 'A' ? 'B' : 'A';
  const initialeMoi = initialeParent(parents[parentActif]?.nom);
  const initialeAutre = initialeParent(parents[autreRole]?.nom);

  const decisionsEnAttente = decisions.filter(
    (d) => d.statut === 'proposée' || d.statut === 'en_attente'
  );
  const depensesNonReglees = depenses.filter((d) => !d.rembourse);
  const nbATraiter = decisionsEnAttente.length + (depensesNonReglees.length > 0 ? 1 : 0);

  const soldeNonRegle = useMemo(() => {
    let totalA = 0;
    let totalB = 0;
    depensesNonReglees.forEach((d) => {
      if (d.auteurId === 'A') totalA += d.montant;
      else totalB += d.montant;
    });
    const total = totalA + totalB;
    const duA = total / 2 - totalA;
    const aJour = Math.abs(duA) < 0.005;
    const debiteur: ParentRole = duA > 0 ? 'B' : 'A';
    const crediteur: ParentRole = duA > 0 ? 'A' : 'B';
    return { montant: Math.abs(duA), aJour, debiteur, crediteur };
  }, [depensesNonReglees]);

  const souvenir = trouverSouvenir(journalEntries);
  const prochainEvenement = todayEvents.length > 0 ? todayEvents[0] : null;

  const evenementsAVenir = useMemo(() => {
    const debut = startOfWeek(new Date(), { weekStartsOn: 1 });
    const fin = endOfWeek(new Date(), { weekStartsOn: 1 });
    return evenementsCalendrier
      .filter((ev) => {
        const d = parseISO(ev.date);
        return d >= debut && d <= fin && !isToday(d);
      })
      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
  }, [evenementsCalendrier]);

  const evenementsAffiches = evenementsAVenir.slice(0, 3);
  const nbAutres = Math.max(0, evenementsAVenir.length - 3);

  return (
    <View style={styles.screen}>
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
        <View style={styles.promesse}>
          <Text style={styles.promesseTitre}>{t.accueil.bannerTitre}</Text>
          <Text style={styles.promesseSous}>
            {familyCard.enfants} · {familyCard.localisation}
          </Text>
          <Text style={styles.promesseMeta}>{familyCard.prochainEchange}</Text>
        </View>

        <Text style={styles.bonjour}>{t.accueil.bonjour} {prenom}</Text>
        <Text style={styles.sousBonjour}>{t.accueil.cockpitSousTitre}</Text>

        <View style={styles.trio}>
          <Pressable style={styles.trioCard} onPress={() => router.push('/echanges' as any)}>
            <Text style={styles.trioLabel} numberOfLines={1}>{t.accueil.cockpitATraiter}</Text>
            <Text style={styles.trioValeur}>{nbATraiter}</Text>
            <Text style={styles.trioCaption}>{t.accueil.cockpitAExaminer}</Text>
          </Pressable>

          <Pressable style={styles.trioCard} onPress={() => router.push('/semaine-activites' as any)}>
            <Text style={styles.trioLabel} numberOfLines={1}>{t.accueil.cockpitAujourdhui}</Text>
            <Text style={styles.trioValeur}>{todayEvents.length}</Text>
            <Text style={styles.trioCaption} numberOfLines={1}>
              {prochainEvenement ? t.accueil.cockpitProchain(prochainEvenement.time) : t.accueil.cockpitEvenements(todayEvents.length)}
            </Text>
          </Pressable>

          <Pressable style={styles.trioCard} onPress={() => router.push('/finances' as any)}>
            <Text style={styles.trioLabel} numberOfLines={1}>{t.accueil.attention.financesTitre}</Text>
            <Text style={styles.trioValeur} numberOfLines={1} adjustsFontSizeToFit>
              {soldeNonRegle.aJour ? '0 €' : `${soldeNonRegle.montant.toFixed(0)} €`}
            </Text>
            <Text style={styles.trioCaption} numberOfLines={1}>
              {soldeNonRegle.aJour
                ? t.accueil.organisationAJour
                : `${parents[soldeNonRegle.debiteur]?.nom.split(' ')[0]} ${t.finances.doit} ${parents[soldeNonRegle.crediteur]?.nom.split(' ')[0]}`}
            </Text>
          </Pressable>
        </View>

        {evenementsAffiches.length > 0 ? (
          <>
            <View style={styles.semaineHeader}>
              <Text style={styles.sectionLabel}>{t.accueil.semaineAVenir}</Text>
              <Pressable onPress={() => router.push('/semaine-activites' as any)}>
                <Text style={styles.semaineLien}>{t.accueil.semaineLien} →</Text>
              </Pressable>
            </View>
            <View style={styles.semaineCard}>
              {evenementsAffiches.map((ev, index) => {
                const d = parseISO(ev.date);
                const aUneHeure = d.getHours() !== 0 || d.getMinutes() !== 0;
                const qui = ev.enfant || parents[ev.parentId]?.nom.split(' ')[0] || '';
                return (
                  <View
                    key={ev.id}
                    style={[styles.semaineLigne, index === evenementsAffiches.length - 1 && { borderBottomWidth: 0 }]}
                  >
                    <Text style={styles.semaineJour}>{format(d, 'EEE d', { locale: dateLocale })}</Text>
                    <Text style={styles.semaineHeure}>{aUneHeure ? format(d, 'HH:mm') : '—'}</Text>
                    <Text style={styles.semaineTitre} numberOfLines={1}>
                      {ev.titre}{qui ? ` · ${qui}` : ''}
                    </Text>
                  </View>
                );
              })}
              {nbAutres > 0 ? (
                <Text style={styles.semaineAutres}>{t.accueil.autresSemaine(nbAutres)}</Text>
              ) : null}
            </View>
          </>
        ) : null}

        {souvenir ? (
          <Pressable style={styles.souvenirLigne} onPress={() => setSouvenirVisible(true)}>
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

      <SouvenirModal
        visible={souvenirVisible}
        onClose={() => setSouvenirVisible(false)}
        entry={souvenir?.entry ?? null}
        ilYaUnAn={souvenir?.ilYaUnAn ?? false}
      />
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

  sectionLabel: {
    fontFamily: FONTS.bodySemibold, fontSize: 12, letterSpacing: 0.6,
    textTransform: 'uppercase', color: COLORS.ardoise,
  },
  semaineHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: SPACING.xl, marginBottom: SPACING.md,
  },
  semaineLien: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.vert },
  semaineCard: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md,
  },
  semaineLigne: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.bordure, gap: SPACING.sm,
  },
  semaineJour: {
    fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.vertProfond,
    textTransform: 'capitalize', minWidth: 52,
  },
  semaineHeure: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise, minWidth: 42 },
  semaineTitre: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 14.5, color: COLORS.texte },
  semaineAutres: {
    fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.ardoise,
    paddingVertical: SPACING.sm, fontStyle: 'italic',
  },

  souvenirLigne: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.ivoireFonce, borderRadius: RADIUS.md,
    padding: SPACING.md, marginTop: SPACING.xl,
  },
  souvenirEyebrow: {
    fontFamily: FONTS.bodySemibold, fontSize: 11, color: COLORS.terracotta,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  souvenirTitre: { fontFamily: FONTS.bodyMedium, fontSize: 16, color: COLORS.texte, marginTop: 1 },
  souvenirLien: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.vert, marginLeft: SPACING.sm },
});