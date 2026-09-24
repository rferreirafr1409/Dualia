// app/validation-cadre.tsx
//
// Écran de validation clause par clause du cadre familial. Accessible :
// 1. Depuis JugementUpload, juste après une extraction de convention.
// 2. Plus tard, depuis Finances → « Votre cadre familial » (à câbler dans
//    une prochaine étape), pour revoir ou modifier les règles.
//
// Règle métier stricte : tant que CadreFamilial.statut !== 'valide', aucune
// règle ici présente ne doit être utilisée ailleurs (Finances, Calendrier,
// Décisions) pour calculer quoi que ce soit automatiquement.

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store/useStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { libellesConditions, listerConditions, aDesConditions } from '../lib/conditionsCadre';
import { formatMontant } from '../lib/comptes';
import { TRADUCTIONS } from '../constants/i18n';
import DatePickerField from '../components/DatePickerField';
import type { CategorieRegle, NiveauConfiance, ReglePartage, ParentRole } from '../types';

export default function ValidationCadreScreen() {
  const router = useRouter();
  const langue = useStore((s) => s.langue);
  const lcCadre = libellesConditions(langue);
  // Exactement la même fonction que l'écran Finances : un plafond doit se lire
  // à l'identique là où on le valide et là où on l'applique. Dupliquer la mise
  // en forme, c'était laisser les deux écrans diverger à la première retouche.
  const formatMontantCadre = (n: number) => formatMontant(n, langue);
  const t = TRADUCTIONS[langue].validationCadre;
  const localeDate = langue === 'pt' ? 'pt-PT' : langue === 'es' ? 'es-ES' : langue === 'en' ? 'en-GB' : 'fr-FR';

  const LABELS_CATEGORIE: Record<CategorieRegle, string> = {
    fraisMedicaux: t.categorieFraisMedicaux,
    fraisScolaires: t.categorieFraisScolaires,
    activitesExtra: t.categorieActivitesExtra,
    autre: t.categorieAutre,
  };

  const LABELS_CONFIANCE: Record<NiveauConfiance, { label: string; couleur: string }> = {
    haute: { label: t.confianceHaute, couleur: COLORS.vert },
    moyenne: { label: t.confianceMoyenne, couleur: COLORS.or },
    basse: { label: t.confianceBasse, couleur: COLORS.terracotta },
  };

  const cadreFamilial = useStore((s) => s.cadreFamilial);
  const validerRegle = useStore((s) => s.validerRegle);
  const rejeterRegle = useStore((s) => s.rejeterRegle);
  const modifierRegle = useStore((s) => s.modifierRegle);
  const finaliserCadreFamilial = useStore((s) => s.finaliserCadreFamilial);
  const parents = useStore((s) => s.parents);
  const genererCalendrierAlterne = useStore((s) => s.genererCalendrierAlterne);
  const genererCalendrierGardeWeekend = useStore((s) => s.genererCalendrierGardeWeekend);
  const genererDatesSpeciales = useStore((s) => s.genererDatesSpeciales);
  const genererVacancesScolaires = useStore((s) => s.genererVacancesScolaires);
  const setGenreParental = useStore((s) => s.setGenreParental);

  const [dateDebutGarde, setDateDebutGarde] = useState<Date | null>(null);
  const [parentQuiCommence, setParentQuiCommence] = useState<ParentRole>('A');
  const [calendrierGenere, setCalendrierGenere] = useState(false);
  const [datesGenereesMessage, setDatesGenereesMessage] = useState<string | null>(null);
  const [vacancesGenereesMessage, setVacancesGenereesMessage] = useState<string | null>(null);

  const confirmerGenerationVacances = () => {
    const { genere } = genererVacancesScolaires();
    setVacancesGenereesMessage(`${genere} repères ajoutés au calendrier (zone C, Créteil).`);
  };

  const confirmerGenerationDatesSpeciales = () => {
    if (!cadreFamilial?.datesSpeciales) return;
    const anneeCourante = new Date().getFullYear();
    const { genere, ignorees } = genererDatesSpeciales(cadreFamilial.datesSpeciales, anneeCourante, 3);
    const messageIgnorees = ignorees.length > 0
      ? ` ${ignorees.join(', ')} : date mobile, à ajouter toi-même une fois connue.`
      : '';
    setDatesGenereesMessage(`${genere} date${genere > 1 ? 's' : ''} ajoutée${genere > 1 ? 's' : ''} au calendrier (3 prochaines années).${messageIgnorees}`);
  };

  const [modifModalRegle, setModifModalRegle] = useState<ReglePartage | null>(null);
  const [partAInput, setPartAInput] = useState('');

  if (!cadreFamilial) {
    return (
      <View style={styles.screen}>
        <View style={styles.topbar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="close" size={22} color={COLORS.vertProfond} />
          </Pressable>
          <Text style={styles.topbarTitre}>{t.titre}</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.videWrap}>
          <Text style={styles.videTexte}>{t.videTexte}</Text>
        </View>
      </View>
    );
  }

  const regles = cadreFamilial.regles;
  const nbTotal = regles.length;
  const nbVerifiees = regles.filter((r) => r.validation.statut !== 'a_verifier').length;
  const toutEstVerifie = nbTotal > 0 && nbVerifiees === nbTotal;
  const dejaValide = cadreFamilial.statut === 'valide';

  // Détection volontairement simple : on ne propose la génération
  // automatique du calendrier QUE quand le texte du jugement mentionne
  // explicitement une résidence alternée, OU une garde exclusive avec un
  // rythme de week-end régulier détecté — dans tous les autres cas, le
  // motif n'est pas assez régulier pour être généré fiablement à partir du
  // seul texte libre extrait.
  const texteGarde = `${cadreFamilial.garde?.residencePrincipale || ''} ${cadreFamilial.garde?.droitVisiteHebergementDescription || ''}`.toLowerCase();
  const resideceAlterneeDetectee = texteGarde.includes('altern');
  const gardeWeekendDetectee = !resideceAlterneeDetectee && !!cadreFamilial.garde?.weekendParite;

  // Tentative de rattachement automatique du parent résident, à partir du
  // genre déclaré sur chaque parent (voir setGenreParental). Sans ces
  // infos, impossible de savoir de façon fiable si "au domicile de la
  // mère" désigne le parent A ou B — on redemande alors manuellement.
  const genreDetecteDansTexte: 'mere' | 'pere' | null = texteGarde.includes('mère') || texteGarde.includes('mere')
    ? 'mere'
    : texteGarde.includes('père') || texteGarde.includes('pere')
    ? 'pere'
    : null;
  const parentResidentAuto = genreDetecteDansTexte
    ? ((['A', 'B'] as ParentRole[]).find((id) => parents[id].genreParental === genreDetecteDansTexte) ?? null)
    : null;

  const genresManquants = !parents.A.genreParental || !parents.B.genreParental;

  const confirmerGenerationCalendrier = () => {
    if (!dateDebutGarde) return;
    const parentAUtiliser = parentResidentAuto || parentQuiCommence;
    if (resideceAlterneeDetectee) {
      genererCalendrierAlterne(dateDebutGarde.toISOString(), parentAUtiliser, 12);
    } else {
      genererCalendrierGardeWeekend(dateDebutGarde.toISOString(), parentAUtiliser, 12);
    }
    setCalendrierGenere(true);
    const message = t.calendrierGenereMsg;
    if (Platform.OS === 'web') window.alert(message);
    else Alert.alert(t.calendrierGenereTitre, message);
  };

  const ouvrirModif = (regle: ReglePartage) => {
    setModifModalRegle(regle);
    setPartAInput(String(regle.partA));
  };

  const confirmerModif = () => {
    if (!modifModalRegle) return;
    const partA = Math.max(0, Math.min(100, parseInt(partAInput, 10) || 0));
    const partB = 100 - partA;
    modifierRegle(modifModalRegle.id, { partA, partB });
    setModifModalRegle(null);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={22} color={COLORS.vertProfond} />
        </Pressable>
        <Text style={styles.topbarTitre}>{t.titre}</Text>
        <View style={{ width: 22 }} />
      </View>

      {nbTotal > 0 && (
        <View style={styles.progressionWrap}>
          <Text style={styles.progressionTexte}>{t.progressionTexte(nbVerifiees, nbTotal)}</Text>
          <View style={styles.progressionBarreFond}>
            <View
              style={[
                styles.progressionBarreRemplie,
                { width: `${nbTotal === 0 ? 0 : (nbVerifiees / nbTotal) * 100}%` },
              ]}
            />
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {cadreFamilial.pension && (
          <View style={styles.pensionCard}>
            <Text style={styles.pensionEyebrow}>{t.pensionEyebrow}</Text>
            <Text style={styles.pensionMontant}>{cadreFamilial.pension.montant} {t.pensionParMois}</Text>
            {cadreFamilial.pension.montantParEnfant && cadreFamilial.pension.nombreEnfantsConcernes ? (
              <Text style={styles.pensionMeta}>
                {t.pensionParEnfant(cadreFamilial.pension.montantParEnfant, cadreFamilial.pension.nombreEnfantsConcernes)}
              </Text>
            ) : null}
            <Text style={styles.pensionMeta}>{t.pensionPeriodicite(cadreFamilial.pension.periodicite)}</Text>
          </View>
        )}

        {cadreFamilial.datesSpeciales && cadreFamilial.datesSpeciales.length > 0 && (
          <View style={styles.datesCard}>
            <Text style={styles.datesEyebrow}>{t.datesEyebrow}</Text>
            {cadreFamilial.datesSpeciales.map((d, i) => (
              <View key={i} style={styles.dateLigne}>
                <Text style={styles.dateOccasion}>{d.occasion}</Text>
                <Text style={styles.dateParent}>
                  {d.parent === 'A' ? parents.A.nom : d.parent === 'B' ? parents.B.nom : '—'}
                </Text>
              </View>
            ))}
            <Text style={styles.datesResultat}>
              {dejaValide ? t.datesResultatValide : t.datesResultatEnAttente}
            </Text>
          </View>
        )}

        {(resideceAlterneeDetectee || gardeWeekendDetectee) && (
          <View style={styles.gardeCard}>
            <Text style={styles.gardeEyebrow}>
              {resideceAlterneeDetectee ? t.gardeEyebrowAlternee : t.gardeEyebrowRythme}
            </Text>
            <Text style={styles.gardeTexte}>
              {resideceAlterneeDetectee
                ? t.gardeTexteAlternee
                : t.gardeTexteRythme(cadreFamilial.garde?.weekendParite || '')}
              {' '}
              {dejaValide ? t.gardeSuiteValide : t.gardeSuiteEnAttente}
            </Text>

            {dejaValide ? (
              <View style={styles.gardeConfirmation}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.vert} />
                <Text style={styles.gardeConfirmationTexte}>{t.gardeConfirmationTexte}</Text>
              </View>
            ) : (
              <>
                {parentResidentAuto ? (
                  <Text style={styles.gardeAutoDetecte}>
                    {t.gardeAutoDetecte(parents[parentResidentAuto].nom)}
                  </Text>
                ) : (
                  genresManquants && (
                    <View style={styles.genreSetup}>
                      <Text style={styles.genreSetupTexte}>{t.genreSetupTexte(parents.A.nom)}</Text>
                      {(['A', 'B'] as ParentRole[]).map((id) => (
                        <View key={id} style={styles.genreSetupLigne}>
                          <Text style={styles.genreSetupNom}>{parents[id].nom}</Text>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            {(['mere', 'pere'] as const).map((g) => (
                              <Pressable
                                key={g}
                                style={[styles.genreChip, parents[id].genreParental === g && styles.genreChipActif]}
                                onPress={() => setGenreParental(id, g)}
                              >
                                <Text style={[styles.genreChipTexte, parents[id].genreParental === g && styles.genreChipTexteActif]}>
                                  {g === 'mere' ? t.genreMere : t.genrePere}
                                </Text>
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                  )
                )}
              </>
            )}
          </View>
        )}

        {regles.length === 0 && (
          <Text style={styles.videTexte}>{t.reglesVideTexte}</Text>
        )}

        {regles.map((regle) => {
          const confiance = LABELS_CONFIANCE[regle.detection.confiance];
          const conditions = listerConditions(regle.conditions, langue, formatMontantCadre);
          const estDefautNonPrecise = regle.detection.confiance === 'basse' && !regle.clauseSource?.reference;

          return (
            <View key={regle.id} style={styles.regleCard}>
              <Text style={styles.regleTitre}>{LABELS_CATEGORIE[regle.categorie]}</Text>

              <View style={styles.repartitionRow}>
                <Text style={styles.repartitionTexte}>
                  {estDefautNonPrecise ? t.repartitionDefaut : t.repartitionDetectee}
                  <Text style={styles.repartitionValeur}>{regle.partA} % / {regle.partB} %</Text>
                </Text>
              </View>

              {estDefautNonPrecise && (
                <Text style={styles.avertissementDefaut}>{t.avertissementDefaut}</Text>
              )}

              {regle.clauseSource?.reference || regle.clauseSource?.extrait ? (
                <View style={styles.clauseBox}>
                  {regle.clauseSource.reference && (
                    <Text style={styles.clauseReference}>
                      {t.clauseSource(regle.clauseSource.reference)}
                      {regle.clauseSource.page ? t.clauseSourcePage(String(regle.clauseSource.page)) : ''}
                    </Text>
                  )}
                  {regle.clauseSource.extrait && (
                    <Text style={styles.clauseExtrait}>« {regle.clauseSource.extrait} »</Text>
                  )}
                </View>
              ) : null}

              {/* Conditions du jugement. Elles étaient extraites, enregistrées
                  en base, et montrées à personne : le parent validait « 60/40 »
                  sans voir « dans la limite de 400 €, déduction faite de la
                  mutuelle, sur justificatif ». Valider une règle dont on ne
                  voit pas les conditions, ce n'est pas valider. */}
              {aDesConditions(regle.conditions) ? (
                <View style={styles.conditionsBox}>
                  <Text style={styles.conditionsTitre}>{lcCadre.titre}</Text>
                  {conditions.map((ligne, i) => (
                    <View key={i} style={styles.conditionLigne}>
                      <Ionicons name="ellipse" size={5} color={COLORS.or} style={{ marginTop: 6 }} />
                      <Text style={styles.conditionTexte}>{ligne}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.confianceRow}>
                <View style={[styles.confiancePuce, { backgroundColor: confiance.couleur }]} />
                <Text style={styles.confianceTexte}>{confiance.label}</Text>
              </View>

              {regle.validation.statut === 'a_verifier' ? (
                <View style={styles.actionsRow}>
                  <Pressable style={styles.btnValider} onPress={() => validerRegle(regle.id)}>
                    <Text style={styles.btnValiderTexte}>{t.valider}</Text>
                  </Pressable>
                  <Pressable style={styles.btnSecondaire} onPress={() => ouvrirModif(regle)}>
                    <Text style={styles.btnSecondaireTexte}>{t.modifier}</Text>
                  </Pressable>
                  <Pressable style={styles.btnSecondaire} onPress={() => rejeterRegle(regle.id)}>
                    <Text style={styles.btnSecondaireTexte}>{t.rejeter}</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.statutFinalRow}>
                  <Ionicons
                    name={regle.validation.statut === 'validee' ? 'checkmark-circle' : 'close-circle'}
                    size={16}
                    color={regle.validation.statut === 'validee' ? COLORS.vert : COLORS.ardoise}
                  />
                  <Text style={styles.statutFinalTexte}>
                    {regle.validation.statut === 'validee' ? t.valideeStatut : t.nonRetenueStatut}
                  </Text>
                </View>
              )}
            </View>
          );
        })}

        {dejaValide && (
          <View style={styles.dejaValideBox}>
            <Ionicons name="shield-checkmark" size={16} color={COLORS.vert} />
            <Text style={styles.dejaValideTexte}>
              {t.dejaValideTexte(cadreFamilial.valideLe ? new Date(cadreFamilial.valideLe).toLocaleDateString(localeDate) : '')}
            </Text>
          </View>
        )}
      </ScrollView>

      {!dejaValide && (
        <Pressable
          style={[styles.btnFinaliser, !toutEstVerifie && nbTotal > 0 && styles.btnFinaliserDesactive]}
          disabled={nbTotal > 0 && !toutEstVerifie}
          onPress={() => {
            finaliserCadreFamilial();
            router.back();
          }}
        >
          <Text style={styles.btnFinaliserTexte}>{t.btnFinaliser}</Text>
        </Pressable>
      )}

      <Modal visible={!!modifModalRegle} animationType="fade" transparent onRequestClose={() => setModifModalRegle(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitre}>{t.modalTitre}</Text>
            <Text style={styles.modalLabel}>{t.modalLabel}</Text>
            <TextInput
              style={styles.modalInput}
              value={partAInput}
              onChangeText={setPartAInput}
              keyboardType="number-pad"
              placeholder="50"
              placeholderTextColor={COLORS.ardoise}
            />
            <Text style={styles.modalHint}>
              {t.modalHint(100 - (parseInt(partAInput, 10) || 0))}
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtnAnnuler} onPress={() => setModifModalRegle(null)}>
                <Text style={styles.modalBtnAnnulerTexte}>{t.annuler}</Text>
              </Pressable>
              <Pressable style={styles.modalBtnConfirmer} onPress={confirmerModif}>
                <Text style={styles.modalBtnConfirmerTexte}>{t.confirmer}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ivoire },
  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl, paddingBottom: SPACING.md,
  },
  topbarTitre: { fontFamily: FONTS.display, fontSize: 18, color: COLORS.vertProfond },
  videWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl },
  videTexte: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.ardoise, textAlign: 'center', lineHeight: 20 },

  progressionWrap: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  progressionTexte: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.ardoise, marginBottom: 6 },
  progressionBarreFond: { height: 4, borderRadius: 2, backgroundColor: COLORS.bordure },
  progressionBarreRemplie: { height: 4, borderRadius: 2, backgroundColor: COLORS.vert },

  content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl },

  pensionCard: {
    backgroundColor: COLORS.vertProfond, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.lg,
  },
  pensionEyebrow: { fontFamily: FONTS.bodySemibold, fontSize: 10.5, color: COLORS.or, letterSpacing: 0.6, marginBottom: 4 },
  pensionMontant: { fontFamily: FONTS.display, fontSize: 22, color: COLORS.blanc },
  pensionMeta: { fontFamily: FONTS.body, fontSize: 12.5, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  datesCard: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.terracotta, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.lg,
  },
  datesEyebrow: { fontFamily: FONTS.bodySemibold, fontSize: 10.5, color: COLORS.terracotta, letterSpacing: 0.6, marginBottom: SPACING.sm },
  dateLigne: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: COLORS.bordure },
  dateOccasion: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.vertProfond },
  dateParent: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise },
  datesResultat: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.vert, marginTop: SPACING.sm, lineHeight: 18 },
  datesGenererBtn: { backgroundColor: COLORS.terracotta, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', marginTop: SPACING.md },
  datesGenererBtnTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.blanc },
  datesGenererBtnSecondaire: { borderWidth: 1, borderColor: COLORS.terracotta, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center', marginTop: SPACING.sm },
  datesGenererBtnSecondaireTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.terracotta },
  gardeAutoDetecte: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.vert, marginTop: SPACING.sm, marginBottom: SPACING.sm },
  genreSetup: { backgroundColor: COLORS.ivoire, borderRadius: RADIUS.md, padding: SPACING.sm, marginTop: SPACING.sm, marginBottom: SPACING.sm },
  genreSetupTexte: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, marginBottom: 8, lineHeight: 16 },
  genreSetupLigne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  genreSetupNom: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.vertProfond },
  genreChip: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1, borderColor: COLORS.bordure },
  genreChipActif: { backgroundColor: COLORS.vert, borderColor: COLORS.vert },
  genreChipTexte: { fontFamily: FONTS.bodySemibold, fontSize: 11.5, color: COLORS.ardoise },
  genreChipTexteActif: { color: COLORS.blanc },

  gardeCard: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.vert, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.lg,
  },
  gardeEyebrow: { fontFamily: FONTS.bodySemibold, fontSize: 10.5, color: COLORS.vert, letterSpacing: 0.6, marginBottom: 6 },
  gardeTexte: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.vertProfond, lineHeight: 19, marginBottom: SPACING.md },
  gardeLabel: { fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.ardoise, marginBottom: 6, marginTop: SPACING.sm },
  gardeParentRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.md },
  gardeParentChip: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.bordure },
  gardeParentChipActif: { backgroundColor: COLORS.vert, borderColor: COLORS.vert },
  gardeParentChipTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.ardoise },
  gardeParentChipTexteActif: { color: COLORS.blanc },
  gardeGenererBtn: { backgroundColor: COLORS.vert, borderRadius: RADIUS.md, paddingVertical: 13, alignItems: 'center' },
  gardeGenererBtnDesactive: { opacity: 0.4 },
  gardeGenererBtnTexte: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.blanc },
  gardeConfirmation: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gardeConfirmationTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.vert },

  regleCard: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure,
    borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md,
  },
  regleTitre: { fontFamily: FONTS.displaySemibold, fontSize: 16, color: COLORS.vertProfond, marginBottom: 8 },
  repartitionRow: { marginBottom: 4 },
  repartitionTexte: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise },
  repartitionValeur: { fontFamily: FONTS.bodySemibold, color: COLORS.vertProfond },
  avertissementDefaut: {
    fontFamily: FONTS.body, fontSize: 12, color: COLORS.terracotta, lineHeight: 17, marginBottom: 8, marginTop: 2,
  },
  clauseBox: { backgroundColor: '#F3F1EC', borderRadius: 8, padding: 10, marginTop: 6, marginBottom: 8 },
  clauseReference: { fontFamily: FONTS.bodySemibold, fontSize: 11.5, color: COLORS.ardoise, marginBottom: 3 },
  clauseExtrait: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.vertProfond, fontStyle: 'italic', lineHeight: 18 },
  conditionsBox: {
    backgroundColor: 'rgba(197,160,89,0.08)',
    borderLeftWidth: 2,
    borderLeftColor: COLORS.or,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
    gap: 4,
  },
  conditionsTitre: {
    fontFamily: FONTS.bodySemibold,
    fontSize: 11.5,
    color: COLORS.vertProfond,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  conditionLigne: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  conditionTexte: { flex: 1, fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.vertProfond, lineHeight: 17 },
  confianceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.md },
  confiancePuce: { width: 7, height: 7, borderRadius: 4 },
  confianceTexte: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.ardoise },
  actionsRow: { flexDirection: 'row', gap: SPACING.sm },
  btnValider: { flex: 1, backgroundColor: COLORS.vert, borderRadius: 9, paddingVertical: 10, alignItems: 'center' },
  btnValiderTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.blanc },
  btnSecondaire: { flex: 1, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: 9, paddingVertical: 10, alignItems: 'center' },
  btnSecondaireTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.ardoise },
  statutFinalRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statutFinalTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.vertProfond },

  dejaValideBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(45,106,79,0.08)',
    borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.sm,
  },
  dejaValideTexte: { flex: 1, fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.vert, lineHeight: 18 },

  btnFinaliser: {
    backgroundColor: COLORS.vert, marginHorizontal: SPACING.lg, marginBottom: SPACING.lg,
    borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center',
  },
  btnFinaliserDesactive: { backgroundColor: COLORS.bordure },
  btnFinaliserTexte: { fontFamily: FONTS.bodySemibold, fontSize: 14.5, color: COLORS.blanc },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(28,43,37,0.5)', alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  modalCard: { backgroundColor: COLORS.ivoire, borderRadius: RADIUS.lg, padding: SPACING.xl, width: '100%' },
  modalTitre: { fontFamily: FONTS.displaySemibold, fontSize: 17, color: COLORS.vertProfond, marginBottom: SPACING.md },
  modalLabel: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.ardoise, marginBottom: 6 },
  modalInput: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10, fontFamily: FONTS.body, fontSize: 15, color: COLORS.vertProfond,
  },
  modalHint: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.ardoise, marginTop: 8 },
  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  modalBtnAnnuler: { flex: 1, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center' },
  modalBtnAnnulerTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.ardoise },
  modalBtnConfirmer: { flex: 1, backgroundColor: COLORS.vert, borderRadius: RADIUS.md, paddingVertical: 12, alignItems: 'center' },
  modalBtnConfirmerTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.blanc },
});