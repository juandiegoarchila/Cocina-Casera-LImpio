import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../../config/firebase';
import { collection, onSnapshot, updateDoc, doc, deleteDoc, getDocs, query, where, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore'; // Importar serverTimestamp
import { exportToExcel } from './utilities/exportToExcel';
import { exportToPDF } from './utilities/exportToPDF';
import { exportToCSV } from './utilities/exportToCSV';
import { generatePreviewHtml } from './utilities/previewOrders.js';
import { generateExcelPreviewHtml } from './utilities/previewExcel.js';
import { cleanText } from './utils';
import TablaPedidos from './TablaPedidos';
import InteraccionesPedidos from './InteraccionesPedidos';

const OrderManagement = ({ setError, setSuccess, theme }) => {
  const [orders, setOrders] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [totals, setTotals] = useState({ cash: 0, daviplata: 0, nequi: 0 });
  const [editForm, setEditForm] = useState({ meals: [], total: 0, status: '', payment: '', deliveryPerson: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [showMealDetails, setShowMealDetails] = useState(null);
  const [editingDeliveryId, setEditingDeliveryId] = useState(null);
  const [deliveryPersons, setDeliveryPersons] = useState({});
  const [sortBy, setSortBy] = useState('createdAt.seconds');
  const [sortOrder, setSortOrder] = useState('desc');
  const [proteins, setProteins] = useState([]);
  const [newProtein, setNewProtein] = useState({ name: '', quantity: '' });
  const [showProteinModal, setShowProteinModal] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // NUEVOS ESTADOS PARA GENERAR ORDEN
  const [showAddOrderModal, setShowAddOrderModal] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState({
    meals: [{
      soup: '',
      soupReplacement: '',
      principle: [{ name: '' }],
      principleReplacement: '',
      protein: '',
      drink: '',
      cutlery: '',
      sides: [],
      additions: [],
      notes: '',
      address: {
        address: '',
        phoneNumber: '',
        addressType: '',
        localName: '',
        recipientName: '',
      },
      time: '',
      payment: 'Efectivo', // Default payment method
    }],
    total: 0,
    status: 'Pendiente',
    payment: 'Efectivo',
    deliveryPerson: 'Sin asignar',
  });

  const totalProteinUnits = useMemo(() => proteins.reduce((sum, p) => sum + Number(p.quantity || 0), 0), [proteins]);

  // Función para registrar actividades - AHORA ACEPTA UN OBJETO DE DETALLES
  const logActivity = useCallback(async (action, details = {}) => {
    try {
      await addDoc(collection(db, 'userActivity'), {
        action: action,
        timestamp: serverTimestamp(), // Usa serverTimestamp para una marca de tiempo consistente
        details: details, // Guarda los detalles adicionales
      });
    } catch (error) {
      console.error("Error al registrar actividad:", error);
      // No se propaga el error para no interrumpir la acción principal
    }
  }, []);

  const handleExport = (exportFunction, format) => {
    try {
      exportFunction(orders, totals, deliveryPersons, totalProteinUnits, proteins);
      setSuccess(`Exportado correctamente como ${format}.`);
      logActivity(`Exportó pedidos como ${format}`, { format: format }); // Registrar actividad con detalles
    } catch (error) {
      console.error(`Error al exportar ${format}:`, error);
      setError(`Error al exportar ${format}: ${error.message}`);
    }
  };

  const filteredOrders = useMemo(() => {
    if (!searchTerm) return orders;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return orders.filter(order => {
      const address = order.meals?.[0]?.address?.address?.toLowerCase() || '';
      const phone = order.meals?.[0]?.address?.phoneNumber?.toLowerCase() || '';
      const time = order.meals?.[0]?.time?.name?.toLowerCase() || order.meals?.[0]?.time?.toLowerCase() || '';
      const payment = cleanText(order.payment || order.meals?.[0]?.payment?.name || order.meals?.[0]?.payment || '').toLowerCase();
      const deliveryPerson = order.deliveryPerson?.toLowerCase() || '';
      const status = order.status?.toLowerCase() || '';
      return address.includes(lowerSearchTerm) || phone.includes(lowerSearchTerm) || time.includes(lowerSearchTerm) || payment.includes(lowerSearchTerm) || deliveryPerson.includes(lowerSearchTerm) || status.includes(lowerSearchTerm);
    });
  }, [orders, searchTerm]);

  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      // Pasamos filteredOrders explícitamente a getValue para evitar problemas de cierre/referencia
      const getValue = (obj, path, currentFilteredOrdersArray) => {
        // Asegurarse de que obj no sea undefined antes de llamar a indexOf
        if (path === 'orderNumber') return obj ? currentFilteredOrdersArray.indexOf(obj) : -1;
        const value = path.split('.').reduce((acc, part) => acc && acc[part], obj);
        return cleanText(value) || '';
      };
      const valueA = getValue(a, sortBy, filteredOrders); // Pasamos filteredOrders aquí
      const valueB = getValue(b, sortBy, filteredOrders); // Y aquí
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortOrder === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
      }
      return sortOrder === 'asc' ? valueA - valueB : valueB - valueA;
    });
  }, [filteredOrders, sortBy, sortOrder]);

  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return sortedOrders.slice(start, end);
  }, [sortedOrders, currentPage, itemsPerPage]);

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const getSortIcon = (key) => {
    if (sortBy !== key) return null;
    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
      </svg>
    );
  };
  const fetchOrders = useCallback(() => {
    setIsLoading(true);
    const ordersColRef = collection(db, 'orders');
    const unsubscribe = onSnapshot(ordersColRef, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => {
        const data = doc.data();
        // Normalize the order data
        const meals = Array.isArray(data.meals) && data.meals.length > 0 ? data.meals : [{ address: {}, payment: {}, time: {} }];
        return {
          id: doc.id,
          ...data,
          meals: meals.map(meal => ({
            ...meal,
            address: meal.address || {},
            payment: meal.payment || { name: 'Efectivo' },
            time: meal.time || {},
          })),
          payment: data.payment || meals[0]?.payment?.name || 'Efectivo',
          total: data.total || 0,
          deliveryPerson: data.deliveryPerson || 'Sin asignar',
          status: data.status || 'Pendiente',
        };
      });
      setOrders(ordersData);
      const newTotals = { cash: 0, daviplata: 0, nequi: 0 };
      const newDeliveryPersons = {};
      ordersData.forEach(order => {
        const paymentSummary = order.paymentSummary || {};
        newTotals.cash += paymentSummary['Efectivo'] || 0;
        newTotals.daviplata += paymentSummary['Daviplata'] || 0;
        newTotals.nequi += paymentSummary['Nequi'] || 0;
        if (order.deliveryPerson) {
          const personName = cleanText(order.deliveryPerson);
          if (!newDeliveryPersons[personName]) newDeliveryPersons[personName] = { cash: 0, daviplata: 0, nequi: 0, total: 0 };
          const paymentType = cleanText(order.payment || order.meals?.[0]?.payment?.name || order.meals?.[0]?.payment || 'Efectivo');
          const amount = order.total || 0;
          if (paymentType.toLowerCase() === 'efectivo') newDeliveryPersons[personName].cash += amount;
          else if (paymentType.toLowerCase() === 'daviplata') newDeliveryPersons[personName].daviplata += amount;
          else if (paymentType.toLowerCase() === 'nequi') newDeliveryPersons[personName].nequi += amount;
          newDeliveryPersons[personName].total += amount;
        }
      });
      setTotals(newTotals);
      setDeliveryPersons(newDeliveryPersons);
      setIsLoading(false);
    }, (error) => {
      setError(`Error al cargar pedidos: ${error.message}`);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [setError]);

  const fetchProteins = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    const proteinsColRef = query(collection(db, 'dailyProteins'), where('date', '==', today));
    const unsubscribe = onSnapshot(proteinsColRef, (snapshot) => {
      const proteinsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProteins(proteinsData);
    }, (error) => {
      setError(`Error al cargar proteínas: ${error.message}`);
    });
    return () => unsubscribe();
  }, [setError]);

  useEffect(() => {
    const unsubscribeOrders = fetchOrders();
    const unsubscribeProteins = fetchProteins();
    return () => {
      unsubscribeOrders();
      unsubscribeProteins();
    };
  }, [fetchOrders, fetchProteins]);

  const handleAddProtein = async () => {
    if (!newProtein.name || !newProtein.quantity || isNaN(newProtein.quantity) || Number(newProtein.quantity) <= 0) {
      setError('Por favor, ingrese un nombre de proteína válido y una cantidad mayor a 0.');
      return;
    }
    setIsLoading(true);
    try {
      await addDoc(collection(db, 'dailyProteins'), {
        name: newProtein.name.trim(),
        quantity: Number(newProtein.quantity),
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date(),
      });
      setNewProtein({ name: '', quantity: '' });
      setShowProteinModal(false);
      setSuccess('Proteína agregada correctamente.');
      // PASAR DETALLES A logActivity
      logActivity(`Agregó proteína: ${newProtein.name} (${newProtein.quantity} unidades)`, { proteinName: newProtein.name, quantity: Number(newProtein.quantity) });
    } catch (error) {
      setError(`Error al agregar proteína: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditOrder = useCallback((order) => {
    setEditingOrder(order);
    setEditForm({
      meals: order.meals?.map(meal => ({
        ...meal,
        address: meal.address || {},
        payment: meal.payment ? cleanText(meal.payment?.name || meal.payment) : 'Efectivo',
        additions: meal.additions || [],
        principle: Array.isArray(meal.principle) ? meal.principle : meal.principle ? [{ name: meal.principle.name || meal.principle }] : [],
        cutlery: meal.cutlery || null,
        sides: meal.sides || [],
      })) || [],
      total: order.total || 0,
      status: order.status || 'Pendiente',
      payment: order.payment ? cleanText(order.payment) : 'Efectivo',
      deliveryPerson: order.deliveryPerson || '',
    });
  }, []);

  // Handler para campos del formulario de EDICIÓN de pedido
  const handleEditOrderMealFormFieldChange = (mealIndex, field, value) => {
    setEditForm(prev => {
      const newMeals = [...prev.meals];
      if (!newMeals[mealIndex]) { // Asegurar que el objeto meal exista
        newMeals[mealIndex] = { address: {}, payment: {}, time: {} };
      }
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        newMeals[mealIndex] = { ...newMeals[mealIndex], [parent]: { ...newMeals[mealIndex][parent], [child]: value } };
      } else if (field === 'sides') {
        newMeals[mealIndex] = { ...newMeals[mealIndex], sides: value.split(',').map(s => ({ name: s.trim() })) };
      } else if (field === 'additions') {
        newMeals[mealIndex] = {
          ...newMeals[mealIndex],
          additions: value.split(';').map(a => {
            const [name, proteinOrReplacement = '', quantity = '1'] = a.split(',');
            return { name: name.trim(), [proteinOrReplacement.includes('por') ? 'replacement' : 'protein']: proteinOrReplacement.trim(), quantity: Number(quantity) || 1 };
          }).filter(a => a.name),
        };
      } else if (field === 'principle') {
        newMeals[mealIndex] = { ...newMeals[mealIndex], principle: value.split(',').map(p => ({ name: p.trim() })).filter(p => p.name) };
      } else {
        newMeals[mealIndex] = { ...newMeals[mealIndex], [field]: value };
      }
      return { ...prev, meals: newMeals };
    });
  };

  const handleSaveEdit = async () => {
    if (!editingOrder) return;
    setIsLoading(true);
    try {
      // Obtener el estado anterior del pedido para el log
      const oldOrder = orders.find(o => o.id === editingOrder.id);
      const previousState = oldOrder ? {
        meals: oldOrder.meals,
        total: oldOrder.total,
        status: oldOrder.status,
        payment: oldOrder.payment,
        deliveryPerson: oldOrder.deliveryPerson,
      } : {};

      const updatedMealsForDB = editForm.meals.map(meal => ({
        ...meal,
        soup: meal.soup && typeof meal.soup === 'string' ? { name: meal.soup } : meal.soup,
        soupReplacement: meal.soupReplacement && typeof meal.soupReplacement === 'string' ? { name: meal.soupReplacement } : meal.soupReplacement,
        principle: Array.isArray(meal.principle) ? meal.principle.map(p => typeof p === 'string' ? { name: p } : p) : meal.principle && typeof meal.principle === 'string' ? [{ name: meal.principle }] : meal.principle,
        principleReplacement: meal.principleReplacement && typeof meal.principleReplacement === 'string' ? { name: meal.principleReplacement } : meal.principleReplacement,
        protein: meal.protein && typeof meal.protein === 'string' ? { name: meal.protein } : meal.protein,
        drink: meal.drink && typeof meal.drink === 'string' ? { name: meal.drink } : meal.drink,
        cutlery: meal.cutlery && typeof meal.cutlery === 'string' ? { name: meal.cutlery } : meal.cutlery,
        time: meal.time && typeof meal.time === 'string' ? { name: meal.time } : meal.time,
        payment: meal.payment && typeof meal.payment === 'string' ? { name: meal.payment } : meal.payment,
        sides: Array.isArray(meal.sides) ? meal.sides.map(s => typeof s === 'string' ? { name: s } : s) : [],
        additions: Array.isArray(meal.additions) ? meal.additions.map(a => ({ name: a.name || '', protein: a.protein || '', replacement: a.replacement || '', quantity: a.quantity || 1 })) : [],
      }));
      await updateDoc(doc(db, 'orders', editingOrder.id), { ...editForm, meals: updatedMealsForDB, updatedAt: new Date() });
      setEditingOrder(null);
      setSuccess('Pedido actualizado correctamente.');
      // PASAR DETALLES A logActivity
      logActivity(`Editó el pedido con ID: ${editingOrder.id}`, {
        orderId: editingOrder.id,
        previousState: previousState,
        newState: { ...editForm, meals: updatedMealsForDB },
      });
    } catch (error) {
      setError(`Error al guardar: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteOrder = async (orderId) => { // Acepta orderId como parámetro
    setIsLoading(true);
    try {
      // Encontrar el objeto de la orden para registrar sus detalles
      const orderToDelete = orders.find(o => o.id === orderId);

      await deleteDoc(doc(db, 'orders', orderId));
      setSuccess('Pedido eliminado correctamente.');
      // PASAR DETALLES A logActivity
      if (orderToDelete) {
        logActivity(`Eliminó el pedido con ID: ${orderId}`, {
          orderId: orderId,
          deletedOrderDetails: { meals: orderToDelete.meals, total: orderToDelete.total, status: orderToDelete.status, payment: orderToDelete.payment, deliveryPerson: orderToDelete.deliveryPerson },
        });
      } else {
        logActivity(`Eliminó el pedido con ID: ${orderId} (detalles no disponibles)`);
      }
    } catch (error) {
      setError(`Error al eliminar: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAllOrders = async () => {
    if (confirmText.toLowerCase() !== 'confirmar') {
      setError('Por favor, escribe "confirmar" para proceder.');
      return;
    }
    setIsLoading(true);
    try {
      const batch = writeBatch(db);
      const ordersSnapshot = await getDocs(collection(db, 'orders'));
      ordersSnapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      setShowConfirmDeleteAll(false);
      setConfirmText('');
      setSuccess('Todos los pedidos han sido eliminados.');
      // PASAR DETALLES A logActivity
      logActivity('Eliminó todos los pedidos', { count: ordersSnapshot.size });
    } catch (error) {
      setError(`Error al eliminar todos los pedidos: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const oldOrder = orders.find(o => o.id === orderId); // Obtener el pedido actual
      const previousStatus = oldOrder ? oldOrder.status : 'Desconocido';

      await updateDoc(doc(db, 'orders', orderId), { status: newStatus, updatedAt: new Date() });
      setSuccess('Estado actualizado correctamente.');
      // PASAR DETALLES A logActivity
      logActivity(`Actualizó el estado del pedido ${orderId} a: ${newStatus}`, {
        orderId: orderId,
        previousStatus: previousStatus,
        newStatus: newStatus,
      });
    } catch (error) {
      setError(`Error al actualizar estado: ${error.message}`);
    }
  };

  const handleDeliveryChange = async (orderId, deliveryPerson) => {
    try {
      const oldOrder = orders.find(o => o.id === orderId); // Obtener el pedido actual
      const previousDeliveryPerson = oldOrder ? oldOrder.deliveryPerson : 'Desconocido';

      await updateDoc(doc(db, 'orders', orderId), { deliveryPerson: deliveryPerson || null, updatedAt: new Date() });
      setEditingDeliveryId(null);
      setSuccess('Domiciliario actualizado correctamente.');
      // PASAR DETALLES A logActivity
      logActivity(`Asignó/Actualizó domiciliario para el pedido ${orderId} a: ${deliveryPerson || 'Sin asignar'}`, {
        orderId: orderId,
        previousDeliveryPerson: previousDeliveryPerson,
        newDeliveryPerson: deliveryPerson || 'Sin asignar',
      });
    } catch (error) {
      setError(`Error al actualizar domiciliario: ${error.message}`);
    }
  };

  const handleOpenPreview = () => {
    const previewWindow = window.open('', '_blank');
    previewWindow.document.write(generatePreviewHtml(orders, totals, deliveryPersons));
    previewWindow.document.close();
    // PASAR DETALLES A logActivity
    logActivity('Abrió la vista previa de pedidos (PDF)', { type: 'PDF Preview' });
  };

  const handleOpenExcelPreview = () => {
    const previewWindow = window.open('', '_blank');
    previewWindow.document.write(generateExcelPreviewHtml(orders, totals, deliveryPersons, totalProteinUnits, proteins));
    previewWindow.document.close();
    // PASAR DETALLES A logActivity
    logActivity('Abrió la vista previa de pedidos (Excel)', { type: 'Excel Preview' });
  };

  // NUEVAS FUNCIONES PARA GENERAR ORDEN
  const handleNewOrderMealFormFieldChange = (mealIndex, field, value) => {
    setNewOrderForm(prev => {
      const newMeals = [...prev.meals];
      if (!newMeals[mealIndex]) { // Ensure meal object exists
        newMeals[mealIndex] = { address: {}, payment: {}, time: {} };
      }

      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        newMeals[mealIndex] = { ...newMeals[mealIndex], [parent]: { ...newMeals[mealIndex][parent], [child]: value } };
      } else if (field === 'sides') {
        newMeals[mealIndex] = { ...newMeals[mealIndex], sides: value.split(',').map(s => ({ name: s.trim() })).filter(s => s.name) };
      } else if (field === 'additions') {
        newMeals[mealIndex] = {
          ...newMeals[mealIndex],
          additions: value.split(';').map(a => {
            const [name, proteinOrReplacement = '', quantity = '1'] = a.split(',');
            return { name: name.trim(), [proteinOrReplacement.includes('por') ? 'replacement' : 'protein']: proteinOrReplacement.trim(), quantity: Number(quantity) || 1 };
          }).filter(a => a.name),
        };
      } else if (field === 'principle') {
        newMeals[mealIndex] = { ...newMeals[mealIndex], principle: value.split(',').map(p => ({ name: p.trim() })).filter(p => p.name) };
      } else {
        newMeals[mealIndex] = { ...newMeals[mealIndex], [field]: value };
      }
      return { ...prev, meals: newMeals };
    });
  };

  const handleAddOrderSubmit = async () => {
    setIsLoading(true);
    try {
      // Normalizar datos para Firestore
      const normalizedMeals = newOrderForm.meals.map(meal => ({
        ...meal,
        soup: meal.soup ? { name: meal.soup } : null,
        soupReplacement: meal.soupReplacement ? { name: meal.soupReplacement } : null,
        principle: Array.isArray(meal.principle) ? meal.principle.map(p => ({ name: p.name || p })) : (meal.principle ? [{ name: meal.principle }] : []),
        principleReplacement: meal.principleReplacement ? { name: meal.principleReplacement } : null,
        protein: meal.protein ? { name: meal.protein } : null,
        drink: meal.drink ? { name: meal.drink } : null,
        cutlery: meal.cutlery ? { name: meal.cutlery } : null,
        time: meal.time ? { name: meal.time } : null,
        payment: newOrderForm.payment ? { name: newOrderForm.payment } : { name: 'Efectivo' }, // Usar newOrderForm.payment
        sides: Array.isArray(meal.sides) ? meal.sides.map(s => ({ name: s.name || s })) : [],
        additions: Array.isArray(meal.additions) ? meal.additions.map(a => ({ name: a.name || '', protein: a.protein || '', replacement: a.replacement || '', quantity: a.quantity || 1 })) : [],
      }));

      // Calcular paymentSummary basado en el payment de la nueva orden
      const paymentSummary = {
        'Efectivo': newOrderForm.payment === 'Efectivo' ? newOrderForm.total : 0,
        'Daviplata': newOrderForm.payment === 'Daviplata' ? newOrderForm.total : 0,
        'Nequi': newOrderForm.payment === 'Nequi' ? newOrderForm.total : 0,
      };

      const orderData = {
        ...newOrderForm,
        meals: normalizedMeals,
        createdAt: serverTimestamp(),
        paymentSummary: paymentSummary, // Añadir paymentSummary
      };

      const docRef = await addDoc(collection(db, 'orders'), orderData);
      setSuccess('Orden agregada correctamente.');
      // PASAR DETALLES A logActivity
      logActivity(`Agregó una nueva orden (Total: $${newOrderForm.total.toLocaleString()})`, {
        orderId: docRef.id,
        newOrderDetails: { ...newOrderForm, meals: normalizedMeals },
      });
      setShowAddOrderModal(false);
      // Resetear el formulario después de guardar
      setNewOrderForm({
        meals: [{
          soup: '',
          soupReplacement: '',
          principle: [{ name: '' }],
          principleReplacement: '',
          protein: '',
          drink: '',
          cutlery: '',
          sides: [],
          additions: [],
          notes: '',
          address: {
            address: '',
            phoneNumber: '',
            addressType: '',
            localName: '',
            recipientName: '',
          },
          time: '',
          payment: 'Efectivo',
        }],
        total: 0,
        status: 'Pendiente',
        payment: 'Efectivo',
        deliveryPerson: 'Sin asignar',
      });
    } catch (error) {
      setError(`Error al agregar orden: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Extraer nombres únicos de domiciliarios para el autocompletado
  const uniqueDeliveryPersons = useMemo(() => {
    return Object.keys(deliveryPersons);
  }, [deliveryPersons]);


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <InteraccionesPedidos
        theme={theme}
        showProteinModal={showProteinModal}
        setShowProteinModal={setShowProteinModal}
        newProtein={newProtein}
        setNewProtein={setNewProtein}
        handleAddProtein={handleAddProtein}
        proteins={proteins}
        totalProteinUnits={totalProteinUnits}
        isLoading={isLoading}
        showMealDetails={showMealDetails}
        setShowMealDetails={setShowMealDetails}
        editingOrder={editingOrder}
        setEditingOrder={setEditingOrder}
        editForm={editForm}
        handleMealFormFieldChange={handleEditOrderMealFormFieldChange}
        handleSaveEdit={handleSaveEdit}
        showConfirmDeleteAll={showConfirmDeleteAll}
        setShowConfirmDeleteAll={setShowConfirmDeleteAll}
        confirmText={confirmText}
        setConfirmText={setConfirmText}
        handleDeleteAllOrders={handleDeleteAllOrders}
        setError={setError}
        setSuccess={setSuccess}
        // NUEVAS PROPS PARA GENERAR ORDEN
        showAddOrderModal={showAddOrderModal}
        setShowAddOrderModal={setShowAddOrderModal}
        newOrderForm={newOrderForm}
        handleNewOrderMealFormFieldChange={handleNewOrderMealFormFieldChange}
        handleAddOrderSubmit={handleAddOrderSubmit}
        uniqueDeliveryPersons={uniqueDeliveryPersons}
      />
      <TablaPedidos
        theme={theme}
        orders={orders}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        totals={totals}
        isLoading={isLoading}
        paginatedOrders={paginatedOrders}
        currentPage={currentPage}
        totalPages={totalPages}
        setCurrentPage={setCurrentPage}
        itemsPerPage={itemsPerPage}
        setItemsPerPage={setItemsPerPage}
        deliveryPersons={deliveryPersons}
        handleEditOrder={handleEditOrder}
        handleDeleteOrder={handleDeleteOrder}
        handleStatusChange={handleStatusChange}
        handleSort={handleSort}
        getSortIcon={getSortIcon}
        setShowMealDetails={setShowMealDetails}
        editingDeliveryId={editingDeliveryId}
        setEditingDeliveryId={setEditingDeliveryId}
        editForm={editForm}
        setEditForm={setEditForm}
        handleDeliveryChange={handleDeliveryChange}
        sortOrder={sortOrder}
        showProteinModal={showProteinModal}
        setShowProteinModal={setShowProteinModal}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        handleOpenPreview={handleOpenPreview}
        handleOpenExcelPreview={handleOpenExcelPreview}
        handleExport={handleExport}
        handleDeleteAllOrders={handleDeleteAllOrders}
        setShowConfirmDeleteAll={setShowConfirmDeleteAll}
        exportToExcel={exportToExcel} // Pass the actual export function
        exportToPDF={exportToPDF}     // Pass the actual export function
        exportToCSV={exportToCSV}     // Pass the actual export function
        // NUEVA PROP PARA GENERAR ORDEN
        setShowAddOrderModal={setShowAddOrderModal}
        uniqueDeliveryPersons={uniqueDeliveryPersons}
      />

      {/* Sección para el resumen de domiciliarios */}
      <div className={`mt-8 p-6 rounded-2xl shadow-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
        <h3 className={`text-xl font-semibold mb-4 ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>Resumen por Domiciliarios</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(deliveryPersons).length === 0 ? (
            <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>No hay domiciliarios asignados aún.</p>
          ) : (
            Object.entries(deliveryPersons).map(([person, data]) => (
              <div key={person} className={`p-4 rounded-lg shadow-md ${theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-800'}`}>
                <h4 className="font-semibold text-lg mb-2">{person}</h4>
                <p>Efectivo: <span className="font-bold">${data.cash.toLocaleString()}</span></p>
                <p>Daviplata: <span className="font-bold">${data.daviplata.toLocaleString()}</span></p>
                <p>Nequi: <span className="font-bold">${data.nequi.toLocaleString()}</span></p>
                <p className="font-bold mt-2">Total: <span className="text-green-400">${data.total.toLocaleString()}</span></p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderManagement;
