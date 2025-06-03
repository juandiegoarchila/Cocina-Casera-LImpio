import { useMemo } from 'react';
import { calculateMealPrice } from '../utils/MealLogic';
import { isValidTime, isValidNote, formatNotes } from '../utils/MealLogic';

const OrderSummary = ({ meals, onSendOrder, calculateTotal }) => {
  const cleanText = (text) => text?.replace(' NUEVO', '') || 'No seleccionado';

  const total = useMemo(() => calculateTotal(meals), [meals, calculateTotal]);

  const paymentSummary = (meals) => {
    if (!meals || meals.length === 0) return {};
    return meals.reduce((acc, meal) => {
      const price = calculateMealPrice(meal);
      const paymentMethod = meal?.payment?.name || 'No especificado';
      acc[paymentMethod] = (acc[paymentMethod] || 0) + price;
      return acc;
    }, {});
  };

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
        if (JSON.stringify(meal1.principle?.map(p => p.name).sort()) !== JSON.stringify(meal2.principle?.map(p => p.name).sort()) || meal1.principleReplacement?.name !== meal2.principleReplacement?.name) {
          differences.push({
            field: 'Principio',
            value1: meal1.principle?.map(p => p.name).join(', ') || 'Sin principio',
            value2: meal2.principle?.map(p => p.name).join(', ') || 'Sin principio',
            replacement1: meal1.principleReplacement?.name,
            replacement2: meal2.principleReplacement?.name
          });
        }
        if (meal1.protein?.name !== meal2.protein?.name) {
          differences.push({ field: 'Proteína', value1: meal1.protein?.name, value2: meal2.protein?.name });
        }
        if (meal1.drink?.name !== meal2.drink?.name) {
          differences.push({ field: 'Bebida', value1: meal1.drink?.name, value2: meal2.drink?.name });
        }
        if ((meal1.cutlery ?? false) !== (meal2.cutlery ?? false)) {
          differences.push({ field: 'Cubiertos', value1: meal1.cutlery ? 'Sí' : 'No', value2: meal2.cutlery ? 'Sí' : 'No' });
        }
        if (JSON.stringify(meal1.sides?.map(s => s.name).sort()) !== JSON.stringify(meal2.sides?.map(s => s.name).sort())) {
          differences.push({ 
            field: 'Acompañamientos', 
            value1: meal1.sides?.map(s => s.name).join(', ') || 'Sin acompañamientos', 
            value2: meal2.sides?.map(s => s.name).join(', ') || 'Sin acompañamientos' 
          });
        }
        if (
          JSON.stringify(meal1.additions?.map((a) => a.name).sort()) !== JSON.stringify(meal2.additions?.map((a) => a.name).sort()) ||
          JSON.stringify(meal1.additions?.map((a) => a.protein || a.replacement).sort()) !== JSON.stringify(meal2.additions?.map((a) => a.protein || a.replacement).sort())
        ) {
          differences.push({ 
            field: 'Adiciones', 
            value1: meal1.additions?.map((a) => `${a.name}${a.protein || a.replacement ? ` (${a.protein || a.replacement})` : ''}`).join(', ') || 'Ninguna', 
            value2: meal2.additions?.map((a) => `${a.name}${a.protein || a.replacement ? ` (${a.protein || a.replacement})` : ''}`).join(', ') || 'Ninguna' 
          });
        }
        if (meal1.notes !== meal2.notes) {
          differences.push({ field: 'Notas', value1: meal1.notes || 'Ninguna', value2: meal2.notes || 'Ninguna' });
        }
        if (meal1.time?.name !== meal2.time?.name) {
          differences.push({ field: 'Entrega', value1: meal1.time?.name || 'Lo más rápido', value2: meal2.time?.name || 'Lo más rápido' });
        }
        // Address comparison with optimized difference detection
        if (
          meal1.address?.address !== meal2.address?.address ||
          meal1.address?.addressType !== meal2.address?.addressType ||
          meal1.address?.phoneNumber !== meal2.address?.phoneNumber ||
          meal1.address?.unitDetails !== meal2.address?.unitDetails ||
          meal1.address?.localName !== meal2.address?.localName ||
          meal1.address?.recipientName !== meal2.address?.recipientName
        ) {
          differences.push({ 
            field: 'address', 
            value1: meal1.address?.address, 
            value2: meal2.address?.address,
            addressDetails1: {
              addressType: meal1.address?.addressType,
              phoneNumber: meal1.address?.phoneNumber,
              unitDetails: meal1.address?.unitDetails,
              localName: meal1.address?.localName,
              recipientName: meal1.address?.recipientName
            },
            addressDetails2: {
              addressType: meal2.address?.addressType,
              phoneNumber: meal2.address?.phoneNumber,
              unitDetails: meal2.address?.unitDetails,
              localName: meal2.address?.localName,
              recipientName: meal2.address?.recipientName
            }
          });
        }
        if (meal1.payment?.name !== meal2.payment?.name) {
          differences.push({ field: 'Pago', value1: meal1.payment?.name || 'No especificado', value2: meal2.payment?.name || 'No especificado' });
        }

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
            💰 Total: <span className="text-green-600">${total.toLocaleString('es-CO')}</span>
          </p>

          {groupedMeals.map((group, index) => {
            const baseMeal = group.meals[0];
            const count = group.meals.length;
            const totalPrice = group.meals.reduce((sum, m) => sum + calculateMealPrice(m), 0);
            const paymentNames = Array.from(group.payments).filter(name => name && name !== 'No especificado');
            const paymentText = paymentNames.length > 0 ? `(${paymentNames.join(' y ')})` : '(No especificado)';
            const drinkName = baseMeal?.drink?.name === 'Juego de mango' ? 'Jugo de mango' : cleanText(baseMeal?.drink?.name);
            const timeName = isValidTime(baseMeal.time) ? cleanText(baseMeal.time.name) : 'Lo más rápido';
            const note = formatNotes(baseMeal.notes);

            const hasSoupDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Sopa'));
            const hasPrincipleDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Principio'));
            const hasProteinDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Proteína'));
            const hasDrinkDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Bebida'));
            const hasSidesDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Acompañamientos'));
            const hasAdditionsDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Adiciones'));
            const hasNotesDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Notas'));
            const hasTimeDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Entrega'));
            const hasAddressDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'address'));
            const hasPaymentDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Pago'));
            const hasCutleryDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Cubiertos'));

            return (
              <div key={index} className="border-b pb-2 xs:pb-4 last:border-b-0">
                <h3 className="font-medium text-gray-800 mb-1 xs:mb-2 text-[10px] xs:text-xs sm:text-sm">
                  {count > 1 ? `🍽 ${count} Almuerzos iguales – $${totalPrice.toLocaleString('es-CO')} ${paymentText}` : `🍽 ${count} Almuerzo – $${totalPrice.toLocaleString('es-CO')} ${paymentText}`}
                </h3>

                {/* 1. Sopa */}
                {!hasSoupDifferences && (
                  <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600">
                    {baseMeal?.soupReplacement?.name
                      ? `${cleanText(baseMeal.soupReplacement.name)} (por sopa)`
                      : baseMeal?.soup?.name && baseMeal.soup.name !== 'Sin sopa' && baseMeal.soup.name !== 'Solo bandeja'
                      ? `${cleanText(baseMeal.soup.name)}`
                      : baseMeal?.soup?.name === 'Solo bandeja'
                      ? `solo bandeja`
                      : `Sin sopa`}
                  </p>
                )}

                {/* 2. Principio */}
                {!hasPrincipleDifferences && (
                  <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600">
                    {baseMeal?.principle?.length > 0
                      ? baseMeal?.principleReplacement?.name
                        ? `${cleanText(baseMeal.principleReplacement.name)} (por principio)`
                        : `${baseMeal.principle.map(p => cleanText(p.name)).join(', ')}${baseMeal.principle.length > 1 ? ' (mixto)' : ''}`
                      : `Sin principio`}
                  </p>
                )}

                {/* 3. Proteína */}
                {(() => {
                  const isSpecialRice = baseMeal?.principle?.some(p => ['Arroz con pollo', 'Arroz paisa', 'Arroz tres carnes'].includes(p.name));
                  return !isSpecialRice && !hasProteinDifferences && (
                    <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600">
                      {baseMeal?.protein?.name ? `${cleanText(baseMeal.protein.name)}` : `Sin proteína`}
                    </p>
                  );
                })()}

                {/* 4. Bebida */}
                {!hasDrinkDifferences && (
                  <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600">
                    {drinkName}
                  </p>
                )}

                {/* 5. Cubiertos */}
                {!hasCutleryDifferences && (
                  <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600">
                    Cubiertos: {baseMeal?.cutlery ? 'Sí' : 'No'}
                  </p>
                )}

                {/* 9. Acompañamientos */}
                {(() => {
                  const isSpecialRice = baseMeal?.principle?.some(p => ['Arroz con pollo', 'Arroz paisa', 'Arroz tres carnes'].includes(p.name));
                  return !hasSidesDifferences && (
                    <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600">
                      {isSpecialRice 
                        ? 'Acompañamientos ya incluidos'
                        : baseMeal?.sides?.length > 0 
                          ? `${baseMeal.sides.map(s => cleanText(s.name)).join(', ')}${baseMeal.sides.length > 1 ? ' (mixto)' : ''}` 
                          : 'Sin acompañamientos'}
                    </p>
                  );
                })()}

                {/* 10. Adiciones opcionales */}
                {!hasAdditionsDifferences && baseMeal?.additions?.length > 0 && (
                  <div className="text-[10px] xs:text-xs sm:text-sm text-gray-600">
                    <p>➕ Adiciones:</p>
                    {baseMeal.additions.map((a, idx) => (
                      <p key={idx} className="ml-2">
                        - {cleanText(a.name)}{a.protein || a.replacement ? ` (${a.protein || a.replacement})` : ''} ({a.quantity || 1})
                      </p>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {!hasNotesDifferences && note !== 'Ninguna' && (
                  <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600">
                    Notas: {note}
                  </p>
                )}

                {/* Differences Section */}
                {group.differences.length > 0 && group.differences.some(d => d.diffs.length > 0) && (
                  <div className="mt-1">
                    <p className="text-[10px] xs:text-xs sm:text-sm font-medium text-gray-600">🔄 Diferencias:</p>
                    {(() => {
                      // Extract address differences for optimization
                      const addressDiff = group.differences[0]?.diffs.find(diff => diff.field === 'address');
                      const sharedAddress = addressDiff && addressDiff.value1 === addressDiff.value2 ? addressDiff.value1 : null;
                      const sharedPhone = addressDiff && addressDiff.addressDetails1?.phoneNumber === addressDiff.addressDetails2?.phoneNumber ? addressDiff.addressDetails1?.phoneNumber : null;

                      return (
                        <>
                          {sharedAddress && (
                            <div className="text-[10px] xs:text-xs sm:text-sm text-gray-600 ml-2">
                              <p>📍 Dirección compartida: {sharedAddress}</p>
                              {sharedPhone && <p>📞 Teléfono compartido: {sharedPhone}</p>}
                            </div>
                          )}
                          {group.differences.map((diff, idx) => {
                            const meal2 = meals[diff.originalIndex];
                            return (
                              <div key={idx} className="ml-2">
                                {idx === 0 && (
                                  <div>
                                    <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600">
                                      * Almuerzo {group.originalIndices[0] + 1}:
                                    </p>
                                    {hasSoupDifferences && (
                                      <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600 ml-2">
                                        {baseMeal?.soupReplacement?.name
                                          ? `${cleanText(baseMeal.soupReplacement.name)} (por sopa)`
                                          : baseMeal?.soup?.name && baseMeal.soup.name !== 'Sin sopa' && baseMeal.soup.name !== 'Solo bandeja'
                                          ? `${cleanText(baseMeal.soup.name)}`
                                          : baseMeal?.soup?.name === 'Solo bandeja'
                                          ? `solo bandeja`
                                          : `Sin sopa`}
                                      </p>
                                    )}
                                    {hasPrincipleDifferences && (
                                      <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600 ml-2">
                                        {baseMeal?.principleReplacement?.name
                                          ? `${cleanText(baseMeal.principleReplacement.name)} (por principio)`
                                          : baseMeal?.principle?.length > 0
                                          ? `${baseMeal.principle.map(p => cleanText(p.name)).join(', ')}${baseMeal.principle.length > 1 ? ' (mixto)' : ''}`
                                          : `Sin principio`}
                                      </p>
                                    )}
                                    {hasProteinDifferences && baseMeal?.protein?.name && (
                                      <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600 ml-2">
                                        {cleanText(baseMeal.protein.name)}
                                      </p>
                                    )}
                                    {hasDrinkDifferences && (
                                      <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600 ml-2">
                                        {baseMeal?.drink?.name === 'Juego de mango' ? 'Jugo de mango' : cleanText(baseMeal.drink?.name)}
                                      </p>
                                    )}
                                    {hasCutleryDifferences && (
                                      <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600 ml-2">
                                        Cubiertos: {baseMeal?.cutlery ? 'Sí' : 'No'}
                                      </p>
                                    )}
                                    {hasSidesDifferences && (
                                      <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600 ml-2">
                                        {baseMeal?.principle?.some(p => ['Arroz con pollo', 'Arroz paisa', 'Arroz tres carnes'].includes(p.name))
                                          ? 'Acompañamientos ya incluidos'
                                          : baseMeal?.sides?.length > 0 
                                            ? `${baseMeal.sides.map(s => cleanText(s.name)).join(', ')}${baseMeal.sides.length > 1 ? ' (mixto)' : ''}` 
                                            : 'Sin acompañamientos'}
                                      </p>
                                    )}
                                    {hasAdditionsDifferences && (
                                      <div className="text-[10px] xs:text-xs sm:text-sm text-gray-600 ml-2">
                                        <p>➕ Adiciones:</p>
                                        {baseMeal.additions?.length > 0 ? (
                                          baseMeal.additions.map((a, idx) => (
                                            <p key={idx} className="ml-2">
                                              - {cleanText(a.name)}{a.protein || a.replacement ? ` (${a.protein || a.replacement})` : ''} ({a.quantity || 1})
                                            </p>
                                          ))
                                        ) : (
                                          <p className="ml-2">Ninguna</p>
                                        )}
                                      </div>
                                    )}
                                    {hasNotesDifferences && (
                                      <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600 ml-2">
                                        Notas: {formatNotes(baseMeal.notes)}
                                      </p>
                                    )}
                                    {hasTimeDifferences && (
                                      <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600 ml-2">
                                        🕒 Entrega: {isValidTime(baseMeal.time) ? cleanText(baseMeal.time.name) : 'Lo más rápido'}
                                      </p>
                                    )}
                                    {hasAddressDifferences && !sharedAddress && (
                                      <div className="text-[10px] xs:text-xs sm:text-sm text-gray-600 ml-2">
                                        <p>📍 Dirección: {baseMeal?.address?.address || 'No especificada'}</p>
                                        {baseMeal?.address?.addressType && (
                                          <p>
                                            🏠 Lugar de entrega: {baseMeal.address.addressType === 'house'
                                              ? 'Casa/Apartamento Individual'
                                              : baseMeal.address.addressType === 'school'
                                              ? 'Colegio/Oficina'
                                              : baseMeal.address.addressType === 'complex'
                                              ? 'Conjunto Residencial'
                                              : 'Tienda/Local'}
                                          </p>
                                        )}
                                        {baseMeal?.address?.recipientName && (
                                          <p>👤 Receptor: {baseMeal.address.recipientName}</p>
                                        )}
                                        {baseMeal?.address?.unitDetails && (
                                          <p>🏢 Detalles: {baseMeal.address.unitDetails}</p>
                                        )}
                                        {baseMeal?.address?.localName && (
                                          <p>🏬 Nombre del local: {baseMeal.address.localName}</p>
                                        )}
                                        {baseMeal?.address?.phoneNumber && (
                                          <p>📞 Teléfono: {baseMeal.address.phoneNumber}</p>
                                        )}
                                      </div>
                                    )}
                                    {hasAddressDifferences && sharedAddress && (
                                      <div className="text-[10px] xs:text-xs sm:text-sm text-gray-600 ml-2">
                                        {baseMeal?.address?.addressType && (
                                          <p>
                                            🏠 Lugar de entrega: {baseMeal.address.addressType === 'house'
                                              ? 'Casa/Apartamento Individual'
                                              : baseMeal.address.addressType === 'school'
                                              ? 'Colegio/Oficina'
                                              : baseMeal.address.addressType === 'complex'
                                              ? 'Conjunto Residencial'
                                              : 'Tienda/Local'}
                                          </p>
                                        )}
                                        {baseMeal?.address?.recipientName && (
                                          <p>👤 Receptor: {baseMeal.address.recipientName}</p>
                                        )}
                                        {baseMeal?.address?.unitDetails && (
                                          <p>🏢 Detalles: {baseMeal.address.unitDetails}</p>
                                        )}
                                        {baseMeal?.address?.localName && (
                                          <p>🏬 Nombre del local: {baseMeal.address.localName}</p>
                                        )}
                                      </div>
                                    )}
                                    {hasPaymentDifferences && (
                                      <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600 ml-2">
                                        Método de pago: {baseMeal?.payment?.name || 'No especificado'}
                                      </p>
                                    )}
                                  </div>
                                )}
                                <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600">
                                  * Almuerzo {diff.originalIndex + 1}:
                                </p>
                                {diff.diffs.map((d, dIdx) => {
                                  let formattedValue;
                                  if (d.field === 'Sopa') {
                                    formattedValue = d.replacement2
                                      ? `${cleanText(d.replacement2)} (por sopa)`
                                      : d.value2 && d.value2 !== 'Sin sopa' && d.value2 !== 'Solo bandeja'
                                      ? `${cleanText(d.value2)}`
                                      : d.value2 === 'Solo bandeja'
                                      ? `solo bandeja`
                                      : `Sin sopa`;
                                  } else if (d.field === 'Principio') {
                                    formattedValue = d.replacement2 
                                      ? `${cleanText(d.replacement2)} (por principio)` 
                                      : `${cleanText(d.value2)}${meal2?.principle?.length > 1 ? ' (mixto)' : ''}`;
                                  } else if (d.field === 'Proteína') {
                                    formattedValue = `${cleanText(d.value2) || 'Sin proteína'}`;
                                  } else if (d.field === 'Bebida') {
                                    formattedValue = d.value2 === 'Juego de mango' ? 'Jugo de mango' : `${cleanText(d.value2) || 'Sin bebida'}`;
                                  } else if (d.field === 'Cubiertos') {
                                    formattedValue = `Cubiertos: ${d.value2}`;
                                  } else if (d.field === 'Entrega') {
                                    formattedValue = `🕒 Entrega: ${d.value2 || 'Lo más rápido'}`;
                                  } else if (d.field === 'address') {
                                    formattedValue = !sharedAddress ? (
                                      <div>
                                        <p>📍 Dirección: {d.value2 || 'No especificada'}</p>
                                        {d.addressDetails2?.addressType && (
                                          <p>
                                            🏠 Lugar de entrega: {d.addressDetails2.addressType === 'house'
                                              ? 'Casa/Apartamento Individual'
                                              : d.addressDetails2.addressType === 'school'
                                              ? 'Colegio/Oficina'
                                              : d.addressDetails2.addressType === 'complex'
                                              ? 'Conjunto Residencial'
                                              : 'Tienda/Local'}
                                          </p>
                                        )}
                                        {d.addressDetails2?.recipientName && (
                                          <p>👤 Receptor: {d.addressDetails2.recipientName}</p>
                                        )}
                                        {d.addressDetails2?.unitDetails && (
                                          <p>🏢 Detalles: {d.addressDetails2.unitDetails}</p>
                                        )}
                                        {d.addressDetails2?.localName && (
                                          <p>🏬 Nombre del local: {d.addressDetails2.localName}</p>
                                        )}
                                        {d.addressDetails2?.phoneNumber && (
                                          <p>📞 Teléfono: {d.addressDetails2.phoneNumber}</p>
                                        )}
                                      </div>
                                    ) : (
                                      <div>
                                        {d.addressDetails2?.addressType && (
                                          <p>
                                            🏠 Lugar de entrega: {d.addressDetails2.addressType === 'house'
                                              ? 'Casa/Apartamento Individual'
                                              : d.addressDetails2.addressType === 'school'
                                              ? 'Colegio/Oficina'
                                              : d.addressDetails2.addressType === 'complex'
                                              ? 'Conjunto Residencial'
                                              : 'Tienda/Local'}
                                          </p>
                                        )}
                                        {d.addressDetails2?.recipientName && (
                                          <p>👤 Receptor: {d.addressDetails2.recipientName}</p>
                                        )}
                                        {d.addressDetails2?.unitDetails && (
                                          <p>🏢 Detalles: {d.addressDetails2.unitDetails}</p>
                                        )}
                                        {d.addressDetails2?.localName && (
                                          <p>🏬 Nombre del local: {d.addressDetails2.localName}</p>
                                        )}
                                      </div>
                                    );
                                  } else if (d.field === 'Pago') {
                                    formattedValue = `Método de pago: ${d.value2 !== 'No especificado' ? d.value2 : 'No especificado'}`;
                                  } else if (d.field === 'Acompañamientos') {
                                    formattedValue = meal2?.principle?.some(p => ['Arroz con pollo', 'Arroz paisa', 'Arroz tres carnes'].includes(p.name))
                                      ? 'Acompañamientos ya incluidos'
                                      : `${d.value2}${meal2?.sides?.length > 1 ? ' (mixto)' : ''}`;
                                  } else if (d.field === 'Adiciones') {
                                    formattedValue = `➤ Adiciones: ${d.value2 || 'Ninguna'}`;
                                  } else if (d.field === 'Notas') {
                                    formattedValue = `Notas: ${d.value2 || 'Ninguna'}`;
                                  } else {
                                    formattedValue = `${d.value2 || 'Ninguno'}`;
                                  }
                                  return (
                                    <div key={dIdx} className="text-[10px] xs:text-xs sm:text-sm text-gray-600 ml-2">
                                      {formattedValue}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* 6. Entrega */}
                {!hasTimeDifferences && (
                  <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600">
                    🕒 Entrega: {timeName}
                  </p>
                )}

                {/* 7. Dirección */}
                {!hasAddressDifferences && (
                  <div className="text-[10px] xs:text-xs sm:text-sm text-gray-600">
                    <p>📍 Dirección: {baseMeal?.address?.address || 'No especificada'}</p>
                    {baseMeal?.address?.addressType && (
                      <p>
                        🏠 Lugar de entrega: {baseMeal.address.addressType === 'house'
                          ? 'Casa/Apartamento Individual'
                          : baseMeal.address.addressType === 'school'
                          ? 'Colegio/Oficina'
                          : baseMeal.address.addressType === 'complex'
                          ? 'Conjunto Residencial'
                          : 'Tienda/Local'}
                      </p>
                    )}
                    {baseMeal?.address?.recipientName && (
                      <p>👤 Receptor: {baseMeal.address.recipientName}</p>
                    )}
                    {baseMeal?.address?.unitDetails && (
                      <p>🏢 Detalles: {baseMeal.address.unitDetails}</p>
                    )}
                    {baseMeal?.address?.localName && (
                      <p>🏬 Nombre del local: {baseMeal.address.localName}</p>
                    )}
                    {baseMeal?.address?.phoneNumber && (
                      <p>📞 Teléfono: {baseMeal.address.phoneNumber}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* 8. Método de pago (for all meals) */}
          <div className="pt-2 xs:pt-4 border-t">
            <p className="total-price text-[10px] xs:text-sm sm:text-base font-bold text-right">
              Total: <span className="text-green-600">${total.toLocaleString('es-CO')}</span>
            </p>
            <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600 mt-1">
              💳 Instrucciones de pago: Envía al número 313 850 4417 (Nequi o DaviPlata):<br />
              {Object.entries(paymentSummary(meals)).map(([method, amount]) => (
                method !== 'No especificado' && amount > 0 && (
                  <span key={method}>
                    🔹 {method}: ${amount.toLocaleString('es-CO')}<br />
                  </span>
                )
              ))}
            </p>
            <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600 mt-1">
              💰 Total: <span className="text-green-600">${total.toLocaleString('es-CO')}</span>
            </p>
            <p className="text-[10px] xs:text-xs sm:text-sm text-gray-600 mt-1">
              🕐 Entrega estimada: 20–30 minutos. Si estás cerca del local, será aún más rápido.
            </p>
            <button
              onClick={onSendOrder}
              disabled={!meals || meals.length === 0}
              className={`w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg mt-2 xs:mt-4 transition-colors text-xs xs:text-sm sm:text-base ${!meals || meals.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Enviar Pedido por WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderSummary;