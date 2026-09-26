// app/(tabs)/messagerie.tsx
//
// PIÈCES JOINTES — Un mot de l'école, une ordonnance, la photo d'un carnet :
// beaucoup de ce qui se dit entre deux parents tient dans un fichier plutôt
// que dans une phrase. Deux boutons discrets à gauche de la zone de saisie :
// le trombone ouvre les fichiers, l'icône image ouvre la galerie — sur iPhone,
// l'application Fichiers ne montre pas la pellicule, le second chemin n'est
// donc pas un doublon.
//
// Le fichier n'est téléversé qu'à l'envoi : une pièce choisie puis retirée ne
// laisse rien derrière elle. Le bucket est privé, la base ne garde que le
// chemin, et la lecture passe par une URL signée d'une heure.

import React from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet, TextInput, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as FileSystem from 'expo-file-system/legacy';
import { useStore } from '../../store/useStore';
import { entetesBackend } from '../../lib/appelBackend';
import { instantDepuisHeureLocale, estInstantValide, fuseauAppareil } from '../../lib/dates';

// La carte de suggestion et le magasin doivent juger la date de la meme
// facon. Passer par une fonction nommee evite qu'ils divergent a nouveau.
const dateSuggestionLisible = (date: string) => estInstantValide(date);
import { COLORS, FONTS, SPACING, RADIUS } from '../../constants/theme';
import { ExportIcon } from '../../components/icons';
import { TRADUCTIONS } from '../../constants/i18n';
import { choisirFichierDocument } from '../../lib/pickerFichierDocument';
import { TAILLE_MAX_BASE64, estHeic, estUneImage, normaliserType, typeImageStocke } from '../../lib/typesFichier';
import { ouvrirFichierStocke } from '../../lib/ouvrirFichierStocke';

let ImagePicker: typeof import('expo-image-picker') | null = null;
if (Platform.OS !== 'web') {
  ImagePicker = require('expo-image-picker');
}

const PARSE_MESSAGE_URL = 'https://dualia-backend.vercel.app/api/parse-message';
const MODERATE_MESSAGE_URL = 'https://dualia-backend.vercel.app/api/moderate-message';

const PHOTO_MAX_DIMENSION = 1800;
const PHOTO_JPEG_QUALITY = 0.75;

function alertCompat(titre: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? titre + '\n\n' + message : titre);
  } else {
    Alert.alert(titre, message);
  }
}

type PieceEnAttente = { base64: string; contentType: string; nom: string };

type LibellesPiece = {
  erreur: string;
  joindre: string;
  photo: string;
  piece: string;
  typeNonSupporte: string;
  tropVolumineux: string;
  heicNonSupporte: string;
  fichierIllisible: string;
  photoIndisponible: string;
  permissionRefusee: string;
};

