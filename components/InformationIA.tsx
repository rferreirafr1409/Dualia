// components/InformationIA.tsx
//
// Information sur l'usage d'une IA, la ou des donnees du parent partent vers
// un modele : messagerie (reformulation et reperage des rendez-vous), scan de
// ticket, import du jugement (DUA-099).
//
// Apple (regle 5.1.2) et le RGPD exigent que la personne soit informee avant
// que ses donnees soient confiees a un tiers, ici Anthropic. Rien ne le
// disait dans l'application : la politique de confidentialite ne parlait que
// des documents et des tickets, et la messagerie analysait aussi les messages
// du co-parent sans un mot.
//
// Deux usages :
//   <InformationIA contexte="messagerie" cle="messagerie" />  bandeau avec
//     « J'ai compris », memorise sur l'appareil, qui disparait ensuite ;
//   <InformationIA contexte="ticket" />  simple note, toujours visible.

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useStore } from '../store/useStore';
import { COLORS, FONTS, SPACING } from '../constants/theme';

type Contexte = 'messagerie' | 'ticket' | 'jugement';

const TEXTES: Record<'fr' | 'pt' | 'es' | 'en', Record<Contexte, string> & { savoirPlus: string; compris: string }> = {
  fr: {
    messagerie:
      "Les messages de cette conversation, les vôtres comme ceux de votre co-parent, sont analysés par une intelligence artificielle (Anthropic) pour proposer une formulation plus apaisée et repérer les dates et rendez-vous. Ils ne servent pas à entraîner un modèle.",
    ticket: "La lecture du ticket est faite par une intelligence artificielle (Anthropic). La photo ne sert pas à entraîner un modèle. Vérifiez le montant avant de valider.",
    jugement: "La lecture du document est faite par une intelligence artificielle (Anthropic). Le document ne sert pas à entraîner un modèle. Seul l'original fait foi : vous validez chaque clause.",
    savoirPlus: 'En savoir plus',
    compris: "J'ai compris",
  },
  pt: {
    messagerie:
      'As mensagens desta conversa, as suas e as do outro progenitor, são analisadas por uma inteligência artificial (Anthropic) para sugerir um tom mais calmo e identificar datas e compromissos. Não servem para treinar um modelo.',
    ticket: 'A leitura do talão é feita por uma inteligência artificial (Anthropic). A foto não serve para treinar um modelo. Verifique o valor antes de validar.',
    jugement: 'A leitura do documento é feita por uma inteligência artificial (Anthropic). O documento não serve para treinar um modelo. Só o original faz fé: valida cada cláusula.',
    savoirPlus: 'Saber mais',
    compris: 'Entendi',
  },
  es: {
    messagerie:
      'Los mensajes de esta conversación, los tuyos y los del otro progenitor, son analizados por una inteligencia artificial (Anthropic) para proponer un tono más calmado y detectar fechas y citas. No se usan para entrenar un modelo.',
    ticket: 'La lectura del ticket la hace una inteligencia artificial (Anthropic). La foto no se usa para entrenar un modelo. Comprueba el importe antes de validar.',
    jugement: 'La lectura del documento la hace una inteligencia artificial (Anthropic). El documento no se usa para entrenar un modelo. Solo el original da fe: validas cada cláusula.',
    savoirPlus: 'Saber más',
    compris: 'Entendido',
  },
  en: {
    messagerie:
      'Messages in this conversation, yours and your co-parent\'s, are analysed by an artificial intelligence (Anthropic) to suggest a calmer wording and spot dates and appointments. They are not used to train a model.',
    ticket: 'The receipt is read by an artificial intelligence (Anthropic). The photo is not used to train a model. Check the amount before confirming.',
    jugement: 'The document is read by an artificial intelligence (Anthropic). The document is not used to train a model. Only the original is authoritative: you confirm each clause.',
    savoirPlus: 'Learn more',
    compris: 'Got it',
  },
};

const PREFIXE_CLE = 'dualia-ia-compris-';

type Props = {
  contexte: Contexte;
  /** Avec une cle, le bandeau se memorise sur l'appareil une fois compris. */
  cle?: string;
};

export default function InformationIA({ contexte, cle }: Props) {
  const router = useRouter();
  const langue = useStore((s) => s.langue);
  const t = TEXTES[langue] ?? TEXTES.fr;
  // Tant qu'on ne sait pas si le parent a deja compris, on n'affiche rien :
  // un bandeau qui clignote a chaque ouverture serait pire que pas de bandeau.
  const [visible, setVisible] = useState<boolean>(!cle);

  useEffect(() => {
    if (!cle) return;
    let actif = true;
    AsyncStorage.getItem(PREFIXE_CLE + cle)
      .then((v) => { if (actif) setVisible(v !== '1'); })
      .catch(() => { if (actif) setVisible(true); });
    return () => { actif = false; };
  }, [cle]);

  const comprendre = () => {
    setVisible(false);
    if (cle) AsyncStorage.setItem(PREFIXE_CLE + cle, '1').catch(() => {});
  };

  if (!visible) return null;

  return (
    <View style={styles.bandeau}>
      <Text style={styles.texte}>{t[contexte]}</Text>
      <View style={styles.actions}>
        <Pressable onPress={() => router.push('/confidentialite' as any)} hitSlop={6}>
          <Text style={styles.lien}>{t.savoirPlus}</Text>
        </Pressable>
        {cle ? (
          <Pressable onPress={comprendre} style={styles.boutonCompris} hitSlop={6}>
            <Text style={styles.boutonComprisTexte}>{t.compris}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bandeau: {
    backgroundColor: COLORS.ivoire,
    borderWidth: 1,
    borderColor: COLORS.bordure,
    borderRadius: 10,
    padding: 10,
    marginHorizontal: SPACING.xl,
    marginBottom: 8,
    gap: 6,
  },
  texte: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.ardoise, lineHeight: 17 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lien: { fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.vert, textDecorationLine: 'underline' },
  boutonCompris: { backgroundColor: COLORS.vert, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  boutonComprisTexte: { fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.blanc },
});
