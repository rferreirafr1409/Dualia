import { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../../store/useStore';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const FAMILY_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="140" viewBox="0 0 200 180" fill="none">
  <circle cx="30" cy="50" r="11" stroke="#F8F6F2" stroke-width="1.5" fill="none"/>
  <line x1="30" y1="61" x2="30" y2="97" stroke="#F8F6F2" stroke-width="1.5"/>
  <line x1="30" y1="73" x2="18" y2="88" stroke="#F8F6F2" stroke-width="1.5"/>
  <line x1="30" y1="73" x2="52" y2="86" stroke="#F8F6F2" stroke-width="1.5"/>
  <line x1="30" y1="97" x2="22" y2="118" stroke="#F8F6F2" stroke-width="1.5"/>
  <line x1="30" y1="97" x2="38" y2="118" stroke="#F8F6F2" stroke-width="1.5"/>
  <circle cx="76" cy="38" r="14" stroke="#F8F6F2" stroke-width="1.5" fill="none"/>
  <line x1="76" y1="52" x2="76" y2="110" stroke="#F8F6F2" stroke-width="1.5"/>
  <line x1="76" y1="70" x2="52" y2="86" stroke="#F8F6F2" stroke-width="1.5"/>
  <line x1="76" y1="70" x2="98" y2="82" stroke="#F8F6F2" stroke-width="1.5"/>
  <line x1="76" y1="110" x2="66" y2="135" stroke="#F8F6F2" stroke-width="1.5"/>
  <line x1="76" y1="110" x2="86" y2="135" stroke="#F8F6F2" stroke-width="1.5"/>
  <line x1="98" y1="82" x2="108" y2="82" stroke="#C9A84C" stroke-width="1.8" stroke-dasharray="4,3"/>
  <circle cx="126" cy="38" r="14" stroke="#F8F6F2" stroke-width="1.5" fill="none"/>
  <line x1="126" y1="52" x2="126" y2="110" stroke="#F8F6F2" stroke-width="1.5"/>
  <line x1="126" y1="70" x2="108" y2="82" stroke="#F8F6F2" stroke-width="1.5"/>
  <line x1="126" y1="70" x2="150" y2="86" stroke="#F8F6F2" stroke-width="1.5"/>
  <line x1="126" y1="110" x2="116" y2="135" stroke="#F8F6F2" stroke-width="1.5"/>
  <line x1="126" y1="110" x2="136" y2="135" stroke="#F8F6F2" stroke-width="1.5"/>
  <circle cx="172" cy="50" r="11" stroke="#F8F6F2" stroke-width="1.5" fill="none"/>
  <line x1="172" y1="61" x2="172" y2="97" stroke="#F8F6F2" stroke-width="1.5"/>
  <line x1="172" y1="73" x2="150" y2="86" stroke="#F8F6F2" stroke-width="1.5"/>
  <line x1="172" y1="73" x2="184" y2="88" stroke="#F8F6F2" stroke-width="1.5"/>
  <line x1="172" y1="97" x2="164" y2="118" stroke="#F8F6F2" stroke-width="1.5"/>
  <line x1="172" y1="97" x2="180" y2="118" stroke="#F8F6F2" stroke-width="1.5"/>
  <circle cx="101" cy="20" r="2" fill="#C9A84C" opacity="0.7"/>
  <circle cx="115" cy="13" r="1.5" fill="#C9A84C" opacity="0.5"/>
  <circle cx="87" cy="15" r="1.5" fill="#C9A84C" opacity="0.5"/>
  <path d="M101 64 C101 64 97 61 97 57.5 C97 55.2 99 53.8 101 55.4 C103 53.8 105 55.2 105 57.5 C105 61 101 64 101 64Z" stroke="#C9A84C" stroke-width="1" fill="none"/>
</svg>`;

function FamilyIllustration() {
  if (Platform.OS !== 'web') return null;
  return (
    <Image
      source={{ uri: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(FAMILY_SVG)}` }}
      style={styles.familyIllustration}
      resizeMode="contain"
    />
  );
}

function HeroTexture() {
  const dots = [];
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 10; c++) {
      dots.push(
        <View
          key={`${r}-${c}`}
          style={{
            position: 'absolute',
            top: r * 22 + 4,
            left: c * 38 + 8,
            width: 2,
            height: 2,
            borderRadius: 1,
            backgroundColor: 'rgba(255,255,255,0.07)',
          }}
        />
      );
    }
  }
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {dots}
    </View>
  );
}

