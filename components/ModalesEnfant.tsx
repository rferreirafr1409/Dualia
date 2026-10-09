// components/ModalesEnfant.tsx
//
// Les deux formulaires qui touchent a un enfant : sa fiche, et ses contacts
// d'urgence.
//
// Ils vivaient dans app/(tabs)/enfants.tsx, un ecran qui portait TOUTES les
// ecritures — creer, modifier, supprimer un enfant, ajouter et retirer un
// contact — mais n'affichait qu'un tiers des informations. La fiche enfant,
// elle, montrait tout et ne permettait de rien changer : medecin traitant,
// allergies, groupe sanguin, mutuelle, documents de sante, etablissement,
// contacts appelables, journal, histoire, personnes autorisees — en lecture
// seule.
//
// Un ecran qui voit tout sans rien pouvoir changer, un autre qui change tout
// sans rien montrer. En les separant ici, les deux ecrans peuvent enfin
// partager exactement le meme formulaire : Famille pour creer un enfant, la
// fiche pour le modifier.

import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal,
  TextInput, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { parseISO } from 'date-fns';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store/useStore';
import { Enfant, ContactUrgence } from '../types';
import { jourLocal } from '../lib/dates';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../constants/theme';
import { TRADUCTIONS } from '../constants/i18n';
import DatePickerField from './DatePickerField';
import { lireConsentementSante, enregistrerConsentementSante } from '../lib/consentementSante';

let ImagePicker: typeof import('expo-image-picker') | null = null;
try {
  ImagePicker = require('expo-image-picker');
} catch {
  ImagePicker = null;
}

const ACCENT = '#B5927C';
const GROUPES_SANGUINS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

