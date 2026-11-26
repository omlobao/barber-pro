import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Scissors } from 'lucide-react';
import { AuthProvider } from '@/context/AuthContext';
import { ClientAuthProvider } from '@/context/ClientAuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AdminLayout } from '@/components/AdminLayout';
import LandingPage from '@/pages/LandingPage';

const BookingWizardPage = lazy(() => import('@/pages/BookingWizardPage'));
const ClientPortalPage = lazy(() => import('@/pages/ClientPortalPage'));
const MyAppointmentPage = lazy(() => import('@/pages/MyAppointmentPage'));

const AdminLoginPage = lazy(() => import('@/pages/admin/AdminLoginPage'));
const AdminAgendaPage = lazy(() => import('@/pages/admin/AdminAgendaPage'));
const AdminPosPage = lazy(() => import('@/pages/admin/AdminPosPage'));
const AdminFinancePage = lazy(() => import('@/pages/admin/AdminFinancePage'));
const AdminCatalogPage = lazy(() => import('@/pages/admin/AdminCatalogPage'));
const AdminCouponsPage = lazy(() => import('@/pages/admin/AdminCouponsPage'));
const AdminTeamPage = lazy(() => import('@/pages/admin/AdminTeamPage'));
const AdminClientsPage = lazy(() => import('@/pages/admin/AdminClientsPage'));

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0D10] text-[#D97706]">
      <Scissors className="h-6 w-6 animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ClientAuthProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Área Pública & Área do Cliente */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/agendar" element={<BookingWizardPage />} />
              <Route path="/cliente" element={<ClientPortalPage />} />
              <Route
                path="/meu-agendamento/:cancel_token"
                element={<MyAppointmentPage />}
              />

              {/* Autenticação da Equipe */}
              <Route path="/admin/login" element={<AdminLoginPage />} />

              {/* Área Privada — Painel Administrativo e do Barbeiro */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/admin/agenda" replace />} />
                <Route path="agenda" element={<AdminAgendaPage />} />
                <Route path="caixa" element={<AdminPosPage />} />
                <Route path="financeiro" element={<AdminFinancePage />} />
                <Route path="catalogo" element={<AdminCatalogPage />} />
                <Route path="cupons" element={<AdminCouponsPage />} />
                <Route path="equipe" element={<AdminTeamPage />} />
                <Route path="clientes" element={<AdminClientsPage />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ClientAuthProvider>
    </AuthProvider>
  );
}
