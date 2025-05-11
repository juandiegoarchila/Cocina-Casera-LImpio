import React, { useState } from 'react';
import MealItem from './MealItem';

const MealList = ({ 
  meals,
  soups,
  soupReplacements,
  principles,
  proteins,
  drinks,
  sides,
  times,
  paymentMethods,
  onMealChange,
  onRemoveMeal,
  onAddMeal,
  onDuplicateMeal
}) => {
  const [showTutorial, setShowTutorial] = useState(true); // Estado global para el tutorial

  const completedMeals = meals.filter(m => 
    m.protein && m.soup && m.principle && m.drink && m.time && m.address && m.payment && m.cutlery
  ).length;

  return (
    <div className="space-y-1 xs:space-y-2 sm:space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-1 xs:p-2 sm:p-3 rounded-md shadow-sm">
        <div className="mb-1 sm:mb-0">
          <h2 className="text-[10px] xs:text-xs sm:text-base font-bold text-gray-800">Tus Almuerzos</h2>
          <p className="text-[8px] xs:text-xs sm:text-sm text-gray-600">
            {completedMeals} de {meals.length} completos
          </p>
        </div>
        <button
          onClick={onAddMeal}
          className="add-meal-button bg-green-500 hover:bg-green-600 text-white px-2 xs:px-3 py-1 xs:py-1.5 rounded-md transition-colors text-[10px] xs:text-xs sm:text-sm font-medium flex items-center shadow-sm"
          aria-label="Añadir un nuevo almuerzo"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 xs:h-4 w-3 xs:w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Añadir un nuevo almuerzo
        </button>
      </div>
      <div className="space-y-1 xs:space-y-2 sm:space-y-4">
        {meals.map((meal, index) => (
          <MealItem
            key={index}
            id={index}
            meal={meal}
            onMealChange={onMealChange}
            onRemoveMeal={onRemoveMeal}
            onDuplicateMeal={onDuplicateMeal}
            soups={soups}
            soupReplacements={soupReplacements}
            principles={principles}
            proteins={proteins}
            drinks={drinks}
            sides={sides}
            times={times}
            paymentMethods={paymentMethods}
            showTutorial={showTutorial} // Pasamos el estado
            setShowTutorial={setShowTutorial} // Pasamos la función para actualizarlo
          />
        ))}
      </div>
      {meals.length > 0 && (
        <div className="bg-blue-50 p-1 xs:p-2 rounded-md border border-blue-100">
          <h3 className="font-medium text-blue-800 mb-1 flex items-center text-[8px] xs:text-xs sm:text-sm">
            <span className="mr-0.5 xs:mr-1">💡</span> Consejo rápido
          </h3>
          <p className="text-[8px] xs:text-xs sm:text-sm text-blue-600">
            Desliza entre categorías usando las flechas o puntos. 
            Cada almuerzo se colapsará automáticamente cuando esté completo.
          </p>
        </div>
      )}
    </div>
  );
};

export default MealList;