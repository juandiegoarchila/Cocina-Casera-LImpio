// src/hooks/useDashboardData.js
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  Timestamp,
  getDocs,
  addDoc,
  orderBy,
  updateDoc,
  doc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ORDER_STATUS,
  ORDER_STATUS_DISPLAY,
  PIE_COLORS,
  INGRESOS_COLLECTION,
  PEDIDOS_DIARIOS_GUARDADOS_COLLECTION,
} from '../components/Admin/dashboardConstants';
import { calcMethodTotalsAll } from '../utils/payments';
import { getColombiaLocalDateString } from '../utils/bogotaDate';

/* ============================
   Helpers de fechas / formato
   ============================ */

const getDateRange = (rangeType, start, end) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let startDate = new Date(today);
  let endDate = new Date(today);
  endDate.setHours(23, 59, 59, 999);

  switch (rangeType) {
    case '7_days':
      startDate.setDate(today.getDate() - 6);
      break;
    case '30_days':
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'year':
      startDate = new Date(today.getFullYear(), 0, 1);
      endDate = new Date(today.getFullYear(), 11, 31);
      endDate.setHours(23, 59, 59, 999);
      break;
    case 'custom':
      startDate = start ? new Date(start) : null;
      if (startDate) startDate.setHours(0, 0, 0, 0);
      endDate = end ? new Date(end) : null;
      if (endDate) endDate.setHours(23, 59, 59, 999);
      break;
    default:
      startDate.setDate(today.getDate() - 6);
      break;
  }
  return { startDate, endDate };
};

// Normaliza fecha de docs con createdAtLocal / createdAt / timestamp / date → "YYYY-MM-DD"
const getDocDateISO = (doc) => {
  // Prioridad a createdAtLocal si existe (ya viene como string ISO local del negocio)
  if (typeof doc?.createdAtLocal === 'string' && doc.createdAtLocal.length >= 10) {
    return doc.createdAtLocal.split('T')[0];
  }
  const ts = doc?.createdAt || doc?.timestamp || doc?.date;
  const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
  return d ? d.toISOString().split('T')[0] : null;
};

/* ======================================
   Normalización de servicio y de comida
   ====================================== */

const _asStr = (val) => {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object') {
    return String(val.name ?? val.value ?? val.label ?? '').trim();
  }
  return '';
};

// ¿Es un pedido de desayuno?
const isBreakfastOrder = (o) => {
  // Señales directas
  if (o?.isBreakfast) return true;
  if (_asStr(o?.meal).toLowerCase() === 'breakfast') return true;
  if (Array.isArray(o?.breakfasts) && o.breakfasts.length > 0) return true;

  // Señales derivadas (por si la estructura varía)
  const maybeBreakfastStrs = [
    _asStr(o?.type),
    _asStr(o?.category),
    _asStr(o?.group),
    _asStr(o?.tag),
  ]
    .concat(
      Array.isArray(o?.items)
        ? o.items.map((it) => _asStr(it?.category ?? it?.type))
        : []
    )
    .join(' ')
    .toLowerCase();

  if (maybeBreakfastStrs.includes('desayun') || maybeBreakfastStrs.includes('breakfast')) return true;

  return false;
};

// Devuelve 'mesa' | 'llevar' | 'domicilio' | null
const normalizeServiceFromOrder = (o) => {
  // Si la colección indica delivery (incluye desayuno delivery), forzamos 'domicilio'
  if (o?.__collection && o.__collection.toLowerCase().includes('delivery')) {
    return 'domicilio';
  }
  const candidates = [
    o?.orderTypeNormalized,
    o?.serviceType,
    o?.orderType,
    o?.channel,
    o?.tipoPedido,
    o?.typeOfOrder,
    // anidados frecuentes
    o?.meals?.[0]?.orderType,
    o?.breakfasts?.[0]?.orderType,
  ];

  for (const c of candidates) {
    const v = _asStr(c).toLowerCase();
    if (!v) continue;
    if (/mesa|table|sal[oó]n|dine/.test(v)) return 'mesa';
    if (/llevar|para\s*llevar|take(?:-|\s)?away|to-?go|takeout/.test(v)) return 'llevar';
    if (/domicil|deliver|env[ií]o/.test(v)) return 'domicilio';
  }

  // Heurísticas
  // Primero verificar si tableNumber es "llevar"
  const tableValue = _asStr(o?.tableNumber || o?.mesa || o?.table).toLowerCase();
  if (tableValue === 'llevar') return 'llevar';
  if (o?.tableNumber || o?.mesa || o?.table) return 'mesa';
  if (o?.address?.address || o?.deliveryAddress) return 'domicilio';
  // Heurística adicional para desayunos con dirección anidada
  if (o?.breakfasts?.[0]?.address?.address) return 'domicilio';
  if (Array.isArray(o?.breakfasts) && o.breakfasts.length) {
    const addr = o.breakfasts[0]?.address;
    if (addr && (addr.address || addr.phoneNumber || addr.neighborhood)) return 'domicilio';
  }

  return null;
};

// Agregador genérico por tipo de venta (usa normalizadores)
const buildSaleTypeBreakdown = (orders = []) => {
  const acc = {
    domicilio_almuerzo: 0,
    domicilio_desayuno: 0,
    mesa_almuerzo: 0,
    llevar_almuerzo: 0,
    mesa_desayuno: 0,
    llevar_desayuno: 0,
  };

  for (const o of orders) {
    const total = Number(o?.total) || 0;
    if (total <= 0) continue;

    const kind = isBreakfastOrder(o) ? 'desayuno' : 'almuerzo';
    const service = normalizeServiceFromOrder(o);
    if (!service) continue;

    if (service === 'domicilio') acc[`domicilio_${kind}`] += total;
    else if (service === 'mesa') acc[`mesa_${kind}`] += total;
    else if (service === 'llevar') acc[`llevar_${kind}`] += total;
  }

  return acc;
};

/* ============================
   Hook principal
   ============================ */

