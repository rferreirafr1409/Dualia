// app/reinitialiser-mot-de-passe.tsx
//
// Étape 2 de la réinitialisation : cet écran est ouvert en cliquant sur le
// lien reçu par email.
//
// Les tokens (access_token/refresh_token) sont lus depuis sessionStorage
// (clé "dualia_reset_tokens"), et non depuis window.location.hash : le
// script inject dans app/+html.tsx les y a déjà déposés avant qu'Expo
// Router ne démarre et ne touche potentiellement à l'URL. C'est une lecture
// synchrone, faite dans l'initialiseur de useState, donc dès le premier
// rendu — sans dépendre d'un useEffect ni de l'état de l'URL à cet instant.

import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../constants/supabase';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';

function alertCompat(titre: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${titre}\n\n${message}` : titre);
  } else {
    Alert.alert(titre, message);
  }
}

const CLE_TOKENS = 'dualia_reset_tokens';

type EtatEcran = 'pret_a_confirmer' | 'session_active' | 'echec';

function lireTokens(): { access_token: string; refresh_token: string } | null {
  if (Platform.OS !== 'web') return null;

  try {
    const brut = sessionStorage.getItem(CLE_TOKENS);
    if (!brut) return null;
    const parsed = JSON.parse(brut);
    if (!parsed?.access_token || !parsed?.refresh_token) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

function nettoyerTokens() {
  if (Platform.OS !== 'web') return;
  try {
    sessionStorage.removeItem(CLE_TOKENS);
  } catch (e) {}
}

export default function ReinitialiserMotDePasseScreen() {
  const router = useRouter();
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [chargement, setChargement] = useState(false);

  const [tokens] = useState(() => lireTokens());
  const [etatEcran, setEtatEcran] = useState<EtatEcran>(tokens ? 'pret_a_confirmer' : 'echec');

  const confirmerEtEtablirSession = async () => {
    if (!tokens) {
      setEtatEcran('echec');
      return;
    }

    setChargement(true);
    const { error } = await supabase.auth.setSession(tokens);
    setChargement(false);

    if (error) {
      setEtatEcran('echec');
      return;
    }

    nettoyerTokens();
    setEtatEcran('session_active');
  };

  const enregistrerNouveauMotDePasse = async () => {
    if (motDePasse.length < 6) {
      alertCompat('Mot de passe trop court', 'Choisis un mot de passe d\u2019au moins 6 caractères.');
      return;
    }
    if (motDePasse !== confirmation) {
      alertCompat('Les mots de passe ne correspondent pas', 'Vérifie la saisie dans les deux champs.');
      return;
    }

    setChargement(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: motDePasse });
      if (error) throw error;
      alertCompat('Mot de passe mis à jour', 'Vous pouvez maintenant vous reconnecter.');
      router.replace('/(tabs)/accueil');
    } catch (err: any) {
      alertCompat(
        'Impossible de mettre à jour le mot de passe',
        'Le lien a peut-être expiré. Demandez-en un nouveau depuis l\u2019écran de connexion.'
      );
    } finally {
      setChargement(false);
    }
  };

  if (etatEcran === 'echec') {
    return (
      <View style={styles.screen}>
        <View style={styles.contentCentre}>
          <Text style={styles.titre}>Lien invalide ou expiré</Text>
          <Text style={styles.sousTitre}>
            Ce lien de réinitialisation n'est plus valable. Demandez-en un nouveau depuis l'écran de
            connexion.
          </Text>
          <Pressable style={styles.boutonPrincipal} onPress={() => router.replace('/mot-de-passe-oublie' as any)}>
            <Text style={styles.boutonPrincipalTexte}>Demander un nouveau lien</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (etatEcran === 'pret_a_confirmer') {
    return (
      <View style={styles.screen}>
        <View style={styles.contentCentre}>
          <Text style={styles.titre}>Réinitialiser votre mot de passe</Text>
          <Text style={styles.sousTitre}>
            Cliquez ci-dessous pour continuer et choisir un nouveau mot de passe.
          </Text>
          <Pressable style={styles.boutonPrincipal} onPress={confirmerEtEtablirSession} disabled={chargement}>
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

  return (
    <View style={styles.screen}>
      <View style={styles.contentCentre}>
        <Text style={styles.titre}>Choisir un nouveau mot de passe</Text>
        <Text style={styles.sousTitre}>
          Ce mot de passe remplacera l'ancien pour votre compte Dualia.
        </Text>

        <Text style={styles.label}>Nouveau mot de passe</Text>
        <TextInput
          style={styles.input}
          value={motDePasse}
          onChangeText={setMotDePasse}
          placeholder="6 caractères minimum"
          placeholderTextColor={COLORS.ardoise}
          secureTextEntry
        />

        <Text style={styles.label}>Confirmer le mot de passe</Text>
        <TextInput
          style={styles.input}
          value={confirmation}
          onChangeText={setConfirmation}
          placeholder="Ressaisissez le mot de passe"
          placeholderTextColor={COLORS.ardoise}
          secureTextEntry
        />

        <Pressable style={styles.boutonPrincipal} onPress={enregistrerNouveauMotDePasse} disabled={chargement}>
          {chargement ? (
            <ActivityIndicator color={COLORS.blanc} />
          ) : (
            <Text style={styles.boutonPrincipalTexte}>Enregistrer</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ivoire },
  contentCentre: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.xl },
  titre: { fontFamily: FONTS.display, fontSize: 22, color: COLORS.vertProfond, marginBottom: SPACING.sm },
  sousTitre: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, lineHeight: 19, marginBottom: SPACING.xl },
  label: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.vertProfond, marginBottom: 6, marginTop: SPACING.md },
  input: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 12, fontFamily: FONTS.body, fontSize: 15, color: COLORS.vertProfond,
  },
  boutonPrincipal: {
    backgroundColor: COLORS.vert, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center',
    marginTop: SPACING.xl,
  },
  boutonPrincipalTexte: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.blanc },
});