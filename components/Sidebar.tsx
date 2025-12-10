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
        fixed inset-y-0 left-0 z-30 w-72 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:relative md:translate-x-0 flex flex-col shadow-2xl
      `}>
        {/* Logo Area */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <img src="/finlitte_logo.png" alt="Finlitte Logo" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white leading-none">Finlitte</h1>
              <span className="text-[10px] text-blue-400 font-medium tracking-wider uppercase">CRM Sistema</span>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* User Info */}
        <div className="px-6 py-8 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-xl font-bold text-blue-400 border-2 border-slate-700 shadow-inner">
                {(user.full_name || user.username).charAt(0).toUpperCase()}
              </div>
              <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${user.role === 'admin' ? 'bg-purple-500' : 'bg-emerald-500'}`}></div>
            </div>
            <div className="overflow-hidden">
              <p className="font-semibold text-white truncate text-sm tracking-wide" title={user.full_name || user.username}>
                {user.full_name ? user.full_name : <span className="text-red-400 text-xs italic">Nenustatyta</span>}
              </p>
              <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mt-0.5">{roleMap[user.role] || user.role}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-8 px-4 space-y-1.5 overflow-y-auto">
          <p className="px-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-4">Pagrindinis</p>
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
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group
                  ${isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }
                `}
              >
                <Icon size={20} className={`transition-colors ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-400'}`} />
                {item.label}
                {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white opacity-50" />}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/30">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 group"
          >
            <LogOut size={20} className="text-slate-500 group-hover:text-red-400 transition-colors" />
            Atsijungti
          </button>
        </div>
      </aside>
    </>
  );
}