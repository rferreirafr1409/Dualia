// app/faq.tsx
//
// Questions frequentes (DUA-127, DUA-053).
//
// Les questions que posent les premiers testeurs portent moins sur
// l'interface que sur la confiance : qui voit quoi, ce que vaut l'outil
// devant un juge, comment partir. Les reponses tiennent en quelques
// phrases et ne promettent rien que l'application ne fasse deja ; le
// contenu vit dans i18n, une seule reponse ouverte a la fois pour que la
// liste reste lisible sur un telephone.

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store/useStore';
import { TRADUCTIONS } from '../constants/i18n';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { retour } from '../lib/navigation';

const LIGNE_CARTE = 'rgba(23,63,50,0.12)';

export default function FaqScreen() {
  const router = useRouter();
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].faq;
  const [ouverte, setOuverte] = useState<number | null>(null);

  return (
    <SafeAreaView style={styles.conteneur} edges={['bottom']}>
      <View style={styles.topbar}>
        <Pressable style={styles.retourBtn} onPress={() => retour(router, '/(tabs)/famille')}>
          <Ionicons name="chevron-back" size={20} color={COLORS.vertProfond} />
        </Pressable>
        <Text style={styles.titre}>{t.titre}</Text>
        <View style={{ width: 32 }} />
      </View>

      <Text style={styles.sousTitre}>{t.sousTitre}</Text>

      <ScrollView contentContainerStyle={styles.liste} showsVerticalScrollIndicator={false}>
        {t.questions.map((item, index) => {
          const estOuverte = ouverte === index;
          return (
            <View key={index} style={[styles.carte, estOuverte && styles.carteOuverte]}>
              <Pressable
                style={styles.question}
                onPress={() => setOuverte(estOuverte ? null : index)}
                accessibilityRole="button"
                accessibilityState={{ expanded: estOuverte }}
              >
                <Text style={styles.questionTexte}>{item.question}</Text>
                <Ionicons
                  name={estOuverte ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={estOuverte ? COLORS.vert : COLORS.ardoise}
                />
              </Pressable>
              {estOuverte ? <Text style={styles.reponse}>{item.reponse}</Text> : null}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: COLORS.ivoire, paddingTop: SPACING.xxl },

  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, marginBottom: SPACING.sm,
  },
  retourBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.blanc,
    borderWidth: 1, borderColor: LIGNE_CARTE, alignItems: 'center', justifyContent: 'center',
  },
  titre: { fontFamily: FONTS.displaySemibold, fontSize: 18, color: COLORS.vertProfond },

  sousTitre: {
    fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise,
    paddingHorizontal: SPACING.xl, marginBottom: SPACING.lg,
  },

  liste: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl, gap: SPACING.sm },

  carte: {
    backgroundColor: COLORS.blanc, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: LIGNE_CARTE,
  },
  carteOuverte: { borderColor: COLORS.vert },
  question: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    padding: SPACING.lg,
  },
  questionTexte: {
    flex: 1, fontFamily: FONTS.bodySemibold, fontSize: 15, lineHeight: 21, color: COLORS.texte,
  },
  reponse: {
    fontFamily: FONTS.body, fontSize: 14, lineHeight: 21, color: COLORS.ardoise,
    paddingHorizontal: SPACING.lg, paddingBottom: SPACING.lg,
  },
});
