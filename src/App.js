import React, { useState, useEffect, useCallback } from 'react';
import { db } from './config/firebase';
import { collection, onSnapshot } from 'firebase/firestore'; // Cambia getDocs por onSnapshot
import useLocalStorage from './hooks/useLocalStorage';
import Header from './components/Header';
import MealList from './components/MealList';
import OrderSummary from './components/OrderSummary';
import LoadingIndicator from './components/LoadingIndicator';
import ErrorMessage from './components/ErrorMessage';
import SuccessMessage from './components/SuccessMessage';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import AdminPage from './components/AdminPage';

const initialMeal = {
  id: 0,
  soup: null,
  soupReplacement: null,
  principle: null,
  principleReplacement: null,
  protein: null,
  drink: null,
  sides: [],
  notes: '',
  time: null,
  address: '',
  payment: null,
  cutlery: null
};

const App = () => {
  const [meals, setMeals] = useState([]);
  const [address, setAddress] = useLocalStorage('userAddress', '');
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

  // Escuchar cambios en Firestore en tiempo real
  useEffect(() => {
    const collections = [
      'soups', 'soupReplacements', 'principles', 'proteins', 
      'drinks', 'sides', 'times', 'paymentMethods'
    ];
    const setters = [
      setSoups, setSoupReplacements, setPrinciples, setProteins, 
      setDrinks, setSides, setTimes, setPaymentMethods
    ];

    const unsubscribers = collections.map((col, index) => {
      return onSnapshot(collection(db, col), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setters[index](data);
        console.log(`Datos actualizados para ${col}:`, data);
        if (data.length === 0) {
          console.warn(`La colección ${col} está vacía. Agrega datos desde /admin.`);
        }
      }, (error) => {
        console.error(`Error al escuchar ${col}:`, error);
        setErrorMessage(`Error al cargar datos. Revisa la consola para más detalles.`);
      });
    });

    // Limpiar los listeners cuando el componente se desmonte
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, []);

  useEffect(() => {
    setMeals(prev => prev.map(meal => ({ ...meal, address })));
  }, [address]);

  const handleMealChange = useCallback((id, field, value) => {
    setMeals(prev => {
      const updatedMeals = prev.map(meal =>
        meal.id === id ? { ...meal, [field]: value } : meal
      );
      if (field === 'address' && value) setAddress(value);
      return updatedMeals;
    });
  }, [setAddress]);

  const addMeal = useCallback(() => {
    const newId = meals.length > 0 ? Math.max(...meals.map(meal => meal.id)) + 1 : 0;
    const newMeal = { ...initialMeal, id: newId, address };
    if (meals.length > 0) {
      const firstMeal = meals[0];
      setSuccessMessage("Tu dirección, hora y método de pago se han copiado del primer almuerzo. Puedes modificarlo si es necesario.");
      if (firstMeal.time) newMeal.time = firstMeal.time;
      if (firstMeal.address) newMeal.address = firstMeal.address;
      if (firstMeal.payment) newMeal.payment = firstMeal.payment;
    }
    setMeals(prev => [...prev, newMeal]);
  }, [meals, address, setSuccessMessage]);

  const duplicateMeal = useCallback((mealToDuplicate) => {
    const newId = meals.length > 0 ? Math.max(...meals.map(meal => meal.id)) + 1 : 0;
    setSuccessMessage("Se ha duplicado el almuerzo. Puedes modificarlo si es necesario.");
    setMeals(prev => [...prev, { ...mealToDuplicate, id: newId }]);
  }, [meals, setSuccessMessage]);

  const removeMeal = useCallback((id) => {
    const updatedMeals = meals.filter(meal => meal.id !== id);
    const reindexedMeals = updatedMeals.map((meal, index) => ({
      ...meal,
      id: index
    }));
    setMeals(reindexedMeals);
    if (reindexedMeals.length === 0) {
      setSuccessMessage("Todos los almuerzos han sido eliminados.");
    } else {
      setSuccessMessage("Almuerzo eliminado correctamente.");
    }
  }, [meals, setSuccessMessage]);

  const sendToWhatsApp = useCallback(() => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const incompleteMeals = meals.map((meal, index) => {
      const missing = [];
      if (!meal?.soup || (meal.soup?.name === 'Sin sopa' && !meal?.soupReplacement)) missing.push('Sopa');
      if (!meal?.principle || (meal.principle?.name === 'Sin principio' && !meal?.principleReplacement)) missing.push('Principio');
      if (!meal?.protein) missing.push('Proteína');
      if (!meal?.drink) missing.push('Bebida');
      if (!meal?.time) missing.push('Hora');
      if (!meal?.address) missing.push('Dirección');
      if (!meal?.payment) missing.push('Método de pago');
      if (!meal?.cutlery) missing.push('Cubiertos');
      return { index, missing };
    }).filter(m => m.missing.length > 0);

    if (incompleteMeals.length > 0) {
      const firstIncomplete = incompleteMeals[0];
      const slideMap = {
        'Sopa': 0,
        'Principio': 1,
        'Proteína': 2,
        'Bebida': 3,
        'Acompañamientos': 4,
        'Hora': 5,
        'Dirección': 6,
        'Método de pago': 7,
        'Cubiertos': 8
      };
      const firstMissingField = firstIncomplete.missing[0];
      setIncompleteMealIndex(firstIncomplete.index);
      setIncompleteSlideIndex(slideMap[firstMissingField] || 0);
      setErrorMessage(`Por favor, completa el paso de ${firstMissingField} para el Almuerzo #${firstIncomplete.index + 1}. Desplázate hacia arriba para verlo.`);

      setTimeout(() => {
        const element = document.getElementById(`meal-item-${firstIncomplete.index}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('highlight-incomplete');
          setTimeout(() => element.classList.remove('highlight-incomplete'), 3000);
          element.dispatchEvent(new CustomEvent('updateSlide', { detail: { slideIndex: slideMap[firstMissingField] } }));
        }
      }, 100);

      setIsLoading(false);
      return;
    }

    const cleanText = (text) => text?.replace(' NUEVO', '') || 'No seleccionado';

    const groupedMeals = meals.reduce((acc, meal, index) => {
      const key = JSON.stringify(meal);
      if (!acc[key]) {
        acc[key] = { count: 0, indices: [] };
      }
      acc[key].count += 1;
      acc[key].indices.push(index + 1);
      return acc;
    }, {});

    let message = `¡Hola Cocina Casera! 🍴\nQuiero hacer mi pedido:\n\n`;

    Object.entries(groupedMeals).forEach(([key, { count, indices }]) => {
      const meal = JSON.parse(key);
      message += `*${count > 1 ? `${count} almuerzos iguales (#${indices.join(', #')})` : `Almuerzo #${indices[0]}`}*\n`;
      message += `🥣 Sopa: ${cleanText(meal?.soup?.name)}${meal?.soupReplacement ? ` (Reemplazo: ${cleanText(meal.soupReplacement?.name)})` : ''}\n`;
      message += `🍚 Principio: ${cleanText(meal?.principle?.name)}${meal?.principleReplacement ? ` (Reemplazo: ${cleanText(meal.principleReplacement?.name)})` : ''}\n`;
      message += `🍗 Proteína: ${cleanText(meal?.protein?.name)}\n`;
      message += `🥤 Bebida: ${cleanText(meal?.drink?.name)}\n`;
      message += `🥗 Acompañamientos: ${meal?.sides?.length > 0 ? meal.sides.map(s => cleanText(s?.name)).join(', ') : 'Ninguno'}\n`;
      message += `📝 Notas: ${meal?.notes || 'Ninguna'}\n`;
      message += `🕒 Hora: ${cleanText(meal?.time?.name)}\n`;
      message += `📍 Dirección: ${meal?.address || 'No especificada'}\n`;
      message += `💰 Pago: ${cleanText(meal?.payment?.name)}\n`;
      message += `🍴 Cubiertos: ${meal?.cutlery || 'No especificado'}\n\n`;
    });

    const total = meals.reduce((sum, meal) => {
      const basePrice = (meal?.soup?.name === 'Sin sopa' || meal?.soup?.name === 'Solo bandeja') ? 12000 : 13000;
      return sum + basePrice;
    }, 0);

    message += `*Total a pagar*: $${total.toLocaleString()}\n\n`;

    const hasNequiOrDaviPlata = meals.some(meal => meal?.payment?.name === 'Nequi' || meal?.payment?.name === 'DaviPlata');
    if (hasNequiOrDaviPlata) {
      message += `💳 *Instrucciones de pago*: Envía el valor total de $${total.toLocaleString()} a este número 3138505647 al Nequi o DaviPlata.\n\n`;
    }

    message += `¡Gracias! 😊`;

    const encodedMessage = encodeURIComponent(message.trim());
    const whatsappUrl = `https://api.whatsapp.com/send?phone=573023931292&text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');

    setSuccessMessage('¡Pedido enviado correctamente a WhatsApp!');
    setIsLoading(false);

    setTimeout(() => setSuccessMessage(null), 5000);
  }, [meals]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  return (
    <Router>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route
          path="/"
          element={
            <div className="min-h-screen bg-gray-50 flex flex-col">
              <Header />
              <main role="main" className="p-4 flex-grow max-w-4xl mx-auto w-full">
                <div className="fixed top-14 right-3 z-40 space-y-1" aria-live="polite">
                  {isLoading && <LoadingIndicator />}
                  {errorMessage && <ErrorMessage message={errorMessage} />}
                  {successMessage && <SuccessMessage message={successMessage} />}
                </div>
                <p className="text-center text-gray-700 mb-1 sm:mb-2 md:mb-4 text-[10px] xs:text-xs sm:text-sm bg-white p-1 xs:p-2 rounded-lg shadow-sm">
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
                  times={times}
                  paymentMethods={paymentMethods}
                  onMealChange={handleMealChange}
                  onRemoveMeal={removeMeal}
                  onAddMeal={addMeal}
                  onDuplicateMeal={duplicateMeal}
                  incompleteMealIndex={incompleteMealIndex}
                  incompleteSlideIndex={incompleteSlideIndex}
                />
                <OrderSummary meals={meals} onSendOrder={sendToWhatsApp} />
              </main>
            </div>
          }
        />
        <Route path="/test" element={<div className="text-center text-green-500">Ruta de prueba funcionando</div>} />
      </Routes>
    </Router>
  );
};

export default App;