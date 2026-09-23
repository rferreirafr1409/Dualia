import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { useStore } from '../store/useStore';

// Écrans depuis lesquels on ne redirige jamais : parcours d'authentification
// et d'inscription, où l'absence de configuration de foyers est normale.
const ECRANS_SANS_REDIRECTION = [
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
  const familleId = useStore((s) => s.familleId);
  const accesTiers = useStore((s) => s.accesTiers);
  const configFoyers = useStore((s) => s.configFoyers);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    initialiserSession();
  }, []);

  // Rattrapage des espaces familiaux sans foyers.
  // Les familles créées avant l'existence des foyers n'ont ni config_foyers
  // ni foyer : leurs enfants ne sont rattachés à rien, et tous les modules
  // qui raisonnent par foyer (garde, transmission, calendrier) tournent à
  // vide. On renvoie donc vers la configuration tant qu'elle n'est pas faite.
  // configurer_foyers_initial rattache au passage les enfants déjà déclarés.
  useEffect(() => {
    if (chargementInitial) return;
    if (!familleId) return;
    if (configFoyers !== null) return;

    const ecranCourant = segments[0] ?? '';
    if (ECRANS_SANS_REDIRECTION.includes(ecranCourant)) return;

    router.replace('/configurer-foyer' as any);
  }, [chargementInitial, familleId, configFoyers, segments]);

  // Un tiers n'a pas d'espace familial : sans cette redirection, rouvrir
  // l'application le posait sur l'accueil d'une famille dont il ne verrait
  // rien, faute de droits — un écran vide sans explication.
  useEffect(() => {
    if (chargementInitial) return;
    if (familleId) return;
    if (!accesTiers) return;

    const ecranCourant = segments[0] ?? '';
    if (ecranCourant === 'espace-tiers') return;
    if (ECRANS_SANS_REDIRECTION.includes(ecranCourant)) return;

    router.replace('/espace-tiers' as any);
  }, [chargementInitial, familleId, accesTiers, segments]);

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
