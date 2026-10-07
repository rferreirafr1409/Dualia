// app.config.js
//
// Remplace app.json, a l'identique sauf experiments.baseUrl : l'application
// est servie sous /Dualia en production et sous /Dualia/preprod en
// pre-production. L'environnement est choisi a la compilation par
// EXPO_PUBLIC_ENV (voir constants/environnement.ts) ; toute valeur autre que
// 'preprod' donne la production.

const EST_PREPROD = process.env.EXPO_PUBLIC_ENV === 'preprod';

module.exports = {
  expo: {
    "name": "dualia-mvp",
    "slug": "dualia-mvp",
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
      "supportsTablet": true
    },
    "android": {
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
    "plugins": [
      "expo-router",
      "expo-font"
    ]
  },
};
