// src/components/Admin/OrderManagement.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from '../../config/firebase.js';
import {
  collection,
  onSnapshot,
  updateDoc,
  doc,
  deleteDoc,
  getDocs,
  query,
  where,
  writeBatch,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { exportToExcel } from './utilities/exportToExcel.js';
import { exportToPDF } from './utilities/exportToPDF.js';
import { exportToCSV } from './utilities/exportToCSV.js';
import { generatePreviewHtml } from './utilities/previewOrders.js';
import { generateExcelPreviewHtml } from './utilities/previewExcel.js';
import { cleanText, getAddressDisplay } from './utils.js';
import { getColombiaLocalDateString } from '../../utils/bogotaDate.js';
import TablaPedidos from './TablaPedidos.js';
import InteraccionesPedidos from './InteraccionesPedidos.js';

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
  const [showAddOrderModal, setShowAddOrderModal] = useState(false);
  const [orderTypeFilter, setOrderTypeFilter] = useState('all');
  // Filtro de fecha para domicilios - inicializar con fecha actual
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // Formato YYYY-MM-DD
  });
  const [newOrderForm, setNewOrderForm] = useState({
    meals: [
      {
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
          recipientName: ''
        },
        time: '',
        payment: 'Efectivo'
      }
    ],
    total: 0,
    status: 'Pendiente',
    payment: 'Efectivo',
    deliveryPerson: 'Sin asignar',
    type: 'lunch'
  });

  const totalProteinUnits = useMemo(
    () => proteins.reduce((sum, p) => sum + Number(p.quantity || 0), 0),
    [proteins]
  );

  const logActivity = useCallback(async (action, details = {}) => {
    try {
      await addDoc(collection(db, 'userActivity'), {
        action,
        timestamp: serverTimestamp(),
        details
      });
    } catch (error) {
      console.error('Error al registrar actividad:', error);
    }
  }, []);

  const handleExport = (exportFunction, format) => {
    try {
      exportFunction(orders, totals, deliveryPersons, totalProteinUnits, proteins);
      setSuccess(`Exportado correctamente como ${format}.`);
      logActivity(`Exportó pedidos como ${format}`, { format });
    } catch (error) {
      console.error(`Error al exportar ${format}:`, error);
      setError(`Error al exportar ${format}: ${error.message}`);
    }
  };

  const fetchOrders = useCallback(() => {
    setIsLoading(true);

    let latestLunch = [];
    let latestBreakfast = [];

    const recompute = () => {
      const merged = [...latestLunch, ...latestBreakfast];

      setOrders(merged);

      const newTotals = { cash: 0, daviplata: 0, nequi: 0, general: 0 };
      const newDeliveryPersons = {};

      merged.forEach((order) => {
        if (order.status !== 'Cancelado') {
          const paymentSummary = order.paymentSummary || { Efectivo: 0, Daviplata: 0, Nequi: 0 };
          newTotals.cash += paymentSummary['Efectivo'] || 0;
          newTotals.daviplata += paymentSummary['Daviplata'] || 0;
          newTotals.nequi += paymentSummary['Nequi'] || 0;
          newTotals.general += order.total || 0;

          const deliveryPerson = order.deliveryPerson || 'Sin asignar';
          if (deliveryPerson !== 'Sin asignar') {
            if (!newDeliveryPersons[deliveryPerson]) {
              newDeliveryPersons[deliveryPerson] = {
                almuerzo: { efectivo: 0, daviplata: 0, nequi: 0, total: 0 },
                desayuno: { efectivo: 0, daviplata: 0, nequi: 0, total: 0 }
              };
            }
            const bucket = order.type === 'breakfast' ? 'desayuno' : 'almuerzo';
            const paymentType = cleanText(order.payment || 'Efectivo').toLowerCase();
            const amount = order.total || 0;

            if (paymentType === 'efectivo') newDeliveryPersons[deliveryPerson][bucket].efectivo += amount;
            else if (paymentType === 'daviplata') newDeliveryPersons[deliveryPerson][bucket].daviplata += amount;
            else if (paymentType === 'nequi') newDeliveryPersons[deliveryPerson][bucket].nequi += amount;

            newDeliveryPersons[deliveryPerson][bucket].total += amount;
          }
        }
      });

      setTotals(newTotals);
      setDeliveryPersons(newDeliveryPersons);
      setIsLoading(false);
    };

    const unsubLunch = onSnapshot(
      collection(db, 'orders'),
      (snapshot) => {
        latestLunch = snapshot.docs.map((doc) => {
          const data = doc.data();
          const meals =
            Array.isArray(data.meals) && data.meals.length > 0
              ? data.meals
              : [{ address: {}, payment: { name: 'Efectivo' }, time: {} }];

        return {
            id: doc.id,
            type: 'lunch',
            ...data,
            meals: meals.map((meal) => ({
              ...meal,
              address: meal.address || {},
              payment:
                meal.payment && typeof meal.payment === 'object' && meal.payment.name
                  ? meal.payment
                  : { name: meal.payment || 'Efectivo' },
              time: meal.time || {}
            })),
            payment: data.payment || (meals[0]?.payment?.name || 'Efectivo'),
            paymentSummary: data.paymentSummary || { Efectivo: 0, Daviplata: 0, Nequi: 0 },
            total: data.total || 0,
            deliveryPerson: data.deliveryPerson || 'Sin asignar',
            status: data.status || 'Pendiente'
          };
        });
        recompute();
      },
      (error) => {
        setError(`Error al cargar almuerzos: ${error.message}`);
        setIsLoading(false);
      }
    );

    const unsubBreakfast = onSnapshot(
      collection(db, 'deliveryBreakfastOrders'),
      (snapshot) => {
        latestBreakfast = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            type: 'breakfast',
            ...data,
            payment: data.payment || (data.breakfasts?.[0]?.payment?.name || 'Efectivo'),
            paymentSummary: data.paymentSummary || { Efectivo: 0, Daviplata: 0, Nequi: 0 },
            total: data.total || 0,
            deliveryPerson: data.deliveryPerson || 'Sin asignar',
            status: data.status || 'Pendiente'
          };
        });
        recompute();
      },
      (error) => {
        setError(`Error al cargar desayunos: ${error.message}`);
        setIsLoading(false);
      }
    );

    return () => {
      unsubLunch();
      unsubBreakfast();
    };
  }, [setError]);

  const fetchProteins = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    const proteinsColRef = query(collection(db, 'dailyProteins'), where('date', '==', today));
    const unsubscribe = onSnapshot(
      proteinsColRef,
      (snapshot) => {
        const proteinsData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setProteins(proteinsData);
      },
      (error) => {
        setError(`Error al cargar proteínas: ${error.message}`);
      }
    );
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

  const filteredOrders = useMemo(() => {
    const result = orders.filter((order) => {
      const lowerSearchTerm = (searchTerm || '').toLowerCase();

      const addrObj = order.meals?.[0]?.address || order.breakfasts?.[0]?.address || {};
      const address = (addrObj.address || '').toLowerCase();
      
      // Incluir dirección completa para búsqueda (con información adicional)
      const fullAddressDisplay = getAddressDisplay(addrObj).toLowerCase();
      
      const phone = (addrObj.phoneNumber || '').toLowerCase();

      const timeObj = order.meals?.[0]?.time || order.breakfasts?.[0]?.time;
      const time = (typeof timeObj === 'string' ? timeObj : timeObj?.name || '').toLowerCase();

      const payment = cleanText(
        order.payment || order.meals?.[0]?.payment?.name || order.breakfasts?.[0]?.payment?.name || ''
      ).toLowerCase();

      const deliveryPerson = (order.deliveryPerson || '').toLowerCase();
      const status = (order.status || '').toLowerCase();

      // Debug temporal
      if (lowerSearchTerm.includes('plaza')) {
        console.log('🔍 Debug búsqueda Plaza:', {
          searchTerm: lowerSearchTerm,
          address,
          fullAddressDisplay,
          addrObj
        });
      }

      // Filtrado por fecha local si existe, si no, fallback robusto
      let matchesDate = true;
      if (selectedDate) {
        if (order.createdAtLocal) {
          matchesDate = order.createdAtLocal === selectedDate;
        } else {
          // createdAt puede ser Timestamp de Firestore o Date
          let orderDate;
          if (order.createdAt && order.createdAt.seconds) {
            orderDate = new Date(order.createdAt.seconds * 1000).toISOString().split('T')[0];
          } else if (order.createdAt instanceof Date) {
            orderDate = order.createdAt.toISOString().split('T')[0];
          } else if (typeof order.createdAt === 'string') {
            orderDate = order.createdAt.split('T')[0];
          } else {
            orderDate = '';
          }
          matchesDate = orderDate === selectedDate;
        }
      }

      return (
        matchesDate &&
        (orderTypeFilter === 'all' || order.type === orderTypeFilter) &&
        (address.includes(lowerSearchTerm) ||
          fullAddressDisplay.includes(lowerSearchTerm) ||
          phone.includes(lowerSearchTerm) ||
          time.includes(lowerSearchTerm) ||
          payment.includes(lowerSearchTerm) ||
          deliveryPerson.includes(lowerSearchTerm) ||
          status.includes(lowerSearchTerm))
      );
    });
    
    // Debug temporal
    if (searchTerm && searchTerm.toLowerCase().includes('plaza')) {
      console.log('🔍 Filtered orders result:', result.length, 'from', orders.length, 'for search:', searchTerm);
    }
    
    return result;
  }, [orders, searchTerm, orderTypeFilter, selectedDate]);

  // Totales visibles
  const displayedTotals = useMemo(() => {
    const t = { cash: 0, daviplata: 0, nequi: 0, general: 0 };
    filteredOrders.forEach((order) => {
      if (order.status === 'Cancelado') return;
      const ps = order.paymentSummary || { Efectivo: 0, Daviplata: 0, Nequi: 0 };
      t.cash += ps['Efectivo'] || 0;
      t.daviplata += ps['Daviplata'] || 0;
      t.nequi += ps['Nequi'] || 0;
      t.general += order.total || 0;
    });
    return t;
  }, [filteredOrders]);

  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      const getValue = (obj, path, currentFilteredOrdersArray) => {
        if (path === 'orderNumber') return obj ? currentFilteredOrdersArray.indexOf(obj) : -1;

        if (path.startsWith('createdAt')) {
          const ts = obj.createdAt;
          if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
          if (ts instanceof Date) return ts.getTime();
          return ts && ts.seconds ? ts.seconds * 1000 : 0;
        }

        const readPath = (o, p) =>
          p.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), o);

        let value = readPath(obj, path);

        if ((value === undefined || value === null || value === '') && path.startsWith('meals.0.')) {
          const altPath = path.replace(/^meals\.0\./, 'breakfasts.0.');
          value = readPath(obj, altPath);
        }

        if (path.endsWith('.time.name') && typeof value !== 'string') {
          value = value?.name || '';
        }

        return typeof value === 'number' ? value : cleanText(value) || '';
      };

      const valueA = getValue(a, sortBy, filteredOrders);
      const valueB = getValue(b, sortBy, filteredOrders);

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
      <svg className="w-4 h-4 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 inline ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const handleAddProtein = async () => {
    if (
      !newProtein.name ||
      !newProtein.quantity ||
      isNaN(newProtein.quantity) ||
      Number(newProtein.quantity) <= 0
    ) {
      setError('Por favor, ingrese un nombre de proteína válido y una cantidad mayor a 0.');
      return;
    }
    setIsLoading(true);
    try {
      await addDoc(collection(db, 'dailyProteins'), {
        name: newProtein.name.trim(),
        quantity: Number(newProtein.quantity),
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date()
      });
      setNewProtein({ name: '', quantity: '' });
      setShowProteinModal(false);
      setSuccess('Proteína agregada correctamente.');
      logActivity(`Agregó proteína: ${newProtein.name} (${newProtein.quantity} unidades)`, {
        proteinName: newProtein.name,
        quantity: Number(newProtein.quantity)
      });
    } catch (error) {
      setError(`Error al agregar proteína: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditOrder = useCallback((order) => {
    setEditingOrder(order);

    const defaultAddress = {
      address: '',
      phoneNumber: '',
      addressType: '',
      localName: '',
      recipientName: '',
      unitDetails: ''
    };

    if (order.type === 'breakfast') {
      const breakfasts =
        Array.isArray(order.breakfasts) && order.breakfasts.length > 0
          ? order.breakfasts.map((b) => ({
              ...b,
              address: b.address || { ...defaultAddress },
              additions: Array.isArray(b.additions) ? b.additions : [],
              cutlery: typeof b.cutlery === 'boolean' ? b.cutlery : !!b.cutlery,
              time: b.time || '',
              notes: b.notes || '',
              type: b.type || null,
              eggs: b.eggs || null,
              broth: b.broth || null,
              riceBread: b.riceBread || null,
              drink: b.drink || null,
              protein: b.protein || null
            }))
          : [
              {
                type: null,
                eggs: null,
                broth: null,
                riceBread: null,
                drink: null,
                protein: null,
                additions: [],
                notes: '',
                cutlery: false,
                time: '',
                address: { ...defaultAddress }
              }
            ];

      setEditForm({
        id: order.id,
        breakfasts,
        total: order.total || 0,
        status: order.status || 'Pendiente',
        payment: order.payment ? cleanText(order.payment) : 'Efectivo',
        deliveryPerson: order.deliveryPerson || 'Sin asignar',
        type: 'breakfast'
      });
      return;
    }

    const meals =
      Array.isArray(order.meals) && order.meals.length > 0
        ? order.meals.map((meal) => ({
            ...meal,
            address: meal.address || { ...defaultAddress },
            payment: meal.payment ? cleanText(meal.payment?.name || meal.payment) : 'Efectivo',
            additions: Array.isArray(meal.additions) ? meal.additions : [],
            principle: Array.isArray(meal.principle)
              ? meal.principle
              : meal.principle
              ? [{ name: meal.principle.name || meal.principle }]
              : [],
            cutlery: typeof meal.cutlery === 'boolean' ? meal.cutlery : !!meal.cutlery,
            sides: Array.isArray(meal.sides) ? meal.sides : [],
            soup: meal.soup || '',
            soupReplacement: meal.soupReplacement || '',
            protein: meal.protein || '',
            drink: meal.drink || '',
            time: meal.time || '',
            notes: meal.notes || ''
          }))
        : [
            {
              soup: '',
              soupReplacement: '',
              principle: [{ name: '' }],
              principleReplacement: '',
              protein: '',
              drink: '',
              cutlery: false,
              sides: [],
              additions: [],
              notes: '',
              address: { ...defaultAddress },
              time: '',
              payment: 'Efectivo'
            }
          ];

    setEditForm({
      id: order.id,
      meals,
      total: order.total || 0,
      status: order.status || 'Pendiente',
      payment: order.payment ? cleanText(order.payment) : 'Efectivo',
      deliveryPerson: order.deliveryPerson || 'Sin asignar',
      type: 'lunch'
    });
  }, []);

  const handleEditFormFieldChange = (field, value) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditOrderMealFormFieldChange = (mealIndex, field, value) => {
    setEditForm((prev) => {
      const newMeals = [...(prev.meals || [])];
      if (!newMeals[mealIndex]) newMeals[mealIndex] = { address: {}, payment: {}, time: {} };

      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        newMeals[mealIndex] = {
          ...newMeals[mealIndex],
          [parent]: { ...(newMeals[mealIndex][parent] || {}), [child]: value }
        };
      } else if (field === 'sides') {
        if (Array.isArray(value)) {
          newMeals[mealIndex] = { ...newMeals[mealIndex], sides: value };
        } else {
          newMeals[mealIndex] = {
            ...newMeals[mealIndex],
            sides: String(value)
              .split(',')
              .map((s) => ({ name: s.trim() }))
              .filter((s) => s.name)
          };
        }
      } else if (field === 'additions') {
        if (Array.isArray(value)) {
          newMeals[mealIndex] = { ...newMeals[mealIndex], additions: value };
        } else {
          newMeals[mealIndex] = {
            ...newMeals[mealIndex],
            additions: String(value)
              .split(';')
              .map((a) => {
                const [name, proteinOrReplacement = '', quantity = '1'] = a.split(',');
                return {
                  name: name.trim(),
                  [proteinOrReplacement.includes('por') ? 'replacement' : 'protein']: proteinOrReplacement.trim(),
                  quantity: Number(quantity) || 1
                };
              })
              .filter((a) => a.name)
          };
        }
      } else if (field === 'principle') {
        if (Array.isArray(value)) {
          newMeals[mealIndex] = { ...newMeals[mealIndex], principle: value };
        } else {
          newMeals[mealIndex] = {
            ...newMeals[mealIndex],
            principle: String(value)
              .split(',')
              .map((p) => ({ name: p.trim() }))
              .filter((p) => p.name)
          };
        }
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
      const oldOrder = orders.find((o) => o.id === editingOrder.id);
      const previousState = oldOrder
        ? {
            meals: oldOrder.meals,
            breakfasts: oldOrder.breakfasts,
            total: oldOrder.total,
            status: oldOrder.status,
            payment: oldOrder.payment,
            deliveryPerson: oldOrder.deliveryPerson,
            type: oldOrder.type
          }
        : {};

      // Usar el nuevo formato de payments (array) en lugar del formato legacy
      const totalAmount = Number(editForm.total) || 0;
      const payments = [{
        method: editForm.payment || 'Efectivo',
        amount: totalAmount,
        note: ''
      }];

      const paymentSummary = {
        Efectivo: editForm.payment === 'Efectivo' ? totalAmount : 0,
        Daviplata: editForm.payment === 'Daviplata' ? totalAmount : 0,
        Nequi: editForm.payment === 'Nequi' ? totalAmount : 0
      };

      let updateDataBase = {
        total: totalAmount,
        status: editForm.status || 'Pendiente',
        payment: editForm.payment || 'Efectivo', // Mantener para compatibilidad
        payments: payments, // Nuevo formato
        deliveryPerson: editForm.deliveryPerson || 'Sin asignar',
        paymentSummary,
        updatedAt: new Date(),
        type: editForm.type || editingOrder.type || 'lunch'
      };

      if ((editingOrder.type || editForm.type) === 'breakfast') {
        const updatedBreakfastsForDB = (editForm.breakfasts || []).map((b) => ({
          type: b.type ? { name: (typeof b.type === 'string' ? b.type : b.type.name) || '' } : null,
          eggs: b.eggs ? { name: (typeof b.eggs === 'string' ? b.eggs : b.eggs.name) || '' } : null,
          broth: b.broth ? { name: (typeof b.broth === 'string' ? b.broth : b.broth.name) || '' } : null,
          riceBread: b.riceBread ? { name: (typeof b.riceBread === 'string' ? b.riceBread : b.riceBread.name) || '' } : null,
          drink: b.drink ? { name: (typeof b.drink === 'string' ? b.drink : b.drink.name) || '' } : null,
          protein: b.protein ? { name: (typeof b.protein === 'string' ? b.protein : b.protein.name) || '' } : null,
          additions: Array.isArray(b.additions)
            ? b.additions
                .map((a) => ({ name: a.name || '', quantity: Number(a.quantity) || 1 }))
                .filter((a) => a.name)
            : [],
          notes: b.notes || '',
          cutlery: !!b.cutlery,
          time: b.time ? { name: (typeof b.time === 'string' ? b.time : b.time.name) || '' } : null,
          address: {
            address: b.address?.address || '',
            phoneNumber: b.address?.phoneNumber || '',
            addressType: b.address?.addressType || '',
            localName: b.address?.localName || '',
            recipientName: b.address?.recipientName || '',
            unitDetails: b.address?.unitDetails || ''
          }
        }));

        updateDataBase = { ...updateDataBase, breakfasts: updatedBreakfastsForDB };
        await updateDoc(doc(db, 'deliveryBreakfastOrders', editingOrder.id), updateDataBase);

        logActivity(`Editó (desayuno) el pedido ${editingOrder.id}`, {
          orderId: editingOrder.id,
          previousState,
          newState: { ...editForm, breakfasts: updatedBreakfastsForDB }
        });
      } else {
        const updatedMealsForDB = (editForm.meals || []).map((meal) => ({
          soup: meal.soup ? { name: (typeof meal.soup === 'string' ? meal.soup : meal.soup.name) || '' } : null,
          soupReplacement: meal.soupReplacement
            ? { name: (typeof meal.soupReplacement === 'string' ? meal.soupReplacement : meal.soupReplacement.name) || '' }
            : null,
          principle: Array.isArray(meal.principle)
            ? meal.principle
                .map((p) => ({ name: (typeof p === 'string' ? p : p.name) || '' }))
                .filter((p) => p.name)
            : [],
          principleReplacement: meal.principleReplacement
            ? { name: (typeof meal.principleReplacement === 'string' ? meal.principleReplacement : meal.principleReplacement.name) || '' }
            : null,
          protein: meal.protein ? { name: (typeof meal.protein === 'string' ? meal.protein : meal.protein.name) || '' } : null,
          drink: meal.drink ? { name: (typeof meal.drink === 'string' ? meal.drink : meal.drink.name) || '' } : null,
          cutlery: !!meal.cutlery,
          time: meal.time ? { name: (typeof meal.time === 'string' ? meal.time : meal.time.name) || '' } : null,
          payment: meal.payment
            ? { name: (typeof meal.payment === 'string' ? meal.payment : meal.payment.name) || 'Efectivo' }
            : { name: 'Efectivo' },
          sides: Array.isArray(meal.sides)
            ? meal.sides
                .map((s) => ({ name: (typeof s === 'string' ? s : s.name) || '' }))
                .filter((s) => s.name)
            : [],
          additions: Array.isArray(meal.additions)
            ? meal.additions.map((a) => ({
                name: a.name || '',
                protein: a.protein || '',
                replacement: a.replacement || '',
                quantity: Number(a.quantity) || 1
              }))
            : [],
          notes: meal.notes || '',
          address: {
            address: meal.address?.address || '',
            phoneNumber: meal.address?.phoneNumber || '',
            addressType: meal.address?.addressType || '',
            localName: meal.address?.localName || '',
            recipientName: meal.address?.recipientName || '',
            unitDetails: meal.address?.unitDetails || ''
          }
        }));

        updateDataBase = { ...updateDataBase, meals: updatedMealsForDB };
        await updateDoc(doc(db, 'orders', editingOrder.id), updateDataBase);

        logActivity(`Editó (almuerzo) el pedido ${editingOrder.id}`, {
          orderId: editingOrder.id,
          previousState,
          newState: { ...editForm, meals: updatedMealsForDB }
        });
      }

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
      const orderToDelete = orders.find((o) => o.id === orderId);
      await deleteDoc(doc(db, orderToDelete.type === 'breakfast' ? 'deliveryBreakfastOrders' : 'orders', orderId));
      setSuccess('Pedido eliminado correctamente.');
      if (orderToDelete) {
        logActivity(`Eliminó el pedido con ID: ${orderId}`, {
          orderId,
          deletedOrderDetails: {
            meals: orderToDelete.meals,
            total: orderToDelete.total,
            status: orderToDelete.status,
            payment: orderToDelete.payment,
            deliveryPerson: orderToDelete.deliveryPerson,
            type: orderToDelete.type
          }
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
      const breakfastOrdersSnapshot = await getDocs(collection(db, 'deliveryBreakfastOrders'));
      ordersSnapshot.forEach((docRef) => batch.delete(docRef.ref));
      breakfastOrdersSnapshot.forEach((docRef) => batch.delete(docRef.ref));
      await batch.commit();
      setShowConfirmDeleteAll(false);
      setConfirmText('');
      setSuccess('Todos los pedidos han sido eliminados.');
      logActivity('Eliminó todos los pedidos', { count: ordersSnapshot.size + breakfastOrdersSnapshot.size });
    } catch (error) {
      setError(`Error al eliminar todos los pedidos: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const oldOrder = orders.find((o) => o.id === orderId);
      const previousStatus = oldOrder ? oldOrder.status : 'Desconocido';
      const collectionName = oldOrder.type === 'breakfast' ? 'deliveryBreakfastOrders' : 'orders';

      await updateDoc(doc(db, collectionName, orderId), { status: newStatus, updatedAt: new Date() });

      if (newStatus === 'Cancelado' && oldOrder && previousStatus !== 'Cancelado') {
        const paymentType = cleanText(oldOrder.payment || 'Efectivo');
        const amount = oldOrder.total || 0;
        const deliveryPerson = cleanText(oldOrder.deliveryPerson || '');

        setTotals((prev) => {
          const newTotals = { ...prev };
          if (paymentType.toLowerCase() === 'efectivo') {
            newTotals.cash = Math.max(0, newTotals.cash - amount);
          } else if (paymentType.toLowerCase() === 'daviplata') {
            newTotals.daviplata = Math.max(0, newTotals.daviplata - amount);
          } else if (paymentType.toLowerCase() === 'nequi') {
            newTotals.nequi = Math.max(0, newTotals.nequi - amount);
          }
          return newTotals;
        });

        if (deliveryPerson && deliveryPerson !== 'Sin asignar') {
          setDeliveryPersons((prev) => {
            const newDeliveryPersons = { ...prev };
            if (newDeliveryPersons[deliveryPerson]) {
              const bucket = oldOrder.type === 'breakfast' ? 'desayuno' : 'almuerzo';
              const person = { ...newDeliveryPersons[deliveryPerson] };
              const b = {
                ...(person[bucket] || { efectivo: 0, daviplata: 0, nequi: 0, total: 0 })
              };

              const pt = paymentType.toLowerCase();
              if (pt === 'efectivo') b.efectivo = Math.max(0, (b.efectivo || 0) - amount);
              else if (pt === 'daviplata') b.daviplata = Math.max(0, (b.daviplata || 0) - amount);
              else if (pt === 'nequi') b.nequi = Math.max(0, (b.nequi || 0) - amount);
              b.total = Math.max(0, (b.total || 0) - amount);

              person[bucket] = b;
              newDeliveryPersons[deliveryPerson] = person;

              const remaining = (person.almuerzo?.total || 0) + (person.desayuno?.total || 0);
              if (remaining === 0) delete newDeliveryPersons[deliveryPerson];
            }
            return newDeliveryPersons;
          });
        }
      }

      setSuccess('Estado actualizado correctamente.');
      logActivity(`Actualizó el estado del pedido ${orderId} a: ${newStatus}`, {
        orderId,
        previousStatus,
        newStatus
      });
    } catch (error) {
      setError(`Error al actualizar estado: ${error.message}`);
    }
  };

  const handleDeliveryChange = async (orderId, deliveryPerson) => {
    try {
      const oldOrder = orders.find((o) => o.id === orderId);
      const collectionName = oldOrder.type === 'breakfast' ? 'deliveryBreakfastOrders' : 'orders';
      const previousDeliveryPerson = oldOrder ? oldOrder.deliveryPerson : 'Desconocido';

      await updateDoc(doc(db, collectionName, orderId), {
        deliveryPerson: deliveryPerson || null,
        updatedAt: new Date()
      });
      setEditingDeliveryId(null);
      setSuccess('Domiciliario actualizado correctamente.');
      logActivity(`Asignó/Actualizó domiciliario para el pedido ${orderId} a: ${deliveryPerson || 'Sin asignar'}`, {
        orderId,
        previousDeliveryPerson,
        newDeliveryPerson: deliveryPerson || 'Sin asignar'
      });
    } catch (error) {
      setError(`Error al actualizar domiciliario: ${error.message}`);
    }
  };

  const handleOpenPreview = () => {
    const previewWindow = window.open('', '_blank');
    previewWindow.document.write(generatePreviewHtml(filteredOrders, displayedTotals, deliveryPersons));
    previewWindow.document.close();
    logActivity('Abrió la vista previa de pedidos (PDF)', { type: 'PDF Preview' });
  };

  const handleOpenExcelPreview = () => {
    const previewWindow = window.open('', '_blank');
    previewWindow.document.write(
      generateExcelPreviewHtml(filteredOrders, displayedTotals, deliveryPersons, totalProteinUnits, proteins)
    );
    previewWindow.document.close();
    logActivity('Abrió la vista previa de pedidos (Excel)', { type: 'Excel Preview' });
  };

  const handleNewOrderFieldChange = (field, value) => {
    setNewOrderForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleNewOrderMealFormFieldChange = (mealIndex, field, value) => {
    setNewOrderForm((prev) => {
      const newMeals = [...prev.meals];
      if (!newMeals[mealIndex]) {
        newMeals[mealIndex] = { address: {}, payment: {}, time: {} };
      }
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        newMeals[mealIndex] = { ...newMeals[mealIndex], [parent]: { ...newMeals[mealIndex][parent], [child]: value } };
      } else if (field === 'sides') {
        newMeals[mealIndex] = {
          ...newMeals[mealIndex],
          sides: value
            .split(',')
            .map((s) => ({ name: s.trim() }))
            .filter((s) => s.name)
        };
      } else if (field === 'additions') {
        newMeals[mealIndex] = {
          ...newMeals[mealIndex],
          additions: value
            .split(';')
            .map((a) => {
              const [name, proteinOrReplacement = '', quantity = '1'] = a.split(',');
              return {
                name: name.trim(),
                [proteinOrReplacement.includes('por') ? 'replacement' : 'protein']: proteinOrReplacement.trim(),
                quantity: Number(quantity) || 1
              };
            })
            .filter((a) => a.name)
        };
      } else if (field === 'principle') {
        newMeals[mealIndex] = {
          ...newMeals[mealIndex],
          principle: value
            .split(',')
            .map((p) => ({ name: p.trim() }))
            .filter((p) => p.name)
        };
      } else {
        newMeals[mealIndex] = { ...newMeals[mealIndex], [field]: value };
      }
      return { ...prev, meals: newMeals };
    });
  };

  const handleAddOrderSubmit = async () => {
    setIsLoading(true);
    try {
      const normalizedMeals = newOrderForm.meals.map((meal) => ({
        ...meal,
        soup: meal.soup ? { name: meal.soup } : null,
        soupReplacement: meal.soupReplacement ? { name: meal.soupReplacement } : null,
        principle: Array.isArray(meal.principle)
          ? meal.principle.map((p) => ({ name: p.name || p }))
          : meal.principle
          ? [{ name: meal.principle }]
          : [],
        principleReplacement: meal.principleReplacement ? { name: meal.principleReplacement } : null,
        protein: meal.protein ? { name: meal.protein } : null,
        drink: meal.drink ? { name: meal.drink } : null,
        cutlery: meal.cutlery ? { name: meal.cutlery } : null,
        time: meal.time ? { name: meal.time } : null,
        payment: newOrderForm.payment ? { name: newOrderForm.payment } : { name: 'Efectivo' },
        sides: Array.isArray(meal.sides) ? meal.sides.map((s) => ({ name: s.name || s })) : [],
        additions: Array.isArray(meal.additions)
          ? meal.additions.map((a) => ({
              name: a.name || '',
              protein: a.protein || '',
              replacement: a.replacement || '',
              quantity: a.quantity || 1
            }))
          : []
      }));

      const paymentSummary = {
        Efectivo: newOrderForm.payment === 'Efectivo' ? Number(newOrderForm.total) || 0 : 0,
        Daviplata: newOrderForm.payment === 'Daviplata' ? Number(newOrderForm.total) || 0 : 0,
        Nequi: newOrderForm.payment === 'Nequi' ? Number(newOrderForm.total) || 0 : 0
      };

      const orderData = {
        ...newOrderForm,
        meals: normalizedMeals,
        total: Number(newOrderForm.total) || 0,
        status: newOrderForm.status || 'Pendiente',
        payment: newOrderForm.payment || 'Efectivo',
        deliveryPerson: newOrderForm.deliveryPerson || 'Sin asignar',
        paymentSummary,
  createdAt: serverTimestamp(),
  createdAtLocal: getColombiaLocalDateString(), // YYYY-MM-DD local Colombia
        type: newOrderForm.type || 'lunch'
      };

      const collectionName = newOrderForm.type === 'breakfast' ? 'deliveryBreakfastOrders' : 'orders';
      const docRef = await addDoc(collection(db, collectionName), orderData);
      setSuccess('Orden agregada correctamente.');
      logActivity(`Agregó una nueva orden (Total: $${newOrderForm.total.toLocaleString('es-CO')})`, {
        orderId: docRef.id,
        newOrderDetails: { ...newOrderForm, meals: normalizedMeals }
      });
      setShowAddOrderModal(false);
      setNewOrderForm({
        meals: [
          {
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
              recipientName: ''
            },
            time: '',
            payment: 'Efectivo'
          }
        ],
        total: 0,
        status: 'Pendiente',
        payment: 'Efectivo',
        deliveryPerson: 'Sin asignar',
        type: 'lunch'
      });
    } catch (error) {
      setError(`Error al agregar orden: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Compat para el datalist de domiciliarios en TablaPedidos
  const deliveryPersonsCompat = useMemo(() => {
    const r = {};
    for (const [person, data] of Object.entries(deliveryPersons || {})) {
      const cash = (data?.almuerzo?.efectivo || 0) + (data?.desayuno?.efectivo || 0);
      const daviplata = (data?.almuerzo?.daviplata || 0) + (data?.desayuno?.daviplata || 0);
      const nequi = (data?.almuerzo?.nequi || 0) + (data?.desayuno?.nequi || 0);
      const total = (data?.almuerzo?.total || 0) + (data?.desayuno?.total || 0);
      r[person] = { cash, daviplata, nequi, total };
    }
    return r;
  }, [deliveryPersons]);

  const uniqueDeliveryPersons = useMemo(() => Object.keys(deliveryPersons || {}), [deliveryPersons]);

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
        handleEditFormFieldChange={handleEditFormFieldChange}
        handleSaveEdit={handleSaveEdit}
        showConfirmDeleteAll={showConfirmDeleteAll}
        setShowConfirmDeleteAll={setShowConfirmDeleteAll}
        confirmText={confirmText}
        setConfirmText={setConfirmText}
        handleDeleteAllOrders={handleDeleteAllOrders}
        setError={setError}
        setSuccess={setSuccess}
        showAddOrderModal={showAddOrderModal}
        setShowAddOrderModal={setShowAddOrderModal}
        newOrderForm={newOrderForm}
        handleNewOrderMealFormFieldChange={handleNewOrderMealFormFieldChange}
        handleNewOrderFieldChange={handleNewOrderFieldChange}
        handleAddOrderSubmit={handleAddOrderSubmit}
        uniqueDeliveryPersons={uniqueDeliveryPersons}
      />

      <TablaPedidos
        theme={theme}
        orders={paginatedOrders}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        totals={displayedTotals}
        isLoading={isLoading}
        paginatedOrders={paginatedOrders}
        currentPage={currentPage}
        totalPages={totalPages}
        setCurrentPage={setCurrentPage}
        itemsPerPage={itemsPerPage}
        setItemsPerPage={setItemsPerPage}
        deliveryPersons={deliveryPersonsCompat}
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
        totalOrders={filteredOrders.length}
        showProteinModal={showProteinModal}
        setShowProteinModal={setShowProteinModal}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        handleOpenPreview={handleOpenPreview}
        handleOpenExcelPreview={handleOpenExcelPreview}
        handleExport={handleExport}
        handleDeleteAllOrders={handleDeleteAllOrders}
        setShowConfirmDeleteAll={setShowConfirmDeleteAll}
        exportToExcel={exportToExcel}
        exportToPDF={exportToPDF}
        exportToCSV={exportToCSV}
        setShowAddOrderModal={setShowAddOrderModal}
        orderTypeFilter={orderTypeFilter}
        setOrderTypeFilter={setOrderTypeFilter}
        uniqueDeliveryPersons={uniqueDeliveryPersons}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
      />

      {/* 🔥 Se eliminó el bloque de "Resumen por Domiciliarios" aquí para evitar duplicados.
          Ahora el resumen aparece SOLO dentro de TablaPedidos. */}
    </div>
  );
};

export default OrderManagement;
