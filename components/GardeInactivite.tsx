// components/GardeInactivite.tsx
//
// Ferme la session apres une periode sans activite, apres avoir prevenu.
//
// Pose une fois, tout en haut de l'application. Ne rend rien tant que le
// delai n'approche pas : c'est un avertissement, pas un bandeau permanent.
//
// La regle de minutage et la persistance de l'horodatage vivent dans
// lib/inactivite.ts, a part et eprouvees.

import React from 'react';
import { View, Text, Modal, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../store/useStore';
import { TRADUCTIONS } from '../constants/i18n';
import { COLORS, SPACING, FONTS, RADIUS } from '../constants/theme';
import {
  etatInactivite,
  lireDerniereActivite,
  ecrireDerniereActivite,
  signalerDeconnexionInactivite,
  EVENEMENTS_ACTIVITE,
  EVENEMENTS_VERIFICATION,
  PERIODE_VERIFICATION_MS,
  type EtatInactivite,
} from '../lib/inactivite';

export default function GardeInactivite() {
  const router = useRouter();
  const sessionActive = useStore((s) => s.sessionActive);
  const accesTiers = useStore((s) => s.accesTiers);
  const seDeconnecter = useStore((s) => s.seDeconnecter);
  const langue = useStore((s) => s.langue);
  const t = TRADUCTIONS[langue].inactivite;

  const derniereActivite = React.useRef<number>(Date.now());
  const [etat, setEtat] = React.useState<EtatInactivite>({ phase: 'actif' });

  // Une deconnexion peut etre lente (appel reseau). Sans ce verrou, le
  // minuteur continuerait de tourner et en declencherait une deuxieme.
  const deconnexionEnCours = React.useRef(false);

  // On surveille des que la session n'est PAS explicitement fermee.
  //
  // Le cas `null` — session indeterminee, typiquement hors ligne — merite
  // une explication : l'application affiche alors l'espace familial complet
  // reconstitue depuis le stockage local, sans avoir pu confirmer la session.
  // Ne pas surveiller la aurait laisse un onglet montrer les messages et les
  // adresses indefiniment. C'est le cas ou un delai compte le plus, pas le
  // moins.
  const surveiller = sessionActive !== false;

  // Sur mobile, aucun geste n'est instrumente : il n'y a ni ecouteur global
  // ni PanResponder. Surveiller la reviendrait a deconnecter quelqu'un en
  // pleine lecture toutes les vingt minutes. Le deploiement est web
  // aujourd'hui ; le jour ou une application native sortira, il faudra
  // capter les contacts avant d'activer ceci.
  const actif = surveiller && Platform.OS === 'web';

  React.useEffect(() => {
    if (!actif) {
      setEtat({ phase: 'actif' });
      deconnexionEnCours.current = false;
      return;
    }

    // Point essentiel : on REPREND l'horodatage conserve au lieu de repartir
    // de maintenant. Un rechargement de page n'est pas une preuve de
    // presence — c'est meme la facon la plus courante dont quelqu'un d'autre
    // arrive devant l'ecran.
    const conserve = lireDerniereActivite();
    derniereActivite.current = conserve ?? Date.now();
    if (conserve === null) ecrireDerniereActivite(derniereActivite.current, true);

    const retirer: Array<() => void> = [];

    const terminer = () => {
      deconnexionEnCours.current = true;
      // Lu AVANT la deconnexion, qui remet accesTiers a null.
      const etaitTiers = useStore.getState().accesTiers !== null;
      signalerDeconnexionInactivite();
      void seDeconnecter('local').finally(() => {
        // On conduit nous-memes vers la connexion. S'en remettre a la garde
        // du layout ne suffisait pas : une dizaine d'ecrans en sont exemptes,
        // et l'un d'eux aurait laisse la personne devant un formulaire vide
        // et sans issue.
        try {
          // Un tiers — grand-parent, nounou — n'a pas de mot de passe : il
          // entre par un lien d'invitation. L'envoyer vers l'ecran de
          // connexion serait une impasse. On le ramene a sa propre porte.
          router.replace((etaitTiers ? '/rejoindre-acces' : '/connexion') as any);
        } catch {
          // Navigation indisponible : la garde du layout prendra le relais.
        }
      });
    };

    const verifier = () => {
      if (deconnexionEnCours.current) return;
      // On relit l'horloge et le stockage a chaque passage : un autre onglet
      // a pu signaler une activite entre-temps, et un minuteur mis en sommeil
      // par le navigateur ou par la veille de la machine ne fausse rien,
      // puisque c'est l'ecart de temps reel qui decide.
      const partage = lireDerniereActivite();
      if (partage !== null && partage > derniereActivite.current) {
        derniereActivite.current = partage;
      }
      const suivant = etatInactivite(derniereActivite.current, Date.now());
      setEtat((precedent) =>
        precedent.phase === suivant.phase &&
        precedent.phase !== 'avertissement'
          ? precedent // evite un rendu inutile toutes les cinq secondes
          : suivant
      );
      if (suivant.phase === 'expire') terminer();
    };

    const signalerActivite = () => {
      if (deconnexionEnCours.current) return;
      const maintenant = Date.now();
      derniereActivite.current = maintenant;
      ecrireDerniereActivite(maintenant);
      // Reponse immediate : sans cela, « Je suis la » laissait la fenetre
      // affichee jusqu'a cinq secondes, compte a rebours fige, et donnait
      // l'impression d'une application bloquee.
      setEtat({ phase: 'actif' });
    };

    if (typeof window !== 'undefined') {
      const options = { passive: true } as AddEventListenerOptions;
      for (const nom of EVENEMENTS_ACTIVITE) {
        window.addEventListener(nom, signalerActivite, options);
        retirer.push(() => window.removeEventListener(nom, signalerActivite, options));
      }
      // Retour sur l'onglet : on VERIFIE, on ne repousse pas. Compter le
      // retour comme une activite annulerait le delai au moment precis ou il
      // doit s'appliquer.
      for (const nom of EVENEMENTS_VERIFICATION) {
        const cible: any = nom === 'visibilitychange' ? document : window;
        cible.addEventListener(nom, verifier);
        retirer.push(() => cible.removeEventListener(nom, verifier));
      }
    }

    const minuteur = setInterval(verifier, PERIODE_VERIFICATION_MS);
    verifier();

    return () => {
      clearInterval(minuteur);
      retirer.forEach((f) => f());
    };
  }, [actif, seDeconnecter, router]);

  if (!actif || etat.phase !== 'avertissement') return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.fond}>
        <View style={styles.carte}>
          <Text style={styles.titre}>{t.titre}</Text>
          <Text style={styles.corps}>{t.corps(etat.secondesRestantes)}</Text>
          <View style={styles.actions}>
            <Pressable
              style={styles.btnPartir}
              onPress={() => {
                deconnexionEnCours.current = true;
                const versTiers = accesTiers !== null;
                void seDeconnecter('local').finally(() => {
                  try {
                    router.replace((versTiers ? '/rejoindre-acces' : '/connexion') as any);
                  } catch {
                    /* la garde du layout prendra le relais */
                  }
                });
              }}
            >
              <Text style={styles.btnPartirTxt}>{t.partir}</Text>
            </Pressable>
            <Pressable
              style={styles.btnRester}
              onPress={() => {
                const maintenant = Date.now();
                ecrireDerniereActivite(maintenant, true);
                setEtat({ phase: 'actif' });
              }}
            >
              <Text style={styles.btnResterTxt}>{t.rester}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center', padding: SPACING.lg,
  },
  carte: {
    width: '100%', maxWidth: 380, backgroundColor: COLORS.blanc,
    borderRadius: RADIUS.lg, padding: SPACING.lg,
  },
  titre: {
    fontFamily: FONTS.display, fontSize: 18, color: COLORS.vertProfond,
    marginBottom: SPACING.sm,
  },
  corps: {
    fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise,
    lineHeight: 19, marginBottom: SPACING.lg,
  },
  actions: { flexDirection: 'row', gap: SPACING.sm, justifyContent: 'flex-end' },
  btnPartir: {
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.ardoise,
  },
  btnPartirTxt: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.ardoise },
  btnRester: {
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md, backgroundColor: COLORS.vert,
  },
  btnResterTxt: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.blanc, fontWeight: '600' },
});
