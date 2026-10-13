import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../constants/supabase';
import { useStore } from '../store/useStore';
import { supprimerMonCompte } from '../lib/suppressionCompte';
import { TRADUCTIONS } from '../constants/i18n';

// Sur le web, Alert.alert (React Native) ne s'affiche pas — on utilise
// window.alert/confirm à la place. Sur mobile, on garde Alert.alert natif.
const notifier = (titre: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${titre}\n\n${message}`);
  } else {
    Alert.alert(titre, message);
  }
};

// Les libellés des deux boutons sont passés par l'appelant : « Désactiver »
// était codé en dur pour la double authentification, et se serait affiché tel
// quel sur une demande de déconnexion. Ils viennent des traductions, que
// cette fonction hors composant ne peut pas lire elle-même.
const demanderConfirmation = (
  titre: string,
  message: string,
  libelleConfirmation: string,
  libelleAnnulation: string
): Promise<boolean> => {
  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      resolve(window.confirm(`${titre}\n\n${message}`));
    } else {
      Alert.alert(titre, message, [
        { text: libelleAnnulation, style: 'cancel', onPress: () => resolve(false) },
        { text: libelleConfirmation, style: 'destructive', onPress: () => resolve(true) },
      ]);
    }
  });
};

// Palette Dualia
const COLORS = {
  ivoire: '#F8F6F2',
  vertProfond: '#1C2B25',
  vert: '#2D6A4F',
  terracotta: '#B5927C',
  or: '#C9A84C',
  ardoise: '#6B7F7A',
  blanc: '#FFFFFF',
  rouge: '#B3261E',
};

type Facteur = {
  id: string;
  factor_type: string;
  status: string;
  friendly_name?: string | null;
};

export default function SecuriteCompte() {
  const router = useRouter();
  const seDeconnecterDuStore = useStore((st) => st.seDeconnecter);
  const langue = useStore((st) => st.langue);
  const t = TRADUCTIONS[langue].securiteCompte;
  const [deconnexionEnCours, setDeconnexionEnCours] = useState(false);

  const deconnexion = async () => {
    const confirme = await demanderConfirmation(
      t.deconnexionTitre,
      t.deconnexionConfirmCorps,
      t.deconnexionTitre,
      t.annuler
    );
    if (!confirme) return;
    setDeconnexionEnCours(true);
    try {
      const fermeeCoteServeur = await seDeconnecterDuStore();
      if (!fermeeCoteServeur) {
        // L'appareil est propre, mais la session peut rester ouverte ailleurs.
        // Le dire plutôt que de laisser le parent croire le contraire : sur un
        // ordinateur partagé, c'est précisément ce qu'il a besoin de savoir.
        notifier(t.deconnecteAppareilTitre, t.deconnecteAppareilCorps);
      }
      router.replace('/connexion' as any);
    } finally {
      setDeconnexionEnCours(false);
    }
  };

  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  // Suppression du compte (DUA-089). Apple l'exige de toute application qui
  // permet de creer un compte, et le RGPD de toute facon. Deux confirmations
  // : la premiere dit ce qui va se passer, la seconde est le dernier mot, car
  // rien de tout cela ne se rattrape.
  const supprimerCompte = async () => {
    const premiere = await demanderConfirmation(
      t.supprimerCompteTitre,
      t.supprimerCompteCorps,
      t.continuer,
      t.annuler
    );
    if (!premiere) return;
    const seconde = await demanderConfirmation(
      t.derniereConfirmationTitre,
      t.derniereConfirmationCorps,
      t.supprimerMonCompte,
      t.annuler
    );
    if (!seconde) return;

    setSuppressionEnCours(true);
    try {
      await supprimerMonCompte();
    } catch (e) {
      console.error('[Dualia] Suppression de compte impossible :', e);
      setSuppressionEnCours(false);
      notifier(t.suppressionImpossibleTitre, t.suppressionImpossibleCorps);
      return;
    }
    // Le compte n'existe plus : la fermeture de session cote serveur echouera
    // forcement, et c'est sans importance. Ce qui compte est d'effacer les
    // donnees de cet appareil.
    await seDeconnecterDuStore('local');
    setSuppressionEnCours(false);
    notifier(t.compteSupprimeTitre, t.compteSupprimeCorps);
    router.replace('/connexion' as any);
  };

  const [chargement, setChargement] = useState(true);
  const [facteurs, setFacteurs] = useState<Facteur[]>([]);

  // Étapes de l'inscription d'un nouveau facteur
  const [inscriptionEnCours, setInscriptionEnCours] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verification, setVerification] = useState(false);

  const chargerFacteurs = async () => {
    setChargement(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      notifier(t.erreurTitre, t.chargementImpossible);
      setChargement(false);
      return;
    }
    setFacteurs((data?.totp as Facteur[]) || []);
    setChargement(false);
  };

  useEffect(() => {
    chargerFacteurs();
  }, []);

  const demarrerInscription = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Dualia - ${new Date().toLocaleDateString('fr-FR')}`,
    });

    if (error || !data) {
      notifier(t.erreurTitre, t.activationImpossible);
      return;
    }

    setFactorId(data.id);
    setSecret(data.totp.secret);
    setInscriptionEnCours(true);
  };

  const confirmerCode = async () => {
    if (!factorId || code.trim().length !== 6) {
      notifier(t.codeInvalideTitre, t.codeInvalideCorps);
      return;
    }
    setVerification(true);

    const { data: challenge, error: erreurChallenge } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (erreurChallenge || !challenge) {
      setVerification(false);
      notifier(t.erreurTitre, t.verificationImpossible);
      return;
    }

    const { error: erreurVerif } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });

    setVerification(false);

    if (erreurVerif) {
      notifier(t.codeIncorrectTitre, t.codeIncorrectCorps);
      return;
    }

    setInscriptionEnCours(false);
    setFactorId(null);
    setSecret(null);
    setCode('');
    notifier(t.activeTitre, t.activeCorps);
    chargerFacteurs();
  };

  const annulerInscription = async () => {
    if (factorId) {
      await supabase.auth.mfa.unenroll({ factorId });
    }
    setInscriptionEnCours(false);
    setFactorId(null);
    setSecret(null);
    setCode('');
  };

  const desactiverFacteur = async (facteur: Facteur) => {
    const confirme = await demanderConfirmation(
      t.desactiverTitre,
      t.desactiverCorps,
      t.desactiver,
      t.annuler
    );
    if (!confirme) return;

    const { error } = await supabase.auth.mfa.unenroll({ factorId: facteur.id });
    if (error) {
      notifier(t.erreurTitre, t.desactivationEchouee);
      return;
    }
    chargerFacteurs();
  };

  const retourner = () => {
    // Si la page a été ouverte directement (pas de navigation depuis l'app,
    // ex. lien direct ou rechargement), il n'y a pas d'historique auquel
    // revenir — router.back() ne ferait alors rien. On revient à l'accueil
    // dans ce cas.
    // @ts-ignore — canGoBack existe dans les versions récentes d'expo-router
    if (router.canGoBack && router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const secretFormate = (s: string) => s.match(/.{1,4}/g)?.join(' ') || s;

  return (
    <ScrollView style={styles.conteneur} contentContainerStyle={styles.contenu}>
      <TouchableOpacity onPress={retourner} style={styles.retour}>
        <Text style={styles.retourTexte}>{t.retour}</Text>
      </TouchableOpacity>

      <Text style={styles.titre}>{t.titre}</Text>
      <Text style={styles.sousTitre}>{t.sousTitre}</Text>

      {chargement && <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.vert} />}

      {!chargement && !inscriptionEnCours && facteurs.length === 0 && (
        <View style={styles.carte}>
          <Text style={styles.carteTitre}>{t.nonActivee}</Text>
          <Text style={styles.carteTexte}>{t.nonActiveeCorps}</Text>
          <TouchableOpacity style={styles.boutonPrincipal} onPress={demarrerInscription}>
            <Text style={styles.boutonPrincipalTexte}>{t.activer}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!chargement &&
        facteurs.map((f) => (
          <View key={f.id} style={styles.carte}>
            <Text style={styles.carteTitre}>{t.activee}</Text>
            <Text style={styles.carteTexte}>{f.friendly_name || t.applicationAuth}</Text>
            <TouchableOpacity style={styles.boutonSecondaire} onPress={() => desactiverFacteur(f)}>
              <Text style={styles.boutonSecondaireTexte}>{t.desactiver}</Text>
            </TouchableOpacity>
          </View>
        ))}

      {inscriptionEnCours && secret && (
        <View style={styles.carte}>
          <Text style={styles.carteTitre}>{t.etape1}</Text>
          <Text style={styles.carteTexte}>{t.etape1Corps}</Text>
          <View style={styles.secretBox}>
            <Text style={styles.secretTexte}>{secretFormate(secret)}</Text>
          </View>

          <Text style={[styles.carteTitre, { marginTop: 20 }]}>{t.etape2}</Text>
          <Text style={styles.carteTexte}>{t.etape2Corps}</Text>
          <TextInput
            style={styles.champCode}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="123456"
            placeholderTextColor={COLORS.ardoise}
          />

          <TouchableOpacity
            style={styles.boutonPrincipal}
            onPress={confirmerCode}
            disabled={verification}
          >
            {verification ? (
              <ActivityIndicator color={COLORS.blanc} />
            ) : (
              <Text style={styles.boutonPrincipalTexte}>{t.confirmer}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.boutonAnnuler} onPress={annulerInscription}>
            <Text style={styles.boutonAnnulerTexte}>{t.annuler}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Déconnexion.
          Elle n'existait que pour les tiers. Un parent n'avait aucun moyen de
          retirer ses données d'un ordinateur partagé — or l'ordinateur familial
          d'un couple séparé est précisément le matériel de nos utilisateurs. */}
      <View style={styles.carte}>
        <Text style={styles.carteTitre}>{t.deconnexionCarteTitre}</Text>
        <Text style={styles.carteTexte}>{t.deconnexionCarteCorps}</Text>
        <TouchableOpacity
          style={styles.boutonSecondaire}
          onPress={deconnexion}
          disabled={deconnexionEnCours}
        >
          {deconnexionEnCours ? (
            <ActivityIndicator color={COLORS.rouge} />
          ) : (
            <Text style={styles.boutonSecondaireTexte}>{t.deconnexionTitre}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Suppression du compte (DUA-089) : exigee par Apple pour toute
          application qui permet d'en creer un. */}
      <View style={[styles.carte, styles.carteDanger]}>
        <Text style={styles.carteTitre}>{t.supprimerMonCompte}</Text>
        <Text style={styles.carteTexte}>{t.suppressionCarteCorps}</Text>
        <TouchableOpacity
          style={styles.boutonDanger}
          onPress={supprimerCompte}
          disabled={suppressionEnCours || deconnexionEnCours}
        >
          {suppressionEnCours ? (
            <ActivityIndicator color={COLORS.blanc} />
          ) : (
            <Text style={styles.boutonDangerTexte}>{t.supprimerMonCompte}</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => router.push('/confidentialite' as any)} style={styles.lienPolitique}>
        <Text style={styles.lienPolitiqueTexte}>{t.lirePolitique}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  conteneur: { flex: 1, backgroundColor: COLORS.ivoire },
  contenu: { padding: 20, paddingTop: 60 },
  retour: { marginBottom: 16 },
  retourTexte: { color: COLORS.vert, fontSize: 16 },
  titre: { fontSize: 24, fontWeight: '700', color: COLORS.vertProfond, marginBottom: 8 },
  sousTitre: { fontSize: 14, color: COLORS.ardoise, lineHeight: 20, marginBottom: 24 },
  carte: {
    backgroundColor: COLORS.blanc,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E8E4DC',
  },
  carteTitre: { fontSize: 16, fontWeight: '700', color: COLORS.vertProfond, marginBottom: 6 },
  carteTexte: { fontSize: 14, color: COLORS.ardoise, lineHeight: 20, marginBottom: 12 },
  boutonPrincipal: {
    backgroundColor: COLORS.vert,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  boutonPrincipalTexte: { color: COLORS.blanc, fontWeight: '700', fontSize: 15 },
  boutonSecondaire: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.rouge,
    marginTop: 4,
  },
  boutonSecondaireTexte: { color: COLORS.rouge, fontWeight: '600', fontSize: 14 },
  carteDanger: { borderColor: COLORS.rouge, borderWidth: 1 },
  lienPolitique: { alignSelf: 'center', paddingVertical: 12, marginBottom: 24 },
  lienPolitiqueTexte: { fontSize: 13, color: COLORS.ardoise, textDecorationLine: 'underline' },
  boutonDanger: {
    backgroundColor: COLORS.rouge,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  boutonDangerTexte: { color: COLORS.blanc, fontWeight: '700', fontSize: 14 },
  boutonAnnuler: { alignItems: 'center', marginTop: 12 },
  boutonAnnulerTexte: { color: COLORS.ardoise, fontSize: 14 },
  secretBox: {
    backgroundColor: COLORS.ivoire,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  secretTexte: { fontSize: 18, letterSpacing: 2, fontWeight: '700', color: COLORS.vertProfond },
  champCode: {
    borderWidth: 1,
    borderColor: '#E8E4DC',
    borderRadius: 12,
    padding: 14,
    fontSize: 20,
    letterSpacing: 6,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
    color: COLORS.vertProfond,
  },
});