const MODULES_GRID: {
  id: string;
  titre: string;
  sous: string;
  emoji: string;
  couleur: string;
  fond: string;
  route: string;
}[] = [
  {
    id: 'calendrier',
    titre: 'Calendrier',
    sous: 'Planning',
    emoji: '📅',
    couleur: COLORS.vert,
    fond: '#E8F3ED',
    route: '/(tabs)/calendrier',
  },
  {
    id: 'decisions',
    titre: 'Décisions',
    sous: 'Co-parentalité',
    emoji: '✅',
    couleur: COLORS.or,
    fond: '#FBF3DF',
    route: '/(tabs)/decisions',
  },
  {
    id: 'messagerie',
    titre: 'Messagerie',
    sous: 'Échanges',
    emoji: '💬',
    couleur: COLORS.terracotta,
    fond: '#F7EEE9',
    route: '/(tabs)/messagerie',
  },
  {
    id: 'journal',
    titre: 'Journal',
    sous: 'Souvenirs',
    emoji: '📔',
    couleur: COLORS.vert,
    fond: '#E8F3ED',
    route: '/(tabs)/journal',
  },
  {
    id: 'finances',
    titre: 'Finances',
    sous: 'Dépenses',
    emoji: '💰',
    couleur: COLORS.or,
    fond: '#FBF3DF',
    route: '/(tabs)/finances',
  },
  {
    id: 'documents',
    titre: 'Documents',
    sous: 'Coffre-fort',
    emoji: '📁',
    couleur: COLORS.ardoise,
    fond: '#EEF1F0',
    route: '/(tabs)/documents',
  },
  {
    id: 'caf',
    titre: 'CAF / Fiscal',
    sous: 'Déclarations',
    emoji: '🏛️',
    couleur: COLORS.terracotta,
    fond: '#F7EEE9',
    route: '/(tabs)/caf',
  },
];

const EVENEMENTS_JOUR = [
  { emoji: '🏊', titre: 'Natation — Léo', heure: '16h00', fond: '#E8F3ED' },
  { emoji: '📚', titre: 'Devoirs — Emma', heure: '17h30', fond: '#FBF3DF' },
  { emoji: '🍽️', titre: 'Repas en famille', heure: '19h30', fond: '#F7EEE9' },
];

