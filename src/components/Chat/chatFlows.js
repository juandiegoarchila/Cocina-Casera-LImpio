// src/components/Chat/chatFlows.js
// Genera flujos de conversación DINÁMICOS a partir de datos reales de Firestore
// Cada tipo de desayuno usa su propio array de steps (broth, eggs, riceBread, drink, protein)

import { calculateMealPrice } from '../../utils/MealCalculations';
import { calculateBreakfastPrice } from '../../utils/BreakfastLogic';

export const TYPING_DELAY = 800;

// ─── Helpers ──────────────────────────────────────────────
function fmtPrice(p) {
  return p ? `$${Number(p).toLocaleString('es-CO')}` : '';
}

function fmtTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const period = h >= 12 ? 'pm' : 'am';
  const fh = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  return `${fh}:${m.toString().padStart(2, '0')}${period}`;
}

function sanitizeId(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
}

// Lee dirección guardada del localStorage (misma key que AddressInput)
function getSavedAddress() {
  try {
    const raw = localStorage.getItem('addressForm');
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.streetNumber && data.houseNumber && data.phoneNumber) return data;
    return null;
  } catch { return null; }
}

function formatSavedAddress(a) {
  let s = `${a.streetType || 'Calle'} ${a.streetNumber} # ${a.houseNumber}`;
  if (a.neighborhood) s += `\n📍 Barrio: ${a.neighborhood}`;
  if (a.details) s += `\n📝 Instrucciones: ${a.details}`;
  s += `\n📱 Teléfono: ${a.phoneNumber}`;
  return s;
}

function formatAddressOnly(a) {
  let s = `${a.streetType || 'Calle'} ${a.streetNumber} # ${a.houseNumber}`;
  if (a.neighborhood) s += `, Barrio: ${a.neighborhood}`;
  if (a.details) s += ` - ${a.details}`;
  return s;
}

