// src/components/Waiter/QuickPOSOrders.js
import React, { useState, useMemo, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../Auth/AuthProvider';
import { PlusCircleIcon, HomeIcon, XCircleIcon } from '@heroicons/react/24/outline';

const formatPrice = (v) => new Intl.NumberFormat('es-CO',{ style:'currency', currency:'COP', maximumFractionDigits:0 }).format(v||0);

const QuickPOSOrders = ({ setError=()=>{}, setSuccess=()=>{} }) => {
  const { user } = useAuth();
  const [tableInput, setTableInput] = useState('');
  const [saving, setSaving] = useState(false);

  // Items POS (igual que CajaPOS)
  const [posItems, setPosItems] = useState([]); // {id, name, price, type, category, color, imageData, shape, active}
  const [cartItems, setCartItems] = useState([]); // {id, refId, name, price, quantity, type, category}
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  
  // Mesas de la DB
  const [tables, setTables] = useState([]);
  const [showTableSelector, setShowTableSelector] = useState(false);
  // Eliminado: pending orders (no se muestran al mesero en modo rápido)

  // Suscripción posItems
  useEffect(() => {
    const unsub = onSnapshot(collection(db,'posItems'), snap => {
      const docs = snap.docs.map(d => ({ id:d.id, ...d.data() }))
        .sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
      setPosItems(docs);
    });
    return () => unsub();
  }, []);

  // Suscripción a mesas
  useEffect(() => {
    const q = query(collection(db, 'tables'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setTables(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // Sin suscripción a órdenes pendientes para mesero.

  const activeItems = useMemo(()=> posItems.filter(i => i.active!==false), [posItems]);
  const categories = useMemo(()=> { const s=new Set(); activeItems.forEach(i=>{ if(i.category) s.add(i.category); }); return Array.from(s).sort(); }, [activeItems]);
  // Clasificadores para determinar tipo al guardar
  const isAddition = (it) => {
    const cat = (it.category||'').toLowerCase();
    return cat.includes('adici') || cat.includes('adicion');
  };
  const isBreakfastItem = (it) => {
    const t = (it.type||'').toLowerCase();
    const cat = (it.category||'').toLowerCase();
    const n = (it.name||'').toLowerCase();

    // Excluir adiciones y bebidas de la determinación de tipo (son neutrales)
    if (cat.includes('adicci') || cat.includes('bebida')) {
         return n.includes('desayuno') || n.includes('caldo') || n.includes('huevo') || n.includes('moñona') || n.includes('monona');
    }

    return (
      t.includes('desayun') || t.includes('breakfast') ||
      cat.includes('desayun') || cat.includes('breakfast') ||
      n.includes('desayuno') || n.includes('caldo') || n.includes('huevo') || n.includes('moñona') || n.includes('monona')
    );
  };
  const isLunchItem = (it) => {
    const t = (it.type||'').toLowerCase();
    const cat = (it.category||'').toLowerCase();
    const n = (it.name||'').toLowerCase();
    
    // Excluir explícitamente items de desayuno para evitar falsos positivos
    if (n.includes('huevo') || n.includes('caldo') || n.includes('desayuno') || n.includes('moñona')) return false;

    // Excluir adiciones y bebidas de la determinación de tipo (son neutrales)
    // Esto soluciona el problema donde una Coca-Cola marcada como "Almuerzo" fuerza el pedido a ser Almuerzo
    if (cat.includes('adicci') || cat.includes('bebida')) {
        // Solo cuenta como almuerzo si el NOMBRE lo indica explícitamente (ej: "Adición de Almuerzo" - poco probable pero posible)
        return n.includes('almuerzo') || n.includes('mojarra') || n.includes('pechuga');
    }

    return (
      t.includes('almuerzo') || cat.includes('almuerzo') || n.includes('almuerzo') || n.includes('mojarra') || n.includes('pechuga')
    );
  };
  const filteredItems = useMemo(()=> {
    let items = activeItems;
    if (categoryFilter) items = items.filter(i=> i.category === categoryFilter);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      items = items.filter(i=> i.name?.toLowerCase().includes(term));
    }
    return items;
  }, [activeItems, categoryFilter, searchTerm]);
  const groupedItems = useMemo(()=>{
    const map = new Map();
    filteredItems.forEach(it => { const k = it.category || ''; if(!map.has(k)) map.set(k, []); map.get(k).push(it); });
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  }, [filteredItems]);
  const grandTotal = useMemo(()=> cartItems.reduce((s,i)=> s + i.price * i.quantity, 0), [cartItems]);

  const handleAddItem = (item) => {
    setCartItems(prev => {
      const existing = prev.find(ci=>ci.refId===item.id);
      if (existing) return prev.map(ci => ci.refId===item.id ? { ...ci, quantity: ci.quantity+1 } : ci);
      return [...prev, {
        id: `${item.id}-${Date.now()}`,
        refId: item.id,
        name: item.name,
        price: Number(item.price||0),
        quantity: 1,
        type: item.type || null,
        category: item.category || null,
      }];
    });
  };
  const updateCartItemQuantity = (id, qty) => setCartItems(prev => prev.filter(ci => (ci.id===id && qty<=0)? false : true).map(ci => ci.id===id ? { ...ci, quantity: qty } : ci));
  const removeCartItem = (id) => setCartItems(prev => prev.filter(ci=>ci.id!==id));
  const resetAll = () => { setCartItems([]); setTableInput(''); setSearchTerm(''); setCategoryFilter(''); };

  const isTableValid = useMemo(()=>{
    if (!tableInput.trim()) return false;
    const t = tableInput.trim().toLowerCase();
    return /^\d+$/.test(t) || t === 'llevar' || /^mesa\s+\d+$/.test(t);
  },[tableInput]);

  const handleSave = async () => {
    if (!user) return setError('No usuario');
    if (!cartItems.length) return setError('Sin items');
    if (!isTableValid) return setError('Mesa o "llevar" inválido');
    setSaving(true);
    try {
      const tableRaw = tableInput.trim();
      const isLlevar = tableRaw.toLowerCase() === 'llevar';
      const tableNumber = isLlevar ? null : (/^mesa\s+/i.test(tableRaw) ? tableRaw.replace(/^mesa\s+/i,'') : tableRaw);
      const serviceType = isLlevar ? 'llevar':'mesa';

      // Lógica mejorada para determinar si es desayuno o almuerzo
      // Si tiene AL MENOS un item de almuerzo -> Almuerzo
      // Si no tiene almuerzo pero tiene desayuno -> Desayuno
      // Si no tiene ninguno (solo bebidas/adiciones) -> Almuerzo (por defecto)
      const hasLunch = cartItems.some(ci => isLunchItem(ci));
      const hasBreakfast = cartItems.some(ci => isBreakfastItem(ci));
      
      let isBreakfast = hasBreakfast && !hasLunch;

      // Si no hay items específicos de ninguno, usar la hora actual como fallback
      if (!hasBreakfast && !hasLunch) {
        const hour = new Date().getHours();
        // Consideramos desayuno antes de las 12:00 PM
        isBreakfast = hour < 12;
      }
      
      const collectionName = isBreakfast ? 'breakfastOrders' : 'tableOrders';
      
      // Obtener nombre del mesero/usuario
      let waiterName = 'Mesero';
      if (user.displayName) {
        waiterName = user.displayName;
      } else if (user.email) {
        const namePart = user.email.split('@')[0];
        waiterName = namePart.charAt(0).toUpperCase() + namePart.slice(1).replace(/[._]/g, ' ');
      }

      await addDoc(collection(db, collectionName), {
        userId: user.uid,
        userEmail: user.email || '',
        waiterName: waiterName,
        origin: 'QuickPOS',
        quickMode: true,
        expanded: false,
        quickItems: cartItems.map(ci=>({
          refId: ci.refId,
          name: ci.name,
          quantity: ci.quantity,
          price: ci.price,
          type: ci.type || null,
          category: ci.category || null
        })),
        quickTotal: grandTotal,
        total: grandTotal, // Guardar total en la raíz para compatibilidad
        paymentAmount: grandTotal, // Para compatibilidad con CajaPOS
        orderType: isBreakfast ? 'desayuno' : 'almuerzo',
        type: isBreakfast ? 'breakfast' : 'lunch',
        serviceType,
        tableNumber: tableNumber || 'llevar',
        status: 'Pendiente',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setSuccess('Pedido rápido guardado');
      resetAll();
    } catch (e) {
      setError('Error guardando rápido: '+e.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="w-full mx-auto px-3 sm:px-6 pb-4 pt-4 lg:pb-3 lg:pt-4 lg:h-[calc(100vh-5rem)] lg:overflow-hidden">
      <div className="grid lg:grid-cols-[1fr_380px] gap-6 h-full items-start">
        {/* Presets */}
        <div className="flex flex-col h-full relative min-w-0 min-h-0">
          {/* Header catálogo */}
          <div className="sticky top-0 z-20 -mx-3 sm:-mx-6 lg:mx-0 mb-4">
            <div className="relative overflow-hidden backdrop-blur-md bg-gradient-to-r from-gray-800/90 via-gray-800/80 to-gray-800/90 border border-gray-700/60 rounded-b-xl rounded-t-lg lg:rounded-xl shadow-xl px-3 sm:px-4 py-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-2 rounded-lg bg-gradient-to-tr from-green-600 to-emerald-500 shadow-inner flex-shrink-0">
                    <PlusCircleIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg lg:text-xl font-bold text-white leading-tight truncate">Pedido Rápido</h2>
                    <p className="text-[11px] text-gray-400 hidden lg:block">Selecciona artículos como en Caja POS</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <select value={categoryFilter} onChange={(e)=>setCategoryFilter(e.target.value)} className="px-2 py-1 rounded bg-gray-700 text-gray-200 text-xs">
                    <option value="">Todas</option>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  {categoryFilter && <button onClick={()=>setCategoryFilter('')} className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-gray-100 text-xs">Limpiar</button>}
                  {/* Reset y texto 'Mostrando todo' removidos por solicitud */}
                </div>
              </div>
              <div className="relative mt-3">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="🔍 Buscar artículo..."
                  className="w-full px-3 py-2 pl-3 pr-8 rounded-lg bg-gray-700/60 text-white text-sm placeholder-gray-400 border border-gray-600/50 focus:border-green-500/50 focus:ring-1 focus:ring-green-500/50 focus:outline-none transition"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* Scroll catálogo */}
          <div className="flex-1 relative min-h-0">
            <div className="h-full max-h-full lg:max-h-[calc(100vh-12rem)] overflow-y-auto overscroll-contain pr-4 space-y-4 custom-scrollbar pt-1">
              {/* Se elimina sección de órdenes pendientes para mesero */}
              {/* Catálogo agrupado */}
              {groupedItems.map(g => {
                const cat = g.category || 'Sin Categoría';
                return (
                  <div key={cat}>
                    <div className="flex items-center mb-2">
                      <span className="text-[10px] uppercase tracking-wide text-gray-400 bg-gray-700/40 px-2 py-1 rounded">{cat}</span>
                      <span className="ml-2 text-[10px] text-gray-500">{g.items.length}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-6">
                      {g.items.map(item => {
                        const bgColor = item.color || '#374151';
                        const inCart = cartItems.find(ci=>ci.refId===item.id);
                        let containerClass = 'w-20 h-20 sm:w-24 sm:h-24 mx-auto flex flex-col items-center justify-center text-center text-xs font-medium shadow-md hover:shadow-lg transition relative';
                        let styleObj = { background: item.imageData ? '#f3f4f6' : (item.shape==='outline'?'transparent':bgColor) };
                        if (item.shape==='circle') containerClass += ' rounded-full overflow-hidden';
                        else if (item.shape==='square') containerClass += ' rounded-lg overflow-hidden';
                        else if (item.shape==='outline') containerClass += ' rounded-full overflow-hidden ring-2 ring-offset-2 ring-white';
                        else if (item.shape==='hex') { containerClass += ' overflow-hidden'; styleObj.clipPath='polygon(25% 5%,75% 5%,95% 50%,75% 95%,25% 95%,5% 50%)'; }
                        else containerClass += ' rounded-lg overflow-hidden';
                        return (
                          <div key={item.id} className="relative group">
                            <button onClick={()=>handleAddItem(item)} className={containerClass} style={styleObj}>
                              {item.imageData && <img src={item.imageData} alt={item.name} className="absolute inset-0 w-full h-full object-contain" />}
                              {!item.imageData && item.shape==='outline' && <div className="absolute inset-0 rounded-full" style={{ boxShadow:`0 0 0 3px ${item.color || '#ffffff'}` }} />}
                              <span className="z-10 px-1 drop-shadow leading-tight text-gray-900">{item.name}{inCart && <span className="block text-[10px] font-bold mt-1">x{inCart.quantity}</span>}</span>
                            </button>
                            <div className="mt-1 text-center text-[11px] text-gray-400">{formatPrice(item.price||0)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {groupedItems.length===0 && <div className="text-sm text-gray-400">No hay artículos.</div>}
        </div>
      </div>
      
      {/* Modal Selector de Mesas */}
      {showTableSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full max-h-[75vh] overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-white">Seleccionar Mesa</h3>
                <button
                  onClick={() => setShowTableSelector(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <XCircleIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-4">
              {/* Opción Llevar */}
              <button
                onClick={() => {
                  setTableInput('llevar');
                  setShowTableSelector(false);
                }}
                className={`w-full mb-3 px-3 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 text-sm ${
                  tableInput === 'llevar'
                    ? 'bg-orange-600/20 border-2 border-orange-500 text-orange-300'
                    : 'bg-gray-700/50 border-2 border-gray-600 text-gray-300 hover:border-orange-400 hover:bg-orange-600/10'
                }`}
              >
                <HomeIcon className="w-4 h-4" />
                <span>Para Llevar</span>
                {tableInput === 'llevar' && <span className="ml-auto text-orange-400">✓</span>}
              </button>
              
              {/* Grid de Mesas */}
              <div className="max-h-52 overflow-y-auto overflow-x-hidden custom-scrollbar">
                <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Mesas Disponibles</div>
                <div className="grid grid-cols-4 gap-2 pr-2">
                  {tables.map(table => (
                    <button
                      key={table.id}
                      onClick={() => {
                        setTableInput(table.name);
                        setShowTableSelector(false);
                      }}
                      className={`aspect-square rounded-lg font-medium transition-all duration-200 flex flex-col items-center justify-center gap-0.5 text-xs ${
                        tableInput === table.name
                          ? 'bg-green-600/20 border-2 border-green-500 text-green-300 scale-105'
                          : 'bg-gray-700/50 border-2 border-gray-600 text-gray-300 hover:border-green-400 hover:bg-green-600/10 hover:scale-105'
                      }`}
                    >
                      <span className="text-sm">🪑</span>
                      <span className="text-[10px] leading-tight">{table.name}</span>
                      {tableInput === table.name && <span className="text-green-400 text-[10px]">✓</span>}
                    </button>
                  ))}
                </div>
                {tables.length === 0 && (
                  <div className="text-center text-gray-500 py-4">
                    <span className="block text-sm">No hay mesas configuradas</span>
                    <span className="text-xs opacity-70">Contacte al administrador</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="px-4 py-3 border-t border-gray-700 flex gap-2">
              <button
                onClick={() => setShowTableSelector(false)}
                className="flex-1 py-2 px-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
        
        {/* Sidebar selección */}
        <div className="bg-gray-800 rounded-xl p-4 flex flex-col w-full max-w-sm lg:max-w-none lg:self-start shadow-lg">
          <h3 className="text-base font-semibold text-gray-100 mb-3">Resumen</h3>
          <div className="overflow-y-auto space-y-2 mb-3 pr-1 custom-scrollbar max-h-60">
            {cartItems.length===0 && <div className="text-xs text-gray-400">Añade artículos con un click.</div>}
            {cartItems.map(ci => (
              <div key={ci.id} className="flex items-center justify-between bg-gray-700 rounded p-2 text-xs">
                <div className="flex-1 mr-2 truncate">
                  <div className="font-medium text-gray-100 truncate">{ci.name}</div>
                  <div className="text-[10px] text-gray-400">{formatPrice(ci.price)} c/u</div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={()=>updateCartItemQuantity(ci.id, ci.quantity-1)} className="w-6 h-6 bg-red-600 text-white rounded">-</button>
                  <input type="number" value={ci.quantity} onChange={e=>updateCartItemQuantity(ci.id, Number(e.target.value||0))} className="w-10 px-1 py-0.5 text-center rounded bg-gray-800 text-white" />
                  <button onClick={()=>updateCartItemQuantity(ci.id, ci.quantity+1)} className="w-6 h-6 bg-green-600 text-white rounded">+</button>
                  <button onClick={()=>removeCartItem(ci.id)} className="w-6 h-6 bg-red-700 text-white rounded">x</button>
                </div>
              </div>
            ))}
          </div>
          <div className="mb-3">
            <label className="block text-gray-400 mb-2 text-xs font-medium">Mesa o llevar *</label>
            {/* Botón para abrir selector visual */}
            <button
              onClick={() => setShowTableSelector(true)}
              className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border-2 flex items-center justify-between ${
                tableInput
                  ? 'bg-green-600/20 border-green-500/60 text-green-300'
                  : 'bg-gray-700/50 border-gray-600 text-gray-300 hover:border-gray-500'
              }`}
            >
              <span className="flex items-center gap-2">
                {tableInput === 'llevar' ? (
                  <HomeIcon className="w-4 h-4" />
                ) : (
                  <span className="text-xs">🪑</span>
                )}
                {tableInput || 'Seleccionar mesa o llevar'}
              </span>
              <span className="text-xs opacity-60">▼</span>
            </button>
          </div>
          <div className="flex items-center justify-between mb-3 border-t border-gray-700 pt-3">
            <div className="text-sm text-gray-300 font-semibold tracking-wide">TOTAL</div>
            <div className="text-xl font-extrabold text-green-400">{formatPrice(grandTotal)}</div>
          </div>
          <div className="flex gap-2 text-sm mt-1">
            <button onClick={resetAll} className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded">Limpiar</button>
            <button onClick={handleSave} disabled={saving || !cartItems.length || !isTableValid} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:bg-gray-500 disabled:cursor-not-allowed">Guardar</button>
          </div>
          {saving && <div className="mt-2 text-[11px] text-blue-300">Guardando...</div>}
        </div>
      </div>
      
      {/* Modal Selector de Mesas */}
      {showTableSelector && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowTableSelector(false)}
        >
          <div 
            className="bg-gray-800 rounded-2xl shadow-2xl max-w-sm w-full max-h-[75vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-base font-bold text-white">Seleccionar Mesa</h3>
                <button
                  onClick={() => setShowTableSelector(false)}
                  className="text-gray-400 hover:text-white transition"
                >
                  <XCircleIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-4">
              {/* Opción Llevar */}
              <button
                onClick={() => {
                  setTableInput('llevar');
                  setShowTableSelector(false);
                }}
                className={`w-full mb-3 px-3 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 text-sm ${
                  tableInput === 'llevar'
                    ? 'bg-orange-600/20 border-2 border-orange-500 text-orange-300'
                    : 'bg-gray-700/50 border-2 border-gray-600 text-gray-300 hover:border-orange-400 hover:bg-orange-600/10'
                }`}
              >
                <HomeIcon className="w-4 h-4" />
                <span>Para Llevar</span>
                {tableInput === 'llevar' && <span className="ml-auto text-orange-400">✓</span>}
              </button>
              
              {/* Grid de Mesas */}
              <div className="max-h-52 overflow-y-auto overflow-x-hidden custom-scrollbar">
                <div className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Mesas Disponibles</div>
                <div className="grid grid-cols-4 gap-2 pr-2">
                  {tables.map(table => (
                    <button
                      key={table.id}
                      onClick={() => {
                        setTableInput(table.name);
                        setShowTableSelector(false);
                      }}
                      className={`aspect-square rounded-lg font-medium transition-all duration-200 flex flex-col items-center justify-center gap-0.5 text-xs ${
                        tableInput === table.name
                          ? 'bg-green-600/20 border-2 border-green-500 text-green-300 scale-105'
                          : 'bg-gray-700/50 border-2 border-gray-600 text-gray-300 hover:border-green-400 hover:bg-green-600/10 hover:scale-105'
                      }`}
                    >
                      <span className="text-sm">🪑</span>
                      <span className="text-[10px] leading-tight">{table.name}</span>
                      {tableInput === table.name && <span className="text-green-400 text-[10px]">✓</span>}
                    </button>
                  ))}
                </div>
                {tables.length === 0 && (
                  <div className="text-center text-gray-500 py-4">
                    <span className="block text-sm">No hay mesas configuradas</span>
                    <span className="text-xs opacity-70">Contacte al administrador</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="px-4 py-3 border-t border-gray-700 flex gap-2">
              <button
                onClick={() => setShowTableSelector(false)}
                className="flex-1 py-2 px-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition text-sm"
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

export default QuickPOSOrders;
