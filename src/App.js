//src/App.js
import React, { useState, useEffect, useCallback } from 'react';
import { soups, soupReplacements, principles, proteins, drinks, sides, times, paymentMethods } from './mock/menuOptions';
import Header from './components/Header';
import MealList from './components/MealList';
import OrderSummary from './components/OrderSummary';
import LoadingIndicator from './components/LoadingIndicator';
import ErrorMessage from './components/ErrorMessage';
import SuccessMessage from './components/SuccessMessage';

// Hook useLocalStorage integrado directamente en App.js (solo para address)
const useLocalStorage = (key, initialValue) => {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch (error) {
      console.error('Error reading localStorage:', error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Error writing to localStorage:', error);
    }
  }, [value, key]);

  return [value, setValue];
};

const initialMeal = {
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
  const [meals, setMeals] = useState([initialMeal]);
  const [address, setAddress] = useLocalStorage('userAddress', '');
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [incompleteMealIndex, setIncompleteMealIndex] = useState(null);
  const [incompleteSlideIndex, setIncompleteSlideIndex] = useState(null);

  useEffect(() => {
    setMeals(prev => prev.map(meal => ({ ...meal, address })));
  }, [address]);

  const handleMealChange = useCallback((id, field, value) => {
    setMeals(prev => {
      const updatedMeals = [...prev];
      updatedMeals[id] = { ...updatedMeals[id], [field]: value };
      if (field === 'address' && value) {
        setAddress(value);
        return updatedMeals.map(meal => ({ ...meal, address: value }));
      }
      return updatedMeals;
    });
  }, [setMeals, setAddress]);

  const addMeal = () => {
    const newMeal = { ...initialMeal, address };
    if (meals.length > 0) {
      const firstMeal = meals[0];
      setSuccessMessage("Tu dirección, hora y método de pago se han copiado del primer almuerzo. Puedes modificarlos si es necesario.");
      if (firstMeal.time) newMeal.time = firstMeal.time;
      if (firstMeal.address) newMeal.address = firstMeal.address;
      if (firstMeal.payment) newMeal.payment = firstMeal.payment;
    }
    setMeals(prev => [...prev, newMeal]);
  };

  const duplicateMeal = (mealToDuplicate) => {
    setSuccessMessage("Se ha duplicado el almuerzo. Puedes modificarlo si es necesario.");
    setMeals(prev => [...prev, { ...mealToDuplicate }]);
  };

  const removeMeal = useCallback((id) => {
    if (meals.length > 1) {
      setMeals(prev => prev.filter((_, index) => index !== id));
      setSuccessMessage("Almuerzo eliminado correctamente.");
    } else {
      setErrorMessage("Debes tener al menos un almuerzo en tu pedido.");
    }
  }, [meals, setMeals]);

  const sendToWhatsApp = () => {
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
          // Disparamos un evento personalizado para que MealItem cambie al slide correcto
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
  };

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="p-4 flex-grow max-w-4xl mx-auto w-full">
        <div className="fixed top-14 right-3 z-40 space-y-1">
          {isLoading && <LoadingIndicator />}
          {errorMessage && <ErrorMessage message={errorMessage} />}
          {successMessage && <SuccessMessage message={successMessage} />}
        </div>
        <p className="text-center text-gray-700 mb-6 bg-white p-4 rounded-lg shadow-sm">
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
  );
};

export default App;