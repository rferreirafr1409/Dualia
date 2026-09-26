import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isToday,
  addMonths,
  subMonths,
  parseISO,
  getDay,
  startOfWeek,
  endOfWeek,
  isSameDay,
  subDays,
} from 'date-fns';
import { fr, pt, es, enGB } from 'date-fns/locale';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useStore } from '../../store/useStore';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../constants/theme';
import { EvenementGarde, ParentRole } from '../../types';
import { TRADUCTIONS } from '../../constants/i18n';
import DatePickerField from '../../components/DatePickerField';

const LOCALES = { fr, pt, es, en: enGB };

const OR = COLORS.or ?? '#C9A84C';

// Sous cette largeur, l'écran est traité comme un téléphone : marges réduites
// et légende sur deux lignes.
const MOBILE_BREAKPOINT = 700;

function jourFR(date: Date): number {
  const d = getDay(date);
  return d === 0 ? 6 : d - 1;
}

function parentDuJour(date: Date, evs: EvenementGarde[]): ParentRole | null {
  for (const ev of evs) {
    const debut = parseISO(ev.dateDebut);
    const fin = parseISO(ev.dateFin);
    if (date >= debut && date <= fin) return ev.parentId;
  }
  return null;
}

function evenementDuJour(date: Date, evs: EvenementGarde[]): EvenementGarde | null {
  const surTiers = evs.find((ev) => {
    if (!ev.tiersId) return false;
    const debut = parseISO(ev.dateDebut);
    const fin = parseISO(ev.dateFin);
    return isSameDay(debut, date) && isSameDay(fin, date);
  });
  if (surTiers) return surTiers;
  return evs.find((ev) => {
    const debut = parseISO(ev.dateDebut);
    const fin = parseISO(ev.dateFin);
    return date >= debut && date <= fin;
  }) ?? null;
}

function estJourDePassage(date: Date, tousLesEvenements: EvenementGarde[]): boolean {
  const veille = subDays(date, 1);
  const parentJour = parentDuJour(date, tousLesEvenements);
  const parentVeille = parentDuJour(veille, tousLesEvenements);
  return parentJour !== null && parentVeille !== null && parentJour !== parentVeille;
}

