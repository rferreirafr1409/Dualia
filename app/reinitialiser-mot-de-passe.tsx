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
//
// La règle de mot de passe vient de constants/motDePasse.ts, partagée avec
// creer-espace.tsx et rejoindre.tsx.
//
// Les erreurs d'enregistrement sont affichées telles qu'elles sont, traduites
// en français. La version précédente répondait « le lien a peut-être expiré »
// à TOUTE erreur, y compris un mot de passe trop court ou ayant fuité : le
// parent cherchait alors un problème de lien là où il fallait juste changer
// de mot de passe.

import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../constants/supabase';
import { useStore } from '../store/useStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { AIDE_MOT_DE_PASSE, validerMotDePasse, traduireErreurAuth } from '../constants/motDePasse';

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

  const erreurMotDePasse = motDePasse.length > 0 ? validerMotDePasse(motDePasse) : null;
  const erreurConfirmation =
    confirmation.length > 0 && motDePasse !== confirmation
      ? 'Les deux mots de passe ne correspondent pas.'
      : null;

  const confirmerEtEtablirSession = async () => {
    if (!tokens) {
      setEtatEcran('echec');
      return;
    }

    setChargement(true);
    const { error } = await supabase.auth.setSession(tokens);
    setChargement(false);

    if (error) {
      // Ici, et seulement ici, un lien expiré est la cause probable :
      // c'est l'étape qui consomme réellement le jeton reçu par email.
      setEtatEcran('echec');
      return;
    }

    nettoyerTokens();
    setEtatEcran('session_active');
  };

  const enregistrerNouveauMotDePasse = async () => {
    const probleme = validerMotDePasse(motDePasse);
    if (probleme) {
      alertCompat('Mot de passe trop faible', probleme);
      return;
    }
    if (motDePasse !== confirmation) {
      alertCompat('Les mots de passe ne correspondent pas', 'Vérifiez la saisie dans les deux champs.');
      return;
    }

    setChargement(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: motDePasse });
      if (error) throw error;
      // Recharge l'espace familial AVANT d'annoncer le succes, comme le font
      // connexion, creer-espace, rejoindre et rejoindre-acces. Sans cet appel,
      // le parent arrivait sur un accueil vide — la garde de session ayant
      // purge le stockage local a l'ouverture de cet ecran, qui se fait sans
      // session. Et annoncer avant de charger ferait afficher « Mot de passe
      // mis a jour » puis une erreur, pour un mot de passe pourtant change.
      await useStore.getState().initialiserSession();
      alertCompat('Mot de passe mis à jour', 'Votre nouveau mot de passe est enregistré.');
      router.replace('/(tabs)/accueil');
    } catch (err: any) {
      // Le motif réel est affiché, traduit en français. La session vient
      // d'être établie à l'étape précédente : l'échec ici vient presque
      // toujours du mot de passe lui-même, pas du lien.
      alertCompat('Mot de passe refusé', traduireErreurAuth(err?.message));
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
          style={[styles.input, !!erreurMotDePasse && styles.inputErreur]}
          value={motDePasse}
          onChangeText={setMotDePasse}
          placeholder={AIDE_MOT_DE_PASSE}
          placeholderTextColor={COLORS.ardoise}
          secureTextEntry
        />
        <Text style={[styles.aide, !!erreurMotDePasse && styles.aideErreur]}>
          {erreurMotDePasse ?? AIDE_MOT_DE_PASSE}
        </Text>

        <Text style={styles.label}>Confirmer le mot de passe</Text>
        <TextInput
          style={[styles.input, !!erreurConfirmation && styles.inputErreur]}
          value={confirmation}
          onChangeText={setConfirmation}
          placeholder="Ressaisissez le mot de passe"
          placeholderTextColor={COLORS.ardoise}
          secureTextEntry
        />
        {erreurConfirmation ? (
          <Text style={[styles.aide, styles.aideErreur]}>{erreurConfirmation}</Text>
        ) : null}

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
  inputErreur: { borderColor: COLORS.terracotta },
  aide: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, lineHeight: 16, marginTop: 6 },
  aideErreur: { color: COLORS.terracotta },
  boutonPrincipal: {
    backgroundColor: COLORS.vert, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center',
    marginTop: SPACING.xl,
  },
  boutonPrincipalTexte: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.blanc },
});
