
import React, { useState, useEffect } from 'react';
import { Task, TaskStatus } from '../types';
import { AiService } from '../services/aiService';
import { SmartTextarea } from './SmartTextarea';
import { appStore } from '../lib/store'; // To get other tasks for dependencies

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => Promise<void>;
  initialStatus?: TaskStatus;
  taskToEdit?: Task | null;
  initialDate?: number;
  initialData?: { title: string; description: string } | null;
  openRouterApiKey?: string;
  aiModel?: string;
}

interface TaskFormData {
  title: string;
  description: string;
  status: TaskStatus;
  tags: string;
  assignee: string;
  eventType: string;
  color: string;
  recurrence: string;
  estimatedDuration: number;
  dependencies: string[];
}

export const TaskModal: React.FC<TaskModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialStatus = 'backlog',
  taskToEdit,
  initialData,
  openRouterApiKey,
  aiModel
}) => {
  const [formData, setFormData] = useState<TaskFormData>({
    title: '',
    description: '',
    status: initialStatus,
    tags: '',
    assignee: '',
    eventType: 'task',
    color: '#3182CE',
    recurrence: 'none',
    estimatedDuration: 0,
    dependencies: []
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (isOpen) {
      setAvailableTasks(appStore.getState().tasks.filter(t => !taskToEdit || t.id !== taskToEdit.id));

      if (!taskToEdit) {
         setFormData(prev => ({
           ...prev, 
           status: initialStatus, 
           title: initialData?.title || '', 
           description: initialData?.description || '', 
           tags: '', 
           dependencies: []
         }));
      } else {
         setFormData({
             title: taskToEdit.title,
             description: taskToEdit.description || '',
             status: taskToEdit.status,
             tags: taskToEdit.tags.join(', '),
             assignee: taskToEdit.assignee || '',
             color: taskToEdit.color || '#3182CE',
             recurrence: taskToEdit.recurrence || 'none',
             eventType: taskToEdit.eventType || 'task',
             estimatedDuration: taskToEdit.estimatedDuration || 0,
             dependencies: taskToEdit.dependencies || []
         });
      }
      setAiError(null);
    }
  }, [isOpen, taskToEdit, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tagsArray = formData.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t !== '');
    onSave({
        ...taskToEdit,
        title: formData.title,
        description: formData.description,
        status: formData.status,
        tags: tagsArray,
        color: formData.color,
        eventType: formData.eventType as any,
        recurrence: formData.recurrence as any,
        estimatedDuration: Number(formData.estimatedDuration),
        dependencies: formData.dependencies
    });
    onClose();
  };

  const handleAiImprove = async () => {
    setAiError(null);
    if (!openRouterApiKey) {
      setAiError('Нет API ключа в настройках');
      return;
    }
    if (!formData.description && !formData.title) return;

    setAiLoading(true);
    try {
      const text = `Задача: ${formData.title}\nОписание: ${formData.description}`;
      const improved = await AiService.enhanceText(openRouterApiKey, text, 'professional', aiModel);
      setFormData(prev => ({ ...prev, description: improved }));
    } catch (e: any) {
      let msg = 'Ошибка ИИ';
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
      setAiError(msg);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative bg-bg-surface rounded-modal shadow-modal w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-border animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-border flex justify-between items-center bg-bg-main">
          <h2 className="text-lg font-semibold text-text-main">
            {taskToEdit ? 'Редактировать' : 'Новая задача'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-main text-2xl leading-none">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-main">Название</label>
            <input
              required
              type="text"
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
              className="input-field font-medium text-lg"
              placeholder="Название задачи"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-5">
             <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-muted">Статус</label>
              <select
                value={formData.status}
                onChange={e => setFormData({...formData, status: e.target.value as TaskStatus})}
                className="input-field"
              >
                <option value="backlog">Бэклог</option>
                <option value="in-progress">В работе</option>
                <option value="review">Проверка</option>
                <option value="done">Готово</option>
              </select>
            </div>
            <div className="space-y-1.5">
               <label className="block text-sm font-medium text-text-muted">Оценка (мин)</label>
               <input
                 type="number"
                 value={formData.estimatedDuration}
                 onChange={e => setFormData({...formData, estimatedDuration: Number(e.target.value)})}
                 className="input-field"
                 placeholder="Напр. 60"
               />
            </div>
          </div>

          <div className="space-y-1.5">
             <label className="block text-sm font-medium text-text-muted">Теги</label>
             <input
               type="text"
               value={formData.tags}
               onChange={e => setFormData({...formData, tags: e.target.value})}
               className="input-field"
               placeholder="работа, срочно..."
             />
          </div>
          
          <div className="space-y-1.5">
             <label className="block text-sm font-medium text-text-muted">Блокирующие задачи (Зависимости)</label>
             <select 
               multiple
               value={formData.dependencies}
               onChange={e => setFormData({...formData, dependencies: Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value)})}
               className="input-field h-24 py-2"
             >
                {availableTasks.map(t => (
                  <option key={t.id} value={t.id}>{t.title} ({t.status})</option>
                ))}
             </select>
             <p className="text-[10px] text-text-disabled">Удерживайте Ctrl/Cmd для выбора нескольких</p>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-text-muted">Описание (Smart Input)</label>
              <div className="flex items-center gap-2">
                {aiError && <span className="text-xs text-error">{aiError}</span>}
                {openRouterApiKey && (
                  <button
                    type="button"
                    onClick={handleAiImprove}
                    disabled={aiLoading}
                    className={`text-xs font-semibold px-2 py-0.5 rounded transition ${aiLoading ? 'text-text-disabled' : 'text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20'}`}
                  >
                    {aiLoading ? '...' : '✨ ИИ Улучшить'}
                  </button>
                )}
              </div>
            </div>
            
            <SmartTextarea 
              value={formData.description}
              onChange={(val) => setFormData({...formData, description: val})}
              placeholder="Используйте # для тегов, @ для людей, : для эмодзи"
              className="w-full"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-border mt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn-primary"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
