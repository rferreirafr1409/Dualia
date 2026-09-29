// lib/dialogue.ts
//
// Avertir et faire confirmer, sur le web comme sur mobile.
//
// `Alert.alert` de react-native-web est une fonction VIDE :
//
//     class Alert { static alert() {} }
//
// Chaque appel direct est donc, sur le web, un bouton qui ne fait rien et ne
// dit rien. Repere dans cinq ecrans : on saisissait une echeance sans date,
// on appuyait sur « Ajouter », et il ne se passait strictement rien — la
// personne appuyait de nouveau, indefiniment. Une corbeille sur une fiche
// enfant ne produisait aucune confirmation, donc aucune suppression.
//
// Plusieurs ecrans portaient deja leur propre copie de ce contournement. On
// le pose ici une fois pour toutes.

import { Alert, Platform } from 'react-native';

/** Message simple. Sur le web, boite de dialogue du navigateur. */
export function alerter(titre: string, message?: string) {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return;
    window.alert(titre && message ? `${titre}\n\n${message}` : (message || titre));
    return;
  }
  Alert.alert(titre, message);
}

/**
 * Confirmation. Rend true si la personne accepte.
 *
 * Sur mobile, la promesse se resout a false si la boite est fermee sans
 * choisir (retour Android) : sans ce `onDismiss`, un bouton reste bloque sur
 * son indicateur de chargement, pour toujours.
 */
export function confirmer(
  titre: string,
  message: string,
  libelleConfirmer: string,
  libelleAnnuler: string,
  destructif = false
): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined') return Promise.resolve(false);
    return Promise.resolve(window.confirm(message ? `${titre}\n\n${message}` : titre));
  }

  return new Promise((resoudre) => {
    Alert.alert(
      titre,
      message,
      [
        { text: libelleAnnuler, style: 'cancel', onPress: () => resoudre(false) },
        {
          text: libelleConfirmer,
          style: destructif ? 'destructive' : 'default',
          onPress: () => resoudre(true),
        },
      ],
      { cancelable: true, onDismiss: () => resoudre(false) }
    );
  });
}
