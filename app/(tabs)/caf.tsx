import { useState } from 'react';
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
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const ACCENT = '#B5927C';

const DROITS = [
  {
    titre: 'Allocations familiales',
    montant: '~132 €/mois',
    desc: 'Pour 2 enfants (Emma 8 ans, Léo 5 ans)',
    icone: 'people-outline' as IoniconName,
    fond: '#F7EEE9',
    couleur: ACCENT,
  },
  {
    titre: "Crédit d'impôt frais de garde",
    montant: "Jusqu'à 50%",
    desc: 'Plafond 3 500 € par enfant',
    icone: 'card-outline' as IoniconName,
    fond: '#FBF3DF',
    couleur: COLORS.or,
  },
  {
    titre: "Prime d'activité",
    montant: 'À simuler',
    desc: 'Selon vos revenus et situation familiale',
    icone: 'trending-up-outline' as IoniconName,
    fond: '#E8F3ED',
    couleur: COLORS.vert,
  },
  {
    titre: 'Aide au logement (APL)',
    montant: 'Variable',
    desc: 'En fonction du loyer et des ressources',
    icone: 'home-outline' as IoniconName,
    fond: '#EEF1F0',
    couleur: COLORS.ardoise,
  },
];

const DOCS_GENERES = [
  {
    nom: 'Attestation de garde alternée',
    date: '15 jan. 2026',
    icone: 'document-text-outline' as IoniconName,
    certifie: true,
  },
  {
    nom: 'Déclaration revenus CAF 2025',
    date: '3 fév. 2026',
    icone: 'document-outline' as IoniconName,
    certifie: true,
  },
];

