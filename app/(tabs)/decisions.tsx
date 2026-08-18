import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../../store/useStore';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../constants/theme';
import { StatutDecision } from '../../types';

const STATUT_CONFIG: Record<
  StatutDecision,
  { label: string; couleur: string; fond: string }
> = {
  proposée: { label: 'Proposée', couleur: COLORS.or, fond: '#FBF3DF' },
  acceptée: { label: 'Acceptée', couleur: '#1A8A4A', fond: '#E8F7EE' },
  refusée: { label: 'Refusée', couleur: COLORS.erreur, fond: '#FEF2F2' },
  en_attente: { label: 'En attente', couleur: COLORS.ardoise, fond: COLORS.ivoireFonce },
};

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

export default function DecisionsScreen() {
  const { decisions, parents, parentActif, ajouterDecision, mettreAJourDecision, horodaterDecision } =
    useStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [exportEnCours, setExportEnCours] = useState(false);

  const handleAjouter = () => {
    if (!titre.trim() || !description.trim()) {
      Alert.alert('Champs requis', 'Veuillez remplir le titre et la description.');
      return;
    }
    ajouterDecision({
      id: `d-${Date.now()}`,
      titre: titre.trim(),
      description: description.trim(),
      dateCreation: new Date().toISOString(),
      auteurId: parentActif,
      statut: 'proposée',
    });
    setTitre('');
    setDescription('');
    setModalVisible(false);
  };

  const handleHorodater = (id: string) => {
    Alert.alert(
      'Horodatage eIDAS',
      'Apposer un horodatage qualifié eIDAS sur cette décision ? Elle sera marquée comme acceptée.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Confirmer', onPress: () => horodaterDecision(id) },
      ]
    );
  };

  const handleExportJAF = async () => {
    setExportEnCours(true);
    try {
      const lignes = decisions
        .map(
          (d) => `
          <tr>
            <td><strong>${d.titre}</strong><br/><span style="color:#78716C;font-size:11px">${d.description}</span></td>
            <td>${parents[d.auteurId].nom}</td>
            <td>${format(parseISO(d.dateCreation), 'd MMM yyyy', { locale: fr })}</td>
            <td style="color:${STATUT_CONFIG[d.statut].couleur}">${STATUT_CONFIG[d.statut].label}</td>
            <td style="font-size:11px">${d.horodatageEIDAS ? format(parseISO(d.horodatageEIDAS), "d MMM yyyy 'à' HH:mm", { locale: fr }) : '—'}</td>
            <td style="font-size:10px;font-family:monospace;color:#6B7F7A">${d.signatureToken ?? '—'}</td>
          </tr>`
        )
        .join('');

      const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
        <style>
          body{font-family:Arial,sans-serif;padding:24px;color:#1C1917;font-size:13px}
          h1{color:#1C2B25;margin-bottom:4px}
          .subtitle{color:#78716C;margin-bottom:24px;font-size:12px}
          table{width:100%;border-collapse:collapse;margin-top:16px}
          th{background:#1C2B25;color:#fff;padding:8px;text-align:left;font-size:11px}
          td{padding:8px;border-bottom:1px solid #E7E5E4;vertical-align:top}
          tr:nth-child(even) td{background:#F8F6F2}
          .footer{margin-top:32px;font-size:10px;color:#78716C;text-align:center;border-top:1px solid #E7E5E4;padding-top:12px}
        </style></head><body>
        <h1>Dualia — Registre des décisions coparentales</h1>
        <p class="subtitle">
          ${parents['A'].nom} &amp; ${parents['B'].nom}<br/>
          Généré le ${format(new Date(), "d MMMM yyyy 'à' HH:mm", { locale: fr })} — Document confidentiel JAF
        </p>
        <table>
          <thead><tr>
            <th>Décision</th><th>Proposé par</th><th>Date</th>
            <th>Statut</th><th>Horodatage eIDAS</th><th>Jeton de signature</th>
          </tr></thead>
          <tbody>${lignes}</tbody>
        </table>
        <p class="footer">Document certifié Dualia • Horodatages conformes au Règlement eIDAS (UE) n°910/2014<br/>
        Destiné exclusivement au Juge aux Affaires Familiales</p>
        </body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Export JAF — Décisions Dualia',
        });
      }
    } catch {
      Alert.alert('Erreur export', 'La génération du PDF a échoué. Réessayez.');
    } finally {
      setExportEnCours(false);
    }
  };

  return (
    <SafeAreaView style={styles.conteneur} edges={['bottom']}>
      {/* Bandeau eIDAS */}
      <View style={styles.bandeauEidas}>
        <Ionicons name="lock-closed" size={13} color={COLORS.orClair} />
        <Text style={styles.bandeauEidasTxt}>
          Horodatage eIDAS certifié — Règlement (UE) n°910/2014
        </Text>
      </View>

      {/* Barre actions */}
      <View style={styles.barreActions}>
        <Text style={styles.compteur}>
          {decisions.length} décision{decisions.length !== 1 ? 's' : ''}
        </Text>
        <TouchableOpacity
          style={styles.btnExport}
          onPress={handleExportJAF}
          disabled={exportEnCours}
          accessibilityLabel="Exporter pour le JAF"
        >
          {exportEnCours ? (
            <ActivityIndicator size="small" color={COLORS.vertProfond} />
          ) : (
            <Ionicons name="download-outline" size={16} color={COLORS.vertProfond} />
          )}
          <Text style={styles.btnExportTxt}>Export JAF</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.liste} showsVerticalScrollIndicator={false}>
        {decisions.map((d) => {
          const cfg = STATUT_CONFIG[d.statut];
          const auteur = parents[d.auteurId];
          const peutRepondre =
            (d.statut === 'proposée' || d.statut === 'en_attente') &&
            d.auteurId !== parentActif;

          return (
            <View key={d.id} style={styles.carte}>
              {/* En-tête */}
              <View style={styles.carteEntete}>
                <Text style={styles.carteTitre} numberOfLines={2}>
                  {d.titre}
                </Text>
                <View style={[styles.badge, { backgroundColor: cfg.fond }]}>
                  <Text style={[styles.badgeTxt, { color: cfg.couleur }]}>
                    {cfg.label}
                  </Text>
                </View>
              </View>

              {/* Description */}
              <Text style={styles.carteDesc} numberOfLines={3}>
                {d.description}
              </Text>

              {/* Méta */}
              <View style={styles.carteMeta}>
                <View style={styles.metaItem}>
                  <View
                    style={[
                      styles.metaDot,
                      { backgroundColor: parents[d.auteurId].couleur },
                    ]}
                  />
                  <Text style={styles.metaTxt}>{auteur.nom}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={12} color={COLORS.ardoise} />
                  <Text style={styles.metaTxt}>
                    {format(parseISO(d.dateCreation), 'd MMM yyyy', { locale: fr })}
                  </Text>
                </View>
              </View>

              {/* Horodatage eIDAS ou bouton */}
              {d.horodatageEIDAS ? (
                <View style={styles.eidasConfirme}>
                  <Ionicons name="shield-checkmark" size={13} color="#1A8A4A" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.eidasConfirmeTxt}>
                      eIDAS — {format(parseISO(d.horodatageEIDAS), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                    </Text>
                    {d.signatureToken && (
                      <Text style={[styles.tokenTxt, { fontFamily: MONO }]}>
                        {d.signatureToken}
                      </Text>
                    )}
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.btnHorodater}
                  onPress={() => handleHorodater(d.id)}
                >
                  <Ionicons name="time-outline" size={13} color={COLORS.or} />
                  <Text style={styles.btnHorodaterTxt}>
                    Apposer horodatage eIDAS
                  </Text>
                </TouchableOpacity>
              )}

              {/* Actions */}
              {peutRepondre && (
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.btnAccepter}
                    onPress={() => mettreAJourDecision(d.id, { statut: 'acceptée' })}
                  >
                    <Ionicons name="checkmark" size={16} color={COLORS.blanc} />
                    <Text style={styles.btnAccepterTxt}>Accepter</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnRefuser}
                    onPress={() => mettreAJourDecision(d.id, { statut: 'refusée' })}
                  >
                    <Ionicons name="close" size={16} color={COLORS.erreur} />
                    <Text style={styles.btnRefuserTxt}>Refuser</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: SPACING.xxxl + 40 }} />
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
        accessibilityLabel="Ajouter une décision"
      >
        <Ionicons name="add" size={28} color={COLORS.blanc} />
      </TouchableOpacity>

      {/* Modal nouvelle décision */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContenu}>
            <View style={styles.modalHandle} />
            <View style={styles.modalEntete}>
              <Text style={styles.modalTitre}>Nouvelle décision</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                accessibilityLabel="Fermer"
                style={styles.modalClose}
              >
                <Ionicons name="close" size={20} color={COLORS.ardoise} />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Titre *</Text>
            <TextInput
              style={styles.input}
              value={titre}
              onChangeText={setTitre}
              placeholder="Ex : Inscription cours de sport"
              placeholderTextColor={COLORS.ardoise}
              maxLength={120}
            />

            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={description}
              onChangeText={setDescription}
              placeholder="Décrivez la décision à soumettre…"
              placeholderTextColor={COLORS.ardoise}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />

            <View style={styles.auteurRow}>
              <View
                style={[
                  styles.auteurDot,
                  { backgroundColor: parents[parentActif].couleur },
                ]}
              />
              <Text style={styles.auteurTxt}>
                Proposé par {parents[parentActif].nom}
              </Text>
            </View>

            <TouchableOpacity style={styles.btnSoumettre} onPress={handleAjouter}>
              <Text style={styles.btnSoumettreTexte}>Soumettre la décision</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: COLORS.ivoire },

  bandeauEidas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.vertProfond,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
  },
  bandeauEidasTxt: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.orClair,
    fontWeight: TYPOGRAPHY.medium,
    letterSpacing: 0.2,
  },

  barreActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.bordure,
  },
  compteur: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.ardoise,
    fontWeight: TYPOGRAPHY.medium,
  },
  btnExport: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.or,
  },
  btnExportTxt: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.vertProfond,
    fontWeight: TYPOGRAPHY.semibold,
  },

  liste: { padding: SPACING.lg },

  carte: {
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  carteEntete: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  carteTitre: {
    flex: 1,
    fontSize: TYPOGRAPHY.md,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.texte,
    lineHeight: 22,
  },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  badgeTxt: {
    fontSize: TYPOGRAPHY.xs,
    fontWeight: TYPOGRAPHY.semibold,
  },
  carteDesc: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.ardoise,
    lineHeight: 20,
  },
  carteMeta: {
    flexDirection: 'row',
    gap: SPACING.lg,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.bordure,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaDot: { width: 8, height: 8, borderRadius: RADIUS.full },
  metaTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.ardoise },

  eidasConfirme: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    backgroundColor: '#E8F7EE',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  eidasConfirmeTxt: {
    fontSize: TYPOGRAPHY.xs,
    color: '#1A8A4A',
    fontWeight: TYPOGRAPHY.medium,
  },
  tokenTxt: {
    fontSize: 10,
    color: COLORS.ardoise,
    marginTop: 2,
    letterSpacing: 0.5,
  },

  btnHorodater: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: SPACING.sm,
  },
  btnHorodaterTxt: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.or,
    fontWeight: TYPOGRAPHY.medium,
  },

  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  btnAccepter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.vert,
  },
  btnAccepterTxt: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.blanc,
  },
  btnRefuser: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: COLORS.erreur + '40',
  },
  btnRefuserTxt: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.erreur,
  },

  fab: {
    position: 'absolute',
    bottom: SPACING.xxl,
    right: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.vert,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.vert,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.50)',
    justifyContent: 'flex-end',
  },
  modalContenu: {
    backgroundColor: COLORS.ivoire,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.bordure,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  modalEntete: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  modalTitre: {
    fontSize: TYPOGRAPHY.xl,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.texte,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.ivoireFonce,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.medium,
    color: COLORS.texte,
    marginBottom: SPACING.xs,
    marginTop: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.bordure,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: TYPOGRAPHY.md,
    color: COLORS.texte,
  },
  inputMulti: { height: 100 },
  auteurRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.lg,
  },
  auteurDot: { width: 8, height: 8, borderRadius: RADIUS.full },
  auteurTxt: {
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.ardoise,
    fontStyle: 'italic',
  },
  btnSoumettre: {
    backgroundColor: COLORS.vert,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  btnSoumettreTexte: {
    color: COLORS.blanc,
    fontSize: TYPOGRAPHY.md,
    fontWeight: TYPOGRAPHY.semibold,
  },
});
