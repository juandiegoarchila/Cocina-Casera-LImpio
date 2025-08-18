// src/hooks/useDashboardData.js
import { useState, useEffect, useRef, useCallback } from 'react';
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

// --- Helpers ---
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

// Normaliza fecha de docs con createdAt / timestamp / date
const getDocDateISO = (doc) => {
  const ts = doc?.createdAt || doc?.timestamp || doc?.date;
  const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
  return d ? d.toISOString().split('T')[0] : null;
};

// ---------- NUEVOS HELPERS (agregación por tipo de venta) ----------
const isBreakfastOrder = (o) =>
  Boolean(
    o?.isBreakfast ||
    o?.meal === 'breakfast' ||
    (Array.isArray(o?.breakfasts) && o.breakfasts.length > 0)
  );

const normalizeServiceFromOrder = (o) => {
  const v = (
    o?.orderTypeNormalized ??
    o?.serviceType ??
    o?.orderType ??
    o?.channel ??
    o?.tipoPedido ??
    o?.typeOfOrder ??
    ''
  ).toString().toLowerCase();

  if (/mesa|table|sal[oó]n|dine/.test(v)) return 'mesa';
  if (/llevar|para\s*llevar|take(?:-|\s)?away|to-?go|takeout/.test(v)) return 'llevar';
  if (/domicil|deliver|env[ií]o/.test(v)) return 'domicilio';
  return null;
};

