// app/acces-tiers.tsx
//
// Gestion des accès tiers : grands-parents, nounous, école. Trois rôles
// prédéfinis en V1 (pas de permissions personnalisables) — le niveau
// d'accès réel (lecture calendrier, contacts du jour, partage ponctuel)
// est appliqué côté RLS Supabase par rôle, jamais côté client.
//
// Volontairement en lecture/consultation uniquement pour le tiers : aucune
// écriture n'est proposée à ce stade (voir hors-périmètre V1 du brief).

import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store/useStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import type { RoleTiers, Tiers } from '../types';

const ROLES: { valeur: RoleTiers; label: string; desc: string; icone: keyof typeof Ionicons.glyphMap }[] = [
  { valeur: 'grand_parent', label: 'Grand-parent', desc: 'Lecture du calendrier et des moments partagés', icone: 'people-outline' },
  { valeur: 'nounou', label: 'Nounou / baby-sitter', desc: 'Contacts et planning du jour uniquement', icone: 'person-outline' },
  { valeur: 'ecole_tiers', label: 'École / tiers', desc: 'Partage ponctuel d\u2019un document ou d\u2019une info', icone: 'school-outline' },
];

function alertCompat(titre: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${titre}\n\n${message}` : titre);
  } else {
    Alert.alert(titre, message);
  }
}

export default function AccesTiersScreen() {
  const router = useRouter();
  const tiers = useStore((s) => s.tiers);
  const parentActif = useStore((s) => s.parentActif);
  const inviterTiers = useStore((s) => s.inviterTiers);
  const revoquerTiers = useStore((s) => s.revoquerTiers);

  const [modalOuverte, setModalOuverte] = useState(false);
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [roleChoisi, setRoleChoisi] = useState<RoleTiers>('grand_parent');

  const tiersActifs = tiers.filter((t) => t.statut !== 'revoque');

  const envoyerInvitation = () => {
    if (!nom.trim() || !email.trim()) {
      alertCompat('Champs incomplets', 'Indique un nom et un email pour envoyer l\u2019invitation.');
      return;
    }
    const nouveauTiers: Tiers = {
      id: 'tiers-' + Date.now(),
      nom: nom.trim(),
      email: email.trim(),
      role: roleChoisi,
      statut: 'invite',
      invitePar: parentActif,
      creeLe: new Date().toISOString(),
    };
    inviterTiers(nouveauTiers);
    setNom('');
    setEmail('');
    setRoleChoisi('grand_parent');
    setModalOuverte(false);
  };

  const demanderRevocation = (t: Tiers) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Révoquer l'accès de ${t.nom} ?`)) revoquerTiers(t.id);
      return;
    }
    Alert.alert('Révoquer l\u2019accès', `Révoquer l'accès de ${t.nom} ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Révoquer', style: 'destructive', onPress: () => revoquerTiers(t.id) },
    ]);
  };

  const roleInfo = (role: RoleTiers) => ROLES.find((r) => r.valeur === role)!;

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={22} color={COLORS.vertProfond} />
        </Pressable>
        <Text style={styles.topbarTitre}>Accès partagés</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.contenu} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Invitez un grand-parent, une nounou ou un établissement scolaire avec un accès limité à ce
          qui les concerne — jamais aux messages ni aux dépenses entre parents.
        </Text>

        {tiersActifs.length === 0 ? (
          <View style={styles.videCard}>
            <Ionicons name="people-outline" size={28} color={COLORS.ardoise} />
            <Text style={styles.videTexte}>Aucun accès partagé pour le moment</Text>
          </View>
        ) : (
          tiersActifs.map((t) => {
            const info = roleInfo(t.role);
            return (
              <View key={t.id} style={styles.tiersCard}>
                <View style={styles.tiersIconWrap}>
                  <Ionicons name={info.icone} size={20} color={COLORS.terracotta} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tiersNom}>{t.nom}</Text>
                  <Text style={styles.tiersRole}>{info.label}</Text>
                  {t.statut === 'invite' ? (
                    <Text style={styles.tiersStatutInvite}>Invitation envoyée — en attente</Text>
                  ) : null}
                </View>
                <Pressable onPress={() => demanderRevocation(t)} hitSlop={10} style={styles.revoquerBtn}>
                  <Text style={styles.revoquerTexte}>Révoquer</Text>
                </Pressable>
              </View>
            );
          })
        )}

        <Pressable style={styles.ajouterBtn} onPress={() => setModalOuverte(true)}>
          <Ionicons name="add" size={18} color={COLORS.blanc} />
          <Text style={styles.ajouterTexte}>Inviter un accès</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={modalOuverte} animationType="slide" transparent onRequestClose={() => setModalOuverte(false)}>
        <View style={styles.modalFond}>
          <View style={styles.modalCarte}>
            <Text style={styles.modalTitre}>Inviter un accès</Text>

            <Text style={styles.label}>Rôle</Text>
            {ROLES.map((r) => (
              <Pressable
                key={r.valeur}
                style={[styles.roleOption, roleChoisi === r.valeur && styles.roleOptionActive]}
                onPress={() => setRoleChoisi(r.valeur)}
              >
                <Ionicons name={r.icone} size={18} color={roleChoisi === r.valeur ? COLORS.vert : COLORS.ardoise} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.roleLabel, roleChoisi === r.valeur && styles.roleLabelActive]}>{r.label}</Text>
                  <Text style={styles.roleDesc}>{r.desc}</Text>
                </View>
                {roleChoisi === r.valeur ? <Ionicons name="checkmark-circle" size={18} color={COLORS.vert} /> : null}
              </Pressable>
            ))}

            <Text style={styles.label}>Nom</Text>
            <TextInput
              style={styles.input}
              value={nom}
              onChangeText={setNom}
              placeholder="Ex. Mamie Colette"
              placeholderTextColor={COLORS.ardoise}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="exemple@email.com"
              placeholderTextColor={COLORS.ardoise}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <View style={styles.modalBtns}>
              <Pressable style={styles.modalBtnAnnuler} onPress={() => setModalOuverte(false)}>
                <Text style={styles.modalBtnAnnulerTexte}>Annuler</Text>
              </Pressable>
              <Pressable style={styles.modalBtnEnvoyer} onPress={envoyerInvitation}>
                <Text style={styles.modalBtnEnvoyerTexte}>Envoyer l'invitation</Text>
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
  contenu: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl },
  intro: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise, lineHeight: 19, marginBottom: SPACING.lg },

  videCard: {
    backgroundColor: COLORS.blanc, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.bordure,
    borderStyle: 'dashed', padding: SPACING.xl, alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg,
  },
  videTexte: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise },

  tiersCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  tiersIconWrap: {
    width: 40, height: 40, borderRadius: RADIUS.md, backgroundColor: '#F3E9E4',
    alignItems: 'center', justifyContent: 'center',
  },
  tiersNom: { fontFamily: FONTS.bodySemibold, fontSize: 14.5, color: COLORS.vertProfond },
  tiersRole: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.ardoise, marginTop: 1 },
  tiersStatutInvite: { fontFamily: FONTS.bodySemibold, fontSize: 11, color: COLORS.or, marginTop: 3 },
  revoquerBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  revoquerTexte: { fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.terracotta },

  ajouterBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.vert, borderRadius: RADIUS.md, paddingVertical: 14, marginTop: SPACING.md,
  },
  ajouterTexte: { fontFamily: FONTS.bodySemibold, fontSize: 14.5, color: COLORS.blanc },

  modalFond: { flex: 1, backgroundColor: 'rgba(28,43,37,0.45)', justifyContent: 'flex-end' },
  modalCarte: {
    backgroundColor: COLORS.ivoire, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg,
    padding: SPACING.xl, maxHeight: '85%',
  },
  modalTitre: { fontFamily: FONTS.display, fontSize: 19, color: COLORS.vertProfond, marginBottom: SPACING.md },
  label: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.vertProfond, marginBottom: 6, marginTop: SPACING.md },
  input: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 12, fontFamily: FONTS.body, fontSize: 15, color: COLORS.vertProfond,
  },
  roleOption: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, borderWidth: 1, borderColor: COLORS.bordure,
    borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, backgroundColor: COLORS.blanc,
  },
  roleOptionActive: { borderColor: COLORS.vert, backgroundColor: '#EEF4F1' },
  roleLabel: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.vertProfond },
  roleLabelActive: { color: COLORS.vert },
  roleDesc: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, marginTop: 1 },
  modalBtns: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xl },
  modalBtnAnnuler: { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.bordure },
  modalBtnAnnulerTexte: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.ardoise },
  modalBtnEnvoyer: { flex: 2, paddingVertical: 13, alignItems: 'center', borderRadius: RADIUS.md, backgroundColor: COLORS.vert },
  modalBtnEnvoyerTexte: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.blanc },
});
