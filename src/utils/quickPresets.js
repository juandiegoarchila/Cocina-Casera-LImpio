// utils/quickPresets.js
// Presets rápidos para almuerzo y desayuno. Se pueden mover a Firestore luego.
export const lunchQuickPresets = [
  { id: 'almuerzo-completo', name: 'Almuerzo Completo', variant: 'normal', baseType: 'almuerzo', price: 12000 },
  { id: 'almuerzo-sin-sopa', name: 'Sin Sopa', variant: 'sin_sopa', baseType: 'almuerzo', price: 11000 },
  { id: 'almuerzo-mojarra', name: 'Mojarra', variant: 'mojarra', baseType: 'almuerzo', price: 16000 },
  { id: 'almuerzo-pechuga-gratinada', name: 'Pechuga Gratinada', variant: 'pechuga_gratinada', baseType: 'almuerzo', price: 14000 },
  { id: 'almuerzo-pechuga-asada', name: 'Pechuga Asada', variant: 'pechuga_asada', baseType: 'almuerzo', price: 12000 },
  { id: 'almuerzo-solo-bandeja', name: 'Solo Bandeja', variant: 'solo_bandeja', baseType: 'almuerzo', price: 11000 }
];

export const breakfastQuickPresets = [
  { id: 'desayuno-costilla', name: 'Desayuno Costilla', variant: 'desayuno_costilla', baseType: 'desayuno', price: 12000 },
  { id: 'desayuno-pescado', name: 'Desayuno Pescado', variant: 'desayuno_pescado', baseType: 'desayuno', price: 12000 },
  { id: 'desayuno-pata', name: 'Desayuno Pata', variant: 'desayuno_pata', baseType: 'desayuno', price: 13000 },
  { id: 'desayuno-pajarilla', name: 'Desayuno Pajarilla', variant: 'desayuno_pajarilla', baseType: 'desayuno', price: 14000 },
  { id: 'solo-caldo-costilla', name: 'Solo Caldo Costilla', variant: 'solo_caldo_costilla', baseType: 'desayuno', price: 8000 },
  { id: 'solo-huevos', name: 'Solo Huevos', variant: 'solo_huevos', baseType: 'desayuno', price: 8000 }
];

export const getQuickPresets = (mode) => mode === 'desayuno' ? breakfastQuickPresets : lunchQuickPresets;
