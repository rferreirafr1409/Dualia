// app/(tabs)/famille.tsx
//
// "Famille" répond à UNE question : qui compose ma famille, et quelles
// sont les informations essentielles de mes enfants ? Pas "où puis-je
// trouver toutes les fonctions de Dualia ?".
//
// Documents, Administratif (CAF) et Agenda scolaire ont désormais leur
// propre porte d'entrée (barre de navigation / fiche enfant filtrée) et ne
// sont plus dupliqués ici — une information, une seule source, plusieurs
// chemins pour y accéder. Chaque enfant ouvre sa fiche "L'Essentiel"
// (app/enfant/[id].tsx), qui elle-même renvoie vers Documents/Agenda/
// Journal filtrés plutôt que de recréer un second système de stockage.

import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { differenceInYears, parseISO } from 'date-fns';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStore } from '../../store/useStore';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS, FONTS } from '../../constants/theme';
import { TRADUCTIONS } from '../../constants/i18n';
import type { ParentRole } from '../../types';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function parentDuJour(date: Date, evs: { dateDebut: string; dateFin: string; parentId: ParentRole }[]): ParentRole | null {
  for (const ev of evs) {
    const debut = new Date(ev.dateDebut);
    const fin = new Date(ev.dateFin);
    if (date >= debut && date <= fin) return ev.parentId;
  }
  return null;
}

// Libellés de l'entrée « Mon compte ». Gardés ici plutôt que dans i18n.ts
// pour ne pas alourdir un fichier de 2 700 lignes avec deux chaînes.
const LIBELLES_COMPTE: Record<'fr' | 'pt' | 'es' | 'en', { titre: string; desc: string }> = {
  fr: { titre: 'Mon compte', desc: 'Double authentification et déconnexion' },
  pt: { titre: 'A minha conta', desc: 'Dupla autenticação e terminar sessão' },
  es: { titre: 'Mi cuenta', desc: 'Doble autenticación y cerrar sesión' },
  en: { titre: 'My account', desc: 'Two-factor authentication and sign out' },
};

