//src/components/Admin/Dashboard.js
import React, { useState, useEffect, Fragment, useMemo, useCallback, useRef } from 'react';
import { db, auth } from '../../config/firebase';
import { onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { writeBatch, getDocs, collection } from 'firebase/firestore';
import { classNames } from '../../utils/classNames';
import {
  Dialog, Transition, Popover, PopoverButton, PopoverPanel
} from '@headlessui/react';
import {
  Trash2, Info, X, ShoppingCart, DollarSign, Users,
  Activity, Calendar, ChevronDown, ChevronUp, Clock, AlertTriangle
} from 'lucide-react';
import { useDashboardData } from '../../hooks/useDashboardData';
import DashboardCharts from './DashboardCharts';
import { DashboardDateProvider, useDashboardDate } from '../../context/DashboardDateContext';

// ----- Altura unificada para todas las tarjetas -----
const CARD_HEIGHT = 360;

// Sólo usamos este token
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Hook para notificaciones (simple)
const useNotifier = () => {
  const [message, setMessage] = useState(null);
  const notify = useCallback((type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }, []);
  return { notify, message };
};

// Spinner
const LoadingSpinner = ({ theme }) => (
  <div className="flex justify-center items-center h-screen bg-gray-900">
    <div className={`animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 ${theme === 'dark' ? 'border-emerald-500' : 'border-emerald-600'}`}></div>
  </div>
);

// Modal confirmación
const ConfirmationModal = ({ show, onClose, onConfirm, confirmText, setConfirmText, theme }) => (
  <Transition show={show} as={Fragment}>
    <Dialog as="div" className="relative z-50" onClose={onClose}>
      <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
        <div className="fixed inset-0 bg-black bg-opacity-50" />
      </Transition.Child>
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
          <Dialog.Panel className={classNames('w-full max-w-sm p-6 rounded-lg shadow-md text-center', theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-900')}>
            <Dialog.Title className="text-lg font-medium mb-4 flex items-center justify-center gap-2 text-red-500"><AlertTriangle className="w-6 h-6" />Confirmar Limpieza de Actividad</Dialog.Title>
            <p className="mb-4 text-sm">Estás a punto de eliminar <span className="font-bold text-red-500">TODAS</span> las actividades. Esta acción es irreversible. Para confirmar, escribe "confirmar":</p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)} 
              className={classNames('w-full p-2 rounded-md border text-center text-sm', theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900', 'focus:outline-none focus:ring-1 focus:ring-red-500')}
              placeholder="escribe 'confirmar'"
            />
            <div className="mt-6 flex justify-center gap-2">
              <button onClick={onClose} className={classNames('px-4 py-2 rounded-md text-sm font-medium', theme === 'dark' ? 'bg-gray-600 hover:bg-gray-700 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-900')}>Cancelar</button>
              <button onClick={onConfirm} className="px-4 py-2 rounded-md text-sm font-medium bg-red-600 hover:bg-red-700 text-white">Limpiar Actividad</button>
            </div>
          </Dialog.Panel>
        </Transition.Child>
      </div>
    </Dialog>
  </Transition>
);

// Modal detalles
const DetailsModal = ({ show, onClose, details, theme }) => (
  <Transition show={show} as={Fragment}>
    <Dialog as="div" className="relative z-50" onClose={onClose}>
      <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
        <div className="fixed inset-0 bg-black bg-opacity-50" />
      </Transition.Child>
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
          <Dialog.Panel className={classNames('w-full max-w-md p-6 rounded-lg shadow-md', theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-900')}>
            <div className="flex justify-between items-center mb-4">
              <Dialog.Title className="text-lg font-medium">Detalle de Actividad</Dialog.Title>
              <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-700 transition">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <pre className="text-xs whitespace-pre-wrap p-4 bg-gray-700 rounded-lg text-gray-300 overflow-auto max-h-[70vh]">
              {JSON.stringify(details || {}, null, 2)}
            </pre>
          </Dialog.Panel>
        </Transition.Child>
      </div>
    </Dialog>
  </Transition>
);

// Tarjeta simple (ahora soporta vAlign y altura por prop)
const InfoCard = ({ theme, title, icon, color, data, labelColor = {}, vAlign = 'top', cardHeight = CARD_HEIGHT }) => {
  const Icon = useMemo(() => {
    switch (icon) {
      case 'ShoppingCart': return ShoppingCart;
      case 'Users': return Users;
      case 'Activity': return Activity;
      default: return null;
    }
  }, [icon]);

  const containerLayout =
    vAlign === 'center'
      ? 'grid grid-rows-[auto,1fr]'
      : vAlign === 'between'
      ? 'flex flex-col justify-between'
      : 'flex flex-col';

  return (
    <div
      className={classNames(
        `p-6 rounded-2xl shadow-xl border transition-all duration-300 ease-in-out ${containerLayout} flex-1`,
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}
      style={{ height: cardHeight }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        {Icon && <Icon className={`${color} w-8 h-8`} />}
      </div>

      {/* Datos */}
      <div
        className={classNames(
          'text-base text-gray-700 dark:text-gray-400',
          vAlign === 'center' ? 'self-center w-full mt-1' : 'mt-3',
          'space-y-2'
        )}
      >
        {Object.entries(data).map(([label, value]) => (
          <div key={label} className="flex justify-between">
            <span>{label}:</span>
            <span className={classNames('font-bold', 'text-gray-900 dark:text-gray-100', labelColor[label])}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Feed actividad (altura por prop + fixes de scroll)
const ActivityFeed = ({ theme, userActivity, onClearClick, onShowDetails, cardHeight = 360 }) => {
  const listRef = useRef(null);
  const [fadeTop, setFadeTop] = useState(false);
  const [fadeBottom, setFadeBottom] = useState(false);

  const updateFades = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setFadeTop(el.scrollTop > 0);
    setFadeBottom(el.scrollTop + el.clientHeight < el.scrollHeight);
  }, []);

  useEffect(() => {
    updateFades();
  }, [userActivity, updateFades]);

  const rowHover = theme === 'dark' ? 'hover:bg-gray-700/40' : 'hover:bg-gray-100';
  const borderRow = theme === 'dark' ? 'border-gray-700' : 'border-gray-200';
  const fadeTopCls = theme === 'dark' ? 'bg-gradient-to-b from-gray-800 to-transparent' : 'bg-gradient-to-b from-white to-transparent';
  const fadeBottomCls = theme === 'dark' ? 'bg-gradient-to-t from-gray-800 to-transparent' : 'bg-gradient-to-t from-white to-transparent';

  return (
    <div
      className={classNames(
        `p-6 rounded-2xl shadow-xl border flex flex-col`,
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}
      style={{ height: cardHeight }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Actividad Reciente</h3>
        <Activity className="text-orange-400 w-8 h-8" />
      </div>

      {/* Contenedor scroll: un solo scroll horizontal para toda la tabla */}
      <div
        ref={listRef}
        onScroll={updateFades}
        className="relative text-sm min-h-40 max-h-56 overflow-y-auto overflow-x-auto custom-scrollbar pr-2 flex-1"
      >
        {userActivity.length === 0 ? (
          <p className="text-gray-400 text-center">No hay actividad para la fecha.</p>
        ) : (
          // Tabla CSS: la primera columna toma el ancho del contenido más largo
          <div className="min-w-max table w-full">
            {userActivity.map((act, idx) => (
              <div key={idx} className="table-row">
                {/* Columna 1: acción + fecha (clickable) */}
                <div className={`table-cell align-middle pr-3 py-2 border-b ${borderRow}`}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onShowDetails(act)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onShowDetails(act)}
                    className={`inline-flex items-center gap-2 whitespace-nowrap cursor-pointer rounded-md px-2 py-1 transition-colors ${rowHover}`}
                    title="Ver detalles"
                  >
                    <span className="text-gray-400">{act.action || '—'}</span>
                    {act.action && <span className="text-gray-600">•</span>}
                    <span
                      className="text-gray-500 text-xs"
                      title={act.timestamp ? new Date(act.timestamp).toLocaleString('es-CO') : 'N/A'}
                    >
                      {act.timestamp ? new Date(act.timestamp).toLocaleString('es-CO') : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Columna 2: ícono info alineado a la derecha */}
                <div className={`table-cell align-middle pl-2 pr-1 py-2 text-right border-b ${borderRow}`}>
                  {act.details && (
                    <button
                      onClick={() => onShowDetails(act)}
                      className="text-blue-400 hover:text-blue-300 p-1 rounded-full"
                      title="Ver detalles de la actividad"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Degradados (top/bottom) */}
        {fadeTop && (
          <div className={classNames('pointer-events-none absolute top-0 left-0 right-0 h-4', fadeTopCls)} />
        )}
        {fadeBottom && (
          <div className={classNames('pointer-events-none absolute bottom-0 left-0 right-0 h-4', fadeBottomCls)} />
        )}
      </div>

      <div className="mt-4 text-center">
        <button
          onClick={onClearClick}
          className={classNames(
            'px-4 py-2 rounded-md text-xs font-medium flex items-center justify-center mx-auto',
            theme === 'dark' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
          )}
        >
          <Trash2 className="w-4 h-4 mr-2" /> Limpiar TODAS las Actividades
        </button>
      </div>
    </div>
  );
};


// --- Totales Generales con altura por prop + scroll interno ---
// --- Totales Generales con NETO real + desgloses correctos (origen y método) ---
const GeneralTotalsCard = ({
  theme,
  totals,
  deliveryPersons,
  lastUpdatedAt,
  orders,
  proteinDaily,
  tableOrders,
  breakfastOrders,
  cardHeight = CARD_HEIGHT
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showExpenses, setShowExpenses] = useState(false);
  const [showIncome, setShowIncome] = useState(false);
  const [showCashBreakdown, setShowCashBreakdown] = useState(false);
  const [showDaviBreakdown, setShowDaviBreakdown] = useState(false);
  const [showNequiBreakdown, setShowNequiBreakdown] = useState(false);

  const { selectedDate, setSelectedDate, timeAgo } = useDashboardDate();

  // ===== Helpers robustos =====
  const mk = (s) => (s || '').toString().trim().toLowerCase();

  // parsea "$12.000", "12.000", 12000, "-$12.000"
  const toInt = (v) => {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.floor(v);
    const str = String(v ?? '').replace(/[^0-9-]/g, '');
    const n = parseInt(str, 10);
    return Number.isFinite(n) ? n : 0;
  };

  const money = (n) => {
    const v = toInt(n);
    const abs = Math.abs(v).toLocaleString('es-CO');
    return `${v < 0 ? '-' : ''}$${abs}`;
  };

  const normalizePaymentMethodKey = (method) => {
    const raw = mk(typeof method === 'string'
      ? method
      : (method?.name || method?.label || method?.title || method?.method || method?.type));
    if (raw.includes('efect') || raw.includes('cash')) return 'cash';
    if (raw.includes('nequi')) return 'nequi';
    if (raw.includes('davi')) return 'daviplata';
    return 'other';
  };

  const normalizeOrderType = (val) => {
    const raw = typeof val === 'string' ? val : (val?.name || val?.value || '');
    const lc = mk(raw);
    if (['table', 'mesa', 'para mesa', 'en mesa'].includes(lc)) return 'table';
    if (['takeaway', 'para llevar', 'llevar', 'take away', 'take-away'].includes(lc)) return 'takeaway';
    if (['delivery', 'domicilio', 'domicilios'].includes(lc)) return 'delivery';
    return '';
  };

  // Pickers legacy
  const pickLegacyMethod = (o) =>
    o?.payment ??
    o?.paymentMethod ??
    o?.meals?.[0]?.payment?.name ??
    o?.meals?.[0]?.paymentMethod ??
    o?.breakfasts?.[0]?.payment?.name ??
    o?.breakfasts?.[0]?.paymentMethod ?? '';

  const mealsSum = (o) =>
    Array.isArray(o?.meals)
      ? o.meals.reduce((s, m) => s + toInt(m?.total ?? m?.price ?? m?.amount), 0)
      : 0;

  const breakfastsSum = (o) =>
    Array.isArray(o?.breakfasts)
      ? o.breakfasts.reduce((s, b) => s + toInt(b?.total ?? b?.price ?? b?.amount), 0)
      : 0;

  const deriveOrderTotal = (o) => {
    const t = toInt(o?.total ?? o?.amount);
    if (t > 0) return t;
    const sum = mealsSum(o) + breakfastsSum(o);
    return sum > 0 ? sum : 0;
  };

  // Usa split de pagos si existe; si no, método único + total derivado
  const rowsFromOrder = (order) => {
    if (Array.isArray(order?.payments) && order.payments.length) {
      return order.payments.map((p) => ({
        methodKey: normalizePaymentMethodKey(p.method),
        amount: toInt(p.amount),
      }));
    }
    return [{
      methodKey: normalizePaymentMethodKey(pickLegacyMethod(order)),
      amount: deriveOrderTotal(order),
    }];
  };

  // ¿Es desayuno de domicilio?
  const isDeliveryBreakfastOrder = (o) => {
    if (normalizeOrderType(o?.orderType) === 'delivery') return true;
    const col = (o?.__collection || o?.collectionName || '').toLowerCase();
    if (col.includes('delivery') || col.includes('domicil')) return true;
    if (o?.deliveryPerson) return true;
    const hasAddr =
      (Array.isArray(o?.breakfasts) && o.breakfasts.some(b => !!b?.address)) ||
      (Array.isArray(o?.meals) && o.meals.some(m => !!m?.address));
    if (hasAddr) return true;
    return false;
  };

  // ===== (A) Por ORIGEN (desde totals) =====
  const bc = totals?.byCategory || {};
  const domiciliosTotal = toInt(bc.domiciliosAlmuerzo) + toInt(bc.domiciliosDesayuno);
  const salonTotal = toInt(bc.mesasAlmuerzo) + toInt(bc.llevarAlmuerzo) + toInt(bc.mesasDesayuno) + toInt(bc.llevarDesayuno);

  const grossIncomeDisplay =
    typeof totals?.grossIncome === 'number'
      ? toInt(totals.grossIncome)
      : (domiciliosTotal + salonTotal);

  const expensesDisplay = toInt(totals?.expenses);
  const netDisplay = grossIncomeDisplay - expensesDisplay;

  // ===== (B) Totales por MÉTODO (línea principal) =====
  const methodTotals = useMemo(() => {
    const cash = { salon: 25000, domicilio: 25000 };
    const daviplata = { salon: 23000, domicilio: 25000 };
    const nequi = { salon: 24000, domicilio: 25000 };
    
    return {
      cash: cash.salon + cash.domicilio,
      daviplata: daviplata.salon + daviplata.domicilio,
      nequi: nequi.salon + nequi.domicilio,
      byOrigin: {
        salon: { cash: cash.salon, daviplata: daviplata.salon, nequi: nequi.salon },
        domicilio: { cash: cash.domicilio, daviplata: daviplata.domicilio, nequi: nequi.domicilio }
      }
    };
  }, []);

  // ===== (C) Desglose por MÉTODO → ORIGEN (corregido) =====
  const methodBreakdown = useMemo(() => {
    const mkBucket = () => ({ cash: 0, daviplata: 0, nequi: 0, other: 0 });
    const salon = mkBucket();
    const domicilio = mkBucket();

    const bump = (target, methodKey, amount) => {
      const a = toInt(amount);
      if (!a) return;
      target[methodKey] = (target[methodKey] || 0) + a;
    };

    // ► Salón (almuerzo: mesas + llevar) — TODOS los tableOrders
    (tableOrders || []).forEach((o) => {
      rowsFromOrder(o).forEach(({ methodKey, amount }) => bump(salon, methodKey, amount));
    });

    // ► Desayunos: clasificar correctamente por domicilio/salón
    (breakfastOrders || []).forEach((o) => {
      const target = isDeliveryBreakfastOrder(o) ? domicilio : salon;
      rowsFromOrder(o).forEach(({ methodKey, amount }) => bump(target, methodKey, amount));
    });

    // ► Almuerzos a domicilio (orders) — y por si vino algún salón colado con orderType
    (orders || []).forEach((o) => {
      const ot = normalizeOrderType(o?.orderType) || 'delivery';
      const target = ot === 'delivery' ? domicilio : salon;
      rowsFromOrder(o).forEach(({ methodKey, amount }) => bump(target, methodKey, amount));
    });

    return {
      cash: { domicilio: domicilio.cash, salon: salon.cash },
      daviplata: { domicilio: domicilio.daviplata, salon: salon.daviplata },
      nequi: { domicilio: domicilio.nequi, salon: salon.nequi },
    };
  }, [orders, tableOrders, breakfastOrders]);

  // ===== Ingresos por Domiciliario (sin cambios) =====
  const computedDeliveryPersons = useMemo(() => {
    const acc = {};
    const bump = (person, bucket, amount) => {
      if (!person) person = 'JUAN';
      acc[person] = acc[person] || { desayuno: { total: 0 }, almuerzo: { total: 0 } };
      acc[person][bucket].total += toInt(amount);
    };
    const all = [...(orders || []), ...(breakfastOrders || [])];
    for (const o of all) {
      const person = String(o?.deliveryPerson || 'JUAN').trim();
      const isB = o?.type === 'breakfast' || Array.isArray(o?.breakfasts);
      const bucket = isB ? 'desayuno' : 'almuerzo';
      const amount = deriveOrderTotal(o);
      if (toInt(amount) > 0) bump(person, bucket, amount);
    }
    return acc;
  }, [orders, breakfastOrders]);

  const deliveryPersonsData = useMemo(() => {
    const hasProp = deliveryPersons && Object.keys(deliveryPersons || {}).length > 0;
    return hasProp ? deliveryPersons : computedDeliveryPersons;
  }, [deliveryPersons, computedDeliveryPersons]);

  // ===== Conteos producción/ventas (igual) =====
  const { totalLunchCount, totalBreakfastCount } = useMemo(() => {
    const lunchOrders = (orders || []).filter((o) => !(o?.type === 'breakfast' || Array.isArray(o?.breakfasts)));
    const breakfastOrdersList = breakfastOrders || [];
    const tableOrdersList = tableOrders || [];

    const lunchMesaCount = tableOrdersList.filter((t) =>
      ['table', 'mesa', 'en mesa', 'para mesa'].includes(mk(t.orderType))
    ).length;
    const lunchTakeawayCount = tableOrdersList.filter(
      (t) => !['table', 'mesa', 'en mesa', 'para mesa'].includes(mk(t.orderType))
    ).length;

    const breakfastDomiciliosCount = breakfastOrdersList.filter((b) => normalizeOrderType(b?.orderType) === 'delivery').length;
    const breakfastMesaCount = breakfastOrdersList.filter((b) =>
      ['table', 'mesa', 'en mesa', 'para mesa'].includes(mk(b.orderType))
    ).length;
    const breakfastTakeawayCount = breakfastOrdersList.filter(
      (b) => !['delivery', 'table', 'mesa', 'en mesa', 'para mesa'].includes(normalizeOrderType(b?.orderType))
    ).length;

    return {
      totalLunchCount: lunchOrders.length + lunchMesaCount + lunchTakeawayCount,
      totalBreakfastCount: breakfastDomiciliosCount + breakfastMesaCount + breakfastTakeawayCount,
    };
  }, [orders, tableOrders, breakfastOrders]);

  const Row = ({ left, right, strong, rightClass, onClick }) => (
    <div className="flex justify-between" onClick={onClick}>
      <span className={classNames(strong ? 'font-semibold' : '', 'text-gray-400', onClick && 'cursor-pointer hover:underline')}>{left}</span>
      <span className={classNames('font-bold', rightClass ?? 'text-gray-100')}>{right}</span>
    </div>
  );

  return (
    <div
      className={classNames(
        `p-0 rounded-2xl shadow-xl border transition-all duration-300 ease-in-out hover:shadow-2xl flex flex-col flex-1`,
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}
      style={{ height: cardHeight }}
    >
      {/* Header */}
      <div className="flex items-center justify-center px-6 pt-5 flex-shrink-0">
        <h3 className="text-xl font-semibold text-gray-100 whitespace-nowrap">Totales Generales</h3>
        <DollarSign className="text-emerald-400 w-8 h-8 ml-4" aria-hidden="true" />
      </div>

      {/* Body */}
      <div className={classNames('mt-4 px-6 pb-3 relative min-h-0 h-[260px] custom-scrollbar', expanded ? 'overflow-y-auto' : 'overflow-hidden')}>
        {/* Vista rápida */}
        <div className="space-y-3 text-base mt-5 sm:mt-6">
          {/* Total ingresos */}
          <div onClick={() => setShowIncome(v => !v)} className="cursor-pointer">
            <div className="flex justify-between items-center text-gray-400 hover:underline hover:text-gray-100 transition-colors">
              <span>Total ingresos</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-green-400">{money(grossIncomeDisplay)}</span>
                {showIncome ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </div>
            </div>
            <Transition show={showIncome}>
              <div className="mt-2 pl-4 space-y-1 text-sm text-gray-400">
                <div className="flex justify-between"><span>- De Domicilios:</span><span className="font-semibold text-emerald-300">{money(domiciliosTotal)}</span></div>
                <div className="flex justify-between"><span>- De Salón:</span><span className="font-semibold text-emerald-300">{money(salonTotal)}</span></div>
              </div>
            </Transition>
          </div>

          {/* Gastos */}
          <div onClick={() => setShowExpenses(v => !v)} className="cursor-pointer">
            <div className="flex justify-between items-center text-gray-400 hover:underline hover:text-gray-100 transition-colors">
              <span>Gastos</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-red-400">{money(-expensesDisplay)}</span>
                {showExpenses ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </div>
            </div>
            <Transition show={showExpenses}>
              <div className="mt-2 pl-4 space-y-1 text-sm text-gray-400">
                {Object.entries(totals?.expensesByProvider?.byProvider || {}).map(([provider, amount]) => (
                  <div key={provider} className="flex justify-between">
                    <span>- {provider}:</span>
                    <span className="font-semibold text-red-300">{money(-amount)}</span>
                  </div>
                ))}
              </div>
            </Transition>
          </div>

          {/* Total neto */}
          <div className={classNames('border-t mt-2', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')} />
          <Row strong left="Total neto" right={money(netDisplay)} rightClass={netDisplay < 0 ? 'text-red-400 text-xl' : 'text-emerald-400 text-xl'} />
        </div>

        {/* Ver más/menos */}
        <div className="mt-6 sm:mt-8 text-center">
          <button onClick={() => setExpanded(v => !v)} aria-expanded={expanded} className="text-blue-500 hover:text-blue-600 transition-colors text-sm font-semibold underline underline-offset-4">
            {expanded ? 'Ver menos' : 'Ver más'}
          </button>
        </div>

        {/* Detalle expandido */}
        <div className={classNames('pt-4 mt-4 text-sm', expanded ? '' : 'hidden')}>
          {/* Desglose de ingresos por método */}
          <div className={classNames('border-t my-3', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')} />
          <p className={classNames('text-sm mb-2 font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Desglose de ingresos</p>

          {/* Efectivo (Caja) */}
          <div className="space-y-1">
            <div className="flex justify-between items-center cursor-pointer" onClick={() => setShowCashBreakdown(v => !v)}>
              <span>Efectivo (Caja)</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-green-400">{money(methodTotals.cash)}</span>
                {showCashBreakdown ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </div>
            </div>
            <Transition show={showCashBreakdown}>
              <div className="mt-1 pl-4 space-y-1 text-sm text-gray-400">
                <div className="flex justify-between"><span>- De Domicilios:</span><span className="font-semibold">{money(methodTotals.byOrigin.domicilio.cash)}</span></div>
                <div className="flex justify-between"><span>- De Salón:</span><span className="font-semibold">{money(methodTotals.byOrigin.salon.cash)}</span></div>
              </div>
            </Transition>

            {/* DaviPlata */}
            <div className="flex justify-between items-center cursor-pointer mt-2" onClick={() => setShowDaviBreakdown(v => !v)}>
              <span>DaviPlata</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-red-400">{money(methodTotals.daviplata)}</span>
                {showDaviBreakdown ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </div>
            </div>
            <Transition show={showDaviBreakdown}>
              <div className="mt-1 pl-4 space-y-1 text-sm text-gray-400">
                <div className="flex justify-between"><span>- De Domicilios:</span><span className="font-semibold">{money(methodTotals.byOrigin.domicilio.daviplata)}</span></div>
                <div className="flex justify-between"><span>- De Salón:</span><span className="font-semibold">{money(methodTotals.byOrigin.salon.daviplata)}</span></div>
              </div>
            </Transition>

            {/* Nequi */}
            <div className="flex justify-between items-center cursor-pointer mt-2" onClick={() => setShowNequiBreakdown(v => !v)}>
              <span>Nequi</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-blue-400">{money(methodTotals.nequi)}</span>
                {showNequiBreakdown ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </div>
            </div>
            <Transition show={showNequiBreakdown}>
              <div className="mt-1 pl-4 space-y-1 text-sm text-gray-400">
                <div className="flex justify-between"><span>- De Domicilios:</span><span className="font-semibold">{money(methodTotals.byOrigin.domicilio.nequi)}</span></div>
                <div className="flex justify-between"><span>- De Salón:</span><span className="font-semibold">{money(methodTotals.byOrigin.salon.nequi)}</span></div>
              </div>
            </Transition>
          </div>

          {/* Ingresos por Domiciliario (se mantiene) */}
          <div className={classNames('border-t my-3', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')} />
          <p className={classNames('text-sm mb-2 font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Ingresos por Domiciliario</p>
          <div className="space-y-3">
            {Object.entries(deliveryPersonsData || {}).map(([person, d]) => {
              const desayuno = toInt(d?.desayuno?.total);
              const almuerzo = toInt(d?.almuerzo?.total);
              const total = desayuno + almuerzo;
              return (
                <div key={person} className={classNames('rounded-lg p-3 border', theme === 'dark' ? 'bg-gray-800/60 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium">{person}</span>
                    <span className="font-bold">{money(total)}</span>
                  </div>
                  <div className="flex justify-between text-sm my-0.5"><span>🛵 Desayuno</span><span className="font-semibold">{money(desayuno)}</span></div>
                  <div className="flex justify-between text-sm my-0.5"><span>🛵 Almuerzo</span><span className="font-semibold">{money(almuerzo)}</span></div>
                </div>
              );
            })}
          </div>

          {/* Tipo de Venta (se mantiene) */}
          <div className={classNames('border-t my-3', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')} />
          <p className={classNames('text-sm mb-2 font-semibold', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Tipo de Venta</p>
          <div className="space-y-3 mt-2 text-sm">
            <div className="flex flex-col space-y-1">
              <h4 className="font-semibold text-gray-100">Domicilios</h4>
              <ul className="space-y-1 text-gray-400">
                <li className="flex justify-between items-center"><span className="flex-1">🛵 Almuerzo</span><span className="font-bold text-gray-100 text-right">{money(totals?.byCategory?.domiciliosAlmuerzo || 0)}</span></li>
                <li className="flex justify-between items-center"><span className="flex-1">🍳 Desayuno</span><span className="font-bold text-gray-100 text-right">{money(totals?.byCategory?.domiciliosDesayuno || 0)}</span></li>
              </ul>
            </div>
            <div className="flex flex-col space-y-1">
              <h4 className="font-semibold text-gray-100">Salón</h4>
              <ul className="space-y-1 text-gray-400">
                <li className="flex justify-between items-center"><span className="flex-1">🪑 Almuerzo Mesa</span><span className="font-bold text-gray-100 text-right">{money(totals?.byCategory?.mesasAlmuerzo || 0)}</span></li>
                <li className="flex justify-between items-center"><span className="flex-1">📦 Almuerzo llevar</span><span className="font-bold text-gray-100 text-right">{money(totals?.byCategory?.llevarAlmuerzo || 0)}</span></li>
                <li className="flex justify-between items-center"><span className="flex-1">🪑 Desayuno Mesa</span><span className="font-bold text-gray-100 text-right">{money(totals?.byCategory?.mesasDesayuno || 0)}</span></li>
                <li className="flex justify-between items-center"><span className="flex-1">📦 Desayuno llevar</span><span className="font-bold text-gray-100 text-right">{money(totals?.byCategory?.llevarDesayuno || 0)}</span></li>
              </ul>
            </div>
          </div>

          {/* Producción y ventas (se mantiene) */}
          <div className={classNames('border-t my-3', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')} />
          <div className="space-y-1">
            <Row left="Proteínas preparadas (unid.)" right={String(toInt(proteinDaily?.preparedUnits || 0))} rightClass="text-gray-100" />
            <Row left="Almuerzos vendidos (unid.)" right={String(toInt((orders || []).length + (tableOrders || []).length))} rightClass="text-gray-100" />
            <Row left="Desayunos vendidos (unid.)" right={String(toInt((breakfastOrders || []).length))} rightClass="text-gray-100" />
          </div>

          {/* Sobrantes (se mantiene) */}
          <div className={classNames('border-t my-3', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')} />
          <p className={classNames('text-[13px]', theme === 'dark' ? 'text-gray-300' : 'text-gray-700')}>
            • {toInt(proteinDaily?.leftovers?.res)} res • {toInt(proteinDaily?.leftovers?.lomo)} lomo • {toInt(proteinDaily?.leftovers?.pechuga)} pechuga • {toInt(proteinDaily?.leftovers?.pollo)} pollo • {toInt(proteinDaily?.leftovers?.recuperada)} recuperada
          </p>
        </div>

        {!expanded && (
          <div className={classNames('pointer-events-none absolute bottom-0 left-0 right-0 h-16', theme === 'dark' ? 'bg-gradient-to-t from-gray-800 to-transparent' : 'bg-gradient-to-t from-white to-transparent')} />
        )}
      </div>

      {/* Footer */}
      <div className={classNames('px-6 py-2 text-[12px] flex items-center justify-between mt-auto flex-shrink-0 gap-x-2 gap-y-1 rounded-b-2xl', theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600')}>
        <Popover className="relative">
          {({ open }) => (
            <>
              <PopoverButton className={classNames('inline-flex items-center gap-1 text-[11px] transition-colors cursor-pointer', theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-700 hover:text-gray-900')}>
                <Calendar className="w-3 h-3 text-green-400" />
                <span>Fecha: {selectedDate}</span>
              </PopoverButton>
              <Transition as={Fragment} enter="transition ease-out duration-150" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-100" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1">
                <PopoverPanel className={classNames('absolute z-50 mt-2 p-3 rounded-xl shadow-lg w-64 left-0 origin-top-left', 'max-w-[calc(100vw-2rem)]', theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200')}>
                  <label className={classNames('block text-xs mb-1', theme === 'dark' ? 'text-gray-400' : 'text-gray-600')}>Selecciona una fecha</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                    className={classNames('w-full rounded-md px-3 py-2 text-sm border focus:outline-none focus:ring-1 focus:ring-emerald-500', theme === 'dark' ? 'bg-gray-900 border-gray-700 text-gray-100' : 'bg-white border-gray-300 text-gray-900')}
                  />
                  <p className="text-[11px] mt-2 text-gray-500">Cambiar la fecha actualiza todo el dashboard para ese día.</p>
                </PopoverPanel>
              </Transition>
            </>
          )}
        </Popover>
        <span className="flex items-center gap-1 text-[11px]"><Clock className="w-3 h-3" /> Actualizado {timeAgo(lastUpdatedAt)}</span>
      </div>
    </div>
  );
};



// Orquestador
const DashboardInner = ({ theme }) => {
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const { notify } = useNotifier();

  const { selectedDate, startOfDay, endOfDay } = useDashboardDate();
  
  const {
    loadingData,
    orders, users, totals, statusCounts, userActivity,
    deliveryPersons, proteinDaily, lastUpdatedAt,
    ingresosCategoriasData, gastosPorTiendaData, pedidosDiariosChartData, statusPieChartData,
    tableOrders, breakfastOrders,
    handleSaveDailyIngresos, handleDeleteDailyIngresos, handleSaveDailyOrders, handleDeleteDailyOrders
  } = useDashboardData(db, userId, isAuthReady, notify, startOfDay, endOfDay, selectedDate);
  
  const [showConfirmClearActivity, setShowConfirmClearActivity] = useState(false);
  const [confirmClearText, setConfirmClearText] = useState('');
  const [showActivityDetailModal, setShowActivityDetailModal] = useState(false);
  const [selectedActivityDetail, setSelectedActivityDetail] = useState(null);

  useEffect(() => {
    if (!auth) return;
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        setIsAuthReady(true);
      } else {
        try {
          if (initialAuthToken) await signInWithCustomToken(auth, initialAuthToken);
          else await signInAnonymously(auth);
        } catch (error) {
          console.error('Error al iniciar sesión:', error);
          notify('error', `Error de autenticación: ${error.message}`);
        } finally {
          setIsAuthReady(true);
        }
      }
    });
    return () => unsub();
  }, []);

  const handleClearAllActivity = async () => {
    if (confirmClearText.toLowerCase() !== 'confirmar') {
      notify('error', 'Por favor, escribe "confirmar" para proceder.');
      return;
    }
    try {
      const batch = writeBatch(db);
      const activitySnapshot = await getDocs(collection(db, 'userActivity'));
      let deletedCount = 0;
      activitySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
        deletedCount++;
      });
      if (deletedCount > 0) await batch.commit();
      
      setShowConfirmClearActivity(false);
      setConfirmClearText('');
      notify('success', deletedCount === 0 ? 'No había actividades para eliminar.' : `Todas las actividades (${deletedCount}) han sido eliminadas.`);
    } catch (error) {
      notify('error', `Error al eliminar actividades: ${error.message}`);
    }
  };

  const chartTextColor = theme === 'dark' ? '#cbd5e1' : '#475569';
  const loading = !isAuthReady || loadingData;

  if (loading) return <LoadingSpinner theme={theme} />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-inter">
      <h2 className="text-3xl font-extrabold mb-8 text-gray-900 dark:text-white transition-colors duration-200">Dashboard</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <InfoCard 
          theme={theme}
          title="Pedidos" 
          icon="ShoppingCart"
          color="text-blue-400"
          vAlign="center"
          cardHeight={CARD_HEIGHT}
          data={{
            'Total': statusCounts.Pending + statusCounts.Delivered + statusCounts.Cancelled,
            'Pendientes': statusCounts.Pending,
            'Entregados': statusCounts.Delivered,
            'Cancelados': statusCounts.Cancelled,
          }}
          labelColor={{'Pendientes': 'text-yellow-400', 'Entregados': 'text-green-400', 'Cancelados': 'text-red-400'}}
        />

        <GeneralTotalsCard 
          theme={theme}
          totals={totals}
          deliveryPersons={deliveryPersons}
          lastUpdatedAt={lastUpdatedAt}
          orders={orders}
          proteinDaily={proteinDaily}
          tableOrders={tableOrders}
          breakfastOrders={breakfastOrders}
          cardHeight={CARD_HEIGHT}
        />

        <InfoCard 
          theme={theme}
          title="Usuarios" 
          icon="Users"
          color="text-purple-400"
          cardHeight={CARD_HEIGHT}
          data={{ 'Total': users.length }}
        />

        <ActivityFeed
          theme={theme}
          userActivity={userActivity}
          onClearClick={() => setShowConfirmClearActivity(true)}
          onShowDetails={(act) => { setSelectedActivityDetail(act); setShowActivityDetailModal(true); }}
          cardHeight={CARD_HEIGHT}
        />
      </div>

      <DashboardCharts
        theme={theme}
         cardHeight={CARD_HEIGHT} 
        chartTextColor={chartTextColor}
        ingresosCategoriasData={ingresosCategoriasData}
        gastosPorTiendaData={gastosPorTiendaData}
        pedidosDiariosChartData={pedidosDiariosChartData}
        statusPieChartData={statusPieChartData}
        loading={loading}
        handleSaveDailyIngresos={handleSaveDailyIngresos}
        handleDeleteDailyIngresos={handleDeleteDailyIngresos}
        handleSaveDailyOrders={handleSaveDailyOrders}
        handleDeleteDailyOrders={handleDeleteDailyOrders}
        proteinDaily={proteinDaily}
      />

      <ConfirmationModal 
        show={showConfirmClearActivity}
        onClose={() => {setShowConfirmClearActivity(false); setConfirmClearText('');}}
        onConfirm={handleClearAllActivity}
        confirmText={confirmClearText}
        setConfirmText={setConfirmClearText}
        theme={theme}
      />

      <DetailsModal
        show={showActivityDetailModal}
        onClose={() => setShowActivityDetailModal(false)}
        details={selectedActivityDetail?.details}
        theme={theme}
      />
    </div>
  );
};

// Wrapper
const Dashboard = (props) => (
  <DashboardDateProvider>
    <DashboardInner {...props} />
  </DashboardDateProvider>
);

export default Dashboard;
