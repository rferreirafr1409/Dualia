import React, { useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
let ImagePicker: typeof import('expo-image-picker') | null = null;
if (Platform.OS !== 'web') {
  ImagePicker = require('expo-image-picker');
}

function alertCompat(titre: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? titre + '\n\n' + message : titre);
  } else {
    Alert.alert(titre, message);
  }
}
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../../store/useStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { Depense, CategorieDepense, ParentRole } from '../../types';
import DatePickerField from '../../components/DatePickerField';
import { TRADUCTIONS } from '../../constants/i18n';
import ErrorBoundary from '../../components/ErrorBoundary';

const BACKEND_URL = 'https://dualia-backend.vercel.app/api/scan-ticket';

// Taille max (en pixels, côté le plus long) et qualité JPEG appliquées avant
// l'envoi d'une photo au serveur. Sans ça, une photo Android haute résolution
// (souvent plusieurs Mo une fois en base64) peut dépasser la limite de taille
// des fonctions serverless Vercel (~4,5 Mo), arriver tronquée côté serveur,
// et faire échouer la lecture détaillée du ticket (un seul article détecté
// au lieu du détail ligne par ligne). La version native compressait déjà
// (quality: 0.6) ; le chemin web ne le faisait pas — corrigé ici.
const PHOTO_MAX_DIMENSION = 1600;
const PHOTO_JPEG_QUALITY = 0.7;

function compresserImageWeb(dataUrl: string): Promise<{ dataUrl: string; base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > PHOTO_MAX_DIMENSION || height > PHOTO_MAX_DIMENSION) {
        if (width >= height) {
          height = Math.round((height * PHOTO_MAX_DIMENSION) / width);
          width = PHOTO_MAX_DIMENSION;
        } else {
          width = Math.round((width * PHOTO_MAX_DIMENSION) / height);
          height = PHOTO_MAX_DIMENSION;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('canvas_unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const compresse = canvas.toDataURL('image/jpeg', PHOTO_JPEG_QUALITY);
      const base64 = compresse.split(',')[1];
      resolve({ dataUrl: compresse, base64, mediaType: 'image/jpeg' });
    };
    img.onerror = () => reject(new Error('image_load_failed'));
    img.src = dataUrl;
  });
}

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
  throw new Error('scan_failed');
};

const CATEGORIES: { key: CategorieDepense; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'sante', icon: 'medkit-outline' },
  { key: 'ecole', icon: 'school-outline' },
  { key: 'activites', icon: 'football-outline' },
  { key: 'quotidien', icon: 'basket-outline' },
  { key: 'vacances', icon: 'airplane-outline' },
  { key: 'alimentaire', icon: 'nutrition-outline' },
  { key: 'beaute', icon: 'sparkles-outline' },
  { key: 'vetements', icon: 'shirt-outline' },
  { key: 'transport', icon: 'car-outline' },
  { key: 'maison', icon: 'home-outline' },
  { key: 'autre', icon: 'ellipsis-horizontal-outline' },
];

function formatMontant(n: number): string {
  return `${n.toFixed(2)} €`;
}

function formatDateCourt(isoDate: string, langue: 'fr' | 'pt') {
  const d = new Date(isoDate);
  return d.toLocaleDateString(langue === 'pt' ? 'pt-PT' : 'fr-FR', { day: 'numeric', month: 'short' });
}

