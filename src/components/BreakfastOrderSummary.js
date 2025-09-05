import React, { useMemo } from 'react';
import { calculateBreakfastPrice, calculateTotalBreakfastPrice } from '../utils/BreakfastLogic';

const cleanText = (text) => {
  if (!text) return '';
  return text.replace(' NUEVO', '') || '';
};

const fieldsToCheck = ['Tipo', 'Caldo', 'Huevos', 'Arroz/Pan', 'Bebida', 'Proteína', 'Cubiertos', 'Adiciones', 'Mesa', 'Dirección'];
const addressFields = ['address', 'addressType', 'recipientName', 'phoneNumber', 'unitDetails', 'localName'];

/** Normaliza el nombre del método de pago desde varias estructuras posibles. */
const getPaymentName = (item, fallbackSelectedPaymentName) => {
  // Soportes posibles en tus datos:
  // item.paymentMethod?.name   (recomendado)
  // item.paymentMethod         (string)
  // item.payment?.name
  // item.payment?.method
  // item.payment               (string)
  // item.breakfasts?.[0]?.payment?.name (por compatibilidad con versiones anteriores)
  const fromItem =
    item?.paymentMethod?.name ||
    (typeof item?.paymentMethod === 'string' ? item.paymentMethod : '') ||
    item?.payment?.name ||
    item?.payment?.method ||
    (typeof item?.payment === 'string' ? item.payment : '') ||
    item?.breakfasts?.[0]?.payment?.name ||
    '';

  const normalized = (fromItem || fallbackSelectedPaymentName || '').toString().trim();
  if (!normalized) return 'No especificado';

  // Normalizamos casing esperado
  const lower = normalized.toLowerCase();
  if (lower.includes('efect')) return 'Efectivo';
  if (lower.includes('nequi')) return 'Nequi';
  if (lower.includes('davi')) return 'Daviplata';
  return normalized; // por si agregas otros métodos en el futuro
};

