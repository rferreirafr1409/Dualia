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
import { lienApplication } from '../constants/liens';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { AIDE_MOT_DE_PASSE, validerMotDePasse, traduireErreurAuth } from '../constants/motDePasse';
import {
  lireInvitationEnAttente,
  memoriserInvitationEnAttente,
  oublierInvitationEnAttente,
} from '../lib/invitationEnAttente';

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

  // Adresse du compte deja connecte sur cet appareil, s'il y en a un. Quand
  // elle correspond a l'adresse saisie, le mot de passe n'a plus rien a
  // prouver : on ne le redemande pas. C'est le cas d'un co-parent revenu
  // par le lien de l'e-mail de confirmation, ou passe par l'ecran de
  // connexion avant de rouvrir le lien.
  const [emailSession, setEmailSession] = useState<string | null>(null);
  useEffect(() => {
    let vivant = true;
    supabase.auth.getSession().then(({ data }) => {
      if (vivant) setEmailSession(data.session?.user.email?.toLowerCase() ?? null);
    });
    return () => { vivant = false; };
  }, []);
  const sessionCorrespond =
    !!emailSession && emailSession === email.trim().toLowerCase();

  // Ce qui a deja ete saisi pour ce lien revient tout seul : le detour par
  // l'e-mail de confirmation ne doit pas effacer le formulaire.
  useEffect(() => {
    if (!token) return;
    let vivant = true;
    lireInvitationEnAttente().then((memo) => {
      if (!vivant) return;
      if (memo && memo.token === token) {
        if (memo.prenom) setPrenom((p) => p || memo.prenom!);
        if (memo.email) setEmail((e) => e || memo.email!);
      }
      memoriserInvitationEnAttente({ token });
    });
    return () => { vivant = false; };
  }, [token]);

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
  // On arrive aussi ici SANS jeton : l'application y renvoie tout compte
  // dont la demande attend une validation, precisement pour qu'il retrouve
  // sa salle d'attente sans avoir a remettre la main sur le SMS d'origine.
  // Tant que cette question n'a pas de reponse, on ne declare pas le lien
  // invalide — sinon ce parent lisait « ce lien n'est pas valide » alors que
  // sa demande suivait son cours.
  const [demandeVerifiee, setDemandeVerifiee] = useState(false);

  useEffect(() => {
    let vivant = true;
    supabase.rpc('etat_de_ma_demande').then(({ data }) => {
      if (!vivant) return;
      if (data === 'en_attente_validation') setEnAttente(true);
      setDemandeVerifiee(true);
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
        oublierInvitationEnAttente();
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
    if (!sessionCorrespond) {
      const probleme = validerMotDePasse(motDePasse);
      if (probleme) {
        alertCompat('Mot de passe trop faible', probleme);
        return;
      }
    }

    if (token) {
      memoriserInvitationEnAttente({ token, prenom: prenom.trim(), email: email.trim() });
    }

    setChargement(true);
    try {
      // Trois situations mènent ici, et l'écran doit les traverser toutes :
      //   - compte à créer, sans confirmation d'e-mail : session immédiate ;
      //   - compte à créer AVEC confirmation obligatoire : pas de session,
      //     il faut confirmer puis revenir sur ce même lien ;
      //   - compte déjà existant : on se connecte au lieu de s'inscrire.
      //
      // La version précédente ne connaissait que la première. Activer la
      // confirmation d'e-mail — ce qu'on veut faire — condamnait donc toute
      // arrivée de co-parent : inscription impossible, connexion inexistante.
      const { data: dejaConnecte } = await supabase.auth.getSession();
      let session = dejaConnecte.session;

      // Une session d'un AUTRE compte traine souvent dans ce navigateur : le
      // parent qui invite vient de creer son espace sur ce meme telephone,
      // puis tend l'appareil au co-parent. Avant ce garde-fou, l'adresse
      // saisie etait ignoree et la demande partait au nom du parent connecte,
      // qui lisait « Ce compte appartient deja a un espace familial » (vu le
      // 10 octobre 2026 chez un couple testeur). On repart de l'adresse saisie.
      const emailSaisi = email.trim().toLowerCase();
      if (session && (session.user.email ?? '').toLowerCase() !== emailSaisi) {
        await supabase.auth.signOut();
        session = null;
      }

      if (!session) {
        // D'abord la connexion : un compte deja confirme (co-parent revenu
        // par le lien de l'e-mail, ou qui recommence) doit entrer avec son
        // mot de passe. Avant, on tentait l'inscription en premier ; pour
        // une adresse deja confirmee, Supabase repond alors SANS erreur et
        // sans session (anti-enumeration) et n'envoie aucun e-mail : l'ecran
        // promettait un message qui n'arrivait jamais (10 octobre 2026).
        const { data: connexion, error: erreurConnexion } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: motDePasse,
          });
        if (!erreurConnexion && connexion.session) {
          session = connexion.session;
        } else if (erreurConnexion && !/invalid login credentials/i.test(erreurConnexion.message ?? '')) {
          // Adresse non confirmee, trop d'essais... : on le dit tel quel.
          throw erreurConnexion;
        }
      }

      if (!session) {
        // emailRedirectTo ramene sur CE lien d'invitation, jeton compris.
        // Sans lui, Supabase renvoie vers la « Site URL » du projet : le
        // jeton disparaissait de l'URL, et la personne devait retrouver le
        // SMS d'origine pour reprendre — ou renoncer.
        const { data: inscription, error: erreurInscription } = await supabase.auth.signUp({
          email: email.trim(),
          password: motDePasse,
          options: { emailRedirectTo: lienApplication('rejoindre', { token }) },
        });

        // Compte existant mais mot de passe faux : soit une erreur explicite,
        // soit (confirmation d'e-mail activee) un utilisateur factice sans
        // identite et sans session. Dans les deux cas, pas d'e-mail envoye.
        const dejaInscrit =
          (erreurInscription &&
            /already registered|already been registered|user already exists/i.test(
              erreurInscription.message ?? ''
            )) ||
          (!erreurInscription &&
            !inscription.session &&
            (inscription.user?.identities?.length ?? 0) === 0);

        if (dejaInscrit) {
          setRefus(
            "Un compte existe déjà avec cette adresse, mais le mot de passe ne correspond pas. Réessayez, ou passez par « Mot de passe oublié » sur l'écran de connexion."
          );
          setChargement(false);
          return;
        } else if (erreurInscription) {
          throw erreurInscription;
        } else if (!inscription.session) {
          alertCompat(
            'Confirmez votre adresse',
            Platform.OS === 'web'
              ? "Un e-mail vient de vous être envoyé. Cliquez sur le lien qu'il contient : il vous ramènera sur cette page. Il vous restera à ressaisir le code et votre mot de passe, puis votre demande sera déposée."
              : "Un e-mail vient de vous être envoyé. Cliquez sur le lien qu'il contient : il s'ouvre dans votre navigateur et confirme votre adresse. Revenez ensuite dans l'application Dualia, ressaisissez le code et votre mot de passe, puis votre demande sera déposée."
          );
          setChargement(false);
          return;
        } else {
          session = inscription.session;
        }
      }

      if (!session) {
        alertCompat('Connexion impossible', "Réessayez dans un instant.");
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
      oublierInvitationEnAttente();
    } catch (err: any) {
      alertCompat('Erreur', traduireErreurAuth(err?.message));
    } finally {
      setChargement(false);
    }
  };

  // Le nom de l'invitant vient du jeton : arrivé sans jeton, on ne l'a pas.
  // La phrase doit donc tenir dans les deux cas.
  const salleDAttente = () => (
    <View style={styles.screen}>
      <View style={styles.contentCentre}>
        <Text style={styles.titre}>Demande envoyée</Text>
        <Text style={styles.sousTitre}>
          {nomInvitant
            ? `${nomInvitant} doit maintenant valider votre arrivée.`
            : "L'autre parent doit maintenant valider votre arrivée."}{' '}
          Vous verrez l'espace familial dès que ce sera fait — vous pouvez laisser cette page
          ouverte.
        </Text>
        <ActivityIndicator size="small" color={COLORS.vert} style={{ marginTop: SPACING.lg }} />
      </View>
    </View>
  );

  // Une demande en cours passe AVANT tout : elle vaut pour elle-meme, jeton
  // ou pas. C'est ce qui permet a ce parent de revenir par l'adresse
  // ordinaire de Dualia, des jours plus tard, et de retrouver sa demande.
  if (enAttente) {
    return salleDAttente();
  }

  if (verification === 'en_cours' || !demandeVerifiee) {
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
          {sessionCorrespond
            ? `Vous êtes connecté. Saisissez le code reçu : ${nomInvitant} validera ensuite votre arrivée.`
            : `Créez votre compte. ${nomInvitant} validera ensuite votre arrivée.`}
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

        {sessionCorrespond ? (
          <Text style={styles.aide}>Compte connecté : {emailSession}. Pas besoin de mot de passe.</Text>
        ) : (
          <>
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
          </>
        )}

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
  // Colonne de formulaire : pleine largeur sur telephone, bornee et centree
  // sur grand ecran, pour ne pas etirer les champs d'un bord a l'autre.
  contentCentre: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.xl, width: '100%', maxWidth: 560, alignSelf: 'center' },
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
