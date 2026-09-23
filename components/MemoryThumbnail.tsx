// components/MemoryThumbnail.tsx
//
// Miniature d'aperçu pour un souvenir replié — recadrage (cover) autorisé
// ici, contrairement à JournalMemoryImage qui affiche la photo complète.

import { View, Image, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '../constants/theme';

interface MemoryThumbnailProps {
  photoUrl?: string;
  emoji?: string;
  size?: number;
}

export default function MemoryThumbnail({ photoUrl, emoji, size = 56 }: MemoryThumbnailProps) {
  if (photoUrl) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={[styles.image, { width: size, height: size, borderRadius: RADIUS.md }]}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={[styles.emojiWrap, { width: size, height: size, borderRadius: RADIUS.md }]}>
      <Text style={{ fontSize: size * 0.4 }}>{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: COLORS.ivoireFonce },
  emojiWrap: { backgroundColor: 'rgba(201,168,76,0.14)', alignItems: 'center', justifyContent: 'center' },
});