export default function CalendrierScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < MOBILE_BREAKPOINT;
  // enfant : prénom d'un enfant, passé depuis la fiche "L'Essentiel" pour ne
  // montrer que ses événements ponctuels (école, activités...). Le planning
  // de garde, lui, n'est jamais filtré : il n'est pas propre à un enfant.
  const params = useLocalSearchParams<{ enfant?: string }>();
  const enfantFiltre = params.enfant ?? null;
  const { evenements, parents, evenementsCalendrier, langue, parentActif, ajouterEvenementCalendrier, enfants } = useStore();
  const tiers = useStore((s) => s.tiers);
  const confierGardeATiers = useStore((s) => s.confierGardeATiers);
  const supprimerEvenementGarde = useStore((s) => s.supprimerEvenementGarde);
  const t = TRADUCTIONS[langue].calendrier;
  const dateLocale = LOCALES[langue];
  const JOURS = t.jours;
  const [mois, setMois] = useState(new Date());
  const [jourSelectionne, setJourSelectionne] = useState<Date | null>(null);

  const [modalAjoutVisible, setModalAjoutVisible] = useState(false);
  // Message affiche dans la fenetre d'ajout quand l'evenement a ete refuse.
  const [erreurAjout, setErreurAjout] = useState<string | null>(null);
  const [formTitre, setFormTitre] = useState('');
  const [formDate, setFormDate] = useState<Date | null>(null);
  const [formHeure, setFormHeure] = useState('');
  const [formParent, setFormParent] = useState<ParentRole>(parentActif);
  const [formEnfantId, setFormEnfantId] = useState<string | null>(null);

  const [modeleModalVisible, setModeleModalVisible] = useState(false);
  const [modeleChoisi, setModeleChoisi] = useState<'alternee' | 'weekend' | null>(null);
  const [modeleDateDebut, setModeleDateDebut] = useState<Date | null>(null);
  const [modeleParent, setModeleParent] = useState<ParentRole>(parentActif);
  const genererCalendrierAlterne = useStore((s) => s.genererCalendrierAlterne);
  const genererCalendrierGardeWeekend = useStore((s) => s.genererCalendrierGardeWeekend);

  const reinitialiserModeleModal = () => {
    setModeleChoisi(null);
    setModeleDateDebut(null);
    setModeleParent(parentActif);
  };

  const confirmerModele = () => {
    if (!modeleChoisi || !modeleDateDebut) return;
    if (modeleChoisi === 'alternee') {
      genererCalendrierAlterne(modeleDateDebut.toISOString(), modeleParent, 12);
    } else {
      genererCalendrierGardeWeekend(modeleDateDebut.toISOString(), modeleParent, 12);
    }
    setModeleModalVisible(false);
    reinitialiserModeleModal();
    const message = t.modeleGardeGenere;
    if (Platform.OS === 'web') window.alert(message);
    else Alert.alert(message);
  };

  const jours = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(mois), end: endOfMonth(mois) }),
    [mois]
  );

  const tiersGardiens = useMemo(
    () => tiers.filter((tr) => tr.peutEtreGardien && tr.statut !== 'revoque'),
    [tiers]
  );

  const decalage = useMemo(() => jourFR(startOfMonth(mois)), [mois]);

  const semaines = useMemo(() => {
    const cellules: (Date | null)[] = [
      ...Array.from({ length: decalage }, () => null),
      ...jours,
    ];
    while (cellules.length % 7 !== 0) cellules.push(null);
    const resultat: (Date | null)[][] = [];
    for (let i = 0; i < cellules.length; i += 7) {
      resultat.push(cellules.slice(i, i + 7));
    }
    return resultat;
  }, [decalage, jours]);

  const evsMois = useMemo(
    () =>
      evenements.filter((ev) => {
        const debut = parseISO(ev.dateDebut);
        const fin = parseISO(ev.dateFin);
        return debut <= endOfMonth(mois) && fin >= startOfMonth(mois);
      }),
    [evenements, mois]
  );

  const recapMois = useMemo(() => {
    const compteur: Partial<Record<ParentRole, number>> = {};
    jours.forEach((jour) => {
      const parentId = parentDuJour(jour, evsMois);
      if (parentId) {
        compteur[parentId] = (compteur[parentId] ?? 0) + 1;
      }
    });
    return compteur;
  }, [jours, evsMois]);

  const debutSemaine = useMemo(() => startOfWeek(new Date(), { weekStartsOn: 1 }), []);
  const finSemaine = useMemo(() => endOfWeek(new Date(), { weekStartsOn: 1 }), []);

  // Résout le prénom passé en paramètre vers l'enfant réel du foyer, pour
  // filtrer par enfantId (fiable) plutôt que par comparaison de texte.
  const enfantFiltreResolu = useMemo(
    () => (enfantFiltre ? enfants.find((e) => e.prenom === enfantFiltre) : null),
    [enfants, enfantFiltre]
  );

  // evenementsCalendrier filtré par enfant quand un filtre est actif —
  // compare enfantId en priorité (fiable), avec repli sur le label texte
  // pour les événements créés avant cette migration.
  const evenementsCalendrierFiltres = useMemo(() => {
    if (!enfantFiltre) return evenementsCalendrier;
    return evenementsCalendrier.filter(
      (ev) =>
        (enfantFiltreResolu && ev.enfantId === enfantFiltreResolu.id) ||
        (!ev.enfantId && ev.enfant === enfantFiltre)
    );
  }, [evenementsCalendrier, enfantFiltre, enfantFiltreResolu]);

  const elementsSemaine = useMemo(() => {
    const gardes = evenements
      .filter((ev) => {
        const debut = parseISO(ev.dateDebut);
        const fin = parseISO(ev.dateFin);
        return debut <= finSemaine && fin >= debutSemaine;
      })
      .map((ev) => ({
        id: ev.id,
        kind: 'garde' as const,
        date: parseISO(ev.dateDebut),
        dateFin: parseISO(ev.dateFin),
        parentId: ev.parentId,
        type: ev.type,
      }));
    const evs = evenementsCalendrierFiltres
      .filter((ev) => {
        const d = parseISO(ev.date);
        return d >= debutSemaine && d <= finSemaine;
      })
      .map((ev) => ({
        id: ev.id,
        kind: 'evenement' as const,
        date: parseISO(ev.date),
        titre: ev.titre,
        enfant: ev.enfant,
        parentId: ev.parentId,
      }));
    // Filtré : uniquement les événements ponctuels (pas de garde à filtrer,
    // elle n'est pas propre à un enfant).
    return [...(enfantFiltre ? [] : gardes), ...evs].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [evenements, evenementsCalendrierFiltres, debutSemaine, finSemaine, enfantFiltre]);

  const elementsJour = useMemo(() => {
    if (!jourSelectionne) return { garde: undefined as EvenementGarde | undefined, evenements: [] as typeof evenementsCalendrier };
    const gardeDuJour = enfantFiltre ? undefined : evenementDuJour(jourSelectionne, evsMois) ?? undefined;
    const evsJour = evenementsCalendrierFiltres.filter((ev) =>
      isSameDay(parseISO(ev.date), jourSelectionne)
    );
    return { garde: gardeDuJour, evenements: evsJour };
  }, [jourSelectionne, evsMois, evenementsCalendrierFiltres, enfantFiltre]);

  const jourSelectionneEstPassage = useMemo(
    () => (jourSelectionne ? estJourDePassage(jourSelectionne, evenements) : false),
    [jourSelectionne, evenements]
  );

  const ouvrirAjoutEvenement = () => {
    setFormTitre('');
    setFormDate(new Date());
    setFormHeure('');
    setFormParent(parentActif);
    setFormEnfantId(enfantFiltreResolu?.id ?? null);
    setErreurAjout(null);
    setModalAjoutVisible(true);
  };

  const soumettreEvenement = () => {
    if (!formTitre.trim() || !formDate) return;

    const dateComplete = new Date(formDate);
    // Accepte "18:30" comme "18H30" ou "18h30" — évite qu'une heure tapée
    // dans un format légèrement différent du placeholder soit silencieusement
    // ignorée et l'événement enregistré sans heure.
    const heureNormalisee = formHeure.trim().toLowerCase().replace('h', ':');
    const heureValide = /^([01]?\d|2[0-3]):([0-5]\d)$/.test(heureNormalisee);
    if (heureValide) {
      const [h, m] = heureNormalisee.split(':').map(Number);
      dateComplete.setHours(h, m, 0, 0);
    } else {
      dateComplete.setHours(0, 0, 0, 0);
    }

    const enfantChoisi = formEnfantId ? enfants.find((e) => e.id === formEnfantId) : undefined;

    const retenu = ajouterEvenementCalendrier({
      id: `evt-${Date.now()}`,
      titre: formTitre.trim(),
      date: dateComplete.toISOString(),
      parentId: formParent,
      enfant: enfantChoisi?.prenom,
      enfantId: enfantChoisi?.id,
    });

    // On ne ferme la fenetre que si l'evenement a bien ete retenu. La fermer
    // dans tous les cas donnait au parent la preuve visible d'un
    // enregistrement qui n'avait pas eu lieu, et sa saisie etait perdue.
    //
    // Et on le dit : une fenetre qui reste ouverte sans un mot apres un appui
    // sur « Ajouter » se lit comme une panne, pas comme un refus.
    if (!retenu) {
      setErreurAjout(t.dateIllisible);
      return;
    }
    setErreurAjout(null);
    setModalAjoutVisible(false);
  };

  return (
    <SafeAreaView style={styles.conteneur} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {enfantFiltre ? (
          <View style={styles.filtreEnfantBanner}>
            <Ionicons name="funnel-outline" size={14} color={COLORS.vertProfond} />
            <Text style={styles.filtreEnfantTexte}>{enfantFiltre}</Text>
            <TouchableOpacity onPress={() => router.setParams({ enfant: undefined })} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={COLORS.ardoise} />
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={[styles.legende, isMobile && styles.legendeMobile]}>
          <View style={[styles.legendeHaut, isMobile && styles.legendeHautMobile]}>
            <View style={[styles.legendeParents, isMobile && styles.legendeParentsMobile]}>
              {(['A', 'B'] as ParentRole[]).map((role) => (
                <View key={role} style={styles.legendeItem}>
                  <View
                    style={[styles.legendePuce, { backgroundColor: parents[role].couleur }]}
                  />
                  <Text style={styles.legendeTxt} numberOfLines={1}>{parents[role].nom}</Text>
                </View>
              ))}
            </View>
            {/* Action principale en haut, comme Documents et Journal. Plus
                aucun bouton flottant : la bulle de retour BETA se place par
                rapport à la fenêtre, un bouton d'écran par rapport à la zone
                de contenu — les faire cohabiter en bas à droite relève du
                hasard, jamais de la mise en page. */}
            <TouchableOpacity style={styles.ajouterBtn} onPress={ouvrirAjoutEvenement} activeOpacity={0.85}>
              <Ionicons name="add" size={16} color={COLORS.blanc} />
              <Text style={styles.ajouterBtnTxt} numberOfLines={1}>{t.ajouter.replace('+ ', '')}</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.legendeDroiteWrap, isMobile && styles.legendeDroiteWrapMobile]}>
            <TouchableOpacity style={styles.modeleGardeLienBtn} onPress={() => setModeleModalVisible(true)}>
              <Ionicons name="sparkles-outline" size={13} color={COLORS.vert} />
              <Text style={styles.modeleGardeLienTxt} numberOfLines={1}>{t.modeleGardeLien}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modeleGardeLienBtn} onPress={() => router.push('/calendriers-externes' as any)}>
              <Ionicons name="link-outline" size={13} color={COLORS.vert} />
              <Text style={styles.modeleGardeLienTxt} numberOfLines={1}>Calendriers externes</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.navMois, isMobile && styles.blocMobile]}>
          <TouchableOpacity
            onPress={() => setMois((m) => subMonths(m, 1))}
            style={styles.navBtn}
            accessibilityLabel={langue === 'pt' ? 'Mês anterior' : 'Mois précédent'}
          >
            <Ionicons name="chevron-back" size={18} color={COLORS.ardoise} />
          </TouchableOpacity>
          <View style={styles.titreMoisWrap}>
            <Text style={styles.titreMois}>
              {format(mois, 'MMMM yyyy', { locale: dateLocale })}
            </Text>
            <View style={styles.titreMoisTrait} />
          </View>
          <TouchableOpacity
            onPress={() => setMois((m) => addMonths(m, 1))}
            style={styles.navBtn}
            accessibilityLabel={langue === 'pt' ? 'Mês seguinte' : 'Mois suivant'}
          >
            <Ionicons name="chevron-forward" size={18} color={COLORS.ardoise} />
          </TouchableOpacity>
        </View>

        <View style={[styles.recapMois, isMobile && styles.blocMobile]}>
          <Text style={[styles.recapNom, { color: parents.A.couleur }]}>
            {parents.A.nom.split(' ')[0]}
          </Text>
          <Text style={[styles.recapNb, { color: COLORS.texte }]}>{recapMois.A ?? 0}{t.jourAbrev}</Text>
          <View style={styles.recapPuceOr} />
          <Text style={[styles.recapNom, { color: parents.B.couleur }]}>
            {parents.B.nom.split(' ')[0]}
          </Text>
          <Text style={[styles.recapNb, { color: COLORS.texte }]}>{recapMois.B ?? 0}{t.jourAbrev}</Text>
        </View>

        <View style={[styles.grilleWrap, isMobile && styles.grilleWrapMobile]}>
          <View style={styles.grilleLigne}>
            {JOURS.map((j, i) => (
              <View key={i} style={[styles.cellule, isMobile && styles.celluleMobile, styles.celluleHeader]}>
                <Text style={[styles.headerJour, isMobile && styles.headerJourMobile]} numberOfLines={1}>
                  {j}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.grille}>
            {semaines.map((semaine, wi) => (
              <View key={wi} style={styles.grilleSemaineLigne}>
                {semaine.map((jour, di) => {
                  if (!jour) {
                    return <View key={di} style={[styles.cellule, isMobile && styles.celluleMobile]} />;
                  }

                  const evGardeJour = enfantFiltre ? null : evenementDuJour(jour, evsMois);
                  const tiersJour = evGardeJour?.tiersId ? tiers.find((tr) => tr.id === evGardeJour.tiersId) : undefined;
                  const parentId = evGardeJour?.parentId ?? null;
                  const couleur = tiersJour ? COLORS.or : parentId ? parents[parentId].couleur : null;
                  const prenomParent = tiersJour ? tiersJour.nom.split(' ')[0] : parentId ? parents[parentId].nom.split(' ')[0] : null;
                  const estAujourdhui = isToday(jour);
                  const estPassage = enfantFiltre ? false : estJourDePassage(jour, evenements);
                  const evsJourCellule = evenementsCalendrierFiltres.filter((ev) =>
                    isSameDay(parseISO(ev.date), jour)
                  );

                  return (
                    <TouchableOpacity
                      key={di}
                      style={[styles.cellule, isMobile && styles.celluleMobile]}
                      activeOpacity={0.7}
                      onPress={() => setJourSelectionne(jour)}
                    >
                      {estPassage ? (
                        <View style={styles.pastilleTransfert}>
                          <Ionicons name="swap-horizontal" size={9} color={COLORS.blanc} />
                        </View>
                      ) : null}
                      <Text style={[styles.numeroJourTop, estAujourdhui && styles.numeroJourTopAujourdhui]}>
                        {format(jour, 'd')}
                      </Text>
                      <View style={styles.etiquettesWrap}>
                        {couleur ? (
                          <View style={[styles.etiquetteGarde, { backgroundColor: couleur }]}>
                            <Text style={styles.etiquetteGardeTxt} numberOfLines={1}>
                              {prenomParent}
                            </Text>
                          </View>
                        ) : null}
                        {evsJourCellule.slice(0, couleur ? 1 : 2).map((ev) => (
                          <View key={ev.id} style={styles.etiquetteEvenement}>
                            <Text style={styles.etiquetteEvenementTxt} numberOfLines={1}>
                              {ev.titre}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        {jourSelectionne && (
          <View style={[styles.panneauJour, isMobile && styles.blocMobile]}>
            <View style={styles.panneauJourHeader}>
              <Text style={styles.panneauJourTitre}>
                {format(jourSelectionne, 'EEEE d MMMM yyyy', { locale: dateLocale })}
              </Text>
              <TouchableOpacity onPress={() => setJourSelectionne(null)} hitSlop={8}>
                <Ionicons name="close" size={18} color={COLORS.ardoise} />
              </TouchableOpacity>
            </View>

            {jourSelectionneEstPassage ? (
              <View style={styles.modalLigne}>
                <View style={styles.modalPuceTransfert}>
                  <Ionicons name="swap-horizontal" size={11} color={COLORS.blanc} />
                </View>
                <Text style={[styles.modalTexte, { fontWeight: TYPOGRAPHY.semibold }]}>
                  {t.passage}
                </Text>
              </View>
            ) : null}

            {elementsJour.garde ? (
              <View style={styles.modalLigne}>
                <View
                  style={[
                    styles.modalPuce,
                    { backgroundColor: elementsJour.garde.tiersId ? COLORS.or : parents[elementsJour.garde.parentId].couleur },
                  ]}
                />
                <Text style={styles.modalTexte}>
                  {elementsJour.garde.tiersId
                    ? `${t.garde} — Confié à ${tiers.find((tr) => tr.id === elementsJour.garde!.tiersId)?.nom ?? '—'}`
                    : `${t.garde} — ${parents[elementsJour.garde.parentId].nom}`}
                </Text>
              </View>
            ) : null}

            {jourSelectionne && !enfantFiltre ? (
              elementsJour.garde?.tiersId ? (
                <TouchableOpacity
                  style={styles.tiersRetirerBtn}
                  onPress={() => supprimerEvenementGarde(elementsJour.garde!.id)}
                >
                  <Text style={styles.tiersRetirerBtnTexte}>Retirer, revenir au rythme habituel</Text>
                </TouchableOpacity>
              ) : tiersGardiens.length > 0 ? (
                <View style={styles.tiersConfierBloc}>
                  <Text style={styles.tiersConfierLabel}>Confier ce jour à :</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {tiersGardiens.map((tr) => (
                      <TouchableOpacity
                        key={tr.id}
                        style={styles.tiersConfierChip}
                        onPress={() => confierGardeATiers(jourSelectionne.toISOString(), tr.id)}
                      >
                        <Text style={styles.tiersConfierChipTexte}>{tr.nom}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null
            ) : null}

            {elementsJour.evenements.length > 0
              ? elementsJour.evenements.map((ev) => (
                  <View key={ev.id} style={styles.modalLigne}>
                    <View
                      style={[
                        styles.modalPuce,
                        { backgroundColor: parents[ev.parentId]?.couleur ?? OR },
                      ]}
                    />
                    <Text style={styles.modalTexte}>
                      {ev.titre}
                      {ev.enfant ? ` — ${ev.enfant}` : ''}
                      {(() => {
                        const d = parseISO(ev.date);
                        const aUneHeure = d.getHours() !== 0 || d.getMinutes() !== 0;
                        return aUneHeure ? ` — ${format(d, 'HH:mm')}` : '';
                      })()}
                    </Text>
                  </View>
                ))
              : null}

            {!elementsJour.garde && elementsJour.evenements.length === 0 ? (
              <Text style={styles.videTxt}>{t.aucunEvenement}</Text>
            ) : null}
          </View>
        )}

        <View style={[styles.section, isMobile && styles.sectionMobile]}>
          <View style={styles.sectionTitreLigne}>
            <Text style={styles.sectionTitre}>{t.semaineEnCours}</Text>
            <View style={styles.sectionTitreTrait} />
          </View>
          {elementsSemaine.length === 0 ? (
            <Text style={styles.videTxt}>{t.aucunEvenement}</Text>
          ) : (
            elementsSemaine.map((ev) => {
              const parent = parents[ev.parentId];
              return (
                <View key={ev.id} style={styles.carteEv}>
                  <View style={[styles.barreEv, { backgroundColor: parent.couleur }]} />
                  <View style={styles.contenuEv}>
                    <Text style={styles.evParent}>{parent.nom}</Text>
                    <Text style={styles.evDate}>
                      {format(ev.date, 'EEEE d MMM', { locale: dateLocale })}
                      {(() => {
                        if (ev.kind !== 'evenement') return '';
                        const aUneHeure = ev.date.getHours() !== 0 || ev.date.getMinutes() !== 0;
                        return aUneHeure ? ` · ${format(ev.date, 'HH:mm')}` : '';
                      })()}
                    </Text>
                    <Text style={styles.evType}>
                      {ev.kind === 'garde' ? (t.typesGarde[ev.type] ?? ev.type.replace(/_/g, ' ')) : ev.titre}
                    </Text>
                  </View>
                  <View style={styles.evDot}>
                    <Ionicons name={ev.kind === 'garde' ? 'home-outline' : 'calendar-outline'} size={14} color={OR} />
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: SPACING.xxxl + 70 }} />
      </ScrollView>

      <Modal
        visible={modalAjoutVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalAjoutVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalAjoutVisible(false)} />
          <View style={styles.modalAjout}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalPoignee} />
              <Text style={styles.modalAjoutTitre}>{t.modalTitreEvenement}</Text>

              <Text style={styles.label}>{t.champTitre}</Text>
              <TextInput
                style={styles.input}
                value={formTitre}
                onChangeText={setFormTitre}
                placeholder={t.titrePlaceholder}
                placeholderTextColor={COLORS.ardoise}
              />

              <DatePickerField label={t.dateDebut} value={formDate} onChange={setFormDate} />
              <View style={{ height: SPACING.lg }} />

              <Text style={styles.label}>{t.heure}</Text>
              <TextInput
                style={styles.input}
                value={formHeure}
                onChangeText={setFormHeure}
                placeholder={t.heurePlaceholder}
                placeholderTextColor={COLORS.ardoise}
                keyboardType="numbers-and-punctuation"
              />

              <Text style={styles.label}>{t.parent}</Text>
              <View style={styles.parentChoixLigne}>
                {(['A', 'B'] as ParentRole[]).map((role) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.parentChoix,
                      formParent === role && { backgroundColor: parents[role].couleur, borderColor: parents[role].couleur },
                    ]}
                    onPress={() => setFormParent(role)}
                  >
                    <Text style={[styles.parentChoixTxt, formParent === role && { color: COLORS.blanc }]}>
                      {parents[role].nom.split(' ')[0]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {enfants.length > 0 ? (
                <>
                  <Text style={styles.label}>Enfant concerné (optionnel)</Text>
                  <View style={styles.parentChoixLigne}>
                    <TouchableOpacity
                      style={[styles.parentChoix, formEnfantId === null && { backgroundColor: COLORS.vertProfond, borderColor: COLORS.vertProfond }]}
                      onPress={() => setFormEnfantId(null)}
                    >
                      <Text style={[styles.parentChoixTxt, formEnfantId === null && { color: COLORS.blanc }]}>Tous</Text>
                    </TouchableOpacity>
                    {enfants.map((e) => (
                      <TouchableOpacity
                        key={e.id}
                        style={[styles.parentChoix, formEnfantId === e.id && { backgroundColor: COLORS.vertProfond, borderColor: COLORS.vertProfond }]}
                        onPress={() => setFormEnfantId(e.id)}
                      >
                        <Text style={[styles.parentChoixTxt, formEnfantId === e.id && { color: COLORS.blanc }]}>{e.prenom}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              ) : null}

              {erreurAjout ? <Text style={styles.erreurAjout}>{erreurAjout}</Text> : null}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.btnAnnuler} onPress={() => setModalAjoutVisible(false)}>
                  <Text style={styles.btnAnnulerTxt}>{t.annuler}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnValider, !formTitre.trim() && styles.btnDisabled]}
                  onPress={soumettreEvenement}
                  disabled={!formTitre.trim()}
                >
                  <Text style={styles.btnValiderTxt}>{t.confirmerAjout}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={modeleModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setModeleModalVisible(false);
          reinitialiserModeleModal();
        }}
      >
        <View style={styles.overlay}>
          <View style={styles.modalAjout}>
            <View style={styles.modalPoignee} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalAjoutTitre}>{t.modeleGardeTitre}</Text>
              <Text style={styles.modeleGardeSousTitre}>{t.modeleGardeSousTitre}</Text>

              <TouchableOpacity
                style={[styles.modeleOption, modeleChoisi === 'alternee' && styles.modeleOptionActif]}
                onPress={() => setModeleChoisi('alternee')}
              >
                <Ionicons name="swap-horizontal-outline" size={20} color={modeleChoisi === 'alternee' ? COLORS.vert : COLORS.ardoise} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.modeleOptionTitre}>{t.modeleGardeAlternee}</Text>
                  <Text style={styles.modeleOptionDesc}>{t.modeleGardeAlterneeDesc}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modeleOption, modeleChoisi === 'weekend' && styles.modeleOptionActif]}
                onPress={() => setModeleChoisi('weekend')}
              >
                <Ionicons name="home-outline" size={20} color={modeleChoisi === 'weekend' ? COLORS.vert : COLORS.ardoise} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.modeleOptionTitre}>{t.modeleGardeWeekend}</Text>
                  <Text style={styles.modeleOptionDesc}>{t.modeleGardeWeekendDesc}</Text>
                </View>
              </TouchableOpacity>

              {modeleChoisi ? (
                <>
                  <View style={{ height: SPACING.md }} />
                  <DatePickerField
                    label={modeleChoisi === 'alternee' ? t.modeleGardeDateDebut : t.modeleGardeDateDebut}
                    value={modeleDateDebut}
                    onChange={setModeleDateDebut}
                  />

                  <Text style={styles.label}>
                    {modeleChoisi === 'alternee' ? t.modeleGardeQuiCommence : t.modeleGardeQuiResident}
                  </Text>
                  <View style={styles.parentChoixLigne}>
                    {(['A', 'B'] as ParentRole[]).map((role) => (
                      <TouchableOpacity
                        key={role}
                        style={[
                          styles.parentChoix,
                          modeleParent === role && { backgroundColor: parents[role].couleur, borderColor: parents[role].couleur },
                        ]}
                        onPress={() => setModeleParent(role)}
                      >
                        <Text style={[styles.parentChoixTxt, modeleParent === role && { color: COLORS.blanc }]}>
                          {parents[role].nom}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.modeleAvertissement}>{t.modeleGardeAvertissement}</Text>
                </>
              ) : null}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.btnAnnuler}
                  onPress={() => {
                    setModeleModalVisible(false);
                    reinitialiserModeleModal();
                  }}
                >
                  <Text style={styles.btnAnnulerTxt}>{t.modeleGardeAnnuler}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnValider, !(modeleChoisi && modeleDateDebut) && styles.btnDisabled]}
                  onPress={confirmerModele}
                  disabled={!(modeleChoisi && modeleDateDebut)}
                >
                  <Text style={styles.btnValiderTxt}>{t.modeleGardeConfirmer}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: COLORS.ivoire },

  filtreEnfantBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#EEF4F1', marginHorizontal: SPACING.lg, marginTop: SPACING.md,
    borderRadius: RADIUS.full, paddingHorizontal: SPACING.md, paddingVertical: 6, alignSelf: 'flex-start',
  },
  filtreEnfantTexte: { fontWeight: TYPOGRAPHY.semibold, fontSize: 12.5, color: COLORS.vertProfond },

  legende: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xxl,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  // Téléphone : les noms des parents sur une ligne, les deux liens en dessous.
  legendeMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  legendeHaut: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg },
  legendeHautMobile: { width: '100%', justifyContent: 'space-between', gap: SPACING.sm },
  legendeParents: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xxl },
  legendeParentsMobile: { gap: SPACING.lg, flexShrink: 1 },
  legendeItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, flexShrink: 1, minWidth: 0 },
  legendePuce: { width: 10, height: 10, borderRadius: RADIUS.sm },
  legendeTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.texte, fontWeight: TYPOGRAPHY.medium, flexShrink: 1 },
  legendeDroiteWrap: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginLeft: 'auto' },
  legendeDroiteWrapMobile: {
    marginLeft: 0,
    width: '100%',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },

  navMois: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: SPACING.lg, marginBottom: SPACING.md,
    backgroundColor: COLORS.blanc, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.bordure,
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm,
  },
  navBtn: { padding: SPACING.sm, borderRadius: RADIUS.md },
  titreMoisWrap: { alignItems: 'center' },
  titreMois: {
    fontSize: TYPOGRAPHY.lg, fontWeight: TYPOGRAPHY.semibold, color: COLORS.vertProfond,
    textTransform: 'capitalize', letterSpacing: 0.4,
  },
  titreMoisTrait: { width: 28, height: 2, backgroundColor: OR, borderRadius: 1, marginTop: 4 },

  // Marges réduites sur téléphone : SPACING.lg de chaque côté mangeait déjà
  // près d'un dixième de la largeur utile de la grille.
  blocMobile: { marginHorizontal: SPACING.md },
  sectionMobile: { paddingHorizontal: SPACING.md },

  grilleWrap: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },
  grilleWrapMobile: { paddingHorizontal: SPACING.md },
  grilleLigne: { flexDirection: 'row', marginBottom: SPACING.xs },
  grille: {
    borderRadius: RADIUS.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.bordure, backgroundColor: COLORS.blanc,
  },
  grilleSemaineLigne: { flexDirection: 'row' },
  cellule: { flex: 1, height: 64, minWidth: 0, alignItems: 'stretch', justifyContent: 'flex-start', paddingTop: 4, paddingHorizontal: 2, position: 'relative' },
  // 7 cellules sur ~360 px : chaque pixel de marge intérieure compte.
  celluleMobile: { height: 70, paddingHorizontal: 1 },
  celluleHeader: { height: 28, alignItems: 'center', justifyContent: 'center' },
  headerJour: {
    fontSize: TYPOGRAPHY.xs, fontWeight: TYPOGRAPHY.semibold, color: COLORS.ardoise,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  headerJourMobile: { fontSize: 10, letterSpacing: 0 },
  numeroJourTop: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: TYPOGRAPHY.medium,
    color: COLORS.texte,
    textAlign: 'center',
    marginBottom: 3,
  },
  numeroJourTopAujourdhui: {
    color: COLORS.blanc,
    fontWeight: TYPOGRAPHY.bold,
    backgroundColor: OR,
    borderRadius: RADIUS.full,
    width: 18,
    height: 18,
    lineHeight: 18,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  etiquettesWrap: { gap: 2, minWidth: 0 },
  etiquetteGarde: {
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  etiquetteGardeTxt: {
    fontSize: 8.5,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.blanc,
  },
  etiquetteEvenement: {
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
    backgroundColor: 'rgba(201,168,76,0.18)',
    overflow: 'hidden',
  },
  etiquetteEvenementTxt: {
    fontSize: 8.5,
    fontWeight: TYPOGRAPHY.medium,
    color: '#8A6D1E',
  },
  pastilleTransfert: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 14,
    height: 14,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.vertProfond,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },

  recapMois: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    marginHorizontal: SPACING.lg, marginBottom: SPACING.md, paddingVertical: SPACING.sm,
  },
  recapNom: { fontSize: TYPOGRAPHY.sm, fontWeight: TYPOGRAPHY.semibold },
  recapNb: { fontSize: TYPOGRAPHY.sm, fontWeight: TYPOGRAPHY.medium },
  recapPuceOr: { width: 4, height: 4, borderRadius: RADIUS.full, backgroundColor: OR, marginHorizontal: SPACING.sm },

  section: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  sectionTitreLigne: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  sectionTitre: {
    fontSize: TYPOGRAPHY.xs, fontWeight: TYPOGRAPHY.semibold, color: COLORS.ardoise,
    textTransform: 'uppercase', letterSpacing: 1.2,
  },
  sectionTitreTrait: { flex: 1, height: 1, backgroundColor: COLORS.bordure },
  videTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.ardoise, paddingVertical: SPACING.md },
  carteEv: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.blanc, borderRadius: RADIUS.md,
    marginBottom: SPACING.sm, borderWidth: 1, borderColor: COLORS.bordure, overflow: 'hidden',
  },
  barreEv: { width: 3, alignSelf: 'stretch' },
  contenuEv: { flex: 1, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  evParent: { fontSize: TYPOGRAPHY.md, fontWeight: TYPOGRAPHY.semibold, color: COLORS.texte },
  evDate: { fontSize: TYPOGRAPHY.sm, color: COLORS.ardoise, marginTop: 2, textTransform: 'capitalize' },
  evType: { fontSize: TYPOGRAPHY.xs, color: COLORS.vertProfond, marginTop: 4, textTransform: 'capitalize' },
  evDot: {
    width: 34, height: 34, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center',
    marginRight: SPACING.md, backgroundColor: 'rgba(201,168,76,0.12)',
  },

  ajouterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.vert,
    borderRadius: RADIUS.full,
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
  },
  ajouterBtnTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: TYPOGRAPHY.semibold, color: COLORS.blanc },

  panneauJour: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.bordure,
    padding: SPACING.lg,
  },
  panneauJourHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  panneauJourTitre: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.vertProfond,
    textTransform: 'capitalize',
    flex: 1,
    paddingRight: SPACING.sm,
  },
  modalLigne: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: COLORS.bordure,
  },
  modalPuce: { width: 10, height: 10, borderRadius: RADIUS.sm },
  modalPuceTransfert: {
    width: 18, height: 18, borderRadius: RADIUS.full,
    backgroundColor: COLORS.vertProfond, alignItems: 'center', justifyContent: 'center',
  },
  modalTexte: { fontSize: TYPOGRAPHY.sm, color: COLORS.texte },
  modalFermerBtn: {
    marginTop: SPACING.lg, paddingVertical: SPACING.md, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.bordure, alignItems: 'center',
  },
  modalFermerTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: TYPOGRAPHY.semibold, color: COLORS.ardoise },

  overlay: { flex: 1, justifyContent: 'flex-end' },
  modalAjout: {
    backgroundColor: COLORS.blanc,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxxl,
    maxHeight: '85%',
  },
  modalPoignee: { width: 36, height: 4, backgroundColor: COLORS.bordure, borderRadius: RADIUS.full, alignSelf: 'center', marginBottom: SPACING.lg },
  modalAjoutTitre: { fontSize: TYPOGRAPHY.xl, fontWeight: TYPOGRAPHY.bold, color: COLORS.texte, marginBottom: SPACING.lg },
  label: { fontSize: TYPOGRAPHY.xs, fontWeight: TYPOGRAPHY.semibold, color: COLORS.ardoise, letterSpacing: 1, marginBottom: SPACING.sm, textTransform: 'uppercase' },

  modeleGardeLienBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modeleGardeLienTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: TYPOGRAPHY.semibold, color: COLORS.vert },
  modeleGardeSousTitre: { fontSize: TYPOGRAPHY.sm, color: COLORS.ardoise, marginBottom: SPACING.lg },
  modeleOption: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.bordure,
    borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, backgroundColor: COLORS.blanc,
  },
  modeleOptionActif: { borderColor: COLORS.vert, backgroundColor: '#EEF4F1' },
  modeleOptionTitre: { fontSize: TYPOGRAPHY.md, fontWeight: TYPOGRAPHY.semibold, color: COLORS.vertProfond },
  modeleOptionDesc: { fontSize: TYPOGRAPHY.xs, color: COLORS.ardoise, marginTop: 1 },
  modeleAvertissement: { fontSize: TYPOGRAPHY.xs, color: COLORS.terracotta, marginTop: SPACING.sm, marginBottom: SPACING.sm, lineHeight: 16 },
  tiersRetirerBtn: { paddingVertical: 8, marginTop: 4 },
  tiersRetirerBtnTexte: { fontSize: 12.5, fontWeight: TYPOGRAPHY.semibold, color: COLORS.terracotta },
  tiersConfierBloc: { marginTop: 8 },
  tiersConfierLabel: { fontSize: 11.5, color: COLORS.ardoise, marginBottom: 6 },
  tiersConfierChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 14, backgroundColor: COLORS.ivoireFonce },
  tiersConfierChipTexte: { fontSize: 12.5, fontWeight: TYPOGRAPHY.semibold, color: COLORS.vertProfond },
  input: { backgroundColor: COLORS.ivoire, borderRadius: RADIUS.md, padding: SPACING.md, fontSize: TYPOGRAPHY.sm, color: COLORS.texte, marginBottom: SPACING.lg },
  parentChoixLigne: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  parentChoix: {
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.bordure, alignItems: 'center',
  },
  parentChoixTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: TYPOGRAPHY.medium, color: COLORS.texte },
  erreurAjout: { fontSize: 12, color: COLORS.erreur, marginTop: 4, marginBottom: 2 },
  modalActions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xs },
  btnAnnuler: { flex: 1, padding: SPACING.lg, borderRadius: RADIUS.md, backgroundColor: COLORS.ivoire, alignItems: 'center' },
  btnAnnulerTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.ardoise, fontWeight: TYPOGRAPHY.medium },
  btnValider: { flex: 2, padding: SPACING.lg, borderRadius: RADIUS.md, backgroundColor: COLORS.vert, alignItems: 'center' },
  btnDisabled: { opacity: 0.45 },
  btnValiderTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.blanc, fontWeight: TYPOGRAPHY.semibold },
});