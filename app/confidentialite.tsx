// app/confidentialite.tsx
//
// Politique de confidentialité publique de Dualia. Contenu validé le
// 08/09/2026 (identité légale R Digital Instore, sous-traitants audités :
// Supabase eu-west-3, Vercel cdg1, Anthropic Ireland Limited via DPA
// auto-intégré aux Commercial Terms). Section 9 (Arkhineo/eIDAS)
// volontairement neutralisée tant qu'aucun contrat n'est signé — ne pas
// réintroduire de mention "certifié eIDAS" ici sans repasser par le
// document interne dualia-politique-confidentialite-INTERNE.md.

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';

type Section = { titre: string; paragraphes: string[] };

const SECTIONS: Section[] = [
  {
    titre: '1. Qui est responsable de vos données',
    paragraphes: [
      "Le responsable du traitement des données à caractère personnel collectées via l'application et le site Dualia (dualia.app) est :",
      "R Digital Instore, SASU au capital de 100 €\nSiège social : 60 rue François 1er, 75008 Paris, France\nRCS Paris : 939 683 462\nSIRET (établissement) : 939 683 462 00013\nContact données personnelles : privacy@dualia.app",
    ],
  },
  {
    titre: '2. Quelles données nous collectons',
    paragraphes: [
      "Identité (nom, prénom, e-mail, téléphone), données familiales (nom des enfants, dates de naissance), données de santé facultatives (groupe sanguin, allergies, informations médicales que vous choisissez de renseigner), documents juridiques que vous importez (jugements, conventions), données financières (montants de pension, dépenses partagées), contenus échangés (messages, moments partagés, photos), et données techniques (adresse IP, type d'appareil, journaux de connexion).",
      "Nous collectons les données que vous renseignez ou transmettez directement dans Dualia, ainsi que certaines données techniques générées automatiquement lors de l'utilisation du service.",
      "Les documents que vous importez peuvent contenir des données concernant d'autres personnes que vous — le plus souvent l'autre parent, parfois des tiers mentionnés dans une décision de justice. Dualia s'engage à informer ces personnes, dans la mesure du raisonnablement possible, de l'existence de ce traitement et de leurs droits.",
    ],
  },
  {
    titre: '3. Sur quelle base légale',
    paragraphes: [
      "Exécution du contrat pour la majorité des traitements (compte, calendrier, documents). Consentement pour les fonctionnalités facultatives. Consentement explicite pour les données de santé facultatives, catégorie particulière de données. Intérêt légitime pour la sécurité et la prévention de la fraude. Obligation légale pour la conservation à des fins comptables.",
    ],
  },
  {
    titre: '4. Combien de temps nous les conservons',
    paragraphes: [
      "Compte actif : pendant toute la durée d'utilisation du service. Après suppression : 30 jours en base active, puis suppression ou anonymisation. Documents comptables et financiers : 10 ans (Code de commerce). Documents juridiques familiaux : durée d'utilisation du compte. Données de connexion : 12 mois maximum.",
    ],
  },
  {
    titre: '5. Qui a accès à vos données',
    paragraphes: [
      "En interne : un accès strictement limité aux personnes qui en ont besoin, sous engagement de confidentialité.",
      "Sous-traitants techniques, liés par un contrat de sous-traitance RGPD : hébergement de la base de données et de l'authentification en Union européenne, hébergement de notre infrastructure applicative en France, et un prestataire d'intelligence artificielle pour l'extraction automatisée assistée des documents juridiques et le traitement des tickets de dépenses (voir section 9).",
      "Personnes que vous autorisez vous-même : l'autre parent rattaché au dossier familial, un membre du cercle familial élargi, ou un professionnel via le portail dédié. Ces accès sont toujours limités aux permissions que vous attribuez, et révocables à tout moment.",
      "Nous ne vendons, ne louons et ne partageons jamais vos données à des fins publicitaires ou de prospection commerciale.",
    ],
  },
  {
    titre: '6. Transferts hors Union européenne',
    paragraphes: [
      "Nous privilégions autant que possible un hébergement en Union européenne. Lorsqu'un prestataire implique un transfert hors UE, nous nous engageons à mettre en place les garanties appropriées reconnues par la réglementation européenne (clauses contractuelles types ou cadre équivalent selon le prestataire).",
    ],
  },
  {
    titre: '7. Vos droits',
    paragraphes: [
      "Conformément au RGPD (articles 15 à 22) : droit d'accès, de rectification, à l'effacement, à la portabilité, d'opposition, à la limitation, et de retrait du consentement à tout moment.",
      "Pour exercer ces droits : privacy@dualia.app. Réponse sous un mois maximum. Vous pouvez aussi saisir la CNIL (cnil.fr).",
    ],
  },
  {
    titre: '8. Sécurité',
    paragraphes: [
      "Dualia met en œuvre des mesures techniques et organisationnelles destinées à protéger les données contre l'accès non autorisé, la perte, l'altération ou la divulgation : chiffrement des communications, mécanismes d'authentification, et cloisonnement des données entre dossiers familiaux.",
    ],
  },
  {
    titre: '9. Analyse automatisée des documents (IA)',
    paragraphes: [
      "Dualia propose deux fonctionnalités d'extraction automatisée assistée par IA : sur les documents juridiques importés, pour une pré-lecture des clauses de garde, pensions et dates spéciales ; et sur les tickets de caisse photographiés, pour en extraire le montant, le commerçant et la date.",
      "Ces fonctionnalités proposent des informations, elles ne les inventent ni ne les certifient ; le document original reste la seule référence faisant foi ; elles ne prennent aucune décision à votre place ; et font l'objet d'une validation par vous avant intégration dans votre dossier familial.",
    ],
  },
  {
    titre: '10. Cookies et traceurs',
    paragraphes: [
      "Dualia n'utilise que des cookies strictement nécessaires au fonctionnement du service (session, authentification), exemptés de consentement préalable selon les lignes directrices de la CNIL. Aucun cookie publicitaire, aucun traceur de réseau social. Aucun bandeau de consentement n'est donc nécessaire dans cette configuration.",
    ],
  },
  {
    titre: '11. Mineurs',
    paragraphes: [
      "Dualia traite des données concernant des enfants mineurs, renseignées par les utilisateurs disposant des droits nécessaires pour les communiquer et les gérer. Ces données sont accessibles uniquement aux utilisateurs autorisés sur le dossier familial concerné.",
    ],
  },
  {
    titre: '12. Modification de cette politique',
    paragraphes: [
      "Nous pouvons faire évoluer cette politique, notamment pour refléter des évolutions légales ou techniques. Toute modification substantielle vous sera notifiée par e-mail ou notification dans l'application.",
    ],
  },
  {
    titre: '13. Contact',
    paragraphes: ["Pour toute question relative à vos données personnelles : privacy@dualia.app"],
  },
];

