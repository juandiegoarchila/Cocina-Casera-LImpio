// src/components/Admin/InteraccionesPedidos.js
import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, TrashIcon, PencilIcon } from '@heroicons/react/24/outline';
import { PrinterIcon } from '@heroicons/react/24/outline';
// Función para imprimir recibo de domicilio
const handlePrintDeliveryReceipt = (order) => {
  // SOLO imprime el recibo, NO abre la caja registradora
  const win = window.open('', 'PRINT', 'height=700,width=400');
  if (!win) return;
  const isBreakfast = order.type === 'breakfast';
  const pago = order.payment || order.paymentMethod || 'N/A';
  const total = order.total?.toLocaleString('es-CO') || 'N/A';
  const tipo = isBreakfast ? 'Desayuno' : 'Almuerzo';
  const address = (isBreakfast ? order.breakfasts?.[0]?.address : order.meals?.[0]?.address) || order.address || {};
  const direccion = address.address || '';
  const telefono = address.phoneNumber || '';
  const barrio = address.neighborhood || '';
  const detalles = address.details || '';
  const now = new Date();
  const fecha = now.toLocaleDateString('es-CO') + ' ' + now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  
  // Obtener la hora de entrega usando la misma lógica que en la tabla
  const timeValue = order.meals?.[0]?.time || order.breakfasts?.[0]?.time || order.time || null;
  let deliveryTime = '';
  
  // timeValue puede ser: string, {name}, Firestore Timestamp, Date, o null
  if (typeof timeValue === 'string' && timeValue.trim()) {
    deliveryTime = timeValue;
  } else if (timeValue instanceof Date) {
    deliveryTime = timeValue.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  } else if (timeValue && typeof timeValue === 'object') {
    // Firestore Timestamp tiene toDate(); también aceptamos { name }
    if (typeof timeValue.toDate === 'function') {
      try {
        const d = timeValue.toDate();
        deliveryTime = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        deliveryTime = timeValue.name || '';
      }
    } else if (timeValue.name && typeof timeValue.name === 'string') {
      deliveryTime = timeValue.name;
    }
  }
  
  let resumen = '';
  if (!isBreakfast && Array.isArray(order.meals)) {
    resumen += `<div style='font-weight:bold;margin-bottom:4px;'>✅ Resumen del Pedido</div>`;
    resumen += `<div>🍽 ${order.meals.length} almuerzos en total</div>`;
    order.meals.forEach((m, idx) => {
      resumen += `<div style='margin-top:10px;'><b>🍽 Almuerzo ${idx + 1} – ${(order.total || '').toLocaleString('es-CO')} (${pago})</b></div>`;
      if (m.soup?.name === 'Solo bandeja') resumen += '<div>solo bandeja</div>';
      else if (m.soupReplacement?.name) resumen += `<div>${m.soupReplacement.name} (por sopa)</div>`;
      else if (m.soup?.name && m.soup.name !== 'Sin sopa') resumen += `<div>${m.soup.name}</div>`;
      if (m.principleReplacement?.name) resumen += `<div>${m.principleReplacement.name} (por principio)</div>`;
      else if (Array.isArray(m.principle) && m.principle.length > 0) {
        const principles = m.principle.map(p => p.name).join(', ');
        // Agregar (mixto) si hay más de un principio
        const mixtoLabel = m.principle.length > 1 ? ' (mixto)' : '';
        resumen += `<div>${principles}${mixtoLabel}</div>`;
      }
      const specialRice = Array.isArray(m.principle) && m.principle.some(p => ['Arroz con pollo', 'Arroz paisa', 'Arroz tres carnes'].includes(p.name));
      if (specialRice) resumen += `<div>Proteína: Ya incluida en el arroz</div>`;
      else if (m.protein?.name) resumen += `<div>Proteína: ${m.protein.name}</div>`;
      if (m.drink?.name) resumen += `<div>${m.drink.name === 'Juego de mango' ? 'Jugo de mango' : m.drink.name}</div>`;
      resumen += `<div>Cubiertos: ${m.cutlery ? 'Sí' : 'No'}</div>`;
      if (specialRice) resumen += `<div>Acompañamientos: Ya incluidos</div>`;
      else if (Array.isArray(m.sides) && m.sides.length > 0) {
        // Mostrar los acompañamientos seleccionados sin etiqueta mixto
        const sides = m.sides.map(s => s.name).join(', ');
        resumen += `<div>Acompañamientos: ${sides}</div>`;
      }
      else resumen += `<div>Acompañamientos: Ninguno</div>`;
      
      // Agregar la sección "No Incluir" solo con acompañamientos disponibles para ese día
      // Asumir que estos son los acompañamientos disponibles reales, no inventados
      const availableSidesForToday = ['Arroz', 'Ensalada', 'Papa', 'Tajadas'];
      const selectedSides = Array.isArray(m.sides) ? m.sides.map(s => s.name) : [];
      
      // Filtrar los acompañamientos no seleccionados pero disponibles hoy
      const excludedItems = availableSidesForToday.filter(side => 
        !selectedSides.some(s => s.includes(side))
      );
      
      // Solo mostrar "No Incluir" si hay elementos para excluir
      if (excludedItems.length > 0) {
        resumen += `<div>No Incluir: ${excludedItems.join(', ')}</div>`;
      }
      
      if (Array.isArray(m.additions) && m.additions.length > 0) {
        resumen += `<div>Adiciones:</div>`;
        m.additions.forEach(a => {
          resumen += `<div style='margin-left:10px;'>- ${a.name}${a.protein ? ' (' + a.protein + ')' : ''} (${a.quantity || 1})</div>`;
        });
      }
      resumen += `<div>Notas: ${m.notes || 'Ninguna'}</div>`;
    });
  } else if (isBreakfast && Array.isArray(order.breakfasts)) {
    resumen += `<div style='font-weight:bold;margin-bottom:4px;'>✅ Resumen del Pedido</div>`;
    resumen += `<div>🍽 ${order.breakfasts.length} desayunos en total</div>`;
    order.breakfasts.forEach((b, idx) => {
      resumen += `<div style='margin-top:10px;'><b>🍽 Desayuno ${idx + 1} – ${(order.total || '').toLocaleString('es-CO')} (${pago})</b></div>`;
      if (b.type) resumen += `<div>Tipo: ${typeof b.type === 'string' ? b.type : b.type?.name || ''}</div>`;
      if (b.broth) resumen += `<div>Caldo: ${typeof b.broth === 'string' ? b.broth : b.broth?.name || ''}</div>`;
      if (b.eggs) resumen += `<div>Huevos: ${typeof b.eggs === 'string' ? b.eggs : b.eggs?.name || ''}</div>`;
      if (b.riceBread) resumen += `<div>Arroz/Pan: ${typeof b.riceBread === 'string' ? b.riceBread : b.riceBread?.name || ''}</div>`;
      if (b.drink) resumen += `<div>Bebida: ${typeof b.drink === 'string' ? b.drink : b.drink?.name || ''}</div>`;
      if (b.protein) resumen += `<div>Proteína: ${typeof b.protein === 'string' ? b.protein : b.protein?.name || ''}</div>`;
      if (b.additions && b.additions.length > 0) {
        resumen += `<div>Adiciones:</div>`;
        b.additions.forEach(a => {
          resumen += `<div style='margin-left:10px;'>- ${a.name} (${a.quantity || 1})</div>`;
        });
      }
      resumen += `<div>Notas: ${b.notes || 'Ninguna'}</div>`;
    });
  }
  win.document.write(`
    <html><head><title>Recibo Domicilio</title>
    <style>
      body { font-family: monospace; font-size: 14px; margin: 0; padding: 0; }
      h2 { margin: 0 0 8px 0; font-size: 18px; }
      .line { border-bottom: 1px dashed #888; margin: 8px 0; }
    </style>
    </head><body>
    <h2>RECIBO DE DOMICILIO</h2>
    <div class='line'></div>
    <div><b>Tipo:</b> ${tipo}</div>
    <div><b>Pago:</b> ${pago}</div>
    <div><b>Total:</b> ${total}</div>
    <div><b>Fecha:</b> ${fecha}</div>
    ${deliveryTime ? `<div><b>Entrega:</b> ${deliveryTime}</div>` : ''}
    <div class='line'></div>
    <div><b>Dirección:</b> ${direccion}</div>
    <div><b>Barrio:</b> ${barrio}</div>
    <div><b>Teléfono:</b> ${telefono}</div>
    <div><b>Detalles:</b> ${detalles}</div>
    <div class='line'></div>
    ${resumen}
    <div class='line'></div>
    <div style='text-align:center;margin-top:16px;'>¡Gracias por su compra!</div>
<br><br><br><br><br><br>
    </body></html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 500);
};
import { classNames } from '../../utils/classNames';
import OrderSummary from '../OrderSummary';
import BreakfastOrderSummary from '../BreakfastOrderSummary';
import { db } from '../../config/firebase';
import { deleteDoc, doc, updateDoc, onSnapshot, collection } from 'firebase/firestore';
import OptionSelector from '../OptionSelector';

// Lista de barrios disponibles
const BARRIOS = [
  "Gaitana",
  "Lisboa",
  "Berlín",
  "Tibabuyes",
];
import { calculateTotal } from '../../utils/MealCalculations';
import { calculateBreakfastPrice } from '../../utils/BreakfastCalculations';


// ===================== Helpers para hidratación =====================
const normalizeName = (s) => (s || '').replace(/\s*NUEVO\s*$/i, '').trim();

const byName = (list, value) => {
  if (!value) return null;
  const name = typeof value === 'string' ? value : value?.name;
  return list.find((o) => normalizeName(o.name) === normalizeName(name)) || null;
};

// Función específica para reemplazos que maneja más casos
const byNameReplacement = (list, value) => {
  if (!value) return null;
  
  // Si es string, buscar directamente
  if (typeof value === 'string') {
    const found = list.find((o) => normalizeName(o.name) === normalizeName(value));
    if (found) return found;
    
    // Buscar por coincidencia parcial si no se encuentra exacta
    const partialMatch = list.find((o) => 
      normalizeName(o.name).includes(normalizeName(value)) ||
      normalizeName(value).includes(normalizeName(o.name))
    );
    if (partialMatch) return partialMatch;
  }
  
  // Si es objeto, intentar varias propiedades
  if (typeof value === 'object') {
    const possibleNames = [
      value.name,
      value.replacement,
      value.replacementName,
      value.replacementText
    ].filter(Boolean);
    
    for (const name of possibleNames) {
      // Busqueda exacta primero
      let found = list.find((o) => normalizeName(o.name) === normalizeName(name));
      if (found) return found;
      
      // Busqueda parcial como fallback
      found = list.find((o) => 
        normalizeName(o.name).includes(normalizeName(name)) ||
        normalizeName(name).includes(normalizeName(o.name))
      );
      if (found) return found;
    }
  }
  
  // Fallback final: si el valor parece ser un reemplazo pero no se encontró,
  // intentar crear un objeto temporal con el nombre
  if (typeof value === 'string' && value.trim()) {
    return { name: value.trim(), id: `temp-${Date.now()}` };
  }
  
  return null;
};

const manyByName = (list, arr) => (Array.isArray(arr) ? arr.map((v) => byName(list, v)).filter(Boolean) : []);

const ensureAddress = (addr = {}, fallback = {}) => ({
  address: addr.address ?? fallback.address ?? '',
  phoneNumber: addr.phoneNumber ?? fallback.phoneNumber ?? '',
  neighborhood: addr.neighborhood ?? fallback.neighborhood ?? '',
  localName: addr.localName ?? fallback.localName ?? '',
  unitDetails: addr.unitDetails ?? fallback.unitDetails ?? '',
  recipientName: addr.recipientName ?? fallback.recipientName ?? '',
  details: addr.details ?? fallback.details ?? '',
});

const InteraccionesPedidos = ({
  theme,
  showProteinModal,
  setShowProteinModal,
  newProtein,
  setNewProtein,
  handleAddProtein,
  proteins,
  totalProteinUnits,
  isLoading,
  showMealDetails,
  setShowMealDetails,
  editingOrder,
  setEditingOrder,
  editForm,
  handleMealFormFieldChange,
  handleEditFormFieldChange,
  handleSaveEdit,
  showConfirmDeleteAll,
  setShowConfirmDeleteAll,
  confirmText,
  setConfirmText,
  handleDeleteAllOrders,
  setError,
  setSuccess,
  showAddOrderModal,
  setShowAddOrderModal,
  newOrderForm,
  handleNewOrderMealFormFieldChange,
  handleNewOrderFieldChange,
  handleAddOrderSubmit,
  uniqueDeliveryPersons,
}) => {
  const [soups, setSoups] = useState([]);
  const [soupReplacements, setSoupReplacements] = useState([]);
  const [principles, setPrinciples] = useState([]);
  const [menuProteins, setMenuProteins] = useState([]);
  const [drinks, setDrinks] = useState([]);
  const [sides, setSides] = useState([]);
  const [additions, setAdditions] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);

  const [breakfastEggs, setBreakfastEggs] = useState([]);
  const [breakfastBroths, setBreakfastBroths] = useState([]);
  const [breakfastRiceBread, setBreakfastRiceBread] = useState([]);
  const [breakfastDrinks, setBreakfastDrinks] = useState([]);
  const [breakfastAdditions, setBreakfastAdditions] = useState([]);
  const [breakfastTypes, setBreakfastTypes] = useState([]);
  const [breakfastProteins, setBreakfastProteins] = useState([]);

  // NUEVO: estado usado por el modal de proteínas
  const [editingProtein, setEditingProtein] = useState(null);

  // ===================== Carga de catálogos =====================
  useEffect(() => {
    const mapSetter = {
      soups: setSoups,
      soupReplacements: setSoupReplacements,
      principles: setPrinciples,
      proteins: setMenuProteins,
      drinks: setDrinks,
      sides: setSides,
      additions: setAdditions,
      paymentMethods: setPaymentMethods,
      breakfastEggs: setBreakfastEggs,
      breakfastBroths: setBreakfastBroths,
      breakfastRiceBread: setBreakfastRiceBread,
      breakfastDrinks: setBreakfastDrinks,
      breakfastAdditions: setBreakfastAdditions,
      breakfastTypes: setBreakfastTypes,
      breakfastProteins: setBreakfastProteins,
    };

    const listen = (name) =>
      onSnapshot(collection(db, name), (snap) => mapSetter[name](snap.docs.map((d) => ({ id: d.id, ...d.data() }))));

    const unsubs = [
      listen('soups'),
      listen('soupReplacements'),
      listen('principles'),
      listen('proteins'),
      listen('drinks'),
      listen('sides'),
      listen('additions'),
      listen('paymentMethods'),
      listen('breakfastEggs'),
      listen('breakfastBroths'),
      listen('breakfastRiceBread'),
      listen('breakfastDrinks'),
      listen('breakfastAdditions'),
      listen('breakfastTypes'),
      listen('breakfastProteins'),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, []);

  // ===================== Editar Breakfast (setter anidado) =====================
  const handleBreakfastFormFieldChange = (index, field, value) => {
    const list = Array.isArray(editForm.breakfasts) ? [...editForm.breakfasts] : [];
    if (!list[index]) list[index] = {};
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      list[index] = { ...list[index], [parent]: { ...(list[index][parent] || {}), [child]: value } };
    } else {
      list[index] = { ...list[index], [field]: value };
    }
    handleEditFormFieldChange('breakfasts', list);
  };

  // Passthrough inmediato para OptionSelector de desayuno
  const handleBreakfastImmediate = (idx, field, value) => {
    handleBreakfastFormFieldChange(idx, field, value);
  };

  // ===================== Hidratación segura del formulario =====================
  const hydratedOrderIdRef = React.useRef(null);

  // Reset de bandera cuando cierras/abres otra orden
  useEffect(() => {
    if (!editingOrder) hydratedOrderIdRef.current = null;
  }, [editingOrder]);

  useEffect(() => {
    if (!editingOrder) return;

    const catalogsLoaded =
      soups.length ||
      principles.length ||
      menuProteins.length ||
      drinks.length ||
      sides.length ||
      additions.length ||
      breakfastTypes.length ||
      breakfastBroths.length ||
      breakfastEggs.length ||
      breakfastRiceBread.length ||
      breakfastDrinks.length ||
      breakfastAdditions.length ||
      breakfastProteins.length;

    if (!catalogsLoaded) return;

    if (hydratedOrderIdRef.current === editingOrder.id) return; // evita rehidrataciones

    const fallbackAddress = editingOrder.address || {};

    // Total preferimos recalcular solo para almuerzos; para desayuno respetamos total existente
    const computedTotal =
      typeof editingOrder.total === 'number'
        ? editingOrder.total
        : editingOrder.type === 'breakfast'
        ? editingOrder.total || 0
        : Array.isArray(editingOrder.meals)
        ? Number(calculateTotal(editingOrder.meals) || 0)
        : 0;

    handleEditFormFieldChange('total', computedTotal);
    handleEditFormFieldChange('payment', editingOrder.payment || '');
    handleEditFormFieldChange('status', editingOrder.status || 'Pendiente');
    handleEditFormFieldChange('deliveryPerson', editingOrder.deliveryPerson || '');

    if (editingOrder.type === 'breakfast') {
      const breakfasts = (editingOrder.breakfasts || []).map((b) => ({
        type: byName(breakfastTypes, b.type),
        broth: byName(breakfastBroths, b.broth),
        eggs: byName(breakfastEggs, b.eggs),
        riceBread: byName(breakfastRiceBread, b.riceBread),
        drink: byName(breakfastDrinks, b.drink),
        protein: byName(breakfastProteins, b.protein),
        additions: Array.isArray(b.additions)
          ? b.additions
              .map((a) => {
                const full = byName(breakfastAdditions, a);
                return full ? { ...full, quantity: a.quantity || 1 } : null;
              })
              .filter(Boolean)
          : [],
        cutlery: !!b.cutlery,
        time: typeof b.time === 'string' ? b.time : b.time?.name || '',
        address: ensureAddress(b.address, fallbackAddress),
        notes: b.notes || '',
      }));
      handleEditFormFieldChange('breakfasts', breakfasts);
    } else {
      // Debug temporal para ver los datos crudos del ADMIN
      console.log('🔍 ADMIN DEBUG principleReplacement:', {
        meals: editingOrder.meals,
        soupReplacements: soupReplacements,
        firstMeal: editingOrder.meals?.[0],
        soupReplacementValue: editingOrder.meals?.[0]?.soupReplacement,
        principleReplacementValue: editingOrder.meals?.[0]?.principleReplacement
      });
      
      const meals = (editingOrder.meals || []).map((m) => ({
        soup: byName(soups, m.soup),
        soupReplacement: byNameReplacement(soupReplacements, m.soupReplacement),
        // Construir principle inicial (sin placeholder) y principleRaw
        principle: (() => {
          const base = Array.isArray(m.principle)
            ? m.principle.map((p) => byName(principles, p)).filter(Boolean)
            : [];
          return base;
        })(),
        principleRaw: Array.isArray(m.principle) ? m.principle : [],
        principleReplacement: (() => {
          // 1. Campo dedicado
          const found = byNameReplacement(soupReplacements, m.principleReplacement);
          if (found) return { name: found.name };
          if (typeof m.principleReplacement === 'string' && m.principleReplacement.trim()) return { name: m.principleReplacement.trim() };
          if (typeof m.principleReplacement === 'object' && m.principleReplacement?.name) return { name: m.principleReplacement.name };
          // 2. Derivar de placeholder embebido
            if (Array.isArray(m.principle)) {
              const placeholder = m.principle.find(p => {
                const n = typeof p === 'string' ? p : p?.name;
                return n && n.toLowerCase().includes('remplazo por principio');
              });
              if (placeholder) {
                let candidate = '';
                if (typeof placeholder === 'object') {
                  let rawCandidate = placeholder.replacement || placeholder.selectedReplacement || placeholder.value || '';
                  if (rawCandidate && typeof rawCandidate === 'object') rawCandidate = rawCandidate.name || '';
                  candidate = rawCandidate;
                  if (!candidate && typeof placeholder.name === 'string') {
                    const match = placeholder.name.match(/remplazo por principio\s*\(([^)]+)\)/i);
                    if (match && match[1]) candidate = match[1];
                  }
                } else if (typeof placeholder === 'string') {
                  const match = placeholder.match(/remplazo por principio\s*\(([^)]+)\)/i);
                  if (match && match[1]) candidate = match[1];
                }
                if (candidate && typeof candidate === 'string' && candidate.trim()) return { name: candidate.trim() };
              }
            }
          return null;
        })(),
        protein: byName(menuProteins, m.protein),
        drink: byName(drinks, m.drink),
        sides: manyByName(sides, m.sides),
        additions: Array.isArray(m.additions)
          ? m.additions
              .map((a) => {
                const full = byName(additions, a);
                return full ? { ...full, quantity: a.quantity || 1, price: a.price ?? full.price ?? 0 } : null;
              })
              .filter(Boolean)
          : [],
        cutlery: !!m.cutlery,
        time: typeof m.time === 'string' ? m.time : m.time?.name || '',
        address: ensureAddress(m.address, fallbackAddress),
        notes: m.notes || '',
        }));

      // Segunda pasada: si hay principleReplacement y no está el placeholder, insertarlo para edición (visual en verde)
      const placeholderPrinciple = principles.find(p => p.name === 'Remplazo por Principio');
      meals.forEach(mealObj => {
        if (mealObj.principleReplacement && placeholderPrinciple) {
          const hasPlaceholder = Array.isArray(mealObj.principle) && mealObj.principle.some(p => p?.name === 'Remplazo por Principio');
          if (!hasPlaceholder) {
            mealObj.principle = [placeholderPrinciple];
            try { console.log('[EDIT HYDRATE DEBUG] Inserted placeholder Remplazo por Principio for meal with replacement:', mealObj.principleReplacement); } catch(_) {}
          }
        }
      });
        
      // Debug: verificar qué devuelve byNameReplacement para cada reemplazo en ADMIN
      console.log('🔍 ADMIN DEBUG byNameReplacement results:', {
        soupReplacementResult: byNameReplacement(soupReplacements, editingOrder.meals?.[0]?.soupReplacement),
        principleReplacementResult: byNameReplacement(soupReplacements, editingOrder.meals?.[0]?.principleReplacement),
        mealsAfterTransformation: meals,
        firstMealAfterTransform: meals[0]
      });
        
      handleEditFormFieldChange('meals', meals);
    }

    hydratedOrderIdRef.current = editingOrder.id;
  }, [
    editingOrder,
    soups,
    principles,
    menuProteins,
    drinks,
    sides,
    additions,
    breakfastTypes,
    breakfastBroths,
    breakfastEggs,
    breakfastRiceBread,
    breakfastDrinks,
    breakfastAdditions,
    breakfastProteins,
    handleEditFormFieldChange,
  ]);

  // Recalcular total en edición cuando cambian meals (solo almuerzo)
  useEffect(() => {
    if (!editingOrder || editingOrder.type === 'breakfast') return;
    const computed = Number(calculateTotal(editForm.meals || [])) || 0;
    if (computed !== (editForm.total || 0)) {
      handleEditFormFieldChange('total', computed);
    }
  }, [editingOrder, editForm.meals, handleEditFormFieldChange, calculateTotal]);

  // Soporta lunch (meals) y breakfast (breakfasts)
  // Normaliza mealsForDetails para asegurar que principleReplacement siempre sea objeto { name: ... }
  const mealsForDetails = Array.isArray(showMealDetails?.meals)
    ? showMealDetails.meals.map((m) => ({
        ...m,
  principleRaw: Array.isArray(m.principle) ? m.principle : [],
        principle: Array.isArray(m.principle)
          ? m.principle
              .map((p) => {
                const name = typeof p === 'string' ? p : p?.name;
                // Ignorar el placeholder 'Remplazo por Principio' para que no aparezca como principio normal
                if (name && name.toLowerCase().includes('remplazo por principio')) return null;
                return byName(principles, p);
              })
              .filter(Boolean)
          : [],
        principleReplacement: (() => {
          try {
            console.log('[DETAILS DEBUG] Raw meal for details:', {
              principleRaw: m.principle,
              principleReplacementRaw: m.principleReplacement,
              hasArray: Array.isArray(m.principle),
              typePrincipleReplacement: typeof m.principleReplacement,
            });
          } catch(_) {}
          // 1. Intentar con el campo dedicado
          const found = byNameReplacement(soupReplacements, m.principleReplacement);
          if (found) return { name: found.name };
          if (typeof m.principleReplacement === 'string' && m.principleReplacement.trim()) return { name: m.principleReplacement.trim() };
          if (typeof m.principleReplacement === 'object' && m.principleReplacement?.name) return { name: m.principleReplacement.name };

          // 2. Derivar desde el array principle si trae el placeholder con un replacement embebido
          if (Array.isArray(m.principle)) {
            const replEntry = m.principle.find((p) => {
              const n = typeof p === 'string' ? p : p?.name;
              return n && n.toLowerCase().includes('remplazo por principio');
            });
            if (replEntry) {
              let candidate = '';
              if (typeof replEntry === 'object') {
                let rawCandidate = replEntry.replacement || replEntry.selectedReplacement || replEntry.value || '';
                if (rawCandidate && typeof rawCandidate === 'object') {
                  rawCandidate = rawCandidate.name || '';
                }
                candidate = rawCandidate;
                if (!candidate && typeof replEntry.name === 'string') {
                  const match = replEntry.name.match(/remplazo por principio\s*\(([^)]+)\)/i);
                  if (match && match[1]) candidate = match[1];
                }
              }
              if (typeof replEntry === 'string') {
                const match = replEntry.match(/remplazo por principio\s*\(([^)]+)\)/i);
                if (match && match[1]) candidate = match[1];
              }
              if (candidate && typeof candidate === 'string' && candidate.trim()) {
                try { console.log('[DETAILS DEBUG] Derived from placeholder entry:', replEntry, '=>', candidate); } catch(_) {}
                return { name: candidate.trim() };
              }
            }
          }
          return null;
        })(),
      }))
    : Array.isArray(showMealDetails?.breakfasts)
    ? showMealDetails.breakfasts
    : [];

    // Recalcular total en edición cuando cambian breakfasts (solo desayunos)
  useEffect(() => {
    if (!editingOrder || editingOrder.type !== 'breakfast') return;
    
    console.log('🔍 [InteraccionesPedidos] === RECALCULANDO TOTAL ADMIN ===');
    const list = editForm.breakfasts || [];
    console.log('🔍 [InteraccionesPedidos] Lista de desayunos para recalcular:', {
      listLength: list.length,
      breakfasts: list.map(b => ({
        type: b.type?.name,
        broth: b.broth?.name,
        orderType: b.orderType,
        additions: b.additions
      }))
    });

    const computed = list.reduce((sum, b, index) => {
      console.log(`🔍 [InteraccionesPedidos] Calculando precio para desayuno ${index + 1}:`, {
        breakfast: {
          type: b.type?.name,
          broth: b.broth?.name,
          orderType: b.orderType,
          additions: b.additions
        }
      });
      
      const itemPrice = Number(calculateBreakfastPrice(b, 3, breakfastTypes) || 0);
      console.log(`🔍 [InteraccionesPedidos] Precio calculado:`, {
        itemPrice,
        sumAnterior: sum,
        sumNuevo: sum + itemPrice,
        source: 'InteraccionesPedidos.js (Admin)'
      });
      
      return sum + itemPrice;
    }, 0);

    console.log('🔍 [InteraccionesPedidos] === TOTAL ADMIN FINAL ===', {
      computed,
      currentTotal: editForm.total || 0,
      willUpdate: computed !== (editForm.total || 0)
    });

    if (computed !== (editForm.total || 0)) {
      handleEditFormFieldChange('total', computed);
    }
  }, [editingOrder, editForm.breakfasts, breakfastTypes, handleEditFormFieldChange]);


  const handleDeleteProtein = async (proteinId) => {
    try {
      await deleteDoc(doc(db, 'dailyProteins', proteinId));
      setSuccess('Proteína eliminada correctamente.');
    } catch (error) {
      setError(`Error al eliminar proteína: ${error.message}`);
    }
  };

  const handleEditProtein = (protein) => {
    // Aseguramos incluir campos derivados: remaining (cantidad restante) y sold
    setEditingProtein({
      ...protein,
      remaining: protein.remaining != null ? protein.remaining : (protein.remainingUnits != null ? protein.remainingUnits : (protein.leftover || 0)),
      sold: protein.sold != null ? protein.sold : (protein.quantity != null && protein.remaining != null ? (Number(protein.quantity) - Number(protein.remaining)) : protein.sold)
    });
  };

  const handleUpdateProtein = async () => {
    if (!editingProtein.name || editingProtein.quantity === '' || isNaN(editingProtein.quantity) || Number(editingProtein.quantity) < 0) {
      setError('Por favor, ingrese un nombre de proteína válido y una cantidad inicial >= 0.');
      return;
    }
    // Normalizamos valores
    const quantityNum = Number(editingProtein.quantity) || 0;
    let remainingNum = Number(editingProtein.remaining);
    if (isNaN(remainingNum) || remainingNum < 0) remainingNum = 0;
    if (remainingNum > quantityNum) remainingNum = quantityNum; // No permitir sobrantes mayores a la inicial
    const soldNum = quantityNum - remainingNum;
    try {
      await updateDoc(doc(db, 'dailyProteins', editingProtein.id), {
        name: editingProtein.name.trim(),
        quantity: quantityNum,
        remaining: remainingNum,
        sold: soldNum,
      });
      setSuccess('Proteína actualizada correctamente.');
      setEditingProtein(null);
    } catch (error) {
      setError(`Error al actualizar proteína: ${error.message}`);
    }
  };

  const handleCancelEditProtein = () => {
    setEditingProtein(null);
  };

  return (
    <div>
      {/* Diálogo para gestionar proteínas */}
      <Transition show={showProteinModal} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => { setShowProteinModal(false); setEditingProtein(null); }}>
          <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel
                className={
                  classNames(
                    'w-full max-w-md p-6 rounded-lg shadow-md',
                    theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-gray-50 text-gray-900'
                  )
                }
              >
                <div className="flex justify-between items-center mb-4">
                  <Dialog.Title className="text-lg font-medium">{editingProtein ? 'Editar Proteína' : 'Gestionar Proteínas'}</Dialog.Title>
                  <button onClick={() => { setShowProteinModal(false); setEditingProtein(null); }} className="text-gray-500 hover:text-gray-400" aria-label="Cerrar modal">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  {editingProtein ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
                        <input
                          type="text"
                          value={editingProtein.name}
                          onChange={(e) => setEditingProtein({ ...editingProtein, name: e.target.value })}
                          className={classNames(
                            'w-full p-2 rounded-md border text-sm',
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            'focus:outline-none focus:ring-1 focus:ring-blue-500'
                          )}
                          placeholder="Ej: Pollo"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cantidad</label>
                        <input
                          type="number"
                          value={editingProtein.quantity}
                          onChange={(e) => setEditingProtein({ ...editingProtein, quantity: e.target.value })}
                          className={classNames(
                            'w-full p-2 rounded-md border text-sm',
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            'focus:outline-none focus:ring-1 focus:ring-blue-500'
                          )}
                          placeholder="Ej: 50"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cantidad Restante</label>
                        <input
                          type="number"
                          value={editingProtein.remaining ?? 0}
                          onChange={(e) => setEditingProtein({ ...editingProtein, remaining: e.target.value })}
                          className={classNames(
                            'w-full p-2 rounded-md border text-sm',
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            'focus:outline-none focus:ring-1 focus:ring-blue-500'
                          )}
                          placeholder="Ej: 5"
                          min="0"
                        />
                        <p className="text-xs mt-1 text-gray-500 dark:text-gray-400">Vendidas calculadas: {Math.max(0, (Number(editingProtein.quantity)||0) - (Number(editingProtein.remaining)||0))}</p>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={handleCancelEditProtein} className={classNames('px-4 py-2 rounded-md text-sm font-medium', theme === 'dark' ? 'bg-gray-600 hover:bg-gray-700 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-900')}>Cancelar</button>
                        <button onClick={handleUpdateProtein} disabled={isLoading} className={classNames('px-4 py-2 rounded-md text-sm font-medium', isLoading ? 'bg-gray-400 cursor-not-allowed' : theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white')}>
                          {isLoading ? 'Guardando...' : 'Actualizar'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
                        <input
                          type="text"
                          value={newProtein.name}
                          onChange={(e) => setNewProtein({ ...newProtein, name: e.target.value })}
                          className={classNames(
                            'w-full p-2 rounded-md border text-sm',
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            'focus:outline-none focus:ring-1 focus:ring-blue-500'
                          )}
                          placeholder="Ej: Pollo"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cantidad</label>
                        <input
                          type="number"
                          value={newProtein.quantity}
                          onChange={(e) => setNewProtein({ ...newProtein, quantity: e.target.value })}
                          className={classNames(
                            'w-full p-2 rounded-md border text-sm',
                            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                            'focus:outline-none focus:ring-1 focus:ring-blue-500'
                          )}
                          placeholder="Ej: 50"
                          min="0"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setShowProteinModal(false)} className={classNames('px-4 py-2 rounded-md text-sm font-medium', theme === 'dark' ? 'bg-gray-600 hover:bg-gray-700 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-900')}>Cancelar</button>
                        <button onClick={handleAddProtein} disabled={isLoading} className={classNames('px-4 py-2 rounded-md text-sm font-medium', isLoading ? 'bg-gray-400 cursor-not-allowed' : theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white')}>
                          {isLoading ? 'Guardando...' : 'Agregar'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Proteínas Registradas (Total: {totalProteinUnits} unidades)
                  </h3>
                  {proteins.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No hay proteínas registradas.</p>
                  ) : (
                    <div className="max-h-80 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent">
                      <ul className="space-y-2">
                        {proteins.map((protein) => (
                          <li key={protein.id} className={classNames('flex justify-between items-center p-2 rounded-md', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
                            <div className="flex flex-col text-xs sm:text-sm">
                              <span className="font-medium">{protein.name}</span>
                              <div className="flex gap-3 mt-0.5">
                                <span>Inicial: <strong>{protein.quantity || 0}</strong></span>
                                <span>Restante: <strong>{protein.remaining != null ? protein.remaining : (protein.remainingUnits || 0)}</strong></span>
                                <span>Vendidas: <strong>{(protein.quantity || 0) - (protein.remaining != null ? protein.remaining : (protein.remainingUnits || 0))}</strong></span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => handleEditProtein(protein)} className="text-blue-500 hover:text-blue-400 transition-colors duration-150 p-1 rounded-md" title="Editar proteína" aria-label={`Editar ${protein.name}`}>
                                <PencilIcon className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteProtein(protein.id)} className="text-red-500 hover:text-red-400 transition-colors duration-150 p-1 rounded-md" title="Eliminar proteína" aria-label={`Eliminar ${protein.name}`}>
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Diálogo para detalles del pedido */}
      <Transition show={showMealDetails !== null} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowMealDetails(null)}>
          <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className={classNames('w-full max-w-2xl p-6 rounded-lg shadow-xl max-h-[80vh] overflow-y-auto', theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-gray-50 text-gray-900')}>
                <Dialog.Title className="text-lg font-medium mb-4 flex justify-between items-center">
                  Detalles del Pedido
                  <button onClick={() => setShowMealDetails(null)} className="text-gray-500 hover:text-gray-400" aria-label="Cerrar detalles">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </Dialog.Title>
                {showMealDetails && (
                  <>
                    {/* Calcular deliveryTime y pasarlo al componente de resumen para que aparezca DENTRO del bloque 'Resumen del Pedido' */}
                    {(() => {
                      const timeValue = showMealDetails?.meals?.[0]?.time || showMealDetails?.breakfasts?.[0]?.time || showMealDetails?.time || null;
                      let displayTime = '';
                      if (typeof timeValue === 'string' && timeValue.trim()) {
                        displayTime = timeValue;
                      } else if (timeValue instanceof Date) {
                        displayTime = timeValue.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
                      } else if (timeValue && typeof timeValue === 'object') {
                        if (typeof timeValue.toDate === 'function') {
                          try {
                            const d = timeValue.toDate();
                            displayTime = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
                          } catch (e) {
                            displayTime = timeValue.name || '';
                          }
                        } else if (timeValue.name && typeof timeValue.name === 'string') {
                          displayTime = timeValue.name;
                        }
                      }
                      if ((!displayTime || displayTime === '') && showMealDetails?.createdAt) {
                        try {
                          const ca = showMealDetails.createdAt && typeof showMealDetails.createdAt.toDate === 'function'
                            ? showMealDetails.createdAt.toDate()
                            : (showMealDetails.createdAt instanceof Date ? showMealDetails.createdAt : new Date(showMealDetails.createdAt));
                          displayTime = ca.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
                        } catch (e) {}
                      }
                      const deliveryTime = displayTime || null;
                      return showMealDetails?.type === 'breakfast' ? (
                        <BreakfastOrderSummary items={showMealDetails.breakfasts || mealsForDetails} user={{ role: 3 }} breakfastTypes={breakfastTypes} statusClass="bg-white" showSaveButton={false} deliveryTime={deliveryTime} allSides={sides} />
                      ) : (
                        <OrderSummary meals={mealsForDetails} isTableOrder={false} isWaiterView={true} statusClass="bg-white" deliveryTime={deliveryTime} allSides={sides} />
                      );
                    })()}
                    <div className="mt-3 text-xs sm:text-sm">
                      <p className="font-medium">Estado: {showMealDetails.status || 'Pendiente'}</p>
                      <p className="font-medium">Domiciliario: {showMealDetails.deliveryPerson || 'Sin asignar'}</p>
                 {showMealDetails?.type === 'breakfast' ? (
                  <p className="font-medium">
                    Total del pedido: ${
                      (() => {
                        console.log('🔍 [InteraccionesPedidos] === CALCULANDO TOTAL PARA MOSTRAR EN DETALLES ===');
                        const breakfasts = showMealDetails.breakfasts || [];
                        console.log('🔍 [InteraccionesPedidos] Desayunos para mostrar:', {
                          breakfastsLength: breakfasts.length,
                          breakfasts: breakfasts.map(b => ({
                            type: b.type?.name,
                            broth: b.broth?.name,
                            orderType: b.orderType,
                            additions: b.additions
                          }))
                        });

                        const total = breakfasts.reduce((sum, b, index) => {
                          console.log(`🔍 [InteraccionesPedidos] Calculando para mostrar desayuno ${index + 1}:`, {
                            breakfast: {
                              type: b.type?.name,
                              broth: b.broth?.name,
                              orderType: b.orderType,
                              additions: b.additions
                            }
                          });
                          
                          const itemPrice = Number(calculateBreakfastPrice(b, 3, breakfastTypes) || 0);
                          console.log(`🔍 [InteraccionesPedidos] Precio para mostrar:`, {
                            itemPrice,
                            sumAnterior: sum,
                            sumNuevo: sum + itemPrice,
                            source: 'InteraccionesPedidos.js (Show Details)'
                          });
                          
                          return sum + itemPrice;
                        }, 0);

                        console.log('🔍 [InteraccionesPedidos] === TOTAL PARA MOSTRAR ===', total);
                        return total;
                      })().toLocaleString('es-CO')
                    }
                  </p>
                ) : (
  typeof showMealDetails.total === 'number' && (
 <p className="font-medium">
  Total del pedido: ${
    (
      Array.isArray(showMealDetails?.meals)
        ? Number(calculateTotal(showMealDetails.meals) || 0)
        : Number(showMealDetails?.total || 0)
    ).toLocaleString('es-CO')
  }
</p>

  )
)}

                    </div>
                  </>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Diálogo para editar pedido */}
      <Transition show={editingOrder !== null} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setEditingOrder(null)}>
          <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child as={React.Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className={classNames('w-full max-w-2xl p-6 rounded-lg shadow-xl max-h-[80vh] overflow-y-auto', theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-gray-50 text-gray-900')}>
                <Dialog.Title className="text-lg font-medium mb-4 flex justify-between items-center">
                  Editar Pedido
                  <button onClick={() => setEditingOrder(null)} className="text-gray-500 hover:text-gray-400" aria-label="Cerrar edición">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </Dialog.Title>
                {(() => {
                  const editItems = editingOrder?.type === 'breakfast' ? editForm.breakfasts || [] : editForm.meals || [];

                  return editItems.map((row, idx) => (
                    <div key={idx} className="mb-6 p-4 border rounded-md border-gray-200 dark:border-gray-600">
                      <h3 className="font-medium mb-2">{editingOrder?.type === 'breakfast' ? `Desayuno ${idx + 1}` : `Bandeja ${idx + 1}`}</h3>

                      {editingOrder?.type === 'breakfast' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">Tipo</label>
                            <OptionSelector title="Tipo" emoji="🥞" options={breakfastTypes} selected={row.type || null} multiple={false} onImmediateSelect={(v) => handleBreakfastImmediate(idx, 'type', v)} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Caldo</label>
                            <OptionSelector title="Caldo" emoji="🥣" options={breakfastBroths} selected={row.broth || null} multiple={false} onImmediateSelect={(v) => handleBreakfastImmediate(idx, 'broth', v)} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Huevos</label>
                            <OptionSelector title="Huevos" emoji="🥚" options={breakfastEggs} selected={row.eggs || null} multiple={false} onImmediateSelect={(v) => handleBreakfastImmediate(idx, 'eggs', v)} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Arroz/Pan</label>
                            <OptionSelector title="Arroz/Pan" emoji="🍞" options={breakfastRiceBread} selected={row.riceBread || null} multiple={false} onImmediateSelect={(v) => handleBreakfastImmediate(idx, 'riceBread', v)} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Bebida</label>
                            <OptionSelector title="Bebida" emoji="🥤" options={breakfastDrinks} selected={row.drink || null} multiple={false} onImmediateSelect={(v) => handleBreakfastImmediate(idx, 'drink', v)} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Proteína</label>
                            <OptionSelector title="Proteína" emoji="🍖" options={breakfastProteins} selected={row.protein || null} multiple={false} onImmediateSelect={(v) => handleBreakfastImmediate(idx, 'protein', v)} />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium mb-1">Adiciones</label>
                            <OptionSelector
                              title="Adiciones"
                              emoji="➕"
                              options={breakfastAdditions}
                              selected={row.additions || []}
                              multiple={true}
                              onImmediateSelect={(sel) => handleBreakfastImmediate(idx, 'additions', sel.map((a) => ({ name: a.name, quantity: a.quantity || 1 })))}
                            />
                          </div>

                          {/* Operativos desayuno */}
                          <div>
                            <label className="block text-sm font-medium mb-1">Cubiertos</label>
                            <input type="checkbox" checked={!!row.cutlery} onChange={(e) => handleBreakfastFormFieldChange(idx, 'cutlery', e.target.checked)} className="h-4 w-4" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Hora de Entrega</label>
                            <input
                              type="text"
                              value={typeof row.time === 'string' ? row.time : row.time?.name || ''}
                              onChange={(e) => handleBreakfastFormFieldChange(idx, 'time', e.target.value)}
                              className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium mb-1">Dirección</label>
                            <input
                              type="text"
                              value={row.address?.address || ''}
                              onChange={(e) => handleBreakfastFormFieldChange(idx, 'address.address', e.target.value)}
                              className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Teléfono</label>
                            <input
                              type="text"
                              value={row.address?.phoneNumber || ''}
                              onChange={(e) => handleBreakfastFormFieldChange(idx, 'address.phoneNumber', e.target.value)}
                              className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Barrio</label>
                            <select
                              value={row.address?.neighborhood || ''}
                              onChange={(e) => handleBreakfastFormFieldChange(idx, 'address.neighborhood', e.target.value)}
                              className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                            >
                              <option value="">Seleccione un barrio</option>
                              {BARRIOS.map((barrio) => (
                                <option key={barrio} value={barrio}>{barrio}</option>
                              ))}
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium mb-1">Instrucciones de entrega</label>
                            <input
                              type="text"
                              value={row.address?.details || ''}
                              onChange={(e) => handleBreakfastFormFieldChange(idx, 'address.details', e.target.value)}
                              placeholder="Ej: Spa, Gabriel maria, Interior 12..."
                              className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium mb-1">Notas</label>
                            <input
                              type="text"
                              value={row.notes || ''}
                              onChange={(e) => handleBreakfastFormFieldChange(idx, 'notes', e.target.value)}
                              className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">Sopa o reemplazo</label>
                            <OptionSelector 
                              title="Sopa" 
                              emoji="🥣" 
                              options={soups} 
                              selected={row.soup || null} 
                              multiple={false} 
                              replacements={soupReplacements}
                              selectedReplacement={row.soupReplacement}
                              onImmediateSelect={(v) => handleMealFormFieldChange(idx, 'soup', v)} 
                              onImmediateReplacementSelect={(option) => handleMealFormFieldChange(idx, 'soupReplacement', option)}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Principio</label>
                            <OptionSelector
                              title="Principio"
                              emoji="🍚"
                              options={principles}
                              selected={row.principle || []}
                              multiple={true}
                              showConfirmButton={true}
                              replacements={soupReplacements}
                              selectedReplacement={row.principleReplacement}
                              onImmediateSelect={(selection) => handleMealFormFieldChange(idx, 'principle', selection)}
                              onConfirm={({ selection }) => handleMealFormFieldChange(idx, 'principle', selection)}
                              onImmediateReplacementSelect={(option) => handleMealFormFieldChange(idx, 'principleReplacement', option)}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Proteína</label>
                            <OptionSelector title="Proteína" emoji="🍖" options={menuProteins} selected={row.protein || null} multiple={false} onImmediateSelect={(v) => handleMealFormFieldChange(idx, 'protein', v)} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Bebida</label>
                            <OptionSelector title="Bebida" emoji="🥤" options={drinks} selected={row.drink || null} multiple={false} onImmediateSelect={(v) => handleMealFormFieldChange(idx, 'drink', v)} />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium mb-1">Acompañamientos</label>
                            <OptionSelector title="Acompañamientos" emoji="🥗" options={sides} selected={row.sides || []} multiple={true} onImmediateSelect={(selection) => handleMealFormFieldChange(idx, 'sides', selection)} />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium mb-1">Adiciones</label>
                            <OptionSelector
                              title="Adiciones"
                              emoji="➕"
                              options={additions}
                              selected={row.additions || []}
                              multiple={true}
                              onImmediateSelect={(sel) =>
                                handleMealFormFieldChange(
                                  idx,
                                  'additions',
                                  sel.map((a) => ({
                                    id: a.id,
                                    name: a.name,
                                    price: a.price || 0,
                                    protein: a.protein || '',
                                    replacement: a.replacement || '',
                                    quantity: a.quantity || 1,
                                  }))
                                )
                              }
                            />
                          </div>

                          {/* Operativos almuerzo */}
                          <div>
                            <label className="block text-sm font-medium mb-1">Cubiertos</label>
                            <input type="checkbox" checked={!!row.cutlery} onChange={(e) => handleMealFormFieldChange(idx, 'cutlery', e.target.checked)} className="h-4 w-4" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Hora de Entrega</label>
                            <input
                              type="text"
                              value={typeof row.time === 'string' ? row.time : row.time?.name || ''}
                              onChange={(e) => handleMealFormFieldChange(idx, 'time', e.target.value)}
                              className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium mb-1">Dirección</label>
                            <input
                              type="text"
                              value={row.address?.address || ''}
                              onChange={(e) => handleMealFormFieldChange(idx, 'address.address', e.target.value)}
                              className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Teléfono</label>
                            <input
                              type="text"
                              value={row.address?.phoneNumber || ''}
                              onChange={(e) => handleMealFormFieldChange(idx, 'address.phoneNumber', e.target.value)}
                              className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Barrio</label>
                            <select
                              value={row.address?.neighborhood || ''}
                              onChange={(e) => handleMealFormFieldChange(idx, 'address.neighborhood', e.target.value)}
                              className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                            >
                              <option value="">Seleccione un barrio</option>
                              {BARRIOS.map((barrio) => (
                                <option key={barrio} value={barrio}>{barrio}</option>
                              ))}
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium mb-1">Instrucciones de entrega</label>
                            <input
                              type="text"
                              value={row.address?.details || ''}
                              onChange={(e) => handleMealFormFieldChange(idx, 'address.details', e.target.value)}
                              placeholder="Ej: Spa, Gabriel maria, Interior 12..."
                              className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium mb-1">Notas</label>
                            <input
                              type="text"
                              value={row.notes || ''}
                              onChange={(e) => handleMealFormFieldChange(idx, 'notes', e.target.value)}
                              className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ));
                })()}

                {/* Campos de la orden principal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total</label>
                    <input
                      type="number"
                      value={editForm.total || 0}
                      onChange={(e) => handleEditFormFieldChange('total', Number(e.target.value))}
                      className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estado</label>
                    <select
                      value={editForm.status || 'Pendiente'}
                      onChange={(e) => handleEditFormFieldChange('status', e.target.value)}
                      className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="En Preparación">En Preparación</option>
                      <option value="En Camino">En Camino</option>
                      <option value="Entregado">Entregado</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Método de Pago</label>
                    <OptionSelector
                      title="Método de Pago"
                      emoji="💳"
                      options={paymentMethods}
                      selected={paymentMethods.find((m) => m.name === editForm.payment) || null}
                      multiple={false}
                      onImmediateSelect={(v) => handleEditFormFieldChange('payment', v?.name || '')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Domiciliario</label>
                    <input
                      type="text"
                      value={editForm.deliveryPerson || 'Sin asignar'}
                      onChange={(e) => handleEditFormFieldChange('deliveryPerson', e.target.value)}
                      className={classNames('w-full p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-blue-500')}
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={() => handlePrintDeliveryReceipt(editForm)}
                    className={classNames('p-2 rounded-md border border-green-600 text-green-600 hover:text-green-500 hover:border-green-500 transition-colors duration-150')}
                    title="Imprimir recibo domicilio"
                    aria-label="Imprimir recibo domicilio"
                  >
                    <PrinterIcon className="w-5 h-5" />
                  </button>
                  <button onClick={() => setEditingOrder(null)} className={classNames('px-4 py-2 rounded-md text-sm font-medium', theme === 'dark' ? 'bg-gray-600 hover:bg-gray-700 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-900')}>
                    Cancelar
                  </button>
                  <button onClick={handleSaveEdit} disabled={isLoading} className={classNames('px-4 py-2 rounded-md text-sm font-medium', isLoading ? 'bg-gray-400 cursor-not-allowed' : theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white')}>
                    {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>


      {/* Diálogo para confirmar eliminación de todos los pedidos */}
      <Transition show={showConfirmDeleteAll} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowConfirmDeleteAll(false)}>
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={classNames(
                "w-full max-w-sm p-6 rounded-lg shadow-md text-center",
                theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-gray-50 text-gray-900'
              )}>
                <Dialog.Title className="text-lg font-medium mb-4">Confirmar Eliminación Masiva</Dialog.Title>
                <p className="mb-4">
                  Estás a punto de eliminar <span className="font-bold text-red-500">TODOS</span> los pedidos.
                  Esta acción es irreversible. Para confirmar, escribe "confirmar" a continuación:
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  className={classNames(
                    "w-full p-2 rounded-md border text-center text-sm",
                    theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                    "focus:outline-none focus:ring-1 focus:ring-red-500"
                  )}
                  placeholder="escribe 'confirmar'"
                />
                <div className="mt-6 flex justify-center gap-2">
                  <button
                    onClick={() => { setShowConfirmDeleteAll(false); setConfirmText(''); }}
                    className={classNames(
                      "px-4 py-2 rounded-md text-sm font-medium",
                      theme === 'dark' ? 'bg-gray-600 hover:bg-gray-700 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    )}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDeleteAllOrders}
                    disabled={isLoading || confirmText.toLowerCase() !== 'confirmar'}
                    className={classNames(
                      "px-4 py-2 rounded-md text-sm font-medium",
                      isLoading || confirmText.toLowerCase() !== 'confirmar' ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'
                    )}
                  >
                    {isLoading ? 'Eliminando...' : 'Eliminar Todos'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Diálogo para generar nueva orden */}
      <Transition show={showAddOrderModal} as={React.Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowAddOrderModal(false)}>
          <Transition.Child
            as={React.Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={classNames(
                "w-full max-w-2xl p-6 rounded-lg shadow-xl max-h-[80vh] overflow-y-auto",
                theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-gray-50 text-gray-900'
              )}>
                <Dialog.Title className="text-lg font-medium mb-4 flex justify-between items-center">
                  Generar Nueva Orden
                  <button
                    onClick={() => setShowAddOrderModal(false)}
                    className="text-gray-500 hover:text-gray-400"
                    aria-label="Cerrar formulario de nueva orden"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </Dialog.Title>
                {newOrderForm.meals.map((meal, mealIndex) => (
                  <div key={mealIndex} className="mb-6 p-4 border rounded-md border-gray-200 dark:border-gray-600">
                    <h3 className="font-medium mb-2">Bandeja {mealIndex + 1}</h3>
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <div>
    <label className="block text-sm font-medium mb-1">Sopa o reemplazo</label>
    <OptionSelector
      title="Sopa"
      emoji="🥣"
      options={soups}
      selected={typeof meal.soup === 'string' ? soups.find(s => s.name === meal.soup) : meal.soup}
      multiple={false}
      replacements={soupReplacements}
      selectedReplacement={meal.soupReplacement}
      onImmediateSelect={(v) => handleNewOrderMealFormFieldChange(mealIndex, 'soup', v)}
      onImmediateReplacementSelect={(option) => handleNewOrderMealFormFieldChange(mealIndex, 'soupReplacement', option)}
    />
  </div>

  <div>
    <label className="block text-sm font-medium mb-1">Principio</label>
    <OptionSelector
      title="Principio"
      emoji="🍚"
      options={principles}
      selected={Array.isArray(meal.principle) ? meal.principle : []}
      multiple={true}
      showConfirmButton={true}
      replacements={soupReplacements}
      selectedReplacement={meal.principleReplacement}
      onImmediateSelect={(selection) => handleNewOrderMealFormFieldChange(mealIndex, 'principle', selection)}
      onConfirm={({ selection }) => handleNewOrderMealFormFieldChange(mealIndex, 'principle', selection)}
      onImmediateReplacementSelect={(option) => handleNewOrderMealFormFieldChange(mealIndex, 'principleReplacement', option)}
    />
  </div>

  <div>
    <label className="block text-sm font-medium mb-1">Proteína</label>
    <OptionSelector
      title="Proteína"
      emoji="🍖"
      options={menuProteins}
      selected={typeof meal.protein === 'string' ? menuProteins.find(p => p.name === meal.protein) : meal.protein}
      multiple={false}
      onImmediateSelect={(v) => handleNewOrderMealFormFieldChange(mealIndex, 'protein', v)}
    />
  </div>

  <div>
    <label className="block text-sm font-medium mb-1">Bebida</label>
    <OptionSelector
      title="Bebida"
      emoji="🥤"
      options={drinks}
      selected={typeof meal.drink === 'string' ? drinks.find(d => d.name === meal.drink) : meal.drink}
      multiple={false}
      onImmediateSelect={(v) => handleNewOrderMealFormFieldChange(mealIndex, 'drink', v)}
    />
  </div>

  <div className="sm:col-span-2">
    <label className="block text-sm font-medium mb-1">Acompañamientos</label>
    <OptionSelector
      title="Acompañamientos"
      emoji="🥗"
      options={sides}
      selected={Array.isArray(meal.sides) ? meal.sides : []}
      multiple={true}
      onImmediateSelect={(selection) => handleNewOrderMealFormFieldChange(mealIndex, 'sides', selection)}
    />
  </div>

  <div className="sm:col-span-2">
    <label className="block text-sm font-medium mb-1">Adiciones</label>
    <OptionSelector
      title="Adiciones"
      emoji="➕"
      options={additions}
      selected={Array.isArray(meal.additions) ? meal.additions : []}
      multiple={true}
onImmediateSelect={(sel) =>
  handleNewOrderMealFormFieldChange(
    mealIndex,
    'additions',
    sel.map(a => ({
      id: a.id,
      name: a.name,
      price: a.price || 0,
      protein: a.protein || '',
      replacement: a.replacement || '',
      quantity: a.quantity || 1
    }))
  )
}

    />
  </div>

  {/* Campos operativos */}
  <div>
    <label className="block text-sm font-medium mb-1">Cubiertos</label>
    <input
      type="checkbox"
      checked={!!meal.cutlery}
      onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'cutlery', e.target.checked)}
      className="h-4 w-4"
    />
  </div>

  <div>
    <label className="block text-sm font-medium mb-1">Hora de Entrega</label>
    <input
      type="text"
      value={typeof meal.time === 'string' ? meal.time : (meal.time?.name || '')}
      onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'time', e.target.value)}
      className={classNames(
        "w-full p-2 rounded-md border text-sm",
        theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
        "focus:outline-none focus:ring-1 focus:ring-blue-500"
      )}
    />
  </div>

  <div className="sm:col-span-2">
    <label className="block text-sm font-medium mb-1">Dirección</label>
    <input
      type="text"
      value={meal.address?.address || ''}
      onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'address.address', e.target.value)}
      className={classNames(
        "w-full p-2 rounded-md border text-sm",
        theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
        "focus:outline-none focus:ring-1 focus:ring-blue-500"
      )}
    />
  </div>

  <div>
    <label className="block text-sm font-medium mb-1">Teléfono</label>
    <input
      type="text"
      value={meal.address?.phoneNumber || ''}
      onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'address.phoneNumber', e.target.value)}
      className={classNames(
        "w-full p-2 rounded-md border text-sm",
        theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
        "focus:outline-none focus:ring-1 focus:ring-blue-500"
      )}
    />
  </div>

  <div>
    <label className="block text-sm font-medium mb-1">Barrio</label>
    <select
      value={meal.address?.neighborhood || ''}
      onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'address.neighborhood', e.target.value)}
      className={classNames(
        "w-full p-2 rounded-md border text-sm",
        theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
        "focus:outline-none focus:ring-1 focus:ring-blue-500"
      )}
    >
      <option value="">Seleccione un barrio</option>
      {BARRIOS.map(barrio => (
        <option key={barrio} value={barrio}>{barrio}</option>
      ))}
    </select>
  </div>

  <div className="sm:col-span-2">
    <label className="block text-sm font-medium mb-1">Notas</label>
    <input
      type="text"
      value={meal.notes || ''}
      onChange={e => handleNewOrderMealFormFieldChange(mealIndex, 'notes', e.target.value)}
      className={classNames(
        "w-full p-2 rounded-md border text-sm",
        theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
        "focus:outline-none focus:ring-1 focus:ring-blue-500"
      )}
    />
  </div>
</div>


                  </div>
                ))}
                {/* Campos de la orden principal */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Total</label>
                    <input
                      type="number"
                      value={newOrderForm.total || 0}
                      onChange={e => handleNewOrderFieldChange('total', Number(e.target.value))}
                      className={classNames(
                        "w-full p-2 rounded-md border text-sm",
                        theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                        "focus:outline-none focus:ring-1 focus:ring-blue-500"
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estado</label>
                    <select
                      value={newOrderForm.status || 'Pendiente'}
                      onChange={e => handleNewOrderFieldChange('status', e.target.value)}
                      className={classNames(
                        "w-full p-2 rounded-md border text-sm",
                        theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                        "focus:outline-none focus:ring-1 focus:ring-blue-500"
                      )}
                    >
                      <option value="Pendiente">Pendiente</option>
                      <option value="En Preparación">En Preparación</option>
                      <option value="En Camino">En Camino</option>
                      <option value="Entregado">Entregado</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Método de Pago</label>
                    <select
                      value={newOrderForm.payment || 'Efectivo'}
                      onChange={e => handleNewOrderFieldChange('payment', e.target.value)}
                      className={classNames(
                        "w-full p-2 rounded-md border text-sm",
                        theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                        "focus:outline-none focus:ring-1 focus:ring-blue-500"
                      )}
                    >
                      <option value="Efectivo">Efectivo</option>
                      <option value="Daviplata">Daviplata</option>
                      <option value="Nequi">Nequi</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Domiciliario</label>
                    <input
                      type="text"
                      value={newOrderForm.deliveryPerson || 'Sin asignar'}
                      onChange={e => handleNewOrderFieldChange('deliveryPerson', e.target.value)}
                      className={classNames(
                        "w-full p-2 rounded-md border text-sm",
                        theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                        "focus:outline-none focus:ring-1 focus:ring-blue-500"
                      )}
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={() => setShowAddOrderModal(false)}
                    className={classNames(
                      "px-4 py-2 rounded-md text-sm font-medium",
                      theme === 'dark' ? 'bg-gray-600 hover:bg-gray-700 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    )}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddOrderSubmit}
                    disabled={isLoading}
                    className={classNames(
                      "px-4 py-2 rounded-md text-sm font-medium",
                      isLoading ? 'bg-gray-400 cursor-not-allowed' : theme === 'dark' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
                    )}
                  >
                    {isLoading ? 'Guardando...' : 'Crear Orden'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default InteraccionesPedidos;