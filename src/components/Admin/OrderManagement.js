import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { ArrowDownTrayIcon, XMarkIcon } from '@heroicons/react/24/outline';

const OrderManagement = ({ setError, setSuccess, theme }) => {
  const [orders, setOrders] = useState([]);
  const [editingOrder, setEditingOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [totals, setTotals] = useState({ cash: 0, daviplata: 0, nequi: 0 });
  const [editForm, setEditForm] = useState({ meals: [], total: 0, status: '', payment: '' });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);
      const newTotals = { cash: 0, daviplata: 0, nequi: 0 };
      ordersData.forEach(order => (order.payment === 'Efectivo' ? newTotals.cash += order.total || 0 : order.payment === 'DaviPlata' ? newTotals.daviplata += order.total || 0 : order.payment === 'Nequi' ? newTotals.nequi += order.total || 0 : null));
      setTotals(newTotals);
    }, (error) => setError(`Error al cargar pedidos: ${error.message}`));
    return () => unsubscribe();
  }, [setError]);

  const handleEditOrder = (order) => { setEditingOrder(order); setEditForm({ meals: order.meals || [], total: order.total || 0, status: order.status || 'Pending', payment: order.payment || 'Efectivo' }); };
  const handleSaveEdit = async () => { try { await updateDoc(doc(db, 'orders', editingOrder.id), { ...editForm, updatedAt: new Date() }); setEditingOrder(null); setSuccess('Pedido actualizado'); } catch (error) { setError(`Error: ${error.message}`); } };
  const handleDeleteOrder = async (orderId) => { try { await deleteDoc(doc(db, 'orders', orderId)); setSuccess('Pedido eliminado'); } catch (error) { setError(`Error: ${error.message}`); } };
  const handleMealChange = (index, field, value) => { const updatedMeals = [...editForm.meals]; updatedMeals[index] = { ...updatedMeals[index], [field]: value }; setEditForm({ ...editForm, meals: updatedMeals }); };
  const exportToCSV = () => { 
    const csv = [['ID', 'Bandeja', 'Dirección', 'Hora', 'Pago', 'Notas', 'Total', 'Estado']].concat(
      orders.map(order => [
        order.id, 
        order.meals?.map(m => `${m.soup} ${m.principle} ${m.protein}`).join(' | '), 
        order.meals?.[0]?.address || '', 
        order.meals?.[0]?.time || '', 
        order.payment || '', 
        order.meals?.[0]?.notes || '', 
        order.total || 0, 
        order.status || 'Pending'
      ])
    ).map(row => row.join(',')).join('\n'); 
    const blob = new Blob([csv], { type: 'text/csv' }); 
    const url = window.URL.createObjectURL(blob); 
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = 'orders.csv'; 
    a.click(); 
  };

  const filteredOrders = orders.filter(order => {
    const idMatch = order.id?.toLowerCase?.().includes(searchTerm.toLowerCase()) || false;
    const mealMatch = order.meals?.some(meal => Object.values(meal).some(val => val?.toString().toLowerCase().includes(searchTerm.toLowerCase()))) || false;
    const statusMatch = order.status?.toLowerCase?.().includes(searchTerm.toLowerCase()) || false;
    const paymentMatch = order.payment?.toLowerCase?.().includes(searchTerm.toLowerCase()) || false;
    return idMatch || mealMatch || statusMatch || paymentMatch;
  });

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-100">Lista de Pedidos</h2>
        <div className="flex gap-2">
          <input 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            placeholder="Buscar..." 
            className={`p-2 rounded-lg border border-${theme === 'dark' ? 'gray-600' : 'gray-300'} focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64 text-${theme === 'dark' ? 'white' : 'gray-900'} bg-${theme === 'dark' ? 'gray-700' : 'white'} text-sm`} 
          />
          <button 
            onClick={exportToCSV} 
            className="bg-blue-600 hover:bg-blue-700 p-2 rounded-lg transition-colors text-sm"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className={`bg-${theme === 'dark' ? 'gray-800' : 'white'} p-4 sm:p-6 rounded-xl shadow-lg max-h-[70vh] overflow-y-auto custom-scrollbar`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className={`bg-${theme === 'dark' ? 'gray-700' : 'gray-300'} text-${theme === 'dark' ? 'gray-300' : 'gray-700'} font-semibold`}>
                <th className="p-2 border-b">Nº</th>
                <th className="p-2 border-b">Bandeja</th>
                <th className="p-2 border-b hidden md:table-cell">Dirección</th>
                <th className="p-2 border-b hidden md:table-cell">Hora</th>
                <th className="p-2 border-b hidden sm:table-cell">Pago</th>
                <th className="p-2 border-b hidden lg:table-cell">Notas</th>
                <th className="p-2 border-b hidden sm:table-cell">Total</th>
                <th className="p-2 border-b hidden sm:table-cell">Estado</th>
                <th className="p-2 border-b">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr><td colSpan="9" className="p-4 text-gray-400 text-center">No hay pedidos.</td></tr>
              ) : (
                filteredOrders.map((order, index) => {
                  const bandeja = order.meals?.map(meal => `${meal?.soup || ''} ${meal?.principle || ''} ${meal?.protein || ''} ${meal?.drink || ''} ${meal?.sides?.join(', ') || ''}`).join(' | ') || '';
                  return (
                    <tr key={order.id} className={`border-b ${index % 2 === 0 ? 'bg-gray-750' : ''}`}>
                      <td className="p-2 text-gray-300">{filteredOrders.length - index}</td>
                      <td className="p-2 text-gray-300 max-w-[120px] sm:max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">{bandeja}</td>
                      <td className="p-2 text-gray-300 hidden md:table-cell">{order.meals?.[0]?.address || ''}</td>
                      <td className="p-2 text-gray-300 hidden md:table-cell">{order.meals?.[0]?.time || ''}</td>
                      <td className="p-2 text-gray-300 hidden sm:table-cell">{order.payment || ''}</td>
                      <td className="p-2 text-gray-300 hidden lg:table-cell">{order.meals?.[0]?.notes || 'N/A'}</td>
                      <td className="p-2 text-gray-300 hidden sm:table-cell">${order.total?.toLocaleString() || '0'}</td>
                      <td className="p-2 hidden sm:table-cell">
                        <span className={`px-2 py-1 rounded-full text-xs ${order.status === 'Pending' ? 'bg-yellow-600 text-yellow-100' : order.status === 'Delivered' ? 'bg-green-600 text-green-100' : 'bg-gray-600 text-gray-100'}`}>
                          {order.status || 'Pending'}
                        </span>
                      </td>
                      <td className="p-2">
                        <button onClick={() => handleEditOrder(order)} className="text-blue-400 hover:text-blue-300 mr-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => handleDeleteOrder(order.id)} className="text-red-400 hover:text-red-300">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4M7 7h10" /></svg>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-4 text-gray-300 text-sm">
        <p>Total Efectivo: ${totals.cash.toLocaleString()}</p>
        <p>Total DaviPlata: ${totals.daviplata.toLocaleString()}</p>
        <p>Total Nequi: ${totals.nequi.toLocaleString()}</p>
      </div>
      {editingOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`bg-${theme === 'dark' ? 'gray-800' : 'white'} p-4 sm:p-6 rounded-xl shadow-lg w-11/12 max-w-md overflow-y-auto max-h-[80vh]`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-100">Editar Pedido</h2>
              <button onClick={() => setEditingOrder(null)} className="text-gray-400 hover:text-gray-200">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            {editForm.meals.map((meal, index) => (
              <div key={index} className="mb-4">
                <h3 className="text-base font-semibold mb-2">Comida ${index + 1}</h3>
                <input 
                  value={meal.soup || ''} 
                  onChange={e => handleMealChange(index, 'soup', e.target.value)} 
                  placeholder="Sopa" 
                  className={`w-full p-2 border rounded mb-2 text-${theme === 'dark' ? 'white' : 'gray-900'} bg-${theme === 'dark' ? 'gray-700' : 'gray-200'} text-sm`} 
                />
                <input 
                  value={meal.principle || ''} 
                  onChange={e => handleMealChange(index, 'principle', e.target.value)} 
                  placeholder="Principio" 
                  className={`w-full p-2 border rounded mb-2 text-${theme === 'dark' ? 'white' : 'gray-900'} bg-${theme === 'dark' ? 'gray-700' : 'gray-200'} text-sm`} 
                />
                <input 
                  value={meal.protein || ''} 
                  onChange={e => handleMealChange(index, 'protein', e.target.value)} 
                  placeholder="Proteína" 
                  className={`w-full p-2 border rounded mb-2 text-${theme === 'dark' ? 'white' : 'gray-900'} bg-${theme === 'dark' ? 'gray-700' : 'gray-200'} text-sm`} 
                />
                <input 
                  value={meal.drink || ''} 
                  onChange={e => handleMealChange(index, 'drink', e.target.value)} 
                  placeholder="Bebida" 
                  className={`w-full p-2 border rounded mb-2 text-${theme === 'dark' ? 'white' : 'gray-900'} bg-${theme === 'dark' ? 'gray-700' : 'gray-200'} text-sm`} 
                />
                <input 
                  value={meal.sides?.join(', ') || ''} 
                  onChange={e => handleMealChange(index, 'sides', e.target.value.split(', '))} 
                  placeholder="Acompañamientos" 
                  className={`w-full p-2 border rounded mb-2 text-${theme === 'dark' ? 'white' : 'gray-900'} bg-${theme === 'dark' ? 'gray-700' : 'gray-200'} text-sm`} 
                />
                <input 
                  value={meal.address || ''} 
                  onChange={e => handleMealChange(index, 'address', e.target.value)} 
                  placeholder="Dirección" 
                  className={`w-full p-2 border rounded mb-2 text-${theme === 'dark' ? 'white' : 'gray-900'} bg-${theme === 'dark' ? 'gray-700' : 'gray-200'} text-sm`} 
                />
                <input 
                  value={meal.time || ''} 
                  onChange={e => handleMealChange(index, 'time', e.target.value)} 
                  placeholder="Hora" 
                  className={`w-full p-2 border rounded mb-2 text-${theme === 'dark' ? 'white' : 'gray-900'} bg-${theme === 'dark' ? 'gray-700' : 'gray-200'} text-sm`} 
                />
                <input 
                  value={meal.notes || ''} 
                  onChange={e => handleMealChange(index, 'notes', e.target.value)} 
                  placeholder="Notas" 
                  className={`w-full p-2 border rounded mb-2 text-${theme === 'dark' ? 'white' : 'gray-900'} bg-${theme === 'dark' ? 'gray-700' : 'gray-200'} text-sm`} 
                />
              </div>
            ))}
            <label className="block mb-4">
              <span className="text-gray-300 font-medium text-sm">Pago:</span>
              <select 
                value={editForm.payment} 
                onChange={e => setEditForm({ ...editForm, payment: e.target.value })} 
                className={`mt-1 w-full p-2 border rounded text-${theme === 'dark' ? 'white' : 'gray-900'} bg-${theme === 'dark' ? 'gray-700' : 'gray-200'} text-sm`}
              >
                <option value="Efectivo">Efectivo</option>
                <option value="DaviPlata">DaviPlata</option>
                <option value="Nequi">Nequi</option>
              </select>
            </label>
            <label className="block mb-4">
              <span className="text-gray-300 font-medium text-sm">Total:</span>
              <input 
                type="number" 
                value={editForm.total} 
                onChange={e => setEditForm({ ...editForm, total: Number(e.target.value) })} 
                className={`mt-1 w-full p-2 border rounded text-${theme === 'dark' ? 'white' : 'gray-900'} bg-${theme === 'dark' ? 'gray-700' : 'gray-200'} text-sm`} 
              />
            </label>
            <label className="block mb-4">
              <span className="text-gray-300 font-medium text-sm">Estado:</span>
              <select 
                value={editForm.status} 
                onChange={e => setEditForm({ ...editForm, status: e.target.value })} 
                className={`mt-1 w-full p-2 border rounded text-${theme === 'dark' ? 'white' : 'gray-900'} bg-${theme === 'dark' ? 'gray-700' : 'gray-200'} text-sm`}
              >
                <option value="Pending">Pendiente</option>
                <option value="Delivered">Entregado</option>
                <option value="Cancelled">Cancelado</option>
              </select>
            </label>
            <div className="flex gap-2">
              <button 
                onClick={handleSaveEdit} 
                className="flex-1 bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition-all transform hover:scale-105 text-sm"
              >
                Guardar
              </button>
              <button 
                onClick={() => setEditingOrder(null)} 
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white p-2 rounded-lg transition-all transform hover:scale-105 text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManagement;