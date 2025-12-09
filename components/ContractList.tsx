import React from 'react';
import { Contract, ExpiryStatus, User } from '../types';
import { Edit2, Trash2, FileText, Calendar, DollarSign, Box, Archive, RefreshCw, StickyNote, Clock } from 'lucide-react';

interface ContractListProps {
  user: User;
  contracts: Contract[];
  onEdit: (c: Contract) => void;
  onDelete: (id: number) => void;
  onArchiveToggle: (id: number) => void;
  onViewHistory: (c: Contract) => void;
  onViewNotes: (c: Contract) => void;
  getStatus: (date: string) => ExpiryStatus;
}

export default function ContractList({ user, contracts, onEdit, onDelete, onArchiveToggle, onViewHistory, onViewNotes, getStatus }: ContractListProps) {
  if (contracts.length === 0) {
    return (
      <div className="p-12 text-center text-gray-500">
        <FileText className="mx-auto w-12 h-12 text-gray-300 mb-4" />
        <p className="text-lg">Sutarčių nerasta.</p>
        <p className="text-sm">Sukurkite naują sutartį arba pakeiskite paiešką.</p>
      </div>
    );
  }

  const getStatusColor = (status: ExpiryStatus) => {
    switch (status) {
      case ExpiryStatus.EXPIRED: return 'bg-red-100 text-red-800 border-red-200';
      case ExpiryStatus.WARNING: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case ExpiryStatus.VALID: return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const canEdit = user.role === 'admin' || user.role === 'sales';
  const canDelete = user.role === 'admin';

  return (
    <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-200">
      <table className="w-full text-left text-sm text-slate-600">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <th className="px-6 py-4 font-bold text-slate-700 uppercase tracking-wider text-xs">Klientas / Tipas</th>
            <th className="px-6 py-4 font-bold text-slate-700 uppercase tracking-wider text-xs">Poliso detalės</th>
            <th className="px-6 py-4 font-bold text-slate-700 uppercase tracking-wider text-xs">Būsena</th>
            <th className="px-6 py-4 font-bold text-slate-700 uppercase tracking-wider text-xs">Finansai</th>
            <th className="px-6 py-4 font-bold text-slate-700 uppercase tracking-wider text-xs text-right">Veiksmai</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {contracts.map((contract) => {
            const status = getStatus(contract.galiojaIki);
            return (
              <tr key={contract.id} className="hover:bg-blue-50/50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="font-semibold text-slate-900 text-base flex items-center gap-2">
                    {contract.draudejas}
                    {contract.notes && contract.notes.length > 0 && (
                      <button
                        onClick={() => onViewNotes(contract)}
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-600 hover:bg-amber-200 transition-colors"
                        title={`${contract.notes.length} pastabos`}
                      >
                        <StickyNote size={12} />
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 inline-flex items-center gap-2">
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium border border-slate-200">
                      {contract.ldGrupe || 'Nenurodyta'}
                    </span>
                    <span className="text-slate-400">|</span>
                    <span>{contract.pardavejas}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-mono text-slate-700 font-medium tracking-tight bg-slate-50 inline-block px-2 py-0.5 rounded border border-slate-100">
                    {contract.policyNo}
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-1.5">
                    <Box size={14} className="text-slate-400" />
                    <span className="font-medium">{contract.valstybinisNr}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {contract.is_archived ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                      <Archive size={12} />
                      Archyvuota
                    </span>
                  ) : (
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border shadow-sm ${getStatusColor(status)}`}>
                      {status === ExpiryStatus.EXPIRED ? 'Pasibaigę' : status === ExpiryStatus.WARNING ? 'Baigiasi' : 'Aktyvi'}
                    </span>
                  )}
                  <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5 font-medium">
                    <Calendar size={14} className="text-slate-400" />
                    IKI: {new Date(contract.galiojaIki).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-slate-900 font-bold text-sm">
                    {contract.metineIsmoka.toFixed(2)} €
                    <span className="text-xs font-normal text-slate-400 ml-1">/ met.</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Vertė: {contract.ismoka.toFixed(2)} €
                  </div>
                </td>

                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onViewNotes(contract)}
                      className="p-2 hover:bg-amber-50 text-slate-400 hover:text-amber-600 rounded-lg transition-all"
                      title="Pastabos"
                    >
                      <StickyNote size={18} />
                    </button>

                    <button
                      onClick={() => onViewHistory(contract)}
                      className="p-2 hover:bg-purple-50 text-slate-400 hover:text-purple-600 rounded-lg transition-all"
                      title="Istorija"
                    >
                      <Clock size={18} />
                    </button>

                    {canEdit && (
                      <>
                        <button
                          onClick={() => contract.id && onArchiveToggle(contract.id)}
                          className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition-all"
                          title={contract.is_archived ? "Atkurti" : "Archyvuoti"}
                        >
                          {contract.is_archived ? <RefreshCw size={18} /> : <Archive size={18} />}
                        </button>

                        <button
                          onClick={() => onEdit(contract)}
                          className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-all"
                          title="Redaguoti"
                        >
                          <Edit2 size={18} />
                        </button>
                      </>
                    )}

                    {canDelete && (
                      <button
                        onClick={() => contract.id && onDelete(contract.id)}
                        className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors ml-2 border-l border-slate-100 pl-3"
                        title="Ištrinti"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}