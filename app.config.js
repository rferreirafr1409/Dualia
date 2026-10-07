// app.config.js
//
// Remplace app.json, a l'identique sauf experiments.baseUrl : l'application
// est servie sous /Dualia en production et sous /Dualia/preprod en
// pre-production. L'environnement est choisi a la compilation par
// EXPO_PUBLIC_ENV (voir constants/environnement.ts) ; toute valeur autre que
// 'preprod' donne la production.
//
// Appli mobile (EAS Build, profils dans eas.json) : la pre-prod porte un
// identifiant distinct (suffixe .preprod) et son propre nom, pour s'installer
// a cote de l'appli de production sur le meme telephone sans l'ecraser.
//
// L'identifiant de production (app.dualia, domaine dualia.app inverse) est DEFINITIF une fois l'appli
// publiee sur l'App Store ou Google Play : ne jamais le modifier ensuite.

const EST_PREPROD = process.env.EXPO_PUBLIC_ENV === 'preprod';
const IDENTIFIANT = EST_PREPROD ? 'app.dualia.preprod' : 'app.dualia';

module.exports = {
  expo: {
    "name": EST_PREPROD ? 'Dualia pré-prod' : 'Dualia',
    "slug": "dualia",
    // Projet EAS (expo.dev, organisation r-digital-instore) qui compile
    // l'appli mobile. Les deux environnements partagent ce projet.
    "owner": "r-digital-instore",
    "scheme": EST_PREPROD ? 'dualia-preprod' : 'dualia',
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": IDENTIFIANT,
      "infoPlist": {
        // Dualia n'utilise que le chiffrement standard (HTTPS) : evite la
        // question sur l'export de cryptographie a chaque envoi sur TestFlight.
        "ITSAppUsesNonExemptEncryption": false
      }
    },
    "android": {
      "package": IDENTIFIANT,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "edgeToEdgeEnabled": true,
      "predictiveBackGestureEnabled": false
    },
    "web": {
      "output": "static"
    },
    "experiments": {
      "baseUrl": EST_PREPROD ? '/Dualia/preprod' : '/Dualia'
    },
    "extra": {
      "eas": {
        "projectId": "3b851b01-1806-483f-bcb5-21b9de9408c9"
      }
    },
    "plugins": [
      "expo-router",
      "expo-font",
      [
        "expo-image-picker",
        {
          "photosPermission": "Dualia accède à vos photos pour joindre un ticket, un justificatif ou un souvenir.",
          "cameraPermission": "Dualia utilise l'appareil photo pour scanner un ticket ou un justificatif."
        }
      ]
    ]
  },
};
