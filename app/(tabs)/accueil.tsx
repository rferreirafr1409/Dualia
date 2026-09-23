// app/(tabs)/accueil.tsx
//
// Le "cockpit familial" — grille de cartes personnalisable (Aujourd'hui /
// À traiter / Finances / Leur semaine / Un souvenir récent / Documents
// importants), en 2 colonnes, rangées générées dynamiquement à partir des
// widgets visibles et de leur ordre (voir hooks/useHomeWidgets.ts et
// constants/widgetsCatalog.ts). Contenu plafonné à une largeur maximale et
// centré, pour rester dense et lisible même sur un très grand écran —
// c'est l'espace autour qui respire, pas les cartes qui s'étirent.
// Données réelles via useStore.
//
// "Un souvenir récent" n'est pas une carte mais une bannière : il réutilise
// MemoryAccordionRow, le bandeau déjà partagé par le Journal et "Son
// histoire", en mode replié et non dépliable — l'appui renvoie vers le fil
// de vie. Même objet, même forme partout dans l'app, et l'accueil gagne
// environ 80 px par rapport à la carte photo qu'il remplace.
//
// Pertinence des cartes (voir widgetEstPertinent) : trois widgets ne
// s'affichent que quand ils ont quelque chose à dire, pour que l'essentiel
// tienne sans faire défiler.
//   - "À traiter" et "À anticiper" disparaissent quand ils sont vides ;
//     une carte qui annonce qu'elle n'a rien à annoncer coûte 140 px.
//   - "Transmission" n'obéit pas au vide mais à la date : elle sort à J-2
//     du prochain échange. Affichée en permanence, la check-list devient
//     du décor et on ne la voit plus le jour où elle compte.
// Exception volontaire : tant que le foyer n'est pas en service (aucun
// enfant ou aucun planning de garde), rien n'est masqué — sinon un compte
// neuf ouvre Dualia sur une page presque vide, et son propriétaire ne
// découvre jamais ces fonctions. Les widgets masqués restent listés dans
// /personnaliser-home.

import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Image, TextInput, useWindowDimensions, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { startOfWeek, endOfWeek, addDays, isToday, parseISO, format, differenceInYears } from 'date-fns';
import { fr, pt, es, enGB } from 'date-fns/locale';
import { useStore } from '../../store/useStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { TRADUCTIONS } from '../../constants/i18n';
import { useHomeWidgets } from '../../hooks/useHomeWidgets';
import { useAnticiper } from '../../hooks/useAnticiper';
import { useTransmission } from '../../hooks/useTransmission';
import type { WidgetId } from '../../constants/widgetsCatalog';
import SouvenirModal from '../../components/SouvenirModal';
import JourneeModal from '../../components/JourneeModal';
import Drapeau from '../../components/Drapeau';
import MemoryAccordionRow from '../../components/MemoryAccordionRow';
import type { JournalEntry, ParentRole, DocumentItem } from '../../types';

const LOCALES = { fr, pt, es, en: enGB };
const DESKTOP_BREAKPOINT = 1100;
// En dessous de ce seuil, l'écran passe en disposition mobile : une carte par
// rangée, en-tête sur deux lignes, marges réduites. Sans cela, la grille à
// deux colonnes et la barre d'outils débordent sur un téléphone.
const MOBILE_BREAKPOINT = 700;
const LIGNE_CARTE = 'rgba(23,63,50,0.12)';
const LARGEUR_MAX_CONTENU = 900;
// Nombre de jours avant le prochain échange à partir duquel la carte
// "Transmission" apparaît. 2 jours : assez tôt pour préparer le sac, assez
// tard pour que la carte reste un signal et non un meuble.
const JOURS_AVANT_TRANSMISSION = 2;
// Ordre alphabétique : ne privilégie aucune langue et reste stable
// quand de nouvelles s'ajoutent.
const LANGUES_DISPONIBLES = ['en', 'es', 'fr', 'pt'] as const;

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

function ageEnfant(dateNaissance?: string): number | null {
  if (!dateNaissance) return null;
  return differenceInYears(new Date(), parseISO(dateNaissance));
}

const DOC_COULEUR: Record<string, string> = {
  juridique: COLORS.vert,
  sante: COLORS.terracotta,
  ecole: COLORS.or,
  administratif: COLORS.ardoise,
};

