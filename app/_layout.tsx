import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
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
import { COLORS } from '../constants/theme';
import ErrorBoundary from '../components/ErrorBoundary';
import { Platform } from 'react-native';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.onerror = function (message, source, lineno, colno, error) {
    window.alert('Erreur JS: ' + message + '\n' + source + ':' + lineno + ':' + colno + '\n' + (error && error.stack ? error.stack : ''));
  };
  window.onunhandledrejection = function (event) {
    window.alert('Promesse rejetee: ' + (event.reason && event.reason.message ? event.reason.message : String(event.reason)));
  };
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.ivoire }}>
        <ActivityIndicator color={COLORS.vert} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={COLORS.vertProfond} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </SafeAreaProvider>
    </ErrorBoundary>
  );
}
