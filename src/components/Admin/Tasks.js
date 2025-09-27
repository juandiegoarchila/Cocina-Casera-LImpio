// src/components/Admin/Tasks.js
import { useState, useEffect } from 'react';
import { db } from '../../config/firebase';
import { doc, setDoc, onSnapshot, collection, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { PlusIcon, TrashIcon, CheckIcon, ClockIcon } from '@heroicons/react/24/outline';

const Tasks = ({ setError, setSuccess, theme, setTheme }) => {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({ title: '', description: '', assignedTo: '', priority: 'media', dueDate: '' });
  const [showAddForm, setShowAddForm] = useState(false);

  // Perfiles disponibles para asignar tareas
  const profiles = [
    { id: 'mesero', name: 'Mesero', color: 'blue' },
    { id: 'cocinera', name: 'Cocinera', color: 'green' },
    { id: 'domiciliario', name: 'Domiciliario', color: 'yellow' },
    { id: 'cajero', name: 'Cajero', color: 'purple' },
    { id: 'limpieza', name: 'Limpieza', color: 'pink' },
    { id: 'todos', name: 'Todos', color: 'gray' }
  ];

  // Cargar tareas desde Firestore
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      const taskList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTasks(taskList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    }, (error) => setError(`Error al cargar tareas: ${error.message}`));
    return () => unsubscribe();
  }, [setError]);

  // Crear nueva tarea
  const handleCreateTask = async () => {
    if (!newTask.title || !newTask.assignedTo) {
      setError('Título y perfil asignado son obligatorios');
      return;
    }
    try {
      await addDoc(collection(db, 'tasks'), {
        ...newTask,
        status: 'pendiente',
        createdAt: new Date(),
        createdBy: 'admin'
      });
      setNewTask({ title: '', description: '', assignedTo: '', priority: 'media', dueDate: '' });
      setShowAddForm(false);
      setSuccess('Tarea creada exitosamente');
    } catch (error) {
      setError(`Error al crear tarea: ${error.message}`);
    }
  };

  // Cambiar estado de tarea
  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: newStatus,
        updatedAt: new Date()
      });
      setSuccess('Estado actualizado');
    } catch (error) {
      setError(`Error al actualizar estado: ${error.message}`);
    }
  };

  // Eliminar tarea
  const handleDeleteTask = async (taskId) => {
    if (window.confirm('¿Estás seguro de eliminar esta tarea?')) {
      try {
        await deleteDoc(doc(db, 'tasks', taskId));
        setSuccess('Tarea eliminada');
      } catch (error) {
        setError(`Error al eliminar tarea: ${error.message}`);
      }
    }
  };

  // Obtener color del perfil
  const getProfileColor = (profileId) => {
    const profile = profiles.find(p => p.id === profileId);
    return profile ? profile.color : 'gray';
  };

  // Obtener nombre del perfil
  const getProfileName = (profileId) => {
    const profile = profiles.find(p => p.id === profileId);
    return profile ? profile.name : profileId;
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-4 sm:py-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-100">📋 Gestión de Tareas</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors text-sm"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Nueva Tarea</span>
        </button>
      </div>

      {/* Formulario para crear nueva tarea */}
      {showAddForm && (
        <div className={`bg-${theme === 'dark' ? 'gray-800' : 'white'} p-4 sm:p-6 rounded-xl shadow-lg mb-6`}>
          <h3 className="text-lg font-semibold mb-4 text-gray-100">Crear Nueva Tarea</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Título *</label>
              <input
                type="text"
                value={newTask.title}
                onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                placeholder="Ej: Limpiar mesas del área principal"
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Asignar a *</label>
              <select
                value={newTask.assignedTo}
                onChange={(e) => setNewTask({...newTask, assignedTo: e.target.value})}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Seleccionar perfil</option>
                {profiles.map(profile => (
                  <option key={profile.id} value={profile.id}>{profile.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Prioridad</label>
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="baja">🟢 Baja</option>
                <option value="media">🟡 Media</option>
                <option value="alta">🔴 Alta</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Fecha límite</label>
              <input
                type="date"
                value={newTask.dueDate}
                onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">Descripción</label>
              <textarea
                value={newTask.description}
                onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                placeholder="Detalles adicionales sobre la tarea..."
                rows="3"
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-4">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateTask}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors text-sm"
            >
              Crear Tarea
            </button>
          </div>
        </div>
      )}

      {/* Lista de tareas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna: Pendientes */}
        <div className={`bg-${theme === 'dark' ? 'gray-800' : 'white'} rounded-xl shadow-lg p-4`}>
          <h3 className="text-lg font-semibold text-red-400 mb-4 flex items-center">
            <ClockIcon className="w-5 h-5 mr-2" />
            Pendientes ({tasks.filter(t => t.status === 'pendiente').length})
          </h3>
          {tasks.filter(t => t.status === 'pendiente').map(task => (
            <TaskCard 
              key={task.id} 
              task={task} 
              onStatusChange={handleStatusChange}
              onDelete={handleDeleteTask}
              getProfileColor={getProfileColor}
              getProfileName={getProfileName}
              theme={theme}
            />
          ))}
        </div>

        {/* Columna: En Progreso */}
        <div className={`bg-${theme === 'dark' ? 'gray-800' : 'white'} rounded-xl shadow-lg p-4`}>
          <h3 className="text-lg font-semibold text-yellow-400 mb-4 flex items-center">
            <ClockIcon className="w-5 h-5 mr-2" />
            En Progreso ({tasks.filter(t => t.status === 'en_progreso').length})
          </h3>
          {tasks.filter(t => t.status === 'en_progreso').map(task => (
            <TaskCard 
              key={task.id} 
              task={task} 
              onStatusChange={handleStatusChange}
              onDelete={handleDeleteTask}
              getProfileColor={getProfileColor}
              getProfileName={getProfileName}
              theme={theme}
            />
          ))}
        </div>

        {/* Columna: Completadas */}
        <div className={`bg-${theme === 'dark' ? 'gray-800' : 'white'} rounded-xl shadow-lg p-4`}>
          <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center">
            <CheckIcon className="w-5 h-5 mr-2" />
            Completadas ({tasks.filter(t => t.status === 'completada').length})
          </h3>
          {tasks.filter(t => t.status === 'completada').map(task => (
            <TaskCard 
              key={task.id} 
              task={task} 
              onStatusChange={handleStatusChange}
              onDelete={handleDeleteTask}
              getProfileColor={getProfileColor}
              getProfileName={getProfileName}
              theme={theme}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Componente para renderizar cada tarea individual
const TaskCard = ({ task, onStatusChange, onDelete, getProfileColor, getProfileName, theme }) => {
  const getPriorityEmoji = (priority) => {
    switch(priority) {
      case 'alta': return '🔴';
      case 'media': return '🟡';
      case 'baja': return '🟢';
      default: return '⚪';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('es-CO');
  };

  const profileColor = getProfileColor(task.assignedTo);
  
  return (
    <div className={`bg-${theme === 'dark' ? 'gray-700' : 'gray-50'} p-4 rounded-lg mb-3 border-l-4 border-${profileColor}-500`}>
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-semibold text-sm text-gray-100">{task.title}</h4>
        <button
          onClick={() => onDelete(task.id)}
          className="text-red-400 hover:text-red-300 p-1"
          title="Eliminar tarea"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>
      
      {task.description && (
        <p className="text-xs text-gray-400 mb-2">{task.description}</p>
      )}
      
      <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
        <span className={`px-2 py-1 rounded-full bg-${profileColor}-100 text-${profileColor}-800`}>
          {getProfileName(task.assignedTo)}
        </span>
        <span>{getPriorityEmoji(task.priority)} {task.priority}</span>
      </div>
      
      {task.dueDate && (
        <p className="text-xs text-yellow-400 mb-2">
          📅 Vence: {formatDate(task.dueDate)}
        </p>
      )}
      
      <div className="flex space-x-1">
        {task.status === 'pendiente' && (
          <button
            onClick={() => onStatusChange(task.id, 'en_progreso')}
            className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-xs transition-colors"
          >
            Iniciar
          </button>
        )}
        {task.status === 'en_progreso' && (
          <>
            <button
              onClick={() => onStatusChange(task.id, 'completada')}
              className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs transition-colors"
            >
              Completar
            </button>
            <button
              onClick={() => onStatusChange(task.id, 'pendiente')}
              className="px-2 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs transition-colors"
            >
              Pausar
            </button>
          </>
        )}
        {task.status === 'completada' && (
          <button
            onClick={() => onStatusChange(task.id, 'pendiente')}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs transition-colors"
          >
            Reabrir
          </button>
        )}
      </div>
      
      <div className="text-xs text-gray-500 mt-2">
        Creada: {formatDate(task.createdAt?.toDate?.() || task.createdAt)}
      </div>
    </div>
  );
};

export default Tasks;