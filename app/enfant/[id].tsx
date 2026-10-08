// app/enfant/[id].tsx
//
// La fiche "L'Essentiel" d'un enfant : porte d'entrée par la personne,
// complémentaire à la barre de navigation qui reste la porte d'entrée par
// fonction. Chaque section (Santé, École, Son histoire) montre l'essentiel
// directement ici, mais renvoie vers le module propriétaire (Documents,
// Agenda, Journal) pour le détail plutôt que de le dupliquer — une
// information, une seule source, plusieurs chemins pour y accéder.

import { useState } from 'react';
import { ActivityIndicator, View, Text, StyleSheet, ScrollView, Pressable, Image, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { differenceInYears, parseISO } from 'date-fns';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../../store/useStore';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, FONTS } from '../../constants/theme';
import { TRADUCTIONS } from '../../constants/i18n';
import { retour } from '../../lib/navigation';
import { confirmer, alerter } from '../../lib/dialogue';
import { ModaleEnfant, ModaleContactUrgence } from '../../components/ModalesEnfant';

export default function FicheEnfantScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].ficheEnfant;
  const enfants = useStore((s) => s.enfants);
  const chargementInitial = useStore((s) => s.chargementInitial);
  const enfant = enfants.find((e) => e.id === id);

  const supprimerEnfant = useStore((s) => s.supprimerEnfant);
  const supprimerContactUrgence = useStore((s) => s.supprimerContactUrgence);
  const tEnfants = TRADUCTIONS[langue].enfants;

  const appeler = (numero: string) => {
    Linking.openURL(`tel:${numero.replace(/\s+/g, '')}`).catch(() => {});
  };

  const [modaleEnfant, setModaleEnfant] = useState(false);
  const [modaleContact, setModaleContact] = useState(false);

  // Les contacts viennent du store, pas d'une requete a part.
  //
  // Cet ecran les relisait sur le reseau a chaque ouverture, et ne
  // distinguait pas « aucun contact » d'une requete echouee : hors ligne,
  // la fiche annoncait « aucun contact » alors que l'application les
  // connaissait. Ils sont maintenant lus la ou ils sont deja chargés — ce
  // qui les fait aussi apparaitre immediatement apres un ajout.
  const contacts = enfant?.contactsUrgence ?? [];


  // Fiche introuvable : ouverture directe de l'URL avant que le store soit
  // chargé, chargement des enfants en échec, ou enfant supprimé depuis
  // l'appareil de l'autre parent. L'écran n'affichait alors RIEN — un fond
  // ivoire et un chevron, sans un mot. Et sur une ouverture directe, ce
  // chevron ne faisait rien non plus, faute d'historique.
  // Tant que l'espace familial charge, « introuvable » est faux : c'est
  // « pas encore ». Sans ce test, ouvrir la fiche directement affichait
  // « Cette fiche n'est pas disponible » puis basculait sur la vraie
  // fiche — un clignotement qui dit l'inverse de ce qu'on veut dire.
  if (!enfant && chargementInitial) {
    return (
      <SafeAreaView style={styles.conteneur} edges={['bottom']}>
        <View style={styles.introuvableBloc}>
          <ActivityIndicator size="large" color={COLORS.vert} />
        </View>
      </SafeAreaView>
    );
  }

  if (!enfant) {
    return (
      <SafeAreaView style={styles.conteneur} edges={['bottom']}>
        <Pressable onPress={() => retour(router, '/(tabs)/famille')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.vertProfond} />
        </Pressable>
        <View style={styles.introuvableBloc}>
          <Text style={styles.introuvableTitre}>Cette fiche n'est pas disponible</Text>
          <Text style={styles.introuvableTexte}>
            L'enfant a peut-être été retiré de votre espace, ou la page a été ouverte avant le
            chargement de vos données.
          </Text>
          <Pressable
            style={styles.introuvableBouton}
            onPress={() => router.replace('/(tabs)/famille' as any)}
          >
            <Text style={styles.introuvableBoutonTexte}>Retour à Famille</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const age = enfant.dateNaissance ? differenceInYears(new Date(), parseISO(enfant.dateNaissance)) : null;

  return (
    <SafeAreaView style={styles.conteneur} edges={['bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => retour(router, '/(tabs)/famille')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.vertProfond} />
        </Pressable>
        {/* Modifier et supprimer vivaient sur un autre ecran, qui affichait
            trois fois moins d'informations que celui-ci. Ils sont a leur
            place : sur la fiche de l'enfant concerne. */}
        <View style={styles.actionsEntete}>
          <Pressable onPress={() => setModaleEnfant(true)} style={styles.actionBtn}>
            <Ionicons name="create-outline" size={20} color={COLORS.vert} />
          </Pressable>
          <Pressable
            style={styles.actionBtn}
            onPress={async () => {
              const accepte = await confirmer(
                tEnfants.supprimer, tEnfants.confirmerSuppressionEnfant,
                tEnfants.supprimer, tEnfants.annuler, true
              );
              if (!accepte) return;
              const supprime = await supprimerEnfant(enfant.id);
              if (!supprime) {
                alerter(tEnfants.supprimer, t.suppressionRefusee);
                return;
              }
              retour(router, '/(tabs)/famille');
            }}
          >
            <Ionicons name="trash-outline" size={20} color={COLORS.erreur} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.enteteEnfant}>
          <View style={styles.avatar}>
            {enfant.photoUrl ? (
              <Image source={{ uri: enfant.photoUrl }} style={styles.avatarPhoto} />
            ) : (
              <Text style={styles.avatarTxt}>{enfant.prenom.charAt(0).toUpperCase()}</Text>
            )}
          </View>
          <Text style={styles.prenom}>{enfant.prenom}</Text>
          {age !== null ? <Text style={styles.age}>{age} {langue === 'pt' ? 'anos' : langue === 'es' ? 'años' : langue === 'en' ? 'yrs' : 'ans'}</Text> : null}
        </View>

        <Text style={styles.sectionLabel}>{t.essentiel}</Text>

        {/* Santé */}
        <View style={styles.carte}>
          <View style={styles.carteHeader}>
            <Ionicons name="medkit-outline" size={18} color={COLORS.terracotta} />
            <Text style={styles.carteTitre}>{t.santeTitre}</Text>
          </View>
          {enfant.medecinTraitant ? (
            <View style={styles.ligneInfo}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ligneLabel}>{t.medecinTraitant}</Text>
                <Text style={styles.ligneValeur}>{enfant.medecinTraitant}</Text>
              </View>
              {enfant.medecinTelephone ? (
                <Pressable onPress={() => appeler(enfant.medecinTelephone!)} style={styles.appelBtn}>
                  <Ionicons name="call-outline" size={14} color={COLORS.blanc} />
                  <Text style={styles.appelBtnTxt}>{t.appeler}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <View style={styles.ligneInfo}>
            <Text style={styles.ligneLabel}>{t.allergiesLabel}</Text>
            <Text style={styles.ligneValeur}>{enfant.allergies || t.aucuneAllergie}</Text>
          </View>
          {enfant.groupeSanguin ? (
            <View style={styles.ligneInfo}>
              <Text style={styles.ligneLabel}>{t.groupeSanguinLabel}</Text>
              <Text style={styles.ligneValeur}>{enfant.groupeSanguin}</Text>
            </View>
          ) : null}
          {enfant.mutuelle ? (
            <View style={styles.ligneInfo}>
              <Text style={styles.ligneLabel}>{t.mutuelleLabel}</Text>
              <Text style={styles.ligneValeur}>{enfant.mutuelle}</Text>
            </View>
          ) : null}
          <Pressable onPress={() => router.push({ pathname: '/documents', params: { enfant: enfant.id, categorie: 'sante' } } as any)}>
            <Text style={styles.lienTexte}>{t.documentsAssocies}</Text>
          </Pressable>
        </View>

        {/* École */}
        <View style={styles.carte}>
          <View style={styles.carteHeader}>
            <Ionicons name="school-outline" size={18} color={COLORS.vert} />
            <Text style={styles.carteTitre}>{t.ecoleTitre}</Text>
          </View>
          <View style={styles.ligneInfo}>
            <Text style={styles.ligneLabel}>{t.etablissementLabel}</Text>
            <Text style={styles.ligneValeur}>{enfant.ecole || t.aucunEtablissement}</Text>
          </View>
          <Pressable onPress={() => router.push({ pathname: '/agenda-scolaire', params: { enfant: enfant.id } } as any)}>
            <Text style={styles.lienTexte}>{t.voirAgenda}</Text>
          </Pressable>
        </View>

        {/* Contacts d'urgence */}
        <View style={styles.carte}>
          <View style={styles.carteHeader}>
            <Ionicons name="alert-circle-outline" size={18} color={COLORS.or} />
            <Text style={styles.carteTitre}>{t.contactsTitre}</Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={() => setModaleContact(true)} style={styles.actionBtn}>
              <Ionicons name="add-circle-outline" size={20} color={COLORS.terracotta} />
            </Pressable>
          </View>
          {contacts.length === 0 ? (
            <Text style={styles.videTxt}>{t.aucunContact}</Text>
          ) : (
            contacts.map((c) => (
              <View key={c.id} style={styles.ligneInfo}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ligneValeur}>{c.nom}</Text>
                  <Text style={styles.ligneLabel}>
                    {c.relation ? `${c.relation} · ${c.telephone}` : c.telephone}
                  </Text>
                </View>
                <Pressable onPress={() => appeler(c.telephone)} style={styles.appelBtn}>
                  <Ionicons name="call-outline" size={14} color={COLORS.blanc} />
                  <Text style={styles.appelBtnTxt}>{t.appeler}</Text>
                </Pressable>
                <Pressable
                  style={styles.actionBtn}
                  onPress={async () => {
                    const accepte = await confirmer(
                      tEnfants.supprimer, tEnfants.confirmerSuppressionContact,
                      tEnfants.supprimer, tEnfants.annuler, true
                    );
                    if (accepte) supprimerContactUrgence(c.id);
                  }}
                >
                  <Ionicons name="trash-outline" size={16} color={COLORS.ardoise} />
                </Pressable>
              </View>
            ))
          )}
        </View>

        {/* Journal */}
        <Pressable
          style={styles.ligneNav}
          onPress={() => router.push({ pathname: '/fil-de-vie', params: { enfant: enfant.id } } as any)}
        >
          <View style={[styles.iconWrap, { backgroundColor: '#FBF3DF' }]}>
            <Ionicons name="images-outline" size={20} color={COLORS.or} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ligneNavTitre}>{t.journalTitre}</Text>
            <Text style={styles.ligneNavDesc}>{t.journalDesc}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.ardoise} />
        </Pressable>

        {/* Son histoire */}
        <Pressable
          style={styles.ligneNav}
          onPress={() => router.push({ pathname: '/enfant-histoire', params: { prenom: enfant.prenom } } as any)}
        >
          <View style={[styles.iconWrap, { backgroundColor: '#E8F0EB' }]}>
            <Ionicons name="book-outline" size={20} color={COLORS.vert} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ligneNavTitre}>{t.histoireTitre}</Text>
            <Text style={styles.ligneNavDesc}>{t.histoireDesc}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.ardoise} />
        </Pressable>

        {/* Personnes autorisées */}
        <Pressable style={styles.ligneNav} onPress={() => router.push('/acces-tiers' as any)}>
          <View style={[styles.iconWrap, { backgroundColor: '#F3E9E4' }]}>
            <Ionicons name="people-outline" size={20} color={COLORS.terracotta} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ligneNavTitre}>{t.personnesAutoriseesTitre}</Text>
            <Text style={styles.ligneNavDesc}>{t.personnesAutoriseesDesc(enfant.prenom)}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={COLORS.ardoise} />
        </Pressable>
      </ScrollView>
      <ModaleEnfant
        visible={modaleEnfant}
        enfant={enfant}
        onFermer={() => setModaleEnfant(false)}
      />
      <ModaleContactUrgence
        visible={modaleContact}
        enfantId={enfant.id}
        onFermer={() => setModaleContact(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actionsEntete: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  actionBtn: { padding: SPACING.xs },
  introuvableBloc: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl,
  },
  introuvableTitre: {
    fontFamily: FONTS.display, fontSize: 19, color: COLORS.vertProfond,
    marginBottom: SPACING.sm, textAlign: 'center',
  },
  introuvableTexte: {
    fontFamily: FONTS.body, fontSize: 13.5, lineHeight: 20,
    color: COLORS.ardoise, textAlign: 'center',
  },
  introuvableBouton: {
    backgroundColor: COLORS.vert, borderRadius: RADIUS.md,
    paddingVertical: 13, paddingHorizontal: SPACING.xl, marginTop: SPACING.xl,
  },
  introuvableBoutonTexte: {
    fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.blanc,
  },
  conteneur: { flex: 1, backgroundColor: COLORS.ivoire },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.sm,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  content: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl },

  enteteEnfant: { alignItems: 'center', marginBottom: SPACING.lg },
  avatar: {
    width: 68, height: 68, borderRadius: 34, backgroundColor: COLORS.vert,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: SPACING.sm,
  },
  avatarPhoto: { width: '100%', height: '100%' },
  avatarTxt: { fontFamily: FONTS.bodyBold, fontSize: 26, color: COLORS.blanc },
  prenom: { fontFamily: FONTS.display, fontSize: 22, color: COLORS.vertProfond },
  age: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise, marginTop: 2 },

  sectionLabel: {
    fontFamily: FONTS.bodySemibold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase',
    color: COLORS.ardoise, marginBottom: SPACING.sm, marginLeft: SPACING.xs,
  },

  carte: {
    backgroundColor: COLORS.blanc, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  carteHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: SPACING.sm },
  carteTitre: { fontSize: TYPOGRAPHY.md, fontWeight: TYPOGRAPHY.semibold, color: COLORS.texte },

  ligneInfo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.bordure,
  },
  ligneLabel: { fontSize: TYPOGRAPHY.xs, color: COLORS.ardoise },
  ligneValeur: { fontSize: TYPOGRAPHY.sm, color: COLORS.texte, fontWeight: TYPOGRAPHY.medium, marginTop: 1 },
  videTxt: { fontSize: TYPOGRAPHY.sm, color: COLORS.ardoise, paddingVertical: 6 },

  appelBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.vert,
    borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 6,
  },
  appelBtnTxt: { fontSize: 11.5, fontWeight: TYPOGRAPHY.semibold, color: COLORS.blanc },

  lienTexte: { fontSize: TYPOGRAPHY.sm, fontWeight: TYPOGRAPHY.semibold, color: COLORS.vert, marginTop: SPACING.sm },

  ligneNav: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md, backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  iconWrap: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  ligneNavTitre: { fontSize: TYPOGRAPHY.md, fontWeight: TYPOGRAPHY.semibold, color: COLORS.texte },
  ligneNavDesc: { fontSize: TYPOGRAPHY.xs, color: COLORS.ardoise, marginTop: 2 },
});