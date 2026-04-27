import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import ClienteDetalle from './pages/ClienteDetalle';
import Productos from './pages/Productos';
import Ventas from './pages/Ventas';
import NuevaVenta from './pages/NuevaVenta';
import Proveedores from './pages/Proveedores';
import ProveedorDetalle from './pages/ProveedorDetalle';
import NuevaCompra from './pages/NuevaCompra';
import Caja from './pages/Caja';
import Elaboracion from './pages/Elaboracion';
import StockHistorial from './pages/StockHistorial';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />

        <Route path="/clientes" element={
          <ProtectedRoute>
            <Clientes />
          </ProtectedRoute>
        } />

        <Route path="/clientes/:id" element={
          <ProtectedRoute>
            <ClienteDetalle />
          </ProtectedRoute>
        } />

        <Route path="/productos" element={
          <ProtectedRoute>
            <Productos />
          </ProtectedRoute>
        } />

        <Route path="/ventas" element={
          <ProtectedRoute>
            <Ventas />
          </ProtectedRoute>
        } />

        <Route path="/ventas/nueva" element={
          <ProtectedRoute>
            <NuevaVenta />
          </ProtectedRoute>
        } />

        <Route path="/proveedores" element={
          <ProtectedRoute>
            <Proveedores />
          </ProtectedRoute>
        } />

        <Route path="/proveedores/:id" element={
          <ProtectedRoute>
            <ProveedorDetalle />
          </ProtectedRoute>
        } />

        <Route path="/compras/nueva" element={
          <ProtectedRoute>
            <NuevaCompra />
          </ProtectedRoute>
        } />

        <Route path="/caja" element={
          <ProtectedRoute>
            <Caja />
          </ProtectedRoute>
        } />

        <Route path="/elaboracion" element={
          <ProtectedRoute>
            <Elaboracion />
          </ProtectedRoute>
        } />
        
        <Route path="/stock/historial" element={
          <ProtectedRoute>
            <StockHistorial />
          </ProtectedRoute>
        } />

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
