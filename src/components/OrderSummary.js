//src/components/OrderSummary.js
import React, { useMemo } from 'react';

const OrderSummary = ({ meals, onSendOrder }) => {
  const calculateTotal = () => {
    return meals.reduce((total, meal) => {
      const basePrice = (meal?.soup?.name === 'Sin sopa' || meal?.soup?.name === 'Solo bandeja') ? 12000 : 13000;
      return total + basePrice;
    }, 0);
  };

  const cleanText = (text) => text?.replace(' NUEVO', '') || 'No seleccionado';

  const groupedMeals = useMemo(() => {
    return meals.reduce((acc, meal, index) => {
      const key = JSON.stringify(meal);
      if (!acc[key]) {
        acc[key] = { count: 0, indices: [] };
      }
      acc[key].count += 1;
      acc[key].indices.push(index + 1);
      return acc;
    }, {});
  }, [meals]);

  const total = useMemo(() => calculateTotal(), [meals]);
  const selectedPayment = meals[0]?.payment;
  const paymentNumber = '3138505647';

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg mt-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">✅ Resumen del Pedido</h2>
      <div className="space-y-6">
        {Object.entries(groupedMeals).map(([key, { count, indices }]) => {
          const meal = JSON.parse(key);
          const mealPrice = (meal?.soup?.name === 'Sin sopa' || meal?.soup?.name === 'Solo bandeja') ? 12000 : 13000;
          return (
            <div key={key} className="border-b pb-4 last:border-b-0">
              <h3 className="font-medium text-gray-800 mb-2">
                {count > 1 ? `${count} Almuerzos iguales (#${indices.join(', #')})` : `Almuerzo #${indices[0]}`} - ${mealPrice.toLocaleString()}
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p>🥣 Sopa: <span className="font-medium">{cleanText(meal.soup?.name)}</span></p>
                {meal.soupReplacement && (
                  <p>Reemplazo: <span className="font-medium">{meal.soupReplacement.name}</span></p>
                )}
                <p>🍚 Principio: <span className="font-medium">{cleanText(meal.principle?.name)}</span></p>
                {meal.principleReplacement && (
                  <p>Reemplazo: <span className="font-medium">{meal.principleReplacement.name}</span></p>
                )}
                <p>🍗 Proteína: <span className="font-medium">{cleanText(meal.protein?.name)}</span></p>
                <p>🥤 Bebida: <span className="font-medium">{cleanText(meal.drink?.name)}</span></p>
                <p>
                  🥗 Acompañamientos:{' '}
                  <span className="font-medium">
                    {Array.isArray(meal.sides) && meal.sides.length > 0
                      ? meal.sides.map(s => cleanText(s.name)).join(', ')
                      : 'Ninguno'}
                  </span>
                </p>
                <p>📝 Notas: <span className="font-medium">{meal.notes || 'Ninguna'}</span></p>
                <p>🕒 Hora: <span className="font-medium">{meal.time?.name || 'No seleccionado'}</span></p>
                <p>📍 Dirección: <span className="font-medium">{meal.address || 'No seleccionado'}</span></p>
                <p>💰 Pago: <span className="font-medium">{meal.payment?.name || 'No seleccionado'}</span></p>
                <p>🍴 Cubiertos: <span className="font-medium">{meal.cutlery || 'No seleccionado'}</span></p>
              </div>
            </div>
          );
        })}
        <div className="pt-4 border-t">
          <p className="text-lg font-bold text-right">
            Total: <span className="text-green-600">${total.toLocaleString()}</span>
          </p>
          {selectedPayment && (
            <div className="mt-2 p-2 bg-yellow-100 text-gray-800 text-xs rounded">
              {selectedPayment.name === 'Nequi' || selectedPayment.name === 'DaviPlata' ? (
                <p><strong>💳 Instrucciones de pago:</strong> Envía el valor total de ${total.toLocaleString()} al número {paymentNumber} por Nequi o DaviPlata.</p>
              ) : selectedPayment.name === 'Efectivo' ? (
                <div>
                  <p>Paga al momento de la entrega.</p>
                  <p>En caso tal de no tener efectivo, paga a este número, Nequi o DaviPlata {paymentNumber}.</p>
                </div>
              ) : null}
            </div>
          )}
          <button 
            onClick={onSendOrder}
            className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg mt-4 transition-colors flex items-center justify-center"
            aria-label="Enviar pedido a WhatsApp"
          >
            <span className="mr-2">Enviar pedido a WhatsApp</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.479 5.392 1.479 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderSummary;