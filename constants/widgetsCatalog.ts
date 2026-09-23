// constants/widgetsCatalog.ts
//
// Catalogue statique des widgets disponibles sur la Home. Ce fichier définit
// QUELS widgets existent et leurs métadonnées d'affichage (titre, icône,
// taille). Il ne contient aucune donnée dynamique — les widgets eux-mêmes
// restent des composants dans accueil.tsx, ce catalogue sert uniquement à
// piloter l'écran de configuration ("Personnaliser ma Home") et l'ordre de
// rendu.
//
// Ajouter un nouveau widget = ajouter une entrée ici + son rendu conditionnel
// dans accueil.tsx. Le reste (config utilisateur, persistance Supabase,
// écran de personnalisation) fonctionne automatiquement pour tout widget
// présent dans ce catalogue.

export type WidgetId =
  | 'aujourdhui'
  | 'a_traiter'
  | 'finances'
  | 'leur_semaine'
  | 'souvenir_recent'
  | 'a_anticiper'
  | 'transmission';

export interface WidgetDefinition {
  id: WidgetId;
  titreKey: string; // clé de traduction dans TRADUCTIONS[langue].accueil
  icone: string; // nom d'icône Ionicons
  tailleParDefaut: 'simple' | 'double'; // 'double' = prend toute la largeur d'une rangée
}

export const WIDGETS_CATALOGUE: WidgetDefinition[] = [
  { id: 'aujourdhui', titreKey: 'cockpitAujourdhui', icone: 'calendar-outline', tailleParDefaut: 'simple' },
  { id: 'a_traiter', titreKey: 'cockpitATraiter', icone: 'checkmark-circle-outline', tailleParDefaut: 'simple' },
  { id: 'finances', titreKey: 'attention.financesTitre', icone: 'wallet-outline', tailleParDefaut: 'simple' },
  { id: 'leur_semaine', titreKey: 'leurSemaine', icone: 'calendar-clear-outline', tailleParDefaut: 'simple' },
  { id: 'souvenir_recent', titreKey: 'unSouvenirRecentTitre', icone: 'image-outline', tailleParDefaut: 'simple' },
  { id: 'a_anticiper', titreKey: 'aAnticiperTitre', icone: 'alert-circle-outline', tailleParDefaut: 'simple' },
  { id: 'transmission', titreKey: 'transmissionTitre', icone: 'swap-horizontal-outline', tailleParDefaut: 'simple' },
];

// Ordre et visibilité par défaut pour un nouveau parent (avant toute
// personnalisation) — reproduit l'ordre actuel de la Home.
export const CONFIG_WIDGETS_PAR_DEFAUT: { widgetId: WidgetId; position: number; visible: boolean }[] =
  WIDGETS_CATALOGUE.map((w, index) => ({ widgetId: w.id, position: index, visible: true }));