// ─── Generador de flujos dinámicos ────────────────────────
export function buildDynamicFlows(menuData) {
  const {
    soups = [], soupReplacements = [], proteins = [], principles = [], drinks = [], sides = [], additions = [],
    breakfastTypes = [], breakfastEggs = [], breakfastBroths = [], breakfastDrinks = [],
    breakfastProteins = [], breakfastAdditions = [], breakfastRiceBread = [],
    breakfastTimes = [],
    paymentMethods = [],
    schedules = { breakfastStart: 420, breakfastEnd: 631, lunchStart: 632, lunchEnd: 950 },
    isOrderingDisabled = false, getCurrentMenuType,
  } = menuData;

  const menuType = getCurrentMenuType ? getCurrentMenuType() : 'closed';
  const scheduleText = `🥐 Desayunos: ${fmtTime(schedules.breakfastStart)} - ${fmtTime(schedules.breakfastEnd)}\n🍲 Almuerzos: ${fmtTime(schedules.lunchStart)} - ${fmtTime(schedules.lunchEnd)}`;

  const av = (arr) => arr.filter(i => !i.isFinished);
  const fin = (arr) => arr.filter(i => i.isFinished);
  const realSoups = soups.filter(s => s.name !== 'Remplazo por Sopa');
  const realPrinciples = principles.filter(p => p.name !== 'Remplazo por Principio');
  const avSoupReplacements = av(soupReplacements);

  const avSoups = av(realSoups);
  const avProteins = av(proteins);
  const avPrinciples = av(realPrinciples);
  const avDrinks = av(drinks);
  const avSides = av(sides);
  const avSidesForOrder = avSides.filter(s => s.name !== 'Todo incluído' && s.name !== 'Ninguno');
  const avAdditions = av(additions);
  const finSoups = fin(realSoups);
  const finProteins = fin(proteins);
  const finDrinks = fin(drinks);
  const finPrinciples = fin(realPrinciples);
  const finSidesForOrder = fin(sides).filter(s => s.name !== 'Todo incluído' && s.name !== 'Ninguno');
  const finAdditions = fin(additions);

  const avBfTypes = av(breakfastTypes);
  const avBfEggs = av(breakfastEggs);
  const avBfBroths = av(breakfastBroths);
  const avBfDrinks = av(breakfastDrinks);
  const avBfProteins = av(breakfastProteins);
  const avBfAdditions = av(breakfastAdditions);
  const avBfRiceBread = av(breakfastRiceBread);
  const avBfTimes = av(breakfastTimes);
  const finBfTypes = fin(breakfastTypes);
  const finBfEggs = fin(breakfastEggs);
  const finBfBroths = fin(breakfastBroths);
  const finBfDrinks = fin(breakfastDrinks);
  const finBfProteins = fin(breakfastProteins);
  const finBfAdditions = fin(breakfastAdditions);
  const finBfRiceBread = fin(breakfastRiceBread);
  const avPaymentMethods = av(paymentMethods);

  const savedAddr = getSavedAddress();

  const flows = {};

  // ═══════════════════════════════════════
  // WELCOME
  // ═══════════════════════════════════════
  flows.welcome = {
    id: 'welcome',
    resetsOrder: true, // ChatWidget usará esto para resetear selecciones
    messages: (() => {
      const m = ['Bienvenidos al canal oficial de Cocina Casera 💛🍽️'];
      if (isOrderingDisabled || menuType === 'closed') {
        m.push('🚫 En este momento estamos cerrados.');
        m.push(`⏰ Nuestros horarios de atención:\n${scheduleText}`);
        m.push('¡Te esperamos mañana! 🙌');
      }
      else if (menuType === 'breakfast') m.push('🥐 Estamos en horario de desayunos. ¿Qué te gustaría hacer?');
      else if (menuType === 'lunch') m.push('🍲 Estamos en horario de almuerzos. ¿Qué te gustaría hacer?');
      return m;
    })(),
    options: (() => {
      const o = [];
      if (isOrderingDisabled || menuType === 'closed') {
        o.push({ label: 'Ver horarios', icon: '⏰', nextFlow: 'faqSchedule' });
        o.push({ label: 'Tengo una pregunta', icon: '❓', nextFlow: 'faqTopics' });
        return o;
      }
      if (menuType === 'breakfast') {
        o.push({ label: 'Pedir desayuno', icon: '🥐', nextFlow: 'orderBreakfast' });
        o.push({ label: 'Ver menú desayunos', icon: '📋', nextFlow: 'breakfastFullMenu' });
      } else if (menuType === 'lunch') {
        o.push({ label: 'Pedir almuerzo', icon: '🍲', nextFlow: 'orderLunch' });
        o.push({ label: 'Ver menú almuerzos', icon: '📋', nextFlow: 'lunchFullMenu' });
      }
      o.push({ label: 'Tengo una pregunta', icon: '❓', nextFlow: 'faqTopics' });
      return o;
    })(),
  };

  // ═══════════════════════════════════════
  // ALMUERZO – Menú completo
  // ═══════════════════════════════════════
  flows.lunchFullMenu = {
    id: 'lunchFullMenu',
    messages: (() => {
      const m = ['📋 Menú del día - Almuerzo:'];
      if (realSoups.length > 0) {
        let t = '🥣 Sopas:\n' + avSoups.map(s => `  • ${s.name}`).join('\n');
        if (finSoups.length > 0) t += '\n  🚫 Agotadas: ' + finSoups.map(s => s.name).join(', ');
        m.push(t);
      }
      if (proteins.length > 0) {
        let t = '🥩 Proteínas:\n' + avProteins.map(p => `  • ${p.name}${p.price ? ` (${fmtPrice(p.price)})` : ''}`).join('\n');
        if (finProteins.length > 0) t += '\n  🚫 Agotadas: ' + finProteins.map(p => p.name).join(', ');
        m.push(t);
      }
      if (realPrinciples.length > 0) {
        let t = '🍚 Principios:\n' + avPrinciples.map(p => `  • ${p.name}`).join('\n');
        if (finPrinciples.length > 0) t += '\n  🚫 Agotados: ' + finPrinciples.map(p => p.name).join(', ');
        m.push(t);
      }
      if (drinks.length > 0) {
        let t = '🥤 Bebidas:\n' + avDrinks.map(d => `  • ${d.name}${d.price ? ` (${fmtPrice(d.price)})` : ''}`).join('\n');
        if (finDrinks.length > 0) t += '\n  🚫 Agotadas: ' + finDrinks.map(d => d.name).join(', ');
        m.push(t);
      }
      if (sides.length > 0) {
        let t = '🥗 Acompañamientos:\n' + avSides.map(s => `  • ${s.name}${s.price ? ` (${fmtPrice(s.price)})` : ''}`).join('\n');
        if (finSidesForOrder.length > 0) t += '\n  🚫 Agotados: ' + finSidesForOrder.map(s => s.name).join(', ');
        m.push(t);
      }
      if (additions.length > 0) {
        let t = '🍗 Adiciones:\n' + avAdditions.map(a => `  • ${a.name}${a.price ? ` (${fmtPrice(a.price)})` : ''}`).join('\n');
        if (finAdditions.length > 0) t += '\n  🚫 Agotadas: ' + finAdditions.map(a => a.name).join(', ');
        m.push(t);
      }
      m.push(scheduleText);
      return m;
    })(),
    options: [
      ...(menuType === 'lunch' ? [{ label: 'Ordenar almuerzo', icon: '🍲', nextFlow: 'orderLunch' }] : []),
      { label: 'Ver menú desayunos', icon: '🥐', nextFlow: 'breakfastFullMenu' },
      { label: '← Volver al inicio', icon: '🏠', nextFlow: 'welcome' },
    ],
  };

  // ═══════════════════════════════════════
  // ALMUERZO – Flujo paso a paso
  // ═══════════════════════════════════════
  flows.orderLunch = {
    id: 'orderLunch', selectionField: 'soup',
    messages: ['🍲 ¡Vamos a armar tu almuerzo!', avSoups.length > 0 ? `Elige tu sopa (${avSoups.length} disponible${avSoups.length > 1 ? 's' : ''}):` : '⚠️ No hay sopas disponibles ahora.'],
    options: (() => {
      const o = avSoups.map(s => ({
        label: s.name === 'Solo bandeja' ? 'Solo bandeja (sin sopa)' : s.name,
        icon: s.name === 'Solo bandeja' ? '🍽️' : '🥣',
        nextFlow: 'lunchPrinciple',
        itemData: s,
      }));
      // Remplazo por Sopa option
      if (avSoupReplacements.length > 0) {
        const soupReplacementObj = soups.find(s => s.name === 'Remplazo por Sopa');
        o.push({ label: 'Remplazo por Sopa', icon: '🔄', nextFlow: 'lunchSoupReplacement', itemData: soupReplacementObj || null });
      }
      finSoups.forEach(s => o.push({ label: (s.name === 'Solo bandeja' ? 'Solo bandeja' : s.name) + ' — AGOTADO', icon: '🚫', isSoldOut: true }));
      o.push({ label: '← Volver', icon: '↩️', nextFlow: 'welcome' });
      return o;
    })(),
  };

  // Remplazo por Sopa – elegir el remplazo
  if (avSoupReplacements.length > 0) {
    flows.lunchSoupReplacement = {
      id: 'lunchSoupReplacement', selectionField: 'soupReplacement',
      messages: ['🔄 Elige tu remplazo de sopa:'],
      options: (() => {
        const o = avSoupReplacements.map(r => ({
          label: r.name, icon: '🥣', nextFlow: 'lunchPrinciple', itemData: r,
        }));
        o.push({ label: '← Volver a sopas', icon: '↩️', nextFlow: 'orderLunch' });
        return o;
      })(),
    };
  }

  flows.lunchPrinciple = {
    id: 'lunchPrinciple', selectionField: 'principle',
    multiSelect: true, maxSelections: 2,
    messages: ['✅ ¡Sopa seleccionada!', avPrinciples.length > 0 ? `🍚 Elige tu principio (puedes elegir hasta 2):\n${avPrinciples.length} disponible${avPrinciples.length > 1 ? 's' : ''}` : '⚠️ No hay principios disponibles.'],
    options: (() => {
      const o = avPrinciples.map(p => ({ label: p.name, icon: '🍚', itemData: p }));
      // Remplazo por Principio option
      if (avSoupReplacements.length > 0) {
        o.push({ label: 'Remplazo por Principio', icon: '🔄', nextFlow: 'lunchPrincipleReplacement', isBack: true });
      }
      finPrinciples.forEach(p => o.push({ label: p.name + ' — AGOTADO', icon: '🚫', isSoldOut: true }));
      o.push({ label: 'Confirmar principio', icon: '✅', nextFlow: 'lunchProtein', isConfirm: true });
      o.push({ label: '← Volver a sopas', icon: '↩️', nextFlow: 'orderLunch', isBack: true });
      return o;
    })(),
  };

  // Remplazo por Principio – elegir el remplazo
  if (avSoupReplacements.length > 0) {
    flows.lunchPrincipleReplacement = {
      id: 'lunchPrincipleReplacement', selectionField: 'principleReplacement',
      messages: ['🔄 Elige tu remplazo de principio:'],
      options: (() => {
        const o = avSoupReplacements.map(r => ({
          label: r.name, icon: '🍚', nextFlow: 'lunchProtein', itemData: r,
        }));
        o.push({ label: '← Volver a principio', icon: '↩️', nextFlow: 'lunchPrinciple' });
        return o;
      })(),
    };
  }

  flows.lunchProtein = {
    id: 'lunchProtein', selectionField: 'protein',
    messages: ['✅ ¡Principio seleccionado!', avProteins.length > 0 ? `Elige tu proteína (${avProteins.length} disponible${avProteins.length > 1 ? 's' : ''}):` : '⚠️ No hay proteínas disponibles.'],
    options: (() => {
      const o = avProteins.map(p => ({ label: p.name + (p.price ? ` (${fmtPrice(p.price)})` : ''), icon: '🥩', nextFlow: 'lunchDrink', itemData: p }));
      finProteins.forEach(p => o.push({ label: p.name + (p.price ? ` (${fmtPrice(p.price)})` : '') + ' — AGOTADO', icon: '🚫', isSoldOut: true }));
      o.push({ label: '← Volver a principio', icon: '↩️', nextFlow: 'lunchPrinciple' });
      return o;
    })(),
  };

  flows.lunchDrink = {
    id: 'lunchDrink', selectionField: 'drink',
    messages: ['✅ ¡Proteína seleccionada!', avDrinks.length > 0 ? `¿Qué bebida quieres? (${avDrinks.length} disponible${avDrinks.length > 1 ? 's' : ''}):` : '⚠️ No hay bebidas disponibles.'],
    options: (() => {
      const o = avDrinks.map(d => ({ label: d.name + (d.price ? ` (${fmtPrice(d.price)})` : ''), icon: '🥤', nextFlow: 'lunchCutlery', itemData: d }));
      finDrinks.forEach(d => o.push({ label: d.name + (d.price ? ` (${fmtPrice(d.price)})` : '') + ' — AGOTADO', icon: '🚫', isSoldOut: true }));
      o.push({ label: '← Volver a proteína', icon: '↩️', nextFlow: 'lunchProtein' });
      return o;
    })(),
  };

  // ═══════════════════════════════════════
  // ALMUERZO – Pasos comunes: cubiertos → hora → dirección → acuerdo → pago → acompañamiento → notas → adiciones → confirmar
  // ═══════════════════════════════════════
  flows.lunchCutlery = {
    id: 'lunchCutlery', selectionField: 'cutlery',
    messages: ['✅ ¡Bebida seleccionada!', '🍴 ¿Necesitas cubiertos?'],
    options: [
      { label: 'Sí, por favor', icon: '🍴', nextFlow: 'lunchTimeStep' },
      { label: 'No, gracias', icon: '👌', nextFlow: 'lunchTimeStep' },
      { label: '← Volver', icon: '↩️', nextFlow: 'lunchDrink' },
    ],
  };

  flows.lunchTimeStep = {
    id: 'lunchTimeStep', selectionField: 'time',
    messages: ['✅ ¡Cubiertos anotados!', '🕒 ¿Para qué hora quieres tu almuerzo?'],
    options: [
      { label: 'Lo más pronto posible', icon: '⚡', nextFlow: savedAddr ? 'lunchAddressConfirm' : 'lunchAddressStep' },
      { label: '12:00 PM', icon: '🕐', nextFlow: savedAddr ? 'lunchAddressConfirm' : 'lunchAddressStep' },
      { label: '12:30 PM', icon: '🕐', nextFlow: savedAddr ? 'lunchAddressConfirm' : 'lunchAddressStep' },
      { label: '1:00 PM', icon: '🕐', nextFlow: savedAddr ? 'lunchAddressConfirm' : 'lunchAddressStep' },
      { label: '1:30 PM', icon: '🕐', nextFlow: savedAddr ? 'lunchAddressConfirm' : 'lunchAddressStep' },
      { label: '← Volver', icon: '↩️', nextFlow: 'lunchCutlery' },
    ],
  };

  // Dirección guardada → confirmar
  if (savedAddr) {
    flows.lunchAddressConfirm = {
      id: 'lunchAddressConfirm', selectionField: 'address',
      messages: ['✅ ¡Hora registrada!', `📍 Tu dirección guardada:\n${formatSavedAddress(savedAddr)}`, '¿Es correcta?'],
      options: [
        { label: 'Sí, es correcta', icon: '✅', nextFlow: 'lunchAgreementStep', selectionValue: formatAddressOnly(savedAddr), extraSelections: { phone: savedAddr.phoneNumber } },
        { label: 'No, quiero cambiarla', icon: '✏️', nextFlow: 'lunchAddressStep' },
      ],
    };
  }

  flows.lunchAddressStep = {
    id: 'lunchAddressStep', selectionField: 'address',
    messages: [savedAddr ? '✏️ Escribe tu nueva dirección:' : '✅ ¡Hora registrada!\n📍 Escribe tu dirección completa para el domicilio:'],
    options: [],
    expectsInput: true,
    inputPlaceholder: 'Ej: Calle 137 #128b-01, Barrio...',
    nextFlowAfterInput: 'lunchPhoneStep',
  };

  flows.lunchPhoneStep = {
    id: 'lunchPhoneStep', selectionField: 'phone',
    messages: ['✅ ¡Dirección guardada!', '📱 Escribe tu número de teléfono:'],
    options: [],
    expectsInput: true,
    inputPlaceholder: 'Ej: 3001234567',
    nextFlowAfterInput: 'lunchAgreementStep',
  };

  flows.lunchAgreementStep = {
    id: 'lunchAgreementStep', selectionField: 'agreement',
    messages: [
      '🤝 Acuerdo de Entrega:',
      '⏱️ Tiempo estimado: 25-30 min desde confirmación de salida.\n🧾 Pago por transferencia: tu pedido se prepara al recibir comprobante.\n🏢 Entregas en portería o entrada principal.',
    ],
    options: [
      { label: 'Ver más detalles', icon: '📋', nextFlow: 'lunchAgreementDetails' },
      { label: '¡Acepto!', icon: '✅', nextFlow: 'lunchPaymentStep' },
      { label: 'Cancelar pedido', icon: '❌', nextFlow: 'welcome' },
    ],
  };

  flows.lunchAgreementDetails = {
    id: 'lunchAgreementDetails', selectionField: 'agreement',
    messages: [
      '📋 Detalles completos del acuerdo:',
      '⏱️ El tiempo puede variar según zona, tráfico y clima.\n\n👩‍🍳 Preparación al momento: Si deseas que tu pedido llegue a la hora indicada, te recomendamos pedir con 30 min a 1 hora de anticipación.\n\n📲 Confirmación de salida: El domiciliario confirmará cuando salga con tu pedido.\n\n⚖️ Compromiso con todos: Atendemos en orden de llegada. Agradecemos tu paciencia.\n\n🌧️ Retrasos externos: Factores como lluvia o congestión pueden causar demoras adicionales.',
      '¿Aceptas las condiciones?',
    ],
    options: [
      { label: '¡Acepto! Entiendo las condiciones', icon: '✅', nextFlow: 'lunchPaymentStep' },
      { label: 'Cancelar pedido', icon: '❌', nextFlow: 'welcome' },
    ],
  };

  flows.lunchPaymentStep = {
    id: 'lunchPaymentStep', selectionField: 'payment',
    messages: ['✅ ¡Condiciones aceptadas!', '💰 ¿Cómo vas a pagar?'],
    options: (() => {
      const afterPay = avSidesForOrder.length > 0 ? 'lunchSides' : 'lunchNotesStep';
      const o = avPaymentMethods.length > 0
        ? avPaymentMethods.map(pm => ({ label: pm.name, icon: '💳', nextFlow: afterPay, itemData: pm }))
        : [
            { label: 'Efectivo', icon: '💵', nextFlow: afterPay },
            { label: 'Nequi', icon: '💳', nextFlow: afterPay },
            { label: 'Daviplata', icon: '💳', nextFlow: afterPay },
          ];
      o.push({ label: '← Volver', icon: '↩️', nextFlow: 'lunchAgreementStep' });
      return o;
    })(),
  };

  if (avSidesForOrder.length > 0) {
    flows.lunchSides = {
      id: 'lunchSides', selectionField: 'sides',
      multiSelect: true,
      messages: ['✅ ¡Pago seleccionado!', '🥗 ¿Qué acompañamientos quieres? (puedes elegir varios):'],
      options: (() => {
        const o = [];
        o.push({ label: 'Todo incluido', icon: '📦', isSelectAll: true });
        avSidesForOrder.forEach(s => o.push({
          label: s.name + (s.price ? ` (${fmtPrice(s.price)})` : ''),
          icon: '🥗', itemData: s,
        }));
        finSidesForOrder.forEach(s => o.push({ label: s.name + (s.price ? ` (${fmtPrice(s.price)})` : '') + ' — AGOTADO', icon: '🚫', isSoldOut: true }));
        o.push({ label: 'Confirmar acompañamiento', icon: '✅', nextFlow: 'lunchNotesStep', isConfirm: true });
        o.push({ label: 'Ninguno', icon: '🚫', nextFlow: 'lunchNotesStep', isNone: true });
        return o;
      })(),
    };
  }

  flows.lunchNotesStep = {
    id: 'lunchNotesStep', selectionField: 'notes',
    messages: ['✅ ¡Selección guardada!', '📝 ¿Tienes alguna nota o instrucción especial?\nEscribe tu nota o presiona "Sin notas":'],
    options: [
      { label: 'Sin notas', icon: '👌', nextFlow: avAdditions.length > 0 ? 'lunchAdditionsStep' : 'lunchAddMore' },
    ],
    expectsInput: true,
    inputPlaceholder: 'Ej: Sin cebolla, extra picante...',
    nextFlowAfterInput: avAdditions.length > 0 ? 'lunchAdditionsStep' : 'lunchAddMore',
  };

  // Additions that require sub-menus (replacement selection)
  const additionsWithReplacement = ['Proteína adicional', 'Sopa adicional', 'Principio adicional', 'Bebida adicional'];

  if (avAdditions.length > 0) {
    flows.lunchAdditionsStep = {
      id: 'lunchAdditionsStep', selectionField: 'additions',
      messages: ['✅ ¡Notas guardadas!', '➕ ¿Quieres agregar adiciones? (opcional)'],
      options: (() => {
        const o = avAdditions.map(a => {
          const needsReplacement = additionsWithReplacement.includes(a.name);
          const subFlowKey = needsReplacement ? `lunchAdditionSub_${a.name.replace(/\s+/g, '_')}` : null;
          return {
            label: a.name + (a.price ? ` (${fmtPrice(a.price)})` : ''),
            icon: '➕',
            nextFlow: subFlowKey || 'lunchAddMore',
            itemData: a,
          };
        });
        finAdditions.forEach(a => o.push({ label: a.name + (a.price ? ` (${fmtPrice(a.price)})` : '') + ' — AGOTADO', icon: '🚫', isSoldOut: true }));
        o.push({ label: 'No, así está bien', icon: '👌', nextFlow: 'lunchAddMore' });
        return o;
      })(),
    };
  }

  // Sub-flows for additions that need a replacement picker
  const additionSubFlowMap = {
    'Sopa adicional': { items: av(soups.filter(s => s.name !== 'Solo bandeja' && s.name !== 'Remplazo por Sopa')), icon: '🥣', label: 'sopa' },
    'Principio adicional': { items: av(principles.filter(p => p.name !== 'Remplazo por Principio' && !['Arroz con pollo', 'Arroz paisa', 'Arroz tres carnes'].includes(p.name))), icon: '🍚', label: 'principio' },
    'Proteína adicional': { items: av(proteins.filter(p => p.name !== 'Mojarra')), icon: '🥩', label: 'proteína' },
    'Bebida adicional': { items: av(drinks.filter(d => d.name !== 'Sin bebida')), icon: '🥤', label: 'bebida' },
  };

  avAdditions.forEach(a => {
    if (!additionsWithReplacement.includes(a.name)) return;
    const subKey = `lunchAdditionSub_${a.name.replace(/\s+/g, '_')}`;
    const subData = additionSubFlowMap[a.name];
    if (!subData || subData.items.length === 0) return;
    flows[subKey] = {
      id: subKey, selectionField: `addition_${a.name.replace(/\s+/g, '_')}_replacement`,
      messages: [`${subData.icon} Selecciona tu opción para ${a.name}:`],
      options: (() => {
        const o = subData.items.map(item => ({
          label: item.name + (item.price ? ` (${fmtPrice(item.price)})` : ''),
          icon: subData.icon, nextFlow: 'lunchAddMore', itemData: item,
        }));
        o.push({ label: '← Volver a adiciones', icon: '↩️', nextFlow: 'lunchAdditionsStep' });
        return o;
      })(),
    };
  });

  // ═══════════════════════════════════════
  // ALMUERZO – ¿Agregar otro almuerzo?
  // ═══════════════════════════════════════
  flows.lunchAddMore = {
    id: 'lunchAddMore',
    messages: ['🍽️ ¡Tu almuerzo está listo!', '¿Quieres agregar otro almuerzo al pedido?'],
    options: [
      { label: '📋 Duplicar este almuerzo', icon: '📋', nextFlow: 'lunchAddMore', isDuplicate: true },
      { label: '➕ Agregar almuerzo diferente', icon: '➕', nextFlow: 'orderLunch', isAddNew: true },
      { label: 'No, solo este', icon: '✅', nextFlow: 'lunchConfirm' },
    ],
  };

  flows.lunchConfirm = {
    id: 'lunchConfirm',
    buildSummary: true,
    messages: ['placeholder'],
    options: [
      { label: 'Confirmar pedido', icon: '✅', nextFlow: 'orderConfirmed' },
      { label: 'Modificar pedido', icon: '✏️', nextFlow: 'lunchModify' },
      { label: 'Cancelar', icon: '❌', nextFlow: 'welcome' },
    ],
  };

  // ═══════════════════════════════════════
  // ALMUERZO – Modificar pedido (ir directo al campo a cambiar)
  // ═══════════════════════════════════════
  flows.lunchModify = {
    id: 'lunchModify',
    messages: ['✏️ ¿Qué deseas cambiar de tu pedido?', 'Selecciona la opción que quieras modificar:'],
    options: [
      { label: 'Cambiar sopa', icon: '🥣', nextFlow: 'lunchEditSoup' },
      { label: 'Cambiar principio', icon: '🍚', nextFlow: 'lunchEditPrinciple' },
      { label: 'Cambiar proteína', icon: '🥩', nextFlow: 'lunchEditProtein' },
      { label: 'Cambiar bebida', icon: '🥤', nextFlow: 'lunchEditDrink' },
      { label: 'Cambiar cubiertos', icon: '🍴', nextFlow: 'lunchEditCutlery' },
      { label: 'Cambiar hora', icon: '🕒', nextFlow: 'lunchEditTime' },
      { label: 'Cambiar dirección', icon: '📍', nextFlow: 'lunchEditAddress' },
      { label: 'Cambiar pago', icon: '💰', nextFlow: 'lunchEditPayment' },
      ...(avSidesForOrder.length > 0 ? [{ label: 'Cambiar acompañamiento', icon: '🥗', nextFlow: 'lunchEditSides' }] : []),
      { label: 'Cambiar notas', icon: '📝', nextFlow: 'lunchEditNotes' },
      ...(avAdditions.length > 0 ? [{ label: 'Cambiar adiciones', icon: '➕', nextFlow: 'lunchEditAdditions' }] : []),
      { label: 'Volver al resumen', icon: '✅', nextFlow: 'lunchConfirm' },
    ],
  };

  // ─── Edit flows (cada uno vuelve a lunchConfirm) ─────
  flows.lunchEditSoup = {
    id: 'lunchEditSoup', selectionField: 'soup',
    messages: ['🥣 Elige tu nueva sopa:'],
    options: (() => {
      const o = avSoups.map(s => ({
        label: s.name === 'Solo bandeja' ? 'Solo bandeja (sin sopa)' : s.name,
        icon: s.name === 'Solo bandeja' ? '🍽️' : '🥣',
        nextFlow: 'lunchConfirm', itemData: s,
      }));
      if (avSoupReplacements.length > 0) {
        const soupReplacementObj = soups.find(s => s.name === 'Remplazo por Sopa');
        o.push({ label: 'Remplazo por Sopa', icon: '🔄', nextFlow: 'lunchEditSoupReplacement', itemData: soupReplacementObj || null });
      }
      finSoups.forEach(s => o.push({ label: (s.name === 'Solo bandeja' ? 'Solo bandeja' : s.name) + ' — AGOTADO', icon: '🚫', isSoldOut: true }));
      o.push({ label: '← Cancelar cambio', icon: '↩️', nextFlow: 'lunchModify' });
      return o;
    })(),
  };

  if (avSoupReplacements.length > 0) {
    flows.lunchEditSoupReplacement = {
      id: 'lunchEditSoupReplacement', selectionField: 'soupReplacement',
      messages: ['🔄 Elige tu remplazo de sopa:'],
      options: (() => {
        const o = avSoupReplacements.map(r => ({
          label: r.name, icon: '🥣', nextFlow: 'lunchConfirm', itemData: r,
        }));
        o.push({ label: '← Volver a sopas', icon: '↩️', nextFlow: 'lunchEditSoup' });
        return o;
      })(),
    };
  }

  flows.lunchEditPrinciple = {
    id: 'lunchEditPrinciple', selectionField: 'principle',
    multiSelect: true, maxSelections: 2,
    messages: ['🍚 Elige tu nuevo principio (hasta 2):'],
    options: (() => {
      const o = avPrinciples.map(p => ({ label: p.name, icon: '🍚', itemData: p }));
      if (avSoupReplacements.length > 0) {
        o.push({ label: 'Remplazo por Principio', icon: '🔄', nextFlow: 'lunchEditPrincipleReplacement', isBack: true });
      }
      finPrinciples.forEach(p => o.push({ label: p.name + ' — AGOTADO', icon: '🚫', isSoldOut: true }));
      o.push({ label: 'Confirmar principio', icon: '✅', nextFlow: 'lunchConfirm', isConfirm: true });
      o.push({ label: '← Cancelar cambio', icon: '↩️', nextFlow: 'lunchModify', isBack: true });
      return o;
    })(),
  };

  if (avSoupReplacements.length > 0) {
    flows.lunchEditPrincipleReplacement = {
      id: 'lunchEditPrincipleReplacement', selectionField: 'principleReplacement',
      messages: ['🔄 Elige tu remplazo de principio:'],
      options: (() => {
        const o = avSoupReplacements.map(r => ({
          label: r.name, icon: '🍚', nextFlow: 'lunchConfirm', itemData: r,
        }));
        o.push({ label: '← Volver a principio', icon: '↩️', nextFlow: 'lunchEditPrinciple' });
        return o;
      })(),
    };
  }

  flows.lunchEditProtein = {
    id: 'lunchEditProtein', selectionField: 'protein',
    messages: ['🥩 Elige tu nueva proteína:'],
    options: (() => {
      const o = avProteins.map(p => ({ label: p.name + (p.price ? ` (${fmtPrice(p.price)})` : ''), icon: '🥩', nextFlow: 'lunchConfirm', itemData: p }));
      finProteins.forEach(p => o.push({ label: p.name + (p.price ? ` (${fmtPrice(p.price)})` : '') + ' — AGOTADO', icon: '🚫', isSoldOut: true }));
      o.push({ label: '← Cancelar cambio', icon: '↩️', nextFlow: 'lunchModify' });
      return o;
    })(),
  };

  flows.lunchEditDrink = {
    id: 'lunchEditDrink', selectionField: 'drink',
    messages: ['🥤 Elige tu nueva bebida:'],
    options: (() => {
      const o = avDrinks.map(d => ({ label: d.name + (d.price ? ` (${fmtPrice(d.price)})` : ''), icon: '🥤', nextFlow: 'lunchConfirm', itemData: d }));
      finDrinks.forEach(d => o.push({ label: d.name + (d.price ? ` (${fmtPrice(d.price)})` : '') + ' — AGOTADO', icon: '🚫', isSoldOut: true }));
      o.push({ label: '← Cancelar cambio', icon: '↩️', nextFlow: 'lunchModify' });
      return o;
    })(),
  };

  flows.lunchEditCutlery = {
    id: 'lunchEditCutlery', selectionField: 'cutlery',
    messages: ['🍴 ¿Necesitas cubiertos?'],
    options: [
      { label: 'Sí, por favor', icon: '🍴', nextFlow: 'lunchConfirm' },
      { label: 'No, gracias', icon: '👌', nextFlow: 'lunchConfirm' },
      { label: '← Cancelar cambio', icon: '↩️', nextFlow: 'lunchModify' },
    ],
  };

  flows.lunchEditTime = {
    id: 'lunchEditTime', selectionField: 'time',
    messages: ['🕒 ¿Para qué hora quieres tu almuerzo?'],
    options: [
      { label: 'Lo más pronto posible', icon: '⚡', nextFlow: 'lunchConfirm' },
      { label: '12:00 PM', icon: '🕐', nextFlow: 'lunchConfirm' },
      { label: '12:30 PM', icon: '🕐', nextFlow: 'lunchConfirm' },
      { label: '1:00 PM', icon: '🕐', nextFlow: 'lunchConfirm' },
      { label: '1:30 PM', icon: '🕐', nextFlow: 'lunchConfirm' },
      { label: '← Cancelar cambio', icon: '↩️', nextFlow: 'lunchModify' },
    ],
  };

  flows.lunchEditAddress = {
    id: 'lunchEditAddress', selectionField: 'address',
    messages: ['📍 Escribe tu nueva dirección:'],
    options: [],
    expectsInput: true,
    inputPlaceholder: 'Ej: Calle 137 #128b-01, Barrio...',
    nextFlowAfterInput: 'lunchEditPhone',
  };

  flows.lunchEditPhone = {
    id: 'lunchEditPhone', selectionField: 'phone',
    messages: ['📱 Escribe tu número de teléfono:'],
    options: [],
    expectsInput: true,
    inputPlaceholder: 'Ej: 3001234567',
    nextFlowAfterInput: 'lunchConfirm',
  };

  flows.lunchEditPayment = {
    id: 'lunchEditPayment', selectionField: 'payment',
    messages: ['💰 ¿Cómo vas a pagar?'],
    options: (() => {
      const o = avPaymentMethods.length > 0
        ? avPaymentMethods.map(pm => ({ label: pm.name, icon: '💳', nextFlow: 'lunchConfirm', itemData: pm }))
        : [
            { label: 'Efectivo', icon: '💵', nextFlow: 'lunchConfirm' },
            { label: 'Nequi', icon: '💳', nextFlow: 'lunchConfirm' },
            { label: 'Daviplata', icon: '💳', nextFlow: 'lunchConfirm' },
          ];
      o.push({ label: '← Cancelar cambio', icon: '↩️', nextFlow: 'lunchModify' });
      return o;
    })(),
  };

  if (avSidesForOrder.length > 0) {
    flows.lunchEditSides = {
      id: 'lunchEditSides', selectionField: 'sides',
      multiSelect: true,
      messages: ['🥗 Elige tus acompañamientos (puedes elegir varios):'],
      options: (() => {
        const o = [];
        o.push({ label: 'Todo incluido', icon: '📦', isSelectAll: true });
        avSidesForOrder.forEach(s => o.push({
          label: s.name + (s.price ? ` (${fmtPrice(s.price)})` : ''),
          icon: '🥗', itemData: s,
        }));
        finSidesForOrder.forEach(s => o.push({ label: s.name + (s.price ? ` (${fmtPrice(s.price)})` : '') + ' — AGOTADO', icon: '🚫', isSoldOut: true }));
        o.push({ label: 'Confirmar acompañamiento', icon: '✅', nextFlow: 'lunchConfirm', isConfirm: true });
        o.push({ label: 'Ninguno', icon: '🚫', nextFlow: 'lunchConfirm', isNone: true });
        return o;
      })(),
    };
  }

  flows.lunchEditNotes = {
    id: 'lunchEditNotes', selectionField: 'notes',
    messages: ['📝 Escribe tu nota o instrucción especial:'],
    options: [
      { label: 'Sin notas', icon: '👌', nextFlow: 'lunchConfirm' },
    ],
    expectsInput: true,
    inputPlaceholder: 'Ej: Sin cebolla, extra picante...',
    nextFlowAfterInput: 'lunchConfirm',
  };

  if (avAdditions.length > 0) {
    flows.lunchEditAdditions = {
      id: 'lunchEditAdditions', selectionField: 'additions',
      messages: ['➕ ¿Quieres agregar adiciones?'],
      options: (() => {
        const o = avAdditions.map(a => {
          const needsReplacement = additionsWithReplacement.includes(a.name);
          const subFlowKey = needsReplacement ? `lunchEditAdditionSub_${a.name.replace(/\s+/g, '_')}` : null;
          return {
            label: a.name + (a.price ? ` (${fmtPrice(a.price)})` : ''),
            icon: '➕',
            nextFlow: subFlowKey || 'lunchConfirm',
            itemData: a,
          };
        });
        finAdditions.forEach(a => o.push({ label: a.name + (a.price ? ` (${fmtPrice(a.price)})` : '') + ' — AGOTADO', icon: '🚫', isSoldOut: true }));
        o.push({ label: 'Sin adiciones', icon: '👌', nextFlow: 'lunchConfirm' });
        o.push({ label: '← Cancelar cambio', icon: '↩️', nextFlow: 'lunchModify' });
        return o;
      })(),
    };
  }

  // Sub-flows for edit additions that need a replacement picker
  avAdditions.forEach(a => {
    if (!additionsWithReplacement.includes(a.name)) return;
    const subKey = `lunchEditAdditionSub_${a.name.replace(/\s+/g, '_')}`;
    const subData = additionSubFlowMap[a.name];
    if (!subData || subData.items.length === 0) return;
    flows[subKey] = {
      id: subKey, selectionField: `addition_${a.name.replace(/\s+/g, '_')}_replacement`,
      messages: [`${subData.icon} Selecciona tu opción para ${a.name}:`],
      options: (() => {
        const o = subData.items.map(item => ({
          label: item.name + (item.price ? ` (${fmtPrice(item.price)})` : ''),
          icon: subData.icon, nextFlow: 'lunchConfirm', itemData: item,
        }));
        o.push({ label: '← Volver a adiciones', icon: '↩️', nextFlow: 'lunchEditAdditions' });
        return o;
      })(),
    };
  });

  // ═══════════════════════════════════════
  // DESAYUNO – Menú completo
  // ═══════════════════════════════════════
  flows.breakfastFullMenu = {
    id: 'breakfastFullMenu',
    messages: (() => {
      const m = ['📋 Menú de Desayunos:'];
      if (breakfastTypes.length > 0) {
        let t = '🍳 Tipos de desayuno:\n' + avBfTypes.map(bt => {
          let line = `  • ${bt.name}`;
          if (bt.description) line += `\n    ${bt.description}`;
          return line;
        }).join('\n');
        if (finBfTypes.length > 0) t += '\n  🚫 Agotados: ' + finBfTypes.map(t => t.name).join(', ');
        m.push(t);
      }
      if (breakfastBroths.length > 0) {
        let t = '🥣 Caldos:\n' + avBfBroths.map(b => `  • ${b.name}${b.price ? ` (${fmtPrice(b.price)})` : ''}`).join('\n');
        if (finBfBroths.length > 0) t += '\n  🚫 Agotados: ' + finBfBroths.map(b => b.name).join(', ');
        m.push(t);
      }
      if (breakfastEggs.length > 0) {
        let t = '🥚 Huevos:\n' + avBfEggs.map(e => `  • ${e.name}`).join('\n');
        if (finBfEggs.length > 0) t += '\n  🚫 Agotados: ' + finBfEggs.map(e => e.name).join(', ');
        m.push(t);
      }
      if (breakfastDrinks.length > 0) {
        let t = '☕ Bebidas:\n' + avBfDrinks.map(d => `  • ${d.name}${d.price ? ` (${fmtPrice(d.price)})` : ''}`).join('\n');
        if (finBfDrinks.length > 0) t += '\n  🚫 Agotadas: ' + finBfDrinks.map(d => d.name).join(', ');
        m.push(t);
      }
      if (breakfastProteins.length > 0) {
        let t = '🥓 Proteínas:\n' + avBfProteins.map(p => `  • ${p.name}${p.price ? ` (${fmtPrice(p.price)})` : ''}`).join('\n');
        if (finBfProteins.length > 0) t += '\n  🚫 Agotadas: ' + finBfProteins.map(p => p.name).join(', ');
        m.push(t);
      }
      if (breakfastRiceBread.length > 0) {
        let t = '🍞 Arroz o pan:\n' + avBfRiceBread.map(r => `  • ${r.name}`).join('\n');
        if (finBfRiceBread.length > 0) t += '\n  🚫 Agotados: ' + finBfRiceBread.map(r => r.name).join(', ');
        m.push(t);
      }
      if (breakfastAdditions.length > 0) {
        let t = '🍗 Adiciones:\n' + avBfAdditions.map(a => `  • ${a.name}${a.price ? ` (${fmtPrice(a.price)})` : ''}`).join('\n');
        if (finBfAdditions.length > 0) t += '\n  🚫 Agotadas: ' + finBfAdditions.map(a => a.name).join(', ');
        m.push(t);
      }
      m.push(scheduleText);
      return m;
    })(),
    options: [
      ...(menuType === 'breakfast' ? [{ label: 'Ordenar desayuno', icon: '🥐', nextFlow: 'orderBreakfast' }] : []),
      { label: 'Ver menú almuerzos', icon: '🍲', nextFlow: 'lunchFullMenu' },
      { label: '← Volver al inicio', icon: '🏠', nextFlow: 'welcome' },
    ],
  };

  // ═══════════════════════════════════════
  // DESAYUNO – Flujo paso a paso
  // ═══════════════════════════════════════

  flows.orderBreakfast = {
    id: 'orderBreakfast', selectionField: 'type',
    messages: ['🥐 ¡Vamos con tu desayuno!', avBfTypes.length > 0 ? `Elige el tipo de desayuno (${avBfTypes.length} disponible${avBfTypes.length > 1 ? 's' : ''}):` : '⚠️ No hay tipos de desayuno disponibles.'],
    options: (() => {
      const o = avBfTypes.map(t => {
        let label = t.name;
        if (t.description) label += `\n${t.description}`;
        const typeKey = sanitizeId(t.name);
        return { label, icon: '🍳', nextFlow: `bf_${typeKey}_step0`, itemData: t };
      });
      finBfTypes.forEach(t => o.push({ label: t.name + ' — AGOTADO', icon: '🚫', isSoldOut: true }));
      o.push({ label: '← Volver', icon: '↩️', nextFlow: 'welcome' });
      return o;
    })(),
  };

  // ─── Mapa de steps: SIN allowSkip en ninguno ──────────────
  const stepDataMap = {
    broth:    { items: avBfBroths,    finItems: finBfBroths,    emoji: '🥣', title: '¿Qué caldo quieres?',       confirmMsg: '✅ ¡Caldo seleccionado!',     selField: 'broth' },
    eggs:     { items: avBfEggs,      finItems: finBfEggs,      emoji: '🥚', title: '¿Cómo quieres los huevos?',  confirmMsg: '✅ ¡Huevos seleccionados!',   selField: 'eggs' },
    riceBread:{ items: avBfRiceBread, finItems: finBfRiceBread, emoji: '🍞', title: '¿Arroz o pan?',              confirmMsg: '✅ ¡Seleccionado!',           selField: 'riceBread' },
    drink:    { items: avBfDrinks,    finItems: finBfDrinks,    emoji: '☕', title: '¿Qué bebida quieres?',       confirmMsg: '✅ ¡Bebida seleccionada!',    selField: 'drink' },
    protein:  { items: avBfProteins,  finItems: finBfProteins,  emoji: '🥓', title: '¿Qué proteína quieres?',    confirmMsg: '✅ ¡Proteína seleccionada!',  selField: 'protein' },
  };

  // Orden común: cubiertos → hora → dir → acuerdo → pago → adiciones → confirmar
  const commonFirstStep = 'bfCutleryStep';

  // ─── Generar cadena de flows por TIPO de desayuno ─
  avBfTypes.forEach(bfType => {
    const typeKey = sanitizeId(bfType.name);
    const typeSteps = bfType.steps || [];
    const validSteps = typeSteps.filter(s => stepDataMap[s] && stepDataMap[s].items.length > 0);

    if (validSteps.length === 0) {
      flows[`bf_${typeKey}_step0`] = {
        id: `bf_${typeKey}_step0`,
        messages: [`✅ ¡${bfType.name} seleccionado!`, 'Pasemos a los detalles del pedido.'],
        options: [
          { label: 'Continuar', icon: '➡️', nextFlow: commonFirstStep },
          { label: '← Cambiar tipo', icon: '↩️', nextFlow: 'orderBreakfast' },
        ],
      };
      return;
    }

    validSteps.forEach((stepName, idx) => {
      const flowKey = `bf_${typeKey}_step${idx}`;
      const stepInfo = stepDataMap[stepName];
      const isFirst = idx === 0;
      const isLast = idx === validSteps.length - 1;
      const nextFlowTarget = isLast ? commonFirstStep : `bf_${typeKey}_step${idx + 1}`;
      const prevFlowTarget = isFirst ? 'orderBreakfast' : `bf_${typeKey}_step${idx - 1}`;

      const messages = [];
      if (isFirst) {
        messages.push(`✅ ¡${bfType.name} seleccionado!`);
      } else {
        const prev = stepDataMap[validSteps[idx - 1]];
        messages.push(prev ? prev.confirmMsg : '✅ ¡Seleccionado!');
      }
      messages.push(`${stepInfo.emoji} ${stepInfo.title} (${stepInfo.items.length} disponible${stepInfo.items.length > 1 ? 's' : ''}):`);

      const options = stepInfo.items.map(item => ({
        label: item.name + (item.price ? ` (${fmtPrice(item.price)})` : ''),
        icon: stepInfo.emoji, nextFlow: nextFlowTarget, itemData: item,
      }));
      // Mostrar ítems agotados como no seleccionables
      if (stepInfo.finItems?.length > 0) {
        stepInfo.finItems.forEach(item => options.push({ label: item.name + (item.price ? ` (${fmtPrice(item.price)})` : '') + ' — AGOTADO', icon: '🚫', isSoldOut: true }));
      }
      // SIN opción skip - todos los pasos del tipo son obligatorios
      options.push({ label: '← Volver', icon: '↩️', nextFlow: prevFlowTarget });

      flows[flowKey] = { id: flowKey, selectionField: stepInfo.selField, messages, options };
    });
  });

  // ═══════════════════════════════════════
  // DESAYUNO – Pasos COMUNES: cubiertos → hora → dirección → acuerdo → pago → adiciones → confirmar
  // ═══════════════════════════════════════

  flows.bfCutleryStep = {
    id: 'bfCutleryStep', selectionField: 'cutlery',
    messages: ['✅ ¡Selección completada!', '🍴 ¿Necesitas cubiertos?'],
    options: [
      { label: 'Sí, por favor', icon: '🍴', nextFlow: 'bfTimeStep' },
      { label: 'No, gracias', icon: '👌', nextFlow: 'bfTimeStep' },
      { label: '← Cambiar tipo', icon: '↩️', nextFlow: 'orderBreakfast' },
    ],
  };

  flows.bfTimeStep = {
    id: 'bfTimeStep', selectionField: 'time',
    messages: ['✅ ¡Cubiertos anotados!', '🕒 ¿Para qué hora quieres tu desayuno?'],
    options: (() => {
      const nextAddr = savedAddr ? 'bfAddressConfirm' : 'bfAddressStep';
      if (avBfTimes.length > 0) {
        const o = avBfTimes.map(t => ({ label: t.name, icon: '🕐', nextFlow: nextAddr }));
        o.push({ label: '← Volver', icon: '↩️', nextFlow: 'bfCutleryStep' });
        return o;
      }
      return [
        { label: 'Lo más pronto posible', icon: '⚡', nextFlow: nextAddr },
        { label: '7:00 AM', icon: '🕐', nextFlow: nextAddr },
        { label: '7:30 AM', icon: '🕐', nextFlow: nextAddr },
        { label: '8:00 AM', icon: '🕐', nextFlow: nextAddr },
        { label: '8:30 AM', icon: '🕐', nextFlow: nextAddr },
        { label: '9:00 AM', icon: '🕐', nextFlow: nextAddr },
        { label: '← Volver', icon: '↩️', nextFlow: 'bfCutleryStep' },
      ];
    })(),
  };

  // Dirección guardada → confirmar
  if (savedAddr) {
    flows.bfAddressConfirm = {
      id: 'bfAddressConfirm', selectionField: 'address',
      messages: ['✅ ¡Hora registrada!', `📍 Tu dirección guardada:\n${formatSavedAddress(savedAddr)}`, '¿Es correcta?'],
      options: [
        { label: 'Sí, es correcta', icon: '✅', nextFlow: 'bfAgreementStep', selectionValue: formatAddressOnly(savedAddr), extraSelections: { phone: savedAddr.phoneNumber } },
        { label: 'No, quiero cambiarla', icon: '✏️', nextFlow: 'bfAddressStep' },
        { label: '← Volver', icon: '↩️', nextFlow: 'bfTimeStep' },
      ],
    };
  }

  flows.bfAddressStep = {
    id: 'bfAddressStep', selectionField: 'address',
    messages: [savedAddr ? '✏️ Escribe tu nueva dirección:' : '✅ ¡Hora registrada!\n📍 Escribe tu dirección completa para el domicilio:'],
    options: [],
    expectsInput: true,
    inputPlaceholder: 'Ej: Calle 137 #128b-01, Barrio...',
    nextFlowAfterInput: 'bfPhoneStep',
  };

  flows.bfPhoneStep = {
    id: 'bfPhoneStep', selectionField: 'phone',
    messages: ['✅ ¡Dirección guardada!', '📱 Escribe tu número de teléfono:'],
    options: [],
    expectsInput: true,
    inputPlaceholder: 'Ej: 3001234567',
    nextFlowAfterInput: 'bfAgreementStep',
  };

  flows.bfAgreementStep = {
    id: 'bfAgreementStep', selectionField: 'agreement',
    messages: [
      '🤝 Acuerdo de Entrega:',
      '⏱️ Tiempo estimado: 25-30 min desde confirmación de salida.\n🧾 Pago por transferencia: tu pedido se prepara al recibir comprobante.\n🏢 Entregas en portería o entrada principal.',
    ],
    options: [
      { label: 'Ver más detalles', icon: '📋', nextFlow: 'bfAgreementDetails' },
      { label: '¡Acepto!', icon: '✅', nextFlow: 'bfPaymentStep' },
      { label: 'Cancelar pedido', icon: '❌', nextFlow: 'welcome' },
    ],
  };

  flows.bfAgreementDetails = {
    id: 'bfAgreementDetails', selectionField: 'agreement',
    messages: [
      '📋 Detalles completos del acuerdo:',
      '⏱️ El tiempo puede variar según zona, tráfico y clima.\n\n👩‍🍳 Preparación al momento: Si deseas que tu pedido llegue a la hora indicada, te recomendamos pedir con 30 min a 1 hora de anticipación.\n\n📲 Confirmación de salida: El domiciliario confirmará cuando salga con tu pedido.\n\n⚖️ Compromiso con todos: Atendemos en orden de llegada. Agradecemos tu paciencia.\n\n🌧️ Retrasos externos: Factores como lluvia o congestión pueden causar demoras adicionales.',
      '¿Aceptas las condiciones?',
    ],
    options: [
      { label: '¡Acepto! Entiendo las condiciones', icon: '✅', nextFlow: 'bfPaymentStep' },
      { label: 'Cancelar pedido', icon: '❌', nextFlow: 'welcome' },
    ],
  };

  flows.bfPaymentStep = {
    id: 'bfPaymentStep', selectionField: 'payment',
    messages: ['✅ ¡Condiciones aceptadas!', '💰 ¿Cómo vas a pagar?'],
    options: (() => {
      const nextStep = avBfAdditions.length > 0 ? 'bfAdditionsStep' : 'bfAddMore';
      const o = avPaymentMethods.length > 0
        ? avPaymentMethods.map(pm => ({ label: pm.name, icon: '💳', nextFlow: nextStep, itemData: pm }))
        : [
            { label: 'Efectivo', icon: '💵', nextFlow: nextStep },
            { label: 'Nequi', icon: '💳', nextFlow: nextStep },
            { label: 'Daviplata', icon: '💳', nextFlow: nextStep },
          ];
      o.push({ label: '← Volver', icon: '↩️', nextFlow: 'bfAgreementStep' });
      return o;
    })(),
  };

  if (avBfAdditions.length > 0) {
    flows.bfAdditionsStep = {
      id: 'bfAdditionsStep', selectionField: 'additions',
      messages: ['✅ ¡Pago seleccionado!', '➕ ¿Quieres agregar adiciones? (opcional)'],
      options: (() => {
        const o = avBfAdditions.map(a => ({
          label: a.name + (a.price ? ` (${fmtPrice(a.price)})` : ''),
          icon: '➕', nextFlow: 'bfAddMore', itemData: a,
        }));
        finBfAdditions.forEach(a => o.push({ label: a.name + (a.price ? ` (${fmtPrice(a.price)})` : '') + ' — AGOTADO', icon: '🚫', isSoldOut: true }));
        o.push({ label: 'No, así está bien', icon: '👌', nextFlow: 'bfAddMore' });
        return o;
      })(),
    };
  }

  // ═══════════════════════════════════════
  // DESAYUNO – ¿Agregar otro desayuno?
  // ═══════════════════════════════════════
  flows.bfAddMore = {
    id: 'bfAddMore',
    messages: ['🥐 ¡Tu desayuno está listo!', '¿Quieres agregar otro desayuno al pedido?'],
    options: [
      { label: '📋 Duplicar este desayuno', icon: '📋', nextFlow: 'bfAddMore', isDuplicateBreakfast: true },
      { label: '➕ Agregar desayuno diferente', icon: '➕', nextFlow: 'orderBreakfast', isAddNewBreakfast: true },
      { label: 'No, solo este', icon: '✅', nextFlow: 'bfConfirm' },
    ],
  };

  flows.bfConfirm = {
    id: 'bfConfirm',
    buildSummary: true,
    messages: ['placeholder'],
    options: [
      { label: 'Confirmar pedido', icon: '✅', nextFlow: 'orderConfirmed' },
      { label: 'Modificar pedido', icon: '✏️', nextFlow: 'bfModify' },
      { label: 'Cancelar', icon: '❌', nextFlow: 'welcome' },
    ],
  };

  // ═══════════════════════════════════════
  // DESAYUNO – Modificar pedido (ir directo al campo a cambiar)
  // ═══════════════════════════════════════
  flows.bfModify = {
    id: 'bfModify',
    messages: ['✏️ ¿Qué deseas cambiar de tu desayuno?', 'Selecciona la opción que quieras modificar:'],
    options: [
      ...(avBfTypes.length > 0 ? [{ label: 'Cambiar tipo', icon: '🍳', nextFlow: 'bfEditType' }] : []),
      ...(avBfBroths.length > 0 ? [{ label: 'Cambiar caldo', icon: '🥣', nextFlow: 'bfEditBroth' }] : []),
      ...(avBfEggs.length > 0 ? [{ label: 'Cambiar huevos', icon: '🥚', nextFlow: 'bfEditEggs' }] : []),
      ...(avBfRiceBread.length > 0 ? [{ label: 'Cambiar arroz/pan', icon: '🍞', nextFlow: 'bfEditRiceBread' }] : []),
      ...(avBfProteins.length > 0 ? [{ label: 'Cambiar proteína', icon: '🥓', nextFlow: 'bfEditProtein' }] : []),
      ...(avBfDrinks.length > 0 ? [{ label: 'Cambiar bebida', icon: '☕', nextFlow: 'bfEditDrink' }] : []),
      { label: 'Cambiar cubiertos', icon: '🍴', nextFlow: 'bfEditCutlery' },
      { label: 'Cambiar hora', icon: '🕒', nextFlow: 'bfEditTime' },
      { label: 'Cambiar dirección', icon: '📍', nextFlow: 'bfEditAddress' },
      { label: 'Cambiar pago', icon: '💰', nextFlow: 'bfEditPayment' },
      ...(avBfAdditions.length > 0 ? [{ label: 'Cambiar adiciones', icon: '➕', nextFlow: 'bfEditAdditions' }] : []),
      { label: 'Cambiar notas', icon: '📝', nextFlow: 'bfEditNotes' },
      { label: 'Volver al resumen', icon: '✅', nextFlow: 'bfConfirm' },
    ],
  };

  // ─── Edit flows desayuno (cada uno vuelve a bfConfirm) ─────
  if (avBfTypes.length > 0) {
    flows.bfEditType = {
      id: 'bfEditType', selectionField: 'type',
      messages: ['🍳 Elige tu nuevo tipo de desayuno:'],
      options: (() => {
        const o = avBfTypes.map(t => ({ label: t.name + (t.description ? `\n${t.description}` : ''), icon: '🍳', nextFlow: 'bfConfirm', itemData: t }));
        finBfTypes.forEach(t => o.push({ label: t.name + ' — AGOTADO', icon: '🚫', isSoldOut: true }));
        o.push({ label: '← Cancelar cambio', icon: '↩️', nextFlow: 'bfModify' });
        return o;
      })(),
    };
  }

  if (avBfBroths.length > 0) {
    flows.bfEditBroth = {
      id: 'bfEditBroth', selectionField: 'broth',
      messages: ['🥣 Elige tu nuevo caldo:'],
      options: (() => {
        const o = avBfBroths.map(b => ({ label: b.name + (b.price ? ` (${fmtPrice(b.price)})` : ''), icon: '🥣', nextFlow: 'bfConfirm', itemData: b }));
        finBfBroths.forEach(b => o.push({ label: b.name + ' — AGOTADO', icon: '🚫', isSoldOut: true }));
        o.push({ label: '← Cancelar cambio', icon: '↩️', nextFlow: 'bfModify' });
        return o;
      })(),
    };
  }

  if (avBfEggs.length > 0) {
    flows.bfEditEggs = {
      id: 'bfEditEggs', selectionField: 'eggs',
      messages: ['🥚 ¿Cómo quieres los huevos?'],
      options: (() => {
        const o = avBfEggs.map(e => ({ label: e.name, icon: '🥚', nextFlow: 'bfConfirm', itemData: e }));
        finBfEggs.forEach(e => o.push({ label: e.name + ' — AGOTADO', icon: '🚫', isSoldOut: true }));
        o.push({ label: '← Cancelar cambio', icon: '↩️', nextFlow: 'bfModify' });
        return o;
      })(),
    };
  }

  if (avBfRiceBread.length > 0) {
    flows.bfEditRiceBread = {
      id: 'bfEditRiceBread', selectionField: 'riceBread',
      messages: ['🍞 ¿Arroz o pan?'],
      options: (() => {
        const o = avBfRiceBread.map(r => ({ label: r.name, icon: '🍞', nextFlow: 'bfConfirm', itemData: r }));
        finBfRiceBread.forEach(r => o.push({ label: r.name + ' — AGOTADO', icon: '🚫', isSoldOut: true }));
        o.push({ label: '← Cancelar cambio', icon: '↩️', nextFlow: 'bfModify' });
        return o;
      })(),
    };
  }

  if (avBfProteins.length > 0) {
    flows.bfEditProtein = {
      id: 'bfEditProtein', selectionField: 'protein',
      messages: ['🥓 Elige tu nueva proteína:'],
      options: (() => {
        const o = avBfProteins.map(p => ({ label: p.name + (p.price ? ` (${fmtPrice(p.price)})` : ''), icon: '🥓', nextFlow: 'bfConfirm', itemData: p }));
        finBfProteins.forEach(p => o.push({ label: p.name + ' — AGOTADO', icon: '🚫', isSoldOut: true }));
        o.push({ label: '← Cancelar cambio', icon: '↩️', nextFlow: 'bfModify' });
        return o;
      })(),
    };
  }

  if (avBfDrinks.length > 0) {
    flows.bfEditDrink = {
      id: 'bfEditDrink', selectionField: 'drink',
      messages: ['☕ Elige tu nueva bebida:'],
      options: (() => {
        const o = avBfDrinks.map(d => ({ label: d.name + (d.price ? ` (${fmtPrice(d.price)})` : ''), icon: '☕', nextFlow: 'bfConfirm', itemData: d }));
        finBfDrinks.forEach(d => o.push({ label: d.name + ' — AGOTADO', icon: '🚫', isSoldOut: true }));
        o.push({ label: '← Cancelar cambio', icon: '↩️', nextFlow: 'bfModify' });
        return o;
      })(),
    };
  }

  flows.bfEditCutlery = {
    id: 'bfEditCutlery', selectionField: 'cutlery',
    messages: ['🍴 ¿Necesitas cubiertos?'],
    options: [
      { label: 'Sí, por favor', icon: '🍴', nextFlow: 'bfConfirm' },
      { label: 'No, gracias', icon: '👌', nextFlow: 'bfConfirm' },
      { label: '← Cancelar cambio', icon: '↩️', nextFlow: 'bfModify' },
    ],
  };

  flows.bfEditTime = {
    id: 'bfEditTime', selectionField: 'time',
    messages: ['🕒 ¿Para qué hora quieres tu desayuno?'],
    options: (() => {
      if (avBfTimes.length > 0) {
        const o = avBfTimes.map(t => ({ label: t.name, icon: '🕐', nextFlow: 'bfConfirm' }));
        o.push({ label: '← Cancelar cambio', icon: '↩️', nextFlow: 'bfModify' });
        return o;
      }
      return [
        { label: 'Lo más pronto posible', icon: '⚡', nextFlow: 'bfConfirm' },
        { label: '7:00 AM', icon: '🕐', nextFlow: 'bfConfirm' },
        { label: '7:30 AM', icon: '🕐', nextFlow: 'bfConfirm' },
        { label: '8:00 AM', icon: '🕐', nextFlow: 'bfConfirm' },
        { label: '8:30 AM', icon: '🕐', nextFlow: 'bfConfirm' },
        { label: '9:00 AM', icon: '🕐', nextFlow: 'bfConfirm' },
        { label: '← Cancelar cambio', icon: '↩️', nextFlow: 'bfModify' },
      ];
    })(),
  };

  flows.bfEditAddress = {
    id: 'bfEditAddress', selectionField: 'address',
    messages: ['📍 Escribe tu nueva dirección:'],
    options: [],
    expectsInput: true,
    inputPlaceholder: 'Ej: Calle 137 #128b-01, Barrio...',
    nextFlowAfterInput: 'bfEditPhone',
  };

  flows.bfEditPhone = {
    id: 'bfEditPhone', selectionField: 'phone',
    messages: ['📱 Escribe tu número de teléfono:'],
    options: [],
    expectsInput: true,
    inputPlaceholder: 'Ej: 3001234567',
    nextFlowAfterInput: 'bfConfirm',
  };

  flows.bfEditPayment = {
    id: 'bfEditPayment', selectionField: 'payment',
    messages: ['💰 ¿Cómo vas a pagar?'],
    options: (() => {
      const o = avPaymentMethods.length > 0
        ? avPaymentMethods.map(pm => ({ label: pm.name, icon: '💳', nextFlow: 'bfConfirm', itemData: pm }))
        : [
            { label: 'Efectivo', icon: '💵', nextFlow: 'bfConfirm' },
            { label: 'Nequi', icon: '💳', nextFlow: 'bfConfirm' },
            { label: 'Daviplata', icon: '💳', nextFlow: 'bfConfirm' },
          ];
      o.push({ label: '← Cancelar cambio', icon: '↩️', nextFlow: 'bfModify' });
      return o;
    })(),
  };

  if (avBfAdditions.length > 0) {
    flows.bfEditAdditions = {
      id: 'bfEditAdditions', selectionField: 'additions',
      messages: ['➕ Elige tus adiciones:'],
      options: (() => {
        const o = avBfAdditions.map(a => ({
          label: a.name + (a.price ? ` (${fmtPrice(a.price)})` : ''),
          icon: '➕', nextFlow: 'bfConfirm', itemData: a,
        }));
        finBfAdditions.forEach(a => o.push({ label: a.name + (a.price ? ` (${fmtPrice(a.price)})` : '') + ' — AGOTADO', icon: '🚫', isSoldOut: true }));
        o.push({ label: 'Sin adiciones', icon: '👌', nextFlow: 'bfConfirm' });
        o.push({ label: '← Cancelar cambio', icon: '↩️', nextFlow: 'bfModify' });
        return o;
      })(),
    };
  }

  flows.bfEditNotes = {
    id: 'bfEditNotes', selectionField: 'notes',
    messages: ['📝 Escribe tu nota o instrucción especial:'],
    options: [
      { label: 'Sin notas', icon: '👌', nextFlow: 'bfConfirm' },
    ],
    expectsInput: true,
    inputPlaceholder: 'Ej: Sin cebolla, extra queso...',
    nextFlowAfterInput: 'bfConfirm',
  };

  // ═══════════════════════════════════════
  // CONFIRMACIÓN + WHATSAPP
  // ═══════════════════════════════════════
  flows.orderConfirmed = {
    id: 'orderConfirmed',
    messages: [
      '👇 Envía tu pedido por WhatsApp para que lo preparemos:',
    ],
    options: [
      { label: 'Enviar Pedido por WhatsApp', icon: '📲', whatsappAction: true },
    ],
  };

  flows.orderSuccess = {
    id: 'orderSuccess',
    messages: [
      '✅ ¡Pedido registrado! 🎊',
      'Tu pedido ha sido recibido exitosamente.',
      '⏱️ Tiempo estimado: 25-30 min. ¡Gracias por tu preferencia! 😊',
    ],
    options: [
      { label: 'Hacer otro pedido', icon: '🍽️', nextFlow: 'welcome' },
      { label: 'Tengo una pregunta', icon: '❓', nextFlow: 'faqTopics' },
    ],
  };

  // ═══════════════════════════════════════
  // FAQ
  // ═══════════════════════════════════════
  flows.faqTopics = {
    id: 'faqTopics',
    messages: ['❓ ¿Sobre qué tema tienes dudas?'],
    options: [
      { label: 'Horarios', icon: '⏰', nextFlow: 'faqSchedule' },
      ...(paymentMethods.length > 0 ? [{ label: 'Métodos de pago', icon: '💳', nextFlow: 'faqPayment' }] : []),
      { label: 'Domicilios', icon: '🛵', nextFlow: 'faqDelivery' },
      { label: 'Hablar con alguien', icon: '👤', nextFlow: 'supportContact' },
      { label: '← Volver', icon: '🏠', nextFlow: 'welcome' },
    ],
  };

  flows.faqSchedule = {
    id: 'faqSchedule',
    messages: ['⏰ Nuestros horarios:', scheduleText, menuType === 'closed' ? '⚠️ Actualmente estamos fuera de horario.' : `✅ Ahora: horario de ${menuType === 'breakfast' ? 'desayunos' : 'almuerzos'}.`],
    options: [
      ...(menuType !== 'closed' ? [{ label: 'Hacer un pedido', icon: '🍽️', nextFlow: 'welcome' }] : []),
      { label: 'Otra pregunta', icon: '❓', nextFlow: 'faqTopics' },
      { label: '← Volver', icon: '🏠', nextFlow: 'welcome' },
    ],
  };

  flows.faqPayment = {
    id: 'faqPayment',
    messages: avPaymentMethods.length > 0 ? ['💳 Métodos de pago aceptados:', avPaymentMethods.map(p => `  • ${p.name}`).join('\n')] : ['💳 Métodos de pago: Efectivo, Nequi, Daviplata'],
    options: [{ label: 'Hacer un pedido', icon: '🍽️', nextFlow: 'welcome' }, { label: 'Otra pregunta', icon: '❓', nextFlow: 'faqTopics' }],
  };

  flows.faqDelivery = {
    id: 'faqDelivery',
    messages: ['🛵 Información de domicilios:', '⏱️ Tiempo estimado: 25-30 minutos\n📍 Consulta cobertura al momento de pedir'],
    options: [{ label: 'Hacer un pedido', icon: '🍽️', nextFlow: 'welcome' }, { label: 'Otra pregunta', icon: '❓', nextFlow: 'faqTopics' }],
  };

  flows.supportContact = {
    id: 'supportContact',
    messages: ['👤 Escríbenos tu mensaje y te responderemos:'],
    options: [], expectsInput: true, inputPlaceholder: 'Escribe tu mensaje...', nextFlowAfterInput: 'supportReceived',
  };

  flows.supportReceived = {
    id: 'supportReceived',
    messages: ['✅ ¡Mensaje recibido!', 'Nuestro equipo te responderá pronto. ¿Algo más?'],
    options: [
      { label: 'Ver el menú', icon: '📋', nextFlow: menuType === 'breakfast' ? 'breakfastFullMenu' : 'lunchFullMenu' },
      { label: 'Volver al inicio', icon: '🏠', nextFlow: 'welcome' },
    ],
  };

  return flows;
}

