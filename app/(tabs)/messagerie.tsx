import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useRef } from 'react';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../../store/useStore';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../constants/theme';
import { Message } from '../../types';

function formaterHeure(isoDate: string): string {
  const date = parseISO(isoDate);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return `Hier ${format(date, 'HH:mm')}`;
  return format(date, 'd MMM HH:mm', { locale: fr });
}

function getSeparateur(messages: Message[], index: number): string | null {
  if (index === 0) {
    return format(parseISO(messages[0].dateEnvoi), 'd MMMM yyyy', { locale: fr });
  }
  const curr = format(parseISO(messages[index].dateEnvoi), 'yyyy-MM-dd');
  const prev = format(parseISO(messages[index - 1].dateEnvoi), 'yyyy-MM-dd');
  if (curr !== prev) {
    return format(parseISO(messages[index].dateEnvoi), 'd MMMM yyyy', { locale: fr });
  }
  return null;
}

export default function MessagerieScreen() {
  const { messages, parents, parentActif, ajouterMessage } = useStore();
  const [texte, setTexte] = useState('');
  const [exportEnCours, setExportEnCours] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const handleEnvoyer = () => {
    const contenu = texte.trim();
    if (!contenu) return;
    ajouterMessage({
      id: `m-${Date.now()}`,
      expediteurId: parentActif,
      contenu,
      dateEnvoi: new Date().toISOString(),
      statut: 'envoyé',
    });
    setTexte('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const handleExportJAF = async () => {
    setExportEnCours(true);
    try {
      const lignes = messages
        .map(
          (m) => `
          <tr style="background:${m.expediteurId === 'A' ? '#EBF5F0' : '#FAF0EB'}">
            <td style="font-weight:600;color:${m.expediteurId === 'A' ? '#2D6A4F' : '#B5927C'};white-space:nowrap">
              ${parents[m.expediteurId].nom}
            </td>
            <td>${m.contenu.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
            <td style="white-space:nowrap;color:#6B7F7A;font-size:11px">
              ${format(parseISO(m.dateEnvoi), "d MMM yyyy 'à' HH:mm", { locale: fr })}
            </td>
          </tr>`
        )
        .join('');

      const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
        <style>
          body{font-family:Arial,sans-serif;padding:24px;color:#1C1917;font-size:13px}
          h1{color:#1C2B25;margin-bottom:4px}
          .subtitle{color:#78716C;margin-bottom:24px;font-size:12px}
          table{width:100%;border-collapse:collapse}
          th{background:#1C2B25;color:#fff;padding:10px;text-align:left;font-size:11px}
          td{padding:10px;border-bottom:1px solid #E7E5E4;vertical-align:top}
          .footer{margin-top:32px;font-size:10px;color:#78716C;text-align:center;border-top:1px solid #E7E5E4;padding-top:12px}
        </style></head><body>
        <h1>Dualia — Journal des échanges coparentaux</h1>
        <p class="subtitle">
          Entre ${parents['A'].nom} et ${parents['B'].nom}<br/>
          Exporté le ${format(new Date(), "d MMMM yyyy 'à' HH:mm", { locale: fr })} — Document confidentiel JAF
        </p>
        <table>
          <thead><tr><th>Expéditeur</th><th>Message</th><th>Date &amp; heure</th></tr></thead>
          <tbody>${lignes}</tbody>
        </table>
        <p class="footer">Document certifié Dualia<br/>
        Destiné exclusivement au Juge aux Affaires Familiales — Ne pas diffuser</p>
        </body></html>`;

      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Export JAF — Messagerie Dualia',
        });
      }
    } catch {
      Alert.alert('Erreur export', 'La génération du PDF a échoué. Réessayez.');
    } finally {
      setExportEnCours(false);
    }
  };

  const renderItem = ({ item, index }: { item: Message; index: number }) => {
    const estMoi = item.expediteurId === parentActif;
    const separateur = getSeparateur(messages, index);
    const couleurBulle = parents[item.expediteurId].couleur;
    const texteClairSurBulle = item.expediteurId === 'A'; // vert foncé → texte blanc

    return (
      <>
        {separateur !== null && (
          <View style={styles.separateur}>
            <View style={styles.separateurLigne} />
            <View style={styles.separateurPill}>
              <Text style={styles.separateurTxt}>{separateur}</Text>
            </View>
            <View style={styles.separateurLigne} />
          </View>
        )}
        <View style={[styles.bulleWrap, estMoi ? styles.bulleDroite : styles.bulleGauche]}>
          {!estMoi && (
            <Text style={styles.nomExp}>
              {parents[item.expediteurId].nom.split(' ')[0]}
            </Text>
          )}
          <View
            style={[
              styles.bulle,
              { backgroundColor: couleurBulle },
              estMoi ? styles.bulleMe : styles.bulleThem,
            ]}
          >
            <Text
              style={[
                styles.bulleTxt,
                texteClairSurBulle ? styles.bulleTxtClair : styles.bulleTxtSombre,
              ]}
            >
              {item.contenu}
            </Text>
          </View>
          <View style={[styles.heureCont, estMoi ? styles.heureContDroite : styles.heureContGauche]}>
            <Text style={styles.heure}>{formaterHeure(item.dateEnvoi)}</Text>
            {estMoi && (
              <Ionicons
                name={item.statut === 'lu' ? 'checkmark-done' : 'checkmark'}
                size={12}
                color={COLORS.ardoise}
              />
            )}
          </View>
        </View>
      </>
    );
  };

  return (
    <SafeAreaView style={styles.conteneur} edges={['bottom']}>
      {/* Bandeau sécurité */}
      <View style={styles.bandeauSecurite}>
        <Ionicons name="shield-checkmark" size={13} color={COLORS.orClair} />
        <Text style={styles.bandeauSecuriteTxt}>
          Messagerie sécurisée — Échanges certifiés Dualia
        </Text>
      </View>

      {/* Barre actions */}
      <View style={styles.barreActions}>
        <View style={styles.participantsRow}>
          <View style={[styles.avatarDot, { backgroundColor: COLORS.vert }]} />
          <View style={[styles.avatarDot, { backgroundColor: COLORS.terracotta, marginLeft: -4 }]} />
          <Text style={styles.participantsTxt}>
            {parents['A'].nom.split(' ')[0]} & {parents['B'].nom.split(' ')[0]}
          </Text>
        </View>
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

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.liste}
          showsVerticalScrollIndicator={false}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
        />

        {/* Saisie */}
        <View style={styles.saisieConteneur}>
          <TextInput
            style={styles.saisie}
            value={texte}
            onChangeText={setTexte}
            placeholder="Écrire un message…"
            placeholderTextColor={COLORS.ardoise}
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[styles.btnEnvoyer, !texte.trim() && styles.btnEnvoyerOff]}
            onPress={handleEnvoyer}
            disabled={!texte.trim()}
            accessibilityLabel="Envoyer"
          >
            <Ionicons name="send" size={18} color={COLORS.blanc} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: COLORS.ivoireFonce },
  flex: { flex: 1 },

  bandeauSecurite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.vertProfond,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
  },
  bandeauSecuriteTxt: {
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
    backgroundColor: COLORS.ivoire,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.bordure,
  },
  participantsRow: { flexDirection: 'row', alignItems: 'center' },
  avatarDot: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.full,
    borderWidth: 2,
    borderColor: COLORS.ivoire,
  },
  participantsTxt: {
    fontSize: TYPOGRAPHY.sm,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.texte,
    marginLeft: SPACING.sm,
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

  liste: { padding: SPACING.md, paddingBottom: SPACING.lg },

  separateur: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginVertical: SPACING.lg,
  },
  separateurLigne: { flex: 1, height: 1, backgroundColor: COLORS.bordure },
  separateurPill: {
    backgroundColor: COLORS.ivoireFonce,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.bordure,
  },
  separateurTxt: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.ardoise,
    textTransform: 'capitalize',
  },

  bulleWrap: { marginBottom: SPACING.xs },
  bulleDroite: { alignItems: 'flex-end' },
  bulleGauche: { alignItems: 'flex-start' },
  nomExp: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.ardoise,
    marginBottom: 4,
    marginLeft: SPACING.sm,
    fontWeight: TYPOGRAPHY.medium,
  },
  bulle: {
    maxWidth: '78%',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  bulleMe: {
    borderBottomRightRadius: 4,
  },
  bulleThem: {
    borderBottomLeftRadius: 4,
  },
  bulleTxt: { fontSize: TYPOGRAPHY.md, lineHeight: 22 },
  bulleTxtClair: { color: COLORS.blanc },
  bulleTxtSombre: { color: COLORS.texte },

  heureCont: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 3,
  },
  heureContGauche: { marginLeft: SPACING.sm },
  heureContDroite: { marginRight: SPACING.sm },
  heure: { fontSize: 10, color: COLORS.ardoise },

  saisieConteneur: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: COLORS.ivoire,
    borderTopWidth: 1,
    borderTopColor: COLORS.bordure,
  },
  saisie: {
    flex: 1,
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.bordure,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: TYPOGRAPHY.md,
    color: COLORS.texte,
    maxHeight: 120,
  },
  btnEnvoyer: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.vert,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.vert,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  btnEnvoyerOff: {
    backgroundColor: COLORS.ardoise,
    shadowOpacity: 0,
    elevation: 0,
  },
});