const useBreakfastOrderSummary = (items, isWaiterView, selectedPaymentNameFallback) => {
  const getFieldValue = (breakfast, field) => {
    if (field === 'Tipo') return cleanText(breakfast.type?.name) || 'Sin tipo';
    if (field === 'Caldo') return cleanText(breakfast.broth?.name) || 'Sin caldo';
    if (field === 'Huevos') return cleanText(breakfast.eggs?.name) || 'Sin huevos';
    if (field === 'Arroz/Pan') return cleanText(breakfast.riceBread?.name) || 'Sin arroz/pan';
    if (field === 'Bebida') return cleanText(breakfast.drink?.name) || 'Sin bebida';
    if (field === 'Proteína') return cleanText(breakfast.protein?.name) || 'Sin proteína';
    if (field === 'Cubiertos') return breakfast.cutlery ? 'Sí' : 'No';
    if (field === 'Adiciones') {
      return JSON.stringify(
        breakfast.additions?.map(a => ({
          name: cleanText(a.name),
          quantity: a.quantity || 1,
        })).sort((a, b) => a.name.localeCompare(b.name)) || []
      );
    }
    if (field === 'Mesa') return breakfast.tableNumber || 'No especificada';
    if (field === 'Dirección') {
      return JSON.stringify(addressFields.map(f => breakfast.address?.[f] || ''));
    }
    return '';
  };

  const groupedItems = useMemo(() => {
    if (!items || items.length === 0) {
      return {
        groupedItems: [],
        globalCommonFields: new Set(),
        commonAddressFields: {},
        areAddressesGloballyCommon: false,
        areCoreAddressesCommon: false,
      };
    }

    const groups = [];
    const firstItem = items[0];
    const globalCommonFields = new Set(fieldsToCheck.filter(field => {
      const firstValue = getFieldValue(firstItem, field);
      return items.every(item => getFieldValue(item, field) === firstValue);
    }));

    const commonAddressFields = {};
    let areAddressesGloballyCommon = true;
    let areCoreAddressesCommon = true;
    addressFields.forEach(field => {
      const isCommon = items.every(item => item.address?.[field] === firstItem?.address?.[field]);
      commonAddressFields[field] = isCommon ? firstItem?.address?.[field] : null;
      if (!isCommon && field !== 'recipientName' && field !== 'unitDetails' && field !== 'localName') {
        areAddressesGloballyCommon = false;
      }
      if (!isCommon && (field === 'address' || field === 'phoneNumber')) {
        areCoreAddressesCommon = false;
      }
    });

    const itemGroups = new Map();
    items.forEach((item, index) => {
      let assigned = false;
      for (const [, groupData] of itemGroups) {
        const refItem = groupData.items[0];
        let differences = 0;
        fieldsToCheck.forEach(field => {
          if (getFieldValue(item, field) !== getFieldValue(refItem, field)) {
            differences++;
          }
        });
        if (differences <= 3) {
          groupData.items.push(item);
          groupData.indices.push(index);
          const pName = getPaymentName(item, selectedPaymentNameFallback);
          if (pName) groupData.payments.add(pName);
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        const key = `${index}|${fieldsToCheck.map(field => getFieldValue(item, field)).join('|')}`;
        const pName = getPaymentName(item, selectedPaymentNameFallback);
        itemGroups.set(key, {
          items: [item],
          indices: [index],
          payments: new Set(pName ? [pName] : []),
        });
      }
    });

    itemGroups.forEach((groupData) => {
      const itemsInGroup = groupData.items;
      const group = {
        items: itemsInGroup,
        payments: groupData.payments,
        originalIndices: groupData.indices,
      };
      group.commonFieldsInGroup = new Set(fieldsToCheck.filter(field => {
        const firstValue = getFieldValue(itemsInGroup[0], field);
        return itemsInGroup.every(item => getFieldValue(item, field) === firstValue);
      }));
      group.commonAddressFieldsInGroup = {};
      addressFields.forEach(field => {
        const isCommon = itemsInGroup.every(item => item.address?.[field] === itemsInGroup[0].address?.[field]);
        group.commonAddressFieldsInGroup[field] = isCommon ? itemsInGroup[0].address?.[field] : null;
      });
      const identicalGroups = new Map();
      itemsInGroup.forEach((item, idx) => {
        const key = fieldsToCheck.map(field => getFieldValue(item, field)).join('|');
        if (!identicalGroups.has(key)) {
          identicalGroups.set(key, { items: [], indices: [] });
        }
        identicalGroups.get(key).items.push(item);
        identicalGroups.get(key).indices.push(groupData.indices[idx]);
      });
      group.identicalGroups = Array.from(identicalGroups.values());
      groups.push(group);
    });

    return {
      groupedItems: groups,
      globalCommonFields,
      commonAddressFields,
      areAddressesGloballyCommon,
      areCoreAddressesCommon,
    };
  }, [items, selectedPaymentNameFallback]);

  const total = useMemo(() => {
    const calculatedTotal = items.reduce((sum, item) => {
      const itemPrice = calculateBreakfastPrice(item, 3);
      console.log('Total calculation - Item:', { 
        item, 
        itemPrice, 
        additions: item.additions 
      });
      return sum + itemPrice;
    }, 0);
    console.log('Total calculation - Final total:', calculatedTotal);
    return calculatedTotal;
  }, [items]);

  const paymentSummary = useMemo(() => {
    if (!items || items.length === 0) return {};
    return items.reduce((acc, item) => {
      const price = calculateBreakfastPrice(item, 3);
      const pName = getPaymentName(item, selectedPaymentNameFallback);
      acc[pName] = (acc[pName] || 0) + price;
      return acc;
    }, {});
  }, [items, selectedPaymentNameFallback]);

  return {
    groupedItems: groupedItems.groupedItems,
    total,
    paymentSummary,
    globalCommonFields: groupedItems.globalCommonFields,
    commonAddressFields: groupedItems.commonAddressFields,
    areAddressesGloballyCommon: groupedItems.areAddressesGloballyCommon,
    areCoreAddressesCommon: groupedItems.areCoreAddressesCommon,
  };
};

const AddressSummary = ({ commonAddressFields = {}, breakfastAddress, isCommon = false, globalCommonAddressFields = {} }) => {
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

  const effectiveAddress = breakfastAddress || commonAddressFields;
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

const BreakfastFields = ({ breakfast, commonFields, isWaiterView, isAdminView = false }) => {
  const fields = [];

  if (commonFields.has('Tipo') || commonFields.has('all')) {
    fields.push(<p key="type" className="text-xs sm:text-sm text-gray-600">Tipo: {cleanText(breakfast.type?.name) || 'Sin tipo'}</p>);
  }
  if (commonFields.has('Caldo') || commonFields.has('all')) {
    if (breakfast.broth) {
      fields.push(<p key="broth" className="text-xs sm:text-sm text-gray-600">Caldo: {cleanText(breakfast.broth.name) || 'Sin caldo'}</p>);
    }
  }
  if (commonFields.has('Huevos') || commonFields.has('all')) {
    if (breakfast.eggs) {
      fields.push(<p key="eggs" className="text-xs sm:text-sm text-gray-600">Huevos: {cleanText(breakfast.eggs.name) || 'Sin huevos'}</p>);
    }
  }
  if (commonFields.has('Arroz/Pan') || commonFields.has('all')) {
    if (breakfast.riceBread) {
      fields.push(<p key="riceBread" className="text-xs sm:text-sm text-gray-600">Arroz/Pan: {cleanText(breakfast.riceBread.name) || 'Sin arroz/pan'}</p>);
    }
  }
  if (commonFields.has('Bebida') || commonFields.has('all')) {
    if (breakfast.drink) {
      fields.push(<p key="drink" className="text-xs sm:text-sm text-gray-600">Bebida: {cleanText(breakfast.drink.name) || 'Sin bebida'}</p>);
    }
  }
  if (commonFields.has('Proteína') || commonFields.has('all')) {
    if (breakfast.protein) {
      fields.push(<p key="protein" className="text-xs sm:text-sm text-gray-600">Proteína: {cleanText(breakfast.protein.name) || 'Sin proteína'}</p>);
    }
  }
  if ((commonFields.has('Cubiertos') || commonFields.has('all')) && !isWaiterView && !isAdminView) {
    fields.push(<p key="cutlery" className="text-xs sm:text-sm text-gray-600">Cubiertos: {breakfast.cutlery ? 'Sí' : 'No'}</p>);
  }
  if (commonFields.has('Adiciones') || commonFields.has('all')) {
    if (breakfast.additions?.length > 0) {
      fields.push(<p key="additions-label" className="text-xs sm:text-sm text-gray-600">Adiciones:</p>);
      breakfast.additions.forEach((a, idx) => {
        fields.push(
          <p key={`addition-${idx}`} className="text-xs sm:text-sm text-gray-600">
            - {cleanText(a.name)} ({a.quantity || 1})
          </p>
        );
      });
    }
  }
  
  // En vista admin, mostrar tipo de orden en lugar de notas
  if (isAdminView && breakfast.orderType) {
    const tipoPedido = breakfast.orderType === 'table' ? 'Para mesa' : breakfast.orderType === 'takeaway' ? 'Para llevar' : breakfast.orderType;
    fields.push(<p key="orderType" className="text-xs sm:text-sm text-gray-600">Tipo: {tipoPedido}</p>);
  } else if (commonFields.has('all') && !isAdminView) {
    fields.push(<p key="notes" className="text-xs sm:text-sm text-gray-600">Notas: {breakfast.notes || 'Ninguna'}</p>);
  }
  
  if ((commonFields.has('Mesa') || commonFields.has('all')) && isWaiterView && breakfast.tableNumber) {
    fields.push(<p key="table" className="text-xs sm:text-sm text-gray-600">Mesa: {breakfast.tableNumber}</p>);
  }
  if ((commonFields.has('all') || commonFields.has('TipoPedido')) && isWaiterView && breakfast.orderType && !isAdminView) {
    const tipoPedido = breakfast.orderType === 'table' ? 'Para mesa' : breakfast.orderType === 'takeaway' ? 'Para llevar' : breakfast.orderType;
    fields.push(<p key="orderType" className="text-xs sm:text-sm text-gray-600">Tipo: {tipoPedido}</p>);
  }
  if ((commonFields.has('Dirección') || commonFields.has('all')) && !isWaiterView && !isAdminView && breakfast.address) {
    fields.push(
      <AddressSummary
        key="address"
        breakfastAddress={breakfast.address}
        isCommon={false}
        globalCommonAddressFields={{}}
      />
    );
  }
  
  // Mostrar el total en la vista de administrador
  if (isAdminView) {
    const price = calculateBreakfastPrice(breakfast, 3); // userRole 3 para mesera
    console.log('BreakfastFields - Admin view price calculation:', { 
      breakfast, 
      calculatedPrice: price,
      additions: breakfast.additions 
    });
    fields.push(<p key="total" className="text-xs sm:text-sm font-medium text-gray-800 mt-2">Total: ${price.toLocaleString('es-CO')}</p>);
  }
  
  return fields;
};

const BreakfastGroup = ({ group, globalCommonFields, isWaiterView, isAdminView = false }) => {
  const baseBreakfast = group.items[0];
  const count = group.items.length;
  const groupTotal = group.items.reduce((sum, item) => {
    // Usar la función calculateBreakfastPrice para calcular el precio correctamente
    const itemPrice = calculateBreakfastPrice(item, 3); // userRole 3 para mesera
    console.log('BreakfastGroup - Price calculation:', { 
      item, 
      itemPrice, 
      isWaiterView, 
      isAdminView,
      additions: item.additions 
    });
    return sum + itemPrice;
  }, 0);

  const paymentNames = Array.from(group.payments).filter(Boolean);
  const paymentText = `(${(paymentNames.length ? paymentNames : ['No especificado']).join(' y ')})`;

  const getFieldValue = (breakfast, field) => {
    if (field === 'Tipo') return cleanText(breakfast.type?.name) || 'Sin tipo';
    if (field === 'Caldo') return cleanText(breakfast.broth?.name) || 'Sin caldo';
    if (field === 'Huevos') return cleanText(breakfast.eggs?.name) || 'Sin huevos';
    if (field === 'Arroz/Pan') return cleanText(breakfast.riceBread?.name) || 'Sin arroz/pan';
    if (field === 'Bebida') return cleanText(breakfast.drink?.name) || 'Sin bebida';
    if (field === 'Proteína') return cleanText(breakfast.protein?.name) || 'Sin proteína';
    if (field === 'Cubiertos') return `Cubiertos: ${breakfast.cutlery ? 'Sí' : 'No'}`;
    if (field === 'Adiciones') {
      return breakfast.additions?.length > 0
        ? [
            <p key="additions-label">Adiciones:</p>,
            ...breakfast.additions.map((a, aIdx) => (
              <p key={`addition-${aIdx}`}>- {cleanText(a.name)} ({a.quantity || 1})</p>
            ))
          ]
        : [<p key="no-additions">Sin adiciones</p>];
    }
    if (field === 'Mesa') return breakfast.tableNumber || 'No especificada';
    if (field === 'Dirección') {
      return breakfast.address ? (
        <AddressSummary
          breakfastAddress={breakfast.address}
          isCommon={false}
          globalCommonAddressFields={{}}
        />
      ) : null;
    }
    return null;
  };

  // ¿Hay diferencias dentro del grupo?
  const hasDifferences = group.identicalGroups.length > 1 || group.identicalGroups.some(ig => ig.items.length < group.items.length);

  return (
    <div className="pb-2">
      <h3 className="font-medium text-gray-800 text-xs sm:text-sm">
        🍽 {count > 1 ? `${count} Desayunos iguales – $${groupTotal.toLocaleString('es-CO')} ${paymentText}` : `${count} Desayuno – $${groupTotal.toLocaleString('es-CO')} ${paymentText}`}
      </h3>
      <BreakfastFields breakfast={baseBreakfast} commonFields={count > 1 ? group.commonFieldsInGroup : new Set(['all'])} isWaiterView={isWaiterView} isAdminView={isAdminView} />
      {count === 1 && !globalCommonFields.has('Dirección') && baseBreakfast.address && !isWaiterView && !isAdminView && (
        <AddressSummary
          breakfastAddress={baseBreakfast.address}
          isCommon={false}
          globalCommonAddressFields={{}}
        />
      )}
      {count > 1 && group.commonFieldsInGroup.has('Dirección') && !globalCommonFields.has('Dirección') && baseBreakfast.address && !isWaiterView && !isAdminView && (
        <AddressSummary
          breakfastAddress={baseBreakfast.address}
          isCommon={true}
          globalCommonAddressFields={{}}
        />
      )}
      {hasDifferences && (
        <div className="mt-1">
          <p className="font-medium text-gray-800 text-xs sm:text-sm">🔄 Diferencias:</p>
          {group.identicalGroups.map((identicalGroup, igIndex) => (
            <div key={igIndex} className="ml-2">
              <p className="font-medium text-gray-800 text-xs sm:text-sm">
                * {identicalGroup.indices.length > 1 ? `Desayunos ${identicalGroup.indices.map(i => i + 1).join(', ')}` : `Desayuno ${identicalGroup.indices[0] + 1}`}:
              </p>
              {fieldsToCheck.map((field, dIdx) => {
                if (group.commonFieldsInGroup.has(field)) return null;
                const item = identicalGroup.items[0];
                const formattedValue = getFieldValue(item, field);
                if (!formattedValue) return null;
                if (field === 'Dirección') {
                  return (
                    <div key={dIdx} className="text-xs sm:text-sm text-gray-600 ml-2">
                      {addressFields.map((addrField, addrIdx) => {
                        const isCommonInGroup = group.commonAddressFieldsInGroup[addrField];
                        if (isCommonInGroup) return null;
                        const value = item.address?.[addrField];
                        const addrType = item.address?.addressType || '';
                        if (addrField === 'address' && value) {
                          return <p key={addrIdx}>📍 Dirección: {value}</p>;
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

const PaymentSummary = ({ paymentSummary, total, isWaiterView }) => {
  const allCashOrUnspecified = Object.keys(paymentSummary).every(method => method === 'Efectivo' || method === 'No especificado');

  return (
    <div className="pt-2 border-t">
      <p className="text-sm sm:text-base font-bold text-right text-gray-800">
        Total: <span className="text-green-600">${total.toLocaleString('es-CO')}</span>
      </p>
      {!isWaiterView && (
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

const BreakfastOrderSummary = ({ items, onSendOrder, user, breakfastTypes, statusClass = '', showSaveButton = true, selectedPayment, isAdminView = false, isWaiterView: propIsWaiterView }) => {
  const isWaiterView = propIsWaiterView !== undefined ? propIsWaiterView : user?.role === 3;
  const selectedPaymentNameFallback = selectedPayment?.name; // si el padre lo envía, lo usamos como fallback

  const {
    groupedItems,
    total,
    paymentSummary,
    globalCommonFields,
    commonAddressFields,
    areAddressesGloballyCommon, // (no usado, se mantiene para compat)
  } = useBreakfastOrderSummary(items, isWaiterView, selectedPaymentNameFallback);

  // Aplicar el color de estado en la vista de "Ver Órdenes" (cuando isWaiterView=true) 
  // pero mantener el color blanco en la vista de "Crear Orden" (cuando onSendOrder existe)
  const baseClass = isWaiterView && !onSendOrder ? `${statusClass} p-4 rounded-lg shadow-md` : 'bg-white p-3 rounded-lg shadow-lg mt-6 leading-relaxed';

  return (
    <div className={baseClass}>
      <h2 className="text-lg font-bold text-gray-800 mb-4">✅ Resumen del Pedido de Desayuno</h2>
      {(!items || items.length === 0) ? (
        <div>
          <p className="text-sm text-gray-600">No hay desayunos en tu pedido.</p>
          <p className="text-base font-bold text-right mt-2 text-gray-800">
            💰 Total: <span className="text-green-600">$0</span>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            <span className="font-medium text-gray-800">🍽 {items.length} desayunos en total</span>
          </p>

          {!isWaiterView && groupedItems.map((group, index) => (
            group.items.length > 1 && (
              <p key={`group-${index}`} className="text-sm text-gray-700">
                * {group.items.length} desayunos iguales
              </p>
            )
          ))}

          {!isWaiterView && (
            <p className="text-sm text-gray-700">
              <span className="font-medium text-gray-800">💰 Total: ${total.toLocaleString('es-CO')}</span>
            </p>
          )}

          <hr className="border-t border-gray-300 my-2" />

          {groupedItems.map((group, index) => (
            <BreakfastGroup
              key={index}
              group={group}
              globalCommonFields={new Set()} // no necesitamos globales aquí
              isWaiterView={isWaiterView}
              isAdminView={isAdminView}
            />
          ))}

          <hr className="border-t border-gray-300 my-2" />
          
          {/* Siempre mostrar el total en vista Admin */}
          {isAdminView && (
            <p className="text-sm text-gray-800 font-medium mt-2">Total: ${total.toLocaleString('es-CO')}</p>
          )}
          
          {!isWaiterView && !isAdminView && <p className="text-sm text-gray-600">🚚 Estimado: 25-30 min (10-15 si están cerca).</p>}

          {!isAdminView && <PaymentSummary paymentSummary={paymentSummary} total={total} isWaiterView={isWaiterView} />}

          {onSendOrder && showSaveButton && (
            <button
              onClick={onSendOrder}
              disabled={!items || items.length === 0}
              className={`w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg mt-2 transition-colors text-sm ${
                !items || items.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isWaiterView ? 'Guardar Pedido' : 'Enviar Pedido por WhatsApp'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default BreakfastOrderSummary;
