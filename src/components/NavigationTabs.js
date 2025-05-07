//src/components/NavigationTabs.js
import React from 'react';

const NavigationTabs = ({ activeTab, setActiveTab }) => {
  return (
    <div className="flex border-b">
      <button
        onClick={() => setActiveTab('menu')}
        className={`px-6 py-3 font-medium ${activeTab === 'menu' ? 'text-black border-b-2 border-black' : 'text-gray-500'}`}
      >
        Menú
      </button>
      <button
        onClick={() => setActiveTab('orders')}
        className={`px-6 py-3 font-medium ${activeTab === 'orders' ? 'text-black border-b-2 border-black' : 'text-gray-500'}`}
      >
        Pedidos
      </button>
    </div>
  );
};

export default NavigationTabs;