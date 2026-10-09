// app/cgu.tsx
//
// Conditions générales d'utilisation de Dualia (DUA-105). Acceptées à la
// création du compte (case à cocher dans creer-espace.tsx) et lisibles à tout
// moment depuis la page Sécurité. Même mise en page que la politique de
// confidentialité (app/confidentialite.tsx).

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { retour } from '../lib/navigation';

type Section = { titre: string; paragraphes: string[] };

const SECTIONS: Section[] = [
  {
    titre: '1. Objet',
    paragraphes: [
      "Les présentes conditions encadrent l'utilisation de l'application et du site Dualia, édités par R Digital Instore, SASU au capital de 100 €, 60 rue François 1er, 75008 Paris, RCS Paris 939 683 462 (ci-après « Dualia »).",
      "Dualia est un outil d'organisation destiné aux parents séparés : calendrier de garde, dépenses partagées, documents, messagerie et suivi des enfants. En créant un compte, vous acceptez ces conditions et notre politique de confidentialité.",
    ],
  },
  {
    titre: '2. Compte et accès',
    paragraphes: [
      "Le service est réservé aux personnes majeures. Chaque parent dispose de son propre compte, protégé par un mot de passe que vous gardez confidentiel. Vous êtes responsable des actions menées depuis votre compte.",
      "Un espace familial réunit les deux parents d'un ou plusieurs enfants. Les accès que vous accordez à des tiers (grands-parents, nounou, école) sont limités aux permissions que vous choisissez et révocables à tout moment.",
    ],
  },
  {
    titre: '3. Ce que Dualia fait, et ne fait pas',
    paragraphes: [
      "Dualia aide à organiser et à garder une trace. Dualia ne rend aucune décision à votre place, ne donne pas de conseil juridique et ne remplace ni un avocat, ni un médiateur, ni le juge aux affaires familiales.",
      "Les informations extraites d'un jugement ou d'un ticket par une intelligence artificielle sont des propositions que vous devez vérifier avant de les valider. Seul le document d'origine fait foi.",
      "Les montants, répartitions et échéances affichés sont calculés à partir de ce que vous avez saisi. Ils n'ont pas de valeur contractuelle entre les parents, sauf accord exprès entre eux.",
    ],
  },
  {
    titre: '4. Vos contenus',
    paragraphes: [
      "Vous restez propriétaire des messages, photos, documents et informations que vous déposez dans Dualia. Vous nous accordez uniquement le droit technique de les héberger, de les afficher aux personnes que vous autorisez et de les traiter pour rendre le service.",
      "Vous vous engagez à ne déposer que des contenus licites, que vous avez le droit de partager, et à respecter l'autre parent dans vos échanges. Les contenus insultants, menaçants, ou portant atteinte à un enfant sont interdits.",
      "Chaque parent peut signaler un message reçu. Dualia examine les signalements et peut, en cas de manquement grave ou répété, restreindre ou fermer un compte après en avoir informé la personne concernée.",
    ],
  },
  {
    titre: '5. Disponibilité et évolution du service',
    paragraphes: [
      "Nous faisons notre possible pour que Dualia soit disponible en permanence, sans pouvoir le garantir : des interruptions pour maintenance ou en cas d'incident peuvent survenir. Nous vous recommandons de conserver une copie des documents importants.",
      "Le service évolue : des fonctions peuvent être ajoutées, modifiées ou retirées. Les changements importants vous sont annoncés dans l'application.",
    ],
  },
  {
    titre: '6. Prix',
    paragraphes: [
      "Pendant la phase de test, Dualia est gratuit. Si une offre payante est introduite, ses conditions (prix, durée, résiliation) vous seront présentées avant tout engagement, et aucun paiement ne sera prélevé sans votre accord explicite.",
    ],
  },
  {
    titre: '7. Responsabilité',
    paragraphes: [
      "Dualia est fourni avec le soin d'un prestataire diligent. Nous ne pouvons être tenus responsables des décisions que vous prenez sur la base des informations affichées, ni des contenus déposés par l'autre parent ou par un tiers autorisé, ni des dommages indirects.",
      "Rien dans ces conditions ne limite notre responsabilité dans les cas où la loi l'interdit.",
    ],
  },
  {
    titre: '8. Fin du contrat',
    paragraphes: [
      "Vous pouvez supprimer votre compte à tout moment depuis Famille › Mon compte. Si l'autre parent reste dans l'espace familial, les données communes (calendrier, dépenses, documents) lui restent accessibles ; vos informations personnelles sont retirées.",
      "Nous pouvons fermer un compte en cas de violation grave de ces conditions, après vous en avoir informé, sauf urgence imposant d'agir immédiatement.",
    ],
  },
  {
    titre: '9. Droit applicable',
    paragraphes: [
      "Ces conditions sont soumises au droit français. En cas de litige, nous chercherons d'abord une solution amiable. À défaut, les tribunaux français sont compétents, sans préjudice des règles protectrices applicables aux consommateurs, y compris la possibilité de saisir un médiateur de la consommation.",
    ],
  },
  {
    titre: '10. Contact',
    paragraphes: ["Pour toute question sur ces conditions : contact@dualia.app", 'Dernière mise à jour : 9 octobre 2026.'],
  },
];

export default function CguScreen() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <Pressable onPress={() => retour(router, '/(tabs)/famille')} style={styles.zoneTactileRetour}>
          <Ionicons name="close" size={22} color={COLORS.vertProfond} />
        </Pressable>
        <Text style={styles.topbarTitre}>Conditions d'utilisation</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.contenu} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Les règles du jeu entre vous et Dualia, en clair. Elles complètent la politique de
          confidentialité, qui décrit ce que nous faisons de vos données.
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

        <Pressable style={styles.lien} onPress={() => router.push('/confidentialite' as any)}>
          <Ionicons name="document-text-outline" size={18} color={COLORS.vert} />
          <Text style={styles.lienTexte}>Lire la politique de confidentialité</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.ardoise} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  zoneTactileRetour: { padding: 10, margin: -10 },
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
  lien: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, backgroundColor: '#EAF3EE',
    borderRadius: RADIUS.md, padding: SPACING.lg, marginTop: SPACING.sm,
  },
  lienTexte: { flex: 1, fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.vertProfond },
});