// ─── Helper: valor de campo para comparación (almuerzo) ──────────
function getLunchFieldValue(meal, field) {
  if (!meal) return '';
  if (field === 'Sopa') {
    if (meal.soup?.name === 'Solo bandeja') return 'solo bandeja';
    if (meal.soupReplacement?.name) return JSON.stringify({ name: meal.soupReplacement.name, type: 'por sopa' });
    if (meal.soup?.name && meal.soup.name !== 'Sin sopa') return meal.soup.name;
    return 'Sin sopa';
  } else if (field === 'Principio') {
    const names = (Array.isArray(meal.principle) ? meal.principle : (meal.principle ? [meal.principle] : []))
      .map(p => p.name).sort();
    const repl = meal.principleReplacement?.name || '';
    return JSON.stringify([names.join(','), repl]);
  } else if (field === 'Proteína') return meal.protein?.name || 'Sin proteína';
  else if (field === 'Bebida') return meal.drink?.name || 'Sin bebida';
  else if (field === 'Cubiertos') return meal.cutlery === true || meal.cutlery === 'Sí' ? 'Sí' : 'No';
  else if (field === 'Acompañamientos') return JSON.stringify((meal.sides || []).map(s => s.name).sort());
  else if (field === 'Hora') return meal.time?.name || '';
  else if (field === 'Pago') return meal.payment?.name || 'No especificado';
  else if (field === 'Adiciones') return JSON.stringify((meal.additions || []).map(a => ({ n: a.name, q: a.quantity || 1, p: a.protein || '', r: a.replacement || '' })).sort((a, b) => a.n.localeCompare(b.n)));
  else if (field === 'Notas') return meal.notes || '';
  return '';
}

