import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, StyleSheet, ActivityIndicator } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, TYPOGRAPHY } from '../constants/theme';
import { supabase } from '../constants/supabase';
import { useStore } from '../store/useStore';

// Écrans dont le bas est déjà occupé par une zone de saisie permanente.
// La bulle y recouvrirait le bouton d'envoi, et aucune position de repli
// ne tient : au-dessus du composeur elle masque les derniers messages,
// c'est-à-dire exactement ce qu'on vient lire. Le retour BETA reste
// accessible depuis tous les autres écrans.
const ECRANS_SANS_BULLE = ['/messagerie', '/echanges'];

const TEXTES = {
  fr: {
    titre: 'Un avis, une idée, un bug ?',
    sousTitre: "Vos premiers retours nous aident à construire Dualia.",
    placeholder: 'Dites-nous ce que vous en pensez...',
    envoyer: 'Envoyer',
    annuler: 'Annuler',
    merci: 'Merci pour votre retour !',
  },
  pt: {
    titre: 'Uma opinião, uma ideia, um erro?',
    sousTitre: 'Os seus primeiros retornos ajudam-nos a construir a Dualia.',
    placeholder: 'Diga-nos o que pensa...',
    envoyer: 'Enviar',
    annuler: 'Cancelar',
    merci: 'Obrigado pelo seu retorno!',
  },
  es: {
    titre: '¿Una opinión, una idea, un error?',
    sousTitre: 'Tus primeros comentarios nos ayudan a construir Dualia.',
    placeholder: 'Cuéntanos qué piensas...',
    envoyer: 'Enviar',
    annuler: 'Cancelar',
    merci: '¡Gracias por tu comentario!',
  },
  en: {
    titre: 'Feedback, an idea, a bug?',
    sousTitre: 'Your early feedback helps us build Dualia.',
    placeholder: 'Tell us what you think...',
    envoyer: 'Send',
    annuler: 'Cancel',
    merci: 'Thanks for your feedback!',
  },
};

export default function RetourBetaBouton() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const langue = useStore((s) => s.langue);
  const t = TEXTES[langue] ?? TEXTES.fr;

  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [note, setNote] = useState<number | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [succes, setSucces] = useState(false);

  const masquee = ECRANS_SANS_BULLE.some((ecran) => pathname?.startsWith(ecran));

  const envoyer = async () => {
    if (!message.trim()) return;
    setEnvoi(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('retours_beta').insert({
      user_id: user?.id,
      message: message.trim(),
      note,
      ecran: pathname,
    });
    setEnvoi(false);
    if (!error) {
      setSucces(true);
      setMessage('');
      setNote(null);
      setTimeout(() => {
        setSucces(false);
        setVisible(false);
      }, 1400);
    }
  };

  if (masquee) return null;

  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        activeOpacity={0.85}
        style={[styles.bouton, { bottom: 76 + insets.bottom }]}
      >
        <Ionicons name="chatbubble-ellipses" size={20} color={COLORS.blanc} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.carte}>
            {succes ? (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <Ionicons name="checkmark-circle" size={40} color={COLORS.vert} />
                <Text style={{ marginTop: 10, fontWeight: TYPOGRAPHY.semibold }}>{t.merci}</Text>
              </View>
            ) : (
              <>
                <Text style={styles.titre}>{t.titre}</Text>
                <Text style={styles.sousTitre}>{t.sousTitre}</Text>

                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginVertical: 16 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <TouchableOpacity key={n} onPress={() => setNote(n)}>
                      <Ionicons
                        name={note && n <= note ? 'star' : 'star-outline'}
                        size={26}
                        color={COLORS.or}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder={t.placeholder}
                  placeholderTextColor={COLORS.ardoise}
                  multiline
                  numberOfLines={4}
                  style={styles.input}
                />

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                  <TouchableOpacity style={styles.boutonAnnuler} onPress={() => setVisible(false)}>
                    <Text style={{ color: COLORS.vertProfond }}>{t.annuler}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.boutonEnvoyer, !message.trim() && { opacity: 0.5 }]}
                    onPress={envoyer}
                    disabled={!message.trim() || envoi}
                  >
                    {envoi ? <ActivityIndicator color={COLORS.blanc} /> : <Text style={{ color: COLORS.blanc, fontWeight: TYPOGRAPHY.semibold }}>{t.envoyer}</Text>}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bouton: {
    position: 'absolute',
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.vertProfond,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.or,
    zIndex: 50,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  carte: { backgroundColor: COLORS.ivoire, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  titre: { fontSize: TYPOGRAPHY.lg, fontWeight: TYPOGRAPHY.semibold, color: COLORS.vertProfond, textAlign: 'center' },
  sousTitre: { fontSize: TYPOGRAPHY.xs, color: COLORS.ardoise, textAlign: 'center', marginTop: 4 },
  input: {
    backgroundColor: COLORS.blanc,
    borderRadius: 14,
    padding: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  boutonAnnuler: { flex: 1, padding: 14, borderRadius: 14, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.05)' },
  boutonEnvoyer: { flex: 2, padding: 14, borderRadius: 14, alignItems: 'center', backgroundColor: COLORS.vert },
});