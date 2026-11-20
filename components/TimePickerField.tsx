// components/TimePickerField.tsx
//
// Sélecteur d'heure en deux colonnes (heures / minutes), même habillage que
// DatePickerField. DUA-149 : un testeur iPhone tapait l'heure au clavier et
// trouvait ça pénible ; ici on choisit, on ne saisit plus. L'heure reste
// optionnelle : « Sans heure » vide le champ.
//
// La valeur est une chaîne « HH:mm » ou '' (pas d'heure), ce que les écrans
// enregistraient déjà, donc rien ne change côté store.

import React, { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { useStore } from '../store/useStore';

type Langue = 'fr' | 'pt' | 'es' | 'en';

const PLACEHOLDER: Record<Langue, string> = {
  fr: 'Sans heure',
  pt: 'Sem hora',
  es: 'Sin hora',
  en: 'No time',
};
const SANS_HEURE: Record<Langue, string> = {
  fr: 'Sans heure',
  pt: 'Sem hora',
  es: 'Sin hora',
  en: 'No time',
};
const VALIDER: Record<Langue, string> = { fr: 'Valider', pt: 'Confirmar', es: 'Confirmar', en: 'Done' };
const HEURES_LABEL: Record<Langue, string> = { fr: 'Heures', pt: 'Horas', es: 'Horas', en: 'Hours' };
const MINUTES_LABEL: Record<Langue, string> = { fr: 'Minutes', pt: 'Minutos', es: 'Minutos', en: 'Minutes' };

const HEURES = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const deuxChiffres = (n: number) => String(n).padStart(2, '0');

type Props = {
  label: string;
  // « HH:mm » ou '' quand aucune heure n'est choisie.
  value: string;
  onChange: (heure: string) => void;
};

export default function TimePickerField({ label, value, onChange }: Props) {
  const langue = useStore((s) => s.langue) as Langue;
  const [visible, setVisible] = useState(false);

  const [h, m] = value ? value.split(':').map(Number) : [NaN, NaN];
  const [heure, setHeure] = useState<number>(Number.isFinite(h) ? h : 9);
  // On arrondit au pas de 5 min pour qu'une valeur existante (« 14:32 »)
  // tombe sur une case de la grille.
  const [minute, setMinute] = useState<number>(Number.isFinite(m) ? Math.round(m / 5) * 5 % 60 : 0);

  const ouvrir = () => {
    if (value) {
      const [hh, mm] = value.split(':').map(Number);
      if (Number.isFinite(hh)) setHeure(hh);
      if (Number.isFinite(mm)) setMinute(Math.round(mm / 5) * 5 % 60);
    }
    setVisible(true);
  };

  const valider = () => {
    onChange(`${deuxChiffres(heure)}:${deuxChiffres(minute)}`);
    setVisible(false);
  };

  const effacer = () => {
    onChange('');
    setVisible(false);
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={ouvrir} accessibilityRole="button">
        <Text style={[styles.fieldText, !value && styles.fieldPlaceholder]}>
          {value || (PLACEHOLDER[langue] ?? PLACEHOLDER.fr)}
        </Text>
        <Ionicons name="time-outline" size={17} color={COLORS.ardoise} />
      </Pressable>

      <Modal visible={visible} animationType="fade" transparent onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.apercu}>
              {deuxChiffres(heure)}:{deuxChiffres(minute)}
            </Text>

            <View style={styles.colonnes}>
              <View style={styles.colonne}>
                <Text style={styles.colonneTitre}>{HEURES_LABEL[langue] ?? HEURES_LABEL.fr}</Text>
                <ScrollView style={styles.liste} showsVerticalScrollIndicator={false}>
                  {HEURES.map((hh) => {
                    const active = hh === heure;
                    return (
                      <Pressable
                        key={hh}
                        style={[styles.ligne, active && styles.ligneActive]}
                        onPress={() => setHeure(hh)}
                      >
                        <Text style={[styles.ligneTxt, active && styles.ligneTxtActive]}>{deuxChiffres(hh)}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.colonne}>
                <Text style={styles.colonneTitre}>{MINUTES_LABEL[langue] ?? MINUTES_LABEL.fr}</Text>
                <ScrollView style={styles.liste} showsVerticalScrollIndicator={false}>
                  {MINUTES.map((mm) => {
                    const active = mm === minute;
                    return (
                      <Pressable
                        key={mm}
                        style={[styles.ligne, active && styles.ligneActive]}
                        onPress={() => setMinute(mm)}
                      >
                        <Text style={[styles.ligneTxt, active && styles.ligneTxtActive]}>{deuxChiffres(mm)}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            <Pressable style={styles.validerBtn} onPress={valider}>
              <Text style={styles.validerTxt}>{VALIDER[langue] ?? VALIDER.fr}</Text>
            </Pressable>
            <Pressable style={styles.effacerBtn} onPress={effacer}>
              <Text style={styles.effacerTxt}>{SANS_HEURE[langue] ?? SANS_HEURE.fr}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.ardoise, marginTop: SPACING.lg, marginBottom: 6 },
  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  fieldText: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.vertProfond },
  fieldPlaceholder: { color: COLORS.ardoise },
  overlay: { flex: 1, backgroundColor: 'rgba(28,43,37,0.5)', alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  card: { backgroundColor: COLORS.ivoire, borderRadius: RADIUS.xl, padding: SPACING.lg, width: '100%', maxWidth: 300 },
  apercu: { fontFamily: FONTS.display, fontSize: 28, color: COLORS.vertProfond, textAlign: 'center', marginBottom: SPACING.md },
  colonnes: { flexDirection: 'row', gap: SPACING.md },
  colonne: { flex: 1 },
  colonneTitre: {
    fontFamily: FONTS.bodySemibold, fontSize: 10.5, color: COLORS.ardoise, textTransform: 'uppercase',
    textAlign: 'center', marginBottom: 4,
  },
  liste: { maxHeight: 220, backgroundColor: COLORS.blanc, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.bordure },
  ligne: { paddingVertical: 10, alignItems: 'center' },
  ligneActive: { backgroundColor: COLORS.vert },
  ligneTxt: { fontFamily: FONTS.bodyMedium, fontSize: 15, color: COLORS.vertProfond },
  ligneTxtActive: { fontFamily: FONTS.bodyBold, color: COLORS.blanc },
  validerBtn: {
    marginTop: SPACING.md, alignItems: 'center', paddingVertical: 12,
    backgroundColor: COLORS.vertProfond, borderRadius: RADIUS.md,
  },
  validerTxt: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.blanc },
  effacerBtn: { marginTop: SPACING.sm, alignItems: 'center', paddingVertical: 8 },
  effacerTxt: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.ardoise },
});
