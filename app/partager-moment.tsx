// app/partager-moment.tsx

import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../store/useStore';
import { COLORS, SPACING, FONTS, RADIUS } from '../constants/theme';
import { TRADUCTIONS } from '../constants/i18n';

let ImagePicker: typeof import('expo-image-picker') | null = null;
try {
  ImagePicker = require('expo-image-picker');
} catch {
  ImagePicker = null;
}

export default function PartagerMomentScreen() {
  const router = useRouter();
  const langue = useStore((s) => s.langue);
  const enfants = useStore((s) => s.enfants);
  const ajouterMoment = useStore((s) => s.ajouterMoment);
  const t = TRADUCTIONS[langue].filDeVie;

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoRatio, setPhotoRatio] = useState<number>(4 / 3);
  const [texte, setTexte] = useState('');
  const [enfantChoisi, setEnfantChoisi] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const choisirPhoto = async () => {
    if (!ImagePicker) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    // Pas de recadrage forcé (allowsEditing) : on affiche la photo entière,
    // telle que prise, jamais un cadrage automatique qui pourrait couper
    // un visage.
    const resultat = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (!resultat.canceled && resultat.assets[0]) {
      const asset = resultat.assets[0];
      setPhotoUri(asset.uri);
      if (asset.width && asset.height) {
        setPhotoRatio(asset.width / asset.height);
      }
    }
  };

  const partager = async () => {
    if (!photoUri && !texte.trim()) {
      Alert.alert('', t.champRequis);
      return;
    }
    setEnvoi(true);
    try {
      await ajouterMoment({
        texte: texte.trim() || undefined,
        enfant: enfantChoisi ?? undefined,
        photoUri: photoUri ?? undefined,
      });
      router.back();
    } catch {
      Alert.alert('', t.champRequis);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <SafeAreaView style={styles.conteneur} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="close" size={22} color={COLORS.ardoise} />
          </Pressable>
          <View style={{ flex: 1, marginLeft: SPACING.md }}>
            <Text style={styles.headerTitre}>{t.modalTitre}</Text>
            <Text style={styles.headerSous}>{t.modalSousTitre}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {photoUri ? (
            <View style={styles.photoWrap}>
                           <Image source={{ uri: photoUri }} style={[styles.photo, { aspectRatio: photoRatio, height: undefined }]} />
              <Pressable style={styles.photoRetirer} onPress={() => setPhotoUri(null)}>
                <Ionicons name="trash-outline" size={16} color={COLORS.blanc} />
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.photoBtn} onPress={choisirPhoto}>
              <Ionicons name="camera-outline" size={24} color={COLORS.vert} />
              <Text style={styles.photoBtnTxt}>{t.choisirPhoto}</Text>
            </Pressable>
          )}

          <Text style={styles.label}>{t.texteLabel}</Text>
          <TextInput
            style={styles.input}
            value={texte}
            onChangeText={setTexte}
            placeholder={t.textePlaceholder}
            placeholderTextColor={COLORS.ardoise}
            multiline
            numberOfLines={3}
          />

          {enfants.length > 0 ? (
            <>
              <Text style={styles.label}>{t.associerEnfant}</Text>
              <View style={styles.enfantsLigne}>
                <Pressable
                  style={[styles.enfantChoix, enfantChoisi === null && styles.enfantChoixActif]}
                  onPress={() => setEnfantChoisi(null)}
                >
                  <Text style={[styles.enfantChoixTxt, enfantChoisi === null && styles.enfantChoixTxtActif]}>
                    {t.tous}
                  </Text>
                </Pressable>
                {enfants.map((e) => (
                  <Pressable
                    key={e.id}
                    style={[styles.enfantChoix, enfantChoisi === e.prenom && styles.enfantChoixActif]}
                    onPress={() => setEnfantChoisi(e.prenom)}
                  >
                    <Text style={[styles.enfantChoixTxt, enfantChoisi === e.prenom && styles.enfantChoixTxtActif]}>
                      {e.prenom}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <Pressable
            style={[styles.publierBtn, (envoi || (!photoUri && !texte.trim())) && styles.publierBtnDisabled]}
            onPress={partager}
            disabled={envoi || (!photoUri && !texte.trim())}
          >
            {envoi ? (
              <ActivityIndicator color={COLORS.blanc} />
            ) : (
              <Text style={styles.publierBtnTxt}>{t.publier}</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: COLORS.ivoire },
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.md,
  },
  headerTitre: { fontFamily: FONTS.display, fontSize: 20, color: COLORS.vertProfond },
  headerSous: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, marginTop: 2 },

  content: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl },

  photoBtn: {
    height: 160, borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.bordure, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: SPACING.xs, marginBottom: SPACING.lg,
    backgroundColor: COLORS.blanc,
  },
  photoBtnTxt: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.vert },
  photoWrap: { marginBottom: SPACING.lg, borderRadius: RADIUS.lg, overflow: 'hidden' },
  photo: { width: '100%', height: 220, backgroundColor: COLORS.ivoireFonce },
  photoRetirer: {
    position: 'absolute', top: SPACING.sm, right: SPACING.sm,
    backgroundColor: 'rgba(28,43,37,0.6)', borderRadius: RADIUS.full, padding: SPACING.xs,
  },

  label: {
    fontFamily: FONTS.bodySemibold, fontSize: 11, color: COLORS.ardoise,
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md,
    padding: SPACING.md, fontFamily: FONTS.body, fontSize: 14.5, color: COLORS.texte,
    minHeight: 84, textAlignVertical: 'top', marginBottom: SPACING.lg,
  },

  enfantsLigne: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.xl },
  enfantChoix: {
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.bordure, backgroundColor: COLORS.blanc,
  },
  enfantChoixActif: { backgroundColor: COLORS.vert, borderColor: COLORS.vert },
  enfantChoixTxt: { fontFamily: FONTS.bodyMedium, fontSize: 13, color: COLORS.texte },
  enfantChoixTxtActif: { color: COLORS.blanc },

  publierBtn: {
    backgroundColor: COLORS.vert, borderRadius: RADIUS.md, paddingVertical: SPACING.md,
    alignItems: 'center', justifyContent: 'center', minHeight: 50,
  },
  publierBtnDisabled: { opacity: 0.45 },
  publierBtnTxt: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.blanc },
});