export default function CafScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [revenus, setRevenus] = useState('');
  const [joursPar, setJoursPar] = useState('');
  const [resultat, setResultat] = useState<number | null>(null);

  const simuler = () => {
    const rev = parseFloat(revenus.replace(',', '.'));
    const jours = parseFloat(joursPar.replace(',', '.'));
    if (!rev || !jours) return;
    const fraisEstimes = jours * 6.5 * 12;
    const credit = Math.min(fraisEstimes * 0.5, 3500);
    setResultat(Math.round(credit));
  };

  const fermerModal = () => {
    setModalVisible(false);
    setRevenus('');
    setJoursPar('');
    setResultat(null);
  };

  return (
    <SafeAreaView style={styles.conteneur} edges={['top', 'bottom']}>
      {/* Header */}
      <LinearGradient colors={['#9E7A64', ACCENT]} style={styles.header}>
        <View>
          <Text style={styles.headerTitre}>CAF / Fiscal</Text>
          <Text style={styles.headerSous}>Droits & déclarations</Text>
        </View>
        <View style={styles.headerBadge}>
          <Ionicons name="shield-checkmark" size={20} color={COLORS.blanc} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Cartes dashboard */}
        <View style={styles.dashRow}>
          <View style={[styles.dashCard, { flex: 1 }]}>
            <Ionicons name="checkmark-circle" size={22} color={COLORS.succes} />
            <Text style={styles.dashValeur}>✓</Text>
            <Text style={styles.dashLabel}>Garde alternée{'\n'}déclarée</Text>
          </View>
          <View style={[styles.dashCard, { flex: 1 }]}>
            <Ionicons name="cash-outline" size={22} color={COLORS.or} />
            <Text style={styles.dashValeur}>1 840 €</Text>
            <Text style={styles.dashLabel}>Crédit d'impôt{'\n'}estimé 2025</Text>
          </View>
        </View>

        <View style={[styles.dashCard, styles.dashCardFull]}>
          <View style={styles.dashCardRow}>
            <Ionicons name="calendar-outline" size={22} color={ACCENT} />
            <View style={{ flex: 1 }}>
              <Text style={styles.dashValeur}>15 mai 2026</Text>
              <Text style={styles.dashLabel}>Prochaine déclaration — Impôts 2025</Text>
            </View>
          </View>
        </View>

        {/* Mes droits */}
        <Text style={styles.sectionTitre}>MES DROITS</Text>
        {DROITS.map((droit, i) => (
          <View key={i} style={styles.droitCard}>
            <View style={[styles.droitIcon, { backgroundColor: droit.fond }]}>
              <Ionicons name={droit.icone} size={20} color={droit.couleur} />
            </View>
            <View style={styles.droitInfo}>
              <Text style={styles.droitTitre}>{droit.titre}</Text>
              <Text style={styles.droitDesc}>{droit.desc}</Text>
            </View>
            <Text style={[styles.droitMontant, { color: droit.couleur }]}>
              {droit.montant}
            </Text>
          </View>
        ))}

        {/* Documents générés */}
        <Text style={[styles.sectionTitre, { marginTop: SPACING.xl }]}>
          DOCUMENTS GÉNÉRÉS
        </Text>
        {DOCS_GENERES.map((doc, i) => (
          <View key={i} style={styles.docCard}>
            <View style={styles.docIconWrap}>
              <Ionicons name={doc.icone} size={20} color={ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.docNom}>{doc.nom}</Text>
              <Text style={styles.docDate}>{doc.date}</Text>
            </View>
            {doc.certifie && (
              <View style={styles.certifBadge}>
                <Text style={styles.certifTxt}>✓ Certifié</Text>
              </View>
            )}
          </View>
        ))}

        {/* Bouton simulation */}
        <TouchableOpacity
          style={styles.btnSimuler}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#9E7A64', ACCENT]}
            style={styles.btnSimulerGradient}
          >
            <Ionicons name="calculator-outline" size={20} color={COLORS.blanc} />
            <Text style={styles.btnSimulerTxt}>
              Simuler mon crédit d'impôt
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modal simulation */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={fermerModal}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modal}>
            <View style={styles.modalPoignee} />
            <Text style={styles.modalTitre}>Simulateur crédit d'impôt</Text>
            <Text style={styles.modalInfo}>
              Estimation indicative — consultez un expert pour votre situation.
            </Text>

            {resultat !== null ? (
              <View style={styles.resultatWrap}>
                <Text style={styles.resultatLabel}>Crédit d'impôt estimé</Text>
                <Text style={styles.resultatValeur}>{resultat.toLocaleString('fr-FR')} €</Text>
                <Text style={styles.resultatNote}>
                  Soit 50% des frais estimés, dans la limite du plafond légal.
                </Text>
                <TouchableOpacity style={styles.btnFermer} onPress={fermerModal}>
                  <Text style={styles.btnFermerTxt}>Fermer</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.label}>Revenus annuels nets (€)</Text>
                <TextInput
                  style={styles.input}
                  value={revenus}
                  onChangeText={setRevenus}
                  placeholder="Ex : 35000"
                  placeholderTextColor={COLORS.ardoise}
                  keyboardType="decimal-pad"
                />

                <Text style={styles.label}>Jours de garde par mois (enfant)</Text>
                <TextInput
                  style={styles.input}
                  value={joursPar}
                  onChangeText={setJoursPar}
                  placeholder="Ex : 15"
                  placeholderTextColor={COLORS.ardoise}
                  keyboardType="decimal-pad"
                />

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.btnAnnuler}
                    onPress={fermerModal}
                  >
                    <Text style={styles.btnAnnulerTxt}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.btnValider,
                      (!revenus || !joursPar) && styles.btnDisabled,
                    ]}
                    onPress={simuler}
                    disabled={!revenus || !joursPar}
                  >
                    <Text style={styles.btnValiderTxt}>Simuler</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
  headerBadge: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.lg },

  sectionTitre: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.ardoise,
    letterSpacing: 1.5,
    marginBottom: SPACING.md,
  },

  dashRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  dashCard: {
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  dashCardFull: {
    alignItems: 'flex-start',
    marginBottom: SPACING.xl,
  },
  dashCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  dashValeur: {
    fontSize: TYPOGRAPHY.xl,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.texte,
  },
  dashLabel: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.ardoise,
    textAlign: 'center',
    lineHeight: 16,
  },

  droitCard: {
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
  droitIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  droitInfo: { flex: 1 },
  droitTitre: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.texte,
    marginBottom: 2,
  },
  droitDesc: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.ardoise,
    lineHeight: 16,
  },
  droitMontant: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: TYPOGRAPHY.bold,
    textAlign: 'right',
    maxWidth: 72,
  },

  docCard: {
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
  docIconWrap: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: '#F7EEE9',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  docNom: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.medium,
    color: COLORS.texte,
    marginBottom: 2,
  },
  docDate: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.ardoise,
  },
  certifBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    backgroundColor: '#E6F4EA',
  },
  certifTxt: {
    fontSize: 10,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.succes,
  },

  btnSimuler: {
    marginTop: SPACING.xl,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  btnSimulerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
  },
  btnSimulerTxt: {
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
    marginBottom: SPACING.xs,
  },
  modalInfo: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.ardoise,
    marginBottom: SPACING.xl,
    lineHeight: 17,
  },
  label: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.ardoise,
    letterSpacing: 1,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
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

  resultatWrap: { alignItems: 'center', paddingVertical: SPACING.lg },
  resultatLabel: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.ardoise,
    marginBottom: SPACING.sm,
  },
  resultatValeur: {
    fontSize: 40,
    fontWeight: TYPOGRAPHY.bold,
    color: ACCENT,
    marginBottom: SPACING.sm,
  },
  resultatNote: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.ardoise,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.xl,
  },
  btnFermer: {
    paddingHorizontal: SPACING.xxxl,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.lg,
    backgroundColor: ACCENT,
  },
  btnFermerTxt: {
    fontSize: TYPOGRAPHY.md,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.blanc,
  },
});
