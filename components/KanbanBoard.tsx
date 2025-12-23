
import React, { useState, useEffect } from 'react';
import { Task, TaskStatus, BoardColumn, Board } from '../types';
import { appStore, DEFAULT_COLUMNS } from '../lib/store';
import { StorageService } from '../services/storageService';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onMoveTask: (taskId: string, newStatus: TaskStatus) => void;
  onAddClick: (status: TaskStatus) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ 
  tasks, 
  onTaskClick, 
  onMoveTask,
  onAddClick
}) => {
  const [boards, setBoards] = useState<Board[]>(appStore.getState().boards);
  const [activeBoardId, setActiveBoardId] = useState<string | null>(appStore.getState().activeBoardId);
  
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [tempColTitle, setTempColTitle] = useState('');
  
  // Board editing
  const [isBoardMenuOpen, setIsBoardMenuOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);

  // Inline Task Creation State
  const [addingTaskColId, setAddingTaskColId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  useEffect(() => {
     const unsub = appStore.subscribe((state) => {
         setBoards(state.boards);
         setActiveBoardId(state.activeBoardId);
     });
     return unsub;
  }, []);

  const activeBoard = boards.find(b => b.id === activeBoardId) || boards[0];
  const columns = activeBoard?.columns || [];
  
  // Filter tasks by active board
  const boardTasks = tasks.filter(t => t.boardId === activeBoard?.id);

  // --- Board Management ---

  const handleCreateBoard = async () => {
      if (!newBoardName.trim()) return;
      
      const newBoard: Board = {
          id: crypto.randomUUID(),
          title: newBoardName,
          columns: DEFAULT_COLUMNS
      };
      
      const updatedBoards = [...boards, newBoard];
      setBoards(updatedBoards);
      appStore.setState({ boards: updatedBoards, activeBoardId: newBoard.id }); // Optimistic update
      
      await StorageService.saveBoard(newBoard);
      setNewBoardName('');
      setIsCreatingBoard(false);
      setIsBoardMenuOpen(false);
  };

  const handleDeleteBoard = async () => {
      if (!activeBoard) return;
      if (confirm(`Удалить доску "${activeBoard.title}" и все её задачи?`)) {
          const remainingBoards = boards.filter(b => b.id !== activeBoard.id);
          
          // Delete tasks associated with this board
          const tasksToDelete = tasks.filter(t => t.boardId === activeBoard.id);
          tasksToDelete.forEach(t => {
              StorageService.deleteTask(t.id);
              appStore.deleteTask(t.id);
          });

          setBoards(remainingBoards);
          const nextBoardId = remainingBoards.length > 0 ? remainingBoards[0].id : null;
          appStore.setState({ boards: remainingBoards, activeBoardId: nextBoardId });
          
          await StorageService.deleteBoard(activeBoard.id);
          
          if (remainingBoards.length === 0) {
              // Re-create default if all deleted
              const def: Board = { id: 'default-board', title: 'Главная', columns: DEFAULT_COLUMNS };
              await StorageService.saveBoard(def);
              appStore.setState({ boards: [def], activeBoardId: def.id });
          }
      }
  };

  // --- Column Management (Scoped to Active Board) ---

  const saveColumnTitle = async () => {
     if (editingColId && activeBoard) {
        const updatedCols = columns.map(c => c.id === editingColId ? { ...c, title: tempColTitle } : c);
        const updatedBoard = { ...activeBoard, columns: updatedCols };
        
        // Update local state & store
        appStore.updateBoard(updatedBoard);
        await StorageService.saveBoard(updatedBoard);
        setEditingColId(null);
     }
  };

  const createNewColumn = async () => {
     const title = prompt("Название новой колонки:");
     if (title && activeBoard) {
         const newCol: BoardColumn = {
             id: crypto.randomUUID(),
             title,
             order: columns.length
         };
         const updatedBoard = { ...activeBoard, columns: [...columns, newCol] };
         
         appStore.updateBoard(updatedBoard);
         await StorageService.saveBoard(updatedBoard);
     }
  };

  const deleteColumn = async (id: string) => {
      if (activeBoard && confirm("Удалить колонку?")) {
          const updatedBoard = { ...activeBoard, columns: columns.filter(c => c.id !== id) };
          appStore.updateBoard(updatedBoard);
          await StorageService.saveBoard(updatedBoard);
      }
  };

  // --- Drag and Drop ---

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverCol(colId);
  };

  const handleDrop = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverCol(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) onMoveTask(taskId, colId);
  };

  // --- Inline Task ---

  const submitNewTask = async () => {
      if (addingTaskColId && newTaskTitle.trim() && activeBoard) {
          const newTask: Task = {
            id: crypto.randomUUID(),
            title: newTaskTitle,
            status: addingTaskColId,
            completed: addingTaskColId === 'done',
            tags: [],
            description: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            order: Date.now(),
            color: '#3b82f6',
            boardId: activeBoard.id
          };
          await StorageService.addTask(newTask);
          appStore.addTask(newTask);
          setNewTaskTitle('');
      }
  };

  if (!activeBoard) return <div className="p-4 text-center">Загрузка досок...</div>;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Board Toolbar */}
      <div className="flex-none px-4 py-3 bg-bg-surface border-b border-border flex items-center justify-between">
         <div className="relative">
            <button 
                onClick={() => setIsBoardMenuOpen(!isBoardMenuOpen)}
                className="flex items-center gap-2 font-bold text-lg hover:bg-bg-panel px-3 py-1.5 rounded-lg transition-colors"
            >
                {activeBoard.title}
                <span className="text-xs text-text-muted">▼</span>
            </button>

            {isBoardMenuOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsBoardMenuOpen(false)}></div>
                    <div className="absolute top-full left-0 mt-2 w-64 bg-bg-surface rounded-xl shadow-modal border border-border z-50 p-2 animate-in fade-in zoom-in-95">
                        <div className="text-xs font-bold text-text-muted px-2 py-1 uppercase">Мои доски</div>
                        {boards.map(b => (
                            <button
                                key={b.id}
                                onClick={() => { appStore.setActiveBoard(b.id); setIsBoardMenuOpen(false); }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 ${b.id === activeBoard.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-bg-panel'}`}
                            >
                                {b.title}
                            </button>
                        ))}
                        <div className="h-px bg-border my-2"></div>
                        {isCreatingBoard ? (
                            <div className="px-2">
                                <input 
                                    autoFocus
                                    className="input-field text-sm mb-2" 
                                    placeholder="Имя доски..." 
                                    value={newBoardName}
                                    onChange={e => setNewBoardName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleCreateBoard()}
                                />
                                <div className="flex gap-2">
                                    <button onClick={handleCreateBoard} className="btn-primary text-xs py-1 px-2 h-8">Создать</button>
                                    <button onClick={() => setIsCreatingBoard(false)} className="btn-secondary text-xs py-1 px-2 h-8">Отмена</button>
                                </div>
                            </div>
                        ) : (
                            <button 
                                onClick={() => setIsCreatingBoard(true)}
                                className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-bg-panel text-primary flex items-center gap-2"
                            >
                                <span className="text-lg leading-none">+</span> Новая доска
                            </button>
                        )}
                    </div>
                </>
            )}
         </div>

         <div className="flex gap-2">
             <button 
                onClick={handleDeleteBoard}
                className="text-text-muted hover:text-error p-2 rounded hover:bg-error/10 transition-colors"
                title="Удалить доску"
             >
                🗑
             </button>
         </div>
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden flex gap-4 p-4 snap-x snap-mandatory">
        {columns.sort((a,b) => a.order - b.order).map(column => {
            const columnTasks = boardTasks.filter(t => t.status === column.id);
            const isOver = dragOverCol === column.id;
            const isEditing = editingColId === column.id;

            return (
            <div 
                key={column.id}
                className={`
                flex-shrink-0 w-80 flex flex-col rounded-xl max-h-full snap-center transition-colors duration-200 bg-bg-panel border border-border/50
                ${isOver ? 'ring-2 ring-primary bg-primary/5' : ''}
                `}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={(e) => handleDrop(e, column.id)}
            >
                {/* Column Header */}
                <div className="p-3 pl-4 flex justify-between items-center group cursor-grab active:cursor-grabbing">
                {isEditing ? (
                    <input 
                    autoFocus
                    type="text"
                    className="bg-bg-surface border border-primary rounded px-1 py-0.5 text-sm font-bold w-full mr-2"
                    value={tempColTitle}
                    onChange={e => setTempColTitle(e.target.value)}
                    onBlur={saveColumnTitle}
                    onKeyDown={e => e.key === 'Enter' && saveColumnTitle()}
                    />
                ) : (
                    <div 
                        className="font-bold text-text-main text-sm flex-1 truncate"
                        onClick={() => { setEditingColId(column.id); setTempColTitle(column.title); }}
                    >
                        {column.title}
                    </div>
                )}
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-xs font-mono text-text-muted bg-bg-surface px-1.5 rounded-full">
                        {columnTasks.length}
                    </span>
                    <button 
                        onClick={() => deleteColumn(column.id)}
                        className="p-1 text-text-muted hover:text-error rounded hover:bg-bg-surface"
                        title="Delete Column"
                    >
                        ×
                    </button>
                </div>
                </div>

                {/* Tasks List */}
                <div className="px-2 pb-2 flex-1 overflow-y-auto space-y-2 min-h-[50px] custom-scrollbar">
                {columnTasks.map(task => (
                    <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, task)}
                    onClick={() => onTaskClick(task)}
                    className="bg-bg-surface p-3 rounded-lg shadow-sm border border-border hover:border-primary/50 cursor-pointer active:cursor-grabbing hover:shadow-md transition-all group relative"
                    >
                    {/* Labels */}
                    {task.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                        {task.tags.map(tag => (
                            <div key={tag} className="h-2 w-8 rounded-full bg-primary/20" title={tag}></div>
                        ))}
                        </div>
                    )}

                    <div className="text-sm font-medium text-text-main leading-snug mb-1">
                        {task.title}
                    </div>

                    <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                            {task.timeLogs && task.timeLogs.length > 0 && <span>⏱</span>}
                            {task.description && <span>≡</span>}
                            {task.recurrence && <span>↻</span>}
                        </div>
                        {task.deadline && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${Date.now() > task.deadline ? 'bg-red-100 text-red-700' : 'bg-bg-panel text-text-muted'}`}>
                            {new Date(task.deadline).toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                            </span>
                        )}
                    </div>
                    </div>
                ))}
                
                {/* Inline Add Task */}
                {addingTaskColId === column.id ? (
                    <div className="bg-bg-surface p-2 rounded-lg border border-primary shadow-sm">
                        <textarea
                            autoFocus
                            placeholder="Заголовок задачи..."
                            className="w-full bg-transparent resize-none outline-none text-sm mb-2"
                            rows={2}
                            value={newTaskTitle}
                            onChange={e => setNewTaskTitle(e.target.value)}
                            onKeyDown={e => {
                                if(e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    submitNewTask();
                                }
                                if(e.key === 'Escape') setAddingTaskColId(null);
                            }}
                        />
                        <div className="flex gap-2">
                            <button onClick={submitNewTask} className="bg-primary text-white text-xs px-3 py-1.5 rounded font-medium">Добавить</button>
                            <button onClick={() => setAddingTaskColId(null)} className="text-text-muted text-xl leading-none">×</button>
                        </div>
                    </div>
                ) : (
                    <button 
                        onClick={() => { setAddingTaskColId(column.id); setNewTaskTitle(''); }}
                        className="w-full py-2 flex items-center gap-2 text-sm text-text-muted hover:bg-bg-surface hover:text-text-main rounded-lg px-2 transition-colors"
                    >
                        <span className="text-lg leading-none">+</span> Добавить карточку
                    </button>
                )}
                </div>
            </div>
            );
        })}
        
        {/* Add Column Button */}
        <div className="flex-shrink-0 w-80">
            <button 
                onClick={createNewColumn}
                className="w-full h-12 bg-bg-panel/50 hover:bg-bg-panel border-2 border-dashed border-border rounded-xl flex items-center justify-center gap-2 text-text-muted hover:text-text-main transition-colors font-medium"
            >
                + Добавить колонку
            </button>
        </div>
      </div>
    </div>
  );
};
