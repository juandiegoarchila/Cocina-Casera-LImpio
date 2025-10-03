// src/components/Waiter/CajaPOS.js
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../config/firebase';
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { CurrencyDollarIcon, PlusCircleIcon, PencilIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../Auth/AuthProvider';

const formatPrice = (v) => new Intl.NumberFormat('es-CO',{ style:'currency', currency:'COP', maximumFractionDigits:0 }).format(v||0);

const CajaPOS = ({ theme='dark', setError=()=>{}, setSuccess=()=>{} }) => {
  const { role } = useAuth(); // 2 = admin, 3 = mesera

  // Estado principal
  const [posItems, setPosItems] = useState([]);
  const [cartItems, setCartItems] = useState([]); // {id, refId, name, price, quantity}
  const [posOrderType, setPosOrderType] = useState('almuerzo');
  const [posTableNumber, setPosTableNumber] = useState('');
  const [posPaymentMethod, setPosPaymentMethod] = useState('efectivo');
  const [posCashAmount, setPosCashAmount] = useState('');
  const [posCalculatedChange, setPosCalculatedChange] = useState(0);
  const [posNote, setPosNote] = useState('');
  const [posStage, setPosStage] = useState('select'); // 'select' | 'pay'

  // Editor de artículos
  const [showItemEditor, setShowItemEditor] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemEditorMode, setItemEditorMode] = useState('color'); // 'color' | 'image'
  const [itemColor, setItemColor] = useState('#fb923c');
  const [itemShape, setItemShape] = useState('circle'); // circle | square | hex | outline
  const [itemName, setItemName] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [itemType, setItemType] = useState('almuerzo');
  const [itemCategory, setItemCategory] = useState('');
  const [itemImageData, setItemImageData] = useState(null);
  const [itemActive, setItemActive] = useState(true);

  // Filtro de categorías
  const [categoryFilter, setCategoryFilter] = useState('');

  const colorPalette = ['#fb923c','#fbbf24','#10b981','#0ea5e9','#6366f1','#ec4899','#f43f5e','#6b7280','#f59e0b'];
  const shapeOptions = [
    { id:'circle', label:'Círculo' },
    { id:'square', label:'Cuadrado' },
    { id:'hex', label:'Hexágono' },
    { id:'outline', label:'Borde' }
  ];

  // Suscripción a items POS
  useEffect(()=>{
    const unsub = onSnapshot(collection(db,'posItems'), snap => {
      const docs = snap.docs.map(d => ({ id:d.id, ...d.data() }))
        .sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
      setPosItems(docs);
    });
    return () => unsub && unsub();
  },[]);

  // Derivados
  const activeItems = useMemo(()=> posItems.filter(i => i.active!==false), [posItems]);
  const categories = useMemo(()=> { const s=new Set(); activeItems.forEach(i=>{ if(i.category) s.add(i.category); }); return Array.from(s).sort(); }, [activeItems]);
  const filteredItems = useMemo(()=> categoryFilter ? activeItems.filter(i=>i.category===categoryFilter) : activeItems, [activeItems, categoryFilter]);
  const groupedItems = useMemo(()=>{
    const map = new Map();
    filteredItems.forEach(it => { const k = it.category || ''; if(!map.has(k)) map.set(k, []); map.get(k).push(it); });
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  }, [filteredItems]);
  const cartTotal = useMemo(()=> cartItems.reduce((s,i)=> s + i.price * i.quantity, 0), [cartItems]);

  // Cambio efectivo
  useEffect(()=>{
    if (posPaymentMethod !== 'efectivo' || !posCashAmount){ setPosCalculatedChange(0); return; }
    const paid = parseFloat(posCashAmount)||0;
    setPosCalculatedChange(paid - cartTotal > 0 ? Math.round(paid - cartTotal) : 0);
  },[posCashAmount,posPaymentMethod,cartTotal]);

  // Carrito
  const handleAddPosItem = (item) => {
    setCartItems(prev => {
      const existing = prev.find(ci=>ci.refId===item.id);
      if (existing) return prev.map(ci => ci.refId===item.id ? { ...ci, quantity: ci.quantity+1 } : ci);
      return [...prev, { id:`${item.id}-${Date.now()}`, refId:item.id, name:item.name, price:Number(item.price||0), quantity:1 }];
    });
  };
  const updateCartItemQuantity = (id, qty) => setCartItems(prev => prev.filter(ci => (ci.id===id && qty<=0)? false : true).map(ci => ci.id===id ? { ...ci, quantity: qty } : ci));
  const removeCartItem = (id) => setCartItems(prev => prev.filter(ci=>ci.id!==id));
  const resetCart = () => { setCartItems([]); setPosCashAmount(''); setPosCalculatedChange(0); setPosNote(''); setPosStage('select'); };
  const quickCashButtons = [10000,20000,50000,100000];

  // Procesar venta
  const handleProcessPosSale = async () => {
    if (cartItems.length===0) return setError('Agrega artículos');
    if (posStage==='select'){ setPosStage('pay'); return; }
    try {
      const payload = {
        orderType: posOrderType === 'general' ? 'almuerzo' : posOrderType,
        isPaid: true,
        status: 'Completada',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        paymentDate: serverTimestamp(),
        paymentMethod: posPaymentMethod,
        paymentAmount: cartTotal,
        total: cartTotal,
        paymentNote: posNote || '',
        items: cartItems.map(ci=>({ id: ci.refId, name: ci.name, unitPrice: ci.price, quantity: ci.quantity }))
      };
      if (posTableNumber.trim()) payload.tableNumber = posTableNumber.trim(); else payload.takeaway = true;
      if (posPaymentMethod==='efectivo' && posCashAmount){ payload.cashReceived=parseFloat(posCashAmount)||0; payload.changeGiven=posCalculatedChange; }
      const collectionName = (posOrderType==='desayuno') ? 'breakfastOrders' : 'tableOrders';
      await addDoc(collection(db, collectionName), payload);
      setSuccess('✅ Venta registrada');
      resetCart();
    }catch(err){ setError('Error registrando venta: '+err.message); }
  };

  // Editor de items
  const openNewItemEditor = () => {
    setEditingItem(null); setItemEditorMode('color'); setItemColor('#fb923c'); setItemShape('circle'); setItemName(''); setItemPrice(''); setItemType('almuerzo'); setItemCategory(''); setItemImageData(null); setItemActive(true); setShowItemEditor(true);
  };
  const openEditItem = (item) => {
    setEditingItem(item); setItemEditorMode(item.imageData ? 'image':'color'); setItemColor(item.color||'#fb923c'); setItemShape(item.shape||'circle'); setItemName(item.name||''); setItemPrice(item.price!=null? String(item.price):''); setItemType(item.type||'almuerzo'); setItemCategory(item.category||''); setItemImageData(item.imageData||null); setItemActive(item.active!==false); setShowItemEditor(true);
  };
  const handleSaveItem = async () => {
    if(!itemName.trim()||!itemPrice) return setError('Nombre y precio obligatorios');
    const base = { name:itemName.trim(), price:Math.round(Number(itemPrice)||0), type:itemType, category:itemCategory.trim()||null, color:itemEditorMode==='color'?itemColor:null, shape:itemEditorMode==='color'?itemShape:null, imageData:itemEditorMode==='image'?itemImageData:null, active:itemActive, sortOrder: editingItem?.sortOrder || Date.now() };
    try {
      if (editingItem) { const { updateDoc, doc } = await import('firebase/firestore'); await updateDoc(doc(db,'posItems',editingItem.id), base); setSuccess('Artículo actualizado'); }
      else { await addDoc(collection(db,'posItems'), base); setSuccess('Artículo creado'); }
      setShowItemEditor(false);
    }catch(err){ setError('Error guardando: '+err.message); }
  };
  const handleImageFile = (e) => { const f=e.target.files?.[0]; if(!f)return; const r=new FileReader(); r.onload=ev=>setItemImageData(ev.target.result); r.readAsDataURL(f); };

  const CategoryFilter = ({ current, onSelect }) => (
    <div className="flex items-center gap-2 text-xs">
      <select value={current} onChange={(e)=>onSelect(e.target.value)} className="px-2 py-1 rounded bg-gray-700 text-gray-200">
        <option value="">Todas</option>
        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
      </select>
      {current && <button onClick={()=>onSelect('')} className="px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded text-gray-100">Limpiar</button>}
    </div>
  );

  return (
    <div className="w-full mx-auto px-3 sm:px-6 py-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2"><CurrencyDollarIcon className="w-6 h-6"/> Caja POS</h2>
        <div className="flex items-center gap-3">
          <CategoryFilter current={categoryFilter} onSelect={setCategoryFilter} />
          {role===2 && <button onClick={openNewItemEditor} className="flex items-center px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"><PlusCircleIcon className="w-5 h-5 mr-1"/>Nuevo</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Catálogo */}
        <div className="lg:col-span-2 space-y-6">
          {groupedItems.map(g => (
            <div key={g.category || 'sin-cat'}>
              <div className="flex items-center mb-2">
                <span className="text-[10px] uppercase tracking-wide text-gray-400 bg-gray-700/40 px-2 py-1 rounded">{g.category || 'Sin Categoría'}</span>
                <span className="ml-2 text-[10px] text-gray-500">{g.items.length}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
                {g.items.map(item => {
                  const shapeClass = item.shape==='circle' ? 'rounded-full' : item.shape==='square' ? 'rounded-lg' : item.shape==='outline' ? 'rounded-full ring-2 ring-offset-2 ring-white' : '';
                  const hexStyle = item.shape==='hex' ? { clipPath:'polygon(25% 5%,75% 5%,95% 50%,75% 95%,25% 95%,5% 50%)' } : {};
                  const bg = item.imageData ? `url(${item.imageData})` : (item.color || '#374151');
                  const isInCart = cartItems.find(ci=>ci.refId===item.id);
                  return (
                    <div key={item.id} className="relative group">
                      {role===2 && <button onClick={()=>openEditItem(item)} className="absolute -top-2 -right-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"><PencilIcon className="w-4 h-4"/></button>}
                      <button
                        onClick={()=>handleAddPosItem(item)}
                        className={`w-24 h-24 mx-auto flex flex-col items-center justify-center text-center text-xs font-medium text-gray-900 dark:text-gray-100 shadow-md hover:shadow-lg transition relative overflow-hidden ${shapeClass}`}
                        style={{ background: item.imageData?bg: item.shape==='outline'?'transparent': bg, backgroundSize:'cover', backgroundPosition:'center', ...hexStyle }}>
                        {!item.imageData && item.shape==='outline' && <div className="absolute inset-0 rounded-full" style={{ boxShadow:`0 0 0 3px ${item.color || '#ffffff'}` }} />}
                        <span className="z-10 px-1 drop-shadow leading-tight">{item.name}{isInCart && <span className="block text-[10px] font-bold mt-1">x{isInCart.quantity}</span>}</span>
                      </button>
                      <div className="mt-1 text-center text-[11px] text-gray-400">{formatPrice(item.price||0)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {groupedItems.length===0 && <div className="text-sm text-gray-400">No hay artículos.</div>}
        </div>

        {/* Resumen / Pago */}
        <div className={`${theme==='dark' ? 'bg-gray-800':'bg-white'} rounded-xl p-4 shadow-lg flex flex-col`}>
          <h3 className="text-lg font-semibold text-gray-100 mb-3">{posStage==='select' ? 'Resumen' : 'Detalle del Pedido'}</h3>
          {posStage==='select' && (
            <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
              <div>
                <label className="block text-gray-400 mb-1">Tipo Pedido</label>
                <select value={posOrderType} onChange={e=>setPosOrderType(e.target.value)} className="w-full px-2 py-1 rounded bg-gray-700 text-white text-xs">
                  <option value="almuerzo">Almuerzo</option>
                  <option value="desayuno">Desayuno</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Mesa / vacío = Llevar</label>
                <input value={posTableNumber} onChange={e=>setPosTableNumber(e.target.value)} className="w-full px-2 py-1 rounded bg-gray-700 text-white text-xs" />
              </div>
            </div>
          )}

            <div className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1">
              {cartItems.length===0 && <div className="text-sm text-gray-400">Añade artículos con un click.</div>}
              {cartItems.map(ci => (
                <div key={ci.id} className="flex items-center justify-between text-sm bg-gray-700 rounded p-2">
                  <div className="flex-1 mr-2">
                    <div className="font-medium text-gray-100 truncate">{ci.name}</div>
                    <div className="text-[11px] text-gray-400">{formatPrice(ci.price)} c/u</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={()=>updateCartItemQuantity(ci.id, ci.quantity-1)} className="w-6 h-6 bg-red-600 text-white rounded text-xs">-</button>
                    <input type="number" value={ci.quantity} onChange={(e)=>updateCartItemQuantity(ci.id, Number(e.target.value||0))} className="w-10 px-1 py-0.5 text-center rounded bg-gray-800 text-white text-xs" />
                    <button onClick={()=>updateCartItemQuantity(ci.id, ci.quantity+1)} className="w-6 h-6 bg-green-600 text-white rounded text-xs">+</button>
                    <button onClick={()=>removeCartItem(ci.id)} className="w-6 h-6 bg-red-700 text-white rounded text-xs">x</button>
                  </div>
                </div>
              ))}
            </div>

            {posStage==='pay' && (
              <>
                <div className="mb-3 border-t border-gray-700 pt-3">
                  <label className="block text-gray-400 mb-1 text-xs">Nota</label>
                  <input value={posNote} onChange={e=>setPosNote(e.target.value)} className="w-full px-2 py-1 rounded bg-gray-700 text-white text-xs"/>
                </div>
                <div className="mb-3">
                  <label className="block text-gray-400 mb-1 text-xs">Método de Pago</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['efectivo','nequi','daviplata'].map(m => (
                      <button key={m} onClick={()=>setPosPaymentMethod(m)} className={`py-2 text-xs rounded border-2 ${posPaymentMethod===m ? 'border-blue-500 bg-blue-500/20 text-blue-300':'border-gray-600 text-gray-300 hover:bg-gray-700'}`}>{m}</button>
                    ))}
                  </div>
                </div>
                {posPaymentMethod==='efectivo' && (
                  <div className="mb-3">
                    <label className="block text-gray-400 mb-1 text-xs">Billetes Rápidos</label>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {quickCashButtons.map(b => (
                        <button key={b} onClick={()=>setPosCashAmount(String(b))} className="py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded">{formatPrice(b)}</button>
                      ))}
                    </div>
                    <input type="number" placeholder="Monto recibido" value={posCashAmount} onChange={(e)=>setPosCashAmount(e.target.value)} className="w-full px-2 py-1 rounded bg-gray-700 text-white text-xs"/>
                    {posCashAmount && <div className={`mt-1 text-xs ${posCalculatedChange>=0?'text-green-400':'text-red-400'}`}>Vueltos: {formatPrice(posCalculatedChange)}</div>}
                  </div>
                )}
              </>
            )}

            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-300 font-medium">Total:</div>
              <div className="text-xl font-bold text-green-400">{formatPrice(cartTotal)}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={resetCart} className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm">{posStage==='select' ? 'Limpiar':'Cancelar'}</button>
              <button onClick={handleProcessPosSale} className={`flex-1 py-2 ${posStage==='select' ? 'bg-green-600 hover:bg-green-700':'bg-blue-600 hover:bg-blue-700'} text-white rounded text-sm font-semibold`} disabled={cartItems.length===0}>{posStage==='select' ? 'Cobrar':'Confirmar Pago'}</button>
            </div>
            {posStage==='pay' && <button onClick={()=>setPosStage('select')} className="mt-2 w-full py-1.5 text-xs text-gray-400 hover:text-gray-200 transition">← Volver a editar items</button>}
        </div>
      </div>

      {/* Modal Editor */}
      {showItemEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${theme==='dark'?'bg-gray-800':'bg-white'} w-full max-w-md rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto p-6`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-100">{editingItem ? 'Editar Artículo' : 'Nuevo Artículo'}</h3>
              <button onClick={()=>setShowItemEditor(false)} className="text-gray-400 hover:text-gray-200"><XCircleIcon className="w-6 h-6"/></button>
            </div>
            <div className="mb-4 flex gap-6 text-xs">
              <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={itemEditorMode==='color'} onChange={()=>setItemEditorMode('color')} /> Color y forma</label>
              <label className="flex items-center gap-1 cursor-pointer"><input type="radio" checked={itemEditorMode==='image'} onChange={()=>setItemEditorMode('image')} /> Imagen</label>
            </div>
            {itemEditorMode==='color' ? (
              <div className="mb-6">
                <div className="grid grid-cols-9 gap-2 mb-4">
                  {colorPalette.map(c => (
                    <button key={c} onClick={()=>setItemColor(c)} style={{ background:c }} className={`h-8 rounded ${itemColor===c ? 'ring-2 ring-white':''}`}></button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 mb-4 text-xs">
                  {shapeOptions.map(opt => (
                    <button key={opt.id} onClick={()=>setItemShape(opt.id)} className={`px-2 py-1 rounded border ${itemShape===opt.id ? 'bg-blue-600 border-blue-500 text-white':'border-gray-600 text-gray-300 hover:bg-gray-700'}`}>{opt.label}</button>
                  ))}
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-xs text-gray-300">Preview:</div>
                  <div className={`w-16 h-16 flex items-center justify-center text-[11px] font-semibold text-gray-900 dark:text-gray-100 shadow ${itemShape==='circle'?'rounded-full': itemShape==='square'?'rounded-lg': itemShape==='outline'?'rounded-full ring-2 ring-white':'rounded-full'}`} style={itemShape==='hex'?{clipPath:'polygon(25% 5%,75% 5%,95% 50%,75% 95%,25% 95%,5% 50%)',background:itemColor}:{background:itemShape==='outline'?'transparent':itemColor}}>Item</div>
                </div>
              </div>
            ) : (
              <div className="mb-6 space-y-4">
                <div>
                  <label className="block text-xs text-gray-300 mb-1">Imagen</label>
                  <input type="file" accept="image/*" onChange={handleImageFile} className="text-xs" />
                </div>
                {itemImageData && (
                  <div className="relative w-24 h-24 rounded-full overflow-hidden ring-2 ring-white">
                    <img src={itemImageData} alt="preview" className="object-cover w-full h-full" />
                    <button onClick={()=>setItemImageData(null)} className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1"><XCircleIcon className="w-4 h-4"/></button>
                  </div>
                )}
              </div>
            )}
            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-gray-300 mb-1">Nombre</label>
                <input value={itemName} onChange={e=>setItemName(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-700 text-white text-sm" />
              </div>
              <div>
                <label className="block text-gray-300 mb-1">Precio</label>
                <input type="number" value={itemPrice} onChange={e=>setItemPrice(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-700 text-white text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 mb-1">Tipo</label>
                  <select value={itemType} onChange={e=>setItemType(e.target.value)} className="w-full px-3 py-2 rounded bg-gray-700 text-white text-sm">
                    <option value="almuerzo">Almuerzo</option>
                    <option value="desayuno">Desayuno</option>
                    <option value="general">General</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">Categoría</label>
                  <input value={itemCategory} onChange={e=>setItemCategory(e.target.value)} placeholder="Ej: Bebidas" className="w-full px-3 py-2 rounded bg-gray-700 text-white text-sm" />
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <input id="activo" type="checkbox" checked={itemActive} onChange={e=>setItemActive(e.target.checked)} />
                <label htmlFor="activo" className="text-gray-300 select-none">Activo</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleSaveItem} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-semibold text-sm">Guardar</button>
                <button onClick={()=>setShowItemEditor(false)} className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm">Cancelar</button>
                {editingItem && <button onClick={()=>setItemActive(a=>!a)} className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm">{itemActive? 'Desactivar':'Activar'}</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CajaPOS;