function docCouleur(categorie: string): string {
  return DOC_COULEUR[categorie] ?? COLORS.ardoise;
}

// Regroupe une liste plate en rangées. Deux cartes par rangée sur grand
// écran, une seule sur téléphone : à 390 px de large, une demi-largeur ne
// laisse pas la place d'afficher "Marlon & Shana sont avec toi" ni les sept
// jours de la semaine.
function grouper<T>(liste: T[], parRangee: number): T[][] {
  const resultat: T[][] = [];
  for (let i = 0; i < liste.length; i += parRangee) {
    resultat.push(liste.slice(i, i + parRangee));
  }
  return resultat;
}

export default function AccueilScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const isMobile = width < MOBILE_BREAKPOINT;

  const langue = useStore((s) => s.langue);
  const setLangue = useStore((s) => s.setLangue);
  const familyCard = useStore((s) => s.familyCard);
  const decisions = useStore((s) => s.decisions);
  const depenses = useStore((s) => s.depenses);
  const documents = useStore((s) => s.documents);
  const journalEntries = useStore((s) => s.journalEntries);
  const moments = useStore((s) => s.moments);
  const evenementsCalendrier = useStore((s) => s.evenementsCalendrier);
  const evenements = useStore((s) => s.evenements);
  const enfants = useStore((s) => s.enfants);
  const parents = useStore((s) => s.parents);
  const parentActif = useStore((s) => s.parentActif);
  const suggestionsMessages = useStore((s) => s.suggestionsMessages);
  const t = TRADUCTIONS[langue];
  const dateLocale = LOCALES[langue];
  const prenom = parents[parentActif]?.nom.split(' ')[0] ?? '';

  const { widgetsVisibles } = useHomeWidgets();
  const { echeances: echeancesAAnticiper } = useAnticiper();
  const { prochainPassage, nomProchainParent, items: itemsTransmission, toutCoche: transmissionComplete, toggleCoche: toggleItemTransmission } = useTransmission();

  const [souvenirVisible, setSouvenirVisible] = useState(false);
  const [journeeVisible, setJourneeVisible] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [langueMenuOuvert, setLangueMenuOuvert] = useState(false);

  const initialeMoi = initialeParent(parents[parentActif]?.nom);
  const nomsEnfants = enfants.length > 0 ? enfants.map((e) => e.prenom).join(' & ') : familyCard.enfants;

  const roleGardeAujourdhui = useMemo(() => parentDuJour(new Date(), evenements), [evenements]);
  const gardeAujourdhuiTexte = useMemo(() => {
    if (!roleGardeAujourdhui) return null;
    const nom = parents[roleGardeAujourdhui]?.nom.split(' ')[0] ?? '';
    const pluriel = enfants.length > 1;
    return roleGardeAujourdhui === parentActif
      ? `${nomsEnfants} ${t.accueil.avecToi(pluriel)}`
      : `${nomsEnfants} ${t.accueil.avecAutre(nom, pluriel)}`;
  }, [roleGardeAujourdhui, parentActif, parents, nomsEnfants, enfants.length, t]);

  const prochainEchangeTexte = useMemo(() => {
    const roleAujourdhui = parentDuJour(new Date(), evenements);
    for (let i = 1; i <= 30; i++) {
      const jour = new Date();
      jour.setDate(jour.getDate() + i);
      jour.setHours(0, 0, 0, 0);
      const role = parentDuJour(jour, evenements);
      if (role && role !== roleAujourdhui) {
        return t.accueil.prochainEchangeTexte(i, parents[role]?.nom.split(' ')[0] ?? '');
      }
    }
    return null;
  }, [evenements, parents, langue]);

  const decisionsEnAttente = decisions.filter((d) => d.statut === 'proposée' || d.statut === 'en_attente');
  const depensesNonReglees = depenses.filter((d) => !d.rembourse);
  const nbSuggestionsMessages = Object.keys(suggestionsMessages).length;
  const nbATraiter = decisionsEnAttente.length + nbSuggestionsMessages;
  const derniereDepense = depenses.length > 0 ? depenses[0] : null;
  const souvenir = trouverSouvenir(journalEntries);
  const dernierMoment = moments.length > 0 ? moments[0] : null;

  const evenementsAujourdhui = useMemo(() => {
    return evenementsCalendrier
      .filter((ev) => isToday(parseISO(ev.date)))
      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
  }, [evenementsCalendrier]);

  const joursSemaine = useMemo(() => {
    const debut = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(debut, i));
  }, []);

  const evenementsSemaine = useMemo(() => {
    const debut = startOfWeek(new Date(), { weekStartsOn: 1 });
    const fin = endOfWeek(new Date(), { weekStartsOn: 1 });
    return evenementsCalendrier
      .filter((ev) => {
        const d = parseISO(ev.date);
        return d >= debut && d <= fin;
      })
      .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
  }, [evenementsCalendrier]);

  const documentsRecents = documents.slice(0, 3);

  // Contenu de la bannière "Un souvenir récent". Une seule source à la fois :
  // le dernier moment partagé s'il existe, sinon l'entrée de journal retenue
  // par trouverSouvenir. Mélanger les deux donnerait un titre qui décrit un
  // souvenir et une date qui en décrit un autre.
  const souvenirBanniere = useMemo(() => {
    if (dernierMoment) {
      return {
        photoUrl: dernierMoment.photoUrl as string | undefined,
        emoji: undefined as string | undefined,
        titre: dernierMoment.texte || t.accueil.souvenirPlaceholder,
        meta: t.accueil.unSouvenirRecentTitre,
        extrait: undefined as string | undefined,
        enfantLabel: undefined as string | undefined,
      };
    }
    if (souvenir) {
      const e = souvenir.entry;
      const auteur = parents[e.auteurId]?.nom.split(' ')[0] ?? '';
      const dateTexte = format(parseISO(e.date), 'd MMMM yyyy', { locale: dateLocale });
      return {
        photoUrl: e.photoUrl as string | undefined,
        emoji: e.emoji as string | undefined,
        titre: e.titre,
        meta: auteur ? `${dateTexte} · ${auteur}` : dateTexte,
        extrait: e.description as string | undefined,
        enfantLabel: e.enfant && e.enfant !== 'Tous' ? e.enfant : undefined,
      };
    }
    return {
      photoUrl: undefined as string | undefined,
      emoji: undefined as string | undefined,
      titre: t.accueil.souvenirPlaceholder,
      meta: t.accueil.unSouvenirRecentTitre,
      extrait: undefined as string | undefined,
      enfantLabel: undefined as string | undefined,
    };
  }, [dernierMoment, souvenir, parents, dateLocale, t]);

  // Nombre de jours pleins qui séparent aujourd'hui du prochain échange.
  // null s'il n'y a aucun passage prévu dans le planning.
  const joursAvantPassage = useMemo(() => {
    if (!prochainPassage) return null;
    return Math.round(
      (prochainPassage.date.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000
    );
  }, [prochainPassage]);

  // Un foyer est "en service" dès qu'il a des enfants ET un planning de
  // garde. Avant cela, on n'applique aucun masquage : un espace tout neuf
  // doit montrer ses cartes, même vides, sinon il n'y a rien à découvrir.
  const foyerEnService = enfants.length > 0 && evenements.length > 0;

  function widgetEstPertinent(widgetId: WidgetId): boolean {
    if (!foyerEnService) return true;
    switch (widgetId) {
      case 'a_traiter':
        return nbATraiter > 0;
      case 'a_anticiper':
        return echeancesAAnticiper.length > 0;
      case 'transmission':
        return (
          joursAvantPassage !== null &&
          joursAvantPassage >= 0 &&
          joursAvantPassage <= JOURS_AVANT_TRANSMISSION
        );
      default:
        return true;
    }
  }

  // Rendu de chaque widget par son id — c'est la seule fonction à toucher
  // pour ajouter un nouveau widget (avec son entrée dans WIDGETS_CATALOGUE).
  function renderWidget(widgetId: WidgetId) {
    switch (widgetId) {
      case 'aujourdhui':
        return (
          <Pressable key={widgetId} style={styles.card} onPress={() => setJourneeVisible(true)}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitre}>{t.accueil.cockpitAujourdhui}</Text>
              <View style={styles.roundIcon}><Ionicons name="calendar-outline" size={14} color={COLORS.vert} /></View>
            </View>
            {gardeAujourdhuiTexte ? <Text style={styles.cardStrong} numberOfLines={2}>{gardeAujourdhuiTexte}</Text> : null}
            {evenementsAujourdhui.length > 0 ? (
              evenementsAujourdhui.slice(0, 2).map((ev) => {
                const d = parseISO(ev.date);
                const aUneHeure = d.getHours() !== 0 || d.getMinutes() !== 0;
                return (
                  <View key={ev.id} style={styles.cardRow}>
                    <Text style={styles.cardRowMeta}>{aUneHeure ? format(d, 'HH:mm') : '—'}</Text>
                    <Text style={styles.cardRowTexte} numberOfLines={1}>{ev.titre}</Text>
                  </View>
                );
              })
            ) : (
              <Text style={styles.muted}>{t.accueil.rienPrevuAujourdhui}</Text>
            )}
            <Pressable onPress={() => router.push('/calendrier' as any)}>
              <Text style={styles.mutedLien}>{t.accueil.voirTout}</Text>
            </Pressable>
          </Pressable>
        );

      case 'a_traiter':
        return (
          <Pressable key={widgetId} style={styles.card} onPress={() => router.push('/decisions' as any)}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitre}>{t.accueil.cockpitATraiter}</Text>
              {nbATraiter > 0 ? (
                <View style={styles.minibadge}><Text style={styles.minibadgeTxt}>{nbATraiter}</Text></View>
              ) : null}
            </View>
            {decisionsEnAttente.length > 0 ? (
              decisionsEnAttente.slice(0, 2).map((d) => (
                <View key={d.id} style={styles.cardRow}>
                  <Text style={styles.cardRowTexte} numberOfLines={1}>{d.titre}</Text>
                  <Text style={styles.cardRowChevron}>›</Text>
                </View>
              ))
            ) : (
              <Text style={styles.muted}>{t.accueil.cockpitAExaminer}</Text>
            )}
            {nbSuggestionsMessages > 0 ? (
              <View style={styles.cardRow}>
                <Text style={styles.cardRowTexte} numberOfLines={1}>
                  {t.accueil.messagesAExaminer(nbSuggestionsMessages)}
                </Text>
                <Text style={styles.cardRowChevron}>›</Text>
              </View>
            ) : null}
          </Pressable>
        );

      case 'finances':
        return (
          <Pressable key={widgetId} style={styles.card} onPress={() => router.push('/finances' as any)}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitre}>{t.accueil.attention.financesTitre}</Text>
              <View style={styles.roundIcon}><Ionicons name="wallet-outline" size={14} color={COLORS.vert} /></View>
            </View>
            <Text style={styles.amount}>
              {derniereDepense ? `${derniereDepense.montant.toFixed(2).replace('.', ',')} €` : '0,00 €'}
            </Text>
            <Text style={styles.muted} numberOfLines={1}>
              {derniereDepense ? (derniereDepense.description || derniereDepense.categorie) : t.accueil.organisationAJour}
            </Text>
          </Pressable>
        );

      case 'leur_semaine':
        return (
          <View key={widgetId} style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitre}>{t.accueil.leurSemaine}</Text>
              <Pressable onPress={() => router.push('/semaine-activites' as any)}>
                <Text style={styles.muted}>{t.accueil.voirToutCourt}</Text>
              </Pressable>
            </View>
            <View style={styles.weekdaysRow}>
              {joursSemaine.map((jour) => {
                const aujourdhui = isToday(jour);
                return (
                  <View key={jour.toISOString()} style={styles.weekday}>
                    <Text style={styles.weekdayLabel}>{format(jour, 'EEEEE', { locale: dateLocale })}</Text>
                    <View style={[styles.weekdayNumWrap, aujourdhui && styles.weekdayNumWrapActive]}>
                      <Text style={[styles.weekdayNum, aujourdhui && styles.weekdayNumActive]}>{format(jour, 'd')}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
            {evenementsSemaine.length > 0 ? (
              evenementsSemaine.slice(0, 3).map((ev) => {
                const d = parseISO(ev.date);
                const aUneHeure = d.getHours() !== 0 || d.getMinutes() !== 0;
                const qui = ev.enfant || parents[ev.parentId]?.nom.split(' ')[0] || '';
                return (
                  <View key={ev.id} style={styles.timelineLigne}>
                    <Text style={styles.timelineHeure}>{aUneHeure ? format(d, 'HH:mm') : '—'}</Text>
                    <View style={styles.timelineTexteWrap}>
                      <View style={[styles.timelineDot, { backgroundColor: parents[ev.parentId]?.couleur ?? COLORS.vert }]} />
                      <Text style={styles.timelineTexte} numberOfLines={1}>{ev.titre}{qui ? ` — ${qui}` : ''}</Text>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={styles.muted}>{t.semaine.aucuneActivite}</Text>
            )}
          </View>
        );

      case 'souvenir_recent':
        // Bandeau replié, non dépliable : children={null} et l'appui navigue
        // au lieu d'ouvrir l'accordéon. Le fil de vie est le bon endroit
        // pour lire un souvenir en entier, pas l'accueil.
        return (
          <View key={widgetId} style={styles.banniereWrap}>
            <MemoryAccordionRow
              isExpanded={false}
              onToggle={() =>
                dernierMoment ? router.push('/fil-de-vie' as any) : router.push('/partager-moment' as any)
              }
              photoUrl={souvenirBanniere.photoUrl}
              emoji={souvenirBanniere.emoji}
              titre={souvenirBanniere.titre}
              meta={souvenirBanniere.meta}
              extrait={souvenirBanniere.extrait}
              enfantLabel={souvenirBanniere.enfantLabel}
              children={null}
            />
          </View>
        );

      case 'a_anticiper':
        return (
          <Pressable key={widgetId} style={styles.card} onPress={() => router.push('/echeances' as any)}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitre}>{t.accueil.aAnticiperTitre}</Text>
              <Text style={styles.cardRowChevron}>›</Text>
            </View>
            {echeancesAAnticiper.length > 0 ? (
              echeancesAAnticiper.slice(0, 3).map((ech, index) => (
                <View key={ech.id} style={[styles.docrow, index === Math.min(echeancesAAnticiper.length, 3) - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[styles.docicon, { backgroundColor: `${COLORS.terracotta}1A` }]}>
                    <Ionicons
                      name={ech.type === 'document' ? 'document-text-outline' : 'alert-circle-outline'}
                      size={13}
                      color={COLORS.terracotta}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.docNom} numberOfLines={1}>{ech.titre}</Text>
                    <Text style={styles.muted}>{t.accueil.aAnticiperExpire(format(parseISO(ech.dateEcheance), 'dd/MM/yyyy'))}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.muted}>{t.accueil.aAnticiperVide}</Text>
            )}
          </Pressable>
        );

      case 'transmission':
        return (
          <View key={widgetId} style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitre}>{t.accueil.transmissionTitre}</Text>
              <Pressable onPress={() => router.push('/personnaliser-transmission' as any)}>
                <Ionicons name="options-outline" size={15} color={COLORS.ardoise} />
              </Pressable>
            </View>
            {/* Le jour même, la ligne est omise : "dans 0 j" ne veut rien dire.
                Un libellé dédié ("Échange aujourd'hui, chez X") demande une
                nouvelle clé de traduction dans les quatre langues. */}
            {joursAvantPassage !== null && joursAvantPassage >= 1 ? (
              <Text style={styles.cardStrong} numberOfLines={1}>
                {t.accueil.prochainEchangeTexte(joursAvantPassage, nomProchainParent)}
              </Text>
            ) : null}
            {itemsTransmission.length > 0 ? (
              <>
                {itemsTransmission.slice(0, 4).map((item) => (
                  <Pressable key={item.key} style={styles.cardRow} onPress={() => toggleItemTransmission(item.key)}>
                    <Ionicons
                      name={item.coche ? 'checkbox' : 'square-outline'}
                      size={15}
                      color={item.coche ? COLORS.vert : COLORS.ardoise}
                    />
                    <Text
                      style={[styles.cardRowTexte, item.coche && { textDecorationLine: 'line-through', color: COLORS.ardoise }]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                ))}
                {transmissionComplete ? (
                  <Text style={styles.mutedLien}>{t.accueil.transmissionChecklistComplete}</Text>
                ) : null}
              </>
            ) : (
              <Pressable onPress={() => router.push('/personnaliser-transmission' as any)}>
                <Text style={styles.mutedLien}>{t.accueil.transmissionPersonnaliser}</Text>
              </Pressable>
            )}
          </View>
        );

      default:
        return null;
    }
  }

  // Filet de sécurité : si le filtrage ne laisse rien (un parent qui
  // n'aurait gardé que des cartes contextuelles), on réaffiche la sélection
  // complète plutôt qu'un accueil blanc.
  const widgetsPertinents = widgetsVisibles.filter(widgetEstPertinent);
  const widgetsAffiches = widgetsPertinents.length > 0 ? widgetsPertinents : widgetsVisibles;

  const rangeesWidgets = grouper(widgetsAffiches, isMobile ? 1 : 2);

  return (
    <View style={styles.screen}>
      <View style={[styles.topbar, isMobile && styles.topbarMobile]}>
        {/* Sur téléphone, la barre de recherche est retirée : à cette largeur
            elle écrase les cinq actions de droite, qui se retrouvent coupées.
            Elle réapparaît dès qu'il y a la place. */}
        {isMobile ? (
          <View style={{ flex: 1 }} />
        ) : (
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={16} color={COLORS.ardoise} />
            <TextInput
              style={styles.searchInput}
              value={recherche}
              onChangeText={setRecherche}
              placeholder={t.accueil.rechercherPlaceholder}
              placeholderTextColor={COLORS.ardoise}
            />
          </View>
        )}
        <View style={styles.rightRow}>
          <Pressable style={styles.langBtnSimple} onPress={() => setLangueMenuOuvert(true)}>
            <Drapeau code={langue} taille={16} />
            <Text style={styles.langBtnSimpleText}>{langue.toUpperCase()}</Text>
            <Ionicons name="chevron-down" size={12} color={COLORS.vertProfond} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => router.push('/personnaliser-home' as any)}>
            <Ionicons name="options-outline" size={17} color={COLORS.vertProfond} />
          </Pressable>
          {/* Pas de "+" ici. L'écran en comptait trois : celui-ci, le bouton
              central de la barre de navigation (création globale) et le rond
              pointillé sous les enfants. Les deux autres disent ce qu'ils
              font ; celui-ci menait au même écran que le rond pointillé sans
              l'annoncer. */}
          <Pressable style={styles.iconBtn} onPress={() => router.push('/decisions' as any)}>
            <Ionicons name="notifications-outline" size={17} color={COLORS.vertProfond} />
            {nbATraiter > 0 ? (
              <View style={styles.bellBadge}><Text style={styles.bellBadgeTxt}>{nbATraiter}</Text></View>
            ) : null}
          </Pressable>
          <View style={[styles.avatar, { backgroundColor: COLORS.vert }]}>
            <Text style={styles.avatarText}>{initialeMoi}</Text>
          </View>
        </View>
      </View>

      <Modal
        visible={langueMenuOuvert}
        transparent
        animationType="fade"
        onRequestClose={() => setLangueMenuOuvert(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setLangueMenuOuvert(false)}>
          <View style={styles.langDropdownModal}>
            {LANGUES_DISPONIBLES.map((code) => {
              const actif = langue === code;
              return (
                <Pressable
                  key={code}
                  onPress={() => { setLangue(code); setLangueMenuOuvert(false); }}
                  style={[styles.langDropdownItem, actif && styles.langDropdownItemActive]}
                >
                  <Drapeau code={code} taille={18} />
                  <Text style={[styles.langDropdownText, actif && styles.langDropdownTextActive]}>
                    {code.toUpperCase()}
                  </Text>
                  {actif ? <Ionicons name="checkmark" size={14} color={COLORS.vert} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      <ScrollView
        contentContainerStyle={[styles.content, isMobile && styles.contentMobile]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.contentInner, isDesktop && { maxWidth: LARGEUR_MAX_CONTENU, alignSelf: 'center', width: '100%' }]}>
          {/* Sur téléphone, la date et le prochain échange passent sous le
              titre : côte à côte, ils sont tronqués en plein milieu d'un mot. */}
          <View style={[styles.entete, isMobile && styles.enteteMobile]}>
            <View style={isMobile ? { width: '100%' } : undefined}>
              <Text style={styles.bonjour}>{t.accueil.bonjour} {prenom}</Text>
              <Text style={styles.sousBonjour}>{t.accueil.cockpitSousTitre}</Text>
            </View>
            <View style={isMobile ? styles.enteteDatesMobile : { alignItems: 'flex-end' }}>
              <Text style={styles.dateAujourdhui}>
                {format(new Date(), isMobile ? 'EEEE d MMMM' : 'EEEE d MMMM yyyy', { locale: dateLocale })}
              </Text>
              {prochainEchangeTexte ? <Text style={styles.promesseMeta}>{prochainEchangeTexte}</Text> : null}
            </View>
          </View>

          {enfants.length > 0 ? (
            <View style={[styles.kidsRow, isMobile && styles.kidsRowMobile]}>
              {enfants.map((e) => {
                const ans = ageEnfant(e.dateNaissance);
                return (
                  <Pressable key={e.id} style={styles.kidItem} onPress={() => router.push('/famille' as any)}>
                    <View style={styles.kidFace}>
                      {e.photoUrl ? (
                        <Image source={{ uri: e.photoUrl }} style={styles.kidPhoto} />
                      ) : (
                        <Text style={styles.kidInitiale}>{e.prenom.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                    <Text style={styles.kidNom}>{e.prenom}</Text>
                    {ans !== null ? <Text style={styles.kidAge}>{ans} {t.accueil.ansSuffix}</Text> : null}
                  </Pressable>
                );
              })}
              <Pressable style={styles.kidItem} onPress={() => router.push('/famille' as any)}>
                <View style={styles.kidFaceAjouter}><Ionicons name="add" size={18} color={COLORS.ardoise} /></View>
                <Text style={styles.kidNom}>{t.accueil.ajouterCourt}</Text>
              </Pressable>
            </View>
          ) : null}

          {rangeesWidgets.map((rangee, index) => (
            <View key={index} style={styles.cardsRow}>
              {rangee.map((widgetId) => renderWidget(widgetId))}
            </View>
          ))}
        </View>
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
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, paddingBottom: SPACING.sm, gap: SPACING.md,
  },
  // Marges resserrées : sur un écran de 390 px, SPACING.xl de chaque côté
  // consomme près d'un sixième de la largeur disponible.
  topbarMobile: { paddingHorizontal: SPACING.md, gap: SPACING.sm },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: LIGNE_CARTE,
    borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 8, maxWidth: 360,
  },
  searchInput: { flex: 1, fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.texte, padding: 0 },
  rightRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },

  langBtnSimple: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: LIGNE_CARTE,
    borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 6,
  },
  langBtnSimpleText: { fontFamily: FONTS.bodyBold, fontSize: 11, color: COLORS.vertProfond },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  langDropdownModal: {
    position: 'absolute', top: 62, right: SPACING.xl,
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: LIGNE_CARTE,
    borderRadius: RADIUS.md, paddingVertical: 4, minWidth: 112,
    shadowColor: '#173f32', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16, shadowRadius: 16,
    elevation: 10,
  },
  langDropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  langDropdownItemActive: { backgroundColor: `${COLORS.vert}14` },
  langDropdownText: { flex: 1, fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.texte },
  langDropdownTextActive: { fontFamily: FONTS.bodySemibold, color: COLORS.vertProfond },

  iconBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.blanc,
    borderWidth: 1, borderColor: LIGNE_CARTE, alignItems: 'center', justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute', top: -3, right: -3, backgroundColor: COLORS.terracotta,
    borderRadius: RADIUS.full, minWidth: 15, height: 15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  bellBadgeTxt: { fontFamily: FONTS.bodyBold, fontSize: 9, color: COLORS.blanc },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.blanc },

  // paddingBottom généreux : la barre de navigation et le bouton de retour
  // BETA flottent au-dessus du contenu et masqueraient la dernière carte.
  content: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.sm, paddingBottom: SPACING.xxxl * 2 },
  contentMobile: { paddingHorizontal: SPACING.md },
  contentInner: {},

  entete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: SPACING.lg },
  enteteMobile: { flexDirection: 'column', alignItems: 'flex-start', gap: 6 },
  enteteDatesMobile: { alignItems: 'flex-start', width: '100%' },
  bonjour: { fontFamily: FONTS.display, fontSize: 28, color: COLORS.vertProfond },
  sousBonjour: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, marginTop: 2 },
  dateAujourdhui: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.ardoise, textTransform: 'capitalize' },
  promesseMeta: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.ardoise, marginTop: 2 },

  kidsRow: { flexDirection: 'row', gap: SPACING.xl, marginBottom: SPACING.xl },
  kidsRowMobile: { gap: SPACING.md, marginBottom: SPACING.lg, flexWrap: 'wrap' },
  kidItem: { alignItems: 'center', width: 60 },
  kidFace: {
    width: 44, height: 44, borderRadius: 22, marginBottom: 5, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.terracottaClair,
    borderWidth: 2, borderColor: COLORS.blanc,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  kidFaceAjouter: {
    width: 44, height: 44, borderRadius: 22, marginBottom: 5,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.ardoise, borderStyle: 'dashed',
  },
  kidPhoto: { width: '100%', height: '100%' },
  kidInitiale: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.vertProfond },
  kidNom: { fontFamily: FONTS.bodySemibold, fontSize: 11.5, color: COLORS.vertProfond, textAlign: 'center' },
  kidAge: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.ardoise, textAlign: 'center' },

  cardsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  card: {
    flex: 1,
    backgroundColor: COLORS.blanc,
    borderWidth: 0,
    borderRadius: 20,
    padding: SPACING.md,
    minHeight: 142,
    shadowColor: '#173f32',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.09,
    shadowRadius: 22,
    elevation: 3,
  },

  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardTitre: {
    fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.ardoise,
    textTransform: 'uppercase', letterSpacing: 0.7,
  },
  cardStrong: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.texte, marginBottom: 6 },
  roundIcon: {
    width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
    backgroundColor: `${COLORS.vert}1A`,
  },
  minibadge: {
    backgroundColor: COLORS.terracotta, borderRadius: RADIUS.full,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  minibadgeTxt: { fontFamily: FONTS.bodyBold, fontSize: 10, color: COLORS.blanc },

  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, gap: SPACING.sm },
  cardRowMeta: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, minWidth: 36 },
  cardRowTexte: { flex: 1, fontFamily: FONTS.body, fontSize: 12, color: COLORS.texte },
  cardRowChevron: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.ardoise },

  muted: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise },
  mutedLien: { fontFamily: FONTS.bodySemibold, fontSize: 11.5, color: COLORS.vert, marginTop: 6 },
  amount: { fontFamily: FONTS.displaySemibold, fontSize: 24, color: COLORS.vertProfond, marginVertical: 4 },

  weekdaysRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  // flex: 1 au lieu d'une largeur fixe : les sept jours se répartissent la
  // place disponible au lieu d'imposer 7 x 28 px, qui débordait de la carte.
  weekday: { alignItems: 'center', flex: 1, minWidth: 0 },
  weekdayLabel: { fontFamily: FONTS.body, fontSize: 9, color: COLORS.ardoise, marginBottom: 4, textTransform: 'uppercase' },
  weekdayNumWrap: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  weekdayNumWrapActive: { backgroundColor: COLORS.vert },
  weekdayNum: { fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.texte },
  weekdayNumActive: { color: COLORS.blanc },

  timelineLigne: { flexDirection: 'row', gap: SPACING.sm, marginBottom: 4 },
  timelineHeure: { fontFamily: FONTS.body, fontSize: 10.5, color: COLORS.ardoise, minWidth: 36 },
  timelineTexteWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  timelineDot: { width: 6, height: 6, borderRadius: 3 },
  timelineTexte: { flex: 1, fontFamily: FONTS.body, fontSize: 11, color: COLORS.texte },

  // MemoryAccordionRow porte déjà son propre fond, sa bordure et son rayon :
  // ce conteneur ne fait que lui donner la largeur de colonne de la grille
  // et le centrer verticalement quand il partage sa rangée avec une carte
  // plus haute.
  banniereWrap: { flex: 1, justifyContent: 'center' },

  docrow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: LIGNE_CARTE,
  },
  docicon: { width: 25, height: 25, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  docNom: { fontFamily: FONTS.bodyMedium, fontSize: 12.5, color: COLORS.texte },
});
