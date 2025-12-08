import React, { useState, useEffect, useRef } from 'react';
import { Contract } from '../types';
import { X, Upload, Save, FileText, Plus, Trash2, Edit2, Check, Bold, Italic, List, RefreshCw, AlertTriangle, Quote } from 'lucide-react';

interface ContractFormProps {
  onClose: () => void;
  onSave: (contract: Contract) => void;
  initialData?: Contract;
  initialMode?: 'view' | 'edit';
}

const DRAFT_KEY = 'finlitte_new_contract_draft';

export default function ContractForm({ onClose, onSave, initialData, initialMode = 'edit' }: ContractFormProps) {
  const [mode, setMode] = useState<'view' | 'edit'>(initialMode);
  const [formData, setFormData] = useState<Contract>({
    draudejas: '',
    pardavejas: '',
    ldGrupe: '',
    policyNo: '',
    galiojaNuo: new Date().toISOString().split('T')[0],
    galiojaIki: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    valstybinisNr: '',
    metineIsmoka: 0,
    ismoka: 0,

    atnaujinimoData: new Date().toISOString().split('T')[0],
    notes: []
  });

  const [noteInput, setNoteInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // State for editing specific notes
  const [editingNoteIdx, setEditingNoteIdx] = useState<number | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-Save / Draft State
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      // Check for draft only in "New Contract" mode
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          // Only prompt if there is meaningful data
          if (parsed.formData.draudejas || parsed.formData.policyNo || parsed.formData.notes.length > 0) {
            setShowDraftPrompt(true);
          }
        } catch (e) {
          console.error("Failed to parse draft", e);
        }
      }
    }
  }, [initialData]);

  // Auto-save effect
  useEffect(() => {
    // Don't auto-save if we are editing an existing contract (unless we want to support it there too?), 
    // or if the draft prompt is currently visible (to avoid overwriting the draft with empty state)
    // Also logic: only auto-save if mode is edit
    if (initialData || showDraftPrompt || mode === 'view') return;

    const timeoutId = setTimeout(() => {
      // Only save if some data has been entered
      if (formData.draudejas || formData.policyNo || formData.valstybinisNr || noteInput) {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({
          formData,
          noteInput
        }));
      }
    }, 800); // Debounce save by 800ms

    return () => clearTimeout(timeoutId);
  }, [formData, noteInput, initialData, showDraftPrompt, mode]);

  const handleRestoreDraft = () => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        setFormData(parsed.formData);
        setNoteInput(parsed.noteInput || '');
        setShowDraftPrompt(false);
      }
    } catch (e) {
      console.error("Error restoring draft", e);
    }
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setShowDraftPrompt(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setIsUploading(true);
    const file = e.target.files[0];
    const uploadData = new FormData();
    uploadData.append('file', file);

    try {
      // Send to the webhook as requested in prompt
      const res = await fetch('https://n8n.girsta.com/webhook/upload-csv', {
        method: 'POST',
        body: uploadData
      });

      if (res.ok) {
        const json = await res.json();
        // Assuming the webhook returns fields mapping to our contract
        setFormData(prev => ({
          ...prev,
          ...json // simplistic merge, in reality might need field mapping
        }));
      } else {
        alert("Webhook įkėlimas nepavyko");
      }
    } catch (err) {
      console.error("Upload error", err);
      alert("Klaida įkeliant failą");
    } finally {
      setIsUploading(false);
    }
  };

  // --- Markdown / Rich Text Helpers ---

  const insertMarkdown = (
    syntax: string,
    type: 'inline' | 'block' | 'list',
    targetState: string,
    setTargetState: React.Dispatch<React.SetStateAction<string>>,
    ref: React.RefObject<HTMLTextAreaElement>
  ) => {
    if (!ref.current) return;

    const start = ref.current.selectionStart;
    const end = ref.current.selectionEnd;
    const text = targetState;

    let newText = '';

    if (type === 'list' || type === 'block') {
      // Prepend current line with syntax (e.g., "- " or "> ")
      const before = text.substring(0, start);
      const after = text.substring(start);
      // Find start of line
      const lastNewLine = before.lastIndexOf('\n');
      const insertAt = lastNewLine === -1 ? 0 : lastNewLine + 1;

      newText = text.substring(0, insertAt) + syntax + text.substring(insertAt);

      setTargetState(newText);
      // Restore focus and move cursor
      setTimeout(() => {
        ref.current?.focus();
        ref.current?.setSelectionRange(start + syntax.length, start + syntax.length);
      }, 0);
    } else {
      // Wrap selection
      const selection = text.substring(start, end);
      newText = text.substring(0, start) + syntax + selection + syntax + text.substring(end);

      setTargetState(newText);
      // Restore focus
      setTimeout(() => {
        ref.current?.focus();
        // If text was selected, keep it selected inside tags
        if (start !== end) {
          ref.current?.setSelectionRange(start + syntax.length, end + syntax.length);
        } else {
          // If no text, put cursor between tags
          ref.current?.setSelectionRange(start + syntax.length, start + syntax.length);
        }
      }, 0);
    }
  };

  const renderMarkdown = (text: string) => {
    // Simple parser for Bold (**), Italic (*), List (- ), and Blockquote (> )
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

  // --- Note Logic ---

  const handleAddNote = () => {
    if (!noteInput.trim()) return;
    setFormData(prev => ({ ...prev, notes: [...prev.notes, noteInput.trim()] }));
    setNoteInput('');
  };

  const handleDeleteNote = (idxToDelete: number) => {
    setFormData(prev => ({
      ...prev,
      notes: prev.notes.filter((_, idx) => idx !== idxToDelete)
    }));
  };

  const startEditNote = (idx: number, text: string) => {
    setEditingNoteIdx(idx);
    setEditNoteText(text);
  };

  const saveEditNote = () => {
    if (editingNoteIdx === null) return;
    if (!editNoteText.trim()) {
      setEditingNoteIdx(null);
      return;
    }

    setFormData(prev => {
      const newNotes = [...prev.notes];
      newNotes[editingNoteIdx] = editNoteText.trim();
      return { ...prev, notes: newNotes };
    });
    setEditingNoteIdx(null);
    setEditNoteText('');
  };

  const cancelEditNote = () => {
    setEditingNoteIdx(null);
    setEditNoteText('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    // Clear draft on successful save
    if (!initialData) {
      localStorage.removeItem(DRAFT_KEY);
    }
  };

  const renderField = (label: string, value: string | number, type: string = 'text', field?: keyof Contract, required = false) => {
    if (mode === 'view') {
      return (
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 opacity-70">{label}</label>
          <div className="text-gray-900 font-medium text-base py-1 border-b border-gray-100 min-h-[1.5em]">
            {value}
          </div>
        </div>
      );
    }

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input
          required={required}
          type={type}
          step={type === 'number' ? '0.01' : undefined}
          value={value}
          onChange={e => field && setFormData({ ...formData, [field]: type === 'number' ? parseFloat(e.target.value) : e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
        />
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="sticky top-0 bg-white border-b border-gray-100 z-10">
          {/* Header */}
          <div className="px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              {mode === 'view' ? (
                <>
                  <FileText className="text-blue-500" />
                  Sutarties peržiūra
                </>
              ) : (
                <>{initialData ? 'Redaguoti sutartį' : 'Nauja sutartis'}</>
              )}
            </h2>
            <div className="flex items-center gap-2">
              {mode === 'view' && (
                <button
                  onClick={() => setMode('edit')}
                  className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
                >
                  <Edit2 size={16} />
                  Redaguoti
                </button>
              )}
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Draft Prompt Banner */}
          {showDraftPrompt && mode === 'edit' && (
            <div className="bg-blue-50 border-b border-blue-100 px-6 py-3 flex items-center justify-between animate-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-blue-800 text-sm">
                <AlertTriangle size={16} />
                <span>Rastas neišsaugotas juodraštis.</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDiscardDraft}
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded hover:bg-blue-100 transition-colors"
                >
                  Atmesti
                </button>
                <button
                  onClick={handleRestoreDraft}
                  className="text-xs font-medium bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                >
                  <RefreshCw size={12} />
                  Atkurti juodraštį
                </button>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6">


          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <h3 className="text-sm uppercase tracking-wide text-gray-500 font-semibold border-b pb-2">Kliento informacija</h3>

              {renderField('Kliento vardas (Draudėjas)', formData.draudejas, 'text', 'draudejas', true)}
              {renderField('Pardavėjas (ID)', formData.pardavejas, 'text', 'pardavejas', true)}
              {renderField('Valstybinis Nr.', formData.valstybinisNr, 'text', 'valstybinisNr')}
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <h3 className="text-sm uppercase tracking-wide text-gray-500 font-semibold border-b pb-2">Poliso detalės</h3>

              <div className="grid grid-cols-2 gap-4">
                {renderField('Poliso Nr.', formData.policyNo, 'text', 'policyNo', true)}
                {renderField('LD grupės pavadinimas', formData.ldGrupe, 'text', 'ldGrupe', true)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {renderField('Galioja nuo', formData.galiojaNuo, 'date', 'galiojaNuo')}
                {renderField('Galioja iki', formData.galiojaIki, 'date', 'galiojaIki', true)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {renderField('Metinė įmoka', formData.metineIsmoka, 'number', 'metineIsmoka')}
                {renderField('Išmokos vertė', formData.ismoka, 'number', 'ismoka')}
              </div>


            </div>
          </div>

          {/* Notes Section */}
          <div className="mt-8 bg-gray-50 rounded-xl p-6 border border-gray-200">
            <h3 className="text-sm uppercase tracking-wide text-gray-500 font-semibold mb-4 flex items-center gap-2">
              <FileText size={16} />
              Sutarties pastabos
            </h3>

            {/* Notes List */}
            <div className="space-y-4 mb-6">
              {formData.notes.length === 0 && <p className="text-gray-400 text-sm italic">Pastabų dar nėra.</p>}

              {formData.notes.map((note, idx) => (
                <div key={idx} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm text-sm text-gray-700 group flex items-start justify-between gap-3">

                  {/* Edit Mode */}
                  {editingNoteIdx === idx && mode === 'edit' ? (
                    <div className="flex-1 flex flex-col gap-2">
                      {/* Rich Text Toolbar for Edit */}
                      <div className="flex items-center gap-1 bg-gray-50 p-1.5 rounded-t-lg border border-gray-200 border-b-0">
                        <button type="button" onClick={() => insertMarkdown('**', 'inline', editNoteText, setEditNoteText, editInputRef)} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Paryškinti">
                          <Bold size={14} />
                        </button>
                        <button type="button" onClick={() => insertMarkdown('*', 'inline', editNoteText, setEditNoteText, editInputRef)} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Kursyvas">
                          <Italic size={14} />
                        </button>
                        <button type="button" onClick={() => insertMarkdown('- ', 'list', editNoteText, setEditNoteText, editInputRef)} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Sąrašas">
                          <List size={14} />
                        </button>
                        <button type="button" onClick={() => insertMarkdown('> ', 'block', editNoteText, setEditNoteText, editInputRef)} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Citata">
                          <Quote size={14} />
                        </button>
                      </div>

                      <textarea
                        ref={editInputRef}
                        value={editNoteText}
                        onChange={(e) => setEditNoteText(e.target.value)}
                        className="w-full px-3 py-2 border border-blue-300 rounded-b-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px] font-mono text-sm"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={cancelEditNote}
                          className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded text-xs font-medium border border-red-200"
                        >
                          Atšaukti
                        </button>
                        <button
                          type="button"
                          onClick={saveEditNote}
                          className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-blue-700"
                        >
                          Išsaugoti pakeitimus
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <>
                      <div className="flex-1 flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0"></div>
                        <div className="text-gray-800 w-full">
                          {renderMarkdown(note)}
                        </div>
                      </div>

                      {mode === 'edit' && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-start">
                          <button
                            type="button"
                            onClick={() => startEditNote(idx, note)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Redaguoti pastabą"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteNote(idx)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Ištrinti pastabą"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add New Note (Rich Editor) - Only in Edit Mode */}
            {mode === 'edit' && (
              <div className="border border-gray-300 rounded-lg bg-white overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-shadow">
                {/* Toolbar */}
                <div className="flex items-center gap-1 bg-gray-50 p-2 border-b border-gray-200">
                  <span className="text-xs text-gray-400 font-medium mr-2 px-1">FORMATAS:</span>
                  <button type="button" onClick={() => insertMarkdown('**', 'inline', noteInput, setNoteInput, inputRef)} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Paryškinti">
                    <Bold size={16} />
                  </button>
                  <button type="button" onClick={() => insertMarkdown('*', 'inline', noteInput, setNoteInput, inputRef)} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Kursyvas">
                    <Italic size={16} />
                  </button>
                  <div className="w-px h-4 bg-gray-300 mx-1"></div>
                  <button type="button" onClick={() => insertMarkdown('- ', 'list', noteInput, setNoteInput, inputRef)} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Sąrašas">
                    <List size={16} />
                  </button>
                  <button type="button" onClick={() => insertMarkdown('> ', 'block', noteInput, setNoteInput, inputRef)} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Citata">
                    <Quote size={16} />
                  </button>
                </div>

                <div className="relative">
                  <textarea
                    ref={inputRef}
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    placeholder="Įveskite naują išsamią pastabą čia..."
                    className="w-full p-3 outline-none min-h-[100px] text-sm resize-y font-mono"
                  />
                  <div className="absolute bottom-3 right-3">
                    <button
                      type="button"
                      onClick={handleAddNote}
                      disabled={!noteInput.trim()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-4 py-1.5 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                      <Plus size={16} />
                      Pridėti pastabą
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end gap-3">
            {mode === 'edit' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    // If we were initially in view mode, revert nicely or just close? 
                    // If we are deep editing, maybe allow Revert to View. 
                    // But simple close is safer to avoid confusion.
                    if (initialMode === 'view') setMode('view');
                    else onClose();
                  }}
                  className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {initialMode === 'view' ? 'Atšaukti redagavimą' : 'Atšaukti'}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm flex items-center gap-2 transition-colors"
                >
                  <Save size={18} />
                  Išsaugoti sutartį
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
              >
                Uždaryti
              </button>
            )}

          </div>
        </form>
      </div>
    </div>
  );
}