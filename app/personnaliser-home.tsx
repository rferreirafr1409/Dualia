// app/personnaliser-home.tsx
//
// Écran "Personnaliser ma Home" — liste tous les widgets du catalogue,
// permet de les activer/masquer (interrupteur) et de les réordonner
// (flèches haut/bas). Pas de drag & drop : plus simple à utiliser au
// clavier/tactile et fiable sur web comme sur mobile, contrairement au
// drag & drop React Native qui se comporte mal sur React Native Web.
//
// Chaque changement est immédiatement persisté dans Supabase via
// useHomeWidgets() — pas de bouton "Enregistrer", tout est instantané,
// cohérent avec le reste de l'app.
//
// Les textes de titre/sous-titre passent par (t as any).personnaliserHome
// avec repli sur une valeur par défaut, car cette clé n'existe pas encore
// dans constants/i18n.ts — le cast évite une erreur TypeScript bloquante
// au déploiement tant que ces traductions ne sont pas ajoutées formellement.

import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, Switch } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store/useStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { TRADUCTIONS } from '../constants/i18n';
import { useHomeWidgets, type WidgetConfigLigne } from '../hooks/useHomeWidgets';
import { WIDGETS_CATALOGUE } from '../constants/widgetsCatalog';

const LIGNE_CARTE = 'rgba(23,63,50,0.12)';

// Résout une clé de traduction éventuellement imbriquée, ex. "attention.financesTitre".
function resoudreTitre(accueilTraductions: any, cle: string): string {
  const valeur = cle.split('.').reduce((acc: any, part: string) => acc?.[part], accueilTraductions);
  return typeof valeur === 'string' ? valeur : cle;
}

export default function PersonnaliserHomeScreen() {
  const router = useRouter();
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue];

  const { configComplete, chargement, toggleVisibilite, reordonner } = useHomeWidgets();

  const textesEcran = (t as any).personnaliserHome;

  const deplacer = (index: number, direction: -1 | 1) => {
    const nouvelIndex = index + direction;
    if (nouvelIndex < 0 || nouvelIndex >= configComplete.length) return;
    const nouvelOrdre = configComplete.map((c) => c.widgetId);
    [nouvelOrdre[index], nouvelOrdre[nouvelIndex]] = [nouvelOrdre[nouvelIndex], nouvelOrdre[index]];
    reordonner(nouvelOrdre);
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.topbar}>
        <Pressable style={styles.retourBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={COLORS.vertProfond} />
        </Pressable>
        <Text style={styles.titre}>{textesEcran?.titre ?? 'Personnaliser ma Home'}</Text>
        <View style={{ width: 32 }} />
      </View>

      <Text style={styles.sousTitre}>
        {textesEcran?.sousTitre ?? 'Choisis les widgets à afficher et leur ordre sur ta Home.'}
      </Text>

      {chargement ? (
        <Text style={styles.muted}>{textesEcran?.chargement ?? 'Chargement…'}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.liste} showsVerticalScrollIndicator={false}>
          {configComplete.map((ligne: WidgetConfigLigne, index: number) => {
            const definition = WIDGETS_CATALOGUE.find((w) => w.id === ligne.widgetId);
            if (!definition) return null;
            const titre = resoudreTitre(t.accueil, definition.titreKey);

            return (
              <View key={ligne.widgetId} style={[styles.ligne, !ligne.visible && styles.ligneMasquee]}>
                <View style={styles.fleches}>
                  <Pressable
                    style={[styles.flecheBtn, index === 0 && styles.flecheBtnDesactivee]}
                    onPress={() => deplacer(index, -1)}
                    disabled={index === 0}
                  >
                    <Ionicons name="chevron-up" size={16} color={index === 0 ? COLORS.ardoise : COLORS.vertProfond} />
                  </Pressable>
                  <Pressable
                    style={[styles.flecheBtn, index === configComplete.length - 1 && styles.flecheBtnDesactivee]}
                    onPress={() => deplacer(index, 1)}
                    disabled={index === configComplete.length - 1}
                  >
                    <Ionicons name="chevron-down" size={16} color={index === configComplete.length - 1 ? COLORS.ardoise : COLORS.vertProfond} />
                  </Pressable>
                </View>

                <View style={styles.roundIcon}>
                  <Ionicons name={definition.icone as any} size={16} color={COLORS.vert} />
                </View>

                <Text style={styles.ligneTitre} numberOfLines={1}>{titre}</Text>

                <Switch
                  value={ligne.visible}
                  onValueChange={() => toggleVisibilite(ligne.widgetId)}
                  trackColor={{ false: LIGNE_CARTE, true: COLORS.vert }}
                  thumbColor={COLORS.blanc}
                />
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ivoire, paddingTop: SPACING.xxl },

  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, marginBottom: SPACING.sm,
  },
  retourBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.blanc,
    borderWidth: 1, borderColor: LIGNE_CARTE, alignItems: 'center', justifyContent: 'center',
  },
  titre: { fontFamily: FONTS.bodySemibold, fontSize: 16, color: COLORS.vertProfond },

  sousTitre: {
    fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise,
    paddingHorizontal: SPACING.xl, marginBottom: SPACING.lg,
  },
  muted: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise, paddingHorizontal: SPACING.xl },

  liste: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl, gap: SPACING.sm },

  ligne: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: LIGNE_CARTE,
    borderRadius: RADIUS.lg, padding: SPACING.md,
  },
  ligneMasquee: { opacity: 0.5 },

  fleches: { gap: 2 },
  flecheBtn: {
    width: 24, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.ivoireFonce,
  },
  flecheBtnDesactivee: { opacity: 0.3 },

  roundIcon: {
    width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: `${COLORS.vert}1A`,
  },

  ligneTitre: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.texte },
});
