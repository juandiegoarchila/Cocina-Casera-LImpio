// src/components/Admin/Inventory.js
import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../../config/firebase';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  where,
} from 'firebase/firestore';
import { 
  PlusIcon, 
  MagnifyingGlassIcon, 
  PencilSquareIcon, 
  TrashIcon, 
  ArrowDownTrayIcon,
  Squares2X2Icon,
  ListBulletIcon,
  ClockIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';

const defaultItem = {
  name: '',
  category: '',
  provider: '', // proveedor opcional
  quantity: 1, // cantidad recibida
  cost: 0, // costo de compra
  minStock: 0, // stock mínimo
  activatedDate: '', // fecha de llegada del producto
};

const numberOrZero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function Inventory({ setError, setSuccess, theme }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // all, critico, proximo, normal, agotado
  const [sortBy, setSortBy] = useState('name'); // name, duration, cost, quantity, date
  const [sortOrder, setSortOrder] = useState('asc'); // asc, desc
  const [viewMode, setViewMode] = useState('grid'); // grid, list
  const [showModal, setShowModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmData, setConfirmData] = useState({ title: '', message: '', onConfirm: null });
  const [selectedItem, setSelectedItem] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultItem);
  const [exporting, setExporting] = useState(false);
  const [itemHistory, setItemHistory] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'inventory'), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setItems(list);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError && setError('Error cargando inventario');
      setLoading(false);
    });
    return () => unsub();
  }, [setError]);

  // Función para calcular diferencia de días
  const diffDays = (from) => {
    if (!from) return 0;
    try {
      const d = typeof from.toDate === 'function' ? from.toDate() : new Date(from);
      const now = new Date();
      return Math.max(0, Math.round((now.getTime() - d.getTime()) / 86400000));
    } catch {
      return 0;
    }
  };

  const categories = useMemo(() => {
    const set = new Set(items.map(i => (i.category || '').trim()).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [items]);

  // Función para determinar estado de alerta por duración
  const getAlertStatus = (item) => {
    const isActive = (item.status || 'activo') === 'activo';
    if (!isActive) return 'agotado';
    
    const days = diffDays(item.activatedAt);
    const avg = Number(item.avgDurationDays || 0);
    
    if (avg === 0) return 'normal';
    
    const remaining = Math.max(0, avg - days);
    
    if (remaining <= 2) return 'critico'; // 0-2 días
    if (remaining <= 5) return 'proximo'; // 3-5 días
    return 'normal'; // >5 días
  };

  // Función para obtener color según estado
  const getStatusColor = (status) => {
    switch(status) {
      case 'critico': return 'border-red-500 bg-red-50 dark:bg-red-950';
      case 'proximo': return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950';
      case 'normal': return 'border-green-500 bg-green-50 dark:bg-green-950';
      case 'agotado': return 'border-gray-500 bg-gray-50 dark:bg-gray-950';
      default: return 'border-gray-500 bg-gray-50 dark:bg-gray-950';
    }
  };

  // Función para obtener color del indicador (punto)
  const getIndicatorColor = (status) => {
    switch(status) {
      case 'critico': return 'bg-red-500';
      case 'proximo': return 'bg-yellow-500';
      case 'normal': return 'bg-green-500';
      case 'agotado': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  // Función para obtener color de la barra de progreso
  const getProgressBarColor = (status) => {
    switch(status) {
      case 'critico': return 'bg-red-500';
      case 'proximo': return 'bg-yellow-500';
      case 'normal': return 'bg-green-500';
      case 'agotado': return 'bg-gray-500';
      default: return 'bg-indigo-500';
    }
  };

  // Función para calcular fecha estimada de agotamiento
  const getEstimatedExhaustDate = (item) => {
    const isActive = (item.status || 'activo') === 'activo';
    if (!isActive) return null;
    
    const avg = Number(item.avgDurationDays || 0);
    if (avg === 0) return null;
    
    const activatedDate = item.activatedAt 
      ? (typeof item.activatedAt.toDate === 'function' ? item.activatedAt.toDate() : new Date(item.activatedAt))
      : new Date();
    
    const exhaustDate = new Date(activatedDate.getTime() + (avg * 86400000));
    return exhaustDate;
  };

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let result = items.filter(i => {
      const matchesTerm = !term || `${i.name}`.toLowerCase().includes(term);
      const matchesCat = categoryFilter === 'all' || (i.category || '') === categoryFilter;
      
      // Filtro por estado
      const alertStatus = getAlertStatus(i);
      const matchesStatus = statusFilter === 'all' || alertStatus === statusFilter;
      
      return matchesTerm && matchesCat && matchesStatus;
    });

    // Ordenamiento
    result.sort((a, b) => {
      let comparison = 0;
      
      switch(sortBy) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'duration':
          comparison = diffDays(a.activatedAt) - diffDays(b.activatedAt);
          break;
        case 'cost':
          comparison = numberOrZero(a.cost) - numberOrZero(b.cost);
          break;
        case 'quantity':
          comparison = numberOrZero(a.quantity) - numberOrZero(b.quantity);
          break;
        case 'date':
          const dateA = a.activatedAt ? (typeof a.activatedAt.toDate === 'function' ? a.activatedAt.toDate() : new Date(a.activatedAt)) : new Date(0);
          const dateB = b.activatedAt ? (typeof b.activatedAt.toDate === 'function' ? b.activatedAt.toDate() : new Date(b.activatedAt)) : new Date(0);
          comparison = dateA.getTime() - dateB.getTime();
          break;
        default:
          comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [items, search, categoryFilter, statusFilter, sortBy, sortOrder]);

  const activos = useMemo(() => items.filter(i => (i.status || 'activo') === 'activo').length, [items]);
  const agotados = useMemo(() => items.filter(i => i.status === 'agotado').length, [items]);
  const criticos = useMemo(() => items.filter(i => getAlertStatus(i) === 'critico').length, [items]);
  const proximos = useMemo(() => items.filter(i => getAlertStatus(i) === 'proximo').length, [items]);
  const promedioGlobal = useMemo(() => {
    const all = items.flatMap(i => Array.isArray(i.durations) ? i.durations : []);
    if (!all.length) return 0;
    return Math.round(all.reduce((a,b)=>a+Number(b||0),0) / all.length);
  }, [items]);

  // Estadísticas
  const stats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 86400000);
    const monthAgo = new Date(today.getTime() - 30 * 86400000);

    const reposiciones = items.flatMap(i => {
      const durations = Array.isArray(i.durations) ? i.durations : [];
      return durations.map((_, idx) => ({
        date: i.activatedAt ? (typeof i.activatedAt.toDate === 'function' ? i.activatedAt.toDate() : new Date(i.activatedAt)) : new Date(),
        cost: numberOrZero(i.cost),
        item: i.name,
      }));
    });

    const totalGastadoHoy = reposiciones
      .filter(r => r.date >= today)
      .reduce((sum, r) => sum + r.cost, 0);

    const totalGastadoSemana = reposiciones
      .filter(r => r.date >= weekAgo)
      .reduce((sum, r) => sum + r.cost, 0);

    const totalGastadoMes = reposiciones
      .filter(r => r.date >= monthAgo)
      .reduce((sum, r) => sum + r.cost, 0);

    const itemsMasDuraderos = [...items]
      .filter(i => i.avgDurationDays > 0)
      .sort((a, b) => (b.avgDurationDays || 0) - (a.avgDurationDays || 0))
      .slice(0, 5);

    const itemsMenosDuraderos = [...items]
      .filter(i => i.avgDurationDays > 0)
      .sort((a, b) => (a.avgDurationDays || 0) - (b.avgDurationDays || 0))
      .slice(0, 5);

    const proveedoresCount = {};
    items.forEach(i => {
      const prov = (i.provider || '').trim();
      if (prov) {
        proveedoresCount[prov] = (proveedoresCount[prov] || 0) + 1;
      }
    });

    const proveedoresMasUsados = Object.entries(proveedoresCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      totalGastadoHoy,
      totalGastadoSemana,
      totalGastadoMes,
      itemsMasDuraderos,
      itemsMenosDuraderos,
      proveedoresMasUsados,
    };
  }, [items]);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultItem);
    setShowModal(true);
  };
  
  const openEdit = (item) => {
    setEditing(item);
    
    // Convertir la fecha de activación a formato YYYY-MM-DD para el input
    let activatedDateStr = '';
    if (item.activatedAt) {
      const date = typeof item.activatedAt.toDate === 'function' ? item.activatedAt.toDate() : new Date(item.activatedAt);
      activatedDateStr = date.toISOString().slice(0, 10);
    }
    
    setForm({
      name: item.name || '',
      category: item.category || '',
      provider: item.provider || '',
      quantity: numberOrZero(item.quantity) || 1,
      cost: numberOrZero(item.cost),
      minStock: numberOrZero(item.minStock) || 0,
      activatedDate: activatedDateStr,
    });
    setShowModal(true);
  };

  const openHistory = async (item) => {
    setSelectedItem(item);
    setShowHistory(true);
    
    // Cargar historial de movimientos (simulado con durations)
    const history = (Array.isArray(item.durations) ? item.durations : []).map((duration, idx) => ({
      id: idx,
      action: idx === item.durations.length - 1 ? 'Agotado' : 'Repuesto',
      duration,
      date: new Date(Date.now() - (item.durations.length - idx) * 86400000 * duration),
    }));
    setItemHistory(history);
  };

  const saveItem = async (e) => {
    e && e.preventDefault();
    try {
      const payload = {
        name: (form.name || '').trim(),
        category: (form.category || '').trim(),
        provider: (form.provider || '').trim(),
        quantity: numberOrZero(form.quantity) || 1,
        cost: numberOrZero(form.cost) || 0,
        minStock: numberOrZero(form.minStock) || 0,
        updatedAt: serverTimestamp(),
      };
      
      // Si hay fecha de activación personalizada, convertirla a timestamp
      if (form.activatedDate && editing) {
        const customDate = new Date(form.activatedDate + 'T00:00:00');
        payload.activatedAt = customDate;
      }
      
      if (editing) {
        await updateDoc(doc(db, 'inventory', editing.id), payload);
        setSuccess && setSuccess('Ítem actualizado');
      } else {
        // Para nuevos items, usar la fecha personalizada o la actual
        const activatedAt = form.activatedDate 
          ? new Date(form.activatedDate + 'T00:00:00')
          : serverTimestamp();
          
        await addDoc(collection(db, 'inventory'), {
          ...payload,
          status: 'activo',
          activatedAt,
          createdAt: serverTimestamp(),
          durations: [],
          costHistory: [{ cost: payload.cost, date: serverTimestamp() }],
        });
        setSuccess && setSuccess('Ítem creado');
      }
      setShowModal(false);
    } catch (err) {
      console.error(err);
      setError && setError('No se pudo guardar el ítem');
    }
  };

  const removeItem = async (id) => {
    setConfirmData({
      title: '¿Eliminar producto?',
      message: 'Esta acción no se puede deshacer.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'inventory', id));
          setSuccess && setSuccess('Ítem eliminado');
        } catch (err) {
          console.error(err);
          setError && setError('No se pudo eliminar');
        }
      }
    });
    setShowConfirm(true);
  };

  const markAgotado = async (item) => {
    setConfirmData({
      title: `¿Marcar como agotado?`,
      message: `"${item.name}" se marcará como agotado y se registrará su duración.`,
      onConfirm: async () => {
        try {
          const days = diffDays(item.activatedAt);
          const prev = Array.isArray(item.durations) ? item.durations.slice() : [];
          const durations = [...prev, days];
          const avg = durations.length ? Math.round(durations.reduce((a,b)=>a+Number(b||0),0)/durations.length) : days;
          await updateDoc(doc(db, 'inventory', item.id), {
            status: 'agotado',
            exhaustedAt: serverTimestamp(),
            lastDurationDays: days,
            avgDurationDays: avg,
            durations,
            updatedAt: serverTimestamp(),
          });
          setSuccess && setSuccess('Marcado como agotado');
        } catch (err) {
          console.error(err);
          setError && setError('No se pudo marcar como agotado');
        }
      }
    });
    setShowConfirm(true);
  };

  const reponer = async (item) => {
    setConfirmData({
      title: `¿Reponer producto?`,
      message: `"${item.name}" se marcará como activo nuevamente.`,
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'inventory', item.id), {
            status: 'activo',
            activatedAt: serverTimestamp(),
            exhaustedAt: null,
            updatedAt: serverTimestamp(),
          });
          setSuccess && setSuccess('Producto repuesto');
        } catch (err) {
          console.error(err);
          setError && setError('No se pudo reponer el producto');
        }
      }
    });
    setShowConfirm(true);
  };

  const exportCSV = async () => {
    try {
      setExporting(true);
      const headers = ['Nombre','Categoría','Proveedor','Cantidad','Costo','Estado','Creado','Última duración (d)','Promedio (d)','Registros','Stock mínimo','Fecha agotamiento estimada'];
      const lines = filtered.map(i => {
        const exhaustDate = getEstimatedExhaustDate(i);
        return [
          i.name,
          i.category,
          i.provider || '',
          numberOrZero(i.quantity),
          numberOrZero(i.cost),
          i.status || 'activo',
          i.activatedAt ? (typeof i.activatedAt.toDate==='function' ? i.activatedAt.toDate() : new Date(i.activatedAt)).toISOString().slice(0,10) : '',
          i.lastDurationDays || '',
          i.avgDurationDays || '',
          Array.isArray(i.durations) ? i.durations.length : 0,
          i.minStock || 0,
          exhaustDate ? exhaustDate.toISOString().slice(0,10) : '',
        ];
      });
      const csv = [headers, ...lines].map(r => r.map(v => `"${(v ?? '').toString().replace(/"/g,'\"')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventario_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess && setSuccess('Inventario exportado');
    } catch (err) {
      console.error(err);
      setError && setError('No se pudo exportar');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xl sm:text-2xl font-bold">Inventario</h2>
          <div className="flex items-center gap-2">
            {/* Toggle vista */}
            <div className={`flex rounded-lg border ${theme==='dark'?'border-gray-600':'border-gray-300'}`}>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-l-lg ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : theme==='dark'?'bg-gray-700 text-gray-300':'bg-white text-gray-600'}`}
                title="Vista de tarjetas"
              >
                <Squares2X2Icon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-r-lg ${viewMode === 'list' ? 'bg-indigo-600 text-white' : theme==='dark'?'bg-gray-700 text-gray-300':'bg-white text-gray-600'}`}
                title="Vista de lista"
              >
                <ListBulletIcon className="w-5 h-5" />
              </button>
            </div>
            
            <button
              onClick={() => setShowStats(true)}
              title="Ver estadísticas"
              className={`p-2 rounded-lg border ${theme==='dark'?'bg-gray-700 text-white border-gray-600 hover:bg-gray-600':'bg-white text-gray-800 border-gray-300 hover:bg-gray-100'}`}
            >
              <ChartBarIcon className="w-5 h-5" />
            </button>
            <button
              onClick={exportCSV}
              disabled={exporting}
              title="Exportar a Excel"
              className={`p-2 rounded-lg border ${theme==='dark'?'bg-gray-700 text-white border-gray-600 hover:bg-gray-600':'bg-white text-gray-800 border-gray-300 hover:bg-gray-100'}`}
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
            </button>
            <button
              onClick={openCreate}
              title="Nuevo ítem"
              className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <PlusIcon className="w-5 h-5"/>
            </button>
          </div>
        </div>

        {/* Alertas rápidas */}
        {(criticos > 0 || proximos > 0) && (
          <div className="flex gap-2 flex-wrap">
            {criticos > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm">
                <ExclamationTriangleIcon className="w-5 h-5" />
                <span className="font-semibold">{criticos}</span> crítico{criticos !== 1 ? 's' : ''} (0-2 días)
              </div>
            )}
            {proximos > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500 rounded-lg text-yellow-500 text-sm">
                <ClockIcon className="w-5 h-5" />
                <span className="font-semibold">{proximos}</span> próximo{proximos !== 1 ? 's' : ''} a agotar (3-5 días)
              </div>
            )}
          </div>
        )}

        {/* Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <div className="relative">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"/>
            <input
              value={search}
              onChange={(e)=>setSearch(e.target.value)}
              placeholder="Buscar por nombre..."
              className={`w-full pl-10 pr-3 py-2 rounded-lg border shadow-sm ${theme==='dark'?'bg-gray-800 border-gray-700 text-white placeholder-gray-400':'bg-white border-gray-300 text-gray-800 placeholder-gray-500'}`}
            />
          </div>
          
          <select
            value={categoryFilter}
            onChange={(e)=>setCategoryFilter(e.target.value)}
            className={`w-full px-3 py-2 rounded-lg border shadow-sm ${theme==='dark'?'bg-gray-800 border-gray-700 text-white':'bg-white border-gray-300 text-gray-800'}`}
          >
            {categories.map(c => (
              <option key={c} value={c}>{c === 'all' ? 'Todas las categorías' : c}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e)=>setStatusFilter(e.target.value)}
            className={`w-full px-3 py-2 rounded-lg border shadow-sm ${theme==='dark'?'bg-gray-800 border-gray-700 text-white':'bg-white border-gray-300 text-gray-800'}`}
          >
            <option value="all">Todos los estados</option>
            <option value="critico">🔴 Críticos (0-2 días)</option>
            <option value="proximo">🟡 Próximos (3-5 días)</option>
            <option value="normal">🟢 Normales (&gt;5 días)</option>
            <option value="agotado">⚫ Agotados</option>
          </select>

          <div className="flex gap-2">
            <select
              value={sortBy}
              onChange={(e)=>setSortBy(e.target.value)}
              className={`flex-1 px-3 py-2 rounded-lg border shadow-sm ${theme==='dark'?'bg-gray-800 border-gray-700 text-white':'bg-white border-gray-300 text-gray-800'}`}
            >
              <option value="name">Nombre</option>
              <option value="duration">Duración</option>
              <option value="cost">Costo</option>
              <option value="quantity">Cantidad</option>
              <option value="date">Fecha creación</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className={`px-3 py-2 rounded-lg border ${theme==='dark'?'bg-gray-800 border-gray-700 text-white':'bg-white border-gray-300 text-gray-800'}`}
              title={sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
      </div>

      {/* Lista de items */}
      <div className={`max-h-[70vh] overflow-auto custom-scrollbar bg-transparent shadow-none`}>
        {loading ? (
          <div className="p-6 text-center">Cargando inventario...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-gray-500">Sin resultados</div>
        ) : viewMode === 'grid' ? (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(item => {
              const isActive = (item.status || 'activo') === 'activo';
              const days = diffDays(item.activatedAt);
              const avg = Number(item.avgDurationDays || 0);
              const percent = avg > 0 ? Math.min(100, Math.round((days / avg) * 100)) : 0;
              const diff = avg > 0 ? (days - avg) : 0;
              const showDelta = avg > 0 && diff !== 0;
              const absDiff = Math.abs(diff);
              const alertStatus = getAlertStatus(item);
              const statusColor = getStatusColor(alertStatus);
              const indicatorColor = getIndicatorColor(alertStatus);
              const progressColor = getProgressBarColor(alertStatus);
              const exhaustDate = getEstimatedExhaustDate(item);
              
              return (
                <div key={item.id} className={`rounded-xl shadow p-4 ${statusColor} ${theme==='dark'?'text-white':'text-gray-900'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">{item.category || 'Sin categoría'}</div>
                      <div className="text-lg font-bold text-gray-900 dark:text-white">{item.name}</div>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${indicatorColor} ml-2 mt-1`} title={alertStatus} />
                  </div>
                  
                  <div className="mt-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                    Creado: {item.activatedAt ? (typeof item.activatedAt.toDate==='function' ? item.activatedAt.toDate() : new Date(item.activatedAt)).toLocaleDateString('es-CO') : '—'}
                  </div>
                  
                  {exhaustDate && isActive && (
                    <div className={`mt-1 text-xs font-bold ${alertStatus === 'critico' ? 'text-red-700 dark:text-red-400' : alertStatus === 'proximo' ? 'text-yellow-700 dark:text-yellow-400' : 'text-green-700 dark:text-green-400'}`}>
                      Est. agotamiento: {exhaustDate.toLocaleDateString('es-CO')}
                    </div>
                  )}
                  
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-gray-700 dark:text-gray-300">Duración</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{days} d</span>
                    </div>
                    <div className={`${theme==='dark'?'bg-gray-700':'bg-gray-200'} w-full h-2 rounded-full overflow-hidden`}>
                      <div className={`h-2 ${progressColor}`} style={{ width: `${percent}%` }} />
                    </div>
                    {showDelta && (
                      <div className={`mt-1 text-xs font-bold ${diff > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                        {absDiff} {absDiff === 1 ? 'día' : 'días'} {diff > 0 ? 'más' : 'menos'} que el promedio
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                    {item.provider && (
                      <div className="col-span-2">Proveedor: <span className="font-bold text-gray-900 dark:text-white">{item.provider}</span></div>
                    )}
                    <div>Cantidad: <span className="font-bold text-gray-900 dark:text-white">{numberOrZero(item.quantity) || 1}</span></div>
                    <div>Costo: <span className="font-bold text-gray-900 dark:text-white">${numberOrZero(item.cost).toLocaleString('es-CO')}</span></div>
                    {item.minStock > 0 && (
                      <div className="col-span-2">Stock mín: <span className={`font-bold ${numberOrZero(item.quantity) <= item.minStock ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{item.minStock}</span></div>
                    )}
                    {Array.isArray(item.durations) && item.durations.length>0 && (
                      <div className="col-span-2">Última duración: <span className="font-bold text-gray-900 dark:text-white">{item.lastDurationDays} días</span> ({item.durations.length} registros)</div>
                    )}
                  </div>
                  
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => openEdit(item)}
                      title="Editar"
                      className="p-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      title="Eliminar"
                      className="p-2 rounded bg-red-600 hover:bg-red-700 text-white text-xs"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openHistory(item)}
                      title="Ver historial"
                      className="p-2 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs"
                    >
                      <DocumentTextIcon className="w-4 h-4" />
                    </button>
                    {isActive ? (
                      <button onClick={()=>markAgotado(item)} className="flex-1 px-3 py-1.5 rounded bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium">Marcar agotado</button>
                    ) : (
                      <button onClick={()=>reponer(item)} className="flex-1 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium">Reponer</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Vista de lista */
          <div className="overflow-x-auto">
            <table className={`w-full ${theme==='dark'?'text-white':'text-gray-900'}`}>
              <thead className={`${theme==='dark'?'bg-gray-800':'bg-gray-100'} sticky top-0`}>
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Estado</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Nombre</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Categoría</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Proveedor</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">Duración</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">Cantidad</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">Costo</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const isActive = (item.status || 'activo') === 'activo';
                  const days = diffDays(item.activatedAt);
                  const alertStatus = getAlertStatus(item);
                  const indicatorColor = getIndicatorColor(alertStatus);
                  
                  return (
                    <tr key={item.id} className={`${idx % 2 === 0 ? (theme==='dark'?'bg-gray-900':'bg-white') : (theme==='dark'?'bg-gray-800':'bg-gray-50')} border-b ${theme==='dark'?'border-gray-700':'border-gray-200'}`}>
                      <td className="px-3 py-2">
                        <div className={`w-3 h-3 rounded-full ${indicatorColor}`} title={alertStatus} />
                      </td>
                      <td className="px-3 py-2 font-medium">{item.name}</td>
                      <td className="px-3 py-2 text-sm text-gray-400">{item.category || '—'}</td>
                      <td className="px-3 py-2 text-sm text-gray-400">{item.provider || '—'}</td>
                      <td className="px-3 py-2 text-right text-sm">{days} d</td>
                      <td className="px-3 py-2 text-right text-sm">{numberOrZero(item.quantity)}</td>
                      <td className="px-3 py-2 text-right text-sm">${numberOrZero(item.cost).toLocaleString('es-CO')}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(item)} title="Editar" className="p-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white">
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => removeItem(item.id)} title="Eliminar" className="p-1.5 rounded bg-red-600 hover:bg-red-700 text-white">
                            <TrashIcon className="w-4 h-4" />
                          </button>
                          <button onClick={() => openHistory(item)} title="Historial" className="p-1.5 rounded bg-purple-600 hover:bg-purple-700 text-white">
                            <DocumentTextIcon className="w-4 h-4" />
                          </button>
                          {isActive ? (
                            <button onClick={()=>markAgotado(item)} className="px-2 py-1 rounded bg-orange-600 hover:bg-orange-700 text-white text-xs">Agotar</button>
                          ) : (
                            <button onClick={()=>reponer(item)} className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs">Reponer</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de edición/creación */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10001] p-4" onClick={()=>setShowModal(false)}>
          <div className={`${theme==='dark'?'bg-gray-800 text-white':'bg-white text-gray-900'} rounded-xl shadow-xl w-full max-w-lg p-6`} onClick={(e)=>e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">{editing ? 'Editar producto' : 'Nuevo producto'}</h3>
            <form onSubmit={saveItem} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm">
                  Nombre del producto <span className="text-red-500">*</span>
                  <input 
                    required 
                    value={form.name} 
                    onChange={e=>setForm({...form, name:e.target.value})} 
                    className={`mt-1 w-full px-3 py-2 rounded border ${theme==='dark'?'bg-gray-900 border-gray-700':'bg-white border-gray-300'}`}
                  />
                </label>
                
                <label className="text-sm">
                  Categoría
                  <input 
                    value={form.category} 
                    onChange={e=>setForm({...form, category:e.target.value})} 
                    placeholder="cocina, salón, etc."
                    className={`mt-1 w-full px-3 py-2 rounded border ${theme==='dark'?'bg-gray-900 border-gray-700':'bg-white border-gray-300'}`}
                  />
                </label>
                
                <label className="text-sm">
                  Proveedor
                  <input 
                    value={form.provider || ''} 
                    onChange={e=>setForm({...form, provider:e.target.value})} 
                    placeholder="Nombre o contacto" 
                    className={`mt-1 w-full px-3 py-2 rounded border ${theme==='dark'?'bg-gray-900 border-gray-700':'bg-white border-gray-300'}`}
                  />
                </label>
                
                <label className="text-sm">
                  Fecha de llegada {!editing && <span className="text-red-500">*</span>}
                  <input 
                    type="date" 
                    required={!editing}
                    value={form.activatedDate} 
                    onChange={e=>setForm({...form, activatedDate:e.target.value})} 
                    max={new Date().toISOString().slice(0, 10)}
                    className={`mt-1 w-full px-3 py-2 rounded border ${theme==='dark'?'bg-gray-900 border-gray-700':'bg-white border-gray-300'}`}
                  />
                  <span className="text-xs text-gray-400 mt-1 block">
                    {editing ? 'Dejar vacío para mantener fecha actual' : 'Fecha en que llegó el producto'}
                  </span>
                </label>
                
                <label className="text-sm">
                  Cantidad (unidades)
                  <input 
                    type="number" 
                    min="0" 
                    step="1"
                    value={form.quantity} 
                    onChange={e=>setForm({...form, quantity:e.target.value})} 
                    className={`mt-1 w-full px-3 py-2 rounded border ${theme==='dark'?'bg-gray-900 border-gray-700':'bg-white border-gray-300'}`}
                  />
                </label>
                
                <label className="text-sm">
                  Costo del producto
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    value={form.cost} 
                    onChange={e=>setForm({...form, cost:e.target.value})} 
                    className={`mt-1 w-full px-3 py-2 rounded border ${theme==='dark'?'bg-gray-900 border-gray-700':'bg-white border-gray-300'}`}
                  />
                </label>
                
                <label className="text-sm">
                  Stock mínimo (alerta)
                  <input 
                    type="number" 
                    min="0" 
                    step="1"
                    value={form.minStock} 
                    onChange={e=>setForm({...form, minStock:e.target.value})} 
                    placeholder="0"
                    className={`mt-1 w-full px-3 py-2 rounded border ${theme==='dark'?'bg-gray-900 border-gray-700':'bg-white border-gray-300'}`}
                  />
                </label>
              </div>
              
              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={()=>setShowModal(false)} 
                  className={`px-4 py-2 rounded border ${theme==='dark'?'border-gray-600 hover:bg-gray-700':'border-gray-300 hover:bg-gray-100'}`}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de historial */}
      {showHistory && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10001] p-4" onClick={()=>setShowHistory(false)}>
          <div className={`${theme==='dark'?'bg-gray-800 text-white':'bg-white text-gray-900'} rounded-xl shadow-xl w-full max-w-2xl p-6`} onClick={(e)=>e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Historial: {selectedItem.name}</h3>
            
            <div className="space-y-4">
              {/* Info del item */}
              <div className={`p-4 rounded-lg ${theme==='dark'?'bg-gray-900':'bg-gray-100'}`}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <div className="text-gray-400">Categoría</div>
                    <div className="font-semibold">{selectedItem.category || '—'}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Proveedor</div>
                    <div className="font-semibold">{selectedItem.provider || '—'}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Cantidad</div>
                    <div className="font-semibold">{selectedItem.quantity}</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Costo actual</div>
                    <div className="font-semibold">${numberOrZero(selectedItem.cost).toLocaleString('es-CO')}</div>
                  </div>
                </div>
              </div>

              {/* Historial de costos */}
              {Array.isArray(selectedItem.costHistory) && selectedItem.costHistory.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Historial de costos</h4>
                  <div className={`max-h-40 overflow-auto rounded-lg ${theme==='dark'?'bg-gray-900':'bg-gray-100'} p-3`}>
                    {selectedItem.costHistory.map((entry, idx) => (
                      <div key={idx} className="flex justify-between text-sm py-1">
                        <span>${numberOrZero(entry.cost).toLocaleString('es-CO')}</span>
                        <span className="text-gray-400">
                          {entry.date ? (typeof entry.date.toDate === 'function' ? entry.date.toDate() : new Date(entry.date)).toLocaleDateString('es-CO') : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Historial de duraciones */}
              <div>
                <h4 className="font-semibold mb-2">Historial de movimientos</h4>
                {itemHistory.length > 0 ? (
                  <div className={`max-h-60 overflow-auto rounded-lg ${theme==='dark'?'bg-gray-900':'bg-gray-100'} p-3`}>
                    {itemHistory.map((entry) => (
                      <div key={entry.id} className="flex justify-between items-center text-sm py-2 border-b border-gray-700 last:border-0">
                        <div>
                          <span className="font-semibold">{entry.action}</span>
                          <span className="text-gray-400 ml-2">({entry.duration} días)</span>
                        </div>
                        <span className="text-gray-400 text-xs">
                          {entry.date.toLocaleDateString('es-CO')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-4">Sin movimientos registrados</div>
                )}
              </div>

              {/* Estadísticas del item */}
              <div className={`p-4 rounded-lg ${theme==='dark'?'bg-gray-900':'bg-gray-100'}`}>
                <div className="grid grid-cols-3 gap-3 text-sm text-center">
                  <div>
                    <div className="text-gray-400">Promedio</div>
                    <div className="font-bold text-lg">{selectedItem.avgDurationDays || 0} días</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Última</div>
                    <div className="font-bold text-lg">{selectedItem.lastDurationDays || 0} días</div>
                  </div>
                  <div>
                    <div className="text-gray-400">Registros</div>
                    <div className="font-bold text-lg">{Array.isArray(selectedItem.durations) ? selectedItem.durations.length : 0}</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-4">
              <button 
                onClick={()=>setShowHistory(false)} 
                className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de estadísticas */}
      {showStats && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10001] p-4" onClick={()=>setShowStats(false)}>
          <div className={`${theme==='dark'?'bg-gray-800 text-white':'bg-white text-gray-900'} rounded-xl shadow-xl w-full max-w-4xl p-6 max-h-[90vh] overflow-auto`} onClick={(e)=>e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">Reportes y Estadísticas</h3>
            
            <div className="space-y-6">
              {/* Resumen de gastos */}
              <div>
                <h4 className="font-semibold mb-3">Gastos en reposiciones</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className={`p-4 rounded-lg ${theme==='dark'?'bg-gray-900':'bg-gray-100'}`}>
                    <div className="text-gray-400 text-sm">Hoy</div>
                    <div className="text-2xl font-bold text-green-500">${stats.totalGastadoHoy.toLocaleString('es-CO')}</div>
                  </div>
                  <div className={`p-4 rounded-lg ${theme==='dark'?'bg-gray-900':'bg-gray-100'}`}>
                    <div className="text-gray-400 text-sm">Últimos 7 días</div>
                    <div className="text-2xl font-bold text-blue-500">${stats.totalGastadoSemana.toLocaleString('es-CO')}</div>
                  </div>
                  <div className={`p-4 rounded-lg ${theme==='dark'?'bg-gray-900':'bg-gray-100'}`}>
                    <div className="text-gray-400 text-sm">Últimos 30 días</div>
                    <div className="text-2xl font-bold text-purple-500">${stats.totalGastadoMes.toLocaleString('es-CO')}</div>
                  </div>
                </div>
              </div>

              {/* Items más/menos duraderos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-3">Top 5 más duraderos</h4>
                  <div className={`rounded-lg ${theme==='dark'?'bg-gray-900':'bg-gray-100'} p-3 space-y-2`}>
                    {stats.itemsMasDuraderos.length > 0 ? stats.itemsMasDuraderos.map((item, idx) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="font-medium">{idx + 1}. {item.name}</span>
                        <span className="text-green-500">{item.avgDurationDays} días</span>
                      </div>
                    )) : <div className="text-gray-400 text-center py-2">Sin datos</div>}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-3">Top 5 menos duraderos</h4>
                  <div className={`rounded-lg ${theme==='dark'?'bg-gray-900':'bg-gray-100'} p-3 space-y-2`}>
                    {stats.itemsMenosDuraderos.length > 0 ? stats.itemsMenosDuraderos.map((item, idx) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="font-medium">{idx + 1}. {item.name}</span>
                        <span className="text-red-500">{item.avgDurationDays} días</span>
                      </div>
                    )) : <div className="text-gray-400 text-center py-2">Sin datos</div>}
                  </div>
                </div>
              </div>

              {/* Proveedores más usados */}
              <div>
                <h4 className="font-semibold mb-3">Proveedores más usados</h4>
                <div className={`rounded-lg ${theme==='dark'?'bg-gray-900':'bg-gray-100'} p-3`}>
                  {stats.proveedoresMasUsados.length > 0 ? (
                    <div className="space-y-2">
                      {stats.proveedoresMasUsados.map(([proveedor, count], idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span className="font-medium">{idx + 1}. {proveedor}</span>
                          <span className="text-indigo-500">{count} producto{count !== 1 ? 's' : ''}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-400 text-center py-2">Sin datos</div>
                  )}
                </div>
              </div>

              {/* Resumen general */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className={`p-3 rounded-lg ${theme==='dark'?'bg-gray-900':'bg-gray-100'} text-center`}>
                  <div className="text-gray-400 text-xs">Total Items</div>
                  <div className="text-xl font-bold">{items.length}</div>
                </div>
                <div className={`p-3 rounded-lg ${theme==='dark'?'bg-gray-900':'bg-gray-100'} text-center`}>
                  <div className="text-gray-400 text-xs">Activos</div>
                  <div className="text-xl font-bold text-green-500">{activos}</div>
                </div>
                <div className={`p-3 rounded-lg ${theme==='dark'?'bg-gray-900':'bg-gray-100'} text-center`}>
                  <div className="text-gray-400 text-xs">Agotados</div>
                  <div className="text-xl font-bold text-gray-500">{agotados}</div>
                </div>
                <div className={`p-3 rounded-lg ${theme==='dark'?'bg-gray-900':'bg-gray-100'} text-center`}>
                  <div className="text-gray-400 text-xs">Promedio global</div>
                  <div className="text-xl font-bold text-indigo-500">{promedioGlobal} días</div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button 
                onClick={()=>setShowStats(false)} 
                className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación personalizado */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10002] p-4" onClick={()=>setShowConfirm(false)}>
          <div className={`${theme==='dark'?'bg-gray-800 text-white':'bg-white text-gray-900'} rounded-2xl shadow-2xl w-full max-w-md p-6 transform transition-all`} onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                <ExclamationTriangleIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold">{confirmData.title}</h3>
            </div>
            
            <p className="text-gray-600 dark:text-gray-300 mb-6 ml-15">
              {confirmData.message}
            </p>
            
            <div className="flex gap-3 justify-end">
              <button 
                onClick={()=>setShowConfirm(false)} 
                className={`px-5 py-2.5 rounded-lg font-medium transition-colors ${theme==='dark'?'bg-gray-700 hover:bg-gray-600 text-white':'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  setShowConfirm(false);
                  if (confirmData.onConfirm) {
                    await confirmData.onConfirm();
                  }
                }}
                className="px-5 py-2.5 rounded-lg font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
