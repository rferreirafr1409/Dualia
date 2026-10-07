// components/BandeauEnvironnement.tsx
//
// Petit bandeau « PRÉ-PROD » pose en haut de tous les ecrans quand
// l'application est compilee pour la pre-production. Personne ne doit pouvoir
// confondre les deux : la pre-prod a les memes comptes et le meme mot de
// passe que la prod, seule cette etiquette les distingue a l'ecran.
//
// En production, LIBELLE_BANDEAU vaut null et le composant ne rend rien.
// Il prend sa place dans le flux (app/_layout.tsx le pose sous la marge de
// l'encoche) : pose par-dessus, il recouvrait les titres sur telephone.

import { StyleSheet, Text, View } from 'react-native';
import { LIBELLE_BANDEAU } from '../constants/environnement';
import { COLORS, FONTS } from '../constants/theme';

export default function BandeauEnvironnement() {
  if (!LIBELLE_BANDEAU) return null;
  return (
    <View pointerEvents="none" style={styles.conteneur}>
      <View style={styles.etiquette}>
        <Text style={styles.texte}>{LIBELLE_BANDEAU}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    alignItems: 'center',
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
