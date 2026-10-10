import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { cheminInvitationEnAttente } from '../lib/invitationEnAttente';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { useStore } from '../store/useStore';
import { supabase } from '../constants/supabase';
import GardeInactivite from '../components/GardeInactivite';
import ErrorBoundary from '../components/ErrorBoundary';
import BandeauEnvironnement from '../components/BandeauEnvironnement';
import CadreWeb from '../components/CadreWeb';
import { useFonts } from 'expo-font';
import {
  Fraunces_500Medium,
  Fraunces_600SemiBold,
} from '@expo-google-fonts/fraunces';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

// Écrans depuis lesquels on ne redirige jamais : parcours d'authentification
// et d'inscription, où l'absence de configuration de foyers est normale.
const ECRANS_SANS_REDIRECTION = [
  // La racine : app/index.tsx fait sa propre lecture de session et oriente
  // vers /creer-espace ou /(tabs)/accueil. Sans cette exemption, la garde de
  // session gagnait la course et tout nouveau visiteur atterrissait sur
  // l'ecran de connexion, sans plus jamais voir la creation de compte.
  '',
  'index',
  'connexion',
  'creer-espace',
  'creer-espace-lien',
  'rejoindre',
  'rejoindre-acces',
  'espace-tiers',
  'configurer-foyer',
  'mot-de-passe-oublie',
  'reinitialiser-mot-de-passe',
];

// Écrans accessibles SANS session. La liste ci-dessus ne pouvait pas servir
// à cela : elle contient `configurer-foyer` et `creer-espace-lien`, exemptés
// pour ne pas boucler avec les redirections qui y mènent. Les deux listes
// n'en faisaient qu'une, si bien qu'un visiteur sans aucune session pouvait
// ouvrir /Dualia/configurer-foyer, remplir l'écran, et ne récolter qu'une
// erreur brute du serveur — sur un écran sans bouton retour.
const ECRANS_PUBLICS = [
  '',
  'index',
  'connexion',
  'creer-espace',
  'rejoindre',
  'rejoindre-acces',
  'espace-tiers',
  'mot-de-passe-oublie',
  'reinitialiser-mot-de-passe',
];

