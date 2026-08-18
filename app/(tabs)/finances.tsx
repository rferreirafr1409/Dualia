import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../../store/useStore';
import { Depense, CategorieDepense } from '../../types';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../constants/theme';

const CATEGORIES: { id: CategorieDepense; emoji: string; label: string }[] = [
  { id: 'sante', emoji: '🏥', label: 'Santé' },
  { id: 'ecole', emoji: '📚', label: 'École' },
  { id: 'activites', emoji: '⚽', label: 'Activités' },
  { id: 'quotidien', emoji: '🛒', label: 'Quotidien' },
  { id: 'vacances', emoji: '✈️', label: 'Vacances' },
];

const ACCENT = '#C9A84C';

function getCatInfo(cat: CategorieDepense) {
  return CATEGORIES.find((c) => c.id === cat) ?? CATEGORIES[3];
}

export default function FinancesScreen() {
  const { depenses, parents, parentActif, ajouterDepense } = useStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [categorie, setCategorie] = useState<CategorieDepense>('quotidien');
  const [montantTxt, setMontantTxt] = useState('');
  const [description, setDescription] = useState('');

  const now = new Date();
  const debutMois = startOfMonth(now);
  const finMois = endOfMonth(now);

  const depensesMois = useMemo(
    () =>
      depenses.filter((d) => {
        const date = parseISO(d.date);
        return date >= debutMois && date <= finMois;
      }),
    [depenses]
  );

  const totalMois = depensesMois.reduce((s, d) => s + d.montant, 0);

  const totalA = depenses
    .filter((d) => d.auteurId === 'A')
    .reduce((s, d) => s + d.montant, 0);
  const totalB = depenses
    .filter((d) => d.auteurId === 'B')
    .reduce((s, d) => s + d.montant, 0);
  const totalAll = totalA + totalB || 1;
  const pctA = Math.round((totalA / totalAll) * 100);
  const pctB = 100 - pctA;

  const soumettre = () => {
    const montant = parseFloat(montantTxt.replace(',', '.'));
    if (!montant || montant <= 0 || !description.trim()) return;
    const dep: Depense = {
      id: `dep-${Date.now()}`,
      categorie,
      montant,
      description: description.trim(),
      auteurId: parentActif,
      date: new Date().toISOString(),
      rembourse: false,
    };
    ajouterDepense(dep);
    setMontantTxt('');
    setDescription('');
    setCategorie('quotidien');
    setModalVisible(false);
  };

  const peutSoumettre =
    !!montantTxt && parseFloat(montantTxt.replace(',', '.')) > 0 && !!description.trim();

  return (
    <SafeAreaView style={styles.conteneur} edges={['top', 'bottom']}>
      {/* Header */}
      <LinearGradient colors={['#B8953A', ACCENT]} style={styles.header}>
        <View>
          <Text style={styles.headerTitre}>Finances</Text>
          <Text style={styles.headerSous}>Dépenses partagées</Text>
        </View>
        <Text style={styles.moisTxt}>
          {format(now, 'MMMM yyyy', { locale: fr })}
        </Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Solde du mois */}
        <View style={styles.soldeCard}>
          <Text style={styles.sectionLabel}>TOTAL CE MOIS</Text>
          <Text style={styles.soldeTotal}>
            {totalMois.toFixed(2).replace('.', ',')} €
          </Text>
          <Text style={styles.soldeSous}>{depensesMois.length} dépense{depensesMois.length > 1 ? 's' : ''}</Text>
        </View>

        {/* Répartition */}
        <View style={styles.repartitionCard}>
          <Text style={styles.sectionLabel}>RÉPARTITION</Text>
          <View style={styles.repartitionNoms}>
            <Text style={styles.repartNom}>
              {parents.A.nom.split(' ')[0]}{' '}
              <Text style={{ color: COLORS.vert }}>{pctA}%</Text>
            </Text>
            <Text style={styles.repartNom}>
              {parents.B.nom.split(' ')[0]}{' '}
              <Text style={{ color: COLORS.terracotta }}>{pctB}%</Text>
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressA, { flex: pctA }]}
            />
            <View
              style={[styles.progressB, { flex: pctB }]}
            />
          </View>
          <View style={styles.repartMontants}>
            <Text style={styles.repartMontant}>
              {totalA.toFixed(2).replace('.', ',')} €
            </Text>
            <Text style={styles.repartMontant}>
              {totalB.toFixed(2).replace('.', ',')} €
            </Text>
          </View>
        </View>

        {/* Liste des dépenses */}
        <Text style={[styles.sectionLabel, { marginBottom: SPACING.md }]}>
          TOUTES LES DÉPENSES
        </Text>
        {depenses.map((dep) => {
          const cat = getCatInfo(dep.categorie);
          const auteur = parents[dep.auteurId];
          return (
            <View key={dep.id} style={styles.depCard}>
              <View style={styles.depIconWrap}>
                <Text style={styles.depEmoji}>{cat.emoji}</Text>
              </View>
              <View style={styles.depInfo}>
                <Text style={styles.depDesc}>{dep.description}</Text>
                <View style={styles.depMeta}>
                  <View style={[styles.auteurDot, { backgroundColor: auteur.couleur }]} />
                  <Text style={styles.depMetaTxt}>{auteur.nom.split(' ')[0]}</Text>
                  <Text style={styles.depMetaTxt}>·</Text>
                  <Text style={styles.depMetaTxt}>
                    {format(parseISO(dep.date), 'd MMM', { locale: fr })}
                  </Text>
                </View>
              </View>
              <View style={styles.depDroit}>
                <Text style={styles.depMontant}>
                  {dep.montant.toFixed(2).replace('.', ',')} €
                </Text>
                <View
                  style={[
                    styles.statutBadge,
                    dep.rembourse ? styles.statutOk : styles.statutAttente,
                  ]}
                >
                  <Text style={styles.statutTxt}>
                    {dep.rembourse ? 'Soldé' : 'En attente'}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#B8953A', ACCENT]}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={22} color={COLORS.blanc} />
          <Text style={styles.fabTxt}>Ajouter une dépense</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modal}>
            <View style={styles.modalPoignee} />
            <Text style={styles.modalTitre}>Nouvelle dépense</Text>

            <Text style={styles.label}>Catégorie</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.catRow}
            >
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catOpt, categorie === cat.id && styles.catActif]}
                  onPress={() => setCategorie(cat.id)}
                >
                  <Text style={styles.catEmoji}>{cat.emoji}</Text>
                  <Text
                    style={[
                      styles.catLabel,
                      categorie === cat.id && styles.catLabelActif,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Montant (€)</Text>
            <TextInput
              style={styles.input}
              value={montantTxt}
              onChangeText={setMontantTxt}
              placeholder="Ex : 45,50"
              placeholderTextColor={COLORS.ardoise}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Ex : Médicaments ordonnance Léo"
              placeholderTextColor={COLORS.ardoise}
            />

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.btnAnnuler}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.btnAnnulerTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnValider, !peutSoumettre && styles.btnDisabled]}
                onPress={soumettre}
                disabled={!peutSoumettre}
              >
                <Text style={styles.btnValiderTxt}>Ajouter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: COLORS.ivoire },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  headerTitre: {
    fontSize: TYPOGRAPHY.xl,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.blanc,
  },
  headerSous: {
    fontSize: TYPOGRAPHY.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: SPACING.xs,
  },
  moisTxt: {
    fontSize: TYPOGRAPHY.sm,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: TYPOGRAPHY.medium,
    textTransform: 'capitalize',
  },

  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.lg },
  sectionLabel: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.ardoise,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  soldeCard: {
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  soldeTotal: {
    fontSize: TYPOGRAPHY.titre,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.texte,
    marginTop: SPACING.sm,
  },
  soldeSous: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.ardoise,
    marginTop: SPACING.xs,
  },

  repartitionCard: {
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  repartitionNoms: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  repartNom: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.medium,
    color: COLORS.texte,
  },
  progressBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    backgroundColor: COLORS.ivoireFonce,
    marginBottom: SPACING.sm,
  },
  progressA: {
    backgroundColor: COLORS.vert,
  },
  progressB: {
    backgroundColor: COLORS.terracotta,
  },
  repartMontants: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  repartMontant: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.ardoise,
  },

  depCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  depIconWrap: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.md,
    backgroundColor: '#FBF3DF',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  depEmoji: { fontSize: 22 },
  depInfo: { flex: 1 },
  depDesc: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.medium,
    color: COLORS.texte,
    marginBottom: SPACING.xs,
  },
  depMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  auteurDot: { width: 6, height: 6, borderRadius: RADIUS.full },
  depMetaTxt: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.ardoise,
  },
  depDroit: { alignItems: 'flex-end', gap: SPACING.xs },
  depMontant: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.texte,
  },
  statutBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  statutOk: { backgroundColor: '#E6F4EA' },
  statutAttente: { backgroundColor: '#FBF3DF' },
  statutTxt: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.texte,
  },

  fab: {
    position: 'absolute',
    bottom: SPACING.xl,
    left: SPACING.xl,
    right: SPACING.xl,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  fabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
  },
  fabTxt: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.blanc,
  },

  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modal: {
    backgroundColor: COLORS.blanc,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  modalPoignee: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.bordure,
    borderRadius: RADIUS.full,
    alignSelf: 'center',
    marginBottom: SPACING.xl,
  },
  modalTitre: {
    fontSize: TYPOGRAPHY.xl,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.texte,
    marginBottom: SPACING.lg,
  },
  label: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.ardoise,
    letterSpacing: 1,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
  catRow: { marginBottom: SPACING.lg },
  catOpt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.ivoireFonce,
    marginRight: SPACING.sm,
  },
  catActif: {
    backgroundColor: '#FBF3DF',
    borderWidth: 2,
    borderColor: ACCENT,
  },
  catEmoji: { fontSize: 18 },
  catLabel: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.ardoise,
    fontWeight: TYPOGRAPHY.medium,
  },
  catLabelActif: { color: COLORS.texte },
  input: {
    backgroundColor: COLORS.ivoireFonce,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.texte,
    marginBottom: SPACING.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.xs,
  },
  btnAnnuler: {
    flex: 1,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.ivoireFonce,
    alignItems: 'center',
  },
  btnAnnulerTxt: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.ardoise,
    fontWeight: TYPOGRAPHY.medium,
  },
  btnValider: {
    flex: 2,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    backgroundColor: ACCENT,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.45 },
  btnValiderTxt: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.blanc,
    fontWeight: TYPOGRAPHY.semibold,
  },
});
