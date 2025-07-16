// src/components/Admin/DashboardCharts.jsx
import React, { Fragment, useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Label
} from 'recharts';
import { DollarSign, MoreVertical, Save, Trash2 } from 'lucide-react';
import { Popover, PopoverButton, PopoverPanel, Transition } from '@headlessui/react';
import { classNames } from '../../utils/classNames';
import { BAR_COLORS, PIE_COLORS } from '../Admin/dashboardConstants';

const scrollbarStyles = ``;

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
  loading,
  selectedMonth,
  setSelectedMonth = () => {}
}) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const totalOrders = useMemo(() => statusPieChartData.reduce((sum, entry) => sum + entry.value, 0), [statusPieChartData]);

  const chartVariants = {
    hidden: { opacity: 0, scale: 0.98 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: "easeOut" } },
    exit: { opacity: 0, scale: 0.98, transition: { duration: 0.3, ease: "easeIn" } },
  };

  const pieChartVariants = {
    hidden: { opacity: 0, scale: 0.98 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: "easeOut" } },
    exit: { opacity: 0, scale: 0.98, transition: { duration: 0.5, ease: "easeIn" } },
  };

  return (
    <div className="flex flex-col gap-12 mb-8 px-4 sm:px-6 lg:px-8 pb-12">
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />
      <motion.div
        className={classNames(
          theme === 'dark' ? 'bg-gray-800' : 'bg-white',
          isMobile ? 'p-4' : 'p-6',
          'rounded-2xl shadow-xl border',
          theme === 'dark' ? 'border-gray-700' : 'border-gray-200',
          'overflow-x-auto overflow-y-hidden relative min-h-[450px] flex flex-col'
        )}
        variants={chartVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        <div className="flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold mb-4 text-gray-200 dark:text-gray-100 flex items-center">
              <DollarSign className={isMobile ? "w-4 h-4 mr-2 text-green-400" : "w-5 h-5 mr-2 text-green-400"} />
              Ingresos Diarios
            </h3>
            <Popover className="relative">
              <PopoverButton className="p-2 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <MoreVertical className={isMobile ? "w-4 h-4 text-gray-400" : "w-5 h-5 text-gray-400"} />
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
                  "absolute z-10 mt-2",
                  isMobile ? "w-36" : "w-56",
                  "rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none",
                  theme === 'dark' ? 'bg-gray-700' : 'bg-white',
                  "right-0"
                )}>
                  <div className="py-1">
                    <button
                      onClick={handleSaveDailyIngresos}
                      disabled={loading}
                      className={classNames(
                        "block w-full text-left px-4 py-2 text-sm flex items-center",
                        loading ? 'text-gray-400 cursor-not-allowed' : (theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100')
                      )}
                    >
                      <Save className={isMobile ? "w-4 h-4 mr-2" : "w-5 h-5 mr-2"} />
                      {loading ? 'Guardando...' : 'Guardar Ventas del Día'}
                    </button>
                    <button
                      onClick={() => handleDeleteDailyIngresos()}
                      disabled={loading}
                      className={classNames(
                        "block w-full text-left px-4 py-2 text-sm flex items-center mt-1",
                        loading ? 'text-gray-400 cursor-not-allowed' : (theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100')
                      )}
                    >
                      <Trash2 className={isMobile ? "w-4 h-4 mr-2" : "w-5 h-5 mr-2"} />
                      Eliminar Ventas del Día
                    </button>
                    <div className="border-t border-gray-600 my-1"></div>
                    <button
                      onClick={() => { setSalesFilterRange('7_days'); setSalesCustomStartDate(null); setSalesCustomEndDate(null); setSelectedMonth(null); }}
                      className={classNames(
                        "block w-full text-left px-4 py-2 text-sm",
                        theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      Ver últimos 7 días
                    </button>
                    <button
                      onClick={() => { setSalesFilterRange('30_days'); setSalesCustomStartDate(null); setSalesCustomEndDate(null); setSelectedMonth(null); }}
                      className={classNames(
                        "block w-full text-left px-4 py-2 text-sm",
                        theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      Ver todo el mes
                    </button>
                    <button
                      onClick={() => { setSalesFilterRange('year'); setSalesCustomStartDate(null); setSalesCustomEndDate(null); setSelectedMonth(null); }}
                      className={classNames(
                        "block w-full text-left px-4 py-2 text-sm",
                        theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      Ver todo el año
                    </button>
                    <div className="border-t border-gray-600 my-1"></div>
                    <div className="px-4 py-2 text-sm font-medium text-gray-400">Filtros personalizados</div>
                    <div className="px-4 py-2">
                      <label className="block text-xs font-medium text-gray-400">Desde:</label>
                      <input
                        type="date"
                        value={salesCustomStartDate ? salesCustomStartDate.toISOString().split('T')[0] : ''}
                        onChange={(e) => { setSalesCustomStartDate(new Date(e.target.value)); setSalesFilterRange('custom'); setSelectedMonth(null); }}
                        className={classNames(
                          "mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm",
                          theme === 'dark' ? 'bg-gray-800 text-gray-200 border-gray-600' : 'bg-white text-gray-900 border-gray-300'
                        )}
                      />
                    </div>
                    <div className="px-4 py-2">
                      <label className="block text-xs font-medium text-gray-400">Hasta:</label>
                      <input
                        type="date"
                        value={salesCustomEndDate ? salesCustomEndDate.toISOString().split('T')[0] : ''}
                        onChange={(e) => { setSalesCustomEndDate(new Date(e.target.value)); setSalesFilterRange('custom'); setSelectedMonth(null); }}
                        className={classNames(
                          "mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm",
                          theme === 'dark' ? 'bg-gray-800 text-gray-200 border-gray-600' : 'bg-white text-gray-900 border-gray-300'
                        )}
                      />
                    </div>
                  </div>
                </PopoverPanel>
              </Transition>
            </Popover>
          </div>
          {salesFilterRange === 'year' && selectedMonth && (
            <button
              onClick={() => setSelectedMonth(null)}
              className="mb-4 text-blue-500 hover:underline text-sm self-start"
            >
              Volver al resumen anual
            </button>
          )}
        </div>
        <div className={classNames("w-full", isMobile ? "h-[250px] min-w-[300px]" : "h-[300px] min-w-[700px]")}>
<ResponsiveContainer width="100%" height="100%">
  <BarChart
    data={dailySalesChartData}
    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
    barCategoryGap={isMobile ? "0%" : "40%"}
    barGap={1}
  >
    <CartesianGrid
      strokeDasharray={isMobile ? "2 2" : "3 3"}
      stroke={theme === 'dark' ? '#4b5563' : '#e5e7eb'}
      fill="none"
      opacity={isMobile ? 0.5 : 1}
    />
    <XAxis
      dataKey="name"
      stroke={chartTextColor}
      tick={{ fill: chartTextColor, fontSize: isMobile ? 7 : 10 }}
      angle={-45}
      textAnchor="end"
      interval={0}
      height={50}
    />
    <YAxis
      stroke={chartTextColor}
      tick={{ fill: chartTextColor, fontSize: isMobile ? 7 : 10 }}
      tickFormatter={(value) => `$${value.toLocaleString()}`}
      width={60}
    />
    <Tooltip
      contentStyle={{
        backgroundColor: theme === 'dark' ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        border: 'none',
        borderRadius: '12px',
        fontSize: '12px',
        padding: '8px 12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        backdropFilter: 'blur(5px)',
        touchAction: 'manipulation'
      }}
      labelStyle={{ color: chartTextColor, fontWeight: 'bold', marginBottom: '4px' }}
      itemStyle={{ color: chartTextColor }}
      cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
      content={({ active, payload, label }) => {
        if (active && payload && payload.length) {
          const total = payload.reduce((sum, entry) => sum + entry.value, 0);
          return (
            <div className="custom-tooltip" style={{
              backgroundColor: theme === 'dark' ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              border: 'none',
              borderRadius: '12px',
              padding: '8px 12px',
              fontSize: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              backdropFilter: 'blur(5px)'
            }}>
              <p style={{ color: chartTextColor, fontWeight: 'bold', marginBottom: '4px' }}>{label}</p>
              {payload.map((entry, index) => (
                <p key={index} style={{ color: chartTextColor }}>
                  {entry.name}: ${entry.value.toLocaleString()}
                </p>
              ))}
              <p style={{ color: chartTextColor, fontWeight: 'bold', marginTop: '4px' }}>
                Total: ${total.toLocaleString()}
              </p>
            </div>
          );
        }
        return null;
      }}
    />
    <Legend
      wrapperStyle={{ color: chartTextColor, fontSize: isMobile ? 8 : 12, paddingTop: '10px', paddingBottom: '25px' }}
      align="center"
      verticalAlign="top"
    />
    <Bar
      dataKey="Efectivo"
      fill={BAR_COLORS.Efectivo}
      stroke={BAR_COLORS.Efectivo}
      radius={[6, 6, 0, 0]}
      maxBarSize={isMobile ? 10 : 20}
      onClick={(data) => {
        if (salesFilterRange === 'year' && data.monthKey) {
          setSelectedMonth(data.monthKey);
        }
      }}
    />
    <Bar
      dataKey="Daviplata"
      fill={BAR_COLORS.Daviplata}
      stroke={BAR_COLORS.Daviplata}
      radius={[6, 6, 0, 0]}
      maxBarSize={isMobile ? 10 : 20}
      onClick={(data) => {
        if (salesFilterRange === 'year' && data.monthKey) {
          setSelectedMonth(data.monthKey);
        }
      }}
    />
    <Bar
      dataKey="Nequi"
      fill={BAR_COLORS.Nequi}
      stroke={BAR_COLORS.Nequi}
      radius={[6, 6, 0, 0]}
      maxBarSize={isMobile ? 10 : 20}
      onClick={(data) => {
        if (salesFilterRange === 'year' && data.monthKey) {
          setSelectedMonth(data.monthKey);
        }
      }}
    />
  </BarChart>
</ResponsiveContainer>
        </div>
      </motion.div>
      <div className="flex flex-col lg:flex-row gap-12">
        <motion.div
          className={classNames(
            theme === 'dark' ? 'bg-gray-800' : 'bg-white',
            isMobile ? 'p-4' : 'p-6',
            'rounded-2xl shadow-xl border',
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200',
            'relative min-h-[350px] overflow-x-auto overflow-y-hidden',
            'lg:flex-1'
          )}
          variants={chartVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <h3 className="text-xl font-semibold mb-4 text-gray-200 dark:text-gray-100 flex items-center justify-between">
            <span className="flex items-center">
              Pedidos Diarios
            </span>
            <Popover className="relative">
              <PopoverButton className="p-2 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <MoreVertical className={isMobile ? "w-4 h-4 text-gray-400" : "w-5 h-5 text-gray-400"} />
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
                  "absolute z-10 mt-2",
                  isMobile ? "w-36" : "w-56",
                  "rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none",
                  theme === 'dark' ? 'bg-gray-700' : 'bg-white',
                  "right-0"
                )}>
                  <div className="py-1">
                    <button
                      onClick={handleSaveDailyOrders}
                      disabled={loading}
                      className={classNames(
                        "block w-full text-left px-4 py-2 text-sm flex items-center",
                        loading ? 'text-gray-400 cursor-not-allowed' : (theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100')
                      )}
                    >
                      <Save className={isMobile ? "w-4 h-4 mr-2" : "w-5 h-5 mr-2"} />
                      {loading ? 'Guardando...' : 'Guardar Pedidos del Día'}
                    </button>
                    <button
                      onClick={() => handleDeleteDailyOrders()}
                      disabled={loading}
                      className={classNames(
                        "block w-full text-left px-4 py-2 text-sm flex items-center mt-1",
                        loading ? 'text-gray-400 cursor-not-allowed' : (theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100')
                      )}
                    >
                      <Trash2 className={isMobile ? "w-4 h-4 mr-2" : "w-5 h-5 mr-2"} />
                      Eliminar Pedidos del Día
                    </button>
                    <div className="border-t border-gray-600 my-1"></div>
                    <button
                      onClick={() => { setOrdersFilterRange('7_days'); setOrdersCustomStartDate(null); setOrdersCustomEndDate(null); }}
                      className={classNames(
                        "block w-full text-left px-4 py-2 text-sm",
                        theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      Ver últimos 7 días
                    </button>
                    <button
                      onClick={() => { setOrdersFilterRange('30_days'); setOrdersCustomStartDate(null); setOrdersCustomEndDate(null); }}
                      className={classNames(
                        "block w-full text-left px-4 py-2 text-sm",
                        theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      Ver todo el mes
                    </button>
                    <button
                      onClick={() => { setOrdersFilterRange('year'); setOrdersCustomStartDate(null); setOrdersCustomEndDate(null); }}
                      className={classNames(
                        "block w-full text-left px-4 py-2 text-sm",
                        theme === 'dark' ? 'text-gray-200 hover:bg-gray-600' : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      Ver todo el año
                    </button>
                    <div className="border-t border-gray-600 my-1"></div>
                    <div className="px-4 py-2 text-sm font-medium text-gray-400">Filtros personalizados</div>
                    <div className="px-4 py-2">
                      <label className="block text-xs font-medium text-gray-400">Desde:</label>
                      <input
                        type="date"
                        value={ordersCustomStartDate ? ordersCustomStartDate.toISOString().split('T')[0] : ''}
                        onChange={(e) => { setOrdersCustomStartDate(new Date(e.target.value)); setOrdersFilterRange('custom'); }}
                        className={classNames(
                          "mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm",
                          theme === 'dark' ? 'bg-gray-800 text-gray-200 border-gray-600' : 'bg-white text-gray-900 border-gray-300'
                        )}
                      />
                    </div>
                    <div className="px-4 py-2">
                      <label className="block text-xs font-medium text-gray-400">Hasta:</label>
                      <input
                        type="date"
                        value={ordersCustomEndDate ? ordersCustomEndDate.toISOString().split('T')[0] : ''}
                        onChange={(e) => { setOrdersCustomEndDate(new Date(e.target.value)); setOrdersFilterRange('custom'); }}
                        className={classNames(
                          "mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm",
                          theme === 'dark' ? 'bg-gray-800 text-gray-200 border-gray-600' : 'bg-white text-gray-900 border-gray-300'
                        )}
                      />
                    </div>
                  </div>
                </PopoverPanel>
              </Transition>
            </Popover>
          </h3>
          <div className={classNames("w-full", isMobile ? "h-[250px] min-w-[300px]" : "h-[300px] min-w-[400px]")}>
<ResponsiveContainer width="100%" height="100%">
  <BarChart
    data={dailyOrdersChartData}
    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
  >
    <CartesianGrid
      strokeDasharray={isMobile ? "2 2" : "3 3"}
      stroke={theme === 'dark' ? '#4b5563' : '#e5e7eb'}
      fill="none"
      opacity={isMobile ? 0.5 : 1}
    />
    <XAxis dataKey="name" stroke={chartTextColor} tick={{ fill: chartTextColor, fontSize: isMobile ? 7 : 10 }} />
    <YAxis stroke={chartTextColor} tick={{ fill: chartTextColor, fontSize: isMobile ? 7 : 10 }} />
    <Tooltip
      contentStyle={{
        backgroundColor: theme === 'dark' ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        border: 'none',
        borderRadius: '12px',
        fontSize: '12px',
        padding: '8px 12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        backdropFilter: 'blur(5px)',
        touchAction: 'manipulation'
      }}
      labelStyle={{ color: chartTextColor, fontWeight: 'bold', marginBottom: '4px' }}
      itemStyle={{ color: chartTextColor }}
      cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
    />
    <Legend wrapperStyle={{ color: chartTextColor, paddingTop: '10px', fontSize: isMobile ? 8 : 12 }} />
    <Bar
      dataKey="Pedidos"
      fill={BAR_COLORS.Pedidos}
      stroke={BAR_COLORS.Pedidos}
      radius={[10, 10, 0, 0]}
      opacity={1}
      isAnimationActive={false}
      maxBarSize={isMobile ? 12 : 25}
    />
  </BarChart>
</ResponsiveContainer>
          </div>
        </motion.div>
        <motion.div
          className={classNames(
            theme === 'dark' ? 'bg-gray-800' : 'bg-white',
            isMobile ? 'p-4' : 'p-6',
            'rounded-2xl shadow-xl border',
            theme === 'dark' ? 'border-gray-700' : 'border-gray-200',
            'relative min-h-[350px] overflow-x-auto overflow-y-hidden',
            'lg:flex-1'
          )}
          variants={pieChartVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <h3 className="text-xl font-semibold mb-4 text-gray-200 dark:text-gray-100">Estado de Pedidos</h3>
          <div className={classNames("w-full flex justify-center items-center", isMobile ? "h-[250px] min-w-[250px]" : "h-[250px] min-w-[350px]")}>
<ResponsiveContainer width="100%" height="100%">
  <PieChart margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
    <Pie
      data={statusPieChartData}
      cx="50%"
      cy="50%"
      labelLine={false}
      outerRadius={isMobile ? 60 : 100}
      innerRadius={isMobile ? 40 : 70}
      dataKey="value"
      isAnimationActive={false}
      paddingAngle={5}
      cornerRadius={5}
    >
      {statusPieChartData.map((entry, index) => (
        <Cell
          key={`cell-${index}`}
          fill={PIE_COLORS[index % PIE_COLORS.length]}
          stroke={PIE_COLORS[index % PIE_COLORS.length]}
          opacity={1}
          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
        />
      ))}
    </Pie>
    <Tooltip
      contentStyle={{
        backgroundColor: theme === 'dark' ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        border: 'none',
        borderRadius: '12px',
        fontSize: '12px',
        padding: '8px 12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        backdropFilter: 'blur(5px)',
        touchAction: 'manipulation'
      }}
      labelStyle={{ color: chartTextColor, fontWeight: 'bold' }}
      itemStyle={{ color: chartTextColor }}
      formatter={(value, name) => [`${value} Pedidos`, name]}
    />
    <Legend
      wrapperStyle={{ color: chartTextColor, paddingTop: '10px', fontSize: isMobile ? 8 : 12 }}
      layout={isMobile ? "vertical" : "horizontal"}
      align="center"
      itemStyle={{ paddingRight: isMobile ? 5 : 10 }}
    />
    <Label
      value={`${totalOrders} Pedidos`}
      position="center"
      fill={chartTextColor}
      style={{ fontSize: isMobile ? '12px' : '16px', fontWeight: 'bold' }}
    />
  </PieChart>
</ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
});

export default DashboardCharts;