// app/parents-foyers.tsx
//
// Deux listes simples : Parents (identité) et Foyers (contexte de vie des
// enfants). Clic sur une carte → fiche détaillée en modal. Pas de gros
// formulaire à l'arrivée — le premier écran reste immédiatement
// compréhensible.

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store/useStore';
import { COLORS, SPACING, FONTS, RADIUS } from '../constants/theme';
import type { Foyer, ParentRole } from '../types';

export default function ParentsFoyersScreen() {
  const router = useRouter();
  const parents = useStore((s) => s.parents);
  const foyers = useStore((s) => s.foyers);
  const enfants = useStore((s) => s.enfants);
  const configFoyers = useStore((s) => s.configFoyers);
  const modifierFoyer = useStore((s) => s.modifierFoyer);
  const associerEnfantAuFoyer = useStore((s) => s.associerEnfantAuFoyer);
  const retirerEnfantDuFoyer = useStore((s) => s.retirerEnfantDuFoyer);
  const definirResidencePrincipale = useStore((s) => s.definirResidencePrincipale);

  const [foyerOuvert, setFoyerOuvert] = useState<Foyer | null>(null);
  const [formNom, setFormNom] = useState('');
  const [formAdresse, setFormAdresse] = useState('');
  const [formVille, setFormVille] = useState('');
  const [formAdresseVisible, setFormAdresseVisible] = useState(false);
  const [sauvegarde, setSauvegarde] = useState(false);

  // Les foyers placeholder ("Second foyer") ne s'affichent que s'ils sont
  // déjà réclamés — sinon ils n'existent que côté technique, en attente
  // que le second parent rejoigne via le lien d'invitation.
  const foyersVisibles = foyers.filter((f) => !f.estPlaceholder);

  const ouvrirFoyer = (foyer: Foyer) => {
    setFoyerOuvert(foyer);
    setFormNom(foyer.nom);
    setFormAdresse(foyer.adresse ?? '');
    setFormVille(foyer.ville ?? '');
    setFormAdresseVisible(foyer.adresseVisible);
  };

  const enregistrerFoyer = async () => {
    if (!foyerOuvert) return;
    setSauvegarde(true);
    try {
      await modifierFoyer(foyerOuvert.id, {
        nom: formNom.trim() || foyerOuvert.nom,
        adresse: formAdresse.trim() || undefined,
        ville: formVille.trim() || undefined,
        adresseVisible: formAdresseVisible,
      });
      setFoyerOuvert(null);
    } finally {
      setSauvegarde(false);
    }
  };

  const toggleEnfantDansFoyer = (enfantId: string) => {
    if (!foyerOuvert) return;
    const dejaDedans = foyerOuvert.enfantIds.includes(enfantId);
    const residenceActuelle = foyerOuvert.enfantIdsResidencePrincipale ?? [];
    if (dejaDedans) {
      retirerEnfantDuFoyer(foyerOuvert.id, enfantId);
      setFoyerOuvert({
        ...foyerOuvert,
        enfantIds: foyerOuvert.enfantIds.filter((id) => id !== enfantId),
        enfantIdsResidencePrincipale: residenceActuelle.filter((id) => id !== enfantId),
      });
    } else {
      associerEnfantAuFoyer(foyerOuvert.id, enfantId);
      setFoyerOuvert({
        ...foyerOuvert,
        enfantIds: [...foyerOuvert.enfantIds, enfantId],
        enfantIdsResidencePrincipale: residenceActuelle,
      });
    }
  };

  const toggleResidencePrincipale = (enfantId: string, valeur: boolean) => {
    if (!foyerOuvert) return;
    definirResidencePrincipale(foyerOuvert.id, enfantId, valeur);
    const residenceActuelle = foyerOuvert.enfantIdsResidencePrincipale ?? [];
    setFoyerOuvert({
      ...foyerOuvert,
      enfantIdsResidencePrincipale: valeur
        ? [...residenceActuelle.filter((id) => id !== enfantId), enfantId]
        : residenceActuelle.filter((id) => id !== enfantId),
    });
  };

  const prenomsEnfants = (enfantIds: string[]) =>
    enfantIds
      .map((id) => enfants.find((e) => e.id === id)?.prenom)
      .filter(Boolean)
      .join(' · ');

  // Enfants réellement rattachés au foyer ouvert, pour la section résidence.
  const enfantsDuFoyerOuvert = foyerOuvert
    ? enfants.filter((e) => foyerOuvert.enfantIds.includes(e.id))
    : [];

  return (
    <SafeAreaView style={styles.conteneur} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.retourBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={COLORS.vertProfond} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitre}>Parents & foyers</Text>
          <Text style={styles.headerSous}>Qui compose votre famille, et où vivent vos enfants</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>PARENTS</Text>
        {(['A', 'B'] as ParentRole[]).map((role) => {
          const p = parents[role];
          if (!p) return null;
          return (
            <View key={role} style={styles.parentCard}>
              <View style={[styles.avatar, { backgroundColor: p.couleur }]}>
                <Text style={styles.avatarTxt}>{p.nom.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.parentNom}>{p.nom}</Text>
                <Text style={styles.parentStatut}>
                  {p.uuid ? 'Compte Dualia actif' : 'Pas encore invité(e)'}
                </Text>
              </View>
            </View>
          );
        })}

        <Text style={styles.sectionLabel}>FOYERS</Text>
        {foyersVisibles.length === 0 ? (
          <View style={styles.videCard}>
            <Text style={styles.videTxt}>Aucun foyer configuré pour le moment.</Text>
            <Pressable style={styles.videCta} onPress={() => router.push('/configurer-foyer' as any)}>
              <Text style={styles.videCtaTxt}>Configurer mes foyers</Text>
            </Pressable>
          </View>
        ) : (
          foyersVisibles.map((foyer) => (
            <Pressable key={foyer.id} style={styles.foyerCard} onPress={() => ouvrirFoyer(foyer)}>
              <View style={[styles.foyerPuce, { backgroundColor: foyer.couleur || COLORS.vert }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.foyerNom}>{foyer.nom}</Text>
                {foyer.ville ? <Text style={styles.foyerVille}>{foyer.ville}</Text> : null}
                {foyer.enfantIds.length > 0 ? (
                  <Text style={styles.foyerEnfants}>{prenomsEnfants(foyer.enfantIds)}</Text>
                ) : null}
                {(foyer.enfantIdsResidencePrincipale ?? []).length > 0 ? (
                  <Text style={styles.foyerResidence}>
                    Résidence principale : {prenomsEnfants(foyer.enfantIdsResidencePrincipale ?? [])}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.ardoise} />
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal visible={!!foyerOuvert} animationType="slide" transparent onRequestClose={() => setFoyerOuvert(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitre}>Modifier le foyer</Text>

              <Text style={styles.fieldLabel}>Nom du foyer</Text>
              <TextInput
                style={styles.input}
                value={formNom}
                onChangeText={setFormNom}
                placeholder="Ex. Chez Ricardo"
                placeholderTextColor={COLORS.ardoise}
              />

              <Text style={styles.fieldLabel}>Adresse (optionnel)</Text>
              <TextInput
                style={styles.input}
                value={formAdresse}
                onChangeText={setFormAdresse}
                placeholder="12 rue de..."
                placeholderTextColor={COLORS.ardoise}
              />

              <Text style={styles.fieldLabel}>Ville (optionnel)</Text>
              <TextInput
                style={styles.input}
                value={formVille}
                onChangeText={setFormVille}
                placeholder="Paris"
                placeholderTextColor={COLORS.ardoise}
              />

              <View style={styles.switchLigne}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Rendre l'adresse visible</Text>
                  <Text style={styles.switchDesc}>
                    Par défaut, l'adresse n'est visible que par vous. Active pour la partager avec les
                    autres membres de la famille ayant accès à Dualia.
                  </Text>
                </View>
                <Switch value={formAdresseVisible} onValueChange={setFormAdresseVisible} />
              </View>

              {enfants.length > 0 ? (
                <>
                  <Text style={styles.fieldLabel}>Enfants de ce foyer</Text>
                  <View style={styles.pillRow}>
                    {enfants.map((e) => {
                      const dedans = foyerOuvert?.enfantIds.includes(e.id);
                      return (
                        <Pressable
                          key={e.id}
                          onPress={() => toggleEnfantDansFoyer(e.id)}
                          style={[styles.pill, dedans && styles.pillActive]}
                        >
                          <Text style={[styles.pillText, dedans && styles.pillTextActive]}>{e.prenom}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {/* Résidence principale : la question ne se pose qu'en deux foyers.
                  En foyer commun il n'y a qu'un domicile, rien à trancher. */}
              {configFoyers === 'deux_foyers' && enfantsDuFoyerOuvert.length > 0 ? (
                <>
                  <Text style={styles.fieldLabel}>Résidence principale</Text>
                  <Text style={styles.residenceAide}>
                    En garde alternée, ne cochez rien : l'enfant vit dans les deux foyers à parts
                    égales. En garde exclusive, cochez le foyer où l'enfant a sa résidence.
                  </Text>
                  {enfantsDuFoyerOuvert.map((e) => (
                    <View key={e.id} style={styles.residenceLigne}>
                      <Text style={styles.residenceNom}>{e.prenom}</Text>
                      <Switch
                        value={(foyerOuvert?.enfantIdsResidencePrincipale ?? []).includes(e.id)}
                        onValueChange={(v) => toggleResidencePrincipale(e.id, v)}
                      />
                    </View>
                  ))}
                </>
              ) : null}

              <View style={styles.modalActions}>
                <Pressable style={styles.btnAnnuler} onPress={() => setFoyerOuvert(null)}>
                  <Text style={styles.btnAnnulerTxt}>Fermer</Text>
                </Pressable>
                <Pressable style={styles.btnValider} onPress={enregistrerFoyer} disabled={sauvegarde}>
                  <Text style={styles.btnValiderTxt}>{sauvegarde ? '...' : 'Enregistrer'}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: COLORS.ivoire },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.md,
  },
  retourBtn: { padding: SPACING.xs, marginTop: 2 },
  headerTitre: { fontFamily: FONTS.display, fontSize: 20, color: COLORS.vertProfond },
  headerSous: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, marginTop: 2 },

  content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl },
  sectionLabel: {
    fontFamily: FONTS.bodySemibold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase',
    color: COLORS.ardoise, marginTop: SPACING.lg, marginBottom: SPACING.sm,
  },
  videTxt: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, marginBottom: SPACING.sm },
  videCard: {
    backgroundColor: COLORS.blanc, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.bordure,
    borderStyle: 'dashed', padding: SPACING.xl, alignItems: 'center',
  },
  videCta: { marginTop: SPACING.sm, backgroundColor: COLORS.vert, borderRadius: RADIUS.md, paddingHorizontal: SPACING.lg, paddingVertical: 10 },
  videCtaTxt: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.blanc },

  parentCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.blanc, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.bordure,
  },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontFamily: FONTS.bodyBold, fontSize: 16, color: COLORS.blanc },
  parentNom: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.texte },
  parentStatut: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.ardoise, marginTop: 2 },

  foyerCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.blanc, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.bordure,
  },
  foyerPuce: { width: 12, height: 12, borderRadius: 6 },
  foyerNom: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.texte },
  foyerVille: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.ardoise, marginTop: 2 },
  foyerEnfants: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.vert, marginTop: 2 },
  foyerResidence: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(28,43,37,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.ivoire, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl, paddingBottom: SPACING.xxxl, maxHeight: '85%',
  },
  modalTitre: { fontFamily: FONTS.display, fontSize: 19, color: COLORS.vertProfond },
  fieldLabel: { fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.ardoise, marginTop: SPACING.lg, marginBottom: 6 },
  input: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 10, fontFamily: FONTS.body, fontSize: 14, color: COLORS.vertProfond,
  },
  switchLigne: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, marginTop: SPACING.lg },
  switchLabel: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.vertProfond },
  switchDesc: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, marginTop: 3, lineHeight: 16 },

  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full,
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure,
  },
  pillActive: { backgroundColor: COLORS.vertProfond, borderColor: COLORS.vertProfond },
  pillText: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.ardoise },
  pillTextActive: { color: COLORS.ivoire },

  residenceAide: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, lineHeight: 16, marginBottom: SPACING.sm },
  residenceLigne: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: SPACING.sm,
  },
  residenceNom: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.vertProfond },

  modalActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xl },
  btnAnnuler: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.bordure },
  btnAnnulerTxt: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.ardoise },
  btnValider: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.vert },
  btnValiderTxt: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.blanc },
});
