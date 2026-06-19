import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth }   from './context/AuthContext';
import { SocketProvider }          from './context/SocketContext';
import { ThemeProvider }           from './context/ThemeContext';
import Layout                      from './components/Layout/Layout';

// Auth
import Login    from './pages/Login';
import Register from './pages/Register';

// Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';

// Officer
import OfficerDashboard from './pages/officer/OfficerDashboard';

// Shared staff pages
import WardMap       from './pages/WardMap';
import Forecast      from './pages/Forecast';
import SourceDetection from './pages/SourceDetection';
import Alerts        from './pages/Alerts';
import HealthAdvisory from './pages/HealthAdvisory';
import Reports       from './pages/Reports';
import DigitalTwin   from './pages/DigitalTwin';

// Citizen
import CitizenHome   from './pages/citizen/CitizenHome';
import CitizenReport from './pages/citizen/CitizenReport';
import MyReports     from './pages/citizen/MyReports';

// FIX: Removed unused Dashboard import — it was imported but never rendered

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  const role = user?.role || 'citizen';
  const isAdmin   = role === 'admin';
  const isOfficer = role === 'officer';

  return (
    <Routes>
      <Route path="/login"    element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        {/* Home — role-based */}
        <Route index element={
          isAdmin ? <AdminDashboard /> :
          isOfficer ? <OfficerDashboard /> :
          <CitizenHome />
        } />

        {/* Shared — all authenticated users */}
        <Route path="advisory" element={<HealthAdvisory />} />

        {/* Admin + Officer — protected */}
        <Route path="map"     element={<RequireRole roles={['admin','officer']}><WardMap /></RequireRole>} />
        <Route path="forecast"element={<RequireRole roles={['admin','officer']}><Forecast /></RequireRole>} />
        <Route path="sources" element={<RequireRole roles={['admin','officer']}><SourceDetection /></RequireRole>} />
        <Route path="alerts"  element={<RequireRole roles={['admin','officer']}><Alerts /></RequireRole>} />
        {/* FIX: Added missing /reports route — Reports.tsx existed but had no route */}
        <Route path="reports" element={<RequireRole roles={['admin','officer']}><Reports /></RequireRole>} />
        <Route path="twin"    element={<RequireRole roles={['admin','officer']}><DigitalTwin /></RequireRole>} />

        {/* Admin only */}
        <Route path="users"   element={<RequireRole roles={['admin']}><UserManagement /></RequireRole>} />

        {/* Citizen only */}
        <Route path="report"    element={<RequireRole roles={['citizen']}><CitizenReport /></RequireRole>} />
        <Route path="myreports" element={<RequireRole roles={['citizen']}><MyReports /></RequireRole>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <AppRoutes />
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
