// app/creer-espace.tsx
// Premier écran vu par un parent qui n'a pas encore de compte. Crée un
// compte Supabase, puis une famille via la fonction creer_famille(), et
// redirige vers configurer-foyer.tsx — la question du lien d'invitation
// (creer-espace-lien.tsx) vient après, une fois les foyers configurés.
//
// La règle de mot de passe vit dans constants/motDePasse.ts et doit rester
// alignée sur la configuration Supabase : sinon l'écran accepte ce que le
// serveur refuse, et le parent reçoit une erreur brute en anglais.

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

export default function CreerEspaceScreen() {
  const router = useRouter();
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);

  // Message affiché sous le champ pendant la saisie, plutôt qu'une alerte
  // au moment de valider : le parent voit ce qui manque au fur et à mesure.
  const erreurMotDePasse = motDePasse.length > 0 ? validerMotDePasse(motDePasse) : null;

  const creerEspace = async () => {
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
        // Ne devrait pas arriver tant que la confirmation par email reste
        // désactivée côté Supabase — gardé par sécurité si jamais réactivée.
        alertCompat(
          'Confirmation requise',
          'Vérifie ta boîte mail pour confirmer ton adresse, puis reviens te connecter.'
        );
        setChargement(false);
        return;
      }

      const { error: familleError } = await supabase.rpc('creer_famille', {
        p_nom: prenom.trim(),
      });

      if (familleError) throw familleError;

      // La création de compte est une navigation interne (SPA), pas un
      // rechargement de page — sans cet appel explicite, le store garde
      // ses valeurs par défaut jusqu'au prochain F5 involontaire.
      // On force ici le chargement de la vraie session.
      await useStore.getState().initialiserSession();

      router.replace('/configurer-foyer' as any);
    } catch (err: any) {
      alertCompat('Erreur', traduireErreurAuth(err?.message));
    } finally {
      setChargement(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.contentCentre}>
        <Text style={styles.titre}>Créer votre espace familial</Text>
        <Text style={styles.sousTitre}>
          Vous pourrez ensuite inviter l'autre parent à rejoindre le même espace, pour que vos deux
          comptes restent synchronisés.
        </Text>

        <Text style={styles.label}>Votre prénom</Text>
        <TextInput
          style={styles.input}
          value={prenom}
          onChangeText={setPrenom}
          placeholder="Ex. Marie"
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

        <Pressable style={styles.boutonPrincipal} onPress={creerEspace} disabled={chargement}>
          {chargement ? (
            <ActivityIndicator color={COLORS.blanc} />
          ) : (
            <Text style={styles.boutonPrincipalTexte}>Créer mon espace</Text>
          )}
        </Pressable>

        <Pressable onPress={() => router.push('/rejoindre' as any)}>
          <Text style={styles.lienTexteSecondaire}>J'ai déjà reçu un lien d'invitation</Text>
        </Pressable>

        <Pressable onPress={() => router.push('/connexion' as any)}>
          <Text style={styles.lienTexteSecondaire}>J'ai déjà un compte</Text>
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
  inputErreur: { borderColor: COLORS.terracotta },
  aide: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, lineHeight: 16, marginTop: 6 },
  aideErreur: { color: COLORS.terracotta },
  boutonPrincipal: {
    backgroundColor: COLORS.vert, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center',
    marginTop: SPACING.xl,
  },
  boutonPrincipalTexte: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.blanc },
  lienTexteSecondaire: {
    fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.vert, textAlign: 'center', marginTop: SPACING.lg,
  },
});