const LIBELLES: Record<string, LibellesPiece> = {
  fr: {
    erreur: 'Erreur',
    joindre: 'Joindre un fichier',
    photo: 'Joindre une photo',
    piece: 'Pièce jointe',
    typeNonSupporte: 'Format non accepté. PDF, Word, Excel, texte, JPG, PNG.',
    tropVolumineux: 'Fichier trop volumineux : 10 Mo maximum.',
    heicNonSupporte:
      "Cette photo est au format HEIC, que la plupart des ordinateurs n'ouvrent pas. Sur iPhone : Réglages › Appareil photo › Formats › « Plus compatible ».",
    fichierIllisible: 'Fichier illisible.',
    photoIndisponible: "L'ajout de photo est disponible sur l'application mobile.",
    permissionRefusee:
      "Dualia n'a pas accès à vos photos. Autorisez l'accès dans les réglages du téléphone.",
  },
  pt: {
    erreur: 'Erro',
    joindre: 'Anexar um ficheiro',
    photo: 'Anexar uma foto',
    piece: 'Anexo',
    typeNonSupporte: 'Formato não aceite. PDF, Word, Excel, texto, JPG, PNG.',
    tropVolumineux: 'Ficheiro demasiado grande: 10 MB no máximo.',
    heicNonSupporte:
      'Esta foto está no formato HEIC, que a maioria dos computadores não abre. No iPhone: Definições › Câmara › Formatos › «Mais compatível».',
    fichierIllisible: 'Ficheiro ilegível.',
    photoIndisponible: 'A adição de fotos está disponível na aplicação móvel.',
    permissionRefusee:
      'A Dualia não tem acesso às suas fotos. Autorize o acesso nas definições do telemóvel.',
  },
  es: {
    erreur: 'Error',
    joindre: 'Adjuntar un archivo',
    photo: 'Adjuntar una foto',
    piece: 'Adjunto',
    typeNonSupporte: 'Formato no aceptado. PDF, Word, Excel, texto, JPG, PNG.',
    tropVolumineux: 'Archivo demasiado grande: 10 MB como máximo.',
    heicNonSupporte:
      'Esta foto está en formato HEIC, que la mayoría de los ordenadores no abre. En iPhone: Ajustes › Cámara › Formatos › «Más compatible».',
    fichierIllisible: 'Archivo ilegible.',
    photoIndisponible: 'Añadir fotos está disponible en la aplicación móvil.',
    permissionRefusee:
      'Dualia no tiene acceso a tus fotos. Autoriza el acceso en los ajustes del teléfono.',
  },
  en: {
    erreur: 'Error',
    joindre: 'Attach a file',
    photo: 'Attach a photo',
    piece: 'Attachment',
    typeNonSupporte: 'Format not accepted. PDF, Word, Excel, text, JPG, PNG.',
    tropVolumineux: 'File too large: 10 MB maximum.',
    heicNonSupporte:
      'This photo is in HEIC format, which most computers cannot open. On iPhone: Settings › Camera › Formats › "Most Compatible".',
    fichierIllisible: 'Unreadable file.',
    photoIndisponible: 'Adding a photo is available in the mobile app.',
    permissionRefusee:
      "Dualia doesn't have access to your photos. Allow access in your phone settings.",
  },
};

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

function localeDeLangue(langue: 'fr' | 'pt' | 'es' | 'en') {
  return langue === 'pt' ? 'pt-PT' : langue === 'es' ? 'es-ES' : langue === 'en' ? 'en-GB' : 'fr-FR';
}

