// src/utils/orderUnits.js
// Utilidades para contar unidades de almuerzo dentro de un pedido.
// Estrategia por prioridad:
// 1. Campo explícito: lunchCount / almuerzos / unidadesAlmuerzo
// 2. Array meals: longitud filtrada por tipo (si existe mealType / type / category)
// 3. Texto resumen: buscar patrones "🍽 X almuerzos" o "X almuerzos".
// 4. Heurística precio: dividir por precios típicos (13000,12000,16000) o rango [min*n, max*n].
// 5. Fallback: 1 unidad si total válido > 0.

const UNIT_PRICES = [13000, 12000, 16000];
const MIN_PRICE = 12000;
const MAX_PRICE = 16000;

// Detector liviano de desayuno para evitar contar breakfasts como almuerzo.
export function isBreakfastOrderLight(o) {
  if (!o) return false;
  if (o.isBreakfast) return true;
  const mealStr = [o.meal, o.type, o.category, o.group, o.tag]
    .filter(Boolean)
    .map(v => (typeof v === 'string' ? v : JSON.stringify(v)))
    .join(' ') + ' ' + (Array.isArray(o.items) ? o.items.map(it => it?.category || it?.type || '').join(' ') : '');
  return /desayun|breakfast/i.test(mealStr);
}

function parseIntSafe(v) {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function extractNumericFromText(text) {
  if (!text || typeof text !== 'string') return null;
  // Buscar patrón con emoji 🍽
  const emojiMatch = text.match(/🍽\s*(\d+)\s*almuerzos?/i);
  if (emojiMatch) return parseInt(emojiMatch[1], 10);
  // Buscar patrón "X almuerzos" (evitar líneas tipo "Almuerzo 1:")
  const genericMatch = text.match(/\b(\d{1,2})\s*almuerzos?\b/i);
  if (genericMatch) return parseInt(genericMatch[1], 10);
  return null;
}

function scanAllStringFieldsForUnits(order) {
  if (!order || typeof order !== 'object') return null;
  for (const [k, v] of Object.entries(order)) {
    if (typeof v === 'string') {
      const num = extractNumericFromText(v);
      if (num != null) return num;
    }
  }
  return null;
}

function priceHeuristic(total) {
  if (!total || total < MIN_PRICE) return total > 0 ? 1 : 0;
  // Exact divisiones primero
  for (const p of UNIT_PRICES) {
    if (total % p === 0) {
      const units = total / p;
      if (units >= 1 && units <= 50) return units; // límite arbitrario
    }
  }
  // Rango flexible: intentar de mayor a menor unidades
  for (let units = 10; units >= 2; units--) {
    if (total >= MIN_PRICE * units && total <= MAX_PRICE * units) {
      return units;
    }
  }
  return 1;
}

export function countLunchUnits(order) {
  if (!order) return 0;
  // No contar desayunos como almuerzo
  if (isBreakfastOrderLight(order)) return 0;

  // 1. Campo explícito
  for (const key of ['lunchCount', 'almuerzos', 'unidadesAlmuerzo', 'almuerzosCount']) {
    const val = order[key];
    if (typeof val === 'number' && val > 0) return val;
    if (typeof val === 'string' && /^\d+$/.test(val)) return parseInt(val, 10);
  }

  // 2. meals array
  if (Array.isArray(order.meals) && order.meals.length > 0) {
    // Filtrar por mealType si existe para evitar items no almuerzo
    const filtered = order.meals.filter(m => {
      const typeStr = [m?.mealType, m?.type, m?.category].filter(Boolean).join(' ').toLowerCase();
      if (!typeStr) return true; // asumir almuerzo si no hay info
      return !/desayun|breakfast/.test(typeStr);
    });
    if (filtered.length > 0) return filtered.length;
  }

  // 3. Texto resumen
  const unitsFromText = scanAllStringFieldsForUnits(order);
  if (unitsFromText != null && unitsFromText > 0) return unitsFromText;

  // 4. Heurística de precio
  const total = parseIntSafe(order.total);
  if (total > 0) return priceHeuristic(total);

  // 5. Fallback
  return 1;
}

// Cuenta unidades de almuerzo en un array de pedidos (excluye desayunos)
export function sumLunchUnits(orders = []) {
  return orders.reduce((acc, o) => acc + countLunchUnits(o), 0);
}
