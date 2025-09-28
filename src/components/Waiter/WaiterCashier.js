// src/components/Waiter/WaiterCashier.js
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../config/firebase';
import { collection, onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { 
  MagnifyingGlassIcon, 
  CurrencyDollarIcon, 
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  CreditCardIcon,
  BanknotesIcon,
  DevicePhoneMobileIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

const WaiterCashier = ({ setError, setSuccess, theme, canDeleteAll = false }) => {
  const [tableOrders, setTableOrders] = useState([]);
  const [breakfastOrders, setBreakfastOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState('simple'); // 'simple', 'split'
  const [paymentData, setPaymentData] = useState({});
  const [paymentLines, setPaymentLines] = useState([]); // para modo split: { method, amount }
  const [cashAmount, setCashAmount] = useState('');
  // Adicionales que el cliente pidió (antes de confirmar pago)
  const [addedItems, setAddedItems] = useState([]); // { id, name, amount }
  const [newAddedName, setNewAddedName] = useState('');
  const [newAddedAmount, setNewAddedAmount] = useState('');

  // Si cambian los adicionales, ajustar el monto a pagar automáticamente en modo simple
  useEffect(() => {
    if (!selectedOrder) return;
    const base = parseFloat(selectedOrder.total || 0) || 0;
    const addedTotal = (addedItems || []).reduce((s, a) => s + (Number(a.amount || 0)), 0);
    if (paymentMode === 'simple') {
      setPaymentData(prev => ({ ...prev, amount: Math.round(base + addedTotal) }));
    }
  }, [addedItems, selectedOrder, paymentMode]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Estados para calculadora de vueltos
  const [showChangeCalculator, setShowChangeCalculator] = useState(false);
  const [calculatedChange, setCalculatedChange] = useState(0);

  // Cargar órdenes de mesas en tiempo real
  useEffect(() => {
    const unsubscribeTable = onSnapshot(collection(db, 'tableOrders'), (snapshot) => {
      const orders = snapshot.docs.map(d => ({ id: d.id, ...d.data(), orderType: 'mesa' }));
      setTableOrders(orders);
    }, (error) => setError(`Error al cargar órdenes de mesa: ${error.message}`));

    const unsubscribeBreakfast = onSnapshot(collection(db, 'breakfastOrders'), (snapshot) => {
      const orders = snapshot.docs.map(d => ({ id: d.id, ...d.data(), orderType: 'desayuno' }));
      setBreakfastOrders(orders);
    }, (error) => setError(`Error al cargar órdenes de desayuno: ${error.message}`));

    return () => {
      unsubscribeTable();
      unsubscribeBreakfast();
    };
  }, [setError]);

  // Actualizar hora cada segundo
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Combinar todas las órdenes y organizarlas
  const allOrders = useMemo(() => {
    const combined = [...tableOrders, ...breakfastOrders];
    return combined
      .filter(order => !order.isPaid)
      .filter(order => {
        return (
          searchTerm === '' ||
          (order.tableNumber && order.tableNumber.toString().includes(searchTerm)) ||
          (order.customerName && order.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (order.customerPhone && order.customerPhone.includes(searchTerm)) ||
          (order.id && order.id.includes(searchTerm))
        );
      })
      .sort((a, b) => {
        const timeA = new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt);
        const timeB = new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt);
        return timeA - timeB;
      });
  }, [tableOrders, breakfastOrders, searchTerm]);

  // Agrupar órdenes por mesa
  const ordersByTable = useMemo(() => {
    const grouped = {};
    allOrders.forEach(order => {
      const tableNum = order.tableNumber || 'Sin mesa';
      if (!grouped[tableNum]) grouped[tableNum] = [];
      grouped[tableNum].push(order);
    });
    return grouped;
  }, [allOrders]);

  // Órdenes pagadas (para sección de completadas)
  const paidOrdersByTable = useMemo(() => {
    const combined = [...tableOrders, ...breakfastOrders];
    const paid = combined.filter(o => o.isPaid);
    const grouped = {};
    paid.forEach(order => {
      const tableNum = order.tableNumber || 'Sin mesa';
      if (!grouped[tableNum]) grouped[tableNum] = [];
      grouped[tableNum].push(order);
    });
    return grouped;
  }, [tableOrders, breakfastOrders]);

  // Estadísticas del día
  const dayStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const paidToday = [...tableOrders, ...breakfastOrders].filter(order => {
      if (!order.isPaid || !order.paymentDate) return false;
      const orderDate = new Date(order.paymentDate.seconds * 1000 || order.paymentDate).toISOString().split('T')[0];
      return orderDate === today;
    });

    // Total general (suma de totales)
    const totalAmount = paidToday.reduce((sum, order) => sum + (parseFloat(order.total) || 0), 0);

    // Sumar montos por método de pago (tener en cuenta paymentLines si existen)
    const paymentSums = paidToday.reduce((acc, order) => {
      // Si la orden tiene paymentLines, sumar cada línea por su método
      if (order.paymentLines && Array.isArray(order.paymentLines) && order.paymentLines.length > 0) {
        order.paymentLines.forEach(line => {
          const method = line.method || 'efectivo';
          const amt = parseFloat(line.amount) || 0;
          acc[method] = (acc[method] || 0) + amt;
        });
      } else {
        const method = order.paymentMethod || 'efectivo';
        const amt = parseFloat(order.paymentAmount || order.total) || 0;
        acc[method] = (acc[method] || 0) + amt;
      }
      return acc;
    }, {});

    return {
      totalOrders: paidToday.length,
      totalAmount,
      efectivo: paymentSums.efectivo || 0,
      nequi: paymentSums.nequi || 0,
      daviplata: paymentSums.daviplata || 0
    };
  }, [tableOrders, breakfastOrders]);

  // Formatear precio
  const formatPrice = (price) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  // Obtener etiqueta legible para una orden: preferir order.tableNumber, si no existe
  // usar order.meals[0]?.tableNumber (caso donde la mesa se guardó en la primera comida),
  // si no hay mesa, mostrar 'Para llevar' o un fallback con id.
  const getOrderLabel = (order) => {
    if (!order) return '';
    // Intentar obtener número de mesa desde order.tableNumber o desde la primera comida
    let tableNumRaw = order.tableNumber || (order.meals && order.meals[0] && order.meals[0].tableNumber) || null;
    if (tableNumRaw) {
      // Normalizar: eliminar la palabra 'Mesa' si ya está incluida y trim
      const cleaned = String(tableNumRaw).replace(/Mesa\s*/i, '').trim();
      return `Mesa ${cleaned}`;
    }
    if (order.takeaway || order.isTakeaway) return 'Para llevar';
    return `Orden #${String(order.id || '').substring(0,8)}`;
  };

  // Obtener color de estado por tiempo de espera
  const getUrgencyColor = (createdAt) => {
    const now = new Date();
    const orderTime = new Date(createdAt?.seconds * 1000 || createdAt);
    const minutesWaiting = (now - orderTime) / (1000 * 60);
    
    if (minutesWaiting > 30) return 'red';
    if (minutesWaiting > 15) return 'yellow';
    return 'green';
  };

  // Obtener ícono por método de pago
  const getPaymentIcon = (method) => {
    switch(method) {
      case 'efectivo': return <BanknotesIcon className="w-5 h-5" />;
      case 'nequi': return <DevicePhoneMobileIcon className="w-5 h-5" />;
      case 'daviplata': return <CreditCardIcon className="w-5 h-5" />;
      default: return <CurrencyDollarIcon className="w-5 h-5" />;
    }
  };

  // Abrir modal de pago
  const handleOpenPayment = (order) => {
    setSelectedOrder(order);
    setPaymentMode('simple');
    setPaymentData({
      method: 'efectivo',
      amount: parseFloat(order.total) || 0,
      note: ''
    });
    setPaymentLines([]);
    setCashAmount('');
    setCalculatedChange(0);
    setShowChangeCalculator(false);
    // Inicializar adicionales desde la orden si existen
    setAddedItems(Array.isArray(order.addedItems) ? order.addedItems.map((it, idx) => ({ id: it.id || idx, name: it.name, amount: Number(it.amount || 0) })) : []);
    setNewAddedName('');
    setNewAddedAmount('');
    setShowPaymentModal(true);
  };

  // Calcular vueltos
  const calculateChange = (totalAmount, paidAmount) => {
    const change = paidAmount - totalAmount;
    // Si no hay cambio o pago insuficiente devolver estructura vacía con ceros
    const bills = [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500];
    const breakdown = {};
    if (change <= 0) {
      // inicializar todas las denominaciones en 0 y resto 0
      bills.forEach(b => { breakdown[b] = 0; });
      return { total: 0, breakdown, remaining: 0 };
    }

    let remaining = Math.round(change);

    // Greedy: siempre generar una entrada (incluso si es 0) para cada denominación
    bills.forEach(bill => {
      const count = Math.floor(remaining / bill);
      breakdown[bill] = count;
      remaining -= count * bill;
    });

    // 'remaining' ahora contiene el resto menor a la denominación más pequeña (500)
    return { total: change, breakdown, remaining };
  };

  // Procesar pago
  const handleProcessPayment = async () => {
    if (!selectedOrder) return;

    try {
      console.log('Procesando pago - debug', { orderId: selectedOrder.id, addedItems, paymentData, paymentMode, paymentLines });
      const updateData = {
        isPaid: true,
        status: 'Completada',
        paymentDate: serverTimestamp(),
        paymentMethod: paymentData.method,
        // paymentAmount se calculará más abajo para garantizar que incluye 'addedItems' o 'paymentLines'
        paymentAmount: paymentData.amount,
        updatedAt: serverTimestamp()
      };

      // Preparar lista final de adicionales: incluir cualquiera que esté en los inputs pero no se haya añadido con +Añadir
      const finalAddedItems = [];
      if (Array.isArray(addedItems) && addedItems.length) {
        finalAddedItems.push(...addedItems.map(a => ({ id: a.id, name: a.name, amount: Number(a.amount || 0) })));
      }
      // Si el cajero escribió un adicional en los inputs pero no presionó +Añadir, incluirlo también
      if (newAddedName && newAddedAmount) {
        const pendingAmount = Math.floor(Number(newAddedAmount || 0));
        if (String(newAddedName).trim() !== '' && pendingAmount > 0) {
          const pending = { id: `${Date.now()}-pending`, name: String(newAddedName).trim(), amount: pendingAmount };
          finalAddedItems.push(pending);
        }
      }

      if (finalAddedItems.length) {
        const addedTotalFinal = finalAddedItems.reduce((s, a) => s + (Number(a.amount || 0)), 0);
        updateData.addedItems = finalAddedItems;
        updateData.total = (parseFloat(selectedOrder.total || 0) || 0) + addedTotalFinal;
      }

      if (paymentData.note) updateData.paymentNote = paymentData.note;
      if (paymentData.method === 'efectivo' && cashAmount) {
        updateData.cashReceived = parseFloat(cashAmount);
        updateData.changeGiven = calculatedChange;
      }

      const collection_name = selectedOrder.orderType === 'mesa' ? 'tableOrders' : 'breakfastOrders';
      // Si es pago dividido, añadimos paymentLines
  // Calcular total de adicionales si existen (usar finalAddedItems si está definido)
  const addedTotal = (typeof finalAddedItems !== 'undefined' ? finalAddedItems : (addedItems || [])).reduce((s, a) => s + (Number(a.amount || 0)), 0);

      // Si es pago dividido, añadimos paymentLines y recalculamos paymentAmount
      if (paymentMode === 'split') {
        updateData.paymentLines = paymentLines.map(l => ({ method: l.method, amount: Number(l.amount) }));
        const linesTotal = paymentLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
        updateData.paymentAmount = Math.round(linesTotal + addedTotal);
        // Indicar método múltiple para evitar sobrescribir con paymentData.method que puede ser un método simple
        updateData.paymentMethod = 'multiple';
      } else {
        // Asegurar que paymentAmount refleje paymentData.amount actualizado (incluyendo adicionales)
        // Si el cajero no añadió la línea pero dejó los inputs con un valor pendiente, paymentData.amount puede no incluirlo,
        // por eso usamos selectedOrder.total + addedTotal como fuente de verdad si addedTotal > 0.
        if ((addedTotal || 0) > 0) {
          updateData.paymentAmount = Math.round((parseFloat(selectedOrder.total) || 0) + addedTotal);
        } else {
          updateData.paymentAmount = Math.round(parseFloat(paymentData.amount) || parseFloat(selectedOrder.total) || 0);
        }
      }

      console.log('Procesando pago - data a enviar a Firestore', { updateData, addedTotal, paymentLines });
      await updateDoc(doc(db, collection_name, selectedOrder.id), updateData);

      // Actualización optimista local para reflejar el pago inmediatamente en la UI
      const optimisticFields = {
        isPaid: true,
        status: 'Completada',
        paymentMethod: updateData.paymentMethod,
        paymentAmount: updateData.paymentAmount,
        paymentDate: new Date()
      };
      if (updateData.addedItems) optimisticFields.addedItems = updateData.addedItems;
      if (updateData.total) optimisticFields.total = updateData.total;
      if (updateData.paymentLines) optimisticFields.paymentLines = updateData.paymentLines;
      if (updateData.cashReceived) optimisticFields.cashReceived = updateData.cashReceived;
      if (updateData.changeGiven) optimisticFields.changeGiven = updateData.changeGiven;

      if (collection_name === 'tableOrders') {
        setTableOrders(prev => prev.map(o => o.id === selectedOrder.id ? ({ ...o, ...optimisticFields }) : o));
      } else {
        setBreakfastOrders(prev => prev.map(o => o.id === selectedOrder.id ? ({ ...o, ...optimisticFields }) : o));
      }

      setSuccess(`💰 Pago procesado exitosamente - ${paymentData.method.toUpperCase()}: ${formatPrice(paymentData.amount)}`);
      setShowPaymentModal(false);
      setSelectedOrder(null);
    } catch (error) {
      setError(`Error al procesar pago: ${error.message}`);
    }
  };

  // Gestión de adicionales (antes de confirmar)
  const addNewItem = () => {
    const name = String(newAddedName || '').trim();
    const amount = Math.floor(Number(newAddedAmount || 0));
    if (!name || !amount) return setError('Nombre y monto del adicional son obligatorios');
    const id = `${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    const newItem = { id, name, amount };
    console.log('Añadiendo adicional:', newItem);
    setAddedItems(prev => ([...prev, newItem]));
    setNewAddedName('');
    setNewAddedAmount('');
  };

  const removeAddedItem = (id) => setAddedItems(prev => prev.filter(i => i.id !== id));

  const editAddedItem = (id, patch) => setAddedItems(prev => prev.map(i => i.id === id ? ({ ...i, ...patch }) : i));

  // Añadidos: logs para depurar eliminación/edición
  const _removeAddedItem = (id) => { console.log('Eliminar adicional:', id); setAddedItems(prev => prev.filter(i => i.id !== id)); };
  const _editAddedItem = (id, patch) => { console.log('Editar adicional:', id, patch); setAddedItems(prev => prev.map(i => i.id === id ? ({ ...i, ...patch }) : i)); };

  // Configurar pago dividido
  const handleSplitPayment = (type) => {
    if (!selectedOrder) return;
    
    const total = parseFloat(selectedOrder.total) || 0;
    let splitAmount = 0;
    
    switch(type) {
      case '50-50':
        splitAmount = total / 2;
        break;
      case '1-3':
        splitAmount = total / 3;
        break;
      default:
        splitAmount = total;
    }
    
    setPaymentData(prev => ({
      ...prev,
      amount: Math.round(splitAmount),
      splitType: type
    }));
    setPaymentMode('split');
    // inicializar paymentLines dependiendo del tipo
    if (type === '50-50') {
      setPaymentLines([{ method: 'efectivo', amount: Math.round(total/2) }, { method: 'efectivo', amount: Math.round(total/2) }]);
    } else if (type === '1-3') {
      const part = Math.round(total/3);
      setPaymentLines([{ method: 'efectivo', amount: part }, { method: 'efectivo', amount: part }, { method: 'efectivo', amount: total - part*2 }]);
    } else {
      setPaymentLines([]);
    }
  };

  const splitTotal = useMemo(() => paymentLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0), [paymentLines]);
  const splitIsExact = useMemo(() => {
    const total = parseFloat(selectedOrder?.total || 0);
    return Math.round(splitTotal) === Math.round(total);
  }, [splitTotal, selectedOrder]);

  const addSplitLine = () => setPaymentLines(prev => ([...prev, { method: 'efectivo', amount: 0 }]));
  const removeSplitLine = (idx) => setPaymentLines(prev => prev.filter((_, i) => i !== idx));
  const updateSplitLine = (idx, patch) => setPaymentLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));

  const fillAllWith = (method) => setPaymentLines(prev => prev.map(l => ({ ...l, method })));

  // Recalcular automáticamente los vueltos cuando cambian las líneas, el monto en efectivo o el modo
  useEffect(() => {
    // Si no hay monto en efectivo ingresado, ocultar calculadora
    if (!cashAmount) {
      setCalculatedChange(0);
      setShowChangeCalculator(false);
      return;
    }

    // Determinar cuánto corresponde a efectivo: si está dividido, sumar sólo las líneas 'efectivo'
    const efectivoTotal = paymentMode === 'split'
      ? paymentLines.reduce((s, l) => s + (l.method === 'efectivo' ? (parseFloat(l.amount) || 0) : 0), 0)
      : (parseFloat(paymentData.amount) || 0);

    const changeInfo = calculateChange(efectivoTotal, parseFloat(cashAmount) || 0);
    setCalculatedChange(changeInfo.total);
    setShowChangeCalculator(Boolean(parseFloat(cashAmount)));
  }, [paymentLines, cashAmount, paymentMode, paymentData.amount]);

  // Botones rápidos para billetes
  const quickCashButtons = [10000, 20000, 50000, 100000];

  // Función para borrar todas las órdenes en las colecciones de mesero/desayuno
  const deleteAllOrders = async () => {
    if (!window.confirm('¿Eliminar todas las órdenes (mesa y desayuno)? Esto no se puede deshacer.')) return;
    try {
      const { getDocs, collection: coll, deleteDoc, doc: docRef } = await import('firebase/firestore');
      const tableSnapshot = await getDocs(coll(db, 'tableOrders'));
      for (const d of tableSnapshot.docs) {
        await deleteDoc(docRef(db, 'tableOrders', d.id));
      }
      const breakfastSnapshot = await getDocs(coll(db, 'breakfastOrders'));
      for (const d of breakfastSnapshot.docs) {
        await deleteDoc(docRef(db, 'breakfastOrders', d.id));
      }
      setSuccess('✅ Todas las órdenes fueron eliminadas');
    } catch (error) {
      setError(`Error eliminando órdenes: ${error.message}`);
    }
  };

  // Función para borrar todas las órdenes completadas (pagadas)
  const deleteCompletedOrders = async () => {
    if (!window.confirm('¿Eliminar todas las órdenes completadas (pagadas)? Esto no se puede deshacer.')) return;
    try {
      const { getDocs, collection: coll, deleteDoc, doc: docRef, query, where } = await import('firebase/firestore');
      // tableOrders pagadas
      const q1 = query(coll(db, 'tableOrders'), where('isPaid', '==', true));
      const tableSnapshot = await getDocs(q1);
      for (const d of tableSnapshot.docs) {
        await deleteDoc(docRef(db, 'tableOrders', d.id));
      }
      // breakfastOrders pagadas
      const q2 = query(coll(db, 'breakfastOrders'), where('isPaid', '==', true));
      const breakfastSnapshot = await getDocs(q2);
      for (const d of breakfastSnapshot.docs) {
        await deleteDoc(docRef(db, 'breakfastOrders', d.id));
      }
      setSuccess('✅ Todas las órdenes completadas fueron eliminadas');
    } catch (error) {
      setError(`Error eliminando órdenes completadas: ${error.message}`);
    }
  };

  // Borrar pedidos pagados por mesa (tableNumber)
  const deletePaidByTable = async (tableNumber) => {
    if (!window.confirm(`¿Eliminar las órdenes pagadas de ${tableNumber}? Esto no se puede deshacer.`)) return;
    try {
      const { getDocs, collection: coll, deleteDoc, doc: docRef, query, where } = await import('firebase/firestore');
      // Si la mesa es 'Sin mesa', buscamos documentos donde 'tableNumber' no exista o sea falsy
      if (tableNumber === 'Sin mesa') {
        const q1 = query(coll(db, 'tableOrders'), where('isPaid', '==', true));
        const tableSnapshot = await getDocs(q1);
        for (const d of tableSnapshot.docs) {
          const data = d.data();
          if (!data.tableNumber) await deleteDoc(docRef(db, 'tableOrders', d.id));
        }

        const q2 = query(coll(db, 'breakfastOrders'), where('isPaid', '==', true));
        const breakfastSnapshot = await getDocs(q2);
        for (const d of breakfastSnapshot.docs) {
          const data = d.data();
          if (!data.tableNumber) await deleteDoc(docRef(db, 'breakfastOrders', d.id));
        }

        // Actualizar estado local: remover órdenes sin tableNumber que estén pagadas
        setTableOrders(prev => prev.filter(o => !(o.isPaid && !o.tableNumber)));
        setBreakfastOrders(prev => prev.filter(o => !(o.isPaid && !o.tableNumber)));
        setSuccess(`✅ Órdenes pagadas de ${tableNumber} eliminadas`);
      } else {
        const q1 = query(coll(db, 'tableOrders'), where('tableNumber', '==', tableNumber), where('isPaid', '==', true));
        const tableSnapshot = await getDocs(q1);
        for (const d of tableSnapshot.docs) {
          await deleteDoc(docRef(db, 'tableOrders', d.id));
        }
        const q2 = query(coll(db, 'breakfastOrders'), where('tableNumber', '==', tableNumber), where('isPaid', '==', true));
        const breakfastSnapshot = await getDocs(q2);
        for (const d of breakfastSnapshot.docs) {
          await deleteDoc(docRef(db, 'breakfastOrders', d.id));
        }

        // Actualizar estado local: remover órdenes de la mesa específica
        setTableOrders(prev => prev.filter(o => !(o.isPaid && o.tableNumber === tableNumber)));
        setBreakfastOrders(prev => prev.filter(o => !(o.isPaid && o.tableNumber === tableNumber)));
        setSuccess(`✅ Órdenes pagadas de ${tableNumber} eliminadas`);
      }
    } catch (error) {
      setError(`Error eliminando órdenes pagadas de ${tableNumber}: ${error.message}`);
    }
  };

  // Borrar una orden individual por id (detecta collection por orderType)
  const deleteSingleOrder = async (order) => {
    if (!window.confirm(`¿Eliminar la orden ${order.id.substring(0,8)}? Esto no se puede deshacer.`)) return;
    try {
      const { deleteDoc, doc: docRef } = await import('firebase/firestore');
      const collectionName = order.orderType === 'mesa' ? 'tableOrders' : 'breakfastOrders';
      await deleteDoc(docRef(db, collectionName, order.id));
      setSuccess(`✅ Orden ${order.id.substring(0,8)} eliminada`);
      // Actualizar estado local para remover la orden de la UI sin esperar al snapshot
      if (collectionName === 'tableOrders') {
        setTableOrders(prev => prev.filter(o => o.id !== order.id));
      } else {
        setBreakfastOrders(prev => prev.filter(o => o.id !== order.id));
      }
    } catch (error) {
      setError(`Error eliminando orden: ${error.message}`);
    }
  };

  return (
    <div className="w-full mx-auto px-2 sm:px-4 lg:px-6 py-4 sm:py-6">
      {/* Header con estadísticas */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-100 flex items-center">
            <CurrencyDollarIcon className="w-6 h-6 mr-2" />
            💰 Caja Registradora
          </h2>
          <div className="flex items-center space-x-3">
            <div className="text-sm text-gray-400">{currentTime.toLocaleTimeString('es-CO')}</div>
            {/* Botón global de eliminar todas removido: ahora se usa el icono por mesa */}
          </div>
        </div>

        {/* Estadísticas del día */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4 mb-6 items-stretch">
          {!canDeleteAll && (
            <div className={`p-4 rounded-lg h-24 flex items-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border-l-4 border-green-500`}>
              <div className="flex items-center w-full justify-between">
                <div className="flex items-center">
                  <CheckCircleIcon className="w-8 h-8 text-green-500 mr-3" />
                  <div>
                    <div className="text-2xl font-bold text-green-600">{dayStats.totalOrders}</div>
                    <div className="text-xs text-gray-500">Pagadas Hoy</div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div className={`p-4 rounded-lg h-24 flex items-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border-l-4 border-purple-500`}>
            <div className="flex items-center w-full justify-between">
              <div className="flex items-center">
                <DevicePhoneMobileIcon className="w-6 h-6 text-purple-600 mr-2" />
                <div>
                  <div className="text-xl font-bold text-purple-600">{formatPrice(dayStats.nequi)}</div>
                  <div className="text-xs text-gray-500">Total Nequi</div>
                </div>
              </div>
            </div>
          </div>
          <div className={`p-4 rounded-lg h-24 flex items-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border-l-4 border-orange-500`}>
            <div className="flex items-center w-full justify-between">
              <div className="flex items-center">
                <CreditCardIcon className="w-6 h-6 text-orange-600 mr-2" />
                <div>
                  <div className="text-xl font-bold text-orange-600">{formatPrice(dayStats.daviplata)}</div>
                  <div className="text-xs text-gray-500">Total Daviplata</div>
                </div>
              </div>
            </div>
          </div>
          {/* Efectivo - siempre visible (conteo) */}
          <div className={`p-4 rounded-lg h-24 flex items-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border-l-4 border-gray-500`}>
            <div className="flex items-center w-full justify-between">
              <div className="flex items-center">
                <BanknotesIcon className="w-6 h-6 text-gray-600 mr-2" />
                <div>
                  <div className="text-xl font-bold text-gray-600">{formatPrice(dayStats.efectivo)}</div>
                  <div className="text-xs text-gray-500">Total Efectivo</div>
                </div>
              </div>
            </div>
          </div>
          {/* Total Día - siempre visible */}
          <div className={`p-4 rounded-lg h-24 flex items-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border-l-4 border-blue-500`}>
            <div className="flex items-center w-full justify-between">
              <div className="flex items-center">
                <CurrencyDollarIcon className="w-6 h-6 text-blue-600 mr-2" />
                <div>
                  <div className="text-xl font-bold text-blue-600">{formatPrice(dayStats.totalAmount)}</div>
                  <div className="text-xs text-gray-500">Total General</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Búsqueda: separada y con padding lateral */}
        <div className="px-4">
          <div className="relative mb-6">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por mesa, orden, cliente o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`w-full pl-10 pr-4 py-3 rounded-lg border ${
                theme === 'dark' 
                  ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400' 
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
            />
          </div>
        </div>
        {Object.entries(ordersByTable).map(([tableNumber, orders]) => {
          const unpaidOrders = orders.filter(order => !order.isPaid);
          const hasUnpaidOrders = unpaidOrders.length > 0;
          const totalAmount = unpaidOrders.reduce((sum, order) => sum + (parseFloat(order.total) || 0), 0);
          const oldestOrder = unpaidOrders.reduce((oldest, order) => {
            const orderTime = new Date(order.createdAt?.seconds * 1000 || order.createdAt);
            const oldestTime = new Date(oldest.createdAt?.seconds * 1000 || oldest.createdAt);
            return orderTime < oldestTime ? order : oldest;
          }, unpaidOrders[0]);
          
          const urgencyColor = oldestOrder ? getUrgencyColor(oldestOrder.createdAt) : 'gray';

          return (
            <div
              key={tableNumber}
              className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg p-6 border-l-4 ${
                urgencyColor === 'red' ? 'border-red-500' :
                urgencyColor === 'yellow' ? 'border-yellow-500' :
                urgencyColor === 'green' ? 'border-green-500' : 'border-gray-500'
              } hover:shadow-xl ${
                !hasUnpaidOrders ? 'opacity-50' : ''
              }`}
            >
              {/* Cabecera de mesa */}
              <div className="flex justify-between items-center mb-3">
                {canDeleteAll ? (
                  <h3 className="text-2xl font-bold text-gray-100">Pedidos <span className="text-sm text-gray-400 ml-2">{unpaidOrders.length}</span></h3>
                ) : (
                  <h3 className="text-2xl font-bold text-gray-100">🍽️ Mesa {tableNumber}</h3>
                )}
                <div className="text-right flex items-center space-x-2">
                  <div className="text-xs text-gray-400">{unpaidOrders.length} orden(es)</div>
                  {canDeleteAll && (
                    <button
                      onClick={async () => {
                        if (!window.confirm(`¿Eliminar ${unpaidOrders.length} orden(es) sin pagar de la mesa ${tableNumber}? Esto no se puede deshacer.`)) return;
                        try {
                          const { getDocs, collection: coll, deleteDoc, doc: docRef, query, where } = await import('firebase/firestore');
                          // Determinar colección a filtrar (tableOrders o breakfastOrders)
                          const tableSnapshot = await getDocs(coll(db, 'tableOrders'));
                          // Filtrar por tableNumber y isPaid=false
                          const q = query(coll(db, 'tableOrders'), where('tableNumber', '==', tableNumber), where('isPaid', '==', false));
                          const snapshot = await getDocs(q);
                          for (const d of snapshot.docs) {
                            await deleteDoc(docRef(db, 'tableOrders', d.id));
                          }
                          // También eliminar de breakfastOrders si aplica (en caso de 'Sin mesa' o mixes)
                          const q2 = query(coll(db, 'breakfastOrders'), where('tableNumber', '==', tableNumber), where('isPaid', '==', false));
                          const snapshot2 = await getDocs(q2);
                          for (const d of snapshot2.docs) {
                            await deleteDoc(docRef(db, 'breakfastOrders', d.id));
                          }
                          setSuccess(`✅ ${unpaidOrders.length} orden(es) eliminadas de la mesa ${tableNumber}`);
                        } catch (err) {
                          setError(`Error eliminando órdenes de la mesa ${tableNumber}: ${err.message}`);
                        }
                      }}
                      className="p-1 rounded-md text-red-400 hover:text-white hover:bg-red-600"
                      title={`Eliminar ${unpaidOrders.length} orden(es)`}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Órdenes de la mesa */}
              <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                {unpaidOrders.map((order) => {
                  const orderTime = new Date(order.createdAt?.seconds * 1000 || order.createdAt);
                  const minutesAgo = Math.floor((new Date() - orderTime) / (1000 * 60));
                  
                  return (
                    <div
                      key={order.id}
                      className={`p-3 rounded-lg border ${
                        theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="text-sm font-medium text-gray-100">
                            {order.orderType === 'desayuno' ? '🌅 Desayuno' : '🍽️ Almuerzo'}
                          </div>
                          <div className="text-xs text-gray-400">{getOrderLabel(order)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-green-400">
                            {formatPrice(order.total)}
                          </div>
                          <div className={`text-xs ${minutesAgo > 30 ? 'text-red-400' : minutesAgo > 15 ? 'text-yellow-400' : 'text-green-400'}`}>
                            {minutesAgo}min
                          </div>
                        </div>
                        {order.isPaid && order.paymentMethod && (
                          <div className="flex items-center justify-end space-x-1">
                            {getPaymentIcon(order.paymentMethod)}
                            <span className="text-xs text-green-600 capitalize">
                              {order.paymentMethod}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {!order.isPaid && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleOpenPayment(order)}
                            className="flex-1 mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
                          >
                            💰 Procesar Pago
                          </button>
                          {canDeleteAll && (
                            <button onClick={() => deleteSingleOrder(order)} className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg flex items-center" title={`Eliminar orden ${order.id.substring(0,8)}`}>
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Estado de la mesa */}
              {!hasUnpaidOrders && (
                <div className="text-center py-4">
                  <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-2" />
                  <div className="text-sm text-gray-400">Mesa libre</div>
                </div>
              )}
            </div>
          );
        })}
        {/* Sección: Pedidos Completados */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-200 mb-3">✅ Pedidos Completados</h3>
          {/* Botón global eliminado a petición del usuario; ahora se permite eliminación por mesa y por orden */}
          {Object.entries(paidOrdersByTable).length === 0 && (
            <div className="text-sm text-gray-400">No hay pedidos completados aún.</div>
          )}
          <div className="space-y-3">
            {Object.entries(paidOrdersByTable).map(([tableNumber, orders]) => (
              <div key={`paid-${tableNumber}`} className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-lg p-4 border-l-4 border-blue-500`}>
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm text-gray-300 flex items-center space-x-2">
                    <div>{canDeleteAll ? `Pedidos ${tableNumber}` : `Mesa ${tableNumber}`}</div>
                  </div>
                    <div className="text-xs text-gray-400 flex items-center space-x-2">
                      <div>{orders.length} orden(es)</div>
                      {canDeleteAll && (
                        <button onClick={() => deletePaidByTable(tableNumber)} className="p-1 rounded-md text-red-400 hover:text-white hover:bg-red-600" title={`Eliminar ${orders.length} orden(es) pagadas`}>
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                </div>
                <div className="space-y-2">
                  {orders.map((order) => (
                    <div key={`paid-order-${order.id}`} className={`p-3 rounded-lg border ${theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-100">{order.orderType === 'desayuno' ? '🌅 Desayuno' : '🍽️ Almuerzo'}</div>
                          <div className="text-xs text-gray-400">{getOrderLabel(order)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-green-400">{formatPrice(order.total)}</div>
                          {order.paymentMethod && <div className="text-xs text-gray-300 capitalize">{order.paymentMethod}</div>}
                        </div>
                      </div>
                      <div className="mt-3 flex space-x-2">
                        <button
                          onClick={() => {
                            // Abrir modal con datos de pago actuales para editar
                            setSelectedOrder(order);
                            // Inicializar adicionales desde la orden si existen (para editar correctamente)
                            const initialAdded = Array.isArray(order.addedItems) ? order.addedItems.map((it, idx) => ({ id: it.id || idx, name: it.name, amount: Number(it.amount || 0) })) : [];
                            setAddedItems(initialAdded);

                            // Si la orden tiene paymentLines, abrir en modo split y cargar líneas
                            if (order.paymentLines && Array.isArray(order.paymentLines) && order.paymentLines.length > 0) {
                              setPaymentMode('split');
                              setPaymentLines(order.paymentLines.map(l => ({ method: l.method || 'efectivo', amount: String(l.amount || 0) })));
                              // calcular suma en paymentData.amount para mostrar en resumen, incluyendo adicionales
                              const linesTotal = order.paymentLines.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
                              const addedTotal = initialAdded.reduce((s, a) => s + (Number(a.amount || 0)), 0);
                              setPaymentData(prev => ({ ...prev, amount: Math.round(linesTotal + addedTotal) }));
                            } else {
                              setPaymentMode('simple');
                              setPaymentLines([]);
                              // Preferir order.total (que puede incluir adicionales persistidos) sobre paymentAmount
                              const amount = Math.round(parseFloat(order.total) || parseFloat(order.paymentAmount) || 0);
                              setPaymentData({
                                method: order.paymentMethod || 'efectivo',
                                amount,
                                note: order.paymentNote || ''
                              });
                            }
                            setCashAmount(order.cashReceived ? String(order.cashReceived) : '');
                            setCalculatedChange(order.changeGiven || 0);
                            setShowChangeCalculator(!!order.cashReceived);
                            setShowPaymentModal(true);
                          }}
                          className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded-lg"
                        >
                          ✏️ Editar Pago
                        </button>
                          {canDeleteAll && (
                            <button onClick={() => deleteSingleOrder(order)} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg flex items-center" title={`Eliminar orden ${order.id.substring(0,8)}`}>
                              <TrashIcon className="w-4 h-4 mr-2" />Eliminar
                            </button>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal de pago */}
      {showPaymentModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto`}>
            <div className="p-6">
              {/* Header del modal */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-100">
                  💰 Procesar Pago - Mesa {selectedOrder.tableNumber}
                </h3>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="text-gray-400 hover:text-gray-200"
                >
                  <XCircleIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Información de la orden */}
              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'} mb-6`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-400">{getOrderLabel(selectedOrder)}</span>
                  <span className="text-sm text-gray-400">
                    {selectedOrder.orderType === 'desayuno' ? '🌅 Desayuno' : '🍽️ Almuerzo'}
                  </span>
                </div>
                <div className="text-2xl font-bold text-green-400">
                  Total: {formatPrice(selectedOrder.total)}
                </div>
              </div>

              {/* Opciones de división de pago */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-100 mb-3">Opciones de Pago</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMode('simple')}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      paymentMode === 'simple'
                        ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                        : theme === 'dark'
                          ? 'border-gray-600 bg-gray-700 text-gray-300'
                          : 'border-gray-300 bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="text-center">
                      <CurrencyDollarIcon className="w-6 h-6 mx-auto mb-1" />
                      <div className="text-sm font-medium">Pago Completo</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setPaymentMode('split')}
                    className={`p-3 rounded-lg border-2 transition-colors ${
                      paymentMode === 'split'
                        ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                        : theme === 'dark'
                          ? 'border-gray-600 bg-gray-700 text-gray-300'
                          : 'border-gray-300 bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="text-center">
                      <CurrencyDollarIcon className="w-6 h-6 mx-auto mb-1" />
                      <div className="text-sm font-medium">Dividir Pago</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Opciones de división */}
              {paymentMode === 'split' && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Dividir en:</h4>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleSplitPayment('50-50')}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-lg transition-colors"
                    >
                      50/50
                    </button>
                    <button
                      onClick={() => handleSplitPayment('1-3')}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-lg transition-colors"
                    >
                      1/3 cada uno
                    </button>
                    <button
                      onClick={() => handleSplitPayment('custom')}
                      className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded-lg transition-colors"
                    >
                      Personalizado
                    </button>
                  </div>
                </div>
              )}

                {/* Editor de líneas para pago dividido */}
                {paymentMode === 'split' && (
                  <div className="mb-6 p-4 rounded-lg border border-gray-600 bg-gray-800/30">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm font-medium text-gray-200">Líneas de Pago</div>
                      <div className="flex items-center space-x-2">
                        <button onClick={() => fillAllWith('efectivo')} className="px-2 py-1 bg-green-600 text-white rounded text-xs">Todo Efectivo</button>
                        <button onClick={() => fillAllWith('nequi')} className="px-2 py-1 bg-purple-600 text-white rounded text-xs">Todo Nequi</button>
                        <button onClick={() => fillAllWith('daviplata')} className="px-2 py-1 bg-orange-600 text-white rounded text-xs">Todo Daviplata</button>
                        <button onClick={addSplitLine} className="px-2 py-1 bg-blue-600 text-white rounded text-xs">+ Añadir línea</button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {paymentLines.map((line, idx) => (
                        <div key={`line-${idx}`} className="flex items-center space-x-2">
                          <select value={line.method} onChange={(e) => updateSplitLine(idx, { method: e.target.value })} className="px-2 py-1 rounded bg-gray-700 text-white text-sm">
                            <option value="efectivo">Efectivo</option>
                            <option value="nequi">Nequi</option>
                            <option value="daviplata">Daviplata</option>
                          </select>
                          <input type="number" value={line.amount} onChange={(e) => updateSplitLine(idx, { amount: e.target.value })} className="w-32 px-2 py-1 rounded text-sm bg-white text-black" />
                          <button onClick={() => removeSplitLine(idx)} className="px-2 py-1 bg-red-600 text-white rounded text-sm">✕</button>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-sm text-gray-300">Total pedido: <span className="font-bold">{formatPrice(selectedOrder?.total || 0)}</span></div>
                      <div className="text-sm">
                        <span className="mr-3">Suma líneas: <span className="font-bold">{formatPrice(splitTotal)}</span></span>
                        {splitIsExact ? (
                          <span className="text-green-400 font-semibold">✔ Suma exacta</span>
                        ) : (
                          <span className="text-yellow-400">Suma no coincide</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              {/* Método de pago */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Método de Pago</h4>
                <div className="grid grid-cols-3 gap-2">
                  {['efectivo', 'nequi', 'daviplata'].map((method) => (
                    <button
                      key={method}
                      onClick={() => setPaymentData(prev => ({ ...prev, method }))}
                      className={`p-3 rounded-lg border-2 transition-colors ${
                        paymentData.method === method
                          ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                          : theme === 'dark'
                            ? 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600'
                            : 'border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <div className="text-center">
                        {getPaymentIcon(method)}
                        <div className="text-xs font-medium mt-1 capitalize">{method}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Botones rápidos para efectivo */}
              {paymentData.method === 'efectivo' && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Billetes Recibidos</h4>
                    {/* Mostrar cuánto corresponde a efectivo (cuando hay split) */}
                    {paymentMode === 'split' && (
                      <div className="text-sm text-gray-200 mb-2">Efectivo a cobrar: <span className="font-bold">{formatPrice(paymentLines.reduce((s, l) => s + (l.method === 'efectivo' ? (parseFloat(l.amount) || 0) : 0), 0))}</span></div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                    {quickCashButtons.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => {
                          setCashAmount(amount.toString());
                          const efectivoTotal = paymentMode === 'split' ? paymentLines.reduce((s, l) => s + (l.method === 'efectivo' ? (parseFloat(l.amount) || 0) : 0), 0) : (parseFloat(paymentData.amount) || 0);
                          const change = calculateChange(efectivoTotal, amount);
                          setCalculatedChange(change.total);
                          setShowChangeCalculator(true);
                        }}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                      >
                        {formatPrice(amount)}
                      </button>
                    ))}
                  </div>
                  
                  {/* Input manual para efectivo */}
                  <div className="mt-3">
                    <input
                      type="number"
                      placeholder="Otro monto recibido..."
                      value={cashAmount}
                      onChange={(e) => {
                        setCashAmount(e.target.value);
                        if (e.target.value) {
                          const efectivoTotal = paymentMode === 'split' ? paymentLines.reduce((s, l) => s + (l.method === 'efectivo' ? (parseFloat(l.amount) || 0) : 0), 0) : (parseFloat(paymentData.amount) || 0);
                          const change = calculateChange(efectivoTotal, parseFloat(e.target.value));
                          setCalculatedChange(change.total);
                          setShowChangeCalculator(true);
                        } else {
                          setShowChangeCalculator(false);
                        }
                      }}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        theme === 'dark' 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'bg-white border-gray-300 text-gray-900'
                      } focus:ring-2 focus:ring-blue-500`}
                    />
                  </div>
                </div>
              )}

              {/* Adicionales: permitir agregar platos/añadidos antes de confirmar el pago */}
              <div className="mb-6">
                <h4 className={`text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Adicionales / Items extra</h4>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <input type="text" placeholder="Descripción (ej: 1 Jugo extra)" value={newAddedName} onChange={(e) => setNewAddedName(e.target.value)} className={`col-span-2 px-3 py-2 rounded-lg border text-sm ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} />
                  <input type="number" placeholder="Monto" value={newAddedAmount} onChange={(e) => setNewAddedAmount(e.target.value)} className={`px-3 py-2 rounded-lg border text-sm ${theme === 'dark' ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}`} />
                </div>
                <div className="flex gap-2 mb-3">
                  <button onClick={addNewItem} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm">+ Añadir</button>
                  <button onClick={() => { setNewAddedName(''); setNewAddedAmount(''); }} className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm">Limpiar</button>
                </div>

                <div className="space-y-2">
                  {addedItems.length === 0 && <div className={`text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}>No hay adicionales</div>}
                  {addedItems.map(item => (
                    <div key={item.id} className={`flex items-center justify-between p-2 rounded ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'}`}>
                      <div>
                        <div className={`text-sm font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{item.name}</div>
                        <div className={`text-xs ${theme === 'dark' ? 'text-gray-300' : 'text-gray-500'}`}>{formatPrice(item.amount)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="number" value={item.amount} onChange={(e) => _editAddedItem(item.id, { amount: Number(e.target.value || 0) })} className={`w-24 px-2 py-1 rounded text-sm ${theme === 'dark' ? 'bg-gray-700 text-white border border-gray-600' : 'bg-white text-gray-900 border border-gray-300'}`} />
                        <button onClick={() => _removeAddedItem(item.id)} className="px-2 py-1 bg-red-600 text-white rounded text-sm">Eliminar</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 text-sm">
                  <span className="font-medium">Total adicionales: </span>
                  <span className="font-bold">{formatPrice(addedItems.reduce((s, a) => s + (Number(a.amount || 0)), 0))}</span>
                </div>
              </div>

              {/* Calculadora de vueltos */}
              {showChangeCalculator && calculatedChange > 0 && (
                <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-green-900/30' : 'bg-green-100'} border border-green-500 mb-6`}>
                  <h4 className="text-lg font-semibold text-green-400 mb-2">
                    💰 Vueltos: {formatPrice(calculatedChange)}
                  </h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {(() => {
                          const changeInfo = calculateChange(paymentData.amount, parseFloat(cashAmount) || 0) || { breakdown: {}, remaining: 0 };
                          const breakdown = changeInfo.breakdown || {};
                          const remainingCoins = changeInfo.remaining || 0;
                          // Mostrar solo las denominaciones necesarias (count > 0), ordenadas descendente
                          const entries = Object.entries(breakdown)
                            .map(([bill, count]) => [parseInt(bill, 10), count])
                            .filter(([, count]) => count > 0)
                            .sort((a, b) => b[0] - a[0]);

                          const rows = entries.map(([bill, count]) => (
                            <div key={bill} className="flex justify-between opacity-100">
                              <span className="text-gray-300">{formatPrice(bill)}:</span>
                              <span className="text-green-400 font-bold">{count}</span>
                            </div>
                          ));

                          // Agregar fila de resto si aplica
                          if (remainingCoins > 0) {
                            rows.push(
                              <div key="remaining" className="flex justify-between border-t pt-2 mt-2">
                                <span className="text-gray-300">Monedas/Restante:</span>
                                <span className="text-green-400 font-bold">{formatPrice(remainingCoins)}</span>
                              </div>
                            );
                          }

                          // Si no hay billetes/monedas a devolver y no hay resto, mostrar un texto sutil
                          if (rows.length === 0) {
                            return (
                              <div className="text-sm text-gray-400">No hay vueltos</div>
                            );
                          }

                          return rows;
                        })()}
                      </div>
                </div>
              )}

              {/* Nota opcional */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nota (opcional)
                </label>
                <textarea
                  value={paymentData.note || ''}
                  onChange={(e) => setPaymentData(prev => ({ ...prev, note: e.target.value }))}
                  rows={2}
                  className={`w-full px-3 py-2 rounded-lg border ${
                    theme === 'dark' 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:ring-2 focus:ring-blue-500`}
                  placeholder="Notas adicionales del pago..."
                />
              </div>

              {/* Resumen del pago */}
              <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-blue-900/30' : 'bg-blue-100'} border border-blue-500 mb-6`}>
                <div className="flex justify-between items-center">
                  <span className="text-blue-400 font-medium">
                    {paymentData.method.toUpperCase()}: {formatPrice(paymentData.amount)}
                  </span>
                  {paymentData.amount === parseFloat(selectedOrder.total) ? (
                    <CheckCircleIcon className="w-5 h-5 text-green-500" />
                  ) : (
                    <span className="text-xs text-yellow-400">Pago parcial</span>
                  )}
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleProcessPayment}
                  className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-semibold"
                >
                  ✅ Confirmar Pago
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WaiterCashier;