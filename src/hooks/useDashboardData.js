// src/hooks/useDashboardData.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, onSnapshot, query, where, Timestamp, getDocs, addDoc, setDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { ORDER_STATUS, ORDER_STATUS_DISPLAY, PIE_COLORS, INGRESOS_COLLECTION, PEDIDOS_DIARIOS_GUARDADOS_COLLECTION } from '../components/Admin/dashboardConstants';

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
export const useDashboardData = (db, userId, isAuthReady, setError, setSuccess, salesFilterRange, salesCustomStartDate, salesCustomEndDate, ordersFilterRange, ordersCustomStartDate, ordersCustomEndDate, selectedMonth) => {
  const [loadingData, setLoadingData] = useState(true);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [totals, setTotals] = useState({ cash: 0, daviplata: 0, nequi: 0 });
  const [statusCounts, setStatusCounts] = useState({ Pending: 0, Delivered: 0, Cancelled: 0 });
  const [userActivity, setUserActivity] = useState([]);
  const [ingresosData, setIngresosData] = useState([]);
  const [pedidosDiariosGuardadosData, setPedidosDiariosGuardadosData] = useState([]);
  const [dailySalesChartData, setDailySalesChartData] = useState([]);
  const [dailyOrdersChartData, setDailyOrdersChartData] = useState([]);
  const [statusPieChartData, setStatusPieChartData] = useState([]);

  const initialLoadRefs = useRef({
    orders: false,
    users: false,
    activity: false,
    ingresos: false,
    pedidosDiariosGuardados: false
  });

  const checkIfAllLoaded = () => {
    if (
      initialLoadRefs.current.orders &&
      initialLoadRefs.current.users &&
      initialLoadRefs.current.activity &&
      initialLoadRefs.current.ingresos &&
      initialLoadRefs.current.pedidosDiariosGuardados
    ) {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!db || !userId || !isAuthReady) {
      return;
    }

    setLoadingData(true);

    const unsubscribes = [];

    const ordersCollectionRef = collection(db, 'orders');
    const unsubscribeOrders = onSnapshot(ordersCollectionRef, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);

      const newTotals = { cash: 0, daviplata: 0, nequi: 0 };
      const newStatusCounts = { Pending: 0, Delivered: 0, Cancelled: 0 };

      ordersData.forEach(order => {
        const paymentSummary = order.paymentSummary || {};
        newTotals.cash += paymentSummary['Efectivo'] || 0;
        newTotals.daviplata += paymentSummary['Daviplata'] || 0;
        newTotals.nequi += paymentSummary['Nequi'] || 0;

        const orderStatus = order.status?.toLowerCase() || '';
        if (orderStatus === ORDER_STATUS.PENDING) newStatusCounts.Pending += 1;
        else if (orderStatus === ORDER_STATUS.DELIVERED) newStatusCounts.Delivered += 1;
        else if (orderStatus === ORDER_STATUS.CANCELLED) newStatusCounts.Cancelled += 1;
      });

      setTotals(newTotals);
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
    }, (error) => {
      setError(`Error al cargar pedidos: ${error.message}`);
      if (!initialLoadRefs.current.orders) {
        initialLoadRefs.current.orders = true;
        checkIfAllLoaded();
      }
    });
    unsubscribes.push(unsubscribeOrders);

    const usersCollectionRef = collection(db, 'users');
    const unsubscribeUsers = onSnapshot(usersCollectionRef, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
      if (!initialLoadRefs.current.users) {
        initialLoadRefs.current.users = true;
        checkIfAllLoaded();
      }
    }, (error) => {
      setError(`Error al cargar usuarios: ${error.message}`);
      if (!initialLoadRefs.current.users) {
        initialLoadRefs.current.users = true;
        checkIfAllLoaded();
      }
    });
    unsubscribes.push(unsubscribeUsers);

    const userActivityCollectionRef = collection(db, 'userActivity');
    const unsubscribeActivity = onSnapshot(userActivityCollectionRef, (snapshot) => {
      const activity = snapshot.docs.map(doc => {
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
    }, (error) => {
      setError(`Error al cargar actividad: ${error.message}`);
      if (!initialLoadRefs.current.activity) {
        initialLoadRefs.current.activity = true;
        checkIfAllLoaded();
      }
    });
    unsubscribes.push(unsubscribeActivity);

    const ingresosColRef = collection(db, INGRESOS_COLLECTION);
    const unsubscribeIngresos = onSnapshot(ingresosColRef, (snapshot) => {
      const ingresosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setIngresosData(ingresosData);
      if (!initialLoadRefs.current.ingresos) {
        initialLoadRefs.current.ingresos = true;
        checkIfAllLoaded();
      }
    }, (error) => {
      setError(`Error al cargar ingresos: ${error.message}`);
      if (!initialLoadRefs.current.ingresos) {
        initialLoadRefs.current.ingresos = true;
        checkIfAllLoaded();
      }
    });
    unsubscribes.push(unsubscribeIngresos);

    const pedidosDiariosGuardadosColRef = collection(db, PEDIDOS_DIARIOS_GUARDADOS_COLLECTION);
    const unsubscribePedidosDiariosGuardados = onSnapshot(pedidosDiariosGuardadosColRef, (snapshot) => {
      const pedidosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPedidosDiariosGuardadosData(pedidosData);
      if (!initialLoadRefs.current.pedidosDiariosGuardados) {
        initialLoadRefs.current.pedidosDiariosGuardados = true;
        checkIfAllLoaded();
      }
    }, (error) => {
      setError(`Error al cargar pedidos diarios guardados: ${error.message}`);
      if (!initialLoadRefs.current.pedidosDiariosGuardados) {
        initialLoadRefs.current.pedidosDiariosGuardados = true;
        checkIfAllLoaded();
      }
    });
    unsubscribes.push(unsubscribePedidosDiariosGuardados);

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [db, userId, isAuthReady, setError]);

useEffect(() => {
  if (!isAuthReady) return;

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const { startDate: salesStartDate, endDate: salesEndDate } = getDateRange(salesFilterRange, salesCustomStartDate, salesCustomEndDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString().split('T')[0];
  let chartData;

  if (salesFilterRange === 'year' && !selectedMonth) {
    const monthlySales = {};
    const currentYear = today.getFullYear();

    for (let month = 0; month < 12; month++) {
      const monthKey = `${currentYear}-${String(month + 1).padStart(2, '0')}`;
      monthlySales[monthKey] = { Efectivo: 0, Daviplata: 0, Nequi: 0 };
    }

    ingresosData.forEach(summary => {
      const date = new Date(summary.date);
      if (date.getFullYear() === currentYear) {
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlySales[monthKey].Efectivo += summary.cash || 0;
        monthlySales[monthKey].Daviplata += summary.daviplata || 0;
        monthlySales[monthKey].Nequi += summary.nequi || 0;
      }
    });

    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    let currentMonthRealtimeCash = 0;
    let currentMonthRealtimeDaviplata = 0;
    let currentMonthRealtimeNequi = 0;

    orders.forEach(order => {
      const orderDate = order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toISOString().split('T')[0] : null;
      if (orderDate && orderDate >= salesStartDate.toISOString().split('T')[0] && orderDate <= salesEndDate.toISOString().split('T')[0]) {
        const paymentSummary = order.paymentSummary || {};
        currentMonthRealtimeCash += paymentSummary['Efectivo'] || 0;
        currentMonthRealtimeDaviplata += paymentSummary['Daviplata'] || 0;
        currentMonthRealtimeNequi += paymentSummary['Nequi'] || 0;
      }
    });

    monthlySales[currentMonthKey] = {
      Efectivo: monthlySales[currentMonthKey].Efectivo + currentMonthRealtimeCash,
      Daviplata: monthlySales[currentMonthKey].Daviplata + currentMonthRealtimeDaviplata,
      Nequi: monthlySales[currentMonthKey].Nequi + currentMonthRealtimeNequi,
    };

    chartData = Object.keys(monthlySales).map(monthKey => ({
      name: monthNames[parseInt(monthKey.split('-')[1]) - 1],
      monthKey: monthKey,
      Efectivo: monthlySales[monthKey].Efectivo,
      Daviplata: monthlySales[monthKey].Daviplata,
      Nequi: monthlySales[monthKey].Nequi,
    }));
  } else {
    const filteredDailySales = {};

    // Agregar datos históricos de ingresosData según el rango o mes seleccionado
    ingresosData.forEach(summary => {
      const summaryDate = new Date(summary.date).toISOString().split('T')[0];
      if (summaryDate >= salesStartDate.toISOString().split('T')[0] && summaryDate <= salesEndDate.toISOString().split('T')[0]) {
        if (salesFilterRange === 'year' && selectedMonth) {
          const monthKey = `${new Date(summary.date).getFullYear()}-${String(new Date(summary.date).getMonth() + 1).padStart(2, '0')}`;
          if (monthKey === selectedMonth) {
            filteredDailySales[summaryDate] = {
              Efectivo: (filteredDailySales[summaryDate]?.Efectivo || 0) + (summary.cash || 0),
              Daviplata: (filteredDailySales[summaryDate]?.Daviplata || 0) + (summary.daviplata || 0),
              Nequi: (filteredDailySales[summaryDate]?.Nequi || 0) + (summary.nequi || 0)
            };
          }
        } else {
          filteredDailySales[summaryDate] = {
            Efectivo: (filteredDailySales[summaryDate]?.Efectivo || 0) + (summary.cash || 0),
            Daviplata: (filteredDailySales[summaryDate]?.Daviplata || 0) + (summary.daviplata || 0),
            Nequi: (filteredDailySales[summaryDate]?.Nequi || 0) + (summary.nequi || 0)
          };
        }
      }
    });

    // Agregar datos en tiempo real solo si el día actual está dentro del rango o mes seleccionado
    if (today >= salesStartDate && today <= salesEndDate) {
      let currentDayRealtimeCash = 0;
      let currentDayRealtimeDaviplata = 0;
      let currentDayRealtimeNequi = 0;

      orders.forEach(order => {
        const orderDate = order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toISOString().split('T')[0] : null;
        if (orderDate && orderDate >= salesStartDate.toISOString().split('T')[0] && orderDate <= salesEndDate.toISOString().split('T')[0]) {
          const paymentSummary = order.paymentSummary || {};
          currentDayRealtimeCash += paymentSummary['Efectivo'] || 0;
          currentDayRealtimeDaviplata += paymentSummary['Daviplata'] || 0;
          currentDayRealtimeNequi += paymentSummary['Nequi'] || 0;
        }
      });

      if (salesFilterRange === 'year' && selectedMonth) {
        const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        if (currentMonth === selectedMonth) {
          filteredDailySales[todayISO] = {
            Efectivo: (filteredDailySales[todayISO]?.Efectivo || 0) + currentDayRealtimeCash,
            Daviplata: (filteredDailySales[todayISO]?.Daviplata || 0) + currentDayRealtimeDaviplata,
            Nequi: (filteredDailySales[todayISO]?.Nequi || 0) + currentDayRealtimeNequi
          };
        }
      } else {
        filteredDailySales[todayISO] = {
          Efectivo: (filteredDailySales[todayISO]?.Efectivo || 0) + currentDayRealtimeCash,
          Daviplata: (filteredDailySales[todayISO]?.Daviplata || 0) + currentDayRealtimeDaviplata,
          Nequi: (filteredDailySales[todayISO]?.Nequi || 0) + currentDayRealtimeNequi
        };
      }
    }

    const sortedDates = Object.keys(filteredDailySales).sort((a, b) => new Date(a) - new Date(b));
    chartData = sortedDates.map(date => ({
      name: date,
      Efectivo: filteredDailySales[date].Efectivo,
      Daviplata: filteredDailySales[date].Daviplata,
      Nequi: filteredDailySales[date].Nequi
    }));
  }

  setDailySalesChartData(chartData);

  const { startDate: ordersStartDate, endDate: ordersEndDate } = getDateRange(ordersFilterRange, ordersCustomStartDate, ordersCustomEndDate);
  const filteredDailyOrders = {};

  pedidosDiariosGuardadosData.forEach(summary => {
    const summaryDate = new Date(summary.date);
    if (summaryDate >= ordersStartDate && summaryDate <= ordersEndDate) {
      filteredDailyOrders[summary.date] = summary.count || 0;
    }
  });

  if (today >= ordersStartDate && today <= ordersEndDate) {
    let currentDayRealtimeOrdersCount = 0;
    orders.forEach(order => {
      const orderDate = order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toISOString().split('T')[0] : null;
      if (orderDate === todayISO) {
        currentDayRealtimeOrdersCount++;
      }
    });
    filteredDailyOrders[todayISO] = currentDayRealtimeOrdersCount;
  }

  const sortedOrderDates = Object.keys(filteredDailyOrders).sort((a, b) => new Date(a) - new Date(b));
  const finalDailyOrdersChartData = sortedOrderDates.map(date => ({ name: date, Pedidos: filteredDailyOrders[date] }));
  setDailyOrdersChartData(finalDailyOrdersChartData);
}, [orders, ingresosData, pedidosDiariosGuardadosData, salesFilterRange, salesCustomStartDate, salesCustomEndDate, ordersFilterRange, ordersCustomStartDate, ordersCustomEndDate, isAuthReady, selectedMonth]);

  const handleSaveDailyIngresos = useCallback(async () => {
    setLoadingData(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      let currentDayCash = 0;
      let currentDayDaviplata = 0;
      let currentDayNequi = 0;

      orders.forEach(order => {
        const orderDate = order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toISOString().split('T')[0] : null;
        if (orderDate === today) {
          const paymentSummary = order.paymentSummary;
          if (paymentSummary) {
            currentDayCash += paymentSummary['Efectivo'] || 0;
            currentDayDaviplata += paymentSummary['Daviplata'] || 0;
            currentDayNequi += paymentSummary['Nequi'] || 0;
          } else {
            const paymentType = order.payment?.toLowerCase() || order.meals?.[0]?.payment?.name?.toLowerCase();
            const amount = order.total || 0;
            if (paymentType === 'efectivo') currentDayCash += amount;
            else if (paymentType === 'daviplata') currentDayDaviplata += amount;
            else if (paymentType === 'nequi') currentDayNequi += amount;
          }
        }
      });

      const currentDayTotalSales = currentDayCash + currentDayDaviplata + currentDayNequi;

      const q = query(collection(db, INGRESOS_COLLECTION), where('date', '==', today));
      const existingSummarySnapshot = await getDocs(q);

      if (existingSummarySnapshot.empty) {
        await addDoc(collection(db, INGRESOS_COLLECTION), {
          date: today,
          cash: currentDayCash,
          daviplata: currentDayDaviplata,
          nequi: currentDayNequi,
          totalSales: currentDayTotalSales,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setSuccess(`Resumen de ingresos para ${today} guardado correctamente.`);
      } else {
        const docToUpdate = existingSummarySnapshot.docs[0];
        await updateDoc(doc(db, INGRESOS_COLLECTION, docToUpdate.id), {
          cash: currentDayCash,
          daviplata: currentDayDaviplata,
          nequi: currentDayNequi,
          totalSales: currentDayTotalSales,
          updatedAt: serverTimestamp(),
        });
        setSuccess(`Resumen de ingresos para ${today} actualizado correctamente.`);
      }
    } catch (error) {
      setError(`Error al guardar/actualizar resumen de ingresos: ${error.message}`);
      console.error("Error al guardar ingresos diarios:", error);
    } finally {
      setLoadingData(false);
    }
  }, [db, orders, setSuccess, setError]);

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
      console.error("Error al eliminar ingresos diarios:", error);
    } finally {
      setLoadingData(false);
    }
  }, [db, setSuccess, setError]);

  const handleSaveDailyOrders = useCallback(async () => {
    setLoadingData(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      let currentDayOrdersCount = 0;

      orders.forEach(order => {
        const orderDate = order.createdAt?.toDate ? new Date(order.createdAt.toDate()).toISOString().split('T')[0] : null;
        if (orderDate === today) {
          currentDayOrdersCount++;
        }
      });

      const q = query(collection(db, PEDIDOS_DIARIOS_GUARDADOS_COLLECTION), where('date', '==', today));
      const existingSummarySnapshot = await getDocs(q);

      if (existingSummarySnapshot.empty) {
        await addDoc(collection(db, PEDIDOS_DIARIOS_GUARDADOS_COLLECTION), {
          date: today,
          count: currentDayOrdersCount,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setSuccess(`Conteo de pedidos diarios para ${today} guardado correctamente.`);
      } else {
        const docToUpdate = existingSummarySnapshot.docs[0];
        await updateDoc(doc(db, PEDIDOS_DIARIOS_GUARDADOS_COLLECTION, docToUpdate.id), {
          count: currentDayOrdersCount,
          updatedAt: serverTimestamp(),
        });
        setSuccess(`Conteo de pedidos diarios para ${today} actualizado correctamente.`);
      }
    } catch (error) {
      setError(`Error al guardar/actualizar conteo de pedidos diarios: ${error.message}`);
      console.error("Error al guardar conteo de pedidos diarios:", error);
    } finally {
      setLoadingData(false);
    }
  }, [db, orders, setSuccess, setError]);

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
      console.error("Error al eliminar conteo de pedidos diarios:", error);
    } finally {
      setLoadingData(false);
    }
  }, [db, setSuccess, setError]);

  return {
    loadingData,
    orders,
    users,
    totals,
    statusCounts,
    userActivity,
    dailySalesChartData,
    dailyOrdersChartData,
    statusPieChartData,
    handleSaveDailyIngresos,
    handleDeleteDailyIngresos,
    handleSaveDailyOrders,
    handleDeleteDailyOrders,
  };
};