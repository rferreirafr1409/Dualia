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
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store/useStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import type { CategorieRegle, NiveauConfiance, ReglePartage } from '../types';

const LABELS_CATEGORIE: Record<CategorieRegle, string> = {
  fraisMedicaux: 'Frais médicaux non remboursés',
  fraisScolaires: 'Frais scolaires',
  activitesExtra: 'Activités extrascolaires',
  autre: 'Autre',
};

const LABELS_CONFIANCE: Record<NiveauConfiance, { label: string; couleur: string }> = {
  haute: { label: 'Confiance élevée', couleur: COLORS.vert },
  moyenne: { label: 'Confiance moyenne', couleur: COLORS.or },
  basse: { label: 'Confiance basse', couleur: COLORS.terracotta },
};

export default function ValidationCadreScreen() {
  const router = useRouter();
  const cadreFamilial = useStore((s) => s.cadreFamilial);
  const validerRegle = useStore((s) => s.validerRegle);
  const rejeterRegle = useStore((s) => s.rejeterRegle);
  const modifierRegle = useStore((s) => s.modifierRegle);
  const finaliserCadreFamilial = useStore((s) => s.finaliserCadreFamilial);

  const [modifModalRegle, setModifModalRegle] = useState<ReglePartage | null>(null);
  const [partAInput, setPartAInput] = useState('');

  if (!cadreFamilial) {
    return (
      <View style={styles.screen}>
        <View style={styles.topbar}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="close" size={22} color={COLORS.vertProfond} />
          </Pressable>
          <Text style={styles.topbarTitre}>Cadre familial</Text>
          <View style={{ width: 22 }} />
        </View>
        <View style={styles.videWrap}>
          <Text style={styles.videTexte}>
            Aucune convention n'a encore été analysée. Importez un document depuis l'écran Décisions
            pour commencer.
          </Text>
        </View>
      </View>
    );
  }

  const regles = cadreFamilial.regles;
  const nbTotal = regles.length;
  const nbVerifiees = regles.filter((r) => r.validation.statut !== 'a_verifier').length;
  const toutEstVerifie = nbTotal > 0 && nbVerifiees === nbTotal;
  const dejaValide = cadreFamilial.statut === 'valide';

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
        <Text style={styles.topbarTitre}>Cadre familial</Text>
        <View style={{ width: 22 }} />
      </View>

      {nbTotal > 0 && (
        <View style={styles.progressionWrap}>
          <Text style={styles.progressionTexte}>
            {nbVerifiees} / {nbTotal} règle{nbTotal > 1 ? 's' : ''} vérifiée{nbVerifiees > 1 ? 's' : ''}
          </Text>
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
            <Text style={styles.pensionEyebrow}>PENSION ALIMENTAIRE</Text>
            <Text style={styles.pensionMontant}>{cadreFamilial.pension.montant} € / mois</Text>
            <Text style={styles.pensionMeta}>Périodicité : {cadreFamilial.pension.periodicite}</Text>
          </View>
        )}

        {regles.length === 0 && (
          <Text style={styles.videTexte}>
            Aucune règle de répartition n'a été identifiée avec une précision suffisante dans votre
            document. Vous pourrez en ajouter manuellement depuis Finances.
          </Text>
        )}

        {regles.map((regle) => {
          const confiance = LABELS_CONFIANCE[regle.detection.confiance];
          const estDefautNonPrecise = regle.detection.confiance === 'basse' && !regle.clauseSource?.reference;

          return (
            <View key={regle.id} style={styles.regleCard}>
              <Text style={styles.regleTitre}>{LABELS_CATEGORIE[regle.categorie]}</Text>

              <View style={styles.repartitionRow}>
                <Text style={styles.repartitionTexte}>
                  {estDefautNonPrecise ? 'Répartition proposée par défaut : ' : 'Répartition détectée : '}
                  <Text style={styles.repartitionValeur}>{regle.partA} % / {regle.partB} %</Text>
                </Text>
              </View>

              {estDefautNonPrecise && (
                <Text style={styles.avertissementDefaut}>
                  Aucun pourcentage n'était précisé dans votre document. Dualia propose la répartition
                  standard 50/50 — à valider ou modifier.
                </Text>
              )}

              {regle.clauseSource?.reference || regle.clauseSource?.extrait ? (
                <View style={styles.clauseBox}>
                  {regle.clauseSource.reference && (
                    <Text style={styles.clauseReference}>
                      Source : {regle.clauseSource.reference}
                      {regle.clauseSource.page ? ` · page ${regle.clauseSource.page}` : ''}
                    </Text>
                  )}
                  {regle.clauseSource.extrait && (
                    <Text style={styles.clauseExtrait}>« {regle.clauseSource.extrait} »</Text>
                  )}
                </View>
              ) : null}

              <View style={styles.confianceRow}>
                <View style={[styles.confiancePuce, { backgroundColor: confiance.couleur }]} />
                <Text style={styles.confianceTexte}>{confiance.label}</Text>
              </View>

              {regle.validation.statut === 'a_verifier' ? (
                <View style={styles.actionsRow}>
                  <Pressable style={styles.btnValider} onPress={() => validerRegle(regle.id)}>
                    <Text style={styles.btnValiderTexte}>Valider</Text>
                  </Pressable>
                  <Pressable style={styles.btnSecondaire} onPress={() => ouvrirModif(regle)}>
                    <Text style={styles.btnSecondaireTexte}>Modifier</Text>
                  </Pressable>
                  <Pressable style={styles.btnSecondaire} onPress={() => rejeterRegle(regle.id)}>
                    <Text style={styles.btnSecondaireTexte}>Rejeter</Text>
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
                    {regle.validation.statut === 'validee' ? 'Validée' : 'Non retenue'}
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
              Ce cadre familial est validé et utilisé par Dualia depuis le{' '}
              {cadreFamilial.valideLe ? new Date(cadreFamilial.valideLe).toLocaleDateString('fr-FR') : ''}.
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
          <Text style={styles.btnFinaliserTexte}>Terminer la vérification</Text>
        </Pressable>
      )}

      <Modal visible={!!modifModalRegle} animationType="fade" transparent onRequestClose={() => setModifModalRegle(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitre}>Modifier la répartition</Text>
            <Text style={styles.modalLabel}>Part A (%)</Text>
            <TextInput
              style={styles.modalInput}
              value={partAInput}
              onChangeText={setPartAInput}
              keyboardType="number-pad"
              placeholder="50"
              placeholderTextColor={COLORS.ardoise}
            />
            <Text style={styles.modalHint}>
              Part B sera automatiquement {100 - (parseInt(partAInput, 10) || 0)} %.
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalBtnAnnuler} onPress={() => setModifModalRegle(null)}>
                <Text style={styles.modalBtnAnnulerTexte}>Annuler</Text>
              </Pressable>
              <Pressable style={styles.modalBtnConfirmer} onPress={confirmerModif}>
                <Text style={styles.modalBtnConfirmerTexte}>Confirmer</Text>
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
