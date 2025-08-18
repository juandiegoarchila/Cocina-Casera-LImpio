// src/components/OrderSummary.js
import { useMemo } from 'react';
import { isValidTime, formatNotes } from '../utils/MealLogic';
import { calculateMealPrice } from '../utils/MealCalculations';

// Constantes globales
const fieldsToCheck = ['Sopa', 'Principio', 'Proteína', 'Bebida', 'Cubiertos', 'Acompañamientos', 'Hora', 'Dirección', 'Pago', 'Adiciones', 'Mesa'];
const addressFields = ['address', 'addressType', 'recipientName', 'phoneNumber', 'unitDetails', 'localName'];
const specialRiceOptions = ['Arroz con pollo', 'Arroz paisa', 'Arroz tres carnes'];

// Función utilitaria para limpiar texto
const cleanText = (text) => {
  if (!text || text === 'Remplazo por Principio' || text === 'Reemplazo por Principio') return 'Sin reemplazo';
  return text.replace(' NUEVO', '') || 'Sin reemplazo';
};

// Hook personalizado para manejar la lógica de resumen
const useOrderSummary = (meals, isWaiterView) => {
  const getFieldValue = (meal, field) => {
    if (!meal) return '';
    if (field === 'Sopa') {
      if (meal.soup?.name === 'Solo bandeja') return 'solo bandeja';
      if (meal.soupReplacement?.name) return JSON.stringify({ name: cleanText(meal.soupReplacement.name), type: 'por sopa' });
      if (meal.soup?.name && meal.soup.name !== 'Sin sopa') return cleanText(meal.soup.name);
      return 'Sin sopa';
    } else if (field === 'Principio') {
      const principleNames = meal.principle?.map(p => cleanText(p.name)).sort() || [];
      const replacement = meal.principleReplacement?.name ? cleanText(meal.principleReplacement.name) : '';
      return JSON.stringify([principleNames.join(','), replacement]);
    } else if (field === 'Proteína') {
      return cleanText(meal.protein?.name || 'Sin proteína');
    } else if (field === 'Bebida') {
      return cleanText(meal.drink?.name || 'Sin bebida');
    } else if (field === 'Cubiertos') {
      return meal.cutlery ? 'Sí' : 'No';
    } else if (field === 'Acompañamientos') {
      return JSON.stringify(meal.sides?.map(s => cleanText(s.name)).sort() || []);
    } else if (field === 'Hora') {
      return meal.time?.name || 'No especificada';
    } else if (field === 'Dirección') {
      return JSON.stringify(addressFields.map(f => meal.address?.[f] || ''));
    } else if (field === 'Pago') {
      return meal.payment?.name || meal.paymentMethod?.name || 'No especificado';
    } else if (field === 'Adiciones') {
      return JSON.stringify(
        meal.additions?.map(a => ({
          name: cleanText(a.name),
          protein: a.protein || '',
          replacement: a.replacement || '',
          quantity: a.quantity || 1,
        })).sort((a, b) => a.name.localeCompare(b.name)) || []
      );
    } else if (field === 'Mesa') {
      return meal.tableNumber || 'No especificada';
    }
    return '';
  };

  const groupedMeals = useMemo(() => {
    if (!meals || meals.length === 0) {
      return {
        groupedMeals: [],
        commonDeliveryTime: null,
        commonAddressFields: {},
        globalCommonFields: new Set(),
        areAddressesGloballyCommon: false,
        areCoreAddressesCommon: false,
      };
    }

    const groups = [];
    const firstMeal = meals[0];
    const commonDeliveryTime = meals.every(meal => meal.time?.name === firstMeal?.time?.name) ? firstMeal?.time?.name : null;

    const commonAddressFields = {};
    let areAddressesGloballyCommon = true;
    let areCoreAddressesCommon = true;
    addressFields.forEach(field => {
      const isCommon = meals.every(meal => meal.address?.[field] === firstMeal?.address?.[field]);
      commonAddressFields[field] = isCommon ? firstMeal?.address?.[field] : null;
      if (!isCommon && field !== 'recipientName' && field !== 'unitDetails' && field !== 'localName') {
        areAddressesGloballyCommon = false;
      }
      if (!isCommon && (field === 'address' || field === 'phoneNumber')) {
        areCoreAddressesCommon = false;
      }
    });

    const globalCommonFields = new Set(fieldsToCheck.filter(field => {
      const firstValue = getFieldValue(firstMeal, field);
      return meals.every(meal => getFieldValue(meal, field) === firstValue);
    }));

    const mealGroups = new Map();
    meals.forEach((meal, index) => {
      let assigned = false;
      for (let [, groupData] of mealGroups) {
        const refMeal = groupData.meals[0];
        let differences = 0;
        fieldsToCheck.forEach(field => {
          if (getFieldValue(meal, field) !== getFieldValue(refMeal, field)) {
            differences++;
          }
        });
        if (differences <= 3) {
          groupData.meals.push(meal);
          groupData.indices.push(index);
          if (meal.payment?.name || meal.paymentMethod?.name) {
            groupData.payments.add(meal.payment?.name || meal.paymentMethod?.name);
          }
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        const key = `${index}|${fieldsToCheck.map(field => getFieldValue(meal, field)).join('|')}`;
        mealGroups.set(key, {
          meals: [meal],
          indices: [index],
          payments: new Set((meal.payment?.name || meal.paymentMethod?.name) ? [meal.payment?.name || meal.paymentMethod?.name] : []),
        });
      }
    });

    mealGroups.forEach((groupData) => {
      const mealsInGroup = groupData.meals;
      const group = {
        meals: mealsInGroup,
        payments: groupData.payments,
        originalIndices: groupData.indices,
      };
      group.commonFieldsInGroup = new Set(fieldsToCheck.filter(field => {
        const firstValue = getFieldValue(mealsInGroup[0], field);
        return mealsInGroup.every(meal => getFieldValue(meal, field) === firstValue);
      }));
      group.commonAddressFieldsInGroup = {};
      addressFields.forEach(field => {
        const isCommon = mealsInGroup.every(meal => meal.address?.[field] === mealsInGroup[0].address?.[field]);
        group.commonAddressFieldsInGroup[field] = isCommon ? mealsInGroup[0].address?.[field] : null;
      });
      const identicalGroups = new Map();
      mealsInGroup.forEach((meal, idx) => {
        const key = fieldsToCheck.map(field => getFieldValue(meal, field)).join('|');
        if (!identicalGroups.has(key)) {
          identicalGroups.set(key, { meals: [], indices: [] });
        }
        identicalGroups.get(key).meals.push(meal);
        identicalGroups.get(key).indices.push(groupData.indices[idx]);
      });
      group.identicalGroups = Array.from(identicalGroups.values());
      groups.push(group);
    });

    return {
      groupedMeals: groups,
      commonDeliveryTime,
      commonAddressFields,
      globalCommonFields,
      areAddressesGloballyCommon,
      areCoreAddressesCommon,
    };
  }, [meals]);

  const total = useMemo(() => {
    return meals.reduce((sum, meal) => sum + calculateMealPrice(meal), 0);
  }, [meals]);

  const paymentSummary = useMemo(() => {
    if (!meals || meals.length === 0) return {};
    return meals.reduce((acc, meal) => {
      const price = calculateMealPrice(meal);
      const paymentMethod = meal.payment?.name || meal.paymentMethod?.name || 'No especificado';
      acc[paymentMethod] = (acc[paymentMethod] || 0) + price;
      return acc;
    }, {});
  }, [meals]);

  return {
    groupedMeals: groupedMeals.groupedMeals,
    total,
    paymentSummary,
    commonDeliveryTime: groupedMeals.commonDeliveryTime,
    commonAddressFields: groupedMeals.commonAddressFields,
    globalCommonFields: groupedMeals.globalCommonFields,
    areAddressesGloballyCommon: groupedMeals.areAddressesGloballyCommon,
    areCoreAddressesCommon: groupedMeals.areCoreAddressesCommon,
  };
};

// Componente para renderizar direcciones
const AddressSummary = ({ commonAddressFields = {}, mealAddress, isCommon = false, globalCommonAddressFields = {} }) => {
  const renderAddressField = (field, value, addrType) => {
    if ((field === 'address' || field === 'addressType' || field === 'phoneNumber') && globalCommonAddressFields[field] && !isCommon) {
      return null;
    }
    if (field === 'address' && value) {
      return (
        <p key={field} className="text-xs sm:text-sm text-gray-600">
          📍 Dirección: {value}
        </p>
      );
    } else if (field === 'addressType' && value) {
      return (
        <p key={field} className="text-xs sm:text-sm text-gray-600 font-medium">
          🏠 Lugar de entrega: {value === 'house' ? 'Casa/Apartamento Individual' :
            value === 'school' ? 'Colegio/Oficina' :
            value === 'complex' ? 'Conjunto Residencial' :
            value === 'shop' ? 'Tienda/Local' : 'No especificado'}
        </p>
      );
    } else if (field === 'recipientName' && addrType === 'school' && value) {
      return <p key={field} className="text-xs sm:text-sm text-gray-600">👤 Nombre: {value}</p>;
    } else if (field === 'phoneNumber' && value) {
      return (
        <p key={field} className="text-xs sm:text-sm text-gray-600 font-medium">
          📞 Teléfono: {value}
        </p>
      );
    } else if (field === 'unitDetails' && addrType === 'complex' && value) {
      return <p key={field} className="text-xs sm:text-sm text-gray-600">🏢 Detalles: {value}</p>;
    } else if (field === 'localName' && addrType === 'shop' && value) {
      return <p key={field} className="text-xs sm:text-sm text-gray-600">🏬 Nombre del local: {value}</p>;
    }
    return null;
  };

  const effectiveAddress = mealAddress || commonAddressFields;
  const effectiveAddressType = effectiveAddress?.addressType || '';

  return (
    <div className="relative">
      {addressFields.map(field => {
        const value = isCommon ? commonAddressFields[field] : effectiveAddress[field];
        return renderAddressField(field, value, effectiveAddressType);
      }).filter(Boolean)}
    </div>
  );
};

// Componente para renderizar campos de una comida
const MealFields = ({ meal, commonFields, isWaiterView }) => {
  const hasSpecialRice = meal?.principle?.some(p => specialRiceOptions.includes(p.name));

  const fields = [];
  if (commonFields.has('Sopa') || commonFields.has('all')) {
    if (meal?.soup?.name === 'Solo bandeja') {
      fields.push(<p key="soup" className="text-xs sm:text-sm text-gray-600">solo bandeja</p>);
    } else if (meal?.soupReplacement?.name) {
      fields.push(
        <p key="soup" className="text-xs sm:text-sm text-gray-600">
          {`${cleanText(meal.soupReplacement.name)} (por sopa)`}
        </p>
      );
    } else if (meal?.soup?.name && meal.soup.name !== 'Sin sopa') {
      fields.push(<p key="soup" className="text-xs sm:text-sm text-gray-600">{cleanText(meal.soup.name)}</p>);
    }
  }
  if (commonFields.has('Principio') || commonFields.has('all')) {
    if (meal?.principle?.length > 0 || meal?.principleReplacement?.name) {
      fields.push(
        <p key="principle" className="text-xs sm:text-sm text-gray-600">
          {meal?.principleReplacement?.name
            ? `${cleanText(meal.principleReplacement.name)} (por principio)`
            : `${meal.principle.map(p => cleanText(p.name)).join(', ')}${meal.principle.length > 1 ? ' (mixto)' : ''}`}
        </p>
      );
    }
  }
  if ((commonFields.has('Proteína') || commonFields.has('all')) && !hasSpecialRice) {
    fields.push(<p key="protein" className="text-xs sm:text-sm text-gray-600">{cleanText(meal.protein?.name || 'Sin proteína')}</p>);
  } else if ((commonFields.has('Proteína') || commonFields.has('all')) && hasSpecialRice) {
    fields.push(<p key="protein" className="text-xs sm:text-sm text-gray-600">Proteína: Ya incluida en el arroz</p>);
  }
  if (commonFields.has('Bebida') || commonFields.has('all')) {
    if (meal?.drink?.name) {
      const drinkName = meal.drink.name === 'Juego de mango' ? 'Jugo de mango' : cleanText(meal.drink.name);
      fields.push(<p key="drink" className="text-xs sm:text-sm text-gray-600">{drinkName}</p>);
    }
  }
  if (commonFields.has('Cubiertos') || commonFields.has('all')) {
    fields.push(<p key="cutlery" className="text-xs sm:text-sm text-gray-600">Cubiertos: {meal?.cutlery ? 'Sí' : 'No'}</p>);
  }
  if (commonFields.has('Acompañamientos') || commonFields.has('all')) {
    fields.push(
      <p key="sides" className="text-xs sm:text-sm text-gray-600">
        Acompañamientos: {hasSpecialRice ? 'Ya incluidos' : meal?.sides?.length > 0 ? meal.sides.map(s => cleanText(s.name)).join(', ') : 'Sin acompañamientos'}
      </p>
    );
  }
  if (commonFields.has('Adiciones') || commonFields.has('all')) {
    if (meal?.additions?.length > 0) {
      meal.additions.forEach((a, idx) => {
        fields.push(
          <p key={`addition-${idx}`} className="text-xs sm:text-sm text-gray-600">
            - {cleanText(a.name)}{a.protein || a.replacement ? ` (${a.protein || a.replacement})` : ''} ({a.quantity || 1})
          </p>
        );
      });
    }
  }
  if (commonFields.has('all')) {
    fields.push(<p key="notes" className="text-xs sm:text-sm text-gray-600">Notas: {formatNotes(meal.notes) || 'Ninguna'}</p>);
  }
  if ((commonFields.has('Mesa') || commonFields.has('all')) && isWaiterView && meal.tableNumber) {
    fields.push(<p key="table" className="text-xs sm:text-sm text-gray-600">Mesa: {meal.tableNumber}</p>);
  }
  return fields;
};

// Componente para un grupo de comidas
const MealGroup = ({ group, globalCommonFields, globalCommonAddressFields, isWaiterView, isTableOrder, calculateTotal }) => {
  const baseMeal = group.meals[0];
  const count = group.meals.length;
  // Usar calculateTotal para el total del grupo en la vista de mesera con isTableOrder=true
  const groupTotal = isWaiterView && isTableOrder ? calculateTotal(group.meals) : group.meals.reduce((sum, meal) => sum + calculateMealPrice(meal), 0);
  // Forzar 'No especificado' si no hay método de pago válido, según el ejemplo
  const paymentNames = Array.from(group.payments).filter(name => name && name !== 'No especificado').length > 0
    ? Array.from(group.payments).filter(name => name && name !== 'No especificado')
    : ['No especificado'];
  const paymentText = `(${paymentNames.join(' y ')})`;
  const hasDifferences = group.identicalGroups.length > 1 || group.identicalGroups.some(ig => ig.meals.length < group.meals.length);

  const getFieldValue = (meal, field) => {
    if (!meal) return null;
    if (field === 'Sopa') {
      if (meal.soup?.name === 'Solo bandeja') return 'solo bandeja';
      if (meal.soupReplacement?.name) return `${cleanText(meal.soupReplacement.name)} (por sopa)`;
      if (meal.soup?.name && meal.soup.name !== 'Sin sopa') return cleanText(meal.soup.name);
      return 'Sin sopa';
    } else if (field === 'Principio') {
      return meal?.principleReplacement?.name
        ? `${cleanText(meal.principleReplacement.name)} (por principio)`
        : `${meal.principle?.map(p => cleanText(p.name)).join(', ') || 'Sin principio'}${meal.principle?.length > 1 ? ' (mixto)' : ''}`;
    } else if (field === 'Proteína') {
      const hasSpecialRice = meal?.principle?.some(p => specialRiceOptions.includes(p.name));
      return hasSpecialRice ? 'Proteína: Ya incluida en el arroz' : cleanText(meal.protein?.name || 'Sin proteína');
    } else if (field === 'Bebida') {
      return meal.drink?.name === 'Juego de mango' ? 'Jugo de mango' : cleanText(meal.drink?.name || 'Sin bebida');
    } else if (field === 'Cubiertos') {
      return `Cubiertos: ${meal.cutlery ? 'Sí' : 'No'}`;
    } else if (field === 'Acompañamientos') {
      const hasSpecialRice = meal?.principle?.some(p => specialRiceOptions.includes(p.name));
      return `Acompañamientos: ${hasSpecialRice ? 'Ya incluidos' : meal.sides?.length > 0 ? meal.sides.map(s => cleanText(s.name)).join(', ') : 'Ninguno'}`;
    } else if (field === 'Hora') {
      return meal.time?.name ? isValidTime(meal.time) ? cleanText(meal.time.name) : 'Lo más rápido' : null;
    } else if (field === 'Pago') {
      return meal.payment?.name || meal.paymentMethod?.name || 'No especificado';
    } else if (field === 'Adiciones') {
      return meal.additions?.length > 0
        ? meal.additions.map((a, aIdx) => (
            <p key={`addition-${aIdx}`}>- {cleanText(a.name)}{a.protein || a.replacement ? ` (${a.protein || a.replacement})` : ''} ({a.quantity || 1})</p>
          ))
        : [<p key="no-additions">Sin adiciones</p>];
    } else if (field === 'Dirección') {
      return meal.address ? (
        <AddressSummary
          mealAddress={meal.address}
          isCommon={false}
          globalCommonAddressFields={globalCommonAddressFields}
        />
      ) : null;
    } else if (field === 'Mesa') {
      return meal.tableNumber || 'No especificada';
    }
    return null;
  };

  return (
    <div className="pb-2">
      <h3 className="font-medium text-gray-800 text-xs sm:text-sm">
        🍽 {count > 1 ? `${count} Almuerzos iguales – $${groupTotal.toLocaleString('es-CO')} ${paymentText}` : `${count} Almuerzo – $${groupTotal.toLocaleString('es-CO')} ${paymentText}`}
      </h3>
      <MealFields meal={baseMeal} commonFields={count > 1 ? group.commonFieldsInGroup : new Set(['all', 'Mesa'])} isWaiterView={isWaiterView} />
      {count === 1 && !globalCommonFields.has('Dirección') && baseMeal.address && (
        <AddressSummary
          mealAddress={baseMeal.address}
          isCommon={false}
          globalCommonAddressFields={globalCommonAddressFields}
        />
      )}
      {count > 1 && group.commonFieldsInGroup.has('Dirección') && !globalCommonFields.has('Dirección') && baseMeal.address && (
        <AddressSummary
          mealAddress={baseMeal.address}
          isCommon={false}
          globalCommonAddressFields={globalCommonAddressFields}
        />
      )}
      {hasDifferences && (
        <div className="mt-1">
          <p className="font-medium text-gray-800 text-xs sm:text-sm">🔄 Diferencias:</p>
          {group.identicalGroups.map((identicalGroup, igIndex) => (
            <div key={igIndex} className="ml-2">
              <p className="font-medium text-gray-800 text-xs sm:text-sm">
                * {identicalGroup.indices.length > 1 ? `Almuerzos ${identicalGroup.indices.map(i => i + 1).join(', ')}` : `Almuerzo ${identicalGroup.indices[0] + 1}`}:
              </p>
              {fieldsToCheck.map((field, dIdx) => {
                if (group.commonFieldsInGroup.has(field)) return null;
                const meal = identicalGroup.meals[0];
                const formattedValue = getFieldValue(meal, field);
                if (!formattedValue) return null;
                if (field === 'Dirección') {
                  return (
                    <div key={dIdx} className="text-xs sm:text-sm text-gray-600 ml-2">
                      {addressFields.map((addrField, addrIdx) => {
                        const isCommonInGroup = group.commonAddressFieldsInGroup[addrField];
                        if (isCommonInGroup) return null;
                        const value = meal.address?.[addrField];
                        const addrType = meal.address?.addressType || '';
                        if (addrField === 'address' && value) {
                          return (
                            <p key={addrIdx}>📍 Dirección: {value}</p>
                          );
                        } else if (addrField === 'addressType' && value) {
                          return (
                            <p key={addrIdx}>🏠 Lugar de entrega: {
                              value === 'house' ? 'Casa/Apartamento Individual' :
                              value === 'school' ? 'Colegio/Oficina' :
                              value === 'complex' ? 'Conjunto Residencial' :
                              value === 'shop' ? 'Tienda/Local' : 'No especificado'
                            }</p>
                          );
                        } else if (addrField === 'recipientName' && addrType === 'school' && value) {
                          return <p key={addrIdx}>👤 Nombre: {value}</p>;
                        } else if (addrField === 'phoneNumber' && value) {
                          return <p key={addrIdx}>📞 Teléfono: {value}</p>;
                        } else if (addrField === 'unitDetails' && addrType === 'complex' && value) {
                          return <p key={addrIdx}>🏢 Detalles: {value}</p>;
                        } else if (addrField === 'localName' && addrType === 'shop' && value) {
                          return <p key={addrIdx}>🏬 Nombre del local: {value}</p>;
                        }
                        return null;
                      }).filter(Boolean)}
                    </div>
                  );
                }
                return (
                  <div key={dIdx} className="text-xs sm:text-sm text-gray-600 ml-2">
                    {Array.isArray(formattedValue) ? formattedValue : formattedValue}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Componente para resumen de pagos
const PaymentSummary = ({ paymentSummary, total, isWaiterView, isTableOrder }) => {
  const allCashOrUnspecified = Object.keys(paymentSummary).every(method => method === 'Efectivo' || method === 'No especificado');

  return (
    <div className="pt-2 border-t">
      <p className="text-sm sm:text-base font-bold text-right text-gray-800">
        Total: <span className="text-green-600">${total.toLocaleString('es-CO')}</span>
      </p>
      {!isWaiterView && !isTableOrder && (
        <>
          {allCashOrUnspecified ? (
            <>
              <p className="font-medium text-gray-800 text-xs sm:text-sm">Paga en efectivo al momento de la entrega.</p>
              <p className="text-xs sm:text-sm text-gray-600">💵 Efectivo: ${total.toLocaleString('es-CO')}</p>
              <p className="text-xs sm:text-sm text-gray-600">
                Si no tienes efectivo, puedes transferir por Nequi o DaviPlata al número: 313 850 5647.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-gray-800 text-xs sm:text-sm">💳 Instrucciones de pago:</p>
              <p className="text-xs sm:text-sm text-gray-600">Envía al número 313 850 5647 (Nequi o DaviPlata):</p>
              {Object.entries(paymentSummary).map(([method, amount]) => (
                method !== 'No especificado' && amount > 0 && (
                  <p key={method} className="text-xs sm:text-sm text-gray-600">
                    🔹 {method}: ${amount.toLocaleString('es-CO')}
                  </p>
                )
              ))}
            </>
          )}
          <p className="font-medium text-gray-800 text-xs sm:text-sm">💰 Total: ${total.toLocaleString('es-CO')}</p>
        </>
      )}
    </div>
  );
};

// Componente principal
const OrderSummary = ({ meals, onSendOrder, calculateTotal, isTableOrder = false, isWaiterView = false, statusClass = '' }) => {
  const {
    groupedMeals,
    total,
    paymentSummary,
    commonDeliveryTime,
    commonAddressFields,
    globalCommonFields,
  } = useOrderSummary(meals, isWaiterView);

  const effectiveTotal = isTableOrder ? calculateTotal(meals) : total;

  const baseClass = isWaiterView ? `${statusClass} p-4 rounded-lg shadow-md` : 'bg-white p-3 rounded-lg shadow-lg mt-6 leading-relaxed';

  return (
    <div className={baseClass}>
      <h2 className="text-lg font-bold text-gray-800 mb-4">✅ Resumen del Pedido</h2>
      {meals?.length === 0 ? (
        <div>
          <p className="text-sm text-gray-600">No hay almuerzos en tu pedido.</p>
          <p className="text-base font-bold text-right mt-2 text-gray-800">
            💰 Total: <span className="text-green-600">$0</span>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            <span className="font-medium text-gray-800">🍽 {meals.length} almuerzos en total</span>
          </p>
          {!isWaiterView &&
            groupedMeals.map((group, index) => (
              group.meals.length > 1 && (
                <p key={`group-${index}`} className="text-sm text-gray-700">
                  * {group.meals.length} almuerzos iguales
                </p>
              )
            ))}
          {!isWaiterView && (
            <p className="text-sm text-gray-700">
              <span className="font-medium text-gray-800">💰 Total: ${effectiveTotal.toLocaleString('es-CO')}</span>
            </p>
          )}
          <hr className="border-t border-gray-300 my-2" />
          {groupedMeals.map((group, index) => (
            <MealGroup
              key={index}
              group={group}
              globalCommonFields={globalCommonFields}
              globalCommonAddressFields={commonAddressFields}
              isWaiterView={isWaiterView}
              isTableOrder={isTableOrder}
              calculateTotal={calculateTotal}
            />
          ))}
          {!isTableOrder && meals.length > 0 && (
            <div className="text-sm text-gray-600">
              <hr className="border-t border-gray-300 my-2" />
              {commonDeliveryTime && (
                <p className="font-medium text-gray-800">
                  🕒 Entrega: {isValidTime(meals[0].time) ? cleanText(meals[0].time.name) : 'Lo más rápido'}
                </p>
              )}
              {Object.keys(commonAddressFields).some(field => commonAddressFields[field]) && (
                <AddressSummary commonAddressFields={commonAddressFields} isCommon={true} globalCommonAddressFields={commonAddressFields} />
              )}
              <hr className="border-t border-gray-300 my-2" />
              {!isWaiterView && (
                <p className="text-sm text-gray-600">🚚 Estimado: 25-30 min (10-15 si están cerca).</p>
              )}
            </div>
          )}
          <PaymentSummary paymentSummary={paymentSummary} total={effectiveTotal} isWaiterView={isWaiterView} isTableOrder={isTableOrder} />
          {onSendOrder && (
            <button
              onClick={onSendOrder}
              disabled={!meals || meals.length === 0}
              className={`w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg mt-2 transition-colors text-sm ${
                !meals || meals.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isTableOrder && !isWaiterView ? 'Guardar Pedido' : 'Enviar Pedido por WhatsApp'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default OrderSummary;