const buildSaleTypeBreakdown = (orders = []) => {
  const acc = {
    // Domicilios
    domicilio_almuerzo: 0,
    domicilio_desayuno: 0,
    // Salón
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
    // lo demás queda con defaults
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
    // Estos no existen en esa firma
    notify = null;
    startOfDay = null;
    endOfDay = null;
    selectedDate = null;
  }

  const [loadingData, setLoadingData] = useState(true);
  const [orders, setOrders] = useState([]);
  const [tableOrders, setTableOrders] = useState([]);
  const [breakfastOrders, setBreakfastOrders] = useState([]);
  const [users, setUsers] = useState([]);

  const [totals, setTotals] = useState({
    cash: 0,
    cashCaja: 0,
    cashPendiente: 0,
    daviplata: 0,
    nequi: 0,
    expenses: 0,
    expensesByProvider: { total: 0, byProvider: {}, counts: {} }, // 👈 NUEVO
    byCategory: {
      domiciliosAlmuerzo: 0,
      mesasAlmuerzo: 0,
      llevarAlmuerzo: 0,       // 👈 NUEVO
      domiciliosDesayuno: 0,
      mesasDesayuno: 0,
      llevarDesayuno: 0,       // 👈 NUEVO
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

  const initialLoadRefs = useRef({
    orders: false,
    tableOrders: false,
    breakfastOrders: false,
    users: false,
    activity: false,
    ingresos: false,
    pedidosDiariosGuardados: false,
    payments: false, // para gastos
  });

  const checkIfAllLoaded = () => {
    if (
      initialLoadRefs.current.orders &&
      initialLoadRefs.current.tableOrders &&
      initialLoadRefs.current.breakfastOrders &&
      initialLoadRefs.current.users &&
      initialLoadRefs.current.activity &&
      initialLoadRefs.current.ingresos &&
      initialLoadRefs.current.pedidosDiariosGuardados &&
      initialLoadRefs.current.payments
    ) {
      setLoadingData(false);
    }
  };

  // --- Sumas por categoría (robusto con normalización + detección desayuno/almuerzo) ---
  useEffect(() => {
    const sum = {
      domiciliosAlmuerzo: 0,
      mesasAlmuerzo: 0,
      llevarAlmuerzo: 0,
      domiciliosDesayuno: 0,
      mesasDesayuno: 0,
      llevarDesayuno: 0,
    };

    // 1) Almuerzo: 'orders' (legacy: delivery de almuerzo)
    sum.domiciliosAlmuerzo = orders.reduce((acc, o) => acc + Number(o.total || 0), 0);

    // 2) Salón (y llevar) en 'tableOrders' — separar desayuno vs almuerzo
    for (const t of tableOrders) {
      const amount = Number(t.total || 0);
      if (amount <= 0) continue;

      const esDesayuno = isBreakfastOrder(t);           // ✅ detecta si esta orden de mesa es desayuno
      const service = normalizeServiceFromOrder(t)      // ✅ 'mesa' | 'llevar' | 'domicilio' | null
                      || 'mesa';                        //     default razonable en salón

      if (!esDesayuno) {
        if (service === 'mesa') sum.mesasAlmuerzo += amount;
        else if (service === 'llevar') sum.llevarAlmuerzo += amount;
        else if (service === 'domicilio') sum.domiciliosAlmuerzo += amount; // por si llegara algo mal guardado
        else sum.mesasAlmuerzo += amount; // fallback
      } else {
        if (service === 'mesa') sum.mesasDesayuno += amount;
        else if (service === 'llevar') sum.llevarDesayuno += amount;
        else if (service === 'domicilio') sum.domiciliosDesayuno += amount;
        else sum.mesasDesayuno += amount; // fallback
      }
    }

    // 3) 'deliveryBreakfastOrders' — normalmente son domicilios, pero normalizamos por si hay mesa/llevar
    for (const b of breakfastOrders) {
      const amount = Number(b.total || 0);
      if (amount <= 0) continue;

      const service = normalizeServiceFromOrder(b);
      const hasAddr = !!(b.address?.address || b.breakfasts?.[0]?.address?.address);

      if (service === 'mesa') sum.mesasDesayuno += amount;
      else if (service === 'llevar') sum.llevarDesayuno += amount;
      else if (service === 'domicilio' || (!service && hasAddr)) sum.domiciliosDesayuno += amount;
      else sum.domiciliosDesayuno += amount; // fallback conservador
    }

    const gross =
      sum.domiciliosAlmuerzo +
      sum.mesasAlmuerzo +
      sum.llevarAlmuerzo +
      sum.domiciliosDesayuno +
      sum.mesasDesayuno +
      sum.llevarDesayuno;

    setTotals(prev => ({
      ...prev,
      byCategory: sum,
      grossIncome: gross,
      net: Math.max(gross - (prev.expenses || 0), 0),
    }));

    // Mantén este breakdown (ya usaba la normalización correcta)
    const mixed = [...orders, ...tableOrders, ...breakfastOrders];
    setSaleTypeBreakdown(buildSaleTypeBreakdown(mixed));
  }, [orders, tableOrders, breakfastOrders]);



  // --- Suscripciones a Firestore ---
  useEffect(() => {
    if (!db || !userId || !isAuthReady) {
      return;
    }

    setLoadingData(true);
    const unsubscribes = [];

    // Orders
    const ordersCollectionRef = collection(db, 'orders');
    const unsubscribeOrders = onSnapshot(
      ordersCollectionRef,
      (snapshot) => {
        const ordersData = snapshot.docs.map((doc) => ({ id: doc.id, __collection: 'orders', ...doc.data() }));
        setOrders(ordersData);

        const newTotals = { cash: 0, daviplata: 0, nequi: 0 };
        const newStatusCounts = { Pending: 0, Delivered: 0, Cancelled: 0 };

        ordersData.forEach((order) => {
          const paymentSummary = order.paymentSummary || {};
          newTotals.cash += Number(paymentSummary['Efectivo'] || 0);
          newTotals.daviplata += Number(paymentSummary['Daviplata'] || 0);
          newTotals.nequi += Number(paymentSummary['Nequi'] || 0);

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

        if (!initialLoadRefs.current.orders) {
          initialLoadRefs.current.orders = true;
          checkIfAllLoaded();
        }
      },
      (error) => {
        setError(`Error al cargar pedidos: ${error.message}`);
        if (!initialLoadRefs.current.orders) {
          initialLoadRefs.current.orders = true;
          checkIfAllLoaded();
        }
      }
    );
    unsubscribes.push(unsubscribeOrders);

    // Table orders
    const tableOrdersCollectionRef = collection(db, 'tableOrders');
    const unsubscribeTableOrders = onSnapshot(
      tableOrdersCollectionRef,
      (snapshot) => {
        const tableOrdersData = snapshot.docs.map((doc) => ({ id: doc.id, __collection: 'tableOrders', ...doc.data() }));
        setTableOrders(tableOrdersData);

        if (!initialLoadRefs.current.tableOrders) {
          initialLoadRefs.current.tableOrders = true;
          checkIfAllLoaded();
        }
      },
      (error) => {
        setError(`Error al cargar pedidos de mesa: ${error.message}`);
        if (!initialLoadRefs.current.tableOrders) {
          initialLoadRefs.current.tableOrders = true;
          checkIfAllLoaded();
        }
      }
    );
    unsubscribes.push(unsubscribeTableOrders);

    // Breakfast orders (deliveryBreakfastOrders)
    const deliveryBreakfastOrdersRef = collection(db, 'deliveryBreakfastOrders');
    const unsubscribeBreakfastOrders = onSnapshot(
      deliveryBreakfastOrdersRef,
      (snapshot) => {
        const breakfastOrdersData = snapshot.docs.map((doc) => ({ id: doc.id, __collection: 'deliveryBreakfastOrders', ...doc.data() }));
        setBreakfastOrders(breakfastOrdersData);
        if (!initialLoadRefs.current.breakfastOrders) {
          initialLoadRefs.current.breakfastOrders = true;
          checkIfAllLoaded();
        }
      },
      (error) => {
        setError(`Error al cargar desayunos: ${error.message}`);
        if (!initialLoadRefs.current.breakfastOrders) {
          initialLoadRefs.current.breakfastOrders = true;
          checkIfAllLoaded();
        }
      }
    );
    unsubscribes.push(unsubscribeBreakfastOrders);

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
        setError(`Error al cargar usuarios: ${error.message}`);
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
        setError(`Error al cargar actividad: ${error.message}`);
        if (!initialLoadRefs.current.activity) {
          initialLoadRefs.current.activity = true;
          checkIfAllLoaded();
        }
      }
    );
    unsubscribes.push(unsubscribeActivity);

    // Ingresos
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
        setError(`Error al cargar ingresos: ${error.message}`);
        if (!initialLoadRefs.current.ingresos) {
          initialLoadRefs.current.ingresos = true;
          checkIfAllLoaded();
        }
      }
    );
    unsubscribes.push(unsubscribeIngresos);

    // Pedidos diarios guardados
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
        setError(`Error al cargar pedidos diarios guardados: ${error.message}`);
        if (!initialLoadRefs.current.pedidosDiariosGuardados) {
          initialLoadRefs.current.pedidosDiariosGuardados = true;
          checkIfAllLoaded();
        }
      }
    );
    unsubscribes.push(unsubscribePedidosDiariosGuardados);

    // Payments (gastos) — filtra por la FECHA seleccionada si startOfDay/endOfDay existen
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
        // Ignorar docs sin timestamp aún (serverTimestamp “en vuelo”)
        const items = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => !!p.timestamp);

        let totalExpenses = 0;
        const byProvider = {};
        const counts = {};

        for (const p of items) {
          const amount = Number(p.amount || 0);
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


    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [db, userId, isAuthReady]); // 👈 evita el bucle

  // --- Recalcular métodos de pago sumando orders + mesas + desayunos ---
  useEffect(() => {
    const m = calcMethodTotalsAll(orders, tableOrders, breakfastOrders);
    setTotals((prev) => ({
      ...prev,
      // Compatibilidad: mantenemos 'cash' pero ahora equivale a lo que realmente está en caja
      cash: m.cashCaja,
      // Nuevos campos explícitos (opcionales para UI):
      cashCaja: m.cashCaja,
      cashPendiente: m.cashClientesPendiente,
      daviplata: m.daviplataTotal,
      nequi: m.nequiTotal,
    }));
  }, [orders, tableOrders, breakfastOrders]);

  // --- Daily Sales Chart (categorías) ---
  useEffect(() => {
    if (!isAuthReady) return;

    const monthNames = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
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

      // Realtime del mes actual
      const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      let rt = { da: 0, dd: 0, ma: 0, md: 0 };

      orders.forEach((o) => {
        const d = o.createdAt?.toDate ? new Date(o.createdAt.toDate()) : null;
        if (d && d.getFullYear() === currentYear && d.getMonth() === today.getMonth())
          rt.da += Number(o.total || 0);
      });
      tableOrders.forEach((t) => {
        const d = t.createdAt?.toDate ? new Date(t.createdAt.toDate()) : null;
        if (d && d.getFullYear() === currentYear && d.getMonth() === today.getMonth())
          rt.ma += Number(t.total || 0);
      });
      breakfastOrders.forEach((b) => {
        const dISO = getDocDateISO(b);
        if (dISO) {
          const d = new Date(dISO);
          if (d.getFullYear() === currentYear && d.getMonth() === today.getMonth()) {
            const amount = Number(b.total || 0);
            const orderType = (b.breakfasts?.[0]?.orderType || b.orderType || '').toLowerCase();
            const hasAddress = !!(b.address?.address || b.breakfasts?.[0]?.address?.address);
            if (orderType === 'table' || orderType === 'takeaway') rt.md += amount;
            else if (hasAddress) rt.dd += amount;
            else rt.dd += amount;
          }
        }
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

      // Realtime del rango
      if (today >= salesStartDate && today <= salesEndDate) {
        let da = 0,
          dd = 0,
          ma = 0,
          md = 0;

        orders.forEach((o) => {
          const dISO = o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toISOString().split('T')[0] : null;
          if (
            dISO &&
            dISO >= salesStartDate.toISOString().split('T')[0] &&
            dISO <= salesEndDate.toISOString().split('T')[0]
          ) {
            da += Number(o.total || 0);
          }
        });
        tableOrders.forEach((t) => {
          const dISO = t.createdAt?.toDate ? new Date(t.createdAt.toDate()).toISOString().split('T')[0] : null;
          if (
            dISO &&
            dISO >= salesStartDate.toISOString().split('T')[0] &&
            dISO <= salesEndDate.toISOString().split('T')[0]
          ) {
            ma += Number(t.total || 0);
          }
        });
        breakfastOrders.forEach((b) => {
          const dISO = getDocDateISO(b);
          if (
            dISO &&
            dISO >= salesStartDate.toISOString().split('T')[0] &&
            dISO <= salesEndDate.toISOString().split('T')[0]
          ) {
            const amount = Number(b.total || 0);
            const orderType = (b.breakfasts?.[0]?.orderType || b.orderType || '').toLowerCase();
            const hasAddress = !!(b.address?.address || b.breakfasts?.[0]?.address?.address);
            if (orderType === 'table' || orderType === 'takeaway') md += amount;
            else if (hasAddress) dd += amount;
            else dd += amount;
          }
        });

        const k = todayISO;
        filteredDailySales[k] = {
          'Domicilios Almuerzo': (filteredDailySales[k]?.['Domicilios Almuerzo'] || 0) + da,
          'Domicilios Desayuno': (filteredDailySales[k]?.['Domicilios Desayuno'] || 0) + dd,
          'Mesas/Llevar Almuerzo': (filteredDailySales[k]?.['Mesas/Llevar Almuerzo'] || 0) + ma,
          'Mesas/Llevar Desayuno': (filteredDailySales[k]?.['Mesas/Llevar Desayuno'] || 0) + md,
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

    setDailySalesChartData(chartData);
  }, [
    orders,
    tableOrders,
    breakfastOrders,
    ingresosData,
    salesFilterRange,
    salesCustomStartDate,
    salesCustomEndDate,
    isAuthReady,
    selectedMonth,
  ]);

  // --- Daily Orders Chart (conteos) ---
  useEffect(() => {
    if (!isAuthReady) return;

    const monthNames = [
      'Enero',
      'Febrero',
      'Marzo',
      'Abril',
      'Mayo',
      'Junio',
      'Julio',
      'Agosto',
      'Septiembre',
      'Octubre',
      'Noviembre',
      'Diciembre',
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

      tableOrders.forEach((tableOrder) => {
        const d = tableOrder.createdAt?.toDate ? new Date(tableOrder.createdAt.toDate()) : null;
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

        orders.forEach((order) => {
          const orderDate = order.createdAt?.toDate
            ? new Date(order.createdAt.toDate()).toISOString().split('T')[0]
            : null;
          if (orderDate === todayISO) {
            currentDayRealtimeDomicilios++;
          }
        });

        tableOrders.forEach((tableOrder) => {
          const tableOrderDate = tableOrder.createdAt?.toDate
            ? new Date(tableOrder.createdAt.toDate()).toISOString().split('T')[0]
            : null;
          if (tableOrderDate === todayISO) {
            currentDayRealtimeMesas++;
          }
        });

        if (ordersFilterRange === 'year' && selectedMonth) {
          const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
          if (currentMonth === selectedMonth) {
            filteredDailyOrders[todayISO] = {
              Domicilios: (filteredDailyOrders[todayISO]?.Domicilios || 0) + currentDayRealtimeDomicilios,
              Mesas: (filteredDailyOrders[todayISO]?.Mesas || 0) + currentDayRealtimeMesas,
            };
          }
        } else {
          filteredDailyOrders[todayISO] = {
            Domicilios: (filteredDailyOrders[todayISO]?.Domicilios || 0) + currentDayRealtimeDomicilios,
            Mesas: (filteredDailyOrders[todayISO]?.Mesas || 0) + currentDayRealtimeMesas,
          };
        }
      }

      const sortedDates = Object.keys(filteredDailyOrders).sort((a, b) => new Date(a) - new Date(b));
      chartData = sortedDates.map((date) => ({
        name: date,
        Domicilios: filteredDailyOrders[date].Domicilios,
        Mesas: filteredDailyOrders[date].Mesas,
      }));
    }

    setDailyOrdersChartData(chartData);
  }, [
    orders,
    tableOrders,
    pedidosDiariosGuardadosData,
    ordersFilterRange,
    ordersCustomStartDate,
    ordersCustomEndDate,
    isAuthReady,
    selectedMonth,
  ]);

  // --- Guardar ingresos diarios (hoy) ---
  const handleSaveDailyIngresos = useCallback(async () => {
    setLoadingData(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      let da = 0,
        dd = 0,
        ma = 0,
        md = 0;

      orders.forEach((o) => {
        const dISO = o.createdAt?.toDate ? new Date(o.createdAt.toDate()).toISOString().split('T')[0] : null;
        if (dISO === today) da += Number(o.total || 0);
      });
      tableOrders.forEach((t) => {
        const dISO = t.createdAt?.toDate ? new Date(t.createdAt.toDate()).toISOString().split('T')[0] : null;
        if (dISO === today) ma += Number(t.total || 0);
      });
      breakfastOrders.forEach((b) => {
        if (getDocDateISO(b) === today) {
          const amount = Number(b.total || 0);
          const orderType = (b.breakfasts?.[0]?.orderType || b.orderType || '').toLowerCase();
          const hasAddress = !!(b.address?.address || b.breakfasts?.[0]?.address?.address);
          if (orderType === 'table' || orderType === 'takeaway') md += amount;
          else if (hasAddress) dd += amount;
          else dd += amount;
        }
      });

      const totalIncome = da + dd + ma + md;

      const qY = query(collection(db, INGRESOS_COLLECTION), where('date', '==', today));
      const snap = await getDocs(qY);
      const payload = {
        date: today,
        categories: {
          domiciliosAlmuerzo: da,
          domiciliosDesayuno: dd,
          mesasAlmuerzo: ma,
          mesasDesayuno: md,
        },
        totalIncome,
        updatedAt: serverTimestamp(),
      };

      if (snap.empty) {
        await addDoc(collection(db, INGRESOS_COLLECTION), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        setSuccess(`Resumen de ingresos para ${today} guardado correctamente.`);
      } else {
        await updateDoc(doc(db, INGRESOS_COLLECTION, snap.docs[0].id), payload);
        setSuccess(`Resumen de ingresos para ${today} actualizado correctamente.`);
      }
    } catch (error) {
      setError(`Error al guardar/actualizar resumen de ingresos: ${error.message}`);
      console.error('Error al guardar ingresos diarios:', error);
    } finally {
      setLoadingData(false);
    }
  }, [db, orders, tableOrders, breakfastOrders, setSuccess, setError]);

  // --- Cierre automático diario (ayer) ---
  useEffect(() => {
    if (!isAuthReady) return;

    const saveDay = async () => {
      try {
        const now = new Date();
        const todayISO = now.toISOString().split('T')[0];
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        y.setHours(0, 0, 0, 0);
        const yesterdayISO = y.toISOString().split('T')[0];

        const inDayISO = (ts, targetISO) => {
          const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
          if (!d) return false;
          return d.toISOString().split('T')[0] === targetISO;
        };

        let da = 0,
          dd = 0,
          ma = 0,
          md = 0;

        orders.forEach((o) => {
          if (inDayISO(o.createdAt, yesterdayISO)) da += Number(o.total || 0);
        });
        tableOrders.forEach((t) => {
          if (inDayISO(t.createdAt, yesterdayISO)) ma += Number(t.total || 0);
        });
        breakfastOrders.forEach((b) => {
          const bISO = getDocDateISO(b);
          if (bISO !== yesterdayISO) return;
          const amount = Number(b.total || 0);
          const orderType = (b.breakfasts?.[0]?.orderType || b.orderType || '').toLowerCase();
          const hasAddress = !!(b.address?.address || b.breakfasts?.[0]?.address?.address);
          if (orderType === 'table' || orderType === 'takeaway') md += amount;
          else if (hasAddress) dd += amount;
          else dd += amount;
        });

        const payloadY = {
          date: yesterdayISO,
          categories: {
            domiciliosAlmuerzo: da,
            domiciliosDesayuno: dd,
            mesasAlmuerzo: ma,
            mesasDesayuno: md,
          },
          totalIncome: da + dd + ma + md,
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
  }, [isAuthReady, orders, tableOrders, breakfastOrders, setError]);

  // --- Guardar / borrar conteo de pedidos diarios ---
  const handleDeleteDailyIngresos = useCallback(async () => {
    setLoadingData(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const q = query(collection(db, INGRESOS_COLLECTION), where('date', '==', today));
      const existingSummarySnapshot = await getDocs(q);

      if (!existingSummarySnapshot.empty) {
        const docToDelete = existingSummarySnapshot.docs[0];
        await deleteDoc(doc(db, INGRESOS_COLLECTION, docToDelete.id));
        setSuccess(`Resumen de ingresos para ${today} eliminado correctamente.`);
      } else {
        setSuccess(`No se encontró un resumen de ingresos para ${today} para eliminar.`);
      }
    } catch (error) {
      setError(`Error al eliminar resumen de ingresos: ${error.message}`);
      console.error('Error al eliminar ingresos diarios:', error);
    } finally {
      setLoadingData(false);
    }
  }, [db, setSuccess, setError]);

  const handleSaveDailyOrders = useCallback(async () => {
    setLoadingData(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      let currentDayDomicilios = 0;
      let currentDayMesas = 0;

      orders.forEach((order) => {
        const orderDate = order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toISOString().split('T')[0] : null;
        if (orderDate === today) {
          currentDayDomicilios++;
        }
      });

      tableOrders.forEach((tableOrder) => {
        const tableOrderDate = tableOrder.createdAt?.toDate
          ? new Date(tableOrder.createdAt.toDate()).toISOString().split('T')[0]
          : null;
        if (tableOrderDate === today) {
          currentDayMesas++;
        }
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
        setSuccess(`Conteo de pedidos diarios para ${today} guardado correctamente.`);
      } else {
        const docToUpdate = existingSummarySnapshot.docs[0];
        await updateDoc(doc(db, PEDIDOS_DIARIOS_GUARDADOS_COLLECTION, docToUpdate.id), {
          domicilios: currentDayDomicilios,
          mesas: currentDayMesas,
          updatedAt: serverTimestamp(),
        });
        setSuccess(`Conteo de pedidos diarios para ${today} actualizado correctamente.`);
      }
    } catch (error) {
      setError(`Error al guardar/actualizar conteo de pedidos diarios: ${error.message}`);
      console.error('Error al guardar conteo de pedidos diarios:', error);
    } finally {
      setLoadingData(false);
    }
  }, [db, orders, tableOrders, setSuccess, setError]);

  const handleDeleteDailyOrders = useCallback(async () => {
    setLoadingData(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const q = query(collection(db, PEDIDOS_DIARIOS_GUARDADOS_COLLECTION), where('date', '==', today));
      const existingSummarySnapshot = await getDocs(q);

      if (!existingSummarySnapshot.empty) {
        const docToDelete = existingSummarySnapshot.docs[0];
        await deleteDoc(doc(db, PEDIDOS_DIARIOS_GUARDADOS_COLLECTION, docToDelete.id));
        setSuccess(`Conteo de pedidos diarios para ${today} eliminado correctamente.`);
      } else {
        setSuccess(`No se encontró un conteo de pedidos diarios para ${today} para eliminar.`);
      }
    } catch (error) {
      setError(`Error al eliminar conteo de pedidos diarios: ${error.message}`);
      console.error('Error al eliminar conteo de pedidos diarios:', error);
    } finally {
      setLoadingData(false);
    }
  }, [db, setSuccess, setError]);

  return {
    loadingData,
    orders,
    tableOrders,
    breakfastOrders,
    users,
    totals,
    statusCounts,
    userActivity,

    // ALIAS para que coincida con tu DashboardCharts:
    ingresosCategoriasData: dailySalesChartData,
    gastosPorTiendaData: Object.entries(totals?.expensesByProvider?.byProvider || {})
      .map(([name, value]) => ({ name, value })),
    pedidosDiariosChartData: dailyOrdersChartData,
    statusPieChartData,

    // NUEVO: desglose robusto por Tipo de Venta
    saleTypeBreakdown,

    // (si ya los tienes) — handlers:
    handleSaveDailyIngresos,
    handleDeleteDailyIngresos,
    handleSaveDailyOrders,
    handleDeleteDailyOrders,
  };

};
