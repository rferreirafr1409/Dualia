// app/connexion.tsx
//
// Écran de connexion classique (email + mot de passe) pour un parent qui a
// déjà un compte Dualia. Nécessaire car creer-espace.tsx et rejoindre.tsx
// ne servent qu'à la CRÉATION initiale du compte (via signUp) — un lien
// d'invitation est à usage unique et ne peut donc pas servir de moyen de
// reconnexion après la première fois.
//
// Après une connexion réussie, on appelle explicitement
// initialiserSession() du store AVANT de naviguer vers l'accueil : sans
// ça, l'écran d'accueil se monte avec les données par défaut (jamais
// remplacées), et affiche "Marie/Pierre" au lieu du vrai espace familial
// de l'utilisateur, même si l'authentification a parfaitement réussi.
//
// Tout le monde ne se connecte pas comme parent : une nounou, un
// grand-parent ou une école ont un accès tiers, pas un espace familial.
// initialiserSession() le détecte ; on regarde ensuite où l'envoyer, sinon
// une nounou parfaitement authentifiée atterrissait sur un accueil vide.

import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { cheminInvitationEnAttente } from '../lib/invitationEnAttente';
import { supabase } from '../constants/supabase';
import { useStore } from '../store/useStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { TRADUCTIONS } from '../constants/i18n';
import { consommerMotifInactivite } from '../lib/inactivite';

function alertCompat(titre: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${titre}\n\n${message}` : titre);
  } else {
    Alert.alert(titre, message);
  }
}

export default function ConnexionScreen() {
  const router = useRouter();
  const initialiserSession = useStore((s) => s.initialiserSession);
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);

  // Pourquoi la personne se retrouve-t-elle ici ? Sans cette explication, une
  // deconnexion automatique se lit comme une panne, et le parent recommence
  // en se demandant ce qu'il a casse. La langue vient du stockage local, donc
  // elle est connue avant meme la connexion.
  const langue = useStore((s) => s.langue);
  const [deconnexionInactivite] = useState(() => consommerMotifInactivite());

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

      // Charge les vraies données (espace familial, parents, enfants...)
      // avant de naviguer — sans quoi l'accueil afficherait encore les
      // valeurs par défaut jamais remplacées.
      await initialiserSession();

      const { familleId, accesTiers } = useStore.getState();
      if (!familleId && accesTiers) {
        router.replace('/espace-tiers' as any);
        return;
      }

      // Un co-parent invite qui passe par ici avant d'avoir rejoint l'espace
      // retrouve son lien d'invitation, au lieu d'etre pousse a creer un
      // espace a lui (10 octobre 2026).
      if (!familleId) {
        const cheminInvitation = await cheminInvitationEnAttente();
        if (cheminInvitation) {
          router.replace(cheminInvitation as any);
          return;
        }
      }

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

        {deconnexionInactivite ? (
          <Text style={styles.motifDeconnexion}>
            {TRADUCTIONS[langue].inactivite.expiree}
          </Text>
        ) : null}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="vous@exemple.com"
          placeholderTextColor={COLORS.ardoise}
          autoCapitalize="none"
          keyboardType="email-address"
          returnKeyType="next"
        />

        <Text style={styles.label}>Mot de passe</Text>
        <TextInput
          style={styles.input}
          value={motDePasse}
          onChangeText={setMotDePasse}
          placeholder="Votre mot de passe"
          placeholderTextColor={COLORS.ardoise}
          secureTextEntry
          returnKeyType="go"
          onSubmitEditing={seConnecter}
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

        {/* La politique de confidentialité existait sans qu'aucun écran n'y
            mène. Apple exige qu'elle soit lisible dans l'app (DUA-098). */}
        <Pressable onPress={() => router.push('/confidentialite' as any)}>
          <Text style={styles.lienDiscret}>Confidentialité et protection des données</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ivoire },
  // Colonne de formulaire : pleine largeur sur telephone, bornee et centree
  // sur grand ecran, pour ne pas etirer les champs d'un bord a l'autre.
  contentCentre: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.xl, width: '100%', maxWidth: 560, alignSelf: 'center' },
  titre: { fontFamily: FONTS.display, fontSize: 24, color: COLORS.vertProfond, marginBottom: SPACING.sm },
  sousTitre: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, lineHeight: 19, marginBottom: SPACING.xl },
  motifDeconnexion: {
    fontFamily: FONTS.body, fontSize: 12, color: COLORS.vertProfond,
    backgroundColor: COLORS.ivoire, borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    marginTop: SPACING.md, lineHeight: 17,
  },
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
  lienDiscret: { marginTop: 18, fontSize: 12, color: COLORS.ardoise, textAlign: 'center', textDecorationLine: 'underline' },
  lienTexteSecondaire: {
    fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.vert, textAlign: 'center', marginTop: SPACING.lg,
  },
});
