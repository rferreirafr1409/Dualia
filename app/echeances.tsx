// app/echeances.tsx
//
// Alimente le widget "À anticiper" de la Home : deux sections indépendantes.
// 1. Démarches administratives/scolaires (table echeances_administratives) —
//    création, marquage traité/ignoré, suppression.
// 2. Dates d'expiration des documents existants (colonne date_expiration sur
//    la table documents) — pas de nouveau document créé ici, juste la date
//    posée sur un document déjà présent dans le Coffre-fort.
//
// Les dates se saisissent en texte au format AAAA-MM-JJ (pas de dépendance
// à un date-picker) : cohérent avec le reste de l'app (ex. les horaires
// saisis en texte libre dans le calendrier).

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, TextInput, Modal, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../constants/supabase';
import { useStore } from '../store/useStore';
import { TRADUCTIONS } from '../constants/i18n';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';

const LIGNE = 'rgba(23,63,50,0.12)';

type Echeance = {
  id: string;
  titre: string;
  description: string | null;
  date_echeance: string;
  enfant_id: string | null;
  recurrence: 'annuelle' | 'mensuelle' | null;
};

type DocumentLigne = {
  id: string;
  nom: string;
  categorie: string;
  date_expiration: string | null;
};

function dateValide(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}

export default function EcheancesScreen() {
  const router = useRouter();
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].echeances;
  const familleId = useStore((s) => s.familleId);
  const parents = useStore((s) => s.parents);
  const parentActif = useStore((s) => s.parentActif);
  const enfants = useStore((s) => s.enfants);
  const parentId = parents[parentActif]?.uuid;

  const [onglet, setOnglet] = useState<'demarches' | 'documents'>('demarches');
  const [echeances, setEcheances] = useState<Echeance[]>([]);
  const [documents, setDocuments] = useState<DocumentLigne[]>([]);
  const [chargement, setChargement] = useState(true);

  const [modalDemarcheOuvert, setModalDemarcheOuvert] = useState(false);
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [enfantId, setEnfantId] = useState<string | null>(null);
  const [recurrence, setRecurrence] = useState<'annuelle' | 'mensuelle' | null>(null);

  const [documentEnEdition, setDocumentEnEdition] = useState<DocumentLigne | null>(null);
  const [dateExpirationSaisie, setDateExpirationSaisie] = useState('');

  const charger = useCallback(async () => {
    if (!familleId) { setChargement(false); return; }
    setChargement(true);
    const [echRes, docRes] = await Promise.all([
      supabase
        .from('echeances_administratives')
        .select('id, titre, description, date_echeance, enfant_id, recurrence')
        .eq('famille_id', familleId)
        .eq('statut', 'a_venir')
        .order('date_echeance', { ascending: true }),
      supabase
        .from('documents')
        .select('id, nom, categorie, date_expiration')
        .eq('famille_id', familleId)
        .order('date_expiration', { ascending: true, nullsFirst: false }),
    ]);
    setEcheances(echRes.data ?? []);
    setDocuments(docRes.data ?? []);
    setChargement(false);
  }, [familleId]);

  useEffect(() => { charger(); }, [charger]);

  function ouvrirModalDemarche() {
    setTitre(''); setDescription(''); setDate(''); setEnfantId(null); setRecurrence(null);
    setModalDemarcheOuvert(true);
  }

  async function enregistrerDemarche() {
    if (!titre.trim() || !dateValide(date) || !familleId) {
      Alert.alert(t.champsIncompletsTitre, t.champsIncompletsMsg);
      return;
    }
    const { error } = await supabase.from('echeances_administratives').insert({
      famille_id: familleId,
      auteur_id: parentId,
      titre: titre.trim(),
      description: description.trim() || null,
      date_echeance: date,
      enfant_id: enfantId,
      recurrence,
    });
    if (error) { Alert.alert(t.erreurTitre, error.message); return; }
    setModalDemarcheOuvert(false);
    charger();
  }

  async function marquerTraite(id: string) {
    setEcheances((prev) => prev.filter((e) => e.id !== id));
    await supabase.from('echeances_administratives').update({ statut: 'traite' }).eq('id', id);
  }

  async function supprimerDemarche(id: string) {
    setEcheances((prev) => prev.filter((e) => e.id !== id));
    await supabase.from('echeances_administratives').delete().eq('id', id);
  }

  function ouvrirEditionDocument(doc: DocumentLigne) {
    setDocumentEnEdition(doc);
    setDateExpirationSaisie(doc.date_expiration ?? '');
  }

  async function enregistrerExpirationDocument() {
    if (!documentEnEdition) return;
    if (dateExpirationSaisie && !dateValide(dateExpirationSaisie)) {
      Alert.alert(t.dateInvalideTitre, t.dateInvalideMsg);
      return;
    }
    const nouvelleValeur = dateExpirationSaisie || null;
    setDocuments((prev) => prev.map((d) => (d.id === documentEnEdition.id ? { ...d, date_expiration: nouvelleValeur } : d)));
    setDocumentEnEdition(null);
    await supabase.from('documents').update({ date_expiration: nouvelleValeur }).eq('id', documentEnEdition.id);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.vertProfond} />
        </Pressable>
        <Text style={styles.titrePage}>{t.titrePage}</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.onglets}>
        <Pressable
          style={[styles.onglet, onglet === 'demarches' && styles.ongletActif]}
          onPress={() => setOnglet('demarches')}
        >
          <Text style={[styles.ongletTexte, onglet === 'demarches' && styles.ongletTexteActif]}>{t.ongletDemarches}</Text>
        </Pressable>
        <Pressable
          style={[styles.onglet, onglet === 'documents' && styles.ongletActif]}
          onPress={() => setOnglet('documents')}
        >
          <Text style={[styles.ongletTexte, onglet === 'documents' && styles.ongletTexteActif]}>{t.ongletDocuments}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {onglet === 'demarches' ? (
          <>
            {echeances.length === 0 && !chargement ? (
              <Text style={styles.vide}>{t.aucuneDemarche}</Text>
            ) : (
              echeances.map((e) => {
                const enfant = enfants.find((en) => en.id === e.enfant_id);
                const recurrenceLabel = e.recurrence === 'annuelle' ? t.recurrenceAnnuelle : e.recurrence === 'mensuelle' ? t.recurrenceMensuelle : null;
                return (
                  <View key={e.id} style={styles.carte}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.carteTitre}>{e.titre}</Text>
                      <Text style={styles.carteMeta}>
                        {new Date(e.date_echeance).toLocaleDateString(t.localeDate)}
                        {enfant ? ` · ${enfant.prenom}` : ''}
                        {recurrenceLabel ? ` · ${recurrenceLabel}` : ''}
                      </Text>
                      {e.description ? <Text style={styles.carteDesc}>{e.description}</Text> : null}
                    </View>
                    <Pressable onPress={() => marquerTraite(e.id)} style={styles.iconAction}>
                      <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.vert} />
                    </Pressable>
                    <Pressable onPress={() => supprimerDemarche(e.id)} style={styles.iconAction}>
                      <Ionicons name="trash-outline" size={18} color={COLORS.terracotta} />
                    </Pressable>
                  </View>
                );
              })
            )}
            <Pressable style={styles.ajouterBtn} onPress={ouvrirModalDemarche}>
              <Ionicons name="add" size={18} color={COLORS.blanc} />
              <Text style={styles.ajouterBtnTexte}>{t.ajouterDemarche}</Text>
            </Pressable>
          </>
        ) : (
          <>
            {documents.length === 0 && !chargement ? (
              <Text style={styles.vide}>{t.aucunDocument}</Text>
            ) : (
              documents.map((d) => (
                <Pressable key={d.id} style={styles.carte} onPress={() => ouvrirEditionDocument(d)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.carteTitre}>{d.nom}</Text>
                    <Text style={styles.carteMeta}>
                      {d.date_expiration
                        ? t.expireLe(new Date(d.date_expiration).toLocaleDateString(t.localeDate))
                        : t.pasDateExpiration}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.ardoise} />
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Modal nouvelle démarche */}
      <Modal visible={modalDemarcheOuvert} transparent animationType="slide" onRequestClose={() => setModalDemarcheOuvert(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCarte}>
            <Text style={styles.modalTitre}>{t.modalTitreDemarche}</Text>
            <TextInput style={styles.input} placeholder={t.champTitre} placeholderTextColor={COLORS.ardoise} value={titre} onChangeText={setTitre} />
            <TextInput
              style={[styles.input, { height: 70 }]}
              placeholder={t.champDetails}
              placeholderTextColor={COLORS.ardoise}
              value={description}
              onChangeText={setDescription}
              multiline
            />
            <TextInput
              style={styles.input}
              placeholder={t.champDate}
              placeholderTextColor={COLORS.ardoise}
              value={date}
              onChangeText={setDate}
            />
            {enfants.length > 0 ? (
              <View style={styles.chipsRow}>
                {enfants.map((en) => (
                  <Pressable
                    key={en.id}
                    style={[styles.chip, enfantId === en.id && styles.chipActif]}
                    onPress={() => setEnfantId(enfantId === en.id ? null : en.id)}
                  >
                    <Text style={[styles.chipTexte, enfantId === en.id && styles.chipTexteActif]}>{en.prenom}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={styles.chipsRow}>
              {(['annuelle', 'mensuelle'] as const).map((r) => (
                <Pressable
                  key={r}
                  style={[styles.chip, recurrence === r && styles.chipActif]}
                  onPress={() => setRecurrence(recurrence === r ? null : r)}
                >
                  <Text style={[styles.chipTexte, recurrence === r && styles.chipTexteActif]}>
                    {r === 'annuelle' ? t.recurrenceAnnuelle : t.recurrenceMensuelle}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.modalBoutons}>
              <Pressable style={styles.btnSecondaire} onPress={() => setModalDemarcheOuvert(false)}>
                <Text style={styles.btnSecondaireTexte}>{t.annuler}</Text>
              </Pressable>
              <Pressable style={styles.btnPrincipal} onPress={enregistrerDemarche}>
                <Text style={styles.btnPrincipalTexte}>{t.ajouter}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal date d'expiration d'un document */}
      <Modal visible={!!documentEnEdition} transparent animationType="slide" onRequestClose={() => setDocumentEnEdition(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCarte}>
            <Text style={styles.modalTitre}>{documentEnEdition?.nom}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.dateExpirationPlaceholder}
              placeholderTextColor={COLORS.ardoise}
              value={dateExpirationSaisie}
              onChangeText={setDateExpirationSaisie}
            />
            <View style={styles.modalBoutons}>
              <Pressable style={styles.btnSecondaire} onPress={() => setDocumentEnEdition(null)}>
                <Text style={styles.btnSecondaireTexte}>{t.annuler}</Text>
              </Pressable>
              <Pressable style={styles.btnPrincipal} onPress={enregistrerExpirationDocument}>
                <Text style={styles.btnPrincipalTexte}>{t.enregistrer}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ivoire },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.xl, paddingBottom: SPACING.sm,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  titrePage: { fontFamily: FONTS.displaySemibold, fontSize: 17, color: COLORS.vertProfond },

  onglets: { flexDirection: 'row', paddingHorizontal: SPACING.xl, gap: SPACING.sm, marginBottom: SPACING.sm },
  onglet: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: RADIUS.full, backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: LIGNE },
  ongletActif: { backgroundColor: COLORS.vert, borderColor: COLORS.vert },
  ongletTexte: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.vertProfond },
  ongletTexteActif: { color: COLORS.blanc },

  content: { padding: SPACING.xl, paddingTop: SPACING.sm, paddingBottom: SPACING.xxxl },
  vide: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise, marginBottom: SPACING.md },

  carte: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.xs, gap: SPACING.sm,
  },
  carteTitre: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.texte },
  carteMeta: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, marginTop: 2 },
  carteDesc: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.texte, marginTop: 4 },
  iconAction: { padding: 4 },

  ajouterBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.vert, borderRadius: RADIUS.md, paddingVertical: 12, marginTop: SPACING.sm,
  },
  ajouterBtnTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.blanc },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'flex-end' },
  modalCarte: { backgroundColor: COLORS.ivoire, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, padding: SPACING.xl },
  modalTitre: { fontFamily: FONTS.displaySemibold, fontSize: 16, color: COLORS.vertProfond, marginBottom: SPACING.md },
  input: {
    backgroundColor: COLORS.blanc, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: 10,
    fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.texte, marginBottom: SPACING.sm,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: LIGNE },
  chipActif: { backgroundColor: COLORS.vert, borderColor: COLORS.vert },
  chipTexte: { fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.vertProfond },
  chipTexteActif: { color: COLORS.blanc },
  modalBoutons: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  btnSecondaire: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: LIGNE },
  btnSecondaireTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.ardoise },
  btnPrincipal: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.vert },
  btnPrincipalTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.blanc },
});
