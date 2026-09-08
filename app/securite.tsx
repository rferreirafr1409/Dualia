// app/securite.tsx
//
// Page produit "Sécurité". Contient uniquement des affirmations vérifiées
// au 08/09/2026 : hébergement Supabase eu-west-3 (Paris), Vercel cdg1
// (Paris), RLS testé en conditions réelles le 07/09/2026 (0 fuite inter-
// familles sur documents/parents/messages/depenses/enfants), MFA (TOTP)
// implémenté et testé, sous-traitant IA identifié (Anthropic Ireland,
// Limited) avec DPA auto-intégré et non-entraînement contractuel.
//
// Ne PAS mentionner Arkhineo, "eIDAS", "certifié" ou "valeur probante"
// ici tant qu'aucun contrat n'est signé — voir
// dualia-politique-confidentialite-INTERNE.md pour le point de blocage
// exact et la formulation à utiliser une fois signé (NF 461 + horodatage
// eIDAS qualifié, jamais "archivage qualifié eIDAS 2.0").

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';

type Point = { icone: keyof typeof Ionicons.glyphMap; titre: string; texte: string };

const POINTS: Point[] = [
  {
    icone: 'location-outline',
    titre: 'Vos données restent en Europe',
    texte:
      "Base de données et authentification hébergées en région Europe de l'Ouest (Paris). Infrastructure applicative hébergée en France (région Paris). Pas d'hébergement par défaut aux États-Unis, contrairement à beaucoup d'applications concurrentes.",
  },
  {
    icone: 'lock-closed-outline',
    titre: 'Chiffrement systématique',
    texte:
      "Toutes les données sont chiffrées au repos (AES-256) et en transit (TLS). Chaque échange entre votre appareil et nos serveurs est protégé.",
  },
  {
    icone: 'people-outline',
    titre: 'Cloisonnement strict entre familles',
    texte:
      "Testé en conditions réelles : une tentative d'accès d'une famille aux documents, messages, dépenses et données d'une autre famille a été bloquée sur l'ensemble des tables testées. Ce n'est pas une promesse, c'est vérifié.",
  },
  {
    icone: 'key-outline',
    titre: 'Double authentification disponible',
    texte:
      "Vous pouvez activer une vérification en deux étapes (code à 6 chiffres) pour protéger votre compte, en plus de votre mot de passe.",
  },
  {
    icone: 'sparkles-outline',
    titre: "L'IA, encadrée strictement",
    texte:
      "L'extraction assistée par IA (documents, tickets de dépenses) est confiée à Anthropic Ireland, Limited. Vos données ne servent jamais à entraîner leurs modèles — c'est un engagement contractuel, pas une intention. Traitement encadré par un accord de sous-traitance intégrant les clauses contractuelles types européennes.",
  },
  {
    icone: 'close-circle-outline',
    titre: 'Ce que nous ne faisons pas',
    texte:
      "Nous ne vendons, ne louons et ne partageons jamais vos données à des fins publicitaires. Nous ne lisons pas vos messages ou documents pour du ciblage marketing.",
  },
];

export default function SecuriteScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={22} color={COLORS.vertProfond} />
        </Pressable>
        <Text style={styles.topbarTitre}>Sécurité</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.contenu} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Dualia héberge des jugements, des pensions, des messages entre parents, des photos
          d'enfants. On a construit l'infrastructure en conséquence — voici exactement ce qui
          protège vos données, sans promesse vague.
        </Text>

        {POINTS.map((p) => (
          <View key={p.titre} style={styles.pointCard}>
            <View style={styles.iconWrap}>
              <Ionicons name={p.icone} size={20} color={COLORS.vert} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pointTitre}>{p.titre}</Text>
              <Text style={styles.pointTexte}>{p.texte}</Text>
            </View>
          </View>
        ))}

        <Pressable style={styles.confidentialiteLien} onPress={() => router.push('/confidentialite')}>
          <Ionicons name="document-text-outline" size={18} color={COLORS.vert} />
          <Text style={styles.confidentialiteLienTexte}>
            Voir la politique de confidentialité complète
          </Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.ardoise} />
        </Pressable>

        <Text style={styles.contact}>
          Une question de sécurité ? Écrivez à securite@dualia.app — on répond, pas de formulaire
          qui part dans le vide.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ivoire },
  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.xl, paddingBottom: SPACING.md,
  },
  topbarTitre: { fontFamily: FONTS.display, fontSize: 18, color: COLORS.vertProfond },
  contenu: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl },
  intro: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise, lineHeight: 19, marginBottom: SPACING.lg },

  pointCard: {
    flexDirection: 'row', gap: SPACING.md, backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.bordure,
    padding: SPACING.lg, marginBottom: SPACING.sm,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: '#EAF3EE',
    alignItems: 'center', justifyContent: 'center',
  },
  pointTitre: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.vertProfond, marginBottom: 3 },
  pointTexte: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.texte, lineHeight: 18 },

  confidentialiteLien: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: '#EAF3EE',
    borderRadius: RADIUS.md, padding: SPACING.lg, marginTop: SPACING.md,
  },
  confidentialiteLienTexte: {
    flex: 1, fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.vertProfond,
  },

  contact: {
    fontFamily: FONTS.body, fontSize: 12, color: COLORS.ardoise, textAlign: 'center',
    marginTop: SPACING.xl, lineHeight: 17,
  },
});
