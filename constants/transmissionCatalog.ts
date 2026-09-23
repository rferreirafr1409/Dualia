// Catalogue statique des items par défaut de la checklist de transmission.
// Chaque famille peut désactiver un item par défaut (ligne dans
// transmission_items_config avec actif=false) ou en ajouter des personnalisés
// (est_personnalise=true, avec un label propre). Un item par défaut sans
// ligne en base est simplement affiché tel quel, dans cet ordre.

export type ItemTransmissionDefaut = {
  id: string;
  icone: string;
  label: string;
};

export const ITEMS_TRANSMISSION_DEFAUT: ItemTransmissionDefaut[] = [
  { id: 'affaires', icone: '👕', label: 'Affaires (vêtements, chaussures)' },
  { id: 'cartable', icone: '🎒', label: "Cartable / affaires d'école" },
  { id: 'doudou', icone: '🧸', label: 'Doudou / objet transitionnel' },
  { id: 'medicaments', icone: '💊', label: 'Médicaments en cours' },
  { id: 'carnet_sante', icone: '📕', label: 'Carnet de santé' },
  { id: 'chargeur', icone: '🔌', label: 'Chargeur / appareil électronique' },
];