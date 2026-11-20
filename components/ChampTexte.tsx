// DUA-152 : sur iPhone, certains claviers n'ont aucune touche pour se fermer.
// Le pavé numérique (montants, codes, téléphone) n'a pas de touche « Retour »,
// et dans un champ sur plusieurs lignes « Retour » fait un saut de ligne.
// Résultat : le clavier reste affiché et cache le bas du formulaire.
//
// ChampTexte est un TextInput qui, sur iOS et pour ces claviers-là, ajoute
// au-dessus du clavier une petite barre avec un bouton « OK » qui le ferme.
// Ailleurs (Android, web, clavier texte classique), il se comporte exactement
// comme un TextInput.
//
// Chaque champ a sa propre barre (identifiant unique) : avec la nouvelle
// architecture de React Native, une barre ne s'attache qu'à un seul champ.
import React, { forwardRef, useId } from 'react';
import {
  InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, Text, TextInput,
  TextInputProps, View,
} from 'react-native';
import { COLORS, FONTS } from '../constants/theme';

const CLAVIERS_SANS_RETOUR = new Set([
  'decimal-pad', 'number-pad', 'numeric', 'phone-pad', 'numbers-and-punctuation',
]);

export function besoinBoutonOK(props: TextInputProps): boolean {
  if (Platform.OS !== 'ios') return false;
  if (props.multiline) return true;
  return !!props.keyboardType && CLAVIERS_SANS_RETOUR.has(props.keyboardType);
}

export const ChampTexte = forwardRef<TextInput, TextInputProps>(function ChampTexte(props, ref) {
  const brut = useId();
  const id = 'clavier-ok-' + brut.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!besoinBoutonOK(props) || props.inputAccessoryViewID) {
    return <TextInput ref={ref} {...props} />;
  }
  return (
    <>
      <TextInput ref={ref} {...props} inputAccessoryViewID={id} />
      <InputAccessoryView nativeID={id}>
        <View style={styles.barre}>
          <Pressable
            onPress={() => Keyboard.dismiss()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="OK"
          >
            <Text style={styles.ok}>OK</Text>
          </Pressable>
        </View>
      </InputAccessoryView>
    </>
  );
});

const styles = StyleSheet.create({
  barre: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: COLORS.ivoireFonce,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.bordure,
  },
  ok: { fontFamily: FONTS.bodySemibold, fontSize: 16, color: COLORS.vert },
});

export default ChampTexte;
