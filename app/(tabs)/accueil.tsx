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
import { View, Text, ScrollView, Pressable, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { startOfWeek, endOfWeek, isToday, parseISO, format } from 'date-fns';
import { fr, pt } from 'date-fns/locale';
import { useStore } from '../../store/useStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { BrandMark } from '../../components/icons';
import { TRADUCTIONS } from '../../constants/i18n';
import SouvenirModal from '../../components/SouvenirModal';
import JourneeModal from '../../components/JourneeModal';
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

function parentDuJour(date: Date, evs: { dateDebut: string; dateFin: string; parentId: ParentRole }[]): ParentRole | null {
  for (const ev of evs) {
    const debut = new Date(ev.dateDebut);
    const fin = new Date(ev.dateFin);
    if (date >= debut && date <= fin) return ev.parentId;
  }
  return null;
}

export default function AccueilScreen() {
  const router = useRouter();
  const langue = useStore((s) => s.langue);
  const setLangue = useStore((s) => s.setLangue);
  const familyCard = useStore((s) => s.familyCard);
  const decisions = useStore((s) => s.decisions);
  const depenses = useStore((s) => s.depenses);
  const journalEntries = useStore((s) => s.journalEntries);
  const moments = useStore((s) => s.moments);
  const evenementsCalendrier = useStore((s) => s.evenementsCalendrier);
  const evenements = useStore((s) => s.evenements);
  const parents = useStore((s) => s.parents);
  const parentActif = useStore((s) => s.parentActif);
  const suggestionsMessages = useStore((s) => s.suggestionsMessages);
  const t = TRADUCTIONS[langue];
  const dateLocale = LOCALES[langue];
  const prenom = parents[parentActif]?.nom.split(' ')[0] ?? '';

  const [souvenirVisible, setSouvenirVisible] = useState(false);
  const [journeeVisible, setJourneeVisible] = useState(false);

  const autreRole: ParentRole = parentActif === 'A' ? 'B' : 'A';
  const initialeMoi = initialeParent(parents[parentActif]?.nom);
  const initialeAutre = initialeParent(parents[autreRole]?.nom);

  // Vrai calcul du prochain changement de garde à partir du planning réel
  // (le même que celui utilisé dans l'Agenda) — jamais un texte figé avec
  // un nom au hasard.
  const prochainEchangeTexte = useMemo(() => {
    const roleAujourdhui = parentDuJour(new Date(), evenements);
    for (let i = 1; i <= 30; i++) {
      const jour = new Date();
      jour.setDate(jour.getDate() + i);
      jour.setHours(0, 0, 0, 0);
      const role = parentDuJour(jour, evenements);
      if (role && role !== roleAujourdhui) {
        const nomAutre = parents[role]?.nom.split(' ')[0] ?? '';
        return t.accueil.prochainEchangeTexte(i, nomAutre);
      }
    }
    return null;
  }, [evenements, parents, langue]);

  const decisionsEnAttente = decisions.filter(
    (d) => d.statut === 'proposée' || d.statut === 'en_attente'
  );
  const depensesNonReglees = depenses.filter((d) => !d.rembourse);
  // "À traiter" compte les décisions en attente ET les suggestions
  // d'événement détectées dans un message (en attente de Confirmer/
  // Ignorer) — toutes deux de vraies choses à traiter, contrairement à
  // l'ancien "+1" pour les dépenses non réglées qui n'avait nulle part où
  // atterrir en cliquant.
  const nbSuggestionsMessages = Object.keys(suggestionsMessages).length;
  const nbATraiter = decisionsEnAttente.length + nbSuggestionsMessages;

  // Solde "qui doit à qui" — net exact des parts de chaque dépense non
  // réglée (pas un écart par rapport à une moyenne globale), pour
  // représenter un mouvement d'argent précis. Même méthode que le module
  // Finances, pour ne jamais afficher deux chiffres différents.
  const soldeNonRegle = useMemo(() => {
    let duAVersB = 0;
    let duBVersA = 0;
    depensesNonReglees.forEach((d) => {
      const partA = d.partA ?? d.montant / 2;
      const partB = d.partB ?? d.montant / 2;
      if (d.auteurId === 'A') duBVersA += partB;
      else duAVersB += partA;
    });
    const duA = duBVersA - duAVersB; // positif => B doit à A
    const aJour = Math.abs(duA) < 0.005;
    const debiteur: ParentRole = duA > 0 ? 'B' : 'A';
    const crediteur: ParentRole = duA > 0 ? 'A' : 'B';
    return { montant: Math.abs(duA), aJour, debiteur, crediteur };
  }, [depensesNonReglees]);

  const souvenir = trouverSouvenir(journalEntries);

  // Une seule source de vérité pour "aujourd'hui" : les vrais événements du
  // calendrier, filtrés sur la date du jour — jamais une liste fictive
  // séparée. Un événement ajouté dans l'Agenda apparaît donc
  // automatiquement ici, en disparaît le lendemain, et se retrouve dans
  // "À venir cette semaine" les jours suivants.
  const evenementsAujourdhui = useMemo(() => {
    return evenementsCalendrier
      .filter((ev) => isToday(parseISO(ev.date)))
      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
  }, [evenementsCalendrier]);

  // Le compteur reste au nombre total d'événements du jour, même une fois
  // leur heure passée (ils comptent jusqu'à minuit). Mais "Prochain XXhXX"
  // ne doit désigner que le prochain événement encore à venir — jamais un
  // événement déjà passé dans la journée.
  const maintenant = new Date();
  const prochainEvenement = evenementsAujourdhui.find((ev) => parseISO(ev.date) > maintenant) ?? null;
  const prochainHeureAffichee = useMemo(() => {
    if (!prochainEvenement) return null;
    const d = parseISO(prochainEvenement.date);
    return d.getHours() !== 0 || d.getMinutes() !== 0 ? format(d, 'HH:mm') : null;
  }, [prochainEvenement]);

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

  const evenementsAffiches = evenementsAVenir.slice(0, 2);
  const nbAutres = Math.max(0, evenementsAVenir.length - 2);

  // "Leur journée" — le Fil de vie, présent. Compact : un seul moment
  // (le plus récent), pas un flux complet sur la Home.
  const dernierMoment = moments.length > 0 ? moments[0] : null;
  const nbNouveauxMoments = useMemo(
    () => moments.filter((m) => isToday(parseISO(m.createdAt))).length,
    [moments]
  );

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
          {prochainEchangeTexte ? <Text style={styles.promesseMeta}>{prochainEchangeTexte}</Text> : null}
        </View>

        <Text style={styles.bonjour}>{t.accueil.bonjour} {prenom}</Text>
        <Text style={styles.sousBonjour}>{t.accueil.cockpitSousTitre}</Text>

        <View style={styles.trio}>
          <Pressable style={styles.trioCard} onPress={() => router.push('/decisions' as any)}>
            <Text style={styles.trioLabel} numberOfLines={1}>{t.accueil.cockpitATraiter}</Text>
            <Text style={styles.trioValeur}>{nbATraiter}</Text>
            <Text style={styles.trioCaption}>{t.accueil.cockpitAExaminer}</Text>
          </Pressable>

          <Pressable style={styles.trioCard} onPress={() => setJourneeVisible(true)}>
            <Text style={styles.trioLabel} numberOfLines={1}>{t.accueil.cockpitAujourdhui}</Text>
            <Text style={styles.trioValeur}>{evenementsAujourdhui.length}</Text>
            <Text style={styles.trioCaption} numberOfLines={1}>
              {prochainHeureAffichee
                ? t.accueil.cockpitProchain(prochainHeureAffichee)
                : t.accueil.cockpitEvenements(evenementsAujourdhui.length)}
            </Text>
          </Pressable>

          <Pressable style={styles.trioCard} onPress={() => router.push('/finances' as any)}>
            <Text style={styles.trioLabel} numberOfLines={1}>{t.accueil.attention.financesTitre}</Text>
            <Text style={styles.trioValeur} numberOfLines={1} adjustsFontSizeToFit>
              {soldeNonRegle.aJour ? '0,00 €' : `${soldeNonRegle.montant.toFixed(2).replace('.', ',')} €`}
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

        {/* Leur journée — le Fil de vie, compact. Un seul moment, jamais un
            flux complet sur l'accueil : le clic ouvre le Fil en entier. */}
        <View style={styles.journeeHeader}>
          <Text style={styles.sectionLabel}>{t.filDeVie.leurJournee}</Text>
          {nbNouveauxMoments > 0 ? (
            <View style={styles.journeeBadge}>
              <Text style={styles.journeeBadgeTxt}>{t.filDeVie.nouveauxMoments(nbNouveauxMoments)}</Text>
            </View>
          ) : null}
        </View>

        {dernierMoment ? (
          <Pressable style={styles.journeeCarte} onPress={() => router.push('/fil-de-vie' as any)}>
            {dernierMoment.photoUrl ? (
              <Image source={{ uri: dernierMoment.photoUrl }} style={styles.journeePhoto} resizeMode="contain" />
            ) : null}
            <View style={styles.journeeCorps}>
              <View style={{ flex: 1 }}>
                {dernierMoment.texte ? (
                  <Text style={styles.journeeTexte} numberOfLines={2}>{dernierMoment.texte}</Text>
                ) : null}
                <Text style={styles.journeeMeta}>
                  {t.filDeVie.partagePar(parents[dernierMoment.auteurId]?.nom.split(' ')[0] ?? '')}
                </Text>
              </View>
              <Text style={styles.journeeLien}>{t.filDeVie.voirLeFil}</Text>
            </View>
          </Pressable>
        ) : (
          <Pressable style={styles.journeeVide} onPress={() => router.push('/partager-moment' as any)}>
            <Text style={styles.journeeVideTxte}>{t.filDeVie.proposePartager}</Text>
            <Text style={styles.journeeVideCta}>{t.filDeVie.partagerCTA}</Text>
          </Pressable>
        )}

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
      <JourneeModal visible={journeeVisible} onClose={() => setJourneeVisible(false)} />
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
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  promesseTitre: { fontFamily: FONTS.bodySemibold, fontSize: 16, color: COLORS.vertProfond, marginBottom: 3 },
  promesseSous: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.texte },
  promesseMeta: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, marginTop: 1 },

  bonjour: { fontFamily: FONTS.display, fontSize: 28, color: COLORS.vertProfond },
  sousBonjour: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, marginTop: 2, marginBottom: SPACING.md },

  trio: { flexDirection: 'row', gap: SPACING.sm },
  trioCard: {
    flex: 1,
    backgroundColor: COLORS.blanc,
    borderWidth: 1,
    borderColor: COLORS.bordure,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    minHeight: 78,
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
    marginTop: SPACING.lg, marginBottom: SPACING.sm,
  },
  semaineLien: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.vert },
  semaineCard: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure,
    borderRadius: RADIUS.md, paddingHorizontal: SPACING.md,
  },
  semaineLigne: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm,
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
    paddingVertical: SPACING.xs, fontStyle: 'italic',
  },

  journeeHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    marginTop: SPACING.lg, marginBottom: SPACING.sm,
  },
  journeeBadge: { backgroundColor: COLORS.terracotta, borderRadius: RADIUS.full, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  journeeBadgeTxt: { fontFamily: FONTS.bodyBold, fontSize: 10.5, color: COLORS.blanc },
  journeeCarte: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure,
    borderRadius: RADIUS.md, overflow: 'hidden',
  },
  journeePhoto: { width: '100%', height: 130, backgroundColor: COLORS.ivoireFonce },
  journeeCorps: { flexDirection: 'row', alignItems: 'flex-end', padding: SPACING.md, gap: SPACING.sm },
  journeeTexte: { fontFamily: FONTS.bodyMedium, fontSize: 14.5, color: COLORS.texte },
  journeeMeta: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.ardoise, marginTop: 2 },
  journeeLien: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.vert },
  journeeVide: {
    backgroundColor: COLORS.ivoireFonce, borderRadius: RADIUS.md, padding: SPACING.lg, alignItems: 'center',
  },
  journeeVideTxte: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, marginBottom: SPACING.xs },
  journeeVideCta: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.terracotta },

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