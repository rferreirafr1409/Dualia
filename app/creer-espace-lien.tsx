// app/creer-espace-lien.tsx
// Affiché juste après configurer-foyer.tsx — récupère le lien
// d'invitation déjà généré par creer_famille() (appelée dans
// creer-espace.tsx) et propose de le partager. "Continuer sans inviter"
// reste possible : qui utilise Dualia aujourd'hui est indépendant de la
// configuration familiale déjà choisie.

import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Share, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../constants/supabase';
import { useStore } from '../store/useStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { URL_APPLICATION } from '../constants/environnement';
import { confirmer } from '../lib/dialogue';

type Langue = 'fr' | 'pt' | 'es' | 'en';

const LIBELLES: Record<Langue, {
  titreInviter: string;
  titreCree: string;
  sousTitre: string;
  plusTard: string;
  espaceComplet: string;
  codeLabel: string;
  codeAide: string;
  partager: string;
  regenerer: string;
  retour: string;
  continuer: string;
  erreurComplet: string;
  erreurCreation: string;
  erreurEspace: string;
  erreurChargement: string;
  remplacerTitre: string;
  remplacerTexte: string;
  remplacer: string;
  garder: string;
}> = {
  fr: {
    titreInviter: 'Inviter le co-parent',
    titreCree: 'Votre espace est créé',
    sousTitre: "Envoyez ce lien à l'autre parent, puis communiquez-lui le code par un autre moyen. Valable 48 heures.",
    plusTard: ' Vous pourrez aussi le faire plus tard.',
    espaceComplet: "Cet espace familial est complet : vous et l'autre parent y êtes tous les deux. Il n'y a donc plus personne à inviter.",
    codeLabel: 'Code à transmettre séparément',
    codeAide: "Dites-le au téléphone, de vive voix, ou par un autre message que celui qui porte le lien. Envoyer les deux ensemble reviendrait à n'avoir aucun code.",
    partager: 'Partager le lien seul',
    regenerer: 'Générer un nouveau lien et un nouveau code',
    retour: 'Retour',
    continuer: 'Continuer vers Dualia →',
    erreurComplet: "Cet espace familial est déjà complet : il n'y a personne à inviter.",
    erreurCreation: "Le lien n'a pas pu être créé. Réessayez dans un instant.",
    erreurEspace: "Choisissez d'abord l'espace familial concerné, en haut de l'écran.",
    erreurChargement: "Le lien n'a pas pu être chargé. Réessayez dans un instant.",
    remplacerTitre: 'Remplacer le lien actuel ?',
    remplacerTexte: "Le lien et le code que vous avez déjà envoyés ne fonctionneront plus. L'autre parent devra utiliser les nouveaux.",
    remplacer: 'Remplacer',
    garder: 'Garder le lien actuel',
  },
  pt: {
    titreInviter: 'Convidar o outro progenitor',
    titreCree: 'O seu espaço foi criado',
    sousTitre: 'Envie esta ligação ao outro progenitor e comunique-lhe o código por outro meio. Válida durante 48 horas.',
    plusTard: ' Também poderá fazê-lo mais tarde.',
    espaceComplet: 'Este espaço familiar está completo: você e o outro progenitor já estão ambos presentes. Já não há ninguém para convidar.',
    codeLabel: 'Código a transmitir separadamente',
    codeAide: 'Diga-o ao telefone, pessoalmente, ou numa mensagem diferente da que contém a ligação. Enviar os dois juntos seria o mesmo que não ter código.',
    partager: 'Partilhar só a ligação',
    regenerer: 'Gerar uma nova ligação e um novo código',
    retour: 'Voltar',
    continuer: 'Continuar para a Dualia →',
    erreurComplet: 'Este espaço familiar já está completo: não há ninguém para convidar.',
    erreurCreation: 'Não foi possível criar a ligação. Tente novamente dentro de instantes.',
    erreurEspace: 'Escolha primeiro o espaço familiar em causa, no topo do ecrã.',
    erreurChargement: 'Não foi possível carregar a ligação. Tente novamente dentro de instantes.',
    remplacerTitre: 'Substituir a ligação atual?',
    remplacerTexte: 'A ligação e o código que já enviou deixarão de funcionar. O outro progenitor terá de usar os novos.',
    remplacer: 'Substituir',
    garder: 'Manter a ligação atual',
  },
  es: {
    titreInviter: 'Invitar al otro progenitor',
    titreCree: 'Tu espacio está creado',
    sousTitre: 'Envía este enlace al otro progenitor y comunícale el código por otro medio. Válido durante 48 horas.',
    plusTard: ' También podrás hacerlo más tarde.',
    espaceComplet: 'Este espacio familiar está completo: tú y el otro progenitor ya estáis los dos. Ya no queda nadie a quien invitar.',
    codeLabel: 'Código a transmitir por separado',
    codeAide: 'Dilo por teléfono, en persona, o en otro mensaje distinto del que lleva el enlace. Enviar los dos juntos equivaldría a no tener código.',
    partager: 'Compartir solo el enlace',
    regenerer: 'Generar un nuevo enlace y un nuevo código',
    retour: 'Volver',
    continuer: 'Continuar a Dualia →',
    erreurComplet: 'Este espacio familiar ya está completo: no hay nadie a quien invitar.',
    erreurCreation: 'No se ha podido crear el enlace. Inténtalo de nuevo en un momento.',
    erreurEspace: 'Elige primero el espacio familiar correspondiente, en la parte superior de la pantalla.',
    erreurChargement: 'No se ha podido cargar el enlace. Inténtalo de nuevo en un momento.',
    remplacerTitre: '¿Sustituir el enlace actual?',
    remplacerTexte: 'El enlace y el código que ya has enviado dejarán de funcionar. El otro progenitor tendrá que usar los nuevos.',
    remplacer: 'Sustituir',
    garder: 'Mantener el enlace actual',
  },
  en: {
    titreInviter: 'Invite the co-parent',
    titreCree: 'Your space has been created',
    sousTitre: 'Send this link to the other parent, then give them the code by another means. Valid for 48 hours.',
    plusTard: ' You can also do this later.',
    espaceComplet: 'This family space is complete: you and the other parent are both in it. There is no one left to invite.',
    codeLabel: 'Code to pass on separately',
    codeAide: 'Say it over the phone, in person, or in a different message from the one carrying the link. Sending both together would be the same as having no code at all.',
    partager: 'Share the link only',
    regenerer: 'Generate a new link and a new code',
    retour: 'Back',
    continuer: 'Continue to Dualia →',
    erreurComplet: 'This family space is already complete: there is no one to invite.',
    erreurCreation: 'The link could not be created. Please try again in a moment.',
    erreurEspace: 'First choose the family space concerned, at the top of the screen.',
    erreurChargement: 'The link could not be loaded. Please try again in a moment.',
    remplacerTitre: 'Replace the current link?',
    remplacerTexte: 'The link and code you have already sent will stop working. The other parent will need to use the new ones.',
    remplacer: 'Replace',
    garder: 'Keep the current link',
  },
};

