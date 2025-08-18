// src/utils/MealCalculations.js

// --------------------------------------
// Precios (ALMUERZO) según tipo de orden
// --------------------------------------
// Normal:
//   - Mesa:    $12.000
//   - Llevar:  $13.000
// Solo bandeja:
//   - Mesa:    $11.000
//   - Llevar:  $12.000
// Mojarra: $15.000 (fijo, sin importar Mesa/Llevar)
// Adiciones: se suman (respetando quantity)

const PRICE_MAP = {
  table:    { normal: 12000, bandeja: 11000 },
  takeaway: { normal: 13000, bandeja: 12000 },
};

// Normaliza 'orderType' a 'table' | 'takeaway'
const normalizeOrderType = (val) => {
  if (!val) return 'table';
  const raw = typeof val === 'string' ? val : (val?.name || val?.value || '');
  const lc = String(raw || '').toLowerCase().trim();

  if (['table', 'mesa', 'para mesa', 'en mesa'].includes(lc)) return 'table';
  if (['takeaway', 'para llevar', 'llevar', 'take away', 'take-away'].includes(lc)) return 'takeaway';

  // Por defecto, mesa
  return 'table';
};

// ¿Seleccionó "Solo bandeja"?
const isSoloBandeja = (meal) => {
  const soup = (meal?.soup?.name || '').toLowerCase().trim();
  const replName = (meal?.soupReplacement?.name || '').toLowerCase().trim();
  const replacement = (meal?.soupReplacement?.replacement || '').toLowerCase().trim();

  if (soup === 'solo bandeja') return true;
  // Cuando usan "Remplazo por Sopa" y el replacement es "Solo bandeja"
  if (replName.includes('remplazo') && replacement === 'solo bandeja') return true;

  return false;
};

// Suma adiciones respetando la cantidad
const additionsTotal = (meal) =>
  (Array.isArray(meal?.additions) ? meal.additions : [])
    .reduce((sum, it) => sum + Number(it?.price || 0) * Number(it?.quantity || 1), 0);

// Precio por almuerzo (usa orderType + solo bandeja + mojarra)
export const calculateMealPrice = (meal) => {
  if (!meal) return 0;

  // Mojarra tiene precio base fijo
  const hasMojarra = (meal?.protein?.name || '').toLowerCase().trim() === 'mojarra';
  if (hasMojarra) {
    return 15000 + additionsTotal(meal);
  }

  const orderType = normalizeOrderType(meal?.orderType);
  const kind = isSoloBandeja(meal) ? 'bandeja' : 'normal';
  const base = PRICE_MAP[orderType][kind];

  return base + additionsTotal(meal);
};

// Total de todos los almuerzos
export const calculateTotal = (meals) => {
  if (!Array.isArray(meals)) {
    console.error('Error: meals no es un arreglo:', meals);
    return 0;
  }
  return meals.reduce((sum, meal) => sum + calculateMealPrice(meal), 0);
};

// Resumen por método de pago (acepta string u objeto {name})
export const paymentSummary = (meals) => {
  if (!Array.isArray(meals) || meals.length === 0) return {};
  return meals.reduce((acc, meal) => {
    const price = calculateMealPrice(meal);
    const pm = meal?.payment ?? meal?.paymentMethod ?? 'No especificado';
    const key = typeof pm === 'string' ? pm : (pm?.name || 'No especificado');
    acc[key] = (acc[key] || 0) + price;
    return acc;
  }, {});
};
