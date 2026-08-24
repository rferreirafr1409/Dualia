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
} from 'date-fns';
import { fr } from 'date-fns/locale';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../../store/useStore';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../constants/theme';
import { EvenementGarde, ParentRole } from '../../types';

const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const { width } = Dimensions.get('window');
const CELL = Math.floor((width - SPACING.lg * 2) / 7);

// Accent premium — or ponctuel, jamais dominant
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

export default function CalendrierScreen() {
  const { evenements, parents, evenementsCalendrier } = useStore();
  const [mois, setMois] = useState(new Date());

  const jours = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(mois), end: endOfMonth(mois) }),
    [mois]
  );

  const decalage = useMemo(() => jourFR(startOfMonth(mois)), [mois]);

  const prochainsElements = useMemo(() => {
    const gardes = evenements
      .filter((ev) => parseISO(ev.dateFin) >= new Date())
      .map((ev) => ({
        id: ev.id,
        kind: 'garde' as const,
        date: parseISO(ev.dateDebut),
        dateFin: parseISO(ev.dateFin),
        parentId: ev.parentId,
        type: ev.type,
      }));
    const evs = evenementsCalendrier
      .filter((ev) => parseISO(ev.date) >= new Date())
      .map((ev) => ({
        id: ev.id,
        kind: 'evenement' as const,
        date: parseISO(ev.date),
        titre: ev.titre,
        enfant: ev.enfant,
        parentId: ev.parentId,
      }));
    return [...gardes, ...evs].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [evenements, evenementsCalendrier]);

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

  const handleSaisirGarde = () => {
    Alert.alert(
      'Saisir ma garde',
      'Déclarez une nouvelle période de résidence pour votre enfant.',
      [{ text: 'Compris', style: 'default' }]
    );
  };

  return (
    <SafeAreaView style={styles.conteneur} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Légende parents */}
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

        {/* Navigation mois */}
        <View style={styles.navMois}>
          <TouchableOpacity
            onPress={() => setMois((m) => subMonths(m, 1))}
            style={styles.navBtn}
            accessibilityLabel="Mois précédent"
          >
            <Ionicons name="chevron-back" size={18} color={COLORS.ardoise} />
          </TouchableOpacity>
          <View style={styles.titreMoisWrap}>
            <Text style={styles.titreMois}>
              {format(mois, 'MMMM yyyy', { locale: fr })}
            </Text>
            <View style={styles.titreMoisTrait} />
          </View>
          <TouchableOpacity
            onPress={() => setMois((m) => addMonths(m, 1))}
            style={styles.navBtn}
            accessibilityLabel="Mois suivant"
          >
            <Ionicons name="chevron-forward" size={18} color={COLORS.ardoise} />
          </TouchableOpacity>
        </View>

        {/* Récapitulatif du mois */}
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

        {/* Grille */}
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
              const estAujourdhui = isToday(jour);

              return (
                <View key={jour.toISOString()} style={styles.cellule}>
                  <View
                    style={[
                      styles.numeroCercle,
                      estAujourdhui && styles.numeroCercleAujourdhui,
                    ]}
                  >
                    <Text
                      style={[
                        styles.numeroJour,
                        estAujourdhui && styles.numeroJourAujourdhui,
                      ]}
                    >
                      {format(jour, 'd')}
                    </Text>
                  </View>
                  {couleur ? (
                    <View style={[styles.pointParent, { backgroundColor: couleur }]} />
                  ) : (
                    <View style={styles.pointParentVide} />
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Prochaines périodes */}
        <View style={styles.section}>
          <View style={styles.sectionTitreLigne}>
            <Text style={styles.sectionTitre}>Prochaines périodes</Text>
            <View style={styles.sectionTitreTrait} />
          </View>
          {prochainsElements.map((ev) => {
            const parent = parents[ev.parentId];
            return (
              <View key={ev.id} style={styles.carteEv}>
                <View style={[styles.barreEv, { backgroundColor: parent.couleur }]} />
                <View style={styles.contenuEv}>
                  <Text style={styles.evParent}>{parent.nom}</Text>
                  <Text style={styles.evDate}>
                    {format(ev.date, 'd MMM', { locale: fr })}
                    {ev.kind === 'garde' ? '  →  ' + format(ev.dateFin, 'd MMM yyyy', { locale: fr }) : ''}
                  </Text>
                  <Text style={styles.evType}>
                    {ev.kind === 'garde' ? ev.type.replace(/_/g, ' ') : ev.titre}
                  </Text>
                </View>
                <View style={styles.evDot}>
                  <Ionicons name="home-outline" size={14} color={OR} />
                </View>
              </View>
            );
          })}
        </View>

        <View style={{ height: SPACING.xxxl + 40 }} />
      </ScrollView>

      {/* Bouton saisir garde */}
      <View style={styles.fabZone}>
        <TouchableOpacity
          style={styles.btnGarde}
          onPress={handleSaisirGarde}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={20} color={COLORS.blanc} />
          <Text style={styles.btnGardeTxt}>Saisir ma garde</Text>
        </TouchableOpacity>
      </View>
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
  legendePuce: {
    width: 10,
    height: 10,
    borderRadius: RADIUS.sm,
  },
  legendeTxt: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.texte,
    fontWeight: TYPOGRAPHY.medium,
  },

  navMois: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.bordure,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  navBtn: {
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  titreMoisWrap: { alignItems: 'center' },
  titreMois: {
    fontSize: TYPOGRAPHY.lg,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.vertProfond,
    textTransform: 'capitalize',
    letterSpacing: 0.4,
  },
  titreMoisTrait: {
    width: 28,
    height: 2,
    backgroundColor: OR,
    borderRadius: 1,
    marginTop: 4,
  },

  grilleWrap: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  grilleLigne: {
    flexDirection: 'row',
    marginBottom: SPACING.xs,
  },
  grille: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.bordure,
    backgroundColor: COLORS.blanc,
  },
  cellule: {
    width: CELL,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  celluleHeader: {
    height: 28,
  },
  headerJour: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.ardoise,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  numeroCercle: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeroCercleAujourdhui: {
    borderWidth: 1.5,
    borderColor: OR,
  },
  numeroJour: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.medium,
    color: COLORS.texte,
  },
  numeroJourAujourdhui: {
    color: COLORS.vertProfond,
    fontWeight: TYPOGRAPHY.bold,
  },
  pointParent: {
    width: 5,
    height: 5,
    borderRadius: RADIUS.full,
  },
  pointParentVide: {
    width: 5,
    height: 5,
  },

  recapMois: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  recapNom: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.semibold,
  },
  recapNb: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.medium,
  },
  recapPuceOr: {
    width: 4,
    height: 4,
    borderRadius: RADIUS.full,
    backgroundColor: OR,
    marginHorizontal: SPACING.sm,
  },

  section: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  sectionTitreLigne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sectionTitre: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.ardoise,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  sectionTitreTrait: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.bordure,
  },
  carteEv: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.bordure,
    overflow: 'hidden',
  },
  barreEv: { width: 3, alignSelf: 'stretch' },
  contenuEv: { flex: 1, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  evParent: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.texte,
  },
  evDate: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.ardoise,
    marginTop: 2,
  },
  evType: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.vertProfond,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  evDot: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    backgroundColor: 'rgba(201,168,76,0.12)',
  },

  fabZone: {
    position: 'absolute',
    bottom: SPACING.xl,
    left: SPACING.lg,
    right: SPACING.lg,
  },
  btnGarde: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.vertProfond,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  btnGardeTxt: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.blanc,
    letterSpacing: 0.3,
  },
});
