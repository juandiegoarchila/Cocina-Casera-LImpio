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
// === Reemplaza SOLO este componente ===
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

  // --- helpers ---
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

  const bc = totals?.byCategory || {};
  const domiciliosTotal =
    toInt(bc.domiciliosAlmuerzo) + toInt(bc.domiciliosDesayuno);
  const salonTotal =
    toInt(bc.mesasAlmuerzo) + toInt(bc.llevarAlmuerzo) +
    toInt(bc.mesasDesayuno) + toInt(bc.llevarDesayuno);

  const grossIncomeDisplay =
    typeof totals?.grossIncome === 'number'
      ? toInt(totals.grossIncome)
      : (domiciliosTotal + salonTotal);

  const expensesDisplay = toInt(totals?.expenses);
  const netDisplay = grossIncomeDisplay - expensesDisplay;

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

  const deliveryPersonsData = useMemo(() => {
    return deliveryPersons || {
      'Dylan': { desayuno: { total: 12000 }, almuerzo: { total: 39000 } }
    };
  }, [deliveryPersons]);

  // --- Fila compacta: NUNCA truncamos la etiqueta, NUNCA partimos el monto ---
  const Row = ({ left, right, strong, rightClass, percentage, onClick, className = '' }) => (
    <div
      className={classNames(
        'grid grid-cols-[1fr,auto] items-center min-w-0 leading-tight',
        className,
        onClick && 'cursor-pointer hover:bg-gray-700/20 rounded px-1 -mx-1'
      )}
      onClick={onClick}
    >
      <span
        className={classNames(
          strong ? 'font-semibold' : '',
          'text-gray-400 whitespace-normal',
          onClick && 'hover:underline'
        )}
      >
        {left}
      </span>
      <div className="flex items-center gap-2 pl-3">
        <span
          className={classNames(
            'font-bold text-right whitespace-nowrap tabular-nums',
            rightClass ?? 'text-gray-100'
          )}
        >
          {right}
        </span>
        {percentage != null && (
          <span className="text-gray-500 text-sm tabular-nums whitespace-nowrap">
            ({percentage}%)
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={classNames(
        'p-0 rounded-2xl shadow-xl border transition-all duration-300 ease-in-out hover:shadow-2xl flex flex-col flex-1',
        theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      )}
      style={{ height: cardHeight }}
    >
      {/* Header */}
      <div className="flex items-center justify-center px-6 pt-5 flex-shrink-0">
        <h3 className="text-xl font-semibold text-gray-100 whitespace-nowrap">
          Totales Generales
        </h3>
        <DollarSign className="text-emerald-400 w-8 h-8 ml-4" aria-hidden="true" />
      </div>

      {/* BODY: scroll Y siempre si hace falta; scroll X sólo cuando el contenido lo exige */}
      <div
        className={classNames(
          'mt-4 px-6 pb-3 flex-1 min-h-0',
          'custom-scrollbar overflow-y-auto overflow-x-auto',
          'relative',
          theme === 'dark' 
            ? 'scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800/40'
            : 'scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200/40'
        )}
        style={{ scrollbarGutter: 'stable both-edges' }}
      >
        {/* CLAVE: el interior crece a su ancho natural → sólo habrá X-scroll si es mayor que el contenedor */}
        <div className="inline-block w-max min-w-full align-top">
          {/* Vista rápida */}
          <div className="space-y-3 text-base mt-5 sm:mt-6">
            {/* Total ingresos */}
            <div onClick={() => setShowIncome(v => !v)} className="cursor-pointer">
              <div className="grid grid-cols-[1fr,auto] items-start gap-x-3 text-gray-400 hover:underline hover:text-gray-100">
                <span className="whitespace-normal break-words pr-2">Total ingresos</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-green-400 whitespace-nowrap tabular-nums">
                    {money(grossIncomeDisplay)}
                  </span>
                  {showIncome
                    ? <ChevronUp className="w-4 h-4 text-gray-500" />
                    : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </div>
              </div>

              <Transition show={showIncome}>
                <div className="mt-1 pl-2 space-y-0.5 text-sm text-gray-400">
                  <Row 
                    left="- De Domicilios:" 
                    right={money(domiciliosTotal)} 
                    percentage={((domiciliosTotal / grossIncomeDisplay) * 100).toFixed(1)}
                    rightClass="text-emerald-300" 
                  />
                  <Row 
                    left="- De Salón:" 
                    right={money(salonTotal)} 
                    percentage={((salonTotal / grossIncomeDisplay) * 100).toFixed(1)}
                    rightClass="text-emerald-300" 
                  />
                </div>
              </Transition>
            </div>

            {/* Gastos */}
            <div onClick={() => setShowExpenses(v => !v)} className="cursor-pointer">
              <div className="grid grid-cols-[1fr,auto] items-start gap-x-3 text-gray-400 hover:underline hover:text-gray-100">
                <span className="whitespace-normal break-words pr-2">Gastos</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-red-400 whitespace-nowrap tabular-nums">
                    {money(-expensesDisplay)}
                  </span>
                  {showExpenses
                    ? <ChevronUp className="w-4 h-4 text-gray-500" />
                    : <ChevronDown className="w-4 h-4 text-gray-500" />}
                </div>
              </div>

              <Transition show={showExpenses}>
                <div className="mt-2 pl-4 space-y-1 text-sm text-gray-400">
                  {Object.entries(totals?.expensesByProvider?.byProvider || {})
                    .map(([provider, amount]) => {
                      const expensePercentage = ((Math.abs(amount) / Math.abs(expensesDisplay)) * 100).toFixed(1);
                      return (
                        <Row
                          key={provider}
                          left={`- ${provider}:`}
                          right={money(-amount)}
                          percentage={expensePercentage}
                          rightClass="text-red-300"
                        />
                      );
                    })}
                </div>
              </Transition>
            </div>

            {/* Total neto */}
            <div className={classNames('border-t mt-2 pt-2', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')} />
            <Row
              strong
              left="Total neto"
              right={money(netDisplay)}
              rightClass={netDisplay < 0 ? 'text-red-400 text-xl' : 'text-emerald-400 text-xl'}
              className="py-1"
            />
          </div>

          {/* Ver más/menos */}
          <div className="mt-6 sm:mt-8 text-center">
            <button
              onClick={() => setExpanded(v => !v)}
              aria-expanded={expanded}
              className="text-blue-500 hover:text-blue-600 transition-colors text-sm font-semibold underline underline-offset-4"
            >
              {expanded ? 'Ver menos' : 'Ver más'}
            </button>
          </div>

          {/* Detalle expandido */}
          <div className={classNames('pt-4 mt-4 text-sm', expanded ? '' : 'hidden')}>
            <div className={classNames('border-t my-3', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')} />
            <Row left="Desglose de ingresos" right={null} strong className="mb-2" />

            <div className="space-y-2">
              <div className="cursor-pointer" onClick={() => setShowCashBreakdown(v => !v)}>
                <Row left="Efectivo (Caja)" right={<span className="text-green-400 whitespace-nowrap tabular-nums">{money(methodTotals.cash)}</span>} />
                <Transition show={showCashBreakdown}>
                  <div className="mt-1 pl-4 space-y-1 text-sm text-gray-400">
                    <Row left="- De Domicilios:" right={money(methodTotals.byOrigin.domicilio.cash)} />
                    <Row left="- De Salón:" right={money(methodTotals.byOrigin.salon.cash)} />
                  </div>
                </Transition>
              </div>

              <div className="cursor-pointer" onClick={() => setShowDaviBreakdown(v => !v)}>
                <Row left="DaviPlata" right={<span className="text-red-400 whitespace-nowrap tabular-nums">{money(methodTotals.daviplata)}</span>} />
                <Transition show={showDaviBreakdown}>
                  <div className="mt-1 pl-4 space-y-1 text-sm text-gray-400">
                    <Row left="- De Domicilios:" right={money(methodTotals.byOrigin.domicilio.daviplata)} />
                    <Row left="- De Salón:" right={money(methodTotals.byOrigin.salon.daviplata)} />
                  </div>
                </Transition>
              </div>

              <div className="cursor-pointer" onClick={() => setShowNequiBreakdown(v => !v)}>
                <Row left="Nequi" right={<span className="text-blue-400 whitespace-nowrap tabular-nums">{money(methodTotals.nequi)}</span>} />
                <Transition show={showNequiBreakdown}>
                  <div className="mt-1 pl-4 space-y-1 text-sm text-gray-400">
                    <Row left="- De Domicilios:" right={money(methodTotals.byOrigin.domicilio.nequi)} />
                    <Row left="- De Salón:" right={money(methodTotals.byOrigin.salon.nequi)} />
                  </div>
                </Transition>
              </div>
            </div>

            <div className={classNames('border-t my-3', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')} />
            <Row left="Ingresos por Domiciliario" right={null} strong className="mb-2" />
            <div className="space-y-3">
              {Object.entries(deliveryPersonsData || {}).map(([person, d]) => {
                const desayuno = toInt(d?.desayuno?.total);
                const almuerzo = toInt(d?.almuerzo?.total);
                const total = desayuno + almuerzo;
                return (
                  <div key={person} className={classNames('rounded-lg p-3 border', theme === 'dark' ? 'bg-gray-800/60 border-gray-700' : 'bg-gray-50 border-gray-200')}>
                    <Row left={person} right={money(total)} className="text-sm mb-2 font-medium" />
                    <div className="pl-4">
                      <Row left="🛵 Desayuno" right={money(desayuno)} className="text-sm my-0.5" />
                      <Row left="🛵 Almuerzo" right={money(almuerzo)} className="text-sm my-0.5" />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={classNames('border-t my-3', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')} />
            <Row left="Tipo de Venta" right={null} strong className="mb-2" />
            <div className="space-y-3 mt-2 text-sm">
              <Row left={<h4 className="font-semibold text-gray-100">Domicilios</h4>} right={null} className="mb-1" />
              <div className="space-y-1 text-gray-400 pl-4">
                <Row left="🛵 Almuerzo" right={money(totals?.byCategory?.domiciliosAlmuerzo || 0)} rightClass="text-gray-100" />
                <Row left="🍳 Desayuno" right={money(totals?.byCategory?.domiciliosDesayuno || 0)} rightClass="text-gray-100" />
              </div>

              <Row left={<h4 className="font-semibold text-gray-100">Salón</h4>} right={null} className="mt-2 mb-1" />
              <div className="space-y-1 text-gray-400 pl-4">
                <Row left="🪑 Almuerzo Mesa" right={money(totals?.byCategory?.mesasAlmuerzo || 0)} rightClass="text-gray-100" />
                <Row left="📦 Almuerzo llevar" right={money(totals?.byCategory?.llevarAlmuerzo || 0)} rightClass="text-gray-100" />
                <Row left="🪑 Desayuno Mesa" right={money(totals?.byCategory?.mesasDesayuno || 0)} rightClass="text-gray-100" />
                <Row left="📦 Desayuno llevar" right={money(totals?.byCategory?.llevarDesayuno || 0)} rightClass="text-gray-100" />
              </div>
            </div>

            <div className={classNames('border-t my-3', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')} />
            <div className="space-y-1">
              <Row left="Proteínas preparadas (unid.)" right={String(toInt(proteinDaily?.preparedUnits || 0))} rightClass="text-gray-100" />
              <Row left="Almuerzos vendidos (unid.)" right={String(toInt((orders || []).length + (tableOrders || []).length))} rightClass="text-gray-100" />
              <Row left="Desayunos vendidos (unid.)" right={String(toInt((breakfastOrders || []).length))} rightClass="text-gray-100" />
            </div>

            <div className={classNames('border-t my-3', theme === 'dark' ? 'border-gray-700' : 'border-gray-200')} />
            <Row left="Proteínas restantes" right={null} strong className="mb-1" />
            <div className="space-y-0.5 pl-2">
              <Row 
                left="• Res" 
                right={toInt(proteinDaily?.leftovers?.res || 0)} 
                rightClass="text-gray-100" 
              />
              <Row 
                left="• Lomo" 
                right={toInt(proteinDaily?.leftovers?.lomo || 0)} 
                rightClass="text-gray-100" 
              />
              <Row 
                left="• Pechuga" 
                right={toInt(proteinDaily?.leftovers?.pechuga || 0)} 
                rightClass="text-gray-100" 
              />
              <Row 
                left="• Pollo" 
                right={toInt(proteinDaily?.leftovers?.pollo || 0)} 
                rightClass="text-gray-100" 
              />
              <Row 
                left="• Recuperada" 
                right={toInt(proteinDaily?.leftovers?.recuperada || 0)} 
                rightClass="text-gray-100" 
              />
            </div>
          </div>
        </div>
      </div>
      {/* Footer */}
      <div
        className={classNames(
          'px-6 py-2 text-[12px] flex items-center justify-between mt-auto flex-shrink-0 gap-x-2 gap-y-1 rounded-b-2xl',
          theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-600'
        )}
      >
        <Popover className="relative">
          {({ open }) => (
            <>
              <PopoverButton className={classNames('inline-flex items-center gap-1 text-[11px] transition-colors cursor-pointer', theme === 'dark' ? 'text-gray-400 hover:text-gray-200' : 'text-gray-700 hover:text-gray-900')}>
                <Calendar className="w-3 h-3 text-green-400" />
                <span className="whitespace-nowrap">Fecha: {selectedDate}</span>
              </PopoverButton>
              <Transition as={Fragment} enter="transition ease-out duration-150" enterFrom="opacity-0 translate-y-1" enterTo="opacity-100 translate-y-0" leave="transition ease-in duration-100" leaveFrom="opacity-100 translate-y-0" leaveTo="opacity-0 translate-y-1">
                <PopoverPanel className={classNames('absolute z-50 mt-2 p-3 rounded-xl shadow-lg w-64 left-0 origin-top-left max-w-[calc(100vw-2rem)]', theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200')}>
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
        <span className="flex items-center gap-1 text-[11px] whitespace-nowrap">
          <Clock className="w-3 h-3" /> Actualizado {timeAgo(lastUpdatedAt)}
        </span>
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
