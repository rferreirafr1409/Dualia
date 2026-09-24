// app/(tabs)/documents.tsx
//
// Coffre-fort familial. Deux axes de lecture strictement distincts :
//   CONCERNE  — qui : tous / chaque enfant de l'espace familial / la famille
//   CATÉGORIE — quoi : santé, école, administratif, juridique
// Ils se croisent ("Marlon + Santé", "Famille + Juridique") sans jamais se
// confondre. Une source unique, plusieurs vues contextuelles — aucun dossier
// physique, aucune duplication.
//
// Les enfants proposés dans les filtres viennent toujours du store, jamais
// d'une liste écrite en dur : un espace familial avec Sophie et Lucas affiche
// Sophie et Lucas.
//
// Les actions destructives ne sont pas exposées en permanence sur chaque
// ligne : elles vivent dans le menu de la carte.
//
// PIÈCE JOINTE — Un carnet de santé, un bulletin, une ordonnance arrivent le
// plus souvent en photo, pas en PDF. Deux chemins explicites plutôt qu'un
// sélecteur fourre-tout : « Fichier » ouvre les documents (PDF, Word, Excel,
// texte, images), « Photo » ouvre directement la galerie. Les images sont
// redimensionnées et recompressées avant l'envoi (une photo d'iPhone pèse 3 à
// 5 Mo brute, moins de 500 Ko après passage), et le type réel du fichier est
// transmis au store, qui en déduit l'extension de stockage — sans quoi une
// photo repartirait en .bin au téléchargement.
//
// Les formats acceptés et les plafonds vivent dans lib/typesFichier.ts, pour
// que Documents, Finances et la messagerie répondent la même chose.

import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, parseISO } from 'date-fns';
import { fr, pt, es, enGB } from 'date-fns/locale';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useStore } from '../../store/useStore';
import { aujourdHuiLocal } from '../../lib/dates';
import { DocumentItem, CategorieDocument, DocumentPortee } from '../../types';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../constants/theme';
import { TRADUCTIONS } from '../../constants/i18n';
import { choisirFichierDocument } from '../../lib/pickerFichierDocument';
import {
  TAILLE_MAX_BASE64,
  estHeic,
  estUneImage,
  normaliserType,
  typeImageStocke,
} from '../../lib/typesFichier';
import { ouvrirFichierStocke } from '../../lib/ouvrirFichierStocke';
import JugementUpload from '../../components/JugementUpload';

// Même garde que dans finances.tsx et journal.tsx : le module natif n'existe
// pas sur le web, où l'on passe par un <input type="file">.
let ImagePicker: typeof import('expo-image-picker') | null = null;
if (Platform.OS !== 'web') {
  ImagePicker = require('expo-image-picker');
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const CATEGORIE_ICONES: Record<CategorieDocument, IoniconName> = {
  administratif: 'folder-outline',
  sante: 'medkit-outline',
  ecole: 'school-outline',
  juridique: 'document-text-outline',
};

const CATEGORIE_COULEURS: Record<CategorieDocument, { couleur: string; fond: string }> = {
  administratif: { couleur: COLORS.ardoise, fond: '#EEF1F0' },
  sante: { couleur: COLORS.vert, fond: '#E8F3ED' },
  ecole: { couleur: COLORS.or, fond: '#FBF3DF' },
  juridique: { couleur: COLORS.terracotta, fond: '#F7EEE9' },
};

const ORDRE_CATEGORIES: CategorieDocument[] = ['administratif', 'sante', 'ecole', 'juridique'];

// Un document scanné doit rester lisible : on garde plus de définition que
// pour un ticket de caisse (finances.tsx plafonne à 1600 px / qualité 0,6).
const PHOTO_MAX_DIMENSION = 2000;
const PHOTO_JPEG_QUALITY = 0.75;

// En dessous de ce poids, une image JPEG ou PNG part telle quelle : un PNG de
// capture d'écran recompressé en JPEG verrait son texte se brouiller pour
// gagner quelques dizaines de kilo-octets.
const TAILLE_IMAGE_SANS_COMPRESSION = 1500000;

type LibellesPieceJointe = {
  fichier: string;
  photo: string;
  heicNonSupporte: string;
  typeNonSupporte: string;
  tropVolumineux: string;
  imageIllisible: string;
  photoIndisponible: string;
  permissionRefusee: string;
};

// Libellés locaux : ils ne concernent que cet écran. À remonter dans
// constants/i18n.ts le jour où un autre écran en aura besoin.
const LIBELLES_PIECE_JOINTE: Record<string, LibellesPieceJointe> = {
  fr: {
    fichier: 'Fichier',
    photo: 'Photo',
    heicNonSupporte:
      "Cette photo est au format HEIC, que la plupart des ordinateurs n'ouvrent pas. Sur iPhone : Réglages › Appareil photo › Formats › « Plus compatible ».",
    typeNonSupporte: 'Format non accepté. PDF, Word, Excel, texte, JPG, PNG.',
    tropVolumineux: 'Fichier trop volumineux : 10 Mo maximum.',
    imageIllisible: 'Image illisible.',
    photoIndisponible: "L'ajout de photo est disponible sur l'application mobile.",
    permissionRefusee:
      "Dualia n'a pas accès à vos photos. Autorisez l'accès dans les réglages du téléphone.",
  },
  pt: {
    fichier: 'Ficheiro',
    photo: 'Foto',
    heicNonSupporte:
      'Esta foto está no formato HEIC, que a maioria dos computadores não abre. No iPhone: Definições › Câmara › Formatos › «Mais compatível».',
    typeNonSupporte: 'Formato não aceite. PDF, Word, Excel, texto, JPG, PNG.',
    tropVolumineux: 'Ficheiro demasiado grande: 10 MB no máximo.',
    imageIllisible: 'Imagem ilegível.',
    photoIndisponible: 'A adição de fotos está disponível na aplicação móvel.',
    permissionRefusee:
      'A Dualia não tem acesso às suas fotos. Autorize o acesso nas definições do telemóvel.',
  },
  es: {
    fichier: 'Archivo',
    photo: 'Foto',
    heicNonSupporte:
      'Esta foto está en formato HEIC, que la mayoría de los ordenadores no abre. En iPhone: Ajustes › Cámara › Formatos › «Más compatible».',
    typeNonSupporte: 'Formato no aceptado. PDF, Word, Excel, texto, JPG, PNG.',
    tropVolumineux: 'Archivo demasiado grande: 10 MB como máximo.',
    imageIllisible: 'Imagen ilegible.',
    photoIndisponible: 'Añadir fotos está disponible en la aplicación móvil.',
    permissionRefusee:
      'Dualia no tiene acceso a tus fotos. Autoriza el acceso en los ajustes del teléfono.',
  },
  en: {
    fichier: 'File',
    photo: 'Photo',
    heicNonSupporte:
      'This photo is in HEIC format, which most computers cannot open. On iPhone: Settings › Camera › Formats › "Most Compatible".',
    typeNonSupporte: 'Format not accepted. PDF, Word, Excel, text, JPG, PNG.',
    tropVolumineux: 'File too large: 10 MB maximum.',
    imageIllisible: 'Unreadable image.',
    photoIndisponible: 'Adding a photo is available in the mobile app.',
    permissionRefusee:
      "Dualia doesn't have access to your photos. Allow access in your phone settings.",
  },
};

type FichierJoint = {
  uri: string;
  nom: string;
  contentType: string;
  // Rempli dès la sélection pour les images (déjà recompressées) ; absent pour
  // un PDF, relu au moment de l'envoi.
  base64?: string;
};

// Redimensionne et réencode une image côté web. La version native s'appuie sur
// le paramètre `quality` du sélecteur, qui fait le même travail.
function compresserImageWeb(dataUrl: string): Promise<{ base64: string; contentType: string }> {
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
        reject(new Error('canvas_indisponible'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const sortie = canvas.toDataURL('image/jpeg', PHOTO_JPEG_QUALITY);
      resolve({ base64: sortie.split(',')[1], contentType: 'image/jpeg' });
    };
    img.onerror = () => reject(new Error('image_illisible'));
    img.src = dataUrl;
  });
}

