// components/Drapeau.tsx
//
// Drapeaux dessinés en vues natives plutôt qu'en emojis : Windows ne rend
// pas les emojis drapeaux (il affiche les deux lettres du pays à la place),
// ce qui casserait l'affichage web sur la majorité des postes. Ici le rendu
// est identique sur Windows, iOS, Android et web.
//
// Le drapeau anglais est simplifié (croix de Saint-Georges sur fond bleu,
// sans les diagonales de l'Union Jack) : à cette taille les diagonales ne
// produisent qu'un brouillage visuel, et les tracer proprement exigerait
// une dépendance SVG que ce projet n'a pas.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { Langue } from '../constants/i18n';

type Props = { code: Langue; taille?: number };

const BLEU_FR = '#0055A4';
const ROUGE_FR = '#EF4135';
const ROUGE_ES = '#AA151B';
const JAUNE_ES = '#F1BF00';
const VERT_PT = '#046A38';
const ROUGE_PT = '#DA291C';
const JAUNE_PT = '#FFE900';
const BLEU_EN = '#012169';
const ROUGE_EN = '#C8102E';
const BLANC = '#FFFFFF';

export default function Drapeau({ code, taille = 20 }: Props) {
  const cadre = {
    width: taille,
    height: taille,
    borderRadius: taille / 2,
    overflow: 'hidden' as const,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.18)',
  };

  if (code === 'fr') {
    return (
      <View style={[cadre, styles.rangee]}>
        <View style={[styles.part, { backgroundColor: BLEU_FR }]} />
        <View style={[styles.part, { backgroundColor: BLANC }]} />
        <View style={[styles.part, { backgroundColor: ROUGE_FR }]} />
      </View>
    );
  }

  if (code === 'es') {
    return (
      <View style={[cadre, styles.colonne]}>
        <View style={[styles.part, { backgroundColor: ROUGE_ES }]} />
        <View style={[styles.partDouble, { backgroundColor: JAUNE_ES }]} />
        <View style={[styles.part, { backgroundColor: ROUGE_ES }]} />
      </View>
    );
  }

  if (code === 'pt') {
    const sphere = taille * 0.4;
    return (
      <View style={[cadre, styles.rangee]}>
        <View style={[styles.partDouble, { backgroundColor: VERT_PT }]} />
        <View style={[styles.partTriple, { backgroundColor: ROUGE_PT }]} />
        <View
          style={{
            position: 'absolute',
            width: sphere,
            height: sphere,
            borderRadius: sphere / 2,
            backgroundColor: JAUNE_PT,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: ROUGE_PT,
            left: taille * 0.4 - sphere / 2,
            top: (taille - sphere) / 2,
          }}
        />
      </View>
    );
  }

  // Anglais
  const barreBlanche = taille * 0.34;
  const barreRouge = taille * 0.16;
  return (
    <View style={[cadre, { backgroundColor: BLEU_EN }]}>
      <View style={[styles.barreH, { height: barreBlanche, top: (taille - barreBlanche) / 2, backgroundColor: BLANC }]} />
      <View style={[styles.barreV, { width: barreBlanche, left: (taille - barreBlanche) / 2, backgroundColor: BLANC }]} />
      <View style={[styles.barreH, { height: barreRouge, top: (taille - barreRouge) / 2, backgroundColor: ROUGE_EN }]} />
      <View style={[styles.barreV, { width: barreRouge, left: (taille - barreRouge) / 2, backgroundColor: ROUGE_EN }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  rangee: { flexDirection: 'row' },
  colonne: { flexDirection: 'column' },
  part: { flex: 1 },
  partDouble: { flex: 2 },
  partTriple: { flex: 3 },
  barreH: { position: 'absolute', left: 0, right: 0 },
  barreV: { position: 'absolute', top: 0, bottom: 0 },
});
