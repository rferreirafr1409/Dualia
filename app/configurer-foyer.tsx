// app/configurer-foyer.tsx
//
// Affiché une fois, juste après la création du compte du premier parent
// (creer-espace.tsx). Détermine la configuration familiale — foyers, pas
// comptes Dualia. "Qui utilise Dualia aujourd'hui" est une question
// totalement différente et découplée : le lien d'invitation peut être
// envoyé maintenant ou plus tard, quel que soit le choix fait ici.

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../store/useStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import type { ConfigFoyers } from '../types';

function alertCompat(titre: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${titre}\n\n${message}` : titre);
  } else {
    Alert.alert(titre, message);
  }
}

export default function ConfigurerFoyerScreen() {
  const router = useRouter();
  const configurerFoyersInitial = useStore((s) => s.configurerFoyersInitial);
  const [choix, setChoix] = useState<ConfigFoyers | null>(null);
  const [chargement, setChargement] = useState(false);

  const valider = async () => {
    if (!choix) return;
    setChargement(true);
    try {
      await configurerFoyersInitial(choix);
      router.replace('/creer-espace-lien' as any);
    } catch (err: any) {
      alertCompat('Erreur', err.message ?? 'Une erreur est survenue.');
    } finally {
      setChargement(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.contentCentre}>
        <Text style={styles.titre}>Comment vivent vos enfants ?</Text>
        <Text style={styles.sousTitre}>
          Cette information nous permet d'organiser correctement l'agenda et le partage des informations.
        </Text>

        <Pressable
          style={[styles.option, choix === 'deux_foyers' && styles.optionActive]}
          onPress={() => setChoix('deux_foyers')}
        >
          <View style={[styles.radio, choix === 'deux_foyers' && styles.radioActive]}>
            {choix === 'deux_foyers' ? <View style={styles.radioPoint} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitre}>Nous vivons dans deux foyers</Text>
            <Text style={styles.optionDesc}>Les enfants alternent entre deux domiciles</Text>
          </View>
        </Pressable>

        <Pressable
          style={[styles.option, choix === 'foyer_commun' && styles.optionActive]}
          onPress={() => setChoix('foyer_commun')}
        >
          <View style={[styles.radio, choix === 'foyer_commun' && styles.radioActive]}>
            {choix === 'foyer_commun' ? <View style={styles.radioPoint} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitre}>Nous vivons dans le même foyer</Text>
            <Text style={styles.optionDesc}>Nous partageons le même domicile</Text>
          </View>
        </Pressable>

        <Text style={styles.reassurance}>
          Vous pourrez inviter l'autre parent quand vous serez prêt(e) — rien ne vous oblige à le faire
          maintenant.
        </Text>

        <Pressable
          style={[styles.boutonPrincipal, !choix && styles.boutonDisabled]}
          onPress={valider}
          disabled={!choix || chargement}
        >
          {chargement ? (
            <ActivityIndicator color={COLORS.blanc} />
          ) : (
            <Text style={styles.boutonPrincipalTexte}>Continuer</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ivoire },
  contentCentre: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.xl },
  titre: { fontFamily: FONTS.display, fontSize: 24, color: COLORS.vertProfond, marginBottom: SPACING.sm },
  sousTitre: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, lineHeight: 19, marginBottom: SPACING.xl },

  option: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    backgroundColor: COLORS.blanc, borderWidth: 1.5, borderColor: COLORS.bordure,
    borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.md,
  },
  optionActive: { borderColor: COLORS.vert, backgroundColor: 'rgba(45,106,79,0.06)' },
  radio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.bordure,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: COLORS.vert },
  radioPoint: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.vert },
  optionTitre: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.vertProfond },
  optionDesc: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.ardoise, marginTop: 2 },

  reassurance: {
    fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.ardoise, lineHeight: 18,
    marginTop: SPACING.sm, marginBottom: SPACING.xl, fontStyle: 'italic',
  },

  boutonPrincipal: {
    backgroundColor: COLORS.vert, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center',
  },
  boutonDisabled: { opacity: 0.45 },
  boutonPrincipalTexte: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.blanc },
});