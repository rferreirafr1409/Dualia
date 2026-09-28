// components/DemandesEnAttente.tsx
//
// La porte d'entree de l'espace familial.
//
// Un lien d'invitation ne fait plus entrer personne a lui seul. Il ouvre une
// DEMANDE : la personne presente le code recu par un autre canal, puis
// attend. C'est ici que le parent voit qui frappe — nom et adresse e-mail —
// et decide.
//
// Sans cet ecran, la demande resterait invisible et le co-parent attendrait
// indefiniment. Il est donc pose sur l'accueil, la page que l'on voit a
// chaque ouverture, et non dans un reglage qu'il faudrait penser a aller
// chercher.

import React from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../constants/supabase';
import { useStore } from '../store/useStore';
import { COLORS, SPACING, FONTS, RADIUS } from '../constants/theme';

type Demande = {
  invitation_id: string;
  nom: string | null;
  email: string | null;
  demande_le: string;
};

export default function DemandesEnAttente() {
  const sessionActive = useStore((s) => s.sessionActive);
  const familleId = useStore((s) => s.familleId);
  const [demandes, setDemandes] = React.useState<Demande[]>([]);
  const [enCours, setEnCours] = React.useState<string | null>(null);
  const [erreur, setErreur] = React.useState<string | null>(null);

  const charger = React.useCallback(async () => {
    if (sessionActive === false || !familleId) return;
    // Limite a l'espace affiche : la fonction couvrait tous les espaces du
    // compte, et la carte annonçait « demande d'acces a VOTRE espace »
    // sans dire lequel. Accepter sans savoir de quel espace il s'agit,
    // c'est exactement ce que le code et la validation doivent empecher.
    const { data, error } = await supabase.rpc('demandes_en_attente', {
      p_famille_id: familleId,
    });
    if (error) {
      console.error('[Dualia] Lecture des demandes en attente :', error);
      return;
    }
    setDemandes((data as Demande[]) ?? []);
  }, [sessionActive, familleId]);

  React.useEffect(() => {
    charger();
    // Une demande peut arriver pendant que l'ecran est ouvert : le
    // co-parent n'a aucune raison d'attendre le prochain rechargement.
    const minuteur = setInterval(charger, 30000);
    return () => clearInterval(minuteur);
  }, [charger]);

  const repondre = async (invitationId: string, accepter: boolean) => {
    setEnCours(invitationId);
    setErreur(null);
    const { error } = await supabase.rpc('repondre_demande', {
      p_invitation: invitationId,
      p_accepter: accepter,
    });
    if (error) {
      setErreur("La réponse n'a pas pu être enregistrée. Réessayez.");
      setEnCours(null);
      return;
    }
    // Acceptation : le co-parent vient d'etre cree cote serveur. On recharge
    // l'espace pour le voir apparaitre plutot que de deviner son etat.
    if (accepter) await useStore.getState().chargerEspaceFamilial(familleId!);
    await charger();
    setEnCours(null);
  };

  if (demandes.length === 0) return null;

  return (
    <View style={styles.bloc}>
      {demandes.map((d) => (
        <View key={d.invitation_id} style={styles.carte}>
          <Text style={styles.titre}>Demande d'accès à votre espace</Text>
          <Text style={styles.identite} numberOfLines={2}>
            {d.nom || 'Sans nom'}
            {d.email ? ` — ${d.email}` : ''}
          </Text>
          <Text style={styles.avertissement}>
            Cette personne a le lien et le code. Acceptez seulement si vous reconnaissez ce nom et
            cette adresse : elle aura accès aux messages, aux dépenses et aux documents.
          </Text>

          {erreur ? <Text style={styles.erreur}>{erreur}</Text> : null}

          {enCours === d.invitation_id ? (
            <ActivityIndicator size="small" color={COLORS.vert} style={{ marginTop: SPACING.sm }} />
          ) : (
            <View style={styles.actions}>
              <Pressable style={styles.btnRefuser} onPress={() => repondre(d.invitation_id, false)}>
                <Text style={styles.btnRefuserTxt}>Refuser</Text>
              </Pressable>
              <Pressable style={styles.btnAccepter} onPress={() => repondre(d.invitation_id, true)}>
                <Text style={styles.btnAccepterTxt}>Accepter</Text>
              </Pressable>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { marginBottom: SPACING.md },
  carte: {
    backgroundColor: COLORS.blanc, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: COLORS.terracotta,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  titre: {
    fontFamily: FONTS.displaySemibold, fontSize: 14,
    color: COLORS.vertProfond, marginBottom: 2,
  },
  identite: {
    fontFamily: FONTS.bodySemibold, fontSize: 14,
    color: COLORS.vertProfond, marginBottom: SPACING.xs,
  },
  avertissement: {
    fontFamily: FONTS.body, fontSize: 11, color: COLORS.ardoise, lineHeight: 16,
  },
  erreur: {
    fontFamily: FONTS.body, fontSize: 11, color: COLORS.erreur, marginTop: SPACING.xs,
  },
  actions: {
    flexDirection: 'row', gap: SPACING.sm,
    justifyContent: 'flex-end', marginTop: SPACING.md,
  },
  btnRefuser: {
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.ardoise,
  },
  btnRefuserTxt: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise },
  btnAccepter: {
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md, backgroundColor: COLORS.vert,
  },
  btnAccepterTxt: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.blanc, fontWeight: '600' },
});
