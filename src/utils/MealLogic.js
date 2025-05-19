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
  notes: '',
  time: null,
  address,
  payment: null,
  cutlery: null
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

export const sendToWhatsApp = (
  setIsLoading, setErrorMessage, setSuccessMessage, meals,
  incompleteMealIndex, setIncompleteMealIndex, incompleteSlideIndex, setIncompleteSlideIndex,
  calculateMealPrice, total, paymentSummary, isMobile, encodeMessage
) => {
  setIsLoading(true);
  setErrorMessage(null);
  setSuccessMessage(null);

  const incompleteMeals = meals.map((meal, index) => {
    const missing = [];
    if (!meal?.soup || (meal.soup?.name === 'Sin sopa' && !meal?.soupReplacement)) missing.push('Sopa');
    if (!meal?.principle || (meal.principle?.name === 'Sin principio' && !meal?.principleReplacement)) missing.push('Principio');
    if (!meal?.protein) missing.push('Proteína');
    if (!meal?.drink) missing.push('Bebida');
    if (!meal?.time) missing.push('Hora');
    if (!meal?.address) missing.push('Dirección');
    if (!meal?.payment) missing.push('Método de pago');
    if (meal?.cutlery === null) missing.push('Cubiertos');
    if (meal?.sides?.length === 0) missing.push('Acompañamientos');
    return { index, missing };
  }).filter(m => m.missing.length > 0);

  if (incompleteMeals.length > 0) {
    const firstIncomplete = incompleteMeals[0];
    const slideMap = { 'Sopa': 0, 'Principio': 1, 'Proteína': 2, 'Bebida': 3, 'Acompañamientos': 4, 'Hora': 5, 'Dirección': 6, 'Método de pago': 7, 'Cubiertos': 8 };
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
    return;
  }

  const message = generateMessageFromMeals(meals, calculateMealPrice, total, paymentSummary);
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
};

