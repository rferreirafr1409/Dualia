// app/bienvenue.tsx
//
// Presentation de Dualia en quatre ecrans (DUA-127, DUA-053).
//
// Le neveu du fondateur a ouvert l'application sans savoir a quoi elle
// servait : l'accueil suppose une famille deja configuree et ne dit rien
// de ce que l'on peut y faire. Ces quatre etapes repondent a cette seule
// question, puis s'effacent.
//
// Un simple etat d'etape, pas de pager horizontal : un FlatList pagine se
// comporte differemment sur React Native Web (pas de snap au clavier, pas
// de pagination a la molette), alors que des boutons se comportent de la
// meme facon partout. L'ecran est aussi atteignable depuis Famille pour
// etre revu : « Passer » comme « Commencer » marquent la presentation
// comme vue, sinon elle reviendrait au prochain passage par les onglets.

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store/useStore';
import { TRADUCTIONS } from '../constants/i18n';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { retour } from '../lib/navigation';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// Une icone et une couleur par etape ; les textes viennent de i18n, dans
// le meme ordre. Les fonds reprennent ceux des lignes de l'onglet Famille.
const ETAPES: { icone: IoniconName; couleur: string; fond: string }[] = [
  { icone: 'calendar-outline', couleur: COLORS.vert, fond: '#EEF4F1' },
  { icone: 'receipt-outline', couleur: COLORS.terracotta, fond: '#F6EFEA' },
  { icone: 'chatbubbles-outline', couleur: COLORS.vertProfond, fond: '#E8ECEB' },
  { icone: 'book-outline', couleur: COLORS.or, fond: '#F7F1DF' },
];

export default function BienvenueScreen() {
  const router = useRouter();
  const langue = useStore((s) => s.langue);
  const marquerDemoVue = useStore((s) => s.marquerDemoVue);
  const t = TRADUCTIONS[langue].bienvenue;
  const [etape, setEtape] = useState(0);

  const derniere = etape === ETAPES.length - 1;
  const textes = t.etapes[etape];
  const visuel = ETAPES[etape];

  // Ouvert au premier lancement par-dessus les onglets, ou depuis Famille :
  // dans les deux cas il y a un ecran derriere. Le repli couvre le
  // rechargement direct de /bienvenue sur le web.
  const terminer = () => {
    marquerDemoVue();
    retour(router, '/(tabs)/accueil');
  };

  const suivant = () => {
    if (derniere) terminer();
    else setEtape((e) => e + 1);
  };

  return (
    <SafeAreaView style={styles.conteneur} edges={['bottom']}>
      <View style={styles.topbar}>
        <Text style={styles.marque}>Dualia</Text>
        <Pressable onPress={terminer} hitSlop={12} style={styles.passer}>
          <Text style={styles.passerTexte}>{t.passer}</Text>
        </Pressable>
      </View>

      <View style={styles.corps}>
        <View style={[styles.cercle, { backgroundColor: visuel.fond }]}>
          <Ionicons name={visuel.icone} size={56} color={visuel.couleur} />
        </View>
        <Text style={styles.titre}>{textes.titre}</Text>
        <Text style={styles.texte}>{textes.texte}</Text>
      </View>

      <View style={styles.pied}>
        <View style={styles.points}>
          {ETAPES.map((_, i) => (
            <View key={i} style={[styles.point, i === etape && styles.pointActif]} />
          ))}
        </View>
        <Pressable style={styles.bouton} onPress={suivant}>
          <Text style={styles.boutonTexte}>{derniere ? t.commencer : t.suivant}</Text>
          <Ionicons name={derniere ? 'checkmark' : 'arrow-forward'} size={18} color={COLORS.blanc} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: COLORS.ivoire },

  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.sm,
  },
  marque: { fontFamily: FONTS.displaySemibold, fontSize: 18, color: COLORS.vertProfond },
  passer: { paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm },
  passerTexte: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.ardoise },

  corps: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  cercle: {
    width: 132, height: 132, borderRadius: 66,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.xxl,
  },
  titre: {
    fontFamily: FONTS.display, fontSize: 26, lineHeight: 32, color: COLORS.vertProfond,
    textAlign: 'center', marginBottom: SPACING.md,
  },
  texte: {
    fontFamily: FONTS.body, fontSize: 15, lineHeight: 22, color: COLORS.ardoise,
    textAlign: 'center', maxWidth: 320,
  },

  pied: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl, gap: SPACING.lg },
  points: { flexDirection: 'row', justifyContent: 'center', gap: SPACING.sm },
  point: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.ivoireFonce },
  pointActif: { width: 20, backgroundColor: COLORS.vert },
  bouton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.vert, borderRadius: RADIUS.md, paddingVertical: 14,
  },
  boutonTexte: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.blanc },
});
