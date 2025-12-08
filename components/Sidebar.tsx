import React from 'react';
import { User } from '../types';
import { LayoutDashboard, Calendar, Users, Settings, LogOut, X, ShieldCheck, CheckSquare, FileText } from 'lucide-react';

interface SidebarProps {
  user: User;
  activeView: string;
  setActiveView: (view: string) => void;
  onLogout: () => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function Sidebar({ user, activeView, setActiveView, onLogout, isOpen, setIsOpen }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Visos sutartys', icon: FileText, role: 'viewer' },
    { id: 'calendar', label: 'Kalendorius', icon: Calendar, role: 'viewer' },
    { id: 'tasks', label: 'Užduotys', icon: CheckSquare, role: 'viewer' },
    { id: 'users', label: 'Vartotojų valdymas', icon: Users, role: 'admin' },
    { id: 'settings', label: 'Nustatymai', icon: Settings, role: 'viewer' },
  ];

  const filteredItems = menuItems.filter(item =>
    item.role === 'viewer' || (item.role === 'admin' && user.role === 'admin')
  );

  const roleMap: Record<string, string> = {
    admin: 'Administratorius',
    sales: 'Vadybininkas',
    viewer: 'Stebėtojas'
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 bg-white text-gray-800 border-r border-gray-200 transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 flex flex-col shadow-xl md:shadow-none
      `}>
        {/* Logo Area */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {/* Replaced generic Shield with specific branding color implied by light theme */}
            <div className="w-8 h-8 flex items-center justify-center bg-blue-600 rounded-lg text-white">
              <span className="font-bold text-lg">F</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">Finlitte</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {/* User Info */}
        <div className="px-6 py-6 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg font-bold text-blue-700 border border-blue-200">
              {(user.full_name || user.username).charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="font-semibold text-gray-900 truncate text-sm" title={user.full_name || user.username}>
                {user.full_name ? user.full_name : <span className="text-red-500 text-xs">NENUSTATYTA</span>}
              </p>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${user.role === 'admin' ? 'bg-purple-500' : 'bg-green-500'}`}></div>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">{roleMap[user.role] || user.role}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveView(item.id);
                  setIsOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-blue-50 text-blue-700 border border-blue-100 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                  }
                `}
              >
                <Icon size={20} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors border border-transparent hover:border-red-100"
          >
            <LogOut size={20} />
            Atsijungti
          </button>
        </div>
      </aside>
    </>
  );
}