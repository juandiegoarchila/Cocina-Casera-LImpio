// src/App.js
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { db, auth } from './config/firebase';
import { collection, onSnapshot, doc, addDoc, setDoc } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import useLocalStorage from './hooks/useLocalStorage';
import Header from './components/Header';
import MealList from './components/MealList';
import OrderSummary from './components/OrderSummary';
import LoadingIndicator from './components/LoadingIndicator';
import ErrorMessage from './components/ErrorMessage';
import SuccessMessage from './components/SuccessMessage';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

import { useAuth } from './components/Auth/AuthProvider';
import { initializeMealData, handleMealChange, addMeal, duplicateMeal, removeMeal, sendToWhatsApp } from './utils/MealLogic';
import { calculateMealPrice, calculateTotal, paymentSummary } from './utils/MealCalculations';
import { isMobile, encodeMessage } from './utils/Helpers';

// PASO NUEVO: Importar el Footer
import Footer from './components/Footer'; // Asegúrate de que la ruta sea correcta

const AdminPage = lazy(() => import('./components/Admin/AdminPage'));
const Login = lazy(() => import('./components/Auth/Login'));
const ForgotPassword = lazy(() => import('./components/Auth/ForgotPassword'));

const App = () => {
    const { user, loading } = useAuth();
    const [meals, setMeals] = useState([]);
    const [address, setAddress] = useLocalStorage('userAddress', '');
    const [errorMessage, setErrorMessage] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [incompleteMealIndex, setIncompleteMealIndex] = useState(null);
    const [incompleteSlideIndex, setIncompleteSlideIndex] = useState(null);
    const [soups, setSoups] = useState([]);
    const [soupReplacements, setSoupReplacements] = useState([]);
    const [principles, setPrinciples] = useState([]);
    const [proteins, setProteins] = useState([]);
    const [drinks, setDrinks] = useState([]);
    const [sides, setSides] = useState([]);
    const [times, setTimes] = useState([]);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [isOrderingDisabled, setIsOrderingDisabled] = useState(false);

    // --- NUEVO: useEffect para la duración de los mensajes ---
    useEffect(() => {
        if (errorMessage) {
            const timer = setTimeout(() => {
                setErrorMessage(null);
            }, 10000); // 10 segundos
            return () => clearTimeout(timer);
        }
    }, [errorMessage]);

    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => {
                setSuccessMessage(null);
            }, 10000); // 10 segundos
            return () => clearTimeout(timer);
        }
    }, [successMessage]);
    // --- FIN NUEVO ---

    useEffect(() => {
        const collections = ['soups', 'soupReplacements', 'principles', 'proteins', 'drinks', 'sides', 'times', 'paymentMethods'];
        const setters = [setSoups, setSoupReplacements, setPrinciples, setProteins, setDrinks, setSides, setTimes, setPaymentMethods];

        const unsubscribers = collections.map((col, index) =>
            onSnapshot(collection(db, col), (snapshot) => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setters[index](data);
                console.log(`Updated ${col}:`, data);

                // --- LÓGICA DE MENSAJE DE ERROR MEJORADA ---
                if (data.length === 0) {
                    if (process.env.NODE_ENV !== 'production') {
                        // En desarrollo, muestra el error técnico claro
                        console.warn(`La colección ${col} está vacía. Agrega datos desde /admin.`);
                        setErrorMessage(`La colección ${col} está vacía. Agrega datos desde /admin.`);
                    } else {
                        // En producción, muestra un mensaje amigable o no muestra nada
                        setErrorMessage('Algunas opciones no están disponibles. Intenta de nuevo más tarde.');
                        // O, si prefieres no mostrar error y que el componente de selección se adapte:
                        // setErrorMessage(null);
                    }
                }
                // --- FIN LÓGICA MEJORADA ---

                window.dispatchEvent(new Event('optionsUpdated'));
            }, (error) => {
                console.error(`Error al escuchar ${col}:`, error);
                if (process.env.NODE_ENV === 'production') {
                    setErrorMessage('No se pudieron cargar las opciones. Intenta de nuevo más tarde.');
                } else {
                    setErrorMessage(`Error al cargar datos de ${col}. Revisa la consola para más detalles.`);
                }
            })
        );

        const settingsUnsubscribe = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                setIsOrderingDisabled(data.isOrderingDisabled || false);
            } else {
                setIsOrderingDisabled(false);
            }
        }, (error) => {
            console.error('Error al escuchar settings/global:', error);
            setErrorMessage('Error al cargar configuración. Intenta de nuevo más tarde.');
        });

        return () => {
            unsubscribers.forEach(unsubscribe => unsubscribe());
            settingsUnsubscribe();
        };
    }, []);

    const registerClientAndSaveOrder = async (meals) => {
        try {
            setIsLoading(true);
            let currentUser = user;

            if (!currentUser) {
                const userCredential = await signInAnonymously(auth);
                currentUser = userCredential.user;
                console.log('Usuario anónimo creado:', currentUser.uid);
            }

            const clientData = {
                email: currentUser.email || `anon_${currentUser.uid}@example.com`,
                role: 1,
                createdAt: new Date(),
                lastOrder: new Date(),
                totalOrders: 1,
            };

            const userRef = doc(db, 'users', currentUser.uid);
            await setDoc(userRef, clientData, { merge: true });

            const order = {
                userId: currentUser.uid,
                userEmail: clientData.email,
                meals: meals.map(meal => ({
                    soup: meal.soup?.name || '',
                    soupReplacement: meal.soupReplacement?.name || '',
                    principle: meal.principle?.name || '',
                    principleReplacement: meal.principleReplacement?.name || '',
                    protein: meal.protein?.name || '',
                    drink: meal.drink?.name || '',
                    sides: meal.sides?.map(side => side.name) || [],
                    address: meal.address || '',
                    payment: meal.payment?.name || '',
                    time: meal.time?.name || '',
                    notes: meal.notes || '',
                    cutlery: meal.cutlery || '',
                })),
                total: calculateTotal(meals),
                paymentSummary: paymentSummary(meals),
                status: 'Pending',
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            await addDoc(collection(db, 'orders'), order);

            setSuccessMessage('¡Pedido enviado y cliente registrado con éxito!');
        } catch (error) {
            console.error('Error al registrar cliente o guardar pedido:', error);
            setErrorMessage('Error al procesar el pedido. Intenta de nuevo.');
        } finally {
            setIsLoading(false);
        }
    };

    const initialMeal = initializeMealData(address);
    const total = calculateTotal(meals);

    if (loading) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Cargando...</div>;
    }

    return (
        <Router>
            <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center">Cargando aplicación...</div>}>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/admin/*" element={<AdminPage />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/" element={
                        <div className="min-h-screen bg-gray-50 flex flex-col">
                            <Header />
                            <main role="main" className="p-2 sm:p-4 flex-grow w-full max-w-4xl mx-auto">
                                <div className="fixed top-14 right-2 sm:right-3 space-y-2 z-[9999]" aria-live="polite"> {/* Ajustado z-index */}
                                    {isLoading && <LoadingIndicator />}
                                    {errorMessage && <ErrorMessage message={errorMessage} />}
                                    {successMessage && <SuccessMessage message={successMessage} />}
                                </div>
                                {isOrderingDisabled ? (
                                    <div className="text-center text-red-600 bg-red-50 p-3 sm:p-4 rounded-lg">
                                        <p className="text-base sm:text-lg font-semibold">Pedidos cerrados hasta mañana</p>
                                        <p className="text-xs sm:text-sm">Gracias por tu comprensión.</p>
                                    </div>
                                ) : (
                                    <>
                                        <p className="text-center text-gray-700 mb-2 sm:mb-4 text-[10px] xs:text-xs sm:text-sm bg-white p-2 sm:p-3 rounded-lg shadow-sm">
                                            ¡Pide tu almuerzo fácil y rápido! Almuerzo $13.000 (solo bandeja o sin sopa $12.000)
                                        </p>
                                        <MealList
                                            meals={meals}
                                            soups={soups}
                                            soupReplacements={soupReplacements}
                                            principles={principles}
                                            proteins={proteins}
                                            drinks={drinks}
                                            sides={sides}
                                            times={times}
                                            paymentMethods={paymentMethods}
                                            onMealChange={(id, field, value) => handleMealChange(setMeals, id, field, value)}
                                            onRemoveMeal={(id) => removeMeal(setMeals, setSuccessMessage, id, meals)}
                                            onAddMeal={() => addMeal(setMeals, setSuccessMessage, meals, initialMeal)}
                                            onDuplicateMeal={(meal) => duplicateMeal(setMeals, setSuccessMessage, meal, meals)}
                                            incompleteMealIndex={incompleteMealIndex}
                                            incompleteSlideIndex={incompleteSlideIndex}
                                            isOrderingDisabled={isOrderingDisabled}
                                        />
                                        <OrderSummary
                                            meals={meals}
                                            onSendOrder={() => {
                                                sendToWhatsApp(
                                                    setIsLoading, setErrorMessage, setSuccessMessage, meals,
                                                    incompleteMealIndex, setIncompleteMealIndex, incompleteSlideIndex, setIncompleteSlideIndex,
                                                    calculateMealPrice, total, paymentSummary(meals), isMobile, encodeMessage
                                                );
                                                registerClientAndSaveOrder(meals);
                                            }}
                                            calculateTotal={() => total}
                                            paymentSummary={paymentSummary(meals)}
                                        />
                                    </>
                                )}
                            </main>
                            {/* PASO NUEVO: Renderizar el Footer aquí */}
                            <Footer />
                        </div>
                    } />
                    <Route path="/test" element={<div className="text-center text-green-500">Ruta de prueba funcionando</div>} />
                </Routes>
            </Suspense>
        </Router>
    );
};

export default App;