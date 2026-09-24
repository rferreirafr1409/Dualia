import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { useStore } from '../store/useStore';
import { supabase } from '../constants/supabase';

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
  const router = useRouter();
  const segments = useSegments();

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
  // on renvoie vers la connexion, et on le fait AVANT les autres redirections
  // pour ne pas envoyer un visiteur sans session vers la configuration de
  // foyers d'une famille a laquelle il n'appartient pas.
  useEffect(() => {
    if (chargementInitial) return;
    if (sessionActive !== false) return;

    const ecranCourant = segments[0] ?? '';
    if (ECRANS_SANS_REDIRECTION.includes(ecranCourant)) return;

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
    if (ecranCourant === 'espace-tiers') return;
    if (ECRANS_SANS_REDIRECTION.includes(ecranCourant)) return;

    router.replace('/espace-tiers' as any);
  }, [chargementInitial, sessionActive, familleId, accesTiers, segments]);

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
  if (!sessionVerifiee) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor={COLORS.vertProfond} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.ivoire }}>
          <ActivityIndicator size="large" color={COLORS.vert} />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={COLORS.vertProfond} />
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
        <Stack.Screen name="acces-tiers" />
        <Stack.Screen name="agenda-scolaire" />
        <Stack.Screen name="calendriers-externes" />
        <Stack.Screen name="echeances" />
        <Stack.Screen name="enfant-histoire" />
        <Stack.Screen name="fil-de-vie" />
        <Stack.Screen name="journal" />
        <Stack.Screen name="partager-moment" />
        <Stack.Screen name="personnaliser-home" />
        <Stack.Screen name="personnaliser-transmission" />
        <Stack.Screen name="semaine-activites" />
        <Stack.Screen name="enfant/[id]" />
      </Stack>
    </SafeAreaProvider>
  );
}
