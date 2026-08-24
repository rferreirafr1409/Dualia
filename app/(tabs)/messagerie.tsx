// app/(tabs)/messagerie.tsx

import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../../store/useStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { ExportIcon } from '../../components/icons';
import { TRADUCTIONS } from '../../constants/i18n';

const PARSE_MESSAGE_URL = 'https://dualia-backend.vercel.app/api/parse-message';

const fetchAvecRetry = async (url: string, options: RequestInit, tentatives = 2): Promise<Response> => {
  for (let i = 0; i < tentatives; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || i === tentatives - 1) return response;
      if ([502, 503, 504].includes(response.status)) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      return response;
    } catch (e) {
      if (i === tentatives - 1) throw e;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw new Error('parse_failed');
};

function formatDay(isoDate: string, langue: 'fr' | 'pt') {
  const d = new Date(isoDate);
  return d.toLocaleDateString(langue === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(isoDate: string, langue: 'fr' | 'pt') {
  const d = new Date(isoDate);
  return d.toLocaleTimeString(langue === 'pt' ? 'pt-PT' : 'fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function MessagerieScreen() {
  const router = useRouter();
  const messages = useStore((s) => s.messages);
  const parentActif = useStore((s) => s.parentActif);
  const setDraft = useStore((s) => s.setNouvelleDecisionDraft);
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].messagerie;
  const ajouterMessage = useStore((s) => s.ajouterMessage);
  const [texteEnvoi, setTexteEnvoi] = React.useState('');

  const envoyerMessage = () => {
    if (!texteEnvoi.trim()) return;
    ajouterMessage({
      id: 'msg-' + Date.now(),
      expediteurId: parentActif,
      contenu: texteEnvoi.trim(),
      dateEnvoi: new Date().toISOString(),
      statut: 'envoyé',
    });
    setTexteEnvoi('');
  };
  const evenementsCalendrier = useStore((s) => s.evenementsCalendrier);
  const ajouterEvenementCalendrier = useStore((s) => s.ajouterEvenementCalendrier);
  const messagesAnalyses = useStore((s) => s.messagesAnalyses);
  const marquerMessageAnalyse = useStore((s) => s.marquerMessageAnalyse);
  const ignorerSuggestion = useStore((s) => s.ignorerSuggestion);

  const [suggestions, setSuggestions] = React.useState<Record<string, { titre: string; date: string; enfant: string | null }>>({});

  React.useEffect(() => {
    messages.forEach((msg) => {
      if (messagesAnalyses.includes(msg.id)) return;
      marquerMessageAnalyse(msg.id);
      fetchAvecRetry(PARSE_MESSAGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texte: msg.contenu, langue }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.evenementDetecte && data.date) {
            setSuggestions((prev) => ({
              ...prev,
              [msg.id]: { titre: data.titre || 'Evenement', date: data.date, enfant: data.enfant },
            }));
          }
        })
        .catch(() => {});
    });
  }, [messages]);

  const confirmerSuggestion = (msgId: string) => {
    const sug = suggestions[msgId];
    if (!sug) return;
    ajouterEvenementCalendrier({
      id: 'evt-' + Date.now(),
      titre: sug.titre,
      date: sug.date,
      parentId: parentActif,
      enfant: sug.enfant || undefined,
      sourceMessageId: msgId,
    });
    setSuggestions((prev) => { const next = { ...prev }; delete next[msgId]; return next; });
  };

  const ignorerCetteSuggestion = (msgId: string) => {
    ignorerSuggestion(msgId);
    setSuggestions((prev) => { const next = { ...prev }; delete next[msgId]; return next; });
  };

  const formaliser = (contenu: string) => {
    setDraft(contenu);
    router.push('/decisions' as any);
  };

  let lastDay = '';

  return (
    <View style={styles.screen}>
      <View style={styles.topbar}>
        <Text style={styles.title}>{t.titre}</Text>
        <Text style={styles.subtitle}>{t.sousTitre}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {messages.map((msg) => {
          const day = formatDay(msg.dateEnvoi, langue);
          const showDaySeparator = day !== lastDay;
          lastDay = day;
          const fromMe = msg.expediteurId === parentActif;

          return (
            <View key={msg.id}>
              {showDaySeparator ? (
                <Text style={styles.dateSeparator}>{day}</Text>
              ) : null}

              <View style={[styles.bubbleRow, fromMe && styles.bubbleRowMe]}>
                <View style={styles.bubbleColumn}>
                  <View style={[styles.bubble, fromMe ? styles.bubbleMe : styles.bubbleOther]}>
                    <Text style={[styles.bubbleText, fromMe && styles.bubbleTextMe]}>{msg.contenu}</Text>
                    <Text style={[styles.bubbleMeta, fromMe && styles.bubbleMetaMe]}>{formatTime(msg.dateEnvoi, langue)}</Text>
              </View>
              {suggestions[msg.id] ? (
                <View style={styles.suggestionCard}>
                  <Text style={styles.suggestionTexte}>
                   Ajouter au calendrier : {suggestions[msg.id].titre}
                {suggestions[msg.id].enfant ? ` – ${suggestions[msg.id].enfant}` : ''}
                {' – '}
                {(() => {
                  const d = new Date(suggestions[msg.id].date);
                  const aUneHeure = d.getHours() !== 0 || d.getMinutes() !== 0;
                  return d.toLocaleDateString(langue === 'pt' ? 'pt-PT' : 'fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    ...(aUneHeure ? { hour: '2-digit', minute: '2-digit' } : {}),
                  });
                })()}
                {' ?'}
                  </Text>
                  <View style={styles.suggestionBtns}>
                    <Pressable style={styles.suggestionBtnIgnorer} onPress={() => ignorerCetteSuggestion(msg.id)}>
                      <Text style={styles.suggestionBtnIgnorerText}>Ignorer</Text>
                    </Pressable>
                    <Pressable style={styles.suggestionBtnConfirmer} onPress={() => confirmerSuggestion(msg.id)}>
                      <Text style={styles.suggestionBtnConfirmerText}>Confirmer</Text>
                    </Pressable>
                  </View>
                  </View>
                                ) : null}
              <Pressable
                    style={[styles.formaliserBtn, fromMe && styles.formaliserBtnMe]}
                    onPress={() => formaliser(msg.contenu)}
                  >
                    <ExportIcon size={11} color={COLORS.vert} strokeWidth={2} />
                    <Text style={styles.formaliserText}>{t.formaliser}</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
        <View style={styles.saisieZone}>
          <TextInput
            style={styles.saisieInput}
            value={texteEnvoi}
            onChangeText={setTexteEnvoi}
            placeholder={langue === 'pt' ? 'Escrever uma mensagem...' : 'Ecrire un message...'}
            placeholderTextColor={COLORS.ardoise}
            multiline
          />
          <Pressable style={styles.saisieBtnEnvoyer} onPress={envoyerMessage}>
            <Text style={styles.saisieBtnEnvoyerText}>Envoyer</Text>
          </Pressable>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ivoire },
  topbar: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.xl, paddingBottom: SPACING.md },
  title: { fontFamily: FONTS.display, fontSize: 24, color: COLORS.vertProfond },
  subtitle: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise, marginTop: 3 },
  content: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl * 2 },
  dateSeparator: {
    textAlign: 'center', fontFamily: FONTS.bodySemibold, fontSize: 10.5, color: COLORS.ardoise,
    textTransform: 'uppercase', letterSpacing: 0.4, marginVertical: SPACING.md,
  },
  bubbleRow: { flexDirection: 'row', marginBottom: SPACING.md },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubbleColumn: { maxWidth: '78%' },
  bubble: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 16 },
  bubbleOther: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure, borderBottomLeftRadius: 4,
  },
  bubbleMe: { backgroundColor: COLORS.vert, borderBottomRightRadius: 4 },
  bubbleText: { fontFamily: FONTS.body, fontSize: 13.5, lineHeight: 19, color: COLORS.vertProfond },
  bubbleTextMe: { color: COLORS.blanc },
  bubbleMeta: { fontFamily: FONTS.body, fontSize: 10, color: COLORS.ardoise, marginTop: 4 },
  bubbleMetaMe: { color: 'rgba(248, 246, 242, 0.75)', textAlign: 'right' },
  formaliserBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, paddingHorizontal: 4,
  },
  formaliserBtnMe: { alignSelf: 'flex-end' },
  formaliserText: { fontFamily: FONTS.bodySemibold, fontSize: 10.5, color: COLORS.vert },
  suggestionCard: { backgroundColor: COLORS.ivoire, borderWidth: 1, borderColor: COLORS.vert, borderRadius: 10, padding: 10, marginTop: 6, marginBottom: 8 },
  suggestionTexte: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.vertProfond, marginBottom: 8 },
  suggestionBtns: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  suggestionBtnIgnorer: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  suggestionBtnIgnorerText: { fontFamily: FONTS.bodySemibold, fontSize: 11, color: COLORS.ardoise },
  suggestionBtnConfirmer: { backgroundColor: COLORS.vert, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  suggestionBtnConfirmerText: { fontFamily: FONTS.bodySemibold, fontSize: 11, color: COLORS.blanc },
  saisieZone: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, backgroundColor: COLORS.blanc, borderTopWidth: 1, borderTopColor: COLORS.bordure },
  saisieInput: { flex: 1, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.vertProfond, maxHeight: 100 },
  saisieBtnEnvoyer: { backgroundColor: COLORS.vert, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  saisieBtnEnvoyerText: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.blanc }
});
