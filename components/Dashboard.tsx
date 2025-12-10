import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Contract, User, ExpiryStatus } from '../types';
import { Menu, Plus, Search, AlertTriangle, CheckCircle, XCircle, Archive, LayoutList, Download, History, Filter, Upload, Trash2, Clock } from 'lucide-react';
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
    onUserUpdate: (user: User) => void;
}

export default function Dashboard({ user, onLogout, onUserUpdate }: DashboardProps) {
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
    const [formMode, setFormMode] = useState<'view' | 'edit'>('edit');
    const [editingContract, setEditingContract] = useState<Contract | undefined>(undefined);
    const [historyContract, setHistoryContract] = useState<Contract | null>(null);
    const [notesContract, setNotesContract] = useState<Contract | null>(null);
    const [selectedContractIds, setSelectedContractIds] = useState<number[]>([]);

    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Dashboard Tabs: 'active' | 'ended' | 'archived'
    const [activeTab, setActiveTab] = useState<'active' | 'ended' | 'archived'>('active');

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
        // Fetch ALL contracts (Active + Expired + Archived)
        // Server endpoint /api/contracts returns everything
        const endpoint = '/api/contracts';

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
    }, [activeTab, activeView]);

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

    const handleBulkDelete = async () => {
        if (selectedContractIds.length === 0) return;
        if (!window.confirm(`Ar tikrai norite ištrinti ${selectedContractIds.length} pasirinktas sutartis?`)) return;

        try {
            // Optimistic update
            setContracts(prev => prev.filter(c => !selectedContractIds.includes(c.id!)));

            // Send individual delete requests
            await Promise.all(selectedContractIds.map(id =>
                fetch(`/api/contracts/${id}`, { method: 'DELETE' })
            ));

            setSelectedContractIds([]);
        } catch (e) {
            console.error("Bulk delete failed", e);
            alert("Klaida trinant sutartis");
            fetchContracts();
        }
    };

    const handleArchiveToggle = async (id: number) => {
        try {
            const res = await fetch(`/api/contracts/${id}/archive`, { method: 'POST' });
            if (res.ok) {
                // Re-fetch to update state correctly
                fetchContracts();
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
        today.setHours(0, 0, 0, 0);

        const expiry = new Date(dateStr);
        expiry.setHours(0, 0, 0, 0);

        const diffTime = expiry.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return ExpiryStatus.EXPIRED;
        if (diffDays <= 30) return ExpiryStatus.WARNING;
        return ExpiryStatus.VALID;
    };

    const stats = useMemo(() => {
        const s = { red: 0, yellow: 0, green: 0, total: contracts.length };
        contracts.forEach(c => {
            // Logic for stats: Only count NON-ARCHIVED contracts for the status cards
            if (!c.is_archived) {
                const status = getStatus(c.galiojaIki);
                if (status === ExpiryStatus.EXPIRED) s.red++;
                else if (status === ExpiryStatus.WARNING) s.yellow++;
                else s.green++;
            }
        });
        return s;
    }, [contracts]);

    // Filter State
    const [filterSalesperson, setFilterSalesperson] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Reset filters on tab change
    useEffect(() => {
        setFilterSalesperson('');
        setFilterType('');
        setFilterStatus('');
    }, [activeTab]);

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

        const status = getStatus(c.galiojaIki);
        let viewMatches = true;

        if (activeTab === 'active') {
            // Active Tab: Non-Archived AND (Valid OR Warning)
            viewMatches = !c.is_archived && status !== ExpiryStatus.EXPIRED;
        } else if (activeTab === 'ended') {
            // Ended Tab: Non-Archived AND Expired
            viewMatches = !c.is_archived && status === ExpiryStatus.EXPIRED;
        } else if (activeTab === 'archived') {
            // Archived Tab: All Archived
            viewMatches = !!c.is_archived;
        }

        return matchesSearch && matchesSalesperson && matchesType && matchesStatus && viewMatches;
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
        link.setAttribute("download", `finlitte_contracts_${activeTab}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const canCreate = user.role === 'admin' || user.role === 'sales';

    // --- Render Content Based on Active View ---
    const renderContent = () => {
        switch (activeView) {
            case 'calendar':
                return <CalendarView contracts={contracts} onContractClick={(c) => { setEditingContract(c); setFormMode('view'); setIsFormOpen(true); }} />;

            case 'users':
                return user.role === 'admin' ? <UserManagement currentUser={user} /> : <div className="text-red-500">Prieiga uždrausta</div>;

            case 'tasks':
                return <TaskManager currentUser={user} />;

            case 'settings':
                return <SettingsView onUserUpdate={onUserUpdate} />;

            case 'dashboard':
            default:
                return (
                    <>
                        {/* Dashboard Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div
                                onClick={() => { setActiveTab('ended'); }}
                                className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all duration-300 cursor-pointer"
                            >
                                <div className="absolute top-0 right-0 w-1 h-full bg-red-500 rounded-l-full opacity-80"></div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Kritiniai / Pasibaigę</p>
                                    <p className="text-4xl font-bold text-slate-800">{stats.red}</p>
                                </div>
                                <div className="bg-red-50 p-4 rounded-xl text-red-500 group-hover:bg-red-500 group-hover:text-white transition-colors duration-300">
                                    <XCircle size={28} />
                                </div>
                            </div>
                            <div
                                onClick={() => { setActiveTab('active'); setFilterStatus('expiring'); }}
                                className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all duration-300 cursor-pointer"
                            >
                                <div className="absolute top-0 right-0 w-1 h-full bg-amber-400 rounded-l-full opacity-80"></div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Baigiasi galiojimas</p>
                                    <p className="text-4xl font-bold text-slate-800">{stats.yellow}</p>
                                </div>
                                <div className="bg-amber-50 p-4 rounded-xl text-amber-500 group-hover:bg-amber-400 group-hover:text-white transition-colors duration-300">
                                    <AlertTriangle size={28} />
                                </div>
                            </div>
                            <div
                                onClick={() => { setActiveTab('active'); setFilterStatus('active'); }}
                                className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all duration-300 cursor-pointer"
                            >
                                <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500 rounded-l-full opacity-80"></div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Aktyvios sutartys</p>
                                    <p className="text-4xl font-bold text-slate-800">{stats.green}</p>
                                </div>
                                <div className="bg-emerald-50 p-4 rounded-xl text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300">
                                    <CheckCircle size={28} />
                                </div>
                            </div>
                        </div>

                        {/* View Toggle Tabs (3 Tabs) */}
                        <div className="flex items-center gap-6 border-b border-slate-200 mb-8 overflow-x-auto">
                            <button
                                onClick={() => setActiveTab('active')}
                                className={`pb-4 px-2 flex items-center gap-2 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${activeTab === 'active'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                                    }`}
                            >
                                <LayoutList size={18} />
                                Aktyvios sutartys
                            </button>
                            <button
                                onClick={() => setActiveTab('ended')}
                                className={`pb-4 px-2 flex items-center gap-2 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${activeTab === 'ended'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                                    }`}
                            >
                                <Clock size={18} />
                                Pasibaigusios sutartys
                            </button>
                            <button
                                onClick={() => setActiveTab('archived')}
                                className={`pb-4 px-2 flex items-center gap-2 text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${activeTab === 'archived'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
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
                                        placeholder="Ieškoti pagal klientą, polisą ar objektą..."
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
                            </div>

                            {/* Bulk Actions Indicator */}
                            {selectedContractIds.length > 0 && (
                                <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg animate-in fade-in zoom-in duration-200">
                                    <span className="text-sm font-semibold text-blue-700">
                                        Pasirinkta: {selectedContractIds.length}
                                    </span>
                                    {user.role === 'admin' && (
                                        <button
                                            onClick={handleBulkDelete}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 rounded text-xs font-bold transition-colors uppercase tracking-wide"
                                        >
                                            <Trash2 size={14} />
                                            Ištrinti
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setSelectedContractIds([])}
                                        className="text-xs text-blue-500 hover:text-blue-700 font-medium underline"
                                    >
                                        Atšaukti
                                    </button>
                                </div>
                            )}

                            <button
                                onClick={handleExportCSV}
                                className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
                            >
                                <Download size={20} />
                                <span className="hidden sm:inline">Eksportuoti CSV</span>
                            </button>


                            {canCreate && activeTab === 'active' && (
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <input
                                        type="file"
                                        accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                                        ref={fileInputRef}
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white border border-slate-300 hover:border-blue-400 hover:text-blue-600 text-slate-700 px-5 py-2.5 rounded-lg font-medium transition-all shadow-sm"
                                    >
                                        <Upload size={18} />
                                        Įkelti sutartį
                                    </button>
                                    <button
                                        onClick={() => { setEditingContract(undefined); setFormMode('edit'); setIsFormOpen(true); }}
                                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-md shadow-blue-200"
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

                            {/* Status Filter - Only show for Active tab */}
                            {
                                activeTab === 'active' && (
                                    <select
                                        value={filterStatus}
                                        onChange={(e) => setFilterStatus(e.target.value)}
                                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="">Visi statusai</option>
                                        <option value="active">Aktyvūs</option>
                                        <option value="expiring">Baigiasi galiojimas</option>
                                    </select>
                                )
                            }

                            {
                                (filterSalesperson || filterType || filterStatus) && (
                                    <button
                                        onClick={() => { setFilterSalesperson(''); setFilterType(''); setFilterStatus(''); }}
                                        className="text-sm text-red-600 hover:text-red-800 font-medium ml-auto"
                                    >
                                        Valyti filtrus
                                    </button>
                                )
                            }
                        </div>

                        {/* Contract List */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <ContractList
                                user={user}
                                contracts={filteredContracts}
                                onEdit={(c) => { setEditingContract(c); setFormMode('edit'); setIsFormOpen(true); }}
                                onDelete={handleDelete}
                                onArchiveToggle={handleArchiveToggle}
                                onViewHistory={(c) => setHistoryContract(c)}
                                onViewNotes={(c) => setNotesContract(c)}
                                getStatus={getStatus}
                                selectedIds={selectedContractIds}
                                onSelectionChange={setSelectedContractIds}
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
                    initialMode={formMode}
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
