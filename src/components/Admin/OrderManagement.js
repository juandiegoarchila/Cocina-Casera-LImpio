import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../../config/firebase';
import { collection, onSnapshot, updateDoc, doc, deleteDoc, getDocs, query, writeBatch } from 'firebase/firestore';
import {
  ArrowDownTrayIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InformationCircleIcon,
  PencilIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from '@heroicons/react/24/outline';
import { classNames } from '../../utils/classNames';

// Utility functions
const cleanText = (text) => {
  if (text == null) return '';
  if (typeof text === 'string') return text.replace(' NUEVO', '').trim();
  if (typeof text === 'boolean') return text.toString();
  if (typeof text === 'object' && text?.name) return text.name.replace(' NUEVO', '').trim();
  return String(text).replace(' NUEVO', '').trim();
};

const getNestedProperty = (obj, path) => {
  if (!obj || !path) return '';
  return path
    .split('.')
    .reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : ''), obj);
};

const getAddressDisplay = (address) => {
  if (!address?.address) return 'Sin dirección';
  let display = address.address;
  switch (address.addressType) {
    case 'school':
      if (address.recipientName) display += ` (Recibe: ${cleanText(address.recipientName)})`;
      break;
    case 'complex':
      if (address.unitDetails) display += ` (${cleanText(address.unitDetails)})`;
      break;
    case 'shop':
      if (address.localName) display += ` (${cleanText(address.localName)})`;
      break;
    default:
      break;
  }
  return display;
};

const getMealDetailsDisplay = (meal) => {
  const components = [];

  const soupDisplay = meal.soupReplacement?.name || meal.soupReplacement
    ? `${cleanText(meal.soupReplacement?.name || meal.soupReplacement)} (por sopa)`
    : meal.soup?.name || meal.soup
      ? cleanText(meal.soup?.name || meal.soup)
      : 'Sin sopa';
  components.push(`Sopa: ${soupDisplay}`);

  let principleDisplay;
  if (meal.principleReplacement?.name || meal.principleReplacement) {
    principleDisplay = `${cleanText(meal.principleReplacement?.name || meal.principleReplacement)} (por principio)`;
  } else if (Array.isArray(meal.principle) && meal.principle.length > 0) {
    const principleNames = meal.principle.map(p => cleanText(p.name || p)).filter(Boolean);
    principleDisplay = principleNames.length > 0 ? principleNames.join(', ') : 'Sin principio';
  } else if (meal.principle?.name || meal.principle) {
    principleDisplay = cleanText(meal.principle?.name || meal.principle);
  } else {
    principleDisplay = 'Sin principio';
  }
  components.push(`Principio: ${principleDisplay}`);

  components.push(`Proteína: ${meal.protein?.name || meal.protein ? cleanText(meal.protein?.name || meal.protein) : 'Sin proteína'}`);
  const drinkName = (meal.drink?.name || meal.drink) === 'Juego de mango' ? 'Jugo de mango' : (meal.drink?.name || meal.drink);
  components.push(`Bebida: ${drinkName ? cleanText(drinkName) : 'Sin bebida'}`);
  components.push(`Cubiertos: ${meal.cutlery?.name === 'Sí' || meal.cutlery === true || meal.cutlery === 'true' ? 'Sí' : 'No'}`);

  const sides = meal.sides?.length > 0
    ? meal.sides.map(s => cleanText(s.name || s)).filter(Boolean).join(', ')
    : 'Ninguno';
  components.push(`Acompañamientos: ${sides}`);

  const additions = meal.additions?.length > 0
    ? meal.additions.map(a => `${cleanText(a.name || a)}${a.protein || a.replacement ? ` (${cleanText(a.protein || a.replacement)})` : ''} (${a.quantity || 1})`).join(', ')
    : 'Ninguna';
  components.push(`Adiciones: ${additions}`);

  components.push(`Notas: ${meal.notes ? cleanText(meal.notes) : 'Ninguna'}`);
  components.push(`Hora de Entrega: ${meal.time?.name || meal.time ? cleanText(meal.time?.name || meal.time) : 'No especificada'}`);
  components.push(`Dirección: ${getAddressDisplay(meal.address)}`);

  let addressTypeDisplay = '';
  switch (meal.address?.addressType) {
    case 'house': addressTypeDisplay = 'Casa/Apto'; break;
    case 'school': addressTypeDisplay = 'Colegio/Oficina'; break;
    case 'complex': addressTypeDisplay = 'Conjunto'; break;
    case 'shop': addressTypeDisplay = 'Tienda/Local'; break;
    default: addressTypeDisplay = 'No especificado'; break;
  }
  components.push(`Tipo de Lugar: ${addressTypeDisplay}`);
  components.push(`Teléfono: ${meal.address?.phoneNumber ? cleanText(meal.address.phoneNumber) : 'No especificado'}`);

  if (meal.address?.addressType === 'shop' && meal.address?.localName) {
    components.push(`Nombre del Local: ${cleanText(meal.address.localName)}`);
  }
  if (meal.address?.addressType === 'school' && meal.address?.recipientName) {
    components.push(`Recibe: ${cleanText(meal.address.recipientName)}`);
  }
  if (meal.address?.addressType === 'complex' && meal.address?.unitDetails) {
    components.push(`Unidad: ${cleanText(meal.address.unitDetails)}`);
  }

  components.push(`Pago: ${meal.payment?.name || meal.payment ? cleanText(meal.payment?.name || meal.payment) : 'Efectivo'}`);

  return components.join('\n');
};