export const useDashboardData = (
  db,
  userId,
  isAuthReady,
  p4, // notify ó setError
  p5, // startOfDay ó setSuccess
  p6, // endOfDay ó salesFilterRange
  p7, // selectedDate ó salesCustomStartDate
  p8, // ordersFilterRange
  p9, // ordersCustomStartDate
  p10, // ordersCustomEndDate
  p11, // selectedMonth
) => {
  // Compatibilidad con ambas firmas:
  let notify = null;
  let setError = null;
  let setSuccess = null;
  let startOfDay = null;
  let endOfDay = null;
  let selectedDate = null;

  // Parámetros “viejos” de gráficos (si los usas):
  let salesFilterRange = '7_days';
  let salesCustomStartDate = null;
  let salesCustomEndDate = null;
  let ordersFilterRange = '7_days';
  let ordersCustomStartDate = null;
  let ordersCustomEndDate = null;
  let selectedMonth = null;

  if (typeof p4 === 'function') {
    // NUEVA firma: (db, userId, isAuthReady, notify, startOfDay, endOfDay, selectedDate)
    notify = p4;
    setError = (m) => notify?.('error', m);
    setSuccess = (m) => notify?.('success', m);
    startOfDay = p5 || null;
    endOfDay = p6 || null;
    selectedDate = p7 || null;
  } else {
    // FIRMA ANTIGUA
    setError = p4;
    setSuccess = p5;
    salesFilterRange = p6 ?? salesFilterRange;
    salesCustomStartDate = p7 ?? null;
    salesCustomEndDate = p8 ?? null;
    ordersFilterRange = p9 ?? ordersFilterRange;
    ordersCustomStartDate = p10 ?? null;
    ordersCustomEndDate = p11 ?? null;
    selectedMonth = arguments.length >= 12 ? arguments[11] : null;
    notify = null;
    startOfDay = null;
    endOfDay = null;
    selectedDate = null;
  }

  const [loadingData, setLoadingData] = useState(true);
  const [orders, setOrders] = useState([]);            // Domicilios almuerzo
  const [clientOrders, setClientOrders] = useState([]); // Domicilios almuerzo (clientOrders)
  const [tableOrders, setTableOrders] = useState([]);  // Salón (mesa/llevar) — puede haber desayuno/almuerzo
  const [waiterOrders, setWaiterOrders] = useState([]); // Salón (mesa/llevar) creados por mesero
  const [breakfastOrders, setBreakfastOrders] = useState([]); // deliveryBreakfastOrders
  const [breakfastSalonOrders, setBreakfastSalonOrders] = useState([]); // ⬅️ desayunos de salón (colección 'breakfastOrders')
  const [users, setUsers] = useState([]);

  const [totals, setTotals] = useState({
    cash: 0,
    cashCaja: 0,
    cashPendiente: 0,
    daviplata: 0,
    nequi: 0,
    expenses: 0,
    expensesByProvider: { total: 0, byProvider: {}, counts: {} },
    byCategory: {
      domiciliosAlmuerzo: 0,
      mesasAlmuerzo: 0,
      llevarAlmuerzo: 0,
      domiciliosDesayuno: 0,
      mesasDesayuno: 0,
      llevarDesayuno: 0,
    },
    grossIncome: 0,
    net: 0,
  });

  const [saleTypeBreakdown, setSaleTypeBreakdown] = useState({
    domicilio_almuerzo: 0,
    domicilio_desayuno: 0,
    mesa_almuerzo: 0,
    llevar_almuerzo: 0,
    mesa_desayuno: 0,
    llevar_desayuno: 0,
  });

  const [statusCounts, setStatusCounts] = useState({ Pending: 0, Delivered: 0, Cancelled: 0 });
  const [userActivity, setUserActivity] = useState([]);
  const [ingresosData, setIngresosData] = useState([]);
  const [pedidosDiariosGuardadosData, setPedidosDiariosGuardadosData] = useState([]);
  const [dailySalesChartData, setDailySalesChartData] = useState([]);
  const [dailyOrdersChartData, setDailyOrdersChartData] = useState([]);
  const [statusPieChartData, setStatusPieChartData] = useState([]);
  // Guardadas las fechas ya backfilleadas en esta sesión para no escribir repetido
  const backfilledDatesRef = useRef(new Set());

  

  /* =====================================================
     Agregaciones estructuradas para vistas: Hoy / 7d / Mes / Año
     ===================================================== */
  const sevenCategoryKeys = ['domiciliosAlmuerzo','domiciliosDesayuno','mesasAlmuerzo','llevarAlmuerzo','mesasDesayuno','llevarDesayuno','gastos'];

  // Mapa de gastos por día (a partir de payments listener más abajo). Añadimos listener aquí ligero.
  const [paymentsRaw, setPaymentsRaw] = useState([]);
  // Todos los pagos (sin filtrar por selectedDate) para gráficos de rangos amplios
  const [paymentsAllRaw, setPaymentsAllRaw] = useState([]);

  // Cálculo de gastos por día
  const expensesByDay = useMemo(()=>{
    const map = {};
    paymentsRaw.forEach(p => {
      const ts = p.timestamp;
      if(!ts) return;
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      if(!d) return;
      d.setHours(0,0,0,0);
      const iso = d.toISOString().split('T')[0];
      const amt = Number(p.amount||0);
      map[iso] = (map[iso]||0) + (amt>0?amt:0);
    });
    return map;
  },[paymentsRaw]);

  // Helper: sumar categorías de un registro histórico
  const sumHistCategories = (c={}) => (
    Number(c.domiciliosAlmuerzo||0)+Number(c.domiciliosDesayuno||0)+Number(c.mesasAlmuerzo||0)+Number(c.mesasDesayuno||0)+Number(c.llevarAlmuerzo||0)+Number(c.llevarDesayuno||0)
  );

  // Construir índice de históricos por día actual (solo fecha -> categorías)
  const historicIndex = useMemo(()=>{
    const idx = {};
    ingresosData.forEach(r => {
      if(!r?.date) return;
      const d = new Date(r.date);
      if(isNaN(d)) return;
      const iso = d.toISOString().split('T')[0];
      idx[iso] = { ...(r.categories||{}) };
    });
    return idx;
  },[ingresosData]);

  // Realtime builder para un día (si no hay histórico o es hoy abierto)
  const buildRealtimeDay = useCallback((isoDate) => {
    const dateObj = new Date(isoDate);
    if (isNaN(dateObj)) return null;
    const isCancelled = (o) => (o?.status || '').toLowerCase().includes('cancel');
    const inDay = (o) => {
      const dISO = getDocDateISO(o);
      return dISO === isoDate;
    };

    const cat = {
      domiciliosAlmuerzo: 0,
      domiciliosDesayuno: 0,
      mesasAlmuerzo: 0,
      llevarAlmuerzo: 0,
      mesasDesayuno: 0,
      llevarDesayuno: 0,
    };

    // Domicilios (orders + clientOrders) — fusionar sin duplicar y clasificar desayuno/almuerzo
    const mergedDelivery = [...orders];
    (clientOrders || []).forEach((o) => {
      if (!mergedDelivery.find((x) => x.id === o.id)) mergedDelivery.push(o);
    });
    mergedDelivery
      .filter((o) => !isCancelled(o) && inDay(o))
      .forEach((o) => {
        const amount = Number(o.total || 0);
        if (amount <= 0) return;
        const esDes = isBreakfastOrder(o);
        const serv = normalizeServiceFromOrder(o) || 'domicilio';
        if (serv !== 'domicilio') {
          // Seguridad: estos deberían ser domicilios; si no, reubicar por servicio detectado
          if (esDes) {
            if (serv === 'mesa') cat.mesasDesayuno += amount;
            else if (serv === 'llevar') cat.llevarDesayuno += amount;
            else cat.domiciliosDesayuno += amount;
          } else {
            if (serv === 'mesa') cat.mesasAlmuerzo += amount;
            else if (serv === 'llevar') cat.llevarAlmuerzo += amount;
            else cat.domiciliosAlmuerzo += amount;
          }
        } else {
          if (esDes) cat.domiciliosDesayuno += amount;
          else cat.domiciliosAlmuerzo += amount;
        }
      });

    // Salón (tableOrders + waiterOrders) — unir, deduplicar y clasificar
    const combinedSalonRaw = [...tableOrders, ...waiterOrders];
    const seenSalon = new Set();
    const combinedSalon = [];
    for (const o of combinedSalonRaw) {
      const k = o?.id || o?.orderId || null;
      if (k) {
        if (seenSalon.has(k)) continue;
        seenSalon.add(k);
      }
      combinedSalon.push(o);
    }
    combinedSalon
      .filter((o) => !isCancelled(o) && inDay(o))
      .forEach((o) => {
        const amount = Number(o.total || 0);
        if (amount <= 0) return;
        const esDes = isBreakfastOrder(o);
        const serv = normalizeServiceFromOrder(o) || 'mesa';
        if (esDes) {
          if (serv === 'mesa') cat.mesasDesayuno += amount;
          else if (serv === 'llevar') cat.llevarDesayuno += amount;
          else if (serv === 'domicilio') cat.domiciliosDesayuno += amount;
        } else {
          if (serv === 'mesa') cat.mesasAlmuerzo += amount;
          else if (serv === 'llevar') cat.llevarAlmuerzo += amount;
          else if (serv === 'domicilio') cat.domiciliosAlmuerzo += amount;
        }
      });

    // Desayunos de salón específicos (colección 'breakfastOrders') — clasificar por servicio
    (breakfastSalonOrders || [])
      .filter((o) => !isCancelled(o) && inDay(o))
      .forEach((o) => {
        const amount = Number(o.total || 0);
        if (amount <= 0) return;
        const serv = normalizeServiceFromOrder(o) || 'mesa';
        if (serv === 'mesa') cat.mesasDesayuno += amount;
        else if (serv === 'llevar') cat.llevarDesayuno += amount;
        else if (serv === 'domicilio') cat.domiciliosDesayuno += amount;
        else cat.mesasDesayuno += amount;
      });

    // Desayunos delivery (deliveryBreakfastOrders)
    (breakfastOrders || [])
      .filter((o) => !isCancelled(o) && inDay(o))
      .forEach((o) => {
        const amount = Number(o.total || 0);
        if (amount <= 0) return;
        const serv = normalizeServiceFromOrder(o);
        const hasAddr = !!(o.address?.address || o.breakfasts?.[0]?.address?.address);
        if (serv === 'mesa') cat.mesasDesayuno += amount;
        else if (serv === 'llevar') cat.llevarDesayuno += amount;
        else if (serv === 'domicilio' || (!serv && hasAddr)) cat.domiciliosDesayuno += amount;
        else cat.domiciliosDesayuno += amount;
      });

    return cat;
  }, [orders, clientOrders, tableOrders, waiterOrders, breakfastOrders, breakfastSalonOrders]);

  const todayISO = useMemo(()=>{ const d=new Date(); d.setHours(0,0,0,0); return d.toISOString().split('T')[0]; },[]);

  // Día de hoy (histórico si existe; si no realtime)
  const todayCategories = useMemo(()=>{
    if(historicIndex[todayISO]) return historicIndex[todayISO];
    return buildRealtimeDay(todayISO) || { domiciliosAlmuerzo:0, domiciliosDesayuno:0, mesasAlmuerzo:0, llevarAlmuerzo:0, mesasDesayuno:0, llevarDesayuno:0 };
  }, [historicIndex, todayISO, buildRealtimeDay]);

  // Últimos 7 días (cada día: histórico o realtime si no cerrado)
  const last7DaysData = useMemo(()=>{
    const arr = [];
    for(let i=6;i>=0;i--){
      const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
      const iso = d.toISOString().split('T')[0];
      const cat = historicIndex[iso] || buildRealtimeDay(iso) || { domiciliosAlmuerzo:0, domiciliosDesayuno:0, mesasAlmuerzo:0, llevarAlmuerzo:0, mesasDesayuno:0, llevarDesayuno:0 };
      const totalIncome = sumHistCategories(cat);
      const gastos = expensesByDay[iso]||0;
      arr.push({ date: iso, categories: cat, totalIncome, gastos });
    }
    return arr;
  }, [historicIndex, buildRealtimeDay, expensesByDay]);

  // Mes actual completo
  const currentMonthDaily = useMemo(()=>{
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysIn = new Date(year, month+1, 0).getDate();
    const arr = [];
    for(let day=1; day<=daysIn; day++){
      const iso = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const hasHist = !!historicIndex[iso];
      // Solo día actual se reconstruye en vivo si no hay histórico; días pasados sin histórico quedan 0 para no repetir hoy.
      let cat;
      if (hasHist) {
        cat = historicIndex[iso];
      } else if (iso === todayISO) {
        cat = buildRealtimeDay(iso) || { domiciliosAlmuerzo:0, domiciliosDesayuno:0, mesasAlmuerzo:0, llevarAlmuerzo:0, mesasDesayuno:0, llevarDesayuno:0 };
      } else {
        // Pasado o futuro sin histórico: valores en cero para evidenciar que falta cierre.
        cat = { domiciliosAlmuerzo:0, domiciliosDesayuno:0, mesasAlmuerzo:0, llevarAlmuerzo:0, mesasDesayuno:0, llevarDesayuno:0 };
      }
      const totalIncome = sumHistCategories(cat);
      const gastos = expensesByDay[iso]||0;
      arr.push({ date: iso, categories: cat, totalIncome, gastos, closed: hasHist });
    }
    return arr;
  }, [historicIndex, buildRealtimeDay, expensesByDay]);

  // Año: agregación mensual usando históricos + realtime de días abiertos del mes actual
  const currentYearMonthly = useMemo(()=>{
    const now = new Date();
    const year = now.getFullYear();
    const months = [];
    for(let m=0; m<12; m++){
      const daysIn = new Date(year, m+1, 0).getDate();
      let sumCat = { domiciliosAlmuerzo:0, domiciliosDesayuno:0, mesasAlmuerzo:0, llevarAlmuerzo:0, mesasDesayuno:0, llevarDesayuno:0 };
      let gastosMes = 0;
      for(let d=1; d<=daysIn; d++){
        const iso = `${year}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const cat = historicIndex[iso] || (m===now.getMonth() ? buildRealtimeDay(iso) : null);
        if(cat){
          Object.keys(sumCat).forEach(k => { sumCat[k] += Number(cat[k]||0); });
          gastosMes += expensesByDay[iso]||0;
        }
      }
      const totalIncome = sumHistCategories(sumCat);
      months.push({ monthIndex:m, monthKey:`${year}-${String(m+1).padStart(2,'0')}`, categories: sumCat, totalIncome, gastos: gastosMes });
    }
    return months;
  }, [historicIndex, buildRealtimeDay, expensesByDay]);

  // Exposición estructurada para gráficos/drill-down
  const periodStructures = {
    today: { date: todayISO, categories: todayCategories, totalIncome: sumHistCategories(todayCategories), gastos: expensesByDay[todayISO]||0 },
    last7Days: last7DaysData,
    thisMonth: currentMonthDaily,
    thisYear: currentYearMonthly,
  };

  // Exponer también conteo preciso de unidades de almuerzo del día (domicilio + salón) para consumo de UI/gráficas
  const almuerzosUnidadesHoy = useMemo(() => {
    try {
      const { sumLunchUnits } = require('../utils/orderUnits');
      const isTodayISO = getColombiaLocalDateString();
      const inDayISO = (o) => {
        const ts = o?.createdAt || o?.timestamp || o?.date;
        const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
        const local = typeof o?.createdAtLocal === 'string' ? o.createdAtLocal.split('T')[0] : null;
        const iso = local || (d ? d.toISOString().split('T')[0] : null);
        return iso === isTodayISO;
      };
      const isDelivered = (o) => ((o?.status||'').toString().toLowerCase().includes('entreg')) || ((o?.status||'').toString().toLowerCase().includes('deliv'));
      const deliveryMerged = [...orders]; (clientOrders||[]).forEach(o=>{ if(!deliveryMerged.find(x=>x.id===o.id)) deliveryMerged.push(o); });
      const dom = sumLunchUnits(deliveryMerged.filter(inDayISO).filter(isDelivered));
      const salon = sumLunchUnits([...tableOrders, ...waiterOrders].filter(inDayISO).filter(isDelivered));
      return dom + salon;
    } catch(e){
      return 0;
    }
  }, [orders, clientOrders, tableOrders, waiterOrders]);

  const initialLoadRefs = useRef({
    orders: false,
    clientOrders: false,
    tableOrders: false,
    waiterOrders: false,
    breakfastOrders: false,          // delivery
    breakfastSalonOrders: false,     // salón
    users: false,
    activity: false,
    ingresos: false,
    pedidosDiariosGuardados: false,
    payments: false,
  paymentsAll: false,
  });

  // Unificar todos los pedidos de salón (excepto desayunos de salón que tratamos aparte para prorrateo)
  // Unir pedidos de salón (mesa/llevar) antes de usarlos en efectos. Declarado
  // lo más arriba posible respecto a donde se consume para evitar errores de
  // temporal dead zone en dependencias que referencian salonOrders.
  const salonOrders = useMemo(() => {
    return [...tableOrders, ...waiterOrders];
  }, [tableOrders, waiterOrders]);

  const checkIfAllLoaded = () => {
    if (
      initialLoadRefs.current.orders &&
      initialLoadRefs.current.clientOrders &&
      initialLoadRefs.current.tableOrders &&
      initialLoadRefs.current.waiterOrders &&
      initialLoadRefs.current.breakfastOrders &&
      initialLoadRefs.current.breakfastSalonOrders &&
      initialLoadRefs.current.users &&
      initialLoadRefs.current.activity &&
      initialLoadRefs.current.ingresos &&
      initialLoadRefs.current.pedidosDiariosGuardados &&
      initialLoadRefs.current.payments
    ) {
      setLoadingData(false);
    }
  };

  /* ==========================================================
     Sumas por categoría (usa normalización + detección robusta)
     ========================================================== */
  useEffect(() => {
    const todayISO = getColombiaLocalDateString();
    if(selectedDate && selectedDate !== todayISO){
      // Buscar registro histórico de ingresos para esa fecha
      const rec = ingresosData.find(r=> new Date(r.date).toISOString().split('T')[0] === selectedDate);
      if(rec){
        const c = rec.categories || {};
        // Usar llevar* si existen en el documento histórico (backfills nuevos los incluyen)
        const effective = {
          domiciliosAlmuerzo: Number(c.domiciliosAlmuerzo)||0,
          mesasAlmuerzo: Number(c.mesasAlmuerzo)||0,
          llevarAlmuerzo: Number(c.llevarAlmuerzo)||0,
          domiciliosDesayuno: Number(c.domiciliosDesayuno)||0,
          mesasDesayuno: Number(c.mesasDesayuno)||0,
          llevarDesayuno: Number(c.llevarDesayuno)||0,
        };
        const ingresosSalon = effective.mesasAlmuerzo + effective.llevarAlmuerzo + effective.mesasDesayuno + effective.llevarDesayuno;
        const totalDomicilios = effective.domiciliosAlmuerzo + effective.domiciliosDesayuno;
        const gross = ingresosSalon + totalDomicilios;
        setTotals(prev=>({
          ...prev,
          byCategory:{...effective,totalDomicilios, ingresosSalon},
          grossIncome:gross,
          net: Math.max(gross - (prev.expenses||0),0)
        }));
      } else {
        // Sin histórico: reconstruir desde colecciones en vivo y (opcional) backfill persistente
        const cat = buildRealtimeDay(selectedDate) || { domiciliosAlmuerzo:0, domiciliosDesayuno:0, mesasAlmuerzo:0, mesasDesayuno:0, llevarAlmuerzo:0, llevarDesayuno:0 };
        const ingresosSalon = Number(cat.mesasAlmuerzo||0)+Number(cat.llevarAlmuerzo||0)+Number(cat.mesasDesayuno||0)+Number(cat.llevarDesayuno||0);
        const totalDomicilios = Number(cat.domiciliosAlmuerzo||0)+Number(cat.domiciliosDesayuno||0);
        const gross = ingresosSalon + totalDomicilios;
        setTotals(prev=>({
          ...prev,
          byCategory: { ...cat, totalDomicilios, ingresosSalon },
          grossIncome: gross,
          net: Math.max(gross - (prev.expenses||0), 0),
        }));

        // Backfill automático una sola vez por sesión para esta fecha (si es pasada)
        (async () => {
          try {
            if (!backfilledDatesRef.current.has(selectedDate)) {
              const qY = query(collection(db, INGRESOS_COLLECTION), where('date', '==', selectedDate));
              const snap = await getDocs(qY);
              const payload = {
                date: selectedDate,
                categories: { ...cat },
                totalIncome: gross,
                updatedAt: serverTimestamp(),
              };
              if (snap.empty) {
                await addDoc(collection(db, INGRESOS_COLLECTION), { ...payload, createdAt: serverTimestamp() });
              } else {
                await updateDoc(doc(db, INGRESOS_COLLECTION, snap.docs[0].id), payload);
              }
              backfilledDatesRef.current.add(selectedDate);
            }
          } catch (e) {
            // silencioso: si falla backfill, al menos mostramos en memoria
            console.warn('[backfill] No se pudo persistir reconstrucción para', selectedDate, e?.message);
          }
        })();
      }
      return; // saltar cálculo en vivo
    }

    // Helper para filtrar pedidos por fecha seleccionada
    // Filtra pedidos por fecha seleccionada, aceptando tanto createdAtLocal (string) como createdAt/timestamp/date (Timestamp)
    const filterBySelectedDate = (ordersArray) => {
      if (!selectedDate) return ordersArray;
      return ordersArray.filter(o => {
        const orderDate = getDocDateISO(o);
        return orderDate === selectedDate;
      });
    };
    const sum = {
      domiciliosAlmuerzo: 0,
      mesasAlmuerzo: 0,
      llevarAlmuerzo: 0,
      domiciliosDesayuno: 0,
      mesasDesayuno: 0,
      llevarDesayuno: 0,
    };

    // Filtrar todos los arrays por fecha
    // Filtrar y sumar SOLO pedidos de la fecha seleccionada y no cancelados
    const isNotCancelled = (o) => {
      const s = (o?.status || '').toString().toLowerCase();
      return !s.includes('cancel');
    };
  const ordersFiltered = filterBySelectedDate(orders).filter(isNotCancelled);
  // Fusionar pedidos de clientOrders (misma lógica de filtrado y exclusión de cancelados)
  const clientOrdersFiltered = filterBySelectedDate(clientOrders).filter(isNotCancelled);
  const allDeliveryOrders = [...ordersFiltered];
  clientOrdersFiltered.forEach(o => { if(!allDeliveryOrders.find(x => x.id === o.id)) allDeliveryOrders.push(o); });
    const tableOrdersFiltered = filterBySelectedDate(tableOrders).filter(isNotCancelled);
    const waiterOrdersFiltered = filterBySelectedDate(waiterOrders).filter(isNotCancelled);
    const breakfastOrdersFiltered = filterBySelectedDate(breakfastOrders).filter(isNotCancelled);
    const breakfastSalonOrdersFiltered = filterBySelectedDate(breakfastSalonOrders).filter(isNotCancelled);
    // Unir y deduplicar pedidos de salón por id para evitar contar doble si existen en ambas colecciones
    const salonOrdersFiltered = (() => {
      const merged = [...tableOrdersFiltered, ...waiterOrdersFiltered];
      const seen = new Set();
      const out = [];
      for (const o of merged) {
        const k = o?.id || o?.orderId || null;
        if (k) {
          if (seen.has(k)) continue;
          seen.add(k);
        }
        out.push(o);
      }
      return out;
    })();

    // Sumar por tipo y servicio (separando almuerzo vs desayuno para domicilios en 'orders'/'clientOrders')
    for (const o of allDeliveryOrders) {
      const amount = Number(o.total || 0);
      if (amount <= 0) continue;
      const esDesayuno = isBreakfastOrder(o);
      const serv = normalizeServiceFromOrder(o) || 'domicilio';
      if (serv !== 'domicilio') continue; // seguridad, estos arrays son de domicilios
      if (esDesayuno) sum.domiciliosDesayuno += amount;
      else sum.domiciliosAlmuerzo += amount;
    }
    for (const t of salonOrdersFiltered) {
      const amount = Number(t.total || 0);
      if (amount <= 0) continue;
      const esDesayuno = isBreakfastOrder(t);
      const service = normalizeServiceFromOrder(t) || 'mesa';
      if (!esDesayuno) {
        if (service === 'mesa') sum.mesasAlmuerzo += amount;
        else if (service === 'llevar') sum.llevarAlmuerzo += amount;
      } else {
        if (t.__collection !== 'breakfastOrders') {
          if (service === 'mesa') sum.mesasDesayuno += amount;
          else if (service === 'llevar') sum.llevarDesayuno += amount;
        }
      }
    }
    // Desayunos salón (colección 'breakfastOrders')
    const sumBreakfastSalon = (ordersArr = []) => {
      let mesa = 0;
      let llevar = 0;
      for (const o of ordersArr) {
        const amount = Number(o.total || 0);
        if (amount <= 0) continue;
        const items = Array.isArray(o.breakfasts) ? o.breakfasts : [];
        if (items.length === 0) {
          const s = normalizeServiceFromOrder(o) || 'mesa';
          if (s === 'mesa') mesa += amount;
          else if (s === 'llevar') llevar += amount;
          continue;
        }
        const isMesa = (v) => {
          const s = _asStr(v).toLowerCase();
          return /mesa|table|sal[oó]n|dine/.test(s);
        };
        const isLlevar = (v) => {
          const s = _asStr(v).toLowerCase();
          return /llevar|take(?:-|)?away|to-?go|takeout/.test(s);
        };
        const n = items.length;
        const nMesa = items.filter(b => isMesa(b?.orderType)).length;
        const nLlevar = items.filter(b => isLlevar(b?.orderType)).length;
        if (n > 0) {
          mesa += amount * (nMesa / n);
          llevar += amount * (nLlevar / n);
        }
      }
      return { mesa: Math.round(mesa), llevar: Math.round(llevar) };
    };
    const bSalon = sumBreakfastSalon(breakfastSalonOrdersFiltered || []);
    sum.mesasDesayuno += bSalon.mesa;
    sum.llevarDesayuno += bSalon.llevar;
    // Desayunos delivery (deliveryBreakfastOrders)
    for (const b of breakfastOrdersFiltered) {
      const amount = Number(b.total || 0);
      if (amount <= 0) continue;
      const service = normalizeServiceFromOrder(b);
      const hasAddr = !!(b.address?.address || b.breakfasts?.[0]?.address?.address);
      if (service === 'mesa') sum.mesasDesayuno += amount;
      else if (service === 'llevar') sum.llevarDesayuno += amount;
      else if (service === 'domicilio' || (!service && hasAddr)) sum.domiciliosDesayuno += amount;
      else sum.domiciliosDesayuno += amount;
    }
    const effective = { ...sum };

    // DEBUG: Ver valores de domicilios
    console.log('[useDashboardData] Categorías calculadas:', {
      domiciliosAlmuerzo: effective.domiciliosAlmuerzo,
      domiciliosDesayuno: effective.domiciliosDesayuno,
      mesasDesayuno: effective.mesasDesayuno,
      llevarDesayuno: effective.llevarDesayuno,
      ordersCount: orders.length,
      breakfastOrdersCount: breakfastOrders.length,
    });

    // Recalcular ingresosSalon y total domicilios BRUTO (todos) y luego liquidados aparte
    // Recalcular ingresos de salón evitando duplicar almuerzo llevar como mesa
    const ingresosSalon =
      effective.mesasAlmuerzo +
      effective.llevarAlmuerzo +
      effective.mesasDesayuno +
      effective.llevarDesayuno;
    const domiciliosBruto = effective.domiciliosAlmuerzo + effective.domiciliosDesayuno;

  // Para domicilios: mostrar TODOS los entregados (no solo liquidados) en totales generales
  // Pero TAMBIÉN calcular los liquidados por separado para el desglose por domiciliario
  const isLiquidated = (o) => {
    if(!o) return false;
    if(o.settled === true) return true;
    // soportar estructura paymentSettled { cash: true, nequi: true, daviplata: true }
    if(o.paymentSettled && typeof o.paymentSettled === 'object') {
      return Object.values(o.paymentSettled).some(v => v === true);
    }
    return false;
  };
  
    // === Unificación y DEDUP de domicilios (almuerzo + desayuno) para montos liquidados ===
    // Observado: algunos desayunos domicilio aparecen tanto en 'orders' como en 'deliveryBreakfastOrders'
    // causando inflado (~duplica) de domicilios. Unificamos por clave estable.
    const deliveryKey = (o) => {
      if (!o) return null;
      return (
        o.id ||
        o.orderId ||
        (o.phoneNumber ? `phone:${o.phoneNumber}:${Number(o.total)||0}:${getDocDateISO(o)}` : null) ||
        (o.address?.phoneNumber ? `phone:${o.address.phoneNumber}:${Number(o.total)||0}:${getDocDateISO(o)}` : null)
      );
    };
    const unifiedLiquidatedBreakfastKeys = new Set();
    let domiciliosAlmuerzoLiquidado = 0;
    let domiciliosDesayunoLiquidado = 0;

    // 1. Procesar pedidos de orders/clientOrders (merged en allDeliveryOrders)
    allDeliveryOrders.forEach(o => {
      const t = Number(o.total||0); if(t<=0) return;
      const k = deliveryKey(o);
      const esDes = isBreakfastOrder(o);
      if (esDes) {
        if (isLiquidated(o) && !unifiedLiquidatedBreakfastKeys.has(k)) {
          domiciliosDesayunoLiquidado += t;
          if (k) unifiedLiquidatedBreakfastKeys.add(k);
        }
      } else {
        if (isLiquidated(o)) domiciliosAlmuerzoLiquidado += t;
      }
    });

    // 2. Procesar desayunos delivery en colección específica evitando duplicado con clave
    breakfastOrdersFiltered.forEach(b => {
      const t = Number(b.total||0); if(t<=0) return;
      const hasAddr = !!(b.address?.address || b.breakfasts?.[0]?.address?.address);
      if(!hasAddr) return; // sólo domicilio
      const k = deliveryKey(b);
      if (isLiquidated(b) && !unifiedLiquidatedBreakfastKeys.has(k)) {
        domiciliosDesayunoLiquidado += t;
        if (k) unifiedLiquidatedBreakfastKeys.add(k);
      }
    });
    // Total domicilios: SOLO liquidados
  const totalDomiciliosLiquidado = domiciliosAlmuerzoLiquidado + domiciliosDesayunoLiquidado;
    
  console.log('[useDashboardData] Total domicilios liquidados:', totalDomiciliosLiquidado, 'Salón:', ingresosSalon);
    
  // El ingreso bruto mostrado en Totales Generales debe ser: salón + domicilios BRUTOS (incluye desayuno no liquidado)
  const gross = ingresosSalon + domiciliosBruto;

    setTotals((prev) => ({
      ...prev,
      byCategory: {
        ...effective,
        ingresosSalon,
        totalDomicilios: domiciliosBruto, // bruto (sin duplicados ya corregido en effective)
        domiciliosBruto, // alias explícito
        domiciliosAlmuerzoLiquidado,
        domiciliosDesayunoLiquidado,
        totalDomiciliosLiquidado,
        dedupInfo: { unifiedLiquidatedBreakfastCount: unifiedLiquidatedBreakfastKeys.size }
      },
      grossIncome: gross,
      net: Math.max(gross - (prev.expenses || 0), 0),
    }));

    // Desglose adicional (si lo usas en UI) - usar arrays filtrados
  const mixed = [...allDeliveryOrders, ...salonOrdersFiltered, ...breakfastOrdersFiltered, ...breakfastSalonOrdersFiltered];
    setSaleTypeBreakdown(buildSaleTypeBreakdown(mixed));
  }, [orders, clientOrders, salonOrders, breakfastOrders, breakfastSalonOrders, waiterOrders, tableOrders, selectedDate, ingresosData]);

  /* =========================
     Suscripciones a Firestore
     ========================= */
  useEffect(() => {
    if (!db || !userId || !isAuthReady) return;

    setLoadingData(true);
    
    // Reset all loading flags when date changes
    initialLoadRefs.current = {
      orders: false,
      clientOrders: false,
      tableOrders: false,
      waiterOrders: false,
      breakfastOrders: false,
      breakfastSalonOrders: false,
      users: false,
      activity: false,
      ingresos: false,
      pedidosDiariosGuardados: false,
      payments: false,
      paymentsAll: false,
    };
    
    const unsubscribes = [];

    // Orders (domicilios almuerzo) - SIN filtro de fecha para evitar problemas con campos faltantes
    const ordersCollectionRef = collection(db, 'orders');
    const ordersQuery = ordersCollectionRef; // Cargar todos y filtrar en memoria
      
    const unsubscribeOrders = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const ordersData = snapshot.docs.map((doc) => ({ id: doc.id, __collection: 'orders', ...doc.data() }));
        console.log('[Firestore] orders (almuerzo domicilios) cargados:', ordersData.length, 'pedidos');
        if (ordersData.length > 0) {
          console.log('[Firestore] Primer pedido orders:', {
            id: ordersData[0].id,
            total: ordersData[0].total,
            createdAt: ordersData[0].createdAt,
            timestamp: ordersData[0].timestamp,
            status: ordersData[0].status
          });
        }
        setOrders(ordersData);

        const newTotals = { cash: 0, daviplata: 0, nequi: 0 };

        ordersData.forEach((order) => {
          const paymentSummary = order.paymentSummary || {};
          newTotals.cash += Number(paymentSummary['Efectivo'] || 0);
          newTotals.daviplata += Number(paymentSummary['Daviplata'] || 0);
          newTotals.nequi += Number(paymentSummary['Nequi'] || 0);
        });

        if (!initialLoadRefs.current.orders) {
          initialLoadRefs.current.orders = true;
          checkIfAllLoaded();
        }
      },
      (error) => {
        setError?.(`Error al cargar pedidos: ${error.message}`);
        if (!initialLoadRefs.current.orders) {
          initialLoadRefs.current.orders = true;
          checkIfAllLoaded();
        }
      }
    );
    unsubscribes.push(unsubscribeOrders);

    // ClientOrders (domicilios almuerzo desde app cliente) - SIN filtro de fecha
    const clientOrdersRef = collection(db, 'clientOrders');
    const unsubscribeClientOrders = onSnapshot(
      clientOrdersRef,
      (snapshot) => {
        const clientOrdersData = snapshot.docs.map((doc) => ({ id: doc.id, __collection: 'clientOrders', ...doc.data() }));
        setClientOrders(clientOrdersData);
        if (!initialLoadRefs.current.clientOrders) {
          initialLoadRefs.current.clientOrders = true;
          checkIfAllLoaded();
        }
      },
      (error) => {
        console.error('[Firestore] error cargando clientOrders:', error);
        if (!initialLoadRefs.current.clientOrders) {
          initialLoadRefs.current.clientOrders = true;
          checkIfAllLoaded();
        }
      }
    );
    unsubscribes.push(unsubscribeClientOrders);

    // Table orders (salón) - SIN filtro de fecha
    const tableOrdersCollectionRef = collection(db, 'tableOrders');
    const tableOrdersQuery = tableOrdersCollectionRef;
        
    const unsubscribeTableOrders = onSnapshot(
      tableOrdersQuery,
      (snapshot) => {
        const tableOrdersData = snapshot.docs.map((doc) => ({ id: doc.id, __collection: 'tableOrders', ...doc.data() }));
        setTableOrders(tableOrdersData);

        if (!initialLoadRefs.current.tableOrders) {
          initialLoadRefs.current.tableOrders = true;
          checkIfAllLoaded();
        }
      },
      (error) => {
        setError?.(`Error al cargar pedidos de mesa: ${error.message}`);
        if (!initialLoadRefs.current.tableOrders) {
          initialLoadRefs.current.tableOrders = true;
          checkIfAllLoaded();
        }
      }
    );
    unsubscribes.push(unsubscribeTableOrders);

    // Waiter orders (salón creados en alguna vista de mesero) - SIN filtro de fecha
    const waiterOrdersCollectionRef = collection(db, 'waiterOrders');
    const waiterOrdersQuery = waiterOrdersCollectionRef;
        
    const unsubscribeWaiterOrders = onSnapshot(
      waiterOrdersQuery,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, __collection: 'waiterOrders', ...doc.data() }));
        setWaiterOrders(data);
        if (!initialLoadRefs.current.waiterOrders) {
          initialLoadRefs.current.waiterOrders = true;
          checkIfAllLoaded();
        }
      },
      (error) => {
        setError?.(`Error al cargar pedidos del mesero: ${error.message}`);
        if (!initialLoadRefs.current.waiterOrders) {
          initialLoadRefs.current.waiterOrders = true;
          checkIfAllLoaded();
        }
      }
    );
    unsubscribes.push(unsubscribeWaiterOrders);

    // Breakfast orders DELIVERY (deliveryBreakfastOrders) - SIN filtro de fecha
    const unsubscribeBreakfastOrdersDelivery = onSnapshot(
      collection(db, 'deliveryBreakfastOrders'),
      (snapshot) => {
        const breakfastOrdersData = snapshot.docs.map((doc) => ({ id: doc.id, __collection: 'deliveryBreakfastOrders', ...doc.data() }));
        console.log('[Firestore] breakfastOrders (delivery) cargados:', breakfastOrdersData.length, 'pedidos');
        if (breakfastOrdersData.length > 0) {
          console.log('[Firestore] Primer pedido breakfastOrders (delivery):', {
            id: breakfastOrdersData[0].id,
            total: breakfastOrdersData[0].total,
            createdAt: breakfastOrdersData[0].createdAt,
            timestamp: breakfastOrdersData[0].timestamp,
            status: breakfastOrdersData[0].status,
            address: breakfastOrdersData[0].address
          });
        }
        setBreakfastOrders(breakfastOrdersData);
        if (!initialLoadRefs.current.breakfastOrders) {
          initialLoadRefs.current.breakfastOrders = true;
          checkIfAllLoaded();
        }
      },
      (error) => {
        setError?.(`Error al cargar desayunos (delivery): ${error.message}`);
        if (!initialLoadRefs.current.breakfastOrders) {
          initialLoadRefs.current.breakfastOrders = true;
          checkIfAllLoaded();
        }
      }
    );
    unsubscribes.push(unsubscribeBreakfastOrdersDelivery);

    // Breakfast orders de SALÓN (colección 'breakfastOrders' creada en WaiterDashboard) - SIN filtro de fecha
    const breakfastSalonOrdersRef = collection(db, 'breakfastOrders');
    const breakfastSalonOrdersQuery = breakfastSalonOrdersRef;
        
    const unsubscribeBreakfastSalonOrders = onSnapshot(
      breakfastSalonOrdersQuery,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({ id: doc.id, __collection: 'breakfastOrders', ...doc.data() }));
        setBreakfastSalonOrders(data);
        if (!initialLoadRefs.current.breakfastSalonOrders) {
          initialLoadRefs.current.breakfastSalonOrders = true;
          checkIfAllLoaded();
        }
      },
      (error) => {
        setError?.(`Error al cargar desayunos de salón: ${error.message}`);
        if (!initialLoadRefs.current.breakfastSalonOrders) {
          initialLoadRefs.current.breakfastSalonOrders = true;
          checkIfAllLoaded();
        }
      }
    );
    unsubscribes.push(unsubscribeBreakfastSalonOrders);

    // Users
    const usersCollectionRef = collection(db, 'users');
    const unsubscribeUsers = onSnapshot(
      usersCollectionRef,
      (snapshot) => {
        const usersData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setUsers(usersData);
        if (!initialLoadRefs.current.users) {
          initialLoadRefs.current.users = true;
          checkIfAllLoaded();
        }
      },
      (error) => {
        setError?.(`Error al cargar usuarios: ${error.message}`);
        if (!initialLoadRefs.current.users) {
          initialLoadRefs.current.users = true;
          checkIfAllLoaded();
        }
      }
    );
    unsubscribes.push(unsubscribeUsers);

    // User activity
    const userActivityCollectionRef = collection(db, 'userActivity');
    const unsubscribeActivity = onSnapshot(
      userActivityCollectionRef,
      (snapshot) => {
        const activity = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            const timestampDate = data.timestamp instanceof Timestamp ? data.timestamp.toDate() : null;
            return { id: doc.id, ...data, timestamp: timestampDate };
          })
          .sort((a, b) => (b.timestamp ? b.timestamp.getTime() : 0) - (a.timestamp ? a.timestamp.getTime() : 0));
        setUserActivity(activity);
        if (!initialLoadRefs.current.activity) {
          initialLoadRefs.current.activity = true;
          checkIfAllLoaded();
        }
      },
      (error) => {
        setError?.(`Error al cargar actividad: ${error.message}`);
        if (!initialLoadRefs.current.activity) {
          initialLoadRefs.current.activity = true;
          checkIfAllLoaded();
        }
      }
    );
    unsubscribes.push(unsubscribeActivity);

    // Ingresos (históricos guardados)
    const ingresosColRef = collection(db, INGRESOS_COLLECTION);
    const unsubscribeIngresos = onSnapshot(
      ingresosColRef,
      (snapshot) => {
        const ingresosData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setIngresosData(ingresosData);
        if (!initialLoadRefs.current.ingresos) {
          initialLoadRefs.current.ingresos = true;
          checkIfAllLoaded();
        }
      },
      (error) => {
        setError?.(`Error al cargar ingresos: ${error.message}`);
        if (!initialLoadRefs.current.ingresos) {
          initialLoadRefs.current.ingresos = true;
          checkIfAllLoaded();
        }
      }
    );
    unsubscribes.push(unsubscribeIngresos);

    // Pedidos diarios guardados (conteos)
    const pedidosDiariosGuardadosColRef = collection(db, PEDIDOS_DIARIOS_GUARDADOS_COLLECTION);
    const unsubscribePedidosDiariosGuardados = onSnapshot(
      pedidosDiariosGuardadosColRef,
      (snapshot) => {
        const pedidosData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setPedidosDiariosGuardadosData(pedidosData);
        if (!initialLoadRefs.current.pedidosDiariosGuardados) {
          initialLoadRefs.current.pedidosDiariosGuardados = true;
          checkIfAllLoaded();
        }
      },
      (error) => {
        setError?.(`Error al cargar pedidos diarios guardados: ${error.message}`);
        if (!initialLoadRefs.current.pedidosDiariosGuardados) {
          initialLoadRefs.current.pedidosDiariosGuardados = true;
          checkIfAllLoaded();
        }
      }
    );
    unsubscribes.push(unsubscribePedidosDiariosGuardados);

    // Payments (gastos) — opcionalmente filtrados por día seleccionado
    const paymentsQuery = (startOfDay && endOfDay)
      ? query(
          collection(db, 'payments'),
          where('timestamp', '>=', startOfDay),
          where('timestamp', '<=', endOfDay),
          orderBy('timestamp', 'asc'),
        )
      : collection(db, 'payments');

    const unsubscribePayments = onSnapshot(
      paymentsQuery,
      (snapshot) => {
        const items = snapshot.docs.map(d => {
          const data = d.data();
          // Fallback de fecha: timestamp || createdAt || date (string YYYY-MM-DD)
          let ts = data.timestamp || data.createdAt;
          if (!ts && typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
            // Crear Date fijo medio día para evitar corrimientos huso horario
            ts = new Date(data.date + 'T12:00:00-05:00');
          }
          return { id: d.id, ...data, timestamp: ts || data.timestamp }; // normalizamos en timestamp
        });

        // Guardar lista cruda (incluye ahora registros antiguos sin serverTimestamp original)
        setPaymentsRaw(items);

        let totalExpenses = 0;
        const byProvider = {};
        const counts = {};

        const parseAmount = (val) => {
          if (typeof val === 'number') return isNaN(val)?0:val;
          if (typeof val === 'string') {
            // Eliminar símbolos de moneda, espacios y separadores de miles comunes
            let cleaned = val.trim()
              .replace(/COP/gi,'')
              .replace(/\$/g,'')
              .replace(/,/g,'')
              .replace(/\s+/g,'');
            // Si hay más de un punto, asume que son separadores de miles y quita todos
            const points = (cleaned.match(/\./g)||[]).length;
            if(points>1) cleaned = cleaned.replace(/\./g,'');
            const num = Number(cleaned);
            return isNaN(num)?0:num;
          }
          return 0;
        };

        for (const p of items) {
          const amount = parseAmount(p.amount || 0);
          const provider = (p.provider || p.store || '—').toString().trim() || '—';
          totalExpenses += amount;
          byProvider[provider] = (byProvider[provider] || 0) + amount;
          counts[provider] = (counts[provider] || 0) + 1;
        }

        setTotals(prev => {
          const net = Math.max((prev.grossIncome || 0) - totalExpenses, 0);
          return {
            ...prev,
            expenses: totalExpenses,
            expensesByProvider: { total: totalExpenses, byProvider, counts },
            net,
          };
        });

        if (!initialLoadRefs.current.payments) {
          initialLoadRefs.current.payments = true;
          checkIfAllLoaded();
        }
      },
      (error) => {
        setError?.(`Error al cargar pagos: ${error.message}`);
        if (!initialLoadRefs.current.payments) {
          initialLoadRefs.current.payments = true;
          checkIfAllLoaded();
        }
      }
    );
    unsubscribes.push(unsubscribePayments);

    // Payments ALL (sin filtro para gráficos de mes/año/7d)
    const unsubAllPayments = onSnapshot(
      collection(db, 'payments'),
      (snapshot) => {
        const items = snapshot.docs.map(d => {
          const data = d.data();
            let ts = data.timestamp || data.createdAt;
            if (!ts && typeof data.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
              ts = new Date(data.date + 'T12:00:00-05:00');
            }
            return { id: d.id, ...data, timestamp: ts || data.timestamp };
          });
        setPaymentsAllRaw(items);
        if(!initialLoadRefs.current.paymentsAll){
          initialLoadRefs.current.paymentsAll = true;
          checkIfAllLoaded();
        }
      },
      (error) => {
        setError?.(`Error al cargar todos los pagos: ${error.message}`);
        if(!initialLoadRefs.current.paymentsAll){
          initialLoadRefs.current.paymentsAll = true;
          checkIfAllLoaded();
        }
      }
    );
    unsubscribes.push(unsubAllPayments);

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [db, userId, isAuthReady, startOfDay, endOfDay]); // evita bucles

  /* ===========================================
     Recalcular métodos de pago (orders + clientOrders + salón + desayunos)
     =========================================== */
  useEffect(() => {
    // Fecha seleccionada en formato ISO (YYYY-MM-DD)
    const targetDateISO = selectedDate || getColombiaLocalDateString();

    // Helper robusto para obtener ISO de fecha (incluye createdAtLocal)
    const getOrderISO = (o) => {
      if (!o) return null;
      if (typeof o.createdAtLocal === 'string' && o.createdAtLocal.length >= 10) return o.createdAtLocal.split('T')[0];
      const ts = o.createdAt || o.timestamp || o.date;
      const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
      return d ? d.toISOString().split('T')[0] : null;
    };

    // Filtrar pedidos por la fecha seleccionada (orders + clientOrders)
  const filteredOrdersRaw = (orders || []).filter(o => getOrderISO(o) === targetDateISO);
  const filteredClientOrdersRaw = (clientOrders || []).filter(o => getOrderISO(o) === targetDateISO);
    // Fusionar evitando duplicados
    const filteredOrders = [...filteredOrdersRaw];
    filteredClientOrdersRaw.forEach(o => { if (!filteredOrders.find(x => x.id === o.id)) filteredOrders.push(o); });
    const filteredSalonOrders = (salonOrders || []).filter(t => {
      const dISO = t.createdAt?.toDate ? new Date(t.createdAt.toDate()).toISOString().split('T')[0] : getDocDateISO(t);
      return dISO === targetDateISO;
    });
    const filteredBreakfastOrders = (breakfastOrders || []).filter(b => getOrderISO(b) === targetDateISO);
    const filteredBreakfastSalonOrders = (breakfastSalonOrders || []).filter(b => getOrderISO(b) === targetDateISO);

    // Agrupar por método de pago y tipo de venta
    let efectivo = 0, daviplata = 0, nequi = 0;
    let totalDomicilios = 0, totalMesas = 0;
    let totalDesayunoDomicilio = 0, totalAlmuerzoDomicilio = 0;
    let totalDesayunoMesa = 0, totalAlmuerzoMesa = 0;
    let deliveryBreakdown = {};

    // Domicilios (almuerzo y desayuno) SOLO los liquidados
    // Domicilios almuerzo en colección principal (orders) y también posibles desayunos delivery guardados allí.
    // Reglas:
    //  - Almuerzo domicilio: sólo contar si está liquidado (consistente con política actual)
    //  - Desayuno domicilio: contar siempre (como ya se hace con deliveryBreakfastOrders), incluso si no está liquidado
    //    para reflejar ingresos brutos del día y evitar la omisión que ocurre cuando se guardan en 'orders'.
    // Helper robusto de método de pago (legado + anidado)
    const getPaymentMethodLower = (obj) => {
      const raw = (obj?.paymentMethod || obj?.payment || obj?.meals?.[0]?.paymentMethod || obj?.meals?.[0]?.payment?.name || obj?.breakfasts?.[0]?.paymentMethod || obj?.breakfasts?.[0]?.payment?.name || '').toString().trim().toLowerCase();
      if (raw.includes('efect')) return 'efectivo';
      if (raw.includes('davi')) return 'daviplata';
      if (raw.includes('nequi')) return 'nequi';
      return raw;
    };

    filteredOrders.forEach(o => {
      const total = Number(o.total || 0);
      if (total <= 0) return;
      const isDesayuno = isBreakfastOrder(o);
  const pago = getPaymentMethodLower(o);
      const person = o.deliveryPerson || 'Sin asignar';
      const isSettled = !!o.settled;
      // Para almuerzo mantenemos condición de liquidados; para desayuno lo contamos siempre
      if (!isDesayuno && !isSettled) return;
      if (!deliveryBreakdown[person]) deliveryBreakdown[person] = { desayuno: 0, almuerzo: 0 };
      if (isDesayuno) {
        totalDesayunoDomicilio += total;
        deliveryBreakdown[person].desayuno += total;
      } else {
        totalAlmuerzoDomicilio += total;
        deliveryBreakdown[person].almuerzo += total;
      }
      totalDomicilios += total;
      if (pago === 'efectivo') efectivo += total;
      else if (pago === 'daviplata') daviplata += total;
      else if (pago === 'nequi') nequi += total;
    });

    // Mesas (almuerzo y desayuno) — NO contar "llevar" aquí para evitar doble conteo con llevar* calculado en el otro efecto
    filteredSalonOrders.forEach(t => {
      const pago = getPaymentMethodLower(t);
      const total = Number(t.total || 0);
      const isDesayuno = isBreakfastOrder(t);
      const service = (normalizeServiceFromOrder(t) || 'mesa').toLowerCase();
      // Solo sumar a "mesa" cuando realmente es mesa
      if (service === 'mesa') {
        if (isDesayuno) totalDesayunoMesa += total;
        else totalAlmuerzoMesa += total;
      }
      // totalMesas representa ingresos salón totales (mesa + llevar), lo mantenemos para ingresosSalon
      totalMesas += total;
      if (pago === 'efectivo') efectivo += total;
      else if (pago === 'daviplata') daviplata += total;
      else if (pago === 'nequi') nequi += total;
    });

    // Desayunos delivery
    filteredBreakfastOrders.forEach(b => {
      const pago = getPaymentMethodLower(b);
      const total = Number(b.total || 0);
      const person = b.deliveryPerson || 'Sin asignar';
      totalDesayunoDomicilio += total;
      totalDomicilios += total;
      if (!deliveryBreakdown[person]) deliveryBreakdown[person] = { desayuno: 0, almuerzo: 0 };
      deliveryBreakdown[person].desayuno += total;
      if (pago === 'efectivo') efectivo += total;
      else if (pago === 'daviplata') daviplata += total;
      else if (pago === 'nequi') nequi += total;
    });

    // Desayunos de salón
    filteredBreakfastSalonOrders.forEach(b => {
      const pago = getPaymentMethodLower(b);
      const total = Number(b.total || 0);
      totalDesayunoMesa += total;
      totalMesas += total;
      if (pago === 'efectivo') efectivo += total;
      else if (pago === 'daviplata') daviplata += total;
      else if (pago === 'nequi') nequi += total;
    });

    // Totales generales (solo para métodos y desglose); NO sobrescribir grossIncome calculado antes
    const totalGeneral = totalDomicilios + totalMesas;
    setTotals(prev => {
      const prevCat = prev?.byCategory || {};
      // Unificar pedidos de domicilio (almuerzo liquidados + desayunos delivery) evitando duplicados por id
      const domicilioUnified = [];
      const pushUnique = (o) => { if (!o || !o.id) return; if (!domicilioUnified.find(x => x.id === o.id)) domicilioUnified.push(o); };
      filteredOrders.forEach(o => { // ya filtrado: almuerzos liquidados + desayunos (todos)
        const isDesayuno = isBreakfastOrder(o);
        if (!isDesayuno && !o.settled) return; // salvaguarda
        pushUnique(o);
      });
      filteredBreakfastOrders.forEach(pushUnique);

  const domicilioCash = domicilioUnified.reduce((sum, o) => getPaymentMethodLower(o)==='efectivo' ? sum + Number(o.total||0) : sum, 0);
  const domicilioDavi = domicilioUnified.reduce((sum, o) => getPaymentMethodLower(o)==='daviplata' ? sum + Number(o.total||0) : sum, 0);
  const domicilioNequi = domicilioUnified.reduce((sum, o) => getPaymentMethodLower(o)==='nequi' ? sum + Number(o.total||0) : sum, 0);

      const updatedByCategory = {
        ...prevCat,
        domiciliosAlmuerzo: totalAlmuerzoDomicilio,
        domiciliosDesayuno: totalDesayunoDomicilio,
        mesasAlmuerzo: totalAlmuerzoMesa,
        mesasDesayuno: totalDesayunoMesa,
        totalDomicilios,
        ingresosSalon: totalMesas,
        efectivoDomicilios: domicilioCash,
  efectivoMesas: filteredSalonOrders.concat(filteredBreakfastSalonOrders).reduce((sum, o) => getPaymentMethodLower(o)==='efectivo' ? sum + Number(o.total||0) : sum, 0),
        daviplataDomicilios: domicilioDavi,
  daviplataMesas: filteredSalonOrders.concat(filteredBreakfastSalonOrders).reduce((sum, o) => getPaymentMethodLower(o)==='daviplata' ? sum + Number(o.total||0) : sum, 0),
        nequiDomicilios: domicilioNequi,
  nequiMesas: filteredSalonOrders.concat(filteredBreakfastSalonOrders).reduce((sum, o) => getPaymentMethodLower(o)==='nequi' ? sum + Number(o.total||0) : sum, 0),
      };
      const net = Math.max((prev.grossIncome || 0) - (prev.expenses || 0), 0);
      return {
        ...prev,
        cash: efectivo,
        cashCaja: efectivo,
        cashPendiente: 0,
        daviplata,
        nequi,
        totalLiquidado: totalGeneral,
        net,
        deliveryBreakdown,
        expenses: prev.expenses || 0,
        expensesByProvider: prev.expensesByProvider || { total: 0, byProvider: {}, counts: {} },
        byCategory: updatedByCategory,
      };
    });
  }, [orders, clientOrders, salonOrders, breakfastOrders, breakfastSalonOrders, selectedDate]);

  /* ===========================================
     Recalcular conteos de estado incluyendo todas las colecciones
     =========================================== */
  useEffect(() => {
    // Filtrar todos los pedidos por la fecha seleccionada
    const targetDateISO = selectedDate || getColombiaLocalDateString();
    const filterByDate = (arr, getDateFn) => (arr || []).filter(o => {
      const dISO = getDateFn(o);
      return dISO === targetDateISO;
    });
    const filteredOrders = filterByDate(orders, o => o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toISOString().split('T')[0] : getDocDateISO(o));
    const filteredTableOrders = filterByDate(tableOrders, o => o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toISOString().split('T')[0] : getDocDateISO(o));
    const filteredWaiterOrders = filterByDate(waiterOrders, o => o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toISOString().split('T')[0] : getDocDateISO(o));
    const filteredBreakfastOrders = filterByDate(breakfastOrders, getDocDateISO);
    const filteredBreakfastSalonOrders = filterByDate(breakfastSalonOrders, o => o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toISOString().split('T')[0] : getDocDateISO(o));

    const allOrders = [
      ...filteredOrders,
      ...filteredTableOrders,
      ...filteredWaiterOrders,
      ...filteredBreakfastOrders,
      ...filteredBreakfastSalonOrders
    ];

    const newStatusCounts = { Pending: 0, Delivered: 0, Cancelled: 0 };
    allOrders.forEach((order) => {
      const orderStatus = order.status?.toLowerCase() || '';
      if (orderStatus === ORDER_STATUS.PENDING) newStatusCounts.Pending += 1;
      else if (orderStatus === ORDER_STATUS.DELIVERED) newStatusCounts.Delivered += 1;
      else if (orderStatus === ORDER_STATUS.CANCELLED) newStatusCounts.Cancelled += 1;
    });
    setStatusCounts(newStatusCounts);

    const pieChartData = [
      { name: ORDER_STATUS_DISPLAY[ORDER_STATUS.PENDING], value: newStatusCounts.Pending, color: PIE_COLORS[0] },
      { name: ORDER_STATUS_DISPLAY[ORDER_STATUS.DELIVERED], value: newStatusCounts.Delivered, color: PIE_COLORS[1] },
      { name: ORDER_STATUS_DISPLAY[ORDER_STATUS.CANCELLED], value: newStatusCounts.Cancelled, color: PIE_COLORS[2] },
    ];
    setStatusPieChartData(pieChartData);

    // Breakdown por tipo de venta SOLO del día seleccionado
    setSaleTypeBreakdown(buildSaleTypeBreakdown(allOrders));
  }, [orders, tableOrders, waiterOrders, breakfastOrders, breakfastSalonOrders, selectedDate]);

  /* ==========================
     Daily Sales Chart (categorías)
     ========================== */
  useEffect(() => {
    if (!isAuthReady) return;

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    const { startDate: salesStartDate, endDate: salesEndDate } = getDateRange(
      salesFilterRange,
      salesCustomStartDate,
      salesCustomEndDate
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString().split('T')[0];
    let chartData;

    if (salesFilterRange === 'year' && !selectedMonth) {
      const monthlySales = {};
      const currentYear = today.getFullYear();

      for (let month = 0; month < 12; month++) {
        const monthKey = `${currentYear}-${String(month + 1).padStart(2, '0')}`;
        monthlySales[monthKey] = {
          'Domicilios Almuerzo': 0,
          'Domicilios Desayuno': 0,
          'Mesas/Llevar Almuerzo': 0,
          'Mesas/Llevar Desayuno': 0,
        };
      }

      // Históricos guardados
      ingresosData.forEach((summary) => {
        const date = new Date(summary.date);
        if (date.getFullYear() === currentYear) {
          const mKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const c = summary.categories || {};
          monthlySales[mKey]['Domicilios Almuerzo'] += Number(c.domiciliosAlmuerzo || 0);
          monthlySales[mKey]['Domicilios Desayuno'] += Number(c.domiciliosDesayuno || 0);
          monthlySales[mKey]['Mesas/Llevar Almuerzo'] += Number(c.mesasAlmuerzo || 0);
          monthlySales[mKey]['Mesas/Llevar Desayuno'] += Number(c.mesasDesayuno || 0);
        }
      });

      // Realtime del mes actual (simple: mesa+llevar juntos)
      const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      let rt = { da: 0, dd: 0, ma: 0, md: 0 };

      orders.forEach((o) => {
        const d = o.createdAt?.toDate ? new Date(o.createdAt.toDate()) : null;
        if (d && d.getFullYear() === currentYear && d.getMonth() === today.getMonth())
          rt.da += Number(o.total || 0);
      });
      // Incluir clientOrders en Domicilios Almuerzo del mes actual
      (clientOrders||[]).forEach((o) => {
        const d = o.createdAt?.toDate ? new Date(o.createdAt.toDate()) : (typeof o.createdAtLocal === 'string' ? new Date(o.createdAtLocal) : null);
        if (d && d.getFullYear() === currentYear && d.getMonth() === today.getMonth())
          rt.da += Number(o.total || 0);
      });
      // Deduplicar salón en tiempo real del mes actual
      const dedupSalonMonth = (() => {
        const seen = new Set();
        const out = [];
        for (const t of salonOrders) {
          const k = t?.id || t?.orderId || null;
          if (k) { if (seen.has(k)) continue; seen.add(k); }
          out.push(t);
        }
        return out;
      })();
      dedupSalonMonth.forEach((t) => {
        const d = t.createdAt?.toDate ? new Date(t.createdAt.toDate()) : null;
        if (d && d.getFullYear() === currentYear && d.getMonth() === today.getMonth()) {
          const esDesayuno = isBreakfastOrder(t);
          if (esDesayuno) rt.md += Number(t.total || 0);
          else rt.ma += Number(t.total || 0);
        }
      });
      // ⬇️ desayunos de salón (colección 'breakfastOrders') suman al bucket de "Mesas/Llevar Desayuno"
      breakfastSalonOrders.forEach((b) => {
        const d = b.createdAt?.toDate ? new Date(b.createdAt.toDate()) : null;
        if (d && d.getFullYear() === currentYear && d.getMonth() === today.getMonth()) {
          rt.md += Number(b.total || 0);
        }
      });
      breakfastOrders.forEach((b) => {
        const dISO = getDocDateISO(b);
        if (!dISO) return;
        const d = new Date(dISO);
        if (d.getFullYear() !== currentYear || d.getMonth() !== today.getMonth()) return;

        const amount = Number(b.total || 0);
        const service = normalizeServiceFromOrder(b);
        const hasAddr = !!(b.address?.address || b.breakfasts?.[0]?.address?.address);
        if (service === 'mesa' || service === 'llevar') rt.md += amount;
        else if (service === 'domicilio' || (!service && hasAddr)) rt.dd += amount;
        else rt.dd += amount;
      });

      monthlySales[currentMonthKey]['Domicilios Almuerzo'] += rt.da;
      monthlySales[currentMonthKey]['Mesas/Llevar Almuerzo'] += rt.ma;
      monthlySales[currentMonthKey]['Domicilios Desayuno'] += rt.dd;
      monthlySales[currentMonthKey]['Mesas/Llevar Desayuno'] += rt.md;

      chartData = Object.keys(monthlySales).map((monthKey) => ({
        name: monthNames[parseInt(monthKey.split('-')[1]) - 1],
        monthKey,
        'Domicilios Almuerzo': monthlySales[monthKey]['Domicilios Almuerzo'],
        'Domicilios Desayuno': monthlySales[monthKey]['Domicilios Desayuno'],
        'Mesas/Llevar Almuerzo': monthlySales[monthKey]['Mesas/Llevar Almuerzo'],
        'Mesas/Llevar Desayuno': monthlySales[monthKey]['Mesas/Llevar Desayuno'],
      }));
    } else {
      const filteredDailySales = {};

      // Históricos por día
      ingresosData.forEach((summary) => {
        const summaryDateISO = new Date(summary.date).toISOString().split('T')[0];
        if (
          summaryDateISO >= salesStartDate.toISOString().split('T')[0] &&
          summaryDateISO <= salesEndDate.toISOString().split('T')[0]
        ) {
          const c = summary.categories || {};
          filteredDailySales[summaryDateISO] = {
            'Domicilios Almuerzo':
              (filteredDailySales[summaryDateISO]?.['Domicilios Almuerzo'] || 0) +
              Number(c.domiciliosAlmuerzo || 0),
            'Domicilios Desayuno':
              (filteredDailySales[summaryDateISO]?.['Domicilios Desayuno'] || 0) +
              Number(c.domiciliosDesayuno || 0),
            'Mesas/Llevar Almuerzo':
              (filteredDailySales[summaryDateISO]?.['Mesas/Llevar Almuerzo'] || 0) +
              Number(c.mesasAlmuerzo || 0),
            'Mesas/Llevar Desayuno':
              (filteredDailySales[summaryDateISO]?.['Mesas/Llevar Desayuno'] || 0) +
              Number(c.mesasDesayuno || 0),
          };
        }
      });

      // Realtime del rango (simple: mesa+llevar juntos)
      if (today >= salesStartDate && today <= salesEndDate) {
        // Importante: si ya existe un histórico para HOY, preferimos REEMPLAZAR por el cálculo en vivo
        // para evitar acumulaciones o históricos desactualizados.
        delete filteredDailySales[todayISO];

        let da = 0, dd = 0, ma = 0, md = 0, la = 0, ld = 0;

        orders.forEach((o) => {
          const dISO = o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toISOString().split('T')[0] : null;
          if (dISO && dISO >= salesStartDate.toISOString().split('T')[0] && dISO <= salesEndDate.toISOString().split('T')[0]) {
            da += Number(o.total || 0);
          }
        });
        // clientOrders en rango
        (clientOrders||[]).forEach((o) => {
          const dISO = o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toISOString().split('T')[0] : (typeof o.createdAtLocal === 'string' ? o.createdAtLocal.split('T')[0] : null);
          if (dISO && dISO >= salesStartDate.toISOString().split('T')[0] && dISO <= salesEndDate.toISOString().split('T')[0]) {
            da += Number(o.total || 0);
          }
        });

        // Deduplicar salón dentro del rango
        const dedupSalonRange = (() => {
          const seen = new Set();
          const out = [];
          for (const t of salonOrders) {
            const k = t?.id || t?.orderId || null;
            if (k) { if (seen.has(k)) continue; seen.add(k); }
            out.push(t);
          }
          return out;
        })();
        dedupSalonRange.forEach((t) => {
          const dISO = t.createdAt?.toDate ? new Date(t.createdAt.toDate()).toISOString().split('T')[0] : null;
          if (dISO && dISO >= salesStartDate.toISOString().split('T')[0] && dISO <= salesEndDate.toISOString().split('T')[0]) {
            const amount = Number(t.total || 0);
            if (amount <= 0) return;
            const serv = (normalizeServiceFromOrder(t) || 'mesa').toLowerCase();
            const esDesayuno = isBreakfastOrder(t);
            if (serv === 'mesa') {
              if (esDesayuno) md += amount; else ma += amount;
            } else if (serv === 'llevar') {
              if (esDesayuno) md += amount; else ma += amount; // en gráfico se muestra junto "Mesas/Llevar"
            } else if (serv === 'domicilio') {
              // Caso raro: un pedido de salón marcado como domicilio; reubicar según comida
              if (esDesayuno) dd += amount; else da += amount;
            }
          }
        });

        // ⬇️ desayunos de salón de 'breakfastOrders'
        breakfastSalonOrders.forEach((b) => {
          const dISO = b.createdAt?.toDate ? new Date(b.createdAt.toDate()).toISOString().split('T')[0] : getDocDateISO(b);
          if (dISO && dISO >= salesStartDate.toISOString().split('T')[0] && dISO <= salesEndDate.toISOString().split('T')[0]) {
            md += Number(b.total || 0);
          }
        });

        breakfastOrders.forEach((b) => {
          const dISO = getDocDateISO(b);
          if (!dISO) return;
          // Limitar por rango y evitar sumar desayunos de otros días que ya estén cerrados
          if (dISO < salesStartDate.toISOString().split('T')[0] || dISO > salesEndDate.toISOString().split('T')[0]) return;
          const amount = Number(b.total || 0);
          if (amount <= 0) return;
          const service = normalizeServiceFromOrder(b);
          const hasAddr = !!(b.address?.address || b.breakfasts?.[0]?.address?.address);
          if (service === 'mesa' || service === 'llevar') {
            // En gráfico consolidado mesa+llevar se suman juntos
            md += amount;
          } else if (service === 'domicilio' || (!service && hasAddr)) {
            dd += amount;
          } else {
            dd += amount; // fallback domicilio por dirección implícita
          }
        });

        const k = todayISO;
        filteredDailySales[k] = {
          'Domicilios Almuerzo': da,
          'Domicilios Desayuno': dd,
          'Mesas/Llevar Almuerzo': ma,
          'Mesas/Llevar Desayuno': md,
        };
      }

      const sortedDates = Object.keys(filteredDailySales).sort((a, b) => new Date(a) - new Date(b));
      chartData = sortedDates.map((date) => ({
        name: date,
        'Domicilios Almuerzo': filteredDailySales[date]['Domicilios Almuerzo'] || 0,
        'Domicilios Desayuno': filteredDailySales[date]['Domicilios Desayuno'] || 0,
        'Mesas/Llevar Almuerzo': filteredDailySales[date]['Mesas/Llevar Almuerzo'] || 0,
        'Mesas/Llevar Desayuno': filteredDailySales[date]['Mesas/Llevar Desayuno'] || 0,
      }));
    }

    // Ajustar neto y total del día seleccionado usando grossIncome ya calculado (evita discrepancias)
    // Si existe la fecha de hoy en chartData, sustituimos por los valores finales de totals.byCategory para consistencia visual.
    try {
      if (Array.isArray(chartData)) {
        const todayEntry = chartData.find(d => d.name === todayISO);
        if (todayEntry && totals?.byCategory) {
          todayEntry['Domicilios Almuerzo'] = Number(totals.byCategory.domiciliosAlmuerzo||0);
          todayEntry['Domicilios Desayuno'] = Number(totals.byCategory.domiciliosDesayuno||0);
          // Sumar mesa + llevar en almuerzo y desayuno
          const almMesa = Number(totals.byCategory.mesasAlmuerzo||0);
          const almLlevar = Number(totals.byCategory.llevarAlmuerzo||0);
          const desMesa = Number(totals.byCategory.mesasDesayuno||0);
          const desLlevar = Number(totals.byCategory.llevarDesayuno||0);
          todayEntry['Mesas/Llevar Almuerzo'] = almMesa + almLlevar;
          todayEntry['Mesas/Llevar Desayuno'] = desMesa + desLlevar;
        }
      }
    } catch(e){ /* silencioso */ }
    setDailySalesChartData(chartData);
  }, [
    orders,
    salonOrders,
    breakfastOrders,
    breakfastSalonOrders,
    ingresosData,
    salesFilterRange,
    salesCustomStartDate,
    salesCustomEndDate,
    isAuthReady,
    selectedMonth,
    totals, // para sincronizar entrada de hoy con byCategory
  ]);

  /* ==========================
     Daily Orders Chart (conteos)
     ========================== */
  useEffect(() => {
    if (!isAuthReady) return;

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    const { startDate: ordersStartDate, endDate: ordersEndDate } = getDateRange(
      ordersFilterRange,
      ordersCustomStartDate,
      ordersCustomEndDate
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString().split('T')[0];
    let chartData;

    if (ordersFilterRange === 'year' && !selectedMonth) {
      const monthlyOrders = {};
      const currentYear = today.getFullYear();

      for (let month = 0; month < 12; month++) {
        const monthKey = `${currentYear}-${String(month + 1).padStart(2, '0')}`;
        monthlyOrders[monthKey] = { domicilios: 0, mesas: 0 };
      }

      pedidosDiariosGuardadosData.forEach((summary) => {
        const date = new Date(summary.date);
        if (date.getFullYear() === currentYear) {
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          monthlyOrders[monthKey].domicilios += summary.domicilios || 0;
          monthlyOrders[monthKey].mesas += summary.mesas || 0;
        }
      });

      const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      let currentMonthRealtimeDomicilios = 0;
      let currentMonthRealtimeMesas = 0;

      orders.forEach((order) => {
        const d = order.createdAt?.toDate ? new Date(order.createdAt.toDate()) : null;
        if (d && d.getFullYear() === currentYear && d.getMonth() === today.getMonth()) {
          currentMonthRealtimeDomicilios++;
        }
      });
      // Incluir clientOrders en conteo mensual de domicilios
      (clientOrders||[]).forEach((order) => {
        const d = order.createdAt?.toDate ? new Date(order.createdAt.toDate()) : (typeof order.createdAtLocal === 'string' ? new Date(order.createdAtLocal) : null);
        if (d && d.getFullYear() === currentYear && d.getMonth() === today.getMonth()) {
          currentMonthRealtimeDomicilios++;
        }
      });

      salonOrders.forEach((tableOrder) => {
        const d = tableOrder.createdAt?.toDate ? new Date(tableOrder.createdAt.toDate()) : null;
        if (d && d.getFullYear() === currentYear && d.getMonth() === today.getMonth()) {
          currentMonthRealtimeMesas++;
        }
      });

      // ⬇️ contar órdenes de desayunos de salón como "Mesas"
      breakfastSalonOrders.forEach((bo) => {
        const d = bo.createdAt?.toDate ? new Date(bo.createdAt.toDate()) : null;
        if (d && d.getFullYear() === currentYear && d.getMonth() === today.getMonth()) {
          currentMonthRealtimeMesas++;
        }
      });

      monthlyOrders[currentMonthKey].domicilios += currentMonthRealtimeDomicilios;
      monthlyOrders[currentMonthKey].mesas += currentMonthRealtimeMesas;

      chartData = Object.keys(monthlyOrders).map((monthKey) => ({
        name: monthNames[parseInt(monthKey.split('-')[1]) - 1],
        monthKey: monthKey,
        Domicilios: monthlyOrders[monthKey].domicilios,
        Mesas: monthlyOrders[monthKey].mesas,
      }));
    } else {
      const filteredDailyOrders = {};

      pedidosDiariosGuardadosData.forEach((summary) => {
        const summaryDate = new Date(summary.date).toISOString().split('T')[0];
        if (
          summaryDate >= ordersStartDate.toISOString().split('T')[0] &&
          summaryDate <= ordersEndDate.toISOString().split('T')[0]
        ) {
          if (ordersFilterRange === 'year' && selectedMonth) {
            const monthKey = `${new Date(summary.date).getFullYear()}-${String(
              new Date(summary.date).getMonth() + 1
            ).padStart(2, '0')}`;
            if (monthKey === selectedMonth) {
              filteredDailyOrders[summaryDate] = {
                Domicilios: summary.domicilios || 0,
                Mesas: summary.mesas || 0,
              };
            }
          } else {
            filteredDailyOrders[summaryDate] = {
              Domicilios: summary.domicilios || 0,
              Mesas: summary.mesas || 0,
            };
          }
        }
      });

  if (today >= ordersStartDate && today <= ordersEndDate) {
  let currentDayRealtimeDomicilios = 0;
  let currentDayRealtimeMesas = 0;
  // Nuevos contadores detallados por (servicio, comida)
  let c_domiciliosDesayuno = 0, c_domiciliosAlmuerzo = 0;
  let c_mesasDesayuno = 0, c_mesasAlmuerzo = 0;
  let c_llevarDesayuno = 0, c_llevarAlmuerzo = 0;
  // Contador de UNIDADES para almuerzo (en lugar de número de pedidos)
  let countLunchUnits = null;
  try { ({ countLunchUnits } = require('../utils/orderUnits')); } catch(e){ countLunchUnits = null; }

        orders.forEach((order) => {
          const orderDate = order.createdAt?.toDate
            ? new Date(order.createdAt.toDate()).toISOString().split('T')[0]
            : null;
          if (orderDate === todayISO) {
            currentDayRealtimeDomicilios++;
            const esDes = isBreakfastOrder(order);
            const serv = (normalizeServiceFromOrder(order) || 'domicilio').toLowerCase();
            const units = esDes ? 1 : (countLunchUnits ? countLunchUnits(order) : 1);
            if (serv === 'domicilio') {
              if (esDes) c_domiciliosDesayuno += 1; else c_domiciliosAlmuerzo += units;
            } else if (serv === 'mesa') {
              if (esDes) c_mesasDesayuno += 1; else c_mesasAlmuerzo += units;
            } else if (serv === 'llevar') {
              if (esDes) c_llevarDesayuno += 1; else c_llevarAlmuerzo += units;
            } else { // fallback tratar como domicilio
              if (esDes) c_domiciliosDesayuno += 1; else c_domiciliosAlmuerzo += units;
            }
          }
        });
        // clientOrders en el día actual con desglose por servicio/comida
        (clientOrders||[]).forEach((order) => {
          const orderDate = order.createdAt?.toDate
            ? new Date(order.createdAt.toDate()).toISOString().split('T')[0]
            : (typeof order.createdAtLocal === 'string' ? order.createdAtLocal.split('T')[0] : null);
          if (orderDate === todayISO) {
            currentDayRealtimeDomicilios++;
            const esDes = isBreakfastOrder(order);
            const serv = (normalizeServiceFromOrder(order) || 'domicilio').toLowerCase();
            const units = esDes ? 1 : (countLunchUnits ? countLunchUnits(order) : 1);
            if (serv === 'domicilio') {
              if (esDes) c_domiciliosDesayuno += 1; else c_domiciliosAlmuerzo += units;
            } else if (serv === 'mesa') {
              if (esDes) c_mesasDesayuno += 1; else c_mesasAlmuerzo += units;
            } else if (serv === 'llevar') {
              if (esDes) c_llevarDesayuno += 1; else c_llevarAlmuerzo += units;
            } else {
              if (esDes) c_domiciliosDesayuno += 1; else c_domiciliosAlmuerzo += units;
            }
          }
        });

        salonOrders.forEach((tableOrder) => {
          const tableOrderDate = tableOrder.createdAt?.toDate
            ? new Date(tableOrder.createdAt.toDate()).toISOString().split('T')[0]
            : null;
          if (tableOrderDate === todayISO) {
            currentDayRealtimeMesas++;
            const esDes = isBreakfastOrder(tableOrder);
            const serv = (normalizeServiceFromOrder(tableOrder) || 'mesa').toLowerCase();
            const units = esDes ? 1 : (countLunchUnits ? countLunchUnits(tableOrder) : 1);
            if (serv === 'mesa') {
              if (esDes) c_mesasDesayuno += 1; else c_mesasAlmuerzo += units;
            } else if (serv === 'llevar') {
              if (esDes) c_llevarDesayuno += 1; else c_llevarAlmuerzo += units;
            } else if (serv === 'domicilio') {
              if (esDes) c_domiciliosDesayuno += 1; else c_domiciliosAlmuerzo += units;
            }
          }
        });

        // Desayunos delivery (domicilios desayuno) deben contar como domicilios desayuno
        breakfastOrders.forEach((b) => {
          const dISO = getDocDateISO(b);
            if (dISO === todayISO) {
              const esDes = true; // por definición en esta colección
              const serv = (normalizeServiceFromOrder(b) || 'domicilio').toLowerCase();
              if (serv === 'domicilio') c_domiciliosDesayuno++;
              else if (serv === 'llevar') c_llevarDesayuno++; // fallback si llega como llevar
              else if (serv === 'mesa') c_mesasDesayuno++; // improbable
              else c_domiciliosDesayuno++;
              currentDayRealtimeDomicilios++; // contar pedido como domicilio
            }
        });

        // ⬇️ incluir desayunos de salón clasificando por servicio (mesa / llevar / domicilio)
        breakfastSalonOrders.forEach((bo) => {
          const dISO = bo.createdAt?.toDate
            ? new Date(bo.createdAt.toDate()).toISOString().split('T')[0]
            : getDocDateISO(bo);
          if (dISO === todayISO) {
            const serv = (normalizeServiceFromOrder(bo) || 'mesa').toLowerCase();
            if (serv === 'mesa') {
              currentDayRealtimeMesas++;
              c_mesasDesayuno++;
            } else if (serv === 'llevar') {
              // Llevar desayuno: NO incrementa mesas totales, pero sí conteo granular llevar
              c_llevarDesayuno++;
            } else if (serv === 'domicilio') {
              // Caso raro: desayuno salón marcado domicilio
              currentDayRealtimeDomicilios++;
              c_domiciliosDesayuno++;
            } else {
              currentDayRealtimeMesas++;
              c_mesasDesayuno++;
            }
          }
        });

        if (ordersFilterRange === 'year' && selectedMonth) {
          const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
          if (currentMonth === selectedMonth) {
            filteredDailyOrders[todayISO] = {
              Domicilios: (filteredDailyOrders[todayISO]?.Domicilios || 0) + currentDayRealtimeDomicilios,
              Mesas: (filteredDailyOrders[todayISO]?.Mesas || 0) + currentDayRealtimeMesas,
              domiciliosDesayuno: (filteredDailyOrders[todayISO]?.domiciliosDesayuno || 0) + c_domiciliosDesayuno,
              domiciliosAlmuerzo: (filteredDailyOrders[todayISO]?.domiciliosAlmuerzo || 0) + c_domiciliosAlmuerzo,
              mesasDesayuno: (filteredDailyOrders[todayISO]?.mesasDesayuno || 0) + c_mesasDesayuno,
              mesasAlmuerzo: (filteredDailyOrders[todayISO]?.mesasAlmuerzo || 0) + c_mesasAlmuerzo,
              llevarDesayuno: (filteredDailyOrders[todayISO]?.llevarDesayuno || 0) + c_llevarDesayuno,
              llevarAlmuerzo: (filteredDailyOrders[todayISO]?.llevarAlmuerzo || 0) + c_llevarAlmuerzo,
            };
          }
        } else {
          filteredDailyOrders[todayISO] = {
            Domicilios: (filteredDailyOrders[todayISO]?.Domicilios || 0) + currentDayRealtimeDomicilios,
            Mesas: (filteredDailyOrders[todayISO]?.Mesas || 0) + currentDayRealtimeMesas,
            domiciliosDesayuno: (filteredDailyOrders[todayISO]?.domiciliosDesayuno || 0) + c_domiciliosDesayuno,
            domiciliosAlmuerzo: (filteredDailyOrders[todayISO]?.domiciliosAlmuerzo || 0) + c_domiciliosAlmuerzo,
            mesasDesayuno: (filteredDailyOrders[todayISO]?.mesasDesayuno || 0) + c_mesasDesayuno,
            mesasAlmuerzo: (filteredDailyOrders[todayISO]?.mesasAlmuerzo || 0) + c_mesasAlmuerzo,
            llevarDesayuno: (filteredDailyOrders[todayISO]?.llevarDesayuno || 0) + c_llevarDesayuno,
            llevarAlmuerzo: (filteredDailyOrders[todayISO]?.llevarAlmuerzo || 0) + c_llevarAlmuerzo,
          };
        }
      }

      // Fallback para fecha seleccionada distinta a hoy: calcular conteos en vivo si no existen guardados
      if (selectedDate && selectedDate !== todayISO) {
        // Solo inyectar si la fecha cae dentro del rango solicitado
        const sel = new Date(selectedDate + 'T00:00:00');
        if (sel >= ordersStartDate && sel <= ordersEndDate) {
          let selDom = 0, selMes = 0;
          let s_dDes = 0, s_dAlm = 0, s_mDes = 0, s_mAlm = 0, s_lDes = 0, s_lAlm = 0;
          let countLunchUnitsSel = null;
          try { ({ countLunchUnitsSel } = require('../utils/orderUnits')); } catch(e){ countLunchUnitsSel = null; }

          const unitsOf = (o, isDes) => isDes ? 1 : (countLunchUnitsSel ? countLunchUnitsSel(o) : 1);

          // Orders + clientOrders
          orders.forEach(order => {
            const dISO = order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toISOString().split('T')[0] : null;
            if (dISO === selectedDate) {
              selDom++;
              const esDes = isBreakfastOrder(order);
              const serv = (normalizeServiceFromOrder(order) || 'domicilio').toLowerCase();
              const u = unitsOf(order, esDes);
              if (serv === 'domicilio') { if (esDes) s_dDes += 1; else s_dAlm += u; }
              else if (serv === 'mesa') { if (esDes) s_mDes += 1; else s_mAlm += u; }
              else if (serv === 'llevar') { if (esDes) s_lDes += 1; else s_lAlm += u; }
              else { if (esDes) s_dDes += 1; else s_dAlm += u; }
            }
          });
          (clientOrders||[]).forEach(order => {
            const dISO = order.createdAt?.toDate
              ? new Date(order.createdAt.toDate()).toISOString().split('T')[0]
              : (typeof order.createdAtLocal === 'string' ? order.createdAtLocal.split('T')[0] : null);
            if (dISO === selectedDate) {
              selDom++;
              const esDes = isBreakfastOrder(order);
              const serv = (normalizeServiceFromOrder(order) || 'domicilio').toLowerCase();
              const u = unitsOf(order, esDes);
              if (serv === 'domicilio') { if (esDes) s_dDes += 1; else s_dAlm += u; }
              else if (serv === 'mesa') { if (esDes) s_mDes += 1; else s_mAlm += u; }
              else if (serv === 'llevar') { if (esDes) s_lDes += 1; else s_lAlm += u; }
              else { if (esDes) s_dDes += 1; else s_dAlm += u; }
            }
          });

          // Salon orders
          salonOrders.forEach(tableOrder => {
            const dISO = tableOrder.createdAt?.toDate ? new Date(tableOrder.createdAt.toDate()).toISOString().split('T')[0] : null;
            if (dISO === selectedDate) {
              selMes++;
              const esDes = isBreakfastOrder(tableOrder);
              const serv = (normalizeServiceFromOrder(tableOrder) || 'mesa').toLowerCase();
              const u = unitsOf(tableOrder, esDes);
              if (serv === 'mesa') { if (esDes) s_mDes += 1; else s_mAlm += u; }
              else if (serv === 'llevar') { if (esDes) s_lDes += 1; else s_lAlm += u; }
              else if (serv === 'domicilio') { if (esDes) s_dDes += 1; else s_dAlm += u; }
            }
          });

          // Breakfast delivery
          breakfastOrders.forEach(b => {
            const dISO = getDocDateISO(b);
            if (dISO === selectedDate) {
              const serv = (normalizeServiceFromOrder(b) || 'domicilio').toLowerCase();
              if (serv === 'domicilio') { s_dDes++; selDom++; }
              else if (serv === 'llevar') { s_lDes++; }
              else if (serv === 'mesa') { s_mDes++; selMes++; }
              else { s_dDes++; selDom++; }
            }
          });

          // Breakfast salon
          breakfastSalonOrders.forEach(bo => {
            const dISO = bo.createdAt?.toDate ? new Date(bo.createdAt.toDate()).toISOString().split('T')[0] : getDocDateISO(bo);
            if (dISO === selectedDate) {
              const serv = (normalizeServiceFromOrder(bo) || 'mesa').toLowerCase();
              if (serv === 'mesa') { s_mDes++; selMes++; }
              else if (serv === 'llevar') { s_lDes++; }
              else if (serv === 'domicilio') { s_dDes++; selDom++; }
              else { s_mDes++; selMes++; }
            }
          });

          // Registrar entrada para la fecha seleccionada
          filteredDailyOrders[selectedDate] = {
            Domicilios: (filteredDailyOrders[selectedDate]?.Domicilios || 0) + selDom,
            Mesas: (filteredDailyOrders[selectedDate]?.Mesas || 0) + selMes,
            domiciliosDesayuno: (filteredDailyOrders[selectedDate]?.domiciliosDesayuno || 0) + s_dDes,
            domiciliosAlmuerzo: (filteredDailyOrders[selectedDate]?.domiciliosAlmuerzo || 0) + s_dAlm,
            mesasDesayuno: (filteredDailyOrders[selectedDate]?.mesasDesayuno || 0) + s_mDes,
            mesasAlmuerzo: (filteredDailyOrders[selectedDate]?.mesasAlmuerzo || 0) + s_mAlm,
            llevarDesayuno: (filteredDailyOrders[selectedDate]?.llevarDesayuno || 0) + s_lDes,
            llevarAlmuerzo: (filteredDailyOrders[selectedDate]?.llevarAlmuerzo || 0) + s_lAlm,
          };
        }
      }

      // Fallback adicional: cuando se solicita "Últimos 7 días", si faltan días
      // dentro del rango (distintos a HOY), reconstruimos sus conteos a partir
      // de las colecciones en memoria. Esto evita que tras recargar la página
      // el gráfico muestre sólo HOY hasta que existan documentos históricos.
      if (ordersFilterRange === '7_days') {
        // Helper: calcula conteos para una fecha YYYY-MM-DD
        const computeCountsForDate = (iso) => {
          let selDom = 0, selMes = 0;
          let s_dDes = 0, s_dAlm = 0, s_mDes = 0, s_mAlm = 0, s_lDes = 0, s_lAlm = 0;
          let countLunchUnitsSel = null;
          try { ({ countLunchUnitsSel } = require('../utils/orderUnits')); } catch(e){ countLunchUnitsSel = null; }

          const unitsOf = (o, isDes) => isDes ? 1 : (countLunchUnitsSel ? countLunchUnitsSel(o) : 1);

          // Orders + clientOrders
          orders.forEach(order => {
            const dISO = order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toISOString().split('T')[0] : null;
            if (dISO === iso) {
              selDom++;
              const esDes = isBreakfastOrder(order);
              const serv = (normalizeServiceFromOrder(order) || 'domicilio').toLowerCase();
              const u = unitsOf(order, esDes);
              if (serv === 'domicilio') { if (esDes) s_dDes += 1; else s_dAlm += u; }
              else if (serv === 'mesa') { if (esDes) s_mDes += 1; else s_mAlm += u; }
              else if (serv === 'llevar') { if (esDes) s_lDes += 1; else s_lAlm += u; }
              else { if (esDes) s_dDes += 1; else s_dAlm += u; }
            }
          });
          (clientOrders||[]).forEach(order => {
            const dISO = order.createdAt?.toDate
              ? new Date(order.createdAt.toDate()).toISOString().split('T')[0]
              : (typeof order.createdAtLocal === 'string' ? order.createdAtLocal.split('T')[0] : null);
            if (dISO === iso) {
              selDom++;
              const esDes = isBreakfastOrder(order);
              const serv = (normalizeServiceFromOrder(order) || 'domicilio').toLowerCase();
              const u = unitsOf(order, esDes);
              if (serv === 'domicilio') { if (esDes) s_dDes += 1; else s_dAlm += u; }
              else if (serv === 'mesa') { if (esDes) s_mDes += 1; else s_mAlm += u; }
              else if (serv === 'llevar') { if (esDes) s_lDes += 1; else s_lAlm += u; }
              else { if (esDes) s_dDes += 1; else s_dAlm += u; }
            }
          });

          // Salon orders
          salonOrders.forEach(tableOrder => {
            const dISO = tableOrder.createdAt?.toDate ? new Date(tableOrder.createdAt.toDate()).toISOString().split('T')[0] : null;
            if (dISO === iso) {
              selMes++;
              const esDes = isBreakfastOrder(tableOrder);
              const serv = (normalizeServiceFromOrder(tableOrder) || 'mesa').toLowerCase();
              const u = unitsOf(tableOrder, esDes);
              if (serv === 'mesa') { if (esDes) s_mDes += 1; else s_mAlm += u; }
              else if (serv === 'llevar') { if (esDes) s_lDes += 1; else s_lAlm += u; }
              else if (serv === 'domicilio') { if (esDes) s_dDes += 1; else s_dAlm += u; }
            }
          });

          // Breakfast delivery
          breakfastOrders.forEach(b => {
            const dISO = getDocDateISO(b);
            if (dISO === iso) {
              const serv = (normalizeServiceFromOrder(b) || 'domicilio').toLowerCase();
              if (serv === 'domicilio') { s_dDes++; selDom++; }
              else if (serv === 'llevar') { s_lDes++; }
              else if (serv === 'mesa') { s_mDes++; selMes++; }
              else { s_dDes++; selDom++; }
            }
          });

          // Breakfast salón
          breakfastSalonOrders.forEach(bo => {
            const dISO = bo.createdAt?.toDate ? new Date(bo.createdAt.toDate()).toISOString().split('T')[0] : getDocDateISO(bo);
            if (dISO === iso) {
              const serv = (normalizeServiceFromOrder(bo) || 'mesa').toLowerCase();
              if (serv === 'mesa') { s_mDes++; selMes++; }
              else if (serv === 'llevar') { s_lDes++; }
              else if (serv === 'domicilio') { s_dDes++; selDom++; }
              else { s_mDes++; selMes++; }
            }
          });

          return {
            Domicilios: selDom,
            Mesas: selMes,
            domiciliosDesayuno: s_dDes,
            domiciliosAlmuerzo: s_dAlm,
            mesasDesayuno: s_mDes,
            mesasAlmuerzo: s_mAlm,
            llevarDesayuno: s_lDes,
            llevarAlmuerzo: s_lAlm,
          };
        };

        // Recorrer los días del rango y reconstruir los que falten
        const cursor = new Date(ordersStartDate);
        cursor.setHours(0,0,0,0);
        const end = new Date(ordersEndDate);
        end.setHours(0,0,0,0);
        const todayStr = todayISO;
        while (cursor <= end) {
          const iso = cursor.toISOString().split('T')[0];
          if (iso !== todayStr) {
            if (!filteredDailyOrders[iso]) {
              filteredDailyOrders[iso] = computeCountsForDate(iso);
            }
          }
          cursor.setDate(cursor.getDate()+1);
        }
      }

      const sortedDates = Object.keys(filteredDailyOrders).sort((a, b) => new Date(a) - new Date(b));
      chartData = sortedDates.map((date) => ({
        name: date,
        Domicilios: filteredDailyOrders[date].Domicilios,
        Mesas: filteredDailyOrders[date].Mesas,
        domiciliosDesayuno: filteredDailyOrders[date].domiciliosDesayuno || 0,
        domiciliosAlmuerzo: filteredDailyOrders[date].domiciliosAlmuerzo || 0,
        mesasDesayuno: filteredDailyOrders[date].mesasDesayuno || 0,
        mesasAlmuerzo: filteredDailyOrders[date].mesasAlmuerzo || 0,
        llevarDesayuno: filteredDailyOrders[date].llevarDesayuno || 0,
        llevarAlmuerzo: filteredDailyOrders[date].llevarAlmuerzo || 0,
      }));
    }

    setDailyOrdersChartData(chartData);
  }, [
    orders,
    salonOrders,
    breakfastSalonOrders,
  pedidosDiariosGuardadosData,
  breakfastOrders,
    ordersFilterRange,
    ordersCustomStartDate,
    ordersCustomEndDate,
    isAuthReady,
    selectedMonth,
    selectedDate, // asegurar recalculo cuando cambia fecha seleccionada
  ]);

  /* ==========================================
     Guardar ingresos diarios (HOY) — coherente
     ========================================== */
  const handleSaveDailyIngresos = useCallback(async () => {
    setLoadingData(true);
    try {
      const today = getColombiaLocalDateString();

  let da = 0, dd = 0, ma = 0, md = 0, la = 0, ld = 0;

      // Domicilios almuerzo (orders)
      orders.forEach((o) => {
        const dISO = o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toISOString().split('T')[0] : null;
        if (dISO === today) da += Number(o.total || 0);
      });

      // Salón (tableOrders + waiterOrders) — separar desayuno/almuerzo y mesa/llevar
      salonOrders.forEach((t) => {
        const dISO = t.createdAt?.toDate ? new Date(t.createdAt.toDate()).toISOString().split('T')[0] : null;
        if (dISO !== today) return;
        const amount = Number(t.total || 0);
        if (amount <= 0) return;
        const esDesayuno = isBreakfastOrder(t);
        const serv = (normalizeServiceFromOrder(t) || 'mesa').toLowerCase();
        if (esDesayuno) {
          if (serv === 'mesa') md += amount; else if (serv === 'llevar') ld += amount;
        } else {
          if (serv === 'mesa') ma += amount; else if (serv === 'llevar') la += amount;
        }
      });

      // Desayunos de salón (colección 'breakfastOrders'): clasificar mesa/llevar
      breakfastSalonOrders.forEach((b) => {
        const dISO = b.createdAt?.toDate ? new Date(b.createdAt.toDate()).toISOString().split('T')[0] : getDocDateISO(b);
        if (dISO === today) {
          const amount = Number(b.total || 0);
          const serv = (normalizeServiceFromOrder(b) || 'mesa').toLowerCase();
          if (serv === 'mesa') md += amount; else if (serv === 'llevar') ld += amount; else if (serv === 'domicilio') dd += amount;
        }
      });

      // Desayunos delivery
      breakfastOrders.forEach((b) => {
        if (getDocDateISO(b) === today) {
          const amount = Number(b.total || 0);
          const service = normalizeServiceFromOrder(b);
          const hasAddr = !!(b.address?.address || b.breakfasts?.[0]?.address?.address);
          if (service === 'mesa') md += amount;
          else if (service === 'llevar') ld += amount;
          else if (service === 'domicilio' || (!service && hasAddr)) dd += amount;
          else dd += amount;
        }
      });

  const totalIncome = da + dd + ma + md + la + ld;

      const qY = query(collection(db, INGRESOS_COLLECTION), where('date', '==', today));
      const snap = await getDocs(qY);
      const payload = {
        date: today,
        categories: {
          domiciliosAlmuerzo: da,
          domiciliosDesayuno: dd,
          mesasAlmuerzo: ma,
          mesasDesayuno: md,
          llevarAlmuerzo: la,
          llevarDesayuno: ld,
        },
        totalIncome,
        updatedAt: serverTimestamp(),
      };

      if (snap.empty) {
        await addDoc(collection(db, INGRESOS_COLLECTION), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setSuccess?.(`Resumen de ingresos para ${today} guardado correctamente.`);
      } else {
        await updateDoc(doc(db, INGRESOS_COLLECTION, snap.docs[0].id), payload);
        setSuccess?.(`Resumen de ingresos para ${today} actualizado correctamente.`);
      }
    } catch (error) {
      setError?.(`Error al guardar/actualizar resumen de ingresos: ${error.message}`);
      console.error('Error al guardar ingresos diarios:', error);
    } finally {
      setLoadingData(false);
    }
  }, [db, orders, salonOrders, breakfastOrders, breakfastSalonOrders, setSuccess, setError]);

  // Reconstrucción manual de un día arbitrario (histórico o actual) desde colecciones en vivo
  const handleRebuildDailyIngresos = useCallback(async (dateISO) => {
    if (!dateISO) return;
    setLoadingData(true);
    try {
      const cat = buildRealtimeDay(dateISO) || { domiciliosAlmuerzo:0, domiciliosDesayuno:0, mesasAlmuerzo:0, mesasDesayuno:0, llevarAlmuerzo:0, llevarDesayuno:0 };
      const totalIncome = Number(cat.domiciliosAlmuerzo||0)+Number(cat.domiciliosDesayuno||0)+Number(cat.mesasAlmuerzo||0)+Number(cat.mesasDesayuno||0)+Number(cat.llevarAlmuerzo||0)+Number(cat.llevarDesayuno||0);
      const qY = query(collection(db, INGRESOS_COLLECTION), where('date', '==', dateISO));
      const snap = await getDocs(qY);
      const payload = { date: dateISO, categories: { ...cat }, totalIncome, updatedAt: serverTimestamp() };
      if (snap.empty) {
        await addDoc(collection(db, INGRESOS_COLLECTION), { ...payload, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, INGRESOS_COLLECTION, snap.docs[0].id), payload);
      }
      setSuccess?.(`Resumen reconstruido para ${dateISO}.`);
    } catch (e) {
      setError?.(`No se pudo reconstruir ${dateISO}: ${e.message}`);
    } finally {
      setLoadingData(false);
    }
  }, [db, buildRealtimeDay, setSuccess, setError]);

  /* ===================================
     Cierre automático diario (para AYER)
     =================================== */
  useEffect(() => {
    if (!isAuthReady) return;

    const saveDay = async () => {
      try {
        const now = new Date();
        // Usar fecha local de Colombia para evitar desfases
        const todayISO = getColombiaLocalDateString();
        const y = new Date(now);
        y.setHours(0, 0, 0, 0);
        y.setDate(y.getDate() - 1);
        const yesterdayISO = y.toISOString().split('T')[0];

        const inDayISO = (ts, targetISO) => {
          const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
          if (!d) return false;
          return d.toISOString().split('T')[0] === targetISO;
        };

        let da = 0, dd = 0, ma = 0, md = 0, la = 0, ld = 0;

        orders.forEach((o) => {
          if (inDayISO(o.createdAt, yesterdayISO)) da += Number(o.total || 0);
        });

        // Incluir también clientOrders en domicilios almuerzo de AYER
        (clientOrders || []).forEach((o) => {
          let isSame = false;
          if (o.createdAt && inDayISO(o.createdAt, yesterdayISO)) isSame = true;
          else if (typeof o.createdAtLocal === 'string' && o.createdAtLocal.split('T')[0] === yesterdayISO) isSame = true;
          if (isSame) da += Number(o.total || 0);
        });

        salonOrders.forEach((t) => {
          if (!inDayISO(t.createdAt, yesterdayISO)) return;
          const amount = Number(t.total || 0);
          if (amount <= 0) return;
          const esDesayuno = isBreakfastOrder(t);
          const serv = (normalizeServiceFromOrder(t) || 'mesa').toLowerCase();
          if (esDesayuno) { if (serv==='mesa') md += amount; else if (serv==='llevar') ld += amount; }
          else { if (serv==='mesa') ma += amount; else if (serv==='llevar') la += amount; }
        });

        // Desayunos de salón (ayer)
        breakfastSalonOrders.forEach((b) => {
          const bISO = getDocDateISO(b);
          if (bISO !== yesterdayISO) return;
          const amount = Number(b.total || 0);
          const serv = (normalizeServiceFromOrder(b) || 'mesa').toLowerCase();
          if (serv==='mesa') md += amount; else if (serv==='llevar') ld += amount; else if (serv==='domicilio') dd += amount;
        });

        // Desayunos delivery (ayer)
        breakfastOrders.forEach((b) => {
          const bISO = getDocDateISO(b);
          if (bISO !== yesterdayISO) return;
          const amount = Number(b.total || 0);
          const service = normalizeServiceFromOrder(b);
          const hasAddr = !!(b.address?.address || b.breakfasts?.[0]?.address?.address);
          if (service === 'mesa') md += amount;
          else if (service === 'llevar') ld += amount;
          else if (service === 'domicilio' || (!service && hasAddr)) dd += amount;
          else dd += amount;
        });

        const payloadY = {
          date: yesterdayISO,
          categories: {
            domiciliosAlmuerzo: da,
            domiciliosDesayuno: dd,
            mesasAlmuerzo: ma,
            mesasDesayuno: md,
            llevarAlmuerzo: la,
            llevarDesayuno: ld,
          },
          totalIncome: da + dd + ma + md + la + ld,
          updatedAt: serverTimestamp(),
        };

        // Upsert AYER
        const qY = query(collection(db, INGRESOS_COLLECTION), where('date', '==', yesterdayISO));
        const snapY = await getDocs(qY);
        if (snapY.empty) {
          await addDoc(collection(db, INGRESOS_COLLECTION), { ...payloadY, createdAt: serverTimestamp() });
        } else {
          await updateDoc(doc(db, INGRESOS_COLLECTION, snapY.docs[0].id), payloadY);
        }

        // Sembrar HOY vacío si no existe
        const qToday = query(collection(db, INGRESOS_COLLECTION), where('date', '==', todayISO));
        const snapToday = await getDocs(qToday);
        if (snapToday.empty) {
          await addDoc(collection(db, INGRESOS_COLLECTION), {
            date: todayISO,
            categories: { domiciliosAlmuerzo: 0, domiciliosDesayuno: 0, mesasAlmuerzo: 0, mesasDesayuno: 0 },
            totalIncome: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (e) {
        setError?.(`Cierre automático: ${e.message}`);
        console.error('Cierre automático diario', e);
      }
    };

    // Programar a las 00:00:05
    const schedule = () => {
      const now = new Date();
      const next = new Date(now);
      next.setDate(now.getDate() + 1);
      next.setHours(0, 0, 5, 0);
      const ms = next.getTime() - now.getTime();
      return setTimeout(async () => {
        await saveDay();
        schedule();
      }, ms);
    };

    const timer = schedule();
    return () => clearTimeout(timer);
  }, [isAuthReady, orders, salonOrders, breakfastOrders, breakfastSalonOrders, setError]);

  /* ==========================================
     Guardar / borrar conteo de pedidos diarios
     ========================================== */
  const handleDeleteDailyIngresos = useCallback(async () => {
    setLoadingData(true);
    try {
      const today = getColombiaLocalDateString();
      const q = query(collection(db, INGRESOS_COLLECTION), where('date', '==', today));
      const existingSummarySnapshot = await getDocs(q);

      if (!existingSummarySnapshot.empty) {
        const docToDelete = existingSummarySnapshot.docs[0];
        await deleteDoc(doc(db, INGRESOS_COLLECTION, docToDelete.id));
        setSuccess?.(`Resumen de ingresos para ${today} eliminado correctamente.`);
      } else {
        setSuccess?.(`No se encontró un resumen de ingresos para ${today} para eliminar.`);
      }
    } catch (error) {
      setError?.(`Error al eliminar resumen de ingresos: ${error.message}`);
      console.error('Error al eliminar ingresos diarios:', error);
    } finally {
      setLoadingData(false);
    }
  }, [db, setSuccess, setError]);

  const handleSaveDailyOrders = useCallback(async () => {
    setLoadingData(true);
    try {
      const today = getColombiaLocalDateString();
      let currentDayDomicilios = 0;
      let currentDayMesas = 0;

      orders.forEach((order) => {
        const orderDate = order.createdAt?.toDate
          ? new Date(order.createdAt.toDate()).toISOString().split('T')[0]
          : null;
        if (orderDate === today) currentDayDomicilios++;
      });

      salonOrders.forEach((tableOrder) => {
        const tableOrderDate = tableOrder.createdAt?.toDate
          ? new Date(tableOrder.createdAt.toDate()).toISOString().split('T')[0]
          : null;
        if (tableOrderDate === today) currentDayMesas++;
      });

      // ⬇️ contar también las órdenes de desayunos de salón
      breakfastSalonOrders.forEach((bo) => {
        const dISO = bo.createdAt?.toDate
          ? new Date(bo.createdAt.toDate()).toISOString().split('T')[0]
          : getDocDateISO(bo);
        if (dISO === today) currentDayMesas++;
      });

      const q = query(collection(db, PEDIDOS_DIARIOS_GUARDADOS_COLLECTION), where('date', '==', today));
      const existingSummarySnapshot = await getDocs(q);

      if (existingSummarySnapshot.empty) {
        await addDoc(collection(db, PEDIDOS_DIARIOS_GUARDADOS_COLLECTION), {
          date: today,
          domicilios: currentDayDomicilios,
          mesas: currentDayMesas,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setSuccess?.(`Conteo de pedidos diarios para ${today} guardado correctamente.`);
      } else {
        const docToUpdate = existingSummarySnapshot.docs[0];
        await updateDoc(doc(db, PEDIDOS_DIARIOS_GUARDADOS_COLLECTION, docToUpdate.id), {
          domicilios: currentDayDomicilios,
          mesas: currentDayMesas,
          updatedAt: serverTimestamp(),
        });
        setSuccess?.(`Conteo de pedidos diarios para ${today} actualizado correctamente.`);
      }
    } catch (error) {
      setError?.(`Error al guardar/actualizar conteo de pedidos diarios: ${error.message}`);
      console.error('Error al guardar conteo de pedidos diarios:', error);
    } finally {
      setLoadingData(false);
    }
  }, [db, orders, salonOrders, breakfastSalonOrders, setSuccess, setError]);

  const handleDeleteDailyOrders = useCallback(async () => {
    setLoadingData(true);
    try {
      const today = getColombiaLocalDateString();
      const q = query(collection(db, PEDIDOS_DIARIOS_GUARDADOS_COLLECTION), where('date', '==', today));
      const existingSummarySnapshot = await getDocs(q);

      if (!existingSummarySnapshot.empty) {
        const docToDelete = existingSummarySnapshot.docs[0];
        await deleteDoc(doc(db, PEDIDOS_DIARIOS_GUARDADOS_COLLECTION, docToDelete.id));
        setSuccess?.(`Conteo de pedidos diarios para ${today} eliminado correctamente.`);
      } else {
        setSuccess?.(`No se encontró un conteo de pedidos diarios para ${today} para eliminar.`);
      }
    } catch (error) {
      setError?.(`Error al eliminar conteo de pedidos diarios: ${error.message}`);
      console.error('Error al eliminar conteo de pedidos diarios:', error);
    } finally {
      setLoadingData(false);
    }
  }, [db, setSuccess, setError]);

  /* ============
     Retorno hook
     ============ */
  // Filtrar arrays por la fecha seleccionada para el dashboard
  const selectedDateDashboard = selectedDate || getColombiaLocalDateString();
  const filterByDate = (arr, getDateFn) => (arr || []).filter(o => {
    const dISO = getDateFn(o);
    return dISO === selectedDateDashboard;
  });
  const filteredOrders = filterByDate(orders, o => o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toISOString().split('T')[0] : (typeof o.createdAtLocal === 'string' ? o.createdAtLocal.split('T')[0] : null));
  const filteredClientOrders = filterByDate(clientOrders, o => o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toISOString().split('T')[0] : (typeof o.createdAtLocal === 'string' ? o.createdAtLocal.split('T')[0] : null));
  // Unificar domicilios almuerzo de ambas colecciones
  const unifiedDeliveryOrders = [...filteredOrders];
  filteredClientOrders.forEach(o => { if(!unifiedDeliveryOrders.find(x => x.id === o.id)) unifiedDeliveryOrders.push(o); });
  const filteredTableOrders = filterByDate(tableOrders, o => o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toISOString().split('T')[0] : null);
  const filteredWaiterOrders = filterByDate(waiterOrders, o => o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toISOString().split('T')[0] : null);
  const filteredBreakfastOrders = filterByDate(breakfastOrders, getDocDateISO);
  const filteredBreakfastSalonOrders = filterByDate(breakfastSalonOrders, o => o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toISOString().split('T')[0] : getDocDateISO(o));

  // Exponer un cómputo reutilizable de conteos por fecha (para gráficos que
  // necesiten reconstruir meses/años con desglose desayuno/almuerzo por servicio)
  const getCountsForDate = useCallback((iso) => {
    if (!iso || typeof iso !== 'string' || iso.length < 10) return null;
    let selDom = 0, selMes = 0;
    let s_dDes = 0, s_dAlm = 0, s_mDes = 0, s_mAlm = 0, s_lDes = 0, s_lAlm = 0;
    let countLunchUnitsSel = null;
    try { ({ countLunchUnitsSel } = require('../utils/orderUnits')); } catch(e){ countLunchUnitsSel = null; }

    const unitsOf = (o, isDes) => isDes ? 1 : (countLunchUnitsSel ? countLunchUnitsSel(o) : 1);

    // Orders + clientOrders (domicilios almuerzo/desayuno)
    (orders||[]).forEach(order => {
      const dISO = order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toISOString().split('T')[0] : null;
      if (dISO === iso) {
        selDom++;
        const esDes = isBreakfastOrder(order);
        const serv = (normalizeServiceFromOrder(order) || 'domicilio').toLowerCase();
        const u = unitsOf(order, esDes);
        if (serv === 'domicilio') { if (esDes) s_dDes += 1; else s_dAlm += u; }
        else if (serv === 'mesa') { if (esDes) s_mDes += 1; else s_mAlm += u; }
        else if (serv === 'llevar') { if (esDes) s_lDes += 1; else s_lAlm += u; }
        else { if (esDes) s_dDes += 1; else s_dAlm += u; }
      }
    });
    (clientOrders||[]).forEach(order => {
      const dISO = order.createdAt?.toDate
        ? new Date(order.createdAt.toDate()).toISOString().split('T')[0]
        : (typeof order.createdAtLocal === 'string' ? order.createdAtLocal.split('T')[0] : null);
      if (dISO === iso) {
        selDom++;
        const esDes = isBreakfastOrder(order);
        const serv = (normalizeServiceFromOrder(order) || 'domicilio').toLowerCase();
        const u = unitsOf(order, esDes);
        if (serv === 'domicilio') { if (esDes) s_dDes += 1; else s_dAlm += u; }
        else if (serv === 'mesa') { if (esDes) s_mDes += 1; else s_mAlm += u; }
        else if (serv === 'llevar') { if (esDes) s_lDes += 1; else s_lAlm += u; }
        else { if (esDes) s_dDes += 1; else s_dAlm += u; }
      }
    });

    // Salón (tableOrders + waiterOrders combinados en salonOrders)
    (salonOrders||[]).forEach(tableOrder => {
      const dISO = tableOrder.createdAt?.toDate ? new Date(tableOrder.createdAt.toDate()).toISOString().split('T')[0] : getDocDateISO(tableOrder);
      if (dISO === iso) {
        selMes++;
        const esDes = isBreakfastOrder(tableOrder);
        const serv = (normalizeServiceFromOrder(tableOrder) || 'mesa').toLowerCase();
        const u = unitsOf(tableOrder, esDes);
        if (serv === 'mesa') { if (esDes) s_mDes += 1; else s_mAlm += u; }
        else if (serv === 'llevar') { if (esDes) s_lDes += 1; else s_lAlm += u; }
        else if (serv === 'domicilio') { if (esDes) s_dDes += 1; else s_dAlm += u; }
      }
    });

    // Breakfast delivery
    (breakfastOrders||[]).forEach(b => {
      const dISO = getDocDateISO(b);
      if (dISO === iso) {
        const serv = (normalizeServiceFromOrder(b) || 'domicilio').toLowerCase();
        if (serv === 'domicilio') { s_dDes++; selDom++; }
        else if (serv === 'llevar') { s_lDes++; }
        else if (serv === 'mesa') { s_mDes++; selMes++; }
        else { s_dDes++; selDom++; }
      }
    });

    // Breakfast salón
    (breakfastSalonOrders||[]).forEach(bo => {
      const dISO = bo.createdAt?.toDate ? new Date(bo.createdAt.toDate()).toISOString().split('T')[0] : getDocDateISO(bo);
      if (dISO === iso) {
        const serv = (normalizeServiceFromOrder(bo) || 'mesa').toLowerCase();
        if (serv === 'mesa') { s_mDes++; selMes++; }
        else if (serv === 'llevar') { s_lDes++; }
        else if (serv === 'domicilio') { s_dDes++; selDom++; }
        else { s_mDes++; selMes++; }
      }
    });

    return {
      Domicilios: selDom,
      Mesas: selMes,
      domiciliosDesayuno: s_dDes,
      domiciliosAlmuerzo: s_dAlm,
      mesasDesayuno: s_mDes,
      mesasAlmuerzo: s_mAlm,
      llevarDesayuno: s_lDes,
      llevarAlmuerzo: s_lAlm,
    };
  }, [orders, clientOrders, salonOrders, breakfastOrders, breakfastSalonOrders]);

  return {
    loadingData,
  orders: unifiedDeliveryOrders,
    tableOrders: filteredTableOrders,
    waiterOrders: filteredWaiterOrders,
    breakfastOrders: filteredBreakfastOrders,        // delivery
    breakfastSalonOrders: filteredBreakfastSalonOrders,   // salón
    users,
    totals,
    almuerzosUnidadesHoy, // unidades de almuerzo (domicilio + salón) para hoy
    statusCounts,
    userActivity,
    ingresosData,                 // registros diarios guardados de ingresos
    pedidosDiariosGuardadosData,  // registros diarios guardados de pedidos
    paymentsRaw,                  // gastos crudos para gráficos avanzados
    paymentsAllRaw,               // gastos globales para rangos

    // ALIAS para DashboardCharts:
    ingresosCategoriasData: dailySalesChartData,
    gastosPorTiendaData: Object.entries(totals?.expensesByProvider?.byProvider || {})
      .map(([name, value]) => ({ name, value })),
    pedidosDiariosChartData: dailyOrdersChartData,
    statusPieChartData,
    periodStructures,
    saleTypeBreakdown,
    getCountsForDate,
    handleSaveDailyIngresos,
    handleDeleteDailyIngresos,
    handleRebuildDailyIngresos,
    handleSaveDailyOrders,
    handleDeleteDailyOrders,
  };
};
