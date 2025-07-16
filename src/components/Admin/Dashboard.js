// src/components/Admin/Dashboard.jsx
import React, { useState, useEffect, Fragment } from 'react';
import { db, auth } from '../../config/firebase';
import { onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { writeBatch, getDocs, collection } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { classNames } from '../../utils/classNames';
import { Dialog, Transition } from '@headlessui/react';
import { Trash2, Info, X, ShoppingCart, DollarSign, Users, Activity } from 'lucide-react';

import { useDashboardData } from '../../hooks/useDashboardData';
import DashboardCharts from './DashboardCharts';

const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

const Dashboard = ({ setError, setSuccess, theme }) => {
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showConfirmClearActivity, setShowConfirmClearActivity] = useState(false);
  const [confirmClearText, setConfirmClearText] = useState('');
  const [showConfirmDeleteDailySales, setShowConfirmDeleteDailySales] = useState(false);
  const [confirmDeleteDailySalesText, setConfirmDeleteDailySalesText] = useState('');
  const [showActivityDetailModal, setShowActivityDetailModal] = useState(false);
  const [selectedActivityDetail, setSelectedActivityDetail] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [salesFilterRange, setSalesFilterRange] = useState('30_days');
  const [salesCustomStartDate, setSalesCustomStartDate] = useState(null);
  const [salesCustomEndDate, setSalesCustomEndDate] = useState(null);
  const [ordersFilterRange, setOrdersFilterRange] = useState('30_days');
  const [ordersCustomStartDate, setOrdersCustomStartDate] = useState(null);
  const [ordersCustomEndDate, setOrdersCustomEndDate] = useState(null);

  const navigate = useNavigate();

  const {
    loadingData,
    orders,
    users,
    totals,
    statusCounts,
    userActivity,
    dailySalesChartData,
    dailyOrdersChartData,
    statusPieChartData,
    handleSaveDailyIngresos,
    handleDeleteDailyIngresos,
    handleSaveDailyOrders,
    handleDeleteDailyOrders,
  } = useDashboardData(
    db,
    userId,
    isAuthReady,
    setError,
    setSuccess,
    salesFilterRange,
    salesCustomStartDate,
    salesCustomEndDate,
    ordersFilterRange,
    ordersCustomStartDate,
    ordersCustomEndDate,
    selectedMonth
  );

  useEffect(() => {
    if (isAuthReady) {
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, [isAuthReady]);

  useEffect(() => {
    if (!auth) {
      console.warn("Firebase Auth no está disponible. Asegúrate de que Firebase esté inicializado correctamente.");
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        setIsAuthReady(true);
      } else {
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
          } else {
            await signInAnonymously(auth);
          }
        } catch (error) {
          console.error("Error al iniciar sesión:", error);
          setError(`Error de autenticación: ${error.message}`);
        } finally {
          setIsAuthReady(true);
        }
      }
    });

    return () => unsubscribeAuth();
  }, [auth, initialAuthToken, setError]);

  const handleClearOldActivity = async () => {
    if (confirmClearText.toLowerCase() !== 'confirmar') {
      setError('Por favor, escribe "confirmar" para proceder.');
      return;
    }
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const activitySnapshot = await getDocs(collection(db, 'userActivity'));

      let deletedCount = 0;
      activitySnapshot.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });

      if (deletedCount === 0) {
        setSuccess("No había actividades para eliminar.");
      } else {
        await batch.commit();
        setSuccess(`Todas las actividades han sido eliminadas correctamente. Total: ${deletedCount}.`);
      }
      setShowConfirmClearActivity(false);
      setConfirmClearText('');
    } catch (error) {
      setError(`Error al eliminar actividades: ${error.message}. Por favor, verifica las reglas de seguridad de Firebase.`);
      console.error("Error en batch commit:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeleteDailySales = async () => {
    if (confirmDeleteDailySalesText.toLowerCase() !== 'eliminar') {
      setError('Por favor, escribe "eliminar" para proceder.');
      return;
    }
    setLoading(true);
    try {
      await handleDeleteDailyIngresos();
      setShowConfirmDeleteDailySales(false);
      setConfirmDeleteDailySalesText('');
    } catch (error) {
      setError(`Error al eliminar ventas del día: ${error.message}`);
      console.error("Error al eliminar ventas diarias:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewActivityDetails = (activity) => {
    setSelectedActivityDetail(activity);
    setShowActivityDetailModal(true);
  };

  const chartTextColor = theme === 'dark' ? '#cbd5e1' : '#475569';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-inter">
      <h2 className="text-3xl font-extrabold mb-8 text-gray-100 dark:text-white">Dashboard</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className={classNames(`bg-${theme === 'dark' ? 'gray-800' : 'white'} p-6 rounded-2xl shadow-xl transform transition-all duration-300 hover:scale-105 hover:shadow-2xl border border-${theme === 'dark' ? 'gray-700' : 'gray-200'}`)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-200 dark:text-gray-100">Pedidos</h3>
            <ShoppingCart className="text-blue-400 w-8 h-8" />
          </div>
          <div className="space-y-3 text-base text-gray-300 dark:text-gray-400">
            <div className="flex justify-between"><span>Total:</span><span className="font-bold text-gray-100">{orders.length}</span></div>
            <div className="flex justify-between"><span>Pendientes:</span><span className="text-yellow-400 font-bold">{statusCounts.Pending}</span></div>
            <div className="flex justify-between"><span>Entregados:</span><span className="text-green-400 font-bold">{statusCounts.Delivered}</span></div>
            <div className="flex justify-between"><span>Cancelados:</span><span className="text-red-400 font-bold">{statusCounts.Cancelled}</span></div>
          </div>
        </div>
        <div className={classNames(`bg-${theme === 'dark' ? 'gray-800' : 'white'} p-6 rounded-2xl shadow-xl transform transition-all duration-300 hover:scale-105 hover:shadow-2xl border border-${theme === 'dark' ? 'gray-700' : 'gray-200'}`)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-200 dark:text-gray-100">Totales Generales</h3>
            <DollarSign className="text-green-400 w-8 h-8" />
          </div>
          <div className="space-y-3 text-base text-gray-300 dark:text-gray-400">
            <div className="flex justify-between"><span>Efectivo:</span><span className="font-bold text-gray-100">${totals.cash.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>DaviPlata:</span><span className="font-bold text-gray-100">${totals.daviplata.toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Nequi:</span><span className="font-bold text-gray-100">${totals.nequi.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="font-bold text-gray-100">Total:</span><span className="font-bold text-green-400">${(totals.cash + totals.daviplata + totals.nequi).toLocaleString()}</span></div>
          </div>
        </div>
        <div className={classNames(`bg-${theme === 'dark' ? 'gray-800' : 'white'} p-6 rounded-2xl shadow-xl transform transition-all duration-300 hover:scale-105 hover:shadow-2xl border border-${theme === 'dark' ? 'gray-700' : 'gray-200'}`)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-200 dark:text-gray-100">Usuarios</h3>
            <Users className="text-purple-400 w-8 h-8" />
          </div>
          <div className="space-y-3 text-base text-gray-300 dark:text-gray-400">
            <div className="flex justify-between"><span>Total:</span><span className="font-bold text-gray-100">{users.length}</span></div>
            <div className="flex justify-between"><span>Administradores:</span><span className="font-bold text-gray-100">{users.filter(u => u.role === 2).length}</span></div>
            <div className="flex justify-between"><span>Clientes:</span><span className="font-bold text-gray-100">{users.filter(u => u.role === 1).length}</span></div>
            <div className="flex justify-between"><span>ID de Usuario:</span><span className="font-mono text-xs text-gray-500 break-all">{userId}</span></div>
          </div>
        </div>
        <div className={classNames(`bg-${theme === 'dark' ? 'gray-800' : 'white'} p-6 rounded-2xl shadow-xl transform transition-all duration-300 hover:scale-105 hover:shadow-2xl border border-${theme === 'dark' ? 'gray-700' : 'gray-200'}`)}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-200 dark:text-gray-100">Actividad Reciente</h3>
            <Activity className="text-orange-400 w-8 h-8" />
          </div>
          <div className="space-y-3 text-sm max-h-40 overflow-y-auto custom-scrollbar">
            {userActivity.length === 0 ? (
              <p className="text-gray-400 text-center">No hay actividad reciente.</p>
            ) : (
              userActivity.map((act, idx) => (
                <div key={idx} className="flex justify-between items-start pb-2 border-b border-gray-700 last:border-b-0">
                  <span className="text-gray-400 flex-1 pr-2">{act.action}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-500 text-xs text-right">{act.timestamp ? new Date(act.timestamp).toLocaleString() : 'N/A'}</span>
                    {act.details && (
                      <button
                        onClick={() => handleViewActivityDetails(act)}
                        className="text-blue-400 hover:text-blue-300 p-1 rounded-full"
                        title="Ver detalles de la actividad"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-4 text-center">
            <button
              onClick={() => setShowConfirmClearActivity(true)}
              className={classNames(
                "px-4 py-2 rounded-md text-sm font-medium flex items-center justify-center mx-auto",
                theme === 'dark' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
              )}
            >
              <Trash2 className="w-4 h-4 mr-2" /> Limpiar TODAS las Actividades
            </button>
          </div>
        </div>
      </div>
      <DashboardCharts
        dailySalesChartData={dailySalesChartData}
        dailyOrdersChartData={dailyOrdersChartData}
        statusPieChartData={statusPieChartData}
        theme={theme}
        chartTextColor={chartTextColor}
        salesFilterRange={salesFilterRange}
        setSalesFilterRange={setSalesFilterRange}
        salesCustomStartDate={salesCustomStartDate}
        setSalesCustomStartDate={setSalesCustomStartDate}
        salesCustomEndDate={salesCustomEndDate}
        setSalesCustomEndDate={setSalesCustomEndDate}
        ordersFilterRange={ordersFilterRange}
        setOrdersFilterRange={setOrdersFilterRange}
        ordersCustomStartDate={ordersCustomStartDate}
        setOrdersCustomStartDate={setOrdersCustomStartDate}
        ordersCustomEndDate={ordersCustomEndDate}
        setOrdersCustomEndDate={setOrdersCustomEndDate}
        handleSaveDailyIngresos={handleSaveDailyIngresos}
        handleDeleteDailyIngresos={() => setShowConfirmDeleteDailySales(true)}
        handleSaveDailyOrders={handleSaveDailyOrders}
        handleDeleteDailyOrders={handleDeleteDailyOrders}
        loading={loadingData}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
      />
      <Transition show={showConfirmClearActivity} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowConfirmClearActivity(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={classNames(
                "w-full max-w-sm p-6 rounded-lg shadow-md text-center",
                theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-gray-50 text-gray-900'
              )}>
                <Dialog.Title className="text-lg font-medium mb-4">Confirmar Limpieza de Actividad</Dialog.Title>
                <p className="mb-4">
                  Estás a punto de eliminar <span className="font-bold text-red-500">TODAS</span> las actividades registradas.
                  Esta acción es irreversible. Para confirmar, escribe "confirmar" a continuación:
                </p>
                <input
                  type="text"
                  value={confirmClearText}
                  onChange={e => setConfirmClearText(e.target.value)}
                  className={classNames(
                    "w-full p-2 rounded-md border text-center text-sm",
                    theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                    "focus:outline-none focus:ring-1 focus:ring-red-500"
                  )}
                  placeholder="escribe 'confirmar'"
                />
                <div className="mt-6 flex justify-center gap-2">
                  <button
                    onClick={() => { setShowConfirmClearActivity(false); setConfirmClearText(''); }}
                    className={classNames(
                      "px-4 py-2 rounded-md text-sm font-medium",
                      theme === 'dark' ? 'bg-gray-600 hover:bg-gray-700 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    )}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleClearOldActivity}
                    disabled={loading}
                    className={classNames(
                      "px-4 py-2 rounded-md text-sm font-medium",
                      loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'
                    )}
                  >
                    {loading ? 'Eliminando...' : 'Limpiar Actividad'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
      <Transition show={showConfirmDeleteDailySales} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowConfirmDeleteDailySales(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={classNames(
                "w-full max-w-sm p-6 rounded-lg shadow-md text-center",
                theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-gray-50 text-gray-900'
              )}>
                <Dialog.Title className="text-lg font-medium mb-4">Confirmar Eliminación de Ventas del Día</Dialog.Title>
                <p className="mb-4">
                  Estás a punto de eliminar las ventas registradas para <span className="font-bold text-red-500">el día de hoy</span>.
                  Esta acción es irreversible. Para confirmar, escribe "eliminar" a continuación:
                </p>
                <input
                  type="text"
                  value={confirmDeleteDailySalesText}
                  onChange={e => setConfirmDeleteDailySalesText(e.target.value)}
                  className={classNames(
                    "w-full p-2 rounded-md border text-center text-sm",
                    theme === 'dark' ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white text-gray-900',
                    "focus:outline-none focus:ring-1 focus:ring-red-500"
                  )}
                  placeholder="escribe 'eliminar'"
                />
                <div className="mt-6 flex justify-center gap-2">
                  <button
                    onClick={() => { setShowConfirmDeleteDailySales(false); setConfirmDeleteDailySalesText(''); }}
                    className={classNames(
                      "px-4 py-2 rounded-md text-sm font-medium",
                      theme === 'dark' ? 'bg-gray-600 hover:bg-gray-700 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    )}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmDeleteDailySales}
                    disabled={loading}
                    className={classNames(
                      "px-4 py-2 rounded-md text-sm font-medium",
                      loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700 text-white'
                    )}
                  >
                    {loading ? 'Eliminando...' : 'Eliminar Ventas'}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
      <Transition show={showActivityDetailModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowActivityDetailModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className={classNames(
                "w-full max-w-md p-6 rounded-lg shadow-md",
                theme === 'dark' ? 'bg-gray-800 text-gray-200' : 'bg-gray-50 text-gray-900'
              )}>
                <div className="flex justify-between items-center mb-4">
                  <Dialog.Title className="text-lg font-medium">Detalles de la Actividad</Dialog.Title>
                  <button
                    onClick={() => setShowActivityDetailModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {selectedActivityDetail && (
                  <div className="space-y-4 text-sm">
                    <div>
                      <span className="font-medium">Acción:</span> {selectedActivityDetail.action}
                    </div>
                    <div>
                      <span className="font-medium">Fecha:</span>{' '}
                      {selectedActivityDetail.timestamp
                        ? new Date(selectedActivityDetail.timestamp).toLocaleString()
                        : 'N/A'}
                    </div>
                    <div>
                      <span className="font-medium">Detalles:</span>{' '}
                      {typeof selectedActivityDetail.details === 'object'
                        ? JSON.stringify(selectedActivityDetail.details, null, 2)
                        : selectedActivityDetail.details || 'Sin detalles'}
                    </div>
                  </div>
                )}
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowActivityDetailModal(false)}
                    className={classNames(
                      "px-4 py-2 rounded-md text-sm font-medium",
                      theme === 'dark' ? 'bg-gray-600 hover:bg-gray-700 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    )}
                  >
                    Cerrar
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default Dashboard;