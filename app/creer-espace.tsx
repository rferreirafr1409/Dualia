// app/creer-espace.tsx
// Premier écran vu par un parent qui n'a pas encore de compte. Crée un
// compte Supabase, puis une famille via la fonction creer_famille(), et
// redirige vers configurer-foyer.tsx — la question du lien d'invitation
// (creer-espace-lien.tsx) vient après, une fois les foyers configurés.
//
// La règle de mot de passe vit dans constants/motDePasse.ts et doit rester
// alignée sur la configuration Supabase : sinon l'écran accepte ce que le
// serveur refuse, et le parent reçoit une erreur brute en anglais.
//
// TROIS ÉTATS, et le deuxième est la raison de cette réécriture.
//
// La confirmation d'adresse est désormais obligatoire côté Supabase. Or
// signUp() ne rend alors AUCUNE session : l'écran s'arrêtait donc avant
// creer_famille(), affichait « reviens te connecter », et l'espace familial
// n'était jamais fabriqué. La personne confirmait, se connectait, et
// atterrissait sur un accueil vide — définitivement, puisque cet écran-ci
// n'est proposé qu'aux visiteurs SANS session. Deux comptes réels étaient
// déjà dans cet état.
//
//   'inscription'  : aucun compte. Formulaire complet.
//   'confirmation' : compte créé, adresse à confirmer. Rien d'autre à faire.
//   'reprise'      : session valide, mais aucun espace familial rattaché.
//                    On ne réinscrit pas : on fabrique l'espace qui manque.
//
// L'état 'reprise' ne se déduit pas de familleId, qui vaut aussi null
// pendant un chargement ou hors ligne. Il vient de compteSansEspace, que le
// store ne met à true que sur une réponse claire du serveur.

import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { supabase } from '../constants/supabase';
import { useStore } from '../store/useStore';
import { lienApplication } from '../constants/liens';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { AIDE_MOT_DE_PASSE, validerMotDePasse, traduireErreurAuth } from '../constants/motDePasse';

