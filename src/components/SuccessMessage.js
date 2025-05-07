//src/components/SuccessMessage.js
import React from 'react';

const SuccessMessage = ({ message }) => (
  <div role="alert" className="rounded-md bg-green-50 p-3 mb-2 shadow-lg max-w-sm">
    <div className="flex">
      <div className="flex-shrink-0">
        <svg className="h-4 w-4 text-green-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="ml-2">
        <h3 className="text-xs font-medium text-green-800">Éxito</h3>
        <div className="mt-1 text-xs text-green-700">
          <p>{message}</p>
        </div>
      </div>
    </div>
  </div>
);

export default SuccessMessage;