const formulaireVide = () => ({
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

function formulaireDepuis(e: Enfant) {
  return {
    prenom: e.prenom,
    dateNaissance: e.dateNaissance ? parseISO(e.dateNaissance) : null,
    ecole: e.ecole ?? '',
    medecinTraitant: e.medecinTraitant ?? '',
    medecinTelephone: e.medecinTelephone ?? '',
    allergies: e.allergies ?? '',
    groupeSanguin: e.groupeSanguin ?? '',
    mutuelle: e.mutuelle ?? '',
    photoUri: null as string | null,
    photoUrl: e.photoUrl,
  };
}

/**
 * Fiche enfant : creation ou modification.
 *
 * `enfant` absent = creation. `enfant` present = modification de celui-la.
 * Le formulaire se re-initialise a chaque ouverture, via la cle `visible` :
 * sans cela, rouvrir la modale apres une premiere saisie repartait avec les
 * valeurs precedentes.
 */
export function ModaleEnfant({
  visible,
  enfant,
  onFermer,
}: {
  visible: boolean;
  enfant?: Enfant;
  onFermer: () => void;
}) {
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].enfants;
  const ajouterEnfant = useStore((s) => s.ajouterEnfant);
  const modifierEnfant = useStore((s) => s.modifierEnfant);

  const [form, setForm] = useState(() => (enfant ? formulaireDepuis(enfant) : formulaireVide()));
  const [envoi, setEnvoi] = useState(false);
  const [ouvertPour, setOuvertPour] = useState<string | null>(null);
  // Consentement explicite aux donnees de sante (DUA-103) : demande une fois
  // par parent, a la premiere saisie d'un champ sante. `null` = pas encore lu.
  const [consentementDonne, setConsentementDonne] = useState<boolean | null>(null);
  const [consentementCoche, setConsentementCoche] = useState(false);
  useEffect(() => {
    if (!visible || consentementDonne !== null) return;
    let actif = true;
    lireConsentementSante().then((ok) => { if (actif) setConsentementDonne(ok); });
    return () => { actif = false; };
  }, [visible, consentementDonne]);

  const saisitDesDonneesSante =
    !!(form.medecinTraitant.trim() || form.medecinTelephone.trim() || form.allergies.trim() || form.groupeSanguin.trim() || form.mutuelle.trim());
  const consentementRequis = saisitDesDonneesSante && consentementDonne !== true;
  const consentementBloque = consentementRequis && !consentementCoche;

  // Re-initialisation a l'ouverture, sans useEffect : on compare l'identite
  // de ce qui est edite a celle du dernier remplissage.
  const cle = visible ? (enfant?.id ?? 'nouveau') : null;
  if (cle !== ouvertPour) {
    setOuvertPour(cle);
    if (visible) setForm(enfant ? formulaireDepuis(enfant) : formulaireVide());
  }

  const choisirPhoto = async () => {
    if (!ImagePicker) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const resultat = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (!resultat.canceled && resultat.assets[0]) {
      setForm((f) => ({ ...f, photoUri: resultat.assets[0].uri }));
    }
  };

  const soumettre = async () => {
    if (!form.prenom.trim() || consentementBloque) return;
    setEnvoi(true);
    try {
      if (consentementRequis) {
        await enregistrerConsentementSante();
        setConsentementDonne(true);
      }
      // A la MODIFICATION, un champ vide doit partir comme chaine vide et non
      // comme `undefined` : le store n'envoie a la base que les cles
      // presentes, donc `undefined` signifiait « ne touche pas » et le
      // contenu efface revenait au rechargement suivant. Il n'y avait aucun
      // moyen de retirer une allergie ou une mutuelle.
      const texte = {
        prenom: form.prenom.trim(),
        ecole: form.ecole.trim(),
        medecinTraitant: form.medecinTraitant.trim(),
        medecinTelephone: form.medecinTelephone.trim(),
        allergies: form.allergies.trim(),
        groupeSanguin: form.groupeSanguin.trim(),
        mutuelle: form.mutuelle.trim(),
      };
      const dateNaissance = form.dateNaissance ? jourLocal(form.dateNaissance) : undefined;

      if (enfant) {
        await modifierEnfant(enfant.id, { ...texte, dateNaissance }, form.photoUri ?? undefined);
      } else {
        // A la CREATION, les champs vides sont simplement omis.
        const nonVides = Object.fromEntries(
          Object.entries(texte).filter(([, valeur]) => valeur !== '')
        ) as typeof texte;
        await ajouterEnfant(
          {
            id: `enfant-${Date.now()}`,
            ...nonVides,
            prenom: texte.prenom,
            dateNaissance,
            contactsUrgence: [],
          } as Enfant,
          form.photoUri ?? undefined
        );
      }
      onFermer();
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onFermer}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: SPACING.xxxl }}>
          <View style={styles.modalPoignee} />
          <Text style={styles.modalTitre}>
            {enfant ? t.modalTitreEdition : t.modalTitreAjout}
          </Text>

          <TouchableOpacity style={styles.photoBtn} onPress={choisirPhoto}>
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
                onPress={() =>
                  setForm((f) => ({ ...f, groupeSanguin: f.groupeSanguin === g ? '' : g }))
                }
              >
                <Text
                  style={[
                    styles.groupeChoixTxt,
                    form.groupeSanguin === g && styles.groupeChoixTxtActif,
                  ]}
                >
                  {g}
                </Text>
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

          {consentementRequis ? (
            <View style={styles.consentement}>
              <Text style={styles.consentementTitre}>{t.consentementSanteTitre}</Text>
              <Text style={styles.consentementTexte}>{t.consentementSanteTexte}</Text>
              <TouchableOpacity style={styles.consentementLigne} onPress={() => setConsentementCoche((v) => !v)}>
                <Ionicons
                  name={consentementCoche ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={consentementCoche ? COLORS.vert : COLORS.ardoise}
                />
                <Text style={styles.consentementCase}>{t.consentementSanteCase}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnAnnuler} onPress={onFermer}>
              <Text style={styles.btnAnnulerTxt}>{t.annuler}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnValider, (!form.prenom.trim() || envoi || consentementBloque) && styles.btnDisabled]}
              onPress={soumettre}
              disabled={!form.prenom.trim() || envoi || consentementBloque}
            >
              <Text style={styles.btnValiderTxt}>{enfant ? t.enregistrer : t.ajouter}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Ajout d'un contact d'urgence pour un enfant donne. */
export function ModaleContactUrgence({
  visible,
  enfantId,
  onFermer,
}: {
  visible: boolean;
  enfantId: string | null;
  onFermer: () => void;
}) {
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].enfants;
  const enfants = useStore((s) => s.enfants);
  const ajouterContactUrgence = useStore((s) => s.ajouterContactUrgence);

  const [nom, setNom] = useState('');
  const [relation, setRelation] = useState('');
  const [telephone, setTelephone] = useState('');
  const [ouvertPour, setOuvertPour] = useState<string | null>(null);

  const cle = visible ? enfantId : null;
  if (cle !== ouvertPour) {
    setOuvertPour(cle);
    if (visible) {
      setNom('');
      setRelation('');
      setTelephone('');
    }
  }

  const soumettre = () => {
    if (!nom.trim() || !telephone.trim() || !enfantId) return;
    const enfant = enfants.find((e) => e.id === enfantId);
    const nouveau: ContactUrgence = {
      id: `contact-${Date.now()}`,
      enfantId,
      nom: nom.trim(),
      relation: relation.trim() || undefined,
      telephone: telephone.trim(),
      priorite: enfant ? enfant.contactsUrgence.length : 0,
    };
    ajouterContactUrgence(nouveau);
    onFermer();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onFermer}>
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
            value={nom}
            onChangeText={setNom}
            placeholder={t.nomContactPlaceholder}
            placeholderTextColor={COLORS.ardoise}
          />

          <Text style={styles.label}>{t.relation}</Text>
          <TextInput
            style={styles.input}
            value={relation}
            onChangeText={setRelation}
            placeholder={t.relationPlaceholder}
            placeholderTextColor={COLORS.ardoise}
          />

          <Text style={styles.label}>{t.telephone}</Text>
          <TextInput
            style={styles.input}
            value={telephone}
            onChangeText={setTelephone}
            placeholder={t.telephonePlaceholder}
            placeholderTextColor={COLORS.ardoise}
            keyboardType="phone-pad"
          />

          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnAnnuler} onPress={onFermer}>
              <Text style={styles.btnAnnulerTxt}>{t.annuler}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.btnValider,
                (!nom.trim() || !telephone.trim()) && styles.btnDisabled,
              ]}
              onPress={soumettre}
              disabled={!nom.trim() || !telephone.trim()}
            >
              <Text style={styles.btnValiderTxt}>{t.ajouter}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modal: {
    backgroundColor: COLORS.blanc,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl,
    maxHeight: '85%',
  },
  modalPoignee: {
    width: 36, height: 4, backgroundColor: COLORS.bordure, borderRadius: RADIUS.full,
    alignSelf: 'center', marginBottom: SPACING.xl,
  },
  modalTitre: {
    fontSize: TYPOGRAPHY.xl, fontWeight: TYPOGRAPHY.bold,
    color: COLORS.texte, marginBottom: SPACING.lg,
  },
  label: {
    fontSize: TYPOGRAPHY.xs, fontWeight: TYPOGRAPHY.semibold, color: COLORS.ardoise,
    letterSpacing: 1, marginBottom: SPACING.sm, textTransform: 'uppercase',
  },
  input: {
    backgroundColor: COLORS.ivoireFonce, borderRadius: RADIUS.md, padding: SPACING.md,
    fontSize: TYPOGRAPHY.sm, color: COLORS.texte, marginBottom: SPACING.lg,
  },
  photoBtn: { alignItems: 'center', marginBottom: SPACING.lg },
  photoApercu: { width: 76, height: 76, borderRadius: 38, backgroundColor: COLORS.ivoireFonce },
  photoPlaceholder: {
    width: 76, height: 76, borderRadius: 38, backgroundColor: COLORS.ivoireFonce,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.bordure, borderStyle: 'dashed',
  },
  photoBtnTxt: {
    fontSize: TYPOGRAPHY.xs, color: COLORS.ardoise,
    marginTop: SPACING.xs, fontWeight: TYPOGRAPHY.medium,
  },
  groupesLigne: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.lg },
  groupeChoix: {
    width: '22%', paddingVertical: SPACING.sm, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.bordure, alignItems: 'center',
    backgroundColor: COLORS.ivoireFonce,
  },
  groupeChoixActif: { backgroundColor: COLORS.terracotta, borderColor: COLORS.terracotta },
  groupeChoixTxt: { fontSize: TYPOGRAPHY.sm, fontWeight: TYPOGRAPHY.semibold, color: COLORS.texte },
  groupeChoixTxtActif: { color: COLORS.blanc },
  consentement: {
    backgroundColor: '#F4F1EA', borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md,
  },
  consentementTitre: { fontSize: TYPOGRAPHY.sm, fontWeight: TYPOGRAPHY.semibold, color: COLORS.vertProfond, marginBottom: 4 },
  consentementTexte: { fontSize: TYPOGRAPHY.xs, color: COLORS.ardoise, lineHeight: 17, marginBottom: SPACING.sm },
  consentementLigne: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  consentementCase: { flex: 1, fontSize: TYPOGRAPHY.xs, color: COLORS.vertProfond, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xs },
  btnAnnuler: {
    flex: 1, padding: SPACING.lg, borderRadius: RADIUS.md,
    backgroundColor: COLORS.ivoireFonce, alignItems: 'center',
  },
  btnAnnulerTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.ardoise, fontWeight: TYPOGRAPHY.medium },
  btnValider: {
    flex: 2, padding: SPACING.lg, borderRadius: RADIUS.md,
    backgroundColor: ACCENT, alignItems: 'center',
  },
  btnValiderTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.blanc, fontWeight: TYPOGRAPHY.semibold },
  btnDisabled: { opacity: 0.45 },
});
