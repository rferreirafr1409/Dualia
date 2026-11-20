// components/RaccourcisModules.tsx
//
// DUA-154 (retour de Maxime, 15 nov. 2026) : « une home page avec l'accès à
// tous les onglets ». Sur téléphone, la barre du bas ne montre que quatre
// onglets (Aujourd'hui, Agenda, Messages, Famille) : Finances, Décisions,
// Documents et Journal n'étaient accessibles que par les cartes de
// l'accueil, quand elles étaient affichées. Cette grille met chaque module à
// un appui depuis l'accueil.
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, FONTS, SPACING } from '../constants/theme';
import { useStore } from '../store/useStore';

type Langue = 'fr' | 'pt' | 'es' | 'en';
type Module = {
  route: string;
  icone: React.ComponentProps<typeof Ionicons>['name'];
  libelle: Record<Langue, string>;
};

// Mêmes libellés que la navigation (app/(tabs)/_layout.tsx).
const MODULES: Module[] = [
  { route: '/calendrier', icone: 'calendar-outline', libelle: { fr: 'Agenda', pt: 'Agenda', es: 'Agenda', en: 'Calendar' } },
  { route: '/finances', icone: 'wallet-outline', libelle: { fr: 'Finances', pt: 'Finanças', es: 'Finanzas', en: 'Finances' } },
  { route: '/decisions', icone: 'checkmark-circle-outline', libelle: { fr: 'Décisions', pt: 'Decisões', es: 'Decisiones', en: 'Decisions' } },
  { route: '/messagerie', icone: 'chatbubbles-outline', libelle: { fr: 'Messages', pt: 'Mensagens', es: 'Mensajes', en: 'Messages' } },
  { route: '/documents', icone: 'folder-outline', libelle: { fr: 'Documents', pt: 'Documentos', es: 'Documentos', en: 'Documents' } },
  { route: '/journal', icone: 'book-outline', libelle: { fr: 'Journal', pt: 'Diário', es: 'Diario', en: 'Journal' } },
  { route: '/famille', icone: 'people-outline', libelle: { fr: 'Famille', pt: 'Família', es: 'Familia', en: 'Family' } },
];

export default function RaccourcisModules() {
  const router = useRouter();
  const langue = useStore((s) => s.langue) as Langue;
  return (
    <View style={styles.grille}>
      {MODULES.map((m) => (
        <Pressable
          key={m.route}
          style={({ pressed }) => [styles.tuile, pressed && { opacity: 0.6 }]}
          onPress={() => router.push(m.route as any)}
          accessibilityRole="button"
          accessibilityLabel={m.libelle[langue] ?? m.libelle.fr}
        >
          <View style={styles.rond}>
            <Ionicons name={m.icone} size={22} color={COLORS.vert} />
          </View>
          <Text style={styles.libelle} numberOfLines={1}>{m.libelle[langue] ?? m.libelle.fr}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grille: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginBottom: SPACING.md, rowGap: SPACING.md,
  },
  tuile: { width: '25%', alignItems: 'center', gap: 6 },
  rond: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: 'rgba(23,63,50,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  libelle: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.vertProfond },
});
