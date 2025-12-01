import React, { useState, useEffect } from 'react';
import { User, User as UserType } from '../types';
import { Trash2, UserPlus, Shield, UserCheck, Eye, Edit2, X } from 'lucide-react';

interface UserManagementProps {
  currentUser: User;
}

interface DBUser {
  id: number;
  username: string;
  role: 'admin' | 'sales' | 'viewer';
}

export default function UserManagement({ currentUser }: UserManagementProps) {
  const [users, setUsers] = useState<DBUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'sales' | 'viewer'>('viewer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<DBUser | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch users", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Create vs Update
    const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
    const method = editingUser ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword, // Can be empty if editing and keeping old password
          role: newRole
        })
      });

      if (res.ok) {
        resetForm();
        fetchUsers();
        alert(editingUser ? "Vartotojas sėkmingai atnaujintas" : "Vartotojas sėkmingai sukurtas");
      } else {
        const data = await res.json();
        alert(data.error || "Nepavyko išsaugoti vartotojo");
      }
    } catch (e) {
      console.error(e);
      alert("Įvyko klaida");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setNewUsername('');
    setNewPassword('');
    setNewRole('viewer');
    setEditingUser(null);
  };

  const handleEditClick = (user: DBUser) => {
    setEditingUser(user);
    setNewUsername(user.username);
    setNewRole(user.role);
    setNewPassword(''); // Don't populate password for security
  };

  const handleDeleteUser = async (id: number) => {
    if (!window.confirm("Ar tikrai norite ištrinti šį vartotoją?")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || "Nepavyko ištrinti");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield size={16} className="text-purple-600" />;
      case 'sales': return <UserCheck size={16} className="text-blue-600" />;
      default: return <Eye size={16} className="text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Vartotojų valdymas</h2>
          <p className="text-gray-500">Valdyti sistemos prieigą ir roles.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create/Edit User Form */}
        <div className="lg:col-span-1">
          <div className={`bg-white p-6 rounded-xl shadow-sm border ${editingUser ? 'border-blue-300' : 'border-gray-200'}`}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                {editingUser ? <Edit2 size={20} className="text-blue-600" /> : <UserPlus size={20} />}
                {editingUser ? 'Redaguoti vartotoją' : 'Pridėti naują vartotoją'}
              </span>
              {editingUser && (
                <button
                  onClick={resetForm}
                  className="text-xs text-gray-500 hover:text-red-500 flex items-center gap-1 bg-gray-100 px-2 py-1 rounded"
                >
                  <X size={12} /> Atšaukti
                </button>
              )}
            </h3>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vartotojo vardas</label>
                <input
                  type="text"
                  required
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editingUser ? 'Naujas slaptažodis (neprivaloma)' : 'Slaptažodis'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder={editingUser ? "Palikite tuščią, jei nenorite keisti" : ""}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rolė</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="viewer">Stebėtojas (Tik skaityti)</option>
                  <option value="sales">Vadybininkas (Valdyti sutartis)</option>
                  <option value="admin">Administratorius (Pilna prieiga)</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-2 rounded-lg font-medium transition-colors text-white
                  ${editingUser ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}
                `}
              >
                {isSubmitting ? 'Saugoma...' : editingUser ? 'Atnaujinti vartotoją' : 'Sukurti vartotoją'}
              </button>
            </form>
          </div>
        </div>

        {/* User List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 font-semibold text-gray-900">Vartotojas</th>
                  <th className="px-6 py-4 font-semibold text-gray-900">Rolė</th>
                  <th className="px-6 py-4 font-semibold text-gray-900 text-right">Veiksmai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={3} className="p-6 text-center text-gray-500">Kraunami vartotojai...</td></tr>
                ) : users.map(u => (
                  <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${editingUser?.id === u.id ? 'bg-blue-50' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{u.username}</div>
                      <div className="text-xs text-gray-400">ID: {u.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 capitalize">
                        {getRoleIcon(u.role)}
                        {u.role}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEditClick(u)}
                          className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Redaguoti vartotoją"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          disabled={u.username === currentUser.username} // Can't delete self
                          className={`p-2 rounded-lg transition-colors ${u.username === currentUser.username
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-red-500 hover:bg-red-50'
                            }`}
                          title="Ištrinti vartotoją"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}