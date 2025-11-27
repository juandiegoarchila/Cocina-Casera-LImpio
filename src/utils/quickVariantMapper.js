// utils/quickVariantMapper.js
// Convierte variantes rápidas en objetos meal/breakfast iniciales.
// Catálogos (soups, proteins, etc.) se pasan para intentar mapear nombres.

export const quickVariantToMeal = (variant, catalogs) => {
  const { proteins = [], soups = [] } = catalogs || {};
  const findProtein = (name) => proteins.find(p => p.name?.toLowerCase() === name.toLowerCase()) || null;
  const findSoup = (name) => soups.find(s => s.name?.toLowerCase() === name.toLowerCase()) || null;

  const base = {
    soup: null,
    soupReplacement: null,
    principle: [],
    protein: null,
    drink: null,
    sides: [],
    additions: [],
    notes: ''
  };

  switch (variant) {
    case 'normal':
      return { ...base, soup: soups[0] || null };
    case 'sin_sopa':
    case 'solo_bandeja':
      return { ...base, soup: null, notes: 'Rápido: Sin sopa' };
    case 'mojarra':
      return { ...base, soup: soups[0] || null, protein: findProtein('Mojarra') };
    case 'pechuga_gratinada':
      return { ...base, soup: soups[0] || null, protein: findProtein('Pechuga gratinada') };
    case 'pechuga_asada':
      return { ...base, soup: soups[0] || null, protein: findProtein('Pechuga asada') };
    default:
      return base;
  }
};

export const quickVariantToBreakfast = (variant, catalogs) => {
  const { breakfastBroths = [], breakfastProteins = [], breakfastTypes = [] } = catalogs || {};
  const findBroth = (name) => breakfastBroths.find(b => b.name?.toLowerCase() === name.toLowerCase()) || null;
  const findProtein = (name) => breakfastProteins.find(p => p.name?.toLowerCase() === name.toLowerCase()) || null;
  const findType = (name) => breakfastTypes.find(t => t.name?.toLowerCase() === name.toLowerCase()) || null;

  const base = {
    broth: null,
    eggs: null,
    type: null,
    protein: null,
    drink: null,
    riceBread: null,
    additions: [],
    notes: ''
  };

  switch (variant) {
    case 'desayuno_costilla':
      return { ...base, broth: findBroth('Costilla'), type: findType('Desayuno completo') };
    case 'desayuno_pescado':
      return { ...base, broth: findBroth('Pescado'), type: findType('Desayuno completo') };
    case 'desayuno_pata':
      return { ...base, broth: findBroth('Pata'), type: findType('Desayuno completo') };
    case 'desayuno_pajarilla':
      return { ...base, broth: findBroth('Pajarilla'), type: findType('Desayuno completo') };
    case 'solo_caldo_costilla':
      return { ...base, broth: findBroth('Costilla'), notes: 'Rápido: Solo caldo' };
    case 'solo_huevos':
      return { ...base, eggs: { name: 'Huevos', quantity: 2 }, notes: 'Rápido: Solo huevos' };
    default:
      return base;
  }
};
