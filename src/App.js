//src/App.js
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { db, auth } from './config/firebase';
import { collection, onSnapshot, doc, addDoc, setDoc, getDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import useLocalStorage from './hooks/useLocalStorage';
import Header from './components/Header';
import MealList from './components/MealList';
import BreakfastList from './components/BreakfastList';
import OrderSummary from './components/OrderSummary';
import BreakfastOrderSummary from './components/BreakfastOrderSummary';
import LoadingIndicator from './components/LoadingIndicator';
import ErrorMessage from './components/ErrorMessage';
import SuccessMessage from './components/SuccessMessage';
import { Route, Routes } from 'react-router-dom';
import { useAuth } from './components/Auth/AuthProvider';
import { initializeMealData, handleMealChange, addMeal, duplicateMeal, removeMeal, sendToWhatsApp, paymentSummary as paymentSummaryByMode } from './utils/MealLogic';
import { calculateTotal, calculateMealPrice } from './utils/MealCalculations';
import Footer from './components/Footer';
import Modal from './components/Modal';
import PrivacyPolicy from './components/PrivacyPolicy';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import './styles/animations.css';
import { calculateTotalBreakfastPrice } from './utils/BreakfastLogic';

const StaffHub = lazy(() => import('./components/Auth/StaffHub')); 
const AdminPage = lazy(() => import('./components/Admin/AdminPage'));
const Login = lazy(() => import('./components/Auth/Login'));
const ForgotPassword = lazy(() => import('./components/Auth/ForgotPassword'));
const WaiterOrderPage = lazy(() => import('./components/Waiter/WaiterDashboard'));

const App = () => {
  const { user, loading } = useAuth();
  const [meals, setMeals] = useState([]);
  const [breakfasts, setBreakfasts] = useState([]);
  const [address, setAddress] = useLocalStorage('userAddress', '');
  const [phoneNumber, setPhoneNumber] = useLocalStorage('userPhoneNumber', '');
  const [addressType, setAddressType] = useLocalStorage('userAddressType', 'house');
  const [recipientName, setRecipientName] = useLocalStorage('userRecipientName', '');
  const [unitDetails, setUnitDetails] = useLocalStorage('userUnitDetails', '');
  const [localName, setLocalName] = useLocalStorage('userLocalName', '');
  const [details, setDetails] = useLocalStorage('userAddressDetails', '');
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
  const [times, setTimes] = useState([]);
  const [breakfastTimes, setBreakfastTimes] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [additions, setAdditions] = useState([]);
  const [breakfastEggs, setBreakfastEggs] = useState([]);
  const [breakfastBroths, setBreakfastBroths] = useState([]);
  const [breakfastRiceBread, setBreakfastRiceBread] = useState([]);
  const [breakfastDrinks, setBreakfastDrinks] = useState([]);
  const [breakfastAdditions, setBreakfastAdditions] = useState([]);
  const [breakfastTypes, setBreakfastTypes] = useState([]);
  const [breakfastProteins, setBreakfastProteins] = useState([]);
  const [isOrderingDisabled, setIsOrderingDisabled] = useState(false);
  const [showCookieBanner, setShowCookieBanner] = useLocalStorage('cookieConsent', true);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [currentMenuType, setCurrentMenuType] = useState('closed');
  const [countdown, setCountdown] = useState('');
  const [schedules, setSchedules] = useState({
    breakfastStart: 420,
    breakfastEnd: 631,
    lunchStart: 632,
    lunchEnd: 950,
  });

  const savedAddress = { address, phoneNumber, addressType, recipientName, unitDetails, localName, details };

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const period = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    return `${formattedHours}:${mins.toString().padStart(2, '0')} ${period}`;
  };

  const formatCountdown = (minutesLeft, menuType) => {
    if (minutesLeft < 1) return `El menú de ${menuType} termina en menos de un minuto`;
    const hours = Math.floor(minutesLeft / 60);
    const minutes = minutesLeft % 60;
    if (hours > 0 && minutes === 0) return `El menú de ${menuType} termina en ${hours}h`;
    if (hours === 0) return `El menú de ${menuType} termina en ${minutes}m`;
    return `El menú de ${menuType} termina en ${hours}h ${minutes}m`;
  };

  const getCurrentMenuType = () => {
    if (isOrderingDisabled) {
      setCountdown('El restaurante está cerrado manualmente.');
      return 'closed';
    }
    const now = new Date();
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    if (totalMinutes >= schedules.breakfastStart && totalMinutes <= schedules.breakfastEnd) {
      const minutesLeft = schedules.breakfastEnd - totalMinutes;
      setCountdown(formatCountdown(minutesLeft, 'desayuno'));
      return 'breakfast';
    }
    if (totalMinutes >= schedules.lunchStart && totalMinutes <= schedules.lunchEnd) {
      const minutesLeft = schedules.lunchEnd - totalMinutes;
      setCountdown(formatCountdown(minutesLeft, 'almuerzo'));
      return 'lunch';
    }
    setCountdown('El restaurante está cerrado. Consulta los horarios de atención.');
    return 'closed';
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'schedules'), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        setSchedules({
          breakfastStart: data.breakfastStart || 420,
          breakfastEnd: data.breakfastEnd || 631,
          lunchStart: data.lunchStart || 632,
          lunchEnd: data.lunchEnd || 950,
        });
      }
    }, (error) => {
      if (process.env.NODE_ENV === 'development') console.error('Error al cargar horarios:', error);
      setErrorMessage('Error al cargar horarios. Usando horarios predeterminados.');
    });

    const updateMenuType = () => {
      const newMenuType = getCurrentMenuType();
      setCurrentMenuType((prevMenuType) => {
        if (prevMenuType !== newMenuType) {
          if (newMenuType === 'breakfast') {
            setMeals([]);
            if (breakfasts.length === 0) setBreakfasts([initialBreakfast]);
          } else if (newMenuType === 'lunch') {
            setBreakfasts([]);
            if (meals.length === 0) setMeals([initialMeal]);
          } else {
            setMeals([]);
            setBreakfasts([]);
          }
          setErrorMessage(null);
          setSuccessMessage(null);
          setIncompleteMealIndex(null);
          setIncompleteSlideIndex(null);
          setIncompleteBreakfastIndex(null);
          setIncompleteBreakfastSlideIndex(null);
        }
        return newMenuType;
      });
    };
