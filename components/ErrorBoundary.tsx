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
import { useStore } from '../store/useStore';

const LIBELLES: Record<'fr' | 'pt' | 'es' | 'en', { titre: string; texte: string; recharger: string }> = {
  fr: {
    titre: "Cet écran n'a pas pu s'afficher",
    texte: "Vos données sont intactes. Rechargez la page : si le problème persiste, il vient probablement d'un élément précis de votre espace, et nous pouvons le corriger.",
    recharger: 'Recharger',
  },
  pt: {
    titre: 'Não foi possível mostrar este ecrã',
    texte: 'Os seus dados estão intactos. Recarregue a página: se o problema persistir, vem provavelmente de um elemento específico do seu espaço, e podemos corrigi-lo.',
    recharger: 'Recarregar',
  },
  es: {
    titre: 'Esta pantalla no se ha podido mostrar',
    texte: 'Tus datos están intactos. Recarga la página: si el problema persiste, probablemente venga de un elemento concreto de tu espacio, y podemos corregirlo.',
    recharger: 'Recargar',
  },
  en: {
    titre: 'This screen could not be displayed',
    texte: 'Your data is intact. Reload the page: if the problem persists, it probably comes from a specific item in your space, and we can fix it.',
    recharger: 'Reload',
  },
};

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

    // Composant de classe : pas de hook, on lit l'etat du store directement.
    const l = LIBELLES[useStore.getState().langue] ?? LIBELLES.fr;

    return (
      <View style={styles.ecran}>
        <View style={styles.carte}>
          <Text style={styles.titre}>{l.titre}</Text>
          <Text style={styles.texte}>{l.texte}</Text>
          <Pressable style={styles.bouton} onPress={this.recharger}>
            <Text style={styles.boutonTexte}>{l.recharger}</Text>
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
