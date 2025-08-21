//src/components/Admin/DashboardCharts.js
import React, { Fragment, useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Label
} from 'recharts';
import { DollarSign, MoreVertical, Save, Trash2, TrendingUp, Package, ArrowLeft } from 'lucide-react';
import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { classNames } from '../../utils/classNames';
import { BAR_COLORS, PIE_COLORS } from './dashboardConstants';
import { isMobile as checkIsMobile } from '../../utils/Helpers';

// Custom scrollbar styles
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: var(--scrollbar-track-color, #2d3748);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: var(--scrollbar-thumb-color, #4a5568);
    border-radius: 10px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: var(--scrollbar-thumb-hover-color, #64748b);
  }
  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-thumb-color, #4a5568) var(--scrollbar-track-color, #2d3748);
  }
`;

const SkeletonLoader = ({ type, theme, isMobile }) => {
  if (type === 'bar') {
    const numBars = isMobile ? 5 : 7;
    return (
      <div className="flex h-full items-end justify-around p-4 animate-pulse">
        {Array.from({ length: numBars }).map((_, i) => (
          <div
            key={i}
            className={classNames(
              'rounded-t-md',
              theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200',
              'mx-1'
            )}
            style={{ width: `${100 / numBars - 5}%`, height: `${Math.random() * 70 + 30}%` }}
          ></div>
        ))}
      </div>
    );
  } else if (type === 'pie') {
    return (
      <div className="flex justify-center items-center h-full animate-pulse">
        <div className={classNames(
          isMobile ? 'w-32 h-32' : 'w-40 h-40',
          'rounded-full',
          theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
        )}></div>
      </div>
    );
  }
  return null;
};

// Colombian Peso formatter
const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
});

// Custom Tooltip for Bar Charts
const CustomBarTooltip = ({ active, payload, label, theme, chartTextColor, copFormatter, isOrderChart = false }) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum, entry) => sum + entry.value, 0);
    const formatValue = isOrderChart ? (value) => value.toLocaleString() : (value) => typeof copFormatter === 'function' ? copFormatter(value) : copFormatter.format(value);
    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 5 }}
        className="custom-tooltip p-3 rounded-xl shadow-lg border"
        style={{
          backgroundColor: theme === 'dark' ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderColor: theme === 'dark' ? 'rgba(75, 85, 99, 0.7)' : 'rgba(229, 231, 235, 0.7)',
          backdropFilter: 'blur(8px)',
          color: chartTextColor,
          fontSize: '14px',
        }}
      >
        <p className="font-bold mb-1">{label}</p>
        {payload.map((entry, index) => (
          <p key={`item-${index}`} style={{ color: entry.color || chartTextColor }}>
            {entry.name}: <span className="font-semibold">{formatValue(entry.value)}</span>
          </p>
        ))}
        <p className="font-bold mt-2 border-t pt-2" style={{ borderColor: theme === 'dark' ? '#4b5563' : '#e5e7eb' }}>
          Total: {formatValue(total)}
        </p>
      </motion.div>
    );
  }
  return null;
};

// Custom Tooltip for Pie Chart
const CustomPieTooltip = ({ active, payload, theme, chartTextColor }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 5 }}
        className="custom-tooltip p-3 rounded-xl shadow-lg border"
        style={{
          backgroundColor: theme === 'dark' ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderColor: theme === 'dark' ? 'rgba(75, 85, 99, 0.7)' : 'rgba(229, 231, 235, 0.7)',
          backdropFilter: 'blur(8px)',
          color: chartTextColor,
          fontSize: '14px',
        }}
      >
        <p className="font-bold mb-1" style={{ color: data.color || chartTextColor }}>{data.name}</p>
        <p>
          Valor: <span className="font-semibold">{data.value}</span>
        </p>
        <p>
          Porcentaje: <span className="font-semibold">{`${(data.percent * 100).toFixed(1)}%`}</span>
        </p>
      </motion.div>
    );
  }
  return null;
};

const DashboardCharts = React.memo(({
  dailySalesChartData,
  dailyOrdersChartData,
  statusPieChartData,
  theme = 'dark',
  chartTextColor = '#ffffff',
  salesFilterRange,
  setSalesFilterRange = () => {},
  salesCustomStartDate,
  setSalesCustomStartDate = () => {},
  salesCustomEndDate,
  setSalesCustomEndDate = () => {},
  ordersFilterRange,
  setOrdersFilterRange = () => {},
  ordersCustomStartDate,
  setOrdersCustomStartDate = () => {},
  ordersCustomEndDate,
  setOrdersCustomEndDate = () => {},
  handleSaveDailyIngresos = () => {},
  handleDeleteDailyIngresos = () => {},
  handleSaveDailyOrders = () => {},
  handleDeleteDailyOrders = () => {},
  handleSaveDailyExpenses = () => {},
  handleDeleteDailyExpenses = () => {},
  loading,
  selectedMonth,
  setSelectedMonth = () => {}
}) => {
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [payments, setPayments] = useState([]);
  const [expenseFilterRange, setExpenseFilterRange] = useState('30_days');
  const [expenseCustomStartDate, setExpenseCustomStartDate] = useState(null);
  const [expenseCustomEndDate, setExpenseCustomEndDate] = useState(null);
  const [selectedRecipient, setSelectedRecipient] = useState(null);

  useEffect(() => {
    const paymentsQuery = query(collection(db, 'payments'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(paymentsQuery, (snapshot) => {
      setPayments(
        snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      );
    }, (error) => console.error(`Error al cargar pagos: ${error.message}`));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileDevice(checkIsMobile());
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const dailyExpensesChartData = useMemo(() => {
    const groupedByDate = payments.reduce((acc, payment) => {
      if (!payment.timestamp) return acc;
      const date = new Date(payment.timestamp.toDate());
      const now = new Date();
      let startDate;
      if (expenseFilterRange === '7_days') {
        startDate = new Date(now.setDate(now.getDate() - 7));
      } else if (expenseFilterRange === '30_days') {
        startDate = new Date(now.setDate(now.getDate() - 30));
      } else if (expenseFilterRange === 'year') {
        startDate = new Date(now.getFullYear(), 0, 1);
      } else if (expenseFilterRange === 'custom' && expenseCustomStartDate && expenseCustomEndDate) {
        startDate = new Date(expenseCustomStartDate);
      } else {
        startDate = new Date(0);
      }
      if (expenseFilterRange === 'custom' && expenseCustomEndDate) {
        const endDate = new Date(expenseCustomEndDate);
        if (date < startDate || date > endDate) return acc;
      } else if (date < startDate) {
        return acc;
      }
      const dateKey = date.toISOString().split('T')[0];
      if (!acc[dateKey]) {
        acc[dateKey] = { name: dateKey, Total: 0 };
      }
      acc[dateKey].Total += payment.amount;
      return acc;
    }, {});
    return Object.values(groupedByDate).sort((a, b) => new Date(a.name) - new Date(b.name));
  }, [payments, expenseFilterRange, expenseCustomStartDate, expenseCustomEndDate]);

  const totalExpenses = useMemo(() => payments.reduce((sum, payment) => sum + payment.amount, 0), [payments]);
  const totalOrders = useMemo(() => statusPieChartData.reduce((sum, entry) => sum + entry.value, 0), [statusPieChartData]);

  const aggregatedPaymentsByRecipient = useMemo(() => {
    const grouped = payments.reduce((acc, payment) => {
      const storeName = payment.store || 'Desconocido';
      if (!acc[storeName]) {
        acc[storeName] = { totalAmount: 0, payments: [] };
      }
      acc[storeName].totalAmount += payment.amount;
      acc[storeName].payments.push(payment);
      return acc;
    }, {});
    return Object.entries(grouped)
      .map(([store, data]) => ({ store, ...data }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [payments]);

  const paymentsForSelectedRecipient = useMemo(() => {
    if (!selectedRecipient) return [];
    return payments.filter(payment => payment.store === selectedRecipient).sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate());
  }, [payments, selectedRecipient]);

  const chartVariants = {
    hidden: { opacity: 0, scale: 0.98, y: 10 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
    exit: { opacity: 0, scale: 0.98, y: 10, transition: { duration: 0.4, ease: "easeIn" } },
  };

  const pieChartVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.7, ease: "easeOut" } },
    exit: { opacity: 0, scale: 0.9, transition: { duration: 0.5, ease: "easeIn" } },
  };

  const chartMinWidth = isMobileDevice ? "min-w-[700px]" : "min-w-0";
  const chartHeight = isMobileDevice ? "h-[250px]" : "h-[300px]";

  return (
    <div className="flex flex-col gap-12 mb-8 px-4 sm:px-6 lg:px-8 pb-12">
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />
      {/* Daily Sales Chart */}
      <div className={classNames(
          theme === 'dark' ? 'bg-gray-800' : 'bg-white',
          isMobileDevice ? 'p-4' : 'p-6',
          'rounded-2xl shadow-xl border',
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200',
          'relative min-h-[450px] flex flex-col'
        )}>
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold mb-4 text-gray-200 dark:text-gray-100 flex items-center">
            <DollarSign className={classNames(isMobileDevice ? "w-4 h-4 mr-2" : "w-5 h-5 mr-2", "text-green-400")} />
            Ingresos Diarios
          </h3>
          <Popover className="relative">
            <PopoverButton className="p-2 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
              <MoreVertical className={classNames(isMobileDevice ? "w-4 h-4" : "w-5 h-5", "text-gray-400")} />
            </PopoverButton>
            <Transition
              as={Fragment}
              enter="transition ease-out duration-200"
              enterFrom="opacity-0 translate-y-1"
              enterTo="opacity-100 translate-y-0"
              leave="transition ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-1"
            >
              <PopoverPanel className={classNames(
                "absolute z-50 mt-2",
                "right-0 left-auto",
                isMobileDevice ? "w-[150px] text-sm" : "w-56",
                "rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none",
                theme === 'dark' ? 'bg-gray-700' : 'bg-white',
                "origin-top-right",
                "max-h-[80vh] overflow-y-auto custom-scrollbar"
              )}>
                <div className="py-1">
                  <button
                    onClick={handleSaveDailyIngresos}
                    disabled={loading}
                    className={classNames(
                      "block w-full text-left px-4 py-2 flex items-center transition-colors",
                      isMobileDevice ? "text-xs" : "text-sm",
                      loading ? 'text-gray-400 cursor-not-allowed' : (theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100')
                    )}
                  >
                    <Save className={classNames(isMobileDevice ? "w-4 h-4 mr-2" : "w-5 h-5 mr-2", "text-blue-400")} />
                    {loading ? 'Guardando...' : 'Guardar Ventas del Día'}
                  </button>
                  <button
                    onClick={() => handleDeleteDailyIngresos()}
                    disabled={loading}
                    className={classNames(
                      "block w-full text-left px-4 py-2 flex items-center mt-1 transition-colors",
                      isMobileDevice ? "text-xs" : "text-sm",
                      loading ? 'text-gray-400 cursor-not-allowed' : (theme === 'dark' ? 'text-red-300 hover:bg-gray-600' : 'text-red-600 hover:bg-gray-100')
                    )}
                  >
                    <Trash2 className={classNames(isMobileDevice ? "w-4 h-4 mr-2" : "w-5 h-5 mr-2", "text-red-400")} />
                    Eliminar Ventas del Día
                  </button>
                  <div className={classNames("my-1", theme === 'dark' ? "border-t border-gray-600" : "border-t border-gray-200")}></div>
                  <button
                    onClick={() => { setSalesFilterRange('7_days'); setSalesCustomStartDate(null); setSalesCustomEndDate(null); setSelectedMonth(null); }}
                    className={classNames(
                      "block w-full text-left px-4 py-2 transition-colors",
                      isMobileDevice ? "text-xs" : "text-sm",
                      theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100')
                    }
                  >
                    Ver últimos 7 días
                  </button>
                  <button
                    onClick={() => { setSalesFilterRange('30_days'); setSalesCustomStartDate(null); setSalesCustomEndDate(null); setSelectedMonth(null); }}
                    className={classNames(
                      "block w-full text-left px-4 py-2 transition-colors",
                      isMobileDevice ? "text-xs" : "text-sm",
                      theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100')
                    }
                  >
                    Ver todo el mes
                  </button>
                  <button
                    onClick={() => { setSalesFilterRange('year'); setSalesCustomStartDate(null); setSalesCustomEndDate(null); setSelectedMonth(null); }}
                    className={classNames(
                      "block w-full text-left px-4 py-2 transition-colors",
                      isMobileDevice ? "text-xs" : "text-sm",
                      theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100')
                    }
                  >
                    Ver todo el año
                  </button>
                  <div className={classNames("my-1", theme === 'dark' ? "border-t border-gray-600" : "border-t border-gray-200")}></div>
                  <div className={classNames("px-4 py-2 font-medium text-gray-400", isMobileDevice ? "text-xs" : "text-sm")}>Filtros personalizados</div>
                  <div className="px-4 py-2">
                    <label className={classNames("block font-medium text-gray-400 mb-1", isMobileDevice ? "text-xs" : "text-sm")}>Desde:</label>
                    <input
                      type="date"
                      value={salesCustomStartDate ? salesCustomStartDate.toISOString().split('T')[0] : ''}
                      onChange={(e) => { setSalesCustomStartDate(new Date(e.target.value)); setSalesFilterRange('custom'); setSelectedMonth(null); }}
                      className={classNames(
                        "block w-full rounded-md shadow-sm p-2",
                        isMobileDevice ? "text-xs sm:text-sm" : "text-sm",
                        theme === 'dark' ? 'bg-gray-800 text-gray-200 border-gray-600' : 'bg-white text-gray-900 border-gray-300'
                      )}
                    />
                  </div>
                  <div className="px-4 py-2">
                    <label className={classNames("block font-medium text-gray-400 mb-1", isMobileDevice ? "text-xs" : "text-sm")}>Hasta:</label>
                    <input
                      type="date"
                      value={salesCustomEndDate ? salesCustomEndDate.toISOString().split('T')[0] : ''}
                      onChange={(e) => { setSalesCustomEndDate(new Date(e.target.value)); setSalesFilterRange('custom'); }}
                      className={classNames(
                        "block w-full rounded-md shadow-sm p-2",
                        isMobileDevice ? "text-xs sm:text-sm" : "text-sm",
                        theme === 'dark' ? 'bg-gray-800 text-gray-200 border-gray-600' : 'bg-white text-gray-900 border-gray-300'
                      )}
                    />
                  </div>
                </div>
              </PopoverPanel>
            </Transition>
          </Popover>
        </div>
        <motion.div
          className={classNames(
            isMobileDevice ? 'overflow-x-auto overflow-y-hidden custom-scrollbar' : 'overflow-x-hidden overflow-y-hidden',
            'relative flex flex-col flex-grow'
          )}
          variants={chartVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          {salesFilterRange === 'year' && selectedMonth && (
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onClick={() => setSelectedMonth(null)}
              className="mb-4 text-blue-500 hover:underline text-sm self-start transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4 inline-block mr-2" />Volver al resumen anual
            </motion.button>
          )}
          {loading ? (
            <SkeletonLoader type="bar" theme={theme} isMobile={isMobileDevice} />
          ) : (
            <div className={classNames("w-full", chartHeight, chartMinWidth)}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dailySalesChartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  barCategoryGap={isMobileDevice ? "0%" : "40%"}
                  barGap={1}
                >
                  <CartesianGrid
                    strokeDasharray={isMobileDevice ? "2 2" : "3 3"}
                    stroke={theme === 'dark' ? '#4b5563' : '#e5e7eb'}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    stroke={chartTextColor}
                    tick={{ fill: chartTextColor, fontSize: isMobileDevice ? 9 : 11 }}
                    angle={-45}
                    textAnchor="end"
                    interval={0}
                    height={60}
                  />
                  <YAxis
                    stroke={chartTextColor}
                    tick={{ fill: chartTextColor, fontSize: isMobileDevice ? 9 : 11 }}
                    tickFormatter={(value) => copFormatter.format(value)}
                    width={isMobileDevice ? 50 : 80}
                  />
                  <Tooltip
                    cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', rx: 4 }}
                    content={<CustomBarTooltip theme={theme} chartTextColor={chartTextColor} copFormatter={copFormatter} />}
                  />
                  <Legend
                    wrapperStyle={{ color: chartTextColor, fontSize: isMobileDevice ? 10 : 13, paddingTop: '15px', paddingBottom: '20px' }}
                    align="center"
                    verticalAlign="top"
                    iconType="circle"
                  />
<Bar
  dataKey="Domicilios Almuerzo"
  fill="#34D399"
  stroke="#34D399"
  radius={[8, 8, 0, 0]}
  maxBarSize={isMobileDevice ? 12 : 25}
  animationDuration={800}
  onClick={(data) => { if (salesFilterRange === 'year' && data.monthKey) setSelectedMonth(data.monthKey); }}
/>
<Bar
  dataKey="Domicilios Desayuno"
  fill="#60A5FA"
  stroke="#60A5FA"
  radius={[8, 8, 0, 0]}
  maxBarSize={isMobileDevice ? 12 : 25}
  animationDuration={800}
/>
<Bar
  dataKey="Mesas/Llevar Almuerzo"
  fill="#FBBF24"
  stroke="#FBBF24"
  radius={[8, 8, 0, 0]}
  maxBarSize={isMobileDevice ? 12 : 25}
  animationDuration={800}
/>
<Bar
  dataKey="Mesas/Llevar Desayuno"
  fill="#F472B6"
  stroke="#F472B6"
  radius={[8, 8, 0, 0]}
  maxBarSize={isMobileDevice ? 12 : 25}
  animationDuration={800}
/>

                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>
      </div>

      {/* New 2x2 Grid for Expenses Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Daily Expenses Chart */}
        <div className={classNames(
            theme === 'dark' ? 'bg-gray-800' : 'bg-white',
            isMobileDevice ? 'p-4' : 'p-6',
            'rounded-2xl shadow-xl border',
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200',
            'relative min-h-[350px] flex flex-col'
          )}>
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold mb-4 text-gray-200 dark:text-gray-100 flex items-center">
              <DollarSign className={classNames(isMobileDevice ? "w-4 h-4 mr-2" : "w-5 h-5 mr-2", "text-red-400")} />
              Gastos Diarios
            </h3>
            <Popover className="relative">
              <PopoverButton className="p-2 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
                <MoreVertical className={classNames(isMobileDevice ? "w-4 h-4" : "w-5 h-5", "text-gray-400")} />
              </PopoverButton>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="opacity-0 translate-y-1"
                enterTo="opacity-100 translate-y-0"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 translate-y-1"
              >
                <PopoverPanel className={classNames(
                  "absolute z-50 mt-2",
                  "right-0 left-auto",
                  isMobileDevice ? "w-[150px] text-sm" : "w-56",
                  "rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none",
                  theme === 'dark' ? 'bg-gray-700' : 'bg-white',
                  "origin-top-right",
                  "max-h-[80vh] overflow-y-auto custom-scrollbar"
                )}>
                  <div className="py-1">
                    <button
                      onClick={handleSaveDailyExpenses}
                      disabled={loading}
                      className={classNames(
                        "block w-full text-left px-4 py-2 flex items-center transition-colors",
                        isMobileDevice ? "text-xs" : "text-sm",
                        loading ? 'text-gray-400 cursor-not-allowed' : (theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100')
                      )}
                    >
                      <Save className={classNames(isMobileDevice ? "w-4 h-4 mr-2" : "w-5 h-5 mr-2", "text-blue-400")} />
                      {loading ? 'Guardando...' : 'Guardar Gastos del Día'}
                    </button>
                    <button
                      onClick={() => handleDeleteDailyExpenses()}
                      disabled={loading}
                      className={classNames(
                        "block w-full text-left px-4 py-2 flex items-center mt-1 transition-colors",
                        isMobileDevice ? "text-xs" : "text-sm",
                        loading ? 'text-gray-400 cursor-not-allowed' : (theme === 'dark' ? 'text-red-300 hover:bg-gray-600' : 'text-red-600 hover:bg-gray-100')
                      )}
                    >
                      <Trash2 className={classNames(isMobileDevice ? "w-4 h-4 mr-2" : "w-5 h-5 mr-2", "text-red-400")} />
                      Eliminar Gastos del Día
                    </button>
                    <div className={classNames("my-1", theme === 'dark' ? "border-t border-gray-600" : "border-t border-gray-200")}></div>
                    <button
                      onClick={() => { setExpenseFilterRange('7_days'); setExpenseCustomStartDate(null); setExpenseCustomEndDate(null); }}
                      className={classNames(
                        "block w-full text-left px-4 py-2 transition-colors",
                        isMobileDevice ? "text-xs" : "text-sm",
                        theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      Ver últimos 7 días
                    </button>
                    <button
                      onClick={() => { setExpenseFilterRange('30_days'); setExpenseCustomStartDate(null); setExpenseCustomEndDate(null); }}
                      className={classNames(
                        "block w-full text-left px-4 py-2 transition-colors",
                        isMobileDevice ? "text-xs" : "text-sm",
                        theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      Ver todo el mes
                    </button>
                    <button
                      onClick={() => { setExpenseFilterRange('year'); setExpenseCustomStartDate(null); setExpenseCustomEndDate(null); }}
                      className={classNames(
                        "block w-full text-left px-4 py-2 transition-colors",
                        isMobileDevice ? "text-xs" : "text-sm",
                        theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      Ver todo el año
                    </button>
                    <div className={classNames("my-1", theme === 'dark' ? "border-t border-gray-600" : "border-t border-gray-200")}></div>
                    <div className={classNames("px-4 py-2 font-medium text-gray-400", isMobileDevice ? "text-xs" : "text-sm")}>Filtros personalizados</div>
                    <div className="px-4 py-2">
                      <label className={classNames("block font-medium text-gray-400 mb-1", isMobileDevice ? "text-xs" : "text-sm")}>Desde:</label>
                      <input
                        type="date"
                        value={expenseCustomStartDate ? expenseCustomStartDate.toISOString().split('T')[0] : ''}
                        onChange={(e) => { setExpenseCustomStartDate(new Date(e.target.value)); setExpenseFilterRange('custom'); }}
                        className={classNames(
                          "block w-full rounded-md shadow-sm p-2",
                          isMobileDevice ? "text-xs sm:text-sm" : "text-sm",
                          theme === 'dark' ? 'bg-gray-800 text-gray-200 border-gray-600' : 'bg-white text-gray-900 border-gray-300'
                        )}
                      />
                    </div>
                    <div className="px-4 py-2">
                      <label className={classNames("block font-medium text-gray-400 mb-1", isMobileDevice ? "text-xs" : "text-sm")}>Hasta:</label>
                      <input
                        type="date"
                        value={expenseCustomEndDate ? expenseCustomEndDate.toISOString().split('T')[0] : ''}
                        onChange={(e) => { setExpenseCustomEndDate(new Date(e.target.value)); setExpenseFilterRange('custom'); }}
                        className={classNames(
                          "block w-full rounded-md shadow-sm p-2",
                          isMobileDevice ? "text-xs sm:text-sm" : "text-sm",
                          theme === 'dark' ? 'bg-gray-800 text-gray-200 border-gray-600' : 'bg-white text-gray-900 border-gray-300'
                        )}
                      />
                    </div>
                  </div>
                </PopoverPanel>
              </Transition>
            </Popover>
          </div>
          <motion.div
            className={classNames(
              isMobileDevice ? 'overflow-x-auto overflow-y-hidden custom-scrollbar' : 'overflow-x-hidden overflow-y-hidden',
              'relative flex flex-col flex-grow'
            )}
            variants={chartVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {loading ? (
              <SkeletonLoader type="bar" theme={theme} isMobile={isMobileDevice} />
            ) : (
              <div className={classNames("w-full", chartHeight, chartMinWidth)}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dailyExpensesChartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    barCategoryGap={isMobileDevice ? "0%" : "40%"}
                    barGap={1}
                  >
                    <CartesianGrid
                      strokeDasharray={isMobileDevice ? "2 2" : "3 3"}
                      stroke={theme === 'dark' ? '#4b5563' : '#e5e7eb'}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      stroke={chartTextColor}
                      tick={{ fill: chartTextColor, fontSize: isMobileDevice ? 9 : 11 }}
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      height={60}
                    />
                    <YAxis
                      stroke={chartTextColor}
                      tick={{ fill: chartTextColor, fontSize: isMobileDevice ? 9 : 11 }}
                      tickFormatter={(value) => copFormatter.format(value)}
                      width={isMobileDevice ? 50 : 80}
                    />
                    <Tooltip
                      cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', rx: 4 }}
                      content={<CustomBarTooltip theme={theme} chartTextColor={chartTextColor} copFormatter={copFormatter} />}
                    />
                    <Legend
                      wrapperStyle={{ color: chartTextColor, paddingTop: '15px', fontSize: isMobileDevice ? 10 : 13 }}
                      align="center"
                      verticalAlign="top"
                      iconType="circle"
                    />
                    <Bar
                      dataKey="Total"
                      fill="#EF4444"
                      stroke="#EF4444"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={isMobileDevice ? 12 : 25}
                      animationDuration={800}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        </div>

        {/* Expenses Summary Card */}
        <motion.div
          className={classNames(
            `bg-${theme === 'dark' ? 'gray-800' : 'white'} p-6 rounded-2xl shadow-xl transform transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl border border-${theme === 'dark' ? 'gray-700' : 'gray-200'}`
          )}
          variants={chartVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-2xl font-bold text-gray-100">Gastos</h3>
            <DollarSign className="text-red-400 w-10 h-10 animate-pulse" />
          </div>
          <div className="space-y-4 text-base text-gray-300">
            <div className="flex justify-between items-center text-xl font-semibold">
              <span className="text-gray-200">Total de Gastos:</span>
              <span className="font-extrabold text-red-400">
                {copFormatter.format(totalExpenses)}
              </span>
            </div>
            <div
              className="border-t border-dashed my-4"
              style={{ borderColor: theme === 'dark' ? '#4b5563' : '#d1d5db' }}
            ></div>
            {!selectedRecipient ? (
              <>
                <p className="text-gray-400 text-sm mb-2">Gastos por Remitente:</p>
                <div className="text-sm max-h-52 overflow-y-auto custom-scrollbar pr-2">
                  {aggregatedPaymentsByRecipient.length === 0 ? (
                    <p className="text-gray-500 text-center py-6">
                      Aún no hay gastos registrados. ¡Empieza a añadir algunos! 📝
                    </p>
                  ) : (
                    aggregatedPaymentsByRecipient.map((entry, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedRecipient(entry.store)}
                        className="flex justify-between items-center w-full py-3 border-b last:border-b-0 transition-colors duration-200 hover:bg-gray-700 dark:hover:bg-gray-800 rounded-md px-2 -mx-2 cursor-pointer"
                        style={{ borderColor: theme === 'dark' ? '#374151' : '#e5e7eb' }}
                      >
                        <span className="text-gray-300 flex-1 pr-3 truncate text-left font-medium">
                          {entry.store}
                        </span>
                        <div className="flex flex-col items-end">
                          <span className="text-red-300 font-semibold">
                            {copFormatter.format(entry.totalAmount)}
                          </span>
                          <span className="text-gray-500 text-xs mt-1">
                            ({entry.payments.length} movimientos)
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => setSelectedRecipient(null)}
                  className="flex items-center text-blue-400 hover:underline text-sm mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Volver a Gastos por Remitente
                </button>
                <h4 className="text-lg font-semibold text-gray-200 mb-3">{selectedRecipient}</h4>
                <div className={classNames("text-sm max-h-52 overflow-y-auto custom-scrollbar pr-2", isMobileDevice ? "overflow-x-auto" : "overflow-x-hidden")}>
                    <div className="min-w-full inline-block align-middle">
                        {paymentsForSelectedRecipient.length === 0 ? (
                            <p className="text-gray-500 text-center py-6">
                                No hay movimientos para este remitente en el rango de fechas seleccionado.
                            </p>
                        ) : (
                            paymentsForSelectedRecipient.map((payment, idx) => (
                                <div
                                    key={idx}
                                    className="flex items-center py-3 border-b last:border-b-0 transition-colors duration-200 hover:bg-gray-700 dark:hover:bg-gray-800 rounded-md px-2 -mx-2"
                                    style={{ borderColor: theme === 'dark' ? '#374151' : '#e5e7eb' }}
                                >
                                    <span className="text-gray-400 font-normal mr-3 min-w-[80px]">
                                        {payment.name || 'N/A'}
                                    </span>
                                    <span className="text-gray-300 font-light text-nowrap mr-3 min-w-[150px]">
                                        {new Date(payment.timestamp?.toDate()).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                                    </span>
                                    <span className="text-red-300 font-semibold text-right flex-grow">
                                        {copFormatter.format(payment.amount)}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>

      {/* Existing Daily Orders and Status Pie Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Daily Orders Chart */}
        <div className={classNames(
            theme === 'dark' ? 'bg-gray-800' : 'bg-white',
            isMobileDevice ? 'p-4' : 'p-6',
            'rounded-2xl shadow-xl border',
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200',
            'relative min-h-[350px] flex flex-col'
          )}>
          <h3 className="text-xl font-semibold mb-4 text-gray-200 dark:text-gray-100 flex items-center justify-between">
            <span className="flex items-center">
              <Package className={classNames(isMobileDevice ? "w-4 h-4 mr-2" : "w-5 h-5 mr-2", "text-purple-400")} />
              Pedidos Diarios
            </span>
            <Popover className="relative">
              <PopoverButton className="p-2 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors">
                <MoreVertical className={classNames(isMobileDevice ? "w-4 h-4" : "w-5 h-5", "text-gray-400")} />
              </PopoverButton>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="opacity-0 translate-y-1"
                enterTo="opacity-100 translate-y-0"
                leave="transition ease-in duration-150"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 translate-y-1"
              >
                <PopoverPanel className={classNames(
                  "absolute z-50 mt-2",
                  "right-0 left-auto",
                  isMobileDevice ? "w-[150px] text-sm" : "w-56",
                  "rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none",
                  theme === 'dark' ? 'bg-gray-700' : 'bg-white',
                  "origin-top-right",
                  "max-h-[80vh] overflow-y-auto custom-scrollbar"
                )}>
                  <div className="py-1">
                    <button
                      onClick={handleSaveDailyOrders}
                      disabled={loading}
                      className={classNames(
                        "block w-full text-left px-4 py-2 flex items-center transition-colors",
                        isMobileDevice ? "text-xs" : "text-sm",
                        loading ? 'text-gray-400 cursor-not-allowed' : (theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100')
                      )}
                    >
                      <Save className={classNames(isMobileDevice ? "w-4 h-4 mr-2" : "w-5 h-5 mr-2", "text-blue-400")} />
                      {loading ? 'Guardando...' : 'Guardar Pedidos del Día'}
                    </button>
                    <button
                      onClick={() => handleDeleteDailyOrders()}
                      disabled={loading}
                      className={classNames(
                        "block w-full text-left px-4 py-2 flex items-center mt-1 transition-colors",
                        isMobileDevice ? "text-xs" : "text-sm",
                        loading ? 'text-gray-400 cursor-not-allowed' : (theme === 'dark' ? 'text-red-300 hover:bg-gray-600' : 'text-red-600 hover:bg-gray-100')
                      )}
                    >
                      <Trash2 className={classNames(isMobileDevice ? "w-4 h-4 mr-2" : "w-5 h-5 mr-2", "text-red-400")} />
                      Eliminar Pedidos del Día
                    </button>
                    <div className={classNames("my-1", theme === 'dark' ? "border-t border-gray-600" : "border-t border-gray-200")}></div>
                    <button
                      onClick={() => { setOrdersFilterRange('7_days'); setOrdersCustomStartDate(null); setOrdersCustomEndDate(null); }}
                      className={classNames(
                        "block w-full text-left px-4 py-2 transition-colors",
                        isMobileDevice ? "text-xs" : "text-sm",
                        theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      Ver últimos 7 días
                    </button>
                    <button
                      onClick={() => { setOrdersFilterRange('30_days'); setOrdersCustomStartDate(null); setOrdersCustomEndDate(null); }}
                      className={classNames(
                        "block w-full text-left px-4 py-2 transition-colors",
                        isMobileDevice ? "text-xs" : "text-sm",
                        theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      Ver todo el mes
                    </button>
                    <button
                      onClick={() => { setOrdersFilterRange('year'); setOrdersCustomStartDate(null); setOrdersCustomEndDate(null); }}
                      className={classNames(
                        "block w-full text-left px-4 py-2 transition-colors",
                        isMobileDevice ? "text-xs" : "text-sm",
                        theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      Ver todo el año
                    </button>
                    <div className={classNames("my-1", theme === 'dark' ? "border-t border-gray-600" : "border-t border-gray-200")}></div>
                    <div className={classNames("px-4 py-2 font-medium text-gray-400", isMobileDevice ? "text-xs" : "text-sm")}>Filtros personalizados</div>
                    <div className="px-4 py-2">
                      <label className={classNames("block font-medium text-gray-400 mb-1", isMobileDevice ? "text-xs" : "text-sm")}>Desde:</label>
                      <input
                        type="date"
                        value={ordersCustomStartDate ? ordersCustomStartDate.toISOString().split('T')[0] : ''}
                        onChange={(e) => { setOrdersCustomStartDate(new Date(e.target.value)); setOrdersFilterRange('custom'); }}
                        className={classNames(
                          "block w-full rounded-md shadow-sm p-2",
                          isMobileDevice ? "text-xs sm:text-sm" : "text-sm",
                          theme === 'dark' ? 'bg-gray-800 text-gray-200 border-gray-600' : 'bg-white text-gray-900 border-gray-300'
                        )}
                      />
                    </div>
                    <div className="px-4 py-2">
                      <label className={classNames("block font-medium text-gray-400 mb-1", isMobileDevice ? "text-xs" : "text-sm")}>Hasta:</label>
                      <input
                        type="date"
                        value={ordersCustomEndDate ? ordersCustomEndDate.toISOString().split('T')[0] : ''}
                        onChange={(e) => { setOrdersCustomEndDate(new Date(e.target.value)); setOrdersFilterRange('custom'); }}
                        className={classNames(
                          "block w-full rounded-md shadow-sm p-2",
                          isMobileDevice ? "text-xs sm:text-sm" : "text-sm",
                          theme === 'dark' ? 'bg-gray-800 text-gray-200 border-gray-600' : 'bg-white text-gray-900 border-gray-300'
                        )}
                      />
                    </div>
                  </div>
                </PopoverPanel>
              </Transition>
            </Popover>
          </h3>
          <motion.div
            className={classNames(
              isMobileDevice ? 'overflow-x-auto overflow-y-hidden custom-scrollbar' : 'overflow-x-hidden overflow-y-hidden',
              'relative flex flex-col flex-grow'
            )}
            variants={chartVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {ordersFilterRange === 'year' && selectedMonth && (
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onClick={() => setSelectedMonth(null)}
                className="mb-4 text-blue-500 hover:underline text-sm self-start transition-all duration-200"
              >
                <ArrowLeft className="w-4 h-4 inline-block mr-2" />Volver al resumen anual
              </motion.button>
            )}
            {loading ? (
              <SkeletonLoader type="bar" theme={theme} isMobile={isMobileDevice} />
            ) : (
        <div className={classNames("w-full", chartHeight, chartMinWidth)}>
  <ResponsiveContainer width="100%" height="100%">
    <BarChart
      data={dailyOrdersChartData}
      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
      barCategoryGap={isMobileDevice ? "0%" : "40%"}
      barGap={1}
    >
      <CartesianGrid
        strokeDasharray={isMobileDevice ? "2 2" : "3 3"}
        stroke={theme === 'dark' ? '#4b5563' : '#e5e7eb'}
        vertical={false}
      />
      <XAxis
        dataKey="name"
        stroke={chartTextColor}
        tick={{ fill: chartTextColor, fontSize: isMobileDevice ? 9 : 11 }}
        angle={-45}
        textAnchor="end"
        interval={0}
        height={60}
      />
      <YAxis
        stroke={chartTextColor}
        tick={{ fill: chartTextColor, fontSize: isMobileDevice ? 9 : 11 }}
        width={isMobileDevice ? 30 : 50}
      />
      <Tooltip
        cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', rx: 4 }}
        content={<CustomBarTooltip theme={theme} chartTextColor={chartTextColor} copFormatter={(val) => val.toLocaleString()} />}
      />
      <Legend
        wrapperStyle={{ color: chartTextColor, paddingTop: '10px', fontSize: isMobileDevice ? 8 : 12 }}
        align="center"
        verticalAlign="top"
        iconType="circle"
      />
      <Bar
        dataKey="Domicilios"
        fill="#8B5CF6"
        stroke="#8B5CF6"
        radius={[10, 10, 0, 0]}
        opacity={1}
        isAnimationActive={false}
        maxBarSize={isMobileDevice ? 12 : 25}
      />
      <Bar
        dataKey="Mesas"
        fill="#10B981"
        stroke="#10B981"
        radius={[10, 10, 0, 0]}
        opacity={1}
        isAnimationActive={false}
        maxBarSize={isMobileDevice ? 12 : 25}
      />
    </BarChart>
  </ResponsiveContainer>
</div>
            )}
          </motion.div>
        </div>

        {/* Order Status Pie Chart */}
        <motion.div
          className={classNames(
            theme === 'dark' ? 'bg-gray-800' : 'bg-white',
            isMobileDevice ? 'p-4' : 'p-6',
            'rounded-2xl shadow-xl border',
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200',
            'relative min-h-[350px] flex flex-col justify-center items-center'
          )}
          variants={pieChartVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <h3 className="text-xl font-semibold mb-4 text-gray-200 dark:text-gray-100 flex items-center">
            <TrendingUp className={classNames(isMobileDevice ? "w-4 h-4 mr-2" : "w-5 h-5 mr-2", "text-blue-400")} />
            Estado de Pedidos
          </h3>
          {loading ? (
            <SkeletonLoader type="pie" theme={theme} isMobile={isMobileDevice} />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={isMobileDevice ? 80 : 120}
                  fill="#8884d8"
                  dataKey="value"
                  animationDuration={800}
                  innerRadius={isMobileDevice ? 40 : 60}
                >
                  {statusPieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} stroke={theme === 'dark' ? '#1f2937' : '#ffffff'} strokeWidth={2} />
                  ))}
                  <Label
                    value={`${totalOrders} Pedidos`}
                    position="center"
                    fill={chartTextColor}
                    fontSize={isMobileDevice ? 14 : 18}
                    fontWeight="bold"
                    dy={isMobileDevice ? 0 : -10}
                  />
                  <Label
                    value="Total"
                    position="center"
                    fill={chartTextColor}
                    fontSize={isMobileDevice ? 10 : 12}
                    dy={isMobileDevice ? 15 : 15}
                  />
                </Pie>
                <Tooltip content={<CustomPieTooltip theme={theme} chartTextColor={chartTextColor} />} />
                <Legend
                  wrapperStyle={{ color: chartTextColor, fontSize: isMobileDevice ? 10 : 13, paddingTop: '15px' }}
                  align="center"
                  verticalAlign="bottom"
                  iconType="circle"
                  layout="horizontal"
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>
    </div>
  );
});

export default DashboardCharts;