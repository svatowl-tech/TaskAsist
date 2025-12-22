
import React, { useState, useRef, useEffect } from 'react';
import { Task, TaskStatus } from '../types';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onMoveTask: (taskId: string, newStatus: TaskStatus) => void;
  onAddClick: (status: TaskStatus) => void;
  onDelete: (id: string) => void;
}

const COLUMNS: { id: TaskStatus; label: string; bg: string }[] = [
  { id: 'backlog', label: 'Бэклог', bg: 'bg-bg-panel' },
  { id: 'in-progress', label: 'В работе', bg: 'bg-primary/5' },
  { id: 'review', label: 'Проверка', bg: 'bg-warning/5' },
  { id: 'done', label: 'Готово', bg: 'bg-success/5' },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ 
  tasks, 
  onTaskClick, 
  onMoveTask,
  onAddClick,
  onDelete
}) => {
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; task: Task } | null>(null);
  
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    // Optional: Custom drag image
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCol(status);
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) onMoveTask(taskId, status);
  };

  const handleContextMenu = (e: React.MouseEvent, task: Task) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, task });
  };

  const handleCopy = () => {
    if (contextMenu) {
      navigator.clipboard.writeText(contextMenu.task.title);
      setContextMenu(null);
    }
  };

  // Close menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-x-auto lg:overflow-hidden gap-4 pb-4 snap-x snap-mandatory relative">
      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-50 bg-bg-surface border border-border rounded-lg shadow-xl w-48 p-2 animate-in fade-in zoom-in-95"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()} 
        >
           <button onClick={() => { onTaskClick(contextMenu.task); setContextMenu(null); }} className="w-full text-left px-3 py-2 text-sm hover:bg-bg-panel rounded text-text-main">
             ✏️ Редактировать
           </button>
           <button onClick={handleCopy} className="w-full text-left px-3 py-2 text-sm hover:bg-bg-panel rounded text-text-main">
             📋 Копировать текст
           </button>
           <div className="h-px bg-border my-1"></div>
           <button onClick={() => { onDelete(contextMenu.task.id); setContextMenu(null); }} className="w-full text-left px-3 py-2 text-sm text-error hover:bg-error/10 rounded">
             🗑 Удалить
           </button>
        </div>
      )}

      {COLUMNS.map(column => {
        const columnTasks = tasks.filter(t => t.status === column.id);
        const isOver = dragOverCol === column.id;

        return (
          <div 
            key={column.id}
            data-column-id={column.id}
            className={`
              flex-shrink-0 w-full lg:w-80 flex flex-col rounded-card max-h-full snap-center transition-colors duration-200 border border-transparent
              ${isOver ? 'bg-primary/10 border-primary/20' : column.bg}
            `}
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={() => setDragOverCol(null)}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Header */}
            <div className="p-4 flex justify-between items-center">
              <span className="font-semibold text-text-main flex items-center gap-2">
                {column.label}
                <span className="text-xs font-medium text-text-muted bg-bg-surface px-2 py-0.5 rounded-full border border-border">
                  {columnTasks.length}
                </span>
              </span>
              <button 
                onClick={() => onAddClick(column.id)}
                className="w-7 h-7 rounded-full hover:bg-bg-surface flex items-center justify-center text-text-muted transition"
              >
                +
              </button>
            </div>

            {/* Body */}
            <div className="px-3 pb-3 flex-1 overflow-y-auto space-y-3 min-h-[150px]">
              {columnTasks.map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                  onClick={() => onTaskClick(task)}
                  onContextMenu={(e) => handleContextMenu(e, task)}
                  className="bg-bg-surface p-4 rounded-card shadow-card border border-border cursor-grab active:cursor-grabbing hover:shadow-card-hover transition-all group relative select-none"
                >
                  <div className="mb-2 font-medium text-sm text-text-main leading-snug">
                    {task.title}
                  </div>
                  
                  {task.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {task.tags.map(tag => (
                        <span key={tag} className="text-[10px] font-bold text-text-muted px-1.5 py-0.5 rounded-[4px] bg-bg-panel border border-border">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-text-muted">
                    {task.deadline && (
                       <span className={Date.now() > task.deadline ? 'text-error font-medium' : ''}>
                         {new Date(task.deadline).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' })}
                       </span>
                    )}
                  </div>
                </div>
              ))}
              
              <button 
                onClick={() => onAddClick(column.id)}
                className="w-full py-2.5 border border-dashed border-border rounded-card text-sm text-text-muted hover:border-primary hover:text-primary transition-colors bg-transparent"
              >
                + Добавить
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