export default function AccueilScreen() {
  const { parents, parentActif, evenements, decisions, messages } = useStore();
  const router = useRouter();
  const parent = parents[parentActif];
  const { width } = useWindowDimensions();

  const today = new Date();
  const colWidth = Math.floor((width - SPACING.lg * 2 - SPACING.md * 2) / 3);

  const initiales = parent.nom
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const decisionsEnAttente = decisions.filter(
    (d) => d.statut === 'proposée' || d.statut === 'en_attente'
  ).length;

  const messagesNonLus = messages.filter(
    (m) => m.expediteurId !== parentActif && m.statut !== 'lu'
  ).length;

  const badges: Record<string, number> = {
    decisions: decisionsEnAttente,
    messagerie: messagesNonLus,
  };

  const prochainEvenement = useMemo(() => {
    const now = new Date();
    const futur = evenements
      .filter((ev) => parseISO(ev.dateDebut) > now)
      .sort((a, b) => parseISO(a.dateDebut).getTime() - parseISO(b.dateDebut).getTime());
    if (futur.length === 0) return null;
    const next = futur[0];
    const diffMs = parseISO(next.dateDebut).getTime() - now.getTime();
    const jours = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return { jours, date: format(parseISO(next.dateDebut), 'd MMM', { locale: fr }) };
  }, [evenements]);

  return (
    <SafeAreaView style={styles.conteneur} edges={['top', 'bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} bounces>

        {/* Hero */}
        <LinearGradient
          colors={['#2D6A4F', '#3D8B6A']}
          style={styles.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <HeroTexture />
          <FamilyIllustration />
          <View style={styles.heroRow}>
            <View style={styles.heroLeft}>
              <Text style={styles.logo}>dualia</Text>
              <Text style={styles.tagline}>L'app de toutes les familles.</Text>
              <Text style={styles.subTagline}>
                Ensemble ou séparés, organisez la vie de vos enfants.
              </Text>
            </View>
            <View style={styles.parentPill}>
              <View style={[styles.parentInitiale, { backgroundColor: parent.couleur }]}>
                <Text style={styles.initialesTxt}>{initiales}</Text>
              </View>
              <Text style={styles.parentNom}>{parent.nom.split(' ')[0]}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Carte famille */}
        <View style={styles.carteWrap}>
          <View style={styles.carteEnfant}>
            <View style={styles.carteEnfantTop}>
              <Ionicons name="heart" size={14} color={COLORS.or} />
              <Text style={styles.carteEnfantLabel}>VOS ENFANTS</Text>
            </View>
            <Text style={styles.carteEnfantNoms}>Emma & Léo</Text>
            <View style={styles.statutRow}>
              <View style={styles.statutDot} />
              <Text style={styles.statutTxt}>En famille — Paris</Text>
            </View>
            {prochainEvenement && (
              <View style={styles.prochainRow}>
                <Ionicons name="calendar-outline" size={11} color={COLORS.orClair} />
                <Text style={styles.prochainTxt}>
                  Prochain événement :{' '}
                  <Text style={styles.prochainValeur}>
                    dans {prochainEvenement.jours}j — {prochainEvenement.date}
                  </Text>
                </Text>
              </View>
            )}
            <Text style={styles.dateJour}>
              {format(today, 'EEEE d MMMM yyyy', { locale: fr })}
            </Text>
          </View>
        </View>

        {/* Aujourd'hui */}
        <View style={styles.section}>
          <Text style={styles.sectionTitre}>AUJOURD'HUI</Text>
          <View style={styles.evenementsCol}>
            {EVENEMENTS_JOUR.map((ev, i) => (
              <View key={i} style={[styles.evCard, { backgroundColor: ev.fond }]}>
                <Text style={styles.evEmoji}>{ev.emoji}</Text>
                <Text style={styles.evTitre}>{ev.titre}</Text>
                <Text style={styles.evHeure}>{ev.heure}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Grille de modules — 3 colonnes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitre}>VOS MODULES</Text>
          <View style={styles.grid}>
            {MODULES_GRID.map((mod) => {
              const badge = badges[mod.id] ?? 0;
              return (
                <TouchableOpacity
                  key={mod.id}
                  style={[styles.moduleCard, { width: colWidth }]}
                  onPress={() => router.navigate(mod.route as any)}
                  activeOpacity={0.72}
                >
                  <View style={[styles.moduleIconWrap, { backgroundColor: mod.fond }]}>
                    <Text style={styles.moduleEmoji}>{mod.emoji}</Text>
                    {badge > 0 && (
                      <View style={styles.moduleBadge}>
                        <Text style={styles.moduleBadgeTxt}>{badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.moduleTitre} numberOfLines={1}>
                    {mod.titre}
                  </Text>
                  <Text style={styles.moduleSous} numberOfLines={1}>
                    {mod.sous}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerTxt}>
            🔒 Communications certifiées eIDAS · Données hébergées en France
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: COLORS.ivoire },

  hero: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxxl + 8,
    overflow: 'hidden',
  },
  familyIllustration: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 160,
    height: 140,
    opacity: 0.85,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroLeft: { flex: 1, paddingRight: SPACING.md },
  logo: {
    fontSize: 48,
    fontWeight: '200',
    color: COLORS.blanc,
    letterSpacing: 6,
    fontStyle: 'italic',
  },
  tagline: {
    fontSize: TYPOGRAPHY.md,
    color: COLORS.blanc,
    fontWeight: TYPOGRAPHY.semibold,
    marginTop: SPACING.sm,
    letterSpacing: 0.2,
  },
  subTagline: {
    fontSize: TYPOGRAPHY.sm,
    color: 'rgba(255,255,255,0.72)',
    marginTop: SPACING.xs,
    lineHeight: 19,
  },
  parentPill: {
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.xl,
    marginTop: SPACING.xs,
  },
  parentInitiale: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialesTxt: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.blanc,
  },
  parentNom: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.blanc,
    fontWeight: TYPOGRAPHY.medium,
  },

  carteWrap: {
    paddingHorizontal: SPACING.lg,
    marginTop: -24,
  },
  carteEnfant: {
    backgroundColor: COLORS.vertProfond,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    shadowColor: COLORS.vertProfond,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 20,
    elevation: 10,
  },
  carteEnfantTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  carteEnfantLabel: {
    fontSize: 10,
    color: COLORS.orClair,
    fontWeight: TYPOGRAPHY.semibold,
    letterSpacing: 1.5,
  },
  carteEnfantNoms: {
    fontSize: TYPOGRAPHY.xxl,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.blanc,
    marginBottom: SPACING.sm,
  },
  statutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statutDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.vertClair,
  },
  statutTxt: {
    fontSize: TYPOGRAPHY.sm,
    color: 'rgba(255,255,255,0.75)',
  },
  prochainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    alignSelf: 'flex-start',
  },
  prochainTxt: {
    fontSize: TYPOGRAPHY.xs,
    color: 'rgba(255,255,255,0.65)',
  },
  prochainValeur: {
    color: COLORS.orClair,
    fontWeight: TYPOGRAPHY.semibold,
  },
  dateJour: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.ardoise,
    marginTop: SPACING.md,
    textTransform: 'capitalize',
    letterSpacing: 0.2,
  },

  section: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.sm,
  },
  sectionTitre: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.ardoise,
    letterSpacing: 1.5,
    marginBottom: SPACING.md,
  },

  evenementsCol: { gap: SPACING.sm },
  evCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  evEmoji: { fontSize: 22 },
  evTitre: {
    flex: 1,
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.medium,
    color: COLORS.texte,
  },
  evHeure: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.ardoise,
    fontWeight: TYPOGRAPHY.semibold,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  moduleCard: {
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 10,
    elevation: 4,
  },
  moduleIconWrap: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  moduleEmoji: { fontSize: 26 },
  moduleBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.erreur,
    width: 16,
    height: 16,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleBadgeTxt: {
    fontSize: 9,
    color: COLORS.blanc,
    fontWeight: TYPOGRAPHY.bold,
  },
  moduleTitre: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.texte,
    textAlign: 'center',
  },
  moduleSous: {
    fontSize: 10,
    color: COLORS.ardoise,
    textAlign: 'center',
    marginTop: 2,
  },

  footer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  footerTxt: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.ardoise,
    textAlign: 'center',
    lineHeight: 18,
  },
});