export default function ConfidentialiteScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={22} color={COLORS.vertProfond} />
        </Pressable>
        <Text style={styles.topbarTitre}>Confidentialité</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.contenu} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Vos données de famille méritent plus qu'une case cochée dans des CGU. Voici, en clair,
          comment Dualia les protège et les utilise.
        </Text>

        {SECTIONS.map((section) => (
          <View key={section.titre} style={styles.sectionCard}>
            <Text style={styles.sectionTitre}>{section.titre}</Text>
            {section.paragraphes.map((p, i) => (
              <Text key={i} style={styles.paragraphe}>
                {p}
              </Text>
            ))}
          </View>
        ))}

        <Pressable style={styles.securiteLien} onPress={() => router.push('/securite')}>
          <Ionicons name="shield-checkmark-outline" size={18} color={COLORS.vert} />
          <Text style={styles.securiteLienTexte}>Voir le détail technique sur la page Sécurité</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.ardoise} />
        </Pressable>
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

  sectionCard: {
    backgroundColor: COLORS.blanc, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.bordure,
    padding: SPACING.lg, marginBottom: SPACING.md,
  },
  sectionTitre: {
    fontFamily: FONTS.displaySemibold, fontSize: 15, color: COLORS.vertProfond, marginBottom: SPACING.sm,
  },
  paragraphe: {
    fontFamily: FONTS.body, fontSize: 13, color: COLORS.texte, lineHeight: 20, marginBottom: SPACING.sm,
  },

  securiteLien: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: '#EAF3EE',
    borderRadius: RADIUS.md, padding: SPACING.lg, marginTop: SPACING.sm,
  },
  securiteLienTexte: {
    flex: 1, fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.vertProfond,
  },
});
