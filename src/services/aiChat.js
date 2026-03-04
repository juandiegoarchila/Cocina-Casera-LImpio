// src/services/aiChat.js
// Servicio para comunicarse con la Cloud Function de IA
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../config/firebase';

const functions = getFunctions(app, 'us-central1');
const chatWithAIFn = httpsCallable(functions, 'chatWithAI');

// Session ID único por navegador (persiste en localStorage)
function getSessionId() {
  let id = localStorage.getItem('ai_chat_session');
  if (!id) {
    id = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('ai_chat_session', id);
  }
  return id;
}

/**
 * Envía un mensaje al asistente de IA
 * @param {string} message - Mensaje del usuario
 * @param {object} menuData - Datos del menú actual (de useMenuData)
 * @param {Array} conversationHistory - Historial [{role: 'user'|'model', text: '...'}]
 * @returns {Promise<{reply, orderData, isOrderComplete, quickReplies}>}
 */
export async function sendAIMessage(message, menuData, conversationHistory = []) {
  const sessionId = getSessionId();

  // Extraer solo los datos del menú (sin funciones)
  const menuItems = {
    soups: menuData.soups || [],
    soupReplacements: menuData.soupReplacements || [],
    proteins: menuData.proteins || [],
    principles: menuData.principles || [],
    drinks: menuData.drinks || [],
    sides: menuData.sides || [],
    additions: menuData.additions || [],
    paymentMethods: menuData.paymentMethods || [],
    breakfastTypes: menuData.breakfastTypes || [],
    breakfastEggs: menuData.breakfastEggs || [],
    breakfastBroths: menuData.breakfastBroths || [],
    breakfastDrinks: menuData.breakfastDrinks || [],
    breakfastProteins: menuData.breakfastProteins || [],
    breakfastAdditions: menuData.breakfastAdditions || [],
    breakfastRiceBread: menuData.breakfastRiceBread || [],
    breakfastTimes: menuData.breakfastTimes || [],
    times: menuData.times || [],
  };

  const schedules = menuData.schedules || {
    breakfastStart: 420,
    breakfastEnd: 631,
    lunchStart: 632,
    lunchEnd: 950,
  };

  try {
    // Obtener dirección guardada del localStorage para confirmación de paso de dirección
    let savedAddressForConfirm = null;
    try {
      const raw = localStorage.getItem('addressForm');
      if (raw) {
        const data = JSON.parse(raw);
        if (data.address || (data.streetNumber && data.houseNumber)) {
          // Solo enviar la dirección formateada, no el teléfono
          savedAddressForConfirm = data.address || `${data.streetNumber} #${data.houseNumber}, ${data.neighborhood || ''}`;
        }
      }
    } catch (e) { /* ignore */ }

    const result = await chatWithAIFn({
      message,
      menuItems,
      conversationHistory: conversationHistory.slice(-20),
      sessionId,
      schedules,
      isOrderingDisabled: menuData.isOrderingDisabled || false,
      savedAddress: savedAddressForConfirm,
    });

    return result.data;
  } catch (error) {
    console.error('Error llamando a la IA:', error);

    // Si la función no está desplegada o hay error de red
    if (error.code === 'functions/not-found' || error.code === 'functions/unavailable') {
      return {
        reply: '🔧 El asistente de IA no está disponible en este momento. Usa los botones del menú para hacer tu pedido.',
        orderData: null,
        isOrderComplete: false,
        quickReplies: ['Ver menú'],
        error: true,
        aiUnavailable: true,
      };
    }

    return {
      reply: '😅 Tuve un error de conexión. Intenta de nuevo o haz tu pedido con los botones.',
      orderData: null,
      isOrderComplete: false,
      quickReplies: ['Intentar de nuevo'],
      error: true,
    };
  }
}

/**
 * Verifica si la IA está disponible (Cloud Function desplegada)
 */
export async function checkAIAvailability() {
  try {
    const result = await chatWithAIFn({
      message: 'ping',
      menuItems: {},
      conversationHistory: [],
      sessionId: 'health_check',
      schedules: {},
      isOrderingDisabled: false,
    });
    return !result.data?.error;
  } catch {
    return false;
  }
}
