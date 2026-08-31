// app/rejoindre.tsx
// Écran ouvert via le lien d'invitation (?token=...). Vérifie la validité
// du token via get_invitation_info() avant même que la personne crée un
// compte, puis crée son compte et l'attache à la famille via
// rejoindre_famille().

import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../constants/supabase';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';

function alertCompat(titre: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${titre}\n\n${message}` : titre);
  } else {
    Alert.alert(titre, message);
  }
}

export default function RejoindreScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [verification, setVerification] = useState<'en_cours' | 'valide' | 'invalide'>('en_cours');
  const [nomInvitant, setNomInvitant] = useState('');

  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerification('invalide');
      return;
    }
    supabase.rpc('get_invitation_info', { p_token: token }).then(({ data, error }) => {
      const info = data?.[0];
      if (error || !info || info.utilisee_le || new Date(info.expire_le) < new Date()) {
        setVerification('invalide');
        return;
      }
      setNomInvitant(info.parent_nom ?? '');
      setVerification('valide');
    });
  }, [token]);

  const rejoindre = async () => {
    if (!prenom.trim() || !email.trim() || motDePasse.length < 6) {
      alertCompat(
        'Champs incomplets',
        'Renseigne ton prénom, un email valide, et un mot de passe d\u2019au moins 6 caractères.'
      );
      return;
    }

    setChargement(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: motDePasse,
      });
      if (authError) throw authError;
      if (!authData.session) {
        alertCompat(
          'Confirmation requise',
          'Vérifie ta boîte mail pour confirmer ton adresse, puis reviens te connecter.'
        );
        setChargement(false);
        return;
      }

      const { error: rejoindreError } = await supabase.rpc('rejoindre_famille', {
        p_token: token,
        p_nom: prenom.trim(),
      });
      if (rejoindreError) throw rejoindreError;

      router.replace('/(tabs)/accueil');
    } catch (err: any) {
      alertCompat('Erreur', err.message ?? 'Une erreur est survenue.');
    } finally {
      setChargement(false);
    }
  };

  if (verification === 'en_cours') {
    return (
      <View style={styles.centreEcran}>
        <ActivityIndicator size="large" color={COLORS.vert} />
      </View>
    );
  }

  if (verification === 'invalide') {
    return (
      <View style={styles.screen}>
        <View style={styles.contentCentre}>
          <Text style={styles.titre}>Lien invalide ou expiré</Text>
          <Text style={styles.sousTitre}>
            Ce lien d'invitation n'est plus valable. Demande à l'autre parent de t'en renvoyer un nouveau
            depuis son écran Dualia.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.contentCentre}>
        <Text style={styles.titre}>Rejoindre l'espace de {nomInvitant}</Text>
        <Text style={styles.sousTitre}>
          Créez votre compte pour accéder au même espace familial partagé.
        </Text>

        <Text style={styles.label}>Votre prénom</Text>
        <TextInput
          style={styles.input}
          value={prenom}
          onChangeText={setPrenom}
          placeholder="Ex. Pierre"
          placeholderTextColor={COLORS.ardoise}
        />

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
          placeholder="6 caractères minimum"
          placeholderTextColor={COLORS.ardoise}
          secureTextEntry
        />

        <Pressable style={styles.boutonPrincipal} onPress={rejoindre} disabled={chargement}>
          {chargement ? (
            <ActivityIndicator color={COLORS.blanc} />
          ) : (
            <Text style={styles.boutonPrincipalTexte}>Rejoindre</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ivoire },
  centreEcran: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.ivoire },
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
