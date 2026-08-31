import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { Platform } from 'react-native';
import { supabase } from '../constants/supabase';
import { COLORS } from '../constants/theme';

type Decision =
  | { type: 'en_cours' }
  | { type: 'restaurer'; chemin: string }
  | { type: 'connecte' }
  | { type: 'non_connecte' };

export default function Index() {
  const [decision, setDecision] = useState<Decision>({ type: 'en_cours' });

  useEffect(() => {
    // Priorité absolue : si on arrive ici après un rebond depuis
    // public/404.html (lien profond cliqué depuis l'extérieur, ex. un lien
    // d'invitation reçu par SMS), on doit aller vers CETTE page précise —
    // peu importe si une session existe déjà. C'est justement le cas pour
    // /rejoindre : la personne peut être déjà connectée à son propre compte
    // et vouloir malgré tout consulter un lien d'invitation. Vérifié avant
    // toute logique de session pour éviter que les deux ne se disputent la
    // navigation.
    if (Platform.OS === 'web') {
      const chemin = window.sessionStorage.getItem('chemin_avant_404');
      if (chemin) {
        window.sessionStorage.removeItem('chemin_avant_404');
        const cheminSansBase = chemin.replace(/^\/Dualia/, '') || '/';
        setDecision({ type: 'restaurer', chemin: cheminSansBase });
        return;
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      setDecision({ type: data.session ? 'connecte' : 'non_connecte' });
    });
  }, []);

  if (decision.type === 'en_cours') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.ivoire }}>
        <ActivityIndicator size="large" color={COLORS.vert} />
      </View>
    );
  }

  if (decision.type === 'restaurer') {
    return <Redirect href={decision.chemin as any} />;
  }

  if (decision.type === 'connecte') {
    return <Redirect href="/(tabs)/accueil" />;
  }

  return <Redirect href="/creer-espace" />;
}
