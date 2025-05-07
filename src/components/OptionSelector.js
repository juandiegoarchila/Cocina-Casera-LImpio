//src/components/OptionSelector.js
import React from 'react';

const OptionSelector = ({ 
  title, 
  emoji, 
  options, 
  selected, 
  onSelect,
  showReplacements,
  replacements,
  replacementSelected,
  onReplacementSelect,
  className = ''
}) => {
  const [showReplacement, setShowReplacement] = React.useState(!!replacementSelected);

  const handleSelect = (option) => {
    onSelect(option);
    if (option.name === 'Sin sopa' || option.name === 'Sin principio') {
      setShowReplacement(true);
    } else {
      setShowReplacement(false);
      if (onReplacementSelect) onReplacementSelect(null);
    }
  };

  const handleReplacementSelect = (replacement) => {
    if (onReplacementSelect) onReplacementSelect(replacement);
  };

  return (
    <div className={`mb-2 ${className}`}>
      <h3 className="text-sm font-semibold mb-2 flex items-center text-gray-700">
        <span className="mr-1">{emoji}</span> 
        {title}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map(option => (
          <button
            key={option.id}
            onClick={() => handleSelect(option)}
            className={`relative p-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center text-center min-h-[40px] shadow-sm ${
              selected?.id === option.id
                ? 'bg-primary-200 text-primary-800 border border-primary-300'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
            aria-label={`Seleccionar ${option.name}`}
          >
            <span className="truncate flex items-center">
              {option.emoji && <span className="mr-1 text-base">{option.emoji}</span>}
              {option.name.replace(' NUEVO', '')}
            </span>
            {option.isNew && (
              <span className="absolute top-0 right-7 transform translate-x-1/2 -translate-y-1/2 bg-red-500 text-white text-[10px] font-semibold rounded-full px-2 py-0.5">
                NUEVO
              </span>
            )}
          </button>
        ))}
      </div>
      {(showReplacement || replacementSelected) && replacements && (
        <div className="mt-2 pl-2 border-l-2 border-primary-200">
          <h4 className="text-[10px] font-medium mb-1 text-gray-600">Reemplazo:</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {replacements.map(replacement => (
              <button
                key={replacement.id}
                onClick={() => handleReplacementSelect(replacement)}
                className={`relative p-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center text-center min-h-[40px] shadow-sm ${
                  replacementSelected?.id === replacement.id
                    ? 'bg-primary-200 text-primary-800 border border-primary-300'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
                aria-label={`Seleccionar reemplazo ${replacement.name}`}
              >
                <span className="truncate flex items-center">
                  {replacement.emoji && <span className="mr-1 text-base">{replacement.emoji}</span>}
                  {replacement.name}
                </span>
                {replacement.isNew && (
                  <span className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 bg-red-500 text-white text-[10px] font-semibold rounded-full px-2 py-0.5">
                    NUEVO
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OptionSelector;