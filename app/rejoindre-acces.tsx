// app/rejoindre-acces.tsx
//
// Page d'atterrissage du lien d'accès tiers (?token=...). Même parcours que
// rejoindre.tsx pour le second parent : on vérifie le lien AVANT la création
// du compte, puis on rattache la personne à son accès.
//
// get_invitation_tiers_info est volontairement appelable sans session : c'est
// le seul appel du parcours qui précède le compte. Elle ne renvoie jamais
// l'identifiant de l'espace familial — avant d'avoir accepté, la personne n'a
// aucune raison de le connaître.
//
// L'écran dit en clair ce que l'accès donne et ce qu'il ne donne pas. Une
// nounou qui découvre après coup qu'elle voit le carnet de santé d'un enfant,
// ou un parent qui découvre l'inverse, c'est le genre de malentendu qui coûte
// la confiance des deux côtés.
//
// Le tiers n'a pas choisi la langue de l'application : elle vient de son
// appareil. Cet écran est donc traduit comme le reste.

import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../constants/supabase';
import { useStore } from '../store/useStore';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants/theme';
import { AIDE_MOT_DE_PASSE, validerMotDePasse, traduireErreurAuth } from '../constants/motDePasse';

function alertCompat(titre: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${titre}\n\n${message}` : titre);
  } else {
    Alert.alert(titre, message);
  }
}

type Libelles = {
  roles: Record<string, string>;
  titreAvecParent: (parent: string) => string;
  titreSansParent: string;
  sousTitre: (nom: string, role: string) => string;
  verrez: string;
  verrezPas: string;
  listeVerrez: string[];
  listeVerrezPas: string[];
  email: string;
  motDePasse: string;
  activer: string;
  mentionFin: string;
  lienInvalideTitre: string;
  lienInvalideSuite: string;
  motifIncomplet: string;
  motifInexistant: string;
  motifRevoque: string;
  motifExpire: string;
  motifDejaUtilise: string;
  allerConnexion: string;
  champsIncomplets: string;
  champsIncompletsMsg: string;
  motDePasseFaible: string;
  confirmationTitre: string;
  confirmationMsg: string;
  erreur: string;
};

const LIBELLES: Record<string, Libelles> = {
  fr: {
    roles: { grand_parent: 'grand-parent', nounou: 'garde d’enfants', ecole_tiers: 'établissement scolaire' },
    titreAvecParent: (p) => `${p} vous donne accès`,
    titreSansParent: 'Vous avez reçu un accès',
    sousTitre: (nom, role) =>
      `${nom ? nom + ', ' : ''}cet accès est limité${role ? ` à votre rôle de ${role}` : ''}. Créez votre compte pour l’activer.`,
    verrez: 'Ce que vous verrez',
    verrezPas: 'Ce que vous ne verrez pas',
    listeVerrez: [
      'Les enfants qui vous sont confiés, et eux seuls',
      'Leurs informations utiles : école, allergies, groupe sanguin, médecin',
      'Leurs contacts d’urgence',
      'Les créneaux où vous êtes désigné',
    ],
    listeVerrezPas: [
      'Les messages entre les parents',
      'Les dépenses et les remboursements',
      'Les documents, le journal, les décisions',
      'L’organisation de garde de l’autre parent',
    ],
    email: 'Email',
    motDePasse: 'Mot de passe',
    activer: 'Activer mon accès',
    mentionFin: 'Le parent qui vous a invité peut retirer cet accès à tout moment.',
    lienInvalideTitre: 'Lien invalide',
    lienInvalideSuite: 'Demandez au parent qui vous a invité de vous en envoyer un nouveau depuis Dualia.',
    motifIncomplet: 'Ce lien est incomplet.',
    motifInexistant: 'Ce lien n’existe pas ou a été retiré.',
    motifRevoque: 'Cet accès a été retiré par le parent qui vous l’avait donné.',
    motifExpire: 'Ce lien a dépassé ses 14 jours de validité.',
    motifDejaUtilise: 'Ce lien a déjà servi à créer un compte.',
    allerConnexion: 'Se connecter',
    champsIncomplets: 'Champs incomplets',
    champsIncompletsMsg: 'Renseignez une adresse email.',
    motDePasseFaible: 'Mot de passe trop faible',
    confirmationTitre: 'Confirmation requise',
    confirmationMsg: 'Vérifiez votre boîte mail pour confirmer votre adresse, puis rouvrez ce lien.',
    erreur: 'Erreur',
  },
  pt: {
    roles: { grand_parent: 'avô ou avó', nounou: 'ama', ecole_tiers: 'estabelecimento escolar' },
    titreAvecParent: (p) => `${p} dá-lhe acesso`,
    titreSansParent: 'Recebeu um acesso',
    sousTitre: (nom, role) =>
      `${nom ? nom + ', ' : ''}este acesso é limitado${role ? ` ao seu papel de ${role}` : ''}. Crie a sua conta para o ativar.`,
    verrez: 'O que vai ver',
    verrezPas: 'O que não vai ver',
    listeVerrez: [
      'As crianças que lhe são confiadas, e só essas',
      'As suas informações úteis: escola, alergias, grupo sanguíneo, médico',
      'Os seus contactos de emergência',
      'Os períodos em que está designado',
    ],
    listeVerrezPas: [
      'As mensagens entre os pais',
      'As despesas e os reembolsos',
      'Os documentos, o diário, as decisões',
      'A organização de guarda do outro progenitor',
    ],
    email: 'Email',
    motDePasse: 'Palavra-passe',
    activer: 'Ativar o meu acesso',
    mentionFin: 'O progenitor que o convidou pode retirar este acesso a qualquer momento.',
    lienInvalideTitre: 'Ligação inválida',
    lienInvalideSuite: 'Peça ao progenitor que o convidou uma nova ligação a partir da Dualia.',
    motifIncomplet: 'Esta ligação está incompleta.',
    motifInexistant: 'Esta ligação não existe ou foi retirada.',
    motifRevoque: 'Este acesso foi retirado pelo progenitor que lho tinha dado.',
    motifExpire: 'Esta ligação ultrapassou os 14 dias de validade.',
    motifDejaUtilise: 'Esta ligação já foi usada para criar uma conta.',
    allerConnexion: 'Iniciar sessão',
    champsIncomplets: 'Campos incompletos',
    champsIncompletsMsg: 'Indique um endereço de email.',
    motDePasseFaible: 'Palavra-passe demasiado fraca',
    confirmationTitre: 'Confirmação necessária',
    confirmationMsg: 'Verifique o seu email para confirmar o endereço e reabra esta ligação.',
    erreur: 'Erro',
  },
  es: {
    roles: { grand_parent: 'abuelo o abuela', nounou: 'cuidado de niños', ecole_tiers: 'centro escolar' },
    titreAvecParent: (p) => `${p} te da acceso`,
    titreSansParent: 'Has recibido un acceso',
    sousTitre: (nom, role) =>
      `${nom ? nom + ', ' : ''}este acceso es limitado${role ? ` a tu papel de ${role}` : ''}. Crea tu cuenta para activarlo.`,
    verrez: 'Lo que verás',
    verrezPas: 'Lo que no verás',
    listeVerrez: [
      'Los niños que te confían, y solo esos',
      'Su información útil: colegio, alergias, grupo sanguíneo, médico',
      'Sus contactos de emergencia',
      'Los turnos en los que estás designado',
    ],
    listeVerrezPas: [
      'Los mensajes entre los progenitores',
      'Los gastos y los reembolsos',
      'Los documentos, el diario, las decisiones',
      'La organización de custodia del otro progenitor',
    ],
    email: 'Email',
    motDePasse: 'Contraseña',
    activer: 'Activar mi acceso',
    mentionFin: 'El progenitor que te invitó puede retirar este acceso en cualquier momento.',
    lienInvalideTitre: 'Enlace no válido',
    lienInvalideSuite: 'Pide al progenitor que te invitó que te envíe uno nuevo desde Dualia.',
    motifIncomplet: 'Este enlace está incompleto.',
    motifInexistant: 'Este enlace no existe o ha sido retirado.',
    motifRevoque: 'Este acceso ha sido retirado por el progenitor que te lo dio.',
    motifExpire: 'Este enlace ha superado sus 14 días de validez.',
    motifDejaUtilise: 'Este enlace ya se ha usado para crear una cuenta.',
    allerConnexion: 'Iniciar sesión',
    champsIncomplets: 'Campos incompletos',
    champsIncompletsMsg: 'Indica una dirección de email.',
    motDePasseFaible: 'Contraseña demasiado débil',
    confirmationTitre: 'Confirmación necesaria',
    confirmationMsg: 'Revisa tu correo para confirmar tu dirección y vuelve a abrir este enlace.',
    erreur: 'Error',
  },
  en: {
    roles: { grand_parent: 'grandparent', nounou: 'childminder', ecole_tiers: 'school' },
    titreAvecParent: (p) => `${p} is giving you access`,
    titreSansParent: 'You have been given access',
    sousTitre: (nom, role) =>
      `${nom ? nom + ', ' : ''}this access is limited${role ? ` to your role as ${role}` : ''}. Create your account to activate it.`,
    verrez: 'What you will see',
    verrezPas: 'What you will not see',
    listeVerrez: [
      'The children entrusted to you, and only those',
      'Their useful details: school, allergies, blood type, doctor',
      'Their emergency contacts',
      'The time slots you are assigned to',
    ],
    listeVerrezPas: [
      'Messages between the parents',
      'Expenses and reimbursements',
      'Documents, the journal, decisions',
      'The other parent’s custody arrangements',
    ],
    email: 'Email',
    motDePasse: 'Password',
    activer: 'Activate my access',
    mentionFin: 'The parent who invited you can withdraw this access at any time.',
    lienInvalideTitre: 'Invalid link',
    lienInvalideSuite: 'Ask the parent who invited you to send a new one from Dualia.',
    motifIncomplet: 'This link is incomplete.',
    motifInexistant: 'This link does not exist or has been withdrawn.',
    motifRevoque: 'This access was withdrawn by the parent who granted it.',
    motifExpire: 'This link is past its 14 days of validity.',
    motifDejaUtilise: 'This link has already been used to create an account.',
    allerConnexion: 'Sign in',
    champsIncomplets: 'Incomplete fields',
    champsIncompletsMsg: 'Please enter an email address.',
    motDePasseFaible: 'Password too weak',
    confirmationTitre: 'Confirmation required',
    confirmationMsg: 'Check your inbox to confirm your address, then reopen this link.',
    erreur: 'Error',
  },
};

export default function RejoindreAccesScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const langue = useStore((s) => s.langue);
  const l = LIBELLES[langue] ?? LIBELLES.fr;

  const [verification, setVerification] = useState<'en_cours' | 'valide' | 'invalide'>('en_cours');
  const [motifRefus, setMotifRefus] = useState('');
  const [proposerConnexion, setProposerConnexion] = useState(false);
  const [nomTiers, setNomTiers] = useState('');
  const [roleTiers, setRoleTiers] = useState('');
  const [nomParent, setNomParent] = useState('');

  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);

  const erreurMotDePasse = motDePasse.length > 0 ? validerMotDePasse(motDePasse) : null;

  useEffect(() => {
    if (!token) {
      setMotifRefus(l.motifIncomplet);
      setVerification('invalide');
      return;
    }
    supabase.rpc('get_invitation_tiers_info', { p_token: token }).then(({ data, error }) => {
      const info = data?.[0];
      if (error || !info) {
        setMotifRefus(l.motifInexistant);
        setVerification('invalide');
        return;
      }
      if (info.revoque_le) {
        setMotifRefus(l.motifRevoque);
        setVerification('invalide');
        return;
      }
      // Un lien déjà consommé ne doit surtout pas ouvrir le formulaire : la
      // création du compte réussirait, l'activation échouerait, et la personne
      // se retrouverait connectée sous un compte sans aucun accès.
      if (info.accepte_le) {
        setMotifRefus(l.motifDejaUtilise);
        setProposerConnexion(true);
        setVerification('invalide');
        return;
      }
      if (new Date(info.expire_le) < new Date()) {
        setMotifRefus(l.motifExpire);
        setVerification('invalide');
        return;
      }
      setNomTiers(info.nom ?? '');
      setRoleTiers(l.roles[info.role] ?? '');
      setNomParent(info.parent_nom ?? '');
      setVerification('valide');
    });
  }, [token, langue]);

  const accepter = async () => {
    if (!email.trim()) {
      alertCompat(l.champsIncomplets, l.champsIncompletsMsg);
      return;
    }
    const probleme = validerMotDePasse(motDePasse);
    if (probleme) {
      alertCompat(l.motDePasseFaible, probleme);
      return;
    }

    setChargement(true);
    let sessionCreee = false;
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: motDePasse,
      });

      if (authError) {
        // L'adresse existe déjà : c'est le cas normal d'une personne qui a
        // dû confirmer son e-mail et revient sur le lien. On la connecte au
        // lieu de lui opposer une erreur qu'elle ne peut pas résoudre.
        const { error: erreurConnexion } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: motDePasse,
        });
        if (erreurConnexion) throw authError;
        sessionCreee = true;
      } else if (!authData.session) {
        alertCompat(l.confirmationTitre, l.confirmationMsg);
        setChargement(false);
        return;
      } else {
        sessionCreee = true;
      }

      const { error: erreurAcces } = await supabase.rpc('rejoindre_comme_tiers', { p_token: token });
      if (erreurAcces) throw erreurAcces;

      // Même raison que dans rejoindre.tsx : sans ce chargement explicite,
      // l'écran suivant se monte avant que le store sache qui est connecté.
      await useStore.getState().initialiserSession();

      router.replace('/espace-tiers' as any);
    } catch (err: any) {
      const brut = err?.message ?? '';

      // Une session ouverte sans accès rattaché est pire qu'une erreur : la
      // personne reste connectée sous un compte fantôme. On referme.
      if (sessionCreee) {
        await supabase.auth.signOut();
        useStore.getState().purgerDonneesFamiliales();
      }

      if (brut.includes('invitation_deja_utilisee')) {
        alertCompat(l.lienInvalideTitre, l.motifDejaUtilise);
      } else if (brut.includes('invitation_revoquee')) {
        alertCompat(l.lienInvalideTitre, l.motifRevoque);
      } else if (brut.includes('invitation_expiree')) {
        alertCompat(l.lienInvalideTitre, l.motifExpire);
      } else {
        alertCompat(l.erreur, traduireErreurAuth(brut));
      }
    } finally {
      setChargement(false);
    }
  };

  if (verification === 'en_cours') {
    return (
      <View style={styles.centreEcran}>
        <ActivityIndicator size="large" color={COLORS.vert} />
      </View>
    );
  }

  if (verification === 'invalide') {
    return (
      <View style={styles.screen}>
        <View style={styles.contentCentre}>
          <Text style={styles.titre}>{l.lienInvalideTitre}</Text>
          <Text style={styles.sousTitre}>
            {motifRefus} {proposerConnexion ? '' : l.lienInvalideSuite}
          </Text>
          {proposerConnexion ? (
            <Pressable style={styles.boutonPrincipal} onPress={() => router.replace('/connexion' as any)}>
              <Text style={styles.boutonPrincipalTexte}>{l.allerConnexion}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.contenu} showsVerticalScrollIndicator={false}>
        <Text style={styles.titre}>
          {nomParent ? l.titreAvecParent(nomParent) : l.titreSansParent}
        </Text>
        <Text style={styles.sousTitre}>{l.sousTitre(nomTiers, roleTiers)}</Text>

        <View style={styles.encadre}>
          <Text style={styles.encadreTitre}>{l.verrez}</Text>
          {l.listeVerrez.map((ligne) => (
            <View key={ligne} style={styles.ligne}>
              <Ionicons name="checkmark-circle" size={15} color={COLORS.vert} />
              <Text style={styles.ligneTexte}>{ligne}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.encadre, styles.encadreSombre]}>
          <Text style={styles.encadreTitre}>{l.verrezPas}</Text>
          {l.listeVerrezPas.map((ligne) => (
            <View key={ligne} style={styles.ligne}>
              <Ionicons name="close-circle" size={15} color={COLORS.ardoise} />
              <Text style={styles.ligneTexte}>{ligne}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.label}>{l.email}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="vous@exemple.com"
          placeholderTextColor={COLORS.ardoise}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>{l.motDePasse}</Text>
        <TextInput
          style={[styles.input, !!erreurMotDePasse && styles.inputErreur]}
          value={motDePasse}
          onChangeText={setMotDePasse}
          placeholder={AIDE_MOT_DE_PASSE}
          placeholderTextColor={COLORS.ardoise}
          secureTextEntry
        />
        <Text style={[styles.aide, !!erreurMotDePasse && styles.aideErreur]}>
          {erreurMotDePasse ?? AIDE_MOT_DE_PASSE}
        </Text>

        <Pressable style={styles.boutonPrincipal} onPress={accepter} disabled={chargement}>
          {chargement ? (
            <ActivityIndicator color={COLORS.blanc} />
          ) : (
            <Text style={styles.boutonPrincipalTexte}>{l.activer}</Text>
          )}
        </Pressable>

        <Text style={styles.mentionFin}>{l.mentionFin}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.ivoire },
  centreEcran: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.ivoire },
  contentCentre: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.xl },
  contenu: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.xxxl, paddingBottom: SPACING.xxxl },
  titre: { fontFamily: FONTS.display, fontSize: 22, color: COLORS.vertProfond, marginBottom: SPACING.sm },
  sousTitre: { fontFamily: FONTS.body, fontSize: 13.5, color: COLORS.ardoise, lineHeight: 19, marginBottom: SPACING.lg },

  encadre: {
    backgroundColor: COLORS.blanc, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.bordure,
    padding: SPACING.md, marginBottom: SPACING.sm, gap: 6,
  },
  encadreSombre: { backgroundColor: '#F3F1EC' },
  encadreTitre: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.vertProfond, marginBottom: 2 },
  ligne: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  ligneTexte: { flex: 1, fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.ardoise, lineHeight: 17 },

  label: { fontFamily: FONTS.bodySemibold, fontSize: 12.5, color: COLORS.vertProfond, marginBottom: 6, marginTop: SPACING.md },
  input: {
    backgroundColor: COLORS.blanc, borderWidth: 1, borderColor: COLORS.bordure, borderRadius: RADIUS.md,
    paddingHorizontal: 12, paddingVertical: 12, fontFamily: FONTS.body, fontSize: 15, color: COLORS.vertProfond,
  },
  inputErreur: { borderColor: COLORS.terracotta },
  aide: { fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, lineHeight: 16, marginTop: 6 },
  aideErreur: { color: COLORS.terracotta },
  boutonPrincipal: {
    backgroundColor: COLORS.vert, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center',
    marginTop: SPACING.xl,
  },
  boutonPrincipalTexte: { fontFamily: FONTS.bodySemibold, fontSize: 15, color: COLORS.blanc },
  mentionFin: {
    fontFamily: FONTS.body, fontSize: 11.5, color: COLORS.ardoise, textAlign: 'center',
    marginTop: SPACING.lg, lineHeight: 16,
  },
});
