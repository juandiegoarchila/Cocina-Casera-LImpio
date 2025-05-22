import { useState, useEffect, useRef } from 'react';
import { db } from '../../config/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import Chart from 'chart.js/auto';
import { useNavigate } from 'react-router-dom';

const Dashboard = ({ setError, setSuccess, theme }) => {
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [totals, setTotals] = useState({ cash: 0, daviplata: 0, nequi: 0 });
  const [statusCounts, setStatusCounts] = useState({ Pending: 0, Delivered: 0, Cancelled: 0 });
  const [userActivity, setUserActivity] = useState([]);
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const chartRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribeOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);

      const newTotals = { cash: 0, daviplata: 0, nequi: 0 };
      const newStatusCounts = { Pending: 0, Delivered: 0, Cancelled: 0 };
      const dailyOrders = {};

      ordersData.forEach(order => {
        const date = new Date(order.createdAt?.toDate()).toLocaleDateString();
        dailyOrders[date] = (dailyOrders[date] || 0) + 1;

        if (order.payment === 'Efectivo') newTotals.cash += order.total || 0;
        else if (order.payment === 'DaviPlata') newTotals.daviplata += order.total || 0;
        else if (order.payment === 'Nequi') newTotals.nequi += order.total || 0;

        if (order.status === 'Pending') newStatusCounts.Pending += 1;
        else if (order.status === 'Delivered') newStatusCounts.Delivered += 1;
        else if (order.status === 'Cancelled') newStatusCounts.Cancelled += 1;
      });

      setTotals(newTotals);
      setStatusCounts(newStatusCounts);
      setChartData({
        labels: Object.keys(dailyOrders),
        datasets: [{
          label: 'Pedidos Diarios',
          data: Object.values(dailyOrders),
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)',
          borderWidth: 1,
        }],
      });
    }, (error) => setError(`Error al cargar pedidos: ${error.message}`));

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
    }, (error) => setError(`Error al cargar usuarios: ${error.message}`));

    const unsubscribeActivity = onSnapshot(collection(db, 'userActivity'), (snapshot) => {
      const activity = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
      setUserActivity(activity);
    }, (error) => setError(`Error al cargar actividad: ${error.message}`));

    return () => { unsubscribeOrders(); unsubscribeUsers(); unsubscribeActivity(); };
  }, [setError]);

  const recentOrders = orders.slice(0, 5);

  useEffect(() => {
    const ctx = document.getElementById('ordersChart')?.getContext('2d');
    if (ctx) {
      if (chartRef.current) {
        chartRef.current.destroy();
      }

      chartRef.current = new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: {
          scales: { y: { beginAtZero: true } },
          plugins: { legend: { labels: { color: theme === 'dark' ? '#fff' : '#000' } } },
          responsive: true,
          maintainAspectRatio: false,
        },
      });
    }

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [chartData, theme]);

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4">
      <h2 className="text-xl sm:text-2xl font-bold mb-6 text-gray-100">Dashboard</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className={`bg-${theme === 'dark' ? 'gray-800' : 'white'} p-4 sm:p-6 rounded-xl shadow-lg`}>
          <h3 className="text-base sm:text-lg font-semibold mb-4">Resumen de Pedidos</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Total:</span><span>{orders.length}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Pendientes:</span><span className="text-yellow-400">{statusCounts.Pending}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Entregados:</span><span className="text-green-400">{statusCounts.Delivered}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Cancelados:</span><span className="text-red-400">{statusCounts.Cancelled}</span></div>
          </div>
        </div>
        <div className={`bg-${theme === 'dark' ? 'gray-800' : 'white'} p-4 sm:p-6 rounded-xl shadow-lg`}>
          <h3 className="text-base sm:text-lg font-semibold mb-4">Ingresos</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Efectivo:</span><span>${totals.cash.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">DaviPlata:</span><span>${totals.daviplata.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Nequi:</span><span>${totals.nequi.toLocaleString()}</span></div>
          </div>
        </div>
        <div className={`bg-${theme === 'dark' ? 'gray-800' : 'white'} p-4 sm:p-6 rounded-xl shadow-lg`}>
          <h3 className="text-base sm:text-lg font-semibold mb-4">Usuarios</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-400">Total:</span><span>{users.length}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Administradores:</span><span>{users.filter(u => u.role === 2).length}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Clientes:</span><span>{users.filter(u => u.role === 1).length}</span></div>
          </div>
        </div>
        <div className={`bg-${theme === 'dark' ? 'gray-800' : 'white'} p-4 sm:p-6 rounded-xl shadow-lg`}>
          <h3 className="text-base sm:text-lg font-semibold mb-4">Actividad Reciente</h3>
          <div className="space-y-2 text-sm max-h-32 overflow-y-auto">
            {userActivity.map((act, idx) => (
              <div key={idx} className="flex justify-between"><span className="text-gray-400">{act.action}</span><span>{new Date(act.timestamp?.toDate()).toLocaleString()}</span></div>
            ))}
          </div>
        </div>
      </div>

      <div className={`mt-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-4 sm:p-6 rounded-xl shadow-lg`}>
        <h3 className="text-base sm:text-lg font-semibold mb-4">Pedidos Recientes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead><tr className={`bg-${theme === 'dark' ? 'gray-700' : 'gray-300'} text-${theme === 'dark' ? 'gray-300' : 'gray-700'} font-semibold`}><th className="p-2 border-b">Nº</th><th className="p-2 border-b">Bandeja</th><th className="p-2 border-b hidden sm:table-cell">Total</th><th className="p-2 border-b hidden sm:table-cell">Estado</th><th className="p-2 border-b">Acciones</th></tr></thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr><td colSpan="5" className="p-4 text-gray-400 text-center">No hay pedidos recientes.</td></tr>
              ) : (
                recentOrders.map((order, index) => {
                  const bandeja = order.meals?.map(meal => `${meal?.soup || ''} ${meal?.principle || ''} ${meal?.protein || ''}`).join(' | ') || '';
                  return (
                    <tr key={order.id} className={`border-b ${index % 2 === 0 ? 'bg-gray-750' : ''}`}>
                      <td className="p-2 text-gray-300">{recentOrders.length - index}</td>
                      <td className="p-2 text-gray-300 max-w-[120px] sm:max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">{bandeja}</td>
                      <td className="p-2 text-gray-300 hidden sm:table-cell">${order.total?.toLocaleString() || '0'}</td>
                      <td className="p-2 hidden sm:table-cell"><span className={`px-2 py-1 rounded-full text-xs ${order.status === 'Pending' ? 'bg-yellow-600 text-yellow-100' : order.status === 'Delivered' ? 'bg-green-600 text-green-100' : 'bg-gray-600 text-gray-100'}`}>{order.status || 'Pending'}</span></td>
                      <td className="p-2"><button onClick={() => navigate('/admin/orders')} className="text-blue-400 hover:text-blue-300 text-xs sm:text-sm" title="Ver más">Ver más</button></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`mt-6 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} p-4 sm:p-6 rounded-xl shadow-lg`}>
        <h3 className="text-base sm:text-lg font-semibold mb-4">Gráfica de Pedidos</h3>
        <div className="w-full h-64">
          <canvas id="ordersChart" className="w-full h-full"></canvas>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;