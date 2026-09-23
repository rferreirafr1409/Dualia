// app/rejoindre.tsx
// Écran ouvert via le lien d'invitation (?token=...). Vérifie la validité
// du token via get_invitation_info() avant même que la personne crée un
// compte, puis crée son compte et l'attache à la famille via
// rejoindre_famille().
//
// get_invitation_info reste volontairement appelable sans être connecté :
// c'est le seul appel du parcours qui précède la création du compte.
// rejoindre_famille, elle, n'est appelée qu'une fois la session établie —
// d'où la vérification de authData.session plus bas, qui conditionne la
// révocation des droits anonymes côté base.

import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
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

export default function RejoindreScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [verification, setVerification] = useState<'en_cours' | 'valide' | 'invalide'>('en_cours');
  const [nomInvitant, setNomInvitant] = useState('');

  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);

  const erreurMotDePasse = motDePasse.length > 0 ? validerMotDePasse(motDePasse) : null;

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
    if (!prenom.trim() || !email.trim()) {
      alertCompat('Champs incomplets', 'Renseigne ton prénom et une adresse email.');
      return;
    }
    const probleme = validerMotDePasse(motDePasse);
    if (probleme) {
      alertCompat('Mot de passe trop faible', probleme);
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

      // Même raison que dans creer-espace.tsx : sans ce rechargement
      // explicite, le store garde ses valeurs par défaut jusqu'au
      // prochain F5 involontaire de l'utilisateur.
      await useStore.getState().initialiserSession();

      router.replace('/(tabs)/accueil');
    } catch (err: any) {
      alertCompat('Erreur', traduireErreurAuth(err?.message));
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
  inputErreur: { borderColor: COLORS.terracotta },
  aide: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, lineHeight: 16, marginTop: 6 },
  aideErreur: { color: COLORS.terracotta },
  boutonPrincipal: {
    backgroundColor: COLORS.vert, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center',
    marginTop: SPACING.xl,
  },
  boutonPrincipalTexte: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.blanc },
});
