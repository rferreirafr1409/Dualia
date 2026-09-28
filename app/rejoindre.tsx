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
  const [code, setCode] = useState('');
  const [chargement, setChargement] = useState(false);

  // Une fois la demande deposee, l'ecran ne montre plus un formulaire mais
  // une salle d'attente : rien ne s'ouvre avant que le parent ait valide.
  const [enAttente, setEnAttente] = useState(false);
  const [refus, setRefus] = useState<string | null>(null);

  const erreurMotDePasse = motDePasse.length > 0 ? validerMotDePasse(motDePasse) : null;

  useEffect(() => {
    if (!token) {
      setVerification('invalide');
      return;
    }
    // La fonction ne rend plus que le prenom de l'invitant et un booleen.
    // Elle ne dit ni le code, ni l'identifiant de famille, ni la date
    // d'expiration : tout cela serait lisible par quiconque tient le lien.
    supabase.rpc('get_invitation_info', { p_token: token }).then(({ data, error }) => {
      const info = data?.[0];
      if (error || !info || info.valide !== true) {
        setVerification('invalide');
        return;
      }
      setNomInvitant(info.prenom_invitant ?? '');
      setVerification('valide');
    });
  }, [token]);

  // Ce que le serveur peut repondre a une demande, en francais.
  // Tant que la demande est en attente, on redemande l'etat au serveur. Dix
  // secondes : assez reactif pour que la personne voie l'ouverture presque
  // tout de suite, assez espace pour ne pas marteler la base.
  // Une demande en cours doit survivre a un rechargement. Sans cela, la
  // personne revenait sur le formulaire, tentait de recreer son compte, et
  // se heurtait a « adresse deja utilisee » sans aucun moyen de revenir a
  // sa demande — bloquee dehors pour de bon.
  useEffect(() => {
    let vivant = true;
    supabase.rpc('etat_de_ma_demande').then(({ data }) => {
      if (vivant && data === 'en_attente_validation') setEnAttente(true);
    });
    return () => { vivant = false; };
  }, []);

  useEffect(() => {
    if (!enAttente) return;
    let vivant = true;
    const demander = async () => {
      const { data } = await supabase.rpc('etat_de_ma_demande');
      if (!vivant) return;
      if (data === 'acceptee') {
        // Le rattachement vient d'avoir lieu cote serveur : on recharge tout
        // plutot que de deviner l'etat.
        await useStore.getState().initialiserSession();
        router.replace('/(tabs)/accueil');
      } else if (data === 'refusee') {
        setEnAttente(false);
        setRefus("Ta demande a été refusée. Rapproche-toi de la personne qui t'a invité.");
      } else if (data === 'expiree' || data === 'revoquee') {
        setEnAttente(false);
        setRefus("Ce lien n'est plus valide. Demande-en un nouveau.");
      } else if (data == null) {
        // Plus aucune demande a notre nom : le lien a ete regenere, ou la
        // ligne a disparu. Sans cette branche, l'ecran tournait
        // indefiniment sur un sablier qui ne menait nulle part.
        setEnAttente(false);
        setRefus("Ta demande n'est plus suivie. Demande un nouveau lien et un nouveau code.");
      }
    };
    demander();
    const minuteur = setInterval(demander, 10000);
    return () => { vivant = false; clearInterval(minuteur); };
  }, [enAttente, router]);

  const MESSAGES: Record<string, string> = {
    code_invalide: "Ce code ne correspond pas. Vérifie auprès de la personne qui t'a invité.",
    trop_de_tentatives:
      "Trop d'essais : ce lien est désormais bloqué. Demande un nouveau lien et un nouveau code.",
    invitation_expiree: "Ce lien a expiré. Demande-en un nouveau.",
    invitation_revoquee: "Ce lien a été annulé. Demande-en un nouveau.",
    invitation_deja_utilisee: "Ce lien a déjà servi.",
    invitation_introuvable: "Ce lien n'est pas valide.",
    demande_deja_en_cours: "Une autre demande est déjà en attente sur ce lien.",
    demande_refusee: "Cette demande a été refusée. Rapproche-toi de la personne qui t'a invité.",
    deja_membre: "Ce compte appartient déjà à un espace familial.",
    espace_complet: "Cet espace familial est déjà complet.",
    session_requise: "Session introuvable. Réessaie.",
  };

  const rejoindre = async () => {
    if (!prenom.trim() || !email.trim()) {
      alertCompat('Champs incomplets', 'Renseigne ton prénom et une adresse email.');
      return;
    }
    if (!/^\d{6}$/.test(code.replace(/\s/g, ''))) {
      alertCompat('Code manquant', 'Saisis le code à 6 chiffres transmis séparément du lien.');
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

      // Le compte existe, mais il n'est encore rattache a rien. La demande
      // est deposee ; c'est le parent qui invite qui ouvrira la porte.
      const { data: etat, error: demandeError } = await supabase.rpc('demander_a_rejoindre', {
        p_token: token,
        p_code: code.replace(/\s/g, ''),
        p_nom: prenom.trim(),
      });
      if (demandeError) throw demandeError;

      if (etat !== 'en_attente_validation') {
        setRefus(MESSAGES[etat as string] ?? "Cette demande n'a pas pu aboutir.");
        setChargement(false);
        return;
      }

      setRefus(null);
      setEnAttente(true);
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

  if (enAttente) {
    return (
      <View style={styles.screen}>
        <View style={styles.contentCentre}>
          <Text style={styles.titre}>Demande envoyée</Text>
          <Text style={styles.sousTitre}>
            {nomInvitant} doit maintenant valider votre arrivée. Vous verrez l'espace familial
            dès que ce sera fait — vous pouvez laisser cette page ouverte.
          </Text>
          <ActivityIndicator size="small" color={COLORS.vert} style={{ marginTop: SPACING.lg }} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.contentCentre}>
        <Text style={styles.titre}>Rejoindre l'espace de {nomInvitant}</Text>
        <Text style={styles.sousTitre}>
          Créez votre compte. {nomInvitant} validera ensuite votre arrivée.
        </Text>

        {refus ? <Text style={styles.refus}>{refus}</Text> : null}

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

        <Text style={styles.label}>Code à 6 chiffres</Text>
        <Text style={styles.aideCode}>
          {nomInvitant} vous l'a transmis séparément du lien — par téléphone, de vive voix ou par
          un autre message. Le lien seul ne suffit pas.
        </Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="123456"
          placeholderTextColor={COLORS.ardoise}
          keyboardType="number-pad"
          maxLength={7}
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
  refus: {
    fontFamily: FONTS.body, fontSize: 12, color: COLORS.erreur,
    lineHeight: 17, marginTop: SPACING.sm,
  },
  aideCode: {
    fontFamily: FONTS.body, fontSize: 11, color: COLORS.ardoise,
    lineHeight: 16, marginBottom: SPACING.xs,
  },
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
