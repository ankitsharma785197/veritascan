import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { AuthPage } from './pages/AuthPage.jsx';
import { Dashboard } from './pages/Dashboard.jsx';

function AppShell() {
  const { token } = useAuth();
  return token ? <Dashboard /> : <AuthPage />;
}

export function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
