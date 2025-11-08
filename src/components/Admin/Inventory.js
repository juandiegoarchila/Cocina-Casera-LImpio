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
} from 'firebase/firestore';
import { PlusIcon, MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

const defaultItem = {
  name: '',
  category: '',
  provider: '', // proveedor opcional
  quantity: 1, // cantidad recibida
  cost: 0, // costo de compra
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
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(defaultItem);
  const [exporting, setExporting] = useState(false);

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

  const categories = useMemo(() => {
    const set = new Set(items.map(i => (i.category || '').trim()).filter(Boolean));
    return ['all', ...Array.from(set).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter(i => {
      const matchesTerm = !term || `${i.name}`.toLowerCase().includes(term);
      const matchesCat = categoryFilter === 'all' || (i.category || '') === categoryFilter;
      return matchesTerm && matchesCat;
    });
  }, [items, search, categoryFilter]);

  const activos = useMemo(() => items.filter(i => (i.status || 'activo') === 'activo').length, [items]);
  const agotados = useMemo(() => items.filter(i => i.status === 'agotado').length, [items]);
  const promedioGlobal = useMemo(() => {
    const all = items.flatMap(i => Array.isArray(i.durations) ? i.durations : []);
    if (!all.length) return 0;
    return Math.round(all.reduce((a,b)=>a+Number(b||0),0) / all.length);
  }, [items]);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultItem);
    setShowModal(true);
  };
  const openEdit = (item) => {
    setEditing(item);
    setForm({
      name: item.name || '',
      category: item.category || '',
      provider: item.provider || '',
      quantity: numberOrZero(item.quantity) || 1,
      cost: numberOrZero(item.cost),
    });
    setShowModal(true);
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
        updatedAt: serverTimestamp(),
      };
      if (editing) {
        await updateDoc(doc(db, 'inventory', editing.id), payload);
        setSuccess && setSuccess('Ítem actualizado');
      } else {
        await addDoc(collection(db, 'inventory'), {
          ...payload,
          status: 'activo',
          activatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          durations: [],
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
    if (!window.confirm('¿Eliminar este ítem?')) return;
    try {
      await deleteDoc(doc(db, 'inventory', id));
      setSuccess && setSuccess('Ítem eliminado');
    } catch (err) {
      console.error(err);
      setError && setError('No se pudo eliminar');
    }
  };

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

  const markAgotado = async (item) => {
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
  };

  const reponer = async (item) => {
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
  };

  const exportCSV = async () => {
    try {
      setExporting(true);
  const headers = ['Nombre','Categoría','Proveedor','Cantidad','Costo','Estado','Creado','Última duración (d)','Promedio (d)','Registros'];
      const lines = filtered.map(i => [
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
      ]);
      const csv = [headers, ...lines].map(r => r.map(v => `"${(v ?? '').toString().replace(/"/g,'\"')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventario_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Encabezado compacto y ordenado */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-xl sm:text-2xl font-bold">Inventario</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              disabled={exporting}
              title="Exportar CSV"
              aria-label="Exportar CSV"
              className={`p-2 rounded-lg border ${theme==='dark'?'bg-gray-700 text-white border-gray-600 hover:bg-gray-600':'bg-white text-gray-800 border-gray-300 hover:bg-gray-100'}`}
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
            </button>
            <button
              onClick={openCreate}
              title="Nuevo ítem"
              aria-label="Nuevo ítem"
              className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <PlusIcon className="w-5 h-5"/>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
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
            className={`w-full sm:w-56 px-3 py-2 rounded-lg border shadow-sm ${theme==='dark'?'bg-gray-800 border-gray-700 text-white':'bg-white border-gray-300 text-gray-800'}`}
          >
            {categories.map(c => (
              <option key={c} value={c}>{c === 'all' ? 'Todas las categorías' : c}</option>
            ))}
          </select>
        </div>
      </div>

  {/* BLOQUE DE MÉTRICAS REMOVIDO
  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className={`p-3 rounded-lg shadow ${theme==='dark'?'bg-gray-800':'bg-white'}`}>
          <div className="text-sm text-gray-400">Ítems</div>
          <div className="text-2xl font-bold">{items.length}</div>
        </div>
        <div className={`p-3 rounded-lg shadow ${theme==='dark'?'bg-gray-800':'bg-white'}`}>
          <div className="text-sm text-gray-400">Activos / Agotados</div>
          <div className="text-2xl font-bold">{activos} / {agotados}</div>
        </div>
        <div className={`p-3 rounded-lg shadow ${theme==='dark'?'bg-gray-800':'bg-white'}`}>
          <div className="text-sm text-gray-400">Promedio duración</div>
          <div className="text-lg font-bold">{promedioGlobal} días</div>
        </div>
  </div>
  */}

      {/* Fin encabezado */}

  <div className={`max-h-[70vh] overflow-auto custom-scrollbar bg-transparent shadow-none`}>
        {loading ? (
          <div className="p-6 text-center">Cargando inventario...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-gray-500">Sin resultados</div>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(item => {
              const isActive = (item.status || 'activo') === 'activo';
              const days = diffDays(item.activatedAt);
              const avg = Number(item.avgDurationDays || 0);
              const percent = avg > 0 ? Math.min(100, Math.round((days / avg) * 100)) : 0;
              const diff = avg > 0 ? (days - avg) : 0;
              const showDelta = avg > 0 && diff !== 0;
              const absDiff = Math.abs(diff);
              return (
                <div key={item.id} className={`${theme==='dark'?'bg-gray-900':'bg-white'} rounded-xl shadow p-4 border ${theme==='dark'?'border-gray-700':'border-gray-200'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm text-gray-400">{item.category || 'Sin categoría'}</div>
                      <div className="text-lg font-bold">{item.name}</div>
                    </div>
                    {/* Badge de estado removido por solicitud */}
                  </div>
                  <div className="mt-2 text-sm text-gray-400">Creado: {item.activatedAt ? (typeof item.activatedAt.toDate==='function' ? item.activatedAt.toDate() : new Date(item.activatedAt)).toLocaleDateString('es-CO') : '—'}</div>
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-400">Duración</span>
                      <span className="text-gray-400">{days} d</span>
                    </div>
                    <div className={`${theme==='dark'?'bg-gray-700':'bg-gray-200'} w-full h-2 rounded-full overflow-hidden`}>
                      <div className="h-2 bg-indigo-500" style={{ width: `${percent}%` }} />
                    </div>
                    {showDelta && (
                      <div className={`mt-1 text-xs ${diff > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {absDiff} {absDiff === 1 ? 'día' : 'días'} {diff > 0 ? 'más' : 'menos'} que el promedio
                      </div>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-400">
                    {item.provider && (
                      <div className="col-span-2">Proveedor: <span className="font-semibold text-gray-300">{item.provider}</span></div>
                    )}
                    <div>Cantidad: <span className="font-semibold text-gray-300">{numberOrZero(item.quantity) || 1}</span></div>
                    <div>Costo: <span className="font-semibold text-gray-300">${numberOrZero(item.cost).toLocaleString('es-CO')}</span></div>
                    {Array.isArray(item.durations) && item.durations.length>0 && (
                      <div className="col-span-2">Última duración: <span className="font-semibold text-gray-300">{item.lastDurationDays} días</span> ({item.durations.length} registros)</div>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => openEdit(item)}
                      title="Editar"
                      aria-label={`Editar ${item.name}`}
                      className="p-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs flex items-center justify-center"
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      title="Eliminar"
                      aria-label={`Eliminar ${item.name}`}
                      className="p-2 rounded bg-red-600 hover:bg-red-700 text-white text-xs flex items-center justify-center"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                    {isActive ? (
                      <button onClick={()=>markAgotado(item)} className="px-3 py-1.5 rounded bg-orange-600 hover:bg-orange-700 text-white text-xs">Marcar agotado</button>
                    ) : (
                      <button onClick={()=>reponer(item)} className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs">Reponer</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10001]" onClick={()=>setShowModal(false)}>
          <div className={`${theme==='dark'?'bg-gray-800 text-white':'bg-white text-gray-900'} rounded-xl shadow-xl w-full max-w-lg p-4`} onClick={(e)=>e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-3">{editing ? 'Editar producto' : 'Nuevo producto'}</h3>
            <form onSubmit={saveItem} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-sm">Nombre del producto
                <input required value={form.name} onChange={e=>setForm({...form, name:e.target.value})} className={`mt-1 w-full px-3 py-2 rounded border ${theme==='dark'?'bg-gray-900 border-gray-700':'bg-white border-gray-300'}`}/>
              </label>
              <label className="text-sm">Categoría (cocina, salón, etc.)
                <input value={form.category} onChange={e=>setForm({...form, category:e.target.value})} className={`mt-1 w-full px-3 py-2 rounded border ${theme==='dark'?'bg-gray-900 border-gray-700':'bg-white border-gray-300'}`}/>
              </label>
              <label className="text-sm">Proveedor (opcional)
                <input value={form.provider || ''} onChange={e=>setForm({...form, provider:e.target.value})} placeholder="Nombre o contacto" className={`mt-1 w-full px-3 py-2 rounded border ${theme==='dark'?'bg-gray-900 border-gray-700':'bg-white border-gray-300'}`}/>
              </label>
              <label className="text-sm">Cantidad (unidades)
                <input type="number" min="1" value={form.quantity} onChange={e=>setForm({...form, quantity:e.target.value})} className={`mt-1 w-full px-3 py-2 rounded border ${theme==='dark'?'bg-gray-900 border-gray-700':'bg-white border-gray-300'}`}/>
              </label>
              <label className="text-sm">Costo del producto
                <input type="number" step="0.01" min="0" value={form.cost} onChange={e=>setForm({...form, cost:e.target.value})} className={`mt-1 w-full px-3 py-2 rounded border ${theme==='dark'?'bg-gray-900 border-gray-700':'bg-white border-gray-300'}`}/>
              </label>
              <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                <button type="button" onClick={()=>setShowModal(false)} className={`px-3 py-2 rounded border ${theme==='dark'?'border-gray-600 hover:bg-gray-700':'border-gray-300 hover:bg-gray-100'}`}>Cancelar</button>
                <button type="submit" className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fin modales */}
    </div>
  );
}
