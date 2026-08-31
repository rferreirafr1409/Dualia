// app/mot-de-passe-oublie.tsx
//
// Étape 1 de la réinitialisation : la personne saisit son email, Supabase
// lui envoie un lien vers /reinitialiser-mot-de-passe où elle pourra choisir
// un nouveau mot de passe.
//
// IMPORTANT : l'URL de redirection utilisée ici (redirectTo) doit être
// ajoutée dans Supabase → Authentication → URL Configuration → Redirect
// URLs, sinon Supabase refusera de rediriger vers cette page après le clic
// dans l'email.

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

const URL_REDIRECTION = 'https://rferreirafr1409.github.io/Dualia/reinitialiser-mot-de-passe';

export default function MotDePasseOublieScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [chargement, setChargement] = useState(false);
  const [lienEnvoye, setLienEnvoye] = useState(false);

  const envoyerLien = async () => {
    if (!email.trim()) {
      alertCompat('Champ requis', 'Renseigne ton adresse email.');
      return;
    }

    setChargement(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: URL_REDIRECTION,
      });
      if (error) throw error;
      // On affiche toujours ce message de succès, même si l'email n'existe
      // pas dans la base : ça évite de révéler quels emails sont inscrits.
      setLienEnvoye(true);
    } catch (err: any) {
      alertCompat('Erreur', err.message ?? 'Une erreur est survenue.');
    } finally {
      setChargement(false);
    }
  };

  if (lienEnvoye) {
    return (
      <View style={styles.screen}>
        <View style={styles.contentCentre}>
          <Text style={styles.titre}>Vérifiez votre boîte mail</Text>
          <Text style={styles.sousTitre}>
            Si un compte existe avec l'adresse {email.trim()}, un lien pour choisir un nouveau mot de
            passe vient de lui être envoyé. Pensez à vérifier vos courriers indésirables.
          </Text>

          <Pressable style={styles.boutonSecondaire} onPress={() => router.replace('/connexion' as any)}>
            <Text style={styles.boutonSecondaireTexte}>Retour à la connexion</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.contentCentre}>
        <Text style={styles.titre}>Mot de passe oublié</Text>
        <Text style={styles.sousTitre}>
          Indiquez l'email de votre compte Dualia, nous vous envoyons un lien pour choisir un nouveau
          mot de passe.
        </Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="vous@exemple.com"
          placeholderTextColor={COLORS.ardoise}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Pressable style={styles.boutonPrincipal} onPress={envoyerLien} disabled={chargement}>
          {chargement ? (
            <ActivityIndicator color={COLORS.blanc} />
          ) : (
            <Text style={styles.boutonPrincipalTexte}>Envoyer le lien</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.back()}>
          <Text style={styles.lienTexteSecondaire}>Retour</Text>
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
  boutonSecondaire: { paddingVertical: 14, alignItems: 'center', marginTop: SPACING.xl },
  boutonSecondaireTexte: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.vert },
  lienTexteSecondaire: {
    fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.vert, textAlign: 'center', marginTop: SPACING.lg,
  },
});
