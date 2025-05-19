export const calculateMealPrice = (meal) => {
  if (!meal) return 0;
  const hasSoupOrReplacement = meal?.soup?.name && meal.soup.name !== 'Sin sopa' && meal.soup.name !== 'Solo bandeja' || meal?.soupReplacement;
  return hasSoupOrReplacement ? 13000 : 12000;
};

export const calculateTotal = (meals) => meals.reduce((sum, meal) => sum + calculateMealPrice(meal), 0);

export const paymentSummary = (meals) => {
  if (!meals || meals.length === 0) return {};
  return meals.reduce((acc, meal) => {
    const price = calculateMealPrice(meal);
    const paymentMethod = meal?.payment?.name || 'No especificado';
    acc[paymentMethod] = (acc[paymentMethod] || 0) + price;
    return acc;
  }, {});
};