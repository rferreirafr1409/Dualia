// components/ErrorBoundary.tsx
//
// Le dernier filet avant l'ecran blanc.
//
// Sur le web, une exception levee pendant le rendu demonte tout l'arbre React :
// la page devient blanche, definitivement, sans message et sans bouton. Il n'y
// a pas d'overlay d'erreur dans un export statique — celui d'expo-router
// n'existe qu'en developpement.
//
// Cette frontiere etait posee sur un seul ecran, Finances, et affichait la
// trace d'appels JavaScript en clair. Une pile d'appels devant un magistrat ou
// un avocat vaut a peu pres autant qu'un ecran blanc : elle dit « ce produit
// n'est pas fini ». On affiche donc une phrase et une sortie, et on garde le
// detail technique pour la console, ou il sert vraiment.

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';

type Props = { children: React.ReactNode };
type State = { enErreur: boolean };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { enErreur: false };
  }

  static getDerivedStateFromError() {
    return { enErreur: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Console uniquement : c'est la que le detail est utile, et nulle part
    // ailleurs.
    console.error('[Dualia] Écran interrompu :', error, info.componentStack);
  }

  recharger = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
      return;
    }
    // Sur mobile, pas de rechargement de page : on retente le rendu.
    this.setState({ enErreur: false });
  };

  render() {
    if (!this.state.enErreur) return this.props.children;

    return (
      <View style={styles.ecran}>
        <View style={styles.carte}>
          <Text style={styles.titre}>Cet écran n'a pas pu s'afficher</Text>
          <Text style={styles.texte}>
            Vos données sont intactes. Rechargez la page : si le problème persiste, il vient
            probablement d'un élément précis de votre espace, et nous pouvons le corriger.
          </Text>
          <Pressable style={styles.bouton} onPress={this.recharger}>
            <Text style={styles.boutonTexte}>Recharger</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  ecran: {
    flex: 1,
    backgroundColor: COLORS.ivoire,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  carte: {
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.bordure,
    padding: SPACING.xl,
    maxWidth: 440,
    width: '100%',
  },
  titre: {
    fontFamily: FONTS.display,
    fontSize: 19,
    color: COLORS.vertProfond,
    marginBottom: SPACING.sm,
  },
  texte: {
    fontFamily: FONTS.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: COLORS.ardoise,
  },
  bouton: {
    backgroundColor: COLORS.vert,
    borderRadius: RADIUS.md,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  boutonTexte: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.blanc },
});
