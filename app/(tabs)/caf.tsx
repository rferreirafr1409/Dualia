import { useState, useEffect } from 'react';
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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../constants/theme';
import { useStore } from '../../store/useStore';
import { supabase } from '../../constants/supabase';
import { TRADUCTIONS } from '../../constants/i18n';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const ACCENT = '#B5927C';

export default function CafScreen() {
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].caf;
  const cadreFamilial = useStore((s) => s.cadreFamilial);

  // Relie enfin le montant réel extrait du jugement (une fois le cadre
  // validé) à ce module — jusqu'ici il restait affiché uniquement sur
  // l'écran de validation, sans jamais remonter ici où il a le plus de sens.
  const pensionReelle =
    cadreFamilial?.statut === 'valide' && cadreFamilial.pension
      ? `${cadreFamilial.pension.montant} €`
      : null;

  // Le libellé reflète maintenant ce qui a vraiment été détecté dans le
  // document, une fois le cadre validé — et est traduit dans les 4 langues.
  const texteGardeCaf = `${cadreFamilial?.garde?.residencePrincipale || ''} ${cadreFamilial?.garde?.droitVisiteHebergementDescription || ''}`.toLowerCase();
  const modeGardeLabel =
    cadreFamilial?.statut === 'valide' && cadreFamilial.garde
      ? texteGardeCaf.includes('altern')
        ? t.residenceAlterneeDeclaree
        : t.gardeExclusiveDeclaree
      : t.gardeAlterneeDeclaree;

  const indexation = cadreFamilial?.statut === 'valide' ? cadreFamilial.pension?.indexation : undefined;
  const verrouillerIndiceInitial = useStore((s) => s.verrouillerIndiceInitial);
  const [indiceInitialSaisie, setIndiceInitialSaisie] = useState('');
  const [indiceActuel, setIndiceActuel] = useState('');
  const [recuperationEnCours, setRecuperationEnCours] = useState(false);
  const [recuperationErreur, setRecuperationErreur] = useState<string | null>(null);
  const [recuperationAvertissement, setRecuperationAvertissement] = useState<string | null>(null);
  const [valeurAutomatique, setValeurAutomatique] = useState<{ valeur: number; date: string } | null>(null);

  useEffect(() => {
    supabase
      .from('parametres_globaux')
      .select('valeur_num, mis_a_jour_le')
      .eq('cle', 'insee_indice_actuel')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.valeur_num) {
          setValeurAutomatique({ valeur: data.valeur_num, date: data.mis_a_jour_le });
        }
      });
  }, []);

  const recupererIndiceActuel = async () => {
    setRecuperationEnCours(true);
    setRecuperationErreur(null);
    setRecuperationAvertissement(null);
    try {
      const reponse = await fetch('https://dualia-backend.vercel.app/api/insee-indice');
      const data = await reponse.json();
      if (!reponse.ok || !data.valeur) {
        throw new Error(data.error || 'Réponse invalide');
      }
      setIndiceActuel(String(data.valeur).replace('.', ','));
      if (data.avertissement) setRecuperationAvertissement(data.avertissement);
    } catch (err: any) {
      setRecuperationErreur(t.revalEchec);
    } finally {
      setRecuperationEnCours(false);
    }
  };

  const montantInitial = cadreFamilial?.pension?.montant;
  const indiceInitialVerrouille = indexation?.indiceInitialConfirme;
  const indiceInitialNum = indiceInitialVerrouille ?? parseFloat(indiceInitialSaisie.replace(',', '.'));
  const indiceActuelNum = parseFloat(indiceActuel.replace(',', '.'));
  const montantRevalorise =
    montantInitial && indiceInitialNum > 0 && indiceActuelNum > 0
      ? Math.round((montantInitial * indiceActuelNum / indiceInitialNum) * 100) / 100
      : null;

  const localeDate = langue === 'pt' ? 'pt-PT' : langue === 'es' ? 'es-ES' : langue === 'en' ? 'en-GB' : 'fr-FR';

  const DROITS = [
    {
      titre: t.droitAllocFamTitre,
      montant: t.droitAllocFamMontant,
      desc: t.droitAllocFamDesc,
      icone: 'people-outline' as IoniconName,
      fond: '#F7EEE9',
      couleur: ACCENT,
    },
    {
      titre: t.droitCreditGardeTitre,
      montant: t.droitCreditGardeMontant,
      desc: t.droitCreditGardeDesc,
      icone: 'card-outline' as IoniconName,
      fond: '#FBF3DF',
      couleur: COLORS.or,
    },
    {
      titre: t.droitPrimeTitre,
      montant: t.droitPrimeMontant,
      desc: t.droitPrimeDesc,
      icone: 'trending-up-outline' as IoniconName,
      fond: '#E8F3ED',
      couleur: COLORS.vert,
    },
    {
      titre: t.droitApITitre,
      montant: t.droitApIMontant,
      desc: t.droitApIDesc,
      icone: 'home-outline' as IoniconName,
      fond: '#EEF1F0',
      couleur: COLORS.ardoise,
    },
  ];

  const DOCS_GENERES = [
    {
      nom: t.docAttestationNom,
      date: t.docAttestationDate,
      icone: 'document-text-outline' as IoniconName,
      certifie: true,
    },
    {
      nom: t.docDeclarationNom,
      date: t.docDeclarationDate,
      icone: 'document-outline' as IoniconName,
      certifie: true,
    },
  ];

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
          <Text style={styles.headerTitre}>{t.titre}</Text>
          <Text style={styles.headerSous}>{t.sousTitre}</Text>
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
            <Text style={styles.dashLabel}>{modeGardeLabel}</Text>
          </View>
          <View style={[styles.dashCard, { flex: 1 }]}>
            <Ionicons name="cash-outline" size={22} color={COLORS.or} />
            <Text style={styles.dashValeur}>{pensionReelle ?? '1 840 €'}</Text>
            <Text style={styles.dashLabel}>{t.creditImpotEstime}</Text>
          </View>
        </View>

        {montantInitial ? (
          <View style={styles.revalCard}>
            <Text style={styles.revalEyebrow}>{t.revalTitre}</Text>
            {indexation?.formuleTexteSource ? (
              <Text style={styles.revalFormule}>« {indexation.formuleTexteSource} »</Text>
            ) : (
              <Text style={styles.revalFormule}>{t.revalFormuleDefaut}</Text>
            )}
            {indexation?.indiceReference ? (
              <Text style={styles.revalMeta}>{t.revalIndiceRef(indexation.indiceReference)}</Text>
            ) : null}
            {indexation?.dateRevisionAnnuelle ? (
              <Text style={styles.revalMeta}>{t.revalDateRevision(indexation.dateRevisionAnnuelle)}</Text>
            ) : null}

            <Text style={styles.revalLabel}>{t.revalIndiceJugement}</Text>
            {indiceInitialVerrouille ? (
              <View style={styles.revalVerrouille}>
                <Ionicons name="lock-closed" size={13} color={COLORS.ardoise} />
                <Text style={styles.revalVerrouilleTexte}>{t.revalEnregistre(indiceInitialVerrouille)}</Text>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.revalInput}
                  value={indiceInitialSaisie}
                  onChangeText={setIndiceInitialSaisie}
                  placeholder={t.revalIndicePlaceholder}
                  placeholderTextColor={COLORS.ardoise}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity
                  style={[styles.revalVerrouillerBtn, !indiceInitialSaisie && styles.revalVerrouillerBtnDesactive]}
                  disabled={!indiceInitialSaisie}
                  onPress={() => {
                    const v = parseFloat(indiceInitialSaisie.replace(',', '.'));
                    if (v > 0) verrouillerIndiceInitial(v);
                  }}
                >
                  <Text style={styles.revalVerrouillerBtnTexte}>{t.revalEnregistrerBtn}</Text>
                </TouchableOpacity>
              </>
            )}

            <Text style={styles.revalLabel}>{t.revalIndiceActuelLabel}</Text>
            {valeurAutomatique && !indiceActuel ? (
              <TouchableOpacity
                style={styles.revalAutoBloc}
                onPress={() => setIndiceActuel(String(valeurAutomatique.valeur).replace('.', ','))}
              >
                <Ionicons name="sync-outline" size={14} color={COLORS.vert} />
                <Text style={styles.revalAutoTexte}>
                  {t.revalAutoRecupere(valeurAutomatique.valeur, new Date(valeurAutomatique.date).toLocaleDateString(localeDate))}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TextInput
              style={styles.revalInput}
              value={indiceActuel}
              onChangeText={setIndiceActuel}
              placeholder={t.revalIndiceActuelPlaceholder}
              placeholderTextColor={COLORS.ardoise}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity style={styles.revalRecupererBtn} onPress={recupererIndiceActuel} disabled={recuperationEnCours}>
              <Text style={styles.revalRecupererBtnTexte}>
                {recuperationEnCours ? t.revalRecuperationEnCours : t.revalRecupererBtn}
              </Text>
            </TouchableOpacity>
            {recuperationErreur ? <Text style={styles.revalErreur}>{recuperationErreur}</Text> : null}
            {recuperationAvertissement ? <Text style={styles.revalAvertissement}>{recuperationAvertissement}</Text> : null}
            <Text style={styles.revalLien} onPress={() => Linking.openURL('https://www.insee.fr/fr/statistiques/serie/001763852')}>
              {t.revalLienManuel}
            </Text>

            {montantRevalorise ? (
              <View style={styles.revalResultat}>
                <Text style={styles.revalResultatLabel}>{t.revalMontantLabel}</Text>
                <Text style={styles.revalResultatValeur}>{montantRevalorise} € / mois</Text>
              </View>
            ) : null}

            <Text style={styles.revalAvertissement}>{t.revalNote}</Text>
          </View>
        ) : null}

        <View style={[styles.dashCard, styles.dashCardFull]}>
          <View style={styles.dashCardRow}>
            <Ionicons name="calendar-outline" size={22} color={ACCENT} />
            <View style={{ flex: 1 }}>
              <Text style={styles.dashValeur}>{t.prochaineDeclarationDate}</Text>
              <Text style={styles.dashLabel}>{t.prochaineDeclaration}</Text>
            </View>
          </View>
        </View>

        {/* Mes droits */}
        <Text style={styles.sectionTitre}>{t.mesDroits}</Text>
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
          {t.documentsGeneres}
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
                <Text style={styles.certifTxt}>✓ {t.certifie}</Text>
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
              {t.simulerCreditImpot}
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
            <Text style={styles.modalTitre}>{t.modalTitre}</Text>
            <Text style={styles.modalInfo}>
              {t.modalInfo}
            </Text>

            {resultat !== null ? (
              <View style={styles.resultatWrap}>
                <Text style={styles.resultatLabel}>{t.resultatLabel}</Text>
                <Text style={styles.resultatValeur}>
                  {resultat.toLocaleString(localeDate)} €
                </Text>
                <Text style={styles.resultatNote}>
                  {t.resultatNote}
                </Text>
                <TouchableOpacity style={styles.btnFermer} onPress={fermerModal}>
                  <Text style={styles.btnFermerTxt}>{t.fermer}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={styles.label}>{t.revenusLabel}</Text>
                <TextInput
                  style={styles.input}
                  value={revenus}
                  onChangeText={setRevenus}
                  placeholder={t.revenusPlaceholder}
                  placeholderTextColor={COLORS.ardoise}
                  keyboardType="decimal-pad"
                />

                <Text style={styles.label}>{t.joursLabel}</Text>
                <TextInput
                  style={styles.input}
                  value={joursPar}
                  onChangeText={setJoursPar}
                  placeholder={t.joursPlaceholder}
                  placeholderTextColor={COLORS.ardoise}
                  keyboardType="decimal-pad"
                />

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.btnAnnuler}
                    onPress={fermerModal}
                  >
                    <Text style={styles.btnAnnulerTxt}>{t.annuler}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.btnValider,
                      (!revenus || !joursPar) && styles.btnDisabled,
                    ]}
                    onPress={simuler}
                    disabled={!revenus || !joursPar}
                  >
                    <Text style={styles.btnValiderTxt}>{t.simuler}</Text>
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

  revalCard: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: ACCENT, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginHorizontal: SPACING.lg, marginTop: SPACING.md,
  },
  revalEyebrow: { fontSize: TYPOGRAPHY.xs, fontWeight: TYPOGRAPHY.semibold, color: ACCENT, letterSpacing: 0.6, marginBottom: 8 },
  revalFormule: { fontSize: 12.5, color: COLORS.texte, fontStyle: 'italic', marginBottom: 6, lineHeight: 18 },
  revalMeta: { fontSize: 11.5, color: COLORS.ardoise, marginBottom: 2 },
  revalLabel: { fontSize: 12, fontWeight: TYPOGRAPHY.semibold, color: COLORS.texte, marginTop: SPACING.sm, marginBottom: 4 },
  revalInput: {
    backgroundColor: COLORS.ivoire, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.texte,
  },
  revalLien: { fontSize: 12, color: ACCENT, fontWeight: TYPOGRAPHY.semibold, marginTop: 8 },
  revalVerrouille: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.ivoire, borderRadius: RADIUS.md, paddingVertical: 10, paddingHorizontal: 12 },
  revalVerrouilleTexte: { fontSize: 13, color: COLORS.ardoise },
  revalVerrouillerBtn: { backgroundColor: ACCENT, borderRadius: RADIUS.md, paddingVertical: 9, alignItems: 'center', marginTop: 6 },
  revalVerrouillerBtnDesactive: { opacity: 0.4 },
  revalVerrouillerBtnTexte: { fontSize: 12.5, fontWeight: TYPOGRAPHY.semibold, color: COLORS.blanc },
  revalRecupererBtn: { backgroundColor: COLORS.vert, borderRadius: RADIUS.md, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  revalRecupererBtnTexte: { fontSize: 12.5, fontWeight: TYPOGRAPHY.semibold, color: COLORS.blanc },
  revalErreur: { fontSize: 11, color: COLORS.erreur, marginTop: 6 },
  revalAutoBloc: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EEF4F1', borderRadius: RADIUS.md, padding: 10, marginBottom: 6 },
  revalAutoTexte: { flex: 1, fontSize: 11, color: COLORS.vert, lineHeight: 15 },
  revalResultat: {
    backgroundColor: '#F7EEE9', borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.md, alignItems: 'center',
  },
  revalResultatLabel: { fontSize: 11.5, color: ACCENT, marginBottom: 2 },
  revalResultatValeur: { fontSize: TYPOGRAPHY.xl, fontWeight: TYPOGRAPHY.bold, color: COLORS.texte },
  revalAvertissement: { fontSize: 10.5, color: COLORS.ardoise, marginTop: SPACING.sm, lineHeight: 15 },

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