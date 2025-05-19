import { useState, useEffect } from 'react';
import { db } from './config/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import useLocalStorage from './hooks/useLocalStorage';
import Header from './components/Header';
import MealList from './components/MealList';
import OrderSummary from './components/OrderSummary';
import LoadingIndicator from './components/LoadingIndicator';
import ErrorMessage from './components/ErrorMessage';
import SuccessMessage from './components/SuccessMessage';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import AdminPage from './components/AdminPage';
import { initializeMealData, handleMealChange, addMeal, duplicateMeal, removeMeal, sendToWhatsApp } from './utils/MealLogic';
import { calculateMealPrice, calculateTotal, paymentSummary } from './utils/MealCalculations';
import { isMobile, encodeMessage } from './utils/Helpers';

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

  useEffect(() => {
    const collections = ['soups', 'soupReplacements', 'principles', 'proteins', 'drinks', 'sides', 'times', 'paymentMethods'];
    const setters = [setSoups, setSoupReplacements, setPrinciples, setProteins, setDrinks, setSides, setTimes, setPaymentMethods];

    const unsubscribers = collections.map((col, index) =>
      onSnapshot(collection(db, col), (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setters[index](data);
        if (data.length === 0) console.warn(`La colección ${col} está vacía. Agrega datos desde /admin.`);
      }, (error) => {
        console.error(`Error al escuchar ${col}:`, error);
        setErrorMessage(`Error al cargar datos. Revisa la consola para más detalles.`);
      })
    );

    return () => unsubscribers.forEach(unsubscribe => unsubscribe());
  }, []);

  const initialMeal = initializeMealData(address);
  const total = calculateTotal(meals); // Compute total here

  useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
        setErrorMessage(null);
      }, 15000); // Changed to 15 seconds (15,000ms)
      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessage]);

  return (
    <Router>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/" element={
          <div className="min-h-screen bg-gray-50 flex flex-col">
            <Header />
            <main role="main" className="p-4 flex-grow max-w-4xl mx-auto w-full">
              <div className="fixed top-14 right-3 z-[11000] space-y-1" aria-live="polite">
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
                onMealChange={(id, field, value) => handleMealChange(setMeals, id, field, value)}
                onRemoveMeal={(id) => removeMeal(setMeals, setSuccessMessage, id, meals)}
                onAddMeal={() => addMeal(setMeals, setSuccessMessage, meals, initialMeal)}
                onDuplicateMeal={(meal) => duplicateMeal(setMeals, setSuccessMessage, meal, meals)}
                incompleteMealIndex={incompleteMealIndex}
                incompleteSlideIndex={incompleteSlideIndex}
              />
              <OrderSummary
                meals={meals}
                onSendOrder={() => sendToWhatsApp(
                  setIsLoading, setErrorMessage, setSuccessMessage, meals,
                  incompleteMealIndex, setIncompleteMealIndex, incompleteSlideIndex, setIncompleteSlideIndex,
                  calculateMealPrice, total, paymentSummary(meals), isMobile, encodeMessage
                )}
                calculateTotal={() => total}
                paymentSummary={paymentSummary(meals)}
              />
            </main>
          </div>
        } />
        <Route path="/test" element={<div className="text-center text-green-500">Ruta de prueba funcionando</div>} />
      </Routes>
    </Router>
  );
};

export default App;