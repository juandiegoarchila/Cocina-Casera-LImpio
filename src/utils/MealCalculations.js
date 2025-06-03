export const calculateMealPrice = (meal) => {
  if (!meal) return 0;
  const hasMojarra = meal?.protein?.name === 'Mojarra';
  const basePrice = hasMojarra ? 15000 : (meal?.soup?.name && meal.soup.name !== 'Sin sopa' && meal.soup.name !== 'Solo bandeja' || meal?.soupReplacement ? 13000 : 12000);
  const additionsPrice = meal?.additions?.reduce((sum, item) => sum + (item.price || 0), 0) || 0;
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