export default function FamilleScreen() {
  const router = useRouter();
  const langue = useStore((s) => s.langue);
  const enfants = useStore((s) => s.enfants);
  const evenements = useStore((s) => s.evenements);
  const parents = useStore((s) => s.parents);
  const t = TRADUCTIONS[langue].famille;

  const roleAujourdhui = parentDuJour(new Date(), evenements);
  const nomChezQui = roleAujourdhui ? parents[roleAujourdhui]?.nom.split(' ')[0] : null;

  const age = (dateNaissance?: string) => {
    if (!dateNaissance) return null;
    return differenceInYears(new Date(), parseISO(dateNaissance));
  };

  // Organisation familiale : uniquement ce qui n'a pas déjà de porte
  // d'entrée ailleurs dans l'app. Documents, CAF/Droits & démarches et
  // Agenda scolaire ont volontairement quitté cette liste.
  const espaceFamilial: { icone: IoniconName; couleur: string; fond: string; titre: string; desc: string; route: string }[] = [
    { icone: 'home-outline', couleur: COLORS.vert, fond: '#EEF4F1', titre: 'Parents & foyers', desc: 'Qui compose votre famille, et où vivent vos enfants', route: '/parents-foyers' },
    { icone: 'shield-checkmark-outline', couleur: COLORS.vertProfond, fond: '#E8ECEB', titre: t.cadreFamilial, desc: t.cadreFamilialDesc, route: '/validation-cadre' },
    { icone: 'people-outline', couleur: COLORS.terracotta, fond: '#F3E9E4', titre: t.accesTiers, desc: t.accesTiersDesc, route: '/acces-tiers' },
    // Mon compte : double authentification et déconnexion. L'écran existait
    // déjà mais n'était lié depuis nulle part — ni la 2FA ni la déconnexion
    // n'étaient donc atteignables par un parent.
    {
      icone: 'lock-closed-outline',
      couleur: COLORS.vertProfond,
      fond: '#E8ECEB',
      titre: LIBELLES_COMPTE[langue].titre,
      desc: LIBELLES_COMPTE[langue].desc,
      route: '/securite-compte',
    },
  ];

  return (
    <SafeAreaView style={styles.conteneur} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitre}>{t.titre}</Text>
        <Text style={styles.headerSous}>{t.sousTitre}</Text>
        {nomChezQui ? <Text style={styles.chezQui}>{t.aujourdhuiChez(nomChezQui)}</Text> : null}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {enfants.length === 0 ? (
          // Redirige vers /famille lui-même (pas /enfants, écran retiré de
          // la navigation) : évite un lien mort. L'ajout d'un enfant se
          // fait aujourd'hui depuis ailleurs dans l'app — voir avec
          // Ricardo si un formulaire d'ajout doit être intégré ici
          // directement, en modal.
          <Pressable style={styles.videCard} onPress={() => router.push('/famille' as any)}>
            <Text style={styles.videTxt}>{t.aucunEnfant}</Text>
            <Text style={styles.videCta}>{t.ajouterEnfantCta}</Text>
          </Pressable>
        ) : (
          enfants.map((e) => {
            const ansEnfant = age(e.dateNaissance);
            return (
              <Pressable key={e.id} style={styles.enfantCard} onPress={() => router.push(`/enfant/${e.id}` as any)}>
                <View style={styles.enfantHeader}>
                  <View style={styles.avatar}>
                    {e.photoUrl ? (
                      <Image source={{ uri: e.photoUrl }} style={styles.avatarPhoto} />
                    ) : (
                      <Text style={styles.avatarTxt}>{e.prenom.charAt(0).toUpperCase()}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.enfantPrenom}>{e.prenom}</Text>
                    {ansEnfant !== null ? (
                      <Text style={styles.enfantAge}>{ansEnfant} {langue === 'pt' ? 'anos' : 'ans'}</Text>
                    ) : null}
                    <Text style={styles.enfantSousTitre}>{t.sante} · {t.sonHistoire}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.ardoise} />
                </View>
              </Pressable>
            );
          })
        )}

        <Text style={styles.sectionLabel}>{t.notreFamille}</Text>
        {espaceFamilial.map((item) => (
          <Pressable key={item.route} style={styles.ligne} onPress={() => router.push(item.route as any)}>
            <View style={[styles.iconWrap, { backgroundColor: item.fond }]}>
              <Ionicons name={item.icone} size={20} color={item.couleur} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ligneTitre}>{item.titre}</Text>
              <Text style={styles.ligneDesc}>{item.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.ardoise} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: COLORS.ivoire },
  header: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.lg, paddingBottom: SPACING.lg },
  headerTitre: { fontFamily: FONTS.display, fontSize: 24, color: COLORS.vertProfond },
  headerSous: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, marginTop: 3 },
  chezQui: { fontFamily: FONTS.bodySemibold, fontSize: 13, color: COLORS.vert, marginTop: 6 },

  scrollContent: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxxl },

  videCard: {
    backgroundColor: COLORS.blanc, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.bordure,
    borderStyle: 'dashed', padding: SPACING.xl, alignItems: 'center', marginBottom: SPACING.lg,
  },
  videTxt: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.ardoise, marginBottom: SPACING.sm },
  videCta: { fontFamily: FONTS.bodySemibold, fontSize: 14, color: COLORS.vert },

  enfantCard: {
    backgroundColor: COLORS.blanc, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  enfantHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.vert,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarPhoto: { width: '100%', height: '100%' },
  avatarTxt: { fontFamily: FONTS.bodyBold, fontSize: 17, color: COLORS.blanc },
  enfantPrenom: { fontSize: TYPOGRAPHY.lg, fontWeight: TYPOGRAPHY.semibold, color: COLORS.texte },
  enfantAge: { fontSize: TYPOGRAPHY.xs, color: COLORS.ardoise, marginTop: 1 },
  enfantSousTitre: { fontSize: TYPOGRAPHY.xs, color: COLORS.vert, marginTop: 3 },

  sectionLabel: {
    fontFamily: FONTS.bodySemibold, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase',
    color: COLORS.ardoise, marginTop: SPACING.lg, marginBottom: SPACING.sm, marginLeft: SPACING.xs,
  },

  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: RADIUS.md,
    alignItems: 'center', justifyContent: 'center',
  },
  ligneTitre: { fontSize: TYPOGRAPHY.md, fontWeight: TYPOGRAPHY.semibold, color: COLORS.texte },
  ligneDesc: { fontSize: TYPOGRAPHY.xs, color: COLORS.ardoise, marginTop: 2 },
});