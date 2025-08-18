// src/components/Auth/ProtectedRoute.js
import React from 'react';
import { useAuth } from './AuthProvider';
import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ children, allowedRole }) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  // Si está cargando, no renderizamos nada hasta que se complete la autenticación
  if (loading) {
    return null; // Evita el renderizado mientras se verifica la autenticación
  }

  // Si no hay usuario autenticado, redirige a /staffhub
  if (!user) {
    return <Navigate to="/staffhub" state={{ from: location }} replace />;
  }

  // Si el rol no coincide con el permitido, redirige a /staffhub
  if (role !== allowedRole) {
    return <Navigate to="/staffhub" state={{ from: location }} replace />;
  }

  // Si pasa todas las verificaciones, renderiza el componente hijo
  return children;
};

export default ProtectedRoute;