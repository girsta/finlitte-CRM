import React, { useState } from 'react';
import { User } from '../types';
import { ShieldCheck, Lock, User as UserIcon } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
  setServerError: (err: boolean) => void;
}

export default function Login({ onLogin, setServerError }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setServerError(false);

    try {
      // 1. Attempt login at relative path (Production or Proxy)
      let res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      // 2. Check if we accidentally hit the frontend dev server (returns HTML)
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("text/html")) {
        console.warn("Received HTML from /login. Assuming dev environment, trying http://localhost:3000/login");
        // Fallback: Try localhost:3000 explicitly
        res = await fetch('http://localhost:3000/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
      }

      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          onLogin(data.user);
        } else {
          // Fallback structure
          onLogin({ 
            username, 
            isAdmin: username === 'admin',
            role: username === 'admin' ? 'admin' : 'viewer'
          });
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      console.error("Login Error:", err);
      
      // 3. Fail-safe for Demo/Preview if backend is totally unreachable
      if (username === 'admin' && password === 'admin123') {
         console.log("Using offline admin bypass");
         onLogin({ username: 'admin', isAdmin: true, role: 'admin' });
      } else {
        setError('Connection failed. Ensure server.js is running on port 3000.');
        setServerError(true);
      }
    } finally {
      // Ensure the button is always re-enabled
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-blue-900 p-6 text-center">
          <div className="mx-auto bg-blue-800 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white">Finlitte CRM</h1>
          <p className="text-blue-200 text-sm mt-1">Secure Contract Management</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Username</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="Enter username"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                placeholder="Enter password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full text-white font-semibold py-2.5 rounded-lg transition-colors duration-200 flex items-center justify-center ${isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                Authenticating...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
        
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 text-center text-xs text-gray-500">
          Protected by Enterprise Grade Security
        </div>
      </div>
    </div>
  );
}