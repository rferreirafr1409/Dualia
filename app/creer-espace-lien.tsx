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

export default function CreerEspaceLienScreen() {
  const router = useRouter();
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
          ? "Cet espace familial est déjà complet : il n'y a personne à inviter."
          : "Le lien n'a pas pu être créé. Réessayez dans un instant."
      );
      setChargement(false);
      return;
    }
    afficher(ligne);
    setChargement(false);
  }, [familleId]);

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
            ? "Choisissez d'abord l'espace familial concerné, en haut de l'écran."
            : "Le lien n'a pas pu être chargé. Réessayez dans un instant."
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
  }, [genererLien, familleId]);

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
          {espaceComplet || depuisFamille ? 'Inviter le co-parent' : 'Votre espace est créé'}
        </Text>
        {!espaceComplet ? (
          <Text style={styles.sousTitre}>
            Envoyez ce lien à l'autre parent, puis communiquez-lui le code par un autre moyen.
            Valable 48 heures.{depuisFamille ? '' : ' Vous pourrez aussi le faire plus tard.'}
          </Text>
        ) : null}

        {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

        {espaceComplet ? (
          <View style={styles.codeBox}>
            <Text style={styles.codeAide}>
              Cet espace familial est complet : vous et l'autre parent y êtes tous les deux. Il n'y
              a donc plus personne à inviter.
            </Text>
          </View>
        ) : null}

        {lienInvitation && !espaceComplet ? (
          <View style={styles.lienBox}>
            <Text style={styles.lienTexte} selectable>{lienInvitation}</Text>
          </View>
        ) : null}

        {code && !espaceComplet ? (
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>Code à transmettre séparément</Text>
            <Text style={styles.codeValeur} selectable>{code}</Text>
            <Text style={styles.codeAide}>
              Dites-le au téléphone, de vive voix, ou par un autre message que celui qui porte le
              lien. Envoyer les deux ensemble reviendrait à n'avoir aucun code.
            </Text>
          </View>
        ) : null}

        {lienInvitation && !espaceComplet ? (
          <Pressable style={styles.boutonPrincipal} onPress={partagerLien}>
            <Text style={styles.boutonPrincipalTexte}>Partager le lien seul</Text>
          </Pressable>
        ) : null}

        {!espaceComplet ? (
          <Pressable style={styles.boutonSecondaire} onPress={genererLien}>
            <Text style={styles.boutonSecondaireTexte}>Générer un nouveau lien et un nouveau code</Text>
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
            {espaceComplet || depuisFamille ? 'Retour' : 'Continuer vers Dualia →'}
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