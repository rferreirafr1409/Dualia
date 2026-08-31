// app/connexion.tsx
//
// Écran de connexion classique (email + mot de passe) pour un parent qui a
// déjà un compte Dualia. Nécessaire car creer-espace.tsx et rejoindre.tsx
// ne servent qu'à la CRÉATION initiale du compte (via signUp) — un lien
// d'invitation est à usage unique et ne peut donc pas servir de moyen de
// reconnexion après la première fois.

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

export default function ConnexionScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);

  const seConnecter = async () => {
    if (!email.trim() || !motDePasse) {
      alertCompat('Champs incomplets', 'Renseigne ton email et ton mot de passe.');
      return;
    }

    setChargement(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: motDePasse,
      });
      if (error) throw error;
      router.replace('/(tabs)/accueil');
    } catch (err: any) {
      // Message volontairement générique : ne pas révéler si c'est l'email
      // ou le mot de passe qui est incorrect (bonne pratique de sécurité).
      alertCompat('Connexion impossible', 'Email ou mot de passe incorrect.');
    } finally {
      setChargement(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.contentCentre}>
        <Text style={styles.titre}>Se connecter</Text>
        <Text style={styles.sousTitre}>
          Retrouvez votre espace familial Dualia.
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

        <Text style={styles.label}>Mot de passe</Text>
        <TextInput
          style={styles.input}
          value={motDePasse}
          onChangeText={setMotDePasse}
          placeholder="Votre mot de passe"
          placeholderTextColor={COLORS.ardoise}
          secureTextEntry
        />

        <Pressable onPress={() => router.push('/mot-de-passe-oublie' as any)}>
          <Text style={styles.lienMotDePasseOublie}>Mot de passe oublié ?</Text>
        </Pressable>

        <Pressable style={styles.boutonPrincipal} onPress={seConnecter} disabled={chargement}>
          {chargement ? (
            <ActivityIndicator color={COLORS.blanc} />
          ) : (
            <Text style={styles.boutonPrincipalTexte}>Se connecter</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.push('/creer-espace' as any)}>
          <Text style={styles.lienTexteSecondaire}>Je n'ai pas encore de compte</Text>
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
  lienMotDePasseOublie: {
    fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.vert, textAlign: 'right', marginTop: SPACING.sm,
  },
  boutonPrincipal: {
    backgroundColor: COLORS.vert, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center',
    marginTop: SPACING.xl,
  },
  boutonPrincipalTexte: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.blanc },
  lienTexteSecondaire: {
    fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.vert, textAlign: 'center', marginTop: SPACING.lg,
  },
});