// 'tous' | 'famille' | id d'un enfant
type FiltreConcerne = string;

export default function DocumentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ enfant?: string; categorie?: CategorieDocument }>();
  const documents = useStore((s) => s.documents);
  const parents = useStore((s) => s.parents);
  const parentActif = useStore((s) => s.parentActif);
  const ajouterDocument = useStore((s) => s.ajouterDocument);
  const modifierDocument = useStore((s) => s.modifierDocument);
  const supprimerDocument = useStore((s) => s.supprimerDocument);
  const enfants = useStore((s) => s.enfants);
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].documents;
  const tDecisions = TRADUCTIONS[langue].decisions;
  const tErreur = TRADUCTIONS[langue].finances.erreur;
  const localeDateFns = langue === 'pt' ? pt : langue === 'es' ? es : langue === 'en' ? enGB : fr;
  const libelles = LIBELLES_PIECE_JOINTE[langue] ?? LIBELLES_PIECE_JOINTE.fr;

  const CATEGORIES = ORDRE_CATEGORIES.map((id) => ({
    id,
    icone: CATEGORIE_ICONES[id],
    label: t.categories[id],
    couleur: CATEGORIE_COULEURS[id].couleur,
    fond: CATEGORIE_COULEURS[id].fond,
  }));

  // Arrivée depuis la fiche d'un enfant : l'écran devient une vue dédiée
  // ("Santé de Shana") et n'affiche plus les filtres, pour ne pas casser le
  // contexte dont vient l'utilisateur.
  const enfantContexte = params.enfant ? enfants.find((e) => e.id === params.enfant) ?? null : null;
  const modeContextuel = !!enfantContexte && !!params.categorie;
  const categorieInfo = params.categorie ? CATEGORIES.find((c) => c.id === params.categorie) : undefined;
  const connecteur = langue === 'en' ? 'for' : 'de';
  const titreContextuel =
    categorieInfo && enfantContexte ? `${categorieInfo.label} ${connecteur} ${enfantContexte.prenom}` : '';

  const [recherche, setRecherche] = useState('');
  const [filtreConcerne, setFiltreConcerne] = useState<FiltreConcerne>(params.enfant ?? 'tous');
  const [filtreCategorie, setFiltreCategorie] = useState<CategorieDocument | 'tous'>(params.categorie ?? 'tous');
  const [jugementModalVisible, setJugementModalVisible] = useState(false);

  // Formulaire — création et modification partagent le même.
  const [formVisible, setFormVisible] = useState(false);
  const [documentEnEdition, setDocumentEnEdition] = useState<DocumentItem | null>(null);
  const [nom, setNom] = useState('');
  const [categorie, setCategorie] = useState<CategorieDocument>('administratif');
  const [note, setNote] = useState('');
  const [concerneFamille, setConcerneFamille] = useState(true);
  const [enfantsSelectionnes, setEnfantsSelectionnes] = useState<string[]>([]);
  const [fichierJoint, setFichierJoint] = useState<FichierJoint | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [preparationFichier, setPreparationFichier] = useState(false);

  // Sélecteur d'image du web : pas de module natif, un input DOM masqué.
  const webImageInputRef = useRef<any>(null);

  // Menu d'actions d'une carte
  const [menuDocument, setMenuDocument] = useState<DocumentItem | null>(null);

  const documentsFiltres = useMemo(() => {
    return documents.filter((doc) => {
      const matchRecherche = doc.nom.toLowerCase().includes(recherche.toLowerCase());
      const matchCategorie = filtreCategorie === 'tous' || doc.categorie === filtreCategorie;
      const matchContexte = !enfantContexte || doc.enfantIds.includes(enfantContexte.id);
      const matchConcerne =
        filtreConcerne === 'tous'
          ? true
          : filtreConcerne === 'famille'
          ? doc.portee === 'famille'
          : doc.enfantIds.includes(filtreConcerne);
      return matchRecherche && matchCategorie && matchContexte && matchConcerne;
    });
  }, [documents, recherche, filtreCategorie, filtreConcerne, enfantContexte]);

  const documentsByCategorie = useMemo(() => {
    const grouped: Record<CategorieDocument, DocumentItem[]> = {
      administratif: [],
      sante: [],
      ecole: [],
      juridique: [],
    };
    documentsFiltres.forEach((doc) => grouped[doc.categorie].push(doc));
    return grouped;
  }, [documentsFiltres]);

  const alertCompat = (titre: string, message?: string) => {
    if (Platform.OS === 'web') {
      window.alert(message ? `${titre}\n\n${message}` : titre);
    } else {
      Alert.alert(titre, message);
    }
  };

  const lireFichierEnBase64 = async (uri: string): Promise<string> => {
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  };

  // Point d'entrée unique : quel que soit le chemin (PDF ou photo), le fichier
  // retenu renseigne le nom du document s'il est encore vide. On retire une
  // extension quelconque, pas seulement « .pdf ».
  const appliquerFichier = (fichier: FichierJoint) => {
    setFichierJoint(fichier);
    if (!nom.trim()) setNom(fichier.nom.replace(/\.[^./\\]+$/, ''));
  };

  // Les sélecteurs lèvent un code, jamais une phrase : c'est ici, où la langue
  // du parent est connue, que le code devient un message.
  const messagePourErreur = (err: any): string | undefined => {
    switch (err?.message) {
      case 'fichier_heic':
        return libelles.heicNonSupporte;
      case 'type_non_supporte':
        return libelles.typeNonSupporte;
      case 'fichier_trop_volumineux':
        return libelles.tropVolumineux;
      case 'image_illisible':
      case 'fichier_illisible':
        return libelles.imageIllisible;
      default:
        return err?.message;
    }
  };

  const choisirPieceJointe = async () => {
    try {
      const pick = await choisirFichierDocument();
      if (!pick) return;
      setPreparationFichier(true);
      appliquerFichier({
        uri: pick.uri,
        nom: pick.name,
        contentType: normaliserType(pick.mimeType, pick.name),
        // Sur le web le sélecteur rend déjà une data URI : la relire par
        // fetch + FileReader au moment de l'envoi referait le travail.
        base64: pick.uri.startsWith('data:') ? pick.uri.split(',')[1] : undefined,
      });
    } catch (err: any) {
      console.error('[Dualia] Échec sélection de la pièce jointe :', err);
      alertCompat(tErreur, messagePourErreur(err));
    } finally {
      setPreparationFichier(false);
    }
  };

  const choisirPhoto = async () => {
    if (Platform.OS === 'web') {
      webImageInputRef.current?.click();
      return;
    }
    if (!ImagePicker) {
      alertCompat(tErreur, libelles.photoIndisponible);
      return;
    }
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        alertCompat(tErreur, libelles.permissionRefusee);
        return;
      }
      const resultat = await ImagePicker.launchImageLibraryAsync({
        base64: true,
        quality: PHOTO_JPEG_QUALITY,
      });
      if (resultat.canceled || !resultat.assets?.[0]) return;

      setPreparationFichier(true);
      const asset = resultat.assets[0];
      const nomFichier = (asset as any).fileName || `photo-${Date.now()}.jpg`;
      const typeBrut = (asset.mimeType || 'image/jpeg').toLowerCase();

      // Le sélecteur d'Expo transcode normalement le HEIC de l'iPhone en JPEG ;
      // on refuse explicitement plutôt que de déposer dans le coffre un fichier
      // que l'autre parent ne pourra pas ouvrir depuis son ordinateur.
      if (estHeic(typeBrut, nomFichier)) {
        alertCompat(tErreur, libelles.heicNonSupporte);
        return;
      }

      const contentType = typeImageStocke(typeBrut);
      const base64 = asset.base64 ?? (await lireFichierEnBase64(asset.uri));
      if (base64.length > TAILLE_MAX_BASE64) {
        alertCompat(tErreur, libelles.tropVolumineux);
        return;
      }
      appliquerFichier({ uri: asset.uri, nom: nomFichier, contentType, base64 });
    } catch (err: any) {
      console.error('[Dualia] Échec sélection de la photo :', err);
      alertCompat(tErreur, messagePourErreur(err));
    } finally {
      setPreparationFichier(false);
    }
  };

  const traiterImageWeb = async (fichier: File) => {
    setPreparationFichier(true);
    try {
      const nomFichier = fichier.name || 'photo.jpg';
      const typeBrut = (fichier.type || '').toLowerCase();
      if (estHeic(typeBrut, nomFichier)) {
        alertCompat(tErreur, libelles.heicNonSupporte);
        return;
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(fichier);
      });

      const dejaLeger =
        fichier.size <= TAILLE_IMAGE_SANS_COMPRESSION &&
        ['image/png', 'image/jpeg', 'image/webp'].includes(typeBrut);

      let base64 = dataUrl.split(',')[1];
      let contentType = typeImageStocke(typeBrut);
      if (!dejaLeger) {
        const compresse = await compresserImageWeb(dataUrl);
        base64 = compresse.base64;
        contentType = compresse.contentType;
      }

      if (base64.length > TAILLE_MAX_BASE64) {
        alertCompat(tErreur, libelles.tropVolumineux);
        return;
      }
      appliquerFichier({ uri: dataUrl, nom: nomFichier, contentType, base64 });
    } catch (err: any) {
      console.error('[Dualia] Échec préparation de la photo :', err);
      alertCompat(tErreur, messagePourErreur(err));
    } finally {
      setPreparationFichier(false);
    }
  };

  const ouvrirCreation = () => {
    setDocumentEnEdition(null);
    setNom('');
    setNote('');
    setFichierJoint(null);
    setCategorie(filtreCategorie !== 'tous' ? filtreCategorie : params.categorie ?? 'administratif');
    // Le contexte d'arrivée détermine le rattachement par défaut : depuis la
    // fiche d'un enfant, le document le concerne ; sinon, il concerne la
    // famille tant que l'utilisateur n'a pas choisi.
    if (enfantContexte) {
      setConcerneFamille(false);
      setEnfantsSelectionnes([enfantContexte.id]);
    } else if (filtreConcerne !== 'tous' && filtreConcerne !== 'famille') {
      setConcerneFamille(false);
      setEnfantsSelectionnes([filtreConcerne]);
    } else {
      setConcerneFamille(true);
      setEnfantsSelectionnes([]);
    }
    setFormVisible(true);
  };

  const ouvrirEdition = (doc: DocumentItem) => {
    setMenuDocument(null);
    setDocumentEnEdition(doc);
    setNom(doc.nom);
    setNote(doc.note ?? '');
    setCategorie(doc.categorie);
    setFichierJoint(null);
    setConcerneFamille(doc.enfantIds.length === 0);
    setEnfantsSelectionnes(doc.enfantIds);
    setFormVisible(true);
  };

  const fermerForm = () => {
    setFormVisible(false);
    setDocumentEnEdition(null);
    setNom('');
    setNote('');
    setFichierJoint(null);
    setEnfantsSelectionnes([]);
    setConcerneFamille(true);
  };

  const basculerEnfant = (enfantId: string) => {
    setConcerneFamille(false);
    setEnfantsSelectionnes((actuels) =>
      actuels.includes(enfantId) ? actuels.filter((id) => id !== enfantId) : [...actuels, enfantId]
    );
  };

  const choisirFamille = () => {
    setConcerneFamille(true);
    setEnfantsSelectionnes([]);
  };

  // Une portée 'enfant' sans aucun enfant rattaché serait un état incohérent :
  // la portée se déduit donc de la sélection, jamais l'inverse.
  const porteeCourante: DocumentPortee = enfantsSelectionnes.length > 0 ? 'enfant' : 'famille';

  const soumettre = async () => {
    if (!nom.trim() || enregistrement) return;
    setEnregistrement(true);
    try {
      if (documentEnEdition) {
        await modifierDocument(documentEnEdition.id, {
          nom: nom.trim(),
          categorie,
          note: note.trim() || undefined,
          portee: porteeCourante,
          enfantIds: enfantsSelectionnes,
        });
      } else {
        const doc: DocumentItem = {
          id: `doc-${Date.now()}`,
          nom: nom.trim(),
          categorie,
          auteurId: parentActif,
          date: aujourdHuiLocal(),
          certifie: false,
          note: note.trim() || undefined,
          portee: porteeCourante,
          enfantIds: enfantsSelectionnes,
        };
        if (fichierJoint) {
          // Les images arrivent déjà encodées et compressées ; un PDF est relu
          // ici, au moment où l'on en a besoin.
          const base64 = fichierJoint.base64 ?? (await lireFichierEnBase64(fichierJoint.uri));
          await ajouterDocument(doc, { base64, contentType: fichierJoint.contentType });
        } else {
          await ajouterDocument(doc);
        }
      }
      fermerForm();
    } catch (err: any) {
      console.error('[Dualia] Échec enregistrement du document :', err);
      alertCompat(tErreur, err?.message);
    } finally {
      setEnregistrement(false);
    }
  };

  const demanderSuppression = (doc: DocumentItem) => {
    setMenuDocument(null);
    const confirmer = () => supprimerDocument(doc.id);
    const message = t.confirmerSuppression(doc.nom);
    if (Platform.OS === 'web') {
      if (window.confirm(message)) confirmer();
      return;
    }
    Alert.alert(t.supprimer, message, [
      { text: t.annuler, style: 'cancel' },
      { text: t.supprimer, style: 'destructive', onPress: confirmer },
    ]);
  };

  // Le bucket documents-familiaux est privé : URL signée valable une heure,
  // générée au moment de l'ouverture. fichierUrl contient le chemin dans le
  // bucket, pas une adresse complète.
  const ouvrirDocument = async (doc: DocumentItem) => {
    setMenuDocument(null);
    if (!doc.fichierUrl) return;
    try {
      await ouvrirFichierStocke(doc.fichierUrl);
    } catch (err: any) {
      console.error('[Dualia] Échec ouverture du document :', err);
      alertCompat(tErreur, err?.message);
    }
  };

  // Sous-titre d'une carte : "Shana · Santé" ou "Famille · Administratif".
  const sousTitreDocument = (doc: DocumentItem) => {
    const cat = CATEGORIES.find((c) => c.id === doc.categorie)?.label ?? '';
    const prenoms = doc.enfantIds
      .map((id) => enfants.find((e) => e.id === id)?.prenom)
      .filter(Boolean)
      .join(' · ');
    return `${prenoms || t.famille} · ${cat}`;
  };

  const renderDocCard = (doc: DocumentItem) => {
    const cat = CATEGORIES.find((c) => c.id === doc.categorie) ?? CATEGORIES[0];
    const auteur = parents[doc.auteurId];
    const aUnFichier = !!doc.fichierUrl;
    const estUneImage = /\.(jpg|jpeg|png|webp)$/i.test(doc.fichierUrl ?? '');
    return (
      <TouchableOpacity
        key={doc.id}
        style={styles.docCard}
        onPress={() => (aUnFichier ? ouvrirDocument(doc) : ouvrirEdition(doc))}
        activeOpacity={0.75}
      >
        <View style={[styles.docIcon, { backgroundColor: cat.fond }]}>
          <Ionicons name={cat.icone} size={19} color={cat.couleur} />
        </View>

        <View style={styles.docInfo}>
          <Text style={styles.docNom} numberOfLines={1}>{doc.nom}</Text>
          <Text style={styles.docSousTitre} numberOfLines={1}>{sousTitreDocument(doc)}</Text>
          <Text style={styles.docMetaTxt} numberOfLines={1}>
            {t.ajoutePar(auteur?.nom.split(' ')[0] ?? '')} ·{' '}
            {format(parseISO(doc.date), 'd MMMM yyyy', { locale: localeDateFns })}
          </Text>
        </View>

        <View style={styles.docDroit}>
          <TouchableOpacity onPress={() => setMenuDocument(doc)} hitSlop={12} style={styles.docMenuBtn}>
            <Ionicons name="ellipsis-vertical" size={16} color={COLORS.ardoise} />
          </TouchableOpacity>
          {aUnFichier ? (
            <Ionicons
              name={estUneImage ? 'image-outline' : 'attach-outline'}
              size={15}
              color={COLORS.ardoise}
            />
          ) : (
            <Text style={styles.docSansFichier}>{t.aucunFichier}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.conteneur} edges={['top', 'bottom']}>
      {/* En-tête : titre à gauche, action principale à droite. */}
      <View style={styles.header}>
        {modeContextuel ? (
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.retourBtn}>
            <Ionicons name="chevron-back" size={22} color={COLORS.vertProfond} />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitre}>{modeContextuel ? titreContextuel : t.titre}</Text>
          <Text style={styles.headerSous}>
            {modeContextuel
              ? t.compteur(documentsFiltres.length)
              : `${t.sousTitre} · ${t.compteur(documentsFiltres.length)}`}
          </Text>
        </View>
        <TouchableOpacity style={styles.btnAjouter} onPress={ouvrirCreation}>
          <Ionicons name="add" size={17} color={COLORS.blanc} />
          <Text style={styles.btnAjouterTxt}>{t.ajouter}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!modeContextuel ? (
          <>
            <View style={styles.rechercheBar}>
              <Ionicons name="search-outline" size={16} color={COLORS.ardoise} />
              <TextInput
                style={styles.rechercheInput}
                value={recherche}
                onChangeText={setRecherche}
                placeholder={t.rechercherPlaceholder}
                placeholderTextColor={COLORS.ardoise}
              />
              {recherche ? (
                <TouchableOpacity onPress={() => setRecherche('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={COLORS.ardoise} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Axe 1 — QUI. Les enfants viennent du store, jamais d'une liste figée. */}
            <Text style={styles.filtreLabel}>{t.concerne}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtreRangee}>
              <TouchableOpacity
                style={[styles.puce, filtreConcerne === 'tous' && styles.puceActive]}
                onPress={() => setFiltreConcerne('tous')}
              >
                <Text style={[styles.puceTxt, filtreConcerne === 'tous' && styles.puceTxtActive]}>{t.tous}</Text>
              </TouchableOpacity>
              {enfants.map((e) => (
                <TouchableOpacity
                  key={e.id}
                  style={[styles.puce, filtreConcerne === e.id && styles.puceActive]}
                  onPress={() => setFiltreConcerne(e.id)}
                >
                  <Text style={[styles.puceTxt, filtreConcerne === e.id && styles.puceTxtActive]}>{e.prenom}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.puce, filtreConcerne === 'famille' && styles.puceActive]}
                onPress={() => setFiltreConcerne('famille')}
              >
                <Text style={[styles.puceTxt, filtreConcerne === 'famille' && styles.puceTxtActive]}>{t.famille}</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Axe 2 — QUOI. */}
            <Text style={styles.filtreLabel}>{t.categorie}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtreRangee}>
              <TouchableOpacity
                style={[styles.puce, filtreCategorie === 'tous' && styles.puceActive]}
                onPress={() => setFiltreCategorie('tous')}
              >
                <Text style={[styles.puceTxt, filtreCategorie === 'tous' && styles.puceTxtActive]}>{t.toutes}</Text>
              </TouchableOpacity>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.puce, filtreCategorie === cat.id && styles.puceActive]}
                  onPress={() => setFiltreCategorie(cat.id)}
                >
                  <Ionicons
                    name={cat.icone}
                    size={13}
                    color={filtreCategorie === cat.id ? COLORS.blanc : cat.couleur}
                  />
                  <Text style={[styles.puceTxt, filtreCategorie === cat.id && styles.puceTxtActive]}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Cadre familial : une action parmi d'autres, pas le sujet de la
                page. Carte claire à accent vert — un pavé sombre intitulé
                "jugement de divorce" réduirait Dualia aux seuls divorcés. */}
            <TouchableOpacity style={styles.cadreCard} onPress={() => setJugementModalVisible(true)}>
              <View style={styles.cadreAccent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cadreTitre}>{t.cadreFamilialTitre}</Text>
                <Text style={styles.cadreTexte}>{t.cadreFamilialTexte}</Text>
                <Text style={styles.cadreCta}>{t.cadreFamilialCta} →</Text>
              </View>
            </TouchableOpacity>
          </>
        ) : null}

        {modeContextuel
          ? documentsFiltres.map((doc) => renderDocCard(doc))
          : CATEGORIES.map((cat) => {
              const docs = documentsByCategorie[cat.id];
              if (docs.length === 0) return null;
              return (
                <View key={cat.id} style={styles.groupe}>
                  <View style={styles.groupeHeader}>
                    <Text style={styles.groupeTitre}>{cat.label.toUpperCase()}</Text>
                    <Text style={styles.groupeCount}>{docs.length}</Text>
                  </View>
                  {docs.map((doc) => renderDocCard(doc))}
                </View>
              );
            })}

        {documentsFiltres.length === 0 ? (
          <View style={styles.vide}>
            <Ionicons name="folder-open-outline" size={34} color={COLORS.ardoise} />
            <Text style={styles.videTxt}>{t.aucunDocument}</Text>
          </View>
        ) : null}

        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>

      {/* Menu d'une carte : les actions secondaires et destructives vivent
          ici, pas en permanence sur chaque ligne. */}
      <Modal visible={!!menuDocument} transparent animationType="fade" onRequestClose={() => setMenuDocument(null)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuDocument(null)}>
          <View style={styles.menuCard}>
            <Text style={styles.menuTitre} numberOfLines={1}>{menuDocument?.nom}</Text>
            {menuDocument?.fichierUrl ? (
              <TouchableOpacity style={styles.menuItem} onPress={() => menuDocument && ouvrirDocument(menuDocument)}>
                <Ionicons name="open-outline" size={17} color={COLORS.vertProfond} />
                <Text style={styles.menuItemTxt}>{t.ouvrir}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.menuItem} onPress={() => menuDocument && ouvrirEdition(menuDocument)}>
              <Ionicons name="create-outline" size={17} color={COLORS.vertProfond} />
              <Text style={styles.menuItemTxt}>{t.modifier}</Text>
            </TouchableOpacity>
            <View style={styles.menuSeparateur} />
            <TouchableOpacity style={styles.menuItem} onPress={() => menuDocument && demanderSuppression(menuDocument)}>
              <Ionicons name="trash-outline" size={17} color={COLORS.terracotta} />
              <Text style={[styles.menuItemTxt, { color: COLORS.terracotta }]}>{t.supprimer}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Formulaire — création et modification */}
      <Modal visible={formVisible} animationType="slide" transparent onRequestClose={fermerForm}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modal}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalPoignee} />
              <Text style={styles.modalTitre}>{documentEnEdition ? t.modalTitreModifier : t.modalTitre}</Text>

              {/* La pièce jointe n'est proposée qu'à la création : remplacer le
                  fichier d'un document existant est une autre opération, qui
                  mérite sa propre confirmation. */}
              {!documentEnEdition ? (
                <>
                  {fichierJoint ? (
                    <View style={styles.fichierJoint}>
                      <Ionicons
                        name={
                          estUneImage(fichierJoint.contentType)
                            ? 'image-outline'
                            : 'document-attach-outline'
                        }
                        size={18}
                        color={COLORS.vert}
                      />
                      <Text style={styles.fichierJointNom} numberOfLines={1}>{fichierJoint.nom}</Text>
                      <TouchableOpacity onPress={() => setFichierJoint(null)} hitSlop={10}>
                        <Ionicons name="close-circle" size={18} color={COLORS.ardoise} />
                      </TouchableOpacity>
                    </View>
                  ) : preparationFichier ? (
                    <View style={styles.preparation}>
                      <ActivityIndicator color={COLORS.vert} />
                    </View>
                  ) : (
                    <View style={styles.joindreRangee}>
                      <TouchableOpacity style={styles.btnJoindre} onPress={choisirPieceJointe}>
                        <Ionicons name="document-outline" size={17} color={COLORS.vert} />
                        <Text style={styles.btnJoindreTxt} numberOfLines={1}>{libelles.fichier}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.btnJoindre} onPress={choisirPhoto}>
                        <Ionicons name="image-outline" size={17} color={COLORS.vert} />
                        <Text style={styles.btnJoindreTxt} numberOfLines={1}>{libelles.photo}</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Sélecteur d'image du web, invisible : déclenché par le
                      bouton « Photo » ci-dessus. */}
                  {Platform.OS === 'web'
                    ? React.createElement('input', {
                        ref: webImageInputRef,
                        type: 'file',
                        accept: 'image/jpeg,image/png,image/webp',
                        style: { display: 'none' },
                        onChange: (e: any) => {
                          const choisi = e.target.files?.[0];
                          e.target.value = '';
                          if (choisi) traiterImageWeb(choisi);
                        },
                      })
                    : null}
                </>
              ) : null}

              <Text style={styles.label}>{t.nomDocument}</Text>
              <TextInput
                style={styles.input}
                value={nom}
                onChangeText={setNom}
                placeholder={t.nomPlaceholder}
                placeholderTextColor={COLORS.ardoise}
              />

              <Text style={styles.label}>{t.concerne}</Text>
              <View style={styles.pucesForm}>
                <TouchableOpacity
                  style={[styles.puceForm, concerneFamille && styles.puceFormActive]}
                  onPress={choisirFamille}
                >
                  <Text style={[styles.puceFormTxt, concerneFamille && styles.puceFormTxtActive]}>{t.famille}</Text>
                </TouchableOpacity>
                {enfants.map((e) => {
                  const actif = enfantsSelectionnes.includes(e.id);
                  return (
                    <TouchableOpacity
                      key={e.id}
                      style={[styles.puceForm, actif && styles.puceFormActive]}
                      onPress={() => basculerEnfant(e.id)}
                    >
                      <Text style={[styles.puceFormTxt, actif && styles.puceFormTxtActive]}>{e.prenom}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.aide}>{t.concerneAide}</Text>

              <Text style={styles.label}>{t.categorie}</Text>
              <View style={styles.pucesForm}>
                {CATEGORIES.map((cat) => {
                  const actif = categorie === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.puceForm, actif && styles.puceFormActive]}
                      onPress={() => setCategorie(cat.id)}
                    >
                      <Ionicons name={cat.icone} size={13} color={actif ? COLORS.blanc : cat.couleur} />
                      <Text style={[styles.puceFormTxt, actif && styles.puceFormTxtActive]}>{cat.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>{t.note}</Text>
              <TextInput
                style={styles.input}
                value={note}
                onChangeText={setNote}
                placeholder={t.notePlaceholder}
                placeholderTextColor={COLORS.ardoise}
              />

              <View style={styles.actions}>
                <TouchableOpacity style={styles.btnAnnuler} onPress={fermerForm} disabled={enregistrement}>
                  <Text style={styles.btnAnnulerTxt}>{t.annuler}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btnValider, (!nom.trim() || enregistrement) && styles.btnDisabled]}
                  onPress={soumettre}
                  disabled={!nom.trim() || enregistrement}
                >
                  {enregistrement ? (
                    <ActivityIndicator color={COLORS.blanc} />
                  ) : (
                    <Text style={styles.btnValiderTxt}>{documentEnEdition ? t.enregistrer : t.ajouter}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={jugementModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setJugementModalVisible(false)}
      >
        <View style={styles.jugementModalOverlay}>
          <View style={styles.jugementModalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.jugementModalHeader}>
                <Text style={styles.jugementModalTitre}>{tDecisions.jugementImportTitre}</Text>
                <TouchableOpacity onPress={() => setJugementModalVisible(false)} hitSlop={10}>
                  <Ionicons name="close" size={20} color={COLORS.ardoise} />
                </TouchableOpacity>
              </View>
              <JugementUpload onTermine={() => setJugementModalVisible(false)} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const LIGNE = 'rgba(23,63,50,0.10)';

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: COLORS.ivoire },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
  },
  retourBtn: { padding: SPACING.xs },
  headerTitre: { fontSize: TYPOGRAPHY.xl, fontWeight: TYPOGRAPHY.bold, color: COLORS.vertProfond },
  headerSous: { fontSize: TYPOGRAPHY.xs, color: COLORS.ardoise, marginTop: 2 },
  btnAjouter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.vert,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  btnAjouterTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: TYPOGRAPHY.semibold, color: COLORS.blanc },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },

  rechercheBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: LIGNE,
    paddingHorizontal: SPACING.md,
    paddingVertical: 9,
  },
  rechercheInput: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.texte, padding: 0 },

  filtreLabel: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.semibold,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: COLORS.ardoise,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  filtreRangee: { gap: SPACING.sm, paddingRight: SPACING.lg },
  puce: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.blanc,
    borderWidth: 1,
    borderColor: LIGNE,
  },
  puceActive: { backgroundColor: COLORS.vertProfond, borderColor: COLORS.vertProfond },
  puceTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.ardoise, fontWeight: TYPOGRAPHY.medium },
  puceTxtActive: { color: COLORS.blanc, fontWeight: TYPOGRAPHY.semibold },

  cadreCard: {
    flexDirection: 'row',
    gap: SPACING.md,
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: LIGNE,
    padding: SPACING.lg,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  cadreAccent: { width: 3, borderRadius: 2, backgroundColor: COLORS.vert },
  cadreTitre: { fontSize: TYPOGRAPHY.sm, fontWeight: TYPOGRAPHY.semibold, color: COLORS.vertProfond },
  cadreTexte: { fontSize: TYPOGRAPHY.xs, color: COLORS.ardoise, lineHeight: 17, marginTop: 3 },
  cadreCta: { fontSize: TYPOGRAPHY.xs, fontWeight: TYPOGRAPHY.semibold, color: COLORS.vert, marginTop: SPACING.sm },

  groupe: { marginTop: SPACING.lg },
  groupeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  groupeTitre: { fontSize: 11, fontWeight: TYPOGRAPHY.semibold, letterSpacing: 0.7, color: COLORS.ardoise },
  groupeCount: { fontSize: 11, fontWeight: TYPOGRAPHY.semibold, color: COLORS.ardoise },

  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: LIGNE,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  docIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  docInfo: { flex: 1, gap: 2 },
  docNom: { fontSize: TYPOGRAPHY.sm, fontWeight: TYPOGRAPHY.semibold, color: COLORS.texte },
  docSousTitre: { fontSize: TYPOGRAPHY.xs, color: COLORS.vert, fontWeight: TYPOGRAPHY.medium },
  docMetaTxt: { fontSize: 11, color: COLORS.ardoise },
  docDroit: { alignItems: 'flex-end', gap: 8 },
  docMenuBtn: { padding: 2 },
  docSansFichier: { fontSize: 10, color: COLORS.ardoise, fontStyle: 'italic' },

  vide: { alignItems: 'center', paddingVertical: SPACING.xxxl, gap: SPACING.sm },
  videTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.ardoise },

  menuOverlay: { flex: 1, backgroundColor: 'rgba(28,43,37,0.45)', justifyContent: 'flex-end' },
  menuCard: {
    backgroundColor: COLORS.blanc,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
  },
  menuTitre: {
    fontSize: TYPOGRAPHY.xs,
    color: COLORS.ardoise,
    marginBottom: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md },
  menuItemTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.vertProfond, fontWeight: TYPOGRAPHY.medium },
  menuSeparateur: { height: 1, backgroundColor: LIGNE, marginVertical: SPACING.xs },

  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28,43,37,0.45)' },
  modal: {
    backgroundColor: COLORS.ivoire,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxxl,
    maxHeight: '90%',
  },
  modalPoignee: {
    width: 36,
    height: 4,
    backgroundColor: COLORS.bordure,
    borderRadius: RADIUS.full,
    alignSelf: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitre: {
    fontSize: TYPOGRAPHY.lg,
    fontWeight: TYPOGRAPHY.bold,
    color: COLORS.vertProfond,
    marginBottom: SPACING.lg,
  },

  joindreRangee: { flexDirection: 'row', gap: SPACING.sm },
  btnJoindre: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: COLORS.vert,
    borderStyle: 'dashed',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  btnJoindreTxt: { fontSize: TYPOGRAPHY.xs, fontWeight: TYPOGRAPHY.semibold, color: COLORS.vert },
  preparation: {
    borderWidth: 1.5,
    borderColor: COLORS.vert,
    borderStyle: 'dashed',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fichierJoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#E8F3ED',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  fichierJointNom: { flex: 1, fontSize: TYPOGRAPHY.sm, color: COLORS.vertProfond, fontWeight: TYPOGRAPHY.medium },

  label: {
    fontSize: 11,
    fontWeight: TYPOGRAPHY.semibold,
    color: COLORS.ardoise,
    letterSpacing: 0.7,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
  },
  aide: { fontSize: 11, color: COLORS.ardoise, lineHeight: 16, marginTop: SPACING.xs },
  input: {
    backgroundColor: COLORS.blanc,
    borderWidth: 1,
    borderColor: LIGNE,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: TYPOGRAPHY.sm,
    color: COLORS.texte,
  },
  pucesForm: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  puceForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.blanc,
    borderWidth: 1,
    borderColor: LIGNE,
  },
  puceFormActive: { backgroundColor: COLORS.vertProfond, borderColor: COLORS.vertProfond },
  puceFormTxt: { fontSize: TYPOGRAPHY.xs, color: COLORS.ardoise, fontWeight: TYPOGRAPHY.medium },
  puceFormTxtActive: { color: COLORS.blanc, fontWeight: TYPOGRAPHY.semibold },

  actions: { flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.xl },
  btnAnnuler: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: LIGNE,
    alignItems: 'center',
  },
  btnAnnulerTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.ardoise, fontWeight: TYPOGRAPHY.medium },
  btnValider: {
    flex: 2,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.vert,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.45 },
  btnValiderTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.blanc, fontWeight: TYPOGRAPHY.semibold },

  jugementModalOverlay: { flex: 1, backgroundColor: 'rgba(28,43,37,0.5)', justifyContent: 'flex-end' },
  jugementModalCard: {
    backgroundColor: COLORS.ivoire,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl,
    paddingBottom: SPACING.xxxl,
    maxHeight: '92%',
  },
  jugementModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  jugementModalTitre: { fontSize: 19, color: COLORS.vertProfond, fontWeight: TYPOGRAPHY.semibold },
});
