// src/utils/BreakfastCalculations.js

// Precios fijos de las adiciones
const ADDITIONS_PRICES = {
  'chocolate': 3000,
  'pan': 500,
  'arepita': 1000,
  'porción de arroz': 3000,
  'coca cola 1.5lt pet': 8000,
  'cafe con leche': 3000,
  'coca-cola 350ml vir': 3000,
  'bebida adicional': 1000,
  'agua brisa pet 600ml': 2000,
  'proteína adicional': 5000
};

// Constantes para tipos de orden
const ORDER_TYPE = {
  TABLE: 'table',
  TAKEAWAY: 'takeaway'
};

export const calculateBreakfastPrice = (breakfast, userRole, breakfastTypes = []) => {
  // Validación inicial
  if (!breakfast || !breakfast.type || !breakfast.type.name) {
    console.log('[BreakfastCalculations] ❌ No hay desayuno o tipo definido');
    return 0;
  }

  // Logging inicial
  console.log('🔍 [BreakfastCalculations] Iniciando cálculo:', {
    desayuno: breakfast?.type?.name,
    adicionales: breakfast?.additions
  });

  const typeName = breakfast.type.name.toLowerCase().trim();
  const brothName = (breakfast.broth?.name || '').toLowerCase().trim();
  const orderType = breakfast.orderType || 'takeaway';

  const priceMap = {
    'solo huevos': { default: { mesa: 7000, llevar: 8000 } },
    'solo caldo': {
      'caldo de costilla': { mesa: 7000, llevar: 8000 },
      'caldo de pescado': { mesa: 7000, llevar: 8000 },
      'caldo de pata': { mesa: 8000, llevar: 9000 },
      'caldo de pajarilla': { mesa: 9000, llevar: 10000 },
      default: { mesa: 7000, llevar: 8000 },
    },
    'desayuno completo': {
      'caldo de costilla': { mesa: 11000, llevar: 12000 },
      'caldo de pescado': { mesa: 11000, llevar: 12000 },
      'caldo de pata': { mesa: 12000, llevar: 13000 },
      'caldo de pajarilla': { mesa: 13000, llevar: 14000 },
      default: { mesa: 11000, llevar: 12000 },
    },
    'moñona': { default: { mesa: 13000, llevar: 14000 } },
  };

  let basePrice = 0;
  if (priceMap[typeName]) {
    const priceCategory = priceMap[typeName];
    if (typeName === 'solo caldo' || typeName === 'desayuno completo') {
      const brothPrice = priceCategory[brothName] || priceCategory.default;
      basePrice = orderType === 'table' ? brothPrice.mesa : brothPrice.llevar;
    } else {
      const defaultPrice = priceCategory.default;
      basePrice = orderType === 'table' ? defaultPrice.mesa : defaultPrice.llevar;
    }
  } else {
    basePrice = orderType === 'table' ? 7000 : 8000;
  }

  console.log('🔍 [BreakfastCalculations] Precio base calculado:', { 
    typeName, 
    brothName, 
    orderType, 
    basePrice,
    source: 'BreakfastCalculations.js'
  });

  // Calcular precio de adiciones
  let additionsPrice = 0;

  if (breakfast.additions && Array.isArray(breakfast.additions) && breakfast.additions.length > 0) {
    console.log('🔍 [BreakfastCalculations] Procesando adiciones:', breakfast.additions);
    
    additionsPrice = breakfast.additions.reduce((total, addition) => {
      if (!addition) return total;

      // Permitir adiciones en forma de string o de objeto { name, quantity }
      const rawName = typeof addition === 'string' ? addition : addition.name;
      if (!rawName) return total;

      const normalizedName = String(rawName).toLowerCase().trim();
      const mappedPrice = ADDITIONS_PRICES.hasOwnProperty(normalizedName)
        ? ADDITIONS_PRICES[normalizedName]
        : (typeof addition.price === 'number' ? addition.price : 0);

      if (!mappedPrice) {
        console.log('⚠️ [BreakfastCalculations] Precio no encontrado para adición, usando 0:', normalizedName);
      }

      const quantity = (typeof addition.quantity === 'number' && addition.quantity > 0) ? addition.quantity : 1;
      const itemTotal = mappedPrice * quantity;

      console.log('🔍 [BreakfastCalculations] Adición calculada:', {
        nombre: rawName,
        nombreNormalizado: normalizedName,
        precioUsado: mappedPrice,
        cantidad: quantity,
        subtotal: itemTotal
      });

      return total + itemTotal;
    }, 0);

    console.log('🔍 [BreakfastCalculations] Total adiciones:', additionsPrice);
  } else {
    console.log('🔍 [BreakfastCalculations] No hay adiciones para calcular');
  }

  console.log('🔍 [BreakfastCalculations] Precio total adiciones:', additionsPrice);

  const totalPrice = basePrice + additionsPrice;

  console.log('🔍 [BreakfastCalculations] Cálculo final:', {
    type: typeName,
    broth: brothName,
    orderType,
    basePrice,
    additionsPrice,
    totalPrice,
    additions: breakfast.additions,
    source: 'BreakfastCalculations.js'
  });

  if (process.env.NODE_ENV === 'development') {
    console.log(`[BreakfastCalculations] Price for ${typeName}, broth: ${brothName}, orderType: ${orderType}, basePrice: ${basePrice}, totalPrice: ${totalPrice}`);
  }

  return totalPrice;
};

