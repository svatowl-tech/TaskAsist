
import React, { useState, useMemo, useRef } from 'react';
import { Note, NoteType, ChecklistItem, AppState } from '../types';
import { AiService } from '../services/aiService';
import { ExportService } from '../services/exportService';

interface NotesViewProps {
  notes: Note[];
  onSaveNote: (note: Partial<Note>) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
  onCreateTask: (title: string, description?: string) => void;
  openRouterApiKey?: string; 
  aiModel?: string;
}

export const NotesView: React.FC<NotesViewProps> = ({ 
  notes, 
  onSaveNote, 
  onDeleteNote,
  onCreateTask,
  openRouterApiKey,
  aiModel
}) => {
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  
  // UI State for errors and confirmations
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  const editorRef = useRef<HTMLDivElement>(null);

  // Memoize filtered notes
  const filteredNotes = useMemo(() => {
    return notes.filter(n => {
      const q = searchQuery.toLowerCase();
      return n.title.toLowerCase().includes(q) || 
             n.content.toLowerCase().includes(q) ||
             n.items?.some(i => i.text.toLowerCase().includes(q));
    }).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [notes, searchQuery]);

  const selectedNote = useMemo(() => 
    notes.find(n => n.id === selectedNoteId), 
  [notes, selectedNoteId]);

  // --- Handlers ---

  const handleCreateNote = async (type: NoteType, template?: ChecklistItem[]) => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: type === 'checklist' ? 'Новый список' : 'Новая заметка',
      content: '',
      type,
      items: template || [],
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await onSaveNote(newNote);
    setSelectedNoteId(newNote.id);
    setErrorMessage(null);
  };

  const handleCreateShoppingList = () => {
    handleCreateNote('checklist', [
      { id: crypto.randomUUID(), text: 'Молоко', completed: false },
      { id: crypto.randomUUID(), text: 'Яйца', completed: false },
      { id: crypto.randomUUID(), text: 'Хлеб', completed: false },
      { id: crypto.randomUUID(), text: 'Овощи', completed: false },
    ]);
  };

  const updateSelectedNote = (updates: Partial<Note>) => {
    if (selectedNoteId) {
      onSaveNote({ id: selectedNoteId, ...updates });
    }
  };

  const handleAiEnhance = async (action: 'grammar' | 'professional' | 'structure' | 'checklist') => {
    if (!selectedNote || !openRouterApiKey) {
      setErrorMessage("Необходим API ключ в настройках для использования ИИ");
      return;
    }
    setErrorMessage(null);
    setIsAiLoading(true);
    setAiMenuOpen(false);

    try {
      if (selectedNote.type === 'text') {
        if (action === 'checklist') {
          // Convert text to checklist
          const items = await AiService.generateChecklistFromText(openRouterApiKey, selectedNote.content || selectedNote.title, aiModel);
          updateSelectedNote({ type: 'checklist', items, content: '' });
        } else {
          // Enhance text
          const enhanced = await AiService.enhanceText(openRouterApiKey, selectedNote.content, action as any, aiModel);
          updateSelectedNote({ content: enhanced });
        }
      } else if (selectedNote.type === 'checklist') {
        // Generate more items or refine existing
        // Extract existing items text
        const existingText = selectedNote.items?.map(i => i.text).join('\n') || selectedNote.title;
        const newItems = await AiService.generateChecklistFromText(openRouterApiKey, `Улучши и дополни этот список:\n${existingText}`, aiModel);
        updateSelectedNote({ items: newItems });
      }
    } catch (e: any) {
      let msg = 'Произошла ошибка';
      if (typeof e === 'string') msg = e;
      else if (e instanceof Error) msg = e.message;
      else if (e && typeof e === 'object') {
         if (e.message && typeof e.message === 'string') {
            msg = e.message;
         } else {
            try { msg = JSON.stringify(e); } catch { msg = String(e); }
         }
      } else {
         msg = String(e);
      }
      if (msg === '[object Object]') msg = 'Неизвестная ошибка (Object)';
      setErrorMessage("Ошибка AI: " + msg);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    if (confirmDeleteId === id) {
      onDeleteNote(id);
      setSelectedNoteId(null);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000); // Reset after 3 seconds
    }
  };

  const handleShareImage = () => {
    if (editorRef.current) {
        ExportService.shareAsImage(editorRef.current, `note-${selectedNote?.title.slice(0, 10) || 'share'}.png`);
    }
  };

  // --- Renderers ---

  return (
    <div className="h-full p-4 lg:p-8 max-w-7xl mx-auto w-full">
      <div className="flex h-full bg-bg-surface rounded-card shadow-card border border-border overflow-hidden relative">
        {errorMessage && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm z-50 shadow-md border border-red-200">
            {errorMessage}
            <button onClick={() => setErrorMessage(null)} className="ml-2 font-bold">&times;</button>
          </div>
        )}

        {/* Sidebar - List of Notes */}
        <div className={`
          w-full lg:w-80 flex flex-col border-r border-border bg-bg-panel
          ${selectedNoteId ? 'hidden lg:flex' : 'flex'}
        `}>
          <div className="p-4 border-b border-border space-y-3">
            {/* Search */}
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-text-muted">🔍</span>
              <input 
                type="text" 
                placeholder="Поиск..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-bg-surface border border-border rounded-[6px] text-sm text-text-main outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              <button 
                onClick={() => handleCreateNote('text')}
                className="flex-1 px-3 py-2 bg-bg-surface border border-border rounded-[6px] text-sm font-medium hover:bg-bg-panel text-text-main whitespace-nowrap transition-colors"
              >
                + Текст
              </button>
              <button 
                onClick={() => handleCreateNote('checklist')}
                className="flex-1 px-3 py-2 bg-bg-surface border border-border rounded-[6px] text-sm font-medium hover:bg-bg-panel text-text-main whitespace-nowrap transition-colors"
              >
                + Список
              </button>
              <button 
                onClick={handleCreateShoppingList}
                className="px-3 py-2 bg-primary/10 text-primary border border-primary/20 rounded-[6px] text-sm font-medium hover:bg-primary/20 whitespace-nowrap transition-colors"
                title="Quick Shopping List"
              >
                🛒
              </button>
            </div>
          </div>

          {/* Notes List */}
          <div className="flex-1 overflow-y-auto">
            {filteredNotes.length === 0 ? (
              <div className="p-8 text-center text-text-muted text-sm">
                Нет заметок.
              </div>
            ) : (
              filteredNotes.map(note => (
                <div 
                  key={note.id}
                  onClick={() => setSelectedNoteId(note.id)}
                  className={`
                    p-4 border-b border-border cursor-pointer transition hover:bg-bg-surface
                    ${selectedNoteId === note.id ? 'bg-bg-surface border-l-4 border-l-primary' : 'bg-transparent border-l-4 border-l-transparent'}
                  `}
                >
                  <div className="font-semibold text-text-main mb-1 truncate">{note.title || 'Без названия'}</div>
                  <div className="text-xs text-text-muted truncate">
                    {note.type === 'checklist' 
                      ? `${note.items?.filter(i => i.completed).length}/${note.items?.length} выполнено`
                      : note.content || 'Нет содержания'
                    }
                  </div>
                  <div className="text-[10px] text-text-disabled mt-2">
                    {new Date(note.updatedAt).toLocaleDateString('ru-RU')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Editor Area */}
        <div className={`
          flex-1 flex flex-col bg-bg-surface
          ${!selectedNoteId ? 'hidden lg:flex' : 'flex'}
        `}>
          {selectedNote ? (
            <>
              {/* Editor Toolbar */}
              <div className="h-14 flex items-center justify-between px-4 border-b border-border bg-bg-main">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setSelectedNoteId(null)}
                    className="lg:hidden mr-2 text-text-muted"
                  >
                    ← Назад
                  </button>
                  <span className="text-xs font-bold uppercase tracking-wider text-text-muted bg-bg-panel px-2 py-1 rounded-[4px]">
                    {selectedNote.type === 'checklist' ? 'Список' : 'Текст'}
                  </span>
                  
                  {/* AI Tools */}
                  {openRouterApiKey && (
                    <div className="relative ml-2">
                      <button 
                        onClick={() => setAiMenuOpen(!aiMenuOpen)}
                        disabled={isAiLoading}
                        className={`
                          flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-semibold uppercase tracking-wider transition
                          ${isAiLoading ? 'bg-bg-panel text-text-disabled cursor-wait' : 'bg-gradient-to-r from-purple-500/10 to-blue-500/10 text-purple-600 dark:text-purple-400 hover:from-purple-500/20 hover:to-blue-500/20'}
                        `}
                      >
                        {isAiLoading ? 'Думаю...' : '✨ ИИ Улучшить'}
                      </button>
                      
                      {aiMenuOpen && !isAiLoading && (
                        <div className="absolute top-full left-0 mt-2 w-48 bg-bg-surface rounded-modal shadow-modal border border-border z-20 overflow-hidden py-1">
                          {selectedNote.type === 'text' && (
                            <>
                              <button onClick={() => handleAiEnhance('grammar')} className="w-full text-left px-4 py-2 text-sm hover:bg-bg-panel text-text-main">Исправить ошибки</button>
                              <button onClick={() => handleAiEnhance('professional')} className="w-full text-left px-4 py-2 text-sm hover:bg-bg-panel text-text-main">Деловой стиль</button>
                              <button onClick={() => handleAiEnhance('structure')} className="w-full text-left px-4 py-2 text-sm hover:bg-bg-panel text-text-main">Структурировать</button>
                              <div className="h-px bg-border my-1"></div>
                              <button onClick={() => handleAiEnhance('checklist')} className="w-full text-left px-4 py-2 text-sm hover:bg-bg-panel text-primary font-medium">В чеклист</button>
                            </>
                          )}
                          {selectedNote.type === 'checklist' && (
                             <button onClick={() => handleAiEnhance('checklist')} className="w-full text-left px-4 py-2 text-sm hover:bg-bg-panel text-text-main">Улучшить/Дополнить</button>
                          )}
                        </div>
                      )}
                      
                      {aiMenuOpen && (
                          <div className="fixed inset-0 z-10" onClick={() => setAiMenuOpen(false)}></div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleShareImage} 
                    className="p-2 text-text-muted hover:text-primary rounded-[6px]"
                    title="Поделиться картинкой"
                  >
                    📸
                  </button>
                  {selectedNote.type === 'text' && (
                     <button 
                      onClick={() => onCreateTask(selectedNote.title, selectedNote.content)}
                      className="p-2 text-primary hover:bg-primary/10 rounded-[6px] text-sm font-medium"
                      title="Convert to Task"
                    >
                      В задачу
                    </button>
                  )}
                  <button 
                    onClick={() => handleDeleteClick(selectedNote.id)}
                    className={`p-2 rounded-[6px] transition-colors text-sm font-medium
                      ${confirmDeleteId === selectedNote.id ? 'bg-error text-white' : 'text-error hover:bg-error/10'}
                    `}
                  >
                    {confirmDeleteId === selectedNote.id ? 'Точно?' : '🗑️'}
                  </button>
                </div>
              </div>

              {/* Editor Content */}
              <div ref={editorRef} className="flex-1 overflow-y-auto p-6 bg-bg-surface">
                <input
                  type="text"
                  value={selectedNote.title}
                  onChange={(e) => updateSelectedNote({ title: e.target.value })}
                  className="w-full text-2xl font-bold border-none outline-none placeholder-text-disabled mb-4 bg-transparent text-text-main"
                  placeholder="Заголовок"
                />

                {selectedNote.type === 'text' ? (
                  <textarea
                    value={selectedNote.content}
                    onChange={(e) => updateSelectedNote({ content: e.target.value })}
                    className="w-full h-[calc(100%-4rem)] resize-none border-none outline-none text-text-main leading-relaxed text-lg bg-transparent"
                    placeholder="Начните писать или накидайте идеи для ИИ..."
                  />
                ) : (
                  <div className="space-y-3">
                    {selectedNote.items?.map((item, index) => (
                      <div key={item.id} className="flex items-center group">
                        <input 
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => {
                            const newItems = [...(selectedNote.items || [])];
                            newItems[index].completed = !newItems[index].completed;
                            updateSelectedNote({ items: newItems });
                          }}
                          className="w-5 h-5 text-primary rounded focus:ring-primary border-border bg-bg-surface mr-3"
                        />
                        <input
                          type="text"
                          value={item.text}
                          onChange={(e) => {
                            const newItems = [...(selectedNote.items || [])];
                            newItems[index].text = e.target.value;
                            updateSelectedNote({ items: newItems });
                          }}
                          className={`
                            flex-1 border-none outline-none bg-transparent text-text-main
                            ${item.completed ? 'line-through text-text-disabled' : ''}
                          `}
                        />
                        <button
                          onClick={() => onCreateTask(item.text, `Из списка: ${selectedNote.title}`)}
                           className="opacity-0 group-hover:opacity-100 p-1 text-xs text-primary hover:underline mr-2"
                        >
                          В задачу
                        </button>
                        <button
                          onClick={() => {
                            const newItems = selectedNote.items?.filter(i => i.id !== item.id);
                            updateSelectedNote({ items: newItems });
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-error"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    
                    {/* Add New Item */}
                    <div className="flex items-center mt-4 text-text-muted">
                      <span className="w-5 h-5 mr-3 flex items-center justify-center">+</span>
                      <input
                        type="text"
                        placeholder="Добавить пункт..."
                        className="flex-1 border-none outline-none bg-transparent text-text-main placeholder-text-disabled"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const target = e.target as HTMLInputElement;
                            if (target.value.trim()) {
                              const newItems = [
                                ...(selectedNote.items || []), 
                                { id: crypto.randomUUID(), text: target.value, completed: false }
                              ];
                              updateSelectedNote({ items: newItems });
                              target.value = '';
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-text-disabled">
              <div className="text-6xl mb-4 opacity-20">📝</div>
              <p className="text-lg font-medium">Выберите заметку или создайте новую</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
