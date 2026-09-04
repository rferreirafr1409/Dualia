// app/(tabs)/enfants.tsx

import { useState } from 'react';
import { useRouter } from 'expo-router';
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
  Alert,
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { differenceInYears, parseISO } from 'date-fns';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../../store/useStore';
import { Enfant, ContactUrgence } from '../../types';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../constants/theme';
import { TRADUCTIONS } from '../../constants/i18n';
import DatePickerField from '../../components/DatePickerField';

let ImagePicker: typeof import('expo-image-picker') | null = null;
try {
  ImagePicker = require('expo-image-picker');
} catch {
  ImagePicker = null;
}

const ACCENT = '#B5927C';
const GROUPES_SANGUINS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

const enfantVide = () => ({
  prenom: '',
  dateNaissance: null as Date | null,
  ecole: '',
  medecinTraitant: '',
  medecinTelephone: '',
  allergies: '',
  groupeSanguin: '',
  mutuelle: '',
  photoUri: null as string | null,
  photoUrl: undefined as string | undefined,
});

export default function EnfantsScreen() {
  const router = useRouter();
  const enfants = useStore((s) => s.enfants);
  const ajouterEnfant = useStore((s) => s.ajouterEnfant);
  const modifierEnfant = useStore((s) => s.modifierEnfant);
  const supprimerEnfant = useStore((s) => s.supprimerEnfant);
  const ajouterContactUrgence = useStore((s) => s.ajouterContactUrgence);
  const supprimerContactUrgence = useStore((s) => s.supprimerContactUrgence);
  const langue = useStore((s) => s.langue);
   const t = TRADUCTIONS[langue].enfants;
  const tHistoire = TRADUCTIONS[langue].histoireEnfant;

  // ---------- Modal enfant (création / édition) ----------
  const [modalEnfantVisible, setModalEnfantVisible] = useState(false);
  const [enfantEnEdition, setEnfantEnEdition] = useState<string | null>(null);
  const [form, setForm] = useState(enfantVide());

  const ouvrirAjoutEnfant = () => {
    setEnfantEnEdition(null);
    setForm(enfantVide());
    setModalEnfantVisible(true);
  };

  const ouvrirEditionEnfant = (e: Enfant) => {
    setEnfantEnEdition(e.id);
    setForm({
      prenom: e.prenom,
      dateNaissance: e.dateNaissance ? parseISO(e.dateNaissance) : null,
      ecole: e.ecole ?? '',
      medecinTraitant: e.medecinTraitant ?? '',
      medecinTelephone: e.medecinTelephone ?? '',
      allergies: e.allergies ?? '',
      groupeSanguin: e.groupeSanguin ?? '',
      mutuelle: e.mutuelle ?? '',
      photoUri: null,
      photoUrl: e.photoUrl,
    });
    setModalEnfantVisible(true);
  };

  const choisirPhotoEnfant = async () => {
    if (!ImagePicker) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const resultat = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (!resultat.canceled && resultat.assets[0]) {
      setForm((f) => ({ ...f, photoUri: resultat.assets[0].uri }));
    }
  };

  const [envoiEnfant, setEnvoiEnfant] = useState(false);

  const soumettreEnfant = async () => {
    if (!form.prenom.trim()) return;
    setEnvoiEnfant(true);
    try {
      if (enfantEnEdition) {
        await modifierEnfant(
          enfantEnEdition,
          {
            prenom: form.prenom.trim(),
            dateNaissance: form.dateNaissance ? form.dateNaissance.toISOString() : undefined,
            ecole: form.ecole.trim() || undefined,
            medecinTraitant: form.medecinTraitant.trim() || undefined,
            medecinTelephone: form.medecinTelephone.trim() || undefined,
            allergies: form.allergies.trim() || undefined,
            groupeSanguin: form.groupeSanguin.trim() || undefined,
            mutuelle: form.mutuelle.trim() || undefined,
          },
          form.photoUri ?? undefined
        );
      } else {
        const nouvel: Enfant = {
          id: `enfant-${Date.now()}`,
          prenom: form.prenom.trim(),
          dateNaissance: form.dateNaissance ? form.dateNaissance.toISOString() : undefined,
          ecole: form.ecole.trim() || undefined,
          medecinTraitant: form.medecinTraitant.trim() || undefined,
          medecinTelephone: form.medecinTelephone.trim() || undefined,
          allergies: form.allergies.trim() || undefined,
          groupeSanguin: form.groupeSanguin.trim() || undefined,
          mutuelle: form.mutuelle.trim() || undefined,
          contactsUrgence: [],
        };
        await ajouterEnfant(nouvel, form.photoUri ?? undefined);
      }
      setModalEnfantVisible(false);
    } finally {
      setEnvoiEnfant(false);
    }
  };

  const demanderSuppressionEnfant = (e: Enfant) => {
    Alert.alert(t.supprimer, t.confirmerSuppressionEnfant, [
      { text: t.annuler, style: 'cancel' },
      { text: t.supprimer, style: 'destructive', onPress: () => supprimerEnfant(e.id) },
    ]);
  };

  // ---------- Modal contact d'urgence ----------
  const [modalContactVisible, setModalContactVisible] = useState(false);
  const [enfantPourContact, setEnfantPourContact] = useState<string | null>(null);
  const [contactNom, setContactNom] = useState('');
  const [contactRelation, setContactRelation] = useState('');
  const [contactTelephone, setContactTelephone] = useState('');

  const ouvrirAjoutContact = (enfantId: string) => {
    setEnfantPourContact(enfantId);
    setContactNom('');
    setContactRelation('');
    setContactTelephone('');
    setModalContactVisible(true);
  };

  const soumettreContact = () => {
    if (!contactNom.trim() || !contactTelephone.trim() || !enfantPourContact) return;
    const enfant = enfants.find((e) => e.id === enfantPourContact);
    const nouveauContact: ContactUrgence = {
      id: `contact-${Date.now()}`,
      enfantId: enfantPourContact,
      nom: contactNom.trim(),
      relation: contactRelation.trim() || undefined,
      telephone: contactTelephone.trim(),
      priorite: enfant ? enfant.contactsUrgence.length : 0,
    };
    ajouterContactUrgence(nouveauContact);
    setModalContactVisible(false);
  };

  const demanderSuppressionContact = (c: ContactUrgence) => {
    Alert.alert(t.supprimer, t.confirmerSuppressionContact, [
      { text: t.annuler, style: 'cancel' },
      { text: t.supprimer, style: 'destructive', onPress: () => supprimerContactUrgence(c.id) },
    ]);
  };

  const appeler = (telephone: string) => {
    Linking.openURL(`tel:${telephone.replace(/\s+/g, '')}`).catch(() => {});
  };

  const age = (dateNaissance?: string) => {
    if (!dateNaissance) return null;
    try {
      return differenceInYears(new Date(), parseISO(dateNaissance));
    } catch {
      return null;
    }
  };

  return (
    <SafeAreaView style={styles.conteneur} edges={['top', 'bottom']}>
      <LinearGradient colors={['#8A6E5C', ACCENT]} style={styles.header}>
        <View>
          <Text style={styles.headerTitre}>{t.titre}</Text>
          <Text style={styles.headerSous}>{t.sousTitre}</Text>
        </View>
        <View style={styles.compteWrap}>
          <Text style={styles.compteTxt}>{enfants.length}</Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {enfants.length === 0 && (
          <View style={styles.vide}>
            <Text style={styles.videEmoji}>🧒</Text>
            <Text style={styles.videTxt}>{t.aucunEnfant}</Text>
          </View>
        )}

        {enfants.map((e) => {
          const ansEnfant = age(e.dateNaissance);
          return (
            <View key={e.id} style={styles.carte}>
              <View style={styles.carteHeader}>
                <View style={styles.avatar}>
                  {e.photoUrl ? (
                    <Image source={{ uri: e.photoUrl }} style={styles.avatarPhoto} />
                  ) : (
                    <Text style={styles.avatarTxt}>{e.prenom.charAt(0).toUpperCase()}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.prenom}>{e.prenom}</Text>
                  {ansEnfant !== null && (
                    <Text style={styles.age}>{ansEnfant} {langue === 'pt' ? 'anos' : 'ans'}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => ouvrirEditionEnfant(e)} style={styles.iconBtn}>
                  <Ionicons name="pencil-outline" size={18} color={COLORS.ardoise} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => demanderSuppressionEnfant(e)} style={styles.iconBtn}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.erreur} />
                </TouchableOpacity>
              </View>

              <View style={styles.infosGrid}>
                {e.ecole ? (
                  <View style={styles.infoLigne}>
                    <Ionicons name="school-outline" size={16} color={COLORS.ardoise} />
                    <Text style={styles.infoTxt}>{e.ecole}</Text>
                  </View>
                ) : null}
                {e.medecinTraitant ? (
                  <View style={styles.infoLigne}>
                    <Ionicons name="medkit-outline" size={16} color={COLORS.ardoise} />
                    <Text style={styles.infoTxt}>
                      {e.medecinTraitant}
                      {e.medecinTelephone ? ` · ${e.medecinTelephone}` : ''}
                    </Text>
                  </View>
                ) : null}
                {e.allergies ? (
                  <View style={styles.infoLigne}>
                    <Ionicons name="alert-circle-outline" size={16} color={COLORS.erreur} />
                    <Text style={[styles.infoTxt, { color: COLORS.erreur }]}>{e.allergies}</Text>
                  </View>
                ) : null}
                {e.groupeSanguin ? (
                  <View style={styles.infoLigne}>
                    <Ionicons name="water-outline" size={16} color={COLORS.ardoise} />
                    <Text style={styles.infoTxt}>{e.groupeSanguin}</Text>
                  </View>
                ) : null}
                {e.mutuelle ? (
                  <View style={styles.infoLigne}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.ardoise} />
                    <Text style={styles.infoTxt}>{e.mutuelle}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.separateur} />

              <View style={styles.contactsHeader}>
                <Text style={styles.contactsTitre}>{t.contactsUrgence}</Text>
                <TouchableOpacity onPress={() => ouvrirAjoutContact(e.id)}>
                  <Ionicons name="add-circle-outline" size={20} color={COLORS.terracotta} />
                </TouchableOpacity>
              </View>

              {e.contactsUrgence.length === 0 ? (
                <Text style={styles.aucunContact}>{t.aucunContact}</Text>
              ) : (
                e.contactsUrgence.map((c) => (
                  <View key={c.id} style={styles.contactLigne}>
                    <TouchableOpacity
                      style={styles.contactAppel}
                      onPress={() => appeler(c.telephone)}
                    >
                      <Ionicons name="call-outline" size={16} color={COLORS.succes} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.contactNom}>
                        {c.nom}{c.relation ? ` · ${c.relation}` : ''}
                      </Text>
                      <Text style={styles.contactTel}>{c.telephone}</Text>
                    </View>
                    <TouchableOpacity onPress={() => demanderSuppressionContact(c)}>
                      <Ionicons name="close-outline" size={18} color={COLORS.ardoise} />
                    </TouchableOpacity>
                  </View>
                ))
              )}

              <TouchableOpacity
                style={styles.histoireBtn}
                onPress={() => router.push({ pathname: '/enfant-histoire', params: { prenom: e.prenom } } as any)}
              >
                <Ionicons name="book-outline" size={15} color={COLORS.vert} />
                <Text style={styles.histoireBtnTxt}>{tHistoire.voirHistoire}</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={ouvrirAjoutEnfant} activeOpacity={0.85}>
        <LinearGradient colors={['#8A6E5C', ACCENT]} style={styles.fabGradient}>
          <Ionicons name="add" size={22} color={COLORS.blanc} />
          <Text style={styles.fabTxt}>{t.ajouterEnfant}</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Modal enfant */}
      <Modal
        visible={modalEnfantVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalEnfantVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: SPACING.xxxl }}>
            <View style={styles.modalPoignee} />
            <Text style={styles.modalTitre}>{t.modalTitreAjout}</Text>

            <TouchableOpacity style={styles.photoBtn} onPress={choisirPhotoEnfant}>
              {form.photoUri || form.photoUrl ? (
                <Image source={{ uri: form.photoUri ?? form.photoUrl }} style={styles.photoApercu} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera-outline" size={22} color={COLORS.ardoise} />
                </View>
              )}
              <Text style={styles.photoBtnTxt}>{t.photo}</Text>
            </TouchableOpacity>

            <Text style={styles.label}>{t.prenom}</Text>
            <TextInput
              style={styles.input}
              value={form.prenom}
              onChangeText={(v) => setForm((f) => ({ ...f, prenom: v }))}
              placeholder={t.prenomPlaceholder}
              placeholderTextColor={COLORS.ardoise}
            />

            <DatePickerField
              label={t.dateNaissance}
              value={form.dateNaissance}
              onChange={(d) => setForm((f) => ({ ...f, dateNaissance: d }))}
            />
            <View style={{ height: SPACING.lg }} />

            <Text style={styles.label}>{t.ecole}</Text>
            <TextInput
              style={styles.input}
              value={form.ecole}
              onChangeText={(v) => setForm((f) => ({ ...f, ecole: v }))}
              placeholder={t.ecolePlaceholder}
              placeholderTextColor={COLORS.ardoise}
            />

            <Text style={styles.label}>{t.medecinTraitant}</Text>
            <TextInput
              style={styles.input}
              value={form.medecinTraitant}
              onChangeText={(v) => setForm((f) => ({ ...f, medecinTraitant: v }))}
              placeholder={t.medecinTraitantPlaceholder}
              placeholderTextColor={COLORS.ardoise}
            />

            <Text style={styles.label}>{t.medecinTelephone}</Text>
            <TextInput
              style={styles.input}
              value={form.medecinTelephone}
              onChangeText={(v) => setForm((f) => ({ ...f, medecinTelephone: v }))}
              placeholder={t.telephonePlaceholder}
              placeholderTextColor={COLORS.ardoise}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>{t.allergies}</Text>
            <TextInput
              style={styles.input}
              value={form.allergies}
              onChangeText={(v) => setForm((f) => ({ ...f, allergies: v }))}
              placeholder={t.allergiesPlaceholder}
              placeholderTextColor={COLORS.ardoise}
            />

            <Text style={styles.label}>{t.groupeSanguin}</Text>
            <View style={styles.groupesLigne}>
              {GROUPES_SANGUINS.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.groupeChoix, form.groupeSanguin === g && styles.groupeChoixActif]}
                  onPress={() => setForm((f) => ({ ...f, groupeSanguin: f.groupeSanguin === g ? '' : g }))}
                >
                  <Text style={[styles.groupeChoixTxt, form.groupeSanguin === g && styles.groupeChoixTxtActif]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>{t.mutuelle}</Text>
            <TextInput
              style={styles.input}
              value={form.mutuelle}
              onChangeText={(v) => setForm((f) => ({ ...f, mutuelle: v }))}
              placeholder={t.mutuellePlaceholder}
              placeholderTextColor={COLORS.ardoise}
            />

            <View style={styles.actions}>
              <TouchableOpacity style={styles.btnAnnuler} onPress={() => setModalEnfantVisible(false)}>
                <Text style={styles.btnAnnulerTxt}>{t.annuler}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnValider, (!form.prenom.trim() || envoiEnfant) && styles.btnDisabled]}
                onPress={soumettreEnfant}
                disabled={!form.prenom.trim() || envoiEnfant}
              >
                <Text style={styles.btnValiderTxt}>
                  {enfantEnEdition ? t.enregistrer : t.ajouter}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal contact d'urgence */}
      <Modal
        visible={modalContactVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalContactVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modal}>
            <View style={styles.modalPoignee} />
            <Text style={styles.modalTitre}>{t.modalTitreContact}</Text>

            <Text style={styles.label}>{t.nomContact}</Text>
            <TextInput
              style={styles.input}
              value={contactNom}
              onChangeText={setContactNom}
              placeholder={t.nomContactPlaceholder}
              placeholderTextColor={COLORS.ardoise}
            />

            <Text style={styles.label}>{t.relation}</Text>
            <TextInput
              style={styles.input}
              value={contactRelation}
              onChangeText={setContactRelation}
              placeholder={t.relationPlaceholder}
              placeholderTextColor={COLORS.ardoise}
            />

            <Text style={styles.label}>{t.telephone}</Text>
            <TextInput
              style={styles.input}
              value={contactTelephone}
              onChangeText={setContactTelephone}
              placeholder={t.telephonePlaceholder}
              placeholderTextColor={COLORS.ardoise}
              keyboardType="phone-pad"
            />

            <View style={styles.actions}>
              <TouchableOpacity style={styles.btnAnnuler} onPress={() => setModalContactVisible(false)}>
                <Text style={styles.btnAnnulerTxt}>{t.annuler}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.btnValider,
                  (!contactNom.trim() || !contactTelephone.trim()) && styles.btnDisabled,
                ]}
                onPress={soumettreContact}
                disabled={!contactNom.trim() || !contactTelephone.trim()}
              >
                <Text style={styles.btnValiderTxt}>{t.ajouter}</Text>
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
  headerTitre: { fontSize: TYPOGRAPHY.xl, fontWeight: TYPOGRAPHY.bold, color: COLORS.blanc },
  headerSous: { fontSize: TYPOGRAPHY.sm, color: 'rgba(255,255,255,0.7)', marginTop: SPACING.xs },
  compteWrap: { alignItems: 'center' },
  compteTxt: { fontSize: TYPOGRAPHY.xxl, fontWeight: TYPOGRAPHY.bold, color: COLORS.blanc },

  scroll: { flex: 1 },
  scrollContent: { padding: SPACING.lg },

  vide: { alignItems: 'center', paddingVertical: SPACING.xxxl },
  videEmoji: { fontSize: 40, marginBottom: SPACING.md },
  videTxt: { fontSize: TYPOGRAPHY.md, color: COLORS.ardoise },

  carte: {
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  carteHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: '#F7EEE9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarPhoto: { width: '100%', height: '100%' },
  avatarTxt: { fontSize: TYPOGRAPHY.md, fontWeight: TYPOGRAPHY.bold, color: COLORS.terracotta },
  prenom: { fontSize: TYPOGRAPHY.md, fontWeight: TYPOGRAPHY.semibold, color: COLORS.texte },
  age: { fontSize: TYPOGRAPHY.xs, color: COLORS.ardoise },
  iconBtn: { padding: SPACING.xs },

  infosGrid: { gap: SPACING.sm },
  infoLigne: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  infoTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.texte, flex: 1 },

  separateur: { height: 1, backgroundColor: COLORS.bordure, marginVertical: SPACING.md },

  contactsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  contactsTitre: { fontSize: TYPOGRAPHY.xs, fontWeight: TYPOGRAPHY.semibold, color: COLORS.ardoise, textTransform: 'uppercase', letterSpacing: 1 },
  aucunContact: { fontSize: TYPOGRAPHY.sm, color: COLORS.ardoise, fontStyle: 'italic' },
  contactLigne: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xs },
  contactAppel: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.full,
    backgroundColor: '#E6F4EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactNom: { fontSize: TYPOGRAPHY.sm, fontWeight: TYPOGRAPHY.medium, color: COLORS.texte },
  contactTel: { fontSize: TYPOGRAPHY.xs, color: COLORS.ardoise },

  histoireBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.bordure,
  },
  histoireBtnTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: TYPOGRAPHY.semibold, color: COLORS.vert },

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
  fabGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm, paddingVertical: SPACING.lg },
  fabTxt: { fontSize: TYPOGRAPHY.md, fontWeight: TYPOGRAPHY.semibold, color: COLORS.blanc },

  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modal: {
    backgroundColor: COLORS.blanc,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl,
    maxHeight: '85%',
  },
  modalPoignee: { width: 36, height: 4, backgroundColor: COLORS.bordure, borderRadius: RADIUS.full, alignSelf: 'center', marginBottom: SPACING.xl },
  modalTitre: { fontSize: TYPOGRAPHY.xl, fontWeight: TYPOGRAPHY.bold, color: COLORS.texte, marginBottom: SPACING.lg },
  label: { fontSize: TYPOGRAPHY.xs, fontWeight: TYPOGRAPHY.semibold, color: COLORS.ardoise, letterSpacing: 1, marginBottom: SPACING.sm, textTransform: 'uppercase' },
  input: { backgroundColor: COLORS.ivoireFonce, borderRadius: RADIUS.md, padding: SPACING.md, fontSize: TYPOGRAPHY.sm, color: COLORS.texte, marginBottom: SPACING.lg },

  photoBtn: { alignItems: 'center', marginBottom: SPACING.lg },
  photoApercu: { width: 76, height: 76, borderRadius: 38, backgroundColor: COLORS.ivoireFonce },
  photoPlaceholder: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: COLORS.ivoireFonce,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.bordure, borderStyle: 'dashed',
  },
  photoBtnTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.ardoise, marginTop: SPACING.xs, fontWeight: TYPOGRAPHY.medium },

  groupesLigne: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  groupeChoix: {
    width: '22%', paddingVertical: SPACING.sm, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.bordure, alignItems: 'center', backgroundColor: COLORS.ivoireFonce,
  },
  groupeChoixActif: { backgroundColor: COLORS.terracotta, borderColor: COLORS.terracotta },
  groupeChoixTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: TYPOGRAPHY.semibold, color: COLORS.texte },
  groupeChoixTxtActif: { color: COLORS.blanc },
  actions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xs },
  btnAnnuler: { flex: 1, padding: SPACING.lg, borderRadius: RADIUS.md, backgroundColor: COLORS.ivoireFonce, alignItems: 'center' },
  btnAnnulerTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.ardoise, fontWeight: TYPOGRAPHY.medium },
  btnValider: { flex: 2, padding: SPACING.lg, borderRadius: RADIUS.md, backgroundColor: ACCENT, alignItems: 'center' },
  btnDisabled: { opacity: 0.45 },
  btnValiderTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.blanc, fontWeight: TYPOGRAPHY.semibold },
});