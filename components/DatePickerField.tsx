// components/DatePickerField.tsx

import React, { useState, useMemo } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, ScrollView } from 'react-native';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay,
  addMonths, subMonths, getDay, setYear, setMonth,
} from 'date-fns';
import { fr, pt } from 'date-fns/locale';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { useStore } from '../store/useStore';

const JOURS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const JOURS_PT = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
const MOIS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
const MOIS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

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
  const moisLabels = langue === 'pt' ? MOIS_PT : MOIS_FR;

  const [visible, setVisible] = useState(false);
  const [moisAffiche, setMoisAffiche] = useState(value ?? new Date());
  // Trois vues dans la même fenêtre : jour (calendrier classique), mois
  // (grille de 12), année (liste défilante) — pour choisir une date de
  // naissance en 2 tapotements plutôt qu'en cliquant "précédent" des
  // dizaines de fois.
  const [vue, setVue] = useState<'jours' | 'mois' | 'annees'>('jours');

  const joursMois = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(moisAffiche), end: endOfMonth(moisAffiche) }),
    [moisAffiche]
  );
  const decalage = useMemo(() => jourFR(startOfMonth(moisAffiche)), [moisAffiche]);

  const anneeActuelle = new Date().getFullYear();
  const annees = useMemo(() => {
    const liste: number[] = [];
    for (let a = anneeActuelle + 10; a >= anneeActuelle - 120; a--) liste.push(a);
    return liste;
  }, [anneeActuelle]);

  const ouvrir = () => {
    setMoisAffiche(value ?? new Date());
    setVue('jours');
    setVisible(true);
  };

  const choisir = (jour: Date) => {
    onChange(jour);
    setVisible(false);
  };

  const choisirAnnee = (annee: number) => {
    setMoisAffiche((m) => setYear(m, annee));
    setVue('mois');
  };

  const choisirMois = (moisIndex: number) => {
    setMoisAffiche((m) => setMonth(m, moisIndex));
    setVue('jours');
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
              <Pressable
                onPress={() => (vue === 'jours' ? setMoisAffiche((m) => subMonths(m, 1)) : setVue('jours'))}
                style={styles.navBtn}
              >
                <Ionicons name={vue === 'jours' ? 'chevron-back' : 'close'} size={18} color={COLORS.vertProfond} />
              </Pressable>

              <View style={styles.navTitreLigne}>
                <Pressable onPress={() => setVue('mois')} hitSlop={6}>
                  <Text style={styles.navTitre}>{format(moisAffiche, 'MMMM', { locale })}</Text>
                </Pressable>
                <Pressable onPress={() => setVue('annees')} hitSlop={6}>
                  <Text style={[styles.navTitre, styles.navTitreAnnee]}>{format(moisAffiche, 'yyyy')}</Text>
                </Pressable>
              </View>

              <Pressable
                onPress={() => (vue === 'jours' ? setMoisAffiche((m) => addMonths(m, 1)) : undefined)}
                style={styles.navBtn}
              >
                {vue === 'jours' ? <Ionicons name="chevron-forward" size={18} color={COLORS.vertProfond} /> : <View style={{ width: 18 }} />}
              </Pressable>
            </View>

            {vue === 'annees' ? (
              <ScrollView style={styles.listeScroll} showsVerticalScrollIndicator={false}>
                {annees.map((annee) => {
                  const disabled = minDate ? annee < minDate.getFullYear() : false;
                  const active = moisAffiche.getFullYear() === annee;
                  return (
                    <Pressable
                      key={annee}
                      style={[styles.anneeLigne, active && styles.anneeLigneActive]}
                      disabled={disabled}
                      onPress={() => choisirAnnee(annee)}
                    >
                      <Text style={[styles.anneeTxt, active && styles.anneeTxtActive, disabled && styles.dayTextDisabled]}>
                        {annee}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : vue === 'mois' ? (
              <View style={styles.moisGrille}>
                {moisLabels.map((m, i) => {
                  const disabled = minDate
                    ? moisAffiche.getFullYear() === minDate.getFullYear() && i < minDate.getMonth()
                    : false;
                  const active = moisAffiche.getMonth() === i;
                  return (
                    <Pressable
                      key={m}
                      style={[styles.moisCell, active && styles.moisCellActive]}
                      disabled={disabled}
                      onPress={() => choisirMois(i)}
                    >
                      <Text style={[styles.moisTxt, active && styles.moisTxtActive, disabled && styles.dayTextDisabled]}>
                        {m}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <>
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
              </>
            )}

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
  navTitreLigne: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navTitre: { fontFamily: FONTS.display, fontSize: 15, color: COLORS.vertProfond, textTransform: 'capitalize' },
  navTitreAnnee: { color: COLORS.vert },
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

  listeScroll: { maxHeight: 260 },
  anneeLigne: { paddingVertical: 10, alignItems: 'center', borderRadius: RADIUS.md },
  anneeLigneActive: { backgroundColor: COLORS.vert },
  anneeTxt: { fontFamily: FONTS.bodyMedium, fontSize: 15, color: COLORS.vertProfond },
  anneeTxtActive: { fontFamily: FONTS.bodyBold, color: COLORS.blanc },

  moisGrille: { flexDirection: 'row', flexWrap: 'wrap' },
  moisCell: { width: '33.33%', paddingVertical: 14, alignItems: 'center', borderRadius: RADIUS.md },
  moisCellActive: { backgroundColor: COLORS.vert },
  moisTxt: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.vertProfond },
  moisTxtActive: { fontFamily: FONTS.bodyBold, color: COLORS.blanc },

  closeBtn: { marginTop: SPACING.md, alignItems: 'center', paddingVertical: 10 },
  closeBtnText: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.ardoise },
});