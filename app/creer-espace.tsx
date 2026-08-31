// app/creer-espace.tsx
// Premier écran vu par un parent qui n'a pas encore de compte. Crée un
// compte Supabase, puis une famille via la fonction creer_famille(), et
// affiche le lien d'invitation à transmettre au second parent.

import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Share, Alert, Platform,
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

export default function CreerEspaceScreen() {
  const router = useRouter();
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);
  const [lienInvitation, setLienInvitation] = useState<string | null>(null);

  const creerEspace = async () => {
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
        // Ne devrait pas arriver tant que la confirmation par email reste
        // désactivée côté Supabase — gardé par sécurité si jamais réactivée.
        alertCompat(
          'Confirmation requise',
          'Vérifie ta boîte mail pour confirmer ton adresse, puis reviens te connecter.'
        );
        setChargement(false);
        return;
      }

      const { data: familleData, error: familleError } = await supabase.rpc('creer_famille', {
        p_nom: prenom.trim(),
      });

      if (familleError) throw familleError;

      const token = familleData?.[0]?.invitation_token;
      const lien = `https://rferreirafr1409.github.io/Dualia/rejoindre?token=${token}`;
      setLienInvitation(lien);
    } catch (err: any) {
      alertCompat('Erreur', err.message ?? 'Une erreur est survenue.');
    } finally {
      setChargement(false);
    }
  };

  const partagerLien = async () => {
    if (!lienInvitation) return;
    try {
      await Share.share({ message: lienInvitation });
    } catch {
      // L'utilisateur peut aussi copier le lien affiché à l'écran.
    }
  };

  if (lienInvitation) {
    return (
      <View style={styles.screen}>
        <View style={styles.contentCentre}>
          <Text style={styles.titre}>Votre espace est créé</Text>
          <Text style={styles.sousTitre}>
            Envoyez ce lien à l'autre parent pour qu'il rejoigne votre espace familial. Il reste valable
            7 jours.
          </Text>

          <View style={styles.lienBox}>
            <Text style={styles.lienTexte} selectable>{lienInvitation}</Text>
          </View>

          <Pressable style={styles.boutonPrincipal} onPress={partagerLien}>
            <Text style={styles.boutonPrincipalTexte}>Partager le lien</Text>
          </Pressable>

          <Pressable style={styles.boutonSecondaire} onPress={() => router.replace('/(tabs)/accueil')}>
            <Text style={styles.boutonSecondaireTexte}>Continuer vers Dualia →</Text>
          </Pressable>
        </View>
      </View>
    );
  }

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
          style={styles.input}
          value={motDePasse}
          onChangeText={setMotDePasse}
          placeholder="6 caractères minimum"
          placeholderTextColor={COLORS.ardoise}
          secureTextEntry
        />

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
  boutonPrincipal: {
    backgroundColor: COLORS.vert, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center',
    marginTop: SPACING.xl,
  },
  boutonPrincipalTexte: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.blanc },
  boutonSecondaire: { paddingVertical: 14, alignItems: 'center', marginTop: SPACING.sm },
  boutonSecondaireTexte: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.vert },
  lienTexteSecondaire: {
    fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.vert, textAlign: 'center', marginTop: SPACING.lg,
  },
  lienBox: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.lg,
  },
  lienTexte: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.vertProfond },
});