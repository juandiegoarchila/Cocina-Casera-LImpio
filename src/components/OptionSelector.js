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
  multiple = false,
  className = '',
  disabled = false
}) => {
  const [showReplacement, setShowReplacement] = React.useState(!!replacementSelected);

  const handleSelect = (option) => {
    if (disabled || option.isFinished) return;
    let updatedSelected;
    if (multiple) {
      const currentSelected = Array.isArray(selected) ? [...selected] : [];
      const optionIndex = currentSelected.findIndex(opt => opt.id === option.id);

      if (optionIndex > -1) {
        currentSelected.splice(optionIndex, 1);
      } else {
        currentSelected.push(option);
      }
      updatedSelected = currentSelected;
    } else {
      updatedSelected = option;
      if (option.name === 'Sin sopa' || option.name === 'Sin principio') {
        setShowReplacement(true);
      } else {
        setShowReplacement(false);
        if (onReplacementSelect) onReplacementSelect(null);
      }
    }
    onSelect(updatedSelected);
  };

  const handleReplacementSelect = (replacement) => {
    if (disabled || replacement.isFinished) return;
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
            disabled={disabled || option.isFinished}
            className={`relative p-2 rounded-lg text-sm font-medium transition-all duration-200 flex flex-col items-start text-left min-h-[40px] shadow-sm ${
              disabled || option.isFinished
                ? 'bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed'
                : (Array.isArray(selected) ? selected.some(opt => opt.id === option.id) : selected?.id === option.id)
                ? 'bg-green-200 text-green-800 border border-green-300'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
            aria-label={`Seleccionar ${option.name}`}
          >
            <span className="truncate flex items-center">
              {option.emoji && <span className="mr-1 text-base">{option.emoji}</span>}
              {option.name.replace(' NUEVO', '')}
            </span>
            {option.description && (
              <span className="text-xs text-gray-500 mt-1">{option.description}</span>
            )}
            {option.isNew && !option.isFinished && (
              <span className="absolute top-0 right-7 transform translate-x-1/2 -translate-y-1/2 bg-red-500 text-white text-[10px] font-semibold rounded-full px-2 py-0.5">
                NUEVO
              </span>
            )}
            {option.isFinished && (
              <span className="absolute top-0 right-7 transform translate-x-1/2 -translate-y-1/2 bg-gray-500 text-white text-[10px] font-semibold rounded-full px-2 py-0.5">
                AGOTADO
              </span>
            )}
          </button>
        ))}
      </div>
      {(showReplacement || replacementSelected) && replacements && (
        <div className="mt-2 pl-2 border-l-2 border-green-200">
          <h4 className="text-[10px] font-medium mb-1 text-gray-600">Reemplazo:</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {replacements.map(replacement => (
              <button
                key={replacement.id}
                onClick={() => handleReplacementSelect(replacement)}
                disabled={disabled || replacement.isFinished}
                className={`relative p-2 rounded-lg text-sm font-medium transition-all duration-200 flex flex-col items-start text-left min-h-[40px] shadow-sm ${
                  disabled || replacement.isFinished
                    ? 'bg-gray-200 text-gray-400 border border-gray-300 cursor-not-allowed'
                    : replacementSelected?.id === replacement.id
                    ? 'bg-green-200 text-green-800 border border-green-300'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
                aria-label={`Seleccionar reemplazo ${replacement.name}`}
              >
                <span className="truncate flex items-center">
                  {replacement.emoji && <span className="mr-1 text-base">{replacement.emoji}</span>}
                  {replacement.name}
                </span>
                {replacement.description && (
                  <span className="text-xs text-gray-500 mt-1">{replacement.description}</span>
                )}
                {replacement.isNew && !replacement.isFinished && (
                  <span className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 bg-red-500 text-white text-[10px] font-semibold rounded-full px-2 py-0.5">
                    NUEVO
                  </span>
                )}
                {replacement.isFinished && (
                  <span className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 bg-gray-500 text-white text-[10px] font-semibold rounded-full px-2 py-0.5">
                    AGOTADO
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