export default function CreerEspaceLienScreen() {
  const router = useRouter();
  const langue = useStore((s) => s.langue);
  const l = LIBELLES[langue] ?? LIBELLES.fr;
  // Cet ecran sert a deux moments de vie tres differents : la fin de la
  // creation de l'espace, et « Famille -> Inviter le co-parent », des mois
  // plus tard. Sans savoir d'ou l'on vient, la page annonçait « Votre
  // espace est cree » a un parent qui l'avait cree en janvier, et proposait
  // de « continuer vers Dualia » alors qu'il y etait deja.
  const params = useLocalSearchParams<{ depuis?: string }>();
  const depuisFamille = params.depuis === 'famille';
  const [lienInvitation, setLienInvitation] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [espaceComplet, setEspaceComplet] = useState(false);
  const familleId = useStore((s) => s.familleId);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  // On demande au serveur de fabriquer le lien ET le code. Le code n'est
  // volontairement PAS dans l'URL : c'est tout l'interet. Un lien transfere,
  // capture ou lu par-dessus l'epaule ne suffit plus.
  const afficher = (ligne: any) => {
    setLienInvitation(`${URL_APPLICATION}/rejoindre?token=${ligne.token}`);
    setCode(ligne.code ?? null);
  };

  // Fabriquer un lien INVALIDE le precedent. Ce geste ne doit donc jamais
  // etre declenche par un simple affichage : revenir sur cette page suffisait
  // a annuler le lien et le code qu'on venait de dicter au telephone, sans
  // que personne comprenne pourquoi.
  const genererLien = React.useCallback(async () => {
    setChargement(true);
    setErreur(null);
    const { data, error } = await supabase.rpc('creer_invitation', {
      p_famille_id: familleId,
    });
    const ligne = Array.isArray(data) ? data[0] : data;
    if (error || !ligne?.token) {
      setErreur(
        error?.message?.includes('espace_complet')
          ? l.erreurComplet
          : l.erreurCreation
      );
      setChargement(false);
      return;
    }
    afficher(ligne);
    setChargement(false);
  }, [familleId, l]);

  // Regenerer ANNULE le lien et le code deja transmis. Le 10 octobre 2026,
  // un parent a appuye ici huit secondes apres avoir dicte son code : le
  // co-parent, arrive par le premier lien, lisait « Ce lien a ete annule »
  // sans comprendre. On previent, et on ne fait rien sans accord.
  const regenererAvecConfirmation = React.useCallback(async () => {
    if (lienInvitation) {
      const ok = await confirmer(
        l.remplacerTitre,
        l.remplacerTexte,
        l.remplacer,
        l.garder,
        true
      );
      if (!ok) return;
    }
    await genererLien();
  }, [lienInvitation, genererLien, l]);

  // A l'affichage, on RELIT le lien en cours. On n'en cree un que s'il n'y
  // en a aucun de valide.
  useEffect(() => {
    let vivant = true;
    (async () => {
      // On attend de savoir quel espace est actif. Monter cet ecran avant
      // que la session soit chargee envoyait un espace nul : le serveur
      // repondait « espace_a_preciser » pour un compte a deux espaces, et
      // l'erreur etait avalee — ecran mort, sans explication.
      if (!familleId) return;

      const { data, error } = await supabase.rpc('mon_invitation_en_cours', {
        p_famille_id: familleId,
      });
      if (!vivant) return;
      if (error) {
        setErreur(
          error.message?.includes('espace_a_preciser')
            ? l.erreurEspace
            : l.erreurChargement
        );
        setChargement(false);
        return;
      }
      const ligne = Array.isArray(data) ? data[0] : data;
      // L'espace est deja a deux : il n'y a personne a inviter, et
      // proposer un lien serait mentir — le serveur le refuserait.
      if (ligne?.espace_complet) {
        setEspaceComplet(true);
        setChargement(false);
      } else if (ligne?.token) {
        afficher(ligne);
        setChargement(false);
      } else {
        genererLien();
      }
    })();
    return () => { vivant = false; };
  }, [genererLien, familleId, l]);

  const partagerLien = async () => {
    if (!lienInvitation) return;
    try {
      // Le code n'est deliberement pas joint : l'envoyer dans le meme
      // message annulerait la protection qu'il apporte.
      await Share.share({ message: lienInvitation });
    } catch {
      // L'utilisateur peut aussi copier le lien affiché à l'écran.
    }
  };

  if (chargement) {
    return (
      <View style={styles.centreEcran}>
        <ActivityIndicator size="large" color={COLORS.vert} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.contentCentre}>
        <Text style={styles.titre}>
          {espaceComplet || depuisFamille ? l.titreInviter : l.titreCree}
        </Text>
        {!espaceComplet ? (
          <Text style={styles.sousTitre}>
            {l.sousTitre}{depuisFamille ? '' : l.plusTard}
          </Text>
        ) : null}

        {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

        {espaceComplet ? (
          <View style={styles.codeBox}>
            <Text style={styles.codeAide}>{l.espaceComplet}</Text>
          </View>
        ) : null}

        {lienInvitation && !espaceComplet ? (
          <View style={styles.lienBox}>
            <Text style={styles.lienTexte} selectable>{lienInvitation}</Text>
          </View>
        ) : null}

        {code && !espaceComplet ? (
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>{l.codeLabel}</Text>
            <Text style={styles.codeValeur} selectable>{code}</Text>
            <Text style={styles.codeAide}>{l.codeAide}</Text>
          </View>
        ) : null}

        {lienInvitation && !espaceComplet ? (
          <Pressable style={styles.boutonPrincipal} onPress={partagerLien}>
            <Text style={styles.boutonPrincipalTexte}>{l.partager}</Text>
          </Pressable>
        ) : null}

        {!espaceComplet ? (
          <Pressable style={styles.boutonSecondaire} onPress={regenererAvecConfirmation}>
            <Text style={styles.boutonSecondaireTexte}>{l.regenerer}</Text>
          </Pressable>
        ) : null}

        {/* Venu de Famille, on y retourne : « Continuer vers Dualia » vers
            l'accueil n'a de sens qu'a la fin de l'inscription. */}
        <Pressable
          style={styles.boutonSecondaire}
          onPress={() =>
            router.replace((depuisFamille ? '/(tabs)/famille' : '/(tabs)/accueil') as any)
          }
        >
          <Text style={styles.boutonSecondaireTexte}>
            {espaceComplet || depuisFamille ? l.retour : l.continuer}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ivoire },
  centreEcran: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.ivoire },
  contentCentre: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.xl },
  titre: { fontFamily: FONTS.display, fontSize: 24, color: COLORS.vertProfond, marginBottom: SPACING.sm },
  sousTitre: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, lineHeight: 19, marginBottom: SPACING.xl },
  boutonPrincipal: {
    backgroundColor: COLORS.vert, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center',
  },
  boutonPrincipalTexte: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.blanc },
  boutonSecondaire: { paddingVertical: 14, alignItems: 'center', marginTop: SPACING.sm },
  boutonSecondaireTexte: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.vert },
  erreur: {
    fontFamily: FONTS.body, fontSize: 12, color: COLORS.erreur,
    lineHeight: 17, marginBottom: SPACING.sm,
  },
  codeBox: {
    backgroundColor: COLORS.ivoire, borderRadius: RADIUS.md,
    padding: SPACING.md, marginTop: SPACING.md, alignItems: 'center',
  },
  codeLabel: {
    fontFamily: FONTS.body, fontSize: 11, color: COLORS.ardoise,
    textTransform: 'uppercase', letterSpacing: 1,
  },
  codeValeur: {
    fontFamily: FONTS.display, fontSize: 32, color: COLORS.vertProfond,
    letterSpacing: 6, marginVertical: SPACING.xs,
  },
  codeAide: {
    fontFamily: FONTS.body, fontSize: 11, color: COLORS.ardoise,
    lineHeight: 16, textAlign: 'center',
  },
  lienBox: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.lg,
  },
  lienTexte: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.vertProfond },
});