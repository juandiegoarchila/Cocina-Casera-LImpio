import React, { useState, useEffect } from 'react';
import Joyride, { Step } from 'react-joyride';

/**
 * Define los pasos del tutorial de forma dinámica.
 * Los pasos de 'duplicar' y 'eliminar' se incluyen solo si la aplicación
 * se inicia con más de un almuerzo (simulando un escenario donde ya hay múltiples ítems).
 *
 * @param {number} mealsCount - El número actual de almuerzos en el pedido.
 * @returns {Array<Step>} Un array de objetos Step para Joyride.
 */
const getSteps = (mealsCount) => {
  let baseSteps = [
    {
      target: '.add-meal-button',
      content: 'Toca para **añadir tu almuerzo**. 🍽️',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '.slide-item',
      content: '**Desliza** para ver categorías (Sopa, Proteína...). 👉',
      placement: 'auto',
      disableBeacon: true,
    },
    {
      target: '.next-button',
      content: 'Usa la flecha para **avanzar**. ✨',
      placement: 'bottom',
    },
    {
      target: '.prev-button',
      content: 'Toca para **volver atrás**. ↩️',
      placement: 'bottom',
    },
    {
      target: '.order-summary',
      content: '**Resumen** de tu pedido aquí. 📝',
      // ********* CAMBIO CLAVE AQUÍ *********
      // Cambiado de 'top' a 'bottom' para evitar que empuje el contenido hacia abajo.
      placement: 'bottom',
    },
    {
      target: '.total-price',
      content: '**Valor total** a pagar. 💰',
      placement: 'top',
    },
    {
      target: '.send-order-button',
      content: '¡Toca para **enviar pedido por WhatsApp**! 🚀',
      placement: 'top',
    },
    {
      target: '.back-to-whatsapp',
      content: '**¿Primera vez?** Envía "Hola" a WhatsApp antes de pedir. 💬',
      placement: 'bottom',
    },
  ];

  // Si hay más de un almuerzo (al iniciar el tutorial), añadimos los pasos de duplicar y eliminar.
  // Esto simula que el usuario ya está manejando múltiples ítems.
  if (mealsCount > 1) {
    baseSteps.splice(4, 0, // Inserta en el índice 4 (después de 'volver atrás')
      {
        target: '.duplicate-button',
        content: '¡Toca para **duplicar este almuerzo**! 🍝',
        placement: 'bottom',
      },
      {
        target: '.remove-button',
        content: 'Toca para **eliminar este almuerzo**. 🗑️',
        placement: 'bottom',
      }
    );
  }

  return baseSteps;
};

const OnboardingTutorial = ({ run = true, onComplete, mealsCount }) => {
  // Estado para controlar la visibilidad del modal de bienvenida.
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  // Estado para controlar si Joyride debe ejecutarse (solo después de aceptar el modal de bienvenida).
  const [startJoyride, setStartJoyride] = useState(false);

  // Efecto para sincronizar el estado interno con la prop 'run' del componente padre.
  useEffect(() => {
    if (!run) {
      setShowWelcomeModal(false);
      setStartJoyride(false);
    }
  }, [run]);

  /**
   * Maneja los eventos de Joyride.
   * Detiene el tutorial si se completa, se omite o se cierra.
   * @param {object} data - Datos del evento de Joyride.
   */
  const handleJoyrideCallback = (data) => {
    const { status, action } = data;

    if (
      status === 'finished' || // Tutorial completado
      status === 'skipped' || // Clic en "Omitir"
      action === 'close'    // Clic en la "X"
    ) {
      setStartJoyride(false); // Detiene la ejecución de Joyride
      onComplete();           // Notifica al componente padre que el tutorial ha terminado
    }
  };

  /**
   * Inicia el tutorial después de que el usuario acepta el modal de bienvenida.
   */
  const handleStartTour = () => {
    setShowWelcomeModal(false); // Oculta el modal de bienvenida
    setStartJoyride(true);      // Permite que Joyride se ejecute
  };

  /**
   * Omite el tutorial directamente desde el modal de bienvenida.
   */
  const handleSkipWelcome = () => {
    setShowWelcomeModal(false); // Oculta el modal de bienvenida
    onComplete();               // Notifica al padre como si el tutorial se hubiera omitido
  };

  // Renderiza el modal de bienvenida si showWelcomeModal es true y si el padre quiere que el tutorial corra
  if (showWelcomeModal && run) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10002, // Asegura que el modal esté sobre el overlay de Joyride
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '25px',
          borderRadius: '8px',
          textAlign: 'center',
          maxWidth: '350px',
          boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)',
          color: '#333',
        }}>
          <h2>¡Bienvenido/a! 👋</h2>
          <p style={{ lineHeight: '1.4', marginBottom: '20px' }}>
            Este tour te guiará para hacer tu pedido de almuerzo de forma rápida y sencilla.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
            <button
              onClick={handleStartTour}
              style={{
                backgroundColor: '#10B981', // Verde esmeralda
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)',
                transition: 'background-color 0.2s ease',
              }}
            >
              Empezar Tour
            </button>
            <button
              onClick={handleSkipWelcome}
              style={{
                backgroundColor: '#6B7280', // Gris
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 'bold',
                boxShadow: '0 2px 5px rgba(0, 0, 0, 0.2)',
                transition: 'background-color 0.2s ease',
              }}
            >
              No, gracias
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Renderiza Joyride solo si 'startJoyride' es true (después de aceptar el modal)
  // y si la prop 'run' del padre también es true.
  return (
    <Joyride
      steps={getSteps(mealsCount)}
      run={startJoyride && run} // Controla cuándo se ejecuta Joyride
      continuous={true}
      showSkipButton={true}
      callback={handleJoyrideCallback}
      disableOverlayClose={true} // Evita que el clic en el overlay cierre el tutorial
      spotlightClicks={true}     // Habilita clics en los elementos destacados
      styles={{
        options: {
          zIndex: 10001,
          primaryColor: '#10B981', // Verde esmeralda
          overlayColor: 'rgba(0, 0, 0, 0.6)',
          spotlightPadding: 5,
        },
        tooltip: {
          fontSize: '14px',
          maxWidth: '300px',
        },
      }}
      disableScrolling={false} // Permite el scroll durante el tutorial
      locale={{
        back: 'Atrás',
        next: 'Siguiente',
        skip: 'Omitir',
        last: '¡Entendido!',
      }}
    />
  );
};

export default OnboardingTutorial;