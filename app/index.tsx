import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { Platform } from 'react-native';
import { useStore } from '../store/useStore';
import { COLORS } from '../constants/theme';

type Decision =
  | { type: 'en_cours' }
  | { type: 'restaurer'; chemin: string }
  | { type: 'suivre_session' };

export default function Index() {
  const [decision, setDecision] = useState<Decision>({ type: 'en_cours' });

  // La décision de session est prise une seule fois, dans le store.
  //
  // Cet écran appelait getSession() de son côté, et ignorait le champ `error` :
  // un parent hors ligne dont le jeton venait d'expirer était déclaré
  // « non connecté » et envoyé vers la création d'un espace familial — alors
  // que son espace était intact dans le stockage local, et sans aucun chemin
  // de retour vers lui. Deux lectures de session qui se contredisent valaient
  // aussi une course avec la garde du layout.
  const sessionActive = useStore((s) => s.sessionActive);
  const sessionVerifiee = useStore((s) => s.sessionVerifiee);

  useEffect(() => {
    // Priorité absolue : si on arrive ici après un rebond depuis
    // public/404.html (lien profond cliqué depuis l'extérieur, ex. un lien
    // d'invitation reçu par SMS), on doit aller vers CETTE page précise —
    // peu importe si une session existe déjà. C'est justement le cas pour
    // /rejoindre : la personne peut être déjà connectée à son propre compte
    // et vouloir malgré tout consulter un lien d'invitation.
    if (Platform.OS === 'web') {
      const chemin = window.sessionStorage.getItem('chemin_avant_404');
      if (chemin) {
        window.sessionStorage.removeItem('chemin_avant_404');
        const cheminSansBase = chemin.replace(/^\/Dualia/, '') || '/';
        setDecision({ type: 'restaurer', chemin: cheminSansBase });
        return;
      }
    }
    setDecision({ type: 'suivre_session' });
  }, []);

  if (decision.type === 'restaurer') {
    return <Redirect href={decision.chemin as any} />;
  }

  if (decision.type === 'en_cours' || !sessionVerifiee) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.ivoire }}>
        <ActivityIndicator size="large" color={COLORS.vert} />
      </View>
    );
  }

  // sessionActive === false : aucune session sur cet appareil, et le store a
  // déjà purgé les données locales. C'est le seul cas où l'on propose la
  // création d'un espace.
  if (sessionActive === false) {
    return <Redirect href="/creer-espace" />;
  }

  // true (session confirmée) comme null (indéterminée, typiquement hors ligne)
  // mènent à l'accueil : dans le second cas les données locales sont celles du
  // parent, conservées volontairement, et les écrans suivants restent protégés
  // par les règles de sécurité du serveur dès qu'une requête part.
  return <Redirect href="/(tabs)/accueil" />;
}
