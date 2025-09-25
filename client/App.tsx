
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { Toaster } from '@/components/ui/toaster';
import ErrorBoundary from '@/lib/error-boundary';
import '@/global.css';

// Páginas
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import CRM from '@/pages/CRM';
import Projects from '@/pages/Projects';
import Tasks from '@/pages/Tasks';
import CashFlow from '@/pages/CashFlow';
import Billing from '@/pages/Billing';
import Receivables from '@/pages/Receivables';
import Publications from '@/pages/Publications';
import PublicationDetail from '@/pages/PublicationDetail';
import Settings from '@/pages/Settings';
import Notifications from '@/pages/Notifications';
import NotFound from '@/pages/NotFound';

// Layout
import DashboardLayout from '@/components/Layout/DashboardLayout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" replace />} />
      <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
      
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/crm" element={
        <ProtectedRoute>
          <DashboardLayout>
            <CRM />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/projects" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Projects />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/tasks" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Tasks />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/cashflow" element={
        <ProtectedRoute>
          <DashboardLayout>
            <CashFlow />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/billing" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Billing />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/receivables" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Receivables />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/publications" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Publications />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/publications/:id" element={
        <ProtectedRoute>
          <DashboardLayout>
            <PublicationDetail />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/settings" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Settings />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      <Route path="/notifications" element={
        <ProtectedRoute>
          <DashboardLayout>
            <Notifications />
          </DashboardLayout>
        </ProtectedRoute>
      } />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function UIErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}

function AppContent() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <AppRoutes />
          <Toaster />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const App = () => (
  <UIErrorBoundary>
    <AppContent />
  </UIErrorBoundary>
);

createRoot(document.getElementById("root")!).render(<App />);
