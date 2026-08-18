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
} from 'date-fns';
import { fr } from 'date-fns/locale';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../../store/useStore';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../constants/theme';
import { EvenementGarde, ParentRole } from '../../types';

const JOURS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const { width } = Dimensions.get('window');
const CELL = Math.floor((width - SPACING.lg * 2) / 7);

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
  const { evenements, parents } = useStore();
  const [mois, setMois] = useState(new Date());

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

  const prochainsEvs = useMemo(
    () =>
      [...evenements]
        .filter((ev) => parseISO(ev.dateFin) >= new Date())
        .sort((a, b) => parseISO(a.dateDebut).getTime() - parseISO(b.dateDebut).getTime())
        .slice(0, 5),
    [evenements]
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
            <Ionicons name="chevron-back" size={20} color={COLORS.blanc} />
          </TouchableOpacity>
          <Text style={styles.titreMois}>
            {format(mois, 'MMMM yyyy', { locale: fr })}
          </Text>
          <TouchableOpacity
            onPress={() => setMois((m) => addMonths(m, 1))}
            style={styles.navBtn}
            accessibilityLabel="Mois suivant"
          >
            <Ionicons name="chevron-forward" size={20} color={COLORS.blanc} />
          </TouchableOpacity>
        </View>

        {/* Récapitulatif du mois */}
        <View style={styles.recapMois}>
          <Text style={styles.recapTxt}>
            <Text style={[styles.recapNom, { color: parents.A.couleur }]}>
              {parents.A.nom.split(' ')[0]}
            </Text>
            <Text style={styles.recapSep}> : </Text>
            <Text style={[styles.recapNb, { color: parents.A.couleur }]}>{recapMois.A ?? 0}j</Text>
            <Text style={styles.recapSep}>   /   </Text>
            <Text style={[styles.recapNom, { color: parents.B.couleur }]}>
              {parents.B.nom.split(' ')[0]}
            </Text>
            <Text style={styles.recapSep}> : </Text>
            <Text style={[styles.recapNb, { color: parents.B.couleur }]}>{recapMois.B ?? 0}j</Text>
            <Text style={styles.recapSep}> ce mois</Text>
          </Text>
        </View>

        {/* Grille */}
        <View style={styles.grilleWrap}>
          {/* En-têtes jours */}
          <View style={styles.grilleLigne}>
            {JOURS.map((j, i) => (
              <View key={i} style={[styles.cellule, styles.celluleHeader]}>
                <Text style={styles.headerJour}>{j}</Text>
              </View>
            ))}
          </View>

          {/* Cellules */}
          <View style={styles.grille}>
            {Array.from({ length: decalage }).map((_, i) => (
              <View key={`v-${i}`} style={styles.cellule} />
            ))}

            {jours.map((jour) => {
              const parentId = parentDuJour(jour, evsMois);
              const couleur = parentId ? parents[parentId].couleur : null;
              const estAujourdhui = isToday(jour);

              return (
                <View
                  key={jour.toISOString()}
                  style={[
                    styles.cellule,
                    couleur ? { backgroundColor: couleur } : null,
                  ]}
                >
                  <View
                    style={[
                      styles.numeroCercle,
                      estAujourdhui && !couleur && styles.numeroCercleAujourdhui,
                      estAujourdhui && couleur && styles.numeroCercleAujourdhuiGarde,
                    ]}
                  >
                    <Text
                      style={[
                        styles.numeroJour,
                        estAujourdhui && styles.numeroJourAujourdhui,
                        couleur && !estAujourdhui && styles.numeroJourGarde,
                      ]}
                    >
                      {format(jour, 'd')}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Prochaines périodes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitre}>Prochaines périodes</Text>
          {prochainsEvs.map((ev) => {
            const parent = parents[ev.parentId];
            return (
              <View key={ev.id} style={styles.carteEv}>
                <View style={[styles.barreEv, { backgroundColor: parent.couleur }]} />
                <View style={styles.contenuEv}>
                  <Text style={styles.evParent}>{parent.nom}</Text>
                  <Text style={styles.evDate}>
                    {format(parseISO(ev.dateDebut), 'd MMM', { locale: fr })}
                    {'  →  '}
                    {format(parseISO(ev.dateFin), 'd MMM yyyy', { locale: fr })}
                  </Text>
                  <Text style={styles.evType}>
                    {ev.type.replace(/_/g, ' ')}
                  </Text>
                </View>
                <View style={[styles.evDot, { backgroundColor: parent.couleur + '20' }]}>
                  <Ionicons name="home-outline" size={14} color={parent.couleur} />
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
    width: 12,
    height: 12,
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
    backgroundColor: COLORS.vertProfond,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  navBtn: {
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  titreMois: {
    fontSize: TYPOGRAPHY.lg,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.blanc,
    textTransform: 'capitalize',
    letterSpacing: 0.3,
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
  },
  cellule: {
    width: CELL,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: COLORS.vert,
  },
  numeroCercleAujourdhuiGarde: {
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  numeroJour: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.texte,
  },
  numeroJourAujourdhui: {
    color: COLORS.blanc,
    fontWeight: TYPOGRAPHY.bold,
  },
  numeroJourGarde: {
    color: COLORS.blanc,
    fontWeight: TYPOGRAPHY.bold,
  },

  recapMois: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    alignItems: 'center',
  },
  recapTxt: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.texte,
  },
  recapNom: {
    fontWeight: TYPOGRAPHY.semibold,
  },
  recapNb: {
    fontWeight: TYPOGRAPHY.bold,
  },
  recapSep: {
    color: COLORS.ardoise,
  },

  section: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  sectionTitre: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.ardoise,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: SPACING.md,
  },
  carteEv: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  barreEv: { width: 4, alignSelf: 'stretch' },
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
    color: COLORS.vert,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  evDot: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
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
    backgroundColor: COLORS.vert,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    shadowColor: COLORS.vert,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  btnGardeTxt: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.blanc,
    letterSpacing: 0.3,
  },
});