function FinancesScreenInner() {
  const depenses = useStore((s) => s.depenses);
  const parents = useStore((s) => s.parents);
  const parentActif = useStore((s) => s.parentActif);
  const ajouterDepense = useStore((s) => s.ajouterDepense);
  const reglerDepense = useStore((s) => s.reglerDepense);
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].finances;

  const [modalVisible, setModalVisible] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);

  const [formMontant, setFormMontant] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCommercant, setFormCommercant] = useState('');
  const [formCategorie, setFormCategorie] = useState<CategorieDepense>('quotidien');
  const [formDate, setFormDate] = useState<Date | null>(new Date());
  const [formPhotoUri, setFormPhotoUri] = useState<string | undefined>(undefined);
  const [formPartage, setFormPartage] = useState<'50/50' | 'total'>('50/50');
  const [scanLignes, setScanLignes] = useState<{ libelle: string; montant: number; categorie: string }[]>([]);
  const [scanRecapVisible, setScanRecapVisible] = useState(false);
  const [scanCommercant, setScanCommercant] = useState('');
  const webCameraInputRef = useRef<any>(null);
  const webGalleryInputRef = useRef<any>(null);
  const [detailDepense, setDetailDepense] = useState<Depense | null>(null);
  const [scanDate, setScanDate] = useState<Date | null>(null);

  const soldes = useMemo(() => {
    let totalA = 0;
    let totalB = 0;
    depenses.forEach((d) => {
      const partA = d.partA ?? (d.auteurId === 'A' ? d.montant : d.montant / 2);
      const partB = d.partB ?? (d.auteurId === 'B' ? d.montant : d.montant / 2);
      totalA += d.auteurId === 'A' ? d.montant : 0;
      totalB += d.auteurId === 'B' ? d.montant : 0;
    });
    const totalDepenses = totalA + totalB;
    const duA = totalDepenses / 2 - totalA;
    return { totalDepenses, solde: duA };
  }, [depenses]);

  const resetForm = () => {
    setFormMontant('');
    setFormDescription('');
    setFormCommercant('');
    setFormCategorie('quotidien');
    setFormDate(new Date());
    setFormPhotoUri(undefined);
    setFormPartage('50/50');
  };

  const ouvrirModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const lancerScan = async (depuisCamera: boolean) => {
    if (Platform.OS === 'web') {
      if (depuisCamera) { webCameraInputRef.current?.click(); } else { webGalleryInputRef.current?.click(); }
      return;
    }
    if (!ImagePicker) {
      alertCompat(t.scanEchec, "Le scan photo est disponible uniquement sur l\u0027application mobile.");
      return;
    }
    const permission = depuisCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      alertCompat(t.permissionRefusee, t.permissionRefuseeMsg);
      return;
    }

    const result = depuisCamera
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6 });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setFormPhotoUri(asset.uri);
    setScanLoading(true);

    try {
      const response = await fetchAvecRetry(BACKEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: asset.base64, mediaType: asset.mimeType || 'image/jpeg' }),
      });

      if (!response.ok) throw new Error('scan_failed');

      const data = await response.json();

      if (data.montant) setFormMontant(String(data.montant));
      if (data.commercant) setFormCommercant(data.commercant);
      if (data.description) setFormDescription(data.description);
      if (data.date) setFormDate(new Date(data.date));

    if (Array.isArray(data.lignes) && data.lignes.length > 1) {
      setScanLignes(data.lignes);
      setScanCommercant(data.commercant || '');
      setScanDate(data.date ? new Date(data.date) : new Date());
      setModalVisible(false);      setScanRecapVisible(true);
    }

      if (!(Array.isArray(data.lignes) && data.lignes.length > 1)) { alertCompat(t.scanReussi, t.scanReussiMsg); }
    } catch (e) {
      alertCompat(t.scanEchec, t.scanEchecMsg);
    } finally {
      setScanLoading(false);
    }
  };

  const traiterFichierWeb = (event: any, depuisCamera: boolean) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrlOriginal = reader.result as string;
      setScanLoading(true);
      try {
        // Compression systématique avant envoi : uniformise le format en
        // JPEG et réduit la taille, quelle que soit la résolution d'origine
        // de la photo (les photos Android peuvent être très volumineuses).
        const { dataUrl, base64, mediaType } = await compresserImageWeb(dataUrlOriginal);
        setFormPhotoUri(dataUrl);

        const response = await fetchAvecRetry(BACKEND_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64, mediaType }),
        });
        if (!response.ok) throw new Error('scan_failed');
        const data = await response.json();
        if (data.montant) setFormMontant(String(data.montant));
        if (data.commercant) setFormCommercant(data.commercant);
        if (data.description) setFormDescription(data.description);
        if (data.date) setFormDate(new Date(data.date));
        if (Array.isArray(data.lignes) && data.lignes.length > 1) {
          setScanLignes(data.lignes);
          setScanCommercant(data.commercant || '');
          setScanDate(data.date ? new Date(data.date) : new Date());
          setModalVisible(false);          setScanRecapVisible(true);
        }
        if (!(Array.isArray(data.lignes) && data.lignes.length > 1)) { alertCompat(t.scanReussi, t.scanReussiMsg); }
      } catch (e) {
        alertCompat(t.scanEchec, t.scanEchecMsg);
      } finally {
        setScanLoading(false);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const soumettre = () => {

    const montant = parseFloat(formMontant.replace(',', '.'));
    if (!montant || montant <= 0) {
      alertCompat(t.erreur, t.erreurMontant);
      return;
    }
    if (!formDate) {
      alertCompat(t.erreur, t.erreurDate);
      return;
    }

    const partA = formPartage === '50/50' ? montant / 2 : (parentActif === 'A' ? montant : 0);
    const partB = formPartage === '50/50' ? montant / 2 : (parentActif === 'B' ? montant : 0);

    const nouvelle: Depense = {
      id: `dep-${Date.now()}`,
      categorie: formCategorie,
      montant,
      description: formDescription || t.depenseSansTitre,
      auteurId: parentActif,
      date: formDate.toISOString(),
      rembourse: false,
      partA,
      partB,
      photoUri: formPhotoUri,
      commercant: formCommercant || undefined,
    };

    ajouterDepense(nouvelle);
    setModalVisible(false);
  };

  const soumettreLignesCategorisees = () => {
    const groupes: Record<string, number> = {};
    scanLignes.forEach((ligne) => {
      const cat = ligne.categorie || 'autre';
      groupes[cat] = (groupes[cat] || 0) + ligne.montant;
    });

    const dateFinale = scanDate || new Date();
    const commercantFinal = scanCommercant || undefined;

    Object.entries(groupes).forEach(([cat, montantCat], index) => {
      const partA = formPartage === '50/50' ? montantCat / 2 : (parentActif === 'A' ? montantCat : 0);
      const partB = formPartage === '50/50' ? montantCat / 2 : (parentActif === 'B' ? montantCat : 0);
      const nouvelle: Depense = {
        id: `dep-${Date.now()}-${index}`,
        categorie: cat as CategorieDepense,
        montant: montantCat,
        description: commercantFinal ? (commercantFinal + ' - ' + (t.categories[cat as keyof typeof t.categories] ?? cat)) : t.depenseSansTitre,
        auteurId: parentActif,
        date: dateFinale.toISOString(),
        rembourse: false,
        partA,
        partB,
        commercant: commercantFinal,
        lignesDetail: scanLignes.filter((l) => (l.categorie || 'autre') === cat).map((l) => ({ libelle: l.libelle, montant: l.montant })),
      };
      ajouterDepense(nouvelle);
    });

    setScanRecapVisible(false);
    setModalVisible(false);
    setScanLignes([]);
  };

  const parentNom = (id: ParentRole) => parents[id]?.nom ?? id;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={styles.header}>
          <Text style={styles.title}>{t.titre}</Text>
        </View>

        <View style={styles.soldeCard}>
          <Text style={styles.soldeLabel}>{t.totalDepenses}</Text>
          <Text style={styles.soldeMontant}>{formatMontant(soldes.totalDepenses)}</Text>
          <View style={styles.soldeSeparateur} />
          <Text style={styles.soldeLabel}>
            {soldes.solde >= 0
              ? `${parentNom(parentActif === 'A' ? 'B' : 'A')} ${t.doit} ${parentNom(parentActif)}`
              : `${parentNom(parentActif)} ${t.doit} ${parentNom(parentActif === 'A' ? 'B' : 'A')}`}
          </Text>
          <Text style={styles.soldeMontantSecondaire}>{formatMontant(Math.abs(soldes.solde))}</Text>
        </View>

        <Text style={styles.sectionTitre}>{t.depensesRecentes}</Text>

        {depenses.length === 0 && (
          <Text style={styles.videTexte}>{t.aucuneDepense}</Text>
        )}

        {depenses.map((dep) => {
          const cat = CATEGORIES.find((c) => c.key === dep.categorie);
          return (
            <Pressable key={dep.id} onPress={() => dep.lignesDetail && dep.lignesDetail.length > 0 && setDetailDepense(dep)} style={styles.depenseCard}>
              <View style={styles.depenseIcone}>
                <Ionicons name={cat?.icon ?? 'wallet-outline'} size={20} color={COLORS.vert} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.depenseTitre}>{dep.description}</Text>
                <Text style={styles.depenseSousTitre}>
                  {parentNom(dep.auteurId)} · {formatDateCourt(dep.date, langue)}
                  {dep.commercant ? ` · ${dep.commercant}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.depenseMontant}>{formatMontant(dep.montant)}</Text>
                {dep.rembourse ? (
                  <Text style={styles.badgeRegle}>{t.regle}</Text>
                ) : (
                  <Pressable onPress={() => reglerDepense(dep.id)}>
                    <Text style={styles.badgeEnAttente}>{t.marquerRegle}</Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable style={styles.fab} onPress={ouvrirModal}>
        <Ionicons name="add" size={26} color={COLORS.blanc} />
        <Text style={styles.fabTexte}>{t.ajouterDepense}</Text>
      </Pressable>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitre}>{t.nouvelleDepense}</Text>
                <Pressable onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={24} color={COLORS.vertProfond} />
                </Pressable>
              </View>

              <View style={styles.scanRow}>
                <Pressable style={styles.scanBtn} onPress={() => lancerScan(true)} disabled={scanLoading}>
                  <Ionicons name="camera-outline" size={18} color={COLORS.vert} />
                  <Text style={styles.scanBtnTexte}>{t.scannerTicket}</Text>
                </Pressable>
                <Pressable style={styles.scanBtn} onPress={() => lancerScan(false)} disabled={scanLoading}>
                  <Ionicons name="image-outline" size={18} color={COLORS.vert} />
                  <Text style={styles.scanBtnTexte}>{t.choisirPhoto}</Text>
                </Pressable>
              </View>
              {Platform.OS === 'web' ? React.createElement('input', {
                ref: webCameraInputRef, type: 'file', accept: 'image/*', capture: 'environment',
                style: { display: 'none' }, onChange: (e: any) => traiterFichierWeb(e, true),
              }) : null}
              {Platform.OS === 'web' ? React.createElement('input', {
                ref: webGalleryInputRef, type: 'file', accept: 'image/*',
                style: { display: 'none' }, onChange: (e: any) => traiterFichierWeb(e, false),
              }) : null}

              {scanLoading && (
                <View style={styles.scanLoading}>
                  <ActivityIndicator color={COLORS.vert} />
                  <Text style={styles.scanLoadingTexte}>{t.scanEnCours}</Text>
                </View>
              )}

              <Text style={styles.label}>{t.montant}</Text>
              <TextInput
                style={styles.input}
                value={formMontant}
                onChangeText={setFormMontant}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor={COLORS.ardoise}
              />

              <Text style={styles.label}>{t.description}</Text>
              <TextInput
                style={styles.input}
                value={formDescription}
                onChangeText={setFormDescription}
                placeholder={t.descriptionPlaceholder}
                placeholderTextColor={COLORS.ardoise}
              />

              <Text style={styles.label}>{t.commercant}</Text>
              <TextInput
                style={styles.input}
                value={formCommercant}
                onChangeText={setFormCommercant}
                placeholder={t.commercantPlaceholder}
                placeholderTextColor={COLORS.ardoise}
              />

              <DatePickerField label={t.date} value={formDate} onChange={setFormDate} />

              <Text style={styles.label}>{t.categorie}</Text>
              <View style={styles.categorieRow}>
                {CATEGORIES.map((c) => (
                  <Pressable
                    key={c.key}
                    style={[styles.categorieChip, formCategorie === c.key && styles.categorieChipActive]}
                    onPress={() => setFormCategorie(c.key)}
                  >
                    <Ionicons
                      name={c.icon}
                      size={16}
                      color={formCategorie === c.key ? COLORS.blanc : COLORS.vertProfond}
                    />
                    <Text style={[styles.categorieChipTexte, formCategorie === c.key && styles.categorieChipTexteActive]}>
                      {t.categories[c.key]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>{t.repartition}</Text>
              <View style={styles.categorieRow}>
                <Pressable
                  style={[styles.categorieChip, formPartage === '50/50' && styles.categorieChipActive]}
                  onPress={() => setFormPartage('50/50')}
                >
                  <Text style={[styles.categorieChipTexte, formPartage === '50/50' && styles.categorieChipTexteActive]}>
                    {t.partage5050}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.categorieChip, formPartage === 'total' && styles.categorieChipActive]}
                  onPress={() => setFormPartage('total')}
                >
                  <Text style={[styles.categorieChipTexte, formPartage === 'total' && styles.categorieChipTexteActive]}>
                    {t.jePaieTout}
                  </Text>
                </Pressable>
              </View>

              <Pressable style={styles.submitBtn} onPress={soumettre}>
                <Text style={styles.submitBtnTexte}>{t.enregistrer}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={scanRecapVisible} animationType="slide" transparent onRequestClose={() => setScanRecapVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitre}>{t.recapTitre}</Text>
                <Pressable onPress={() => setScanRecapVisible(false)}>
                  <Ionicons name="close" size={24} color={COLORS.vertProfond} />
                </Pressable>
              </View>

              {scanCommercant ? (
                <Text style={styles.recapCommercant}>{scanCommercant}</Text>
              ) : null}

              {(() => {
                const groupes: Record<string, number> = {};
                scanLignes.forEach((ligne) => {
                  const cat = ligne.categorie || 'autre';
                  groupes[cat] = (groupes[cat] || 0) + ligne.montant;
                });
                const total = Object.values(groupes).reduce((a, b) => a + b, 0);
                return (
                  <>
                    {Object.entries(groupes).map(([cat, montantCat]) => {
                      const catDef = CATEGORIES.find((c) => c.key === cat);
                      return (
                        <View key={cat} style={styles.recapLigne}>
                          <View style={styles.recapLigneGauche}>
                            <Ionicons name={catDef?.icon ?? 'ellipsis-horizontal-outline'} size={18} color={COLORS.vert} />
                            <Text style={styles.recapLigneTexte}>{t.categories[cat as keyof typeof t.categories] ?? cat}</Text>
                          </View>
                          <Text style={styles.recapLigneMontant}>{formatMontant(montantCat)}</Text>
                        </View>
                      );
                    })}
                    <View style={styles.recapTotalRow}>
                      <Text style={styles.recapTotalLabel}>{t.recapTotal}</Text>
                      <Text style={styles.recapTotalMontant}>{formatMontant(total)}</Text>
                    </View>
                  </>
                );
              })()}

              <Pressable style={styles.submitBtn} onPress={soumettreLignesCategorisees}>
                <Text style={styles.submitBtnTexte}>{t.recapEnregistrer}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!detailDepense} animationType="slide" transparent onRequestClose={() => setDetailDepense(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitre}>{detailDepense?.description}</Text>
                <Pressable onPress={() => setDetailDepense(null)}>
                  <Ionicons name="close" size={24} color={COLORS.vertProfond} />
                </Pressable>
              </View>
              {detailDepense?.commercant ? (
                <Text style={styles.recapCommercant}>{detailDepense.commercant}</Text>
              ) : null}
              {detailDepense?.lignesDetail?.map((ligne, index) => (
                <View key={index} style={styles.recapLigne}>
                  <Text style={styles.recapLigneTexte}>{ligne.libelle}</Text>
                  <Text style={styles.recapLigneMontant}>{formatMontant(ligne.montant)}</Text>
                </View>
              ))}
              <View style={styles.recapTotalRow}>
                <Text style={styles.recapTotalLabel}>{t.recapTotal}</Text>
                <Text style={styles.recapTotalMontant}>{detailDepense ? formatMontant(detailDepense.montant) : ''}</Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ivoire },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  title: { fontFamily: FONTS.display, fontSize: 26, color: COLORS.vertProfond },
  soldeCard: {
    marginHorizontal: SPACING.lg, backgroundColor: COLORS.vertProfond, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.lg,
  },
  soldeLabel: { fontFamily: FONTS.body, fontSize: 12.5, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' },
  soldeMontant: { fontFamily: FONTS.display, fontSize: 30, color: COLORS.blanc, marginTop: 2, marginBottom: SPACING.sm },
  soldeSeparateur: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: SPACING.sm },
  soldeMontantSecondaire: { fontFamily: FONTS.displaySemibold, fontSize: 20, color: COLORS.or, marginTop: 2 },
  sectionTitre: {
    fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.ardoise, textTransform: 'uppercase',
    marginHorizontal: SPACING.lg, marginBottom: SPACING.sm,
  },
  videTexte: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.ardoise, marginHorizontal: SPACING.lg },
  depenseCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.blanc, borderRadius: RADIUS.md,
    padding: SPACING.md, marginHorizontal: SPACING.lg, marginBottom: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.bordure,
  },
  depenseIcone: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: COLORS.ivoire,
    alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm,
  },
  depenseTitre: { fontFamily: FONTS.bodySemibold, fontSize: 14.5, color: COLORS.vertProfond },
  depenseSousTitre: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.ardoise, marginTop: 2 },
  depenseMontant: { fontFamily: FONTS.displaySemibold, fontSize: 15.5, color: COLORS.vertProfond },
  badgeRegle: {
    fontFamily: FONTS.bodySemibold, fontSize: 10.5, color: COLORS.vert, marginTop: 3, textTransform: 'uppercase',
  },
  badgeEnAttente: {
    fontFamily: FONTS.bodySemibold, fontSize: 10.5, color: COLORS.terracotta, marginTop: 3, textTransform: 'uppercase',
    textDecorationLine: 'underline',
  },
  fab: {
    position: 'absolute', bottom: SPACING.lg, right: SPACING.lg, backgroundColor: COLORS.vert,
    borderRadius: RADIUS.lg, paddingVertical: 14, paddingHorizontal: SPACING.lg,
    flexDirection: 'row', alignItems: 'center', gap: 6, elevation: 4,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  fabTexte: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.blanc },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(28,43,37,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.blanc, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg,
    padding: SPACING.lg, maxHeight: '88%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.md,
  },
  modalTitre: { fontFamily: FONTS.displaySemibold, fontSize: 19, color: COLORS.vertProfond },
  scanRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  scanBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: COLORS.vert, borderRadius: RADIUS.md, paddingVertical: 12,
  },
  scanBtnTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.vert },
  scanLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.md },
  scanLoadingTexte: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise },
  label: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.vertProfond, marginBottom: 6, marginTop: SPACING.sm },
  input: {
    borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm,
    paddingVertical: 10, fontFamily: FONTS.body, fontSize: 14.5, color: COLORS.vertProfond,
  },
  categorieRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categorieChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: COLORS.bordure,
    borderRadius: RADIUS.md, paddingVertical: 8, paddingHorizontal: 12,
  },
  categorieChipActive: { backgroundColor: COLORS.vert, borderColor: COLORS.vert },
  categorieChipTexte: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.vertProfond },
  categorieChipTexteActive: { color: COLORS.blanc },
  submitBtn: {
    backgroundColor: COLORS.vert, borderRadius: RADIUS.md, paddingVertical: 14,
    alignItems: 'center', marginTop: SPACING.lg, marginBottom: SPACING.md,
  },
  recapCommercant: { fontFamily: FONTS.displaySemibold, fontSize: 16, color: COLORS.vertProfond, marginBottom: 12 },
  recapLigne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  recapLigneGauche: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recapLigneTexte: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.vertProfond },
  recapLigneMontant: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.vertProfond },
  recapTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, marginTop: 8, borderTopWidth: 1.5, borderTopColor: COLORS.vertProfond },
  recapTotalLabel: { fontFamily: FONTS.displaySemibold, fontSize: 15, color: COLORS.vertProfond },
  recapTotalMontant: { fontFamily: FONTS.displaySemibold, fontSize: 15, color: COLORS.vert },
  submitBtnTexte: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.blanc },
});

export default function FinancesScreen() {
  return (
    <ErrorBoundary>
      <FinancesScreenInner />
    </ErrorBoundary>
  );
}
