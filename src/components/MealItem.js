import React, { useState, useEffect, useRef } from 'react';
import OptionSelector from './OptionSelector';
import TimeSelector from './TimeSelector';
import AddressInput from './AddressInput';
import PaymentSelector from './PaymentSelector';
import CutlerySelector from './CutlerySelector';
import ProgressBar from './ProgressBar';
import OnboardingTutorial from './OnboardingTutorial';

const MealItem = ({ 
  id,
  meal,
  onMealChange,
  onRemoveMeal,
  onDuplicateMeal,
  soups = [],
  soupReplacements = [],
  principles = [],
  proteins = [],
  drinks = [],
  sides = [],
  times = [],
  paymentMethods = [],
  isIncomplete = false,
  incompleteSlideIndex = null,
  address = '',
  showTutorial,
  setShowTutorial
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [collapseTimeout, setCollapseTimeout] = useState(null);
  const [touchStartX, setTouchStartX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const slideRef = useRef(null);
  const containerRef = useRef(null);
  const nextButtonRef = useRef(null);
  const prevButtonRef = useRef(null);

  const isSoupComplete = meal?.soup && (meal.soup?.name !== 'Sin sopa' || meal?.soupReplacement);
  const isPrincipleComplete = meal?.principle && (meal.principle?.name !== 'Sin principio' || meal?.principleReplacement);
  const isSidesComplete = Array.isArray(meal?.sides) && meal.sides.length > 0;
  const isComplete = isSoupComplete && isPrincipleComplete && meal?.protein && meal?.drink && meal?.time && meal?.address && meal?.payment && meal?.cutlery && isSidesComplete;

  const completionPercentage = Math.round(
    ([
      isSoupComplete,
      isPrincipleComplete,
      meal?.protein,
      meal?.drink,
      meal?.cutlery,
      meal?.time,
      meal?.address,
      meal?.payment,
      isSidesComplete
    ].filter(Boolean).length / 9) * 100
  );

  const slides = [
    {
      component: (
        <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 shadow-sm slide-item">
          <OptionSelector
            title="Sopa"
            emoji="🥣"
            options={soups}
            selected={meal?.soup}
            onSelect={(option) => handleChange('soup', option)}
            showReplacements={meal?.soup?.name === 'Sin sopa'}
            replacements={soupReplacements}
            replacementSelected={meal?.soupReplacement}
            onReplacementSelect={(option) => handleChange('soupReplacement', option)}
          />
        </div>
      ),
      isComplete: isSoupComplete,
      label: 'Sopa'
    },
    {
      component: (
        <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 shadow-sm slide-item">
          <OptionSelector
            title="Principio"
            emoji="🍚"
            options={principles}
            selected={meal?.principle}
            onSelect={(option) => handleChange('principle', option)}
            showReplacements={meal?.principle?.name === 'Sin principio'}
            replacements={soupReplacements}
            replacementSelected={meal?.principleReplacement}
            onReplacementSelect={(option) => handleChange('principleReplacement', option)}
          />
        </div>
      ),
      isComplete: isPrincipleComplete,
      label: 'Principio'
    },
    {
      component: (
        <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 shadow-sm slide-item">
          <OptionSelector
            title="Proteína"
            emoji="🍗"
            options={proteins}
            selected={meal?.protein}
            onSelect={(option) => handleChange('protein', option)}
          />
        </div>
      ),
      isComplete: !!meal?.protein,
      label: 'Proteína'
    },
    {
      component: (
        <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 shadow-sm slide-item">
          <OptionSelector
            title="Bebida"
            emoji="🥤"
            options={drinks}
            selected={meal?.drink}
            onSelect={(option) => handleChange('drink', option)}
          />
        </div>
      ),
      isComplete: !!meal?.drink,
      label: 'Bebida'
    },
    {
      component: (
        <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 shadow-sm slide-item">
          <h4 className="text-sm font-semibold text-green-700 mb-2">Cubiertos</h4>
          <CutlerySelector
            cutlery={meal?.cutlery}
            setCutlery={(cutlery) => handleChange('cutlery', cutlery)}
          />
          {!meal?.cutlery && (
            <p className="text-[10px] text-red-600 bg-red-50 p-1 rounded mt-1">
              Por favor, selecciona si necesitas cubiertos
            </p>
          )}
        </div>
      ),
      isComplete: !!meal?.cutlery,
      label: 'Cubiertos'
    },
    {
      component: (
        <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 shadow-sm slide-item">
          <TimeSelector
            times={times}
            selectedTime={meal?.time}
            setSelectedTime={(time) => handleChange('time', time)}
          />
          {!meal?.time && (
            <p className="text-[10px] text-red-600 bg-red-50 p-1 rounded mt-1">
              Por favor, selecciona una hora
            </p>
          )}
        </div>
      ),
      isComplete: !!meal?.time,
      label: 'Hora'
    },
    {
      component: (
        <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 shadow-sm slide-item">
          {address && (
            <div className="mb-2 text-sm text-gray-600">
              ¿Deseas usar la misma dirección ({address}) o ingresar una nueva?
              <button onClick={() => handleChange('address', address)} className="ml-2 text-blue-500">Usar misma</button>
              <button onClick={() => handleChange('address', '')} className="ml-2 text-red-500">Cambiar</button>
            </div>
          )}
          <AddressInput
            address={meal?.address || ''}
            setAddress={(newAddress) => handleChange('address', newAddress)}
          />
          {meal?.address === '' && (
            <p className="text-[10px] text-red-600 bg-red-50 p-1 rounded mt-1">
              Por favor, ingresa una dirección
            </p>
          )}
        </div>
      ),
      isComplete: !!meal?.address,
      label: 'Dirección'
    },
    {
      component: (
        <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 shadow-sm slide-item">
          <h4 className="text-sm font-semibold text-green-700 mb-2">Método de Pago</h4>
          <PaymentSelector
            paymentMethods={paymentMethods}
            selectedPayment={meal?.payment}
            setSelectedPayment={(payment) => handleChange('payment', payment)}
          />
          {!meal?.payment && (
            <p className="text-[10px] text-red-600 bg-red-50 p-1 rounded mt-1">
              Por favor, selecciona un método de pago
            </p>
          )}
        </div>
      ),
      isComplete: !!meal?.payment,
      label: 'Método de pago'
    },
    {
      component: (
        <div className="bg-gradient-to-r from-green-50 to-green-100 p-3 shadow-sm slide-item">
          <OptionSelector
            title="Acompañamiento"
            emoji="🥗"
            options={sides}
            selected={Array.isArray(meal?.sides) ? meal.sides : []}
            onSelect={(options) => handleChange('sides', options)}
            multiple={true} // Asegurado que multiple sea true
          />
          {!isSidesComplete && (
            <p className="text-[10px] text-red-600 bg-red-50 p-1 rounded mt-1">
              Por favor, selecciona al menos un acompañamiento
            </p>
          )}
          <div className="mt-2 text-xs text-gray-500">
            Puedes seleccionar múltiples acompañamientos si lo deseas.
          </div>
          <div className="mt-2">
            <h4 className="text-sm font-semibold text-green-700 mb-1">Notas Adicionales</h4>
            <textarea
              value={meal?.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Ejemplo: Poquito arroz, sin cebolla, etc."
              className="w-full p-2 text-sm border rounded-md"
              rows="2"
            />
          </div>
        </div>
      ),
      isComplete: isSidesComplete,
      label: 'Acompañamiento'
    }
  ];

  const handleChange = (field, value) => {
    onMealChange(id, field, value);

    if (collapseTimeout) {
      clearTimeout(collapseTimeout);
      setCollapseTimeout(null);
    }

    const updatedMeal = { ...meal, [field]: value };
    const updatedIsSoupComplete = updatedMeal?.soup && (updatedMeal.soup?.name !== 'Sin sopa' || updatedMeal?.soupReplacement);
    const updatedIsPrincipleComplete = updatedMeal?.principle && (updatedMeal.principle?.name !== 'Sin principio' || updatedMeal?.principleReplacement);
    const updatedIsSidesComplete = Array.isArray(updatedMeal?.sides) && updatedMeal.sides.length > 0;
    const willBeComplete = updatedIsSoupComplete && updatedIsPrincipleComplete && updatedMeal?.protein && updatedMeal?.drink && updatedMeal?.time && updatedMeal?.address && updatedMeal?.payment && updatedMeal?.cutlery && updatedIsSidesComplete;

    if (willBeComplete) {
      const timeout = setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.style.height = '0';
        }
        setTimeout(() => setIsExpanded(false), 300);
      }, 2000);
      setCollapseTimeout(timeout);
      return;
    }

    if (field === 'sides' || field === 'notes') return;

    if ((field === 'soup' && value.name === 'Sin sopa' && !updatedMeal.soupReplacement) ||
        (field === 'principle' && value.name === 'Sin principio' && !updatedMeal.principleReplacement)) {
      return;
    }

    let isSlideComplete = false;
    switch (currentSlide) {
      case 0:
        isSlideComplete = updatedIsSoupComplete;
        break;
      case 1:
        isSlideComplete = updatedIsPrincipleComplete;
        break;
      case 2:
        isSlideComplete = !!updatedMeal?.protein;
        break;
      case 3:
        isSlideComplete = !!updatedMeal?.drink;
        break;
      case 4:
        isSlideComplete = !!updatedMeal?.cutlery;
        break;
      case 5:
        isSlideComplete = !!updatedMeal?.time;
        break;
      case 6:
        isSlideComplete = !!updatedMeal?.address;
        break;
      case 7:
        isSlideComplete = !!updatedMeal?.payment;
        break;
      case 8:
        isSlideComplete = updatedIsSidesComplete;
        break;
      default:
        break;
    }

    if (isSlideComplete && currentSlide < slides.length - 1) {
      setTimeout(() => setCurrentSlide(currentSlide + 1), 300);
    }
  };

  useEffect(() => {
    if (isIncomplete && incompleteSlideIndex !== null) {
      setIsExpanded(true);
      setCurrentSlide(incompleteSlideIndex);
    }
  }, [isIncomplete, incompleteSlideIndex]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Enter' && (currentSlide === 6 || currentSlide === 8)) {
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentSlide]);

  useEffect(() => {
    let timer;
    if (currentSlide === 5) {
      timer = setTimeout(() => {
        if (currentSlide < slides.length - 1) {
          setCurrentSlide(currentSlide + 1);
        }
      }, 3000);
    } else if (currentSlide === 8) {
      timer = setTimeout(() => {
        if (isComplete && containerRef.current) {
          containerRef.current.style.height = '0';
          setTimeout(() => setIsExpanded(false), 300);
        } else if (currentSlide < slides.length - 1) {
          setCurrentSlide(currentSlide + 1);
        }
      }, 20000);
    }
    return () => clearTimeout(timer);
  }, [currentSlide, isComplete]);

  useEffect(() => {
    const handleUpdateSlide = (event) => {
      if (event.detail && event.detail.slideIndex !== undefined) {
        setCurrentSlide(event.detail.slideIndex);
      }
    };

    const mealItem = document.getElementById(`meal-item-${id}`);
    if (mealItem) {
      mealItem.addEventListener('updateSlide', handleUpdateSlide);
    }

    return () => {
      if (mealItem) {
        mealItem.removeEventListener('updateSlide', handleUpdateSlide);
      }
      if (collapseTimeout) clearTimeout(collapseTimeout);
    };
  }, [id, collapseTimeout]);

  useEffect(() => {
    if (containerRef.current && slideRef.current && isExpanded) {
      const updateHeight = () => {
        if (slideRef.current && slideRef.current.children && slideRef.current.children[currentSlide]) {
          const slideHeight = slideRef.current.children[currentSlide].offsetHeight;
          containerRef.current.style.height = `${slideHeight + 8}px`;
        }
      };
      updateHeight();
    } else if (containerRef.current && !isExpanded) {
      containerRef.current.style.height = '0';
    }
  }, [currentSlide, meal, isExpanded]);

  const handleNext = () => {
    if (currentSlide < slides.length - 1 && slideRef.current) {
      setCurrentSlide(currentSlide + 1);
      slideRef.current.style.transform = `translateX(-${(currentSlide + 1) * 100}%)`;
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0 && slideRef.current) {
      setCurrentSlide(currentSlide - 1);
      slideRef.current.style.transform = `translateX(-${(currentSlide - 1) * 100}%)`;
    }
  };

  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
    setIsSwiping(false);
  };

  const handleTouchMove = (e) => {
    if (isSwiping || !slideRef.current) return;
    const touchX = e.touches[0].clientX;
    const diff = touchStartX - touchX;

    if (Math.abs(diff) > 100) {
      setIsSwiping(true);
      if (diff > 0 && currentSlide < slides.length - 1) {
        setCurrentSlide(currentSlide + 1);
        slideRef.current.style.transform = `translateX(-${(currentSlide + 1) * 100}%)`;
      } else if (diff < 0 && currentSlide > 0) {
        setCurrentSlide(currentSlide - 1);
        slideRef.current.style.transform = `translateX(-${(currentSlide - 1) * 100}%)`;
      }
    }
  };

  const handleTouchEnd = () => {
    setTouchStartX(0);
    setIsSwiping(false);
  };

  const handleSlideChange = (index) => {
    if (slideRef.current) {
      setCurrentSlide(index);
      slideRef.current.style.transform = `translateX(-${index * 100}%)`;
    }
  };

  const handleTutorialComplete = () => {
    setShowTutorial(false);
  };

  return (
    <div id={`meal-item-${id}`} className="relative bg-white rounded-lg shadow-md mb-2">
      {showTutorial && id === 0 && (
        <OnboardingTutorial run={showTutorial} onComplete={handleTutorialComplete} />
      )}
      <div 
        className="sticky top-0 z-[10000] bg-white p-2 border-b border-gray-200 rounded-t-lg"
        onClick={() => {
          if (!isExpanded) {
            setIsExpanded(true);
          } else if (containerRef.current) {
            containerRef.current.style.height = '0';
            setTimeout(() => setIsExpanded(false), 300);
          }
        }}
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer hover:bg-gray-50">
          <div className="flex items-center mb-1 sm:mb-0">
            <div className={`w-6 h-6 rounded-full mr-2 flex items-center justify-center ${isComplete ? 'bg-green-700 text-white' : 'bg-green-200 text-green-700'} text-xs font-medium`}>
              {isComplete ? '✓' : id + 1}
            </div>
            <div>
              <h3 className="font-medium text-sm text-gray-800">
                Almuerzo #{id + 1} - {meal?.protein?.name || 'Selecciona'}
              </h3>
              <ProgressBar progress={completionPercentage} className="w-24 sm:w-32 mt-1" />
            </div>
          </div>
          <div className="flex items-center space-x-1 mt-1 sm:mt-0">
            {isComplete && (
              <span className="hidden sm:inline-flex">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-200 text-green-700">Completo</span>
              </span>
            )}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onDuplicateMeal(meal);
              }}
              className="duplicate-button p-1 text-green-700 hover:text-green-800 flex items-center transition-colors"
              aria-label={`Duplicar Almuerzo #${id + 1}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              <span className="text-xs">Duplicar</span>
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onRemoveMeal(id);
              }}
              className="remove-button p-1 text-red-600 hover:text-red-700 flex items-center transition-colors"
              aria-label={`Eliminar Almuerzo #${id + 1}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-xs">Eliminar</span>
            </button>
          </div>
        </div>
      </div>
      {isExpanded && (
        <div className="p-2">
          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-lg"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ transition: 'height 0.3s ease-in-out', height: isExpanded ? '' : '0' }}
          >
            <div
              ref={slideRef}
              className="flex transition-transform duration-300 ease-in-out"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {slides.map((slide, index) => (
                <div key={index} className="w-full flex-shrink-0" style={{ height: 'fit-content' }}>
                  <div className="p-2" style={{ height: 'fit-content' }}>{slide.component}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-between items-center mt-1">
            <button
              ref={prevButtonRef}
              className="prev-button p-1 rounded-full text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handlePrev}
              disabled={currentSlide === 0}
              aria-label="Anterior"
            >
              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <div className="flex space-x-1">
              {slides.map((slide, index) => (
                <button
                  key={index}
                  onClick={() => handleSlideChange(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${currentSlide === index ? 'bg-green-700' : slide.isComplete ? 'bg-green-400' : 'bg-green-200'}`}
                  aria-label={`Ir a ${slide.label}`}
                  title={slide.label}
                />
              ))}
            </div>
            <button
              ref={nextButtonRef}
              className="next-button p-1 rounded-full text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleNext}
              disabled={currentSlide === slides.length - 1}
              aria-label="Siguiente"
            >
              <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MealItem;