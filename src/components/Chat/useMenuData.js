// src/components/Chat/useMenuData.js
// Hook que lee en tiempo real las colecciones de menú desde Firestore
import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, onSnapshot, doc } from 'firebase/firestore';

const useMenuData = () => {
  // Almuerzo
  const [soups, setSoups] = useState([]);
  const [soupReplacements, setSoupReplacements] = useState([]);
  const [proteins, setProteins] = useState([]);
  const [principles, setPrinciples] = useState([]);
  const [drinks, setDrinks] = useState([]);
  const [sides, setSides] = useState([]);
  const [additions, setAdditions] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);

  // Desayuno
  const [breakfastTypes, setBreakfastTypes] = useState([]);
  const [breakfastEggs, setBreakfastEggs] = useState([]);
  const [breakfastBroths, setBreakfastBroths] = useState([]);
  const [breakfastDrinks, setBreakfastDrinks] = useState([]);
  const [breakfastProteins, setBreakfastProteins] = useState([]);
  const [breakfastAdditions, setBreakfastAdditions] = useState([]);
  const [breakfastRiceBread, setBreakfastRiceBread] = useState([]);
  const [breakfastTimes, setBreakfastTimes] = useState([]);
  const [times, setTimes] = useState([]);

  // Horarios y configuración
  const [schedules, setSchedules] = useState({
    breakfastStart: 420,
    breakfastEnd: 631,
    lunchStart: 632,
    lunchEnd: 950,
  });
  const [isOrderingDisabled, setIsOrderingDisabled] = useState(false);

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const collectionMap = {
      soups: setSoups,
      soupReplacements: setSoupReplacements,
      proteins: setProteins,
      principles: setPrinciples,
      drinks: setDrinks,
      sides: setSides,
      additions: setAdditions,
      paymentMethods: setPaymentMethods,
      breakfastTypes: setBreakfastTypes,
      breakfastEggs: setBreakfastEggs,
      breakfastBroths: setBreakfastBroths,
      breakfastDrinks: setBreakfastDrinks,
      breakfastProteins: setBreakfastProteins,
      breakfastAdditions: setBreakfastAdditions,
      breakfastRiceBread: setBreakfastRiceBread,
      breakfastTimes: setBreakfastTimes,
      times: setTimes,
    };

    // Primero intentar cache
    try {
      Object.keys(collectionMap).forEach(col => {
        const cached = localStorage.getItem('cached_' + col);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            collectionMap[col](parsed);
          }
        }
      });
    } catch (_) {}

    const loadedCols = new Set();
    const totalCols = Object.keys(collectionMap).length;

    const unsubs = Object.entries(collectionMap).map(([col, setter]) =>
      onSnapshot(collection(db, col), (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setter(data);
        loadedCols.add(col);
        if (loadedCols.size === totalCols) setLoaded(true);
      }, () => {
        loadedCols.add(col);
        if (loadedCols.size === totalCols) setLoaded(true);
      })
    );

    // Schedules
    const unsubSchedules = onSnapshot(doc(db, 'settings', 'schedules'), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setSchedules({
          breakfastStart: d.breakfastStart || 420,
          breakfastEnd: d.breakfastEnd || 631,
          lunchStart: d.lunchStart || 632,
          lunchEnd: d.lunchEnd || 950,
        });
      }
    }, () => {});

    const unsubGlobal = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        setIsOrderingDisabled(snap.data().isOrderingDisabled || false);
      }
    }, () => {});

    return () => {
      unsubs.forEach(u => u());
      unsubSchedules();
      unsubGlobal();
    };
  }, []);

  // Helpers
  const available = (items) => items.filter(i => !i.isFinished);
  const formatPrice = (p) => p ? `$${Number(p).toLocaleString('es-CO')}` : '';

  const getCurrentMenuType = () => {
    if (isOrderingDisabled) return 'closed';
    const now = new Date();
    const totalMinutes = now.getHours() * 60 + now.getMinutes();
    if (totalMinutes >= schedules.breakfastStart && totalMinutes <= schedules.breakfastEnd) return 'breakfast';
    if (totalMinutes >= schedules.lunchStart && totalMinutes <= schedules.lunchEnd) return 'lunch';
    return 'closed';
  };

  return {
    // Raw data
    soups, soupReplacements, proteins, principles, drinks, sides, additions, paymentMethods,
    breakfastTypes, breakfastEggs, breakfastBroths, breakfastDrinks,
    breakfastProteins, breakfastAdditions, breakfastRiceBread, breakfastTimes,
    times,
    schedules, isOrderingDisabled,
    loaded,
    // Helpers
    available,
    formatPrice,
    getCurrentMenuType,
  };
};

export default useMenuData;
