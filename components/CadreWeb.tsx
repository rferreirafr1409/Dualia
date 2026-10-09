import { ReactNode } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../constants/theme';

// Sur grand ecran, TOUTE l'application vit dans une fenetre contenue et
// centree, pas etiree d'un bord a l'autre. Ce cadre etait pose dans la
// navigation par onglets seulement : la connexion, la creation d'espace, la
// fiche enfant ou les pages legales s'affichaient en pleine largeur, comme
// un formulaire etire. Il est maintenant pose une seule fois, a la racine,
// autour de tous les ecrans.
//
// Le plateau derriere garde une teinte visiblement plus sombre que la
// fenetre pour que le cadre se voie, meme sur un ecran tres large. Sous le
// seuil (telephone, tablette, fenetre reduite), on ne touche a rien.
export const SEUIL_GRAND_ECRAN = 1100;

export default function CadreWeb({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  if (width < SEUIL_GRAND_ECRAN) return <>{children}</>;

  const fenetreHeight = Math.min(height - 80, 860);
  const fenetreWidth = Math.min(width - 120, 1280);

  return (
    <LinearGradient
      colors={[COLORS.ivoireFonce, '#DAD4C7']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.plateau}
    >
      <View style={[styles.fenetre, { height: fenetreHeight, width: fenetreWidth }]}>
        {children}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  plateau: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fenetre: {
    backgroundColor: COLORS.ivoire,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(28,43,37,0.10)',
    shadowColor: COLORS.vertProfond,
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.22,
    shadowRadius: 60,
    elevation: 20,
  },
});
