// app/espace-tiers.tsx
//
// L'espace d'un tiers : nounou, grand-parent, établissement scolaire.
//
// Volontairement pauvre. Cet écran ne construit rien : il affiche ce que la
// base a bien voulu rendre, et les règles serveur ne rendent que les enfants
// rattachés, leurs informations utiles, leurs contacts d'urgence et les
// créneaux où ce tiers est désigné. Si une règle change, l'écran se vide tout
// seul — il n'y a aucune vérification côté client à contourner.
//
// Le bandeau du haut dit ce que le tiers voit ET ce qu'il ne voit pas. Une
// nounou doit pouvoir répondre « non, je n'ai pas accès à ça » sans avoir à
// le deviner.

import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Platform, Linking, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../constants/supabase';
import { useStore } from '../store/useStore';
import { depuisJourLocal } from '../lib/dates';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import type { Enfant, EvenementGarde } from '../types';

type Libelles = {
  roles: Record<string, string>;
  bonjour: (nom: string) => string;
  accesPartage: string;
  accesDonnePar: (nom: string) => string;
  bandeau: string;
  prochainsCreneaux: string;
  aucunCreneau: string;
  enfantsConfies: string;
  enfantConfie: string;
  aucunEnfant: string;
  contactsUrgence: string;
  groupe: (g: string) => string;
  ans: (n: number) => string;
  chargement: string;
  aucunAccesTitre: string;
  aucunAccesTexte: string;
  seDeconnecter: string;
  locale: string;
};

const LIBELLES: Record<string, Libelles> = {
  fr: {
    roles: { grand_parent: 'Grand-parent', nounou: 'Garde d’enfants', ecole_tiers: 'Établissement scolaire' },
    bonjour: (nom) => `Bonjour ${nom}`,
    accesPartage: 'Accès partagé',
    accesDonnePar: (nom) => ` · accès donné par ${nom}`,
    bandeau:
      'Vous voyez uniquement les enfants qui vous sont confiés et les créneaux où vous êtes désigné. Les messages entre les parents, les dépenses et les documents de la famille ne vous sont pas accessibles.',
    prochainsCreneaux: 'Prochains créneaux',
    aucunCreneau: 'Aucun créneau prévu pour le moment. Le parent vous désignera depuis son agenda.',
    enfantsConfies: 'Les enfants qui vous sont confiés',
    enfantConfie: 'L’enfant qui vous est confié',
    aucunEnfant: 'Aucun enfant rattaché à votre accès.',
    contactsUrgence: 'Contacts d’urgence',
    groupe: (g) => `Groupe ${g}`,
    ans: (n) => `${n} ans`,
    chargement: 'Chargement…',
    aucunAccesTitre: 'Aucun accès actif',
    aucunAccesTexte:
      'Votre accès a été retiré, ou ce compte n’a pas encore été rattaché à un accès. Demandez un nouveau lien au parent concerné.',
    seDeconnecter: 'Se déconnecter',
    locale: 'fr-FR',
  },
  pt: {
    roles: { grand_parent: 'Avô ou avó', nounou: 'Ama', ecole_tiers: 'Estabelecimento escolar' },
    bonjour: (nom) => `Olá ${nom}`,
    accesPartage: 'Acesso partilhado',
    accesDonnePar: (nom) => ` · acesso dado por ${nom}`,
    bandeau:
      'Vê apenas as crianças que lhe são confiadas e os períodos em que está designado. As mensagens entre os pais, as despesas e os documentos da família não lhe são acessíveis.',
    prochainsCreneaux: 'Próximos períodos',
    aucunCreneau: 'Nenhum período previsto de momento. O progenitor designá-lo-á a partir da sua agenda.',
    enfantsConfies: 'As crianças que lhe são confiadas',
    enfantConfie: 'A criança que lhe é confiada',
    aucunEnfant: 'Nenhuma criança associada ao seu acesso.',
    contactsUrgence: 'Contactos de emergência',
    groupe: (g) => `Grupo ${g}`,
    ans: (n) => `${n} anos`,
    chargement: 'A carregar…',
    aucunAccesTitre: 'Nenhum acesso ativo',
    aucunAccesTexte:
      'O seu acesso foi retirado, ou esta conta ainda não foi associada a um acesso. Peça uma nova ligação ao progenitor em causa.',
    seDeconnecter: 'Terminar sessão',
    locale: 'pt-PT',
  },
  es: {
    roles: { grand_parent: 'Abuelo o abuela', nounou: 'Cuidado de niños', ecole_tiers: 'Centro escolar' },
    bonjour: (nom) => `Hola ${nom}`,
    accesPartage: 'Acceso compartido',
    accesDonnePar: (nom) => ` · acceso dado por ${nom}`,
    bandeau:
      'Solo ves los niños que te confían y los turnos en los que estás designado. Los mensajes entre los progenitores, los gastos y los documentos de la familia no te son accesibles.',
    prochainsCreneaux: 'Próximos turnos',
    aucunCreneau: 'Ningún turno previsto por ahora. El progenitor te designará desde su agenda.',
    enfantsConfies: 'Los niños que te confían',
    enfantConfie: 'El niño que te confían',
    aucunEnfant: 'Ningún niño vinculado a tu acceso.',
    contactsUrgence: 'Contactos de emergencia',
    groupe: (g) => `Grupo ${g}`,
    ans: (n) => `${n} años`,
    chargement: 'Cargando…',
    aucunAccesTitre: 'Ningún acceso activo',
    aucunAccesTexte:
      'Tu acceso ha sido retirado, o esta cuenta aún no se ha vinculado a un acceso. Pide un nuevo enlace al progenitor correspondiente.',
    seDeconnecter: 'Cerrar sesión',
    locale: 'es-ES',
  },
  en: {
    roles: { grand_parent: 'Grandparent', nounou: 'Childminder', ecole_tiers: 'School' },
    bonjour: (nom) => `Hello ${nom}`,
    accesPartage: 'Shared access',
    accesDonnePar: (nom) => ` · access given by ${nom}`,
    bandeau:
      'You only see the children entrusted to you and the time slots you are assigned to. Messages between the parents, expenses and family documents are not accessible to you.',
    prochainsCreneaux: 'Upcoming slots',
    aucunCreneau: 'No slot scheduled yet. The parent will assign you from their calendar.',
    enfantsConfies: 'The children entrusted to you',
    enfantConfie: 'The child entrusted to you',
    aucunEnfant: 'No child linked to your access.',
    contactsUrgence: 'Emergency contacts',
    groupe: (g) => `Blood type ${g}`,
    ans: (n) => `${n} years old`,
    chargement: 'Loading…',
    aucunAccesTitre: 'No active access',
    aucunAccesTexte:
      'Your access has been withdrawn, or this account is not linked to an access yet. Ask the relevant parent for a new link.',
    seDeconnecter: 'Sign out',
    locale: 'en-GB',
  },
};

