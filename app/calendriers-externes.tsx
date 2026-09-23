// app/calendriers-externes.tsx
//
// Écran "Calendriers externes" — ajouter un calendrier .ics (par lien ou
// fichier), voir la liste des abonnements actifs, les resynchroniser ou
// les supprimer.
//
// Sélection de fichier : voir lib/pickerFichierICS.native.ts et
// lib/pickerFichierICS.web.ts — la résolution par extension de fichier
// (faite par Metro au moment du build, pas à l'exécution) garantit que
// expo-document-picker n'est jamais présent dans le bundle web, qui
// utilise à la place un <input type="file"> HTML natif.

import React, { useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView, TextInput, Switch, Alert, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { useCalendriersExternes } from '../hooks/useCalendriersExternes';
import { choisirFichierICS } from '../lib/pickerFichierICS';

const LIGNE_CARTE = 'rgba(23,63,50,0.12)';
const COULEURS_DISPONIBLES = ['#6B7F7A', '#2D6A4F', '#B5927C', '#C9A84C', '#8899AA', '#A66B8F'];

export default function CalendriersExternesScreen() {
  const router = useRouter();
  const {
    calendriers,
    chargement,
    erreur,
    ajouterParUrl,
    ajouterParFichier,
    resynchroniser,
    toggleActif,
    supprimer,
  } = useCalendriersExternes();

  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [modeAjout, setModeAjout] = useState<'url' | 'fichier'>('url');
  const [nom, setNom] = useState('');
  const [url, setUrl] = useState('');
  const [couleurChoisie, setCouleurChoisie] = useState(COULEURS_DISPONIBLES[0]);
  const [enCours, setEnCours] = useState(false);
  const [erreurFormulaire, setErreurFormulaire] = useState<string | null>(null);
  const [resyncEnCours, setResyncEnCours] = useState<string | null>(null);

  // Référence vers l'<input type="file"> caché, utilisé uniquement sur web.
  const inputFichierWebRef = useRef<HTMLInputElement | null>(null);

  const reinitialiserFormulaire = () => {
    setNom('');
    setUrl('');
    setCouleurChoisie(COULEURS_DISPONIBLES[0]);
    setErreurFormulaire(null);
    setModeAjout('url');
  };

  const validerAjoutUrl = async () => {
    if (!nom.trim() || !url.trim()) {
      setErreurFormulaire('Donne un nom et un lien .ics.');
      return;
    }
    setEnCours(true);
    setErreurFormulaire(null);
    const resultat = await ajouterParUrl(nom.trim(), url.trim(), couleurChoisie);
    setEnCours(false);
    if (resultat.ok) {
      setFormulaireOuvert(false);
      reinitialiserFormulaire();
    } else {
      setErreurFormulaire(resultat.erreur ?? 'Une erreur est survenue.');
    }
  };

  // Traite un contenu .ics déjà lu (texte), qu'il vienne du picker natif
  // ou de l'input web — même suite pour les deux plateformes.
  const traiterContenuFichier = async (contenuICS: string) => {
    setEnCours(true);
    setErreurFormulaire(null);
    const resultat = await ajouterParFichier(nom.trim(), contenuICS, couleurChoisie);
    setEnCours(false);
    if (resultat.ok) {
      setFormulaireOuvert(false);
      reinitialiserFormulaire();
    } else {
      setErreurFormulaire(resultat.erreur ?? 'Une erreur est survenue.');
    }
  };

  const choisirFichier = async () => {
    if (!nom.trim()) {
      setErreurFormulaire("Donne d'abord un nom à ce calendrier.");
      return;
    }

    if (Platform.OS === 'web') {
      // Déclenche le clic sur l'input HTML caché ; la suite se passe
      // dans onChangeFichierWeb ci-dessous.
      inputFichierWebRef.current?.click();
      return;
    }

    // Mobile natif : voir lib/pickerFichierICS.native.ts
    const resultat = await choisirFichierICS();
    if (!resultat) return;

    setEnCours(true);
    try {
      const contenu = await (await fetch(resultat.uri)).text();
      await traiterContenuFichier(contenu);
    } catch (e: any) {
      setEnCours(false);
      setErreurFormulaire(`Impossible de lire ce fichier : ${e.message ?? e}`);
    }
  };

  // Appelé par l'<input type="file"> web quand l'utilisateur choisit un fichier.
  const onChangeFichierWeb = (event: any) => {
    const fichier = event.target.files?.[0];
    if (!fichier) return;
    const lecteur = new FileReader();
    lecteur.onload = () => {
      const contenu = typeof lecteur.result === 'string' ? lecteur.result : '';
      traiterContenuFichier(contenu);
    };
    lecteur.onerror = () => setErreurFormulaire('Impossible de lire ce fichier.');
    lecteur.readAsText(fichier);
    event.target.value = ''; // permet de resélectionner le même fichier plus tard
  };

  const confirmerSuppression = (id: string, nomCalendrier: string) => {
    Alert.alert(
      'Supprimer ce calendrier ?',
      `"${nomCalendrier}" et tous ses événements seront retirés de ta Home.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => supprimer(id) },
      ]
    );
  };

  const relancerSync = async (id: string) => {
    setResyncEnCours(id);
    const resultat = await resynchroniser(id);
    setResyncEnCours(null);
    if (!resultat.ok) {
      Alert.alert('Synchronisation impossible', resultat.erreur ?? 'Une erreur est survenue.');
    }
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      {Platform.OS === 'web' ? (
        // @ts-ignore — élément DOM natif, valide uniquement sur web
        <input
          ref={inputFichierWebRef}
          type="file"
          accept=".ics,text/calendar"
          style={{ display: 'none' }}
          onChange={onChangeFichierWeb}
        />
      ) : null}

      <View style={styles.topbar}>
        <Pressable style={styles.retourBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={COLORS.vertProfond} />
        </Pressable>
        <Text style={styles.titre}>Calendriers externes</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.contenu} showsVerticalScrollIndicator={false}>
        <Text style={styles.sousTitre}>
          Abonne-toi au calendrier d'une école, d'un club, ou importe un fichier .ics. Ces événements
          s'affichent dans ton agenda, clairement identifiés, sans jamais modifier tes événements Dualia.
        </Text>

        {erreur ? <Text style={styles.erreurTexte}>{erreur}</Text> : null}

        {calendriers.map((cal) => (
          <View key={cal.id} style={styles.carteCalendrier}>
            <View style={[styles.pastille, { backgroundColor: cal.couleur }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.nomCalendrier} numberOfLines={1}>{cal.nom}</Text>
              <Text style={styles.metaCalendrier}>
                {cal.type === 'url' ? 'Lien .ics' : 'Fichier importé'}
                {cal.derniereSync ? ` · synchronisé le ${new Date(cal.derniereSync).toLocaleDateString('fr-FR')}` : ''}
              </Text>
            </View>
            {cal.type === 'url' ? (
              <Pressable
                style={styles.iconBtnPetit}
                onPress={() => relancerSync(cal.id)}
                disabled={resyncEnCours === cal.id}
              >
                <Ionicons
                  name="refresh"
                  size={15}
                  color={resyncEnCours === cal.id ? COLORS.ardoise : COLORS.vertProfond}
                />
              </Pressable>
            ) : null}
            <Switch
              value={cal.actif}
              onValueChange={() => toggleActif(cal.id)}
              trackColor={{ false: LIGNE_CARTE, true: COLORS.vert }}
              thumbColor={COLORS.blanc}
            />
            <Pressable style={styles.iconBtnPetit} onPress={() => confirmerSuppression(cal.id, cal.nom)}>
              <Ionicons name="trash-outline" size={15} color={COLORS.terracotta} />
            </Pressable>
          </View>
        ))}

        {!chargement && calendriers.length === 0 && !formulaireOuvert ? (
          <Text style={styles.muted}>Aucun calendrier externe pour l'instant.</Text>
        ) : null}

        {formulaireOuvert ? (
          <View style={styles.formulaire}>
            <View style={styles.modeSwitch}>
              <Pressable
                style={[styles.modeBtn, modeAjout === 'url' && styles.modeBtnActif]}
                onPress={() => setModeAjout('url')}
              >
                <Text style={[styles.modeBtnTexte, modeAjout === 'url' && styles.modeBtnTexteActif]}>Lien .ics</Text>
              </Pressable>
              <Pressable
                style={[styles.modeBtn, modeAjout === 'fichier' && styles.modeBtnActif]}
                onPress={() => setModeAjout('fichier')}
              >
                <Text style={[styles.modeBtnTexte, modeAjout === 'fichier' && styles.modeBtnTexteActif]}>Fichier</Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Nom (ex. École d'Emma)"
              placeholderTextColor={COLORS.ardoise}
              value={nom}
              onChangeText={setNom}
            />

            {modeAjout === 'url' ? (
              <TextInput
                style={styles.input}
                placeholder="https://... .ics"
                placeholderTextColor={COLORS.ardoise}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
            ) : null}

            <View style={styles.couleursRow}>
              {COULEURS_DISPONIBLES.map((c) => (
                <Pressable
                  key={c}
                  style={[styles.pastilleChoix, { backgroundColor: c }, couleurChoisie === c && styles.pastilleChoixActive]}
                  onPress={() => setCouleurChoisie(c)}
                />
              ))}
            </View>

            {erreurFormulaire ? <Text style={styles.erreurTexte}>{erreurFormulaire}</Text> : null}

            <View style={styles.formulaireActions}>
              <Pressable
                style={styles.btnAnnuler}
                onPress={() => { setFormulaireOuvert(false); reinitialiserFormulaire(); }}
              >
                <Text style={styles.btnAnnulerTexte}>Annuler</Text>
              </Pressable>
              <Pressable
                style={[styles.btnValider, enCours && { opacity: 0.6 }]}
                onPress={modeAjout === 'url' ? validerAjoutUrl : choisirFichier}
                disabled={enCours}
              >
                <Text style={styles.btnValiderTexte}>
                  {enCours ? 'Import…' : modeAjout === 'url' ? 'Ajouter' : 'Choisir le fichier'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.btnAjouter} onPress={() => setFormulaireOuvert(true)}>
            <Ionicons name="add" size={16} color={COLORS.vertProfond} />
            <Text style={styles.btnAjouterTexte}>Ajouter un calendrier</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ivoire, paddingTop: SPACING.xxl },

  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.xl, marginBottom: SPACING.lg,
  },
  retourBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.blanc,
    borderWidth: 1, borderColor: LIGNE_CARTE, alignItems: 'center', justifyContent: 'center',
  },
  titre: { fontFamily: FONTS.bodySemibold, fontSize: 16, color: COLORS.vertProfond },

  contenu: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xxxl, gap: SPACING.sm },
  sousTitre: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise, marginBottom: SPACING.md, lineHeight: 18 },
  muted: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise },
  erreurTexte: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.terracotta, marginBottom: SPACING.sm },

  carteCalendrier: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: LIGNE_CARTE,
    borderRadius: RADIUS.lg, padding: SPACING.md,
  },
  pastille: { width: 10, height: 10, borderRadius: 5 },
  nomCalendrier: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.texte },
  metaCalendrier: { fontFamily: FONTS.body, fontSize: 11, color: COLORS.ardoise, marginTop: 2 },
  iconBtnPetit: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.ivoireFonce,
  },

  btnAjouter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1, borderColor: COLORS.ardoise, borderStyle: 'dashed', borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md, marginTop: SPACING.sm,
  },
  btnAjouterTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.vertProfond },

  formulaire: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: LIGNE_CARTE,
    borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm, marginTop: SPACING.sm,
  },
  modeSwitch: {
    flexDirection: 'row', backgroundColor: COLORS.ivoireFonce, borderRadius: RADIUS.full, padding: 3,
  },
  modeBtn: { flex: 1, paddingVertical: 7, borderRadius: RADIUS.full, alignItems: 'center' },
  modeBtnActif: { backgroundColor: COLORS.vertProfond },
  modeBtnTexte: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.ardoise },
  modeBtnTexteActif: { color: COLORS.ivoire },

  input: {
    borderWidth: 1, borderColor: LIGNE_CARTE, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.texte,
  },

  couleursRow: { flexDirection: 'row', gap: SPACING.sm, paddingVertical: 4 },
  pastilleChoix: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'transparent' },
  pastilleChoixActive: { borderColor: COLORS.vertProfond },

  formulaireActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: 4 },
  btnAnnuler: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, alignItems: 'center', backgroundColor: COLORS.ivoireFonce },
  btnAnnulerTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.ardoise },
  btnValider: { flex: 1, paddingVertical: 10, borderRadius: RADIUS.md, alignItems: 'center', backgroundColor: COLORS.vertProfond },
  btnValiderTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.ivoire },
});
