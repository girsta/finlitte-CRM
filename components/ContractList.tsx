import React from 'react';
import { Contract, ExpiryStatus, User } from '../types';
import { Edit2, Trash2, FileText, Calendar, DollarSign, Car, Archive, RefreshCw, StickyNote, Clock } from 'lucide-react';

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
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm text-gray-600">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-4 font-semibold text-gray-900">Klientas / Tipas</th>
            <th className="px-6 py-4 font-semibold text-gray-900">Poliso detalės</th>
            <th className="px-6 py-4 font-semibold text-gray-900">Galiojimas</th>
            <th className="px-6 py-4 font-semibold text-gray-900">Finansai</th>
            <th className="px-6 py-4 font-semibold text-gray-900 text-right">Veiksmai</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {contracts.map((contract) => {
            const status = getStatus(contract.galiojaIki);
            return (
              <tr key={contract.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900 text-base flex items-center gap-2">
                    {contract.draudejas}
                    {contract.notes && contract.notes.length > 0 && (
                      <button
                        onClick={() => onViewNotes(contract)}
                        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100 transition-colors"
                        title={`${contract.notes.length} pastabos prisegtos`}
                      >
                        <StickyNote size={10} className="mr-0.5" />
                        {contract.notes.length}
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 inline-flex items-center gap-1">
                    <span className="bg-gray-200 px-1.5 py-0.5 rounded">{contract.ldGrupe}</span>
                    <span>Pardavėjas: {contract.pardavejas}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-mono text-gray-900">{contract.policyNo}</div>
                  <div className="flex items-center gap-1 text-gray-500 text-xs mt-1">
                    <Car size={12} />
                    {contract.valstybinisNr}
                  </div>
                </td>
                <td className="px-6 py-4">
                  {contract.is_archived ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border bg-gray-100 text-gray-600 border-gray-200">
                      Archyvuota
                    </span>
                  ) : (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(status)}`}>
                      {status === ExpiryStatus.EXPIRED ? 'Pasibaigę' : status === ExpiryStatus.WARNING ? 'Baigiasi' : 'Aktyvi'}
                    </span>
                  )}
                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(contract.galiojaIki).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1 text-gray-900 font-medium">
                    <DollarSign size={14} className="text-gray-400" />
                    {contract.metineIsmoka.toFixed(2)} / metams
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Vertė: {contract.ismoka.toFixed(2)}
                  </div>
                </td>

                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onViewNotes(contract)}
                      className="p-1.5 hover:bg-yellow-50 text-yellow-600 rounded transition-colors"
                      title="Žiūrėti pastabas"
                    >
                      <StickyNote size={16} />
                    </button>

                    <button
                      onClick={() => onViewHistory(contract)}
                      className="p-1.5 hover:bg-purple-50 text-purple-600 rounded transition-colors"
                      title="Žiūrėti istoriją"
                    >
                      <Clock size={16} />
                    </button>

                    {canEdit && (
                      <>
                        <button
                          onClick={() => contract.id && onArchiveToggle(contract.id)}
                          className="p-1.5 hover:bg-gray-100 text-gray-600 rounded transition-colors"
                          title={contract.is_archived ? "Atkurti" : "Archyvuoti"}
                        >
                          {contract.is_archived ? <RefreshCw size={16} /> : <Archive size={16} />}
                        </button>

                        <button
                          onClick={() => onEdit(contract)}
                          className="p-1.5 hover:bg-blue-50 text-blue-600 rounded transition-colors"
                          title="Redaguoti"
                        >
                          <Edit2 size={16} />
                        </button>
                      </>
                    )}

                    {canDelete && (
                      <button
                        onClick={() => contract.id && onDelete(contract.id)}
                        className="p-1.5 hover:bg-red-50 text-red-600 rounded transition-colors"
                        title="Ištrinti negrįžtamai"
                      >
                        <Trash2 size={16} />
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