// initialiserSession() charge les vraies données (session Supabase, espace
// familial, parents, enfants...) une fois au tout premier démarrage de
// l'app — quelle que soit la page d'entrée (accueil, un lien direct, un
// favori...). Sans cet appel ici, seul l'écran de connexion déclenchait ce
// chargement : arriver directement sur une autre page laissait l'app
// afficher les valeurs par défaut ("Marie/Pierre"), même avec une session
// Supabase valide en arrière-plan.
export default function RootLayout() {
  const initialiserSession = useStore((s) => s.initialiserSession);
  const chargementInitial = useStore((s) => s.chargementInitial);
  const sessionActive = useStore((s) => s.sessionActive);
  const sessionVerifiee = useStore((s) => s.sessionVerifiee);
  const familleId = useStore((s) => s.familleId);
  const accesTiers = useStore((s) => s.accesTiers);
  const configFoyers = useStore((s) => s.configFoyers);
  const rattachement = useStore((s) => s.rattachement);
  const router = useRouter();
  const segments = useSegments();

  // Les polices n'etaient JAMAIS chargees.
  //
  // constants/theme.ts declare Fraunces et Inter, les deux paquets sont
  // installes, expo-font est dans les plugins — mais aucun appel a
  // useFonts nulle part. Chaque `fontFamily` pointait donc vers une
  // famille inconnue du navigateur, qui retombait sur sa police par
  // defaut. Toute la direction visuelle du produit, sur les trente
  // ecrans, ne s'affichait pas.
  //
  // `erreurPolices` : si le telechargement echoue, on affiche quand meme
  // plutot que de laisser l'application bloquee sur un rond.
  const [policesChargees, erreurPolices] = useFonts({
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const policesPretes = policesChargees || !!erreurPolices;

  useEffect(() => {
    // Un rejet non rattrape laisserait sessionVerifiee a false : l'application
    // resterait sur le rond de chargement pour toujours, et un rechargement
    // reproduirait le probleme. Un ecran blanc au demarrage serait pire que la
    // faille que cette garde corrige.
    initialiserSession().catch((e) => {
      console.error('[Dualia] Initialisation de session interrompue :', e);
      useStore.setState({ sessionActive: null, sessionVerifiee: true, chargementInitial: false });
    });

    // Une session peut tomber en cours d'usage : jeton revoque, mot de passe
    // change depuis un autre appareil, compte supprime. Sans cette ecoute,
    // l'application continuait d'afficher l'espace familial jusqu'au prochain
    // redemarrage, en lisant le stockage local.
    const { data: abonnement } = supabase.auth.onAuthStateChange((evenement) => {
      if (evenement === 'SIGNED_OUT') {
        useStore.getState().purgerDonneesFamiliales();
        useStore.setState({ accesTiers: null, sessionActive: false });
      }
      if (evenement === 'SIGNED_IN' || evenement === 'TOKEN_REFRESHED') {
        useStore.setState({ sessionActive: true });
      }
    });
    return () => abonnement.subscription.unsubscribe();
  }, []);

  // Garde de session.
  //
  // Sans elle, ouvrir Dualia sur un navigateur ou un parent s'etait connecte
  // affichait son espace familial reconstitue depuis le stockage local, sans
  // qu'aucun mot de passe soit demande. La purge est faite dans le store ; ici
  // on renvoie vers la connexion.
  //
  // Cette garde s'exclut des trois suivantes par sa condition meme
  // (sessionActive === false contre !== false) : elles ne peuvent donc pas
  // se disputer la redirection, quel que soit l'ordre des effets.
  useEffect(() => {
    if (chargementInitial) return;
    if (sessionActive !== false) return;

    const ecranCourant = segments[0] ?? '';
    if (ECRANS_PUBLICS.includes(ecranCourant)) return;

    router.replace('/connexion' as any);
  }, [chargementInitial, sessionActive, segments]);

  // Rattrapage des espaces familiaux sans foyers.
  // Les familles créées avant l'existence des foyers n'ont ni config_foyers
  // ni foyer : leurs enfants ne sont rattachés à rien, et tous les modules
  // qui raisonnent par foyer (garde, transmission, calendrier) tournent à
  // vide. On renvoie donc vers la configuration tant qu'elle n'est pas faite.
  // configurer_foyers_initial rattache au passage les enfants déjà déclarés.
  useEffect(() => {
    if (chargementInitial) return;
    if (sessionActive === false) return;
    if (!familleId) return;
    if (configFoyers !== null) return;

    const ecranCourant = segments[0] ?? '';
    if (ECRANS_SANS_REDIRECTION.includes(ecranCourant)) return;

    router.replace('/configurer-foyer' as any);
  }, [chargementInitial, sessionActive, familleId, configFoyers, segments]);

  // Un tiers n'a pas d'espace familial : sans cette redirection, rouvrir
  // l'application le posait sur l'accueil d'une famille dont il ne verrait
  // rien, faute de droits — un écran vide sans explication.
  useEffect(() => {
    if (chargementInitial) return;
    if (sessionActive === false) return;
    if (familleId) return;
    if (!accesTiers) return;

    const ecranCourant = segments[0] ?? '';
    if (ECRANS_SANS_REDIRECTION.includes(ecranCourant)) return;

    router.replace('/espace-tiers' as any);
  }, [chargementInitial, sessionActive, familleId, accesTiers, segments]);

  // Compte rattaché à rien.
  //
  // Un parent qui cree son compte depuis creer-espace.tsx recoit d'abord un
  // e-mail de confirmation : signUp ne rend alors AUCUNE session, et l'ecran
  // s'arrete avant creer_famille(). L'espace n'existe donc pas encore quand
  // la personne revient se connecter — et elle atterrissait sur un accueil
  // vide, definitivement, puisque l'ecran de creation n'est propose qu'aux
  // visiteurs sans session. Deux comptes reels etaient deja dans cet etat.
  //
  // On ne se fie pas a `familleId`, qui vaut aussi null pendant un chargement
  // ou hors ligne, ni a une liste vide : seules ces deux valeurs sont des
  // reponses claires du serveur. 'inconnu' ne redirige vers rien.
  //
  // 'acces_retire' merite son propre chemin : envoyer une nounou dont
  // l'acces vient d'etre coupe vers « Terminons votre espace familial »
  // serait faux deux fois, et lui proposerait de creer un espace de
  // coparentalite dont elle n'a que faire.
  //
  // 'demande_en_attente' aussi : un co-parent invite n'a pas encore de
  // ligne dans `parents` tant que l'autre parent n'a pas valide. Lui
  // proposer de creer un espace lui en fabriquait un a lui, et les deux
  // parents finissaient chacun dans le sien.
  useEffect(() => {
    if (chargementInitial) return;
    if (sessionActive === false) return;
    const DESTINATIONS: Record<string, string> = {
      jamais_rattache: '/creer-espace',
      acces_retire: '/espace-tiers',
      demande_en_attente: '/rejoindre',
    };
    const destination = DESTINATIONS[rattachement];
    if (!destination) return;

    const ecranCourant = segments[0] ?? '';
    if (ECRANS_SANS_REDIRECTION.includes(ecranCourant)) return;

    if (rattachement === 'jamais_rattache') {
      // Un lien d'invitation en attente sur l'appareil passe avant la
      // creation d'un espace : voir lib/invitationEnAttente.ts.
      let vivant = true;
      cheminInvitationEnAttente().then((cheminInvitation) => {
        if (vivant) router.replace((cheminInvitation ?? destination) as any);
      });
      return () => { vivant = false; };
    }

    router.replace(destination as any);
  }, [chargementInitial, sessionActive, rattachement, segments]);

  // Rien n'est rendu tant qu'on ne sait pas s'il y a une session.
  //
  // C'est le coeur du garde-fou, et sans lui le reste ne servait a rien :
  // zustand rehydrate le stockage local de maniere SYNCHRONE sur le web. Le
  // premier rendu affichait donc l'espace familial complet — prenoms des
  // enfants, messages, depenses — et la purge n'arrivait qu'apres, au retour
  // de initialiserSession(). La personne assise devant l'ecran avait tout vu
  // avant la redirection.
  //
  // sessionVerifiee vaut false des le premier rendu (valeur initiale du store,
  // non persistee) et passe a true dans toutes les branches de
  // initialiserSession, y compris celles ou la session reste indeterminee. On
  // n'attend QUE cette reponse : une fois la session confirmee, l'espace
  // familial peut s'afficher depuis le stockage local pendant que les donnees
  // fraiches arrivent, comme avant.
  if (!sessionVerifiee || !policesPretes) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.ivoire }}>
          <BandeauEnvironnement />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="large" color={COLORS.vert} />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {/* Pose une seule fois, au-dessus de tout : la surveillance ne doit pas
          repartir de zero a chaque changement d'ecran. Ne rend rien tant
          qu'aucune session n'est ouverte. */}
      <GardeInactivite />
      {/* Dernier filet. Une exception levee pendant le rendu de N'IMPORTE
          quel ecran demontait tout l'arbre React : page blanche definitive,
          sans message et sans bouton. Cette frontiere n'existait que sur
          Finances. Elle couvre desormais toute l'application. */}
      {/* Sur telephone, l'heure, la batterie et l'encoche occupent le haut de
          l'ecran : on y pose la marge une seule fois, ici, pour tous les
          ecrans. Sur le web la marge vaut 0. Les ecrans ne gerent donc plus
          que le bas (barre de geste). Le bandeau PRE-PROD prend sa place
          dans le flux, sous cette marge, au lieu de recouvrir les titres. */}
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: COLORS.ivoire }}>
      <BandeauEnvironnement />
      <CadreWeb>
      <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="validation-cadre" options={{ presentation: 'modal' }} />
        <Stack.Screen name="creer-espace" />
        <Stack.Screen name="creer-espace-lien" />
        <Stack.Screen name="rejoindre" />
        <Stack.Screen name="rejoindre-acces" />
        <Stack.Screen name="espace-tiers" />
        <Stack.Screen name="configurer-foyer" />
        <Stack.Screen name="parents-foyers" />
        <Stack.Screen name="connexion" />
        <Stack.Screen name="mot-de-passe-oublie" />
        <Stack.Screen name="reinitialiser-mot-de-passe" />
        <Stack.Screen name="securite" />
        <Stack.Screen name="securite-compte" />
        <Stack.Screen name="confidentialite" />
        <Stack.Screen name="cgu" />
        <Stack.Screen name="acces-tiers" />
        <Stack.Screen name="agenda-scolaire" />
        <Stack.Screen name="calendriers-externes" />
        <Stack.Screen name="echeances" />
        <Stack.Screen name="enfant-histoire" />
        <Stack.Screen name="fil-de-vie" />
        <Stack.Screen name="partager-moment" />
        <Stack.Screen name="personnaliser-home" />
        <Stack.Screen name="personnaliser-transmission" />
        <Stack.Screen name="semaine-activites" />
        <Stack.Screen name="enfant/[id]" />
      </Stack>
      </ErrorBoundary>
      </CadreWeb>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
