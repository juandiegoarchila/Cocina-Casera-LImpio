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
// Mojarra: $16.000 (fijo, sin importar Mesa/Llevar)
// Adiciones: se suman (respetando quantity)

const PRICE_MAP = {
  table:    { normal: 12000, bandeja: 11000 },
  takeaway: { normal: 13000, bandeja: 12000 },
};

// Normaliza 'orderType' a 'table' | 'takeaway'
// PRIORIDAD: tableNumber determina el tipo automáticamente
// - Si tableNumber es 'LLevar', 'llevar', vacío => 'takeaway'
// - Si tableNumber tiene valor (Mesa 1, Mesa 2, etc.) => 'table'
const normalizeOrderType = (val, meal) => {
  // PRIORIDAD 1: Verificar tableNumber primero
  const tableNumber = String(meal?.tableNumber || '').toLowerCase().trim();
  
  if (tableNumber) {
    // Si es llevar
    if (tableNumber === 'llevar' || tableNumber === 'lllevar' || tableNumber === 'para llevar') {
      return 'takeaway';
    }
    // Si tiene número de mesa (Mesa 1, Mesa 2, etc.)
    return 'table';
  }
  
  // PRIORIDAD 2: Si no hay tableNumber, verificar orderType explícito
  const raw = typeof val === 'string' ? val : (val?.name || val?.value || '');
  const lc = String(raw || '').toLowerCase().trim();

  // Mesa
  if (['table', 'mesa', 'para mesa', 'en mesa'].includes(lc)) return 'table';

  // Llevar / Delivery / Domicilio
  if ([
    'takeaway', 'para llevar', 'llevar', 'take away', 'take-away',
    'delivery', 'deliveri', 'deli', 'domicilio', 'domicilios', 'a domicilio'
  ].includes(lc)) return 'takeaway';

  // PRIORIDAD 3: Heurística - si hay dirección (pedido de cliente), tratar como llevar
  const hasAddress =
    !!(meal?.address) ||
    !!(meal?.address?.street) ||
    !!(meal?.address?.phoneNumber) ||
    !!(meal?.address?.name);

  if (hasAddress) return 'takeaway';

  // Por defecto: mesa
  return 'table';
};

// ¿Seleccionó "Solo bandeja"?
const isSoloBandeja = (meal) => {
  const soup = (meal?.soup?.name || '').toLowerCase().trim();
  const replName = (meal?.soupReplacement?.name || '').toLowerCase().trim();
  const replacement = (meal?.soupReplacement?.replacement || '').toLowerCase().trim();

  if (soup === 'solo bandeja') return true;

  // Aceptar 'Remplazo' y 'Reemplazo'
  const includesReplace = replName.includes('remplazo') || replName.includes('reemplazo');
  if (includesReplace && replacement === 'solo bandeja') return true;

  return false;
};

// Suma adiciones respetando la cantidad
const additionsTotal = (meal) =>
  (Array.isArray(meal?.additions) ? meal.additions : [])
    .reduce((sum, it) => sum + Number(it?.price || 0) * Number(it?.quantity || 1), 0);

// Precio por almuerzo (usa orderType + solo bandeja + mojarra)
export const calculateMealPrice = (meal) => {
  if (!meal) {
    console.log('⚠️ calculateMealPrice: meal es null/undefined');
    return 0;
  }

  // Debug completo de la proteína
  console.log('🔍 DEBUG MealCalculations - Proteína:', {
    protein: meal?.protein,
    proteinPrice: meal?.protein?.price,
    proteinPriceType: typeof meal?.protein?.price,
    proteinPriceNumber: Number(meal?.protein?.price || 0)
  });

  // Verificar si la proteína tiene un precio especial configurado
  let proteinPrice = meal?.protein?.price ? Number(meal.protein.price) : 0;
  
  // Fallback: Si la proteína es Mojarra pero no tiene precio, usar 16000
  if (!proteinPrice && meal?.protein?.name?.toLowerCase().includes('mojarra')) {
    proteinPrice = 16000;
    console.log('⚠️ Mojarra detectada sin precio, usando fallback de 16000');
  }
  
  if (proteinPrice > 0) {
    const additions = additionsTotal(meal);
    const total = proteinPrice + additions;
    console.log('✅ Proteína con precio especial:', {
      name: meal?.protein?.name,
      price: proteinPrice,
      additions,
      total
    });
    return total;
  }

  const orderType = normalizeOrderType(meal?.orderType, meal);
  const kind = isSoloBandeja(meal) ? 'bandeja' : 'normal';
  const base = PRICE_MAP[orderType]?.[kind] ?? PRICE_MAP.table.normal;
  const additions = additionsTotal(meal);
  const total = base + additions;

  return total;
};

// Total de todos los almuerzos
export const calculateTotal = (meals, userRole = null) => {
  if (!Array.isArray(meals)) {
    console.error('Error: meals no es un arreglo:', meals);
    return 0;
  }
  
  const result = meals.reduce((sum, meal) => sum + calculateMealPrice(meal), 0);
  console.log('💰 Total calculado:', result);
  
  return result;
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