const areMealsIdentical = (meals) => {
  if (!meals || meals.length <= 1) return { areIdentical: false, count: 1 };

  const fieldsToCompare = [
    'soup', 'soupReplacement', 'principle', 'principleReplacement',
    'protein', 'drink', 'cutlery', 'notes', 'time', 'payment',
    'address.address', 'address.addressType', 'address.phoneNumber',
    'address.localName', 'address.recipientName', 'address.unitDetails',
    'sides', 'additions'
  ];

  const getMealSignature = (meal) => {
    return fieldsToCompare.map(field => {
      const value = getNestedProperty(meal, field);

      if (field === 'sides' && Array.isArray(value)) {
        return value.map(s => cleanText(s.name || s)).sort().join(',');
      }
      if (field === 'additions' && Array.isArray(value)) {
        return value.map(a => `${cleanText(a.name || a)}${a.protein || a.replacement ? `:${cleanText(a.protein || a.replacement)}` : ''}:${a.quantity || 1}`).sort().join(';');
      }
      if (field === 'principle' && Array.isArray(value)) {
        return value.map(p => cleanText(p.name || p)).sort().join(',');
      }
      return cleanText(value);
    }).join('|');
  };

  const firstSignature = getMealSignature(meals[0]);
  const areIdentical = meals.every(meal => getMealSignature(meal) === firstSignature);
  return { areIdentical, count: meals.length };
};

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

  const fetchOrders = useCallback(() => {
    setIsLoading(true);
    const ordersColRef = collection(db, 'orders');
    const unsubscribe = onSnapshot(ordersColRef, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
          if (!newDeliveryPersons[personName]) {
            newDeliveryPersons[personName] = { cash: 0, daviplata: 0, nequi: 0, total: 0 };
          }
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

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

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

  const handleSaveEdit = async () => {
    if (!editingOrder) return;
    setIsLoading(true);
    try {
      const updatedMealsForDB = editForm.meals.map(meal => ({
        ...meal,
        soup: meal.soup && typeof meal.soup === 'string' ? { name: meal.soup } : meal.soup,
        soupReplacement: meal.soupReplacement && typeof meal.soupReplacement === 'string' ? { name: meal.soupReplacement } : meal.soupReplacement,
        principle: Array.isArray(meal.principle)
          ? meal.principle.map(p => typeof p === 'string' ? { name: p } : p)
          : meal.principle && typeof meal.principle === 'string'
            ? [{ name: meal.principle }]
            : meal.principle,
        principleReplacement: meal.principleReplacement && typeof meal.principleReplacement === 'string' ? { name: meal.principleReplacement } : meal.principleReplacement,
        protein: meal.protein && typeof meal.protein === 'string' ? { name: meal.protein } : meal.protein,
        drink: meal.drink && typeof meal.drink === 'string' ? { name: meal.drink } : meal.drink,
        cutlery: meal.cutlery && typeof meal.cutlery === 'string' ? { name: meal.cutlery } : meal.cutlery,
        time: meal.time && typeof meal.time === 'string' ? { name: meal.time } : meal.time,
        payment: meal.payment && typeof meal.payment === 'string' ? { name: meal.payment } : meal.payment,
        sides: Array.isArray(meal.sides) ? meal.sides.map(s => typeof s === 'string' ? { name: s } : s) : [],
        additions: Array.isArray(meal.additions) ? meal.additions.map(a => ({ name: a.name || '', protein: a.protein || '', replacement: a.replacement || '', quantity: a.quantity || 1 })) : [],
      }));

      await updateDoc(doc(db, 'orders', editingOrder.id), {
        ...editForm,
        meals: updatedMealsForDB,
        updatedAt: new Date(),
      });
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
    if (confirmText.toLowerCase() === 'confirmar') {
      setIsLoading(true);
      try {
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef);
        const querySnapshot = await getDocs(q);

        const batch = writeBatch(db);
        querySnapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();

        setSuccess('Todos los pedidos han sido eliminados.');
        setShowConfirmDeleteAll(false);
        setConfirmText('');
      } catch (error) {
        setError(`Error al eliminar todos los pedidos: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    } else {
      setError('Por favor, escribe "confirmar" para proceder.');
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    setIsLoading(true);
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: new Date()
      });
      setSuccess('Estado actualizado correctamente.');
    } catch (error) {
      setError(`Error al actualizar estado: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeliveryChange = async (orderId, value) => {
    setIsLoading(true);
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        deliveryPerson: cleanText(value) || null,
        updatedAt: new Date()
      });
      setSuccess('Domiciliario asignado correctamente.');
    } catch (error) {
      setError(`Error al asignar domiciliario: ${error.message}`);
    } finally {
      setEditingDeliveryId(null);
      setIsLoading(false);
    }
  };

  const handleMealFormFieldChange = (mealIndex, field, value) => {
    setEditForm(prevForm => {
      const updatedMeals = [...prevForm.meals];
      let currentMeal = { ...updatedMeals[mealIndex] };

      if (field.startsWith('address.')) {
        const addressField = field.split('.')[1];
        currentMeal.address = { ...currentMeal.address, [addressField]: value };
      } else if (field === 'additions') {
        currentMeal.additions = value.split(';').map(item => {
          const [name, protein = '', replacement = '', quantity = '1'] = item.split(',').map(s => s.trim());
          return { name, protein, replacement, quantity: parseInt(quantity) || 1 };
        }).filter(item => item.name);
      } else if (field === 'principle') {
        currentMeal.principle = value ? value.split(',').map(name => ({ name: name.trim() })).filter(p => p.name) : [];
      } else if (field === 'sides') {
        currentMeal.sides = value.split(',').map(name => ({ name: name.trim() })).filter(s => s.name);
      } else if (field === 'cutlery') {
        currentMeal.cutlery = { name: value };
      } else {
        currentMeal[field] = ['soup', 'soupReplacement', 'protein', 'drink', 'time', 'payment', 'principleReplacement'].includes(field)
          ? { name: value }
          : value;
      }
      updatedMeals[mealIndex] = currentMeal;
      return { ...prevForm, meals: updatedMeals };
    });
  };

  const exportToCSV = useCallback(() => {
    const headers = [
      'ID', 'Número de Bandeja', 'Sopa', 'Principio', 'Proteína', 'Bebida', 'Cubiertos', 'Acompañamientos', 'Adiciones', 'Notas',
      'Hora de Entrega', 'Dirección Completa', 'Tipo de Lugar', 'Nombre del Local', 'Nombre del Destinatario', 'Detalles de Unidad',
      'Teléfono', 'Método de Pago (Bandeja)', 'Total del Pedido', 'Método de Pago (Pedido General)', 'Domiciliario', 'Estado', 'Fecha de Creación', 'Última Actualización'
    ];
    const rows = orders.flatMap(order => {
      return order.meals?.map((meal, mealIndex) => {
        const address = meal.address || {};
        const addressDisplay = getAddressDisplay(address);
        const mealPayment = meal.payment ? cleanText(meal.payment?.name || meal.payment) : '';

        return [
          order.id,
          mealIndex + 1,
          cleanText(meal.soup?.name || meal.soup),
          Array.isArray(meal.principle) ? meal.principle.map(p => cleanText(p.name || p)).join(', ') : cleanText(meal.principle?.name || meal.principle),
          cleanText(meal.protein?.name || meal.protein),
          cleanText(meal.drink?.name || meal.drink),
          cleanText(meal.cutlery?.name || meal.cutlery),
          meal.sides?.map(s => cleanText(s.name || s)).join(', '),
          meal.additions?.map(a => `${cleanText(a.name || a)}${a.protein || a.replacement ? ` (${cleanText(a.protein || a.replacement)})` : ''} (${a.quantity || 1})`).join('; '),
          cleanText(meal.notes),
          cleanText(meal.time?.name || meal.time),
          addressDisplay,
          cleanText(address.addressType),
          cleanText(address.localName),
          cleanText(address.recipientName),
          cleanText(address.unitDetails),
          cleanText(address.phoneNumber),
          mealPayment,
          order.total || 0,
          cleanText(order.payment),
          cleanText(order.deliveryPerson),
          cleanText(order.status),
          order.createdAt ? new Date(order.createdAt.seconds * 1000).toLocaleString() : '',
          order.updatedAt ? new Date(order.updatedAt.seconds * 1000).toLocaleString() : '',
        ].map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',');
      }) || [];
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedidos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    setSuccess('Pedidos exportados a CSV.');
  }, [orders, setSuccess]);

  const sortedAndFilteredOrders = useMemo(() => {
    // Create a copy of orders with indices for stable reference
    const indexedOrders = orders.map((order, index) => ({ ...order, originalIndex: index }));

    // Filter orders based on search term
    let filtered = indexedOrders.filter(order => {
      const searchLower = searchTerm.toLowerCase();
      const idMatch = order.id?.toLowerCase().includes(searchLower) || false;
      const mealMatch = order.meals?.some(meal => {
        const mealValues = [
          meal.soup?.name || meal.soup,
          meal.soupReplacement?.name || meal.soupReplacement,
          ...(Array.isArray(meal.principle) ? meal.principle.map(p => p.name || p) : [meal.principle?.name || meal.principle]),
          meal.principleReplacement?.name || meal.principleReplacement,
          meal.protein?.name || meal.protein,
          meal.drink?.name || meal.drink,
          meal.address?.address,
          meal.address?.localName,
          meal.address?.recipientName,
          meal.address?.unitDetails,
          meal.address?.phoneNumber,
          meal.payment?.name || meal.payment,
          meal.notes,
          ...(meal.sides?.map(s => s.name || s) || []),
          ...(meal.additions?.map(a => `${a.name || a}${a.protein || a.replacement || ''}`) || []),
        ];
        return mealValues.some(val => cleanText(val)?.toLowerCase().includes(searchLower));
      }) || false;
      const statusMatch = cleanText(order.status)?.toLowerCase().includes(searchLower) || false;
      const paymentMatch = cleanText(order.payment)?.toLowerCase().includes(searchLower) || false;
      const deliveryPersonMatch = cleanText(order.deliveryPerson)?.toLowerCase().includes(searchLower) || false;
      return idMatch || mealMatch || statusMatch || paymentMatch || deliveryPersonMatch;
    });

    // Sort filtered orders
    filtered.sort((a, b) => {
      if (sortBy === 'orderNumber') {
        // Sort by originalIndex to maintain stable order
        const aNumber = a.originalIndex;
        const bNumber = b.originalIndex;
        return sortOrder === 'asc' ? aNumber - bNumber : bNumber - aNumber;
      }

      let aValue = getNestedProperty(a, sortBy);
      let bValue = getNestedProperty(b, sortBy);

      // Handle time sorting with proper date/time parsing
      if (sortBy === 'meals.0.time.name') {
        aValue = cleanText(aValue) || 'No especificada';
        bValue = cleanText(bValue) || 'No especificada';
        try {
          const aTime = new Date(`1970-01-01 ${aValue}`);
          const bTime = new Date(`1970-01-01 ${bValue}`);
          if (!isNaN(aTime) && !isNaN(bTime)) {
            return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
          }
        } catch {
          // Fallback to string comparison
        }
      }

      // Ensure values are strings for comparison and handle null/undefined
      aValue = cleanText(aValue) || '';
      bValue = cleanText(bValue) || '';

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
      return sortOrder === 'asc' ? (aValue || 0) - (bValue || 0) : (bValue || 0) - (aValue || 0);
    });

    return filtered;
  }, [orders, searchTerm, sortBy, sortOrder]);

  const totalPages = Math.ceil(sortedAndFilteredOrders.length / itemsPerPage);
  const paginatedOrders = sortedAndFilteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (column) => {
    if (sortBy === column) {
      return sortOrder === 'asc' ? <ArrowUpIcon className="w-4 h-4 ml-1 inline" /> : <ArrowDownIcon className="w-4 h-4 ml-1 inline" />;
    }
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Gestión de Pedidos</h2>

      {/* Totals Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 text-sm text-gray-700 dark:text-gray-300">
        <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg shadow-sm">
          <p className="font-semibold">Total Efectivo</p>
          <p className="text-lg font-bold">${totals.cash.toLocaleString('es-CO')}</p>
        </div>
        <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg shadow-sm">
          <p className="font-semibold">Total Daviplata</p>
          <p className="text-lg font-bold">${totals.daviplata.toLocaleString('es-CO')}</p>
        </div>
        <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg shadow-sm">
          <p className="font-semibold">Total Nequi</p>
          <p className="text-lg font-bold">${totals.nequi.toLocaleString('es-CO')}</p>
        </div>
        <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg shadow-sm">
          <p className="font-semibold">Total General</p>
          <p className="text-lg font-bold">${(totals.cash + totals.daviplata + totals.nequi).toLocaleString('es-CO')}</p>
        </div>
      </div>

      {/* Controls: Search, Export, Delete All */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Buscar pedidos..."
          className={classNames(
            "p-3 rounded-lg border",
            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900',
            "focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-96 shadow-sm text-base transition-all duration-200"
          )}
        />
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={exportToCSV}
            className="flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-md transition-all duration-200 text-sm font-medium"
            aria-label="Exportar pedidos a CSV"
          >
            <ArrowDownTrayIcon className="w-5 h-5 mr-2" /> Exportar CSV
          </button>
          <button
            onClick={() => setShowConfirmDeleteAll(true)}
            className="flex items-center justify-center bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-md transition-all duration-200 text-sm font-medium"
            aria-label="Borrar todos los pedidos"
          >
            <TrashIcon className="w-5 h-5 mr-2" /> Borrar Todos
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className={classNames(
        "p-4 rounded-2xl shadow-xl max-h-[70vh] overflow-y-auto custom-scrollbar transition-all duration-300",
        theme === 'dark' ? 'bg-gray-800' : 'bg-white'
      )}>
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left border-collapse text-sm">
                <thead>
                  <tr className={classNames(
                    "font-semibold sticky top-0 z-10 shadow-sm",
                    theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'
                  )}>
                    <th className="p-3 border-b cursor-pointer" onClick={() => handleSort('orderNumber')}>
                      Nº {getSortIcon('orderNumber')}
                    </th>
                    <th className="p-3 border-b">Detalles</th>
                    <th className="p-3 border-b cursor-pointer" onClick={() => handleSort('meals.0.address.address')}>
                      Dirección {getSortIcon('meals.0.address.address')}
                    </th>
                    <th className="p-3 border-b hidden lg:table-cell cursor-pointer" onClick={() => handleSort('meals.0.address.phoneNumber')}>
                      Teléfono {getSortIcon('meals.0.address.phoneNumber')}
                    </th>
                    <th className="p-3 border-b hidden md:table-cell cursor-pointer" onClick={() => handleSort('meals.0.time.name')}>
                      Hora {getSortIcon('meals.0.time.name')}
                    </th>
                    <th className="p-3 border-b hidden sm:table-cell cursor-pointer" onClick={() => handleSort('payment')}>
                      Pago {getSortIcon('payment')}
                    </th>
                    <th className="p-3 border-b hidden sm:table-cell cursor-pointer" onClick={() => handleSort('total')}>
                      Total {getSortIcon('total')}
                    </th>
                    <th className="p-3 border-b hidden sm:table-cell cursor-pointer" onClick={() => handleSort('deliveryPerson')}>
                      Domiciliario {getSortIcon('deliveryPerson')}
                    </th>
                    <th className="p-3 border-b hidden sm:table-cell cursor-pointer" onClick={() => handleSort('status')}>
                      Estado {getSortIcon('status')}
                    </th>
                    <th className="p-3 border-b">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="p-6 text-center text-gray-500 dark:text-gray-400">
                        No se encontraron pedidos. Intenta ajustar tu búsqueda o filtros.
                      </td>
                    </tr>
                  ) : (
                    paginatedOrders.map((order, index) => {
                      // Calculate display number based on pagination and sort order
                      const displayNumber = sortOrder === 'asc'
                        ? (currentPage - 1) * itemsPerPage + index + 1
                        : sortedAndFilteredOrders.length - ((currentPage - 1) * itemsPerPage + index);
                      
                      const addressDisplay = getAddressDisplay(order.meals?.[0]?.address);
                      const paymentDisplay = cleanText(order.payment || order.meals?.[0]?.payment?.name || order.meals?.[0]?.payment || 'Sin pago');
                      const statusClass = order.status === 'Pendiente' ? 'bg-yellow-500 text-black' : order.status === 'Entregado' ? 'bg-green-500 text-white' : order.status === 'Cancelado' ? 'bg-red-500 text-white' : '';

                      return (
                        <tr
                          key={order.id}
                          className={classNames(
                            "border-b transition-colors duration-150",
                            theme === 'dark' ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50',
                            index % 2 === 0 ? (theme === 'dark' ? 'bg-gray-750' : 'bg-gray-50') : ''
                          )}
                        >
                          <td className="p-3 text-gray-900 dark:text-gray-300 font-semibold">{displayNumber}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-300">
                            <div className="flex items-center h-full">
                              <button
                                onClick={() => setShowMealDetails(order)}
                                className="text-blue-500 hover:text-blue-400 transition-colors duration-150 p-1 rounded-md"
                                title="Ver detalles de la bandeja"
                                aria-label={`Ver detalles del pedido ${order.id}`}
                              >
                                <InformationCircleIcon className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                          <td className="p-3 text-gray-900 dark:text-gray-300 max-w-[200px] truncate" title={addressDisplay}>{addressDisplay}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-300 hidden lg:table-cell">{cleanText(order.meals?.[0]?.address?.phoneNumber)}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-300 hidden md:table-cell">{cleanText(order.meals?.[0]?.time?.name || order.meals?.[0]?.time)}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-300 hidden sm:table-cell">{paymentDisplay}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-300 hidden sm:table-cell font-medium">${order.total?.toLocaleString('es-CO') || '0'}</td>
                          <td className="p-3 text-gray-900 dark:text-gray-300 hidden sm:table-cell">
                            {editingDeliveryId === order.id ? (
                              <input
                                type="text"
                                value={editForm.deliveryPerson || ''}
                                onChange={(e) => setEditForm({ ...editForm, deliveryPerson: e.target.value })}
                                onBlur={(e) => handleDeliveryChange(order.id, e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleDeliveryChange(order.id, e.target.value)}
                                className={classNames(
                                  "w-full p-2 rounded-lg border text-sm",
                                  theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-200 text-gray-900',
                                  "focus:outline-none focus:ring-2 focus:ring-blue-500"
                                )}
                                autoFocus
                                aria-label={`Editar domiciliario para pedido ${order.id}`}
                              />
                            ) : (
                              <span
                                onClick={() => { setEditingDeliveryId(order.id); setEditForm(prev => ({ ...prev, deliveryPerson: order.deliveryPerson || '' })); }}
                                className="cursor-pointer hover:underline"
                                title="Click para editar"
                              >
                                {order.deliveryPerson || 'Sin asignar'}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-gray-900 dark:text-gray-300 hidden sm:table-cell">
                            <select
                              value={order.status || 'Pendiente'}
                              onChange={(e) => handleStatusChange(order.id, e.target.value)}
                              className={classNames(
                                "p-2 rounded-lg text-xs font-medium border focus:outline-none focus:ring-2 focus:ring-blue-500",
                                statusClass,
                                theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'
                              )}
                              style={{ appearance: 'menulist-button' }}
                              aria-label={`Cambiar estado del pedido ${order.id}`}
                            >
                              <option value="Pendiente">Pendiente</option>
                              <option value="Entregado">Entregado</option>
                              <option value="Cancelado">Cancelado</option>
                            </select>
                            <style>
                              {`
                                select option {
                                  background-color: ${theme === 'dark' ? '#4B5563' : '#FFFFFF'} !important;
                                  color: ${theme === 'dark' ? '#F9FAFB' : '#1F2937'} !important;
                                }
                              `}
                            </style>
                          </td>
                          <td className="p-3 flex space-x-2 items-center">
                            <button
                              onClick={() => handleEditOrder(order)}
                              className="text-blue-500 hover:text-blue-400 transition-colors duration-150 p-1 rounded-md"
                              title="Editar pedido"
                              aria-label={`Editar pedido ${order.id}`}
                            >
                              <PencilIcon className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteOrder(order.id)}
                              className="text-red-500 hover:text-red-400 transition-colors duration-150 p-1 rounded-md"
                              title="Eliminar pedido"
                              aria-label={`Eliminar pedido ${order.id}`}
                            >
                              <TrashIcon className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Pedidos por página:</span>
                <select
                  value={itemsPerPage}
                  onChange={e => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className={classNames(
                    "p-2 rounded-lg border text-sm",
                    theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'
                  )}
                  aria-label="Seleccionar número de pedidos por página"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={30}>30</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={classNames(
                    "p-2 rounded-lg transition-all duration-200",
                    currentPage === 1 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
                  )}
                  aria-label="Página anterior"
                >
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={classNames(
                    "p-2 rounded-lg transition-all duration-200",
                    currentPage === totalPages ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
                  )}
                  aria-label="Página siguiente"
                >
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Delivery Persons Summary */}
      <div className="mt-8">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Resumen por Domiciliarios</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Object.keys(deliveryPersons).length === 0 ? (
            <p className="col-span-full text-center text-gray-500 dark:text-gray-400 p-4">No hay datos de domiciliarios disponibles.</p>
          ) : (
            Object.entries(deliveryPersons).map(([name, totals]) => (
              <div key={name} className={classNames(
                "p-5 rounded-lg shadow-md",
                theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-gray-100 text-gray-700'
              )}>
                <p className="font-semibold text-lg mb-2">{name}</p>
                <p className="text-base">Efectivo: <span className="font-medium">${totals.cash.toLocaleString('es-CO')}</span></p>
                <p className="text-base">Daviplata: <span className="font-medium">${totals.daviplata.toLocaleString('es-CO')}</span></p>
                <p className="text-base">Nequi: <span className="font-medium">${totals.nequi.toLocaleString('es-CO')}</span></p>
                <p className="text-base font-bold mt-2">Total: <span className="text-blue-500">${totals.total.toLocaleString('es-CO')}</span></p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Meal Details Modal */}
      {showMealDetails && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="meal-details-title"
        >
          <div className={classNames(
            "p-6 sm:p-8 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto transition-all duration-300 transform scale-95 animate-scaleIn",
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}>
            <div className="flex justify-between items-center mb-6">
              <h2 id="meal-details-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">Detalles del Pedido #{showMealDetails.id}</h2>
              <button
                onClick={() => setShowMealDetails(null)}
                className="text-gray-400 hover:text-gray-200 transition-colors duration-150 p-1 rounded-full"
                aria-label="Cerrar detalles del pedido"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Estado:</h3>
                <span className={classNames(
                  "px-3 py-1 rounded-full text-sm font-medium",
                  showMealDetails.status === 'Pendiente' ? 'bg-yellow-500 text-black' : showMealDetails.status === 'Entregado' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                )}>
                  {showMealDetails.status || 'Pendiente'}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Fecha de Creación:</h3>
                <p className="text-gray-900 dark:text-gray-100">
                  {showMealDetails.createdAt ? new Date(showMealDetails.createdAt.seconds * 1000).toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                </p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Total del Pedido:</h3>
                <p className="text-gray-900 dark:text-gray-100 font-bold text-lg">${showMealDetails.total?.toLocaleString('es-CO') || '0'}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Domiciliario Asignado:</h3>
                <p className="text-gray-900 dark:text-gray-100">{showMealDetails.deliveryPerson || 'Sin asignar'}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Resumen de Almuerzos:</h3>
                {(() => {
                  const { areIdentical, count } = areMealsIdentical(showMealDetails.meals);
                  if (areIdentical && count > 1) {
                    return (
                      <div className={classNames(
                        "p-4 rounded-lg mb-4",
                        theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                      )}>
                        <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">{count} almuerzos idénticos</h4>
                        <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans break-words">{getMealDetailsDisplay(showMealDetails.meals[0])}</pre>
                      </div>
                    );
                  }
                  return showMealDetails.meals?.map((meal, index) => (
                    <div key={index} className={classNames(
                      "p-4 rounded-lg mb-4",
                      theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'
                    )}>
                      <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-2">Almuerzo #{index + 1}</h4>
                      <pre className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans break-words">{getMealDetailsDisplay(meal)}</pre>
                    </div>
                  ));
                })()}
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { handleEditOrder(showMealDetails); setShowMealDetails(null); }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg shadow-md transition-all duration-200 text-sm font-medium"
                aria-label={`Editar pedido ${showMealDetails.id}`}
              >
                Editar Pedido
              </button>
              <button
                onClick={() => setShowMealDetails(null)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white p-3 rounded-lg shadow-md transition-all duration-200 text-sm font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-order-title"
        >
          <div className={classNames(
            "p-6 sm:p-8 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto transition-all duration-300 transform scale-95 animate-scaleIn",
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}>
            <div className="flex justify-between items-center mb-6">
              <h2 id="edit-order-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">Editar Pedido #{editingOrder.id}</h2>
              <button
                onClick={() => setEditingOrder(null)}
                className="text-gray-400 hover:text-gray-200 transition-colors duration-150 p-1 rounded-full"
                aria-label="Cerrar edición de pedido"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            {editForm.meals.map((meal, index) => (
              <div key={index} className={classNames(
                "mb-6 pb-4",
                index < editForm.meals.length - 1 ? (theme === 'dark' ? 'border-b border-gray-700' : 'border-b border-gray-200') : ''
              )}>
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Almuerzo #{index + 1}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="block">
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Sopa:</span>
                    <input type="text" value={cleanText(meal.soup?.name || meal.soup)} onChange={e => handleMealFormFieldChange(index, 'soup', e.target.value)} placeholder="Sopa"
                      className={classNames("mt-1 w-full p-2 border rounded-lg text-sm", theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900', "focus:outline-none focus:ring-2 focus:ring-blue-500")} />
                  </label>
                  <label className="block">
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Reemplazo Sopa:</span>
                    <input type="text" value={cleanText(meal.soupReplacement?.name || meal.soupReplacement)} onChange={e => handleMealFormFieldChange(index, 'soupReplacement', e.target.value)} placeholder="Reemplazo Sopa"
                      className={classNames("mt-1 w-full p-2 border rounded-lg text-sm", theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900', "focus:outline-none focus:ring-2 focus:ring-blue-500")} />
                  </label>
                  <label className="block">
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Principio:</span>
                    <input type="text" value={Array.isArray(meal.principle) ? meal.principle.map(p => cleanText(p.name || p)).join(', ') : cleanText(meal.principle?.name || meal.principle)} onChange={e => handleMealFormFieldChange(index, 'principle', e.target.value)} placeholder="Principio (ej: Arroz, Pasta)"
                      className={classNames("mt-1 w-full p-2 border rounded-lg text-sm", theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900', "focus:outline-none focus:ring-2 focus:ring-blue-500")} />
                  </label>
                  <label className="block">
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Reemplazo Principio:</span>
                    <input type="text" value={cleanText(meal.principleReplacement?.name || meal.principleReplacement)} onChange={e => handleMealFormFieldChange(index, 'principleReplacement', e.target.value)} placeholder="Reemplazo Principio"
                      className={classNames("mt-1 w-full p-2 border rounded-lg text-sm", theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900', "focus:outline-none focus:ring-2 focus:ring-blue-500")} />
                  </label>
                  <label className="block">
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Proteína:</span>
                    <input type="text" value={cleanText(meal.protein?.name || meal.protein)} onChange={e => handleMealFormFieldChange(index, 'protein', e.target.value)} placeholder="Proteína"
                      className={classNames("mt-1 w-full p-2 border rounded-lg text-sm", theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900', "focus:outline-none focus:ring-2 focus:ring-blue-500")} />
                  </label>
                  <label className="block">
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Bebida:</span>
                    <input type="text" value={cleanText(meal.drink?.name || meal.drink)} onChange={e => handleMealFormFieldChange(index, 'drink', e.target.value)} placeholder="Bebida"
                      className={classNames("mt-1 w-full p-2 border rounded-lg text-sm", theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900', "focus:outline-none focus:ring-2 focus:ring-blue-500")} />
                  </label>
                  <label className="block">
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Cubiertos:</span>
                    <select value={cleanText(meal.cutlery?.name || meal.cutlery)} onChange={e => handleMealFormFieldChange(index, 'cutlery', e.target.value)}
                      className={classNames("mt-1 w-full p-2 border rounded-lg text-sm", theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900', "focus:outline-none focus:ring-2 focus:ring-blue-500")}>
                      <option value="Sí">Sí</option>
                      <option value="No">No</option>
                    </select>
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Acompañamientos (separados por coma):</span>
                    <input type="text" value={meal.sides?.map(s => cleanText(s.name || s)).join(', ') || ''} onChange={e => handleMealFormFieldChange(index, 'sides', e.target.value)} placeholder="Ej: Papa, Ensalada"
                      className={classNames("mt-1 w-full p-2 border rounded-lg text-sm", theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900', "focus:outline-none focus:ring-2 focus:ring-blue-500")} />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Adiciones (ej: nombre,prot_reemplazo,cant;):</span>
                    <input type="text" value={meal.additions?.map(a => `${cleanText(a.name || a)}${a.protein || a.replacement ? `,${cleanText(a.protein || a.replacement)}` : ''},${a.quantity || 1}`).join(';') || ''} onChange={e => handleMealFormFieldChange(index, 'additions', e.target.value)} placeholder="Ej: Aguacate,,1;Pollo desmechado,Res,1"
                      className={classNames("mt-1 w-full p-2 border rounded-lg text-sm", theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900', "focus:outline-none focus:ring-2 focus:ring-blue-500")} />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Notas:</span>
                    <textarea value={meal.notes || ''} onChange={e => handleMealFormFieldChange(index, 'notes', e.target.value)} placeholder="Notas adicionales del pedido..." rows="2"
                      className={classNames("mt-1 w-full p-2 border rounded-lg text-sm resize-y", theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900', "focus:outline-none focus:ring-2 focus:ring-blue-500")} />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Dirección:</span>
                    <input type="text" value={meal.address?.address || ''} onChange={e => handleMealFormFieldChange(index, 'address.address', e.target.value)} placeholder="CL 123 #125-67"
                      className={classNames("mt-1 w-full p-2 border rounded-lg text-sm", theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900', "focus:outline-none focus:ring-2 focus:ring-blue-500")} />
                  </label>
                  <label className="block">
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Tipo de Lugar:</span>
                    <select value={meal.address?.addressType || 'house'} onChange={e => handleMealFormFieldChange(index, 'address.addressType', e.target.value)}
                      className={classNames("mt-1 w-full p-2 border rounded-lg text-sm", theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900', "focus:outline-none focus:ring-2 focus:ring-blue-500")}>
                      <option value="house">Casa/Apartamento</option>
                      <option value="school">Colegio/Oficina</option>
                      <option value="complex">Conjunto Residencial</option>
                      <option value="shop">Tienda/Local</option>
                    </select>
                  </label>
                  {meal.address?.addressType === 'school' && (
                    <label className="block">
                      <span className="text-gray-700 dark:text-gray-300 text-sm">Nombre del destinatario:</span>
                      <input type="text" value={meal.address?.recipientName || ''} onChange={e => handleMealFormFieldChange(index, 'address.recipientName', e.target.value)} placeholder="Nombre"
                        className={classNames("mt-1 w-full p-2 border rounded-lg text-sm", theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900', "focus:outline-none focus:ring-2 focus:ring-blue-500")} />
                    </label>
                  )}
                  {meal.address?.addressType === 'complex' && (
                    <label className="block">
                      <span className="text-gray-700 dark:text-gray-300 text-sm">Detalles de unidad:</span>
                      <input type="text" value={meal.address?.unitDetails || ''} onChange={e => handleMealFormFieldChange(index, 'address.unitDetails', e.target.value)} placeholder="Torre, Apto, Bloque"
                        className={classNames("mt-1 w-full p-2 border rounded-lg text-sm", theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900', "focus:outline-none focus:ring-2 focus:ring-blue-500")} />
                    </label>
                  )}
                  {meal.address?.addressType === 'shop' && (
                    <label className="block">
                      <span className="text-gray-700 dark:text-gray-300 text-sm">Nombre del local:</span>
                      <input type="text" value={meal.address?.localName || ''} onChange={e => handleMealFormFieldChange(index, 'address.localName', e.target.value)} placeholder="Nombre del local"
                        className={classNames("mt-1 w-full p-2 border rounded-lg text-sm", theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900', "focus:outline-none focus:ring-2 focus:ring-blue-500")} />
                    </label>
                  )}
                  <label className="block">
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Teléfono:</span>
                    <input type="text" value={meal.address?.phoneNumber || ''} onChange={e => handleMealFormFieldChange(index, 'address.phoneNumber', e.target.value)} placeholder="Teléfono"
                      className={classNames("mt-1 w-full p-2 border rounded-lg text-sm", theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900', "focus:outline-none focus:ring-2 focus:ring-blue-500")} />
                  </label>
                  <label className="block">
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Hora de Entrega:</span>
                    <input type="text" value={cleanText(meal.time?.name || meal.time)} onChange={e => handleMealFormFieldChange(index, 'time', e.target.value)} placeholder="Ej: 1:00 PM"
                      className={classNames("mt-1 w-full p-2 border rounded-lg text-sm", theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900', "focus:outline-none focus:ring-2 focus:ring-blue-500")} />
                  </label>
                  <label className="block">
                    <span className="text-gray-700 dark:text-gray-300 text-sm">Pago de este Almuerzo:</span>
                    <select value={cleanText(meal.payment?.name || meal.payment)} onChange={e => handleMealFormFieldChange(index, 'payment', e.target.value)}
                      className={classNames("mt-1 w-full p-2 border rounded-lg text-sm", theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900', "focus:outline-none focus:ring-2 focus:ring-blue-500")}>
                      <option value="Efectivo">Efectivo</option>
                      <option value="Daviplata">Daviplata</option>
                      <option value="Nequi">Nequi</option>
                    </select>
                  </label>
                </div>
              </div>
            ))}
            <div className="space-y-4 pt-4">
              <label className="block">
                <span className="text-gray-700 dark:text-gray-300 font-medium text-sm">Total General del Pedido</span>
                <input
                  type="number"
                  value={editForm.total}
                  onChange={e => setEditForm({ ...editForm, total: Number(e.target.value) })}
                  className={classNames("mt-1 w-full p-3 border rounded-lg text-sm", theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900', "focus:outline-none focus:ring-2 focus:ring-blue-500")}
                  aria-label="Total general del pedido"
                />
              </label>
              <label className="block">
                <span className="text-gray-700 dark:text-gray-300 font-medium text-sm">Método de Pago General</span>
                <select
                  value={editForm.payment}
                  onChange={e => setEditForm({ ...editForm, payment: e.target.value })}
                  className={classNames("mt-1 w-full p-3 border rounded-lg text-sm", theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900', "focus:outline-none focus:ring-2 focus:ring-blue-500")}
                  aria-label="Método de pago general"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Daviplata">Daviplata</option>
                  <option value="Nequi">Nequi</option>
                </select>
              </label>
              <label className="block">
                <span className="text-gray-700 dark:text-gray-300 font-medium text-sm">Domiciliario</span>
                <input
                  type="text"
                  value={editForm.deliveryPerson}
                  onChange={e => setEditForm({ ...editForm, deliveryPerson: e.target.value })}
                  className={classNames("mt-1 w-full p-3 border rounded-lg text-sm", theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900', "focus:outline-none focus:ring-2 focus:ring-blue-500")}
                  aria-label="Nombre del domiciliario"
                />
              </label>
              <label className="block">
                <span className="text-gray-700 dark:text-gray-300 font-medium text-sm">Estado</span>
                <select
                  value={editForm.status}
                  onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                  className={classNames(
                    "mt-1 w-full p-3 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
                    editForm.status === 'Pendiente' ? 'bg-yellow-500 text-black' : editForm.status === 'Entregado' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                  )}
                  aria-label="Estado del pedido"
                >
                  <option value="Pendiente">Pendiente</option>
                  <option value="Entregado">Entregado</option>
                  <option value="Cancelado">Cancelado</option>
                </select>
              </label>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSaveEdit}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white p-3 rounded-lg shadow-md transition-all duration-200 text-sm font-medium"
                disabled={isLoading}
              >
                {isLoading ? 'Guardando...' : 'Guardar Cambios'}
              </button>
              <button
                onClick={() => setEditingOrder(null)}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white p-3 rounded-lg shadow-md transition-all duration-200 text-sm font-medium"
                disabled={isLoading}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete All Modal */}
      {showConfirmDeleteAll && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
        >
          <div className={classNames(
            "p-6 sm:p-8 rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto transition-all duration-300 transform scale-95 animate-scaleIn",
            theme === 'dark' ? 'bg-gray-800' : 'bg-white'
          )}>
            <div className="flex justify-between items-center mb-6">
              <h2 id="confirm-delete-title" className="text-xl font-bold text-gray-900 dark:text-gray-100">Confirmar Eliminación Masiva</h2>
              <button
                onClick={() => { setShowConfirmDeleteAll(false); setConfirmText(''); }}
                className="text-gray-400 hover:text-gray-200 transition-colors duration-150 p-1 rounded-full"
                aria-label="Cerrar confirmación de eliminación"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-4 text-base">
              Estás a punto de eliminar <strong className="text-red-500">TODOS</strong> los pedidos. Esta acción es irreversible.
              Para confirmar, por favor escribe "<span className="font-bold text-red-500">confirmar</span>" en el campo de abajo.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="Escribe 'confirmar' aquí"
              className={classNames(
                "w-full p-3 border rounded-lg text-sm mb-4",
                theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-gray-50 text-gray-900',
                "focus:outline-none focus:ring-2 focus:ring-red-500"
              )}
              aria-label="Campo de confirmación para eliminar todos los pedidos"
            />
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAllOrders}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white p-3 rounded-lg shadow-md transition-all duration-200 text-sm font-medium transform hover:scale-105"
                disabled={isLoading || confirmText.toLowerCase() !== 'confirmar'}
              >
                {isLoading ? 'Eliminando...' : 'Eliminar Todos'}
              </button>
              <button
                onClick={() => { setShowConfirmDeleteAll(false); setConfirmText(''); }}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white p-3 rounded-lg shadow-md transition-all duration-200 text-sm font-medium transform hover:scale-105"
                disabled={isLoading}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManagement;