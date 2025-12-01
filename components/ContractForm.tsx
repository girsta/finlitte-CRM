import React, { useState, useEffect, useRef } from 'react';
import { Contract } from '../types';
import { X, Upload, Save, FileText, Plus, Trash2, Edit2, Check, Bold, Italic, List, RefreshCw, AlertTriangle, Quote } from 'lucide-react';

interface ContractFormProps {
  onClose: () => void;
  onSave: (contract: Contract) => void;
  initialData?: Contract;
}

const DRAFT_KEY = 'finlitte_new_contract_draft';

export default function ContractForm({ onClose, onSave, initialData }: ContractFormProps) {
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
    // Don't auto-save if we are editing an existing contract, 
    // or if the draft prompt is currently visible (to avoid overwriting the draft with empty state)
    if (initialData || showDraftPrompt) return;

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
  }, [formData, noteInput, initialData, showDraftPrompt]);

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
        alert("Webhook upload failed");
      }
    } catch (err) {
      console.error("Upload error", err);
      alert("Error uploading file");
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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-100 z-10">
           {/* Header */}
           <div className="px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {initialData ? 'Edit Contract' : 'New Contract'}
              </h2>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                <X size={20} />
              </button>
           </div>
           
           {/* Draft Prompt Banner */}
           {showDraftPrompt && (
             <div className="bg-blue-50 border-b border-blue-100 px-6 py-3 flex items-center justify-between animate-in slide-in-from-top-2">
                <div className="flex items-center gap-2 text-blue-800 text-sm">
                   <AlertTriangle size={16} />
                   <span>Unsaved draft found from a previous session.</span>
                </div>
                <div className="flex items-center gap-2">
                   <button 
                     onClick={handleDiscardDraft}
                     className="text-xs font-medium text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded hover:bg-blue-100 transition-colors"
                   >
                     Discard
                   </button>
                   <button 
                     onClick={handleRestoreDraft}
                     className="text-xs font-medium bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                   >
                     <RefreshCw size={12} />
                     Restore Draft
                   </button>
                </div>
             </div>
           )}
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* File Upload Section */}
          {!initialData && (
            <div className="mb-8 p-6 border-2 border-dashed border-blue-200 rounded-xl bg-blue-50/50 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="p-3 bg-white rounded-full shadow-sm text-blue-600">
                  <Upload size={24} />
                </div>
                <h3 className="font-semibold text-blue-900">Auto-fill from Document</h3>
                <p className="text-sm text-blue-600/80 mb-2">Upload a policy CSV/PDF to auto-populate fields</p>
                <input 
                  type="file" 
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="block w-full text-sm text-slate-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-full file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-600 file:text-white
                    hover:file:bg-blue-700
                    cursor-pointer max-w-xs mx-auto
                  "
                />
                {isUploading && <p className="text-xs text-blue-600 animate-pulse">Processing document...</p>}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <h3 className="text-sm uppercase tracking-wide text-gray-500 font-semibold border-b pb-2">Client Details</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Name (Draudejas)</label>
                <input
                  required
                  type="text"
                  value={formData.draudejas}
                  onChange={e => setFormData({...formData, draudejas: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Salesperson (ID)</label>
                <input
                  required
                  type="text"
                  value={formData.pardavejas}
                  onChange={e => setFormData({...formData, pardavejas: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              
               <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registration No.</label>
                <input
                  type="text"
                  value={formData.valstybinisNr}
                  onChange={e => setFormData({...formData, valstybinisNr: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <h3 className="text-sm uppercase tracking-wide text-gray-500 font-semibold border-b pb-2">Policy Details</h3>
              
              <div className="grid grid-cols-2 gap-4">
                 <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Policy No.</label>
                  <input
                    required
                    type="text"
                    value={formData.policyNo}
                    onChange={e => setFormData({...formData, policyNo: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type (Grupe)</label>
                  <input
                    required
                    type="text"
                    value={formData.ldGrupe}
                    onChange={e => setFormData({...formData, ldGrupe: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid From</label>
                  <input
                    type="date"
                    value={formData.galiojaNuo}
                    onChange={e => setFormData({...formData, galiojaNuo: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                  <input
                    required
                    type="date"
                    value={formData.galiojaIki}
                    onChange={e => setFormData({...formData, galiojaIki: e.target.value})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Yearly Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.metineIsmoka}
                    onChange={e => setFormData({...formData, metineIsmoka: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payout Value</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.ismoka}
                    onChange={e => setFormData({...formData, ismoka: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="mt-8 bg-gray-50 rounded-xl p-6 border border-gray-200">
            <h3 className="text-sm uppercase tracking-wide text-gray-500 font-semibold mb-4 flex items-center gap-2">
              <FileText size={16} />
              Contract Notes
            </h3>
            
            {/* Notes List */}
            <div className="space-y-4 mb-6">
              {formData.notes.length === 0 && <p className="text-gray-400 text-sm italic">No notes added yet.</p>}
              
              {formData.notes.map((note, idx) => (
                <div key={idx} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm text-sm text-gray-700 group flex items-start justify-between gap-3">
                  
                  {/* Edit Mode */}
                  {editingNoteIdx === idx ? (
                    <div className="flex-1 flex flex-col gap-2">
                      {/* Rich Text Toolbar for Edit */}
                      <div className="flex items-center gap-1 bg-gray-50 p-1.5 rounded-t-lg border border-gray-200 border-b-0">
                         <button type="button" onClick={() => insertMarkdown('**', 'inline', editNoteText, setEditNoteText, editInputRef)} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Bold">
                           <Bold size={14} />
                         </button>
                         <button type="button" onClick={() => insertMarkdown('*', 'inline', editNoteText, setEditNoteText, editInputRef)} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Italic">
                           <Italic size={14} />
                         </button>
                         <button type="button" onClick={() => insertMarkdown('- ', 'list', editNoteText, setEditNoteText, editInputRef)} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Bulleted List">
                           <List size={14} />
                         </button>
                         <button type="button" onClick={() => insertMarkdown('> ', 'block', editNoteText, setEditNoteText, editInputRef)} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Quote">
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
                          Cancel
                        </button>
                        <button 
                          type="button" 
                          onClick={saveEditNote}
                          className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-blue-700"
                        >
                          Save Changes
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
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-start">
                        <button 
                          type="button"
                          onClick={() => startEditNote(idx, note)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit Note"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleDeleteNote(idx)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete Note"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add New Note (Rich Editor) */}
            <div className="border border-gray-300 rounded-lg bg-white overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-shadow">
               {/* Toolbar */}
               <div className="flex items-center gap-1 bg-gray-50 p-2 border-b border-gray-200">
                  <span className="text-xs text-gray-400 font-medium mr-2 px-1">FORMAT:</span>
                  <button type="button" onClick={() => insertMarkdown('**', 'inline', noteInput, setNoteInput, inputRef)} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Bold">
                    <Bold size={16} />
                  </button>
                  <button type="button" onClick={() => insertMarkdown('*', 'inline', noteInput, setNoteInput, inputRef)} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Italic">
                    <Italic size={16} />
                  </button>
                  <div className="w-px h-4 bg-gray-300 mx-1"></div>
                  <button type="button" onClick={() => insertMarkdown('- ', 'list', noteInput, setNoteInput, inputRef)} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="List">
                    <List size={16} />
                  </button>
                  <button type="button" onClick={() => insertMarkdown('> ', 'block', noteInput, setNoteInput, inputRef)} className="p-1.5 hover:bg-gray-200 rounded text-gray-700" title="Quote">
                    <Quote size={16} />
                  </button>
               </div>
               
               <div className="relative">
                 <textarea
                  ref={inputRef}
                  value={noteInput}
                  onChange={e => setNoteInput(e.target.value)}
                  placeholder="Type a new detailed note here..."
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
                    Add Note
                   </button>
                 </div>
               </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-8 pt-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm flex items-center gap-2 transition-colors"
            >
              <Save size={18} />
              Save Contract
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}