function formatDay(isoDate: string, langue: 'fr' | 'pt' | 'es' | 'en') {
  const d = new Date(isoDate);
  return d.toLocaleDateString(localeDeLangue(langue), { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(isoDate: string, langue: 'fr' | 'pt' | 'es' | 'en') {
  const d = new Date(isoDate);
  return d.toLocaleTimeString(localeDeLangue(langue), { hour: '2-digit', minute: '2-digit' });
}

export default function MessagerieScreen() {
  const router = useRouter();
  const messages = useStore((s) => s.messages);
  const parentActif = useStore((s) => s.parentActif);
  const setDraft = useStore((s) => s.setNouvelleDecisionDraft);
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].messagerie;
  const l = LIBELLES[langue] ?? LIBELLES.fr;
  const ajouterMessage = useStore((s) => s.ajouterMessage);
  const televerserPieceJointe = useStore((s) => s.televerserPieceJointe);
  const [texteEnvoi, setTexteEnvoi] = React.useState('');
  // ---- Modération à l'envoi (filtre + reformulation IA) ----
  const [verificationEnCours, setVerificationEnCours] = React.useState(false);
  const [alerte, setAlerte] = React.useState<{ texteOriginal: string; reformulation: string } | null>(null);
  // Identifiant du message dont la suggestion vient d'etre refusee, parce que
  // sa date etait illisible. On le retient pour l'afficher, au lieu de laisser
  // le parent appuyer sur « Confirmer » sans que rien ne se passe.
  const [suggestionRefusee, setSuggestionRefusee] = React.useState<string | null>(null);
  // ---- Pièce jointe ----
  const [piece, setPiece] = React.useState<PieceEnAttente | null>(null);
  const [preparationPiece, setPreparationPiece] = React.useState(false);
  // Le téléversement d'une pièce prend plusieurs secondes. Sans ce verrou, le
  // bouton reste actif pendant ce temps et un second appui enverrait un
  // deuxième message, avec un deuxième fichier.
  const [envoiEnCours, setEnvoiEnCours] = React.useState(false);
  const webImageInputRef = React.useRef<any>(null);

  const messagePourErreur = (err: any): string | undefined => {
    switch (err?.message) {
      case 'fichier_heic':
        return l.heicNonSupporte;
      case 'type_non_supporte':
        return l.typeNonSupporte;
      case 'fichier_trop_volumineux':
        return l.tropVolumineux;
      case 'image_illisible':
      case 'fichier_illisible':
        return l.fichierIllisible;
      default:
        return err?.message;
    }
  };

  const lireFichierEnBase64 = async (uri: string): Promise<string> => {
    if (Platform.OS === 'web') {
      const reponse = await fetch(uri);
      const blob = await reponse.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  };

  const choisirFichier = async () => {
    try {
      const pick = await choisirFichierDocument();
      if (!pick) return;
      setPreparationPiece(true);
      const contentType = normaliserType(pick.mimeType, pick.name);
      const base64 = pick.uri.startsWith('data:')
        ? pick.uri.split(',')[1]
        : await lireFichierEnBase64(pick.uri);
      setPiece({ base64, contentType, nom: pick.name });
    } catch (err: any) {
      console.error('[Dualia] Échec sélection de la pièce jointe :', err);
      alertCompat(l.erreur, messagePourErreur(err));
    } finally {
      setPreparationPiece(false);
    }
  };

  const choisirPhoto = async () => {
    if (Platform.OS === 'web') {
      webImageInputRef.current?.click();
      return;
    }
    if (!ImagePicker) {
      alertCompat(l.erreur, l.photoIndisponible);
      return;
    }
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        alertCompat(l.erreur, l.permissionRefusee);
        return;
      }
      const resultat = await ImagePicker.launchImageLibraryAsync({
        base64: true,
        quality: PHOTO_JPEG_QUALITY,
      });
      if (resultat.canceled || !resultat.assets?.[0]) return;

      setPreparationPiece(true);
      const asset = resultat.assets[0];
      const nom = (asset as any).fileName || `photo-${Date.now()}.jpg`;
      const typeBrut = (asset.mimeType || 'image/jpeg').toLowerCase();
      if (estHeic(typeBrut, nom)) {
        alertCompat(l.erreur, l.heicNonSupporte);
        return;
      }
      const contentType = typeImageStocke(typeBrut);
      const base64 = asset.base64 ?? (await lireFichierEnBase64(asset.uri));
      if (base64.length > TAILLE_MAX_BASE64) {
        alertCompat(l.erreur, l.tropVolumineux);
        return;
      }
      setPiece({ base64, contentType, nom });
    } catch (err: any) {
      console.error('[Dualia] Échec sélection de la photo :', err);
      alertCompat(l.erreur, messagePourErreur(err));
    } finally {
      setPreparationPiece(false);
    }
  };

  const traiterImageWeb = async (fichier: File) => {
    setPreparationPiece(true);
    try {
      const nom = fichier.name || 'photo.jpg';
      const typeBrut = (fichier.type || '').toLowerCase();
      if (estHeic(typeBrut, nom)) {
        alertCompat(l.erreur, l.heicNonSupporte);
        return;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('fichier_illisible'));
        reader.readAsDataURL(fichier);
      });
      const compresse = await compresserImageWeb(dataUrl);
      if (compresse.base64.length > TAILLE_MAX_BASE64) {
        alertCompat(l.erreur, l.tropVolumineux);
        return;
      }
      setPiece({ base64: compresse.base64, contentType: compresse.contentType, nom });
    } catch (err: any) {
      console.error('[Dualia] Échec préparation de la photo :', err);
      alertCompat(l.erreur, messagePourErreur(err));
    } finally {
      setPreparationPiece(false);
    }
  };

  const ouvrirPieceJointe = async (chemin: string) => {
    try {
      await ouvrirFichierStocke(chemin);
    } catch (err: any) {
      console.error('[Dualia] Échec ouverture de la pièce jointe :', err);
      alertCompat(l.erreur, err?.message);
    }
  };

  const envoyerTexte = async (contenu: string, contenuOriginal?: string, alerteDetectee?: boolean) => {
    if (envoiEnCours) return;
    setEnvoiEnCours(true);
    let pieceEnvoyee: { chemin: string; nom: string; type: string } | null = null;
    if (piece) {
      try {
        pieceEnvoyee = await televerserPieceJointe(piece);
      } catch (err: any) {
        // Un message parti sans sa pièce jointe donnerait à croire qu'elle est
        // arrivée : on n'envoie rien plutôt que de mentir sur ce point.
        console.error('[Dualia] Échec envoi de la pièce jointe :', err);
        alertCompat(l.erreur, messagePourErreur(err));
        setEnvoiEnCours(false);
        return;
      }
    }

    ajouterMessage({
      id: 'msg-' + Date.now(),
      expediteurId: parentActif,
      contenu,
      dateEnvoi: new Date().toISOString(),
      // Le fuseau de CELUI QUI ECRIT, fige a l'envoi. C'est lui qui donne son
      // sens a « demain » ou « ce soir » — pas celui de la personne qui lira.
      fuseauExpediteur: fuseauAppareil(),
      statut: 'envoyé',
      contenuOriginal,
      alerteDetectee,
      pieceJointeUrl: pieceEnvoyee?.chemin,
      pieceJointeNom: pieceEnvoyee?.nom,
      pieceJointeType: pieceEnvoyee?.type,
    });
    setTexteEnvoi('');
    setPiece(null);
    setAlerte(null);
    setEnvoiEnCours(false);
  };

  const envoyerMessage = async () => {
    const texte = texteEnvoi.trim();
    // Une pièce jointe seule est un message valable : la photo du mot de
    // l'école se suffit souvent à elle-même.
    if ((!texte && !piece) || verificationEnCours || preparationPiece || envoiEnCours) return;

    if (texte) {
      setVerificationEnCours(true);
      try {
        const reponse = await fetchAvecRetry(MODERATE_MESSAGE_URL, {
          method: 'POST',
          headers: await entetesBackend(),
          body: JSON.stringify({ texte, langue }),
        });
        const data = await reponse.json();
        if (data.alerteDetectee && data.reformulation) {
          setAlerte({ texteOriginal: texte, reformulation: data.reformulation });
          return; // on attend le choix du parent avant d'envoyer quoi que ce soit
        }
      } catch {
        // Si la modération est indisponible (backend en panne, réseau…), on
        // n'empêche jamais l'envoi du message : ce garde-fou est une aide,
        // pas un blocage.
      } finally {
        setVerificationEnCours(false);
      }
    }
    await envoyerTexte(texte);
  };

  const envoyerTelQuel = () => {
    if (!alerte) return;
    envoyerTexte(alerte.texteOriginal);
  };

  const envoyerReformule = () => {
    if (!alerte) return;
    envoyerTexte(alerte.reformulation, alerte.texteOriginal, true);
  };
  const evenementsCalendrier = useStore((s) => s.evenementsCalendrier);
  const ajouterEvenementCalendrier = useStore((s) => s.ajouterEvenementCalendrier);
  const messagesAnalyses = useStore((s) => s.messagesAnalyses);
  const marquerMessageAnalyse = useStore((s) => s.marquerMessageAnalyse);
  const ignorerSuggestion = useStore((s) => s.ignorerSuggestion);
  const suggestions = useStore((s) => s.suggestionsMessages);
  const ajouterSuggestionMessage = useStore((s) => s.ajouterSuggestionMessage);
  const retirerSuggestionMessage = useStore((s) => s.retirerSuggestionMessage);
  const enfants = useStore((s) => s.enfants);

  React.useEffect(() => {
    messages.forEach((msg) => {
      if (messagesAnalyses.includes(msg.id)) return;
      marquerMessageAnalyse(msg.id);
      // Un message réduit à sa pièce jointe n'a pas de texte à analyser :
      // l'envoyer au détecteur d'événements ne ferait qu'un aller-retour
      // réseau pour rien.
      if (!msg.contenu.trim()) return;
      // Les en-têtes portent désormais le jeton de session, et le construire
      // demande un await : le rappel passe donc en asynchrone. Les erreurs
      // restent avalées — ce détecteur d'événements est un confort, il ne doit
      // jamais faire échouer l'affichage de la messagerie.
      (async () => {
        try {
          const reponse = await fetchAvecRetry(PARSE_MESSAGE_URL, {
            method: 'POST',
            headers: await entetesBackend(),
            // L'analyse est ancree sur le MESSAGE, pas sur le moment ou on le
            // lit. Sans « instant », le serveur prenait l'heure courante : un
            // message ecrit vendredi soir et ouvert le dimanche faisait
            // tomber « demain » sur lundi chez l'un et samedi chez l'autre.
            // Et sans le fuseau de l'expediteur, deux parents dans deux pays
            // — Lisbonne et Paris n'ont pas la meme heure — obtenaient deux
            // jours differents pour la meme phrase.
            //
            // Les deux appareils envoient donc exactement les memes reperes,
            // et obtiennent donc la meme date. Pour les messages anterieurs a
            // la colonne, on retombe sur le fuseau du lecteur.
            body: JSON.stringify({
              texte: msg.contenu,
              langue,
              instant: msg.dateEnvoi,
              fuseau: msg.fuseauExpediteur || fuseauAppareil(),
            }),
          });
          const data = await reponse.json();
          if (data.evenementDetecte && data.date) {
            ajouterSuggestionMessage(msg.id, { titre: data.titre || 'Evenement', date: data.date, enfant: data.enfant });
          }
        } catch {
          /* silencieux */
        }
      })();
    });
  }, [messages]);

  const confirmerSuggestion = (msgId: string) => {
    const sug = suggestions[msgId];
    if (!sug) return;
    // L'IA renvoie le prénom en texte libre — on le résout vers l'enfant
    // réel du foyer (comparaison insensible à la casse) pour obtenir un
    // enfantId fiable plutôt que de ne garder qu'un label non relié.
    const enfantResolu = sug.enfant
      ? enfants.find((e) => e.prenom.toLowerCase() === sug.enfant!.toLowerCase())
      : undefined;
    // L'heure rendue par le detecteur est une heure murale, sans fuseau. La
    // conversion en instant se fait une seule fois, dans le magasin : la
    // faire aussi ici la faisait deux fois, et l'evenement partait deux
    // heures plus tot que l'heure affichee dans la bulle juste au-dessus.
    const retenu = ajouterEvenementCalendrier({
      id: 'evt-' + Date.now(),
      titre: sug.titre,
      date: sug.date,
      parentId: parentActif,
      enfant: enfantResolu?.prenom ?? sug.enfant ?? undefined,
      enfantId: enfantResolu?.id,
      sourceMessageId: msgId,
    });

    // Refuse : on garde la suggestion a l'ecran. L'effacer ferait disparaitre
    // le rendez-vous sans que rien ne soit cree, et sans retour possible —
    // le message est deja marque comme analyse, il ne sera pas represente.
    if (!retenu) {
      setSuggestionRefusee(msgId);
      return;
    }
    retirerSuggestionMessage(msgId);
  };

  const ignorerCetteSuggestion = (msgId: string) => {
    ignorerSuggestion(msgId);
    retirerSuggestionMessage(msgId);
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
                    {msg.pieceJointeUrl ? (
                      <Pressable
                        style={[styles.pieceBulle, fromMe && styles.pieceBulleMe]}
                        onPress={() => msg.pieceJointeUrl && ouvrirPieceJointe(msg.pieceJointeUrl)}
                      >
                        <Ionicons
                          name={estUneImage(msg.pieceJointeType ?? '') ? 'image-outline' : 'document-attach-outline'}
                          size={16}
                          color={fromMe ? COLORS.blanc : COLORS.vert}
                        />
                        <Text
                          style={[styles.pieceBulleNom, fromMe && styles.pieceBulleNomMe]}
                          numberOfLines={1}
                        >
                          {msg.pieceJointeNom || l.piece}
                        </Text>
                      </Pressable>
                    ) : null}
                    {msg.contenu.trim() ? (
                      <Text style={[styles.bubbleText, fromMe && styles.bubbleTextMe]}>{msg.contenu}</Text>
                    ) : null}
                    <Text style={[styles.bubbleMeta, fromMe && styles.bubbleMetaMe]}>{formatTime(msg.dateEnvoi, langue)}</Text>
              </View>
              {suggestions[msg.id] ? (
                <View style={styles.suggestionCard}>
                  <Text style={styles.suggestionTexte}>
                   {t.ajouterAuCalendrier} {suggestions[msg.id].titre}
                {suggestions[msg.id].enfant ? ` – ${suggestions[msg.id].enfant}` : ''}
                {dateSuggestionLisible(suggestions[msg.id].date) ? (
                  <>
                    {' – '}
                    {(() => {
                      // Meme lecture que celle qui sera enregistree, pour que
                      // l'heure proposee et l'heure retenue ne divergent jamais.
                      const d = new Date(instantDepuisHeureLocale(suggestions[msg.id].date));
                      const aUneHeure = d.getHours() !== 0 || d.getMinutes() !== 0;
                      return d.toLocaleDateString(localeDeLangue(langue), {
                        day: 'numeric',
                        month: 'long',
                        ...(aUneHeure ? { hour: '2-digit', minute: '2-digit' } : {}),
                      });
                    })()}
                    {' ?'}
                  </>
                ) : null}
                  </Text>

                  {/* Une date que le magasin refusera ne doit pas etre
                      affichee comme si elle allait de soi. new Date() reporte
                      le 31 fevrier au 3 mars sans rien dire : la carte
                      proposait « 3 mars a 19:00 ? », le parent confirmait, et
                      s'entendait repondre que la date etait illisible. */}
                  {!dateSuggestionLisible(suggestions[msg.id].date) || suggestionRefusee === msg.id ? (
                    <Text style={styles.suggestionErreur}>{t.dateIllisible}</Text>
                  ) : null}

                  <View style={styles.suggestionBtns}>
                    <Pressable style={styles.suggestionBtnIgnorer} onPress={() => ignorerCetteSuggestion(msg.id)}>
                      <Text style={styles.suggestionBtnIgnorerText}>{t.ignorer}</Text>
                    </Pressable>
                    {dateSuggestionLisible(suggestions[msg.id].date) ? (
                      <Pressable style={styles.suggestionBtnConfirmer} onPress={() => confirmerSuggestion(msg.id)}>
                        <Text style={styles.suggestionBtnConfirmerText}>{t.confirmer}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  </View>
                                ) : null}
                              {msg.contenu.trim() ? (
                                <Pressable
                    style={[styles.formaliserBtn, fromMe && styles.formaliserBtnMe]}
                    onPress={() => formaliser(msg.contenu)}
                  >
                    <ExportIcon size={11} color={COLORS.vert} strokeWidth={2} />
                    <Text style={styles.formaliserText}>{t.formaliser}</Text>
                  </Pressable>
                              ) : null}
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
        {alerte ? (
          <View style={styles.moderationCard}>
            <Text style={styles.moderationLabel}>
              {langue === 'pt'
                ? 'Talvez seja melhor com um tom mais calmo :'
                : langue === 'en'
                ? 'Perhaps calmer this way:'
                : langue === 'es'
                ? 'Quizás mejor con un tono más calmado:'
                : 'Peut-être plus apaisé ainsi :'}
            </Text>
            <Text style={styles.moderationTexte}>{alerte.reformulation}</Text>
            <View style={styles.suggestionBtns}>
              <Pressable style={styles.suggestionBtnIgnorer} onPress={envoyerTelQuel} disabled={envoiEnCours}>
                <Text style={styles.suggestionBtnIgnorerText}>
                  {langue === 'pt'
                    ? 'Enviar assim mesmo'
                    : langue === 'en'
                    ? 'Send as is'
                    : langue === 'es'
                    ? 'Enviar tal cual'
                    : 'Envoyer tel quel'}
                </Text>
              </Pressable>
              <Pressable style={styles.suggestionBtnConfirmer} onPress={envoyerReformule} disabled={envoiEnCours}>
                <Text style={styles.suggestionBtnConfirmerText}>
                  {langue === 'pt'
                    ? 'Usar esta versão'
                    : langue === 'en'
                    ? 'Use this version'
                    : langue === 'es'
                    ? 'Usar esta versión'
                    : 'Utiliser cette version'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Pièce en attente : visible au-dessus de la zone de saisie, et
            retirable avant l'envoi. Rien n'est téléversé tant que le message
            n'est pas parti. */}
        {piece || preparationPiece ? (
          <View style={styles.pieceEnAttente}>
            {preparationPiece ? (
              <ActivityIndicator color={COLORS.vert} size="small" />
            ) : (
              <Ionicons
                name={estUneImage(piece!.contentType) ? 'image-outline' : 'document-attach-outline'}
                size={17}
                color={COLORS.vert}
              />
            )}
            <Text style={styles.pieceEnAttenteNom} numberOfLines={1}>
              {piece ? piece.nom : '…'}
            </Text>
            {piece ? (
              <Pressable onPress={() => setPiece(null)} hitSlop={10}>
                <Ionicons name="close-circle" size={18} color={COLORS.ardoise} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.saisieZone}>
          <Pressable
            style={styles.saisieBtnPiece}
            onPress={choisirFichier}
            disabled={preparationPiece}
            accessibilityLabel={l.joindre}
          >
            <Ionicons name="attach-outline" size={21} color={COLORS.vert} />
          </Pressable>
          <Pressable
            style={styles.saisieBtnPiece}
            onPress={choisirPhoto}
            disabled={preparationPiece}
            accessibilityLabel={l.photo}
          >
            <Ionicons name="image-outline" size={19} color={COLORS.vert} />
          </Pressable>
          {Platform.OS === 'web' ? React.createElement('input', {
            ref: webImageInputRef,
            type: 'file',
            accept: 'image/jpeg,image/png,image/webp',
            style: { display: 'none' },
            onChange: (e: any) => {
              const choisi = e.target.files?.[0];
              e.target.value = '';
              if (choisi) traiterImageWeb(choisi);
            },
          }) : null}
          <TextInput
            style={styles.saisieInput}
            value={texteEnvoi}
            onChangeText={setTexteEnvoi}
            placeholder={
              langue === 'pt'
                ? 'Escrever uma mensagem...'
                : langue === 'en'
                ? 'Write a message...'
                : langue === 'es'
                ? 'Escribir un mensaje...'
                : 'Ecrire un message...'
            }
            placeholderTextColor={COLORS.ardoise}
            multiline
            editable={!verificationEnCours}
          />
          <Pressable
            style={[
              styles.saisieBtnEnvoyer,
              (verificationEnCours || preparationPiece || envoiEnCours) && styles.saisieBtnEnvoyerInactif,
            ]}
            onPress={envoyerMessage}
            disabled={verificationEnCours || preparationPiece || envoiEnCours}
          >
            {envoiEnCours ? (
              <ActivityIndicator color={COLORS.blanc} size="small" />
            ) : (
              <Text style={styles.saisieBtnEnvoyerText}>
                {verificationEnCours ? '…' : t.envoyer}
              </Text>
            )}
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
  pieceBulle: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(23,63,50,0.05)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6,
  },
  pieceBulleMe: { backgroundColor: 'rgba(255,255,255,0.18)' },
  pieceBulleNom: {
    flex: 1, fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.vertProfond,
    textDecorationLine: 'underline',
  },
  pieceBulleNomMe: { color: COLORS.blanc },
  formaliserBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, paddingHorizontal: 4,
  },
  formaliserBtnMe: { alignSelf: 'flex-end' },
  formaliserText: { fontFamily: FONTS.bodySemibold, fontSize: 10.5, color: COLORS.vert },
  suggestionCard: { backgroundColor: COLORS.ivoire, borderWidth: 1, borderColor: COLORS.vert, borderRadius: 10, padding: 10, marginTop: 6, marginBottom: 8 },
  suggestionTexte: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.vertProfond, marginBottom: 8 },
  suggestionErreur: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.erreur, marginBottom: 8 },
  suggestionBtns: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  suggestionBtnIgnorer: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  suggestionBtnIgnorerText: { fontFamily: FONTS.bodySemibold, fontSize: 11, color: COLORS.ardoise },
  suggestionBtnConfirmer: { backgroundColor: COLORS.vert, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  suggestionBtnConfirmerText: { fontFamily: FONTS.bodySemibold, fontSize: 11, color: COLORS.blanc },
  moderationCard: { backgroundColor: COLORS.ivoire, borderWidth: 1, borderColor: COLORS.terracotta, borderRadius: 10, padding: 10, marginHorizontal: SPACING.xl, marginBottom: 8 },
  moderationLabel: { fontFamily: FONTS.bodySemibold, fontSize: 11, color: COLORS.terracotta, marginBottom: 4 },
  moderationTexte: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.vertProfond, marginBottom: 8, fontStyle: 'italic' },
  pieceEnAttente: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: '#E8F3ED', borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: 10,
    marginHorizontal: SPACING.xl, marginBottom: 8,
  },
  pieceEnAttenteNom: { flex: 1, fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.vertProfond },
  saisieZone: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, backgroundColor: COLORS.blanc, borderTopWidth: 1, borderTopColor: COLORS.bordure },
  saisieBtnPiece: { paddingHorizontal: 2, paddingVertical: 10 },
  saisieInput: { flex: 1, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.vertProfond, maxHeight: 100 },
  saisieBtnEnvoyer: { backgroundColor: COLORS.vert, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  saisieBtnEnvoyerInactif: { opacity: 0.55 },
  saisieBtnEnvoyerText: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.blanc }
});
