//src/components/onboardingTutorial.js
import React from 'react';
import Joyride, { Step } from 'react-joyride';

const steps: Step[] = [
  {
    target: '.slide-item',
    content: 'Desliza con tu dedo para cambiar entre las opciones disponibles para tu almuerzo.',
    placement: 'auto',
    disableBeacon: true,
  },
  {
    target: '.next-button',
    content: 'Toca aquí para avanzar con la flecha.',
    placement: 'bottom',
  },
  {
    target: '.prev-button',
    content: 'Toca aquí para volver atrás.',
    placement: 'bottom',
  },
  {
    target: '.duplicate-button',
    content: 'Toca aquí para duplicar este almuerzo y crear una copia idéntica.',
    placement: 'bottom',
  },
  {
    target: '.remove-button',
    content: 'Toca aquí para eliminar este almuerzo si ya no lo necesitas.',
    placement: 'bottom',
  },
  {
    target: '.add-meal-button',
    content: 'Toca aquí para añadir un nuevo almuerzo a tu lista.',
    placement: 'bottom',
  },
  {
    target: '.order-summary',
    content: 'Aquí puedes ver el resumen de tu pedido con todos los detalles de los almuerzos.',
    placement: 'top',
  },
  {
    target: '.total-price',
    content: 'Este es el valor total a pagar por tu pedido.',
    placement: 'top',
  },
  {
    target: '.send-order-button',
    content: 'Toca aquí para enviar tu pedido a WhatsApp y proceder con la compra.',
    placement: 'top',
  },
  {
    target: '.back-to-whatsapp',
    content: 'Primera vez? Envía "Hola" antes de pedir. (Si ya hablaste con nosotros, ignora esto.)',
    placement: 'bottom',
  },
];

const OnboardingTutorial = ({ run = true, onComplete }) => {
  const handleJoyrideCallback = (data) => {
    const { status, action } = data;

    // Detenemos el tutorial y el spotlight solo si se hace clic en "Omitir" o en la "X"
    if (
      status === 'finished' || // Tutorial completado
      status === 'skipped' || // Clic en "Omitir"
      action === 'close' // Clic en la "X"
    ) {
      onComplete(); // Llamamos a onComplete para detener el tutorial y ocultar el spotlight
    }
    // Ignoramos el clic fuera del tooltip (overlay), por lo que el tutorial sigue activo
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous={true}
      showSkipButton={true}
      callback={handleJoyrideCallback}
      disableOverlayClose={true} // Evita que el clic en el overlay cierre el tutorial
      styles={{
        options: {
          zIndex: 10001,
          primaryColor: '#10B981',
          overlayColor: 'rgba(0, 0, 0, 0.6)',
          spotlightPadding: 5,
        },
        tooltip: {
          fontSize: '14px',
          maxWidth: '300px',
        },
      }}
      disableScrolling={false}
      locale={{
        back: 'Atrás',
        next: 'Siguiente',
        skip: 'Omitir',
        last: 'Finalizar',
      }}
    />
  );
};

export default OnboardingTutorial;