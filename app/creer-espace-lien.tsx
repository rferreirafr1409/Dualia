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
import { useRouter } from 'expo-router';
import { supabase } from '../constants/supabase';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';

export default function CreerEspaceLienScreen() {
  const router = useRouter();
  const [lienInvitation, setLienInvitation] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    supabase
      .from('familles')
      .select('invitations(token)')
      .then(async () => {
        // Le token a été généré par creer_famille() ; on le retrouve via
        // la famille de l'utilisateur courant.
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user) {
          setChargement(false);
          return;
        }
        const { data: parentRow } = await supabase
          .from('parents')
          .select('famille_id')
          .eq('user_id', user.id)
          .single();
        if (!parentRow) {
          setChargement(false);
          return;
        }
        const { data: invitationRow } = await supabase
          .from('invitations')
          .select('token')
          .eq('famille_id', parentRow.famille_id)
          .is('utilisee_le', null)
          .order('cree_le', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (invitationRow?.token) {
          setLienInvitation(`https://rferreirafr1409.github.io/Dualia/rejoindre?token=${invitationRow.token}`);
        }
        setChargement(false);
      });
  }, []);

  const partagerLien = async () => {
    if (!lienInvitation) return;
    try {
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
        <Text style={styles.titre}>Votre espace est créé</Text>
        <Text style={styles.sousTitre}>
          Envoyez ce lien à l'autre parent pour qu'il rejoigne votre espace familial. Il reste valable
          7 jours. Vous pouvez aussi continuer sans l'envoyer maintenant.
        </Text>

        {lienInvitation ? (
          <View style={styles.lienBox}>
            <Text style={styles.lienTexte} selectable>{lienInvitation}</Text>
          </View>
        ) : null}

        {lienInvitation ? (
          <Pressable style={styles.boutonPrincipal} onPress={partagerLien}>
            <Text style={styles.boutonPrincipalTexte}>Partager le lien</Text>
          </Pressable>
        ) : null}

        <Pressable style={styles.boutonSecondaire} onPress={() => router.replace('/(tabs)/accueil')}>
          <Text style={styles.boutonSecondaireTexte}>Continuer vers Dualia →</Text>
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
  lienBox: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.lg,
  },
  lienTexte: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.vertProfond },
});