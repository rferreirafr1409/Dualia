import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { Platform } from 'react-native';
import { useStore } from '../store/useStore';
import { COLORS } from '../constants/theme';
import { CHEMIN_BASE } from '../constants/environnement';
import { cheminInvitationEnAttente } from '../lib/invitationEnAttente';

type Decision =
  | { type: 'en_cours' }
  | { type: 'restaurer'; chemin: string }
  | { type: 'suivre_session' };

// Compte sans famille : s'il a un lien d'invitation en attente sur cet
// appareil, c'est la qu'il va, pas vers la creation d'un espace a lui.
function RedirectionSansFamille() {
  const [chemin, setChemin] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let vivant = true;
    cheminInvitationEnAttente().then((c) => { if (vivant) setChemin(c); });
    return () => { vivant = false; };
  }, []);
  if (chemin === undefined) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.ivoire }}>
        <ActivityIndicator size="large" color={COLORS.vert} />
      </View>
    );
  }
  return <Redirect href={(chemin ?? '/creer-espace') as any} />;
}

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
  const rattachement = useStore((s) => s.rattachement);

  useEffect(() => {
    // Filet de secours, normalement inutile : le script de app/+html.tsx
    // consomme cette clé et restaure l'URL lui-même, avant même que ce
    // bundle ne soit chargé. On la garde au cas où ce script serait absent
    // (rendu natif, page servie autrement), mais c'est bien lui qui agit.
    //
    // Si on arrive ici après un rebond depuis
    // public/404.html (lien profond cliqué depuis l'extérieur, ex. un lien
    // d'invitation reçu par SMS), on doit aller vers CETTE page précise —
    // peu importe si une session existe déjà. C'est justement le cas pour
    // /rejoindre : la personne peut être déjà connectée à son propre compte
    // et vouloir malgré tout consulter un lien d'invitation.
    if (Platform.OS === 'web') {
      const chemin = window.sessionStorage.getItem('chemin_avant_404');
      if (chemin) {
        window.sessionStorage.removeItem('chemin_avant_404');
        const cheminSansBase = (chemin.startsWith(CHEMIN_BASE) ? chemin.slice(CHEMIN_BASE.length) : chemin) || '/';
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

  // Session valide, mais rien de rattache a ce compte : la creation d'espace
  // a ete interrompue par la confirmation d'e-mail. On y renvoie directement.
  // La garde du layout couvre le meme cas ; ici on evite en plus le passage
  // par un accueil vide quand la reponse est deja connue.
  if (rattachement === 'jamais_rattache') {
    return <RedirectionSansFamille />;
  }

  // Un acces tiers retire n'est pas un compte neuf : on ne propose pas de
  // creer un espace familial, on l'envoie sur l'ecran qui saura le dire.
  if (rattachement === 'acces_retire') {
    return <Redirect href="/espace-tiers" />;
  }

  // Co-parent invite dont la demande attend la validation : sa place est la
  // salle d'attente, pas la creation d'un espace a lui.
  if (rattachement === 'demande_en_attente') {
    return <Redirect href="/rejoindre" />;
  }

  // true (session confirmée) comme null (indéterminée, typiquement hors ligne)
  // mènent à l'accueil : dans le second cas les données locales sont celles du
  // parent, conservées volontairement, et les écrans suivants restent protégés
  // par les règles de sécurité du serveur dès qu'une requête part.
  return <Redirect href="/(tabs)/accueil" />;
}
