import { isMobile, encodeMessage } from './Helpers';

export const initializeMealData = (address) => ({
  id: 0,
  soup: null,
  soupReplacement: null,
  principle: null,
  principleReplacement: null,
  protein: null,
  drink: null,
  sides: [],
  additions: [],
  notes: '',
  time: null,
  address,
  payment: null,
  cutlery: null,
});

export const handleMealChange = (setMeals, id, field, value) => {
  setMeals(prev => prev.map(meal => (meal.id === id ? { ...meal, [field]: value } : meal)));
};

export const addMeal = (setMeals, setSuccessMessage, meals, initialMeal) => {
  const newId = meals.length > 0 ? Math.max(...meals.map(meal => meal.id)) + 1 : 0;
  const newMeal = { ...initialMeal, id: newId };
  if (meals.length > 0) {
    const firstMeal = meals[0];
    setSuccessMessage("Tu dirección, hora y método de pago se han copiado del primer almuerzo.");
    if (firstMeal.time) newMeal.time = firstMeal.time;
    if (firstMeal.address) newMeal.address = firstMeal.address;
    if (firstMeal.payment) newMeal.payment = firstMeal.payment;
  }
  setMeals(prev => [...prev, newMeal]);
};

export const duplicateMeal = (setMeals, setSuccessMessage, mealToDuplicate, meals) => {
  const newId = meals.length > 0 ? Math.max(...meals.map(meal => meal.id)) + 1 : 0;
  setSuccessMessage("Se ha duplicado el almuerzo.");
  setMeals(prev => [...prev, { ...mealToDuplicate, id: newId }]);
};

export const removeMeal = (setMeals, setSuccessMessage, id, meals) => {
  const updatedMeals = meals.filter(meal => meal.id !== id).map((meal, index) => ({ ...meal, id: index }));
  setMeals(updatedMeals);
  setSuccessMessage(updatedMeals.length === 0 ? "Todos los almuerzos han sido eliminados." : "Almuerzo eliminado.");
};

export const calculateMealPrice = (meal) => {
  if (!meal) return 0;
  const hasSoupOrReplacement = meal?.soup?.name && meal.soup.name !== 'Sin sopa' && meal.soup.name !== 'Solo bandeja' || meal?.soupReplacement;
  const hasMojarra = meal?.protein?.name === 'Mojarra';
  const basePrice = hasMojarra ? 15000 : (hasSoupOrReplacement ? 13000 : 12000);
  const additionsPrice = meal?.additions?.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0) || 0;
  return basePrice + additionsPrice;
};

export const calculateTotal = (meals) => {
  return meals.reduce((sum, meal) => sum + calculateMealPrice(meal), 0);
};

export const paymentSummary = (meals) => {
  if (!meals || meals.length === 0) return {};
  return meals.reduce((acc, meal) => {
    const price = calculateMealPrice(meal);
    const paymentMethod = meal?.payment?.name || 'No especificado';
    acc[paymentMethod] = (acc[paymentMethod] || 0) + price;
    return acc;
  }, {});
};

