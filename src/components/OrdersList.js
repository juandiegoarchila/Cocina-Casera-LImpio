//src/components/OrdersList.js
import React from 'react';

const OrdersList = ({ orders }) => {
  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div key={order.id} className="bg-white rounded-xl shadow-md p-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-lg">Pedido #{order.id}</h3>
            <span className={`px-3 py-1 rounded-full text-sm ${
              order.status === 'Completado' ? 'bg-green-100 text-green-800' :
              order.status === 'En preparación' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {order.status}
            </span>
          </div>
          <p className="text-gray-600 mb-4">Cliente: {order.customer}</p>
          <div className="space-y-2">
            {order.items.map((item, index) => (
              <div key={index} className="flex justify-between">
                <span className="text-gray-700">{item.name}</span>
                <span className="text-gray-700">x{item.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default OrdersList;