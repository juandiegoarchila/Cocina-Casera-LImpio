// src/components/Admin/TableOrdersAdmin.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Auth/AuthProvider';
import { db } from '../../config/firebase';
import { collection, onSnapshot, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { classNames } from '../../utils/classNames';
import {
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  InformationCircleIcon,
  TrashIcon,
  EllipsisVerticalIcon,
  PencilIcon
} from '@heroicons/react/24/outline';
import LoadingIndicator from '../LoadingIndicator';
import ErrorMessage from '../ErrorMessage';
import OrderSummary from '../OrderSummary';
import OptionSelector from '../OptionSelector';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { calculateTotal } from '../../utils/MealCalculations';
import { calculateTotalBreakfastPrice } from '../../utils/BreakfastLogic';
import { format } from 'date-fns';

// === NUEVO: pagos
import PaymentSplitEditor from '../common/PaymentSplitEditor';
import { summarizePayments, sumPaymentsByMethod, defaultPaymentsForOrder } from '../../utils/payments';

// ===== Helpers para buscar por nombre y asegurar estructura =====
const normalizeName = (s) => (s || '').replace(/\s*NUEVO\s*$/i, '').trim();

const byName = (list, value) => {
  if (!value) return null;
  const name = typeof value === 'string' ? value : value?.name;
  return list.find((o) => normalizeName(o.name) === normalizeName(name)) || null;
};

const manyByName = (list, arr) =>
  Array.isArray(arr) ? arr.map((v) => byName(list, v)).filter(Boolean) : [];

const ensureAddress = (addr = {}, fallback = {}) => ({
  address: addr.address ?? fallback.address ?? '',
  phoneNumber: addr.phoneNumber ?? fallback.phoneNumber ?? '',
  addressType: addr.addressType ?? fallback.addressType ?? '',
  localName: addr.localName ?? fallback.localName ?? '',
  unitDetails: addr.unitDetails ?? fallback.unitDetails ?? '',
  recipientName: addr.recipientName ?? fallback.recipientName ?? '',
});

// ===== Helpers NUEVOS / ROBUSTOS para pago =====
const formatValue = (value) => {
  if (!value) return 'N/A';
  if (typeof value === 'string') return value;
  const candidates = [
    value.name, value.label, value.title, value.method, value.type, value.payment, value.value,
    value?.method?.name, value?.payment?.name, value?.value?.name, value?.type?.name
  ].filter((v) => typeof v === 'string' && v.trim());
  return candidates[0] || 'N/A';
};

// Devuelve raw pago desde la orden
const getOrderPaymentRaw = (order) =>
  order?.meals?.[0]?.paymentMethod ??
  order?.breakfasts?.[0]?.payment ??
  order?.breakfasts?.[0]?.paymentMethod ??
  order?.payment ??
  order?.paymentMethod ??
  null;

const getOrderPaymentText = (order) => formatValue(getOrderPaymentRaw(order));

const normalizePaymentKey = (raw) =>
  (typeof raw === 'string' ? raw : formatValue(raw)).toLowerCase().trim();

// === NUEVO: mostrar solo método(s) sin montos ===
const displayPaymentLabel = (val) => {
  const raw = (typeof val === 'string' ? val : val?.name || val?.label || val?.method || val?.type || '').toString().trim().toLowerCase();
  if (!raw) return '';
  if (raw.includes('efect') || raw.includes('cash')) return 'Efectivo';
  if (raw.includes('nequi')) return 'Nequi';
  if (raw.includes('davi')) return 'Daviplata';
  return '';
};

const paymentMethodsOnly = (order) => {
  if (Array.isArray(order?.payments) && order.payments.length) {
    const names = order.payments
      .map((p) => displayPaymentLabel(typeof p.method === 'string' ? p.method : p?.method?.name || p?.method))
      .filter(Boolean);
    return [...new Set(names)].join(' + ') || 'Sin pago';
  }
  return displayPaymentLabel(getOrderPaymentRaw(order)) || 'Sin pago';
};


const TableOrdersAdmin = ({ theme = 'light' }) => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showMealDetails, setShowMealDetails] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [orderTypeFilter, setOrderTypeFilter] = useState('all'); // 'all', 'breakfast', 'lunch'
  const [breakfastTypes, setBreakfastTypes] = useState([]);
  const menuRef = useRef(null);

  // Catálogos almuerzo
  const [soups, setSoups] = useState([]);
  const [soupReplacements, setSoupReplacements] = useState([]);
  const [principles, setPrinciples] = useState([]);
  const [menuProteins, setMenuProteins] = useState([]);
  const [drinks, setDrinks] = useState([]);
  const [sides, setSides] = useState([]);
  const [additions, setAdditions] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);

  // Catálogos desayuno
  const [breakfastEggs, setBreakfastEggs] = useState([]);
  const [breakfastBroths, setBreakfastBroths] = useState([]);
  const [breakfastRiceBread, setBreakfastRiceBread] = useState([]);
  const [breakfastDrinks, setBreakfastDrinks] = useState([]);
  const [breakfastAdditions, setBreakfastAdditions] = useState([]);
  const [breakfastProteins, setBreakfastProteins] = useState([]);

  // --- Auth & carga inicial
  useEffect(() => {
    if (loading) return;
    if (!user || role !== 2) {
      setErrorMessage('Acceso denegado. Solo los administradores pueden acceder a esta página.');
      setTimeout(() => navigate('/login'), 3000);
      return;
    }

    setIsLoading(true);

    // Tipos de desayuno
    const breakfastTypesUnsubscribe = onSnapshot(
      collection(db, 'breakfastTypes'),
      (snapshot) => {
        const types = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setBreakfastTypes(types);
      },
      (error) => {
        console.error('Error al escuchar breakfastTypes:', error);
        setErrorMessage('Error al cargar tipos de desayuno. Intenta de nuevo.');
      }
    );

    // Órdenes desayuno
    const breakfastOrdersUnsubscribe = onSnapshot(
      collection(db, 'breakfastOrders'),
      (snapshot) => {
        const breakfastOrders = snapshot.docs.map((doc) => ({
          id: doc.id, ...doc.data(), type: 'breakfast', __collection: 'breakfastOrders', // <-- NUEVO
        }));
        setOrders((prev) => [
          ...prev.filter((order) => order.type !== 'breakfast'),
          ...breakfastOrders,
        ]);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error al escuchar breakfastOrders:', error);
        setErrorMessage('Error al cargar órdenes de desayunos. Intenta de nuevo.');
        setIsLoading(false);
      }
    );

    // Órdenes mesa
    const tableOrdersUnsubscribe = onSnapshot(
      collection(db, 'tableOrders'),
      (snapshot) => {
        const tableOrders = snapshot.docs.map((doc) => ({
          id: doc.id, ...doc.data(), type: 'lunch', __collection: 'tableOrders', // <-- NUEVO
        }));
        setOrders((prev) => [
          ...prev.filter((order) => order.type !== 'lunch'),
          ...tableOrders,
        ]);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error al escuchar tableOrders:', error);
        setErrorMessage('Error al cargar órdenes de mesas. Intenta de nuevo.');
        setIsLoading(false);
      }
    );

    return () => {
      breakfastTypesUnsubscribe();
      breakfastOrdersUnsubscribe();
      tableOrdersUnsubscribe();
    };
  }, [user, loading, role, navigate]);

  // Escucha catálogos para OptionSelector
  useEffect(() => {
    const unsubs = [];
    const listen = (name, setter) => {
      const u = onSnapshot(collection(db, name), (snap) => {
        setter(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
      unsubs.push(u);
    };

    // Almuerzo
    listen('soups', setSoups);
    listen('soupReplacements', setSoupReplacements);
    listen('principles', setPrinciples);
    listen('proteins', setMenuProteins);
    listen('drinks', setDrinks);
    listen('sides', setSides);
    listen('additions', setAdditions);
    listen('paymentMethods', setPaymentMethods);

    // Desayuno
    listen('breakfastEggs', setBreakfastEggs);
    listen('breakfastBroths', setBreakfastBroths);
    listen('breakfastRiceBread', setBreakfastRiceBread);
    listen('breakfastDrinks', setBreakfastDrinks);
    listen('breakfastAdditions', setBreakfastAdditions);
    listen('breakfastProteins', setBreakfastProteins);

    return () => unsubs.forEach((u) => u && u());
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // ====== Totales usando split de pagos (con fallback legacy) EXCLUYENDO cancelados ======
  const totals = sumPaymentsByMethod(orders.filter(o => !/(cancel)/i.test((o.status || '').toLowerCase())));

  // ===== Filtro/búsqueda (incluye pago) =====
  const filteredOrders = orders.filter((order) => {
    const searchLower = searchTerm.toLowerCase();

    const matchesSearch =
      order.id.toLowerCase().includes(searchLower) ||
      // Almuerzos
      order.meals?.some((meal) => {
        const payText = normalizePaymentKey(meal.paymentMethod ?? '');
        return (
          meal.tableNumber?.toString().toLowerCase().includes(searchLower) ||
          payText.includes(searchLower) ||
          meal.notes?.toLowerCase().includes(searchLower)
        );
      }) ||
      // Desayunos
      order.breakfasts?.some((breakfast) => {
        const payText = normalizePaymentKey(breakfast.payment ?? breakfast.paymentMethod ?? '');
        return (
          breakfast.tableNumber?.toString().toLowerCase().includes(searchLower) ||
          payText.includes(searchLower) ||
          breakfast.notes?.toLowerCase().includes(searchLower)
        );
      }) ||
      // Búsqueda por método en split
normalizePaymentKey(typeof p.method === 'string' ? p.method : p?.method?.name).includes(searchLower)
    return matchesSearch && (orderTypeFilter === 'all' || order.type === orderTypeFilter);
  });

  // ===== Ordenamiento simple =====
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const field = sortField === 'orderNumber' ? 'id' : sortField;
    const aValue = field === 'id' ? a.id : a[field] || '';
    const bValue = field === 'id' ? b.id : b[field] || '';
    return sortOrder === 'asc' ? (aValue > bValue ? 1 : -1) : (aValue < bValue ? 1 : -1);
  });

  const totalPages = Math.ceil(sortedOrders.length / itemsPerPage);
  const paginatedOrders = sortedOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField === field) {
      return sortOrder === 'asc' ? '↑' : '↓';
    }
    return '';
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      setIsLoading(true);
      const order = orders.find((o) => o.id === orderId);
      const collectionName = order.type === 'breakfast' ? 'breakfastOrders' : 'tableOrders';
      const orderRef = doc(db, collectionName, orderId);
      await updateDoc(orderRef, { status: newStatus, updatedAt: new Date() });
      setErrorMessage(null);
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      setErrorMessage('Error al actualizar el estado de la orden. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta orden?')) return;
    try {
      setIsLoading(true);
      const order = orders.find((o) => o.id === orderId);
      const collectionName = order.type === 'breakfast' ? 'breakfastOrders' : 'tableOrders';
      await deleteDoc(doc(db, collectionName, orderId));
      setErrorMessage(null);
    } catch (error) {
      console.error('Error al eliminar orden:', error);
      setErrorMessage('Error al eliminar la orden. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditOrder = (order) => {
    setEditingOrder(order);
  };

  // Hidratación para OptionSelector
  const hydratedRef = useRef(null);
  useEffect(() => {
    if (!editingOrder) { hydratedRef.current = null; return; }

    const catalogsLoaded =
      soups.length || principles.length || menuProteins.length || drinks.length || sides.length || additions.length ||
      breakfastTypes.length || breakfastBroths.length || breakfastEggs.length || breakfastRiceBread.length ||
      breakfastDrinks.length || breakfastAdditions.length || breakfastProteins.length || paymentMethods.length;

    if (!catalogsLoaded) return;
    if (hydratedRef.current === editingOrder.id) return;

    const isBreakfast = Array.isArray(editingOrder.breakfasts);
    const fallbackAddress = editingOrder.address || {};

    if (isBreakfast) {
      const breakfasts = (editingOrder.breakfasts || []).map((b) => ({
        type: byName(breakfastTypes, b.type),
        broth: byName(breakfastBroths, b.broth),
        eggs: byName(breakfastEggs, b.eggs),
        riceBread: byName(breakfastRiceBread, b.riceBread),
        drink: byName(breakfastDrinks, b.drink),
        protein: byName(breakfastProteins, b.protein),
        additions: Array.isArray(b.additions)
          ? b.additions
              .map((a) => {
                const full = byName(breakfastAdditions, a);
                return full ? { ...full, quantity: a.quantity || 1, price: full.price ?? a.price ?? 0 } : null;
              })
              .filter(Boolean)
          : [],
        cutlery: !!b.cutlery,
        time: typeof b.time === 'string' ? b.time : b.time?.name || '',
        address: ensureAddress(b.address, fallbackAddress),
        notes: b.notes || '',
        paymentMethod: byName(paymentMethods, b.payment || b.paymentMethod),
        orderType: b.orderType || '',
        tableNumber: b.tableNumber || '',
      }));
      setEditingOrder((prev) => ({ ...prev, type: 'breakfast', breakfasts }));
    } else {
      const meals = (editingOrder.meals || []).map((m) => ({
        soup: byName(soups, m.soup),
        soupReplacement: byName(soupReplacements, m.soupReplacement),
        principle: manyByName(principles, m.principle),
        protein: byName(menuProteins, m.protein),
        drink: byName(drinks, m.drink),
        sides: manyByName(sides, m.sides),
        additions: Array.isArray(m.additions)
          ? m.additions
              .map((a) => {
                const full = byName(additions, a);
                return full ? { ...full, quantity: a.quantity || 1, price: a.price ?? full.price ?? 0 } : null;
              })
              .filter(Boolean)
          : [],
        cutlery: !!m.cutlery,
        time: typeof m.time === 'string' ? m.time : m.time?.name || '',
        address: ensureAddress(m.address, fallbackAddress),
        notes: m.notes || '',
        paymentMethod: m.paymentMethod ? byName(paymentMethods, m.paymentMethod) : null,
        orderType: m.orderType || '',
        tableNumber: m.tableNumber || '',
      }));
      setEditingOrder((prev) => ({ ...prev, type: 'lunch', meals }));
    }

    hydratedRef.current = editingOrder.id;
  }, [
    editingOrder,
    soups, soupReplacements, principles, menuProteins, drinks, sides, additions, paymentMethods,
    breakfastTypes, breakfastBroths, breakfastEggs, breakfastRiceBread, breakfastDrinks, breakfastAdditions, breakfastProteins
  ]);

  // Recalcular total en vivo
  useEffect(() => {
    if (!editingOrder) return;

    if (Array.isArray(editingOrder.meals)) {
const newTotal = Number(calculateTotal(editingOrder.meals, 3) || 0);      if ((editingOrder.total || 0) !== newTotal) {
        setEditingOrder((prev) => ({ ...prev, total: newTotal }));
      }
    } else if (Array.isArray(editingOrder.breakfasts)) {
      const newTotal = Number(calculateTotalBreakfastPrice(editingOrder.breakfasts, role, breakfastTypes) || 0);
      if ((editingOrder.total || 0) !== newTotal) {
        setEditingOrder((prev) => ({ ...prev, total: newTotal }));
      }
    }
  }, [editingOrder?.meals, editingOrder?.breakfasts, role, breakfastTypes]); // eslint-disable-line

  const setMealField = (i, key, value) => {
    setEditingOrder((prev) => {
      const list = [...(prev.meals || [])];
      const row = { ...(list[i] || {}) };

      if (key === 'soup') {
        row.soup = value || null;
        row.soupReplacement = null;
      } else if (key === 'soupReplacement') {
        row.soupReplacement = value || null;
        row.soup = null;
      } else if (key.includes('.')) {
        const [p, c] = key.split('.');
        row[p] = { ...(row[p] || {}), [c]: value };
      } else {
        row[key] = value;
      }

      list[i] = row;
      return { ...prev, meals: list };
    });
  };

  const setBreakfastField = (i, key, value) => {
    setEditingOrder((prev) => {
      const list = [...(prev.breakfasts || [])];
      const row = { ...(list[i] || {}) };
      if (key.includes('.')) {
        const [p, c] = key.split('.');
        row[p] = { ...(row[p] || {}), [c]: value };
      } else {
        row[key] = value;
      }
      list[i] = row;
      return { ...prev, breakfasts: list };
    });
  };

  const setEditingTotal = (value) => {
    setEditingOrder((prev) => ({ ...prev, total: Number(value) || 0 }));
  };

  const handleSaveEdit = async () => {
    try {
      setIsLoading(true);
      const isBreakfast = Array.isArray(editingOrder.breakfasts);
      const collectionName = isBreakfast ? 'breakfastOrders' : 'tableOrders';
      const orderRef = doc(db, collectionName, editingOrder.id);

      const newTotal = isBreakfast
        ? Number(calculateTotalBreakfastPrice(editingOrder.breakfasts, role, breakfastTypes) || 0)
        : Number(calculateTotal(editingOrder.meals, role) || 0);

      const payments = Array.isArray(editingOrder.payments) && editingOrder.payments.length
        ? editingOrder.payments.map((p) => ({
            method: (typeof p.method === 'string' ? p.method : p?.method?.name || ''),
            amount: Math.floor(Number(p.amount || 0)) || 0,
            note: p.note || '',
          }))
        : defaultPaymentsForOrder({ ...editingOrder, total: newTotal });

      const sum = payments.reduce((a, b) => a + (b.amount || 0), 0);
      if (sum !== newTotal) {
        alert(`La suma de pagos (${sum.toLocaleString('es-CO')}) no coincide con el total (${newTotal.toLocaleString('es-CO')}). Ajústala antes de guardar.`);
        setIsLoading(false);
        return;
      }

      const payload = isBreakfast
        ? { breakfasts: editingOrder.breakfasts }
        : { meals: editingOrder.meals };

      await updateDoc(orderRef, {
        ...payload,
        payments,
        total: newTotal,
        updatedAt: new Date(),
      });

      setEditingOrder(null);
      setErrorMessage(null);
    } catch (error) {
      console.error('Error al guardar edición:', error);
      setErrorMessage('Error al guardar los cambios. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  // ===== Exportaciones =====
  const exportToExcel = () => {
    const data = filteredOrders.map((order) => {
      const paymentText = (Array.isArray(order.payments) && order.payments.length)
        ? summarizePayments(order.payments)
        : getOrderPaymentText(order);

      return {
        'Nº Orden': order.id.slice(0, 8),
        'Tipo': order.type === 'breakfast' ? 'Desayuno' : 'Almuerzo',
        'Mesa': formatValue(order.meals?.[0]?.tableNumber || order.breakfasts?.[0]?.tableNumber),
        'Estado': order.status,
        'Total': `$${order.total?.toLocaleString('es-CO') || 'N/A'}`,
        'Método de Pago': paymentText,
        'Detalles':
          order.type === 'lunch'
            ? order.meals
                .map((meal, index) =>
                  `Almuerzo #${index + 1}: Sopa: ${formatValue(meal.soup || meal.soupReplacement)}, Principio: ${formatValue(meal.principle)}, Proteína: ${formatValue(meal.protein)}, Bebida: ${formatValue(meal.drink)}, Acompañamientos: ${formatValue(meal.sides)}, Notas: ${meal.notes || 'Ninguna'}`
                )
                .join('; ')
            : order.breakfasts
                .map((breakfast, index) =>
                  `Desayuno #${index + 1}: Tipo: ${formatValue(breakfast.type)}, Caldo: ${formatValue(breakfast.broth)}, Huevos: ${formatValue(breakfast.eggs)}, Arroz/Pan: ${formatValue(breakfast.riceBread)}, Bebida: ${formatValue(breakfast.drink)}, Proteína: ${formatValue(breakfast.protein)}, Adiciones: ${formatValue(breakfast.additions)}, Notas: ${breakfast.notes || 'Ninguna'}`
                )
                .join('; '),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Órdenes');
    XLSX.writeFile(workbook, `ordenes_${orderTypeFilter}_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.xlsx`);
  };

  const exportToPDF = () => {
    const docx = new jsPDF();
    docx.text('Órdenes', 14, 10);
    docx.autoTable({
      head: [['Nº Orden', 'Tipo', 'Mesa', 'Estado', 'Total', 'Método de Pago', 'Detalles']],
      body: filteredOrders.map((order) => {
        const paymentText = (Array.isArray(order.payments) && order.payments.length)
          ? summarizePayments(order.payments)
          : getOrderPaymentText(order);

        return [
          order.id.slice(0, 8),
          order.type === 'breakfast' ? 'Desayuno' : 'Almuerzo',
          formatValue(order.meals?.[0]?.tableNumber || order.breakfasts?.[0]?.tableNumber),
          order.status,
          `$${order.total?.toLocaleString('es-CO') || 'N/A'}`,
          paymentText,
          order.type === 'lunch'
            ? order.meals
                .map((meal, index) =>
                  `Almuerzo #${index + 1}: Sopa: ${formatValue(meal.soup || meal.soupReplacement)}, Principio: ${formatValue(meal.principle)}, Proteína: ${formatValue(meal.protein)}, Bebida: ${formatValue(meal.drink)}, Acompañamientos: ${formatValue(meal.sides)}`
                )
                .join('; ')
            : order.breakfasts
                .map((breakfast, index) =>
                  `Desayuno #${index + 1}: Tipo: ${formatValue(breakfast.type)}, Caldo: ${formatValue(breakfast.broth)}, Huevos: ${formatValue(breakfast.eggs)}, Arroz/Pan: ${formatValue(breakfast.riceBread)}, Bebida: ${formatValue(breakfast.drink)}, Proteína: ${formatValue(breakfast.protein)}, Adiciones: ${formatValue(breakfast.additions)}`
                )
                .join('; '),
        ];
      }),
    });
    docx.save(`ordenes_${orderTypeFilter}_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.pdf`);
  };

  const exportToCSV = () => {
    const rows = [
      ['Nº Orden', 'Tipo', 'Mesa', 'Estado', 'Total', 'Método de Pago', 'Detalles'],
      ...filteredOrders.map((order) => {
        const paymentText = (Array.isArray(order.payments) && order.payments.length)
          ? summarizePayments(order.payments)
          : getOrderPaymentText(order);

        return [
          order.id.slice(0, 8),
          order.type === 'breakfast' ? 'Desayuno' : 'Almuerzo',
          formatValue(order.meals?.[0]?.tableNumber || order.breakfasts?.[0]?.tableNumber),
          order.status,
          `$${order.total?.toLocaleString('es-CO') || 'N/A'}`,
          paymentText,
          `${
            order.type === 'lunch'
              ? order.meals
                  .map((meal, index) =>
                    `Almuerzo #${index + 1}: Sopa: ${formatValue(meal.soup || meal.soupReplacement)}, Principio: ${formatValue(meal.principle)}, Proteína: ${formatValue(meal.protein)}, Bebida: ${formatValue(meal.drink)}, Acompañamientos: ${formatValue(meal.sides)}, Notas: ${meal.notes || 'Ninguna'}`
                  )
                  .join('; ')
              : order.breakfasts
                  .map((breakfast, index) =>
                    `Desayuno #${index + 1}: Tipo: ${formatValue(breakfast.type)}, Caldo: ${formatValue(breakfast.broth)}, Huevos: ${formatValue(breakfast.eggs)}, Arroz/Pan: ${formatValue(breakfast.riceBread)}, Bebida: ${formatValue(breakfast.drink)}, Proteína: ${formatValue(breakfast.protein)}, Adiciones: ${formatValue(breakfast.additions)}, Notas: ${breakfast.notes || 'Ninguna'}`
                  )
                  .join('; ')
          }`,
        ];
      }),
    ];
    const csvContent = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ordenes_${orderTypeFilter}_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.csv`;
    link.click();
  };

  const handleExport = (exportFunc) => {
    exportFunc();
    setErrorMessage(null);
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Cargando...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Gestión de pedidos Mesas</h2>

      {/* Totals Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 text-sm text-gray-700 dark:text-gray-300">
        <div className={classNames("p-3 sm:p-4 rounded-lg shadow-sm", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
          <p className="font-semibold text-sm sm:text-base">Total Efectivo</p>
          <p className="text-lg sm:text-xl font-bold">${Math.floor(totals.cash).toLocaleString('es-CO')}</p>
        </div>
        <div className={classNames("p-3 sm:p-4 rounded-lg shadow-sm", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
          <p className="font-semibold text-sm sm:text-base">Total Daviplata</p>
          <p className="text-lg sm:text-xl font-bold">${Math.floor(totals.daviplata).toLocaleString('es-CO')}</p>
        </div>
        <div className={classNames("p-3 sm:p-4 rounded-lg shadow-sm", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
          <p className="font-semibold text-sm sm:text-base">Total Nequi</p>
          <p className="text-lg sm:text-xl font-bold">${Math.floor(totals.nequi).toLocaleString('es-CO')}</p>
        </div>
        <div className={classNames("p-3 sm:p-4 rounded-lg shadow-sm", theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100')}>
          <p className="font-semibold text-sm sm:text-base">Total General</p>
          <p className="text-lg sm:text-xl font-bold">${Math.floor(totals.cash + totals.daviplata + totals.nequi).toLocaleString('es-CO')}</p>
        </div>
      </div>

      {/* Search and Menu */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-3 sm:gap-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar órdenes por ID, mesa o método de pago..."
          className={classNames(
            "p-2 sm:p-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:max-w-xs shadow-sm text-sm sm:text-base transition-all duration-200",
            theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'
          )}
        />
        <div className="relative z-50 flex-shrink-0" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={classNames(
              "flex items-center justify-center p-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200",
              'focus:outline-none focus:ring-2 focus:ring-blue-500'
            )}
            aria-label="Opciones de menú"
          >
            <EllipsisVerticalIcon
              className={classNames(
                "w-6 h-6",
                theme === 'dark' ? 'text-gray-200 hover:text-white' : 'text-gray-700 hover:text-gray-900'
              )}
            />
          </button>
          {isMenuOpen && (
            <div
              className={classNames(
                "absolute right-0 mt-2 w-48 rounded-lg shadow-xl z-50",
                theme === 'dark' ? 'bg-gray-700 text-gray-200' : 'bg-white text-gray-900'
              )}
            >
              <div className="py-1">
                <button onClick={() => { setOrderTypeFilter('breakfast'); setIsMenuOpen(false); }}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200">
                  Ver Desayunos
                </button>
                <button onClick={() => { setOrderTypeFilter('lunch'); setIsMenuOpen(false); }}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200">
                  Ver Almuerzos
                </button>
                <button onClick={() => { setOrderTypeFilter('all'); setIsMenuOpen(false); }}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200">
                  Ver Todos
                </button>
                <button onClick={() => { handleExport(exportToExcel); setIsMenuOpen(false); }}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200 flex items-center">
                  <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                  Exportar Excel
                </button>
                <button onClick={() => { handleExport(exportToPDF); setIsMenuOpen(false); }}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200 flex items-center">
                  <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                  Exportar PDF
                </button>
                <button onClick={() => { handleExport(exportToCSV); setIsMenuOpen(false); }}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200 flex items-center">
                  <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                  Exportar CSV
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className={classNames(
        "p-3 sm:p-4 rounded-2xl shadow-xl max-h-[70vh] overflow-y-auto custom-scrollbar transition-all duration-300",
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
                    <th className="p-2 sm:p-3 border-b cursor-pointer whitespace-nowrap" onClick={() => handleSort('orderNumber')}>
                      Nº {getSortIcon('orderNumber')}
                    </th>
                    <th className="p-2 sm:p-3 border-b whitespace-nowrap">Detalles</th>
                    <th className="p-2 sm:p-3 border-b cursor-pointer whitespace-nowrap" onClick={() => handleSort('meals.0.tableNumber')}>
                      Mesa {getSortIcon('meals.0.tableNumber')}
                    </th>
                    <th className="p-2 sm:p-3 border-b cursor-pointer whitespace-nowrap" onClick={() => handleSort('meals.0.paymentMethod.name')}>
                      Pago {getSortIcon('meals.0.paymentMethod.name')}
                    </th>
                    <th className="p-2 sm:p-3 border-b cursor-pointer whitespace-nowrap" onClick={() => handleSort('total')}>
                      Total {getSortIcon('total')}
                    </th>
                    <th className="p-2 sm:p-3 border-b cursor-pointer whitespace-nowrap" onClick={() => handleSort('status')}>
                      Estado {getSortIcon('status')}
                    </th>
                    <th className="p-2 sm:p-3 border-b whitespace-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-6 text-center text-gray-500 dark:text-gray-400">
                        No se encontraron órdenes de mesas. Intenta ajustar tu búsqueda.
                      </td>
                    </tr>
                  ) : (
                    paginatedOrders.map((order, index) => {
                      const displayNumber =
                        sortOrder === 'asc'
                          ? (currentPage - 1) * itemsPerPage + index + 1
                          : paginatedOrders.length - ((currentPage - 1) * itemsPerPage + index);

                  const paymentDisplay = paymentMethodsOnly(order);

                      const statusClass =
                        order.status === 'Pendiente'
                          ? 'bg-yellow-500 text-black'
                          : order.status === 'Preparando'
                          ? 'bg-blue-500 text-white'
                          : order.status === 'Completada'
                          ? 'bg-green-500 text-white'
                          : order.status === 'Cancelada'
                          ? 'bg-red-500 text-white'
                          : '';

                      return (
                        <tr
                          key={order.id}
                          className={classNames(
                            "border-b transition-colors.duration-150",
                            theme === 'dark' ? 'border-gray-700 hover:bg-gray-700' : 'border-gray-200 hover:bg-gray-50',
                            index % 2 === 0 ? (theme === 'dark' ? 'bg-gray-750' : 'bg-gray-50') : ''
                          )}
                        >
                          <td className="p-2 sm:p-3 text-gray-300">{displayNumber}</td>
                          <td className="p-2 sm:p-3 text-gray-300">
                            <button
                              onClick={() => setShowMealDetails(order)}
                              className="text-blue-400 hover:text-blue-300 text-xs sm:text-sm flex items-center"
                              title="Ver detalles de la orden"
                            >
                              <InformationCircleIcon className="w-4 h-4 mr-1" />
                              Ver
                            </button>
                          </td>
                          <td className="p-2 sm:p-3 text-gray-300 whitespace-nowrap">
                            {formatValue(order.meals?.[0]?.tableNumber || order.breakfasts?.[0]?.tableNumber)}
                          </td>
                          <td className="p-2 sm:p-3 text-gray-300 whitespace-nowrap">{paymentDisplay}</td>
                          <td className="p-2 sm:p-3 text-gray-300 whitespace-nowrap">
                            ${order.total?.toLocaleString('es-CO') || 'N/A'}
                          </td>
                          <td className="p-2 sm:p-3 whitespace-nowrap">
                            <select
                              value={order.status || 'Pendiente'}
                              onChange={(e) => handleStatusChange(order.id, e.target.value)}
                              className={classNames(
                                "px-2 py-1 rounded-full text-xs font-semibold appearance-none cursor-pointer",
                                statusClass,
                                theme === 'dark' ? 'bg-opacity-70' : 'bg-opacity-90',
                                "focus:outline-none focus:ring-2 focus:ring-blue-500"
                              )}
                            >
                              <option value="Pendiente">Pendiente</option>
                              <option value="Preparando">Preparando</option>
                              <option value="Completada">Completada</option>
                              <option value="Cancelada">Cancelada</option>
                            </select>
                          </td>
                          <td className="p-2 sm:p-3 whitespace-nowrap">
                            <button
                              onClick={() => handleEditOrder(order)}
                              className="text-blue-500 hover:text-blue-400 transition-colors duration-150 p-1 rounded-md mr-2"
                              title="Editar orden"
                              aria-label={`Editar orden ${displayNumber}`}
                            >
                              <PencilIcon className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteOrder(order.id)}
                              className="text-red-500 hover:text-red-400 transition-colors duration-150 p-1 rounded-md"
                              title="Eliminar orden"
                              aria-label={`Eliminar orden ${displayNumber}`}
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

            {/* Pagination */}
            <div className="flex flex-wrap justify-between items-center mt-6 gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span>Órdenes por página:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                  className={classNames(
                    "p-2 rounded-md border text-sm",
                    theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-300 bg-white text-gray-900'
                  )}
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="30">30</option>
                  <option value="50">50</option>
                </select>
              </div>
              <div className="flex.items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={classNames(
                    "p-2 rounded-md transition-colors duration-200",
                    currentPage === 1
                      ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : theme === 'dark' ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
                  )}
                >
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <span>Página {currentPage} de {totalPages}</span>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={classNames(
                    "p-2 rounded-md transition-colors duration-200",
                    currentPage === totalPages
                      ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
                      : theme === 'dark' ? 'hover:bg-gray-700 text-gray-200' : 'hover:bg-gray-100 text-gray-700'
                  )}
                >
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Meal Details Modal */}
            {showMealDetails && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001]">
                <div className={classNames(
                    "p-4 sm:p-6 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto",
                    theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-900'
                  )}>
                  <h3 className="text-lg font-semibold mb-4">Detalles de la Orden #{showMealDetails.id.slice(0, 8)}</h3>
                  <p className="text-sm mb-2">
                    Mesa: {showMealDetails.meals?.[0]?.tableNumber || showMealDetails.breakfasts?.[0]?.tableNumber || 'N/A'}
                  </p>
                  <p className="text-sm mb-2">Estado: {showMealDetails.status}</p>
                  <p className="text-sm mb-4">Total: ${showMealDetails.total?.toLocaleString('es-CO') || 'N/A'}</p>
                  <OrderSummary
                    meals={showMealDetails.meals || showMealDetails.breakfasts}
                    isTableOrder={true}
                    calculateTotal={() => showMealDetails.total}
                  />
                  <button
                    onClick={() => setShowMealDetails(null)}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}

            {/* Edit Order Modal con OptionSelector y Split de Pagos */}
            {editingOrder && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10001]">
                <div className={classNames(
                    "p-4 sm:p-6 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto",
                    theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-white text-gray-900'
                  )}>
                  <h3 className="text-lg font-semibold mb-4">
                    Editar Orden #{editingOrder.id.slice(0, 8)}
                  </h3>

                  {/* === Desayuno === */}
                  {Array.isArray(editingOrder.breakfasts) ? (
                    editingOrder.breakfasts.map((b, index) => (
                      <div key={index} className="mb-6 p-4 border rounded-md border-gray-200 dark:border-gray-700">
                        <h4 className="text-sm font-medium mb-2">Desayuno #{index + 1}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium mb-1">Tipo</label>
                            <OptionSelector
                              title="Tipo" emoji="🥞" options={breakfastTypes}
                              selected={b.type || null} multiple={false}
                              onImmediateSelect={(v) => setBreakfastField(index, 'type', v)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Caldo</label>
                            <OptionSelector
                              title="Caldo" emoji="🥣" options={breakfastBroths}
                              selected={b.broth || null} multiple={false}
                              onImmediateSelect={(v) => setBreakfastField(index, 'broth', v)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium.mb-1">Huevos</label>
                            <OptionSelector
                              title="Huevos" emoji="🥚" options={breakfastEggs}
                              selected={b.eggs || null} multiple={false}
                              onImmediateSelect={(v) => setBreakfastField(index, 'eggs', v)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Arroz/Pan</label>
                            <OptionSelector
                              title="Arroz/Pan" emoji="🍞" options={breakfastRiceBread}
                              selected={b.riceBread || null} multiple={false}
                              onImmediateSelect={(v) => setBreakfastField(index, 'riceBread', v)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Bebida</label>
                            <OptionSelector
                              title="Bebida" emoji="🥤" options={breakfastDrinks}
                              selected={b.drink || null} multiple={false}
                              onImmediateSelect={(v) => setBreakfastField(index, 'drink', v)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Proteína</label>
                            <OptionSelector
                              title="Proteína" emoji="🍖" options={breakfastProteins}
                              selected={b.protein || null} multiple={false}
                              onImmediateSelect={(v) => setBreakfastField(index, 'protein', v)}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block.text-xs font-medium mb-1">Adiciones</label>
                            <OptionSelector
                              title="Adiciones" emoji="➕" options={breakfastAdditions}
                              selected={b.additions || []} multiple={true}
                              onImmediateSelect={(sel) =>
                                setBreakfastField(
                                  index,
                                  'additions',
                                  sel.map((a) => ({ name: a.name, quantity: a.quantity || 1, price: a.price || 0 }))
                                )
                              }
                            />
                          </div>

                          {/* Operativos */}
                          <div>
                            <label className="block text-xs font-medium mb-1">Método de Pago</label>
                            <OptionSelector
                              title="Método de Pago" emoji="💳" options={paymentMethods}
                              selected={b.paymentMethod || null} multiple={false}
                              onImmediateSelect={(v) => setBreakfastField(index, 'paymentMethod', v)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Número de Mesa</label>
                            <input
                              type="text" value={b.tableNumber || ''}
                              onChange={(e) => setBreakfastField(index, 'tableNumber', e.target.value)}
                              className={classNames(
                                "w-full p-2 rounded-md border text-sm",
                                theme === 'dark'
                                  ? 'border-gray-600 bg-gray-700 text-white'
                                  : 'border-gray-200 bg-white text-gray-900',
                                "focus:outline-none focus:ring-1 focus:ring-blue-500"
                              )}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Tipo de Pedido</label>
                            <select
                              value={b.orderType || ''}
                              onChange={(e) => setBreakfastField(index, 'orderType', e.target.value)}
                              className={classNames(
                                "w-full p-2 rounded-md border text-sm",
                                theme === 'dark'
                                  ? 'border-gray-600 bg-gray-700 text-white'
                                  : 'border-gray-200 bg-white text-gray-900',
                                "focus:outline-none focus:ring-1 focus:ring-blue-500"
                              )}
                            >
                              <option value="">Seleccionar</option>
                              <option value="table">Para mesa</option>
                              <option value="takeaway">Para llevar</option>
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium mb-1">Notas</label>
                            <input
                              type="text" value={b.notes || ''} onChange={(e) => setBreakfastField(index, 'notes', e.target.value)}
                              className={classNames(
                                "w-full p-2 rounded-md border text-sm",
                                theme === 'dark'
                                  ? 'border-gray-600 bg-gray-700 text-white'
                                  : 'border-gray-200 bg-white text-gray-900',
                                "focus:outline-none focus:ring-1 focus:ring-blue-500"
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    // === Almuerzo ===
                    editingOrder.meals?.map((m, index) => (
                      <div key={index} className="mb-6 p-4 border rounded-md border-gray-200 dark:border-gray-700">
                        <h4 className="text-sm font-medium mb-2">Almuerzo #{index + 1}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium mb-1">Sopa (excluyente con Reemplazo)</label>
                            <OptionSelector
                              title="Sopa" emoji="🥣" options={soups}
                              selected={m.soup || null} multiple={false}
                              onImmediateSelect={(v) => setMealField(index, 'soup', v)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Reemplazo (ej: Solo bandeja)</label>
                            <OptionSelector
                              title="Reemplazo" emoji="🚫" options={soupReplacements}
                              selected={m.soupReplacement || null} multiple={false}
                              onImmediateSelect={(v) => setMealField(index, 'soupReplacement', v)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Principio</label>
                            <OptionSelector
                              title="Principio" emoji="🍚" options={principles}
                              selected={m.principle || []} multiple={true} showConfirmButton={true}
                              onImmediateSelect={(sel) => setMealField(index, 'principle', sel)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Proteína</label>
                            <OptionSelector
                              title="Proteína" emoji="🍖" options={menuProteins}
                              selected={m.protein || null} multiple={false}
                              onImmediateSelect={(v) => setMealField(index, 'protein', v)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Bebida</label>
                            <OptionSelector
                              title="Bebida" emoji="🥤" options={drinks}
                              selected={m.drink || null} multiple={false}
                              onImmediateSelect={(v) => setMealField(index, 'drink', v)}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium mb-1">Acompañamientos</label>
                            <OptionSelector
                              title="Acompañamientos" emoji="🥗" options={sides}
                              selected={m.sides || []} multiple={true}
                              onImmediateSelect={(sel) => setMealField(index, 'sides', sel)}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium mb-1">Adiciones</label>
                            <OptionSelector
                              title="Adiciones" emoji="➕" options={additions}
                              selected={m.additions || []} multiple={true}
                              onImmediateSelect={(sel) =>
                                setMealField(
                                  index,
                                  'additions',
                                  sel.map((a) => ({
                                    id: a.id,
                                    name: a.name,
                                    price: a.price || 0,
                                    protein: a.protein || '',
                                    replacement: a.replacement || '',
                                    quantity: a.quantity || 1,
                                  }))
                                )
                              }
                            />
                          </div>

                          {/* Operativos */}
                          <div>
                            <label className="block text-xs font-medium mb-1">Método de Pago (legacy)</label>
                            <OptionSelector
                              title="Método de Pago" emoji="💳" options={paymentMethods}
                              selected={m.paymentMethod || null} multiple={false}
                              onImmediateSelect={(v) => setMealField(index, 'paymentMethod', v)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Número de Mesa</label>
                            <input
                              type="text" value={m.tableNumber || ''} onChange={(e) => setMealField(index, 'tableNumber', e.target.value)}
                              className={classNames(
                                "w-full p-2 rounded-md border text-sm",
                                theme === 'dark'
                                  ? 'border-gray-600 bg-gray-700 text.white'
                                  : 'border-gray-200 bg-white text-gray-900',
                                "focus:outline-none focus:ring-1 focus:ring-blue-500"
                              )}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium mb-1">Tipo de Pedido</label>
                            <select
                              value={m.orderType || ''} onChange={(e) => setMealField(index, 'orderType', e.target.value)}
                              className={classNames(
                                "w-full p-2 rounded-md border text-sm",
                                theme === 'dark'
                                  ? 'border-gray-600 bg-gray-700 text.white'
                                  : 'border-gray-200 bg-white text-gray-900',
                                "focus:outline-none focus:ring-1 focus:ring-blue-500"
                              )}
                            >
                              <option value="">Seleccionar</option>
                              <option value="table">Para mesa</option>
                              <option value="takeaway">Para llevar</option>
                            </select>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium mb-1">Notas</label>
                            <input
                              type="text" value={m.notes || ''} onChange={(e) => setMealField(index, 'notes', e.target.value)}
                              className={classNames(
                                "w-full p-2 rounded-md border text-sm",
                                theme === 'dark'
                                  ? 'border-gray-600 bg-gray-700 text.white'
                                  : 'border-gray-200 bg-white text-gray-900',
                                "focus:outline-none focus:ring-1 focus:ring-blue-500"
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}

                  {/* Total y acciones */}
                  <div>
                    <label className="text-xs block mb-1">Total (se recalcula automáticamente)</label>
                    <input
                      type="number" value={editingOrder.total || 0}
                      onChange={(e) => setEditingTotal(e.target.value)} placeholder="Total"
                      className={classNames(
                        "w-full p-2 mt-1 border rounded text-sm",
                        theme === 'dark'
                          ? 'border-gray-600 bg-gray-700 text-white'
                          : 'border-gray-200 bg-white text-gray-900'
                      )}
                    />
                  </div>

                  {/* Split de Pagos */}
                  <div className="mt-4">
                    <PaymentSplitEditor
                      theme={theme}
                      total={editingOrder.total || 0}
                      value={
                        Array.isArray(editingOrder.payments) && editingOrder.payments.length
                          ? editingOrder.payments
                          : defaultPaymentsForOrder(editingOrder)
                      }
                      catalogMethods={paymentMethods}
                      onChange={(rows) => {
                        setEditingOrder((prev) => ({ ...prev, payments: rows }));
                      }}
                    />
                  </div>

                  <div className="mt-4 flex space-x-2">
                    <button onClick={handleSaveEdit} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm">
                      Guardar
                    </button>
                    <button onClick={() => setEditingOrder(null)} className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm">
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="fixed top-16 right-4 z-[10002] space-y-2 w-80 max-w-xs">
        {isLoading && <LoadingIndicator />}
        {errorMessage && <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />}
      </div>
    </div>
  );
};

export default TableOrdersAdmin;
