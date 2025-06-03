import React, { useState, useEffect, useCallback } from 'react';

// Use viewport width to determine if the device is mobile (below 768px)
export const isMobile = () => window.innerWidth < 768;

const OptionSelector = ({
  title,
  emoji,
  options = [],
  selected = [],
  showReplacements: propShowReplacements = false,
  replacements = [],
  multiple = false,
  className = '',
  disabled = false,
  showConfirmButton = false,
  onConfirm = () => {},
  onImmediateSelect = () => {},
  onImmediateReplacementSelect = () => {},
  onAdd = () => {},
  onRemove = () => {},
  onIncrease = () => {},
}) => {
  const [showReplacement, setShowReplacement] = useState(propShowReplacements);
  const [pendingSelection, setPendingSelection] = useState(
    multiple ? (Array.isArray(selected) ? selected : []) : selected
  );
  const [currentConfiguring, setCurrentConfiguring] = useState(null);
  const [showWarning, setShowWarning] = useState(false);

  // Initialize pendingSelection with the current selections
  useEffect(() => {
    setPendingSelection(multiple ? (Array.isArray(selected) ? selected : []) : selected);
    console.log('[OptionSelector] Initialized pendingSelection:', multiple ? (Array.isArray(selected) ? selected : []) : selected);
  }, [selected, multiple]);

  // Update showReplacement based on selection
  useEffect(() => {
    let shouldShow = propShowReplacements;
    if (title === 'Adiciones (por almuerzo)') {
      const needsReplacement = pendingSelection.some(
        (opt) => opt.requiresReplacement && !opt.protein && !opt.replacement
      );
      shouldShow = needsReplacement;
      if (needsReplacement && !currentConfiguring) {
        const unconfigured = pendingSelection.find(
          (opt) => opt.requiresReplacement && !opt.protein && !opt.replacement
        );
        if (unconfigured) {
          setCurrentConfiguring(unconfigured.id);
        }
      }
    } else if (title === 'Sopa') {
      shouldShow = pendingSelection?.name === 'Remplazo por Sopa';
    } else if (title === 'Principio') {
      shouldShow = (multiple && Array.isArray(pendingSelection) && pendingSelection.some((opt) => opt.name === 'Remplazo por Principio')) ||
                   (!multiple && pendingSelection?.name === 'Remplazo por Principio');
    }
    setShowReplacement(shouldShow);
    console.log(
      '[OptionSelector] showReplacement updated:',
      shouldShow,
      'for pendingSelection:',
      pendingSelection,
      'replacements:',
      replacements,
      'title:',
      title
    );
  }, [propShowReplacements, pendingSelection, title, replacements, currentConfiguring, multiple]);

  // Validate selections, but do not remove those being configured
  useEffect(() => {
    if (title === 'Adiciones (por almuerzo)') {
      const validSelections = pendingSelection.filter((opt) => {
        if (opt.requiresReplacement && opt.id !== currentConfiguring) {
          return opt.name === 'Proteína adicional' ? !!opt.protein : !!opt.replacement;
        }
        return true;
      });
      if (validSelections.length !== pendingSelection.length) {
        setPendingSelection(validSelections);
        onImmediateSelect(validSelections);
        console.log('[OptionSelector] Cleaned invalid selections:', validSelections);
      }
    }
  }, [pendingSelection, title, onImmediateSelect, currentConfiguring]);

  // Show warning if an addition is incomplete when collapsing
  const handleCollapseCheck = () => {
    const hasIncompleteAddition = pendingSelection.some(
      (opt) =>
        opt.requiresReplacement &&
        !opt.protein &&
        !opt.replacement &&
        opt.id === currentConfiguring
    );
    setShowWarning(hasIncompleteAddition);
    return hasIncompleteAddition;
  };

  // Check if confirm button is disabled
  const isConfirmDisabled = useCallback(() => {
    if (!showConfirmButton) return false;
    if (title === 'Principio' && multiple) {
      if (pendingSelection.some((opt) => opt.name === 'Remplazo por Principio')) {
        return !pendingSelection[0]?.replacement;
      }
      const hasSpecialRice = pendingSelection.some(opt => ['Arroz con pollo', 'Arroz paisa', 'Arroz tres carnes'].includes(opt.name));
      return hasSpecialRice ? pendingSelection.length > 1 : pendingSelection.length === 0 || pendingSelection.length > 2;
    }
    return multiple ? pendingSelection.length === 0 : !pendingSelection;
  }, [pendingSelection, showConfirmButton, title, multiple]);

  // Handle option click
  const handleOptionClick = (option) => {
    if (disabled || option.isFinished) return;

    let updatedSelection = multiple ? [...pendingSelection] : null;
    const isCurrentlySelected = multiple
      ? updatedSelection.some((opt) => opt.id === option.id)
      : pendingSelection?.id === option.id;

    const toggleableOptions = [
      'Remplazo por Principio',
      'Remplazo por Sopa',
      'Proteína adicional',
      'Sopa adicional',
      'Principio adicional',
    ];

    if (title === 'Adiciones (por almuerzo)') {
      if (isCurrentlySelected) {
        updatedSelection = updatedSelection.filter((opt) => opt.id !== option.id);
        onRemove(option.id);
        if (currentConfiguring === option.id) {
          setCurrentConfiguring(null);
          setShowWarning(false);
        }
        setShowReplacement(false);
      } else {
        const newOption = { ...option, quantity: 1 };
        updatedSelection.push(newOption);
        onAdd(newOption);
        if (option.requiresReplacement) {
          setCurrentConfiguring(option.id);
          setShowReplacement(true);
        }
      }
      setPendingSelection(updatedSelection);
      onImmediateSelect(updatedSelection);
    } else {
      let shouldShowReplacement = false;
      if (toggleableOptions.includes(option.name)) {
        if (isCurrentlySelected) {
          if (multiple) {
            updatedSelection = updatedSelection.filter((opt) => opt.id !== option.id);
          } else {
            updatedSelection = null;
          }
          if (title === 'Sopa' || title === 'Principio') {
            onImmediateReplacementSelect(null);
          }
          shouldShowReplacement = false;
        } else {
          shouldShowReplacement = option.name === 'Remplazo por Sopa' || option.name === 'Remplazo por Principio';
          if (multiple) {
            // For Principio: Clear other selections when selecting "Remplazo por Principio"
            if (title === 'Principio' && option.name === 'Remplazo por Principio') {
              updatedSelection = [option];
            } else {
              updatedSelection.push(option);
            }
          } else {
            updatedSelection = option;
          }
        }
      } else {
        shouldShowReplacement = false;
        if (title === 'Sopa' || title === 'Principio') {
          onImmediateReplacementSelect(null);
        }
        if (title === 'Principio' && multiple) {
          const isSpecialRice = ['Arroz con pollo', 'Arroz paisa', 'Arroz tres carnes'].includes(option.name);
          const hasSpecialRice = updatedSelection.some(opt => ['Arroz con pollo', 'Arroz paisa', 'Arroz tres carnes'].includes(opt.name));

          if (isSpecialRice) {
            if (isCurrentlySelected) {
              // Deselect the special rice dish, allowing non-rice principles to be selected
              updatedSelection = updatedSelection.filter((opt) => opt.id !== option.id);
            } else {
              // If selecting a special rice dish, clear all other selections and set only this rice
              updatedSelection = [option];
            }
          } else {
            // For non-rice principles
            if (hasSpecialRice) {
              // If a special rice dish is already selected, deselect it to allow non-rice principles
              updatedSelection = updatedSelection.filter(opt => !['Arroz con pollo', 'Arroz paisa', 'Arroz tres carnes'].includes(opt.name));
            }
            const optionIndex = updatedSelection.findIndex((opt) => opt.id === option.id);
            if (optionIndex > -1) {
              updatedSelection.splice(optionIndex, 1);
            } else if (updatedSelection.length < 2) {
              updatedSelection.push(option);
            }
          }
        } else if (multiple) {
          const optionIndex = updatedSelection.findIndex((opt) => opt.id === option.id);
          if (optionIndex > -1) {
            updatedSelection.splice(optionIndex, 1);
          } else {
            updatedSelection.push(option);
          }
        } else {
          updatedSelection = option;
        }
      }
      setPendingSelection(updatedSelection);
      onImmediateSelect(updatedSelection);
      setShowReplacement(shouldShowReplacement);
    }
  };

  // Handle replacement click
  const handleReplacementClick = (replacement) => {
    if (disabled || replacement.isFinished) return;

    if (title === 'Adiciones (por almuerzo)') {
      if (currentConfiguring) {
        const updatedSelection = pendingSelection.map((opt) => {
          if (opt.id === currentConfiguring) {
            return {
              ...opt,
              protein: opt.name === 'Proteína adicional' ? replacement.name : opt.protein,
              replacement:
                opt.name === 'Sopa adicional' || opt.name === 'Principio adicional'
                  ? replacement.name
                  : opt.replacement,
            };
          }
          return opt;
        });
        setPendingSelection(updatedSelection);
        onImmediateSelect(updatedSelection);
        onImmediateReplacementSelect({ id: currentConfiguring, replacement });
        setCurrentConfiguring(null);
        const nextUnconfigured = updatedSelection.find(
          (opt) => opt.requiresReplacement && !opt.protein && !opt.replacement
        );
        if (nextUnconfigured) {
          setCurrentConfiguring(nextUnconfigured.id);
          setShowReplacement(true);
        } else {
          setShowReplacement(false);
        }
      }
    } else if (title === 'Sopa' || title === 'Principio') {
      const updatedSelection = multiple
        ? pendingSelection.map((opt) => ({
            ...opt,
            replacement:
              opt.name === 'Remplazo por Sopa' || opt.name === 'Remplazo por Principio'
                ? replacement.name
                : opt.replacement,
          }))
        : { ...pendingSelection, replacement: replacement.name };
      setPendingSelection(updatedSelection);
      onImmediateSelect(updatedSelection);
      onImmediateReplacementSelect(replacement);
      setShowReplacement(false);
      // For Principio: Auto-confirm after selecting a replacement
      if (title === 'Principio') {
        onConfirm({ selection: updatedSelection, replacement });
      }
    }
  };

  // Cancel replacement selection
  const handleCancelReplacement = () => {
    if (title === 'Adiciones (por almuerzo)' && currentConfiguring) {
      const updatedSelection = pendingSelection.filter((opt) => opt.id !== currentConfiguring);
      setPendingSelection(updatedSelection);
      onImmediateSelect(updatedSelection);
      onRemove(currentConfiguring);
      setCurrentConfiguring(null);
      setShowWarning(false);
      setShowReplacement(false);
    }
  };

  // Deselect an addition or option
  const handleDeselect = () => {
    if (title === 'Adiciones (por almuerzo)' && currentConfiguring) {
      const updatedSelection = pendingSelection.filter((opt) => opt.id !== currentConfiguring);
      setPendingSelection(updatedSelection);
      onImmediateSelect(updatedSelection);
      onRemove(currentConfiguring);
      setCurrentConfiguring(null);
      setShowWarning(false);
      setShowReplacement(false);
    } else if (title === 'Sopa' || title === 'Principio') {
      setPendingSelection(multiple ? [] : null);
      onImmediateSelect(multiple ? [] : null);
      onImmediateReplacementSelect(null);
      setShowReplacement(false);
    }
  };

  // Confirm selection for cases with confirm button
  const handleConfirm = () => {
    if (showConfirmButton && onConfirm) {
      onConfirm({ selection: pendingSelection, replacement: null });
    }
  };

  // Check if an option is selected
  const isOptionSelected = useCallback(
    (option) => {
      const currentCheckSelection = showConfirmButton ? pendingSelection : selected;
      if (multiple) {
        return (
          Array.isArray(currentCheckSelection) &&
          currentCheckSelection.some((opt) => opt.id === option.id)
        );
      }
      return currentCheckSelection?.id === option.id;
    },
    [pendingSelection, selected, showConfirmButton, multiple]
  );

  // Get the quantity of an option
  const getOptionQuantity = (option) => {
    if (title === 'Adiciones (por almuerzo)') {
      const selectedOption = pendingSelection.find((opt) => opt.id === option.id);
      return selectedOption ? (selectedOption.quantity || 1) : 0;
    }
    return 0;
  };

  // Check if a replacement is selected
  const isReplacementSelected = useCallback(
    (replacement) => {
      if (title === 'Adiciones (por almuerzo)') {
        const selectedOption = pendingSelection.find((opt) => opt.id === currentConfiguring);
        return (
          selectedOption &&
          (selectedOption.protein === replacement.name ||
            selectedOption.replacement === replacement.name)
        );
      } else if (title === 'Sopa' || title === 'Principio') {
        return (
          pendingSelection?.replacement === replacement.name ||
          (Array.isArray(pendingSelection) &&
            pendingSelection.some((opt) => opt.replacement === replacement.name)) ||
          selected?.replacement?.name === replacement.name
        );
      }
      return false;
    },
    [pendingSelection, selected, currentConfiguring, title]
  );

  // Parse display text and extract description if name includes "(Nuevo)"
  const getDisplayText = (option) => {
    const selectedOption = multiple
      ? Array.isArray(pendingSelection)
        ? pendingSelection.find((opt) => opt.id === option.id)
        : null
      : pendingSelection;

    if (!selectedOption) return option.name;

    let baseName = option.name;
    let isNew = option.isNew || false;

    // Parse "(Nuevo)" from name if present
    if (baseName.includes('(Nuevo)')) {
      baseName = baseName.replace(' (Nuevo)', '');
      isNew = true;
    }

    if (title === 'Adiciones (por almuerzo)') {
      if (option.name === 'Proteína adicional' && selectedOption.protein) {
        return `${baseName} (${selectedOption.protein})`;
      }
      if (
        (option.name === 'Sopa adicional' || option.name === 'Principio adicional') &&
        selectedOption.replacement
      ) {
        return `${baseName} (${selectedOption.replacement})`;
      }
    } else if (
      (title === 'Sopa' && option.name === 'Remplazo por Sopa' && selectedOption.replacement) ||
      (title === 'Principio' && option.name === 'Remplazo por Principio' && selectedOption.replacement)
    ) {
      return `${baseName} (${selectedOption.replacement})`;
    }
    return baseName;
  };

  const mobileLayout = (option, index, isSelected, quantity) => (
    <div key={option.id || index} className="relative">
      <button
        onClick={() => handleOptionClick(option)}
        disabled={disabled || option.isFinished}
        className={`relative w-full p-2 rounded-t-lg text-sm font-medium transition-all duration-200 flex flex-col items-start justify-between text-left min-h-[60px] shadow-sm ${
          disabled || option.isFinished
            ? 'bg-gray-100 text-gray-400 border border-gray-300 cursor-not-allowed'
            : isSelected
            ? 'bg-green-200 text-green-800 border border-green-300'
            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
        } ${
          (title === 'Adiciones (por almuerzo)' && currentConfiguring === option.id && showReplacement) ||
          ((title === 'Sopa' || title === 'Principio') && option.name.includes('Remplazo') && showReplacement)
            ? 'rounded-b-none'
            : 'rounded-b-lg'
        }`}
        aria-label={`Seleccionar ${option.name}${isSelected ? ' (seleccionado)' : ''}`}
      >
        <div className="flex items-center w-full">
          {option.emoji && <span className="mr-2 text-base sm:text-sm">{option.emoji}</span>}
          <div className="flex-grow">
            {getDisplayText(option)}
          </div>
          {isSelected && title !== 'Adiciones (por almuerzo)' && (
            <svg className="h-4 w-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
        {option.description && (
          <span className="text-xs text-gray-500 block mt-1">{option.description}</span>
        )}
        {title === 'Adiciones (por almuerzo)' && isSelected && (
          <div className="flex items-center space-x-1 mt-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(option.id);
              }}
              className="text-red-500 hover:text-red-700"
              aria-label={`Disminuir cantidad de ${option.name}`}
            >
              <span role="img" aria-label="Remove">🗑️</span>
            </button>
            <span className="text-sm">{quantity}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onIncrease(option.id);
              }}
              className="text-green-500 hover:text-green-700"
              aria-label={`Aumentar cantidad de ${option.name}`}
            >
              <span role="img" aria-label="Add">➕</span>
            </button>
          </div>
        )}
      </button>
      {((title === 'Adiciones (por almuerzo)' && currentConfiguring === option.id && showReplacement) ||
        ((title === 'Sopa' || title === 'Principio') && option.name.includes('Remplazo') && showReplacement)) &&
        replacements.length > 0 && (
          <div className="bg-green-50 p-2 rounded-b-lg border border-t-0 border-green-300 shadow-sm">
            <div className="flex justify-between items-center mb-1">
              <h4 className="text-[10px] font-medium text-gray-600">
                Selecciona tu opción para {option.name}:
              </h4>
              <div>
                {title === 'Adiciones (por almuerzo)' && (
                  <button
                    onClick={handleCancelReplacement}
                    className="text-red-600 hover:text-red-700 text-xs mr-2"
                    aria-label="Cancelar selección"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={handleDeselect}
                  className="text-red-600 hover:text-red-700 text-xs"
                  aria-label="Deseleccionar opción"
                >
                  Deseleccionar
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1">
              {replacements.map((replacement, idx) => (
                <div key={replacement.id || idx} className="relative">
                  <button
                    onClick={() => handleReplacementClick(replacement)}
                    disabled={disabled || replacement.isFinished}
                    className={`relative w-full p-2 rounded-lg text-sm font-medium transition-all duration-200 flex flex-col items-start text-left min-h-[60px] shadow-sm ${
                      disabled || replacement.isFinished
                        ? 'bg-gray-100 text-gray-400 border border-gray-300 cursor-not-allowed'
                        : isReplacementSelected(replacement)
                        ? 'bg-green-200 text-green-800 border border-green-300'
                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                    }`}
                    aria-label={`Seleccionar opción ${replacement.name}${isReplacementSelected(replacement) ? ' (seleccionado)' : ''}`}
                  >
                    <div className="flex items-center w-full">
                      {replacement.emoji && (
                        <span className="mr-2 text-base sm:text-sm">{replacement.emoji}</span>
                      )}
                      <div className="flex-grow">
                        {getDisplayText(replacement)}
                      </div>
                      {isReplacementSelected(replacement) && (
                        <svg className="ml-2 h-4 w-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    {replacement.description && (
                      <span className="text-xs text-gray-500 block mt-1">{replacement.description}</span>
                    )}
                  </button>
                  {replacement.isNew && !replacement.isFinished && (
                    <span className="absolute top-0 right-7 transform translate-x-1/2 -translate-y-1/2 bg-red-500 text-white text-[10px] font-semibold rounded-full px-2 py-0.5">
                      NUEVO
                    </span>
                  )}
                  {replacement.isFinished && (
                    <span className="absolute top-0 right-7 transform translate-x-1/2 -translate-y-1/2 bg-gray-500 text-white text-[10px] font-semibold rounded-full px-2 py-0.5">
                      AGOTADO
                    </span>
                  )}
                </div>
              ))}
            </div>
            {showWarning && (
              <p className="text-[10px] text-red-600 bg-red-50 p-1 rounded mt-1">
                Por favor, selecciona una opción o deselecciona la adición antes de cerrar.
              </p>
            )}
          </div>
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
    </div>
  );

  const pcLayout = (option, index, isSelected, quantity) => (
    <div key={option.id || index} className="relative">
      <button
        onClick={() => handleOptionClick(option)}
        disabled={disabled || option.isFinished}
        className={`relative w-full p-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-between text-left min-h-[60px] shadow-sm ${
          disabled || option.isFinished
            ? 'bg-gray-100 text-gray-400 border border-gray-300 cursor-not-allowed'
            : isSelected
            ? 'bg-green-200 text-green-800 border border-green-300'
            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
        }`}
        aria-label={`Seleccionar ${option.name}${isSelected ? ' (seleccionado)' : ''}`}
      >
        <div className="flex items-center flex-grow">
          {option.emoji && <span className="mr-2 text-base sm:text-sm">{option.emoji}</span>}
          <div>
            {getDisplayText(option)}
            {option.description && (
              <span className="text-xs text-gray-500 block mt-1">{option.description}</span>
            )}
          </div>
        </div>
        {title === 'Adiciones (por almuerzo)' && isSelected && (
          <div className="flex items-center space-x-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(option.id);
              }}
              className="text-red-500 hover:text-red-700"
              aria-label={`Disminuir cantidad de ${option.name}`}
            >
              <span role="img" aria-label="Remove">🗑️</span>
            </button>
            <span className="text-sm">{quantity}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onIncrease(option.id);
              }}
              className="text-green-500 hover:text-green-700"
              aria-label={`Aumentar cantidad de ${option.name}`}
            >
              <span role="img" aria-label="Add">➕</span>
            </button>
          </div>
        )}
        {isSelected && title !== 'Adiciones (por almuerzo)' && (
          <svg className="h-4 w-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>
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
    </div>
  );

  return (
    <div className={`mb-2 ${className}`}>
      {title && title !== 'Adiciones (por almuerzo)' && (
        <h3 className="text-sm font-semibold mb-2 flex items-center text-gray-700">
          <span className="mr-1">{emoji}</span>
          {title}
        </h3>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {options.map((option, index) => {
          const isSelected = isOptionSelected(option);
          const quantity = getOptionQuantity(option);
          return isMobile() ? mobileLayout(option, index, isSelected, quantity) : pcLayout(option, index, isSelected, quantity);
        })}
      </div>
      {showReplacement && replacements.length > 0 && !isMobile() && (
        <div className="mt-2 pl-2 border-l-2 border-green-200">
          <div className="flex justify-between items-center mb-1">
            <h4 className="text-[10px] font-medium text-gray-600">
              Selecciona tu opción para{' '}
              {title === 'Adiciones (por almuerzo)'
                ? options.find((opt) => opt.id === currentConfiguring)?.name || title
                : title === 'Sopa'
                ? 'Remplazo por Sopa'
                : 'Remplazo por Principio'}:
            </h4>
            <div>
              {title === 'Adiciones (por almuerzo)' && (
                <button
                  onClick={handleCancelReplacement}
                  className="text-red-600 hover:text-red-700 text-xs mr-2"
                  aria-label="Cancelar selección"
                >
                  Cancelar
                </button>
              )}
              <button
                onClick={handleDeselect}
                className="text-red-600 hover:text-red-700 text-xs"
                aria-label="Deseleccionar opción"
              >
                Deseleccionar
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {replacements.map((replacement, index) => (
              <div key={replacement.id || index} className="relative">
                <button
                  onClick={() => handleReplacementClick(replacement)}
                  disabled={disabled || replacement.isFinished}
                  className={`relative w-full p-2 rounded-lg text-sm font-medium transition-all duration-200 flex flex-col items-start text-left min-h-[60px] shadow-sm ${
                    disabled || replacement.isFinished
                      ? 'bg-gray-100 text-gray-400 border border-gray-300 cursor-not-allowed'
                      : isReplacementSelected(replacement)
                      ? 'bg-green-200 text-green-800 border border-green-300'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                  }`}
                  aria-label={`Seleccionar opción ${replacement.name}${isReplacementSelected(replacement) ? ' (seleccionado)' : ''}`}
                >
                  <div className="flex items-center w-full">
                    {replacement.emoji && (
                      <span className="mr-2 text-base sm:text-sm">{replacement.emoji}</span>
                    )}
                    <span className="flex-grow">{getDisplayText(replacement)}</span>
                    {isReplacementSelected(replacement) && (
                      <svg className="h-4 w-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  {replacement.description && (
                    <span className="text-xs text-gray-500 block mt-1">{replacement.description}</span>
                  )}
                </button>
                {replacement.isNew && !replacement.isFinished && (
                  <span className="absolute top-0 right-7 transform translate-x-1/2 -translate-y-1/2 bg-red-500 text-white text-[10px] font-semibold rounded-full px-2 py-0.5">
                    NUEVO
                  </span>
                )}
                {replacement.isFinished && (
                  <span className="absolute top-0 right-7 transform translate-x-1/2 -translate-y-1/2 bg-gray-500 text-white text-[10px] font-semibold rounded-full px-2 py-0.5">
                    AGOTADO
                  </span>
                )}
              </div>
            ))}
          </div>
          {showWarning && (
            <p className="text-[10px] text-red-600 bg-red-50 p-1 rounded mt-1">
              Por favor, selecciona una opción o deselecciona la adición antes de cerrar.
            </p>
          )}
        </div>
      )}
      {multiple && title === 'Principio' && (
        <div className="mt-1 text-sm sm:text-base text-gray-600 font-semibold">
          {pendingSelection?.some((opt) => opt?.name === 'Remplazo por Principio')
            ? 'Selecciona tu reemplazo por principio entre las opciones disponibles.'
            : 'Puedes seleccionar hasta dos principios. (Mixto)'}
        </div>
      )}
      {multiple && title === 'Adiciones (por almuerzo)' && (
        <div className="mt-1 text-xs text-gray-500">
          Selecciona los extras para este almuerzo. (Opcional)
        </div>
      )}
      {multiple && title === 'Acompañamiento' && (
        <div className="mt-1 text-xs text-gray-500">
        </div>
      )}
      {showConfirmButton && (
        <button
          onClick={handleConfirm}
          disabled={isConfirmDisabled()}
          className={`mt-2 bg-green-500 hover:bg-green-600 text-white px-4 py-1 rounded-lg text-xs transition-colors duration-200 ${
            isConfirmDisabled() ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          aria-label={`Confirmar ${title}`}
        >
          Confirmar Principio
        </button>
      )}
    </div>
  );
};

export default React.memo(OptionSelector);