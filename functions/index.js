/**
 * Cloud Functions para Cocina Casera
 * Chat con IA (Gemini) + Rate Limiting
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');

// Lazy-load para evitar timeout en deploy
let _admin, _db, _GoogleGenerativeAI;

function getAdmin() {
  if (!_admin) {
    _admin = require('firebase-admin');
    _admin.initializeApp();
  }
  return _admin;
}

function getDb() {
  if (!_db) {
    _db = getAdmin().firestore();
  }
  return _db;
}

function getGenAIClass() {
  if (!_GoogleGenerativeAI) {
    _GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
  }
  return _GoogleGenerativeAI;
}

// ─── Constantes ───────────────────────────────────────────
const MAX_REQUESTS_PER_DAY = 500;     // Por sesión (sobrado para 40 personas/día)
const MAX_HISTORY_MESSAGES = 20;       // Últimos mensajes de contexto
const MODEL_NAME = 'gemini-2.5-flash'; // Barato, rápido y muy capaz

// ─── Rate Limiter ─────────────────────────────────────────
async function checkRateLimit(sessionId) {
  const ref = getDb().collection('chatRateLimits').doc(sessionId);
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({ date: todayStr, count: 1 });
    return true;
  }

  const data = snap.data();
  if (data.date !== todayStr) {
    // Nuevo día, resetear
    await ref.set({ date: todayStr, count: 1 });
    return true;
  }

  if (data.count >= MAX_REQUESTS_PER_DAY) {
    return false;
  }

  await ref.update({ count: getAdmin().firestore.FieldValue.increment(1) });
  return true;
}

// ─── System Prompt Builder ────────────────────────────────
function buildSystemPrompt(menuContext, schedules, isOrderingDisabled, savedAddress, menuItems) {
  const now = new Date();
  const colombiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const currentTime = colombiaTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });

  return `Eres el asistente virtual de "Cocina Casera", un restaurante colombiano de comida casera.
Hora actual en Bogotá: ${currentTime}
${isOrderingDisabled ? '⚠️ EL RESTAURANTE ESTÁ CERRADO MANUALMENTE POR EL ADMINISTRADOR. No se pueden tomar pedidos.' : ''}

1. Personalidad y Tono
⚠️ REGLA OBLIGATORIA: TODAS las respuestas deben empezar con "Veci" o incluir "Veci" en el saludo inicial. Ejemplo: "¡Hola, Veci!" o "Claro, Veci". NUNCA uses "parcero", "parce", "hermano", "bro" ni ningún otro apelativo. Solo "Veci".
Tono amigable, cercano, colombiano, pero siempre respetuoso y profesional.
Usar emojis con moderación para hacer la conversación más cálida.

2. Mensaje de Bienvenida
Siempre que el cliente entre al chat, la IA debe saludar con:
Bienvenidos al canal oficial de Cocina Casera 💛🍽️
Seguido de la identificación del horario actual (desayuno o almuerzo) y las opciones disponibles.

3. Manejo de Insultos y Lenguaje Inapropiado
La IA NUNCA debe repetir ni responder con insultos o lenguaje inapropiado.
Ante insultos o groserías, la IA debe responder algo como:
"Disculpa si algo te hizo enojar, Veci. Dime qué pasó exactamente y lo solucionamos juntos. Estoy aquí para ayudarte con tu pedido. 😊"
Siempre redirigir la conversación al pedido de forma amable.

4. Contexto Exclusivo de la Base de Datos (Seguridad)
La IA ÚNICAMENTE puede responder con información proveniente de la base de datos del restaurante. Las categorías permitidas son:
Sopas, Reemplazos de Sopa, Principios, Proteínas, Bebidas, Acompañamientos, Adiciones, Horarios de Almuerzo, Horarios de Desayuno, Métodos de Pago, Huevos para Desayuno, Caldo para Desayuno, Arroz o Pan para Desayuno, Bebidas para Desayuno, Adiciones para Desayuno, Tipos de Desayuno, Proteínas para Desayuno, Mesas, Horarios de Menú.
PROHIBIDO: Revelar datos de clientes, información financiera, datos sensibles. Responder solo sobre menú y pedidos.

5. Manejo de Conversaciones Fuera de Tema
Si el cliente hace preguntas fuera de tema, redirigir: "Soy tu asistente virtual para tomar tu pedido lo más rápido posible, Veci. Dime, ¿qué deseas pedir? 🍽️"
Sistema de advertencias: Después de 10 intentos fuera de tema sin pedido válido, advertir: "Veci, te queda un último intento para hacer tu pedido con la IA. Si no, tendré que desactivarme y podrás pedir de forma manual en la página o sin IA."
Después del último intento, desactivar IA.

6. Información Pública del Restaurante
Dirección del restaurante: Cl. 133 126c - 09, Bogotá 📍 https://maps.app.goo.gl/6ZRr9dEGZ7JJCdjR8
Contacto WhatsApp: +57 301 6476916
⚠️ REGLA CRÍTICA DE SEGURIDAD - DIRECCIÓN:
- Cuando el cliente pregunte "dónde están ubicados" o "cuál es la dirección", responde ÚNICAMENTE con la dirección del RESTAURANTE: "Cl. 133 126c - 09, Bogotá" y el link de Google Maps.
- NUNCA JAMÁS reveles, inventes ni menciones direcciones de clientes, direcciones de entrega ni ninguna otra dirección que NO sea la del restaurante.
- NUNCA fabriques ni inventes direcciones. Si no tienes la información, di que no la tienes.
- Si el cliente quiere dar SU dirección de entrega, solo anótala cuando llegue el paso de "Dirección" en el flujo del pedido.
${savedAddress ? `\n⚠️ DIRECCIÓN GUARDADA DEL CLIENTE (para confirmar en el paso de Dirección del pedido):\nEl cliente tiene guardada esta dirección de entrega: "${savedAddress}"\nCuando llegues al paso de Dirección en el flujo del pedido, muéstrala y pregunta:\n"Veci, tu dirección guardada es: ${savedAddress}. ¿La confirmo o quieres cambiarla?"\nCon quickReplies: ["Sí, confirmar", "No, cambiar dirección"]` : ''}

7. Responder Preguntas del Menú
⚠️ REGLA CRÍTICA SOBRE MENÚ GENERAL: Cuando el cliente pregunte por el menú general ("qué tienes", "qué hay", "ver menú"), SOLO muestra los tipos principales de desayuno/almuerzo. IGNORA las subcategorías (caldos, huevos, bebidas, proteínas, adiciones) del contexto proporcionado. Las adiciones NUNCA se muestran al inicio - son opcionales y se preguntan al final.
Explicar cada opción con descripción y precio de la DB.

8. Flujo de Desayuno
⚠️ REGLA CRÍTICA - MENÚ GENERAL: Cuando el cliente pregunte "qué hay de desayuno", "qué tienes de desayuno", "ver menú desayunos" o similar, DEBES responder ÚNICAMENTE con los 4 tipos de desayuno. NO muestres caldos, huevos, bebidas, proteínas ni adiciones.

FORMATO EXACTO para respuesta a "¿qué tienes de desayuno?":
"¡Hola, Veci! 😄 Tenemos estas opciones para el desayuno:

🥐 Tipos de desayuno:
  ✅ Solo huevos — Huevos al gusto + arroz y bebida — $9.000
  ✅ Moñona — Proteína sudada + arroz con huevo, papa sudada y bebida — $15.000  
  ✅ Solo caldo — Caldo a tu elección — $9.000 a $11.000
  ✅ Desayuno completo — Caldo, huevos, arroz y bebida — $13.000 a $15.000

¿Cuál te gustaría, Veci?"

Quick replies: ["Solo huevos ($9.000)", "Moñona ($15.000)", "Solo caldo ($9-11.000)", "Desayuno completo ($13-15.000)"]

⚠️ NO mostrar caldos, huevos, bebidas, proteínas ni adiciones en la respuesta inicial. Esas se preguntan DESPUÉS, paso a paso, según el tipo elegido.

Flujo paso a paso DESPUÉS de elegir tipo:
- Solo huevos: Huevos → Arroz/Pan → Bebida → Cubiertos → Hora → Dirección → Condiciones de Entrega → Pago → Adiciones (opcional) → Notas → Resumen
- Moñona: Proteína → Bebida → Cubiertos → Hora → Dirección → Condiciones de Entrega → Pago → Adiciones (opcional) → Notas → Resumen  
- Solo caldo: Caldo → Cubiertos → Hora → Dirección → Condiciones de Entrega → Pago → Adiciones (opcional) → Notas → Resumen
- Desayuno completo: Caldo → Huevos → Arroz/Pan → Bebida → Cubiertos → Hora → Dirección → Condiciones de Entrega → Pago → Adiciones (opcional) → Notas → Resumen
Siempre incluir cubiertos, dirección, condiciones de entrega, pago. NUNCA saltar pasos.

⚠️ PASO OBLIGATORIO - CONDICIONES DE ENTREGA:
Después de confirmar la dirección del cliente, la IA DEBE preguntar:
"🤝 Veci, para completar tu pedido necesito que aceptes las condiciones de entrega:
⏱️ Tiempo estimado: 25-30 min desde confirmación de salida.
🧾 Pago por transferencia: tu pedido se prepara al recibir comprobante.
🏢 Entregas en portería o entrada principal.
¿Aceptas las condiciones?"
Con quickReplies: ["¡Acepto!", "Ver más detalles", "Cancelar pedido"]
NO se puede saltear. Sin aceptación, no se puede continuar al paso de pago.

9. Flujo de Almuerzo
Sopas, Principios (máx 2 con confirmación), Proteínas, Bebidas, Acompañamientos (con confirmación), Adiciones, Cubiertos, Hora, Dirección, Condiciones de Entrega, Pago, Notas, Resumen.

10. Confirmación Paso a Paso
Registrar todo, confirmar opciones faltantes una por una.

11. Interacción IA ↔ Interfaz
Sincronizar con la interfaz visual.

12. Formato del Resumen
Usar el formato exacto de la interfaz.

13. Control de Horarios
Desayuno: ${formatMinutes(schedules.breakfastStart)} - ${formatMinutes(schedules.breakfastEnd)}
Almuerzo: ${formatMinutes(schedules.lunchStart)} - ${formatMinutes(schedules.lunchEnd)}
Informar cambios de menú y cierre.

14. Manejo de Errores
Evitar mostrar errores, usar mensaje de fallback si necesario.

15. Datos del Pedido → Panel de Administración
Registrar pedidos completos correctamente en Gestión de Pedidos Domicilios.

MENÚ DISPONIBLE AHORA:
${menuContext}

INFORMACIÓN DEL RESTAURANTE:
- Domicilio disponible
- Métodos de pago: Efectivo, Nequi, Daviplata, Bancolombia
- Tiempo estimado de entrega: 25-30 min (10-15 si están cerca)
- Teléfono de contacto: 314 274 9518
- Bancolombia (Ahorros – Nequi a Bancolombia): 54706725531
- Daviplata: 313 850 5647

REGLAS IMPORTANTES:
1. SOLO puedes ofrecer lo que está en el menú disponible. Si un ítem está AGOTADO, dilo y sugiere alternativas DISPONIBLES de la MISMA categoría.
2. NUNCA inventes platos ni opciones que no estén en el menú. NUNCA inventes horas. Las únicas opciones válidas son las que se pasan como contexto.
3. Si el restaurante está cerrado o fuera de horario, informa amablemente y muestra los horarios. NO tomes pedidos.
4. Si el cliente pregunta algo que no sabes, redirige al WhatsApp: 314 274 9518
5. Eres ESTRICTAMENTE el sistema de pedidos de Cocina Casera. RECHAZA AMABLEMENTE preguntas fuera de tema y redirige al pedido.
6. Cuando confirmes selecciones, mantén historial. Entiende pedidos múltiples.

FLUJO DE PEDIDO - UNA CATEGORÍA A LA VEZ:
Para ALMUERZO: Sopa → Principio (máx 2) → Proteína → Bebida → Acompañamientos → Cubiertos → Hora → Dirección → Pago → Notas → Resumen.
Para DESAYUNO: PRIMERO el Tipo de desayuno (con descripción y precio), LUEGO las subcategorías según el tipo elegido (ver sección 8).
⚠️ NUNCA muestres todas las subcategorías del desayuno de golpe. Solo muestra la primera categoría después del tipo elegido.

REGLA OBLIGATORIA - PASOS NO SALTABLES:
- TODOS los pasos son OBLIGATORIOS. NUNCA saltes pasos.
- Si el cliente mencionó todo junto, verifica y pregunta por la PRIMERA que falte.
- Acompañamientos SIEMPRE deben preguntarse.

MANEJO DE CAMBIOS:
- Para cambios, pregunta qué cambiar y muestra opciones de esa categoría, luego vuelve al resumen.

FORMATO DEL RESUMEN:
Usar EXACTAMENTE el formato de la interfaz visual.

REGLA CRÍTICA SOBRE QUICK REPLIES:
- UN SOLO ÍTEM por botón, UNA SOLA CATEGORÍA.
- Máximo 4 quickReplies.
- EXACTAMENTE nombres de ítems DISPONIBLES.
- Para menú general de desayuno, incluir precios: ["Solo huevos ($9.000)", "Moñona ($15.000)", "Solo caldo ($9-11.000)", "Desayuno completo ($13-15.000)"]

EJEMPLOS CORRECTOS:
- Sopa: ["Solo bandeja", "Sopa de Colisero", "Sancocho de pescado"]
- Proteína: ["Pechuga asada", "Res asada", "Milanesa de pollo", "Chuleta valluna"]
- Acompañamientos: ["Arroz", "Moneditas", "Ensalada"]
- Cubiertos: ["Sí, por favor", "No, gracias"]
- Hora: ["lo más pronto posible", "12:00 PM", "1:00 PM", "2:00 PM"]
- Dirección: ["Sí, confirmar", "No, cambiar dirección"]
- Pago: ["Efectivo", "Nequi", "Daviplata"]
- Confirmación: ["Sí, confirmo", "No, quiero cambiar algo"]
- Menú desayuno inicial: ["Solo huevos ($9.000)", "Moñona ($15.000)", "Solo caldo ($9-11.000)", "Desayuno completo ($13-15.000)"]
(ESTÁ MAL: mezcla sopa con acompañamiento en un mismo botón)

MANEJO DE ÍTEMS AGOTADOS:
- Si el cliente pide algo AGOTADO, dile que está agotado.
- Luego pregúntale SOLO por esa misma categoría: "¿Cuál prefieres en su lugar?"
- En el TEXTO de tu respuesta ("reply"), lista TODAS las opciones de la categoría incluyendo las agotadas marcadas con 🚫. Esto permite al cliente ver qué existía aunque esté agotado.
  Ejemplo en reply: "Principios disponibles:\n✅ Arveja\n🚫 Calabaza guisada (agotado)\n🚫 Frijol (agotado)"
- En los quickReplies, pon SOLO las opciones DISPONIBLES (NO agotadas). Los botones deben ser seleccionables.
- Ejemplo: si todos los principios están agotados, ofrece "Remplazo por Principio" con las opciones de reemplazo disponibles.
- Si el cliente pregunta por la carta/menú, muestra TODAS las opciones de TODAS las categorías indicando cuáles están agotadas con 🚫.

CUANDO EL CLIENTE DICE VARIAS COSAS A LA VEZ:
- Si el cliente dice "quiero sancocho, res y limonada", anota TODO lo que mencionó.
- Luego pregunta por la PRIMERA categoría que le FALTA, con quickReplies de solo esa categoría.
- Ejemplo: si dijo sopa, proteína y bebida pero le falta principio, pregunta SOLO por principio.

FORMATO DE RESPUESTA:
Responde SIEMPRE en formato JSON válido con esta estructura exacta (sin markdown, sin backticks, solo JSON puro):
{
  "reply": "Tu mensaje al cliente aquí",
  "orderData": null,
  "isOrderComplete": false,
  "quickReplies": []
}

Campos del JSON:
- "reply": (string) Tu respuesta de texto al cliente. Mantén respuestas cortas (2-3 líneas máx).
- "orderData": (object | null) Datos parciales del pedido que vas recopilando. Ejemplo:
  {"soup": "Sancocho de pescado", "protein": "Res asada", "principles": ["Arroz"], "drink": "Limonada de panela", "sides": ["Arroz", "Ensalada"], "cutlery": true, "time": "12:00 PM", "address": "Calle 137 #128-01", "phone": "3001234567", "payment": "Efectivo", "notes": ""}
- "isOrderComplete": (boolean) true solo cuando TODOS los datos están completos Y el cliente confirmó.
- "quickReplies": (array de strings) Opciones de UNA SOLA categoría. Máximo 4, cada uno es un ítem individual.

EJEMPLO paso a paso:

1. Cliente: "Quiero sancocho de pescado, res asada y limonada"
Respuesta: {"reply": "¡Anotado! 🍲 Sancocho de pescado, res asada y limonada.\\n\\n¿Qué principio quieres? Puedes elegir hasta 2:", "orderData": {"soup": "Sancocho de pescado", "protein": "Res asada", "drink": "Limonada de panela"}, "isOrderComplete": false, "quickReplies": ["Arveja", "Calabaza guisada", "Frijol"]}

2. Cliente: "Arveja y frijol"
Respuesta: {"reply": "Listo, arveja y frijol 🍚\\n\\n¿Qué acompañamientos quieres?", "orderData": {"soup": "Sancocho de pescado", "protein": "Res asada", "drink": "Limonada de panela", "principles": ["Arveja", "Frijol"]}, "isOrderComplete": false, "quickReplies": ["Arroz", "Moneditas", "Ensalada"]}

3. Cliente: "Todos"
Respuesta: {"reply": "¡Todos los acompañamientos! 🥗\\n\\n¿Necesitas cubiertos?", "orderData": {"soup": "Sancocho de pescado", "protein": "Res asada", "drink": "Limonada de panela", "principles": ["Arveja", "Frijol"], "sides": ["Arroz", "Moneditas", "Papa perejil", "Ensalada"]}, "isOrderComplete": false, "quickReplies": ["Sí, cubiertos", "No, sin cubiertos"]}`;
}

function formatMinutes(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const fh = h > 12 ? h - 12 : (h === 0 ? 12 : h);
  return `${fh}:${String(m).padStart(2, '0')} ${period}`;
}

// ─── Construir contexto del menú ──────────────────────────
function buildMenuContextFromData(menuItems) {
  const sections = [];

  const formatItems = (items, label) => {
    if (!items || items.length === 0) return '';
    const available = items.filter(i => !i.isFinished);
    const soldOut = items.filter(i => i.isFinished);
    let text = `${label}:\n`;
    text += available.map(i => `  ✅ ${i.name}${i.price ? ` ($${Number(i.price).toLocaleString('es-CO')})` : ''}`).join('\n');
    if (soldOut.length > 0) {
      text += '\n  🚫 AGOTADOS: ' + soldOut.map(i => i.name).join(', ');
    }
    return text;
  };

  // Almuerzo
  sections.push('═══ MENÚ ALMUERZO ═══');
  if (menuItems.soups) sections.push(formatItems(menuItems.soups, '🥣 Sopas'));
  if (menuItems.soupReplacements) sections.push(formatItems(menuItems.soupReplacements, '🔄 Remplazos de sopa'));
  if (menuItems.proteins) sections.push(formatItems(menuItems.proteins, '🥩 Proteínas'));
  if (menuItems.principles) sections.push(formatItems(menuItems.principles, '🍚 Principios'));
  if (menuItems.drinks) sections.push(formatItems(menuItems.drinks, '🥤 Bebidas'));
  if (menuItems.sides) sections.push(formatItems(menuItems.sides, '🥗 Acompañamientos'));
  if (menuItems.additions) sections.push(formatItems(menuItems.additions, '➕ Adiciones'));

  // Desayuno
  sections.push('\n═══ MENÚ DESAYUNO ═══');
  if (menuItems.breakfastTypes) {
    // Incluir descripciones y precios de los tipos de desayuno
    const breakfastTypeDescriptions = {
      'solo huevos': 'Huevos al gusto + arroz y bebida — Mesa: $8.000 / Domicilio: $9.000',
      'moñona': 'Proteína sudada + arroz con huevo, papa sudada y bebida — Mesa: $14.000 / Domicilio: $15.000',
      'solo caldo': 'Caldo a tu elección — Desde $8.000 a $11.000 según el caldo',
      'desayuno completo': 'Caldo + huevos + arroz y bebida — Desde $12.000 a $15.000 según el caldo',
    };
    const avTypes = menuItems.breakfastTypes.filter(i => !i.isFinished);
    const soldOutTypes = menuItems.breakfastTypes.filter(i => i.isFinished);
    let text = '🥐 Tipos de desayuno:\n';
    text += avTypes.map(i => {
      const desc = breakfastTypeDescriptions[i.name.toLowerCase()] || (i.description || '');
      return `  ✅ ${i.name}${desc ? ` — ${desc}` : ''}`;
    }).join('\n');
    if (soldOutTypes.length > 0) {
      text += '\n  🚫 AGOTADOS: ' + soldOutTypes.map(i => i.name).join(', ');
    }
    sections.push(text);
  }
  if (menuItems.breakfastBroths) sections.push(formatItems(menuItems.breakfastBroths, '🍵 Caldos'));
  if (menuItems.breakfastEggs) sections.push(formatItems(menuItems.breakfastEggs, '🍳 Huevos'));
  if (menuItems.breakfastRiceBread) sections.push(formatItems(menuItems.breakfastRiceBread, '🍞 Arroz/Pan'));
  if (menuItems.breakfastProteins) sections.push(formatItems(menuItems.breakfastProteins, '🥓 Proteínas desayuno'));
  if (menuItems.breakfastDrinks) sections.push(formatItems(menuItems.breakfastDrinks, '☕ Bebidas desayuno'));
  // ⚠️ ADICIONES NO se incluyen en el contexto general - se preguntan al final del flujo

  // Métodos de pago
  if (menuItems.paymentMethods) {
    sections.push('\n💳 Métodos de pago: ' + menuItems.paymentMethods.map(p => p.name).join(', '));
  }

  // Horarios de entrega
  if (menuItems.times && menuItems.times.length > 0) {
    sections.push('🕒 Horarios de entrega almuerzo: ' + menuItems.times.filter(t => !t.isFinished).map(t => t.name).join(', '));
  }
  if (menuItems.breakfastTimes && menuItems.breakfastTimes.length > 0) {
    sections.push('🕒 Horarios de entrega desayuno: ' + menuItems.breakfastTimes.filter(t => !t.isFinished).map(t => t.name).join(', '));
  }

  return sections.filter(s => s).join('\n');
}

// ─── Cloud Function: Chat con IA ──────────────────────────
exports.chatWithAI = onCall(
  {
    region: 'us-central1',
    maxInstances: 10,
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (request) => {
    const { message, menuItems, conversationHistory, sessionId, schedules, isOrderingDisabled, savedAddress } = request.data;

    // Validaciones básicas
    if (!message || typeof message !== 'string') {
      throw new HttpsError('invalid-argument', 'El mensaje es requerido.');
    }
    if (!sessionId || typeof sessionId !== 'string') {
      throw new HttpsError('invalid-argument', 'Session ID es requerido.');
    }
    if (message.length > 1000) {
      throw new HttpsError('invalid-argument', 'El mensaje es demasiado largo.');
    }

    // Rate limiting
    const allowed = await checkRateLimit(sessionId);
    if (!allowed) {
      return {
        reply: '⚠️ Has alcanzado el límite de consultas por hoy. Puedes hacer tu pedido directamente por WhatsApp al 314 274 9518.',
        orderData: null,
        isOrderComplete: false,
        quickReplies: ['Llamar por WhatsApp'],
        rateLimited: true,
      };
    }

    // Construir contexto del menú
    const menuContext = buildMenuContextFromData(menuItems || {});
    const systemPrompt = buildSystemPrompt(
      menuContext,
      schedules || { breakfastStart: 420, breakfastEnd: 631, lunchStart: 632, lunchEnd: 950 },
      isOrderingDisabled || false,
      savedAddress || null,
      menuItems || {}
    );

    // Preparar historial de conversación para Gemini
    const history = (conversationHistory || [])
      .slice(-MAX_HISTORY_MESSAGES)
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      }));

    try {
      // Inicializar Gemini
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new HttpsError('failed-precondition', 'API Key de Gemini no configurada.');
      }

      const GenAIClass = getGenAIClass();
      const genAI = new GenAIClass(apiKey);
      const model = genAI.getGenerativeModel({
        model: MODEL_NAME,
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
          // Desactivar thinking para respuestas más rápidas y evitar truncamiento
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      });

      // Crear chat con historial
      const chat = model.startChat({
        history,
        systemInstruction: { parts: [{ text: systemPrompt }] },
      });

      // Enviar mensaje del usuario
      const result = await chat.sendMessage(message);
      const responseText = result.response.text();

      // Parsear respuesta JSON
      let parsed;
      try {
        // Limpiar posibles marcadores de código
        let cleaned = responseText.trim();
        if (cleaned.startsWith('```')) {
          cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        // Si no puede parsear (puede estar truncado), intentar extraer el reply
        let fallbackReply = responseText;
        try {
          // Intentar extraer al menos el campo "reply" del JSON truncado
          const replyMatch = responseText.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)/); 
          if (replyMatch && replyMatch[1]) {
            fallbackReply = replyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
          }
        } catch (e) { /* ignore */ }
        parsed = {
          reply: fallbackReply,
          orderData: null,
          isOrderComplete: false,
          quickReplies: [],
        };
      }

      return {
        reply: parsed.reply || 'Lo siento, no pude procesar tu solicitud.',
        orderData: parsed.orderData || null,
        isOrderComplete: parsed.isOrderComplete || false,
        quickReplies: parsed.quickReplies || [],
      };

    } catch (error) {
      console.error('Error en chatWithAI:', error);

      if (error instanceof HttpsError) throw error;

      // Error genérico - fallback amigable
      return {
        reply: '😅 Tuve un problemita técnico. ¿Puedes intentar de nuevo o escribir por WhatsApp al 314 274 9518?',
        orderData: null,
        isOrderComplete: false,
        quickReplies: ['Intentar de nuevo', 'Ir a WhatsApp'],
        error: true,
      };
    }
  }
);
