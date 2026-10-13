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
import { aideMotDePasse, validerMotDePasse, traduireErreurAuth } from '../constants/motDePasse';
import { TRADUCTIONS } from '../constants/i18n';
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
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].rejoindre;

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

  const erreurMotDePasse = motDePasse.length > 0 ? validerMotDePasse(motDePasse, langue) : null;

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
        setRefus(t.refusee);
      } else if (data === 'expiree' || data === 'revoquee') {
        setEnAttente(false);
        setRefus(t.lienPlusValide);
      } else if (data == null) {
        // Plus aucune demande a notre nom : le lien a ete regenere, ou la
        // ligne a disparu. Sans cette branche, l'ecran tournait
        // indefiniment sur un sablier qui ne menait nulle part.
        setEnAttente(false);
        setRefus(t.demandePlusSuivie);
      }
    };
    demander();
    const minuteur = setInterval(demander, 10000);
    return () => { vivant = false; clearInterval(minuteur); };
  }, [enAttente, router]);

  // Les codes d'erreur du serveur, et ce qu'on en dit a la personne.
  const MESSAGES: Record<string, string> = t.messages;

  const rejoindre = async () => {
    if (!prenom.trim() || !email.trim()) {
      alertCompat(t.champsIncompletsTitre, t.champsIncompletsCorps);
      return;
    }
    if (!/^\d{6}$/.test(code.replace(/\s/g, ''))) {
      alertCompat(t.codeManquantTitre, t.codeManquantCorps);
      return;
    }
    if (!sessionCorrespond) {
      const probleme = validerMotDePasse(motDePasse, langue);
      if (probleme) {
        alertCompat(t.motDePasseFaibleTitre, probleme);
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
          setRefus(t.compteExistant);
          setChargement(false);
          return;
        } else if (erreurInscription) {
          throw erreurInscription;
        } else if (!inscription.session) {
          alertCompat(
            t.confirmezAdresseTitre,
            Platform.OS === 'web' ? t.confirmezAdresseWeb : t.confirmezAdresseMobile
          );
          setChargement(false);
          return;
        } else {
          session = inscription.session;
        }
      }

      if (!session) {
        alertCompat(t.connexionImpossibleTitre, t.connexionImpossibleCorps);
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
        setRefus(MESSAGES[etat as string] ?? t.demandeNonAboutie);
        setChargement(false);
        return;
      }

      setRefus(null);
      setEnAttente(true);
      oublierInvitationEnAttente();
    } catch (err: any) {
      alertCompat(t.erreurTitre, traduireErreurAuth(err?.message, langue));
    } finally {
      setChargement(false);
    }
  };

  // Le nom de l'invitant vient du jeton : arrivé sans jeton, on ne l'a pas.
  // La phrase doit donc tenir dans les deux cas.
  const salleDAttente = () => (
    <View style={styles.screen}>
      <View style={styles.contentCentre}>
        <Text style={styles.titre}>{t.demandeEnvoyeeTitre}</Text>
        <Text style={styles.sousTitre}>
          {nomInvitant ? t.doitValider(nomInvitant) : t.autreParentDoitValider}{' '}
          {t.attenteSuite}
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
          <Text style={styles.titre}>{t.lienInvalideTitre}</Text>
          <Text style={styles.sousTitre}>{t.lienInvalideCorps}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.contentCentre}>
        <Text style={styles.titre}>{t.titre(nomInvitant)}</Text>
        <Text style={styles.sousTitre}>
          {sessionCorrespond ? t.sousTitreConnecte(nomInvitant) : t.sousTitreCreer(nomInvitant)}
        </Text>

        {refus ? <Text style={styles.refus}>{refus}</Text> : null}

        <Text style={styles.label}>{t.votrePrenom}</Text>
        <TextInput
          style={styles.input}
          value={prenom}
          onChangeText={setPrenom}
          placeholder={t.prenomPlaceholder}
          placeholderTextColor={COLORS.ardoise}
        />

        <Text style={styles.label}>{t.email}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder={t.emailPlaceholder}
          placeholderTextColor={COLORS.ardoise}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>{t.code}</Text>
        <Text style={styles.aideCode}>{t.codeAide(nomInvitant)}</Text>
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
          <Text style={styles.aide}>{t.compteConnecte(emailSession)}</Text>
        ) : (
          <>
            <Text style={styles.label}>{t.motDePasse}</Text>
            <TextInput
              style={[styles.input, !!erreurMotDePasse && styles.inputErreur]}
              value={motDePasse}
              onChangeText={setMotDePasse}
              placeholder={aideMotDePasse(langue)}
              placeholderTextColor={COLORS.ardoise}
              secureTextEntry
            />
            <Text style={[styles.aide, !!erreurMotDePasse && styles.aideErreur]}>
              {erreurMotDePasse ?? aideMotDePasse(langue)}
            </Text>
          </>
        )}

        <Pressable style={styles.boutonPrincipal} onPress={rejoindre} disabled={chargement}>
          {chargement ? (
            <ActivityIndicator color={COLORS.blanc} />
          ) : (
            <Text style={styles.boutonPrincipalTexte}>{t.rejoindre}</Text>
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
