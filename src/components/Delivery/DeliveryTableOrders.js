//src/components/Delivery/DeliveryTableOrders.js
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Auth/AuthProvider';
import { db, auth } from '../../config/firebase';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import MealList from '../MealList';
import BreakfastList from '../BreakfastList';
import OrderSummary from '../OrderSummary';
import BreakfastOrderSummary from '../BreakfastOrderSummary';
import LoadingIndicator from '../LoadingIndicator';
import ErrorMessage from '../ErrorMessage';
import SuccessMessage from '../SuccessMessage';
import OptionSelector from '../OptionSelector';
import { getColombiaLocalDateString } from '../../utils/bogotaDate';
import { initializeMealData, handleMealChange, addMeal, duplicateMeal, removeMeal } from '../../utils/MealLogic';
import { calculateTotal, calculateMealPrice } from '../../utils/MealCalculations';
import { initializeBreakfastData, handleBreakfastChange, addBreakfast, duplicateBreakfast, removeBreakfast, calculateBreakfastPrice, calculateTotalBreakfastPrice } from '../../utils/BreakfastLogic';
import { quickVariantToMeal, quickVariantToBreakfast } from '../../utils/quickVariantMapper';

const DeliveryTableOrders = () => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [meals, setMeals] = useState([initializeMealData({}, true)]);
  const [breakfasts, setBreakfasts] = useState([initializeBreakfastData({ isWaitress: true })]);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [incompleteMealIndex, setIncompleteMealIndex] = useState(null);
  const [incompleteSlideIndex, setIncompleteSlideIndex] = useState(null);
  const [incompleteBreakfastIndex, setIncompleteBreakfastIndex] = useState(null);
  const [incompleteBreakfastSlideIndex, setIncompleteBreakfastSlideIndex] = useState(null);
  const [soups, setSoups] = useState([]);
  const [soupReplacements, setSoupReplacements] = useState([]);
  const [principles, setPrinciples] = useState([]);
  const [proteins, setProteins] = useState([]);
  const [drinks, setDrinks] = useState([]);
  const [sides, setSides] = useState([]);
  const [additions, setAdditions] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [breakfastEggs, setBreakfastEggs] = useState([]);
  const [breakfastBroths, setBreakfastBroths] = useState([]);
  const [breakfastRiceBread, setBreakfastRiceBread] = useState([]);
  const [breakfastDrinks, setBreakfastDrinks] = useState([]);
  const [breakfastAdditions, setBreakfastAdditions] = useState([]);
  const [breakfastTypes, setBreakfastTypes] = useState([]);
  const [breakfastProteins, setBreakfastProteins] = useState([]);
  const [breakfastTimes, setBreakfastTimes] = useState([]);
  
  // Opciones de mesa
  const tableOptions = [
    { id: 'llevar', name: 'LLevar' },
    { id: 'mesa-1', name: 'Mesa 1' },
    { id: 'mesa-2', name: 'Mesa 2' },
    { id: 'mesa-3', name: 'Mesa 3' },
    { id: 'mesa-4', name: 'Mesa 4' },
    { id: 'mesa-5', name: 'Mesa 5' },
    { id: 'mesa-6', name: 'Mesa 6' },
    { id: 'mesa-7', name: 'Mesa 7' },
    { id: 'mesa-8', name: 'Mesa 8' }
  ];
  
  const [isOrderingDisabled, setIsOrderingDisabled] = useState(false);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('create');
  const [editingOrder, setEditingOrder] = useState(null);
  const [showMenu, setShowMenu] = useState(null);
  const [menuType, setMenuType] = useState('closed');
  // Permitir override manual del menú
  const [manualMenuType, setManualMenuType] = useState(null);
  const [theme, setTheme] = useState('dark');
  const [schedules, setSchedules] = useState({
    breakfastStart: 420, // 07:00
    breakfastEnd: 631,   // 10:31
    lunchStart: 632,     // 10:32
    lunchEnd: 950,       // 15:50
  });
  const [timeRemaining, setTimeRemaining] = useState('');
  const [expandedBreakfast, setExpandedBreakfast] = useState(true);
  const [expandedLunch, setExpandedLunch] = useState(true);

  // Estado para controlar secciones abiertas en el modal de edición
  const [openSections, setOpenSections] = useState({});
  const [sectionTimers, setSectionTimers] = useState({});

  // Limpiar estado al cerrar el modal
  useEffect(() => {
    if (!editingOrder) {
      setOpenSections({});
      Object.values(sectionTimers).forEach(t => clearTimeout(t));
      setSectionTimers({});
    }
  }, [editingOrder]);

  const handleSectionInteraction = (mealIndex, sectionName, isMultiple) => {
    const key = `${mealIndex}-${sectionName}`;
    
    if (!isMultiple) {
      // Cerrar inmediatamente
      setOpenSections(prev => ({ ...prev, [key]: false }));
    } else {
      // Reiniciar temporizador de 7 segundos
      if (sectionTimers[key]) clearTimeout(sectionTimers[key]);
      
      const timer = setTimeout(() => {
        setOpenSections(prev => ({ ...prev, [key]: false }));
        setSectionTimers(prev => {
          const newTimers = { ...prev };
          delete newTimers[key];
          return newTimers;
        });
      }, 7000);
      
      setSectionTimers(prev => ({ ...prev, [key]: timer }));
    }
  };

  const toggleSection = (mealIndex, sectionName, isOpen) => {
    const key = `${mealIndex}-${sectionName}`;
    setOpenSections(prev => ({ ...prev, [key]: isOpen }));
    
    // Si se cierra manualmente, limpiar timer
    if (!isOpen && sectionTimers[key]) {
      clearTimeout(sectionTimers[key]);
      setSectionTimers(prev => {
        const newTimers = { ...prev };
        delete newTimers[key];
        return newTimers;
      });
    }
  };



  // Expansión de órdenes rápidas (quickMode)
  const expandQuickOrder = async (order) => {
    if (!order?.quickMode || order.expanded) return;
    try {
      if (process.env.NODE_ENV === 'development') console.log('[expandQuickOrder] Iniciando expansión', order.id);
      
      // Detectar tipo real (orden rápida nueva usa orderType en español)
      let rawType = (order.type || order.orderType || '').toLowerCase();
      
      // SAFETY NET: Si es almuerzo pero solo tiene items de desayuno, cambiar a desayuno
      const hasLunchItems = (order.quickItems||[]).some(i => {
          const n = (i.name||'').toLowerCase();
          const c = (i.category||'').toLowerCase();
          if (c.includes('bebida') || c.includes('adici')) return false;
          return n.includes('almuerzo') || n.includes('mojarra') || n.includes('pechuga');
      });
      const hasBreakfastItems = (order.quickItems||[]).some(i => {
          const n = (i.name||'').toLowerCase();
          return n.includes('desayuno') || n.includes('caldo') || n.includes('huevo') || n.includes('moñona');
      });

      if (['lunch','almuerzo'].includes(rawType) && !hasLunchItems && hasBreakfastItems) {
          console.log('⚠️ Detectado pedido de desayuno marcado como almuerzo. Corrigiendo...');
          rawType = 'desayuno';
      }

      const isLunch = ['lunch','almuerzo'].includes(rawType);
      const isBreakfast = ['breakfast','desayuno'].includes(rawType);

      if (isLunch) {
        const mealsExpanded = [];
        
        // Separar items principales de accesorios para evitar duplicar almuerzos
        const allItems = order.quickItems || [];
        const mainItems = allItems.filter(item => {
           const name = (item.name || '').toLowerCase();
           const cat = (item.category || '').toLowerCase();
           // Es principal si es explícitamente almuerzo, mojarra, pechuga, o categoría Almuerzo
           // Y NO es una bebida o adición clara
           if (cat.includes('bebida') || cat.includes('adici')) return false;
           return name.includes('almuerzo') || name.includes('mojarra') || name.includes('pechuga') || cat.includes('almuerzo');
        });
        
        const accessoryItems = allItems.filter(item => !mainItems.includes(item));
        
        // Si no hay items principales, crear uno dummy para contener los accesorios
        const itemsToProcess = mainItems.length > 0 ? mainItems : [{ 
            name: 'Almuerzo Personalizado', 
            price: 0, 
            quantity: 1, 
            isPlaceholder: true 
        }];

        let firstMealCreated = false;

        itemsToProcess.forEach(item => {
          for (let i=0; i< (item.quantity||1); i++) {
            let meal;
            if (item?.variant) {
              // Caso anterior basado en variant
              const base = quickVariantToMeal(item.variant, { proteins, soups });
              meal = {
                soup: base.soup ? { name: base.soup.name } : null,
                soupReplacement: base.soupReplacement ? { name: 'Remplazo por Sopa', replacement: base.soupReplacement.replacement || base.soupReplacement.name || '' } : null,
                principle: Array.isArray(base.principle) ? base.principle.map(p => ({ name: p.name })) : [],
                principleReplacement: base.principleReplacement ? { name: base.principleReplacement.name } : null,
                protein: base.protein ? { name: base.protein.name, price: base.protein.price || 0 } : null,
                drink: base.drink ? { name: base.drink.name } : { name: 'Sin bebida' },
                sides: [],
                additions: [],
                tableNumber: order.tableNumber || (order.meals?.[0]?.tableNumber) || '',
                payment: { name: 'Efectivo' },
                orderType: 'almuerzo',
                notes: base.notes || ''
              };
            } else {
              // Nuevo: fallback para item directo de posItems sin variant
              const nameLower = (item.name||'').toLowerCase();
              const isSinSopa = nameLower.includes('sin sopa');
              const isMojarra = nameLower.includes('mojarra');
              const isPechuga = nameLower.includes('pechuga');
              
              // Si es placeholder, no poner nombre en notas
              const notes = item.isPlaceholder ? 'Quick: Solo adicionales' : ('Quick básico: ' + (item.name||''));

              meal = {
                soup: (isSinSopa || item.isPlaceholder) ? null : { name: 'Sopa' },
                soupReplacement: isSinSopa ? { name: 'Remplazo por Sopa', replacement: 'Solo bandeja' } : null,
                principle: [],
                principleReplacement: null,
                protein: (isMojarra || isPechuga) ? { name: item.name, price: Number(item.price||0) } : null,
                drink: { name: 'Sin bebida' },
                sides: [],
                additions: [],
                tableNumber: order.tableNumber || '',
                payment: { name: 'Efectivo' },
                orderType: 'almuerzo',
                notes: notes
              };
            }

            // Adjuntar accesorios al primer almuerzo creado
            if (!firstMealCreated) {
                accessoryItems.forEach(acc => {
                    const accName = (acc.name || '').toLowerCase();
                    const accCat = (acc.category || '').toLowerCase();
                    
                    // Intentar detectar si es bebida
                    if (accCat.includes('bebida') || accName.includes('coca') || accName.includes('agua') || accName.includes('jugo') || accName.includes('gaseosa')) {
                        // Si ya tiene bebida (por variant), mover la anterior a notas o reemplazar?
                        // Asumimos que QuickPOS manda bebida como item separado.
                        // Si meal.drink es "Sin bebida", lo reemplazamos.
                        if (!meal.drink || meal.drink.name === 'Sin bebida') {
                            meal.drink = { name: acc.name, price: acc.price || 0 };
                        } else {
                            // Si ya tiene bebida, agregar esta como adición
                             meal.additions.push({
                                name: acc.name,
                                quantity: acc.quantity || 1,
                                price: acc.price || 0
                            });
                        }
                    } else {
                        // Es una adición (sopa, arroz, etc)
                        meal.additions.push({
                            name: acc.name,
                            quantity: acc.quantity || 1,
                            price: acc.price || 0
                        });
                    }
                });
                firstMealCreated = true;
            }

            mealsExpanded.push(meal);
          }
        });
        // Inyectar adiciones rápidas (legacy)
        if (order.quickAdditions && order.quickAdditions.length && mealsExpanded.length) {
          mealsExpanded[0].additions = [ ...mealsExpanded[0].additions, ...order.quickAdditions.map(a => ({
            name: a.name,
            quantity: a.quantity || 1,
            price: a.price || 0
          }))];
          mealsExpanded[0].notes = (mealsExpanded[0].notes ? mealsExpanded[0].notes + ' | ' : '') + 'Revisar adiciones rápidas';
        }
        const newTotal = calculateTotal(mealsExpanded, 3);
        await updateDoc(doc(db, 'tableOrders', order.id), {
          meals: mealsExpanded,
          expanded: true,
          quickExpandedAt: serverTimestamp(),
          total: newTotal
        });
      } else if (isBreakfast) {
        const breakfastsExpanded = [];
        
        // Separar items principales de accesorios
        const allItems = order.quickItems || [];
        const mainItems = allItems.filter(item => {
           const name = (item.name || '').toLowerCase();
           const cat = (item.category || '').toLowerCase();
           if (cat.includes('bebida') || cat.includes('adici')) return false;
           return name.includes('desayuno') || name.includes('caldo') || name.includes('huevo') || name.includes('moñona') || cat.includes('desayuno');
        });
        
        const accessoryItems = allItems.filter(item => !mainItems.includes(item));
        
        const itemsToProcess = mainItems.length > 0 ? mainItems : [{ 
            name: 'Desayuno Personalizado', 
            price: 0, 
            quantity: 1, 
            isPlaceholder: true 
        }];

        let firstBreakfastCreated = false;

        itemsToProcess.forEach(item => {
          for (let i=0; i< (item.quantity||1); i++) {
            let breakfast;
            if (item?.variant) {
              const base = quickVariantToBreakfast(item.variant, { breakfastBroths, breakfastProteins, breakfastTypes });
              breakfast = {
                broth: base.broth ? { name: base.broth.name } : null,
                eggs: base.eggs ? { name: base.eggs.name || 'Huevos', quantity: base.eggs.quantity || 2 } : null,
                type: base.type ? { name: base.type.name } : null,
                protein: base.protein ? { name: base.protein.name } : null,
                drink: base.drink ? { name: base.drink.name } : { name: 'Sin bebida' },
                riceBread: base.riceBread ? { name: base.riceBread.name } : null,
                additions: [],
                notes: base.notes || '',
                tableNumber: order.tableNumber || (order.breakfasts?.[0]?.tableNumber) || '',
                payment: { name: 'Efectivo' },
                orderType: 'desayuno'
              };
            } else {
              // Fallback parsing del nombre
              const nameLower = (item.name||'').toLowerCase();
              let typeName = 'solo huevos';
              if (nameLower.startsWith('desayuno completo')) typeName = 'desayuno completo';
              else if (nameLower.startsWith('solo caldo')) typeName = 'solo caldo';
              else if (nameLower.startsWith('moñona') || nameLower.startsWith('monona')) typeName = 'moñona';
              else if (nameLower.startsWith('solo huevos')) typeName = 'solo huevos';
              // Determinar caldo
              let brothName = '';
              if (['desayuno completo','solo caldo'].includes(typeName)) {
                if (nameLower.includes('costilla')) brothName = 'caldo de costilla';
                else if (nameLower.includes('pescado')) brothName = 'caldo de pescado';
                else if (nameLower.includes('pata')) brothName = 'caldo de pata';
                else if (nameLower.includes('pajarilla')) brothName = 'caldo de pajarilla';
                else if (nameLower.includes('pollo')) brothName = 'caldo de pollo';
                else brothName = 'caldo de costilla';
              }
              
              const notes = item.isPlaceholder ? 'Quick: Solo adicionales' : ('Quick básico: ' + (item.name||''));

              breakfast = {
                broth: brothName ? { name: brothName } : null,
                eggs: { name: 'Huevos', quantity: 2 },
                type: { name: typeName },
                protein: null,
                drink: { name: 'Sin bebida' },
                riceBread: null,
                additions: [],
                notes: notes,
                tableNumber: order.tableNumber || '',
                payment: { name: 'Efectivo' },
                orderType: 'desayuno'
              };
            }

            // Adjuntar accesorios al primer desayuno
            if (!firstBreakfastCreated) {
                accessoryItems.forEach(acc => {
                    const accName = (acc.name || '').toLowerCase();
                    const accCat = (acc.category || '').toLowerCase();
                    
                    if (accCat.includes('bebida') || accName.includes('coca') || accName.includes('agua') || accName.includes('jugo') || accName.includes('chocolate') || accName.includes('cafe') || accName.includes('tinto')) {
                        if (!breakfast.drink || breakfast.drink.name === 'Sin bebida') {
                          breakfast.drink = { name: acc.name, price: acc.price || 0 };
                        } else {
                             breakfast.additions.push({
                                name: acc.name,
                                quantity: acc.quantity || 1,
                                price: acc.price || 0
                            });
                        }
                    } else {
                        breakfast.additions.push({
                            name: acc.name,
                            quantity: acc.quantity || 1,
                            price: acc.price || 0
                        });
                    }
                });
                firstBreakfastCreated = true;
            }

            breakfastsExpanded.push(breakfast);
          }
        });
        if (order.quickAdditions && order.quickAdditions.length && breakfastsExpanded.length) {
          breakfastsExpanded[0].additions = [ ...breakfastsExpanded[0].additions, ...order.quickAdditions.map(a => ({
            name: a.name,
            quantity: a.quantity || 1,
            price: a.price || 0
          }))];
          breakfastsExpanded[0].notes = (breakfastsExpanded[0].notes ? breakfastsExpanded[0].notes + ' | ' : '') + 'Revisar adiciones rápidas';
        }
        const newTotal = calculateTotalBreakfastPrice(breakfastsExpanded, 3);
        
        // Determinar colección correcta basada en el ID (si ya existe en tableOrders, actualizar ahí pero cambiando el tipo)
        // Nota: Si la orden vino de tableOrders pero ahora es desayuno, actualizamos en tableOrders con type='breakfast'
        // El listener de tableOrders ahora respeta el campo 'type', así que se mostrará correctamente.
        const collectionName = order.type === 'lunch' || !order.type ? 'tableOrders' : 'breakfastOrders';
        // Pero espera, si order viene del listener, ya sabemos de dónde viene? No necesariamente.
        // Asumiremos que actualizamos el documento donde existe.
        // Para simplificar, intentaremos actualizar en la colección original si podemos inferirla, 
        // o probaremos ambas (un poco sucio pero efectivo si no tenemos el path).
        // Mejor: Usamos la colección donde se creó. QuickPOS usa 'tableOrders' para almuerzo y 'breakfastOrders' para desayuno.
        // Si QuickPOS se equivocó y lo puso en tableOrders, lo actualizamos AHÍ mismo, pero cambiamos el type.
        
        // Como no tenemos la referencia de colección en el objeto 'order', intentaremos deducirla o usar una lógica segura.
        // En este caso, asumimos que si llegó aquí, existe en alguna de las dos.
        // Dado que el ID es único, podemos intentar actualizar en la colección que coincida con el tipo ORIGINAL del pedido
        // O simplemente actualizar en ambas (una fallará silenciosamente o creará basura? No, mejor no).
        
        // Solución práctica: Si rawType original era almuerzo, está en tableOrders.
        const originalCollection = (order.type === 'lunch' || order.orderType === 'almuerzo') ? 'tableOrders' : 'breakfastOrders';
        
        await updateDoc(doc(db, originalCollection, order.id), {
          breakfasts: breakfastsExpanded,
          expanded: true,
          quickExpandedAt: serverTimestamp(),
          total: newTotal,
          type: 'breakfast', // Forzar tipo correcto
          orderType: 'desayuno'
        });
      }
      setSuccessMessage('Orden rápida expandida');
    } catch (e) {
      if (process.env.NODE_ENV === 'development') console.error('Error expandiendo orden rápida:', e);
      setErrorMessage('Error expandiendo orden rápida');
    }
  };

  // Helper: normaliza el nombre del método de pago (acepta string u objeto {name/label/value})
  const getMethodName = (opt) => {
    if (!opt) return '';
    if (typeof opt === 'string') return opt;
    return (opt.name || opt.label || opt.value || '').toString();
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setErrorMessage('Por favor, inicia sesión para continuar.');
      setTimeout(() => navigate('/staffhub'), 3000);
      return;
    }
    if (role !== 4 && role !== 3) {
      setErrorMessage('Acceso denegado. Solo personal autorizado puede acceder a esta página.');
      setTimeout(() => navigate('/staffhub'), 3000);
      return;
    }
  }, [user, loading, role, navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (e) {
      setErrorMessage(`Error al cerrar sesión: ${e.message}`);
    }
  };

  useEffect(() => {
    const collections = [
      'soups', 'soupReplacements', 'principles', 'proteins', 'drinks', 'sides', 'additions', 'paymentMethods',
      'breakfastEggs', 'breakfastBroths', 'breakfastRiceBread', 'breakfastDrinks', 'breakfastAdditions',
      'breakfastTypes', 'breakfastProteins', 'breakfastTimes'
    ];
    const setters = [
      setSoups, setSoupReplacements, setPrinciples, setProteins, setDrinks, setSides, setAdditions, setPaymentMethods,
      setBreakfastEggs, setBreakfastBroths, setBreakfastRiceBread, setBreakfastDrinks, setBreakfastAdditions,
      setBreakfastTypes, setBreakfastProteins, setBreakfastTimes
    ];
    const unsubscribers = collections.map((col, index) => onSnapshot(collection(db, col), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setters[index](data);
      if (process.env.NODE_ENV === 'development') console.log(`Updated ${col}:`, data);
      if (data.length === 0) {
        setErrorMessage(
          process.env.NODE_ENV !== 'production'
            ? `La colección ${col} está vacía. Agrega datos desde /admin.`
            : 'Algunas opciones no están disponibles. Intenta de nuevo más tarde.'
        );
      }
    }, (error) => {
      if (process.env.NODE_ENV === 'development') console.error(`Error al escuchar ${col}:`, error);
      setErrorMessage(
        process.env.NODE_ENV === 'production'
          ? 'No se pudieron cargar las opciones. Intenta de nuevo más tarde.'
          : `Error al cargar datos de ${col}. Revisa la consola para más detalles.`
      );
    }));

    const settingsUnsubscribe = onSnapshot(doc(db, 'settings', 'global'), (docSnapshot) => {
      setIsOrderingDisabled(docSnapshot.exists() ? docSnapshot.data().isOrderingDisabled || false : false);
    }, (error) => {
      if (process.env.NODE_ENV === 'development') console.error('Error al escuchar settings/global:', error);
      setErrorMessage('Error al cargar configuración. Intenta de nuevo más tarde.');
    });

    const schedulesUnsubscribe = onSnapshot(doc(db, 'settings', 'schedules'), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const data = docSnapshot.data();
        setSchedules({
          breakfastStart: data.breakfastStart || 420,
          breakfastEnd: data.breakfastEnd || 631,
          lunchStart: data.lunchStart || 632,
          lunchEnd: data.lunchEnd || 950,
        });
      }
    });

    const ordersUnsubscribe = onSnapshot(collection(db, 'tableOrders'), (snapshot) => {
      const todayISO = getColombiaLocalDateString(); // Obtener fecha de hoy en formato YYYY-MM-DD
      const now = new Date();
      
      const orderData = snapshot.docs
        .map(doc => {
          const data = doc.data();
          // Determinar método principal del split de pagos
          let mainMethod = '';
          if (Array.isArray(data.payments) && data.payments.length) {
            const max = data.payments.reduce((a, b) => (b.amount > a.amount ? b : a), data.payments[0]);
            mainMethod = max.method;
          }
          return {
            id: doc.id,
            ...data,
            type: data.type || 'lunch',
            meals: Array.isArray(data.meals) ? data.meals.map(m => ({
              ...m,
              paymentMethod: mainMethod ? { name: mainMethod } : (m.paymentMethod || null),
            })) : [],
            createdAt: data.createdAt ?
              (data.createdAt instanceof Date ?
                data.createdAt :
                data.createdAt.toDate ?
                  data.createdAt.toDate() :
                  new Date(data.createdAt)
              ) :
              new Date()
          };
        })
        .filter(order => {
          // Filtrar por usuario Y por fecha del día actual
          if (order.userId !== user?.uid) return false;
          
          // Permitir órdenes recientes (últimos 10 min) independientemente de la fecha (fix para updates inmediatos)
          const isRecent = (now - order.createdAt) < 10 * 60 * 1000;
          
          // Obtener fecha de la orden
          const orderDate = order.createdAtLocal 
            ? order.createdAtLocal.split('T')[0] 
            : getColombiaLocalDateString(order.createdAt);
          
          return isRecent || orderDate === todayISO;
        });
      
      // Guardamos las órdenes de almuerzo y luego ordenamos todas juntas
      setOrders(prev => {
        // Mantener órdenes que no son almuerzo
        const nonLunchOrders = prev.filter(order => order.type !== 'lunch');
        // Combinar todas las órdenes
        const updatedOrders = [...nonLunchOrders, ...orderData];
        // Ordenar por fecha de creación (más reciente primero)
        return updatedOrders.sort((a, b) => {
          // Convertir a timestamp si es posible, o usar 0 si no existe
          const timestampA = a.createdAt ? (a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime()) : 0;
          const timestampB = b.createdAt ? (b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime()) : 0;
          return timestampB - timestampA;
        });
      });
      
      if (process.env.NODE_ENV === 'development') console.log('Updated waiter orders:', orderData);
    });

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
      settingsUnsubscribe();
      schedulesUnsubscribe();
      ordersUnsubscribe();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return; // Eliminada dependencia de breakfastAdditions.length para evitar bloqueo

    const breakfastOrdersUnsubscribe = onSnapshot(collection(db, 'breakfastOrders'), (snapshot) => {
      const todayISO = getColombiaLocalDateString(); // Obtener fecha de hoy en formato YYYY-MM-DD
      const now = new Date();
      
      const breakfastOrders = snapshot.docs
        .map(doc => {
          const data = doc.data();
          // Determinar método principal del split de pagos
          let mainMethod = '';
          if (Array.isArray(data.payments) && data.payments.length) {
            const max = data.payments.reduce((a, b) => (b.amount > a.amount ? b : a), data.payments[0]);
            mainMethod = max.method;
          }
          return { 
            id: doc.id, 
            ...data, 
            type: 'breakfast',
            // Hidratar las adiciones con precios desde el catálogo y sincronizar método de pago
            breakfasts: Array.isArray(data.breakfasts) ? data.breakfasts.map(b => ({
              ...b,
              additions: Array.isArray(b.additions) ? b.additions.map(a => {
                const fullAddition = (breakfastAdditions||[]).find(ba => ba.name === a.name);
                return {
                  ...a,
                  price: a.price ?? (fullAddition?.price || 0)
                };
              }) : [],
              paymentMethod: mainMethod ? { name: mainMethod } : (b.paymentMethod || b.payment || null),
              payment: mainMethod ? { name: mainMethod } : (b.payment || b.paymentMethod || null),
            })) : [],
            createdAt: data.createdAt ? 
              (data.createdAt instanceof Date ? 
                data.createdAt : 
                data.createdAt.toDate ? 
                  data.createdAt.toDate() : 
                  new Date(data.createdAt)
              ) : 
              new Date()
          };
        })
        .filter(order => {
          // Filtrar por usuario Y por fecha del día actual
          if (order.userId !== user?.uid) return false;
          
          // Permitir órdenes recientes (últimos 10 min) independientemente de la fecha
          const isRecent = (now - order.createdAt) < 10 * 60 * 1000;
          
          // Obtener fecha de la orden
          const orderDate = order.createdAtLocal 
            ? order.createdAtLocal.split('T')[0] 
            : getColombiaLocalDateString(order.createdAt);
          
          return isRecent || orderDate === todayISO;
        });
      
      // Guardamos las órdenes de desayuno y luego ordenamos todas juntas
      setOrders(prev => {
        // Mantener órdenes que no son desayuno
        const nonBreakfastOrders = prev.filter(order => order.type !== 'breakfast');
        // Combinar todas las órdenes
        const updatedOrders = [...nonBreakfastOrders, ...breakfastOrders];
        // Ordenar por fecha de creación (más reciente primero)
        return updatedOrders.sort((a, b) => {
          // Convertir a timestamp si es posible, o usar 0 si no existe
          const timestampA = a.createdAt ? (a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime()) : 0;
          const timestampB = b.createdAt ? (b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime()) : 0;
          return timestampB - timestampA;
        });
      });
      
      if (process.env.NODE_ENV === 'development') console.log('Updated breakfast orders:', breakfastOrders);
    });

    return () => breakfastOrdersUnsubscribe();
  }, [user, breakfastAdditions]);

  useEffect(() => {
    // Si hay override manual, no cambiar automáticamente
    if (manualMenuType) {
      setMenuType(manualMenuType);
      setTimeRemaining(
        manualMenuType === 'breakfast'
          ? (() => {
              const hours = Math.floor(schedules.breakfastEnd / 60);
              const mins = schedules.breakfastEnd % 60;
              const period = hours >= 12 ? 'PM' : 'AM';
              const adjustedHours = hours % 12 || 12;
              return `${adjustedHours}:${mins.toString().padStart(2, '0')} ${period}`;
            })()
          : manualMenuType === 'lunch'
            ? (() => {
                const hours = Math.floor(schedules.lunchEnd / 60);
                const mins = schedules.lunchEnd % 60;
                const period = hours >= 12 ? 'PM' : 'AM';
                const adjustedHours = hours % 12 || 12;
                return `${adjustedHours}:${mins.toString().padStart(2, '0')} ${period}`;
              })()
            : ''
      );
      return;
    }
    const updateMenuTypeAndTime = () => {
      const now = new Date();
      const totalMinutes = now.getHours() * 60 + now.getMinutes();
      let menu = 'closed';
      let timeString = '';

      const formatTime = (minutes) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        const period = hours >= 12 ? 'PM' : 'AM';
        const adjustedHours = hours % 12 || 12;
        return `${adjustedHours}:${mins.toString().padStart(2, '0')} ${period}`;
      };

      if (totalMinutes >= schedules.breakfastStart && totalMinutes <= schedules.breakfastEnd) {
        menu = 'breakfast';
        timeString = formatTime(schedules.breakfastEnd);
      } else if (totalMinutes >= schedules.lunchStart && totalMinutes <= schedules.lunchEnd) {
        menu = 'lunch';
        timeString = formatTime(schedules.lunchEnd);
      }

      setMenuType(menu);
      setTimeRemaining(timeString);
    };

    updateMenuTypeAndTime();
    const interval = setInterval(updateMenuTypeAndTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [schedules, manualMenuType]);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleSendOrder = async () => {
    // Prevenir doble clic
    if (isLoading) {
      console.log('[WaiterDashboard] Orden ya está siendo procesada, ignorando clic adicional');
      return;
    }

    let incompleteMealIndex = null;
    let incompleteSlideIndex = null;
    let firstMissingField = '';
    for (let i = 0; i < meals.length; i++) {
      const meal = meals[i];
      const isCompleteRice = Array.isArray(meal?.principle) && meal.principle.some(p => ['Arroz con pollo', 'Arroz paisa', 'Arroz tres carnes'].includes(p.name));
      const missing = [];
      const slideMap = {
        'Sopa o reemplazo de sopa': 0,
        'Principio': 1,
        'Proteína': 2,
        'Bebida': 3,
        'Acompañamientos': 4,
        'Mesa': 5,
        'Método de pago': 6,
      };

      if (!meal?.soup && !meal?.soupReplacement) missing.push('Sopa o reemplazo de sopa');
      if (!meal?.principle && !meal?.principleReplacement) missing.push('Principio');
      if (!isCompleteRice && !meal?.protein) missing.push('Proteína');
      // Bebida y Método de pago ya NO son requeridos para mesero
      if (!isCompleteRice && (!meal?.sides || meal.sides.length === 0)) missing.push('Acompañamientos');
      if (!meal?.tableNumber) missing.push('Mesa');

      if (missing.length > 0) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Meal ${i + 1} is incomplete. Missing fields:`, missing);
          console.log(`Meal ${i + 1} data:`, meal);
        }
        incompleteMealIndex = i;
        firstMissingField = missing[0];
        incompleteSlideIndex = slideMap[firstMissingField] || 0;
        break;
      }
    }

    if (incompleteMealIndex !== null) {
      setIncompleteMealIndex(incompleteMealIndex);
      setIncompleteSlideIndex(incompleteSlideIndex);
      setErrorMessage(`Por favor, completa el campo "${firstMissingField}" para el Almuerzo #${incompleteMealIndex + 1}.`);
      setTimeout(() => {
        const element = document.getElementById(`meal-item-${incompleteMealIndex}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('highlight-incomplete');
          setTimeout(() => element.classList.remove('highlight-incomplete'), 3000);
          element.dispatchEvent(new CustomEvent('updateSlide', { detail: { slideIndex: incompleteSlideIndex } }));
        }
      }, 100);
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);
    try {
      const order = {
        userId: user.uid,
        userEmail: user.email || `waiter_${user.uid}@example.com`,
        meals: meals.map(meal => ({
          soup: meal.soup ? { name: meal.soup.name } : null,
          soupReplacement: meal.soupReplacement ? { name: meal.soupReplacement.name, replacement: meal.soupReplacement.replacement || '' } : null,
          principle: Array.isArray(meal.principle) ? meal.principle.map(p => ({ name: p.name, replacement: p.replacement || '' })) : [],
          principleReplacement: meal.principleReplacement ? { name: meal.principleReplacement.name } : null,
          protein: meal.protein ? { 
            name: meal.protein.name,
            price: meal.protein.price || 0  // Incluir precio de la proteína
          } : null,
          drink: meal.drink ? { name: meal.drink.name } : { name: 'Sin bebida' }, // Valor por defecto
          sides: Array.isArray(meal.sides) ? meal.sides.map(s => ({ name: s.name })) : [],
          additions: meal.additions?.map(addition => ({
            id: addition.id,
            name: addition.name,
            protein: addition.protein || '',
            replacement: addition.replacement || '',
            quantity: addition.quantity || 1,
            price: addition.price || 0,
          })) || [],
          tableNumber: meal.tableNumber || '',
          payment: meal.payment ? { name: meal.payment.name } : { name: 'Efectivo' }, // Usar 'payment' en lugar de 'paymentMethod'
          orderType: meal.orderType || '',
          notes: meal.notes || '',
        })),
        total: calculateTotal(meals, 3),
        status: 'Pendiente',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      console.log('[WaiterDashboard] Saving order with meals:', order.meals);
      await addDoc(collection(db, 'tableOrders'), order);
  setSuccessMessage('¡Orden de mesa guardada con éxito!');
  // Limpiar completamente la lista para mostrar mensaje "No hay almuerzos..."
  setMeals([]);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('Error al guardar la orden de mesa:', error);
      setErrorMessage('Error al guardar la orden. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const duplicateOrder = async () => {
    if (!editingOrder) return;
    
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      // Crear nueva orden basada en la actual
      const newOrderData = {
        userId: user.uid,
        userEmail: user.email || `delivery_${user.uid}@example.com`,
        status: 'Pendiente',
        createdAt: new Date(),
        updatedAt: new Date(),
        total: editingOrder.total
      };
      
      const collectionName = editingOrder.type === 'lunch' ? 'tableOrders' : 'breakfastOrders';
      
      if (editingOrder.type === 'lunch') {
        newOrderData.meals = editingOrder.meals.map(meal => ({
          soup: meal.soup,
          soupReplacement: meal.soupReplacement,
          principle: meal.principle,
          principleReplacement: meal.principleReplacement,
          protein: meal.protein,
          drink: meal.drink,
          sides: meal.sides,
          additions: meal.additions || [],
          tableNumber: meal.tableNumber || '',
          payment: meal.payment,
          orderType: meal.orderType || '',
          notes: meal.notes || ''
        }));
      } else {
        newOrderData.breakfasts = editingOrder.breakfasts.map(breakfast => ({
          type: breakfast.type,
          broth: breakfast.broth,
          eggs: breakfast.eggs,
          riceBread: breakfast.riceBread,
          drink: breakfast.drink,
          protein: breakfast.protein,
          additions: breakfast.additions || [],
          tableNumber: breakfast.tableNumber || '',
          paymentMethod: breakfast.paymentMethod,
          orderType: breakfast.orderType || '',
          notes: breakfast.notes || ''
        }));
        newOrderData.tableNumber = editingOrder.tableNumber;
      }
      
      await addDoc(collection(db, collectionName), newOrderData);
      setSuccessMessage('¡Orden duplicada con éxito!');
      setEditingOrder(null);
      
    } catch (error) {
      console.error('Error duplicando orden:', error);
      setErrorMessage('Error al duplicar la orden. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendBreakfastOrder = async () => {
    // Prevenir doble clic
    if (isLoading) {
      console.log('[WaiterDashboard] Orden de desayuno ya está siendo procesada, ignorando clic adicional');
      return;
    }

    let incompleteIndex = null;
    let incompleteSlide = null;
    let firstMissingField = '';

    breakfasts.forEach((breakfast, index) => {
      const typeData = Array.isArray(breakfastTypes) ? breakfastTypes.find(bt => bt.name === breakfast.type?.name) : null;
      const steps = typeData ? typeData.steps || [] : ['type', 'eggs', 'broth', 'riceBread', 'drink', 'protein'];
      const missing = [];

      if (!breakfast.type?.name) missing.push('type');
      steps.forEach(step => {
        if (step === 'tableNumber') {
          if (!breakfast.tableNumber) missing.push('tableNumber');
        } else if (step === 'paymentMethod' || step === 'drink') {
          // Bebida y Pago ya NO son requeridos para mesero
        } else if (step === 'orderType') {
          if (!breakfast.orderType) missing.push('orderType');
        } else if (!breakfast[step]) {
          missing.push(step);
        }
      });

      if (missing.length > 0 && incompleteIndex === null) {
        incompleteIndex = index;
        firstMissingField = missing[0];
        const slideMap = {
          type: 0,
          broth: 1,
          eggs: 2,
          riceBread: 3,
          drink: 4,
          protein: 5,
          tableNumber: 6,
          paymentMethod: 7,
          orderType: 8,
        };
        incompleteSlide = slideMap[firstMissingField] || 0;
      }
    });

    if (incompleteIndex !== null) {
      setIncompleteBreakfastIndex(incompleteIndex);
      setIncompleteBreakfastSlideIndex(incompleteSlide);
      setErrorMessage(
        `Por favor, completa el campo "${firstMissingField}" para el Desayuno #${incompleteIndex + 1}.`
      );
      setTimeout(() => {
        const element = document.getElementById(`breakfast-item-${breakfasts[incompleteIndex].id}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('highlight-incomplete');
          setTimeout(() => element.classList.remove('highlight-incomplete'), 3000);
        }
      }, 100);
      return;
    }

    setErrorMessage(null);
    setIsLoading(true);

    try {
      console.log('🔍 [WaiterDashboard] === GUARDANDO PEDIDO DESAYUNO ===');
      // Construir desglose de pagos por método para totales
      const paymentsByMethodBreakfast = {};
      breakfasts.forEach((b, index) => {
        console.log(`🔍 [WaiterDashboard] Procesando desayuno ${index + 1} para pago:`, {
          breakfast: {
            type: b.type?.name,
            broth: b.broth?.name,
            orderType: b.orderType,
            additions: b.additions,
            paymentMethod: b.paymentMethod
          }
        });

        const method = getMethodName(b.paymentMethod || b.payment);
        if (!method) return;
        
        const amount = Number(calculateBreakfastPrice(b, 3) || 0);
        console.log(`🔍 [WaiterDashboard] Cálculo de precio para pago:`, {
          method,
          amount,
          source: 'WaiterDashboard.js'
        });
        
        paymentsByMethodBreakfast[method] = (paymentsByMethodBreakfast[method] || 0) + amount;
      });

      console.log('🔍 [WaiterDashboard] === RESUMEN DE PAGOS ===', paymentsByMethodBreakfast);

      const paymentsBreakfast = Object.entries(paymentsByMethodBreakfast).map(([method, amount]) => ({
        method,
        amount: Math.floor(amount),
      }));

      const order = {
        userId: user.uid,
        userEmail: user.email || `waiter_${user.uid}@example.com`,
        tableNumber: breakfasts[0]?.tableNumber || '', // Agregar tableNumber a nivel de orden
        breakfasts: breakfasts.map(breakfast => ({
          type: breakfast.type ? { name: breakfast.type.name } : null,
          broth: breakfast.broth ? { name: breakfast.broth.name } : null,
          eggs: breakfast.eggs ? { name: breakfast.eggs.name } : null,
          riceBread: breakfast.riceBread ? { name: breakfast.riceBread.name } : null,
          drink: breakfast.drink ? { name: breakfast.drink.name } : { name: 'Sin bebida' }, // Valor por defecto
          protein: breakfast.protein ? { name: breakfast.protein.name } : null,
          additions: breakfast.additions?.map(addition => ({
            name: addition.name,
            quantity: addition.quantity || 1,
            price: addition.price || 0,
          })) || [],
          tableNumber: breakfast.tableNumber || '',
          // Normaliza y guarda ambos por compatibilidad - Valor por defecto: Efectivo
          paymentMethod: (breakfast.paymentMethod || breakfast.payment)
            ? { name: getMethodName(breakfast.paymentMethod || breakfast.payment) }
            : { name: 'Efectivo' },
          payment: (breakfast.payment || breakfast.paymentMethod)
            ? { name: getMethodName(breakfast.payment || breakfast.paymentMethod) }
            : { name: 'Efectivo' },
          orderType: breakfast.orderType || '',
          notes: breakfast.notes || '',
        })),
        total: (() => {
          const total = calculateTotalBreakfastPrice(breakfasts, 3, breakfastTypes);
          console.log('🔍 [WaiterDashboard] === TOTAL FINAL PARA GUARDAR ===', {
            total,
            breakfastsLength: breakfasts.length,
            source: 'WaiterDashboard save order'
          });
          return total;
        })(),
        payments: paymentsBreakfast,
        status: 'Pendiente',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      console.log('[WaiterDashboard] === ORDEN COMPLETA A GUARDAR ===', {
        order: {
          ...order,
          breakfasts: order.breakfasts.map(b => ({
            type: b.type?.name,
            broth: b.broth?.name,
            orderType: b.orderType,
            additions: b.additions
          }))
        }
      });
      if (process.env.NODE_ENV === 'development') console.log('[WaiterDashboard] Saving breakfast order:', order);
      await addDoc(collection(db, 'breakfastOrders'), order);
  setSuccessMessage('¡Orden de desayuno guardada con éxito!');
  // Limpiar lista para que aparezca mensaje "No hay desayunos..."
  setBreakfasts([]);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('Error al guardar la orden de desayuno:', error);
      setErrorMessage('Error al guardar la orden de desayuno. Intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (orderId, newStatus, orderType) => {
    try {
      setIsLoading(true);
      console.log('Attempting to update status for orderId:', orderId, 'to', newStatus, 'with role:', role, 'type:', orderType);
      const collectionName = orderType === 'breakfast' ? 'breakfastOrders' : 'tableOrders';
      const orderRef = doc(db, collectionName, orderId);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: new Date(),
      });
      setErrorMessage(null);
      setSuccessMessage(`Estado de la orden ${orderId.slice(0, 8)} actualizado a ${newStatus}`);
      setShowMenu(null);
      if (process.env.NODE_ENV === 'development') {
        console.log(`Estado de la orden ${orderId} actualizado a ${newStatus}`);
      }
    } catch (error) {
      console.error('Error al actualizar estado:', error);
      setErrorMessage(`Error al actualizar el estado: ${error.message}. Verifica tu rol y permisos.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditOrder = (order) => {
    // Lógica para editar órdenes rápidas no expandidas (generación al vuelo)
    if (order.quickMode && !order.expanded) {
      const rawType = (order.type || order.orderType || '').toLowerCase();
      const isLunch = ['lunch','almuerzo'].includes(rawType);
      const isBreakfast = ['breakfast','desayuno'].includes(rawType);

      if (isLunch) {
        const mealsExpanded = [];
        (order.quickItems||[]).forEach(item => {
          for (let i=0; i< (item.quantity||1); i++) {
            let meal;
            if (item?.variant) {
              const base = quickVariantToMeal(item.variant, { proteins, soups });
              meal = {
                soup: base.soup ? { name: base.soup.name } : null,
                soupReplacement: base.soupReplacement ? { name: 'Remplazo por Sopa', replacement: base.soupReplacement.replacement || base.soupReplacement.name || '' } : null,
                principle: Array.isArray(base.principle) ? base.principle.map(p => ({ name: p.name })) : [],
                principleReplacement: base.principleReplacement ? { name: base.principleReplacement.name } : null,
                protein: base.protein ? { name: base.protein.name, price: base.protein.price || 0 } : null,
                drink: base.drink ? { name: base.drink.name } : { name: 'Sin bebida' },
                sides: [],
                additions: [],
                tableNumber: order.tableNumber || (order.meals?.[0]?.tableNumber) || '',
                paymentMethod: { name: 'Efectivo' },
                orderType: 'almuerzo',
                notes: base.notes || '',
                showReplacementsState: {}
              };
            } else {
              const nameLower = (item.name||'').toLowerCase();
              const isSinSopa = nameLower.includes('sin sopa');
              const isMojarra = nameLower.includes('mojarra');
              const isPechuga = nameLower.includes('pechuga');
              
              // Intentar encontrar la proteína en el catálogo
              let proteinObj = null;
              if (isMojarra || isPechuga) {
                 proteinObj = proteins.find(p => p.name.toLowerCase() === item.name.toLowerCase()) || { name: item.name, price: Number(item.price||0) };
              }

              meal = {
                soup: isSinSopa ? null : { name: 'Sopa' },
                soupReplacement: isSinSopa ? { name: 'Remplazo por Sopa', replacement: 'Solo bandeja' } : null,
                principle: [],
                principleReplacement: null,
                protein: proteinObj,
                drink: { name: 'Sin bebida' },
                sides: [],
                additions: [],
                tableNumber: order.tableNumber ? (tableOptions.find(t => t.name.toLowerCase() === order.tableNumber.toLowerCase() || t.name.toLowerCase() === `mesa ${order.tableNumber}`.toLowerCase()) || { name: order.tableNumber }) : null,
                paymentMethod: { name: 'Efectivo' },
                orderType: 'almuerzo',
                notes: 'Quick básico: ' + (item.name||''),
                showReplacementsState: { soup: isSinSopa }
              };
            }
            mealsExpanded.push(meal);
          }
        });
        // Inyectar adiciones rápidas
        if (order.quickAdditions && order.quickAdditions.length && mealsExpanded.length) {
          mealsExpanded[0].additions = order.quickAdditions.map(a => ({
            name: a.name,
            quantity: a.quantity || 1,
            price: a.price || 0
          }));
        }
        
        setEditingOrder({
          ...order,
          meals: mealsExpanded,
          total: order.total || order.quickTotal || 0
        });
        setShowMenu(null);
        return;
      } else if (isBreakfast) {
        const breakfastsExpanded = [];
        (order.quickItems||[]).forEach(item => {
          for (let i=0; i< (item.quantity||1); i++) {
            let breakfast;
            if (item?.variant) {
              const base = quickVariantToBreakfast(item.variant, { breakfastBroths, breakfastProteins, breakfastTypes });
              breakfast = {
                broth: base.broth ? { name: base.broth.name } : null,
                eggs: base.eggs ? { name: base.eggs.name || 'Huevos', quantity: base.eggs.quantity || 2 } : null,
                type: base.type ? { name: base.type.name } : null,
                protein: base.protein ? { name: base.protein.name } : null,
                drink: base.drink ? { name: base.drink.name } : { name: 'Sin bebida' },
                riceBread: base.riceBread ? { name: base.riceBread.name } : null,
                additions: [],
                notes: base.notes || '',
                tableNumber: order.tableNumber || (order.breakfasts?.[0]?.tableNumber) || '',
                payment: { name: 'Efectivo' },
                orderType: 'desayuno'
              };
            } else {
              const nameLower = (item.name||'').toLowerCase();
              let typeName = 'solo huevos';
              if (nameLower.startsWith('desayuno completo')) typeName = 'desayuno completo';
              else if (nameLower.startsWith('solo caldo')) typeName = 'solo caldo';
              else if (nameLower.startsWith('moñona') || nameLower.startsWith('monona')) typeName = 'moñona';
              else if (nameLower.startsWith('solo huevos')) typeName = 'solo huevos';
              
              let brothName = '';
              if (['desayuno completo','solo caldo'].includes(typeName)) {
                if (nameLower.includes('costilla')) brothName = 'caldo de costilla';
                else if (nameLower.includes('pescado')) brothName = 'caldo de pescado';
                else if (nameLower.includes('pata')) brothName = 'caldo de pata';
                else if (nameLower.includes('pajarilla')) brothName = 'caldo de pajarilla';
                else if (nameLower.includes('pollo')) brothName = 'caldo de pollo';
                else brothName = 'caldo de costilla';
              }

              // Buscar objetos completos en catálogos
              const typeObj = breakfastTypes.find(t => t.name.toLowerCase() === typeName.toLowerCase()) || { name: typeName };
              const brothObj = brothName ? (breakfastBroths.find(b => b.name.toLowerCase() === brothName.toLowerCase()) || { name: brothName }) : null;

              breakfast = {
                broth: brothObj,
                eggs: { name: 'Huevos', quantity: 2 },
                type: typeObj,
                protein: null,
                drink: { name: 'Sin bebida' },
                riceBread: null,
                additions: [],
                notes: 'Quick básico: ' + (item.name||''),
                tableNumber: order.tableNumber ? (tableOptions.find(t => t.name.toLowerCase() === order.tableNumber.toLowerCase() || t.name.toLowerCase() === `mesa ${order.tableNumber}`.toLowerCase()) || { name: order.tableNumber }) : null,
                paymentMethod: { name: 'Efectivo' },
                orderType: 'desayuno'
              };
            }
            breakfastsExpanded.push(breakfast);
          }
        });
        if (order.quickAdditions && order.quickAdditions.length && breakfastsExpanded.length) {
          breakfastsExpanded[0].additions = order.quickAdditions.map(a => ({
            name: a.name,
            quantity: a.quantity || 1,
            price: a.price || 0
          }));
        }

        setEditingOrder({
          ...order,
          breakfasts: breakfastsExpanded,
          total: order.total || order.quickTotal || 0
        });
        setShowMenu(null);
        return;
      }
    }

    if (order.type === 'lunch') {
      const initializedOrder = {
        ...order,
        meals: order.meals.map(meal => {
          // Encontrar el objeto completo de la proteína desde el array de proteins
          const proteinObj = meal.protein ? proteins.find(p => p.name === meal.protein.name) : null;
          
          // Encontrar el objeto completo de la sopa desde el array de soups
          const soupObj = meal.soup ? soups.find(s => s.name === meal.soup.name) : null;
          
          // Encontrar el objeto completo de soupReplacement desde el array de soupReplacements
          const soupReplacementObj = meal.soupReplacement ? soupReplacements.find(sr => sr.name === 'Remplazo por Sopa') : null;
          
          // Encontrar los objetos completos de principle desde el array de principles
          const principleObjs = Array.isArray(meal.principle) ? meal.principle.map(p => {
            const principleObj = principles.find(pr => pr.name === p.name);
            return principleObj ? { ...principleObj, replacement: p.replacement || '' } : null;
          }).filter(Boolean) : [];
          
          // Encontrar los objetos completos de sides desde el array de sides
          const sidesObjs = Array.isArray(meal.sides) ? meal.sides.map(s => 
            sides.find(sd => sd.name === s.name)
          ).filter(Boolean) : [];
          
          // Encontrar el objeto completo de tableNumber desde el array de tableOptions
          const tableObj = meal.tableNumber ? tableOptions.find(t => t.name === meal.tableNumber) : null;
          
          if (process.env.NODE_ENV === 'development') {
            console.log('[handleEditOrder] Table debug:', {
              savedTableNumber: meal.tableNumber,
              tableObj,
              tableOptions,
              foundMatch: !!tableObj
            });
          }
          
          return {
            soup: soupObj,
            soupReplacement: soupReplacementObj ? {
              ...soupReplacementObj,
              replacement: meal.soupReplacement.replacement || ''
            } : null,
            principle: principleObjs,
            principleReplacement: meal.principleReplacement || null,
            protein: proteinObj,
            drink: meal.drink || null,
            sides: sidesObjs,
            additions: Array.isArray(meal.additions) ? meal.additions : [],
            paymentMethod: meal.paymentMethod || meal.payment || null,
            tableNumber: tableObj,
            orderType: meal.orderType || '',
            notes: meal.notes || '',
            showReplacementsState: {
              soup: meal.soupReplacement?.name === 'Remplazo por Sopa' && !!meal.soupReplacement?.replacement,
              principle: meal.principle?.some(opt => opt.name === 'Remplazo por Principio' && !!opt.replacement) || false,
            },
          };
        }),
      };
      setEditingOrder(initializedOrder);
      if (process.env.NODE_ENV === 'development') {
        console.log('[WaiterDashboard] Editing lunch order:', initializedOrder);
        console.log('[WaiterDashboard] Meals count:', initializedOrder.meals.length);
        console.log('[WaiterDashboard] Soup replacement:', initializedOrder.meals[0]?.soupReplacement);
        console.log('[WaiterDashboard] Principle replacement:', initializedOrder.meals[0]?.principle);
        console.log('[WaiterDashboard] Additions for first meal:', initializedOrder.meals[0]?.additions);
      }
    } else if (order.type === 'breakfast') {
      const initializedOrder = {
        ...order,
        breakfasts: order.breakfasts.map(breakfast => ({
          type: breakfast.type || null,
          broth: breakfast.broth || null,
          eggs: breakfast.eggs || null,
          riceBread: breakfast.riceBread || null,
          drink: breakfast.drink || null,
          protein: breakfast.protein || null,
          additions: Array.isArray(breakfast.additions) ? breakfast.additions : [],
          tableNumber: breakfast.tableNumber || '',
          paymentMethod: breakfast.paymentMethod || breakfast.payment || null,
          orderType: breakfast.orderType || '',
          notes: breakfast.notes || '',
        })),
      };
      setEditingOrder(initializedOrder);
      if (process.env.NODE_ENV === 'development') {
        console.log('[WaiterDashboard] Editing breakfast order:', initializedOrder);
        console.log('[WaiterDashboard] Breakfasts count:', initializedOrder.breakfasts.length);
        console.log('[WaiterDashboard] Additions for first breakfast:', initializedOrder.breakfasts[0]?.additions);
      }
    }
    setShowMenu(null);
  };

  const handleFormChange = (index, field, value) => {
    if (editingOrder.type === 'lunch') {
      if (field === 'total' && index === -1) {
        setEditingOrder(prev => ({ ...prev, total: parseFloat(value) || 0 }));
        console.log(`[WaiterDashboard] Updated total: ${value}`);
      } else {
        const newMeals = [...editingOrder.meals];
        if (field === 'principle' || field === 'sides') {
          newMeals[index] = { ...newMeals[index], [field]: value ? value : [] };
        } else if (field === 'soup' || field === 'soupReplacement' || field === 'principleReplacement' || field === 'protein' || field === 'drink' || field === 'paymentMethod') {
          newMeals[index] = { ...newMeals[index], [field]: value ? value : null };
          
          // Si cambia la proteína, recalcular precio si es Pechuga Gratinada
          if (field === 'protein') {
             // Forzar recálculo de precio
             // El calculateTotal ya lo hará, pero necesitamos asegurar que el orderType esté bien seteado en el meal
             // (ya debería estarlo)
          }

          if (field === 'soupReplacement' && value?.name === 'Remplazo por Sopa') {
            newMeals[index].showReplacementsState = { ...newMeals[index].showReplacementsState, soup: true };
          } else if (field === 'soupReplacement' || field === 'soup') {
            newMeals[index].showReplacementsState = { ...newMeals[index].showReplacementsState, soup: false };
            if (field === 'soup') {
              newMeals[index].soupReplacement = null;
            }
          }
          if (field === 'principle' && value?.some(opt => opt.name === 'Remplazo por Principio')) {
            newMeals[index].showReplacementsState = { ...newMeals[index].showReplacementsState, principle: true };
          } else if (field === 'principle') {
            newMeals[index].showReplacementsState = { ...newMeals[index].showReplacementsState, principle: false };
          }
        } else if (field === 'additions') {
          newMeals[index] = { ...newMeals[index], additions: value };
        } else {
          newMeals[index] = { ...newMeals[index], [field]: value };
        }
        const updatedTotal = calculateTotal(newMeals, 3);
        setEditingOrder(prev => ({ ...prev, meals: newMeals, total: updatedTotal }));
      }
    } else if (editingOrder.type === 'breakfast') {
      if (field === 'total' && index === -1) {
        setEditingOrder(prev => ({ ...prev, total: parseFloat(value) || 0 }));
        console.log(`[WaiterDashboard] Updated total: ${value}`);
      } else {
        const newBreakfasts = [...editingOrder.breakfasts];
        if (field === 'additions') {
          newBreakfasts[index] = { ...newBreakfasts[index], additions: value };
        } else {
          newBreakfasts[index] = { ...newBreakfasts[index], [field]: value ? value : null };
        }
        const updatedTotal = calculateTotalBreakfastPrice(newBreakfasts, 3, breakfastTypes);
        setEditingOrder(prev => ({ ...prev, breakfasts: newBreakfasts, total: updatedTotal }));
      }
    }
  };

  const handleSaveEdit = async () => {
    if (editingOrder.type === 'lunch') {
      for (const [index, meal] of editingOrder.meals.entries()) {
        const unconfiguredAdditions = meal.additions?.filter(
          add => add.requiresReplacement && (
            (add.name === 'Proteína adicional' && !add.protein) ||
            (['Sopa adicional', 'Principio adicional', 'Bebida adicional'].includes(add.name) && !add.replacement)
          )
        ) || [];
        if (unconfiguredAdditions.length > 0) {
          setErrorMessage(`Por favor, selecciona una opción para "${unconfiguredAdditions[0].name}" en Almuerzo #${index + 1}.`);
          return;
        }
        // Auto-asignar orderType basado en tableNumber si no existe
        if (!meal.orderType && meal.tableNumber) {
          const tableNumberName = typeof meal.tableNumber === 'string' ? meal.tableNumber : meal.tableNumber?.name || '';
          const isLlevar = tableNumberName.toLowerCase().includes('llevar');
          meal.orderType = isLlevar ? 'takeaway' : 'table';
        }
        if (!meal.tableNumber) {
          setErrorMessage(`La mesa es obligatoria para el Almuerzo #${index + 1}.`);
          return;
        }
      }
      try {
        setIsLoading(true);
        console.log('[WaiterDashboard] Saving edited lunch order:', editingOrder);
        const orderRef = doc(db, 'tableOrders', editingOrder.id);
        await updateDoc(orderRef, {
          meals: editingOrder.meals.map(meal => ({
            soup: meal.soup ? { name: meal.soup.name || '' } : null,
            soupReplacement: meal.soupReplacement ? { name: meal.soupReplacement.name || '', replacement: meal.soupReplacement.replacement || '' } : null,
            principle: Array.isArray(meal.principle) ? meal.principle.map(p => ({ name: p.name || '', replacement: p.replacement || '' })) : [],
            principleReplacement: meal.principleReplacement ? { name: meal.principleReplacement.name || '' } : null,
            protein: meal.protein ? { name: meal.protein.name || '' } : null,
            drink: meal.drink ? { name: meal.drink.name || '' } : null,
            sides: Array.isArray(meal.sides) ? meal.sides.map(s => ({ name: s.name || '' })) : [],
            additions: meal.additions ? meal.additions.map(a => ({
              id: a.id || `add-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: a.name || '',
              protein: a.protein || '',
              replacement: a.replacement || '',
              quantity: a.quantity || 1,
              price: a.price || 0,
            })) : [],
            tableNumber: typeof meal.tableNumber === 'string' ? meal.tableNumber : (meal.tableNumber?.name || ''),
            paymentMethod: meal.paymentMethod ? { name: meal.paymentMethod.name || '' } : null,
            orderType: meal.orderType || '',
            notes: meal.notes || '',
          })),
          total: editingOrder.total !== undefined ? Number(editingOrder.total) : calculateTotal(editingOrder.meals, 3),
          updatedAt: new Date(),
        });
        setEditingOrder(null);
        setSuccessMessage(`Orden ${editingOrder.id.slice(0, 8)} actualizada con éxito`);
        if (process.env.NODE_ENV === 'development') {
          console.log(`Orden ${editingOrder.id} actualizada con éxito`);
        }
      } catch (error) {
        console.error('Error al guardar edición:', error);
        setErrorMessage(`Error al guardar los cambios: ${error.message}. Verifica tu rol y permisos.`);
      } finally {
        setIsLoading(false);
      }
    } else if (editingOrder.type === 'breakfast') {
      for (const [index, breakfast] of editingOrder.breakfasts.entries()) {
        const typeData = breakfastTypes.find(bt => bt.name === breakfast.type?.name) || { steps: ['type', 'eggs', 'broth', 'riceBread', 'drink', 'protein'] };
        const steps = typeData.steps || [];
        const missing = [];
        if (!breakfast.type?.name) missing.push('type');
        steps.forEach(step => {
          if (step === 'tableNumber' && !breakfast.tableNumber) missing.push('tableNumber');
          // Payment method validation removed for waiters
          else if (step === 'orderType' && !breakfast.orderType) missing.push('orderType');
          else if (!breakfast[step]) missing.push(step);
        });
        if (missing.length > 0) {
          setErrorMessage(`Por favor, completa el campo "${missing[0]}" para el Desayuno #${index + 1}.`);
          return;
        }
        // Auto-asignar orderType basado en tableNumber si no existe
        if (!breakfast.orderType && breakfast.tableNumber) {
          const tableVal = typeof breakfast.tableNumber === 'string' ? breakfast.tableNumber : (breakfast.tableNumber.name || '');
          const isLlevar = tableVal.toLowerCase().includes('llevar');
          breakfast.orderType = isLlevar ? 'takeaway' : 'table';
        }
        if (!breakfast.tableNumber) {
          setErrorMessage(`La mesa es obligatoria para el Desayuno #${index + 1}.`);
          return;
        }
      }
      try {
        setIsLoading(true);
        console.log('[WaiterDashboard] Saving edited breakfast order:', editingOrder);
        // Recalcular desglose de pagos por método
        const paymentsByMethodBreakfast = {};
        editingOrder.breakfasts.forEach((b, index) => {
          const method = getMethodName(b.paymentMethod || b.payment);
          if (!method) return;
          const amount = Number(calculateBreakfastPrice(b, 3) || 0);
          paymentsByMethodBreakfast[method] = (paymentsByMethodBreakfast[method] || 0) + amount;
        });
        const paymentsBreakfast = Object.entries(paymentsByMethodBreakfast).map(([method, amount]) => ({
          method,
          amount: Math.floor(amount),
        }));
        const orderRef = doc(db, 'breakfastOrders', editingOrder.id);
        await updateDoc(orderRef, {
          breakfasts: editingOrder.breakfasts.map(breakfast => ({
            type: breakfast.type ? { name: breakfast.type.name } : null,
            broth: breakfast.broth ? { name: breakfast.broth.name } : null,
            eggs: breakfast.eggs ? { name: breakfast.eggs.name } : null,
            riceBread: breakfast.riceBread ? { name: breakfast.riceBread.name } : null,
            drink: breakfast.drink ? { name: breakfast.drink.name } : { name: 'Sin bebida' }, // Valor por defecto
            protein: breakfast.protein ? { name: breakfast.protein.name } : null,
            additions: breakfast.additions?.map(addition => ({
              name: addition.name,
              quantity: addition.quantity || 1,
              price: addition.price || 0,
            })) || [],
            tableNumber: breakfast.tableNumber || '',
            paymentMethod: (breakfast.paymentMethod || breakfast.payment)
              ? { name: getMethodName(breakfast.paymentMethod || breakfast.payment) }
              : null,
            orderType: breakfast.orderType || '',
            notes: breakfast.notes || '',
          })),
          total: editingOrder.total !== undefined ? editingOrder.total : calculateTotalBreakfastPrice(editingOrder.breakfasts, 3, breakfastTypes),
          payments: paymentsBreakfast,
          updatedAt: new Date(),
        });
        setEditingOrder(null);
        setSuccessMessage(`Orden ${editingOrder.id.slice(0, 8)} actualizada con éxito`);
        if (process.env.NODE_ENV === 'development') {
          console.log(`Orden ${editingOrder.id} actualizada con éxito`);
        }
      } catch (error) {
        console.error('Error al guardar edición:', error);
        setErrorMessage(`Error al guardar los cambios: ${error.message}. Verifica tu rol y permisos.`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const formatValue = (value) => {
    if (!value) return 'N/A';
    if (typeof value === 'string') return value;
    if (value.name) return value.name;
    return 'N/A';
  };

  const formatArray = (arr) => {
    if (!arr || !Array.isArray(arr)) return formatValue(arr);
    if (arr.length === 0) return 'N/A';
    return arr.map(item => formatValue(item)).filter(v => v !== 'N/A').join(', ');
  };

  const statusColors = {
    'Pendiente': 'bg-gray-100 text-gray-800',
    'Preparando': 'bg-blue-100 text-blue-800',
    'Completada': 'bg-green-100 text-green-800',
    'Cancelada': 'bg-red-100 text-red-800',
  };

  const normalizedAdditions = useMemo(() => additions.map(add => ({
    ...add,
    price: add.name === 'Mojarra' ? 8000 : add.price,
    requiresReplacement: add.requiresReplacement || ['Proteína adicional', 'Sopa adicional', 'Principio adicional', 'Bebida adicional'].includes(add.name),
  })).filter(add =>
    add.name !== 'Arroz con pollo' &&
    add.name !== 'Arroz paisa' &&
    add.name !== 'Arroz tres carnes'
  ), [additions]);

  const getReplacementsForAdditions = (meal) => {
    const selectedAdditions = meal?.additions || [];
    const unconfiguredAdditions = selectedAdditions.filter(
      (add) => add.requiresReplacement && (add.name === 'Proteína adicional' ? !add.protein : !add.replacement)
    );
    if (unconfiguredAdditions.length === 0) return [];

    const firstUnconfigured = unconfiguredAdditions[0];
    if (firstUnconfigured.name === 'Sopa adicional') return soups.filter(soup => soup.name !== 'Solo bandeja' && soup.name !== 'Remplazo por Sopa');
    if (firstUnconfigured.name === 'Principio adicional') return principles.filter(principle =>
      principle.name !== 'Remplazo por Principio' &&
      !['Arroz con pollo', 'Arroz paisa', 'Arroz tres carnes'].includes(principle.name)
    );
    if (firstUnconfigured.name === 'Proteína adicional') return proteins.filter((p) => p.name !== 'Mojarra');
    if (firstUnconfigured.name === 'Bebida adicional') return drinks.filter((d) => d.name !== 'Sin bebida');
    return [];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingIndicator message="Cargando panel del mesero..." size="medium" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'} pb-4`}>
      {/* Contenido principal - Sin header duplicado porque DeliveryOrdersPage ya lo proporciona */}
      <div className="flex-1 transition-all duration-300 min-h-screen">
        {/* Content */}
        <>
            <div className="flex border-b border-gray-300 mb-4">
              <button
                className={`px-4 py-2 text-sm font-medium ${activeTab === 'create' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-600'}`}
                onClick={() => setActiveTab('create')}
              >
                Crear Orden
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium ${activeTab === 'view' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-600'}`}
                onClick={() => setActiveTab('view')}
              >
                Ver Órdenes
              </button>
            </div>
  {/* Eliminado el selector anterior para evitar duplicidad */}
  {activeTab === 'create' ? (
          menuType === 'breakfast' ? (
            <>
              <div className="mb-4">
                <div className="flex items-center justify-center bg-white p-3 rounded-lg shadow-sm">
                  <span className="text-gray-700 text-sm text-center">
                    Toma pedidos rápido. {(manualMenuType || menuType) === 'breakfast' ? 'Desayuno' : (manualMenuType || menuType) === 'lunch' ? 'Almuerzo' : 'Menú'} disponible hasta {timeRemaining}
                  </span>
                  <div className="ml-4 flex items-center">
                    <select
                      className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring focus:border-blue-300"
                      value={manualMenuType || menuType}
                      onChange={e => setManualMenuType(e.target.value === 'auto' ? null : e.target.value)}
                      style={{ minWidth: 100 }}
                    >
                      <option value="auto">Automático</option>
                      <option value="breakfast">Desayuno</option>
                      <option value="lunch">Almuerzo</option>
                    </select>
                  </div>
                </div>
              </div>
              <BreakfastList
                breakfasts={breakfasts}
                setBreakfasts={setBreakfasts}
                eggs={breakfastEggs}
                broths={breakfastBroths}
                riceBread={breakfastRiceBread}
                drinks={breakfastDrinks}
                additions={breakfastAdditions}
                breakfastTypes={breakfastTypes}
                breakfastProteins={breakfastProteins}
                times={breakfastTimes}
                paymentMethods={paymentMethods}
                onBreakfastChange={(id, field, value) => handleBreakfastChange(setBreakfasts, id, field, value)}
                onRemoveBreakfast={(id) => removeBreakfast(setBreakfasts, setSuccessMessage, id, breakfasts)}
                onAddBreakfast={() => addBreakfast(setBreakfasts, setSuccessMessage, breakfasts, initializeBreakfastData({ isWaitress: true }))}
                onDuplicateBreakfast={(breakfast) => duplicateBreakfast(setBreakfasts, setSuccessMessage, breakfast, breakfasts)}
                incompleteBreakfastIndex={incompleteBreakfastIndex}
                incompleteSlideIndex={incompleteBreakfastSlideIndex}
                isOrderingDisabled={isOrderingDisabled}
                userRole={3}
                savedAddress={{}}
                isTableOrder={true}
              />
              <BreakfastOrderSummary
                items={breakfasts}
                onSendOrder={handleSendBreakfastOrder}
                user={{ role: 3 }}
                breakfastTypes={breakfastTypes}
                isWaiterView={true}
                isLoading={isLoading}
              />
            </>
          ) : (
            <>
              <div className="mb-4">
                <div className="flex items-center justify-center bg-white p-3 rounded-lg shadow-sm">
                  <span className="text-gray-700 text-sm text-center">
                    Toma pedidos rápido. {(manualMenuType || menuType) === 'breakfast' ? 'Desayuno' : (manualMenuType || menuType) === 'lunch' ? 'Almuerzo' : 'Menú'} disponible hasta {timeRemaining}
                  </span>
                  <div className="ml-4 flex items-center">
                    <select
                      className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring focus:border-blue-300"
                      value={manualMenuType || menuType}
                      onChange={e => setManualMenuType(e.target.value === 'auto' ? null : e.target.value)}
                      style={{ minWidth: 100 }}
                    >
                      <option value="auto">Automático</option>
                      <option value="breakfast">Desayuno</option>
                      <option value="lunch">Almuerzo</option>
                    </select>
                  </div>
                </div>
              </div>
              <MealList
                meals={meals}
                soups={soups}
                soupReplacements={soupReplacements}
                principles={principles}
                proteins={proteins}
                drinks={drinks}
                sides={sides}
                additions={additions}
                paymentMethods={paymentMethods}
                times={[]}
                isTableOrder={true}
                userRole={3}
                onMealChange={(id, field, value) => handleMealChange(setMeals, id, field, value)}
                onRemoveMeal={(id) => removeMeal(setMeals, setSuccessMessage, id, meals)}
                onAddMeal={() => addMeal(setMeals, setSuccessMessage, meals, initializeMealData({}, true))}
                onDuplicateMeal={(meal) => duplicateMeal(setMeals, setSuccessMessage, meal, meals)}
                incompleteMealIndex={incompleteMealIndex}
                incompleteSlideIndex={incompleteSlideIndex}
                isOrderingDisabled={isOrderingDisabled}
              />
              {(() => {
                const totalCalculated = calculateTotal(meals, 3);
                console.log('🔍 WaiterDashboard total calculado:', totalCalculated);
                return (
                  <OrderSummary
                    meals={meals}
                    onSendOrder={handleSendOrder}
                    calculateTotal={() => calculateTotal(meals, 3)}
                    preCalculatedTotal={totalCalculated}
                    isTableOrder={true}
                    isWaiterView={false}
                    userRole={3}
                    allSides={sides}
                    isLoading={isLoading}
                  />
                );
              })()}
            </>
          )
        ) : (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <p className="text-center text-gray-700">No has registrado órdenes de mesas.</p>
            ) : (
              <>
                {/* Separador para Desayunos si hay alguno */}
                {orders.some(order => order.type === 'breakfast') && (
                  <div 
                    className="bg-yellow-100 p-2 rounded-md text-center font-medium text-yellow-800 border-b-2 border-yellow-300 cursor-pointer hover:bg-yellow-200 transition-colors"
                    onClick={() => setExpandedBreakfast(!expandedBreakfast)}
                  >
                    <div className="flex justify-center items-center">
                      <span>Órdenes de Desayuno</span>
                      <span className="ml-2 text-lg">{expandedBreakfast ? '▼' : '▶'}</span>
                    </div>
                  </div>
                )}
                
                {/* Listar órdenes de desayuno */}
                {expandedBreakfast && orders
                  .filter(order => order.type === 'breakfast')
                  .map((order, index) => (
                    <div key={order.id} className={`p-4 rounded-lg shadow-md mb-3 ${statusColors[order.status] || 'bg-white'}`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                            {order.quickMode && !order.expanded && <span className="inline-flex items-center px-1.5 py-0.5 bg-green-600 text-white text-[10px] rounded">⚡ Rápido</span>}
                            Desayuno #{index + 1} - Mesa {formatValue(order.breakfasts?.[0]?.tableNumber || order.tableNumber)} - #{order.id.slice(-4)}
                          </h2>
                          {order.quickMode && !order.expanded && (
                            <div className="mt-1 text-[11px] text-green-700 font-medium">Pendiente de expansión</div>
                          )}
                          {order.quickMode && order.expanded && order.quickAdditions?.length > 0 && (
                            <div className="mt-1 text-[11px] text-purple-700 font-medium">Incluye {order.quickAdditions.length} adición(es) rápida(s)</div>
                          )}
                        </div>
                    <div className="relative">
                      <button
                        onClick={() => setShowMenu(showMenu === order.id ? null : order.id)}
                        className="text-gray-600 hover:text-gray-800 focus:outline-none"
                      >
                        ⋮
                      </button>
                      {showMenu === order.id && (
                        <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                          <button
                            onClick={() => handleStatusChange(order.id, 'Pendiente', order.type)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:bg-gray-200"
                            disabled={order.status === 'Pendiente'}
                          >
                            Pendiente
                          </button>
                          <button
                            onClick={() => handleStatusChange(order.id, 'Preparando', order.type)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:bg-gray-200"
                            disabled={order.status === 'Preparando'}
                          >
                            Preparando
                          </button>
                          <button
                            onClick={() => handleStatusChange(order.id, 'Completada', order.type)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:bg-gray-200"
                            disabled={order.status === 'Completada'}
                          >
                            Completada
                          </button>
                          <button
                            onClick={() => handleStatusChange(order.id, 'Cancelada', order.type)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:bg-gray-200"
                            disabled={order.status === 'Cancelada'}
                          >
                            Cancelada
                          </button>
                          {order.quickMode && !order.expanded && (
                            <button
                              onClick={() => { expandQuickOrder(order); setShowMenu(null); }}
                              className="block w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-100"
                            >
                              Expandir Detalles
                            </button>
                          )}
                          <button
                            onClick={() => handleEditOrder(order)}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            Editar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {order.type === 'breakfast' ? (
                    <BreakfastOrderSummary
                      items={order.breakfasts}
                      user={{ role: 3 }}
                      breakfastTypes={breakfastTypes}
                      isWaiterView={true}
                      statusClass={statusColors[order.status] || ''} // Añadir clase de estado
                      showSaveButton={false} // Indica explícitamente que estamos en "Ver Órdenes"
                    />
                  ) : (
                    <OrderSummary
                      meals={order.meals}
                      isTableOrder={true}
                      calculateTotal={() => order.total}
                      isWaiterView={true}
                      statusClass={statusColors[order.status] || ''}
                      userRole={3}
                      allSides={sides}
                    />
                  )}
                  {(order.quickMode && !order.expanded && (order.quickItems?.length > 0 || order.quickAdditions?.length>0)) && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                      <div className="text-[11px] font-semibold text-green-700 mb-1">Resumen rápido:</div>
                      <ul className="text-[11px] text-green-800 list-disc ml-4 space-y-0.5">
                        {order.quickItems?.map((qi, idx) => (
                          <li key={idx}>{qi.quantity}x {qi.name}</li>
                        ))}
                        {order.quickAdditions?.map((qa, idx) => (
                          <li key={`qab-${idx}`}>{qa.quantity}x Adición: {qa.name}</li>
                        ))}
                      </ul>
                      <button
                        onClick={() => expandQuickOrder(order)}
                        className="mt-2 w-full text-center px-2 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[11px] rounded font-semibold"
                      >Expandir ahora</button>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Separador para Almuerzos si hay alguno */}
              {orders.some(order => order.type === 'lunch') && (
                <div 
                  className="bg-green-100 p-2 rounded-md text-center font-medium text-green-800 border-b-2 border-green-300 mt-6 mb-3 cursor-pointer hover:bg-green-200 transition-colors"
                  onClick={() => setExpandedLunch(!expandedLunch)}
                >
                  <div className="flex justify-center items-center">
                    <span>Órdenes de Almuerzo</span>
                    <span className="ml-2 text-lg">{expandedLunch ? '▼' : '▶'}</span>
                  </div>
                </div>
              )}
              
              {/* Listar órdenes de almuerzo */}
              {expandedLunch && orders
                .filter(order => order.type === 'lunch')
                .map((order, index) => (
                  <div key={order.id} className={`p-4 rounded-lg shadow-md mb-3 ${statusColors[order.status] || 'bg-white'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                          {order.quickMode && !order.expanded && <span className="inline-flex items-center px-1.5 py-0.5 bg-green-600 text-white text-[10px] rounded">⚡ Rápido</span>}
                          Almuerzo #{index + 1} - Mesa {formatValue(order.meals?.[0]?.tableNumber || order.tableNumber)} - #{order.id.slice(-4)}
                        </h2>
                        {order.quickMode && !order.expanded && (
                          <div className="mt-1 text-[11px] text-green-700 font-medium">Pendiente de expansión</div>
                        )}
                      </div>
                      <div className="relative">
                        <button
                          onClick={() => setShowMenu(showMenu === order.id ? null : order.id)}
                          className="text-gray-600 hover:text-gray-800 focus:outline-none"
                        >
                          ⋮
                        </button>
                        {showMenu === order.id && (
                          <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                            <button
                              onClick={() => handleStatusChange(order.id, 'Pendiente', order.type)}
                              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:bg-gray-200"
                              disabled={order.status === 'Pendiente'}
                            >
                              Pendiente
                            </button>
                            <button
                              onClick={() => handleStatusChange(order.id, 'Preparando', order.type)}
                              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:bg-gray-200"
                              disabled={order.status === 'Preparando'}
                            >
                              Preparando
                            </button>
                            <button
                              onClick={() => handleStatusChange(order.id, 'Completada', order.type)}
                              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:bg-gray-200"
                              disabled={order.status === 'Completada'}
                            >
                              Completada
                            </button>
                            <button
                              onClick={() => handleStatusChange(order.id, 'Cancelada', order.type)}
                              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:bg-gray-200"
                              disabled={order.status === 'Cancelada'}
                            >
                              Cancelada
                            </button>
                            {order.quickMode && !order.expanded && (
                              <button
                                onClick={() => { expandQuickOrder(order); setShowMenu(null); }}
                                className="block w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-100"
                              >
                                Expandir Detalles
                              </button>
                            )}
                            <button
                              onClick={() => handleEditOrder(order)}
                              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              Editar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <OrderSummary
                      meals={order.meals}
                      isTableOrder={true}
                      calculateTotal={() => order.total}
                      isWaiterView={true}
                      statusClass={statusColors[order.status] || ''}
                      userRole={3}
                      allSides={sides}
                    />
                    {(order.quickMode && !order.expanded && (order.quickItems?.length > 0 || order.quickAdditions?.length>0)) && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                        <div className="text-[11px] font-semibold text-green-700 mb-1">Resumen rápido:</div>
                        <ul className="text-[11px] text-green-800 list-disc ml-4 space-y-0.5">
                          {order.quickItems?.map((qi, idx) => (
                            <li key={idx}>{qi.quantity}x {qi.name}</li>
                          ))}
                          {order.quickAdditions?.map((qa, idx) => (
                            <li key={`qal-${idx}`}>{qa.quantity}x Adición: {qa.name}</li>
                          ))}
                        </ul>
                        <button
                          onClick={() => expandQuickOrder(order)}
                          className="mt-2 w-full text-center px-2 py-1.5 bg-green-600 hover:bg-green-700 text-white text-[11px] rounded font-semibold"
                        >Expandir ahora</button>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
    )}
  {editingOrder && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-8 pt-16 sm:pt-20"
            onClick={(e) => {
              // Cerrar modal solo si se hace clic en el fondo
              if (e.target === e.currentTarget) {
                setEditingOrder(null);
              }
            }}
          >
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-auto overflow-hidden flex flex-col" style={{ maxHeight: '85vh' }}>
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-2 flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-bold">✏️ Editar #{editingOrder.id.slice(-4)}</h2>
                  <p className="text-xs text-blue-100 mt-0.5">
                    {editingOrder.type === 'lunch' ? `${editingOrder.meals.length} Almuerzo(s)` : `${editingOrder.breakfasts.length} Desayuno(s)`} • 
                    ${(editingOrder.total || 0).toLocaleString('es-CO')}
                  </p>
                </div>
                <button
                  onClick={() => setEditingOrder(null)}
                  className="text-white hover:bg-blue-800 rounded-full p-1 transition-colors"
                  aria-label="Cerrar"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Contenido scrollable */}
              <div className="overflow-y-auto flex-1 px-3 sm:px-4 py-3">
              {editingOrder.type === 'lunch' ? (
                editingOrder.meals.map((meal, index) => (
                  <div key={index} className="mb-4">
                    {/* Resumen del pedido actual */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-3 border-blue-500 rounded p-2 mb-2 shadow-sm">
                      <div className="flex items-center mb-1.5">
                        <span className="bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mr-1.5">
                          {index + 1}
                        </span>
                        <h3 className="text-xs font-bold text-gray-800">Resumen</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                        {meal.soupReplacement && (
                          <div className="col-span-1 sm:col-span-2 bg-white rounded px-1.5 py-1">
                            <span className="font-semibold text-gray-700">🥣 Sopa:</span>
                            <span className="ml-1 text-gray-600">{meal.soupReplacement.replacement}</span>
                          </div>
                        )}
                        {meal.soup && !meal.soupReplacement && (
                          <div className="col-span-1 sm:col-span-2 bg-white rounded px-1.5 py-1">
                            <span className="font-semibold text-gray-700">🥣 Sopa:</span>
                            <span className="ml-1 text-gray-600">{meal.soup.name}</span>
                          </div>
                        )}
                        {meal.principle && meal.principle.length > 0 && (
                          <div className="col-span-1 sm:col-span-2 bg-white rounded px-1.5 py-1">
                            <span className="font-semibold text-gray-700">🍚 Principio:</span>
                            <span className="ml-1 text-gray-600">
                              {meal.principle.map(p => p.name === 'Remplazo por Principio' ? p.replacement : p.name).join(', ')}
                            </span>
                          </div>
                        )}
                        {meal.protein && (
                          <div className="bg-white rounded px-1.5 py-1">
                            <span className="font-semibold text-gray-700">🍖 Proteína:</span>
                            <span className="ml-1 text-gray-600">{meal.protein.name}</span>
                          </div>
                        )}
                        {meal.tableNumber && (
                          <div className="bg-white rounded px-1.5 py-1">
                            <span className="font-semibold text-gray-700">🍽️ Mesa:</span>
                            <span className="ml-1 text-gray-600">{meal.tableNumber.name}</span>
                          </div>
                        )}
                        {meal.sides && meal.sides.length > 0 && (
                          <div className="col-span-1 sm:col-span-2 bg-white rounded px-1.5 py-1">
                            <span className="font-semibold text-gray-700">🥗 Acompañamientos:</span>
                            <span className="ml-1 text-gray-600">{meal.sides.map(s => s.name).join(', ')}</span>
                          </div>
                        )}
                        {meal.additions && meal.additions.length > 0 && (
                          <div className="col-span-1 sm:col-span-2 bg-white rounded px-1.5 py-1">
                            <span className="font-semibold text-gray-700">➕ Adiciones:</span>
                            <span className="ml-1 text-gray-600">{meal.additions.map(a => `${a.name} (${a.quantity})`).join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Formulario de edición con acordeón */}
                    <div className="space-y-2">
                      <details 
                        className="group bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
                        open={openSections[`${index}-soup`] || false}
                        onToggle={(e) => toggleSection(index, 'soup', e.target.open)}
                      >
                        <summary className="flex items-center justify-between cursor-pointer px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors" onClick={(e) => e.preventDefault() || toggleSection(index, 'soup', !openSections[`${index}-soup`])}>
                          <span className="text-sm font-semibold text-gray-700 flex items-center">
                            <span className="text-base mr-1.5">🥣</span>
                            Sopa o Reemplazo
                          </span>
                          <svg className={`w-4 h-4 text-gray-500 transition-transform ${openSections[`${index}-soup`] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="px-3 py-2">
                          <OptionSelector
                            title="Sopa"
                            emoji="🥣"
                            options={soups}
                            selected={meal.soup || meal.soupReplacement}
                            showReplacements={meal.showReplacementsState?.soup || false}
                            replacements={soupReplacements.filter(opt => opt.name !== 'Remplazo por Sopa' && opt.name !== 'Solo bandeja')}
                            selectedReplacement={meal.soupReplacement?.replacement ? { name: meal.soupReplacement.replacement } : null}
                            multiple={false}
                            onImmediateSelect={(value) => {
                              console.log(`[WaiterDashboard] Sopa selected for meal ${index + 1}:`, value);
                              handleFormChange(index, value?.name === 'Remplazo por Sopa' ? 'soupReplacement' : 'soup', value);
                              // Si es reemplazo, NO cerrar inmediatamente para permitir seleccionar el reemplazo
                              if (value?.name !== 'Remplazo por Sopa') {
                                handleSectionInteraction(index, 'soup', false);
                              }
                            }}
                            onImmediateReplacementSelect={(replacement) => {
                              console.log(`[WaiterDashboard] Sopa replacement selected for meal ${index + 1}:`, replacement);
                              const newMeals = [...editingOrder.meals];
                              newMeals[index] = {
                                ...newMeals[index],
                                soupReplacement: {
                                  ...newMeals[index].soupReplacement,
                                  name: 'Remplazo por Sopa',
                                  replacement: replacement?.name || ''
                                }
                              };
                              setEditingOrder(prev => ({ ...prev, meals: newMeals }));
                              handleSectionInteraction(index, 'soup', false);
                            }}
                          />
                        </div>
                      </details>

                      <details 
                        className="group bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
                        open={openSections[`${index}-principle`] || false}
                        onToggle={(e) => toggleSection(index, 'principle', e.target.open)}
                      >
                        <summary className="flex items-center justify-between cursor-pointer px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors" onClick={(e) => e.preventDefault() || toggleSection(index, 'principle', !openSections[`${index}-principle`])}>
                          <span className="text-sm font-semibold text-gray-700 flex items-center">
                            <span className="text-base mr-1.5">🍚</span>
                            Principio o Reemplazo
                          </span>
                          <svg className={`w-4 h-4 text-gray-500 transition-transform ${openSections[`${index}-principle`] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="px-3 py-2">
                          <OptionSelector
                            title="Principio"
                            emoji="🍚"
                            options={principles}
                            selected={meal.principle || meal.principleReplacement}
                            showReplacements={meal.showReplacementsState?.principle || false}
                            replacements={soupReplacements.filter(opt => opt.name !== 'Remplazo por Sopa' && opt.name !== 'Solo bandeja')}
                            selectedReplacement={
                              meal.principle?.find(opt => opt.name === 'Remplazo por Principio')?.replacement
                                ? { name: meal.principle.find(opt => opt.name === 'Remplazo por Principio').replacement }
                                : null
                            }
                            multiple={true}
                            showConfirmButton={true}
                            onImmediateSelect={(value) => {
                              console.log(`[WaiterDashboard] Principio selected for meal ${index + 1}:`, value);
                              handleFormChange(index, 'principle', value);
                              // Si es reemplazo, NO cerrar inmediatamente
                              const isReplacement = Array.isArray(value) 
                                ? value.some(v => v.name === 'Remplazo por Principio')
                                : value?.name === 'Remplazo por Principio';
                                
                              if (!isReplacement) {
                                handleSectionInteraction(index, 'principle', true);
                              }
                            }}
                            onImmediateReplacementSelect={(replacement) => {
                              console.log(`[WaiterDashboard] Principio replacement selected for meal ${index + 1}:`, replacement);
                              const newMeals = [...editingOrder.meals];
                              newMeals[index] = {
                                ...newMeals[index],
                                principle: newMeals[index].principle?.map(opt => ({
                                  ...opt,
                                  replacement: opt.name === 'Remplazo por Principio' ? replacement?.name || '' : opt.replacement
                                }))
                              };
                              setEditingOrder(prev => ({ ...prev, meals: newMeals }));
                              handleSectionInteraction(index, 'principle', true);
                            }}
                            onConfirm={({ selection }) => {
                                handleFormChange(index, 'principle', selection);
                                handleSectionInteraction(index, 'principle', false);
                            }}
                          />
                        </div>
                      </details>

                      <details 
                        className="group bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
                        open={openSections[`${index}-protein`] || false}
                        onToggle={(e) => toggleSection(index, 'protein', e.target.open)}
                      >
                        <summary className="flex items-center justify-between cursor-pointer px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors" onClick={(e) => e.preventDefault() || toggleSection(index, 'protein', !openSections[`${index}-protein`])}>
                          <span className="text-sm font-semibold text-gray-700 flex items-center">
                            <span className="text-base mr-1.5">🍖</span>
                            Proteína
                          </span>
                          <svg className={`w-4 h-4 text-gray-500 transition-transform ${openSections[`${index}-protein`] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="px-3 py-2">
                          <OptionSelector
                            title="Proteína"
                            emoji="🍖"
                            options={proteins}
                            selected={meal.protein}
                            multiple={false}
                            onImmediateSelect={(value) => {
                                handleFormChange(index, 'protein', value);
                                handleSectionInteraction(index, 'protein', false);
                            }}
                          />
                        </div>
                      </details>

                      <details 
                        className="group bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
                        open={openSections[`${index}-sides`] || false}
                        onToggle={(e) => toggleSection(index, 'sides', e.target.open)}
                      >
                        <summary className="flex items-center justify-between cursor-pointer px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors" onClick={(e) => e.preventDefault() || toggleSection(index, 'sides', !openSections[`${index}-sides`])}>
                          <span className="text-sm font-semibold text-gray-700 flex items-center">
                            <span className="text-base mr-1.5">🥗</span>
                            Acompañamientos
                          </span>
                          <svg className={`w-4 h-4 text-gray-500 transition-transform ${openSections[`${index}-sides`] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="px-3 py-2">
                          <OptionSelector
                            title="Acompañamiento"
                            emoji="🥗"
                            options={sides}
                            selected={meal.sides}
                            multiple={true}
                            onImmediateSelect={(value) => {
                                handleFormChange(index, 'sides', value);
                                handleSectionInteraction(index, 'sides', true);
                            }}
                          />
                        </div>
                      </details>

                      <details 
                        className="group bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
                        open={openSections[`${index}-table`] || false}
                        onToggle={(e) => toggleSection(index, 'table', e.target.open)}
                      >
                        <summary className="flex items-center justify-between cursor-pointer px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors" onClick={(e) => e.preventDefault() || toggleSection(index, 'table', !openSections[`${index}-table`])}>
                          <span className="text-sm font-semibold text-gray-700 flex items-center">
                            <span className="text-base mr-1.5">🍽️</span>
                            Mesa
                          </span>
                          <svg className={`w-4 h-4 text-gray-500 transition-transform ${openSections[`${index}-table`] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="px-3 py-2">
                          <OptionSelector
                            title="Mesa"
                            emoji="🍽️"
                            options={tableOptions}
                            selected={meal.tableNumber}
                            multiple={false}
                            onImmediateSelect={(value) => {
                              const isLlevar = value?.name?.toLowerCase().includes('llevar') || value?.name?.toLowerCase() === 'lllevar';
                              setEditingOrder(prev => {
                                const newMeals = [...prev.meals];
                                newMeals[index] = { 
                                  ...newMeals[index], 
                                  tableNumber: value,
                                  orderType: isLlevar ? 'takeaway' : 'table'
                                };
                                const updatedTotal = calculateTotal(newMeals, 3);
                                return { ...prev, meals: newMeals, total: updatedTotal };
                              });
                              handleSectionInteraction(index, 'table', false);
                            }}
                          />
                        </div>
                      </details>

                      <details className="group bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                        <summary className="flex items-center justify-between cursor-pointer px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors">
                          <span className="text-sm font-semibold text-gray-700 flex items-center">
                            <span className="text-base mr-1.5">📝</span>
                            Notas
                          </span>
                          <svg className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="px-3 py-2">
                          <textarea
                            value={meal.notes || ''}
                            onChange={(e) => handleFormChange(index, 'notes', e.target.value)}
                            placeholder="Ej: Poquito arroz, más plátano..."
                            className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows="2"
                          />
                        </div>
                      </details>

                      <details className="group bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                        <summary className="flex items-center justify-between cursor-pointer px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors">
                          <span className="text-sm font-semibold text-gray-700 flex items-center">
                            <span className="text-base mr-1.5">➕</span>
                            Adiciones (opcional)
                          </span>
                          <svg className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="px-3 py-2">
                        <OptionSelector
                          title="Adiciones (por almuerzo)"
                          emoji="➕"
                          options={normalizedAdditions}
                          selected={meal?.additions || []}
                          multiple={true}
                          showReplacements={meal?.additions?.some(
                            add => add.requiresReplacement && (
                              (add.name === 'Proteína adicional' && !add.protein) ||
                              (['Sopa adicional', 'Principio adicional', 'Bebida adicional'].includes(add.name) && !add.replacement)
                            )
                          )}
                          replacements={getReplacementsForAdditions(meal)}
                          onImmediateSelect={(selection) => {
                            console.log(`[WaiterDashboard] Additions selected for meal ${index + 1}:`, selection);
                            handleFormChange(index, 'additions', selection.map(add => ({
                              ...add,
                              quantity: add.quantity || 1,
                              price: add.price || 0,
                              protein: add.name === 'Proteína adicional' ? (add.protein || '') : add.protein || '',
                              replacement: ['Sopa adicional', 'Principio adicional', 'Bebida adicional'].includes(add.name) ? (add.replacement || '') : add.replacement || '',
                            })));
                          }}
                          onImmediateReplacementSelect={({ id: additionId, replacement }) => {
                            console.log(`[WaiterDashboard] Replacement selected for meal ${index + 1}, addition ${additionId}:`, replacement);
                            const updatedAdditions = (meal?.additions || []).map((add) => {
                              if (add.id === additionId) {
                                return {
                                  ...add,
                                  protein: add.name === 'Proteína adicional' ? replacement?.name || add.protein : add.protein,
                                  replacement: ['Sopa adicional', 'Principio adicional', 'Bebida adicional'].includes(add.name)
                                    ? replacement?.name || add.replacement
                                    : add.replacement,
                                };
                              }
                              return add;
                            });
                            handleFormChange(index, 'additions', updatedAdditions);
                          }}
                          onAdd={(addition) => {
                            console.log(`[WaiterDashboard] Adding addition for meal ${index + 1}:`, addition);
                            const existingAddition = meal?.additions?.find(a => a.id === addition.id);
                            const updatedAdditions = existingAddition
                              ? meal.additions.map(a => a.id === addition.id ? { ...a, quantity: (a.quantity || 1) + 1 } : a)
                              : [...(meal.additions || []), { ...addition, quantity: 1, price: addition.price || 0 }];
                            handleFormChange(index, 'additions', updatedAdditions);
                          }}
                          onRemove={(additionId) => {
                            console.log(`[WaiterDashboard] Removing addition ${additionId} for meal ${index + 1}`);
                            const updatedAdditions = meal.additions
                              .map(add => add.id === additionId ? { ...add, quantity: (add.quantity || 1) - 1 } : add)
                              .filter(add => add.quantity > 0);
                            handleFormChange(index, 'additions', updatedAdditions);
                          }}
                          onIncrease={(additionId) => {
                            console.log(`[WaiterDashboard] Increasing addition ${additionId} for meal ${index + 1}`);
                            const updatedAdditions = meal.additions.map(add =>
                              add.id === additionId ? { ...add, quantity: (add.quantity || 1) + 1 } : add
                            );
                            handleFormChange(index, 'additions', updatedAdditions);
                          }}
                        />
                        {meal?.additions?.length > 0 && (
                          <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-xs font-semibold text-green-800">
                              Total Adiciones: ${meal.additions.reduce((sum, item) => sum + (item?.price || 0) * (item?.quantity || 1), 0).toLocaleString('es-CO')}
                            </p>
                          </div>
                        )}
                        </div>
                      </details>
                    </div>

                    {/* Botón para agregar otro almuerzo */}
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <button
                        onClick={() => {
                          const newMeal = {
                            soup: null,
                            soupReplacement: null,
                            principle: [],
                            protein: null,
                            sides: [],
                            tableNumber: meal.tableNumber, // Copiar la mesa del almuerzo actual
                            additions: [],
                            notes: '',
                            showReplacementsState: {}
                          };
                          const updatedMeals = [...editingOrder.meals];
                          updatedMeals.splice(index + 1, 0, newMeal); // Insertar después del almuerzo actual
                          setEditingOrder(prev => ({ ...prev, meals: updatedMeals }));
                        }}
                        className="w-full py-2 px-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Agregar otro almuerzo a esta orden
                      </button>
                      
                      <button
                        onClick={duplicateOrder}
                        disabled={isLoading}
                        className="w-full mt-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 font-medium shadow transition-all flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Duplicar orden completa
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                editingOrder.breakfasts.map((breakfast, index) => {
                  const selectedType = breakfastTypes.find(t => t.name === breakfast.type?.name);
                  const steps = selectedType?.steps;
                  const showStep = (step) => !steps || steps.includes(step);

                  return (
                  <div key={index} className="mb-4">
                    {/* Resumen del pedido actual */}
                    <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-l-3 border-orange-500 rounded p-2 mb-2 shadow-sm">
                      <div className="flex items-center mb-1.5">
                        <span className="bg-orange-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold mr-1.5">
                          {index + 1}
                        </span>
                        <h3 className="text-xs font-bold text-gray-800">Resumen</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                        {breakfast.type && (
                          <div className="col-span-1 sm:col-span-2 bg-white rounded px-1.5 py-1">
                            <span className="font-semibold text-gray-700">🥞 Tipo:</span>
                            <span className="ml-1 text-gray-600">{breakfast.type.name}</span>
                          </div>
                        )}
                        {breakfast.broth && (
                          <div className="bg-white rounded px-1.5 py-1">
                            <span className="font-semibold text-gray-700">🥣 Caldo:</span>
                            <span className="ml-1 text-gray-600">{breakfast.broth.name}</span>
                          </div>
                        )}
                        {breakfast.eggs && (
                          <div className="bg-white rounded px-1.5 py-1">
                            <span className="font-semibold text-gray-700">🥚 Huevos:</span>
                            <span className="ml-1 text-gray-600">{breakfast.eggs.name}</span>
                          </div>
                        )}
                        {breakfast.riceBread && (
                          <div className="bg-white rounded px-1.5 py-1">
                            <span className="font-semibold text-gray-700">🍞 Arroz/Pan:</span>
                            <span className="ml-1 text-gray-600">{breakfast.riceBread.name}</span>
                          </div>
                        )}
                        {breakfast.drink && (
                          <div className="bg-white rounded px-1.5 py-1">
                            <span className="font-semibold text-gray-700">🥤 Bebida:</span>
                            <span className="ml-1 text-gray-600">{breakfast.drink.name}</span>
                          </div>
                        )}
                        {breakfast.protein && (
                          <div className="bg-white rounded px-1.5 py-1">
                            <span className="font-semibold text-gray-700">🍖 Proteína:</span>
                            <span className="ml-1 text-gray-600">{breakfast.protein.name}</span>
                          </div>
                        )}
                        {breakfast.tableNumber && (
                          <div className="bg-white rounded px-1.5 py-1">
                            <span className="font-semibold text-gray-700">🍽️ Mesa:</span>
                            <span className="ml-1 text-gray-600">{breakfast.tableNumber.name || breakfast.tableNumber}</span>
                          </div>
                        )}
                        {breakfast.additions && breakfast.additions.length > 0 && (
                          <div className="col-span-1 sm:col-span-2 bg-white rounded px-1.5 py-1">
                            <span className="font-semibold text-gray-700">➕ Adiciones:</span>
                            <span className="ml-1 text-gray-600">{breakfast.additions.map(a => `${a.name} (${a.quantity})`).join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <details 
                        className="group bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
                        open={openSections[`b-${index}-type`] || false}
                      >
                        <summary 
                          className="flex items-center justify-between cursor-pointer px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                          onClick={(e) => e.preventDefault() || toggleSection(`b-${index}`, 'type', !openSections[`b-${index}-type`])}
                        >
                          <span className="text-sm font-semibold text-gray-700 flex items-center">
                            <span className="text-base mr-1.5">🥞</span>
                            Tipo de Desayuno
                          </span>
                          <svg className={`w-4 h-4 text-gray-500 transition-transform ${openSections[`b-${index}-type`] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="px-3 py-2">
                          <OptionSelector
                            title="Tipo"
                            emoji="🥞"
                            options={breakfastTypes}
                            selected={breakfast.type}
                            multiple={false}
                            onImmediateSelect={(value) => {
                              handleFormChange(index, 'type', value);
                              setTimeout(() => handleSectionInteraction(`b-${index}`, 'type', false), 150);
                            }}
                          />
                        </div>
                      </details>

                      {showStep('broth') && (
                      <details 
                        className="group bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
                        open={openSections[`b-${index}-broth`] || false}
                      >
                        <summary 
                          className="flex items-center justify-between cursor-pointer px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                          onClick={(e) => e.preventDefault() || toggleSection(`b-${index}`, 'broth', !openSections[`b-${index}-broth`])}
                        >
                          <span className="text-sm font-semibold text-gray-700 flex items-center">
                            <span className="text-base mr-1.5">🥣</span>
                            Caldo
                          </span>
                          <svg className={`w-4 h-4 text-gray-500 transition-transform ${openSections[`b-${index}-broth`] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="px-3 py-2">
                          <OptionSelector
                            title="Caldo"
                            emoji="🥣"
                            options={breakfastBroths}
                            selected={breakfast.broth}
                            multiple={false}
                            onImmediateSelect={(value) => {
                              handleFormChange(index, 'broth', value);
                              setTimeout(() => handleSectionInteraction(`b-${index}`, 'broth', false), 150);
                            }}
                          />
                        </div>
                      </details>
                      )}

                      {showStep('eggs') && (
                      <details 
                        className="group bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
                        open={openSections[`b-${index}-eggs`] || false}
                      >
                        <summary 
                          className="flex items-center justify-between cursor-pointer px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                          onClick={(e) => e.preventDefault() || toggleSection(`b-${index}`, 'eggs', !openSections[`b-${index}-eggs`])}
                        >
                          <span className="text-sm font-semibold text-gray-700 flex items-center">
                            <span className="text-base mr-1.5">🥚</span>
                            Huevos
                          </span>
                          <svg className={`w-4 h-4 text-gray-500 transition-transform ${openSections[`b-${index}-eggs`] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="px-3 py-2">
                          <OptionSelector
                            title="Huevos"
                            emoji="🥚"
                            options={breakfastEggs}
                            selected={breakfast.eggs}
                            multiple={false}
                            onImmediateSelect={(value) => {
                              handleFormChange(index, 'eggs', value);
                              setTimeout(() => handleSectionInteraction(`b-${index}`, 'eggs', false), 150);
                            }}
                          />
                        </div>
                      </details>
                      )}

                      {showStep('riceBread') && (
                      <details 
                        className="group bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
                        open={openSections[`b-${index}-riceBread`] || false}
                      >
                        <summary 
                          className="flex items-center justify-between cursor-pointer px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                          onClick={(e) => e.preventDefault() || toggleSection(`b-${index}`, 'riceBread', !openSections[`b-${index}-riceBread`])}
                        >
                          <span className="text-sm font-semibold text-gray-700 flex items-center">
                            <span className="text-base mr-1.5">🍞</span>
                            Arroz/Pan
                          </span>
                          <svg className={`w-4 h-4 text-gray-500 transition-transform ${openSections[`b-${index}-riceBread`] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="px-3 py-2">
                          <OptionSelector
                            title="Arroz/Pan"
                            emoji="🍞"
                            options={breakfastRiceBread}
                            selected={breakfast.riceBread}
                            multiple={false}
                            onImmediateSelect={(value) => {
                              handleFormChange(index, 'riceBread', value);
                              setTimeout(() => handleSectionInteraction(`b-${index}`, 'riceBread', false), 150);
                            }}
                          />
                        </div>
                      </details>
                      )}

                      {showStep('drink') && (
                      <details 
                        className="group bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
                        open={openSections[`b-${index}-drink`] || false}
                      >
                        <summary 
                          className="flex items-center justify-between cursor-pointer px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                          onClick={(e) => e.preventDefault() || toggleSection(`b-${index}`, 'drink', !openSections[`b-${index}-drink`])}
                        >
                          <span className="text-sm font-semibold text-gray-700 flex items-center">
                            <span className="text-base mr-1.5">🥤</span>
                            Bebida
                          </span>
                          <svg className={`w-4 h-4 text-gray-500 transition-transform ${openSections[`b-${index}-drink`] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="px-3 py-2">
                          <OptionSelector
                            title="Bebida"
                            emoji="🥤"
                            options={breakfastDrinks}
                            selected={breakfast.drink}
                            multiple={false}
                            onImmediateSelect={(value) => {
                              handleFormChange(index, 'drink', value);
                              setTimeout(() => handleSectionInteraction(`b-${index}`, 'drink', false), 150);
                            }}
                          />
                        </div>
                      </details>
                      )}

                      {showStep('protein') && (
                      <details 
                        className="group bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
                        open={openSections[`b-${index}-protein`] || false}
                      >
                        <summary 
                          className="flex items-center justify-between cursor-pointer px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                          onClick={(e) => e.preventDefault() || toggleSection(`b-${index}`, 'protein', !openSections[`b-${index}-protein`])}
                        >
                          <span className="text-sm font-semibold text-gray-700 flex items-center">
                            <span className="text-base mr-1.5">🍖</span>
                            Proteína
                          </span>
                          <svg className={`w-4 h-4 text-gray-500 transition-transform ${openSections[`b-${index}-protein`] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="px-3 py-2">
                          <OptionSelector
                            title="Proteína"
                            emoji="🍖"
                            options={breakfastProteins}
                            selected={breakfast.protein}
                            multiple={false}
                            onImmediateSelect={(value) => {
                              handleFormChange(index, 'protein', value);
                              setTimeout(() => handleSectionInteraction(`b-${index}`, 'protein', false), 150);
                            }}
                          />
                        </div>
                      </details>
                      )}



                      <details 
                        className="group bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
                        open={openSections[`b-${index}-table`] || false}
                      >
                        <summary 
                          className="flex items-center justify-between cursor-pointer px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                          onClick={(e) => e.preventDefault() || toggleSection(`b-${index}`, 'table', !openSections[`b-${index}-table`])}
                        >
                          <span className="text-sm font-semibold text-gray-700 flex items-center">
                            <span className="text-base mr-1.5">🍽️</span>
                            Mesa
                          </span>
                          <svg className={`w-4 h-4 text-gray-500 transition-transform ${openSections[`b-${index}-table`] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="px-3 py-2">
                          <OptionSelector
                            title="Mesa"
                            emoji="🍽️"
                            options={tableOptions}
                            selected={breakfast.tableNumber}
                            multiple={false}
                            onImmediateSelect={(value) => {
                              const isLlevar = value?.name?.toLowerCase().includes('llevar') || value?.name?.toLowerCase() === 'lllevar';
                              setEditingOrder(prev => {
                                const newBreakfasts = [...prev.breakfasts];
                                newBreakfasts[index] = { 
                                  ...newBreakfasts[index], 
                                  tableNumber: value,
                                  orderType: isLlevar ? 'takeaway' : 'table'
                                };
                                const updatedTotal = calculateTotalBreakfastPrice(newBreakfasts, 3, breakfastTypes);
                                return { ...prev, breakfasts: newBreakfasts, total: updatedTotal };
                              });
                              setTimeout(() => handleSectionInteraction(`b-${index}`, 'table', false), 150);
                            }}
                          />
                        </div>
                      </details>

                      <details className="group bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                        <summary className="flex items-center justify-between cursor-pointer px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors">
                          <span className="text-sm font-semibold text-gray-700 flex items-center">
                            <span className="text-base mr-1.5">📝</span>
                            Notas
                          </span>
                          <svg className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="px-3 py-2">
                          <textarea
                            value={breakfast.notes || ''}
                            onChange={(e) => handleFormChange(index, 'notes', e.target.value)}
                            placeholder="Notas"
                            className="w-full p-2 border rounded text-sm"
                          />
                        </div>
                      </details>

                      <details className="group bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
                        <summary className="flex items-center justify-between cursor-pointer px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors">
                          <span className="text-sm font-semibold text-gray-700 flex items-center">
                            <span className="text-base mr-1.5">➕</span>
                            Adiciones (opcional)
                          </span>
                          <svg className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </summary>
                        <div className="px-3 py-2">
                          <OptionSelector
                            title="Adiciones (por desayuno)"
                            emoji="➕"
                            options={breakfastAdditions}
                            selected={(breakfast?.additions || []).map(add => ({
                              ...add,
                              id: add.id || add.name
                            }))}
                            multiple={true}
                            onImmediateSelect={(selection) => {
                              console.log(`[WaiterDashboard] Additions selected for breakfast ${index + 1}:`, selection);
                              handleFormChange(index, 'additions', selection.map(add => ({
                                name: add.name,
                                quantity: add.quantity || 1,
                                price: add.price || 0,
                                id: add.id || add.name
                              })));
                            }}
                            onAdd={(addition) => {
                              console.log(`[WaiterDashboard] Adding addition for breakfast ${index + 1}:`, addition);
                              const existingAddition = breakfast?.additions?.find(a => (a.id || a.name) === (addition.id || addition.name));
                              const updatedAdditions = existingAddition
                                ? breakfast.additions.map(a => (a.id || a.name) === (addition.id || addition.name) ? { ...a, quantity: (a.quantity || 1) + 1 } : a)
                                : [...(breakfast.additions || []), { name: addition.name, quantity: 1, price: addition.price || 0, id: addition.id || addition.name }];
                              handleFormChange(index, 'additions', updatedAdditions);
                            }}
                            onRemove={(additionId) => {
                              console.log(`[WaiterDashboard] Removing addition ${additionId} for breakfast ${index + 1}`);
                              const updatedAdditions = breakfast.additions
                                .map(add => (add.id || add.name) === additionId ? { ...add, quantity: (add.quantity || 1) - 1 } : add)
                                .filter(add => add.quantity > 0);
                              handleFormChange(index, 'additions', updatedAdditions);
                            }}
                            onIncrease={(additionId) => {
                              console.log(`[WaiterDashboard] Increasing addition ${additionId} for breakfast ${index + 1}`);
                              const updatedAdditions = breakfast.additions.map(add =>
                                (add.id || add.name) === additionId ? { ...add, quantity: (add.quantity || 1) + 1 } : add
                              );
                              handleFormChange(index, 'additions', updatedAdditions);
                            }}
                          />
                          {breakfast?.additions?.length > 0 && (
                            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                              <p className="text-xs font-semibold text-green-800">
                                Total Adiciones: $
                                {breakfast.additions.reduce((sum, item) => {
                                  const price = item.price || breakfastAdditions.find(a => a.name === item.name)?.price || 0;
                                  return sum + price * (item?.quantity || 1);
                                }, 0).toLocaleString('es-CO')}
                              </p>
                            </div>
                          )}
                        </div>
                      </details>
                    </div>

                    {/* Botón para agregar otro desayuno */}
                    <div className="mt-3 pt-3 border-t border-gray-300">
                      <button
                        onClick={() => {
                          const newBreakfast = {
                            type: null,
                            broth: null,
                            eggs: null,
                            riceBread: null,
                            drink: null,
                            protein: null,
                            tableNumber: breakfast.tableNumber, // Copiar la mesa del desayuno actual
                            additions: [],
                            notes: '',
                            paymentMethod: breakfast.paymentMethod
                          };
                          const updatedBreakfasts = [...editingOrder.breakfasts];
                          updatedBreakfasts.splice(index + 1, 0, newBreakfast); // Insertar después del desayuno actual
                          setEditingOrder(prev => ({ ...prev, breakfasts: updatedBreakfasts }));
                        }}
                        className="w-full py-2 px-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Agregar otro desayuno a esta orden
                      </button>
                      
                      <button
                        onClick={duplicateOrder}
                        disabled={isLoading}
                        className="w-full mt-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 font-medium shadow transition-all flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Duplicar orden completa
                      </button>
                    </div>
                  </div>
                );
                })
              )}
              </div>

              {/* Footer con total y botones */}
              <div className="border-t border-gray-200 bg-gray-50 px-3 py-2 space-y-1.5">
                <div className="bg-white rounded p-2 border border-blue-200">
                  <label className="text-xs font-medium text-gray-700 block mb-1">
                    💰 Total (editable)
                  </label>
                  <div className="flex items-center">
                    <span className="text-sm font-bold text-gray-600 mr-1">$</span>
                    <input
                      type="number"
                      value={editingOrder.total !== undefined ? editingOrder.total : (editingOrder.type === 'lunch' ? calculateTotal(editingOrder.meals, 3) : calculateTotalBreakfastPrice(editingOrder.breakfasts, 3, breakfastTypes))}
                      onChange={(e) => handleFormChange(-1, 'total', e.target.value)}
                      placeholder="Total"
                      className="flex-1 p-1.5 border border-gray-300 rounded text-sm font-bold text-gray-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-1.5">
                  <button
                    onClick={handleSaveEdit}
                    className="flex-1 px-3 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded hover:from-green-700 hover:to-green-800 font-medium shadow transition-all flex items-center justify-center gap-1.5 text-xs"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Guardar
                  </button>
                  <button
                    onClick={() => setEditingOrder(null)}
                    className="px-3 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded hover:from-gray-600 hover:to-gray-700 font-medium shadow transition-all flex items-center justify-center gap-1.5 text-xs"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
          </>
        <div>
          <div className="fixed top-16 right-4 z-[10002] space-y-2 w-80 max-w-xs">
            {isLoading && <LoadingIndicator />}
            {errorMessage && (
              <ErrorMessage message={errorMessage} onClose={() => setErrorMessage(null)} />
            )}
            {successMessage && (
              <SuccessMessage message={successMessage} onClose={() => setSuccessMessage(null)} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryTableOrders;
