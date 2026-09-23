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

// Sur le web, Alert.alert (React Native) ne s'affiche pas — on utilise
// window.alert/confirm à la place. Sur mobile, on garde Alert.alert natif.
const notifier = (titre: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${titre}\n\n${message}`);
  } else {
    Alert.alert(titre, message);
  }
};

const demanderConfirmation = (titre: string, message: string): Promise<boolean> => {
  return new Promise((resolve) => {
    if (Platform.OS === 'web') {
      resolve(window.confirm(`${titre}\n\n${message}`));
    } else {
      Alert.alert(titre, message, [
        { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Désactiver', style: 'destructive', onPress: () => resolve(true) },
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
      notifier('Erreur', "Impossible de charger l'état de la double authentification.");
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
      notifier('Erreur', "Impossible de démarrer l'activation. Réessaie dans un instant.");
      return;
    }

    setFactorId(data.id);
    setSecret(data.totp.secret);
    setInscriptionEnCours(true);
  };

  const confirmerCode = async () => {
    if (!factorId || code.trim().length !== 6) {
      notifier('Code invalide', 'Saisis le code à 6 chiffres affiché dans ton application.');
      return;
    }
    setVerification(true);

    const { data: challenge, error: erreurChallenge } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (erreurChallenge || !challenge) {
      setVerification(false);
      notifier('Erreur', 'Impossible de vérifier le code. Réessaie.');
      return;
    }

    const { error: erreurVerif } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });

    setVerification(false);

    if (erreurVerif) {
      notifier('Code incorrect', "Le code saisi n'est pas valide. Vérifie l'heure de ton téléphone et réessaie.");
      return;
    }

    setInscriptionEnCours(false);
    setFactorId(null);
    setSecret(null);
    setCode('');
    notifier('Activé', 'La double authentification est maintenant active sur ton compte.');
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
      'Désactiver la double authentification ?',
      'Ton compte sera moins protégé. Confirme si tu veux vraiment continuer.'
    );
    if (!confirme) return;

    const { error } = await supabase.auth.mfa.unenroll({ factorId: facteur.id });
    if (error) {
      notifier('Erreur', 'La désactivation a échoué.');
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
        <Text style={styles.retourTexte}>← Retour</Text>
      </TouchableOpacity>

      <Text style={styles.titre}>Double authentification</Text>
      <Text style={styles.sousTitre}>
        Ajoute une couche de sécurité supplémentaire : en plus de ton mot de passe, un code à 6
        chiffres généré par une application (Google Authenticator, Authy, etc.) sera demandé à
        chaque connexion.
      </Text>

      {chargement && <ActivityIndicator style={{ marginTop: 24 }} color={COLORS.vert} />}

      {!chargement && !inscriptionEnCours && facteurs.length === 0 && (
        <View style={styles.carte}>
          <Text style={styles.carteTitre}>Non activée</Text>
          <Text style={styles.carteTexte}>
            Ton compte n'est actuellement protégé que par ton mot de passe.
          </Text>
          <TouchableOpacity style={styles.boutonPrincipal} onPress={demarrerInscription}>
            <Text style={styles.boutonPrincipalTexte}>Activer la double authentification</Text>
          </TouchableOpacity>
        </View>
      )}

      {!chargement &&
        facteurs.map((f) => (
          <View key={f.id} style={styles.carte}>
            <Text style={styles.carteTitre}>✅ Activée</Text>
            <Text style={styles.carteTexte}>{f.friendly_name || 'Application d\'authentification'}</Text>
            <TouchableOpacity style={styles.boutonSecondaire} onPress={() => desactiverFacteur(f)}>
              <Text style={styles.boutonSecondaireTexte}>Désactiver</Text>
            </TouchableOpacity>
          </View>
        ))}

      {inscriptionEnCours && secret && (
        <View style={styles.carte}>
          <Text style={styles.carteTitre}>Étape 1 — Ajoute la clé</Text>
          <Text style={styles.carteTexte}>
            Ouvre ton application d'authentification (Google Authenticator, Authy, etc.), choisis
            "Ajouter manuellement" et saisis cette clé :
          </Text>
          <View style={styles.secretBox}>
            <Text style={styles.secretTexte}>{secretFormate(secret)}</Text>
          </View>

          <Text style={[styles.carteTitre, { marginTop: 20 }]}>Étape 2 — Confirme</Text>
          <Text style={styles.carteTexte}>
            Saisis le code à 6 chiffres que l'application affiche maintenant :
          </Text>
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
              <Text style={styles.boutonPrincipalTexte}>Confirmer</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.boutonAnnuler} onPress={annulerInscription}>
            <Text style={styles.boutonAnnulerTexte}>Annuler</Text>
          </TouchableOpacity>
        </View>
      )}
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
