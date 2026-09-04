import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { COLORS } from '../constants/theme';
import { useStore } from '../store/useStore';

export default function RootLayout() {
  const initialiserSession = useStore((s) => s.initialiserSession);
  const chargementInitial = useStore((s) => s.chargementInitial);

  useEffect(() => {
    initialiserSession();
  }, []);

  if (chargementInitial) {
    return (
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor={COLORS.vertProfond} />
        <View
          style={{
            flex: 1,
            backgroundColor: COLORS.ivoire,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
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
        <Stack.Screen name="semaine-activites" options={{ presentation: 'modal' }} />
        <Stack.Screen name="enfant-histoire" options={{ presentation: 'modal' }} />
                <Stack.Screen name="fil-de-vie" options={{ presentation: 'modal' }} />
        <Stack.Screen name="partager-moment" options={{ presentation: 'modal' }} />
        <Stack.Screen name="creer-espace" />
        <Stack.Screen name="rejoindre" />
        <Stack.Screen name="connexion" />
        <Stack.Screen name="mot-de-passe-oublie" />
        <Stack.Screen name="reinitialiser-mot-de-passe" />
      </Stack>
    </SafeAreaProvider>
  );
}