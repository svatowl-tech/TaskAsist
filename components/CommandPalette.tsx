
import React, { useState, useEffect, useRef } from 'react';
import { Task, Note, ViewMode } from '../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  notes: Note[];
  onNavigate: (view: ViewMode) => void;
  onSelectTask: (task: Task) => void;
  onSelectNote: (note: Note) => void;
  toggleTheme: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen, onClose, tasks, notes, onNavigate, onSelectTask, onSelectNote, toggleTheme
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const filteredItems = React.useMemo(() => {
    const q = query.toLowerCase();
    const items: { type: string, label: string, icon: string, action: () => void }[] = [];

    // Navigation
    const navs: {id: ViewMode, label: string, icon: string}[] = [
      { id: 'tasks', label: 'Перейти к Задачам', icon: '📋' },
      { id: 'calendar', label: 'Перейти в Календарь', icon: '📅' },
      { id: 'board', label: 'Перейти на Доску', icon: '📊' },
      { id: 'notes', label: 'Перейти в Заметки', icon: '📝' },
      { id: 'analytics', label: 'Перейти в Аналитику', icon: '📈' },
    ];
    
    navs.forEach(n => {
      if (n.label.toLowerCase().includes(q)) {
        items.push({ type: 'nav', label: n.label, icon: n.icon, action: () => onNavigate(n.id) });
      }
    });

    // System
    if ('сменить тему'.includes(q) || 'theme'.includes(q)) {
        items.push({ type: 'sys', label: 'Сменить тему (Светлая/Темная)', icon: '🌓', action: toggleTheme });
    }

    // Tasks
    tasks.slice(0, 10).forEach(t => {
      if (t.title.toLowerCase().includes(q)) {
        items.push({ type: 'task', label: t.title, icon: '✅', action: () => onSelectTask(t) });
      }
    });

    // Notes
    notes.slice(0, 5).forEach(n => {
      if (n.title.toLowerCase().includes(q)) {
        items.push({ type: 'note', label: n.title, icon: '📄', action: () => onSelectNote(n) });
      }
    });

    return items;
  }, [query, tasks, notes]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] bg-black/50 backdrop-blur-sm transition-opacity">
      <div className="w-full max-w-xl bg-bg-surface rounded-xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[60vh] animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center px-4 py-3 border-b border-border">
          <span className="text-xl mr-3 opacity-50">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-lg text-text-main placeholder-text-disabled"
            placeholder="Куда перейдем? (Задачи, заметки, настройки...)"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
          />
          <div className="hidden sm:flex items-center gap-1">
             <kbd className="px-2 py-0.5 bg-bg-panel border border-border rounded text-xs text-text-muted">esc</kbd>
          </div>
        </div>
        
        <div className="overflow-y-auto flex-1 p-2">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-text-muted">Ничего не найдено</div>
          ) : (
            filteredItems.map((item, idx) => (
              <button
                key={idx}
                onClick={() => { item.action(); onClose(); }}
                className={`w-full flex items-center px-3 py-3 rounded-lg text-left transition-colors
                  ${idx === selectedIndex ? 'bg-primary text-white' : 'text-text-main hover:bg-bg-panel'}
                `}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <span className="mr-3 text-lg">{item.icon}</span>
                <span className="flex-1 truncate font-medium">{item.label}</span>
                {idx === selectedIndex && <span className="text-xs opacity-80">↵</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