export const generateMessageFromMeals = (meals, calculateMealPrice, total, paymentSummary) => {
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
      if (meal1.time?.name !== meal2.time?.name) differences.push({ field: 'Entrega', value1: meal1.time?.name || 'lo más pronto posible', value2: meal2.time?.name || 'lo más pronto posible' });
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
    groupedMeals.push(group);
  }

  const totalMeals = meals.length;
  const identicalGroups = groupedMeals.filter(group => group.meals.length > 1);

  message += `🍽 ${totalMeals} almuerzos en total\n`;
  if (identicalGroups.length > 0) identicalGroups.forEach(group => message += `• ${group.meals.length} almuerzos iguales\n`);
  message += `💰 Total: $${total.toLocaleString()}\n`;

  groupedMeals.forEach((group, index) => {
    const baseMeal = group.meals[0];
    const count = group.meals.length;
    const totalPrice = group.meals.reduce((sum, m) => sum + calculateMealPrice(m), 0);
    const paymentNames = Array.from(group.payments).filter(name => name && name !== 'No especificado');
    const paymentText = paymentNames.length > 0 ? `(${paymentNames.join(' y ')})` : '(No especificado)';
    const drinkName = baseMeal?.drink?.name === 'Juego de mango' ? 'Jugo de mango' : baseMeal?.drink?.name || 'No seleccionado';
    const timeName = isValidTime(baseMeal.time) ? baseMeal.time.name : 'lo más pronto posible';
    const note = formatNotes(baseMeal.notes);

    message += `────────────────\n`;
    message += count > 1 ? `🍽 ${count} Almuerzos iguales – $${totalPrice.toLocaleString()} ${paymentText}\n\n` : `🍽 ${count} Almuerzo – $${totalPrice.toLocaleString()} ${paymentText}\n\n`;

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

    if (!hasSoupDifferences) {
      if (baseMeal?.soupReplacement?.name) message += `🥣 ${baseMeal.soupReplacement.name}\n`;
      else if (baseMeal?.soup?.name && baseMeal.soup.name !== 'Sin sopa' && baseMeal.soup.name !== 'Solo bandeja') message += `🥣 ${baseMeal.soup.name}\n`;
      else if (baseMeal?.soup?.name === 'Solo bandeja') message += `🥣 Solo bandeja\n`;
      else message += `🥣 Sin sopa\n`;
    }

    if (!hasPrincipleDifferences) {
      if (baseMeal?.principleReplacement?.name) message += `🍚 ${baseMeal.principleReplacement.name}\n`;
      else if (baseMeal?.principle?.name && baseMeal.principle.name !== 'Sin principio') message += `🍚 ${baseMeal.principle.name}\n`;
      else message += `🍚 Sin principio\n`;
    }

    if (!hasProteinDifferences && baseMeal?.protein?.name) message += `🍗 ${baseMeal.protein.name}\n`;
    if (!hasDrinkDifferences) message += `🥤 ${drinkName}\n`;
    if (!hasSidesDifferences && baseMeal?.sides?.length > 0) message += `🥗 ${baseMeal.sides.map(s => s.name).join(', ')}\n`;
    if (!hasNotesDifferences) message += `📝 ${note}\n`;

    // Only show differences if there are any
    if (group.differences.length > 0 && group.differences.some(d => d.diffs.length > 0)) {
      message += `\n🔄 Diferencias:\n`;
      const diffOrder = ['Sopa', 'Principio', 'Proteína', 'Bebida', 'Acompañamientos', 'Notas', 'Entrega', 'Dirección', 'Pago', 'Cubiertos'];
      const diffItems = group.originalIndices.reduce((acc, idx) => ({ ...acc, [idx]: [] }), {});

      group.differences.forEach(diff => {
        diff.diffs.forEach(d => {
          let formattedValue1, formattedValue2;
          if (d.field === 'Sopa') {
            formattedValue1 = d.value1 === 'Sin sopa' && d.replacement1 ? `🥣 ${d.replacement1} (en lugar de sopa)` : `🥣 ${d.value1 || 'Sin sopa'}`;
            formattedValue2 = d.value2 === 'Sin sopa' && d.replacement2 ? `🥣 ${d.replacement2} (en lugar de sopa)` : `🥣 ${d.value2 || 'Sin sopa'}`;
          } else if (d.field === 'Principio') {
            formattedValue1 = d.value1 === 'Sin principio' && d.replacement1 ? `🍚 ${d.replacement1} (por principio)` : `🍚 ${d.value1 || 'Sin principio'}`;
            formattedValue2 = d.value2 === 'Sin principio' && d.replacement2 ? `🍚 ${d.replacement2} (por principio)` : `🍚 ${d.value2 || 'Sin principio'}`;
          } else if (d.field === 'Proteína') {
            formattedValue1 = `🍗 ${d.value1 || 'Sin proteína'}`;
            formattedValue2 = `🍗 ${d.value2 || 'Sin proteína'}`;
          } else if (d.field === 'Bebida') {
            formattedValue1 = `🥤 ${d.value1 || 'Sin bebida'}`;
            formattedValue2 = `🥤 ${d.value2 || 'Sin bebida'}`;
          } else if (d.field === 'Acompañamientos') {
            formattedValue1 = `🥗 ${d.value1 || 'Sin acompañamientos'}`;
            formattedValue2 = `🥗 ${d.value2 || 'Sin acompañamientos'}`;
          } else if (d.field === 'Notas') {
            formattedValue1 = `📝 ${d.value1 || 'Ninguna'}`;
            formattedValue2 = `📝 ${d.value2 || 'Ninguna'}`;
          } else if (d.field === 'Entrega') {
            formattedValue1 = `🕒 ${d.value1}`;
            formattedValue2 = `🕒 ${d.value2}`;
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
            formattedValue1 = `${d.field}: ${d.value1 || 'Ninguno'}`;
            formattedValue2 = `${d.field}: ${d.value2 || 'Ninguno'}`;
          }
          diffItems[group.originalIndices[0]].push({ field: d.field, value: formattedValue1, order: diffOrder.indexOf(d.field) });
          diffItems[diff.originalIndex].push({ field: d.field, value: formattedValue2, order: diffOrder.indexOf(d.field) });
        });
      });

      Object.keys(diffItems).forEach(index => {
        const sortedItems = diffItems[index].sort((a, b) => a.order - b.order);
        message += `* Almuerzo ${parseInt(index) + 1}:\n`;
        sortedItems.forEach(item => {
          message += `  ${item.value}\n`;
        });
      });
    }

    if (!hasTimeDifferences) message += `\n🕒 Entrega: ${timeName}\n`;
    if (!hasAddressDifferences) message += `📍 ${baseMeal?.address || 'No especificada'}${index > 0 && groupedMeals[0].meals[0]?.address === baseMeal?.address ? ' (Misma dirección)' : ''}\n`;
    if (!hasCutleryDifferences) message += `🍴 Cubiertos: ${baseMeal?.cutlery ? 'Sí' : 'No'}\n`;
  });

  message += `────────────────\n`;
  message += `💳 Instrucciones de pago:\n`;
  message += `Envía al número 313 850 5647 (Nequi o DaviPlata):\n`;
  Object.entries(paymentSummary).forEach(([method, amount]) => {
    if (method !== 'No especificado' && amount > 0) message += `${method} $${amount.toLocaleString()}\n`;
  });

  message += `\n💰 Total general: $${total.toLocaleString()}\n`;
  message += `🚚 Estimado: 20-30 min (si están cerca, antes).\n`;

  return message;
};

export const isValidTime = (time) => time?.name && /\d/.test(time.name);

export const isValidNote = (notes) => notes && !/^(asdasd|prueba|test|abcde)$/i.test(notes) && notes.trim().length > 0;

export const formatNotes = (notes) => {
  if (!isValidNote(notes)) return 'Ninguna';
  return notes.split(/,\s*/).map(item => `• ${item.trim()}`).join('\n');
};