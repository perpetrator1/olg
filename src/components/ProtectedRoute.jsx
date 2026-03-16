import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { session, role, loading } = useAuth();
  const location = useLocation();

  console.log('ProtectedRoute: Checking access:', { 
    path: location.pathname, 
    hasSession: !!session, 
    role, 
    loading,
    allowedRoles 
  });

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 rounded-full bg-slate-700 mb-4"></div>
          <div className="h-4 w-24 bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};
