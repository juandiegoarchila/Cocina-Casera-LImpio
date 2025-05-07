//src/components/MealList.js
import React from 'react';
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
  const completedMeals = meals.filter(m => 
    m.protein && m.soup && m.principle && m.drink && m.time && m.address && m.payment && m.cutlery
  ).length;

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 rounded-md shadow-sm">
        <div className="mb-1 sm:mb-0">
          <h2 className="text-base font-bold text-gray-800">Tus Almuerzos</h2>
          <p className="text-xs text-gray-600">
            {completedMeals} de {meals.length} completos
          </p>
        </div>
        <button
          onClick={onAddMeal}
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md transition-colors text-sm font-medium flex items-center shadow-md"
          aria-label="Añadir un nuevo almuerzo"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Añadir un nuevo almuerzo
        </button>
      </div>
      <div className="space-y-2">
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
          />
        ))}
      </div>
      {meals.length > 0 && (
        <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
          <h3 className="font-medium text-blue-800 mb-1 flex items-center text-xs">
            <span className="mr-1">💡</span> Consejo rápido
          </h3>
          <p className="text-xs text-blue-600">
            Desliza entre categorías usando las flechas o puntos. 
            Cada almuerzo se colapsará automáticamente cuando esté completo.
          </p>
        </div>
      )}
    </div>
  );
};

export default MealList;