// src/components/Admin/TablaPedidos.js
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { classNames } from '../../utils/classNames.js';
import { cleanText, getAddressDisplay } from './utils.js';
import { calculateMealPrice } from '../../utils/MealCalculations';
import PaymentSplitEditor from '../common/PaymentSplitEditor';
import { summarizePayments, sumPaymentsByMethod, defaultPaymentsForOrder } from '../../utils/payments';
import {
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InformationCircleIcon,
  PencilIcon,
  TrashIcon,
  EllipsisVerticalIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  PrinterIcon
} from '@heroicons/react/24/outline';
// Función para imprimir recibo de domicilio (idéntica a la de InteraccionesPedidos.js)
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
  let resumen = '';
  if (!isBreakfast && Array.isArray(order.meals)) {
    resumen += `<div style='font-weight:bold;margin-bottom:4px;'>✅ Resumen del Pedido</div>`;
    resumen += `<div>🍽 ${order.meals.length} almuerzos en total</div>`;
    order.meals.forEach((m, idx) => {
      resumen += `<div style='margin-top:10px;'><b>🍽 Almuerzo ${idx + 1} – ${(m.price || order.total || '').toLocaleString('es-CO')} (${pago})</b></div>`;
      if (m.soup?.name === 'Solo bandeja') resumen += '<div>solo bandeja</div>';
      else if (m.soupReplacement?.name) resumen += `<div>${m.soupReplacement.name} (por sopa)</div>`;
      else if (m.soup?.name && m.soup.name !== 'Sin sopa') resumen += `<div>${m.soup.name}</div>`;
      if (m.principleReplacement?.name) resumen += `<div>${m.principleReplacement.name} (por principio)</div>`;
      else if (Array.isArray(m.principle) && m.principle.length > 0) resumen += `<div>${m.principle.map(p => p.name).join(', ')}</div>`;
      const specialRice = Array.isArray(m.principle) && m.principle.some(p => ['Arroz con pollo', 'Arroz paisa', 'Arroz tres carnes'].includes(p.name));
      if (specialRice) resumen += `<div>Proteína: Ya incluida en el arroz</div>`;
      else if (m.protein?.name) resumen += `<div>Proteína: ${m.protein.name}</div>`;
      if (m.drink?.name) resumen += `<div>${m.drink.name === 'Juego de mango' ? 'Jugo de mango' : m.drink.name}</div>`;
      resumen += `<div>Cubiertos: ${m.cutlery ? 'Sí' : 'No'}</div>`;
      if (specialRice) resumen += `<div>Acompañamientos: Ya incluidos</div>`;
      else if (Array.isArray(m.sides) && m.sides.length > 0) resumen += `<div>Acompañamientos: ${m.sides.map(s => s.name).join(', ')}</div>`;
      else resumen += `<div>Acompañamientos: Ninguno</div>`;
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
      resumen += `<div style='margin-top:10px;'><b>🍽 Desayuno ${idx + 1} – ${(b.price || order.total || '').toLocaleString('es-CO')} (${pago})</b></div>`;
      if (b.type) resumen += `<div>${typeof b.type === 'string' ? b.type : b.type?.name || ''}</div>`;
      if (b.protein) resumen += `<div>Proteína: ${typeof b.protein === 'string' ? b.protein : b.protein?.name || ''}</div>`;
      if (b.drink) resumen += `<div>Bebida: ${typeof b.drink === 'string' ? b.drink : b.drink?.name || ''}</div>`;
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

// Firestore para persistir pagos
import { db } from '../../config/firebase';
import { updateDoc, doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, increment } from 'firebase/firestore';
import { INGRESOS_COLLECTION } from './dashboardConstants';

/* ===========================
   Helpers de resumen (in-file)
   =========================== */

const normKey = (s) => (s || '').toString().trim().toLowerCase();
const normalizePaymentMethodKey = (method) => {
  const raw = normKey(
    typeof method === 'string'
      ? method
      : method?.name || method?.label || method?.title || method?.method || method?.type || ''
  );
  if (raw.includes('efect')) return 'cash';
  if (raw.includes('cash')) return 'cash';
  if (raw.includes('nequi')) return 'nequi';
  if (raw.includes('davi')) return 'daviplata';
  return 'other';
};

const paymentsRowsFromOrder = (order, fallbackBuilder) => {
  const total = Math.floor(Number(order?.total || 0)) || 0;

  console.log('🔍 DEBUG paymentsRowsFromOrder:', {
    orderId: order?.id?.slice(-4),
    hasPayments: Array.isArray(order?.payments),
    paymentsLength: order?.payments?.length,
    payments: order?.payments,
    total: total
  });

  if (Array.isArray(order?.payments) && order.payments.length) {
    const result = order.payments.map((p) => ({
      methodKey: normalizePaymentMethodKey(p.method),
      amount: Math.floor(Number(p.amount || 0)) || 0,
    }));
    console.log('✅ Using order.payments:', result);
    return result;
  }

  const fb = typeof fallbackBuilder === 'function' ? (fallbackBuilder(order) || []) : [];
  if (fb.length) {
    const result = fb.map((p) => ({
      methodKey: normalizePaymentMethodKey(p.method),
      amount: Math.floor(Number(p.amount || 0)) || 0,
    }));
    console.log('⚠️ Using fallback:', result);
    return result;
  }

  console.log('❌ Using default other:', [{ methodKey: 'other', amount: total }]);
  return [{ methodKey: 'other', amount: total }];
};

const sumPaymentsByDeliveryAndType = (orders, { fallbackBuilder, filter } = {}) => {
  const acc = {};
  const ensureBucket = (person, bucket) => {
    acc[person] = acc[person] || {};
    acc[person][bucket] = acc[person][bucket] || { cash: 0, nequi: 0, daviplata: 0, other: 0, total: 0 };
    return acc[person][bucket];
  };
  const bump = (obj, methodKey, amount) => {
    if (!amount) return;
    obj[methodKey] = (obj[methodKey] || 0) + amount;
    obj.total += amount;
  };

  (orders || [])
    .filter(order => !filter || filter(order))
    .forEach((order) => {
    const person = String(order?.deliveryPerson || 'JUAN').trim(); // default "JUAN" si no hay asignado
    const isBreakfast = Array.isArray(order?.breakfasts) || order?.type === 'breakfast';
    const bucket = isBreakfast ? 'breakfast' : 'lunch';
    const rows = paymentsRowsFromOrder(order, fallbackBuilder);
    const byType = ensureBucket(person, bucket);
    const byTotal = ensureBucket(person, 'total');
    rows.forEach(({ methodKey, amount }) => {
      bump(byType, methodKey, amount);
      bump(byTotal, methodKey, amount);
    });
  });

  return acc;
};

const money = (n) => `$${Math.floor(n || 0).toLocaleString('es-CO')}`;
// === NUEVO: mostrar solo método(s) sin montos ===
const methodLabel = (k) =>
  k === 'cash' ? 'Efectivo' : k === 'nequi' ? 'Nequi' : k === 'daviplata' ? 'Daviplata' : '';

// Función para obtener las clases de color según el método de pago
const getPaymentMethodColorClass = (method) => {
  switch (method) {
    case 'cash':
      return 'text-green-600 dark:text-green-400'; // Verde para Efectivo
    case 'daviplata':
      return 'text-red-600 dark:text-red-400'; // Rojo para Daviplata
    case 'nequi':
      return 'text-blue-600 dark:text-blue-400'; // Azul para Nequi
    default:
      return 'text-gray-600 dark:text-gray-400'; // Color por defecto
  }
};

const paymentMethodsOnly = (order) => {
  const rows = paymentsRowsFromOrder(order, defaultPaymentsForOrder);
  console.log('🔍 DEBUG paymentMethodsOnly:', {
    orderId: order?.id?.slice(-4),
    order: order,
    payments: order?.payments,
    rows: rows,
    legacy: {
      payment: order?.payment,
      paymentMethod: order?.paymentMethod,
      mealPayment: order?.meals?.[0]?.payment,
      mealPaymentMethod: order?.meals?.[0]?.paymentMethod,
    }
  });
  
  const names = [...new Set(rows.map((r) => methodLabel(r.methodKey)).filter(Boolean))];
  if (names.length) return names.join(' + ');

  const legacy =
    order?.payment ||
    order?.paymentMethod ||
    order?.meals?.[0]?.payment?.name ||
    order?.meals?.[0]?.paymentMethod ||
    order?.breakfasts?.[0]?.payment?.name ||
    order?.breakfasts?.[0]?.paymentMethod || '';
  return String(legacy).trim() || 'Sin pago';
};

// Función para migrar direcciones del formato antiguo al nuevo (para visualización)
const migrateOldAddressForDisplay = (address) => {
  if (!address) return {};
  
  // Si ya tiene el formato nuevo (con campo details Y neighborhood), devolverlo tal como está
  if (address.details !== undefined && address.neighborhood !== undefined) {
    return address;
  }
  
  let migratedAddress = { ...address };
  let extractedDetails = '';
  
  // FORMATO ANTIGUO detectado - aplicar migración para display
  if (address.addressType !== undefined && !address.neighborhood) {
    console.log('📦 FORMATO ANTIGUO detectado para display, migrando...');
    
    // Estrategia 1: Buscar patrones de nombres en el campo address
    if (address.address && typeof address.address === 'string') {
      const addressText = address.address;
      
      // Buscar patrones como "(Gabriel maria)" o "- Gabriel maria" o "Gabriel maria" al final
      const patterns = [
        /\(([^)]+)\)\s*$/,  // (Gabriel maria) al final
        /-\s*([^-]+)\s*$/,  // - Gabriel maria al final  
        /,\s*([^,]+)\s*$/,   // , Gabriel maria al final
        /\s+([A-Za-z\s]{3,})\s*$/  // Palabras al final (nombres)
      ];
      
      for (const pattern of patterns) {
        const match = addressText.match(pattern);
        if (match && match[1] && match[1].trim().length > 2) {
          const potential = match[1].trim();
          // Verificar que no sea parte de la dirección (números, #, etc.)
          if (!/[0-9#-]/.test(potential) && potential.length > 2) {
            extractedDetails = potential;
            // Remover las instrucciones de la dirección principal para display
            migratedAddress.address = addressText.replace(pattern, '').trim();
            break;
          }
        }
      }
    }
    
    // Estrategia 2: Revisar campos de nombre que pueden contener instrucciones
    if (!extractedDetails) {
      const nameFields = ['recipientName', 'localName', 'unitDetails'];
      for (const field of nameFields) {
        if (address[field] && typeof address[field] === 'string' && address[field].trim()) {
          // Si parece ser una instrucción (no un tipo de dirección estándar)
          const value = address[field].trim();
          if (value.length > 2 && !['casa', 'apartamento', 'oficina', 'shop', 'house', 'school'].includes(value.toLowerCase())) {
            extractedDetails = value;
            break;
          }
        }
      }
    }
    
    // Agregar las instrucciones extraídas al campo details
    if (extractedDetails) {
      migratedAddress.details = extractedDetails;
      console.log('🔄 Migración de dirección para display:', {
        orderId: 'display',
        original: address,
        extractedDetails
      });
    }
  }
  
  return migratedAddress;
};

/* =======================
   Component principal
   ======================= */

const TablaPedidos = ({
  theme,
  orders: rawOrders,
  searchTerm,
  setSearchTerm,
  totals, // puede venir del padre; si no, calculamos localmente con split
  isLoading,
  currentPage,
  totalPages,
  setCurrentPage,
  itemsPerPage,
  setItemsPerPage,
  deliveryPersons,
  handleEditOrder,
  handleDeleteOrder,
  handleStatusChange,
  handleSort,
  getSortIcon,
  setShowMealDetails,
  editingDeliveryId,
  setEditingDeliveryId,
  editForm,
  setEditForm,
  handleDeliveryChange,
  sortOrder,
  totalOrders,
  showProteinModal,
  setShowProteinModal,
  isMenuOpen,
  setIsMenuOpen,
  handleOpenPreview,
  handleOpenExcelPreview,
  handleExport,
  handleDeleteAllOrders,
  setShowConfirmDeleteAll,
  exportToExcel,
  exportToPDF,
  exportToCSV,
  setShowAddOrderModal,
  orderTypeFilter,
  setOrderTypeFilter,
  uniqueDeliveryPersons,
  selectedDate,
  setSelectedDate,
}) => {
  const menuRef = useRef(null);
  const [deliveryDraft, setDeliveryDraft] = useState('');
  // El filtro de fecha y su setter ahora vienen del padre
  const lastAssignedRef = useRef('');

    // Filtrado reactivo de órdenes por fecha y búsqueda
  // ...existing code...

  // El array de órdenes ya viene filtrado por fecha desde el padre
  const orders = rawOrders;
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return orders.slice(startIndex, endIndex);
  }, [orders, currentPage, itemsPerPage]);

  const currentDate = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const displayDate = selectedDate
    ? new Date(selectedDate.replace(/-/g, '/')).toLocaleDateString('es-CO', { weekday: 'long', month: 'long', day: 'numeric' })
    : currentDate;

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen, setIsMenuOpen]);

  /* ===== Toast flotante estilo “éxito” ===== */
  const [toast, setToast] = useState(null); // { type: 'success'|'warning'|'error', text: string }
  const toastTimer = useRef(null);
  const showToast = (type, text) => {
    setToast({ type, text });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  };
  useEffect(() => () => toastTimer.current && clearTimeout(toastTimer.current), []);

  // ====== Split de pagos: estado para modal local ======
  const [editingPaymentsOrder, setEditingPaymentsOrder] = useState(null);

  // ✅ Incluye tus colecciones reales
  const EXTRA_COLLECTIONS = [
    'orders',
    'deliveryOrders',
    'tableOrders',
    'deliveryBreakfastOrders', // <— importante para desayunos
    'breakfastOrders',
    'domicilioOrders'
  ];

  // ✅ Heurística afinada a tus nombres reales
  const resolveCollectionName = (order) => {
    if (order?.__collection) return order.__collection;
    if (order?.collectionName) return order.collectionName;

    const isBreakfast =
      order?.type === 'breakfast' ||
      Array.isArray(order?.breakfasts);

    if (isBreakfast) return 'deliveryBreakfastOrders';
    return 'orders'; // almuerzos
  };

  // ✅ Busca la orden probando todas las variantes conocidas
  const findExistingOrderRef = async (order) => {
    const id = order?.id;
    if (!id) throw new Error('Order sin id');

    const preferred = [];
    if (order?.__collection) preferred.push(order.__collection);
    if (order?.collectionName && order?.collectionName !== order?.__collection) {
      preferred.push(order.collectionName);
    }

    const guess = resolveCollectionName(order);
    const BASE = ['orders', 'deliveryOrders', 'tableOrders', 'deliveryBreakfastOrders', 'breakfastOrders'];
    const orderedBase = [guess, ...BASE.filter((c) => c !== guess)];

    const candidates = [
      ...preferred.filter(Boolean),
      ...orderedBase,
      ...EXTRA_COLLECTIONS,
    ].filter((v, i, a) => !!v && a.indexOf(v) === i); // únicos

    for (const col of candidates) {
      const ref = doc(db, col, id);
      const snap = await getDoc(ref);
      if (snap.exists()) return ref;
    }

    return null;
  };

  const savePaymentsForOrder = async (order, payments) => {
    const sum = (payments || []).reduce(
      (a, b) => a + (Math.floor(Number(b.amount || 0)) || 0),
      0
    );
    const total = Math.floor(Number(order.total || 0)) || 0;

    if (sum !== total) {
      showToast(
        'warning',
        `La suma de pagos (${sum.toLocaleString('es-CO')}) no coincide con el total (${total.toLocaleString('es-CO')}).`
      );
      return false;
    }

    const ref = await findExistingOrderRef(order);
    if (!ref) {
      showToast(
        'error',
        'No se pudo guardar los pagos: la orden no existe en una colección conocida.'
      );
      return false;
    }

    const payload = {
      payments: (payments || []).map((p) => ({
        method: typeof p.method === 'string' ? p.method : p?.method?.name || '',
        amount: Math.floor(Number(p.amount || 0)) || 0,
        note: p.note || '',
      })),
      updatedAt: new Date(),
    };

    try {
      await updateDoc(ref, payload);
      showToast('success', 'Pagos actualizados correctamente.');
      return true;
    } catch (e) {
      console.error('[Pagos] updateDoc error', e);
      const code = e?.code || '';
      if (code === 'permission-denied') {
        showToast('error', 'Permisos insuficientes para guardar pagos.');
      } else {
        showToast('error', 'No se pudo guardar los pagos.');
      }
      return false;
    }
  };

  // Totales superiores (tiles) - Muestra todos los totales
  const totalsDisplay = useMemo(() => {
    const acc = { cash: 0, nequi: 0, daviplata: 0, other: 0, total: 0 };
    const isActive = (o) => !/(cancel|canelad)/i.test((o?.status || '')); // ignora cancelados

    (orders || []).filter(isActive).forEach((order) => {
      // Para los métodos específicos
      if (order.payments && Array.isArray(order.payments)) {
        order.payments.forEach(payment => {
          const methodKey = normalizePaymentMethodKey(payment.method);
          const amount = Math.floor(Number(payment.amount || 0)) || 0;
          if (amount <= 0) return;
          
          acc[methodKey] = (acc[methodKey] || 0) + amount;
          acc.total += amount;
        });
      } else {
        // Estructura antigua
        const methodKey = normalizePaymentMethodKey(order.payment || order.paymentMethod);
        const amount = Math.floor(Number(order.total || 0)) || 0;
        if (amount <= 0) return;
        
        acc[methodKey] = (acc[methodKey] || 0) + amount;
        acc.total += amount;
      }
    });
    
    return acc;
  }, [orders]);

  // ===== Resumen por Domiciliarios (exacto con split) =====
  const resumen = useMemo(
    () => sumPaymentsByDeliveryAndType(orders || [], { 
      fallbackBuilder: defaultPaymentsForOrder,
      // Solo incluir pedidos no liquidados y no cancelados en el resumen
      filter: order => !order.settled && order.status !== 'Cancelado'
    }),
    [orders]
  );
  const resumenPersons = useMemo(
    () => Object.keys(resumen).sort((a, b) => a.localeCompare(b, 'es')),
    [resumen]
  );

  const handleSettle = async (person, buckets) => {
    try {
      const personKey = String(person || '').trim();
      const toSettle = (orders || []).filter((o) => {
        const normalized = String(o?.deliveryPerson || 'JUAN').trim();
        return !o?.settled && normalized === personKey;
      });

      if (!toSettle.length) {
        showToast('warning', `No hay pedidos pendientes para liquidar de ${personKey}.`);
        return;
      }

      // Calcular totales por método de pago
      const totals = {
        cash: 0,
        nequi: 0,
        daviplata: 0
      };

      toSettle.forEach(order => {
        const payments = order.payments || [];
        payments.forEach(payment => {
          const methodKey = normalizePaymentMethodKey(payment.method);
          if (methodKey in totals) {
            totals[methodKey] += Math.floor(Number(payment.amount || 0));
          }
        });
      });

      let ok = 0, fail = 0;

      for (const order of toSettle) {
        const ref = await findExistingOrderRef(order);
        if (!ref) { fail++; continue; }

        try {
          // Determinar qué métodos de pago están presentes
          const payments = order.payments || [];
          const hasPaymentMethod = (method) => 
            payments.some(p => normalizePaymentMethodKey(p.method) === method);
          // Determinar qué métodos están presentes
          const hasNequi = hasPaymentMethod('nequi');
          const hasDaviplata = hasPaymentMethod('daviplata');
          const hasCash = hasPaymentMethod('cash');
          // Construir el objeto de actualización
          const updateData = {
            settledAt: new Date().toISOString(),
          };
          // Marcar como settled y actualizar el estado de liquidación de cada método
          updateData.settled = true;
          updateData.paymentSettled = {
            ...(order.paymentSettled || {}),
            nequi: hasNequi ? true : (order.paymentSettled?.nequi || false),
            daviplata: hasDaviplata ? true : (order.paymentSettled?.daviplata || false),
            cash: hasCash ? true : (order.paymentSettled?.cash || false)
          };
          await updateDoc(ref, updateData);
          // También actualizar el documento de Ingresos para la fecha de la orden
          (async function updateIngresosForOrder(o) {
            try {
              const getOrderISO = (ord) => {
                const ts = ord?.createdAt || ord?.timestamp || ord?.date;
                const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
                if (!d) return null;
                d.setHours(0,0,0,0);
                return d.toISOString().split('T')[0];
              };
              const iso = getOrderISO(o) || new Date().toISOString().split('T')[0];
              const amount = Math.floor(Number(o.total || 0)) || 0;
              if (!amount) return;
              const isBreakfast = (o?.type === 'breakfast') || Array.isArray(o?.breakfasts);
              const categoryKey = isBreakfast ? 'domiciliosDesayuno' : 'domiciliosAlmuerzo';

              const colRef = collection(db, INGRESOS_COLLECTION);
              const q = query(colRef, where('date', '==', iso));
              const snap = await getDocs(q);
              if (!snap.empty) {
                const docRef = doc(db, INGRESOS_COLLECTION, snap.docs[0].id);
                // Intentar incrementar campos existentes (si no existen, setearlos a amount)
                const updates = {
                  ['categories.' + categoryKey]: increment(amount),
                  totalIncome: increment(amount),
                  updatedAt: serverTimestamp(),
                };
                await updateDoc(docRef, updates);
              } else {
                // Crear nuevo registro para la fecha con la categoría adecuada
                const payload = {
                  date: iso,
                  categories: {
                    domiciliosAlmuerzo: isBreakfast ? 0 : amount,
                    domiciliosDesayuno: isBreakfast ? amount : 0,
                    mesasAlmuerzo: 0,
                    mesasDesayuno: 0,
                  },
                  totalIncome: amount,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                };
                await addDoc(colRef, payload);
              }
            } catch (e) {
              console.error('[Ingresos] error al actualizar ingresos por liquidación:', e);
            }
          })(order);
          ok++;
        } catch (e) {
          console.error('[Liquidar] updateDoc error', e);
          fail++;
        }
      }

      if (fail === 0) {
        showToast('success', `Domiciliario liquidado: ${personKey} (${ok} órdenes).`);
      } else {
        showToast('warning', `Liquidado con advertencias: ${personKey}. OK: ${ok}, errores: ${fail}.`);
      }
    } catch (e) {
      console.error('[Liquidar] error general', e);
      showToast('error', 'Ocurrió un error al liquidar.');
    }
  };



  // Reiniciar la página al cambiar la fecha seleccionada
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate]);

  return (
    <>
      {/* TOAST FLOTANTE */}
      {toast && (
        <div className="fixed right-4 top-4 z-[10002]">
          <div
            className={classNames(
              'rounded-xl px-4 py-3 shadow-lg border',
              toast.type === 'success' && 'bg-green-600 text-white border-green-500',
              toast.type === 'warning' && 'bg-yellow-400 text-black border-yellow-300',
              toast.type === 'error' && 'bg-red-600 text-white border-red-500'
            )}
          >
            <span className="font-semibold">{toast.text}</span>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Gestión de Pedidos Domicilios
        </h2>

        {/* Totals Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 text-sm text-gray-700 dark:text-gray-300">
          <div className={classNames('p-3 sm:p-4 rounded-lg shadow-sm', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
            <p className="font-semibold text-sm sm:text-base">Total Efectivo</p>
            <p className="text-lg sm:text-xl font-bold">${Math.floor(totalsDisplay.cash || 0).toLocaleString('es-CO')}</p>
          </div>
          <div className={classNames('p-3 sm:p-4 rounded-lg shadow-sm', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
            <p className="font-semibold text-sm sm:text-base">Total Daviplata</p>
            <p className="text-lg sm:text-xl font-bold">${Math.floor(totalsDisplay.daviplata || 0).toLocaleString('es-CO')}</p>
          </div>
          <div className={classNames('p-3 sm:p-4 rounded-lg shadow-sm', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
            <p className="font-semibold text-sm sm:text-base">Total Nequi</p>
            <p className="text-lg sm:text-xl font-bold">${Math.floor(totalsDisplay.nequi || 0).toLocaleString('es-CO')}</p>
          </div>
          <div className={classNames('p-3 sm:p-4 rounded-lg shadow-sm', theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
            <p className="font-semibold text-sm sm:text-base">Total General</p>
            <p className="text-lg sm:text-xl font-bold">
              ${Math.floor((totalsDisplay.cash || 0) + (totalsDisplay.daviplata || 0) + (totalsDisplay.nequi || 0)).toLocaleString('es-CO')}
            </p>
          </div>
        </div>

        {/* Search, Date Filter, and Menu */}
        <div className="flex flex-wrap justify-center sm:justify-between items-center mb-6 gap-3 sm:gap-4">
          <div className="flex flex-wrap gap-4 items-center flex-1 max-w-3xl">
            <div className="relative w-full">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar pedidos..."
                className={classNames(
                  'pl-10 pr-4 py-2 sm:py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 w-full shadow-sm text-sm sm:text-base transition-all duration-200',
                  theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400' : 'border-gray-300 bg-white text-gray-900 placeholder-gray-500'
                )}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2">
            <button
              onClick={() => setShowProteinModal(true)}
              className={classNames(
                'flex items-center justify-center gap-2 px-3 py-2 sm:px-5 sm:py-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 flex-shrink-0',
                theme === 'dark' ? 'bg-gray-600 hover:bg-gray-500 text-white border border-gray-500' : 'bg-gray-200 hover:bg-gray-300 text-gray-900 border border-gray-400'
              )}
            >
              <PlusIcon className="w-4 h-4" />
              <span className="hidden md:inline">Proteínas del Día</span>
            </button>
            <label
              className={classNames(
                'relative flex items-center justify-center gap-2 px-3 py-2 sm:px-5 sm:py-3 rounded-lg text-xs sm:text-sm font-semibold shadow-sm border transition-colors duration-200 flex-shrink-0 cursor-pointer',
                theme === 'dark' ? 'bg-gray-700 text-white border-gray-500' : 'bg-gray-200 text-gray-900 border-gray-400'
              )}
              onClick={(e) => {
                const input = e.currentTarget.querySelector('input[type=date]');
                if (input) input.showPicker();
              }}
            >
              {displayDate}
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer bg-transparent"
              />
            </label>
            <div className="relative flex-shrink-0" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={classNames('flex items-center justify-center p-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200', 'focus:outline-none focus:ring-2 focus:ring-blue-500')}
                aria-label="Opciones de menú"
              >
                <EllipsisVerticalIcon className={classNames('w-6 h-6', theme === 'dark' ? 'text-gray-200 hover:text-white' : 'text-gray-700 hover:text-gray-900')} />
              </button>
              {isMenuOpen && (
                <div className={classNames('absolute right-0 mt-2 w-48 rounded-lg shadow-xl z-50', theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-white text-gray-900')}>
                  <div className="py-1">
                    <button onClick={() => { setOrderTypeFilter('breakfast'); setIsMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200">Ver Desayunos</button>
                    <button onClick={() => { setOrderTypeFilter('lunch'); setIsMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200">Ver Almuerzos</button>
                    <button onClick={() => { setOrderTypeFilter('all'); setIsMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200">Ver Todos</button>
                    <button onClick={() => { setShowAddOrderModal(true); setIsMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200">Generar Orden</button>
                    <button onClick={() => { handleOpenPreview(); setIsMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200">Vista Previa PDF</button>
                    <button onClick={() => { handleOpenExcelPreview(); setIsMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200">Vista Previa Excel</button>
                    <button onClick={() => { handleExport(exportToExcel, 'Excel'); setIsMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200 flex items-center">
                      <ArrowDownTrayIcon className="w-4 h-4 mr-2" /> Exportar Excel
                    </button>
                    <button onClick={() => { handleExport(exportToPDF, 'PDF'); setIsMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200 flex items-center">
                      <ArrowDownTrayIcon className="w-4 h-4 mr-2" /> Exportar PDF
                    </button>
                    <button onClick={() => { handleExport(exportToCSV, 'CSV'); setIsMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200 flex items-center">
                      <ArrowDownTrayIcon className="w-4 h-4 mr-2" /> Exportar CSV
                    </button>
                    <button onClick={() => { setShowConfirmDeleteAll(true); setIsMenuOpen(false); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200 text-red-500">Eliminar Todos</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className={classNames('p-3 sm:p-4 rounded-2xl shadow-xl max-h-[70vh] overflow-y-auto custom-scrollbar transition-all duration-300', theme === 'dark' ? 'bg-gray-800' : 'bg-white')}>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500"></div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className={classNames('font-semibold sticky top-0 z-10 shadow-sm', theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700')}>
                      <th className="p-2 sm:p-3 border-b cursor-pointer whitespace-nowrap" onClick={() => handleSort('orderNumber')}>Nº {getSortIcon('orderNumber')}</th>
                      <th className="p-2 sm:p-3 border-b whitespace-nowrap">Detalles</th>
                      <th className="p-2 sm:p-3 border-b cursor-pointer whitespace-nowrap" onClick={() => handleSort('address')}>Dirección {getSortIcon('address')}</th>
                      <th className="p-2 sm:p-3 border-b cursor-pointer whitespace-nowrap" onClick={() => handleSort('phone')}>Teléfono {getSortIcon('phone')}</th>
                      <th className="p-2 sm:p-3 border-b cursor-pointer whitespace-nowrap" onClick={() => handleSort('time')}>Hora {getSortIcon('time')}</th>
                      <th className="p-2 sm:p-3 border-b cursor-pointer whitespace-nowrap" onClick={() => handleSort('payment')}>Pago {getSortIcon('payment')}</th>
                      <th className="p-2 sm:p-3 border-b cursor-pointer whitespace-nowrap" onClick={() => handleSort('total')}>Total {getSortIcon('total')}</th>
                      <th className="p-2 sm:p-3 border-b cursor-pointer whitespace-nowrap" onClick={() => handleSort('deliveryPerson')}>Domiciliario {getSortIcon('deliveryPerson')}</th>
                      <th className="p-2 sm:p-3 border-b cursor-pointer whitespace-nowrap" onClick={() => handleSort('status')}>Estado {getSortIcon('status')}</th>
                      <th className="p-2 sm:p-3 border-b whitespace-nowrap">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="p-6 text-center text-gray-500 dark:text-gray-400">No se encontraron pedidos. Intenta ajustar tu búsqueda o filtros.</td>
                      </tr>
                    ) : (
                      orders.map((order, index) => {
                        const displayNumber =
                          sortOrder === 'asc'
                            ? (currentPage - 1) * itemsPerPage + index + 1
                            : totalOrders - ((currentPage - 1) * itemsPerPage + index);

                        const addressDisplay = getAddressDisplay(order.meals?.[0]?.address || order.breakfasts?.[0]?.address);

                        const rawLegacy = cleanText(
                          order.payment ||
                          order.meals?.[0]?.payment?.name ||
                          order.breakfasts?.[0]?.payment?.name ||
                          'Sin pago'
                        );

                        const paymentDisplay = paymentMethodsOnly(order);

                        const statusClass =
                          order.status === 'Pendiente' ? 'bg-yellow-500 text-black'
                            : order.status === 'Entregado' ? 'bg-green-500 text-white'
                            : order.status === 'Cancelado' ? 'bg-red-500 text-white'
                            : '';

                        const timeValue = order.meals?.[0]?.time || order.breakfasts?.[0]?.time;
                        let displayTime = 'N/A';
                        if (typeof timeValue === 'string') displayTime = timeValue;
                        else if (typeof timeValue === 'object' && timeValue !== null) displayTime = timeValue.name || 'N/A';

                        return (
                          <tr
                            key={order.id}
                            className={classNames(
                              'border-b transition-colors duration-150',
                              theme === 'dark' ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50',
                              index % 2 === 0 ? (theme === 'dark' ? 'bg-gray-750' : 'bg-gray-50') : ''
                            )}
                          >
                            <td className="p-2 sm:p-3 text-gray-300">{displayNumber}</td>
                            <td className="p-2 sm:p-3 text-gray-300">
                              <button
                                onClick={() => setShowMealDetails(order)}
                                className="text-blue-400 hover:text-blue-300 text-xs sm:text-sm flex items-center"
                                title="Ver detalles de la bandeja"
                              >
                                <InformationCircleIcon className="w-4 h-4 mr-1" />
                                Ver
                              </button>
                            </td>
                            <td className="p-2 sm:p-3 text-gray-300 max-w-[250px] sm:max-w-xs">
                              <div className="text-xs sm:text-sm">
                                {(() => {
                                  // Migrar direcciones del formato antiguo para mostrar correctamente
                                  const rawAddress = order.meals?.[0]?.address || order.breakfasts?.[0]?.address;
                                  const migratedAddress = migrateOldAddressForDisplay(rawAddress);
                                  
                                  return (
                                    <>
                                      <div className="whitespace-nowrap overflow-hidden text-ellipsis">
                                        {migratedAddress?.address || 'Sin dirección'}
                                      </div>
                                      {migratedAddress?.details && (
                                        <div className="whitespace-nowrap overflow-hidden text-ellipsis text-gray-400 text-xs">
                                          ({migratedAddress.details})
                                        </div>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </td>
                            <td className="p-2 sm:p-3 text-gray-300 whitespace-nowrap">
                              {order.meals?.[0]?.address?.phoneNumber ||
                                order.breakfasts?.[0]?.address?.phoneNumber ||
                                'N/A'}
                            </td>
                            <td className="p-2 sm:p-3 text-gray-300 whitespace-nowrap">{displayTime}</td>
                            <td className="p-2 sm:p-3 text-gray-300 whitespace-nowrap">{paymentDisplay}</td>
                            <td className="p-2 sm:p-3 text-gray-300 whitespace-nowrap">
                              ${order.total?.toLocaleString('es-CO') || '0'}
                            </td>
                            <td className="p-2 sm:p-3 text-gray-300 whitespace-nowrap">
                              {editingDeliveryId === order.id ? (
                                <>
                                  <input
                                    list={`delivery-list-${order.id}`}
                                    value={deliveryDraft}
                                    onChange={(e) => setDeliveryDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        const valueToSave = (deliveryDraft || '').trim() || 'Sin asignar';
                                        handleDeliveryChange(order.id, valueToSave);
                                        if (valueToSave !== 'Sin asignar') lastAssignedRef.current = valueToSave;
                                        setEditingDeliveryId(null);
                                      } else if (e.key === 'Escape') {
                                        setEditingDeliveryId(null);
                                      }
                                    }}
                                    onBlur={() => {
                                      const valueToSave = (deliveryDraft || '').trim() || 'Sin asignar';
                                      handleDeliveryChange(order.id, valueToSave);
                                      if (valueToSave !== 'Sin asignar') lastAssignedRef.current = valueToSave;
                                      setEditingDeliveryId(null);
                                    }}
                                    placeholder="Escribe y Enter…"
                                    className={classNames(
                                      'w-40 p-1 rounded-md border text-sm',
                                      theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                                      'focus:outline-none focus:ring-1 focus:ring-blue-500'
                                    )}
                                    autoFocus
                                  />
                                  <datalist id={`delivery-list-${order.id}`}>
                                    <option value="Sin asignar" />
                                    {uniqueDeliveryPersons.map((person) => (
                                      <option key={person} value={person} />
                                    ))}
                                  </datalist>
                                </>
                              ) : (
                                <span
                                  onClick={() => {
                                    // Si no hay domiciliario asignado (Sin asignar), usar automáticamente el último
                                    const currentDeliveryPerson = order.deliveryPerson?.trim();
                                    const isUnassigned = !currentDeliveryPerson || currentDeliveryPerson === 'Sin asignar';
                                    
                                    if (isUnassigned && lastAssignedRef.current) {
                                      // Auto-asignar el último domiciliario directamente
                                      setDeliveryDraft(lastAssignedRef.current);
                                      setEditingDeliveryId(order.id);
                                      
                                      // Guardar automáticamente con el último domiciliario
                                      setTimeout(() => {
                                        const valueToSave = lastAssignedRef.current.trim();
                                        handleDeliveryChange(order.id, valueToSave);
                                        setEditingDeliveryId(null);
                                        setDeliveryDraft('');
                                      }, 100);
                                    } else {
                                      // Comportamiento normal para editar
                                      const initial = currentDeliveryPerson || lastAssignedRef.current || '';
                                      setDeliveryDraft(initial);
                                      setEditingDeliveryId(order.id);
                                    }
                                  }}
                                  className="cursor-pointer hover:text-blue-400"
                                  title={
                                    (!order.deliveryPerson?.trim() || order.deliveryPerson === 'Sin asignar') && lastAssignedRef.current
                                      ? `Click para auto-asignar: ${lastAssignedRef.current}`
                                      : "Click para editar; Enter para guardar"
                                  }
                                >
                                  {order.deliveryPerson || 'Sin asignar'}
                                </span>
                              )}
                            </td>
                            <td className="p-2 sm:p-3 whitespace-nowrap">
                              <select
                                value={order.status || 'Pendiente'}
                                onChange={async (e) => {
                                  const value = e.target.value;
                                  try {
                                    const maybePromise = handleStatusChange(order.id, value);
                                    if (maybePromise && typeof maybePromise.then === 'function') {
                                      await maybePromise;
                                    }
                                    showToast('success', 'Estado actualizado correctamente.');
                                  } catch (err) {
                                    console.error('[Estado] error al actualizar', err);
                                    showToast('error', 'No se pudo actualizar el estado.');
                                  }
                                }}
                                className={classNames(
                                  'px-2 py-1 rounded-full text-xs font-semibold appearance-none cursor-pointer',
                                  statusClass,
                                  theme === 'dark' ? 'bg-opacity-70' : 'bg-opacity-90',
                                  'focus:outline-none focus:ring-2 focus:ring-blue-500'
                                )}
                              >
                                <option value="Pendiente">Pendiente</option>
                                <option value="En Preparación">En Preparación</option>
                                <option value="En Camino">En Camino</option>
                                <option value="Entregado">Entregado</option>
                                <option value="Cancelado">Cancelado</option>
                              </select>
                            </td>
                            <td className="p-2 sm:p-3 whitespace-nowrap">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEditOrder(order)}
                                  className="text-blue-500 hover:text-blue-400 transition-colors duration-150 p-1 rounded-md"
                                  title="Editar pedido"
                                  aria-label={`Editar pedido ${displayNumber}`}
                                >
                                  <PencilIcon className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => setEditingPaymentsOrder(order)}
                                  className="text-indigo-500 hover:text-indigo-400 transition-colors duration-150 p-1 rounded-md"
                                  title="Editar pagos (split)"
                                  aria-label={`Editar pagos del pedido ${displayNumber}`}
                                >
                                  💳
                                </button>
                                <button
                                  onClick={() => handlePrintDeliveryReceipt(order)}
                                  className="text-green-600 hover:text-green-500 transition-colors duration-150 p-1 rounded-md border border-green-600"
                                  title="Imprimir recibo domicilio"
                                  aria-label={`Imprimir recibo domicilio ${displayNumber}`}
                                >
                                  <PrinterIcon className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteOrder(order.id)}
                                  className="text-red-500 hover:text-red-400 transition-colors duration-150 p-1 rounded-md"
                                  title="Eliminar pedido"
                                  aria-label={`Eliminar pedido ${displayNumber}`}
                                >
                                  <TrashIcon className="w-5 h-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex flex-wrap justify-between items-center mt-6 gap-3">
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span>Pedidos por página:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className={classNames('p-2 rounded-md border text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900')}
                  >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="30">30</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="200">200</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={classNames(
                      'p-2 rounded-md transition-colors duration-200',
                      currentPage === 1 ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' : 'hover:bg-gray-700 text-gray-200'
                    )}
                  >
                    <ChevronLeftIcon className="w-5 h-5" />
                  </button>
                  <span>Página {currentPage} de {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={classNames(
                      'p-2 rounded-md transition-colors duration-200',
                      currentPage === totalPages ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' : 'hover:bg-gray-700 text-gray-200'
                    )}
                  >
                    <ChevronRightIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* === Resumen por Domiciliarios (ÚNICO) === */}
        <div className="mt-8 space-y-6">
          <h2 className="text-xl sm:text-2xl font-bold">Resumen por Domiciliarios</h2>

          {resumenPersons.length === 0 ? (
            <div className={classNames(
              "rounded-2xl p-6 text-center",
              theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-700'
            )}>
              No hay datos para el resumen de domiciliarios.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {resumenPersons.map((person) => {
                const buckets = resumen[person] || {};
                const lunch = buckets.lunch || { cash:0, nequi:0, daviplata:0, other:0, total:0 };
                const breakfast = buckets.breakfast || { cash:0, nequi:0, daviplata:0, other:0, total:0 };
                const overall = buckets.total || { cash:0, nequi:0, daviplata:0, other:0, total:0 };

                return (
                  <div key={person} className={classNames(
                    "rounded-2xl p-4 sm:p-5 shadow-sm",
                    theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
                  )}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base sm:text-lg font-semibold">{person}</h3>
                      <button
                        onClick={() => handleSettle(person, buckets)}
                        className="text-xs px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        Liquidar ▸
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Almuerzo */}
                      <div>
                        <div className="text-sm font-medium mb-2">Almuerzo</div>
                        <div className={classNames(
                          "rounded-lg p-3 sm:p-4 border",
                          theme === 'dark' ? 'bg-gray-800/60 border-gray-700' : 'bg-gray-50 border-gray-200'
                        )}>
                          <div className="flex justify-between text-sm my-0.5"><span>Efectivo</span><span className={`font-semibold ${getPaymentMethodColorClass('cash')}`}>{money(lunch.cash)}</span></div>
                          <div className="flex justify-between text-sm my-0.5"><span>Daviplata</span><span className={`font-semibold ${getPaymentMethodColorClass('daviplata')}`}>{money(lunch.daviplata)}</span></div>
                          <div className="flex justify-between text-sm my-0.5"><span>Nequi</span><span className={`font-semibold ${getPaymentMethodColorClass('nequi')}`}>{money(lunch.nequi)}</span></div>
                          {lunch.other > 0 && (
                            <div className="flex justify-between text-sm my-0.5"><span>Otros</span><span className="font-semibold">{money(lunch.other)}</span></div>
                          )}
                          <div className="h-px my-2 bg-gray-200 dark:bg-gray-700" />
                          <div className="flex justify-between text-sm"><span className="font-medium">Total</span><span className="font-bold">{money(lunch.total)}</span></div>
                        </div>
                      </div>

                      {/* Desayuno */}
                      <div>
                        <div className="text-sm font-medium mb-2">Desayuno</div>
                        <div className={classNames(
                          "rounded-lg p-3 sm:p-4 border",
                          theme === 'dark' ? 'bg-gray-800/60 border-gray-700' : 'bg-gray-50 border-gray-200'
                        )}>
                          <div className="flex justify-between text-sm my-0.5"><span>Efectivo</span><span className={`font-semibold ${getPaymentMethodColorClass('cash')}`}>{money(breakfast.cash)}</span></div>
                          <div className="flex justify-between text-sm my-0.5"><span>Daviplata</span><span className={`font-semibold ${getPaymentMethodColorClass('daviplata')}`}>{money(breakfast.daviplata)}</span></div>
                          <div className="flex justify-between text-sm my-0.5"><span>Nequi</span><span className={`font-semibold ${getPaymentMethodColorClass('nequi')}`}>{money(breakfast.nequi)}</span></div>
                          {breakfast.other > 0 && (
                            <div className="flex justify-between text-sm my-0.5"><span>Otros</span><span className="font-semibold">{money(breakfast.other)}</span></div>
                          )}
                          <div className="h-px my-2 bg-gray-200 dark:bg-gray-700" />
                          <div className="flex justify-between text-sm"><span className="font-medium">Total</span><span className="font-bold">{money(breakfast.total)}</span></div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="text-sm font-medium mb-2">Total general</div>
                      <div className={classNames(
                        "rounded-lg p-3 sm:p-4 border",
                        theme === 'dark' ? 'bg-gray-800/60 border-gray-700' : 'bg-gray-50 border-gray-200'
                      )}>
                        <div className="flex justify-between text-sm my-0.5"><span>Efectivo</span><span className={`font-semibold ${getPaymentMethodColorClass('cash')}`}>{money(overall.cash)}</span></div>
                        <div className="flex justify-between text-sm my-0.5"><span>Daviplata</span><span className={`font-semibold ${getPaymentMethodColorClass('daviplata')}`}>{money(overall.daviplata)}</span></div>
                        <div className="flex justify-between text-sm my-0.5"><span>Nequi</span><span className={`font-semibold ${getPaymentMethodColorClass('nequi')}`}>{money(overall.nequi)}</span></div>
                        {overall.other > 0 && (
                          <div className="flex justify-between text-sm my-0.5"><span>Otros</span><span className="font-semibold">{money(overall.other)}</span></div>
                        )}
                        <div className="h-px my-2 bg-gray-200 dark:bg-gray-700" />
                        <div className="flex justify-between text-sm"><span className="font-medium">Total</span><span className="font-bold">{money(overall.total)}</span></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

          {/* Modal de edición de pagos (split) */}
          {editingPaymentsOrder && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001]">
              <div className={classNames('p-4 sm:p-6 rounded-lg max-w-xl w-full max-h-[80vh] overflow-y-auto', theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-900')}>
                <h3 className="text-lg font-semibold mb-4">
                  Editar pagos — Orden #{editingPaymentsOrder.id.slice(0, 8)}
                </h3>

                <PaymentSplitEditor
                  theme={theme}
                  total={editingPaymentsOrder.total || 0}
                  value={
                    Array.isArray(editingPaymentsOrder.payments) && editingPaymentsOrder.payments.length
                      ? editingPaymentsOrder.payments
                      : defaultPaymentsForOrder(editingPaymentsOrder)
                  }
                  onChange={(rows) => {
                    setEditingPaymentsOrder((prev) => ({ ...prev, payments: rows }));
                  }}
                />

                <div className="mt-4 flex gap-2 justify-end">
                  <button onClick={() => setEditingPaymentsOrder(null)} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm">
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      const ok = await savePaymentsForOrder(editingPaymentsOrder, editingPaymentsOrder.payments || []);
                      if (ok) setEditingPaymentsOrder(null);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      );
    }

export default TablaPedidos;