export const sendToWhatsApp = (
  setIsLoading,
  setErrorMessage,
  setSuccessMessage,
  meals,
  incompleteMealIndex,
  setIncompleteMealIndex,
  incompleteSlideIndex,
  setIncompleteSlideIndex,
  calculateMealPrice,
  total
) => {
  return new Promise((resolve, reject) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const incompleteMeals = meals.map((meal, index) => {
      const missing = [];
      const isCompleteRice = Array.isArray(meal?.principle) && 
        meal.principle.some(p => ['Arroz con pollo', 'Arroz paisa', 'Arroz tres carnes'].includes(p.name));

      if (!meal?.soup || (meal.soup?.name === 'Sin sopa' && !meal?.soupReplacement)) missing.push('Sopa');
      if (!meal?.principle || (meal.principle?.name === 'Sin principio' && !meal?.principleReplacement)) missing.push('Principio');
      if (!isCompleteRice && !meal?.protein) missing.push('Proteína');
      if (!meal?.drink) missing.push('Bebida');
      if (!meal?.time) missing.push('Hora');
      if (!meal?.address?.address) missing.push('Dirección');
      if (!meal?.payment) missing.push('Método de pago');
      if (meal?.cutlery === null) missing.push('Cubiertos');
      if (!isCompleteRice && meal?.sides?.length === 0) missing.push('Acompañamientos');
      if (meal?.address?.addressType === 'shop' && !meal?.address?.localName) missing.push('Nombre del local');

      return { index, missing };
    }).filter(m => m.missing.length > 0);

    if (incompleteMeals.length > 0) {
      const firstIncomplete = incompleteMeals[0];
      const slideMap = {
        'Sopa': 0,
        'Principio': 1,
        'Proteína': 2,
        'Bebida': 3,
        'Acompañamientos': 8,
        'Hora': 5,
        'Dirección': 6,
        'Método de pago': 7,
        'Cubiertos': 4,
        'Nombre del local': 6,
      };
      const firstMissingField = firstIncomplete.missing[0];
      setIncompleteMealIndex(firstIncomplete.index);
      setIncompleteSlideIndex(slideMap[firstMissingField] || 0);
      setErrorMessage(`Por favor, completa el paso de ${firstMissingField} para el Almuerzo #${firstIncomplete.index + 1}.`);
      setTimeout(() => {
        const element = document.getElementById(`meal-item-${firstIncomplete.index}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('highlight-incomplete');
          setTimeout(() => element.classList.remove('highlight-incomplete'), 3000);
          element.dispatchEvent(new CustomEvent('updateSlide', { detail: { slideIndex: slideMap[firstMissingField] } }));
        }
      }, 100);
      setIsLoading(false);
      reject('Incomplete meals');
      return;
    }

    const message = generateMessageFromMeals(meals, calculateMealPrice, total);
    const encodedMessage = encodeMessage(message);

    if (isMobile()) {
      const whatsappUrl = `whatsapp://send?phone=573023931292&text=${encodedMessage}`;
      const fallbackUrl = `https://wa.me/573023931292?text=${encodedMessage}`;
      const startTime = Date.now();
      window.location = whatsappUrl;
      setTimeout(() => {
        if (Date.now() - startTime < 2000) window.open(fallbackUrl, '_blank');
      }, 2000);
    } else {
      window.open(`https://web.whatsapp.com/send?phone=573023931292&text=${encodedMessage}`, '_blank');
    }

    setSuccessMessage('¡Pedido enviado correctamente a WhatsApp!');
    setIsLoading(false);
    setTimeout(() => setSuccessMessage(null), 5000);
    resolve();
  });
};

export const generateMessageFromMeals = (meals, calculateMealPrice, total) => {
  let message = `👋 ¡Hola Cocina Casera! 🍴\nQuiero hacer mi pedido:\n\n`;

  const groupedMeals = [];
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
      if (meal1.protein?.name !== meal2.protein?.name) differences.push({ field: 'Proteína', value1: meal1.protein?.name, value2: meal2.protein?.name });
      if (meal1.drink?.name !== meal2.drink?.name) differences.push({ field: 'Bebida', value1: meal1.drink?.name, value2: meal2.drink?.name });
      if (JSON.stringify(meal1.sides?.map(s => s.name).sort()) !== JSON.stringify(meal2.sides?.map(s => s.name).sort())) differences.push({ field: 'Acompañamientos', value1: meal1.sides?.map(s => s.name).join(', '), value2: meal2.sides?.map(s => s.name).join(', ') });
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
      if (meal1.notes !== meal2.notes) differences.push({ field: 'Notas', value1: meal1.notes || 'Ninguna', value2: meal2.notes || 'Ninguna' });
      if (meal1.time?.name !== meal2.time?.name) differences.push({ field: 'Entrega', value1: meal1.time?.name || 'Lo más pronto posible', value2: meal2.time?.name || 'Lo más pronto posible' });
      if (meal1.address?.address !== meal2.address?.address) differences.push({ field: 'Dirección', value1: meal1.address?.address, value2: meal2.address?.address });
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
    groupedMeals.push(group);
  }

  const totalMeals = meals.length;
  const identicalGroups = groupedMeals.filter(group => group.meals.length > 1);

  message += `🍽 ${totalMeals} almuerzos en total\n`;
  if (identicalGroups.length > 0) identicalGroups.forEach(group => message += `• ${group.meals.length} almuerzos iguales\n`);
  message += `💰 Total: $${total.toLocaleString('es-CO')}\n`;

  groupedMeals.forEach((group, index) => {
    const baseMeal = group.meals[0];
    const count = group.meals.length;
    const totalPrice = group.meals.reduce((sum, m) => sum + calculateMealPrice(m), 0);
    const paymentNames = Array.from(group.payments).filter(name => name && name !== 'No especificado');
    const paymentText = paymentNames.length > 0 ? `(${paymentNames.join(' y ')})` : '(No especificado)';
    const drinkName = baseMeal?.drink?.name === 'Juego de mango' ? 'Jugo de mango' : baseMeal?.drink?.name || 'No seleccionado';
    const timeName = isValidTime(baseMeal.time) ? baseMeal.time.name : 'Lo más pronto posible';
    const note = formatNotes(baseMeal.notes);

    message += `────────────────\n`;
    message += count > 1 ? `🍽 ${count} Almuerzos iguales – $${totalPrice.toLocaleString('es-CO')} ${paymentText}\n\n` : `🍽 ${count} Almuerzo – $${totalPrice.toLocaleString('es-CO')} ${paymentText}\n\n`;

    const hasSoupDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Sopa'));
    const hasPrincipleDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Principio'));
    const hasProteinDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Proteína'));
    const hasDrinkDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Bebida'));
    const hasSidesDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Acompañamientos'));
    const hasAdditionsDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Adiciones'));
    const hasNotesDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Notas'));
    const hasTimeDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Entrega'));
    const hasAddressDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Dirección'));
    const hasPaymentDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Pago'));
    const hasCutleryDifferences = group.differences.some(d => d.diffs.some(diff => diff.field === 'Cubiertos'));

    // 1. Sopa
    if (!hasSoupDifferences) {
      if (baseMeal?.soupReplacement?.name) message += `${baseMeal.soupReplacement.name} (por sopa)\n`;
      else if (baseMeal?.soup?.name && baseMeal.soup.name !== 'Sin sopa' && baseMeal.soup.name !== 'Solo bandeja') message += `${baseMeal.soup.name}\n`;
      else if (baseMeal?.soup?.name === 'Solo bandeja') message += `solo bandeja\n`;
      else message += `Sin sopa\n`;
    }

    // 2. Principio
    if (!hasPrincipleDifferences) {
      if (baseMeal?.principle?.length > 0) {
        if (baseMeal?.principleReplacement?.name) {
          message += `${baseMeal.principleReplacement.name} (por principio)\n`;
        } else {
          const principles = baseMeal.principle.map(p => p.name).join(' y ');
          const isMix = baseMeal.principle.length > 1;
          message += `${principles}${isMix ? ' (mixto)' : ''}\n`;
        }
      } else {
        message += `Sin principio\n`;
      }
    }

    // 3. Proteína
    const isSpecialRice = baseMeal?.principle?.some(p => ['Arroz con pollo', 'Arroz paisa', 'Arroz tres carnes'].includes(p.name));
    if (!isSpecialRice && !hasProteinDifferences && baseMeal?.protein?.name) {
      message += `${baseMeal.protein.name}\n`;
    } else if (!hasProteinDifferences && !baseMeal?.protein?.name && !isSpecialRice) {
      message += `Sin proteína\n`;
    }

    // 4. Bebida
    if (!hasDrinkDifferences) message += `${drinkName}\n`;

    // 5. Cubiertos
    if (!hasCutleryDifferences) message += `Cubiertos: ${baseMeal?.cutlery ? 'Sí' : 'No'}\n`;

    // 9. Acompañamientos
    if (!hasSidesDifferences && baseMeal?.sides?.length > 0) message += `${baseMeal.sides.map(s => s.name).join(', ')}\n`;
    else if (!hasSidesDifferences && !isSpecialRice) message += `Sin acompañamientos\n`;

    // 10. Adiciones opcionales
    if (!hasAdditionsDifferences && baseMeal?.additions?.length > 0) {
      message += `➕ Adiciones:\n`;
      baseMeal.additions.forEach(a => {
        message += `- ${a.name}${a.protein || a.replacement ? ` (${a.protein || a.replacement})` : ''} (${a.quantity || 1})\n`;
      });
    }

    // Notes (not part of the 10 options but required in the message)
    if (!hasNotesDifferences) message += `${note}\n`;

    // Differences Section (moved here, after Adiciones and Notes, before Entrega)
    if (group.differences.length > 0 && group.differences.some(d => d.diffs.length > 0)) {
      message += `\n🔄 Diferencias:\n`;
      const diffOrder = ['Sopa', 'Principio', 'Proteína', 'Bebida', 'Cubiertos', 'Entrega', 'Dirección', 'Pago', 'Acompañamientos', 'Adiciones', 'Notas'];
      group.differences.forEach(diff => {
        message += `* Almuerzo ${diff.originalIndex + 1}:\n`;
        diff.diffs
          .sort((a, b) => diffOrder.indexOf(a.field) - diffOrder.indexOf(b.field))
          .forEach(d => {
            let formattedValue;
            if (d.field === 'Sopa') {
              formattedValue = d.value2 === 'Sin sopa' && d.replacement2 ? `${d.replacement2} (por sopa)` : `${d.value2 || 'Sin sopa'}`;
            } else if (d.field === 'Principio') {
              formattedValue = d.value2 === 'Sin principio' && d.replacement2 ? `${d.replacement2} (por principio)` : `${d.value2 || 'Sin principio'}`;
            } else if (d.field === 'Proteína') {
              formattedValue = `${d.value2 || 'Sin proteína'}`;
            } else if (d.field === 'Bebida') {
              formattedValue = `${d.value2 || 'Sin bebida'}`;
            } else if (d.field === 'Cubiertos') {
              formattedValue = `Cubiertos: ${d.value2}`;
            } else if (d.field === 'Entrega') {
              formattedValue = `🕒 Entrega: ${d.value2}`;
            } else if (d.field === 'Dirección') {
              formattedValue = `📍 Dirección: ${d.value2 || 'No especificada'}`;
            } else if (d.field === 'Pago') {
              formattedValue = d.value2 !== 'No especificado' ? `${d.value2} = ${calculateMealPrice(meals[diff.originalIndex]).toLocaleString('es-CO')}` : 'No especificado';
            } else if (d.field === 'Acompañamientos') {
              formattedValue = `${d.value2 || 'Sin acompañamientos'}`;
            } else if (d.field === 'Adiciones') {
              formattedValue = `➕ Adiciones: ${d.value2 || 'Ninguna'}`;
            } else if (d.field === 'Notas') {
              formattedValue = `${d.value2 || 'Ninguna'}`;
            } else {
              formattedValue = `${d.value2 || 'Ninguno'}`;
            }
            message += `${formattedValue}\n`;
          });
      });
    }

    // 6. Entrega
    if (!hasTimeDifferences) message += `\n🕒 Entrega: ${timeName}\n`;

    // 7. Dirección
    if (!hasAddressDifferences) {
      message += `📍 Dirección: ${baseMeal?.address?.address || 'No especificada'}\n`;
      if (baseMeal?.address?.addressType) {
        message += `🏠 Lugar de entrega: ${
          baseMeal.address.addressType === 'house' ? 'Casa/Apartamento Individual' :
          baseMeal.address.addressType === 'school' ? 'Colegio/Oficina' :
          baseMeal.address.addressType === 'complex' ? 'Conjunto Residencial' :
          'Tienda/Local'
        }\n`;
      }
      if (baseMeal?.address?.recipientName) message += `👤 Receptor: ${baseMeal.address.recipientName}\n`;
      if (baseMeal?.address?.unitDetails) message += `🏢 Detalles: ${baseMeal.address.unitDetails}\n`;
      if (baseMeal?.address?.localName) message += `🏬 Nombre del local: ${baseMeal.address.localName}\n`;
      if (baseMeal?.address?.phoneNumber) message += `📞 Teléfono: ${baseMeal.address.phoneNumber}\n`;
    }
  });

  // 8. Método de pago (for all meals)
  message += `\n💳 Instrucciones de pago:\nEnvía al número 313 850 5647 (Nequi o DaviPlata):\n`;
  Object.entries(paymentSummary(meals)).forEach(([method, amount]) => {
    if (method !== 'No especificado' && amount > 0) {
      message += `🔹 ${method}: $${amount.toLocaleString('es-CO')}\n`;
    }
  });

  message += `\n💰 Total: $${total.toLocaleString('es-CO')}\n`;
  message += `🕐 Entrega estimada: 20–30 minutos. Si estás cerca del local, será aún más rápido.\n`;

  return message;
};

export const isValidTime = (time) => time && time.name && time.name !== 'Lo más pronto posible';

export const isValidNote = (note) => note && note.trim().length > 0;

export const formatNotes = (notes) => {
  if (!isValidNote(notes)) return 'Ninguna';
  return notes.trim();
};