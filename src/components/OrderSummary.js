import { useMemo } from 'react';
import { calculateMealPrice } from '../utils/MealCalculations';
import { isValidTime, isValidNote, formatNotes } from '../utils/MealLogic';

const OrderSummary = ({ meals, onSendOrder, calculateTotal, paymentSummary }) => {
  const cleanText = (text) => text?.replace(' NUEVO', '') || 'No seleccionado';

  const total = useMemo(() => calculateTotal(), [calculateTotal]);

  const groupedMeals = useMemo(() => {
    const groups = [];
    const usedIndices = new Set();

    for (let i = 0; i < meals.length; i++) {
      if (usedIndices.has(i)) continue;

      const meal1 = meals[i];
      const group = { meals: [meal1], payments: new Set([meal1?.payment?.name]), originalIndices: [i], differences: [] };
      usedIndices.add(i);

      for (let j = i + 1; j < meals.length; j++) {
        if (usedIndices.has(j)) continue;

        const meal2 = meals[j];
        const differences = [];

        if (meal1.soup?.name !== meal2.soup?.name || meal1.soupReplacement?.name !== meal2.soupReplacement?.name) {
          differences.push({ 
            field: 'Sopa', 
            value1: meal1.soup?.name || 'Sin sopa', 
            value2: meal2.soup?.name || 'Sin sopa', 
            replacement1: meal1.soupReplacement?.name, 
            replacement2: meal2.soupReplacement?.name 
          });
        }
        if (meal1.principle?.name !== meal2.principle?.name || meal1.principleReplacement?.name !== meal2.principleReplacement?.name) {
          differences.push({ 
            field: 'Principio', 
            value1: meal1.principle?.name || 'Sin principio', 
            value2: meal2.principle?.name || 'Sin principio', 
            replacement1: meal1.principleReplacement?.name, 
            replacement2: meal2.principleReplacement?.name 
          });
        }
        if (meal1.protein?.name !== meal2.protein?.name) differences.push({ field: 'Proteína', value1: meal1.protein?.name, value2: meal2.protein?.name });
        if (meal1.drink?.name !== meal2.drink?.name) differences.push({ field: 'Bebida', value1: meal1.drink?.name, value2: meal2.drink?.name });
        if (JSON.stringify(meal1.sides?.map(s => s.name).sort()) !== JSON.stringify(meal2.sides?.map(s => s.name).sort())) differences.push({ field: 'Acompañamientos', value1: meal1.sides?.map(s => s.name).join(', '), value2: meal2.sides?.map(s => s.name).join(', ') });
        if (meal1.notes !== meal2.notes) differences.push({ field: 'Notas', value1: meal1.notes || 'Ninguna', value2: meal2.notes || 'Ninguna' });
        if (meal1.time?.name !== meal2.time?.name) differences.push({ field: 'Entrega', value1: meal1.time?.name || 'Lo más pronto posible', value2: meal2.time?.name || 'Lo más pronto posible' });
        if (meal1.address !== meal2.address) differences.push({ field: 'Dirección', value1: meal1.address, value2: meal2.address });
        if (meal1.payment?.name !== meal2.payment?.name) differences.push({ field: 'Pago', value1: meal1.payment?.name || 'No especificado', value2: meal2.payment?.name || 'No especificado' });
        if (meal1.cutlery !== meal2.cutlery) differences.push({ field: 'Cubiertos', value1: meal1.cutlery ? 'Sí' : 'No', value2: meal2.cutlery ? 'Sí' : 'No' });

        if (differences.length <= 3) {
          group.meals.push(meal2);
          group.differences.push({ mealIndex: group.meals.length - 1, diffs: differences, originalIndex: j });
          if (meal2?.payment?.name) group.payments.add(meal2.payment.name);
          usedIndices.add(j);
          group.originalIndices.push(j);
        }
      }
      groups.push(group);
    }
    return groups;
  }, [meals]);

  return (
    <div className="order-summary bg-white p-2 xs:p-4 sm:p-6 rounded-lg shadow-lg mt-4 xs:mt-6 sm:mt-8">
      <h2 className="text-sm xs:text-base sm:text-lg font-bold text-gray-800 mb-2 xs:mb-4">✅ Resumen del Pedido</h2>
      {meals.length === 0 ? (
        <div>
          <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600">No hay almuerzos en tu pedido.</p>
          <p className="total-price text-[10px] xs:text-sm sm:text-base font-bold text-right mt-2">
            Total: <span className="text-green-600">$0</span>
          </p>
        </div>
      ) : (
        <div className="space-y-2 xs:space-y-4 sm:space-y-6">
          <p className="text-[10px] xs:text-xs sm:text-sm text-gray-700">🍽 {meals.length} Almuerzos en total</p>
          {groupedMeals.map(group => group.meals.length > 1 && (
            <p key={`group-${group.meals[0].id}`} className="text-[10px] xs:text-xs sm:text-sm text-gray-700">
              * {group.meals.length} Almuerzos iguales
            </p>
          ))}
          <p className="text-[10px] xs:text-xs sm:text-sm font-bold text-gray-700">
            💰 Total: <span className="text-green-600">${total.toLocaleString()}</span>
          </p>

          {groupedMeals.map((group, index) => {
            const baseMeal = group.meals[0];
            const count = group.meals.length;
            const totalPrice = group.meals.reduce((sum, m) => sum + calculateMealPrice(m), 0);
            const paymentNames = Array.from(group.payments).filter(name => name && name !== 'No especificado');
            const paymentText = paymentNames.length > 0 ? `(${paymentNames.join(' y ')})` : '(No especificado)';
            const drinkName = baseMeal?.drink?.name === 'Juego de mango' ? 'Jugo de mango' : cleanText(baseMeal?.drink?.name);
            const timeName = isValidTime(baseMeal.time) ? cleanText(baseMeal.time.name) : 'Lo más pronto posible';
            const note = formatNotes(baseMeal.notes);

            const hasSoupDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Sopa'));
            const hasPrincipleDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Principio'));
            const hasProteinDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Proteína'));
            const hasDrinkDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Bebida'));
            const hasSidesDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Acompañamientos'));
            const hasNotesDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Notas'));
            const hasTimeDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Entrega'));
            const hasAddressDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Dirección'));
            const hasPaymentDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Pago'));
            const hasCutleryDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Cubiertos'));

            return (
              <div key={index} className="border-b pb-2 xs:pb-4 last:border-b-0">
                <h3 className="font-medium text-gray-800 mb-1 xs:mb-2 text-[10px] xs:text-xs sm:text-sm">
                  {count > 1 ? `🍽 ${count} Almuerzos iguales – $${totalPrice.toLocaleString()} ${paymentText}` : `🍽 ${count} Almuerzo – $${totalPrice.toLocaleString()} ${paymentText}`}
                </h3>
                <div className="text-[10px] xs:text-xs sm:text-sm space-y-1">
                  {!hasSoupDifferences && (
                    baseMeal?.soupReplacement ? (
                      <p>🥣 {cleanText(baseMeal.soupReplacement.name)}</p>
                    ) : baseMeal?.soup?.name && baseMeal.soup.name !== 'Sin sopa' && baseMeal.soup.name !== 'Solo bandeja' ? (
                      <p>🥣 {cleanText(baseMeal.soup.name)}</p>
                    ) : baseMeal?.soup?.name === 'Solo bandeja' ? (
                      <p>🥣 Solo bandeja</p>
                    ) : (
                      <p>🥣 Sin sopa</p>
                    )
                  )}
                  {!hasPrincipleDifferences && (
                    baseMeal?.principleReplacement ? (
                      <p>🍚 {cleanText(baseMeal.principleReplacement.name)}</p>
                    ) : baseMeal?.principle?.name && baseMeal.principle.name !== 'Sin principio' ? (
                      <p>🍚 {cleanText(baseMeal.principle.name)}</p>
                    ) : (
                      <p>🍚 Sin principio</p>
                    )
                  )}
                  {!hasProteinDifferences && baseMeal?.protein && <p>🍗 {cleanText(baseMeal.protein.name)}</p>}
                  {!hasDrinkDifferences && <p>🥤 {drinkName}</p>}
                  {!hasSidesDifferences && baseMeal?.sides?.length > 0 && (
                    <p>🥗 {baseMeal.sides.map(s => cleanText(s.name)).join(', ')}</p>
                  )}
                  {!hasNotesDifferences && <p>📝 Notas: {note}</p>}

                  {group.differences.length > 0 && group.differences.some(d => d.diffs.length > 0) && (
                    <div className="mt-2">
                      <p className="font-medium">🔄 Diferencias:</p>
                      <div className="ml-2">
                        {(() => {
                          const diffOrder = ['Sopa', 'Principio', 'Proteína', 'Bebida', 'Acompañamientos', 'Notas', 'Entrega', 'Dirección', 'Pago', 'Cubiertos'];
                          const diffItems = group.originalIndices.reduce((acc, idx) => ({ ...acc, [idx]: [] }), {});

                          group.differences.forEach(diff => {
                            diff.diffs.forEach(d => {
                              let formattedValue1, formattedValue2;
                              if (d.field === 'Sopa') {
                                formattedValue1 = d.value1 === 'Sin sopa' && d.replacement1 ? `🥣 ${cleanText(d.replacement1)} (en lugar de sopa)` : `🥣 ${cleanText(d.value1) || 'Sin sopa'}`;
                                formattedValue2 = d.value2 === 'Sin sopa' && d.replacement2 ? `🥣 ${cleanText(d.replacement2)} (en lugar de sopa)` : `🥣 ${cleanText(d.value2) || 'Sin sopa'}`;
                              } else if (d.field === 'Principio') {
                                formattedValue1 = d.value1 === 'Sin principio' && d.replacement1 ? `🍚 ${cleanText(d.replacement1)} (por principio)` : `🍚 ${cleanText(d.value1) || 'Sin principio'}`;
                                formattedValue2 = d.value2 === 'Sin principio' && d.replacement2 ? `🍚 ${cleanText(d.replacement2)} (por principio)` : `🍚 ${cleanText(d.value2) || 'Sin principio'}`;
                              } else if (d.field === 'Proteína') {
                                formattedValue1 = `🍗 ${cleanText(d.value1) || 'Sin proteína'}`;
                                formattedValue2 = `🍗 ${cleanText(d.value2) || 'Sin proteína'}`;
                              } else if (d.field === 'Bebida') {
                                formattedValue1 = `🥤 ${cleanText(d.value1) || 'Sin bebida'}`;
                                formattedValue2 = `🥤 ${cleanText(d.value2) || 'Sin bebida'}`;
                              } else if (d.field === 'Acompañamientos') {
                                formattedValue1 = `🥗 ${cleanText(d.value1) || 'Sin acompañamientos'}`;
                                formattedValue2 = `🥗 ${cleanText(d.value2) || 'Sin acompañamientos'}`;
                              } else if (d.field === 'Notas') {
                                formattedValue1 = `📝 ${d.value1 || 'Ninguna'}`;
                                formattedValue2 = `📝 ${d.value2 || 'Ninguna'}`;
                              } else if (d.field === 'Entrega') {
                                formattedValue1 = `🕒 ${cleanText(d.value1)}`;
                                formattedValue2 = `🕒 ${cleanText(d.value2)}`;
                              } else if (d.field === 'Dirección') {
                                formattedValue1 = `📍 ${d.value1 || 'No especificada'}`;
                                formattedValue2 = `📍 ${d.value2 || 'No especificada'}`;
                              } else if (d.field === 'Pago') {
                                formattedValue1 = d.value1 !== 'No especificado' ? `${d.value1} = ${calculateMealPrice(meals[group.originalIndices[0]]).toLocaleString()} Mil` : 'No especificado';
                                formattedValue2 = d.value2 !== 'No especificado' ? `${d.value2} = ${calculateMealPrice(meals[diff.originalIndex]).toLocaleString()} Mil` : 'No especificado';
                              } else if (d.field === 'Cubiertos') {
                                formattedValue1 = `🍴 Cubiertos: ${d.value1}`;
                                formattedValue2 = `🍴 Cubiertos: ${d.value2}`;
                              } else {
                                formattedValue1 = `${d.field}: ${cleanText(d.value1) || 'Ninguno'}`;
                                formattedValue2 = `${d.field}: ${cleanText(d.value2) || 'Ninguno'}`;
                              }
                              diffItems[group.originalIndices[0]].push({ field: d.field, value: formattedValue1, order: diffOrder.indexOf(d.field) });
                              diffItems[diff.originalIndex].push({ field: d.field, value: formattedValue2, order: diffOrder.indexOf(d.field) });
                            });
                          });

                          return Object.keys(diffItems).map(index => {
                            const sortedItems = diffItems[index].sort((a, b) => a.order - b.order);
                            return (
                              <div key={index}>
                                <p>* Almuerzo {parseInt(index) + 1}:</p>
                                {sortedItems.map((item, idx) => (
                                  <p key={idx} className="ml-2">{item.value}</p>
                                ))}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}

                  {!hasTimeDifferences && <p>🕒 Entrega: {timeName}</p>}
                  {!hasAddressDifferences && (
                    <>
                      <p>📍 Dirección: {baseMeal?.address || 'No especificada'}</p>
                      {baseMeal?.address && <p className="text-green-600">✅ Dirección confirmada</p>}
                    </>
                  )}
                  {!hasCutleryDifferences && <p>🍴 Cubiertos: {baseMeal?.cutlery ? 'Sí' : 'No'}</p>}
                </div>
              </div>
            );
          })}

          <div className="pt-2 xs:pt-4 border-t">
            <p className="total-price text-[10px] xs:text-sm sm:text-base font-bold text-right">
              Total: <span className="text-green-600">${total.toLocaleString()}</span>
            </p>
            <div className="mt-1 xs:mt-2 p-1 xs:p-2 bg-yellow-100 text-gray-800 text-[10px] xs:text-xs sm:text-sm rounded">
              <p><strong>💳 Instrucciones de pago:</strong></p>
              <p>Envía al número 313 850 5647 (Nequi o DaviPlata):</p>
              {Object.entries(paymentSummary).map(([method, amount]) => (
                <p key={method}>* {method} ${amount.toLocaleString()}</p>
              ))}
              <p className="mt-2"><strong>💰 Total: ${total.toLocaleString()}</strong></p>
              <p>🕐 Entrega estimada: 20–30 minutos.</p>
              <p>Si estás cerca del local, será aún más rápido.</p>
            </div>
            <button
              onClick={onSendOrder}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-1 xs:py-2 rounded-lg mt-2 xs:mt-4 transition-colors flex items-center justify-center text-[10px] xs:text-xs sm:text-sm"
              aria-label="Enviar pedido a WhatsApp"
            >
              <span className="mr-1 xs:mr-2">Enviar pedido a WhatsApp</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 xs:h-4 w-3 xs:w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.479 5.392 1.479 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderSummary;