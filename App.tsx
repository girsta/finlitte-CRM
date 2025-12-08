import React, { useState, useEffect } from 'react';
import { User, Contract } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { AlertCircle } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState(false);

  // Check session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        // In a real scenario, we would hit /api/me or similar. 
        // For this demo, we check localStorage or assume logged out if session fails.
        // We will rely on the Login component to set the user state upon success.
        const storedUser = localStorage.getItem('finlitte_user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.error("Session check failed", e);
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  const handleLogin = (u: User) => {
    localStorage.setItem('finlitte_user', JSON.stringify(u));
    setUser(u);
  };

  const handleLogout = async () => {
    try {
      await fetch('/logout', { method: 'POST' });
    } catch (e) {
      console.error("Logout failed", e);
    }
    localStorage.removeItem('finlitte_user');
    setUser(null);
  };

  const handleUserUpdate = (u: User) => {
    localStorage.setItem('finlitte_user', JSON.stringify(u));
    setUser(u);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {serverError && (
        <div className="bg-red-500 text-white p-2 text-center flex items-center justify-center gap-2">
          <AlertCircle size={16} />
          <span>Nepavyko prisijungti prie serverio. Įsitikinkite, kad serveris veikia.</span>
        </div>
      )}

      {!user ? (
        <Login onLogin={handleLogin} setServerError={setServerError} />
      ) : (
        <Dashboard user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
      )}
    </div>
  );
}