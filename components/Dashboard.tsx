import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Contract, User, ExpiryStatus } from '../types';
import { Menu, Plus, Search, AlertTriangle, CheckCircle, XCircle, Archive, LayoutList, Download, History, Filter, Upload } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import ContractList from './ContractList';
import ContractForm from './ContractForm';
import HistoryModal from './HistoryModal';
import NotesModal from './NotesModal';
import Sidebar from './Sidebar';
import CalendarView from './CalendarView';
import UserManagement from './UserManagement';
import SettingsView from './SettingsView';
import TaskManager from './TaskManager';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export default function Dashboard({ user, onLogout }: DashboardProps) {
  // Navigation State
  const [activeView, setActiveView] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Data State
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Search History State
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | undefined>(undefined);
  const [historyContract, setHistoryContract] = useState<Contract | null>(null);
  const [notesContract, setNotesContract] = useState<Contract | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toggle between Active and Archived views within the Dashboard tab
  const [viewArchived, setViewArchived] = useState(false);

  // Load Search History on Mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('finlitte_search_history');
      if (saved) {
        setSearchHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load search history", e);
    }
  }, []);

  const addToSearchHistory = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;

    setSearchHistory(prev => {
      const filtered = prev.filter(t => t !== trimmed);
      const newHistory = [trimmed, ...filtered].slice(0, 5); // Keep last 5
      localStorage.setItem('finlitte_search_history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const clearSearchHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('finlitte_search_history');
  };

  const fetchContracts = async () => {
    setIsLoading(true);
    // Determine endpoint based on whether we are looking at archived list 
    // BUT if we are in Calendar mode, we might want ALL active contracts.
    // For simplicity, Dashboard/Calendar fetch active. Archived tab fetches archived.

    // Logic: If user specifically toggled "Archived", we fetch archived.
    // Otherwise default to active.
    const endpoint = viewArchived ? '/api/contracts/archived' : '/api/contracts';

    try {
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setContracts(data);
      } else {
        console.warn("Using mock data as server is unreachable");
        setContracts([]);
      }
    } catch (e) {
      console.error("Failed to fetch contracts", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, [viewArchived, activeView]);
  // Refetch when view changes to ensure fresh data for calendar etc, 
  // though optimally we could cache.

  const handleSave = async (contract: Contract) => {
    try {
      if (contract.id) {
        setContracts(prev => prev.map(c => c.id === contract.id ? contract : c));
      } else {
        setContracts(prev => [...prev, { ...contract, id: Date.now() }]);
      }

      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contract),
      });

      if (res.ok) {
        fetchContracts();
      }
    } catch (e) {
      console.error("Save failed", e);
      alert("Nepavyko išsaugoti serveryje.");
    }
    setIsFormOpen(false);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Ar tikrai norite NEGRĮŽTAMAI ištrinti šią sutartį?")) return;
    try {
      setContracts(prev => prev.filter(c => c.id !== id));
      await fetch(`/api/contracts/${id}`, { method: 'DELETE' });
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  const handleArchiveToggle = async (id: number) => {
    try {
      const res = await fetch(`/api/contracts/${id}/archive`, { method: 'POST' });
      if (res.ok) {
        setContracts(prev => prev.filter(c => c.id !== id));
      }
    } catch (e) {
      console.error("Archive toggle failed", e);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);

    try {
      let data: any[] = [];

      if (file.name.endsWith('.csv')) {
        // Handle CSV
        await new Promise<void>((resolve, reject) => {
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              data = results.data;
              resolve();
            },
            error: (err) => reject(err)
          });
        });
      } else {
        // Handle Excel
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
      }

      // Upload Data
      const res = await fetch('/api/webhook/n8n', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const responseData = await res.json();
        alert(`Įkelta sėkmingai: ${responseData.success}, Nepavyko: ${responseData.failed}`);
        fetchContracts();
      } else {
        alert("Klaida įkeliant duomenis");
      }

    } catch (e) {
      console.error("Upload/Parse failed", e);
      alert("Klaida nuskaitant arba įkeliant failą");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getStatus = (dateStr: string): ExpiryStatus => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today to midnight

    const expiry = new Date(dateStr);
    // Normalize expiry to midnight to ensure fair comparison
    expiry.setHours(0, 0, 0, 0);

    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return ExpiryStatus.EXPIRED; // Strictly past dates
    if (diffDays <= 30) return ExpiryStatus.WARNING; // Expiring in the next 30 days
    return ExpiryStatus.VALID;
  };

  const stats = useMemo(() => {
    const s = { red: 0, yellow: 0, green: 0, total: contracts.length };
    contracts.forEach(c => {
      const status = getStatus(c.galiojaIki);
      if (status === ExpiryStatus.EXPIRED) s.red++;
      else if (status === ExpiryStatus.WARNING) s.yellow++;
      else s.green++;
    });
    return s;
  }, [contracts]);

  // Filter State
  const [filterSalesperson, setFilterSalesperson] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Unique values for dropdowns
  const uniqueSalespersons = useMemo(() => {
    const sales = new Set(contracts.map(c => c.pardavejas).filter(Boolean));
    return Array.from(sales).sort();
  }, [contracts]);

  const uniqueTypes = useMemo(() => {
    const types = new Set(contracts.map(c => c.ldGrupe).filter(Boolean));
    return Array.from(types).sort();
  }, [contracts]);

  const filteredContracts = contracts.filter(c => {
    const matchesSearch =
      c.draudejas.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.policyNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.valstybinisNr.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSalesperson = filterSalesperson ? c.pardavejas === filterSalesperson : true;
    const matchesType = filterType ? c.ldGrupe === filterType : true;

    let matchesStatus = true;
    if (filterStatus) {
      const status = getStatus(c.galiojaIki);
      if (filterStatus === 'active') matchesStatus = status === ExpiryStatus.VALID;
      if (filterStatus === 'expiring') matchesStatus = status === ExpiryStatus.WARNING;
      if (filterStatus === 'expired') matchesStatus = status === ExpiryStatus.EXPIRED;
    }

    return matchesSearch && matchesSalesperson && matchesType && matchesStatus;
  });

  const handleExportCSV = () => {
    const headers = [
      "ID", "Client Name", "Salesperson", "Policy No", "Type",
      "Reg Number", "Valid From", "Valid Until", "Yearly Price",
      "Payout Value", "Status", "Notes"
    ];

    const rows = filteredContracts.map(c => {
      const status = c.is_archived ? "Archived" : getStatus(c.galiojaIki);
      const escape = (str: string | number) => `"${String(str).replace(/"/g, '""')}"`;

      return [
        c.id, escape(c.draudejas), escape(c.pardavejas), escape(c.policyNo),
        escape(c.ldGrupe), escape(c.valstybinisNr), c.galiojaNuo, c.galiojaIki,
        c.metineIsmoka, c.ismoka, status, escape(c.notes.join(" | "))
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `finlitte_contracts_${viewArchived ? 'archived' : 'active'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const canCreate = user.role === 'admin' || user.role === 'sales';

  // --- Render Content Based on Active View ---
  const renderContent = () => {
    switch (activeView) {
      case 'calendar':
        return <CalendarView contracts={contracts} onContractClick={(c) => { setEditingContract(c); setIsFormOpen(true); }} />;

      case 'users':
        return user.role === 'admin' ? <UserManagement currentUser={user} /> : <div className="text-red-500">Prieiga uždrausta</div>;

      case 'tasks':
        return <TaskManager currentUser={user} />;

      case 'settings':
        return <SettingsView />;

      case 'dashboard':
      default:
        return (
          <>
            {/* Dashboard Stats */}
            {!viewArchived && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6 flex items-center justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-2 h-full bg-red-500"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Kritiniai / Pasibaigę</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.red}</p>
                  </div>
                  <div className="bg-red-50 p-3 rounded-full text-red-600"><XCircle size={24} /></div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-yellow-100 p-6 flex items-center justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-2 h-full bg-yellow-400"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Baigiasi galiojimas</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.yellow}</p>
                  </div>
                  <div className="bg-yellow-50 p-3 rounded-full text-yellow-600"><AlertTriangle size={24} /></div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-green-100 p-6 flex items-center justify-between relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-2 h-full bg-green-500"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Aktyvios sutartys</p>
                    <p className="text-3xl font-bold text-gray-900">{stats.green}</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-full text-green-600"><CheckCircle size={24} /></div>
                </div>
              </div>
            )}

            {/* View Toggle Tabs */}
            <div className="flex items-center gap-4 border-b border-gray-200 mb-6">
              <button
                onClick={() => setViewArchived(false)}
                className={`pb-3 px-1 flex items-center gap-2 text-sm font-medium transition-colors border-b-2 ${!viewArchived ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                <LayoutList size={18} />
                Aktyvios sutartys
              </button>
              <button
                onClick={() => setViewArchived(true)}
                className={`pb-3 px-1 flex items-center gap-2 text-sm font-medium transition-colors border-b-2 ${viewArchived ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                <Archive size={18} />
                Archyvuotos
              </button>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 z-20">
              <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                {/* Search Input with History */}
                <div className="relative flex-1 sm:max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Ieškoti pagal klientą, polisą ar reg. nr..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        addToSearchHistory(searchTerm);
                        e.currentTarget.blur();
                      }
                    }}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />

                  {/* Search History Dropdown */}
                  {isSearchFocused && searchHistory.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-30">
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Paskutinės paieškos</span>
                        <button
                          onMouseDown={(e) => {
                            e.preventDefault();
                            clearSearchHistory();
                          }}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Valyti
                        </button>
                      </div>
                      {searchHistory.map((term, i) => (
                        <button
                          key={i}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 flex items-center gap-3 transition-colors border-b border-gray-50 last:border-0"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSearchTerm(term);
                            setIsSearchFocused(false);
                          }}
                        >
                          <History size={16} className="text-gray-400" />
                          {term}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
                >
                  <Download size={20} />
                  <span className="hidden sm:inline">Eksportuoti CSV</span>
                </button>
              </div>

              {canCreate && !viewArchived && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
                  >
                    <Upload size={20} />
                    Įkelti sutartį
                  </button>
                  <button
                    onClick={() => { setEditingContract(undefined); setIsFormOpen(true); }}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
                  >
                    <Plus size={20} />
                    Nauja sutartis
                  </button>
                </div>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Filter size={20} />
                <span className="font-medium text-sm">Filtrai:</span>
              </div>

              <select
                value={filterSalesperson}
                onChange={(e) => setFilterSalesperson(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Visi vadybininkai</option>
                {uniqueSalespersons.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Visi tipai</option>
                {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Visi statusai</option>
                <option value="active">Aktyvūs</option>
                <option value="expiring">Baigiasi galiojimas</option>
                <option value="expired">Pasibaigę</option>
              </select>

              {(filterSalesperson || filterType || filterStatus) && (
                <button
                  onClick={() => { setFilterSalesperson(''); setFilterType(''); setFilterStatus(''); }}
                  className="text-sm text-red-600 hover:text-red-800 font-medium ml-auto"
                >
                  Valyti filtrus
                </button>
              )}
            </div>

            {/* Contract List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <ContractList
                user={user}
                contracts={filteredContracts}
                onEdit={(c) => { setEditingContract(c); setIsFormOpen(true); }}
                onDelete={handleDelete}
                onArchiveToggle={handleArchiveToggle}
                onViewHistory={(c) => setHistoryContract(c)}
                onViewNotes={(c) => setNotesContract(c)}
                getStatus={getStatus}
              />
            </div>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50">

      {/* Sidebar Navigation */}
      <Sidebar
        user={user}
        activeView={activeView}
        setActiveView={setActiveView}
        onLogout={onLogout}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header Trigger */}
        <header className="md:hidden bg-white border-b border-gray-200 h-16 flex items-center px-4 justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-blue-900">Finlitte</span>
          </div>
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-gray-600">
            <Menu size={24} />
          </button>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-auto p-4 sm:p-8">
          <div className="max-w-7xl mx-auto w-full">
            {renderContent()}
          </div>
        </main>
      </div>

      {/* Modals */}
      {isFormOpen && canCreate && (
        <ContractForm
          onClose={() => setIsFormOpen(false)}
          onSave={handleSave}
          initialData={editingContract}
        />
      )}

      {historyContract && historyContract.id && (
        <HistoryModal
          contractId={historyContract.id}
          contractPolicy={historyContract.policyNo}
          onClose={() => setHistoryContract(null)}
        />
      )}

      {notesContract && (
        <NotesModal
          contract={notesContract}
          onClose={() => setNotesContract(null)}
        />
      )}
    </div>
  );
}