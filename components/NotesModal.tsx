import React from 'react';
import { Contract } from '../types';
import { X, FileText } from 'lucide-react';

interface NotesModalProps {
  contract: Contract;
  onClose: () => void;
}

export default function NotesModal({ contract, onClose }: NotesModalProps) {

  // Reusing the markdown parser from ContractForm to ensure consistency in display
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="whitespace-pre-wrap leading-relaxed">
        {lines.map((line, i) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('- ')) {
            return (
              <div key={i} className="flex gap-2 ml-2">
                <span className="text-blue-500 font-bold">•</span>
                <span>{parseInline(line.substring(2))}</span>
              </div>
            );
          }
          if (trimmed.startsWith('> ')) {
            return (
              <div key={i} className="border-l-4 border-gray-300 pl-3 italic text-gray-600 my-1">
                {parseInline(line.substring(2))}
              </div>
            );
          }
          return <div key={i} className="min-h-[1.2em]">{parseInline(line)}</div>;
        })}
      </div>
    );
  };

  const parseInline = (text: string) => {
    // Split by bold syntax first
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const content = part.substring(2, part.length - 2);
        return <strong key={idx} className="font-bold text-gray-900">{parseInlineItalic(content)}</strong>;
      }
      return <span key={idx}>{parseInlineItalic(part)}</span>;
    });
  };

  const parseInlineItalic = (text: string) => {
    // Split by italic syntax
    const parts = text.split(/(\*.*?\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('*') && part.endsWith('*') && part.length > 1) {
        return <em key={idx} className="italic text-gray-800">{part.substring(1, part.length - 1)}</em>;
      }
      return part;
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-100 p-2 rounded-lg text-yellow-600">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Sutarties pastabos</h2>
              <p className="text-xs text-gray-500">{contract.draudejas} - {contract.policyNo}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
          {contract.notes.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>Šiai sutarčiai pastabų neprisegta.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contract.notes.map((note, idx) => (
                <div key={idx} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-sm text-gray-700 flex gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 mt-2 shrink-0"></div>
                  <div className="w-full">
                    {renderMarkdown(note)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 text-right">
          <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            Uždaryti
          </button>
        </div>
      </div>
    </div>
  );
}