// 🔹 NUEVO: totalizador que faltaba (usado por WaiterDashboard)
export const calculateTotalBreakfastPrice = (breakfasts, userRole, breakfastTypes = []) => {
  console.log('🔍 [BreakfastCalculations] === calculateTotalBreakfastPrice llamado ===');
  console.log('🔍 [BreakfastCalculations] Parámetros:', {
    breakfastsLength: breakfasts?.length || 0,
    userRole,
    breakfastTypesLength: breakfastTypes?.length || 0,
    breakfasts: breakfasts?.map(b => ({
      type: b.type?.name,
      broth: b.broth?.name,
      orderType: b.orderType,
      additions: b.additions
    }))
  });

  if (!Array.isArray(breakfasts)) {
    console.log('🔍 [BreakfastCalculations] ❌ breakfasts no es array:', breakfasts);
    return 0;
  }

  const total = breakfasts.reduce((sum, breakfast, index) => {
    console.log(`🔍 [BreakfastCalculations] Calculando total para desayuno ${index + 1}:`, {
      breakfast: {
        type: breakfast.type?.name,
        broth: breakfast.broth?.name,
        orderType: breakfast.orderType,
        additions: breakfast.additions
      }
    });

    const itemPrice = calculateBreakfastPrice(breakfast, userRole, breakfastTypes);
    
    console.log(`🔍 [BreakfastCalculations] Resultado total individual:`, {
      itemPrice,
      sumAnterior: sum,
      sumNuevo: sum + itemPrice,
      source: 'calculateTotalBreakfastPrice (BreakfastCalculations)'
    });

    return sum + itemPrice;
  }, 0);

  console.log('🔍 [BreakfastCalculations] === TOTAL FINAL calculateTotalBreakfastPrice ===', total);
  return total;
};

export const calculateBreakfastProgress = (breakfast, isTableOrder, isWaitress, breakfastTypes = []) => {
  if (!breakfast || !breakfast.type) {
    return 0;
  }

  const breakfastType = breakfastTypes.find(bt => bt.id === breakfast.type?.id) || { steps: [], requiresProtein: false };
  const currentSteps = breakfastType.steps || [];

  const mandatorySteps = ['type'];
  if (currentSteps.includes('broth')) mandatorySteps.push('broth');
  if (currentSteps.includes('eggs')) mandatorySteps.push('eggs');
  if (currentSteps.includes('riceBread')) mandatorySteps.push('riceBread');
  if (currentSteps.includes('drink')) mandatorySteps.push('drink');
  if (currentSteps.includes('protein') && breakfastType.requiresProtein) mandatorySteps.push('protein');

  if (isTableOrder) {
    mandatorySteps.push('tableNumber', 'payment');
    if (isWaitress) mandatorySteps.push('orderType');
  } else {
    mandatorySteps.push('cutlery', 'time', 'address', 'payment');
  }

  const stepCompleteness = {
    type: !!breakfast?.type,
    broth: !!breakfast?.broth,
    eggs: !!breakfast?.eggs,
    riceBread: !!breakfast?.riceBread,
    drink: !!breakfast?.drink,
    protein: !!breakfast?.protein,
    cutlery: breakfast?.cutlery !== null,
    time: !!breakfast?.time,
    address: !!breakfast?.address?.address,
    payment: !!breakfast?.payment,
    tableNumber: !!breakfast?.tableNumber,
    orderType: !!breakfast?.orderType,
  };

  const completedSteps = mandatorySteps.filter(step => stepCompleteness[step]).length;
  const totalSteps = mandatorySteps.length;
  const percentage = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  if (process.env.NODE_ENV === 'development') {
    console.log(`[BreakfastCalculations] Progress: ${completedSteps}/${totalSteps} steps completed, ${Math.round(percentage)}%`);
  }

  return Math.round(percentage);
};
