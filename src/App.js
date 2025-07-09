//src/App.
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { db, auth } from './config/firebase';
import { collection, onSnapshot, doc, addDoc, setDoc, getDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import useLocalStorage from './hooks/useLocalStorage';
import Header from './components/Header';
import MealList from './components/MealList';
import OrderSummary from './components/OrderSummary';
import LoadingIndicator from './components/LoadingIndicator';
import ErrorMessage from './components/ErrorMessage';
import SuccessMessage from './components/SuccessMessage';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useAuth } from './components/Auth/AuthProvider';
import { initializeMealData, handleMealChange, addMeal, duplicateMeal, removeMeal, sendToWhatsApp } from './utils/MealLogic';
import { calculateMealPrice, calculateTotal, paymentSummary } from './utils/MealCalculations';
import Footer from './components/Footer';
import Modal from './components/Modal';
import PrivacyPolicy from './components/PrivacyPolicy';

const AdminPage = lazy(() => import('./components/Admin/AdminPage'));
const Login = lazy(() => import('./components/Auth/Login'));
const ForgotPassword = lazy(() => import('./components/Auth/ForgotPassword'));

const App = () => {
  const { user, loading } = useAuth();
  const [meals, setMeals] = useState([]);
  const [address, setAddress] = useLocalStorage('userAddress', '');
  const [phoneNumber, setPhoneNumber] = useLocalStorage('userPhoneNumber', '');
  const [addressType, setAddressType] = useLocalStorage('userAddressType', 'house');
  const [recipientName, setRecipientName] = useLocalStorage('userRecipientName', '');
  const [unitDetails, setUnitDetails] = useLocalStorage('userUnitDetails', '');
  const [localName, setLocalName] = useLocalStorage('userLocalName', '');
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [incompleteMealIndex, setIncompleteMealIndex] = useState(null);
  const [incompleteSlideIndex, setIncompleteSlideIndex] = useState(null);
  const [soups, setSoups] = useState([]);
  const [soupReplacements, setSoupReplacements] = useState([]);
  const [principles, setPrinciples] = useState([]);
  const [proteins, setProteins] = useState([]);
  const [drinks, setDrinks] = useState([]);
  const [sides, setSides] = useState([]);
  const [times, setTimes] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [additions, setAdditions] = useState([]);
  const [isOrderingDisabled, setIsOrderingDisabled] = useState(false);
  const [showCookieBanner, setShowCookieBanner] = useLocalStorage('cookieConsent', true);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

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

  useEffect(() => {}, []);

  useEffect(() => {
    const collections = ['soups', 'soupReplacements', 'principles', 'proteins', 'drinks', 'sides', 'times', 'paymentMethods', 'additions'];
    const setters = [setSoups, setSoupReplacements, setPrinciples, setProteins, setDrinks, setSides, setTimes, setPaymentMethods, setAdditions];

    const unsubscribers = collections.map((col, index) =>
      onSnapshot(collection(db, col), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setters[index](data);
        if (process.env.NODE_ENV === 'development') console.log(`Updated ${col}:`, data);
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

    const settingsUnsubscribe = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      setIsOrderingDisabled(doc.exists() ? doc.data().isOrderingDisabled || false : false);
    }, (error) => {
      if (process.env.NODE_ENV === 'development') console.error('Error al escuchar settings/global:', error);
      setErrorMessage('Error al cargar configuración. Intenta de nuevo más tarde.');
    });

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
      settingsUnsubscribe();
    };
  }, []);

  const registerClientAndSaveOrder = async (meals) => {
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

      const order = {
        userId: currentUser.uid,
        userEmail: clientData.email,
        meals: meals.map(meal => ({
          soup: meal.soup?.name || '',
          soupReplacement: meal.soupReplacement?.name || '',
          principle: Array.isArray(meal.principle) ? meal.principle.map(p => p.name).join(', ') : meal.principle?.name || '',
          principleReplacement: meal.principleReplacement?.name || '',
          protein: meal.protein?.name || '',
          drink: meal.drink?.name || '',
          sides: meal.sides?.map(side => side.name) || [],
          additions: meal.additions?.map(addition => ({ name: addition.name, protein: addition.protein || '' })) || [],
          address: {
            address: meal.address?.address || '',
            phoneNumber: meal.address?.phoneNumber || '',
            addressType: meal.address?.addressType || '',
            recipientName: meal.address?.recipientName || '',
            unitDetails: meal.address?.unitDetails || '',
            localName: meal.address?.localName || '',
          },
          payment: meal.payment?.name || '',
          time: meal.time?.name || '',
          notes: meal.notes || '',
          cutlery: meal.cutlery || false,
        })),
        total: calculateTotal(meals),
        paymentSummary: paymentSummary(meals),
        status: 'Pendiente',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await addDoc(collection(db, 'orders'), order);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('Error al registrar cliente o guardar pedido:', error);
      setErrorMessage('Error al procesar el pedido. Intenta de nuevo.');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const initialMeal = initializeMealData({
    address,
    phoneNumber,
    addressType,
    recipientName,
    unitDetails,
    localName,
  });
  const total = calculateTotal(meals);

  const onSendOrder = async () => {
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
      };

      // Check fields in exact slide order to ensure correct first missing field
      if (!meal?.soup && !meal?.soupReplacement) {
        missing.push('Sopa o reemplazo de sopa');
      } else if (!meal?.principle) {
        missing.push('Principio');
      } else if (!isCompleteRice && !meal?.protein) {
        missing.push('Proteína');
      } else if (!meal?.drink) {
        missing.push('Bebida');
      } else if (meal?.cutlery === null) {
        missing.push('Cubiertos');
      } else if (!meal?.time) {
        missing.push('Hora');
      } else if (!meal?.address?.address) {
        missing.push('Dirección');
      } else if (!meal?.payment) {
        missing.push('Método de pago');
      } else if (!isCompleteRice && (!meal?.sides || meal.sides.length === 0)) {
        missing.push('Acompañamientos');
      } else if (meal?.address?.addressType === 'shop' && !meal?.address?.localName) {
        missing.push('Nombre del local');
      }

      if (missing.length > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Meal ${i + 1} is incomplete. Missing fields:`, missing);
          console.log(`Meal ${i + 1} data:`, meal);
        }
        incompleteMealIndex = i;
        firstMissingField = missing[0]; // First missing field in slide order
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
      await sendToWhatsApp(
        setIsLoading,
        setErrorMessage,
        setSuccessMessage,
        meals,
        incompleteMealIndex,
        setIncompleteMealIndex,
        incompleteSlideIndex,
        setIncompleteSlideIndex,
        calculateMealPrice,
        total
      );
      await registerClientAndSaveOrder(meals);
      setSuccessMessage('¡Pedido enviado y cliente registrado con éxito!');
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
    <Router>
      <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Cargando aplicación...</div>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin/*" element={<AdminPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/" element={
<div className="min-h-screen bg-gray-200 flex flex-col relative">              <Header />
              {showCookieBanner && (
                <div className="fixed bottom-0 left-0 right-0 bg-blue-100 text-gray-800 p-4 z-[10001] rounded-t-lg shadow-lg">
                  <p className="text-sm font-medium">🍪 Usamos cookies para guardar tus preferencias y hacer tu experiencia más fácil. ¡Todo seguro!</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={handleAcceptCookies}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-1 rounded text-sm font-semibold"
                    >
                      ¡Entendido!
                    </button>
                    <button
                      onClick={() => {
                        setShowCookieBanner(false);
                        setShowPrivacyModal(true);
                      }}
                      className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-1 rounded text-sm"
                      aria-label="Ver política de privacidad"
                    >
                      Más info
                    </button>
                  </div>
                </div>
              )}
              <Modal isOpen={showPrivacyModal} onClose={() => setShowPrivacyModal(false)}>
                <PrivacyPolicy />
              </Modal>
              <main role="main" className="p-2 sm:p-4 flex-grow w-full max-w-4xl mx-auto">
                {isOrderingDisabled ? (
                  <div className="text-center text-red-600 bg-red-50 p-3 sm:p-4 rounded-lg">
                    <p className="text-base sm:text-lg font-semibold">Pedidos cerrados hasta mañana</p>
                    <p className="text-xs sm:text-sm">Gracias por tu comprensión.</p>
                  </div>
                ) : (
                  <>
                    <p className="text-center text-gray-700 mb-2 sm:mb-4 text-sm xs:text-base sm:text-lg md:text-xl bg-white p-2 sm:p-3 md:p-4 rounded-lg shadow-sm">
                      ¡Pide tu almuerzo fácil y rápido! Almuerzo $13.000 (solo bandeja o sin sopa $12.000)
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
                      times={times}
                      paymentMethods={paymentMethods}
                      onMealChange={(id, field, value) => handleMealChange(setMeals, id, field, value)}
                      onRemoveMeal={(id) => removeMeal(setMeals, setSuccessMessage, id, meals)}
                      onAddMeal={() => addMeal(setMeals, setSuccessMessage, meals, initialMeal)}
                      onDuplicateMeal={(meal) => duplicateMeal(setMeals, setSuccessMessage, meal, meals)}
                      incompleteMealIndex={incompleteMealIndex}
                      incompleteSlideIndex={incompleteSlideIndex}
                      isOrderingDisabled={isOrderingDisabled}
                    />
                    <OrderSummary
                      meals={meals}
                      onSendOrder={onSendOrder}
                      calculateTotal={calculateTotal}
                    />
                  </>
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
              <Footer />
            </div>
          } />
          <Route path="/test" element={<div className="text-center text-green-500">Ruta de prueba funcionando</div>} />
        </Routes>
      </Suspense>
    </Router>
  );
};

export default App;