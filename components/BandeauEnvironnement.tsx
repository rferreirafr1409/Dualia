// components/BandeauEnvironnement.tsx
//
// Petit bandeau « PRÉ-PROD » pose au-dessus de tous les ecrans quand
// l'application est compilee pour la pre-production. Personne ne doit pouvoir
// confondre les deux : la pre-prod a les memes comptes et le meme mot de
// passe que la prod, seule cette etiquette les distingue a l'ecran.
//
// En production, LIBELLE_BANDEAU vaut null et le composant ne rend rien.
// pointerEvents="none" : il ne masque aucun bouton qu'on voudrait toucher.

import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LIBELLE_BANDEAU } from '../constants/environnement';
import { COLORS, FONTS } from '../constants/theme';

export default function BandeauEnvironnement() {
  const insets = useSafeAreaInsets();
  if (!LIBELLE_BANDEAU) return null;
  return (
    <View pointerEvents="none" style={[styles.conteneur, { top: insets.top }]}>
      <View style={styles.etiquette}>
        <Text style={styles.texte}>{LIBELLE_BANDEAU}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  etiquette: {
    backgroundColor: COLORS.avertissement,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  texte: {
    color: COLORS.blanc,
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
  },
});
