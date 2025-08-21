// src/components/Admin/TablaPedidos.js
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { classNames } from '../../utils/classNames.js';
import { cleanText, getAddressDisplay } from './utils.js';
import { calculateMealPrice } from '../../utils/MealCalculations';
import {
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InformationCircleIcon,
  PencilIcon,
  TrashIcon,
  EllipsisVerticalIcon,
  PlusIcon
} from '@heroicons/react/24/outline';

// NUEVO: pagos
import PaymentSplitEditor from '../common/PaymentSplitEditor';
import { summarizePayments, sumPaymentsByMethod, defaultPaymentsForOrder } from '../../utils/payments';

// Firestore para persistir pagos
import { db } from '../../config/firebase';
import { updateDoc, doc, getDoc } from 'firebase/firestore';

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

  if (Array.isArray(order?.payments) && order.payments.length) {
    return order.payments.map((p) => ({
      methodKey: normalizePaymentMethodKey(p.method),
      amount: Math.floor(Number(p.amount || 0)) || 0,
    }));
  }

  const fb = typeof fallbackBuilder === 'function' ? (fallbackBuilder(order) || []) : [];
  if (fb.length) {
    return fb.map((p) => ({
      methodKey: normalizePaymentMethodKey(p.method),
      amount: Math.floor(Number(p.amount || 0)) || 0,
    }));
  }

  return [{ methodKey: 'other', amount: total }];
};

const sumPaymentsByDeliveryAndType = (orders, { fallbackBuilder } = {}) => {
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

  (orders || []).forEach((order) => {
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

const paymentMethodsOnly = (order) => {
  const rows = paymentsRowsFromOrder(order, defaultPaymentsForOrder);
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
/* =======================
   Component principal
   ======================= */

const TablaPedidos = ({
  theme,
  orders,
  searchTerm,
  setSearchTerm,
  totals, // puede venir del padre; si no, calculamos localmente con split
  isLoading,
  paginatedOrders,
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
}) => {
  const currentDate = new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const menuRef = useRef(null);
  const [deliveryDraft, setDeliveryDraft] = useState('');
  const lastAssignedRef = useRef('');

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
    
    (orders || []).forEach((order) => {
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
      // Solo incluir pedidos no liquidados en el resumen
      filter: order => !order.settled 
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
      };          await updateDoc(ref, updateData);
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

        {/* Search, Proteins, Date, and Menu */}
        <div className="flex flex-wrap justify-center sm:justify-between items-center mb-6 gap-3 sm:gap-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar pedidos..."
            className={classNames(
              'p-2 sm:p-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:max-w-xs shadow-sm text-sm sm:text-base transition-all duration-200',
              theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'
            )}
          />
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
            <div
              className={classNames(
                'flex items-center justify-center gap-2 px-3 py-2 sm:px-5 sm:py-3 rounded-lg text-xs sm:text-sm font-semibold shadow-sm border transition-colors duration-200 flex-shrink-0',
                theme === 'dark' ? 'bg-gray-700 text-white border-gray-500' : 'bg-gray-200 text-gray-900 border-gray-400'
              )}
            >
              {currentDate}
            </div>
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
                    {paginatedOrders.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="p-6 text-center text-gray-500 dark:text-gray-400">No se encontraron pedidos. Intenta ajustar tu búsqueda o filtros.</td>
                      </tr>
                    ) : (
                      paginatedOrders.map((order, index) => {
                        const displayNumber =
                          sortOrder === 'asc'
                            ? (currentPage - 1) * itemsPerPage + index + 1
                            : paginatedOrders.length - ((currentPage - 1) * itemsPerPage + index);

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
                            <td className="p-2 sm:p-3 text-gray-300 max-w-[150px] sm:max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                              {addressDisplay}
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
                                    const initial = order.deliveryPerson || lastAssignedRef.current || '';
                                    setDeliveryDraft(initial);
                                    setEditingDeliveryId(order.id);
                                  }}
                                  className="cursor-pointer hover:text-blue-400"
                                  title="Click para editar; Enter para guardar"
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
                  </select>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={classNames(
                      'p-2 rounded-md transition-colors duration-200',
                      currentPage === 1 ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' : theme === 'dark' ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
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
                      currentPage === totalPages ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed' : theme === 'dark' ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
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
                          <div className="flex justify-between text-sm my-0.5"><span>Efectivo</span><span className="font-semibold">{money(lunch.cash)}</span></div>
                          <div className="flex justify-between text-sm my-0.5"><span>Daviplata</span><span className="font-semibold">{money(lunch.daviplata)}</span></div>
                          <div className="flex justify-between text-sm my-0.5"><span>Nequi</span><span className="font-semibold">{money(lunch.nequi)}</span></div>
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
                          <div className="flex justify-between text-sm my-0.5"><span>Efectivo</span><span className="font-semibold">{money(breakfast.cash)}</span></div>
                          <div className="flex justify-between text-sm my-0.5"><span>Daviplata</span><span className="font-semibold">{money(breakfast.daviplata)}</span></div>
                          <div className="flex justify-between text-sm my-0.5"><span>Nequi</span><span className="font-semibold">{money(breakfast.nequi)}</span></div>
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
                        <div className="flex justify-between text-sm my-0.5"><span>Efectivo</span><span className="font-semibold">{money(overall.cash)}</span></div>
                        <div className="flex justify-between text-sm my-0.5"><span>Daviplata</span><span className="font-semibold">{money(overall.daviplata)}</span></div>
                        <div className="flex justify-between text-sm my-0.5"><span>Nequi</span><span className="font-semibold">{money(overall.nequi)}</span></div>
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
};

export default TablaPedidos;
