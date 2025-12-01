import React, { useState, useEffect } from 'react';
import { HistoryEntry } from '../types';
import { X, Clock, User as UserIcon } from 'lucide-react';

interface HistoryModalProps {
  contractId: number;
  contractPolicy: string;
  onClose: () => void;
}

export default function HistoryModal({ contractId, contractPolicy, onClose }: HistoryModalProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`/api/contracts/${contractId}/history`);
        if (res.ok) {
          const data = await res.json();
          setHistory(data);
        }
      } catch (e) {
        console.error("Failed to fetch history", e);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [contractId]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
              <Clock size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Audito žurnalas</h2>
              <p className="text-xs text-gray-500">Istorija polisui: {contractPolicy}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>Šiai sutarčiai istorijos nerasta.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {history.map((entry) => (
                <div key={entry.id} className="relative pl-6 border-l-2 border-gray-200 last:border-0 pb-6 last:pb-0">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-purple-400"></div>

                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 -mt-2">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide
                           ${entry.action === 'CREATED' ? 'bg-green-100 text-green-700' : ''}
                           ${entry.action === 'UPDATED' ? 'bg-blue-100 text-blue-700' : ''}
                           ${entry.action === 'ARCHIVED' ? 'bg-gray-200 text-gray-700' : ''}
                           ${entry.action === 'RESTORED' ? 'bg-indigo-100 text-indigo-700' : ''}
                           ${entry.action === 'DELETED' ? 'bg-red-100 text-red-700' : ''}
                         `}>
                          {entry.action === 'CREATED' ? 'SUKURTA' :
                            entry.action === 'UPDATED' ? 'ATNAUJINTA' :
                              entry.action === 'ARCHIVED' ? 'ARCHYVUOTA' :
                                entry.action === 'RESTORED' ? 'ATKURTA' :
                                  entry.action === 'DELETED' ? 'IŠTRINTA' : entry.action}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <UserIcon size={10} />
                          {entry.username}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 font-mono">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {entry.details.split('; ').map((detail, idx) => (
                        <span key={idx} className="block mb-1 last:mb-0">
                          {detail}
                        </span>
                      ))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}