function alertCompat(titre: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${titre}\n\n${message}` : titre);
  } else {
    Alert.alert(titre, message);
  }
}

// Le prénom est saisi AVANT la confirmation d'adresse, et c'est lui que
// creer_famille() attend. Entre les deux, la personne quitte l'application,
// ouvre sa boîte mail, parfois change d'appareil. On le garde donc de côté
// pour le retrouver au retour plutôt que de le redemander sans expliquer
// pourquoi. Ce n'est qu'un confort : s'il a disparu, l'écran le redemande.
// Les deux clés portent l'identifiant du compte.
//
// Sans lui, un ordinateur familial les faisait passer d'une personne à
// l'autre : le second parent à s'inscrire sur la même machine récupérait le
// prénom du premier, préremseigné dans un champ qu'on valide sans le
// relire — et son espace, comme son profil, prenait le prénom de l'autre.
// La clé de rejeu, elle, appartenait au navigateur : réutilisée par le
// second compte, elle se heurtait à l'index unique de la base et bloquait
// l'inscription sur une erreur Postgres brute, à chaque essai.
const CLE_PRENOM = 'dualia_prenom_inscription';

function memoriserPrenom(userId: string, prenom: string) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try { window.localStorage.setItem(`${CLE_PRENOM}:${userId}`, prenom); } catch {}
}

function lirePrenomMemorise(userId: string): string {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return '';
  try { return window.localStorage.getItem(`${CLE_PRENOM}:${userId}`) ?? ''; } catch { return ''; }
}

// Clé de rejeu de la création d'espace.
//
// Elle accompagne l'appel à creer_famille() : si la réponse HTTP se perd
// alors que la création a réussi côté serveur, le même appel avec la même
// clé rend l'espace déjà créé au lieu d'en ajouter un second. Elle survit
// donc à un rechargement de page, tant que l'inscription n'est pas finie.
//
// Pas de clé de secours bricolée : sans générateur aléatoire sûr, on
// n'envoie rien. Une clé devinable serait pire que pas de clé, puisque la
// base porte un index unique dessus — deux comptes tirant la même valeur se
// bloqueraient mutuellement.
const CLE_CREATION = 'dualia_cle_creation_espace';

function cleCreationPersistante(userId: string): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const cle = `${CLE_CREATION}:${userId}`;
    const existante = window.localStorage.getItem(cle);
    if (existante) return existante;
    const generateur = window.crypto;
    if (!generateur || typeof generateur.randomUUID !== 'function') return null;
    const neuve = generateur.randomUUID();
    window.localStorage.setItem(cle, neuve);
    return neuve;
  } catch {
    return null;
  }
}

function oublierBrouillon(userId: string) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`${CLE_PRENOM}:${userId}`);
    window.localStorage.removeItem(`${CLE_CREATION}:${userId}`);
  } catch {}
}

// Jetons deposes par le script de app/+html.tsx quand on arrive depuis un
// lien d'e-mail. Le client Supabase est volontairement configure avec
// detectSessionInUrl: false — indispensable au pre-rendu statique — donc
// personne ne ramasse ces jetons si un ecran ne le fait pas lui-meme.
//
// Sans cette lecture, cliquer « Confirmer mon adresse » ramenait ici SANS
// session : l'ecran reproposait une inscription, et le serveur repondait
// « adresse deja utilisee ». Le parent etait bloque par le lien meme qui
// devait le debloquer.
const CLE_JETONS = 'dualia_reset_tokens';

type JetonsEmail = { access_token: string; refresh_token: string; type: string };

// Lecture PURE : aucune suppression ici. La version precedente effaçait la
// cle dans l'initialiseur d'un useState, c'est-a-dire pendant le rendu —
// exactement ce que React se reserve le droit de rejouer. Un second appel
// rendait alors null, et le parent qui venait de confirmer son adresse se
// voyait reproposer une inscription, a laquelle le serveur repond « adresse
// deja utilisee » : le blocage meme que cet ecran doit supprimer.
//
// La cle est retiree dans l'effet, apres une ouverture de session reussie.
function lireJetonsEmail(): JetonsEmail | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    const brut = window.sessionStorage.getItem(CLE_JETONS);
    if (!brut) return null;
    const parsed = JSON.parse(brut);
    if (!parsed?.access_token || !parsed?.refresh_token) return null;
    return {
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
      type: typeof parsed.type === 'string' ? parsed.type : '',
    };
  } catch {
    return null;
  }
}

function oublierJetonsEmail() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try { window.sessionStorage.removeItem(CLE_JETONS); } catch {}
}

type Etat = 'inscription' | 'confirmation' | 'deja_inscrit' | 'reprise' | 'deja_installe';

export default function CreerEspaceScreen() {
  const router = useRouter();
  const rattachement = useStore((s) => s.rattachement);
  const [etat, setEtat] = useState<Etat>('inscription');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  // CGU et politique acceptées explicitement (DUA-105) : la case est
  // obligatoire, et la date d'acceptation part dans les métadonnées du compte.
  const [conditionsAcceptees, setConditionsAcceptees] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [renvoye, setRenvoye] = useState(false);
  // Lecture sans effet de bord (voir lireJetonsEmail). Un jeton qui n'est pas
  // de type 'signup' ne nous appartient pas : on le laisse a son ecran.
  const [jetons] = useState(() => lireJetonsEmail());
  const jetonsInscription = jetons?.type === 'signup' ? jetons : null;
  const [ouvertureSession, setOuvertureSession] = useState(!!jetonsInscription);
  // Empeche de recreer un espace si la creation a reussi mais qu'une etape
  // suivante a echoue : sans cette memoire, le bouton redevenait actif et un
  // second appui fabriquait un DEUXIEME espace familial.
  const espaceDejaCree = React.useRef<string | null>(null);
  const cleCreation = React.useRef<string | null>(null);
  // Vrai pendant la fabrication : l'effet qui suit `rattachement` ne doit pas
  // changer d'écran sous les pieds d'une opération en cours.
  const fabricationEnCours = React.useRef(false);

  // Message affiché sous le champ pendant la saisie, plutôt qu'une alerte
  // au moment de valider : le parent voit ce qui manque au fur et à mesure.
  const erreurMotDePasse = motDePasse.length > 0 ? validerMotDePasse(motDePasse) : null;

  // Arrivée depuis le lien de confirmation : on ouvre la session avec les
  // jetons que Supabase a joints à la redirection, puis on laisse le store
  // constater qu'aucun espace familial n'est rattaché — ce qui fait basculer
  // l'écran en 'reprise' juste en dessous.
  // Un jeton de réinitialisation de mot de passe peut atterrir ici : si
  // /reinitialiser-mot-de-passe n'est pas dans la liste des URL autorisées
  // de Supabase, le lien retombe sur la page d'accueil du projet, qui nous
  // renvoie ici. Sans ce renvoi, la personne qui a cliqué « choisir un
  // nouveau mot de passe » se voyait proposer de créer un compte, ses jetons
  // intacts dans le stockage et aucun écran pour les utiliser.
  useEffect(() => {
    if (!jetons || jetons.type !== 'recovery') return;
    router.replace('/reinitialiser-mot-de-passe' as any);
  }, [jetons, router]);

  useEffect(() => {
    if (!jetonsInscription) return;
    let vivant = true;
    (async () => {
      // Sans ce filet, une exception ici laisserait le rond de chargement
      // tourner pour toujours — et comme le jeton ne serait pas consommé, un
      // rechargement reproduirait exactement le même blocage.
      try {
      const { error } = await supabase.auth.setSession({
        access_token: jetonsInscription.access_token,
        refresh_token: jetonsInscription.refresh_token,
      });
      if (!vivant) return;
      if (error) {
        // Lien déjà utilisé, ou expiré. L'adresse est peut-être confirmée
        // malgré tout : la connexion normale est alors le bon chemin, et
        // c'est plus honnête que de reproposer une inscription qui se
        // heurterait à « adresse déjà utilisée ».
        console.error('[Dualia] Session de confirmation refusée :', error);
        setOuvertureSession(false);
        alertCompat(
          'Lien expiré',
          "Ce lien de confirmation n'est plus valable. Connectez-vous avec votre adresse et votre mot de passe : la suite se fera automatiquement."
        );
        router.replace('/connexion' as any);
        return;
      }

      // La session est ouverte : le jeton a servi, on le retire.
      oublierJetonsEmail();

      // On vide AVANT de recharger. Si un autre compte était connecté dans
      // cet onglet, son chargement peut encore être en vol : ses requêtes
      // restantes partiraient désormais sous la nouvelle identité et
      // écriraient des collections vides dans le stockage local. La purge
      // fait avancer le compteur de génération, ce qui condamne ce
      // chargement périmé au lieu de le laisser écrire.
      useStore.getState().purgerDonneesFamiliales();

      await useStore.getState().initialiserSession();
      if (!vivant) return;
      setOuvertureSession(false);
      } catch (e) {
        console.error('[Dualia] Ouverture de session depuis le lien interrompue :', e);
        if (!vivant) return;
        oublierJetonsEmail();
        setOuvertureSession(false);
        alertCompat(
          'Connexion interrompue',
          'Votre adresse est confirmée, mais la session n’a pas pu s’ouvrir. Connectez-vous avec votre adresse et votre mot de passe.'
        );
        router.replace('/connexion' as any);
      }
    })();
    return () => { vivant = false; };
  }, [jetonsInscription, router]);

  // Le store tranche après le montage : on ne passe en reprise qu'à ce
  // moment-là. On ne sort JAMAIS de 'confirmation' par cette voie — la
  // personne y est sans session, et l'en arracher lui ferait perdre la seule
  // consigne utile qu'elle ait à l'écran.
  //
  // 'parent' amène ici aussi : l'écran de connexion propose « Je n'ai pas
  // encore de compte », et un parent déjà installé qui clique dessus voyait
  // un formulaire d'inscription qui ne pouvait qu'échouer sur sa propre
  // adresse.
  useEffect(() => {
    if (fabricationEnCours.current) return;
    if (rattachement === 'jamais_rattache') {
      setEtat((precedent) => (precedent === 'confirmation' ? precedent : 'reprise'));
      return;
    }
    if (rattachement === 'parent') {
      setEtat((precedent) => (precedent === 'confirmation' ? precedent : 'deja_installe'));
    }
  }, [rattachement]);

  // En reprise, on affiche sous quel compte on se trouve : arriver ici par
  // une redirection, sans savoir qui est connecté, est le meilleur moyen de
  // fabriquer un espace sur le mauvais compte.
  const [emailConnecte, setEmailConnecte] = useState<string | null>(null);
  useEffect(() => {
    if (etat !== 'reprise') return;
    let vivant = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!vivant) return;
      const utilisateur = data.session?.user;
      setEmailConnecte(utilisateur?.email ?? null);
      const memorise = utilisateur?.id ? lirePrenomMemorise(utilisateur.id) : '';
      if (memorise) setPrenom((actuel) => actuel || memorise);
    })();
    return () => { vivant = false; };
  }, [etat]);

  // Fabrique l'espace familial pour une session déjà ouverte. C'est le
  // deuxième temps de l'inscription, et il vit séparément justement parce
  // qu'il doit pouvoir s'exécuter des heures après le premier.
  const fabriquerEspace = async (nom: string) => {
    // Les deux clés de brouillon sont rangées sous l'identifiant du compte :
    // sans session, on n'a rien à faire ici.
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) {
      throw new Error('Votre session a expiré. Reconnectez-vous et reprenez où vous en étiez.');
    }

    // Un espace a déjà été créé lors d'une tentative précédente : on reprend
    // après le RPC au lieu d'en fabriquer un second. Quatre étapes se
    // suivent ici et les trois dernières peuvent échouer sur un réseau
    // hésitant ; sans cette mémoire, le bouton redevenait actif et un second
    // appui donnait au compte DEUX espaces, dont un vide — indiscernables
    // dans le sélecteur.
    let familleCree = espaceDejaCree.current;

    if (!familleCree) {
      // p_cle_creation rend l'appel rejouable côté serveur : si la réponse
      // HTTP se perd alors que la création a réussi, le même appel rend
      // l'espace déjà créé au lieu d'en ajouter un.
      if (!cleCreation.current) cleCreation.current = cleCreationPersistante(userId);

      const { data: creation, error: familleError } = await supabase.rpc('creer_famille', {
        p_nom: nom,
        p_cle_creation: cleCreation.current,
      });
      if (familleError) {
        // Le message du serveur est technique — contrainte d'unicité, nom de
        // colonne. Le montrer tel quel n'aide personne et inquiète.
        console.error('[Dualia] Création de l’espace familial refusée :', familleError);
        throw new Error("L'espace familial n'a pas pu être créé. Réessayez dans un instant.");
      }

      const nouvelle = Array.isArray(creation) ? creation[0] : creation;
      familleCree = nouvelle?.famille_id ?? null;
      if (!familleCree) {
        throw new Error("L'espace familial n'a pas pu être créé. Réessayez dans un instant.");
      }
      espaceDejaCree.current = familleCree;
    }

    // La création de compte est une navigation interne (SPA), pas un
    // rechargement de page — sans cet appel explicite, le store garde
    // ses valeurs par défaut jusqu'au prochain F5 involontaire.
    // On force ici le chargement de la vraie session.
    await useStore.getState().initialiserSession();

    // Un compte peut désormais avoir plusieurs espaces. On rend ACTIF
    // celui qu'on vient de créer : sans cela, l'écran suivant
    // configurerait les foyers d'un autre espace, celui qui se serait
    // trouvé chargé par défaut.
    await useStore.getState().changerEspaceFamilial(familleCree);

    // On ne part vers la configuration des foyers que si l'espace est
    // réellement chargé. `changerEspaceFamilial` peut laisser familleId à
    // null quand une requête échoue, et configurer-foyer envoie alors un
    // identifiant nul au serveur : erreur brute, sur un écran sans bouton
    // retour et exempté de toutes les gardes. Le seul recours était de
    // recharger la page à la main.
    if (useStore.getState().familleId !== familleCree) {
      throw new Error(
        "Votre espace a bien été créé, mais n'a pas pu être chargé. Vérifiez votre connexion et réessayez."
      );
    }

    oublierBrouillon(userId);
    router.replace('/configurer-foyer' as any);
  };

  // Un échec en cours de fabrication laisse l'écran dans un état qui ment.
  //
  // fabriquerEspace appelle initialiserSession dès l'espace créé : le store
  // passe donc à 'parent', et l'effet ci-dessus basculait l'écran sur « Vous
  // êtes déjà connecté — il n'y a rien à créer », dont le seul bouton mène à
  // un accueil vide. Le bouton « Créer mon espace », lui, avait disparu. On
  // revient donc explicitement à l'écran de reprise, avec de quoi réessayer.
  const echouer = (err: any) => {
    setEtat('reprise');
    alertCompat('Erreur', traduireErreurAuth(err?.message));
  };

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
    if (!conditionsAcceptees) {
      alertCompat('Conditions à accepter', "Coche la case pour accepter les conditions d'utilisation et la politique de confidentialité.");
      return;
    }

    setChargement(true);
    fabricationEnCours.current = true;
    try {
      // emailRedirectTo : sans lui, le lien de confirmation renvoie vers la
      // « Site URL » du projet Supabase — par défaut http://localhost:3000,
      // c'est-à-dire une page morte pour la personne qui vient de cliquer.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: motDePasse,
        options: {
          emailRedirectTo: lienApplication('creer-espace'),
          data: { cgu_acceptees_at: new Date().toISOString() },
        },
      });

      if (authError) throw authError;

      // Adresse deja inscrite. Supabase ne le dit pas en clair — ce serait
      // reveler qui possede un compte — mais il rend un utilisateur dont la
      // liste d'identites est VIDE, et n'envoie aucun e-mail.
      //
      // Sans ce test, l'ecran « Confirmez votre adresse » s'affichait quand
      // meme : la personne attendait un message qui ne partirait jamais, et
      // le bouton « Renvoyer l'e-mail » ne renvoyait rien non plus. Elle
      // n'avait aucun moyen de comprendre, ni aucun chemin vers la
      // connexion depuis cette page.
      const identites = (authData.user as { identities?: unknown[] } | null)?.identities;
      if (authData.user && Array.isArray(identites) && identites.length === 0) {
        setEtat('deja_inscrit');
        setChargement(false);
        return;
      }

      if (authData.user?.id) memoriserPrenom(authData.user.id, prenom.trim());

      if (!authData.session) {
        // Confirmation d'adresse obligatoire : il n'y a pas de session, donc
        // pas d'espace possible pour l'instant. On le dit clairement au lieu
        // de laisser croire que l'inscription a échoué.
        setEtat('confirmation');
        setChargement(false);
        return;
      }

      await fabriquerEspace(prenom.trim());
    } catch (err: any) {
      // On reste sur le formulaire. `echouer` bascule vers l'écran de
      // reprise, qui suppose un compte confirmé et une session ouverte :
      // c'est le bon écran quand la création d'espace échoue APRÈS
      // l'inscription, et un piège quand c'est l'inscription elle-même qui a
      // échoué. Une adresse mal tapée — « marie » au lieu de
      // « marie@… » — faisait disparaître le formulaire au profit de
      // « Terminons votre espace familial », sans aucun compte derrière et
      // sans aucun chemin de retour : le bouton y relançait la même erreur
      // indéfiniment.
      alertCompat('Erreur', traduireErreurAuth(err?.message));
    } finally {
      fabricationEnCours.current = false;
      setChargement(false);
    }
  };

  const reprendre = async () => {
    if (!prenom.trim()) {
      alertCompat('Champ requis', 'Renseigne ton prénom.');
      return;
    }
    setChargement(true);
    fabricationEnCours.current = true;
    try {
      await fabriquerEspace(prenom.trim());
    } catch (err: any) {
      echouer(err);
    } finally {
      fabricationEnCours.current = false;
      setChargement(false);
    }
  };

  const renvoyerConfirmation = async () => {
    setChargement(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: lienApplication('creer-espace') },
    });
    setChargement(false);
    if (error) {
      alertCompat('Envoi impossible', traduireErreurAuth(error.message));
      return;
    }
    setRenvoye(true);
  };

  // Sortie de secours : une redirection a pu amener ici sous un compte qui
  // n'est pas celui que la personne voulait. Sans ce bouton, elle n'a aucun
  // moyen d'en changer sans deviner que « Se déconnecter » se trouve à
  // l'autre bout de l'application, derrière un espace familial qu'elle n'a
  // pas encore.
  const changerDeCompte = async () => {
    setChargement(true);
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (userId) oublierBrouillon(userId);
    await useStore.getState().seDeconnecter();
    setChargement(false);
    router.replace('/connexion' as any);
  };

  // Le temps d'établir la session depuis le lien d'e-mail. Afficher le
  // formulaire d'inscription pendant cette seconde-là inviterait à se
  // réinscrire alors que le compte existe déjà.
  if (ouvertureSession) {
    return (
      <View style={styles.centreEcran}>
        <ActivityIndicator size="large" color={COLORS.vert} />
      </View>
    );
  }

  if (etat === 'confirmation') {
    return (
      <View style={styles.screen}>
        <View style={styles.contentCentre}>
          <Text style={styles.titre}>Confirmez votre adresse</Text>
          <Text style={styles.sousTitre}>
            Un e-mail vient d'être envoyé à {email.trim()}. Ouvrez-le et cliquez sur le lien : votre
            espace familial se crée juste après — il ne vous restera qu'à confirmer votre prénom.
          </Text>
          {Platform.OS !== 'web' && (
            <Text style={styles.sousTitre}>
              Le lien s'ouvre dans votre navigateur. Une fois votre adresse confirmée, revenez dans
              l'application Dualia et connectez-vous avec votre e-mail et votre mot de passe.
            </Text>
          )}
          <Text style={styles.aide}>
            L'e-mail met parfois quelques minutes à arriver, et se range volontiers dans les
            indésirables.
          </Text>

          {renvoye ? (
            <Text style={styles.confirmation}>Un nouvel e-mail a été envoyé.</Text>
          ) : (
            <Pressable style={styles.boutonPrincipal} onPress={renvoyerConfirmation} disabled={chargement}>
              {chargement ? (
                <ActivityIndicator color={COLORS.blanc} />
              ) : (
                <Text style={styles.boutonPrincipalTexte}>Renvoyer l'e-mail</Text>
              )}
            </Pressable>
          )}

          <Pressable onPress={() => setEtat('inscription')}>
            <Text style={styles.lienTexteSecondaire}>Corriger mon adresse</Text>
          </Pressable>

          {/* La sortie. Elle manquait, et cette page n'en avait aucune
              autre : qui arrivait ici par erreur ne pouvait que patienter
              devant un e-mail ou refaire son adresse. */}
          <Pressable onPress={() => router.replace('/connexion' as any)}>
            <Text style={styles.lienTexteSecondaire}>J'ai déjà un compte — me connecter</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (etat === 'deja_inscrit') {
    return (
      <View style={styles.screen}>
        <View style={styles.contentCentre}>
          <Text style={styles.titre}>Cette adresse a déjà un compte</Text>
          <Text style={styles.sousTitre}>
            {email.trim()} est déjà inscrite sur Dualia. Aucun e-mail n'a été envoyé : il n'y a
            rien à confirmer, il suffit de vous connecter.
          </Text>

          <Pressable
            style={styles.boutonPrincipal}
            onPress={() => router.replace('/connexion' as any)}
          >
            <Text style={styles.boutonPrincipalTexte}>Me connecter</Text>
          </Pressable>

          <Pressable onPress={() => router.replace('/mot-de-passe-oublie' as any)}>
            <Text style={styles.lienTexteSecondaire}>J'ai oublié mon mot de passe</Text>
          </Pressable>

          <Pressable onPress={() => setEtat('inscription')}>
            <Text style={styles.lienTexteSecondaire}>Utiliser une autre adresse</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Parent déjà installé arrivé ici par « Je n'ai pas encore de compte » sur
  // l'écran de connexion. Le formulaire d'inscription ne pouvait qu'échouer
  // sur sa propre adresse.
  if (etat === 'deja_installe') {
    return (
      <View style={styles.screen}>
        <View style={styles.contentCentre}>
          <Text style={styles.titre}>Vous êtes déjà connecté</Text>
          <Text style={styles.sousTitre}>
            Votre espace familial existe et vous y êtes. Il n'y a rien à créer.
          </Text>

          <Pressable
            style={styles.boutonPrincipal}
            onPress={() => router.replace('/(tabs)/accueil' as any)}
          >
            <Text style={styles.boutonPrincipalTexte}>Aller à mon espace</Text>
          </Pressable>

          <Pressable onPress={changerDeCompte}>
            <Text style={styles.lienTexteSecondaire}>Utiliser un autre compte</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (etat === 'reprise') {
    return (
      <View style={styles.screen}>
        <View style={styles.contentCentre}>
          <Text style={styles.titre}>Terminons votre espace familial</Text>
          <Text style={styles.sousTitre}>
            Votre compte est bien confirmé, mais votre espace familial n'a pas encore été créé.
            Indiquez votre prénom : c'est la dernière étape.
          </Text>
          {emailConnecte ? (
            <Text style={styles.aide}>Compte connecté : {emailConnecte}</Text>
          ) : null}

          <Text style={styles.label}>Votre prénom</Text>
          <TextInput
            style={styles.input}
            value={prenom}
            onChangeText={setPrenom}
            placeholder="Ex. Marie"
            placeholderTextColor={COLORS.ardoise}
          />

          <Pressable style={styles.boutonPrincipal} onPress={reprendre} disabled={chargement}>
            {chargement ? (
              <ActivityIndicator color={COLORS.blanc} />
            ) : (
              <Text style={styles.boutonPrincipalTexte}>Créer mon espace</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.push('/rejoindre' as any)}>
            <Text style={styles.lienTexteSecondaire}>J'ai reçu un lien d'invitation</Text>
          </Pressable>

          <Pressable onPress={changerDeCompte}>
            <Text style={styles.lienTexteSecondaire}>Utiliser un autre compte</Text>
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

        {/* Apple et le RGPD attendent une acceptation explicite (DUA-105). */}
        <Pressable style={styles.ligneConditions} onPress={() => setConditionsAcceptees((v) => !v)}>
          <Ionicons
            name={conditionsAcceptees ? 'checkbox' : 'square-outline'}
            size={22}
            color={conditionsAcceptees ? COLORS.vert : COLORS.ardoise}
          />
          <Text style={styles.texteConditions}>
            J'ai lu et j'accepte les{' '}
            <Text style={styles.lienConditions} onPress={() => router.push('/cgu' as any)}>
              conditions d'utilisation
            </Text>
            {' '}et la{' '}
            <Text style={styles.lienConditions} onPress={() => router.push('/confidentialite' as any)}>
              politique de confidentialité
            </Text>
            .
          </Text>
        </Pressable>

        <Pressable
          style={[styles.boutonPrincipal, !conditionsAcceptees && styles.boutonInactif]}
          onPress={creerEspace}
          disabled={chargement}
        >
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
  ligneConditions: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: SPACING.xl },
  texteConditions: { flex: 1, fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.ardoise, lineHeight: 18 },
  lienConditions: { color: COLORS.vert, fontFamily: FONTS.bodySemibold, textDecorationLine: 'underline' },
  boutonInactif: { opacity: 0.55 },
  centreEcran: {
    flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.ivoire,
  },
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
  inputErreur: { borderColor: COLORS.terracotta },
  aide: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, lineHeight: 16, marginTop: 6 },
  aideErreur: { color: COLORS.terracotta },
  confirmation: {
    fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.vert,
    marginTop: SPACING.xl, textAlign: 'center',
  },
  boutonPrincipal: {
    backgroundColor: COLORS.vert, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center',
    marginTop: SPACING.lg,
  },
  boutonPrincipalTexte: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.blanc },
  lienTexteSecondaire: {
    fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.vert, textAlign: 'center', marginTop: SPACING.lg,
  },
});