// ─── Helper: valor de campo para comparación (desayuno) ──────────
function getBfFieldValue(meal, field) {
  if (!meal) return '';
  if (field === 'Tipo') return meal.type?.name || '';
  else if (field === 'Caldo') return meal.broth?.name || '';
  else if (field === 'Huevos') return meal.eggs?.name || '';
  else if (field === 'ArrozPan') return meal.riceBread?.name || '';
  else if (field === 'Proteína') return meal.protein?.name || '';
  else if (field === 'Bebida') return meal.drink?.name || '';
  else if (field === 'Cubiertos') return meal.cutlery === true || meal.cutlery === 'Sí' ? 'Sí' : 'No';
  else if (field === 'Hora') return meal.time?.name || '';
  else if (field === 'Pago') return meal.payment?.name || meal.paymentMethod?.name || 'No especificado';
  else if (field === 'Adiciones') return JSON.stringify((meal.additions || []).map(a => ({ n: a.name, q: a.quantity || 1 })).sort((a, b) => a.n.localeCompare(b.n)));
  else if (field === 'Notas') return meal.notes || '';
  return '';
}

// ─── Helper: texto formateado de un campo del almuerzo ──────────
function getLunchFieldText(meal, field) {
  if (field === 'Sopa') {
    if (meal.soup?.name === 'Solo bandeja') return 'solo bandeja';
    if (meal.soupReplacement?.name) return `${meal.soupReplacement.name} (por sopa)`;
    if (meal.soup?.name) return meal.soup.name;
    return null;
  } else if (field === 'Principio') {
    if (meal.principleReplacement?.name) return `${meal.principleReplacement.name} (por principio)`;
    if (meal.principle?.length > 0) {
      const names = meal.principle.map(p => p.name).join(', ');
      return `${names}${meal.principle.length > 1 ? ' (mixto)' : ''}`;
    }
    return null;
  } else if (field === 'Proteína') return meal.protein?.name || null;
  else if (field === 'Bebida') return meal.drink?.name && meal.drink.name !== 'Sin bebida' ? meal.drink.name : null;
  else if (field === 'Cubiertos') return `Cubiertos: ${meal.cutlery === true || meal.cutlery === 'Sí' ? 'Sí' : 'No'}`;
  else if (field === 'Acompañamientos') {
    if (meal.sides?.length > 0) return `Acompañamientos: ${meal.sides.map(s => s.name).join(', ')}`;
    return 'Acompañamientos: Ninguno';
  }
  else if (field === 'Hora') return meal.time?.name || null;
  else if (field === 'Pago') return meal.payment?.name || null;
  else if (field === 'Adiciones') {
    if (meal.additions?.length > 0) return meal.additions.map(a => `- ${a.name}${a.protein || a.replacement ? ` (${a.protein || a.replacement})` : ''} (${a.quantity || 1})`).join('\n');
    return null;
  }
  else if (field === 'Notas') return meal.notes && meal.notes !== 'Sin notas' ? `Notas: ${meal.notes}` : null;
  return null;
}

