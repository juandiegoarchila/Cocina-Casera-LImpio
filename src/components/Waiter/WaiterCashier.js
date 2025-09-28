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
  const [cashAmount, setCashAmount] = useState('');
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

  // Estadísticas del día
  const dayStats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const paidToday = [...tableOrders, ...breakfastOrders].filter(order => {
      if (!order.isPaid || !order.paymentDate) return false;
      const orderDate = new Date(order.paymentDate.seconds * 1000 || order.paymentDate).toISOString().split('T')[0];
      return orderDate === today;
    });

    const totalAmount = paidToday.reduce((sum, order) => sum + (parseFloat(order.total) || 0), 0);
    const paymentMethods = paidToday.reduce((acc, order) => {
      if (order.paymentMethod) {
        acc[order.paymentMethod] = (acc[order.paymentMethod] || 0) + 1;
      }
      return acc;
    }, {});

    return {
      totalOrders: paidToday.length,
      totalAmount,
      efectivo: paymentMethods.efectivo || 0,
      nequi: paymentMethods.nequi || 0,
      daviplata: paymentMethods.daviplata || 0
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
    setCashAmount('');
    setCalculatedChange(0);
    setShowChangeCalculator(false);
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
      const updateData = {
        isPaid: true,
        status: 'Completada',
        paymentDate: serverTimestamp(),
        paymentMethod: paymentData.method,
        paymentAmount: paymentData.amount,
        updatedAt: serverTimestamp()
      };

      if (paymentData.note) updateData.paymentNote = paymentData.note;
      if (paymentData.method === 'efectivo' && cashAmount) {
        updateData.cashReceived = parseFloat(cashAmount);
        updateData.changeGiven = calculatedChange;
      }

      const collection_name = selectedOrder.orderType === 'mesa' ? 'tableOrders' : 'breakfastOrders';
      await updateDoc(doc(db, collection_name, selectedOrder.id), updateData);

      // Actualización optimista local para reflejar el pago inmediatamente en la UI
      const optimisticFields = {
        isPaid: true,
        status: 'Completada',
        paymentMethod: updateData.paymentMethod,
        paymentAmount: updateData.paymentAmount,
        paymentDate: new Date()
      };
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
  };

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
                  <div className="text-xl font-bold text-purple-600">{dayStats.nequi}</div>
                  <div className="text-xs text-gray-500">Nequi</div>
                </div>
              </div>
            </div>
          </div>
          <div className={`p-4 rounded-lg h-24 flex items-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border-l-4 border-orange-500`}>
            <div className="flex items-center w-full justify-between">
              <div className="flex items-center">
                <CreditCardIcon className="w-6 h-6 text-orange-600 mr-2" />
                <div>
                  <div className="text-xl font-bold text-orange-600">{dayStats.daviplata}</div>
                  <div className="text-xs text-gray-500">Daviplata</div>
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
                  <div className="text-xl font-bold text-gray-600">{dayStats.efectivo}</div>
                  <div className="text-xs text-gray-500">Efectivo</div>
                </div>
              </div>
            </div>
          </div>
          {/* Total Día - solo visible para admin */}
          {canDeleteAll && (
            <div className={`p-4 rounded-lg h-24 flex items-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} border-l-4 border-blue-500`}>
              <div className="flex items-center w-full justify-between">
                <div className="flex items-center">
                  <CurrencyDollarIcon className="w-6 h-6 text-blue-600 mr-2" />
                  <div>
                    <div className="text-xl font-bold text-blue-600">{formatPrice(dayStats.totalAmount)}</div>
                    <div className="text-xs text-gray-500">Total Día</div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
                          <div className="text-xs text-gray-400">
                            Orden #{order.id.substring(0, 8)}...
                          </div>
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
                        <button
                          onClick={() => handleOpenPayment(order)}
                          className="w-full mt-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
                        >
                          💰 Procesar Pago
                        </button>
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
                  <span className="text-sm text-gray-400">Orden #{selectedOrder.id.substring(0, 8)}</span>
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
                  <div className="grid grid-cols-2 gap-2">
                    {quickCashButtons.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => {
                          setCashAmount(amount.toString());
                          const change = calculateChange(paymentData.amount, amount);
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
                          const change = calculateChange(paymentData.amount, parseFloat(e.target.value));
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