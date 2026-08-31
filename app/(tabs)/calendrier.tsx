import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
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
import { fr, pt } from 'date-fns/locale';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../../store/useStore';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../constants/theme';
import { EvenementGarde, ParentRole } from '../../types';
import { TRADUCTIONS } from '../../constants/i18n';

const LOCALES = { fr, pt };
const { width } = Dimensions.get('window');
const CELL = Math.floor((width - SPACING.lg * 2 - 2) / 7);

const OR = COLORS.or ?? '#C9A84C';

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

// Un jour de passage est un jour où le parent de garde change par rapport à
// la veille. On compare sur l'ensemble des événements (pas seulement ceux du
// mois affiché) pour ne pas manquer une transition en début de mois.
function estJourDePassage(date: Date, tousLesEvenements: EvenementGarde[]): boolean {
  const veille = subDays(date, 1);
  const parentJour = parentDuJour(date, tousLesEvenements);
  const parentVeille = parentDuJour(veille, tousLesEvenements);
  return parentJour !== null && parentVeille !== null && parentJour !== parentVeille;
}

export default function CalendrierScreen() {
  const { evenements, parents, evenementsCalendrier, langue } = useStore();
  const t = TRADUCTIONS[langue].calendrier;
  const dateLocale = LOCALES[langue];
  const JOURS = t.jours;
  const [mois, setMois] = useState(new Date());
  const [jourSelectionne, setJourSelectionne] = useState<Date | null>(null);

  const jours = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(mois), end: endOfMonth(mois) }),
    [mois]
  );

  const decalage = useMemo(() => jourFR(startOfMonth(mois)), [mois]);

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
    const evs = evenementsCalendrier
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
    return [...gardes, ...evs].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [evenements, evenementsCalendrier, debutSemaine, finSemaine]);

  const elementsJour = useMemo(() => {
    if (!jourSelectionne) return { garde: undefined as EvenementGarde | undefined, evenements: [] as typeof evenementsCalendrier };
    const gardeDuJour = evsMois.find((ev) => {
      const debut = parseISO(ev.dateDebut);
      const fin = parseISO(ev.dateFin);
      return jourSelectionne >= debut && jourSelectionne <= fin;
    });
    const evsJour = evenementsCalendrier.filter((ev) =>
      isSameDay(parseISO(ev.date), jourSelectionne)
    );
    return { garde: gardeDuJour, evenements: evsJour };
  }, [jourSelectionne, evsMois, evenementsCalendrier]);

  const jourSelectionneEstPassage = useMemo(
    () => (jourSelectionne ? estJourDePassage(jourSelectionne, evenements) : false),
    [jourSelectionne, evenements]
  );

  const handleSaisirGarde = () => {
    Alert.alert(
      t.ajouter.replace('+ ', ''),
      t.modalTitre,
      [{ text: 'Compris', style: 'default' }]
    );
  };

  return (
    <SafeAreaView style={styles.conteneur} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        <View style={styles.legende}>
          {(['A', 'B'] as ParentRole[]).map((role) => (
            <View key={role} style={styles.legendeItem}>
              <View
                style={[styles.legendePuce, { backgroundColor: parents[role].couleur }]}
              />
              <Text style={styles.legendeTxt}>{parents[role].nom}</Text>
            </View>
          ))}
        </View>

        <View style={styles.navMois}>
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

        <View style={styles.recapMois}>
          <Text style={[styles.recapNom, { color: parents.A.couleur }]}>
            {parents.A.nom.split(' ')[0]}
          </Text>
          <Text style={[styles.recapNb, { color: COLORS.texte }]}>{recapMois.A ?? 0}j</Text>
          <View style={styles.recapPuceOr} />
          <Text style={[styles.recapNom, { color: parents.B.couleur }]}>
            {parents.B.nom.split(' ')[0]}
          </Text>
          <Text style={[styles.recapNb, { color: COLORS.texte }]}>{recapMois.B ?? 0}j</Text>
        </View>

        <View style={styles.grilleWrap}>
          <View style={styles.grilleLigne}>
            {JOURS.map((j, i) => (
              <View key={i} style={[styles.cellule, styles.celluleHeader]}>
                <Text style={styles.headerJour}>{j}</Text>
              </View>
            ))}
          </View>

          <View style={styles.grille}>
            {Array.from({ length: decalage }).map((_, i) => (
              <View key={`v-${i}`} style={styles.cellule} />
            ))}

            {jours.map((jour) => {
              const parentId = parentDuJour(jour, evsMois);
              const couleur = parentId ? parents[parentId].couleur : null;
              const prenomParent = parentId ? parents[parentId].nom.split(' ')[0] : null;
              const estAujourdhui = isToday(jour);
              const estPassage = estJourDePassage(jour, evenements);
              const evsJourCellule = evenementsCalendrier.filter((ev) =>
                isSameDay(parseISO(ev.date), jour)
              );

              return (
                <TouchableOpacity
                  key={jour.toISOString()}
                  style={styles.cellule}
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
        </View>

        {jourSelectionne && (
          <View style={styles.panneauJour}>
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
                    { backgroundColor: parents[elementsJour.garde.parentId].couleur },
                  ]}
                />
                <Text style={styles.modalTexte}>
                  {t.garde} — {parents[elementsJour.garde.parentId].nom}
                </Text>
              </View>
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

        <View style={styles.section}>
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

      <TouchableOpacity
        style={styles.fab}
        onPress={handleSaisirGarde}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={22} color={COLORS.blanc} />
        <Text style={styles.fabTxt}>{t.ajouter.replace('+ ', '')}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: COLORS.ivoire },

  legende: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.xxl,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  legendeItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  legendePuce: { width: 10, height: 10, borderRadius: RADIUS.sm },
  legendeTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.texte, fontWeight: TYPOGRAPHY.medium },

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

  grilleWrap: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },
  grilleLigne: { flexDirection: 'row', marginBottom: SPACING.xs },
  grille: {
    flexDirection: 'row', flexWrap: 'wrap', borderRadius: RADIUS.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.bordure, backgroundColor: COLORS.blanc,
  },
  cellule: { width: CELL, height: 64, alignItems: 'stretch', justifyContent: 'flex-start', paddingTop: 4, paddingHorizontal: 2, position: 'relative' },
  celluleHeader: { height: 28, alignItems: 'center', justifyContent: 'center' },
  headerJour: {
    fontSize: TYPOGRAPHY.xs, fontWeight: TYPOGRAPHY.semibold, color: COLORS.ardoise,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
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
  etiquettesWrap: { gap: 2 },
  etiquetteGarde: {
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
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

  fab: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.vert,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  fabTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: TYPOGRAPHY.semibold, color: COLORS.blanc },

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
});
