import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { collection, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { XMarkIcon } from '@heroicons/react/24/outline';

const UserManagement = ({ setError, setSuccess, theme }) => {
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({ email: '', role: 1, totalOrders: 0 });

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => setError(`Error al cargar usuarios: ${error.message}`));
    return () => unsubscribe();
  }, [setError]);

  const handleEditUser = (user) => { setEditingUser(user); setEditUserForm(user); };
  const handleSaveEdit = async () => { 
    try { 
      await updateDoc(doc(db, 'users', editingUser.id), editUserForm); 
      setEditingUser(null); 
      setSuccess('Usuario actualizado'); 
    } catch (error) { 
      setError(`Error: ${error.message}`); 
    } 
  };
  const handleDeleteUser = async (userId) => { 
    try { 
      await deleteDoc(doc(db, 'users', userId)); 
      setSuccess('Usuario eliminado'); 
    } catch (error) { 
      setError(`Error: ${error.message}`); 
    } 
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4">
      <h2 className="text-xl sm:text-2xl font-bold mb-6 text-gray-100">Gestión de Usuarios</h2>
      <div className={`bg-${theme === 'dark' ? 'gray-800' : 'white'} p-4 sm:p-6 rounded-xl shadow-lg max-h-[70vh] overflow-y-auto custom-scrollbar`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className={`bg-${theme === 'dark' ? 'gray-700' : 'gray-300'} text-${theme === 'dark' ? 'gray-300' : 'gray-700'} font-semibold`}>
                <th className="p-2 border-b">ID</th>
                <th className="p-2 border-b">Email</th>
                <th className="p-2 border-b hidden sm:table-cell">Rol</th>
                <th className="p-2 border-b hidden sm:table-cell">Pedidos</th>
                <th className="p-2 border-b">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan="5" className="p-4 text-gray-400 text-center">No hay usuarios.</td></tr>
              ) : (
                users.map((user, index) => (
                  <tr key={user.id} className={`border-b ${index % 2 === 0 ? 'bg-gray-750' : ''}`}>
                    <td className="p-2 text-gray-300 max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">{user.id}</td>
                    <td className="p-2 text-gray-300 max-w-[150px] sm:max-w-none overflow-hidden text-ellipsis whitespace-nowrap">{user.email || 'N/A'}</td>
                    <td className="p-2 text-gray-300 hidden sm:table-cell">{user.role === 2 ? 'Administrador' : 'Cliente'}</td>
                    <td className="p-2 text-gray-300 hidden sm:table-cell">{user.totalOrders || 0}</td>
                    <td className="p-2">
                      <button onClick={() => handleEditUser(user)} className="text-blue-400 hover:text-blue-300 mr-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button onClick={() => handleDeleteUser(user.id)} className="text-red-400 hover:text-red-300">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4M7 7h10" /></svg>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`bg-${theme === 'dark' ? 'gray-800' : 'white'} p-4 sm:p-6 rounded-xl shadow-lg w-11/12 max-w-md overflow-y-auto max-h-[80vh]`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-100">Editar Usuario</h2>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-200">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
            <label className="block mb-4">
              <span className="text-gray-300 font-medium text-sm">Email:</span>
              <input 
                value={editUserForm.email} 
                onChange={e => setEditUserForm({ ...editUserForm, email: e.target.value })} 
                className={`mt-1 w-full p-2 border rounded text-${theme === 'dark' ? 'white' : 'gray-900'} bg-${theme === 'dark' ? 'gray-700' : 'gray-200'} text-sm`} 
              />
            </label>
            <label className="block mb-4">
              <span className="text-gray-300 font-medium text-sm">Rol:</span>
              <select 
                value={editUserForm.role} 
                onChange={e => setEditUserForm({ ...editUserForm, role: Number(e.target.value) })} 
                className={`mt-1 w-full p-2 border rounded text-${theme === 'dark' ? 'white' : 'gray-900'} bg-${theme === 'dark' ? 'gray-700' : 'gray-200'} text-sm`}
              >
                <option value={1}>Cliente</option>
                <option value={2}>Administrador</option>
              </select>
            </label>
            <label className="block mb-4">
              <span className="text-gray-300 font-medium text-sm">Pedidos:</span>
              <input 
                type="number" 
                value={editUserForm.totalOrders} 
                onChange={e => setEditUserForm({ ...editUserForm, totalOrders: Number(e.target.value) })} 
                className={`mt-1 w-full p-2 border rounded text-${theme === 'dark' ? 'white' : 'gray-900'} bg-${theme === 'dark' ? 'gray-700' : 'gray-200'} text-sm`} 
              />
            </label>
            <div className="flex gap-2">
              <button 
                onClick={handleSaveEdit} 
                className="flex-1 bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg transition-all transform hover:scale-105 text-sm"
              >
                Guardar
              </button>
              <button 
                onClick={() => setEditingUser(null)} 
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

export default UserManagement;