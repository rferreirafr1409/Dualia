// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Force Metro à utiliser les builds CommonJS des packages plutôt que leurs
// builds ESM modernes. Nécessaire car certaines dépendances (zustand v5
// notamment) exposent une version ESM contenant `import.meta`, une syntaxe
// que Hermes/le bundle web ne supporte pas — leur version CommonJS
// équivalente n'a pas ce problème. Corrige l'erreur "Cannot use
// 'import.meta' outside a module".
config.resolver.unstable_conditionNames = ['browser', 'require', 'react-native'];

module.exports = config;