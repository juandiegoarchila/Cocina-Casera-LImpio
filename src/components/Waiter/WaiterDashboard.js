//src/components/Waiter/WaiterDashboard.js
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Auth/AuthProvider';
import { db } from '../../config/firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
import MealList from '../MealList';
import BreakfastList from '../BreakfastList';
import OrderSummary from '../OrderSummary';
import BreakfastOrderSummary from '../BreakfastOrderSummary';
import LoadingIndicator from '../LoadingIndicator';
import ErrorMessage from '../ErrorMessage';
import SuccessMessage from '../SuccessMessage';
import OptionSelector from '../OptionSelector';
import { initializeMealData, handleMealChange, addMeal, duplicateMeal, removeMeal } from '../../utils/MealLogic';
import { calculateTotal, calculateMealPrice } from '../../utils/MealCalculations';
import { initializeBreakfastData, handleBreakfastChange, addBreakfast, duplicateBreakfast, removeBreakfast, calculateBreakfastPrice, calculateTotalBreakfastPrice } from '../../utils/BreakfastLogic';

const WaiterDashboard = () => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [meals, setMeals] = useState([initializeMealData({}, true)]);
  const [breakfasts, setBreakfasts] = useState([initializeBreakfastData({ isWaitress: true })]);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [incompleteMealIndex, setIncompleteMealIndex] = useState(null);
  const [incompleteSlideIndex, setIncompleteSlideIndex] = useState(null);
  const [incompleteBreakfastIndex, setIncompleteBreakfastIndex] = useState(null);
  const [incompleteBreakfastSlideIndex, setIncompleteBreakfastSlideIndex] = useState(null);
  const [soups, setSoups] = useState([]);
  const [soupReplacements, setSoupReplacements] = useState([]);
  const [principles, setPrinciples] = useState([]);
  const [proteins, setProteins] = useState([]);
  const [drinks, setDrinks] = useState([]);
  const [sides, setSides] = useState([]);
  const [additions, setAdditions] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [breakfastEggs, setBreakfastEggs] = useState([]);
  const [breakfastBroths, setBreakfastBroths] = useState([]);
  const [breakfastRiceBread, setBreakfastRiceBread] = useState([]);
  const [breakfastDrinks, setBreakfastDrinks] = useState([]);
  const [breakfastAdditions, setBreakfastAdditions] = useState([]);
  const [breakfastTypes, setBreakfastTypes] = useState([]);
  const [breakfastProteins, setBreakfastProteins] = useState([]);
  const [breakfastTimes, setBreakfastTimes] = useState([]);
  const [isOrderingDisabled, setIsOrderingDisabled] = useState(false);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('create');
  const [editingOrder, setEditingOrder] = useState(null);
  const [showMenu, setShowMenu] = useState(null);
  const [menuType, setMenuType] = useState('closed');
  const [schedules, setSchedules] = useState({
    breakfastStart: 420, // 07:00
    breakfastEnd: 631,   // 10:31
    lunchStart: 632,     // 10:32
    lunchEnd: 950,       // 15:50
  });
  const [timeRemaining, setTimeRemaining] = useState('');

  // Helper: normaliza el nombre del método de pago (acepta string u objeto {name/label/value})
  const getMethodName = (opt) => {
    if (!opt) return '';
    if (typeof opt === 'string') return opt;
    return (opt.name || opt.label || opt.value || '').toString();
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setErrorMessage('Por favor, inicia sesión para continuar.');
      setTimeout(() => navigate('/staffhub'), 3000);
      return;
    }
    if (role !== 3) {
      setErrorMessage('Acceso denegado. Solo las meseras pueden acceder a esta página.');
      setTimeout(() => navigate('/staffhub'), 3000);
      return;
    }
  }, [user, loading, role, navigate]);

  useEffect(() => {
    const collections = [
      'soups', 'soupReplacements', 'principles', 'proteins', 'drinks', 'sides', 'additions', 'paymentMethods',
      'breakfastEggs', 'breakfastBroths', 'breakfastRiceBread', 'breakfastDrinks', 'breakfastAdditions',
      'breakfastTypes', 'breakfastProteins', 'breakfastTimes'
    ];
    const setters = [
      setSoups, setSoupReplacements, setPrinciples, setProteins, setDrinks, setSides, setAdditions, setPaymentMethods,
      setBreakfastEggs, setBreakfastBroths, setBreakfastRiceBread, setBreakfastDrinks, setBreakfastAdditions,
      setBreakfastTypes, setBreakfastProteins, setBreakfastTimes
    ];
    const unsubscribers = collections.map((col, index) => onSnapshot(collection(db, col), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setters[index](data);
      if (process.env.NODE_ENV === 'development') console.log(`Updated ${col}:`, data);
      if (data.length === 0) {
        setErrorMessage(
          process.env.NODE_ENV !== 'production'
            ? `La colección ${col} está vacía. Agrega datos desde /admin.`
            : 'Algunas opciones no están disponibles. Intenta de nuevo más tarde.'
        );
      }
    }, (error) => {
      if (process.env.NODE_ENV === 'development') console.error(`Error al escuchar ${col}:`, error);
      setErrorMessage(
        process.env.NODE_ENV === 'production'
          ? 'No se pudieron cargar las opciones. Intenta de nuevo más tarde.'
          : `Error al cargar datos de ${col}. Revisa la consola para más detalles.`
      );
    }));

    const settingsUnsubscribe = onSnapshot(doc(db, 'settings', 'global'), (docSnapshot) => {
      setIsOrderingDisabled(docSnapshot.exists() ? docSnapshot.data().isOrderingDisabled || false : false);
    }, (error) => {
      if (process.env.NODE_ENV === 'development') console.error('Error al escuchar settings/global:', error);
      setErrorMessage('Error al cargar configuración. Intenta de nuevo más tarde.');
    });

    const schedulesUnsubscribe = onSnapshot(doc(db, 'settings', 'schedules'), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        setSchedules({
          breakfastStart: data.breakfastStart || 420,
          breakfastEnd: data.breakfastEnd || 631,
          lunchStart: data.lunchStart || 632,
          lunchEnd: data.lunchEnd || 950,
        });
      }
    });

    const breakfastOrdersUnsubscribe = onSnapshot(collection(db, 'breakfastOrders'), (snapshot) => {
      const breakfastOrders = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data(), type: 'breakfast' }))
        .filter(order => order.userId === user?.uid)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(prev => [...prev.filter(order => order.type !== 'breakfast'), ...breakfastOrders]);
      if (process.env.NODE_ENV === 'development') console.log('Updated breakfast orders:', breakfastOrders);
    });

    const ordersUnsubscribe = onSnapshot(collection(db, 'tableOrders'), (snapshot) => {
      const orderData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data(), type: 'lunch' }))
        .filter(order => order.userId === user?.uid)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(prev => [...prev.filter(order => order.type !== 'lunch'), ...orderData]);
      if (process.env.NODE_ENV === 'development') console.log('Updated waiter orders:', orderData);
    });

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
      settingsUnsubscribe();
      schedulesUnsubscribe();
      breakfastOrdersUnsubscribe();
      ordersUnsubscribe();
    };
  }, [user]);

  useEffect(() => {
    const updateMenuTypeAndTime = () => {
      const now = new Date();
      const totalMinutes = now.getHours() * 60 + now.getMinutes();
      let menu = 'closed';
      let timeString = '';

      const formatTime = (minutes) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const period = hours >= 12 ? 'PM' : 'AM';
        const adjustedHours = hours % 12 || 12;
        return `${adjustedHours}:${mins.toString().padStart(2, '0')} ${period}`;
      };

      if (totalMinutes >= schedules.breakfastStart && totalMinutes <= schedules.breakfastEnd) {
        menu = 'breakfast';
        timeString = formatTime(schedules.breakfastEnd);
      } else if (totalMinutes >= schedules.lunchStart && totalMinutes <= schedules.lunchEnd) {
        menu = 'lunch';
        timeString = formatTime(schedules.lunchEnd);
      }

      setMenuType(menu);
      setTimeRemaining(timeString);
    };

    updateMenuTypeAndTime();
    const interval = setInterval(updateMenuTypeAndTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [schedules]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleSendOrder = async () => {
    let incompleteMealIndex = null;
    let incompleteSlideIndex = null;
    let firstMissingField = '';
    for (let i = 0; i < meals.length; i++) {
      const meal = meals[i];
      const isCompleteRice = Array.isArray(meal?.principle) && meal.principle.some(p => ['Arroz con pollo', 'Arroz paisa', 'Arroz tres carnes'].includes(p.name));
      const missing = [];
      const slideMap = {
        'Sopa o reemplazo de sopa': 0,
        'Principio': 1,
        'Proteína': 2,
        'Bebida': 3,
        'Acompañamientos': 4,
        'Mesa': 5,
        'Método de pago': 6,
        'Tipo de pedido': 7,
      };

      if (!meal?.soup && !meal?.soupReplacement) missing.push('Sopa o reemplazo de sopa');
      if (!meal?.principle && !meal?.principleReplacement) missing.push('Principio');
      if (!isCompleteRice && !meal?.protein) missing.push('Proteína');
      if (!meal?.drink) missing.push('Bebida');
      if (!isCompleteRice && (!meal?.sides || meal.sides.length === 0)) missing.push('Acompañamientos');
      if (!meal?.tableNumber) missing.push('Mesa');
      if (!meal?.paymentMethod) missing.push('Método de pago');
      if (!meal?.orderType) missing.push('Tipo de pedido');

      if (missing.length > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Meal ${i + 1} is incomplete. Missing fields:`, missing);
          console.log(`Meal ${i + 1} data:`, meal);
        }
        incompleteMealIndex = i;
        firstMissingField = missing[0];
        incompleteSlideIndex = slideMap[firstMissingField] || 0;
        break;
      }
    }

    if (incompleteMealIndex !== null) {
      setIncompleteMealIndex(incompleteMealIndex);
      setIncompleteSlideIndex(incompleteSlideIndex);
      setErrorMessage(`Por favor, completa el campo "${firstMissingField}" para el Almuerzo #${incompleteMealIndex + 1}.`);
      setTimeout(() => {
        const element = document.getElementById(`meal-item-${incompleteMealIndex}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('highlight-incomplete');
          setTimeout(() => element.classList.remove('highlight-incomplete'), 3000);
          element.dispatchEvent(new CustomEvent('updateSlide', { detail: { slideIndex: incompleteSlideIndex } }));
        }
      }, 100);
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    try {
      const order = {
        userId: user.uid,
        userEmail: user.email || `waiter_${user.uid}@example.com`,
        meals: meals.map(meal => ({
          soup: meal.soup ? { name: meal.soup.name } : null,
          soupReplacement: meal.soupReplacement ? { name: meal.soupReplacement.name, replacement: meal.soupReplacement.replacement || '' } : null,
          principle: Array.isArray(meal.principle) ? meal.principle.map(p => ({ name: p.name, replacement: p.replacement || '' })) : [],
          principleReplacement: meal.principleReplacement ? { name: meal.principleReplacement.name } : null,
          protein: meal.protein ? { name: meal.protein.name } : null,
          drink: meal.drink ? { name: meal.drink.name } : null,
          sides: Array.isArray(meal.sides) ? meal.sides.map(s => ({ name: s.name })) : [],
          additions: meal.additions?.map(addition => ({
            id: addition.id,
            name: addition.name,
            protein: addition.protein || '',
            replacement: addition.replacement || '',
            quantity: addition.quantity || 1,
            price: addition.price || 0,
          })) || [],
          tableNumber: meal.tableNumber || '',
          paymentMethod: meal.paymentMethod ? { name: meal.paymentMethod.name } : null,
          orderType: meal.orderType || '',
          notes: meal.notes || '',
        })),
        total: calculateTotal(meals, 3),
        status: 'Pendiente',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      console.log('[WaiterDashboard] Saving order with meals:', order.meals);
      await addDoc(collection(db, 'tableOrders'), order);
      setSuccessMessage('¡Orden de mesa guardada con éxito!');
      setMeals([initializeMealData({}, true)]);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('Error al guardar la orden de mesa:', error);
      setErrorMessage('Error al guardar la orden. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendBreakfastOrder = async () => {
    let incompleteIndex = null;
    let incompleteSlide = null;
    let firstMissingField = '';

    breakfasts.forEach((breakfast, index) => {
      const typeData = Array.isArray(breakfastTypes) ? breakfastTypes.find(bt => bt.name === breakfast.type?.name) : null;
      const steps = typeData ? typeData.steps || [] : ['type', 'eggs', 'broth', 'riceBread', 'drink', 'protein'];
      const missing = [];

      if (!breakfast.type?.name) missing.push('type');
      steps.forEach(step => {
        if (step === 'tableNumber') {
          if (!breakfast.tableNumber) missing.push('tableNumber');
        } else if (step === 'paymentMethod') {
          if (!breakfast.paymentMethod && !breakfast.payment) missing.push('paymentMethod');
        } else if (step === 'orderType') {
          if (!breakfast.orderType) missing.push('orderType');
        } else if (!breakfast[step]) {
          missing.push(step);
        }
      });

      if (missing.length > 0 && incompleteIndex === null) {
        incompleteIndex = index;
        firstMissingField = missing[0];
        const slideMap = {
          type: 0,
          broth: 1,
          eggs: 2,
          riceBread: 3,
          drink: 4,
          protein: 5,
          tableNumber: 6,
          paymentMethod: 7,
          orderType: 8,
        };
        incompleteSlide = slideMap[firstMissingField] || 0;
      }
    });

    if (incompleteIndex !== null) {
      setIncompleteBreakfastIndex(incompleteIndex);
      setIncompleteBreakfastSlideIndex(incompleteSlide);
      setErrorMessage(
        `Por favor, completa el campo "${firstMissingField}" para el Desayuno #${incompleteIndex + 1}.`
      );
      setTimeout(() => {
        const element = document.getElementById(`breakfast-item-${breakfasts[incompleteIndex].id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('highlight-incomplete');
          setTimeout(() => element.classList.remove('highlight-incomplete'), 3000);
        }
      }, 100);
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      // Construir desglose de pagos por método para totales
      const paymentsByMethodBreakfast = {};
      breakfasts.forEach((b) => {
        const method = getMethodName(b.paymentMethod || b.payment);
        if (!method) return;
        const amount = Number(calculateBreakfastPrice(b, 3) || 0);
        paymentsByMethodBreakfast[method] = (paymentsByMethodBreakfast[method] || 0) + amount;
      });
      const paymentsBreakfast = Object.entries(paymentsByMethodBreakfast).map(([method, amount]) => ({
        method,
        amount: Math.floor(amount),
      }));

      const order = {
        userId: user.uid,
        userEmail: user.email || `waiter_${user.uid}@example.com`,
        breakfasts: breakfasts.map(breakfast => ({
          type: breakfast.type ? { name: breakfast.type.name } : null,
          broth: breakfast.broth ? { name: breakfast.broth.name } : null,
          eggs: breakfast.eggs ? { name: breakfast.eggs.name } : null,
          riceBread: breakfast.riceBread ? { name: breakfast.riceBread.name } : null,
          drink: breakfast.drink ? { name: breakfast.drink.name } : null,
          protein: breakfast.protein ? { name: breakfast.protein.name } : null,
          additions: breakfast.additions?.map(addition => ({
            name: addition.name,
            quantity: addition.quantity || 1,
          })) || [],
          tableNumber: breakfast.tableNumber || '',
          // Normaliza y guarda ambos por compatibilidad
          paymentMethod: (breakfast.paymentMethod || breakfast.payment)
            ? { name: getMethodName(breakfast.paymentMethod || breakfast.payment) }
            : null,
          payment: (breakfast.payment || breakfast.paymentMethod)
            ? { name: getMethodName(breakfast.payment || breakfast.paymentMethod) }
            : null,
          orderType: breakfast.orderType || '',
          notes: breakfast.notes || '',
        })),
        total: calculateTotalBreakfastPrice(breakfasts, 3, breakfastTypes),
        payments: paymentsBreakfast,
        status: 'Pendiente',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      if (process.env.NODE_ENV === 'development') console.log('[WaiterDashboard] Saving breakfast order:', order);
      await addDoc(collection(db, 'breakfastOrders'), order);
      setSuccessMessage('¡Orden de desayuno guardada con éxito!');
      setBreakfasts([initializeBreakfastData({ isWaitress: true })]);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('Error al guardar la orden de desayuno:', error);
      setErrorMessage('Error al guardar la orden de desayuno. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (orderId, newStatus, orderType) => {
    try {
      setIsLoading(true);
      console.log('Attempting to update status for orderId:', orderId, 'to', newStatus, 'with role:', role, 'type:', orderType);
      const collectionName = orderType === 'breakfast' ? 'breakfastOrders' : 'tableOrders';
      const orderRef = doc(db, collectionName, orderId);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: new Date(),
      });
      setErrorMessage(null);
      setSuccessMessage(`Estado de la orden ${orderId.slice(0, 8)} actualizado a ${newStatus}`);
      setShowMenu(null);
      if (process.env.NODE_ENV === 'development') {
        console.log(`Estado de la orden ${orderId} actualizado a ${newStatus}`);
      }
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      setErrorMessage(`Error al actualizar el estado: ${error.message}. Verifica tu rol y permisos.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditOrder = (order) => {
    if (order.type === 'lunch') {
      const initializedOrder = {
        ...order,
        meals: order.meals.map(meal => ({
          soup: meal.soup || null,
          soupReplacement: meal.soupReplacement ? {
            ...meal.soupReplacement,
            replacement: meal.soupReplacement.replacement || ''
          } : null,
          principle: Array.isArray(meal.principle) ? meal.principle.map(p => ({
            ...p,
            replacement: p.replacement || ''
          })) : [],
          principleReplacement: meal.principleReplacement || null,
          protein: meal.protein || null,
          drink: meal.drink || null,
          sides: meal.sides || [],
          additions: Array.isArray(meal.additions) ? meal.additions : [],
          paymentMethod: meal.paymentMethod || null,
          tableNumber: meal.tableNumber || '',
          orderType: meal.orderType || '',
          notes: meal.notes || '',
          showReplacementsState: {
            soup: meal.soupReplacement?.name === 'Remplazo por Sopa' && !!meal.soupReplacement?.replacement,
            principle: meal.principle?.some(opt => opt.name === 'Remplazo por Principio' && !!opt.replacement) || false,
          },
        })),
      };
      setEditingOrder(initializedOrder);
      if (process.env.NODE_ENV === 'development') {
        console.log('[WaiterDashboard] Editing lunch order:', initializedOrder);
        console.log('[WaiterDashboard] Meals count:', initializedOrder.meals.length);
        console.log('[WaiterDashboard] Soup replacement:', initializedOrder.meals[0]?.soupReplacement);
        console.log('[WaiterDashboard] Principle replacement:', initializedOrder.meals[0]?.principle);
        console.log('[WaiterDashboard] Additions for first meal:', initializedOrder.meals[0]?.additions);
      }
    } else if (order.type === 'breakfast') {
      const initializedOrder = {
        ...order,
        breakfasts: order.breakfasts.map(breakfast => ({
          type: breakfast.type || null,
          broth: breakfast.broth || null,
          eggs: breakfast.eggs || null,
          riceBread: breakfast.riceBread || null,
          drink: breakfast.drink || null,
          protein: breakfast.protein || null,
          additions: Array.isArray(breakfast.additions) ? breakfast.additions : [],
          tableNumber: breakfast.tableNumber || '',
          paymentMethod: breakfast.paymentMethod || breakfast.payment || null,
          orderType: breakfast.orderType || '',
          notes: breakfast.notes || '',
        })),
      };
      setEditingOrder(initializedOrder);
      if (process.env.NODE_ENV === 'development') {
        console.log('[WaiterDashboard] Editing breakfast order:', initializedOrder);
        console.log('[WaiterDashboard] Breakfasts count:', initializedOrder.breakfasts.length);
        console.log('[WaiterDashboard] Additions for first breakfast:', initializedOrder.breakfasts[0]?.additions);
      }
    }
    setShowMenu(null);
  };

  const handleFormChange = (index, field, value) => {
    if (editingOrder.type === 'lunch') {
      if (field === 'total' && index === -1) {
        setEditingOrder(prev => ({ ...prev, total: parseFloat(value) || 0 }));
        console.log(`[WaiterDashboard] Updated total: ${value}`);
      } else {
        const newMeals = [...editingOrder.meals];
        if (field === 'principle' || field === 'sides') {
          newMeals[index] = { ...newMeals[index], [field]: value ? value : [] };
        } else if (field === 'soup' || field === 'soupReplacement' || field === 'principleReplacement' || field === 'protein' || field === 'drink' || field === 'paymentMethod') {
          newMeals[index] = { ...newMeals[index], [field]: value ? value : null };
          if (field === 'soupReplacement' && value?.name === 'Remplazo por Sopa') {
            newMeals[index].showReplacementsState = { ...newMeals[index].showReplacementsState, soup: true };
          } else if (field === 'soupReplacement' || field === 'soup') {
            newMeals[index].showReplacementsState = { ...newMeals[index].showReplacementsState, soup: false };
            if (field === 'soup') {
              newMeals[index].soupReplacement = null;
            }
          }
          if (field === 'principle' && value?.some(opt => opt.name === 'Remplazo por Principio')) {
            newMeals[index].showReplacementsState = { ...newMeals[index].showReplacementsState, principle: true };
          } else if (field === 'principle') {
            newMeals[index].showReplacementsState = { ...newMeals[index].showReplacementsState, principle: false };
          }
        } else if (field === 'additions') {
          newMeals[index] = { ...newMeals[index], additions: value };
        } else {
          newMeals[index] = { ...newMeals[index], [field]: value };
        }
        const updatedTotal = calculateTotal(newMeals, 3);
        setEditingOrder(prev => ({ ...prev, meals: newMeals, total: updatedTotal }));
      }
    } else if (editingOrder.type === 'breakfast') {
      if (field === 'total' && index === -1) {
        setEditingOrder(prev => ({ ...prev, total: parseFloat(value) || 0 }));
        console.log(`[WaiterDashboard] Updated total: ${value}`);
      } else {
        const newBreakfasts = [...editingOrder.breakfasts];
        if (field === 'additions') {
          newBreakfasts[index] = { ...newBreakfasts[index], additions: value };
        } else {
          newBreakfasts[index] = { ...newBreakfasts[index], [field]: value ? value : null };
        }
        const updatedTotal = calculateTotalBreakfastPrice(newBreakfasts, 3, breakfastTypes);
        setEditingOrder(prev => ({ ...prev, breakfasts: newBreakfasts, total: updatedTotal }));
      }
    }
  };

  const handleSaveEdit = async () => {
    if (editingOrder.type === 'lunch') {
      for (const [index, meal] of editingOrder.meals.entries()) {
        const unconfiguredAdditions = meal.additions?.filter(
          add => add.requiresReplacement && (
            (add.name === 'Proteína adicional' && !add.protein) ||
            (['Sopa adicional', 'Principio adicional', 'Bebida adicional'].includes(add.name) && !add.replacement)
          )
        ) || [];
        if (unconfiguredAdditions.length > 0) {
          setErrorMessage(`Por favor, selecciona una opción para "${unconfiguredAdditions[0].name}" en Almuerzo #${index + 1}.`);
          return;
        }
        if (!meal.orderType) {
          setErrorMessage(`El tipo de pedido es obligatorio para el Almuerzo #${index + 1}.`);
          return;
        }
        if (!meal.tableNumber && meal.orderType === 'table') {
          setErrorMessage(`El número de mesa es obligatorio para pedidos "Para mesa" en Almuerzo #${index + 1}.`);
          return;
        }
      }
      try {
        setIsLoading(true);
        console.log('[WaiterDashboard] Saving edited lunch order:', editingOrder);
        const orderRef = doc(db, 'tableOrders', editingOrder.id);
        await updateDoc(orderRef, {
          meals: editingOrder.meals.map(meal => ({
            soup: meal.soup ? { name: meal.soup.name } : null,
            soupReplacement: meal.soupReplacement ? { name: meal.soupReplacement.name, replacement: meal.soupReplacement.replacement || '' } : null,
            principle: Array.isArray(meal.principle) ? meal.principle.map(p => ({ name: p.name, replacement: p.replacement || '' })) : [],
            principleReplacement: meal.principleReplacement ? { name: meal.principleReplacement.name } : null,
            protein: meal.protein ? { name: meal.protein.name } : null,
            drink: meal.drink ? { name: meal.drink.name } : null,
            sides: Array.isArray(meal.sides) ? meal.sides.map(s => ({ name: s.name })) : [],
            additions: meal.additions ? meal.additions.map(a => ({
              id: a.id,
              name: a.name,
              protein: a.protein || '',
              replacement: a.replacement || '',
              quantity: a.quantity || 1,
              price: a.price || 0,
            })) : [],
            tableNumber: meal.tableNumber || '',
            paymentMethod: meal.paymentMethod ? { name: meal.paymentMethod.name } : null,
            orderType: meal.orderType || '',
            notes: meal.notes || '',
          })),
          total: editingOrder.total !== undefined ? editingOrder.total : calculateTotal(editingOrder.meals, 3),
          updatedAt: new Date(),
        });
        setEditingOrder(null);
        setSuccessMessage(`Orden ${editingOrder.id.slice(0, 8)} actualizada con éxito`);
        if (process.env.NODE_ENV === 'development') {
          console.log(`Orden ${editingOrder.id} actualizada con éxito`);
        }
      } catch (error) {
        console.error('Error al guardar edición:', error);
        setErrorMessage(`Error al guardar los cambios: ${error.message}. Verifica tu rol y permisos.`);
      } finally {
        setIsLoading(false);
      }
    } else if (editingOrder.type === 'breakfast') {
      for (const [index, breakfast] of editingOrder.breakfasts.entries()) {
        const typeData = breakfastTypes.find(bt => bt.name === breakfast.type?.name) || { steps: ['type', 'eggs', 'broth', 'riceBread', 'drink', 'protein'] };
        const steps = typeData.steps || [];
        const missing = [];
        if (!breakfast.type?.name) missing.push('type');
        steps.forEach(step => {
          if (step === 'tableNumber' && !breakfast.tableNumber) missing.push('tableNumber');
          else if (step === 'paymentMethod' && !breakfast.paymentMethod && !breakfast.payment) missing.push('paymentMethod');
          else if (step === 'orderType' && !breakfast.orderType) missing.push('orderType');
          else if (!breakfast[step]) missing.push(step);
        });
        if (missing.length > 0) {
          setErrorMessage(`Por favor, completa el campo "${missing[0]}" para el Desayuno #${index + 1}.`);
          return;
        }
        if (!breakfast.orderType) {
          setErrorMessage(`El tipo de pedido es obligatorio para el Desayuno #${index + 1}.`);
          return;
        }
        if (!breakfast.tableNumber && breakfast.orderType === 'table') {
          setErrorMessage(`El número de mesa es obligatorio para pedidos "Para mesa" en Desayuno #${index + 1}.`);
          return;
        }
      }
      try {
        setIsLoading(true);
        console.log('[WaiterDashboard] Saving edited breakfast order:', editingOrder);
        const orderRef = doc(db, 'breakfastOrders', editingOrder.id);
        await updateDoc(orderRef, {
          breakfasts: editingOrder.breakfasts.map(breakfast => ({
            type: breakfast.type ? { name: breakfast.type.name } : null,
            broth: breakfast.broth ? { name: breakfast.broth.name } : null,
            eggs: breakfast.eggs ? { name: breakfast.eggs.name } : null,
            riceBread: breakfast.riceBread ? { name: breakfast.riceBread.name } : null,
            drink: breakfast.drink ? { name: breakfast.drink.name } : null,
            protein: breakfast.protein ? { name: breakfast.protein.name } : null,
            additions: breakfast.additions?.map(addition => ({
              name: addition.name,
              quantity: addition.quantity || 1,
            })) || [],
            tableNumber: breakfast.tableNumber || '',
            paymentMethod: (breakfast.paymentMethod || breakfast.payment)
              ? { name: getMethodName(breakfast.paymentMethod || breakfast.payment) }
              : null,
            orderType: breakfast.orderType || '',
            notes: breakfast.notes || '',
          })),
          total: editingOrder.total !== undefined ? editingOrder.total : calculateTotalBreakfastPrice(editingOrder.breakfasts, 3, breakfastTypes),
          updatedAt: new Date(),
        });
        setEditingOrder(null);
        setSuccessMessage(`Orden ${editingOrder.id.slice(0, 8)} actualizada con éxito`);
        if (process.env.NODE_ENV === 'development') {
          console.log(`Orden ${editingOrder.id} actualizada con éxito`);
        }
      } catch (error) {
        console.error('Error al guardar edición:', error);
        setErrorMessage(`Error al guardar los cambios: ${error.message}. Verifica tu rol y permisos.`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const formatValue = (value) => {
    if (!value) return 'N/A';
    if (typeof value === 'string') return value;
    if (value.name) return value.name;
    return 'N/A';
  };

  const formatArray = (arr) => {
    if (!arr || !Array.isArray(arr)) return formatValue(arr);
    if (arr.length === 0) return 'N/A';
    return arr.map(item => formatValue(item)).filter(v => v !== 'N/A').join(', ');
  };

  const statusColors = {
    'Pendiente': 'bg-gray-100 text-gray-800',
    'Preparando': 'bg-blue-100 text-blue-800',
    'Completada': 'bg-green-100 text-green-800',
    'Cancelada': 'bg-red-100 text-red-800',
  };

  const normalizedAdditions = useMemo(() => additions.map(add => ({
    ...add,
    price: add.name === 'Mojarra' ? 8000 : add.price,
    requiresReplacement: add.requiresReplacement || ['Proteína adicional', 'Sopa adicional', 'Principio adicional', 'Bebida adicional'].includes(add.name),
  })).filter(add =>
    add.name !== 'Arroz con pollo' &&
    add.name !== 'Arroz paisa' &&
    add.name !== 'Arroz tres carnes'
  ), [additions]);

  const getReplacementsForAdditions = (meal) => {
    const selectedAdditions = meal?.additions || [];
    const unconfiguredAdditions = selectedAdditions.filter(
      (add) => add.requiresReplacement && (add.name === 'Proteína adicional' ? !add.protein : !add.replacement)
    );
    if (unconfiguredAdditions.length === 0) return [];

    const firstUnconfigured = unconfiguredAdditions[0];
    if (firstUnconfigured.name === 'Sopa adicional') return soups.filter(soup => soup.name !== 'Solo bandeja' && soup.name !== 'Remplazo por Sopa');
    if (firstUnconfigured.name === 'Principio adicional') return principles.filter(principle =>
      principle.name !== 'Remplazo por Principio' &&
      !['Arroz con pollo', 'Arroz paisa', 'Arroz tres carnes'].includes(principle.name)
    );
    if (firstUnconfigured.name === 'Proteína adicional') return proteins.filter((p) => p.name !== 'Mojarra');
    if (firstUnconfigured.name === 'Bebida adicional') return drinks.filter((d) => d.name !== 'Sin bebida');
    return [];
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Cargando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-200 flex flex-col">
      <header className="bg-gray-800 text-white p-4">
        <h1 className="text-lg font-bold">Gestión de Órdenes de Mesas</h1>
      </header>
      <main className="p-4 flex-grow w-full max-w-4xl mx-auto">
        <div className="flex border-b border-gray-300 mb-4">
          <button
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'create' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-600'}`}
            onClick={() => setActiveTab('create')}
          >
            Crear Orden
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium ${activeTab === 'view' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-600'}`}
            onClick={() => setActiveTab('view')}
          >
            Ver Órdenes
          </button>
        </div>
        {activeTab === 'create' ? (
          isOrderingDisabled || menuType === 'closed' ? (
            <div className="flex flex-col items-center justify-center text-center bg-red-50 text-red-700 p-4 rounded-lg shadow-md">
              <h2 className="text-xl font-bold">🚫 Restaurante cerrado</h2>
              <p className="text-sm">Los pedidos estarán disponibles nuevamente mañana.</p>
            </div>
          ) : menuType === 'breakfast' ? (
            <>
              <p className="text-center text-gray-700 mb-4 text-sm bg-white p-3 rounded-lg shadow-sm">
                Toma pedidos rápido. Desayuno disponible hasta {timeRemaining}
              </p>
              <BreakfastList
                breakfasts={breakfasts}
                setBreakfasts={setBreakfasts}
                eggs={breakfastEggs}
                broths={breakfastBroths}
                riceBread={breakfastRiceBread}
                drinks={breakfastDrinks}
                additions={breakfastAdditions}
                breakfastTypes={breakfastTypes}
                breakfastProteins={breakfastProteins}
                times={breakfastTimes}
                paymentMethods={paymentMethods}
                onBreakfastChange={(id, field, value) => handleBreakfastChange(setBreakfasts, id, field, value)}
                onRemoveBreakfast={(id) => removeBreakfast(setBreakfasts, setSuccessMessage, id, breakfasts)}
                onAddBreakfast={() => addBreakfast(setBreakfasts, setSuccessMessage, breakfasts, initializeBreakfastData({ isWaitress: true }))}
                onDuplicateBreakfast={(breakfast) => duplicateBreakfast(setBreakfasts, setSuccessMessage, breakfast, breakfasts)}
                incompleteBreakfastIndex={incompleteBreakfastIndex}
                incompleteSlideIndex={incompleteBreakfastSlideIndex}
                isOrderingDisabled={isOrderingDisabled}
                userRole={role}
                savedAddress={{}}
                isTableOrder={true}
              />
              <BreakfastOrderSummary
                items={breakfasts}
                onSendOrder={handleSendBreakfastOrder}
                user={{ role: 3 }}
                breakfastTypes={breakfastTypes}
              />
            </>
          ) : (
            <>
              <p className="text-center text-gray-700 mb-4 text-sm bg-white p-3 rounded-lg shadow-sm">
                Toma pedidos rápido. Almuerzo disponible hasta {timeRemaining}
              </p>
              <MealList
                meals={meals}
                soups={soups}
                soupReplacements={soupReplacements}
                principles={principles}
                proteins={proteins}
                drinks={drinks}
                sides={sides}
                additions={additions}
                paymentMethods={paymentMethods}
                times={[]}
                isTableOrder={true}
                userRole={role}
                onMealChange={(id, field, value) => handleMealChange(setMeals, id, field, value)}
                onRemoveMeal={(id) => removeMeal(setMeals, setSuccessMessage, id, meals)}
                onAddMeal={() => addMeal(setMeals, setSuccessMessage, meals, initializeMealData({}, true))}
                onDuplicateMeal={(meal) => duplicateMeal(setMeals, setSuccessMessage, meal, meals)}
                incompleteMealIndex={incompleteMealIndex}
                incompleteSlideIndex={incompleteSlideIndex}
                isOrderingDisabled={isOrderingDisabled}
              />
              <OrderSummary
                meals={meals}
                onSendOrder={handleSendOrder}
                calculateTotal={() => calculateTotal(meals, 3)}
                isTableOrder={true}
                isWaiterView={false}
                userRole={3}
              />
            </>
          )
        ) : (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <p className="text-center text-gray-700">No has registrado órdenes de mesas.</p>
            ) : (
              orders.map(order => (
                <div key={order.id} className={`p-4 rounded-lg shadow-md ${statusColors[order.status] || 'bg-white'}`}>
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-semibold text-gray-800">
                      {order.type === 'breakfast' ? 'Desayuno' : 'Almuerzo'} - Mesa {formatValue(order.meals?.[0]?.tableNumber || order.breakfasts?.[0]?.tableNumber)} - #{order.id.slice(-4)}
                    </h2>
                    <div className="relative">
                      <button
                        onClick={() => setShowMenu(showMenu === order.id ? null : order.id)}
                        className="text-gray-600 hover:text-gray-800 focus:outline-none"
                      >
                        ⋮
                      </button>
                      {showMenu === order.id && (
                        <div className="absolute right-0 mt-2 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                          <button
                            onClick={() => handleStatusChange(order.id, 'Pendiente', order.type)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:bg-gray-200"
                            disabled={order.status === 'Pendiente'}
                          >
                            Pendiente
                          </button>
                          <button
                            onClick={() => handleStatusChange(order.id, 'Preparando', order.type)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:bg-gray-200"
                            disabled={order.status === 'Preparando'}
                          >
                            Preparando
                          </button>
                          <button
                            onClick={() => handleStatusChange(order.id, 'Completada', order.type)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:bg-gray-200"
                            disabled={order.status === 'Completada'}
                          >
                            Completada
                          </button>
                          <button
                            onClick={() => handleStatusChange(order.id, 'Cancelada', order.type)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:bg-gray-200"
                            disabled={order.status === 'Cancelada'}
                          >
                            Cancelada
                          </button>
                          <button
                            onClick={() => handleEditOrder(order)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            Editar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {order.type === 'breakfast' ? (
                    <BreakfastOrderSummary
                      items={order.breakfasts}
                      user={{ role: 3 }}
                      breakfastTypes={breakfastTypes}
                      statusClass={statusColors[order.status] || ''} // Añadir clase de estado
                    />
                  ) : (
                    <OrderSummary
                      meals={order.meals}
                      isTableOrder={true}
                      calculateTotal={() => order.total}
                      isWaiterView={true}
                      statusClass={statusColors[order.status] || ''}
                      userRole={3}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        )}
        {editingOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-4 rounded-lg shadow-lg max-w-md w-full mx-4 overflow-y-auto" style={{ maxHeight: '80vh' }}>
              <h2 className="text-lg font-bold mb-4">Editar Orden #{editingOrder.id.slice(-4)}</h2>
              {editingOrder.type === 'lunch' ? (
                editingOrder.meals.map((meal, index) => (
                  <div key={index} className="mb-4">
                    <h3 className="text-sm font-medium mb-2">Almuerzo #{index + 1}</h3>
                    <div className="grid grid-cols-1 gap-2">
                      <div>
                        <label className="text-xs block mb-1 font-medium">Sopa o Reemplazo</label>
                        <OptionSelector
                          title="Sopa"
                          emoji="🥣"
                          options={soups}
                          selected={meal.soup || meal.soupReplacement}
                          showReplacements={meal.showReplacementsState?.soup || false}
                          replacements={soupReplacements.filter(opt => opt.name !== 'Remplazo por Sopa' && opt.name !== 'Solo bandeja')}
                          selectedReplacement={meal.soupReplacement?.replacement ? { name: meal.soupReplacement.replacement } : null}
                          multiple={false}
                          onImmediateSelect={(value) => {
                            console.log(`[WaiterDashboard] Sopa selected for meal ${index + 1}:`, value);
                            handleFormChange(index, value?.name === 'Remplazo por Sopa' ? 'soupReplacement' : 'soup', value);
                          }}
                          onImmediateReplacementSelect={(replacement) => {
                            console.log(`[WaiterDashboard] Sopa replacement selected for meal ${index + 1}:`, replacement);
                            const newMeals = [...editingOrder.meals];
                            newMeals[index] = {
                              ...newMeals[index],
                              soupReplacement: {
                                ...newMeals[index].soupReplacement,
                                name: 'Remplazo por Sopa',
                                replacement: replacement?.name || ''
                              }
                            };
                            setEditingOrder(prev => ({ ...prev, meals: newMeals }));
                          }}
                        />
                      </div>
                      <div>
                        <label className="text-xs block mb-1 font-medium">Principio o Reemplazo</label>
                        <OptionSelector
                          title="Principio"
                          emoji="🍚"
                          options={principles}
                          selected={meal.principle || meal.principleReplacement}
                          showReplacements={meal.showReplacementsState?.principle || false}
                          replacements={soupReplacements.filter(opt => opt.name !== 'Remplazo por Sopa' && opt.name !== 'Solo bandeja')}
                          selectedReplacement={
                            meal.principle?.find(opt => opt.name === 'Remplazo por Principio')?.replacement
                              ? { name: meal.principle.find(opt => opt.name === 'Remplazo por Principio').replacement }
                              : null
                          }
                          multiple={true}
                          showConfirmButton={true}
                          onImmediateSelect={(value) => {
                            console.log(`[WaiterDashboard] Principio selected for meal ${index + 1}:`, value);
                            handleFormChange(index, 'principle', value);
                          }}
                          onImmediateReplacementSelect={(replacement) => {
                            console.log(`[WaiterDashboard] Principio replacement selected for meal ${index + 1}:`, replacement);
                            const newMeals = [...editingOrder.meals];
                            newMeals[index] = {
                              ...newMeals[index],
                              principle: newMeals[index].principle?.map(opt => ({
                                ...opt,
                                replacement: opt.name === 'Remplazo por Principio' ? replacement?.name || '' : opt.replacement
                              }))
                            };
                            setEditingOrder(prev => ({ ...prev, meals: newMeals }));
                          }}
                          onConfirm={({ selection }) => handleFormChange(index, 'principle', selection)}
                        />
                      </div>
                      <div>
                        <label className="text-xs block mb-1 font-medium">Proteína</label>
                        <OptionSelector
                          title="Proteína"
                          emoji="🍖"
                          options={proteins}
                          selected={meal.protein}
                          multiple={false}
                          onImmediateSelect={(value) => handleFormChange(index, 'protein', value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs block mb-1 font-medium">Bebida</label>
                        <OptionSelector
                          title="Bebida"
                          emoji="🥤"
                          options={drinks}
                          selected={meal.drink}
                          multiple={false}
                          onImmediateSelect={(value) => handleFormChange(index, 'drink', value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs block mb-1 font-medium">Acompañamientos</label>
                        <OptionSelector
                          title="Acompañamiento"
                          emoji="🥗"
                          options={sides}
                          selected={meal.sides}
                          multiple={true}
                          onImmediateSelect={(value) => handleFormChange(index, 'sides', value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs block mb-1 font-medium">Método de Pago</label>
                        <OptionSelector
                          title="Método de Pago"
                          emoji="💳"
                          options={paymentMethods}
                          selected={meal.paymentMethod}
                          multiple={false}
                          onImmediateSelect={(value) => handleFormChange(index, 'paymentMethod', value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs block mb-1 font-medium">Número de Mesa</label>
                        <input
                          type="text"
                          value={meal.tableNumber || ''}
                          onChange={(e) => handleFormChange(index, 'tableNumber', e.target.value)}
                          placeholder="Número de mesa"
                          className="w-full p-2 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs block mb-1 font-medium">Tipo de Pedido</label>
                        <select
                          value={meal.orderType || ''}
                          onChange={(e) => handleFormChange(index, 'orderType', e.target.value)}
                          className="w-full p-2 border rounded text-sm"
                        >
                          <option value="">Seleccionar</option>
                          <option value="table">Para mesa</option>
                          <option value="takeaway">Para llevar</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs block mb-1 font-medium">Notas</label>
                        <textarea
                          value={meal.notes || ''}
                          onChange={(e) => handleFormChange(index, 'notes', e.target.value)}
                          placeholder="Notas"
                          className="w-full p-2 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-gray-700 mb-1">➕ Adiciones para Almuerzo #{index + 1} (opcional)</h4>
                        <OptionSelector
                          title="Adiciones (por almuerzo)"
                          emoji="➕"
                          options={normalizedAdditions}
                          selected={meal?.additions || []}
                          multiple={true}
                          showReplacements={meal?.additions?.some(
                            add => add.requiresReplacement && (
                              (add.name === 'Proteína adicional' && !add.protein) ||
                              (['Sopa adicional', 'Principio adicional', 'Bebida adicional'].includes(add.name) && !add.replacement)
                            )
                          )}
                          replacements={getReplacementsForAdditions(meal)}
                          onImmediateSelect={(selection) => {
                            console.log(`[WaiterDashboard] Additions selected for meal ${index + 1}:`, selection);
                            handleFormChange(index, 'additions', selection.map(add => ({
                              ...add,
                              quantity: add.quantity || 1,
                              price: add.price || 0,
                              protein: add.name === 'Proteína adicional' ? (add.protein || '') : add.protein || '',
                              replacement: ['Sopa adicional', 'Principio adicional', 'Bebida adicional'].includes(add.name) ? (add.replacement || '') : add.replacement || '',
                            })));
                          }}
                          onImmediateReplacementSelect={({ id: additionId, replacement }) => {
                            console.log(`[WaiterDashboard] Replacement selected for meal ${index + 1}, addition ${additionId}:`, replacement);
                            const updatedAdditions = (meal?.additions || []).map((add) => {
                              if (add.id === additionId) {
                                return {
                                  ...add,
                                  protein: add.name === 'Proteína adicional' ? replacement?.name || add.protein : add.protein,
                                  replacement: ['Sopa adicional', 'Principio adicional', 'Bebida adicional'].includes(add.name)
                                    ? replacement?.name || add.replacement
                                    : add.replacement,
                                };
                              }
                              return add;
                            });
                            handleFormChange(index, 'additions', updatedAdditions);
                          }}
                          onAdd={(addition) => {
                            console.log(`[WaiterDashboard] Adding addition for meal ${index + 1}:`, addition);
                            const existingAddition = meal?.additions?.find(a => a.id === addition.id);
                            const updatedAdditions = existingAddition
                              ? meal.additions.map(a => a.id === addition.id ? { ...a, quantity: (a.quantity || 1) + 1 } : a)
                              : [...(meal.additions || []), { ...addition, quantity: 1, price: addition.price || 0 }];
                            handleFormChange(index, 'additions', updatedAdditions);
                          }}
                          onRemove={(additionId) => {
                            console.log(`[WaiterDashboard] Removing addition ${additionId} for meal ${index + 1}`);
                            const updatedAdditions = meal.additions
                              .map(add => add.id === additionId ? { ...add, quantity: (add.quantity || 1) - 1 } : add)
                              .filter(add => add.quantity > 0);
                            handleFormChange(index, 'additions', updatedAdditions);
                          }}
                          onIncrease={(additionId) => {
                            console.log(`[WaiterDashboard] Increasing addition ${additionId} for meal ${index + 1}`);
                            const updatedAdditions = meal.additions.map(add =>
                              add.id === additionId ? { ...add, quantity: (add.quantity || 1) + 1 } : add
                            );
                            handleFormChange(index, 'additions', updatedAdditions);
                          }}
                        />
                        {meal?.additions?.length > 0 && (
                          <div className="mt-2 text-sm font-semibold text-gray-700">
                            Total Adiciones de este almuerzo: $
                            {meal.additions.reduce((sum, item) => sum + (item?.price || 0) * (item?.quantity || 1), 0).toLocaleString('es-CO')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                editingOrder.breakfasts.map((breakfast, index) => (
                  <div key={index} className="mb-4">
                    <h3 className="text-sm font-medium mb-2">Desayuno #{index + 1}</h3>
                    <div className="grid grid-cols-1 gap-2">
                      <div>
                        <label className="text-xs block mb-1 font-medium">Tipo de Desayuno</label>
                        <OptionSelector
                          title="Tipo"
                          emoji="🥞"
                          options={breakfastTypes}
                          selected={breakfast.type}
                          multiple={false}
                          onImmediateSelect={(value) => handleFormChange(index, 'type', value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs block mb-1 font-medium">Caldo</label>
                        <OptionSelector
                          title="Caldo"
                          emoji="🥣"
                          options={breakfastBroths}
                          selected={breakfast.broth}
                          multiple={false}
                          onImmediateSelect={(value) => handleFormChange(index, 'broth', value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs block mb-1 font-medium">Huevos</label>
                        <OptionSelector
                          title="Huevos"
                          emoji="🥚"
                          options={breakfastEggs}
                          selected={breakfast.eggs}
                          multiple={false}
                          onImmediateSelect={(value) => handleFormChange(index, 'eggs', value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs block mb-1 font-medium">Arroz/Pan</label>
                        <OptionSelector
                          title="Arroz/Pan"
                          emoji="🍞"
                          options={breakfastRiceBread}
                          selected={breakfast.riceBread}
                          multiple={false}
                          onImmediateSelect={(value) => handleFormChange(index, 'riceBread', value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs block mb-1 font-medium">Bebida</label>
                        <OptionSelector
                          title="Bebida"
                          emoji="🥤"
                          options={breakfastDrinks}
                          selected={breakfast.drink}
                          multiple={false}
                          onImmediateSelect={(value) => handleFormChange(index, 'drink', value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs block mb-1 font-medium">Proteína</label>
                        <OptionSelector
                          title="Proteína"
                          emoji="🍖"
                          options={breakfastProteins}
                          selected={breakfast.protein}
                          multiple={false}
                          onImmediateSelect={(value) => handleFormChange(index, 'protein', value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs block mb-1 font-medium">Método de Pago</label>
                        <OptionSelector
                          title="Método de Pago"
                          emoji="💳"
                          options={paymentMethods}
                          selected={breakfast.paymentMethod}
                          multiple={false}
                          onImmediateSelect={(value) => handleFormChange(index, 'paymentMethod', value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs block mb-1 font-medium">Número de Mesa</label>
                        <input
                          type="text"
                          value={breakfast.tableNumber || ''}
                          onChange={(e) => handleFormChange(index, 'tableNumber', e.target.value)}
                          placeholder="Número de mesa"
                          className="w-full p-2 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs block mb-1 font-medium">Tipo de Pedido</label>
                        <select
                          value={breakfast.orderType || ''}
                          onChange={(e) => handleFormChange(index, 'orderType', e.target.value)}
                          className="w-full p-2 border rounded text-sm"
                        >
                          <option value="">Seleccionar</option>
                          <option value="table">Para mesa</option>
                          <option value="takeaway">Para llevar</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs block mb-1 font-medium">Notas</label>
                        <textarea
                          value={breakfast.notes || ''}
                          onChange={(e) => handleFormChange(index, 'notes', e.target.value)}
                          placeholder="Notas"
                          className="w-full p-2 border rounded text-sm"
                        />
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-gray-700 mb-1">➕ Adiciones para Desayuno #{index + 1} (opcional)</h4>
                        <OptionSelector
                          title="Adiciones (por desayuno)"
                          emoji="➕"
                          options={breakfastAdditions}
                          selected={breakfast?.additions || []}
                          multiple={true}
                          onImmediateSelect={(selection) => {
                            console.log(`[WaiterDashboard] Additions selected for breakfast ${index + 1}:`, selection);
                            handleFormChange(index, 'additions', selection.map(add => ({
                              name: add.name,
                              quantity: add.quantity || 1,
                            })));
                          }}
                          onAdd={(addition) => {
                            console.log(`[WaiterDashboard] Adding addition for breakfast ${index + 1}:`, addition);
                            const existingAddition = breakfast?.additions?.find(a => a.name === addition.name);
                            const updatedAdditions = existingAddition
                              ? breakfast.additions.map(a => a.name === addition.name ? { ...a, quantity: (a.quantity || 1) + 1 } : a)
                              : [...(breakfast.additions || []), { name: addition.name, quantity: 1 }];
                            handleFormChange(index, 'additions', updatedAdditions);
                          }}
                          onRemove={(additionName) => {
                            console.log(`[WaiterDashboard] Removing addition ${additionName} for breakfast ${index + 1}`);
                            const updatedAdditions = breakfast.additions
                              .map(add => add.name === additionName ? { ...add, quantity: (add.quantity || 1) - 1 } : add)
                              .filter(add => add.quantity > 0);
                            handleFormChange(index, 'additions', updatedAdditions);
                          }}
                          onIncrease={(additionName) => {
                            console.log(`[WaiterDashboard] Increasing addition ${additionName} for breakfast ${index + 1}`);
                            const updatedAdditions = breakfast.additions.map(add =>
                              add.name === additionName ? { ...add, quantity: (add.quantity || 1) + 1 } : add
                            );
                            handleFormChange(index, 'additions', updatedAdditions);
                          }}
                        />
                        {breakfast?.additions?.length > 0 && (
                          <div className="mt-2 text-sm font-semibold text-gray-700">
                            Total Adiciones de este desayuno: $
                            {breakfast.additions.reduce((sum, item) => {
                              const addition = breakfastAdditions.find(a => a.name === item.name);
                              return sum + (addition?.price || 0) * (item?.quantity || 1);
                            }, 0).toLocaleString('es-CO')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div>
                <label className="text-xs block mb-1 font-medium">Total (editable)</label>
                <input
                  type="number"
                  value={editingOrder.total !== undefined ? editingOrder.total : (editingOrder.type === 'lunch' ? calculateTotal(editingOrder.meals, 3) : calculateTotalBreakfastPrice(editingOrder.breakfasts, 3, breakfastTypes))}
                  onChange={(e) => handleFormChange(-1, 'total', e.target.value)}
                  placeholder="Total"
                  className="w-full p-2 border rounded text-sm"
                />
              </div>
              <div className="flex justify-end space-x-2 mt-4 sticky bottom-4 bg-white py-2">
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                >
                  Guardar
                </button>
                <button
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <div className="fixed top-16 right-4 z-[10002] space-y-2 w-80 max-w-xs">
        {isLoading && <LoadingIndicator />}
        {errorMessage && (
          <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />
        )}
        {successMessage && (
          <SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />
        )}
      </div>
    </div>
  );
};

export default WaiterDashboard;
