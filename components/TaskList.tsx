
import React, { useState, useRef, useEffect } from 'react';
import { Task } from '../types';

interface TaskListProps {
  tasks: Task[];
  onAdd: (title: string) => Promise<void>;
  onToggle: (id: string, completed: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onEdit: (task: Task) => void;
}

interface SwipeableTaskItemProps {
  task: Task;
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
}

const SwipeableTaskItem: React.FC<SwipeableTaskItemProps> = ({ 
  task, 
  onToggle, 
  onDelete,
  onEdit
}) => {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{x: number, y: number} | null>(null);
  
  const startX = useRef(0);
  const timerRef = useRef<number | null>(null);

  // --- Gestures ---
  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setIsDragging(true);

    // Long Press Detection (Mobile)
    timerRef.current = window.setTimeout(() => {
       setIsDragging(false); // Cancel swipe
       if (navigator.vibrate) navigator.vibrate(50);
       setMenuPos(null); // Center menu for touch
       setShowContextMenu(true);
    }, 600); // 600ms long press
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (timerRef.current) clearTimeout(timerRef.current); // Cancel long press on move
    if (!isDragging) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - startX.current;
    if (Math.abs(diff) < 150) {
      setOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsDragging(false);
    if (offset > 100) {
      if (navigator.vibrate) navigator.vibrate(20);
      onToggle(task.id, true);
    } else if (offset < -100) {
      if (navigator.vibrate) navigator.vibrate(20);
      onDelete(task.id);
    }
    setOffset(0);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsDragging(false);
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(task.title);
    setShowContextMenu(false);
  };

  const bgStyle = offset > 0 ? 'bg-success' : offset < 0 ? 'bg-error' : 'bg-transparent';

  return (
    <div className="relative mb-3 overflow-hidden rounded-card h-auto min-h-[72px] select-none touch-pan-y">
      {/* Context Menu Overlay */}
      {showContextMenu && (
        <>
          <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-[1px]" onClick={() => setShowContextMenu(false)}></div>
          <div 
            className={`z-50 bg-bg-surface border border-border rounded-lg shadow-xl w-48 p-2 animate-in fade-in zoom-in-95 ${menuPos ? 'fixed' : 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'}`}
            style={menuPos ? { top: menuPos.y, left: menuPos.x } : {}}
          >
             <button onClick={() => { onToggle(task.id, !task.completed); setShowContextMenu(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-bg-panel rounded text-text-main">
               {task.completed ? 'Вернуть в работу' : 'Завершить'}
             </button>
             <button onClick={() => { onEdit(task); setShowContextMenu(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-bg-panel rounded text-text-main">
               ✏️ Редактировать
             </button>
             <button onClick={handleCopy} className="w-full text-left px-3 py-2 text-sm hover:bg-bg-panel rounded text-text-main">
               📋 Копировать
             </button>
             <div className="h-px bg-border my-1"></div>
             <button onClick={() => { onDelete(task.id); setShowContextMenu(false); }} className="w-full text-left px-3 py-2 text-sm text-error hover:bg-error/10 rounded">
               🗑 Удалить
             </button>
          </div>
        </>
      )}

      <div className={`absolute inset-0 flex items-center justify-between px-6 text-white font-bold transition-colors ${bgStyle}`}>
        <span className={offset > 0 ? 'opacity-100' : 'opacity-0'}>✓ Готово</span>
        <span className={offset < 0 ? 'opacity-100' : 'opacity-0'}>🗑 Удалить</span>
      </div>

      <div 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
        style={{ transform: `translateX(${offset}px)`, transition: isDragging ? 'none' : 'transform 0.2s ease-out' }}
        className="relative bg-bg-surface p-4 border border-border rounded-card shadow-card active:shadow-card-hover hover:shadow-card-hover transition-shadow h-full flex items-center group"
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(task.id, !task.completed); }}
          className={`flex-shrink-0 w-5 h-5 rounded-[4px] border border-border mr-4 focus:outline-none flex items-center justify-center transition-colors ${task.completed ? 'bg-success border-success text-white' : 'bg-transparent'}`}
          aria-label={task.completed ? "Mark as incomplete" : "Mark as complete"}
        >
          {task.completed && <span className="text-xs font-bold">✓</span>}
        </button>
        
        <div className="flex-1 min-w-0" onDoubleClick={() => onEdit(task)}>
          <span className={`block font-medium text-text-main ${task.completed ? 'text-text-disabled line-through' : ''}`}>
            {task.title}
          </span>
          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {task.tags.map(tag => (
                <span key={tag} className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-[4px] bg-bg-panel text-text-muted border border-border">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Desktop generic menu trigger hint or simple edit button */}
        <button 
          onClick={(e) => { e.stopPropagation(); onEdit(task); }}
          className="ml-2 p-2 text-text-muted hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity hidden lg:block"
        >
          ✏️
        </button>
      </div>
    </div>
  );
};

export const TaskList: React.FC<TaskListProps> = ({ tasks, onAdd, onToggle, onDelete, onEdit }) => {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  
  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    await onAdd(newTaskTitle);
    setNewTaskTitle('');
  };

  return (
    <div className="flex flex-col h-full space-y-6 p-4 lg:p-8 max-w-5xl mx-auto">
      {/* Desktop Input */}
      <form onSubmit={handleSubmit} className="hidden lg:flex gap-3">
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="Добавить новую задачу..."
          className="input-field flex-1"
        />
        <button
          type="submit"
          disabled={!newTaskTitle.trim()}
          className="btn-primary"
        >
          Добавить
        </button>
      </form>

      <div className="flex-1 overflow-y-auto pr-1 pb-20 lg:pb-0 space-y-6 no-scrollbar">
        <div>
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4 px-1">
            В работе ({activeTasks.length})
          </h3>
          
          {activeTasks.length === 0 && (
            <div className="p-8 text-center border-2 border-dashed border-border rounded-card text-text-disabled">
              Задачи выполнены 🎉
            </div>
          )}
          
          <div>
            {activeTasks.map(task => (
              <SwipeableTaskItem 
                key={task.id} 
                task={task} 
                onToggle={onToggle} 
                onDelete={onDelete}
                onEdit={onEdit}
              />
            ))}
          </div>
        </div>

        {completedTasks.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4 mt-8 px-1">
              Завершено ({completedTasks.length})
            </h3>
            <div className="space-y-3 opacity-75">
              {completedTasks.map(task => (
                <SwipeableTaskItem 
                  key={task.id} 
                  task={task} 
                  onToggle={onToggle} 
                  onDelete={onDelete}
                  onEdit={onEdit}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