function formatCreneau(ev: EvenementGarde, locale: string): string {
  const debut = new Date(ev.dateDebut);
  const fin = new Date(ev.dateFin);
  const jour = debut.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const h = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const memeJour = debut.toDateString() === fin.toDateString();
  return memeJour
    ? `${jour}, ${h(debut)} – ${h(fin)}`
    : `${jour}, ${h(debut)} → ${fin.toLocaleDateString(locale, { day: 'numeric', month: 'long' })} ${h(fin)}`;
}

// enfants.date_naissance est une colonne `date` : new Date('2020-01-01') vaut
// minuit UTC, soit le 31 decembre 2019 pour un parent en fuseau negatif. Le
// tiers lisait alors un age different de celui affiche aux parents (qui passent
// par date-fns parseISO, lequel interprete bien la date en local).
function calculerAge(dateNaissance?: string): number | null {
  if (!dateNaissance) return null;
  const n = depuisJourLocal(dateNaissance);
  const aujourdHui = new Date();
  let age = aujourdHui.getFullYear() - n.getFullYear();
  const m = aujourdHui.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && aujourdHui.getDate() < n.getDate())) age--;
  return age >= 0 ? age : null;
}

export default function EspaceTiersScreen() {
  const router = useRouter();
  const acces = useStore((s) => s.accesTiers);
  const chargementInitial = useStore((s) => s.chargementInitial);
  const langue = useStore((s) => s.langue);
  const l = LIBELLES[langue] ?? LIBELLES.fr;
  const chargerEspaceTiers = useStore((s) => s.chargerEspaceTiers);
  const purgerDonneesFamiliales = useStore((s) => s.purgerDonneesFamiliales);
  const derniereVerification = useRef(0);

  // La révocation est immédiate côté serveur, mais un onglet resté ouvert ne
  // relit plus rien : les informations de l'enfant continueraient de s'afficher
  // depuis la mémoire. On revérifie à l'ouverture de l'écran et chaque fois que
  // l'application revient au premier plan.
  useEffect(() => {
    const verifier = () => {
      const maintenant = Date.now();
      if (maintenant - derniereVerification.current < 5000) return;
      derniereVerification.current = maintenant;
      chargerEspaceTiers();
    };

    verifier();
    const abonnement = AppState.addEventListener('change', (etat) => {
      if (etat === 'active') verifier();
    });
    return () => abonnement.remove();
  }, []);

  const seDeconnecter = async () => {
    await supabase.auth.signOut();
    // Le stockage local survit à la déconnexion : on le vide, sinon la
    // personne suivante à ouvrir ce navigateur hérite de la session.
    purgerDonneesFamiliales();
    useStore.setState({ accesTiers: null });
    router.replace('/connexion' as any);
  };

  if (chargementInitial) {
    return (
      <SafeAreaView style={styles.centre}>
        <Text style={styles.videTexte}>{l.chargement}</Text>
      </SafeAreaView>
    );
  }

  // Accès retiré pendant la session, ou compte sans accès : on le dit
  // franchement plutôt que d'afficher un écran vide sans explication.
  if (!acces) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.centre}>
          <Ionicons name="lock-closed-outline" size={32} color={COLORS.ardoise} />
          <Text style={styles.titre}>{l.aucunAccesTitre}</Text>
          <Text style={styles.videTexte}>{l.aucunAccesTexte}</Text>
          <Pressable style={styles.boutonSecondaire} onPress={seDeconnecter}>
            <Text style={styles.boutonSecondaireTexte}>{l.seDeconnecter}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const maintenant = Date.now();
  const creneauxAVenir = acces.gardes.filter((g) => new Date(g.dateFin).getTime() >= maintenant);

  const appeler = (numero: string) => {
    const url = `tel:${numero.replace(/\s/g, '')}`;
    if (Platform.OS === 'web') {
      window.location.href = url;
      return;
    }
    Linking.openURL(url);
  };

  const renderEnfant = (enfant: Enfant) => {
    const age = calculerAge(enfant.dateNaissance);
    return (
      <View key={enfant.id} style={styles.carte}>
        <View style={styles.enfantEntete}>
          <View style={styles.enfantPastille}>
            <Text style={styles.enfantInitiale}>{enfant.prenom.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.enfantPrenom}>{enfant.prenom}</Text>
            {age !== null ? <Text style={styles.enfantMeta}>{l.ans(age)}</Text> : null}
          </View>
        </View>

        {enfant.ecole ? (
          <View style={styles.infoLigne}>
            <Ionicons name="school-outline" size={15} color={COLORS.ardoise} />
            <Text style={styles.infoTexte}>{enfant.ecole}</Text>
          </View>
        ) : null}

        {/* Allergies et groupe sanguin sont en tête de ce qu'une personne qui
            garde un enfant doit savoir : on ne les enfouit pas. */}
        {enfant.allergies ? (
          <View style={[styles.infoLigne, styles.infoAlerte]}>
            <Ionicons name="warning-outline" size={15} color={COLORS.terracotta} />
            <Text style={[styles.infoTexte, styles.infoTexteAlerte]}>{enfant.allergies}</Text>
          </View>
        ) : null}

        {enfant.groupeSanguin ? (
          <View style={styles.infoLigne}>
            <Ionicons name="water-outline" size={15} color={COLORS.ardoise} />
            <Text style={styles.infoTexte}>{l.groupe(enfant.groupeSanguin)}</Text>
          </View>
        ) : null}

        {enfant.medecinTraitant ? (
          <Pressable
            style={styles.infoLigne}
            onPress={() => enfant.medecinTelephone && appeler(enfant.medecinTelephone)}
            disabled={!enfant.medecinTelephone}
          >
            <Ionicons name="medkit-outline" size={15} color={COLORS.ardoise} />
            <Text style={styles.infoTexte}>
              {enfant.medecinTraitant}
              {enfant.medecinTelephone ? ` · ${enfant.medecinTelephone}` : ''}
            </Text>
          </Pressable>
        ) : null}

        {enfant.contactsUrgence.length > 0 ? (
          <>
            <Text style={styles.sousSection}>{l.contactsUrgence}</Text>
            {enfant.contactsUrgence.map((c) => (
              <Pressable key={c.id} style={styles.contactLigne} onPress={() => appeler(c.telephone)}>
                <Ionicons name="call-outline" size={15} color={COLORS.vert} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactNom}>
                    {c.nom}
                    {c.relation ? ` · ${c.relation}` : ''}
                  </Text>
                  <Text style={styles.contactTel}>{c.telephone}</Text>
                </View>
              </Pressable>
            ))}
          </>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.entete}>
        <View style={{ flex: 1 }}>
          <Text style={styles.titre}>{l.bonjour(acces.nom)}</Text>
          <Text style={styles.sousTitre}>
            {l.roles[acces.role] ?? l.accesPartage}
            {acces.parentReferentNom ? l.accesDonnePar(acces.parentReferentNom) : ''}
          </Text>
        </View>
        <Pressable onPress={seDeconnecter} hitSlop={10} style={styles.deconnexionBtn}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.ardoise} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.contenu} showsVerticalScrollIndicator={false}>
        <View style={styles.bandeau}>
          <Ionicons name="shield-checkmark-outline" size={17} color={COLORS.vert} />
          <Text style={styles.bandeauTexte}>{l.bandeau}</Text>
        </View>

        <Text style={styles.section}>{l.prochainsCreneaux}</Text>
        {creneauxAVenir.length === 0 ? (
          <View style={styles.carteVide}>
            <Text style={styles.videTexte}>{l.aucunCreneau}</Text>
          </View>
        ) : (
          creneauxAVenir.map((g) => (
            <View key={g.id} style={styles.creneauCarte}>
              <Ionicons name="time-outline" size={17} color={COLORS.vert} />
              <View style={{ flex: 1 }}>
                <Text style={styles.creneauTexte}>{formatCreneau(g, l.locale)}</Text>
                {g.notes ? <Text style={styles.creneauNote}>{g.notes}</Text> : null}
              </View>
            </View>
          ))
        )}

        <Text style={styles.section}>
          {acces.enfants.length > 1 ? l.enfantsConfies : l.enfantConfie}
        </Text>
        {acces.enfants.length === 0 ? (
          <View style={styles.carteVide}>
            <Text style={styles.videTexte}>{l.aucunEnfant}</Text>
          </View>
        ) : (
          acces.enfants.map(renderEnfant)
        )}

        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ivoire },
  centre: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACING.xl, gap: SPACING.md, backgroundColor: COLORS.ivoire,
  },
  entete: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.md,
  },
  deconnexionBtn: { padding: SPACING.xs },
  titre: { fontFamily: FONTS.display, fontSize: 22, color: COLORS.vertProfond, textAlign: 'center' },
  sousTitre: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.ardoise, marginTop: 3 },
  contenu: { paddingHorizontal: SPACING.xl, paddingBottom: SPACING.xl },

  bandeau: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    backgroundColor: '#E8F3ED', borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg,
  },
  bandeauTexte: { flex: 1, fontFamily: FONTS.body, fontSize: 12, color: COLORS.vertProfond, lineHeight: 17 },

  section: {
    fontFamily: FONTS.bodySemibold, fontSize: 12, color: COLORS.ardoise, textTransform: 'uppercase',
    letterSpacing: 0.6, marginTop: SPACING.lg, marginBottom: SPACING.sm,
  },
  sousSection: {
    fontFamily: FONTS.bodySemibold, fontSize: 11.5, color: COLORS.ardoise,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SPACING.md, marginBottom: 4,
  },

  carte: {
    backgroundColor: COLORS.blanc, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.bordure,
    padding: SPACING.lg, marginBottom: SPACING.sm, gap: 7,
  },
  carteVide: {
    backgroundColor: COLORS.blanc, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.bordure,
    borderStyle: 'dashed', padding: SPACING.lg,
  },
  videTexte: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise, lineHeight: 18, textAlign: 'center' },

  enfantEntete: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
  enfantPastille: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.vertProfond,
    alignItems: 'center', justifyContent: 'center',
  },
  enfantInitiale: { fontFamily: FONTS.displaySemibold, fontSize: 17, color: COLORS.blanc },
  enfantPrenom: { fontFamily: FONTS.bodySemibold, fontSize: 15.5, color: COLORS.vertProfond },
  enfantMeta: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.ardoise, marginTop: 1 },

  infoLigne: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoAlerte: { backgroundColor: '#F7EEE9', borderRadius: RADIUS.md, padding: 8 },
  infoTexte: { flex: 1, fontFamily: FONTS.body, fontSize: 13, color: COLORS.vertProfond },
  infoTexteAlerte: { color: COLORS.terracotta, fontFamily: FONTS.bodySemibold },

  contactLigne: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#EEE',
  },
  contactNom: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.vertProfond },
  contactTel: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.vert, marginTop: 1 },

  creneauCarte: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: COLORS.blanc, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.bordure,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  creneauTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.vertProfond },
  creneauNote: { fontFamily: FONTS.body, fontSize: 12, color: COLORS.ardoise, marginTop: 2 },

  boutonSecondaire: {
    borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md,
    paddingVertical: 12, paddingHorizontal: SPACING.xl, marginTop: SPACING.md,
  },
  boutonSecondaireTexte: { fontFamily: FONTS.bodySemibold, fontSize: 13.5, color: COLORS.ardoise },
});
