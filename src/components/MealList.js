// src/components/MealList.js
import React, { useState, useEffect } from 'react';
import MealItem from './MealItem';
import ErrorMessage from './ErrorMessage';

const MealList = ({
  meals,
  soups,
  soupReplacements,
  principles,
  proteins,
  drinks,
  sides,
  additions,
  paymentMethods,
  times,
  isTableOrder,
  userRole, // Añadido para recibir el prop userRole
  onMealChange,
  onRemoveMeal,
  onAddMeal,
  onDuplicateMeal,
  incompleteMealIndex,
  incompleteSlideIndex,
  isOrderingDisabled,
  isAddressComplete, // Nuevo prop para validar dirección
}) => {
  const [showTutorial, setShowTutorial] = useState(meals.length === 0);
  const maxMeals = 15;
  const [showMaxMealsError, setShowMaxMealsError] = useState(false);

  useEffect(() => {
    const handleQuickMultiply = (e) => {
      const { mealId, count, field, value, type } = e.detail;
      if (type !== 'lunch' || count <= 1) return;
      
      const baseMealIndex = meals.findIndex(m => m.id === mealId);
      if (baseMealIndex === -1) return;
      
      const currentMealsCount = meals.length;
      
      if (count <= currentMealsCount) {
        for (let i = 0; i < count; i++) {
          const targetMeal = meals[i];
          if (targetMeal) {
            setTimeout(() => onMealChange(targetMeal.id, field, value), i * 50);
          }
        }
      } else {
        const baseMeal = meals[baseMealIndex];
        
        for (let i = 0; i < currentMealsCount; i++) {
          const targetMeal = meals[i];
          if (targetMeal) {
            setTimeout(() => onMealChange(targetMeal.id, field, value), i * 50);
          }
        }
        
        const newMealsNeeded = count - currentMealsCount;
        for (let i = 0; i < newMealsNeeded; i++) {
          setTimeout(() => {
            const mealWithValue = { ...baseMeal, [field]: value };
            onDuplicateMeal(mealWithValue);
          }, (currentMealsCount + i) * 100);
        }
      }
    };
    window.addEventListener('quick-multiply-order', handleQuickMultiply);
    return () => window.removeEventListener('quick-multiply-order', handleQuickMultiply);
  }, [meals, maxMeals, onMealChange, onDuplicateMeal]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[MealList] Additions prop updated:', additions);
    }
  }, [additions]);

  useEffect(() => {
    if (meals.length >= maxMeals) {
      setShowMaxMealsError(true);
      const timer = setTimeout(() => setShowMaxMealsError(false), 3000);
      return () => clearTimeout(timer);
    } else {
      setShowMaxMealsError(false);
    }
  }, [meals.length, maxMeals]);

  const completedMeals = meals.filter(m => {
    const isCompleteRice = Array.isArray(m?.principle) && m.principle.some(p => ['Arroz con pollo', 'Arroz paisa', 'Arroz tres carnes'].includes(p.name));
    return (m.soup || m.soupReplacement) &&
           m.principle &&
           (isCompleteRice || m.protein) &&
           m.drink &&
           (isTableOrder ? (m.tableNumber && m.paymentMethod) : (m.time && m.address && m.payment && m.cutlery !== null)) &&
           (isCompleteRice || (m.sides && m.sides.length > 0));
  }).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2 xs:p-3 sm:p-3 rounded-md shadow-sm overflow-hidden">
        <div>
          <h2 className="text-sm sm:text-lg md:text-xl font-bold text-gray-800">Tus Almuerzos</h2>
          <p className="text-xs sm:text-sm md:text-base text-gray-600">
            {completedMeals} de {meals.length} completos
          </p>
        </div>
        <button
          onClick={onAddMeal}
          className={`add-meal-button bg-green-600 hover:bg-green-700 text-white px-2 xs:px-3 py-1 xs:py-1.5 rounded-md transition-colors text-xs sm:text-sm md:text-base font-bold flex items-center shadow-sm flex-shrink-0 ${
            meals.length >= maxMeals || isOrderingDisabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          aria-label="Añadir un nuevo almuerzo"
          disabled={meals.length >= maxMeals || isOrderingDisabled}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 xs:h-5 w-4 xs:w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Añadir un nuevo almuerzo
        </button>
      </div>
      {showMaxMealsError && (
        <div className="fixed right-4 z-[10002] w-80 max-w-xs" style={{ top: '128px' }}>
          <ErrorMessage
            message="Has alcanzado el máximo de 15 almuerzos. No puedes añadir más."
            className="bg-green-100 text-green-800 min-h-[60px]"
            onClose={() => setShowMaxMealsError(false)}
          />
        </div>
      )}
      <div className="space-y-2 sm:space-y-4">
        {meals.length === 0 ? (
          <p className="text-center text-gray-600">No hay almuerzos. ¡Añade uno para comenzar!</p>
        ) : (
          meals.map((meal, index) => (
<MealItem
    key={meal.id}
    id={meal.id}
    meal={meal}
    onMealChange={onMealChange}
    onRemoveMeal={() => onRemoveMeal(index)}
    onDuplicateMeal={() => onDuplicateMeal(meal)}
    soups={soups}
    soupReplacements={soupReplacements}
    principles={principles}
    proteins={proteins}
    drinks={drinks}
    sides={sides}
    additions={additions}
    times={times}
    paymentMethods={paymentMethods}
    isTableOrder={isTableOrder}
    userRole={userRole}
    showTutorial={showTutorial && index === 0}
    setShowTutorial={setShowTutorial}
    isIncomplete={index === incompleteMealIndex}
    incompleteSlideIndex={incompleteSlideIndex}
    address={meal.address || ''}
    isOrderingDisabled={isOrderingDisabled}
    maxMeals={maxMeals}
    totalMeals={meals.length}
    isAddressComplete={isAddressComplete}
  />
          ))
        )}
      </div>
      {meals.length > 0 && !isTableOrder && (
        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 shadow-md">
          <h3 className="font-semibold text-blue-800 mb-2 flex items-center text-sm md:text-base">
            <span className="mr-1.5 text-xl">🚀</span>
            <span className="font-bold">¡Configura tu almuerzo!</span>
          </h3>
          <p className="text-xs sm:text-sm text-blue-700 leading-relaxed">
            <strong className="font-bold">Desliza</strong> para navegar por las opciones. Cada almuerzo se <strong className="font-bold">esconde en 10 segundos</strong> al completarse.
          </p>
          <p className="text-xs sm:text-sm text-blue-700 leading-relaxed mt-1">
            ¿Quieres verlo de nuevo? ¡Solo <strong>haz clic</strong>!
          </p>
        </div>
      )}
    </div>
  );
};

export default MealList;