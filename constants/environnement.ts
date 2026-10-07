// constants/environnement.ts
//
// Le seul endroit qui connaisse les deux environnements de Dualia.
//
// L'environnement est choisi a la COMPILATION par EXPO_PUBLIC_ENV (pose par
// deploy-dualia.ps1 -Cible ...). Toute valeur autre que 'preprod' donne la
// production : un oubli ne peut jamais pointer en silence sur la pre-prod.
//
// Les valeurs de chaque environnement sont ecrites ici en entier, et non
// assemblees depuis plusieurs variables : un environnement a moitie configure
// (le backend de pre-prod, la base de prod) serait pire qu'un environnement
// faux, parce qu'il aurait l'air de marcher.
//
// Chaque constante est un ternaire sur EST_PREPROD, et non une lecture dans un
// objet : Expo remplace process.env.EXPO_PUBLIC_ENV par sa valeur a la
// compilation, le minifieur replie le test, et la branche inutile disparait du
// bundle. L'export de prod ne contient ainsi aucune adresse de pre-prod, et
// inversement.
//
// Les cles publiables sont publiques par conception (protegees par RLS) :
// elles peuvent vivre dans le code. Aucune cle secrete ici, jamais.

const EST_PREPROD = process.env.EXPO_PUBLIC_ENV === 'preprod';

export type Environnement = 'prod' | 'preprod';

export const ENVIRONNEMENT: Environnement = EST_PREPROD ? 'preprod' : 'prod';

// Fonctions serverless (dualia-backend sur Vercel), sans barre finale.
export const BACKEND_URL = EST_PREPROD
  ? 'https://dualia-backend-preprod.vercel.app'
  : 'https://dualia-backend.vercel.app';

export const SUPABASE_URL = EST_PREPROD
  ? 'https://xslwdcbkfdqceukmvjdl.supabase.co'
  : 'https://fnnynyztyujxvpbakvpp.supabase.co';

export const SUPABASE_PUBLISHABLE_KEY = EST_PREPROD
  ? 'sb_publishable_8ZLJ11V6KI6qBc-qnA01Kw_ArqApoQ_'
  : 'sb_publishable_dtbV4IR77FAKU97gj_SXUg_G_X2vVEi';

// Chemin sous lequel GitHub Pages sert l'application (experiments.baseUrl de
// app.config.js), sans barre finale.
export const CHEMIN_BASE = EST_PREPROD ? '/Dualia/preprod' : '/Dualia';

// Adresse publique de l'application, sans barre finale. Les e-mails Supabase
// (confirmation, mot de passe oublie) et les liens d'invitation y ramenent :
// en pre-prod, ils doivent ramener en pre-prod.
export const URL_APPLICATION = `https://rferreirafr1409.github.io${CHEMIN_BASE}`;

// Prod et pre-prod partagent la meme origine (rferreirafr1409.github.io), donc
// le meme localStorage. Sans suffixe, le cache local de la pre-prod ecraserait
// celui de la prod dans le meme navigateur. La prod garde ses cles d'origine.
export const SUFFIXE_STOCKAGE = EST_PREPROD ? '-preprod' : '';

// Texte du bandeau affiche sur tous les ecrans (components/BandeauEnvironnement),
// ou null en production. Le texte vit ici, et non dans le composant, pour que
// le bundle de prod n'en garde aucune trace.
export const LIBELLE_BANDEAU: string | null = EST_PREPROD ? 'PRÉ-PROD' : null;