// ...
updateMenuType();
// 15s es suficiente y evita el warning del ResizeObserver
const interval = setInterval(updateMenuType, 15000);
return () => {
  clearInterval(interval);
  unsubscribe();
};
// ...

  }, [isOrderingDisabled, schedules.breakfastStart, schedules.breakfastEnd, schedules.lunchStart, schedules.lunchEnd, meals.length, breakfasts.length]);

  const handleAcceptCookies = () => setShowCookieBanner(false);

  useEffect(() => {
    if (showCookieBanner) {
      const timer = setTimeout(() => setShowCookieBanner(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [showCookieBanner]);

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

  useEffect(() => {
  const handler = (e) => {
    const a = e.detail || {};
    setAddress(a.address || '');
    setPhoneNumber(a.phoneNumber || '');
    setAddressType(a.addressType || 'house');
    setRecipientName(a.recipientName || '');
    setUnitDetails(a.unitDetails || '');
    setLocalName(a.localName || '');
  };
  window.addEventListener('userAddressUpdated', handler);
  return () => window.removeEventListener('userAddressUpdated', handler);
}, []);


  useEffect(() => {
    const collections = [
      'soups', 'soupReplacements', 'principles', 'proteins', 'drinks', 'sides', 'times', 'paymentMethods', 'additions',
      'breakfastEggs', 'breakfastBroths', 'breakfastRiceBread', 'breakfastDrinks', 'breakfastAdditions', 'breakfastTypes',
      'breakfastTimes', 'breakfastProteins'
    ];
    const setters = [
      setSoups, setSoupReplacements, setPrinciples, setProteins, setDrinks, setSides, setTimes, setPaymentMethods, setAdditions,
      setBreakfastEggs, setBreakfastBroths, setBreakfastRiceBread, setBreakfastDrinks, setBreakfastAdditions, setBreakfastTypes,
      setBreakfastTimes, setBreakfastProteins
    ];

    const unsubscribers = collections.map((col, index) =>
      onSnapshot(collection(db, col), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setters[index](data);
        if (process.env.NODE_ENV === 'development') console.log(`Actualizada ${col}:`, data);
        if (data.length === 0) {
          setErrorMessage(process.env.NODE_ENV !== 'production'
            ? `La colección ${col} está vacía. Agrega datos desde /admin.`
            : 'Algunas opciones no están disponibles. Intenta de nuevo más tarde.');
        }
        window.dispatchEvent(new Event('optionsUpdated'));
      }, (error) => {
        if (process.env.NODE_ENV === 'development') console.error(`Error al escuchar ${col}:`, error);
        setErrorMessage(process.env.NODE_ENV === 'production'
          ? 'No se pudieron cargar las opciones. Intenta de nuevo más tarde.'
          : `Error al cargar datos de ${col}. Revisa la consola para más detalles.`);
      })
    );

    const settingsUnsubscribe = onSnapshot(doc(db, 'settings', 'global'), (docSnapshot) => {
      setIsOrderingDisabled(docSnapshot.exists() ? docSnapshot.data().isOrderingDisabled || false : false);
    }, (error) => {
      if (process.env.NODE_ENV === 'development') console.error('Error al escuchar settings/global:', error);
      setErrorMessage('Error al cargar configuración. Intenta de nuevo más tarde.');
    });

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
      settingsUnsubscribe();
    };
  }, []);

  const registerClientAndSaveOrder = async (orders, isTableOrder = false, isBreakfast = false) => {
    try {
      setIsLoading(true);
      let currentUser = user;

      if (!currentUser) {
        const userCredential = await signInAnonymously(auth);
        currentUser = userCredential.user;
        if (process.env.NODE_ENV === 'development') console.log('Usuario anónimo creado:', currentUser.uid);
      }

      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);
      const currentRole = userDoc.exists() ? userDoc.data().role || 1 : 1;

      const clientData = {
        email: currentUser.email || `anon_${currentUser.uid}@example.com`,
        role: currentRole,
        lastOrder: new Date(),
        totalOrders: userDoc.exists() ? (userDoc.data().totalOrders || 0) + 1 : 1,
        ...(userDoc.exists() ? {} : { createdAt: new Date() }),
      };

      await setDoc(userRef, clientData, { merge: true });

      const collectionName = isTableOrder
        ? (isBreakfast ? 'breakfastOrders' : 'tableOrders')
        : (isBreakfast ? 'deliveryBreakfastOrders' : 'orders');

      if (process.env.NODE_ENV === 'development') console.log('Guardando pedido en colección:', collectionName);

const total = isBreakfast
  ? calculateTotalBreakfastPrice(orders, breakfastTypes)
  : calculateTotal(orders);

// 👉 calcular paymentSummary correctamente para DESAYUNO
let orderPayments;
if (isBreakfast) {
  const acc = { Efectivo: 0, Daviplata: 0, Nequi: 0 };
  orders.forEach((item) => {
    const method = (item?.payment?.name || 'Efectivo').trim().toLowerCase();
    // precio por desayuno usando la misma lógica pero por ítem
    const price = calculateTotalBreakfastPrice([item], breakfastTypes) || 0;
    if (method === 'daviplata') acc.Daviplata += price;
    else if (method === 'nequi') acc.Nequi += price;
    else acc.Efectivo += price;
  });
  orderPayments = acc;
} else {
  orderPayments = paymentSummaryByMode(orders, isTableOrder);
}

// Validación robusta: cualquier método de pago con monto > 0
const _sumPayments = Object.values(orderPayments).reduce((a, b) => a + (b || 0), 0);
if (!isTableOrder && _sumPayments <= 0) {
  throw new Error('No se especificó un método de pago válido.');
}

const order = {
  userId: currentUser.uid,
  userEmail: clientData.email,
  [isBreakfast ? 'breakfasts' : 'meals']: orders.map(item => ({
    ...(isBreakfast ? {
      type: item.type || '',
      broth: item.broth ? { name: item.broth.name } : null,
      eggs: item.eggs ? { name: item.eggs.name } : null,
      riceBread: item.riceBread ? { name: item.riceBread.name } : null,
      drink: item.drink ? { name: item.drink.name } : null,
      protein: item.protein ? { name: item.protein.name } : null,
      additions: item.additions?.map(addition => ({
        name: addition.name,
        quantity: addition.quantity || 1,
      })) || [],
      cutlery: item.cutlery || false,
      address: {
        address: item.address?.address || '',
        phoneNumber: item.address?.phoneNumber || '',
        addressType: item.address?.addressType || '',
        recipientName: item.address?.recipientName || '',
        unitDetails: item.address?.unitDetails || '',
        localName: item.address?.localName || '',
        details: item.address?.details || '',
      },
      payment: { name: item.payment?.name || 'Efectivo' },
      notes: item.notes || '',
      time: item.time ? { name: item.time.name } : null,
    } : {
      soup: item.soup ? { name: item.soup.name } : null,
      soupReplacement: item.soupReplacement ? { name: item.soupReplacement.name } : null,
      principle: Array.isArray(item.principle) ? item.principle.map(p => ({ name: p.name })) : [],
      protein: item.protein ? { name: item.protein.name } : null,
      drink: item.drink ? { name: item.drink.name } : null,
      sides: Array.isArray(item.sides) ? item.sides.map(s => ({ name: s.name })) : [],
      additions: item.additions?.map(addition => ({
        name: addition.name,
        protein: addition.protein || '',
        replacement: addition.replacement || '',
        quantity: addition.quantity || 1,
      })) || [],
      ...(isTableOrder ? { tableNumber: item.tableNumber || '' } : {
        address: {
          address: item.address?.address || '',
          phoneNumber: item.address?.phoneNumber || '',
          addressType: item.address?.addressType || '',
          recipientName: item.address?.recipientName || '',
          unitDetails: item.address?.unitDetails || '',
          localName: item.address?.localName || '',
          details: item.address?.details || '',
        },
        payment: { name: item.payment?.name || 'Efectivo' },
        time: item.time?.name || '',
        cutlery: item.cutlery || false,
      }),
      notes: item.notes || '',
    }),
  })),
  total,
  paymentSummary: orderPayments,
  payment: orders[0]?.payment?.name || orders[0]?.paymentMethod?.name || 'Efectivo',
  status: 'Pendiente',
  createdAt: new Date(),
  updatedAt: new Date(),
  // 👉 clave para que en admin se filtren y sumen bien
  type: isBreakfast ? 'breakfast' : (isTableOrder ? 'table' : 'lunch'),
};


      await addDoc(collection(db, collectionName), order);
      if (process.env.NODE_ENV === 'development') console.log('Pedido guardado exitosamente en:', collectionName);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('Error al registrar cliente o guardar pedido:', error);
      setErrorMessage('Error al procesar el pedido. Intenta de nuevo.');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const initialMeal = initializeMealData(savedAddress);

  const initialBreakfast = {
    id: Date.now(),
    type: null,
    eggs: null,
    broth: null,
    riceBread: null,
    drink: null,
    protein: null,
    cutlery: null,
    address: savedAddress,
    payment: null,
    additions: [],
    notes: '',
    time: null,
  };

  const handleBreakfastChange = (id, field, value) => {
    setBreakfasts(prev => prev.map(b => (b.id === id ? { ...b, [field]: value } : b)));
  };

  const sendBreakfastToWhatsApp = async () => {

    if (currentMenuType !== 'breakfast') {
      setErrorMessage('El menú de desayuno no está disponible en este momento.');
      return;
    }

    let incompleteIndex = null;
    let incompleteSlide = null;
    let firstMissingField = '';

    breakfasts.forEach((breakfast, index) => {
      const breakfastType = breakfastTypes.find(bt => bt.name === breakfast.type);
      const steps = breakfastType ? breakfastType.steps || [] : [];

      const missing = [];
      if (!breakfast.type) missing.push('type');
      steps.forEach(step => {
        if (step === 'address') {
          if (!breakfast.address?.address) missing.push('address');
        } else if (step === 'cutlery') {
          if (breakfast.cutlery === null) missing.push('cutlery');
        } else if (step === 'time') {
          if (!breakfast.time) missing.push('time');
        } else if (step === 'protein' && !breakfast.protein) {
          missing.push('protein');
        } else if (!breakfast[step]) {
          missing.push(step);
        }
      });
      if (!breakfast.payment) missing.push('payment');

      if (missing.length > 0 && incompleteIndex === null) {
        incompleteIndex = index;
        firstMissingField = missing[0];
        const slideMap = {
          type: 0,
          broth: 1,
          eggs: 2,
          riceBread: 3,
          drink: 4,
          cutlery: 5,
          time: 6,
          address: 7,
          payment: 8,
          protein: 9,
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
      let message = '¡Hola! Quiero ordenar desayuno:\n\n';

      breakfasts.forEach((b, index) => {
        message += `*Desayuno ${index + 1}: ${b.type}*\n`;
        if (b.broth) message += `- Caldo: ${b.broth.name}\n`;
        if (b.eggs) message += `- Huevos: ${b.eggs.name}\n`;
        if (b.riceBread) message += `- Arroz/Pan: ${b.riceBread.name}\n`;
        if (b.drink) message += `- Bebida: ${b.drink.name}\n`;
        if (b.protein) message += `- Proteína: ${b.protein.name}\n`;
        message += `- Cubiertos: ${b.cutlery ? 'Sí' : 'No'}\n`;
        message += `- Hora: ${b.time?.name || 'No especificada'}\n`;

        if (b.additions.length > 0) {
          message += `- Adiciones:\n`;
          b.additions.forEach((add) => {
            message += `  • ${add.name} (${add.quantity || 1})\n`;
          });
        }

        message += `\n`;
      });

      const address = breakfasts[0]?.address || savedAddress;
      message += `*Dirección de entrega:*\n`;
      message += `📍 ${address.address}\n`;
      message += `📞 ${address.phoneNumber}\n`;

      if (address.addressType === 'school') message += `👤 ${address.recipientName}\n`;
      if (address.addressType === 'complex') message += `🏢 ${address.unitDetails}\n`;
      if (address.addressType === 'shop') message += `🏬 ${address.localName}\n`;

      message += `\n*Total: $${calculateTotalBreakfastPrice(breakfasts, breakfastTypes).toLocaleString('es-CO')}*`;

      setAddress(address.address);
      setPhoneNumber(address.phoneNumber);
      setAddressType(address.addressType);
      setRecipientName(address.recipientName);
      setUnitDetails(address.unitDetails);
      setLocalName(address.localName);

      const phone = '573023931292';
      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
      await registerClientAndSaveOrder(breakfasts, false, true);
      setSuccessMessage('¡Pedido de desayuno enviado con éxito!');
      setBreakfasts([]);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('Error al enviar pedido de desayuno:', error);
      setErrorMessage('Error al enviar el pedido. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

const onSendOrder = async (isTableOrder = false) => {
  if (currentMenuType !== 'lunch' && !isTableOrder) {
    setErrorMessage('No se pueden hacer pedidos de almuerzo en este momento.');
    return;
  }

  if (!Array.isArray(meals)) {
    setErrorMessage('Error: los almuerzos no están correctamente definidos. Recarga e inténtalo de nuevo.');
    return;
  }


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
        'Cubiertos': 4,
        'Hora': 5,
        'Dirección': 6,
        'Método de pago': 7,
        'Acompañamientos': 8,
        'Nombre del local': 6,
        'Mesa': 6,
      };

      if (!meal?.soup && !meal?.soupReplacement) missing.push('Sopa o reemplazo de sopa');
      else if (!meal?.principle) missing.push('Principio');
      else if (!isCompleteRice && !meal?.protein) missing.push('Proteína');
      else if (!meal?.drink) missing.push('Bebida');
      else if (!isTableOrder && meal?.cutlery === null) missing.push('Cubiertos');
      else if (!isTableOrder && !meal?.time) missing.push('Hora');
      else if (!isTableOrder && !meal?.address?.address) missing.push('Dirección');
      else if (!isTableOrder && !meal?.payment?.name) missing.push('Método de pago');
      else if (!isCompleteRice && (!meal?.sides || meal.sides.length === 0)) missing.push('Acompañamientos');
      else if (!isTableOrder && meal?.address?.addressType === 'shop' && !meal?.address?.localName) missing.push('Nombre del local');
      else if (isTableOrder && !meal?.tableNumber) missing.push('Mesa');

      if (missing.length > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Almuerzo ${i + 1} está incompleto. Campos faltantes:`, missing);
          console.log(`Datos del almuerzo ${i + 1}:`, meal);
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
  if (!isTableOrder) {
const total = Array.isArray(meals) ? calculateTotal(meals) : 0;
await sendToWhatsApp(
  setIsLoading,
  setErrorMessage,
  () => {},                 // suprime el éxito interno, evitamos doble mensaje
  meals,
  incompleteMealIndex,
  setIncompleteMealIndex,
  incompleteSlideIndex,
  setIncompleteSlideIndex,
  calculateMealPrice,       // función por ítem
  total
);


  }
      await registerClientAndSaveOrder(meals, isTableOrder, false);
      setSuccessMessage(isTableOrder ? '¡Orden de mesa guardada con éxito!' : '¡Pedido enviado y cliente registrado con éxito!');
      setMeals([]);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('Error al procesar el pedido:', error);
      setErrorMessage('Error al procesar el pedido. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Cargando...</div>;
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Cargando aplicación...</div>}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/staffhub" element={<StaffHub />} />
        <Route path="/admin/*" element={<AdminPage />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route
          path="/waiter"
          element={<ProtectedRoute allowedRole={3}><WaiterOrderPage /></ProtectedRoute>}
        />
        <Route path="/" element={
          <div className="min-h-screen bg-gray-200 flex flex-col relative">
            <Header />
            {showCookieBanner && (
              <div className="fixed bottom-0 left-0 right-0 bg-blue-100 text-gray-800 p-4 z-[10001] rounded-t-lg shadow-lg">
                <p className="text-sm font-medium">🍪 Usamos cookies para guardar tus preferencias y hacer tu experiencia más fácil. ¡Todo seguro!</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={handleAcceptCookies} className="bg-green-500 hover:bg-green-600 text-white px-4 py-1 rounded text-sm font-semibold">¡Entendido!</button>
                  <button onClick={() => { setShowCookieBanner(false); setShowPrivacyModal(true); }} className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-1 rounded text-sm" aria-label="Ver política de privacidad">Más info</button>
                </div>
              </div>
            )}
            <Modal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)}>
              <PrivacyPolicy />
            </Modal>
            <main role="main" className="p-2 sm:p-4 flex-grow w-full max-w-4xl mx-auto">
              {isOrderingDisabled || currentMenuType === 'closed' ? (
                <div className="flex flex-col items-center justify-center text-center bg-red-50 text-red-700 p-4 sm:p-6 rounded-xl shadow-md space-y-2 mt-8 sm:mt-10">
                  <h2 className="text-xl sm:text-2xl font-bold">🚫 Restaurante cerrado</h2>
                  <p className="text-sm sm:text-base font-medium">{isOrderingDisabled ? 'Los pedidos estarán disponibles nuevamente mañana.' : 'No hay pedidos disponibles en este horario.'}</p>
                  <p className="text-sm sm:text-base text-gray-700">⏰ Horarios de atención:</p>
                  <p className="text-sm sm:text-base text-gray-700"><strong>Desayuno: {formatTime(schedules.breakfastStart)} - {formatTime(schedules.breakfastEnd)}</strong></p>
                  <p className="text-sm sm:text-base text-gray-700"><strong>Almuerzo: {formatTime(schedules.lunchStart)} - {formatTime(schedules.lunchEnd)}</strong></p>
                  <p className="text-xs sm:text-sm text-gray-500 italic">Gracias por tu comprensión y preferencia.</p>
                </div>
              ) : (
                <div className="fade-in">
                  <p className="text-center text-gray-700 mb-2 sm:mb-4 text-sm xs:text-base sm:text-lg md:text-xl bg-white p-2 sm:p-3 md:p-4 rounded-lg shadow-sm">
                    {currentMenuType === 'breakfast' ? '¡Pide tu desayuno fácil y rápido!' : '¡Pide tu almuerzo fácil y rápido! Almuerzo $13.000 (solo bandeja o sin sopa $12.000)'}
                  </p>
                  <div className="text-center text-gray-600 mb-4 text-sm sm:text-base bg-yellow-100 p-2 rounded-lg">{countdown}</div>
                  {currentMenuType === 'breakfast' ? (
                    <>
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
                        onBreakfastChange={handleBreakfastChange}
                        onRemoveBreakfast={(id) => setBreakfasts(breakfasts.filter(b => b.id !== id))}
                        onAddBreakfast={() => setBreakfasts([...breakfasts, { ...initialBreakfast, id: Date.now() }])}
                        onDuplicateBreakfast={(breakfast) => {
                          if (breakfasts.length < 15) {
                            setBreakfasts([...breakfasts, { ...breakfast, id: Date.now() }]);
                            setSuccessMessage('Desayuno duplicado con éxito.');
                          } else {
                            setErrorMessage('Has alcanzado el máximo de 15 desayunos.');
                          }
                        }}
                        incompleteBreakfastIndex={incompleteBreakfastIndex}
                        incompleteSlideIndex={incompleteBreakfastSlideIndex}
                        isOrderingDisabled={isOrderingDisabled}
                        userRole={user?.role || 1}
                        savedAddress={savedAddress}
                      />
                      <BreakfastOrderSummary items={breakfasts} onSendOrder={sendBreakfastToWhatsApp} user={user} />
                    </>
                  ) : (
                    <>
                      <MealList
                        meals={meals}
                        soups={soups}
                        soupReplacements={soupReplacements}
                        principles={principles}
                        proteins={proteins}
                        drinks={drinks}
                        sides={sides}
                        additions={additions}
                        times={times}
                        paymentMethods={paymentMethods}
                        isTableOrder={false}
                        onMealChange={(id, field, value) => handleMealChange(setMeals, id, field, value)}
                        onRemoveMeal={(id) => removeMeal(setMeals, setSuccessMessage, id, meals)}
                        onAddMeal={() => addMeal(setMeals, setSuccessMessage, meals, initialMeal)}
                        onDuplicateMeal={(meal) => duplicateMeal(setMeals, setSuccessMessage, meal, meals)}
                        incompleteMealIndex={incompleteMealIndex}
                        incompleteSlideIndex={incompleteSlideIndex}
                        isOrderingDisabled={isOrderingDisabled}
                      />
                      {(() => {
                        const totalCalculated = calculateTotal(meals);
                        console.log('🔍 App.js total calculado:', totalCalculated);
                        return (
                          <OrderSummary 
                            meals={meals} 
                            onSendOrder={() => onSendOrder(false)} 
                            calculateTotal={calculateTotal} 
                            preCalculatedTotal={totalCalculated}
                            isTableOrder={false} 
                          />
                        );
                      })()}
                    </>
                  )}
                </div>
              )}
            </main>
            <div className="fixed top-16 right-4 z-[10002] space-y-2 w-80 max-w-xs">
              {isLoading && <LoadingIndicator />}
              {errorMessage && <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />}
              {successMessage && <SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />}
            </div>
            <Footer />
          </div>
        } />
        <Route path="/test" element={<div className="text-center text-green-500">Ruta de prueba funcionando</div>} />
      </Routes>
    </Suspense>
  );
};

export default App;