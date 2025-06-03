import { useState, useEffect } from 'react';
import MealItem from './MealItem';

const MealList = ({
  meals,
  soups, // Keep only one soups prop
  soupReplacements,
  principles,
  proteins,
  drinks,
  sides,
  additions, // Accept additions prop
  times,
  paymentMethods,
  onMealChange,
  onRemoveMeal,
  onAddMeal,
  onDuplicateMeal,
  incompleteMealIndex,
  incompleteSlideIndex,
  isOrderingDisabled,
}) => {
  const [showTutorial, setShowTutorial] = useState(meals.length === 0);

  // Debug: Log additions prop to verify updates
  useEffect(() => {
    console.log('[MealList] Additions prop updated:', additions);
  }, [additions]);

  const completedMeals = meals.filter(m =>
    m.protein &&
    m.soup &&
    m.principle &&
    m.drink &&
    m.time &&
    m.address &&
    m.payment &&
    m.cutlery
  ).length;

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
  className="add-meal-button bg-green-600 hover:bg-green-700 text-white px-2 xs:px-3 py-1 xs:py-1.5 rounded-md transition-colors text-xs sm:text-sm md:text-base font-bold flex items-center shadow-sm flex-shrink-0"
  aria-label="Añadir un nuevo almuerzo"
  disabled={isOrderingDisabled}
>
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 xs:h-5 w-4 xs:w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
  </svg>
  Añadir un nuevo almuerzo
</button>
      </div>
      <div className="space-y-2 sm:space-y-4">
        {meals.length === 0 ? (
          <p className="text-center text-gray-600">No hay almuerzos. ¡Añade uno para comenzar!</p>
        ) : (
          meals.map((meal, index) => (
            <MealItem
              key={index}
              id={index}
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
              additions={additions} // Pass additions correctly
              times={times}
              paymentMethods={paymentMethods}
              showTutorial={showTutorial && index === 0}
              setShowTutorial={setShowTutorial}
              isIncomplete={index === incompleteMealIndex}
              incompleteSlideIndex={incompleteSlideIndex}
              address={meal.address || ''}
              isOrderingDisabled={isOrderingDisabled}
            />
          ))
        )}
      </div>
      {meals.length > 0 && (
       <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 shadow-md">
  <h3 className="font-semibold text-blue-800 mb-2 flex items-center text-sm md:text-base">
    <span className="mr-1.5 text-xl">🚀</span>
    <span className="font-bold">¡Configura tu almuerzo!</span>
  </h3>
  <p className="text-xs sm:text-sm text-blue-700 leading-relaxed">
    <strong className="font-bold">Desliza</strong> para navegar por las opciones. Cada almuerzo se <strong className="font-bold">esconde en 30 segundos</strong> al completarse.
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