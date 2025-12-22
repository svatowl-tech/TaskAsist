
import React from 'react';
import { AppState, Task } from '../types';

interface WidgetViewProps {
  appState: AppState;
  onToggleTask: (id: string, completed: boolean) => void;
}

export const WidgetView: React.FC<WidgetViewProps> = ({ appState, onToggleTask }) => {
  const tasks = appState.tasks
    .filter(t => !t.completed)
    .sort((a, b) => {
      // Sort by urgency
      const da = a.deadline || Number.MAX_SAFE_INTEGER;
      const db = b.deadline || Number.MAX_SAFE_INTEGER;
      return da - db;
    })
    .slice(0, 5);

  return (
    <div className="h-screen w-full bg-white dark:bg-gray-900 p-4 flex flex-col">
      <div className="flex justify-between items-center mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">TaskAssist</h1>
        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{tasks.length} active</span>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-2">
        {tasks.length === 0 && <p className="text-sm text-gray-400 text-center mt-10">Все чисто! 🎉</p>}
        {tasks.map(task => (
          <div key={task.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition">
            <input 
              type="checkbox" 
              checked={task.completed}
              onChange={() => onToggleTask(task.id, !task.completed)}
              className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="min-w-0 flex-1">
               <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{task.title}</p>
               {task.deadline && (
                 <p className="text-xs text-red-500">
                   {new Date(task.deadline).toLocaleDateString()}
                 </p>
               )}
            </div>
          </div>
        ))}
      </div>
      
      <a 
        href="/" 
        target="_blank"
        className="mt-4 text-center text-xs text-blue-500 hover:underline block"
      >
        Открыть полное приложение
      </a>
    </div>
  );
};
