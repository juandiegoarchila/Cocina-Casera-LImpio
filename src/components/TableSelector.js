// src/components/TableSelector.js
import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

const TableSelector = ({ selectedTable, onSelectTable }) => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Cargar las mesas desde Firestore
    const tablesQuery = query(collection(db, 'tables'), orderBy('createdAt', 'asc'));
    
    const unsubscribe = onSnapshot(tablesQuery, 
      (snapshot) => {
        const tablesList = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));
        setTables(tablesList);
        setLoading(false);
      },
      (err) => {
        console.error("Error cargando mesas:", err);
        setError("Error al cargar las mesas. Por favor, intenta de nuevo.");
        setLoading(false);
      }
    );
    
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="text-center p-4">Cargando mesas...</div>;
  }

  if (error) {
    return <div className="text-red-500 p-2 text-center">{error}</div>;
  }

  // Si no hay mesas configuradas, mostrar un mensaje y un campo de entrada tradicional
  if (tables.length === 0) {
    return (
      <div>
        <p className="text-sm text-yellow-600 mb-2">
          No hay mesas configuradas. Por favor, ingresa manualmente el número de mesa.
        </p>
        <input
          type="text"
          value={selectedTable || ''}
          onChange={(e) => onSelectTable(e.target.value)}
          placeholder="Ej. Mesa 1, Mesa 1 y 7"
          className="w-full p-2 text-sm border rounded-md"
        />
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-600 mb-2">
        Selecciona una mesa:
      </p>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {tables.map((table) => (
          <button
            key={table.id}
            onClick={() => onSelectTable(table.name)}
            className={`p-2 rounded-lg text-center text-sm transition-all duration-200 ${
              selectedTable === table.name
                ? 'bg-green-200 text-green-800 border border-green-300 font-medium shadow-md'
                : 'bg-gray-100 hover:bg-green-50 hover:border hover:border-green-200 text-gray-800'
            }`}
          >
            {table.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TableSelector;
