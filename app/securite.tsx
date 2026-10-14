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
import { retour } from '../lib/navigation';
import { useStore } from '../store/useStore';

type Point = { icone: keyof typeof Ionicons.glyphMap; titre: string; texte: string };

type Langue = 'fr' | 'pt' | 'es' | 'en';

type Libelles = {
  titre: string;
  intro: string;
  points: Point[];
  politique: string;
  cgu: string;
  contact: string;
};

const LIBELLES: Record<Langue, Libelles> = {
  fr: {
    titre: 'Sécurité',
    intro:
      "Dualia héberge des jugements, des pensions, des messages entre parents, des photos d'enfants. On a construit l'infrastructure en conséquence — voici exactement ce qui protège vos données, sans promesse vague.",
    points: [
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
          "Les fonctions assistées par IA (messagerie apaisée, lecture des tickets, import du jugement) sont confiées à Anthropic Ireland, Limited. Vos données ne servent jamais à entraîner leurs modèles — c'est un engagement contractuel, pas une intention. Traitement encadré par un accord de sous-traitance intégrant les clauses contractuelles types européennes.",
      },
      {
        icone: 'close-circle-outline',
        titre: 'Ce que nous ne faisons pas',
        texte:
          "Nous ne vendons, ne louons et ne partageons jamais vos données à des fins publicitaires. Nous ne lisons pas vos messages ou documents pour du ciblage marketing.",
      },
    ],
    politique: 'Voir la politique de confidentialité complète',
    cgu: "Lire les conditions d'utilisation",
    contact:
      "Une question de sécurité ? Écrivez à securite@dualia.app — on répond, pas de formulaire qui part dans le vide.",
  },
  pt: {
    titre: 'Segurança',
    intro:
      'A Dualia aloja sentenças, pensões, mensagens entre progenitores, fotografias de crianças. Construímos a infraestrutura em conformidade — eis exatamente o que protege os seus dados, sem promessas vagas.',
    points: [
      {
        icone: 'location-outline',
        titre: 'Os seus dados ficam na Europa',
        texte:
          'Base de dados e autenticação alojadas na região Europa Ocidental (Paris). Infraestrutura aplicacional alojada em França (região de Paris). Sem alojamento por defeito nos Estados Unidos, ao contrário de muitas aplicações concorrentes.',
      },
      {
        icone: 'lock-closed-outline',
        titre: 'Encriptação sistemática',
        texte:
          'Todos os dados são encriptados em repouso (AES-256) e em trânsito (TLS). Cada troca entre o seu dispositivo e os nossos servidores está protegida.',
      },
      {
        icone: 'people-outline',
        titre: 'Separação estrita entre famílias',
        texte:
          'Testado em condições reais: uma tentativa de acesso de uma família aos documentos, mensagens, despesas e dados de outra família foi bloqueada em todas as tabelas testadas. Não é uma promessa, é verificado.',
      },
      {
        icone: 'key-outline',
        titre: 'Autenticação de dois fatores disponível',
        texte:
          'Pode ativar uma verificação em dois passos (código de 6 dígitos) para proteger a sua conta, além da sua palavra-passe.',
      },
      {
        icone: 'sparkles-outline',
        titre: 'A IA, estritamente enquadrada',
        texte:
          'As funções assistidas por IA (mensagens apaziguadas, leitura de recibos, importação da sentença) são confiadas à Anthropic Ireland, Limited. Os seus dados nunca servem para treinar os modelos deles — é um compromisso contratual, não uma intenção. Tratamento enquadrado por um acordo de subcontratação que integra as cláusulas contratuais-tipo europeias.',
      },
      {
        icone: 'close-circle-outline',
        titre: 'O que não fazemos',
        texte:
          'Nunca vendemos, alugamos nem partilhamos os seus dados para fins publicitários. Não lemos as suas mensagens nem os seus documentos para segmentação de marketing.',
      },
    ],
    politique: 'Ver a política de privacidade completa',
    cgu: 'Ler as condições de utilização',
    contact:
      'Uma questão de segurança? Escreva para securite@dualia.app — respondemos, sem formulários que caem no vazio.',
  },
  es: {
    titre: 'Seguridad',
    intro:
      'Dualia aloja sentencias, pensiones, mensajes entre progenitores, fotos de niños. Hemos construido la infraestructura en consecuencia — esto es exactamente lo que protege tus datos, sin promesas vagas.',
    points: [
      {
        icone: 'location-outline',
        titre: 'Tus datos se quedan en Europa',
        texte:
          'Base de datos y autenticación alojadas en la región Europa Occidental (París). Infraestructura de la aplicación alojada en Francia (región de París). Sin alojamiento por defecto en Estados Unidos, a diferencia de muchas aplicaciones de la competencia.',
      },
      {
        icone: 'lock-closed-outline',
        titre: 'Cifrado sistemático',
        texte:
          'Todos los datos están cifrados en reposo (AES-256) y en tránsito (TLS). Cada intercambio entre tu dispositivo y nuestros servidores está protegido.',
      },
      {
        icone: 'people-outline',
        titre: 'Separación estricta entre familias',
        texte:
          'Probado en condiciones reales: un intento de acceso de una familia a los documentos, mensajes, gastos y datos de otra familia fue bloqueado en todas las tablas probadas. No es una promesa, está verificado.',
      },
      {
        icone: 'key-outline',
        titre: 'Autenticación en dos pasos disponible',
        texte:
          'Puedes activar una verificación en dos pasos (código de 6 dígitos) para proteger tu cuenta, además de tu contraseña.',
      },
      {
        icone: 'sparkles-outline',
        titre: 'La IA, estrictamente regulada',
        texte:
          'Las funciones asistidas por IA (mensajería apaciguada, lectura de tickets, importación de la sentencia) se confían a Anthropic Ireland, Limited. Tus datos nunca sirven para entrenar sus modelos — es un compromiso contractual, no una intención. Tratamiento regulado por un acuerdo de encargo de tratamiento que integra las cláusulas contractuales tipo europeas.',
      },
      {
        icone: 'close-circle-outline',
        titre: 'Lo que no hacemos',
        texte:
          'Nunca vendemos, alquilamos ni compartimos tus datos con fines publicitarios. No leemos tus mensajes ni tus documentos para segmentación de marketing.',
      },
    ],
    politique: 'Ver la política de privacidad completa',
    cgu: 'Leer las condiciones de uso',
    contact:
      '¿Una pregunta sobre seguridad? Escribe a securite@dualia.app — respondemos, sin formularios que se pierden en el vacío.',
  },
  en: {
    titre: 'Security',
    intro:
      'Dualia stores court orders, maintenance payments, messages between parents, photos of children. We built the infrastructure accordingly — here is exactly what protects your data, with no vague promises.',
    points: [
      {
        icone: 'location-outline',
        titre: 'Your data stays in Europe',
        texte:
          'Database and authentication hosted in the Western Europe region (Paris). Application infrastructure hosted in France (Paris region). No default hosting in the United States, unlike many competing apps.',
      },
      {
        icone: 'lock-closed-outline',
        titre: 'Encryption throughout',
        texte:
          'All data is encrypted at rest (AES-256) and in transit (TLS). Every exchange between your device and our servers is protected.',
      },
      {
        icone: 'people-outline',
        titre: 'Strict separation between families',
        texte:
          "Tested under real conditions: an attempt by one family to access another family's documents, messages, expenses and data was blocked on every table tested. It is not a promise, it is verified.",
      },
      {
        icone: 'key-outline',
        titre: 'Two-factor authentication available',
        texte:
          'You can turn on two-step verification (6-digit code) to protect your account, on top of your password.',
      },
      {
        icone: 'sparkles-outline',
        titre: 'AI, strictly controlled',
        texte:
          'AI-assisted features (calmer messaging, receipt reading, court order import) are entrusted to Anthropic Ireland, Limited. Your data is never used to train their models — this is a contractual commitment, not an intention. Processing is governed by a data processing agreement incorporating the EU standard contractual clauses.',
      },
      {
        icone: 'close-circle-outline',
        titre: 'What we do not do',
        texte:
          'We never sell, rent or share your data for advertising purposes. We do not read your messages or documents for marketing targeting.',
      },
    ],
    politique: 'Read the full privacy policy',
    cgu: 'Read the terms of use',
    contact:
      'A security question? Write to securite@dualia.app — we reply, no form that vanishes into the void.',
  },
};

export default function SecuriteScreen() {
  const router = useRouter();
  const langue = useStore((s) => s.langue);
  const l = LIBELLES[langue] ?? LIBELLES.fr;

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <Pressable onPress={() => retour(router, '/(tabs)/famille')} style={styles.zoneTactileRetour}>
          <Ionicons name="close" size={22} color={COLORS.vertProfond} />
        </Pressable>
        <Text style={styles.topbarTitre}>{l.titre}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.contenu} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>{l.intro}</Text>

        {l.points.map((p) => (
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
          <Text style={styles.confidentialiteLienTexte}>{l.politique}</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.ardoise} />
        </Pressable>
        <Pressable style={styles.confidentialiteLien} onPress={() => router.push('/cgu' as any)}>
          <Ionicons name="reader-outline" size={18} color={COLORS.vert} />
          <Text style={styles.confidentialiteLienTexte}>{l.cgu}</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.ardoise} />
        </Pressable>

        <Text style={styles.contact}>{l.contact}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // react-native-web ignore hitSlop : la zone cliquable doit etre une
  // vraie marge interieure, sinon la croix fait 22 pixels de cote.
  zoneTactileRetour: { padding: 10, margin: -10 },
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
