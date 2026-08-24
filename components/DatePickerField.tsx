// components/DatePickerField.tsx

import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
  addMonths, subMonths, getDay,
} from 'date-fns';
import { fr, pt } from 'date-fns/locale';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { useStore } from '../store/useStore';

const JOURS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const JOURS_PT = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

function jourFR(date: Date): number {
  const d = getDay(date);
  return d === 0 ? 6 : d - 1;
}

type Props = {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  minDate?: Date;
};

export default function DatePickerField({ label, value, onChange, minDate }: Props) {
  const langue = useStore((s) => s.langue);
  const locale = langue === 'pt' ? pt : fr;
  const jours = langue === 'pt' ? JOURS_PT : JOURS_FR;

  const [visible, setVisible] = useState(false);
  const [moisAffiche, setMoisAffiche] = useState(value ?? new Date());

  const joursMois = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(moisAffiche), end: endOfMonth(moisAffiche) }),
    [moisAffiche]
  );
  const decalage = useMemo(() => jourFR(startOfMonth(moisAffiche)), [moisAffiche]);

  const ouvrir = () => {
    setMoisAffiche(value ?? new Date());
    setVisible(true);
  };

  const choisir = (jour: Date) => {
    onChange(jour);
    setVisible(false);
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={ouvrir}>
        <Text style={[styles.fieldText, !value && styles.fieldPlaceholder]}>
          {value ? format(value, 'd MMMM yyyy', { locale }) : (langue === 'pt' ? 'Selecionar uma data' : 'Sélectionner une date')}
        </Text>
        <Ionicons name="calendar-outline" size={17} color={COLORS.ardoise} />
      </Pressable>

      <Modal visible={visible} animationType="fade" transparent onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <View style={styles.nav}>
              <Pressable onPress={() => setMoisAffiche((m) => subMonths(m, 1))} style={styles.navBtn}>
                <Ionicons name="chevron-back" size={18} color={COLORS.vertProfond} />
              </Pressable>
              <Text style={styles.navTitle}>{format(moisAffiche, 'MMMM yyyy', { locale })}</Text>
              <Pressable onPress={() => setMoisAffiche((m) => addMonths(m, 1))} style={styles.navBtn}>
                <Ionicons name="chevron-forward" size={18} color={COLORS.vertProfond} />
              </Pressable>
            </View>

            <View style={styles.dowRow}>
              {jours.map((j, i) => (
                <Text key={i} style={styles.dow}>{j}</Text>
              ))}
            </View>

            <View style={styles.grid}>
              {Array.from({ length: decalage }).map((_, i) => (
                <View key={`v-${i}`} style={styles.cell} />
              ))}
              {joursMois.map((jour) => {
                const selected = value ? isSameDay(jour, value) : false;
                const disabled = minDate ? jour < minDate : false;
                return (
                  <Pressable
                    key={jour.toISOString()}
                    style={styles.cell}
                    disabled={disabled}
                    onPress={() => choisir(jour)}
                  >
                    <View style={[styles.dayCircle, selected && styles.dayCircleSelected]}>
                      <Text style={[
                        styles.dayText,
                        selected && styles.dayTextSelected,
                        disabled && styles.dayTextDisabled,
                      ]}>
                        {format(jour, 'd')}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={styles.closeBtn} onPress={() => setVisible(false)}>
              <Text style={styles.closeBtnText}>{langue === 'pt' ? 'Fechar' : 'Fermer'}</Text>
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
  card: { backgroundColor: COLORS.ivoire, borderRadius: RADIUS.xl, padding: SPACING.lg, width: '100%', maxWidth: 340 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  navBtn: { padding: 6, borderRadius: RADIUS.md, backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure },
  navTitle: { fontFamily: FONTS.display, fontSize: 15, color: COLORS.vertProfond, textTransform: 'capitalize' },
  dowRow: { flexDirection: 'row', marginBottom: 4 },
  dow: {
    flex: 1, textAlign: 'center', fontFamily: FONTS.bodySemibold, fontSize: 10.5,
    color: COLORS.ardoise, textTransform: 'uppercase',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dayCircleSelected: { backgroundColor: COLORS.vert },
  dayText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.vertProfond },
  dayTextSelected: { fontFamily: FONTS.bodyBold, color: COLORS.blanc },
  dayTextDisabled: { color: COLORS.bordure },
  closeBtn: { marginTop: SPACING.md, alignItems: 'center', paddingVertical: 10 },
  closeBtnText: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.ardoise },
});
