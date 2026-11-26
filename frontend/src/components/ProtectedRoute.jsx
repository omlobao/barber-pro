import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Scissors } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B0D10] text-[#F8FAFC]">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D97706]/40 bg-[#14171D] text-[#D97706] shadow-lg">
          <Scissors className="h-6 w-6 animate-spin" />
        </div>
        <p className="mt-4 text-sm text-[#94A3B8]">
          Verificando credenciais...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return children;
}
