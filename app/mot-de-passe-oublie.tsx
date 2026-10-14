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
import { lienApplication } from '../constants/liens';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { retour } from '../lib/navigation';
import { useStore } from '../store/useStore';

type Langue = 'fr' | 'pt' | 'es' | 'en';

const LIBELLES: Record<Langue, {
  verifiezTitre: string;
  verifiezTexte: (email: string) => string;
  verifiezMobile: string;
  retourConnexion: string;
  titre: string;
  sousTitre: string;
  email: string;
  envoyer: string;
  retour: string;
  champRequis: string;
  champRequisTexte: string;
  erreur: string;
  erreurGenerique: string;
}> = {
  fr: {
    verifiezTitre: 'Vérifiez votre boîte mail',
    verifiezTexte: (email) => `Si un compte existe avec l'adresse ${email}, un lien pour choisir un nouveau mot de passe vient de lui être envoyé. Pensez à vérifier vos courriers indésirables.`,
    verifiezMobile: "Le lien s'ouvre dans votre navigateur : choisissez-y votre nouveau mot de passe, puis revenez dans l'application Dualia pour vous connecter.",
    retourConnexion: 'Retour à la connexion',
    titre: 'Mot de passe oublié',
    sousTitre: "Indiquez l'email de votre compte Dualia, nous vous envoyons un lien pour choisir un nouveau mot de passe.",
    email: 'Email',
    envoyer: 'Envoyer le lien',
    retour: 'Retour',
    champRequis: 'Champ requis',
    champRequisTexte: 'Renseigne ton adresse email.',
    erreur: 'Erreur',
    erreurGenerique: 'Une erreur est survenue.',
  },
  pt: {
    verifiezTitre: 'Verifique o seu email',
    verifiezTexte: (email) => `Se existir uma conta com o endereço ${email}, acabou de lhe ser enviada uma ligação para escolher uma nova palavra-passe. Verifique também a pasta de spam.`,
    verifiezMobile: 'A ligação abre no seu navegador: escolha aí a nova palavra-passe e volte depois à aplicação Dualia para iniciar sessão.',
    retourConnexion: 'Voltar ao início de sessão',
    titre: 'Palavra-passe esquecida',
    sousTitre: 'Indique o email da sua conta Dualia e enviamos-lhe uma ligação para escolher uma nova palavra-passe.',
    email: 'Email',
    envoyer: 'Enviar a ligação',
    retour: 'Voltar',
    champRequis: 'Campo obrigatório',
    champRequisTexte: 'Indique o seu endereço de email.',
    erreur: 'Erro',
    erreurGenerique: 'Ocorreu um erro.',
  },
  es: {
    verifiezTitre: 'Revisa tu correo',
    verifiezTexte: (email) => `Si existe una cuenta con la dirección ${email}, se le acaba de enviar un enlace para elegir una nueva contraseña. Revisa también la carpeta de spam.`,
    verifiezMobile: 'El enlace se abre en tu navegador: elige allí tu nueva contraseña y vuelve después a la aplicación Dualia para iniciar sesión.',
    retourConnexion: 'Volver al inicio de sesión',
    titre: 'Contraseña olvidada',
    sousTitre: 'Indica el email de tu cuenta Dualia y te enviamos un enlace para elegir una nueva contraseña.',
    email: 'Email',
    envoyer: 'Enviar el enlace',
    retour: 'Volver',
    champRequis: 'Campo obligatorio',
    champRequisTexte: 'Indica tu dirección de email.',
    erreur: 'Error',
    erreurGenerique: 'Se ha producido un error.',
  },
  en: {
    verifiezTitre: 'Check your inbox',
    verifiezTexte: (email) => `If an account exists for ${email}, a link to choose a new password has just been sent to it. Remember to check your spam folder.`,
    verifiezMobile: 'The link opens in your browser: choose your new password there, then come back to the Dualia app to sign in.',
    retourConnexion: 'Back to sign in',
    titre: 'Forgotten password',
    sousTitre: 'Enter the email of your Dualia account and we will send you a link to choose a new password.',
    email: 'Email',
    envoyer: 'Send the link',
    retour: 'Back',
    champRequis: 'Required field',
    champRequisTexte: 'Please enter your email address.',
    erreur: 'Error',
    erreurGenerique: 'Something went wrong.',
  },
};

function alertCompat(titre: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${titre}\n\n${message}` : titre);
  } else {
    Alert.alert(titre, message);
  }
}

// L'adresse de base vit dans constants/liens.ts, avec celles des autres
// e-mails. Elle etait recopiee ici a la main : le jour du demenagement vers
// dualia.app, la reinitialisation aurait continue de pointer vers l'ancienne
// adresse, sans que rien ne le signale.
const URL_REDIRECTION = lienApplication('reinitialiser-mot-de-passe');

export default function MotDePasseOublieScreen() {
  const router = useRouter();
  const langue = useStore((s) => s.langue);
  const l = LIBELLES[langue] ?? LIBELLES.fr;
  const [email, setEmail] = useState('');
  const [chargement, setChargement] = useState(false);
  const [lienEnvoye, setLienEnvoye] = useState(false);

  const envoyerLien = async () => {
    if (!email.trim()) {
      alertCompat(l.champRequis, l.champRequisTexte);
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
      alertCompat(l.erreur, err.message ?? l.erreurGenerique);
    } finally {
      setChargement(false);
    }
  };

  if (lienEnvoye) {
    return (
      <View style={styles.screen}>
        <View style={styles.contentCentre}>
          <Text style={styles.titre}>{l.verifiezTitre}</Text>
          <Text style={styles.sousTitre}>{l.verifiezTexte(email.trim())}</Text>
          {Platform.OS !== 'web' && (
            <Text style={styles.sousTitre}>{l.verifiezMobile}</Text>
          )}

          <Pressable style={styles.boutonSecondaire} onPress={() => router.replace('/connexion' as any)}>
            <Text style={styles.boutonSecondaireTexte}>{l.retourConnexion}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.contentCentre}>
        <Text style={styles.titre}>{l.titre}</Text>
        <Text style={styles.sousTitre}>{l.sousTitre}</Text>

        <Text style={styles.label}>{l.email}</Text>
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
            <Text style={styles.boutonPrincipalTexte}>{l.envoyer}</Text>
          )}
        </Pressable>

        <Pressable onPress={() => retour(router, '/connexion')}>
          <Text style={styles.lienTexteSecondaire}>{l.retour}</Text>
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
