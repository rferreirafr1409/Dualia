// components/JournalMemoryImage.tsx
//
// Affiche une photo de souvenir en respectant son ratio d'origine — jamais
// de recadrage destructif (cover). Une photo paysage reste large, une
// photo portrait reste haute et centrée sur un fond neutre, une hauteur
// maximale évite qu'une photo très verticale prenne tout l'écran.

import { useState, useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '../constants/theme';

interface Props {
  uri: string;
  maxHeight?: number;
  borderRadius?: number;
}

export default function JournalMemoryImage({ uri, maxHeight = 420, borderRadius = RADIUS.md }: Props) {
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    let annule = false;
    setRatio(null);
    Image.getSize(
      uri,
      (largeur, hauteur) => {
        if (!annule && largeur > 0 && hauteur > 0) setRatio(largeur / hauteur);
      },
      () => {
        if (!annule) setRatio(4 / 3);
      }
    );
    return () => {
      annule = true;
    };
  }, [uri]);

  return (
    <View style={[styles.fond, { borderRadius }]}>
      <Image
        source={{ uri }}
        style={ratio ? [styles.image, { aspectRatio: ratio, maxHeight }] : [styles.image, { height: 220 }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fond: {
    width: '100%',
    backgroundColor: COLORS.ivoireFonce,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
  },
}); 