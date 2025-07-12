import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../../config/firebase';
import { collection, onSnapshot, updateDoc, doc, deleteDoc, getDocs, query, where, writeBatch, addDoc } from 'firebase/firestore';
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

  const totalProteinUnits = useMemo(() => proteins.reduce((sum, p) => sum + Number(p.quantity || 0), 0), [proteins]);

  const handleExport = (exportFunction, format) => {
    try {
      exportFunction(orders, totals, deliveryPersons, totalProteinUnits, proteins);
      setSuccess(`Exportado correctamente como ${format}.`);
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
      const getValue = (obj, path) => {
        if (path === 'orderNumber') return filteredOrders.indexOf(obj);
        const value = path.split('.').reduce((acc, part) => acc && acc[part], obj);
        return cleanText(value) || '';
      };
      const valueA = getValue(a, sortBy);
      const valueB = getValue(b, sortBy);
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
        if (paymentType === 'Efectivo') newDeliveryPersons[personName].cash += amount;
        else if (paymentType === 'Daviplata') newDeliveryPersons[personName].daviplata += amount;
        else if (paymentType === 'Nequi') newDeliveryPersons[personName].nequi += amount;
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

  const handleMealFormFieldChange = (mealIndex, field, value) => {
    setEditForm(prev => {
      const newMeals = [...prev.meals];
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
    } catch (error) {
      setError(`Error al guardar: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    setIsLoading(true);
    try {
      await deleteDoc(doc(db, 'orders', orderId));
      setSuccess('Pedido eliminado correctamente.');
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
    } catch (error) {
      setError(`Error al eliminar todos los pedidos: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus, updatedAt: new Date() });
      setSuccess('Estado actualizado correctamente.');
    } catch (error) {
      setError(`Error al actualizar estado: ${error.message}`);
    }
  };

  const handleDeliveryChange = async (orderId, deliveryPerson) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { deliveryPerson: deliveryPerson || null, updatedAt: new Date() });
      setEditingDeliveryId(null);
      setSuccess('Domiciliario actualizado correctamente.');
    } catch (error) {
      setError(`Error al actualizar domiciliario: ${error.message}`);
    }
  };

  const handleOpenPreview = () => {
    const previewWindow = window.open('', '_blank');
    previewWindow.document.write(generatePreviewHtml(orders, totals, deliveryPersons));
    previewWindow.document.close();
  };

  const handleOpenExcelPreview = () => {
    const previewWindow = window.open('', '_blank');
    previewWindow.document.write(generateExcelPreviewHtml(orders, totals, deliveryPersons, totalProteinUnits, proteins));
    previewWindow.document.close();
  };

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
        handleMealFormFieldChange={handleMealFormFieldChange}
        handleSaveEdit={handleSaveEdit}
        showConfirmDeleteAll={showConfirmDeleteAll}
        setShowConfirmDeleteAll={setShowConfirmDeleteAll}
        confirmText={confirmText}
        setConfirmText={setConfirmText}
        handleDeleteAllOrders={handleDeleteAllOrders}
        setError={setError}
        setSuccess={setSuccess}
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
      />
    </div>
  );
};

export default OrderManagement;