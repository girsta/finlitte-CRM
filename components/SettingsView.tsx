import React, { useState, useEffect } from 'react';
import { Settings, Save, User, Lock, Phone, Mail, Shield, Server, Bell } from 'lucide-react';
import { User as UserType } from '../types';

interface SettingsViewProps {
  onUserUpdate?: (user: UserType) => void;
}

export default function SettingsView({ onUserUpdate }: SettingsViewProps) {
  const [profile, setProfile] = useState<UserType | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
      }
    } catch (err) {
      console.error("Failed to fetch profile", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: profile.full_name,
          phone: profile.phone,
          email: profile.email,
          password: password || undefined // Only send if not empty
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Profilis sėkmingai atnaujintas' });
        setPassword(''); // Clear password field
        // Notify parent to update global state
        if (onUserUpdate) {
          onUserUpdate(profile);
        }
      } else {
        const err = await res.json();
        setMessage({ type: 'error', text: err.error || 'Nepavyko atnaujinti profilio' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Įvyko klaida saugant duomenis' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Kraunama...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Settings size={28} className="text-gray-400" />
        <h2 className="text-2xl font-bold text-gray-900">Sistemos nustatymai</h2>
      </div>

      {/* User Profile Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <User size={20} className="text-blue-600" />
            Vartotojo profilis
          </h3>
          <p className="text-sm text-gray-500 mt-1">Redaguokite savo asmeninę informaciją ir prisijungimo duomenis.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {message && (
            <div className={`p-4 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {message.text}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vartotojo vardas</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  value={profile?.username || ''}
                  disabled
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed"
                  title="Vartotojo vardo keisti negalima"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Vartotojo vardo keisti negalima.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pilnas vardas</label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  value={profile?.full_name || ''}
                  onChange={e => setProfile(prev => prev ? { ...prev, full_name: e.target.value } : null)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Vardenis Pavardenis"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefono numeris</label>
              <div className="relative">
                <Phone size={18} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="tel"
                  value={profile?.phone || ''}
                  onChange={e => setProfile(prev => prev ? { ...prev, phone: e.target.value } : null)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="+370 600 00000"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">El. paštas</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="email"
                  value={profile?.email || ''}
                  onChange={e => setProfile(prev => prev ? { ...prev, email: e.target.value } : null)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="vardas@imone.lt"
                />
              </div>
            </div>

            <div className="md:col-span-2 border-t border-gray-100 pt-4 mt-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Naujas slaptažodis</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Įveskite tik jei norite pakeisti"
                  autoComplete="new-password"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Palikite tuščią, jei nenorite keisti slaptažodžio.</p>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save size={18} />
              {saving ? 'Saugoma...' : 'Išsaugoti profilį'}
            </button>
          </div>
        </form>
      </div>

      {/* System Config (Admin Only - Visual Placeholder for now) */}
      {profile?.role === 'admin' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden opacity-75">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
              <Server size={20} className="text-gray-600" />
              Sistemos konfigūracija
            </h3>
            <p className="text-sm text-gray-500 mt-1">Valdyti aplinkos kintamuosius ir saugojimo kelius.</p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Duomenų saugojimo direktorija</label>
              <input type="text" disabled value="/var/lib/finlitte/data" className="mt-1 block w-full bg-gray-50 border border-gray-300 rounded-md px-3 py-2 text-gray-500" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}