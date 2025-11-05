//src/components/CutlerySelector.js
import React, { useRef } from 'react';

const CutlerySelector = ({ cutlery, setCutlery }) => {
  const lastTouchTimeRef = useRef(0);
  const touchInfoRef = useRef({ x: 0, y: 0, moved: false });

  const onTouchStartGeneric = (e) => {
    const t = e.touches && e.touches[0];
    if (!t) return;
    touchInfoRef.current = { x: t.clientX, y: t.clientY, moved: false };
  };

  const onTouchMoveGeneric = (e) => {
    const t = e.touches && e.touches[0];
    if (!t) return;
    const dx = t.clientX - touchInfoRef.current.x;
    const dy = t.clientY - touchInfoRef.current.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) touchInfoRef.current.moved = true;
  };

  const shouldIgnoreTap = () => {
    const draggedRecently = (typeof window !== 'undefined' && window.__lastMealDragTime)
      ? (Date.now() - window.__lastMealDragTime) < 300
      : false;
    const draggingNow = (typeof window !== 'undefined' && window.__isMealDragging) ? true : false;
    return draggingNow || draggedRecently || touchInfoRef.current.moved;
  };

  const handleTap = (e, value) => {
    if (shouldIgnoreTap()) return;
    if (e?.type === 'touchend') {
      e.preventDefault();
      e.stopPropagation();
      lastTouchTimeRef.current = Date.now();
      setCutlery(value);
      return;
    }
    if (Date.now() - lastTouchTimeRef.current < 350) return;
    setCutlery(value);
  };
  return (
    <div className="bg-white p-4 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-3 text-gray-800">
        🍴 ¿Necesitas cubiertos?
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={(e) => handleTap(e, true)}
          onTouchStart={onTouchStartGeneric}
          onTouchMove={onTouchMoveGeneric}
          onTouchEnd={(e) => handleTap(e, true)}
          className={`
            p-3 rounded-lg text-base font-medium transition-all duration-200 ease-in-out
            focus:outline-none focus:ring-2 focus:ring-offset-2
            ${cutlery === true
              ? 'bg-green-200 text-green-800 border border-green-300 shadow-sm focus:ring-green-300'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 focus:ring-gray-300'}
            flex items-center justify-center text-center
          `}
          style={{ minHeight: '56px' }}
          aria-pressed={cutlery === true}
        >
          Sí, por favor
        </button>
        <button
          onClick={(e) => handleTap(e, false)}
          onTouchStart={onTouchStartGeneric}
          onTouchMove={onTouchMoveGeneric}
          onTouchEnd={(e) => handleTap(e, false)}
          className={`
            p-3 rounded-lg text-base font-medium transition-all duration-200 ease-in-out
            focus:outline-none focus:ring-2 focus:ring-offset-2
            ${cutlery === false
              ? 'bg-red-200 text-red-800 border border-red-300 shadow-sm focus:ring-red-300'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 focus:ring-gray-300'}
            flex items-center justify-center text-center
          `}
          style={{ minHeight: '56px' }}
          aria-pressed={cutlery === false}
        >
          No, gracias
        </button>
      </div>
    </div>
  );
};

export default CutlerySelector;