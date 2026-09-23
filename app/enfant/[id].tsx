// app/enfant/[id].tsx
//
// La fiche "L'Essentiel" d'un enfant : porte d'entrée par la personne,
// complémentaire à la barre de navigation qui reste la porte d'entrée par
// fonction. Chaque section (Santé, École, Son histoire) montre l'essentiel
// directement ici, mais renvoie vers le module propriétaire (Documents,
// Agenda, Journal) pour le détail plutôt que de le dupliquer — une
// information, une seule source, plusieurs chemins pour y accéder.

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { differenceInYears, parseISO } from 'date-fns';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../../store/useStore';
import { supabase } from '../../constants/supabase';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, FONTS } from '../../constants/theme';
import { TRADUCTIONS } from '../../constants/i18n';

type ContactUrgence = { id: string; nom: string; relation: string | null; telephone: string };

export default function FicheEnfantScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].ficheEnfant;
  const tFamille = TRADUCTIONS[langue].famille;
  const enfants = useStore((s) => s.enfants);
  const enfant = enfants.find((e) => e.id === id);

  const [contacts, setContacts] = useState<ContactUrgence[]>([]);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('contacts_urgence')
      .select('id, nom, relation, telephone')
      .eq('enfant_id', id)
      .order('priorite', { ascending: true })
      .then(({ data }) => setContacts(data ?? []));
  }, [id]);

  if (!enfant) {
    return (
      <SafeAreaView style={styles.conteneur} edges={['top', 'bottom']}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.vertProfond} />
        </Pressable>
      </SafeAreaView>
    );
  }

  const age = enfant.dateNaissance ? differenceInYears(new Date(), parseISO(enfant.dateNaissance)) : null;

  return (
    <SafeAreaView style={styles.conteneur} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.vertProfond} />
        </Pressable>
        <View style={{ width: 32 }} />
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
                <Pressable onPress={() => Linking.openURL(`tel:${enfant.medecinTelephone}`)} style={styles.appelBtn}>
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
          </View>
          {contacts.length === 0 ? (
            <Text style={styles.videTxt}>{t.aucunContact}</Text>
          ) : (
            contacts.map((c) => (
              <View key={c.id} style={styles.ligneInfo}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.ligneValeur}>{c.nom}</Text>
                  {c.relation ? <Text style={styles.ligneLabel}>{c.relation}</Text> : null}
                </View>
                <Pressable onPress={() => Linking.openURL(`tel:${c.telephone}`)} style={styles.appelBtn}>
                  <Ionicons name="call-outline" size={14} color={COLORS.blanc} />
                  <Text style={styles.appelBtnTxt}>{t.appeler}</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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