// ─── Helper: texto formateado de un campo del desayuno ──────────
function getBfFieldText(meal, field) {
  if (field === 'Tipo') return meal.type?.name || null;
  else if (field === 'Caldo') return meal.broth?.name || null;
  else if (field === 'Huevos') return meal.eggs?.name || null;
  else if (field === 'ArrozPan') return meal.riceBread?.name || null;
  else if (field === 'Proteína') return meal.protein?.name || null;
  else if (field === 'Bebida') return meal.drink?.name || null;
  else if (field === 'Cubiertos') return `Cubiertos: ${meal.cutlery === true || meal.cutlery === 'Sí' ? 'Sí' : 'No'}`;
  else if (field === 'Hora') return meal.time?.name || null;
  else if (field === 'Pago') return meal.payment?.name || meal.paymentMethod?.name || null;
  else if (field === 'Adiciones') {
    if (meal.additions?.length > 0) return meal.additions.map(a => `- ${a.name} (${a.quantity || 1})`).join('\n');
    return null;
  }
  else if (field === 'Notas') return meal.notes && meal.notes !== 'Sin notas' ? `Notas: ${meal.notes}` : null;
  return null;
}

// ─── Smart grouping: agrupar comidas similares ──────────
function smartGroupMeals(meals, getFieldValue, fieldsToCheck) {
  const mealGroups = new Map();
  meals.forEach((meal, index) => {
    let assigned = false;
    for (const [, groupData] of mealGroups) {
      const refMeal = groupData.meals[0];
      let differences = 0;
      fieldsToCheck.forEach(field => {
        if (getFieldValue(meal, field) !== getFieldValue(refMeal, field)) differences++;
      });
      if (differences <= 3) {
        groupData.meals.push(meal);
        groupData.indices.push(index);
        const pay = meal.payment?.name || meal.paymentMethod?.name;
        if (pay) groupData.payments.add(pay);
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      const key = `${index}|${fieldsToCheck.map(f => getFieldValue(meal, f)).join('|')}`;
      const pay = meal.payment?.name || meal.paymentMethod?.name;
      mealGroups.set(key, {
        meals: [meal],
        indices: [index],
        payments: new Set(pay ? [pay] : []),
      });
    }
  });

  return Array.from(mealGroups.values()).map(groupData => {
    const group = {
      meals: groupData.meals,
      payments: groupData.payments,
      originalIndices: groupData.indices,
    };
    // Campos comunes en el grupo
    group.commonFields = new Set(fieldsToCheck.filter(field => {
      const firstVal = getFieldValue(group.meals[0], field);
      return group.meals.every(m => getFieldValue(m, field) === firstVal);
    }));
    // Sub-groups de comidas 100% idénticas
    const identicalGroups = new Map();
    group.meals.forEach((meal, idx) => {
      const key = fieldsToCheck.map(f => getFieldValue(meal, f)).join('|');
      if (!identicalGroups.has(key)) identicalGroups.set(key, { meals: [], indices: [] });
      identicalGroups.get(key).meals.push(meal);
      identicalGroups.get(key).indices.push(groupData.indices[idx]);
    });
    group.identicalGroups = Array.from(identicalGroups.values());
    return group;
  });
}

// ─── Payment summary por método ──────────
function buildPaymentSummary(meals) {
  const map = {};
  meals.forEach(m => {
    let price = 0;
    try { price = calculateMealPrice(m); } catch (e) { /* ignore */ }
    if (!price) {
      try { price = calculateBreakfastPrice(m, null, []); } catch (e) { /* ignore */ }
    }
    if (!price) price = 13000;
    const method = m.payment?.name || m.paymentMethod?.name || 'No especificado';
    map[method] = (map[method] || 0) + price;
  });
  return map;
}

// ─── Construir resumen dinámico desde selecciones ──────────
export function buildOrderSummary(selections, meal, allMeals) {
  const s = selections;
  const isBreakfast = !!s.type;
  const meals = allMeals && allMeals.length > 0 ? allMeals : (meal ? [meal] : []);
  const mealCount = meals.length;
  const typeLabel = isBreakfast ? 'desayuno' : 'almuerzo';
  const typeLabelPlural = isBreakfast ? 'desayunos' : 'almuerzos';
  const TypeLabelSingle = isBreakfast ? 'Desayuno' : 'Almuerzo';
  const TypeLabelPlural = isBreakfast ? 'Desayunos iguales' : 'Almuerzos iguales';

  const lunchFields = ['Sopa', 'Principio', 'Proteína', 'Bebida', 'Cubiertos', 'Acompañamientos', 'Hora', 'Pago', 'Adiciones', 'Notas'];
  const bfFields = ['Tipo', 'Caldo', 'Huevos', 'ArrozPan', 'Proteína', 'Bebida', 'Cubiertos', 'Hora', 'Pago', 'Adiciones', 'Notas'];
  const fieldsToCheck = isBreakfast ? bfFields : lunchFields;
  const getFieldVal = isBreakfast ? getBfFieldValue : getLunchFieldValue;
  const getFieldTxt = isBreakfast ? getBfFieldText : getLunchFieldText;

  const groups = smartGroupMeals(meals, getFieldVal, fieldsToCheck);

  // Grand total
  let grandTotal = 0;
  meals.forEach(m => {
    let p = 0;
    try { p = isBreakfast ? calculateBreakfastPrice(m, null, []) : calculateMealPrice(m); } catch (e) { /* */ }
    if (!p) p = isBreakfast ? 9000 : 15000;
    grandTotal += p;
  });
  const fmtTotal = fmtPrice(grandTotal);

  let text = '✅ Resumen del Pedido\n';
  text += `🍽 ${mealCount} ${mealCount === 1 ? typeLabel : typeLabelPlural} en total\n\n`;

  // Indicador de grupos
  groups.forEach(g => {
    if (g.meals.length > 1) text += `* ${g.meals.length} ${typeLabelPlural} iguales\n`;
  });
  text += `\n💰 Total: ${fmtTotal}\n`;

  // Por cada grupo
  groups.forEach(group => {
    const baseMeal = group.meals[0];
    const count = group.meals.length;
    let groupTotal = 0;
    group.meals.forEach(m => {
      let p = 0;
      try { p = isBreakfast ? calculateBreakfastPrice(m, null, []) : calculateMealPrice(m); } catch (e) { /* */ }
      if (!p) p = isBreakfast ? 9000 : 15000;
      groupTotal += p;
    });
    const payNames = Array.from(group.payments).filter(n => n && n !== 'No especificado');
    const payText = payNames.length > 0 ? `(${payNames.join(' y ')})` : '';

    text += `\n🍽 ${count > 1 ? `${count} ${TypeLabelPlural}` : `${count} ${TypeLabelSingle}`} – ${fmtPrice(groupTotal)} ${payText}\n`;

    // Campos comunes del grupo (se muestran una vez)
    if (count === 1) {
      // Para un solo almuerzo mostrar todo
      fieldsToCheck.forEach(field => {
        const val = getFieldTxt(baseMeal, field);
        if (val) text += `${val}\n`;
      });
    } else {
      // Mostrar solo campos comunes
      fieldsToCheck.forEach(field => {
        if (group.commonFields.has(field)) {
          const val = getFieldTxt(baseMeal, field);
          if (val) text += `${val}\n`;
        }
      });
    }

    // Diferencias
    const hasDiffs = count > 1 && (group.identicalGroups.length > 1 || group.identicalGroups.some(ig => ig.meals.length < count));
    if (hasDiffs) {
      text += `\n🔄 Diferencias:\n`;
      group.identicalGroups.forEach(identicalGroup => {
        const indices = identicalGroup.indices.map(i => i + 1).sort((a, b) => a - b);
        const indicesText = indices.length > 1
          ? `${TypeLabelPlural.replace(' iguales', '')} ${indices.join(', ')}`
          : `${TypeLabelSingle} ${indices[0]}`;
        text += `* ${indicesText}:\n`;
        const diffMeal = identicalGroup.meals[0];
        fieldsToCheck.forEach(field => {
          if (group.commonFields.has(field)) return; // skip common
          const val = getFieldTxt(diffMeal, field);
          if (val) text += `${val}\n`;
        });
      });
    }
  });

  // Dirección compartida
  text += `───────────────\n`;
  if (s.time && meals.every(m => (m.time?.name || '') === meals[0].time?.name)) {
    text += `🕒 Entrega: ${s.time}\n`;
  }
  if (s.address) {
    let addr = s.address;
    let instr = '';
    if (addr.includes(' - ')) {
      const parts = addr.split(' - ');
      addr = parts[0];
      instr = parts.slice(1).join(' - ');
    }
    text += `📍 Dirección: ${s.address}\n`;
  }
  if (s.phone) text += `📞 Teléfono: ${s.phone}\n`;
  text += `───────────────\n`;

  text += '🚚 Estimado: 25-30 min (10-15 si están cerca).\n\n';
  text += `Total: ${fmtTotal}\n\n`;

  // Sección de pago (smart: por método de pago)
  const payMap = buildPaymentSummary(meals);
  const allEffectivo = Object.keys(payMap).every(k => k === 'Efectivo' || k === 'No especificado');
  if (allEffectivo) {
    text += `Paga en efectivo al momento de la entrega.\n`;
    text += `💵 Efectivo: ${fmtTotal}\n`;
    text += 'Si no tienes efectivo, puedes transferir.\n\n';
    text += 'Bancolombia (Ahorros – Nequi a Bancolombia): 📲 54706725531\n';
    text += 'Daviplata: 📲 313 850 5647\n\n';
  } else {
    text += '💳 Formas de pago:\n\n';
    text += 'Bancolombia (Ahorros – Nequi a Bancolombia): 📲 54706725531\n';
    text += 'Daviplata: 📲 313 850 5647\n';
    Object.entries(payMap).forEach(([method, amount]) => {
      if (method !== 'No especificado' && amount > 0 && method !== 'Efectivo') {
        text += `🔹 ${method}: ${fmtPrice(amount)}\n`;
      }
    });
    if (payMap['Efectivo'] > 0) {
      text += `🔹 Efectivo: ${fmtPrice(payMap['Efectivo'])}\n`;
    }
    text += '\n';
  }
  text += `💰 Total: ${fmtTotal}\n\n`;
  text += '¿Confirmas tu pedido?';

  return text;
}

// ─── Verificar ítems agotados en las selecciones ──────────
export function checkSoldOutItems(meals, menuData, isBreakfast) {
  if (!meals || meals.length === 0 || !menuData) return [];

  const soldOut = [];

  const findCurrent = (collection, item) => {
    if (!item || !collection || !Array.isArray(collection)) return null;
    return collection.find(c => c.id === item.id) || collection.find(c => c.name === item.name) || null;
  };

  if (isBreakfast) {
    const checks = [
      { field: 'type', collection: menuData.breakfastTypes, label: 'Tipo de desayuno', icon: '🍳' },
      { field: 'broth', collection: menuData.breakfastBroths, label: 'Caldo', icon: '🥣' },
      { field: 'eggs', collection: menuData.breakfastEggs, label: 'Huevos', icon: '🥚' },
      { field: 'riceBread', collection: menuData.breakfastRiceBread, label: 'Arroz/Pan', icon: '🍞' },
      { field: 'drink', collection: menuData.breakfastDrinks, label: 'Bebida', icon: '☕' },
      { field: 'protein', collection: menuData.breakfastProteins, label: 'Proteína', icon: '🥓' },
    ];

    meals.forEach((meal, mealIdx) => {
      checks.forEach(({ field, collection, label, icon }) => {
        const item = meal[field];
        if (!item) return;
        const current = findCurrent(collection, item);
        if (current && current.isFinished) {
          soldOut.push({ mealIndex: mealIdx, field, itemName: item.name, fieldLabel: label, icon });
        }
      });

      // Check additions array
      if (Array.isArray(meal.additions) && meal.additions.length > 0) {
        meal.additions.forEach(add => {
          const current = findCurrent(menuData.breakfastAdditions, add);
          if (current && current.isFinished) {
            soldOut.push({ mealIndex: mealIdx, field: 'additions', itemName: add.name, fieldLabel: 'Adición', icon: '➕' });
          }
        });
      }
    });
  } else {
    // Lunch
    const checks = [
      { field: 'soup', collection: menuData.soups, label: 'Sopa', icon: '🥣' },
      { field: 'protein', collection: menuData.proteins, label: 'Proteína', icon: '🥩' },
      { field: 'drink', collection: menuData.drinks, label: 'Bebida', icon: '🥤' },
      { field: 'soupReplacement', collection: menuData.soupReplacements, label: 'Remplazo de sopa', icon: '🔄' },
      { field: 'principleReplacement', collection: menuData.soupReplacements, label: 'Remplazo de principio', icon: '🔄' },
    ];

    meals.forEach((meal, mealIdx) => {
      checks.forEach(({ field, collection, label, icon }) => {
        const item = meal[field];
        if (!item) return;
        const current = findCurrent(collection, item);
        if (current && current.isFinished) {
          soldOut.push({ mealIndex: mealIdx, field, itemName: item.name, fieldLabel: label, icon });
        }
      });

      // Check principle array
      if (Array.isArray(meal.principle) && meal.principle.length > 0) {
        meal.principle.forEach(p => {
          if (p.name === 'Remplazo por Principio') return; // skip meta-items
          const current = findCurrent(menuData.principles, p);
          if (current && current.isFinished) {
            soldOut.push({ mealIndex: mealIdx, field: 'principle', itemName: p.name, fieldLabel: 'Principio', icon: '🍚' });
          }
        });
      }

      // Check sides array
      if (Array.isArray(meal.sides) && meal.sides.length > 0) {
        meal.sides.forEach(s => {
          const current = findCurrent(menuData.sides, s);
          if (current && current.isFinished) {
            soldOut.push({ mealIndex: mealIdx, field: 'sides', itemName: s.name, fieldLabel: 'Acompañamiento', icon: '🥗' });
          }
        });
      }

      // Check additions array
      if (Array.isArray(meal.additions) && meal.additions.length > 0) {
        meal.additions.forEach(add => {
          const current = findCurrent(menuData.additions, add);
          if (current && current.isFinished) {
            soldOut.push({ mealIndex: mealIdx, field: 'additions', itemName: add.name, fieldLabel: 'Adición', icon: '➕' });
          }
        });
      }
    });
  }

  return soldOut;
}

// ─── Generar mensaje WhatsApp desde selecciones ──────────
export function buildWhatsAppMessage(selections, meal, allMeals) {
  const s = selections;
  const isBreakfast = !!s.type;
  const meals = allMeals && allMeals.length > 0 ? allMeals : (meal ? [meal] : []);
  const mealCount = meals.length;
  const typeLabel = isBreakfast ? 'desayuno' : 'almuerzo';
  const typeLabelPlural = isBreakfast ? 'desayunos' : 'almuerzos';
  const TypeLabelSingle = isBreakfast ? 'Desayuno' : 'Almuerzo';
  const TypeLabelPlural = isBreakfast ? 'Desayunos iguales' : 'Almuerzos iguales';

  const lunchFields = ['Sopa', 'Principio', 'Proteína', 'Bebida', 'Cubiertos', 'Acompañamientos', 'Hora', 'Pago', 'Adiciones', 'Notas'];
  const bfFields = ['Tipo', 'Caldo', 'Huevos', 'ArrozPan', 'Proteína', 'Bebida', 'Cubiertos', 'Hora', 'Pago', 'Adiciones', 'Notas'];
  const fieldsToCheck = isBreakfast ? bfFields : lunchFields;
  const getFieldVal = isBreakfast ? getBfFieldValue : getLunchFieldValue;
  const getFieldTxt = isBreakfast ? getBfFieldText : getLunchFieldText;

  const groups = smartGroupMeals(meals, getFieldVal, fieldsToCheck);

  // Grand total
  let grandTotal = 0;
  meals.forEach(m => {
    let p = 0;
    try { p = isBreakfast ? calculateBreakfastPrice(m, null, []) : calculateMealPrice(m); } catch (e) { /* */ }
    if (!p) p = isBreakfast ? 9000 : 15000;
    grandTotal += p;
  });
  const fmtTotal = `$${grandTotal.toLocaleString('es-CO')}`;

  // ── Dirección: separar instrucciones si vienen en el string ──
  let addressLine = s.address || 'No especificada';
  let instructionsLine = '';
  if (addressLine.includes(' - ')) {
    const parts = addressLine.split(' - ');
    addressLine = parts[0];
    instructionsLine = parts.slice(1).join(' - ');
  }

  let msg = '';
  msg += `👋 ¡Hola Cocina Casera! 🍴\n`;
  msg += `Quiero hacer mi pedido${isBreakfast ? ' de desayunos' : ''}:\n\n`;
  msg += `🧾 *Pago por transferencia:* Si pagas con transferencia, tu pedido se empieza a preparar solo cuando envíes el comprobante de pago. Entre más rápido lo envíes, más pronto sale tu pedido. Los números de cuenta están al final del mensaje.\n`;
  msg += `───────────────\n`;
  msg += `🍽 ${mealCount} ${mealCount === 1 ? typeLabel : typeLabelPlural} en total\n`;

  groups.forEach(g => {
    if (g.meals.length > 1) msg += `* ${g.meals.length} ${typeLabelPlural} iguales\n`;
  });
  msg += `💰 Total: ${fmtTotal}\n`;
  if (isBreakfast) msg += `📍 Pedido para entrega\n`;

  // Por cada grupo
  groups.forEach(group => {
    const baseMeal = group.meals[0];
    const count = group.meals.length;
    let groupTotal = 0;
    group.meals.forEach(m => {
      let p = 0;
      try { p = isBreakfast ? calculateBreakfastPrice(m, null, []) : calculateMealPrice(m); } catch (e) { /* */ }
      if (!p) p = isBreakfast ? 9000 : 15000;
      groupTotal += p;
    });
    const payNames = Array.from(group.payments).filter(n => n && n !== 'No especificado');
    const payText = payNames.length > 0 ? `(${payNames.join(' y ')})` : '';

    msg += `───────────────\n`;
    msg += `🍽 ${count > 1 ? `${count} ${TypeLabelPlural}` : `${count} ${TypeLabelSingle}`} – $${groupTotal.toLocaleString('es-CO')} ${payText}\n`;

    if (count === 1) {
      fieldsToCheck.forEach(field => {
        const val = getFieldTxt(baseMeal, field);
        if (val) msg += `${val}\n`;
      });
    } else {
      fieldsToCheck.forEach(field => {
        if (group.commonFields.has(field)) {
          const val = getFieldTxt(baseMeal, field);
          if (val) msg += `${val}\n`;
        }
      });
    }

    msg += `───────────────\n`;

    const hasDiffs = count > 1 && (group.identicalGroups.length > 1 || group.identicalGroups.some(ig => ig.meals.length < count));
    if (hasDiffs) {
      msg += `🔄 Diferencias:\n`;
      group.identicalGroups.forEach(identicalGroup => {
        const indices = identicalGroup.indices.map(i => i + 1).sort((a, b) => a - b);
        const indicesText = indices.length > 1
          ? `*${TypeLabelPlural.replace(' iguales', '')} ${indices.join(', ')}*`
          : `*${TypeLabelSingle} ${indices[0]}*`;
        msg += `${indicesText}:\n`;
        const diffMeal = identicalGroup.meals[0];
        fieldsToCheck.forEach(field => {
          if (group.commonFields.has(field)) return;
          const val = getFieldTxt(diffMeal, field);
          if (val) msg += `${val}\n`;
        });
        msg += `\n`;
      });
      msg += `───────────────\n`;
    }
  });

  // ── Entrega (común) ──
  const commonTime = meals.every(m => (m.time?.name || '') === meals[0].time?.name) ? meals[0].time?.name : null;
  if (commonTime || s.time) msg += `🕒 Entrega: ${commonTime || s.time}\n`;
  msg += `📍 Dirección: ${addressLine}\n`;
  if (s.phone) msg += `📞 Teléfono: ${s.phone}\n`;
  if (instructionsLine) msg += `📝 Instrucciones de entrega: ${instructionsLine}\n`;
  msg += `───────────────\n`;

  // ── Pago (smart por método) ──
  const payMap = buildPaymentSummary(meals);
  const allEffectivo = Object.keys(payMap).every(k => k === 'Efectivo' || k === 'No especificado');
  if (allEffectivo) {
    msg += `Paga en efectivo al momento de la entrega.\n`;
    msg += `💵 Efectivo: ${fmtTotal}\n`;
    msg += `Si no tienes efectivo, puedes transferir.\n`;
  } else {
    msg += `💳 Formas de pago:\n`;
  }
  msg += `\nBancolombia (Ahorros – Nequi a Bancolombia): 📲 54706725531\n`;
  msg += `Daviplata: 📲 313 850 5647\n`;
  if (!allEffectivo) {
    Object.entries(payMap).forEach(([method, amount]) => {
      if (method !== 'No especificado' && amount > 0 && method !== 'Efectivo') {
        msg += `🔹 ${method}: $${(amount || 0).toLocaleString('es-CO')}\n`;
      }
    });
    if (payMap['Efectivo'] > 0) {
      msg += `🔹 Efectivo: $${(payMap['Efectivo'] || 0).toLocaleString('es-CO')}\n`;
    }
  }
  msg += `\n💰 Total: ${fmtTotal}\n`;
  msg += `🚚 Estimado: 25-30 min (10-15 si están cerca).\n`;

  msg += `\n¡Gracias por tu pedido! 😊`;
  msg += `\n\n📋 *Recuerda que aceptaste las condiciones de entrega:*`;
  msg += `\n👉 Ver condiciones completas: https://cocina-casera.web.app/politicas`;

  return msg;
}

// ─── Respuestas inteligentes para texto libre ──────────────
export const smartResponses = [
  { keywords: ['hola', 'hey', 'buenas', 'buenos días', 'buenas tardes'], response: '¡Hola! 😊 ¿En qué puedo ayudarte?', nextFlow: 'welcome' },
  { keywords: ['menú', 'menu', 'carta', 'opciones', 'qué hay', 'que hay'], response: 'Te muestro el menú:', nextFlow: 'lunchFullMenu' },
  { keywords: ['pedir', 'ordenar', 'quiero', 'pedido'], response: '¡Vamos a hacer tu pedido!', nextFlow: 'welcome' },
  { keywords: ['almuerzo', 'almuerzos', 'corriente', 'sopa'], response: '¡Te muestro el menú de almuerzos!', nextFlow: 'lunchFullMenu' },
  { keywords: ['desayuno', 'mañana', 'temprano', 'huevos', 'calentado'], response: '¡Te muestro el menú de desayunos!', nextFlow: 'breakfastFullMenu' },
  { keywords: ['horario', 'hora', 'abren', 'cierran', 'abierto'], response: 'Nuestros horarios:', nextFlow: 'faqSchedule' },
  { keywords: ['domicilio', 'envío', 'envio', 'llevar', 'casa'], response: 'Info de domicilios:', nextFlow: 'faqDelivery' },
  { keywords: ['pago', 'pagar', 'nequi', 'efectivo', 'tarjeta', 'daviplata'], response: 'Métodos de pago:', nextFlow: 'faqPayment' },
  { keywords: ['precio', 'costo', 'cuánto', 'cuanto', 'vale'], response: 'Te muestro precios:', nextFlow: 'lunchFullMenu' },
  { keywords: ['gracias', 'thanks', 'genial', 'listo'], response: '¡Con gusto! 😊 ¿Necesitas algo más?', nextFlow: 'welcome' },
  { keywords: ['proteina', 'proteína', 'carne', 'pollo', 'pescado'], response: 'Proteínas disponibles:', nextFlow: 'lunchFullMenu' },
  { keywords: ['agotado', 'terminó', 'hay', 'queda'], response: 'Lo disponible ahora:', nextFlow: 'lunchFullMenu' },
];

export function findSmartResponse(text) {
  const lower = text.toLowerCase().trim();
  for (const sr of smartResponses) {
    if (sr.keywords.some(kw => lower.includes(kw))) return sr;
  }
  return null;
}
