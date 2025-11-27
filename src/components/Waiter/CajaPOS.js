// src/components/Waiter/CajaPOS.js
import React, { useState, useEffect, useMemo, useRef } from 'react';
import QRCode from 'qrcode';
import { db } from '../../config/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { CurrencyDollarIcon, PlusCircleIcon, PencilIcon, XCircleIcon, InformationCircleIcon, HomeIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../Auth/AuthProvider';
import { calculateMealPrice } from '../../utils/MealCalculations';
import { calculateBreakfastPrice } from '../../utils/BreakfastLogic';
import OrderSummary from '../OrderSummary';
import BreakfastOrderSummary from '../BreakfastOrderSummary';
import PaymentSplitEditor from '../common/PaymentSplitEditor';

const formatPrice = (v) => new Intl.NumberFormat('es-CO',{ style:'currency', currency:'COP', maximumFractionDigits:0 }).format(v||0);

const CajaPOS = ({ theme='dark', setError=()=>{}, setSuccess=()=>{} }) => {
  const { role } = useAuth(); // 2 = admin, 3 = mesera

  // Estado principal
  const [posItems, setPosItems] = useState([]);
  const [cartItems, setCartItems] = useState([]); // {id, refId, name, price, quantity}
  const [posOrderType, setPosOrderType] = useState('almuerzo');
  const [posTableNumber, setPosTableNumber] = useState('');
  const [posPaymentMethod, setPosPaymentMethod] = useState('efectivo');
  const [posCashAmount, setPosCashAmount] = useState('');
  const [payments, setPayments] = useState([]); // Nuevo estado para pagos múltiples
  const [isSplitPaymentMode, setIsSplitPaymentMode] = useState(false); // Nuevo estado para alternar modos
  const [posCalculatedChange, setPosCalculatedChange] = useState(0);
  const [posNote, setPosNote] = useState('');
  const [posStage, setPosStage] = useState('select'); // 'select' | 'pay' | 'completed'
  const [completedSaleData, setCompletedSaleData] = useState(null);

  // Editor de artículos
  const [showItemEditor, setShowItemEditor] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemEditorMode, setItemEditorMode] = useState('color'); // 'color' | 'image'
  const [itemColor, setItemColor] = useState('#fb923c');
  const [itemShape, setItemShape] = useState('circle'); // circle | square | hex | outline
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemType, setItemType] = useState('almuerzo_mesa');
  const [itemCategory, setItemCategory] = useState('');
  const [itemImageData, setItemImageData] = useState(null);
  const [itemActive, setItemActive] = useState(true);

  // Filtro de categorías
  const [categoryFilter, setCategoryFilter] = useState('');
  
  // Buscador de artículos
  const [searchTerm, setSearchTerm] = useState('');
  
  // Órdenes pendientes
  const [tableOrders, setTableOrders] = useState([]);
  const [breakfastOrders, setBreakfastOrders] = useState([]);
  const [loadedOrder, setLoadedOrder] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showOrderDetailModal, setShowOrderDetailModal] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState(null);

  // Mesas de la DB
  const [tables, setTables] = useState([]);
  const [showTableSelector, setShowTableSelector] = useState(false);

  // Helper para obtener nombre del mesero desde email
  const getMeseroName = (email) => {
    if (!email || email.includes('waiter_') || email.includes('@example.com')) return null;
    // Extraer la parte antes del @ y capitalizar
    const name = email.split('@')[0];
    return name.charAt(0).toUpperCase() + name.slice(1).replace(/[._]/g, ' ');
  };

  // Validación de mesa/llevar
  const isTableNumberValid = useMemo(() => {
    const tableInput = (posTableNumber || '').trim();
    if (!tableInput) return false;
    const isNumber = /^\d+$/.test(tableInput);
    const isLlevar = tableInput.toLowerCase() === 'llevar';
    const isMesaFormat = /^mesa\s+\d+$/i.test(tableInput); // Acepta "Mesa 7", "mesa 7", etc.
    return isNumber || isLlevar || isMesaFormat;
  }, [posTableNumber]);

  const colorPalette = ['#fb923c','#fbbf24','#10b981','#0ea5e9','#6366f1','#ec4899','#f43f5e','#6b7280','#f59e0b'];
  const shapeOptions = [
    { id:'circle', label:'Círculo' },
    { id:'square', label:'Cuadrado' },
    { id:'hex', label:'Hexágono' },
    { id:'outline', label:'Borde' }
  ];

  // Suscripción a items POS
  useEffect(()=>{
    const unsub = onSnapshot(collection(db,'posItems'), snap => {
      const docs = snap.docs.map(d => ({ id:d.id, ...d.data() }))
        .sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
      setPosItems(docs);
    });
    return () => unsub && unsub();
  },[]);

  // Suscripción a mesas
  useEffect(() => {
    const q = query(collection(db, 'tables'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setTables(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);
  
  // Cargar órdenes pendientes
  useEffect(() => {
    // Filtrar solo órdenes pendientes para mejorar rendimiento y reactividad
    const qTable = query(collection(db, 'tableOrders'), where('status', '==', 'Pendiente'));
    const unsubTable = onSnapshot(qTable, (snapshot) => {
      const orders = snapshot.docs.map(d => ({ id: d.id, ...d.data(), orderType: 'mesa' }));
      setTableOrders(orders);
    });
    
    const qBreakfast = query(collection(db, 'breakfastOrders'), where('status', '==', 'Pendiente'));
    const unsubBreakfast = onSnapshot(qBreakfast, (snapshot) => {
      const orders = snapshot.docs.map(d => ({ id: d.id, ...d.data(), orderType: 'desayuno' }));
      setBreakfastOrders(orders);
    });
    return () => { unsubTable(); unsubBreakfast(); };
  }, []);
  
  // Actualizar hora cada segundo
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Derivados
  const activeItems = useMemo(()=> posItems.filter(i => i.active!==false), [posItems]);
  const categories = useMemo(()=> { const s=new Set(); activeItems.forEach(i=>{ if(i.category) s.add(i.category); }); return Array.from(s).sort(); }, [activeItems]);
  const filteredItems = useMemo(()=> {
    let items = activeItems;
    // Filtrar por categoría
    if (categoryFilter) items = items.filter(i => i.category === categoryFilter);
    // Filtrar por búsqueda (nombre)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      items = items.filter(i => i.name?.toLowerCase().includes(term));
    }
    return items;
  }, [activeItems, categoryFilter, searchTerm]);
  const groupedItems = useMemo(()=>{
    const map = new Map();
    filteredItems.forEach(it => { const k = it.category || ''; if(!map.has(k)) map.set(k, []); map.get(k).push(it); });
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  }, [filteredItems]);
  const cartTotal = useMemo(()=> cartItems.reduce((s,i)=> s + i.price * i.quantity, 0), [cartItems]);

  // Scroll vertical del catálogo (sin indicador de categoría)

  // Cambio efectivo
  useEffect(()=>{
    if (posPaymentMethod !== 'efectivo' || !posCashAmount){ setPosCalculatedChange(0); return; }
    const paid = parseFloat(posCashAmount)||0;
    setPosCalculatedChange(paid - cartTotal > 0 ? Math.round(paid - cartTotal) : 0);
  },[posCashAmount,posPaymentMethod,cartTotal]);

  // Carrito
  const handleAddPosItem = (item) => {
    setCartItems(prev => {
      const existing = prev.find(ci=>ci.refId===item.id);
      if (existing) return prev.map(ci => ci.refId===item.id ? { ...ci, quantity: ci.quantity+1 } : ci);
      // incluir tipo y categoría para mejor inferencia en dashboards
      return [
        ...prev,
        {
          id: `${item.id}-${Date.now()}`,
          refId: item.id,
          name: item.name,
          price: Number(item.price||0),
          quantity: 1,
          type: item.type || null,
          category: item.category || null,
        }
      ];
    });
  };
  const updateCartItemQuantity = (id, qty) => setCartItems(prev => prev.filter(ci => (ci.id===id && qty<=0)? false : true).map(ci => ci.id===id ? { ...ci, quantity: qty } : ci));
  const removeCartItem = (id) => setCartItems(prev => prev.filter(ci=>ci.id!==id));
  const resetCart = () => { 
    setCartItems([]); 
    setPosCashAmount(''); 
    setPayments([]); // Resetear pagos
    setPosCalculatedChange(0); 
    setPosNote(''); 
    setPosStage('select'); 
    setPosTableNumber('');
    setLoadedOrder(null);
    setCompletedSaleData(null);
  };
  
  // Cargar orden pendiente en el carrito
  const loadPendingOrderToCart = (order) => {
    resetCart();
    const items = [];
    
    console.log('🔍 [CajaPOS] Cargando orden a carrito:', {
      orderId: order.id,
      orderTotal: order.total,
      mealsCount: order.meals?.length || 0,
      breakfastsCount: order.breakfasts?.length || 0
    });
    
    if (order.meals && Array.isArray(order.meals)) {
      order.meals.forEach((meal, idx) => {
        // Calcular precio base del almuerzo SIN adiciones
        const mealWithoutAdditions = { ...meal, additions: [] };
        const baseMealPrice = calculateMealPrice(mealWithoutAdditions);
        
        console.log(`🔍 [CajaPOS] Meal ${idx + 1}:`, {
          protein: meal.protein?.name,
          additions: meal.additions,
          additionsCount: meal.additions?.length || 0,
          baseMealPrice: baseMealPrice,
          tableNumber: meal.tableNumber
        });
        
        // Agregar el almuerzo base
        items.push({
          id: `meal-${order.id}-${idx}`,
          refId: `order-meal-${idx}`,
          name: `Almuerzo ${idx + 1}${meal.protein?.name ? ` - ${meal.protein.name}` : ''}`,
          price: baseMealPrice,
          quantity: 1
        });
        
        // Agregar adiciones como ítems separados
        if (meal.additions && Array.isArray(meal.additions)) {
          meal.additions.forEach((addition, addIdx) => {
            items.push({
              id: `meal-${order.id}-${idx}-addition-${addIdx}`,
              refId: `order-meal-${idx}-addition-${addIdx}`,
              name: `  ↳ ${addition.name}${addition.protein ? ` (${addition.protein})` : ''}${addition.replacement ? ` por ${addition.replacement}` : ''}`,
              price: addition.price || 0,
              quantity: addition.quantity || 1
            });
          });
        }
      });
    }
    
    if (order.breakfasts && Array.isArray(order.breakfasts)) {
      order.breakfasts.forEach((breakfast, idx) => {
        // Calcular precio base del desayuno SIN adiciones
        const breakfastWithoutAdditions = { ...breakfast, additions: [] };
        const baseBreakfastPrice = calculateBreakfastPrice(breakfastWithoutAdditions);
        
        // Agregar el desayuno base
        items.push({
          id: `breakfast-${order.id}-${idx}`,
          refId: `order-breakfast-${idx}`,
          name: `Desayuno ${idx + 1}${breakfast.type?.name ? ` - ${breakfast.type.name}` : ''}`,
          price: baseBreakfastPrice,
          quantity: 1
        });
        
        // Agregar adiciones como ítems separados
        if (breakfast.additions && Array.isArray(breakfast.additions)) {
          breakfast.additions.forEach((addition, addIdx) => {
            items.push({
              id: `breakfast-${order.id}-${idx}-addition-${addIdx}`,
              refId: `order-breakfast-${idx}-addition-${addIdx}`,
              name: `  ↳ ${addition.name}`,
              price: addition.price || 0,
              quantity: addition.quantity || 1
            });
          });
        }
      });
    }
    
    // Soporte para pedidos rápidos: solo usar quickItems si NO se han expandido a breakfasts/meals estructurados
    const hasStructured = Array.isArray(order.breakfasts) && order.breakfasts.length > 0 || Array.isArray(order.meals) && order.meals.length > 0;
    if (!hasStructured && order.quickMode && !order.expanded && Array.isArray(order.quickItems) && order.quickItems.length) {
      order.quickItems.forEach((qi, qIdx) => {
        items.push({
          id: `quick-${order.id}-${qIdx}`,
          refId: qi.refId || qi.id || `qi-${qIdx}`,
          name: qi.name,
          price: Number(qi.price || qi.unitPrice || 0),
          quantity: Number(qi.quantity || 1),
          type: qi.type || null,
          category: qi.category || null,
        });
      });
    }
    
    if (items.length === 0) {
      items.push({
        id: `order-${order.id}`,
        refId: `order-full`,
        name: order.orderType === 'desayuno' ? 'Desayuno' : 'Almuerzo',
        price: order.total || 0,
        quantity: 1
      });
    }
    
    console.log('🔍 [CajaPOS] Items cargados al carrito:', {
      itemsCount: items.length,
      items: items.map(i => ({ name: i.name, price: i.price })),
      totalCalculado: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      orderTotal: order.total
    });
    
    setCartItems(items);
    
    // Recuperar tableNumber de la orden o del primer meal/breakfast
    const tableNum = order.tableNumber || order.meals?.[0]?.tableNumber || order.breakfasts?.[0]?.tableNumber || '';
    setPosTableNumber(tableNum);
    
    setPosOrderType(order.orderType || 'almuerzo');
    if (order.note) setPosNote(order.note);
    setPosPaymentMethod(order.paymentMethod?.name?.toLowerCase() || 'efectivo');
    setLoadedOrder(order);
    setSuccess(`✅ Orden cargada - Mesa: ${tableNum || 'Llevar'} - Total: ${formatPrice(order.total || 0)}`);
  };
  
  // Mostrar detalles de orden en modal
  const showOrderDetails = (order, e) => {
    e.stopPropagation(); // Evitar que se cargue la orden al hacer clic en el botón de info
    setSelectedOrderDetail(order);
    setShowOrderDetailModal(true);
  };
  
  // Órdenes pendientes (sin filtro de búsqueda)
  const pendingOrdersForPOS = useMemo(() => {
    const combined = [...tableOrders, ...breakfastOrders];
    return combined
      .filter(order => !order.isPaid && order.status !== 'Completada')
      .sort((a, b) => {
        const timeA = new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt);
        const timeB = new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt);
        return timeA - timeB;
      });
  }, [tableOrders, breakfastOrders]);
  
  // Sugerencias híbridas escaladas: para totales grandes agregar 60k,70k,80k...
  const quickCashSuggestions = useMemo(()=>{
    const t = cartTotal;
    if (t <= 0) return [];
    const set = new Set();
    const add = v => { if (v>t) set.add(v); };

    // Siempre el siguiente múltiplo de 1000 inmediato
    const next1k = Math.ceil((t+1)/1000)*1000;
    add(next1k);

    if (t >= 40000) {
      // Para montos grandes: saltos de 10k (ej: 60k 70k 80k ...)
      const startTen = Math.ceil((t+1)/10000)*10000; // primer múltiplo de 10k > t
      for (let i=0;i<4;i++) add(startTen + i*10000);
    } else {
      // Para montos pequeños conservar estrategia previa
      const next5k = Math.ceil((t+1)/5000)*5000;
      const next10k = Math.ceil((t+1)/10000)*10000;
      add(next5k);
      add(next10k);
      [20000,50000,100000].forEach(add);
    }

    // Escalado adicional para montos muy altos (>100k): bloques de 50k
    if (t >= 100000) {
      const start50 = Math.ceil((t+1)/50000)*50000;
      add(start50);
      add(start50 + 50000);
    }

    const arr = Array.from(set).sort((a,b)=>a-b);
    const limit = t >= 40000 ? 6 : 4; // más sugerencias cuando el total es grande
    return arr.slice(0, limit);
  },[cartTotal]);

  // Desglose de cambio sugerido (greedy) para COP - incluye billetes y monedas
  const changeBreakdown = useMemo(()=>{
    if (posPaymentMethod !== 'efectivo') return [];
    const change = posCalculatedChange;
    if (change <= 0) return [];
    // Billetes y monedas colombianas en orden descendente
    const denoms = [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50];
    let remaining = change;
    const parts = [];
    for (const d of denoms){
      if (remaining <= 0) break;
      const q = Math.floor(remaining / d);
      if (q>0){ parts.push({ d, q, isCoin: d <= 1000 }); remaining -= q*d; }
    }
    return parts;
  },[posCalculatedChange,posPaymentMethod]);

  // Procesar venta
  const handleProcessPosSale = async () => {
    if (cartItems.length===0) return setError('Agrega artículos');
    
    // Validación de mesa/llevar antes de proceder
    const tableInput = (posTableNumber || '').trim();
    if (!tableInput) {
      return setError('Debe ingresar un número de mesa o escribir "llevar"');
    }
    
    // Validar que sea un número, "llevar" o formato "Mesa X"
    const isNumber = /^\d+$/.test(tableInput);
    const isLlevar = tableInput.toLowerCase() === 'llevar';
    const isMesaFormat = /^mesa\s+\d+$/i.test(tableInput);
    if (!isNumber && !isLlevar && !isMesaFormat) {
      return setError('Ingrese un número de mesa válido o escriba "llevar"');
    }
    
    if (posStage==='select'){ 
        setIsSplitPaymentMode(false);
        setPosPaymentMethod('efectivo');
        setPosCashAmount('');
        setPayments([]);
        setPosStage('pay'); 
        return; 
    }

    // Calcular totales y validar pagos
    let currentPayments = [];
    if (isSplitPaymentMode) {
        currentPayments = payments.length > 0 ? payments : [{ method: 'Efectivo', amount: cartTotal }];
    } else {
        // Modo simple
        const amount = (posPaymentMethod === 'efectivo' && posCashAmount) 
            ? parseFloat(posCashAmount) 
            : cartTotal;
        
        currentPayments = [{ 
            method: posPaymentMethod.charAt(0).toUpperCase() + posPaymentMethod.slice(1), 
            amount: amount || 0
        }];
    }

    const totalTendered = currentPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const change = totalTendered - cartTotal;
    
    if (change < 0) {
        return setError(`Faltan ${formatPrice(Math.abs(change))} por pagar`);
    }

    // Normalizar pagos para DB (la suma debe ser igual al total)
    let dbPayments = currentPayments.map(p => ({ ...p, amount: Number(p.amount) || 0 }));
    let remainingChange = change;
    
    if (remainingChange > 0) {
        // Intentar deducir cambio de Efectivo primero
        const cashIdx = dbPayments.findIndex(p => p.method.toLowerCase() === 'efectivo');
        if (cashIdx >= 0) {
            if (dbPayments[cashIdx].amount >= remainingChange) {
                dbPayments[cashIdx].amount -= remainingChange;
                remainingChange = 0;
            } else {
                remainingChange -= dbPayments[cashIdx].amount;
                dbPayments[cashIdx].amount = 0; 
            }
        }
        
        // Si aún hay cambio por deducir, hacerlo de otros métodos (último a primero)
        if (remainingChange > 0) {
            for (let i = dbPayments.length - 1; i >= 0; i--) {
                if (dbPayments[i].amount >= remainingChange) {
                    dbPayments[i].amount -= remainingChange;
                    remainingChange = 0;
                    break;
                } else {
                    remainingChange -= dbPayments[i].amount;
                    dbPayments[i].amount = 0;
                }
            }
        }
    }
    
    // Filtrar montos cero
    dbPayments = dbPayments.filter(p => p.amount > 0);

    // Determinar método principal
    const sorted = [...dbPayments].sort((a,b) => b.amount - a.amount);
    const primaryMethod = sorted[0]?.method?.toLowerCase() || 'efectivo';
    const isMixed = dbPayments.length > 1;
    const finalMethodName = isMixed ? 'mixto' : primaryMethod;

    // Efectivo Recibido (Suma de pagos en efectivo originales)
    const cashReceived = currentPayments
        .filter(p => p.method.toLowerCase() === 'efectivo')
        .reduce((sum, p) => sum + (Number(p.amount)||0), 0);
    const changeGiven = change;

    try {
      // Si hay una orden cargada, actualizarla en lugar de crear una nueva
      if (loadedOrder) {
        const collectionName = (loadedOrder.orderType === 'desayuno') ? 'breakfastOrders' : 'tableOrders';
        
        // Actualizar paymentMethod en meals o breakfasts
        const updatedMeals = (loadedOrder.meals || []).map(meal => ({
          ...meal,
          payment: { name: finalMethodName.charAt(0).toUpperCase() + finalMethodName.slice(1) }
        }));
        const updatedBreakfasts = (loadedOrder.breakfasts || []).map(breakfast => ({
          ...breakfast,
          payment: { name: finalMethodName.charAt(0).toUpperCase() + finalMethodName.slice(1) }
        }));
        
        const updateData = {
          isPaid: true,
          status: 'Completada',
          updatedAt: serverTimestamp(),
          paymentDate: serverTimestamp(),
          paymentMethod: finalMethodName,
          payment: finalMethodName.charAt(0).toUpperCase() + finalMethodName.slice(1),
          payments: dbPayments, // Guardar array de pagos
          paymentAmount: cartTotal,
          total: cartTotal,
          paymentNote: posNote || '',
          cashReceived: cashReceived > 0 ? cashReceived : null,
          changeGiven: changeGiven > 0 ? changeGiven : null,
          // Asegurar que los items se guarden también al actualizar una orden cargada
          items: cartItems.map(ci=>({
            id: ci.refId,
            name: ci.name,
            unitPrice: ci.price,
            quantity: ci.quantity,
            type: ci.type || (posItems.find(p=>p.id===ci.refId)?.type) || null,
            category: ci.category || (posItems.find(p=>p.id===ci.refId)?.category) || null,
          }))
        };
        
        // Agregar meals o breakfasts actualizados según el tipo de orden
        if (loadedOrder.meals && loadedOrder.meals.length > 0) {
          updateData.meals = updatedMeals;
        }
        if (loadedOrder.breakfasts && loadedOrder.breakfasts.length > 0) {
          updateData.breakfasts = updatedBreakfasts;
        }
        
        await updateDoc(doc(db, collectionName, loadedOrder.id), updateData);
        // Guardar datos de venta completada antes de mostrar confirmación
        setCompletedSaleData({
          total: cartTotal,
          paymentMethod: finalMethodName,
          payments: dbPayments,
          cashReceived: cashReceived > 0 ? cashReceived : null,
          changeGiven: changeGiven > 0 ? changeGiven : null,
          changeBreakdown: changeGiven > 0 ? changeBreakdown : [], // Usar changeBreakdown existente si aplica
          orderId: loadedOrder.id,
          items: cartItems,
          note: posNote,
          tableNumber: posTableNumber,
        });
        setPosStage('completed');
        return;
      }
      
      // Crear nueva venta si no hay orden cargada
      // Inferir servicio (mesa/llevar) y tipo de comida (almuerzo/desayuno)
      const tableNum = (posTableNumber||'').trim();
      const isLlevarCheck = tableNum.toLowerCase() === 'llevar';
      const serviceType = isLlevarCheck ? 'llevar' : 'mesa';
      const hasBreakfastItem = cartItems.some(ci => {
        const t = (ci.type || (posItems.find(p=>p.id===ci.refId)?.type) || '').toLowerCase();
        return t.includes('desayun') || t.includes('breakfast');
      });
      const inferredMeal = (/desayun/i.test(posOrderType) || hasBreakfastItem) ? 'desayuno' : 'almuerzo';
      const orderTypeNormalized = `${inferredMeal}_${serviceType}`; // ej: desayuno_mesa, almuerzo_llevar

      const payload = {
        orderType: inferredMeal, // compat: campo anterior
        orderTypeNormalized,     // nuevo: usado por dashboards
        serviceType,             // 'mesa' | 'llevar'
        isPaid: true,
        status: 'Completada',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        paymentDate: serverTimestamp(),
        paymentMethod: finalMethodName,
        payments: dbPayments, // Guardar array de pagos
        paymentAmount: cartTotal,
        total: cartTotal,
        paymentNote: posNote || '',
        items: cartItems.map(ci=>({
          id: ci.refId,
          name: ci.name,
          unitPrice: ci.price,
          quantity: ci.quantity,
          type: ci.type || (posItems.find(p=>p.id===ci.refId)?.type) || null,
          category: ci.category || (posItems.find(p=>p.id===ci.refId)?.category) || null,
        }))
      };
      if (isLlevarCheck) {
        payload.takeaway = true;
      } else {
        payload.tableNumber = tableNum;
      }
      
      if (cashReceived > 0) payload.cashReceived = cashReceived;
      if (changeGiven > 0) payload.changeGiven = changeGiven;

      const collectionName = (inferredMeal==='desayuno') ? 'breakfastOrders' : 'tableOrders';
      payload.__collection = collectionName; // pista para normalizadores
      const docRef = await addDoc(collection(db, collectionName), payload);
      // Imprimir recibo (solo en cliente)
      try {
        printReceipt({
          id: docRef.id,
          date: new Date(),
          items: cartItems,
            // Totales
          total: cartTotal,
          paymentMethod: finalMethodName,
          payments: dbPayments,
          cashReceived: cashReceived > 0 ? cashReceived : null,
          changeGiven: changeGiven > 0 ? changeGiven : null,
          changeBreakdown: changeGiven > 0 ? changeBreakdown : [],
          note: posNote,
          orderType: payload.orderType,
          orderTypeNormalized: payload.orderTypeNormalized,
          serviceType: payload.serviceType,
          tableNumber: payload.tableNumber,
          takeaway: payload.takeaway,
        });
      } catch(printErr){ /* silenciar errores de impresión */ }
      // Guardar datos de venta completada antes de mostrar confirmación
      setCompletedSaleData({
        total: cartTotal,
        paymentMethod: finalMethodName,
        payments: dbPayments,
        cashReceived: cashReceived > 0 ? cashReceived : null,
        changeGiven: changeGiven > 0 ? changeGiven : null,
        changeBreakdown: changeGiven > 0 ? changeBreakdown : [],
        orderId: docRef.id,
        items: cartItems,
        note: posNote,
        tableNumber: payload.tableNumber,
        takeaway: payload.takeaway,
      });
      setPosStage('completed');
    }catch(err){ setError('Error registrando venta: '+err.message); }
  };

  // Helper para imprimir recibo
  const printReceipt = async ({ id, date, items, total, paymentMethod, cashReceived, changeGiven, note, orderType, orderTypeNormalized, serviceType, tableNumber, takeaway }) => {
    if (typeof window === 'undefined') return;
    const win = window.open('', 'PRINT', 'height=650,width=420');
    if(!win) return;
  const fecha = date.toLocaleString('es-CO');
  // Construir etiqueta combinada según normalización
  const kind = (orderTypeNormalized?.split('_')[0] || orderType || '').toLowerCase(); // desayuno|almuerzo
  const svc = (orderTypeNormalized?.split('_')[1] || serviceType || (tableNumber ? 'mesa' : (takeaway ? 'llevar' : ''))).toLowerCase(); // mesa|llevar
  const cap = (s) => s ? s.charAt(0).toUpperCase()+s.slice(1) : '';
  const tipoLabel = `${cap(kind)} ${svc ? cap(svc) : ''}`.trim();
    // Generar QR canal WhatsApp
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL('https://wa.me/573016476916?text=Hola%20quiero%20el%20menú');
    } catch(err) { /* ignorar */ }
    // Construir items html mostrando total por línea a la derecha
    const itemsHtml = items.map(it => {
      const qty = Number(it.quantity||0);
      const unit = Number(it.price||0);
      const lineTotal = qty * unit;
      return `
        <div class='it-row'>
          <div class='it-left'>
            <div class='it-name'>${it.name}</div>
            <div class='it-line'>${qty}x ${formatPrice(unit)}</div>
          </div>
          <div class='it-right'>${formatPrice(lineTotal)}</div>
        </div>`;
    }).join('');
    win.document.write(`
      <html><head><title>Recibo</title>
      <meta charset='utf-8'/>
      <style>
        body { font-family: monospace; font-size: 13px; margin:0; padding:0 12px; }
        h2 { margin:4px 0 6px; font-size:18px; text-align:center; }
        .line { border-bottom:2px solid #000; margin:8px 0; height:0; }
        .logo { text-align:center; margin-top:6px; }
        .logo img { 
          width:110px; 
          height:auto; 
          filter:brightness(0) contrast(1.5); 
          image-rendering: crisp-edges;
          display: block;
          margin: 0 auto;
          max-width: 110px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .meta div { padding:2px 0; }
        .thanks { text-align:center; margin-top:14px; font-weight:bold; }
        .contact { text-align:center; margin-top:8px; }
        .qr-container { text-align:center; margin-top:14px; }
        .qr-text { font-size:11px; margin-bottom:4px; }
        .small { font-size:11px; }
  .it-row { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px; }
  .it-left { flex:1; min-width:0; }
  .it-name { font-weight:bold; }
  .it-line { padding-left:4px; }
  .it-right { min-width:70px; text-align:right; font-weight:bold; }
      </style>
      </head><body>
        <div class='logo'>
          <img src="/logo.png" alt="Logo" />
          <h2>Cocina Casera</h2>
          <div style='text-align:center; font-size:12px; margin-top:4px; font-weight:bold;'>(Uso interno - No es factura DIAN)</div>
        </div>
        <div class='line'></div>
        <div class='meta'>
          <div><b>Tipo:</b> ${tipoLabel}</div>
          ${tableNumber ? `<div><b>Mesa:</b> ${tableNumber}</div>` : ''}
          <div><b>Fecha:</b> ${fecha}</div>
          ${note ? `<div><b>Nota:</b> ${note}</div>`:''}
        </div>
        <div class='line'></div>
        <div><b>Items:</b></div>
        ${itemsHtml}
        <div class='line'></div>
        <div><b>Total:</b> ${formatPrice(total)}</div>
        <div><b>Pago:</b> ${paymentMethod.charAt(0).toUpperCase()+paymentMethod.slice(1)}</div>
        ${paymentMethod==='efectivo' ? `<div><b>Recibido:</b> ${formatPrice(cashReceived||0)}</div>`:''}
        ${paymentMethod==='efectivo' ? `<div><b>Vueltos:</b> ${formatPrice(changeGiven||0)}</div>`:''}
        <div class='line'></div>
        <div class='thanks'>¡Gracias por su compra!</div>
        <div class='contact'>Te esperamos mañana con un<br>nuevo menú.<br>Escríbenos al <strong>301 6476916</strong><br><strong>Calle 133#126c-09</strong></div>
        <div class='qr-container'>
          <div class='qr-text'>Escanea este código QR para unirte a nuestro canal de WhatsApp<br>y recibir nuestro menú diario:</div>
          ${qrDataUrl ? `<img src='${qrDataUrl}' width='140' height='140' />` : ''}
        </div>
        <br/><br/>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(()=>{ win.print(); setTimeout(()=>win.close(), 400); }, 400);
  };

  // Editor de items
  const openNewItemEditor = () => {
    setEditingItem(null);
    setItemEditorMode('color');
    setItemColor('#fb923c');
    setItemShape('circle');
    setItemName('');
    setItemPrice('');
    setItemType('almuerzo_mesa'); // por defecto
    setItemCategory('');
    setItemImageData(null);
    setItemActive(true);
    setShowItemEditor(true);
  };
  const openEditItem = (item) => {
    const legacyToNew = (t) => {
      if (!t) return 'almuerzo_mesa';
      if (t === 'almuerzo') return 'almuerzo_mesa';
      if (t === 'desayuno') return 'desayuno_mesa';
      if (t === 'general') return 'almuerzo_llevar';
      return t; // ya es nuevo
    };
    setEditingItem(item);
    setItemEditorMode(item.imageData ? 'image':'color');
    setItemColor(item.color||'#fb923c');
    setItemShape(item.shape||'circle');
    setItemName(item.name||'');
    setItemPrice(item.price!=null? String(item.price):'');
    setItemType(legacyToNew(item.type));
    setItemCategory(item.category||'');
    setItemImageData(item.imageData||null);
    setItemActive(item.active!==false);
    setShowItemEditor(true);
  };

  const handleSaveItem = async () => {
    if(!itemName.trim()||!itemPrice) return setError('Nombre y precio obligatorios');
    const base = { 
      name:itemName.trim(), 
      price:Math.round(Number(itemPrice)||0), 
      type:itemType, 
      category:itemCategory.trim()||null, 
      color:itemEditorMode==='color'?itemColor:null, 
      shape:itemShape, // Siempre guardar la forma seleccionada
      imageData:itemEditorMode==='image'?itemImageData:null, 
      active:itemActive, 
      sortOrder: editingItem?.sortOrder || Date.now() 
    };
    try {
      if (editingItem) { const { updateDoc, doc } = await import('firebase/firestore'); await updateDoc(doc(db,'posItems',editingItem.id), base); setSuccess('Artículo actualizado'); }
      else { await addDoc(collection(db,'posItems'), base); setSuccess('Artículo creado'); }
      setShowItemEditor(false);
    }catch(err){ setError('Error guardando: '+err.message); }
  };
  const handleImageFile = (e) => { const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=ev=>setItemImageData(ev.target.result); r.readAsDataURL(f); };

  const CategoryFilter = ({ current, onSelect }) => (
    <div className="flex items-center gap-2 text-xs">
      <select value={current} onChange={(e)=>onSelect(e.target.value)} className="px-2 py-1 rounded bg-gray-700 text-gray-200">
        <option value="">Todas</option>
        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
      </select>
      {current && <button onClick={()=>onSelect('')} className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-gray-100">Limpiar</button>}
    </div>
  );

  return (
  <div className="w-full mx-auto px-3 sm:px-6 pb-4 pt-1 lg:pb-3 lg:pt-1 lg:h-[calc(100vh-5rem)] lg:overflow-hidden">

  <div className={`grid grid-cols-1 ${posStage==='completed' ? '' : posStage==='pay' ? 'lg:grid-cols-[440px_1fr]' : 'lg:grid-cols-3'} gap-4 items-start h-full`}>
        {/* Catálogo (columna izquierda 2/3) */}
  {posStage !== 'completed' && (
  <div className={`${posStage==='select' ? 'lg:col-span-2' : 'lg:w-[440px]'} flex flex-col h-full relative min-w-0 min-h-0`}>
          {posStage==='select' ? (
            <>
              {/* Header Catálogo */}
              <div className="sticky top-0 z-20 -mx-3 sm:-mx-6 lg:mx-0 mb-4">
                <div className="relative overflow-hidden backdrop-blur-md bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/90 border border-gray-700/60 rounded-b-xl rounded-t-lg lg:rounded-xl shadow-xl px-3 sm:px-4 py-3">
                  {/* Layout responsive: vertical en móvil, horizontal en tablet+ */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                    {/* Título */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-2 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-inner flex-shrink-0">
                        <CurrencyDollarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-base sm:text-lg lg:text-xl font-bold text-white leading-tight truncate">Caja POS</h2>
                        <p className="text-[11px] text-gray-400 hidden lg:block">Selecciona artículos y procesa el pago rápido</p>
                      </div>
                    </div>
                    
                    {/* Controles (categoría + nuevo) */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <CategoryFilter current={categoryFilter} onSelect={setCategoryFilter} />
                      {role===2 && (
                        <button onClick={openNewItemEditor} className="group flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-[.97] text-white rounded-md text-xs font-medium shadow hover:shadow-lg transition flex-shrink-0">
                          <PlusCircleIcon className="w-4 h-4"/>
                          <span>Nuevo</span>
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Buscador - siempre en su propia fila */}
                  <div className="relative mt-3">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="🔍 Buscar artículo..."
                      className="w-full px-3 py-2 pl-3 pr-8 rounded-lg bg-gray-700/60 text-white text-sm placeholder-gray-400 border border-gray-600/50 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 focus:outline-none transition"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {/* Listado con scroll vertical */}
              <div className="flex-1 relative min-h-0">
                <div className="h-full max-h-full lg:max-h-[calc(100vh-12rem)] overflow-y-auto overscroll-contain pr-4 space-y-4 custom-scrollbar pt-1">
                  
                  {/* ÓRDENES PENDIENTES - Mostrar primero si existen */}
                  {pendingOrdersForPOS.length > 0 && (
                    <div>
                      <div className="flex items-center mb-2">
                        <span className="text-[10px] uppercase tracking-wide text-orange-400 bg-orange-500/20 px-2 py-1 rounded">🔔 Órdenes Pendientes</span>
                        <span className="ml-2 text-[10px] text-orange-300">{pendingOrdersForPOS.length}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-6">
                        {pendingOrdersForPOS.map(order => {
                          const orderTime = new Date(order.createdAt?.seconds ? order.createdAt.seconds * 1000 : order.createdAt);
                          const minutesAgo = Math.floor((currentTime - orderTime) / 60000);
                          
                          // Debug
                          console.log('🔍 Orden pendiente:', {
                            id: order.id,
                            orderType: order.orderType,
                            tableNumber: order.tableNumber,
                            tableNumberType: typeof order.tableNumber,
                            meals: order.meals?.length,
                            breakfasts: order.breakfasts?.length,
                            firstMealTable: order.meals?.[0]?.tableNumber,
                            firstBreakfastTable: order.breakfasts?.[0]?.tableNumber
                          });
                          
                          // Detectar si es para llevar basado en el tableNumber
                          const tableNum = order.tableNumber || order.meals?.[0]?.tableNumber || order.breakfasts?.[0]?.tableNumber || '';
                          const isLlevar = !tableNum || 
                                          tableNum.toLowerCase().includes('llevar');
                          const displayTable = isLlevar ? 'Llevar' : tableNum;
                          const displayTotal = order.total || 0;
                          const orderLabel = order.orderType === 'desayuno' ? '🍳' : '🍽️';
                          const meseroName = getMeseroName(order.userEmail);
                          
                          return (
                            <div key={order.id} className="relative group">
                              <button onClick={(e) => showOrderDetails(order, e)} className="absolute -top-2 -right-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition z-10">
                                <InformationCircleIcon className="w-4 h-4"/>
                              </button>
                              <button onClick={() => loadPendingOrderToCart(order)} className="w-20 h-20 sm:w-24 sm:h-24 mx-auto flex flex-col items-center justify-center text-center text-xs font-medium shadow-md hover:shadow-xl transition rounded-lg bg-gradient-to-br from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white relative overflow-hidden">
                                <span className="text-2xl mb-1">{orderLabel}</span>
                                <span className="text-[10px] font-bold">{displayTable}</span>
                                {meseroName && <span className="text-[9px] font-bold text-black">{meseroName}</span>}
                                <span className="text-[9px] opacity-80">{minutesAgo}m</span>
                              </button>
                              <div className="mt-1 text-center text-[11px] text-orange-400 font-semibold">{formatPrice(displayTotal)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {groupedItems.map(g => {
                    const cat = g.category || 'Sin Categoría';
                    return (
                      <div key={cat}>
                        <div className="flex items-center mb-2">
                          <span className="text-[10px] uppercase tracking-wide text-gray-400 bg-gray-700/40 px-2 py-1 rounded">{cat}</span>
                          <span className="ml-2 text-[10px] text-gray-500">{g.items.length}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-6">
                          {g.items.map(item => {
                        const bgColor = item.color || '#374151';
                        const isInCart = cartItems.find(ci=>ci.refId===item.id);
                        
                        // Clases y estilos según la forma
                        let containerClass = 'w-20 h-20 sm:w-24 sm:h-24 mx-auto flex flex-col items-center justify-center text-center text-xs font-medium shadow-md hover:shadow-lg transition relative';
                        let imgContainerStyle = { background: item.imageData ? '#f3f4f6' : (item.shape==='outline'?'transparent': bgColor) };
                        
                        if (item.shape === 'circle') {
                          containerClass += ' rounded-full overflow-hidden';
                        } else if (item.shape === 'square') {
                          containerClass += ' rounded-lg overflow-hidden';
                        } else if (item.shape === 'outline') {
                          containerClass += ' rounded-full overflow-hidden ring-2 ring-offset-2 ring-white';
                        } else if (item.shape === 'hex') {
                          containerClass += ' overflow-hidden';
                          imgContainerStyle.clipPath = 'polygon(25% 5%,75% 5%,95% 50%,75% 95%,25% 95%,5% 50%)';
                        } else {
                          // Por defecto cuadrado
                          containerClass += ' rounded-lg overflow-hidden';
                        }
                        
                        return (
                          <div key={item.id} className="relative group">
                            {role===2 && <button onClick={()=>openEditItem(item)} className="absolute -top-2 -right-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition z-10"><PencilIcon className="w-4 h-4"/></button>}
                            <button
                              onClick={()=>handleAddPosItem(item)}
                              className={containerClass}
                              style={imgContainerStyle}>
                              {item.imageData && <img src={item.imageData} alt={item.name} className="absolute inset-0 w-full h-full object-contain" />}
                              {!item.imageData && item.shape==='outline' && <div className="absolute inset-0 rounded-full" style={{ boxShadow:`0 0 0 3px ${item.color || '#ffffff'}` }} />}
                              <span className="z-10 px-1 drop-shadow leading-tight text-gray-900">{item.name}{isInCart && <span className="block text-[10px] font-bold mt-1">x{isInCart.quantity}</span>}</span>
                            </button>
                            <div className="mt-1 text-center text-[11px] text-gray-400">{formatPrice(item.price||0)}</div>
                          </div>
                        );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {groupedItems.length===0 && <div className="text-sm text-gray-400">No hay artículos.</div>}
                </div>
              </div>
            </>
          ) : (
            // Detalle del Pedido en fase de pago (una sola tarjeta)
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto overflow-x-auto pr-1 custom-scrollbar">
                {cartItems.length===0 ? (
                  <div className="text-xs text-gray-400 italic p-2">Vacío</div>
                ) : (
                  <div className="bg-gray-800/70 rounded-lg border border-gray-700/70 shadow-inner flex flex-col overflow-x-auto">
                    <div className="sticky top-0 z-10 bg-gray-800/90 backdrop-blur px-2 py-1.5 flex items-center justify-between border-b border-gray-700/60 min-w-[300px]">
                      <h2 className="text-sm font-bold text-white uppercase tracking-wide">Detalle del Pedido</h2>
                      <button onClick={()=>setPosStage('select')} className="text-[10px] px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow transition">← Seguir agregando</button>
                    </div>
                    <div className="divide-y divide-gray-700/60 min-w-[300px]">
                      {cartItems.map(ci => (
                        <div key={ci.id} className="flex items-center justify-between p-1.5 hover:bg-gray-700/40 transition group">
                          <div className="flex-1 mr-2 min-w-0">
                            <div className="font-medium text-gray-100 text-xs leading-tight truncate" title={ci.name}>{ci.name}</div>
                            <div className="text-[10px] text-gray-400">{formatPrice(ci.price)} c/u</div>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <button onClick={()=>updateCartItemQuantity(ci.id, ci.quantity-1)} className="w-5 h-5 flex items-center justify-center bg-red-600/80 hover:bg-red-600 text-white rounded text-[10px] transition">-</button>
                            <input type="number" value={ci.quantity} onChange={(e)=>updateCartItemQuantity(ci.id, Number(e.target.value||0))} className="w-7 px-0.5 py-0.5 text-center rounded bg-gray-800 text-white text-xs font-medium border border-gray-600" />
                            <button onClick={()=>updateCartItemQuantity(ci.id, ci.quantity+1)} className="w-5 h-5 flex items-center justify-center bg-green-600/80 hover:bg-green-600 text-white rounded text-[10px] transition">+</button>
                            <button onClick={()=>removeCartItem(ci.id)} className="w-5 h-5 flex items-center justify-center bg-gray-600 hover:bg-red-500 text-white rounded text-[10px] ml-1 transition opacity-60 group-hover:opacity-100">x</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
  )}

          {/* Resumen / Pago / Confirmación (panel lateral derecho) */}
        <div className={`${theme==='dark' ? 'bg-gray-800':'bg-white'} rounded-xl shadow-lg flex flex-col ${posStage==='completed' ? 'w-full max-w-2xl mx-auto p-6 lg:p-8 h-full min-h-0' : 'p-3 lg:sticky lg:top-0 self-start h-full lg:h-full min-h-0'} ${posStage==='pay' ? 'min-w-0' : ''}`}>
          {posStage==='select' ? (
            <>
              <h3 className="text-sm font-bold text-gray-100 mb-2 uppercase tracking-wide">Resumen</h3>
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1 mb-2 pr-1 custom-scrollbar">
                {cartItems.length===0 && <div className="text-xs text-gray-400 italic">Carrito vacío</div>}
                {cartItems.map(ci => (
                  <div key={ci.id} className="flex items-center justify-between bg-gray-700/50 rounded-lg p-1.5 border border-gray-600/30">
                    <div className="flex-1 mr-2 min-w-0">
                      <div className="font-medium text-gray-100 text-xs truncate" title={ci.name}>{ci.name}</div>
                      <div className="text-[10px] text-gray-400">{formatPrice(ci.price)} c/u</div>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button onClick={()=>updateCartItemQuantity(ci.id, ci.quantity-1)} className="w-5 h-5 flex items-center justify-center bg-red-600/80 hover:bg-red-600 text-white rounded text-[10px] transition">-</button>
                      <input type="number" value={ci.quantity} onChange={(e)=>updateCartItemQuantity(ci.id, Number(e.target.value||0))} className="w-7 px-0.5 py-0.5 text-center rounded bg-gray-800 text-white text-xs font-medium border border-gray-600" />
                      <button onClick={()=>updateCartItemQuantity(ci.id, ci.quantity+1)} className="w-5 h-5 flex items-center justify-center bg-green-600/80 hover:bg-green-600 text-white rounded text-[10px] transition">+</button>
                      <button onClick={()=>removeCartItem(ci.id)} className="w-5 h-5 flex items-center justify-center bg-gray-600 hover:bg-red-500 text-white rounded text-[10px] ml-1 transition">x</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mb-3">
                <label className="block text-gray-400 mb-2 text-xs font-medium">
                  Mesa o llevar <span className="text-red-400">*</span>
                </label>
                {/* Botón para abrir selector visual */}
                <button
                  onClick={() => setShowTableSelector(true)}
                  className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border-2 flex items-center justify-between ${
                    posTableNumber
                      ? 'bg-green-600/20 border-green-500/60 text-green-300'
                      : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {posTableNumber === 'llevar' ? (
                      <HomeIcon className="w-4 h-4" />
                    ) : (
                      <span className="text-xs">🪑</span>
                    )}
                    {posTableNumber || 'Seleccionar mesa o llevar'}
                  </span>
                  <span className="text-xs opacity-60">▼</span>
                </button>
              </div>
              <div className="flex items-center justify-between mb-4 border-t border-gray-700 pt-4">
                <div className="text-base text-gray-300 font-semibold tracking-wide">TOTAL</div>
                <div className="text-2xl font-extrabold text-green-400">{formatPrice(cartTotal)}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={resetCart} className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm">Limpiar</button>
                <button onClick={handleProcessPosSale} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-semibold disabled:bg-gray-500 disabled:cursor-not-allowed" disabled={cartItems.length===0 || !isTableNumberValid}>Cobrar</button>
              </div>
            </>
          ) : posStage==='pay' ? (
            // Panel de Pago
            <>
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
                <div className="mb-3 bg-gray-700/50 p-3 rounded-xl border border-gray-600 relative">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-gray-400 text-xs">Total a pagar</span>
                    <button 
                        onClick={() => setIsSplitPaymentMode(!isSplitPaymentMode)}
                        className="text-[10px] bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 px-2 py-0.5 rounded border border-blue-500/30 transition"
                    >
                        {isSplitPaymentMode ? 'Modo Simple' : 'Dividir pago'}
                    </button>
                  </div>
                  <div className="text-2xl font-extrabold text-green-400 leading-tight text-center mb-1">{formatPrice(cartTotal)}</div>
                  
                  {/* Resumen de pago (Change/Restante) */}
                  {(() => {
                    let totalPaid = 0;
                    if (isSplitPaymentMode) {
                        totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                    } else {
                        totalPaid = (posPaymentMethod === 'efectivo' && posCashAmount) ? parseFloat(posCashAmount) : (posPaymentMethod !== 'efectivo' ? cartTotal : 0);
                    }
                    
                    const remaining = cartTotal - totalPaid;
                    const isOverpaid = remaining < 0;
                    
                    if (totalPaid > 0) {
                        return (
                          <>
                            <div className="border-t border-gray-600 my-1"></div>
                            <div className="flex justify-between items-center">
                              <span className={isOverpaid ? "text-green-400 text-xs" : "text-red-400 text-xs"}>
                                {isOverpaid ? "Vueltos" : "Restante"}
                              </span>
                              <span className={`text-xl font-bold ${isOverpaid ? "text-green-400" : "text-red-400"}`}>
                                {formatPrice(Math.abs(remaining))}
                              </span>
                            </div>
                          </>
                        );
                    }
                    return null;
                  })()}
                </div>
                
                <div className="mb-3">
                  {isSplitPaymentMode ? (
                      <PaymentSplitEditor
                        theme={theme}
                        total={cartTotal}
                        value={payments}
                        onChange={setPayments}
                        catalogMethods={['Efectivo', 'Nequi', 'Daviplata']}
                      />
                  ) : (
                      // Modo Simple
                      <div className="space-y-2">
                          {/* Selector de Método */}
                          <div className="grid grid-cols-3 gap-2">
                              {['efectivo', 'nequi', 'daviplata'].map(m => (
                                  <button
                                      key={m}
                                      onClick={() => { setPosPaymentMethod(m); setPosCashAmount(''); }}
                                      className={`py-2 rounded-lg border flex flex-col items-center justify-center transition ${
                                          posPaymentMethod === m 
                                          ? 'bg-blue-600 border-blue-500 text-white shadow-md scale-105' 
                                          : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                                      }`}
                                  >
                                      <span className="capitalize font-bold text-xs">{m}</span>
                                  </button>
                              ))}
                          </div>

                          {/* Opciones de Efectivo */}
                          {posPaymentMethod === 'efectivo' && (
                              <div className="bg-gray-800/50 rounded-lg p-2 border border-gray-700 animate-fadeIn">
                                  <div className="text-[10px] text-gray-400 mb-1">Sugerencias</div>
                                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                                      <button 
                                          onClick={() => setPosCashAmount(cartTotal.toString())}
                                          className="py-1.5 px-1 bg-gray-700 hover:bg-gray-600 rounded text-[10px] font-medium text-green-300 border border-green-500/30"
                                      >
                                          Exacto
                                      </button>
                                      {quickCashSuggestions.map(amt => (
                                          <button
                                              key={amt}
                                              onClick={() => setPosCashAmount(amt.toString())}
                                              className="py-1.5 px-1 bg-gray-700 hover:bg-gray-600 rounded text-[10px] font-medium text-white border border-gray-600"
                                          >
                                              {formatPrice(amt)}
                                          </button>
                                      ))}
                                  </div>
                                  
                                  <div>
                                      <label className="block text-[10px] text-gray-400 mb-1">Monto recibido</label>
                                      <div className="relative">
                                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                          <input 
                                              type="number" 
                                              value={posCashAmount} 
                                              onChange={e => setPosCashAmount(e.target.value)}
                                              placeholder="0"
                                              className="w-full pl-5 pr-2 py-1.5 rounded-lg bg-gray-900 border border-gray-600 text-white text-sm font-bold focus:ring-1 focus:ring-blue-500 focus:border-transparent outline-none"
                                          />
                                      </div>
                                  </div>
                              </div>
                          )}
                      </div>
                  )}

                  <div className="mt-3">
                    <label className="block text-gray-400 mb-1 text-[10px]">Nota (opcional)</label>
                    <input value={posNote} onChange={e=>setPosNote(e.target.value)} className="w-full px-2 py-1.5 rounded-lg bg-gray-700 border border-gray-600 text-white text-xs focus:border-blue-500 outline-none"/>
                  </div>
                </div>
              </div>
              <div className="mt-auto pt-2 border-t border-gray-700">
                <div className="flex gap-2 pt-2">
                  <button onClick={()=>setPosStage('select')} className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-xs font-medium transition">Volver</button>
                  
                  {(() => {
                      let totalPaid = 0;
                      if (isSplitPaymentMode) {
                          totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                      } else {
                          totalPaid = (posPaymentMethod === 'efectivo' && posCashAmount) ? parseFloat(posCashAmount) : (posPaymentMethod !== 'efectivo' ? cartTotal : 0);
                      }
                      
                      const remaining = cartTotal - totalPaid;
                      
                      // En modo simple, si es Nequi/Daviplata, asumimos pago completo al dar click
                      // Si es efectivo, validamos monto
                      const canPay = isSplitPaymentMode 
                          ? totalPaid > 0 
                          : (posPaymentMethod !== 'efectivo' || (posCashAmount && parseFloat(posCashAmount) > 0));

                      if (remaining > 0 && canPay) {
                          return (
                              <button 
                                onClick={() => handleProcessPosSale(true)} 
                                className="flex-1 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-xs font-bold shadow hover:shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!canPay}
                              >
                                Abonar {formatPrice(totalPaid)}
                              </button>
                          );
                      } else {
                          return (
                              <button 
                                onClick={() => handleProcessPosSale(false)} 
                                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow hover:shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!canPay && posPaymentMethod === 'efectivo'}
                              >
                                Cobrar Total
                              </button>
                          );
                      }
                  })()}
                </div>
              </div>
            </>
          ) : (
            // Panel de Confirmación de Venta Completada
            <>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* Badge de confirmación */}
                <div className="text-center mb-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-600/20 border border-green-500/50 rounded-full mb-1">
                    <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-xs font-bold text-green-400">¡Venta Completada!</span>
                  </div>
                </div>
                  
                {/* Total cobrado */}
                <div className="text-center mb-3">
                  <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1 font-medium">TOTAL COBRADO</div>
                  <div className="text-2xl font-extrabold text-green-400 mb-1 leading-tight">{formatPrice(completedSaleData?.total || 0)}</div>
                  <div className="text-[10px] text-gray-300 mb-1">
                    Pagado Con {completedSaleData?.paymentMethod === 'efectivo' ? 'Efectivo' : completedSaleData?.paymentMethod === 'nequi' ? 'Nequi' : 'Daviplata'}
                  </div>
                  {completedSaleData?.paymentMethod === 'efectivo' && completedSaleData?.cashReceived != null && (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-700/30 border border-blue-500/50">
                      <span className="text-sm">💵</span>
                      <span className="text-[10px] font-semibold text-blue-200">
                        Recibido: {formatPrice(completedSaleData.cashReceived)}
                      </span>
                    </div>
                  )}
                </div>
                  
                {/* Vueltas a entregar o Efectivo exacto */}
                {completedSaleData?.paymentMethod === 'efectivo' && (
                  completedSaleData?.changeGiven > 0 ? (
                    <>
                    <div className="mb-2 bg-amber-900/30 border border-amber-500/40 rounded-lg p-2">
                      <div className="flex items-center justify-center gap-1 mb-0.5">
                        <span className="text-sm">🪙</span>
                        <span className="text-[10px] font-semibold text-amber-300">Vueltas a entregar</span>
                      </div>
                      <div className="text-xl font-bold text-amber-300 text-center">
                        {formatPrice(completedSaleData.changeGiven)}
                      </div>
                    </div>
                    {/* Desglose sugerido en tarjeta aparte (tono diferente) */}
                    {completedSaleData?.changeBreakdown?.length > 0 && (
                      <div className="mb-2 bg-slate-900/50 border border-slate-700 rounded-xl p-2">
                        <div className="flex items-center justify-center gap-1 mb-1.5">
                          <span className="text-sm">💵</span>
                          <span className="text-[10px] font-medium text-gray-200">Desglose sugerido:</span>
                        </div>
                        <div className="space-y-1">
                          {completedSaleData.changeBreakdown.map(p => (
                            <div key={p.d} className="flex items-center justify-between bg-slate-800 rounded-lg px-2 py-1 border border-slate-700">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs">{p.isCoin ? '🪙' : '💵'}</span>
                                <span className="text-[10px] sm:text-xs font-medium text-gray-200">{p.q}x {formatPrice(p.d)}</span>
                              </div>
                              <span className="text-[10px] sm:text-xs font-semibold text-white">{formatPrice(p.q * p.d)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    </>
                  ) : (
                    <div className="mb-3 bg-emerald-900/30 border border-emerald-600/50 rounded-xl p-2">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-base">✅</span>
                        <span className="text-xs font-semibold text-emerald-300">Efectivo exacto - Sin vueltas</span>
                      </div>
                    </div>
                  )
                )}
              </div>
              
              {/* Botones de acción */}
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => {
                      if (completedSaleData) {
                        printReceipt({
                          id: completedSaleData.orderId,
                          date: new Date(),
                          items: completedSaleData.items,
                          total: completedSaleData.total,
                          paymentMethod: completedSaleData.paymentMethod,
                          cashReceived: completedSaleData.cashReceived,
                          changeGiven: completedSaleData.changeGiven,
                          changeBreakdown: completedSaleData.changeBreakdown,
                          note: completedSaleData.note,
                          tableNumber: completedSaleData.tableNumber,
                          takeaway: completedSaleData.takeaway,
                        });
                      }
                    }}
                    className="py-2 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition shadow hover:shadow-md"
                  >
                    <span className="text-xs">🧾</span>
                    <span className="leading-none">Reimprimir</span>
                  </button>
                  <button 
                    onClick={resetCart}
                    className="py-2 px-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition shadow hover:shadow-md"
                  >
                    <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500 text-white font-semibold tracking-wide">NEW</span>
                    <span className="leading-none">Nueva Venta</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal Selector de Mesas */}
      {showTableSelector && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowTableSelector(false)}
        >
          <div 
            className="bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full max-h-[75vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-white">Seleccionar Mesa</h3>
                <button
                  onClick={() => setShowTableSelector(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <XCircleIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-4">
              {/* Opción Llevar */}
              <button
                onClick={() => {
                  setPosTableNumber('llevar');
                  setShowTableSelector(false);
                }}
                className={`w-full mb-3 px-3 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 text-sm ${
                  posTableNumber === 'llevar'
                    ? 'bg-orange-600/20 border-2 border-orange-500 text-orange-300'
                    : 'bg-gray-700/50 border-2 border-gray-600 text-gray-300 hover:border-orange-400 hover:bg-orange-600/10'
                }`}
              >
                <HomeIcon className="w-4 h-4" />
                <span>Para Llevar</span>
                {posTableNumber === 'llevar' && <span className="ml-auto text-orange-400">✓</span>}
              </button>
              
              {/* Grid de Mesas */}
              <div className="max-h-52 overflow-y-auto overflow-x-hidden custom-scrollbar">
                <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Mesas Disponibles</div>
                <div className="grid grid-cols-4 gap-2 pr-2">
                  {tables.map(table => (
                    <button
                      key={table.id}
                      onClick={() => {
                        setPosTableNumber(table.name);
                        setShowTableSelector(false);
                      }}
                      className={`aspect-square rounded-lg font-medium transition-all duration-200 flex flex-col items-center justify-center gap-0.5 text-xs ${
                        posTableNumber === table.name
                          ? 'bg-blue-600/20 border-2 border-blue-500 text-blue-300 scale-105'
                          : 'bg-gray-700/50 border-2 border-gray-600 text-gray-300 hover:border-blue-400 hover:bg-blue-600/10 hover:scale-105'
                      }`}
                    >
                      <span className="text-sm">🪑</span>
                      <span className="text-[10px] leading-tight">{table.name}</span>
                      {posTableNumber === table.name && <span className="text-blue-400 text-[10px]">✓</span>}
                    </button>
                  ))}
                </div>
                {tables.length === 0 && (
                  <div className="text-center text-gray-500 py-4">
                    <span className="block text-sm">No hay mesas configuradas</span>
                    <span className="text-xs opacity-70">Contacte al administrador</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="px-4 py-3 border-t border-gray-700 flex gap-2">
              <button
                onClick={() => setShowTableSelector(false)}
                className="flex-1 py-2 px-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editor */}
      {showItemEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${theme==='dark'?'bg-gray-800':'bg-white'} w-full max-w-md rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto p-6`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-100">{editingItem ? 'Editar Artículo' : 'Nuevo Artículo'}</h3>
              <button onClick={()=>setShowItemEditor(false)} className="text-gray-400 hover:text-gray-200"><XCircleIcon className="w-6 h-6"/></button>
            </div>
            <div className="mb-4 flex gap-6 text-xs">
              <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={itemEditorMode==='color'} onChange={()=>setItemEditorMode('color')} /> Color y forma</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={itemEditorMode==='image'} onChange={()=>setItemEditorMode('image')} /> Imagen</label>
            </div>
            {itemEditorMode==='color' ? (
              <div className="mb-6">
                <div className="grid grid-cols-9 gap-2 mb-4">
                  {colorPalette.map(c => (
                    <button key={c} onClick={()=>setItemColor(c)} style={{ background:c }} className={`h-8 rounded ${itemColor===c ? 'ring-2 ring-white':''}`}></button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 mb-4 text-xs">
                  {shapeOptions.map(opt => (
                    <button key={opt.id} onClick={()=>setItemShape(opt.id)} className={`px-2 py-1 rounded border ${itemShape===opt.id ? 'bg-blue-600 border-blue-500 text-white':'border-gray-600 text-gray-300 hover:bg-gray-700'}`}>{opt.label}</button>
                  ))}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-xs text-gray-300">Preview:</div>
                  <div className={`w-16 h-16 flex items-center justify-center text-[11px] font-semibold text-gray-900 dark:text-gray-100 shadow ${itemShape==='circle'?'rounded-full': itemShape==='square'?'rounded-lg': itemShape==='outline'?'rounded-full ring-2 ring-white':'rounded-full'}`} style={itemShape==='hex'?{clipPath:'polygon(25% 5%,75% 5%,95% 50%,75% 95%,25% 95%,5% 50%)',background:itemColor}:{background:itemShape==='outline'?'transparent':itemColor}}>Item</div>
                </div>
              </div>
            ) : (
              <div className="mb-6 space-y-4">
                <div>
                  <label className="block text-xs text-gray-300 mb-1">Imagen</label>
                  <input type="file" accept="image/*" onChange={handleImageFile} className="text-xs" />
                </div>
                
                {/* Selector de forma también para imagen */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <label className="block text-xs text-gray-300 w-full mb-1">Forma:</label>
                  {shapeOptions.map(opt => (
                    <button key={opt.id} onClick={()=>setItemShape(opt.id)} className={`px-2 py-1 rounded border ${itemShape===opt.id ? 'bg-blue-600 border-blue-500 text-white':'border-gray-600 text-gray-300 hover:bg-gray-700'}`}>{opt.label}</button>
                  ))}
                </div>
                
                {itemImageData && (
                  <div className="space-y-2">
                    <label className="block text-xs text-gray-300">Preview:</label>
                    <div 
                         style={itemShape==='hex'?{clipPath:'polygon(25% 5%,75% 5%,95% 50%,75% 95%,25% 95%,5% 50%)'}:{}} 
                         className={`relative w-32 h-32 border-2 border-gray-600 bg-gray-100 overflow-hidden ${itemShape==='circle'?'rounded-full': itemShape==='square'?'rounded-lg': itemShape==='outline'?'rounded-full ring-4 ring-blue-500':''}`}>
                      <img src={itemImageData} alt="preview" className="w-full h-full object-contain" />
                      <button onClick={()=>setItemImageData(null)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1 shadow-lg z-10"><XCircleIcon className="w-4 h-4"/></button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-gray-300 mb-1">Nombre</label>
                <input value={itemName} onChange={e=>setItemName(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-700 text-white text-sm" />
              </div>
              <div>
                <label className="block text-gray-300 mb-1">Precio</label>
                <input type="number" value={itemPrice} onChange={e=>setItemPrice(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-700 text-white text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 mb-1">Tipo</label>
                  <select value={itemType} onChange={e=>setItemType(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-700 text-white text-sm">
                    <option value="almuerzo_mesa">🪑 Almuerzo Mesa</option>
                    <option value="almuerzo_llevar">📦 Almuerzo llevar</option>
                    <option value="desayuno_mesa">🪑 Desayuno Mesa</option>
                    <option value="desayuno_llevar">📦 Desayuno llevar</option>
                    <option value="adiccion">➕ Adición/Bebida</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Categoría</label>
                  <input value={itemCategory} onChange={e=>setItemCategory(e.target.value)} placeholder="Ej: Bebidas" className="w-full px-3 py-2 rounded bg-gray-700 text-white text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <input id="activo" type="checkbox" checked={itemActive} onChange={e=>setItemActive(e.target.checked)} />
                <label htmlFor="activo" className="text-gray-300 select-none">Activo</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveItem} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold text-sm">Guardar</button>
                <button onClick={()=>setShowItemEditor(false)} className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm">Cancelar</button>
                {editingItem && <button onClick={()=>setItemActive(a=>!a)} className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm">{itemActive? 'Desactivar':'Activar'}</button>}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de detalles de orden */}
      {showOrderDetailModal && selectedOrderDetail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowOrderDetailModal(false)}>
          <div className="bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">
                {selectedOrderDetail.orderType === 'desayuno' ? '🍳 Detalles del Desayuno' : '🍽️ Detalles del Almuerzo'}
              </h3>
              <button onClick={() => setShowOrderDetailModal(false)} className="text-gray-400 hover:text-white transition">
                <XCircleIcon className="w-6 h-6"/>
              </button>
            </div>
            <div className="p-6">
              {selectedOrderDetail.orderType === 'desayuno' ? (
                <div className="bg-white rounded-lg p-4">
                  <BreakfastOrderSummary
                    items={selectedOrderDetail.breakfasts || []}
                    isAdminView={false}
                    isWaiterView={false}
                    showSaveButton={false}
                    hidePaymentInstructions={true}
                  />
                </div>
              ) : (
                <OrderSummary 
                  meals={selectedOrderDetail.meals || []} 
                  isAdminView={true}
                  isTableOrder={(() => {
                    const tableNum = selectedOrderDetail.tableNumber || selectedOrderDetail.meals?.[0]?.tableNumber || selectedOrderDetail.breakfasts?.[0]?.tableNumber || '';
                    const isLlevar = !tableNum || tableNum.toLowerCase().includes('llevar');
                    return !isLlevar;
                  })()}
                  preCalculatedTotal={selectedOrderDetail.total}
                />
              )}
              <div className="mt-6 flex gap-3">
                <button onClick={() => {
                  loadPendingOrderToCart(selectedOrderDetail);
                  setShowOrderDetailModal(false);
                }} className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition">
                  Cargar en caja
                </button>
                <button onClick={() => setShowOrderDetailModal(false)} className="flex-1 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CajaPOS;