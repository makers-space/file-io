import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@contexts/ThemeContext';
import { AuthProvider } from '@contexts/AuthContext';
import { NotificationProvider } from '@contexts/NotificationContext';

// Import all pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import FilesPage from './pages/FilesPage';
import GroupDetailPage from './pages/GroupDetailPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';

// Import Navigation and NotificationDisplay components
import { Navigation, NotificationDisplay, RouteAccessControl } from '@components/Components';

// Main App Router
function AppRouter() {
  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={
          <RouteAccessControl path="/">
            <HomePage />
          </RouteAccessControl>
        } />

        {/* Authentication routes */}
        <Route path="/login" element={
          <RouteAccessControl path="/login">
            <LoginPage />
          </RouteAccessControl>
        } />
        <Route path="/signup" element={
          <RouteAccessControl path="/signup">
            <SignupPage />
          </RouteAccessControl>
        } />
        <Route path="/forgot-password" element={
          <RouteAccessControl path="/forgot-password">
            <ForgotPasswordPage />
          </RouteAccessControl>
        } />

        {/* Protected application routes */}
        <Route path="/dashboard" element={
          <RouteAccessControl path="/dashboard">
            <DashboardPage />
          </RouteAccessControl>
        } />
        <Route path="/files/*" element={
          <RouteAccessControl path="/files">
            <FilesPage />
          </RouteAccessControl>
        } />
        <Route path="/groups/:groupId" element={
          <RouteAccessControl path="/groups/:groupId">
            <GroupDetailPage />
          </RouteAccessControl>
        } />
        <Route path="/settings" element={
          <RouteAccessControl path="/settings">
            <SettingsPage />
          </RouteAccessControl>
        } />
        <Route path="/admin" element={
          <RouteAccessControl path="/admin">
            <AdminPage />
          </RouteAccessControl>
        } />

        {/* Legacy / redirect routes */}
        <Route path="/drive" element={<Navigate to="/files" replace />} />
        <Route path="/editor" element={<Navigate to="/files" replace />} />
        <Route path="/groups" element={<Navigate to="/dashboard" replace />} />
        <Route path="/people" element={<Navigate to="/dashboard" replace />} />
        <Route path="/profile/:userId" element={<Navigate to="/dashboard" replace />} />
        <Route path="/contact" element={<Navigate to="/" replace />} />
        <Route path="/components" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global Navigation FAB */}
      <Navigation
        position="top-right"
        draggable={true}
        size="md"
      />

      {/* Global Notification Display */}
      <NotificationDisplay position="top-right" />
    </>
  );
}

function App() {
  return (
    <Router>
      <ThemeProvider>
        <NotificationProvider>
          <AuthProvider>
              <AppRouter />
          </AuthProvider>
        </NotificationProvider>
      </ThemeProvider>
    </Router>
  );
}

export default App;

