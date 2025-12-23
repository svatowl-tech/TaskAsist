
import React, { useState, useEffect, useRef } from 'react';
import { Task, TaskStatus, RecurrenceConfig, BoardColumn, Board } from '../types';
import { AiService } from '../services/aiService';
import { ExportService } from '../services/exportService';
import { SmartTextarea } from './SmartTextarea';
import { appStore } from '../lib/store'; 
import { GoogleCalendarService } from '../services/googleCalendarService';
import { AuthService } from '../services/authService';

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
  recurrenceFreq: 'none' | 'daily' | 'weekly' | 'monthly';
  recurrenceDays: number[]; // 0-6 (0=Sun, 1=Mon... as per Date.getDay())
  startTime: string; // HH:mm
  startDate: string; // YYYY-MM-DD
  estimatedDuration: number;
  dependencies: string[];
  syncToGCal: boolean;
  boardId: string;
}

const WEEK_DAYS = [
    { label: 'Пн', val: 1 },
    { label: 'Вт', val: 2 },
    { label: 'Ср', val: 3 },
    { label: 'Чт', val: 4 },
    { label: 'Пт', val: 5 },
    { label: 'Сб', val: 6 },
    { label: 'Вс', val: 0 },
];

export const TaskModal: React.FC<TaskModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialStatus = 'backlog',
  taskToEdit,
  initialDate,
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
    recurrenceFreq: 'none',
    recurrenceDays: [],
    startTime: '',
    startDate: '',
    estimatedDuration: 0,
    dependencies: [],
    syncToGCal: false,
    boardId: ''
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [availableTasks, setAvailableTasks] = useState<Task[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Computed columns based on selected board
  const activeBoard = boards.find(b => b.id === formData.boardId);
  const columns = activeBoard?.columns || [];

  useEffect(() => {
    if (isOpen) {
      const state = appStore.getState();
      setAvailableTasks(state.tasks.filter(t => !taskToEdit || t.id !== taskToEdit.id));
      setBoards(state.boards);

      if (!taskToEdit) {
         const dateObj = initialDate ? new Date(initialDate) : new Date();
         const defaultBoardId = state.activeBoardId || state.boards[0]?.id || '';
         setFormData(prev => ({
           ...prev, 
           status: initialStatus, 
           title: initialData?.title || '', 
           description: initialData?.description || '', 
           tags: '', 
           dependencies: [],
           startDate: dateObj.toISOString().split('T')[0],
           startTime: dateObj.getHours().toString().padStart(2,'0') + ':' + dateObj.getMinutes().toString().padStart(2,'0'),
           recurrenceFreq: 'none',
           recurrenceDays: [],
           syncToGCal: false,
           boardId: defaultBoardId
         }));
      } else {
         // Parse existing recurrence
         let rFreq: any = 'none';
         let rDays: number[] = [];
         if (taskToEdit.recurrence) {
            if (typeof taskToEdit.recurrence === 'string') {
                rFreq = taskToEdit.recurrence;
            } else {
                rFreq = taskToEdit.recurrence.frequency;
                rDays = taskToEdit.recurrence.daysOfWeek || [];
            }
         }

         const start = taskToEdit.startTime ? new Date(taskToEdit.startTime) : (taskToEdit.deadline ? new Date(taskToEdit.deadline) : new Date());

         setFormData({
             title: taskToEdit.title,
             description: taskToEdit.description || '',
             status: taskToEdit.status,
             tags: taskToEdit.tags.join(', '),
             assignee: taskToEdit.assignee || '',
             color: taskToEdit.color || '#3182CE',
             recurrenceFreq: rFreq,
             recurrenceDays: rDays,
             startDate: start.toISOString().split('T')[0],
             startTime: taskToEdit.startTime ? new Date(taskToEdit.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '',
             eventType: taskToEdit.eventType || 'task',
             estimatedDuration: taskToEdit.estimatedDuration || 0,
             dependencies: taskToEdit.dependencies || [],
             syncToGCal: !!taskToEdit.gCalEventId,
             boardId: taskToEdit.boardId || state.activeBoardId || state.boards[0]?.id || ''
         });
      }
      setAiError(null);
    }
  }, [isOpen, taskToEdit, initialData, initialDate]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tagsArray = formData.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t !== '');
    
    // Construct recurrence config
    let recurrence: RecurrenceConfig | undefined;
    if (formData.recurrenceFreq !== 'none') {
        recurrence = {
            frequency: formData.recurrenceFreq,
            interval: 1,
            daysOfWeek: formData.recurrenceFreq === 'weekly' ? formData.recurrenceDays : undefined
        };
    }

    // Construct Start Time
    let startTimestamp: number | undefined;
    if (formData.startDate) {
        if (formData.startTime) {
            startTimestamp = new Date(`${formData.startDate}T${formData.startTime}`).getTime();
        } else {
            startTimestamp = new Date(formData.startDate).getTime();
        }
    }

    // Ensure status is valid for the selected board. 
    // If user switched board but kept status ID that doesn't exist in new board, default to first col.
    let validStatus = formData.status;
    const targetBoard = boards.find(b => b.id === formData.boardId);
    if (targetBoard && !targetBoard.columns.some(c => c.id === validStatus)) {
        validStatus = targetBoard.columns[0]?.id || 'backlog';
    }

    const taskPayload: Partial<Task> = {
        ...taskToEdit,
        title: formData.title,
        description: formData.description,
        status: validStatus,
        tags: tagsArray,
        color: formData.color,
        eventType: formData.eventType as any,
        recurrence: recurrence,
        estimatedDuration: Number(formData.estimatedDuration),
        dependencies: formData.dependencies,
        startTime: startTimestamp,
        boardId: formData.boardId
    };

    // Handle GCal Sync
    if (formData.syncToGCal && !taskToEdit?.gCalEventId) {
        const token = AuthService.getToken();
        const provider = AuthService.getProvider();
        if (token && provider === 'google') {
           const eventId = await GoogleCalendarService.createTask(token, taskPayload as Task);
           if (eventId) {
              taskPayload.gCalEventId = eventId;
           }
        } else {
            alert("Для синхронизации нужно войти через Google");
        }
    }

    await onSave(taskPayload);
    onClose();
  };

  const toggleDay = (day: number) => {
    setFormData(prev => {
        const current = prev.recurrenceDays;
        if (current.includes(day)) return { ...prev, recurrenceDays: current.filter(d => d !== day) };
        return { ...prev, recurrenceDays: [...current, day] };
    });
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
      setAiError('Ошибка ИИ');
    } finally {
      setAiLoading(false);
    }
  };

  const handleShareImage = () => {
    if (contentRef.current) {
        ExportService.shareAsImage(contentRef.current, `task-${formData.title.slice(0, 10)}.png`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      
      <div ref={contentRef} className="relative bg-bg-surface rounded-modal shadow-modal w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-border animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-border flex justify-between items-center bg-bg-main">
          <h2 className="text-lg font-semibold text-text-main">
            {taskToEdit ? 'Редактировать' : 'Новая задача'}
          </h2>
          <div className="flex gap-2">
             {taskToEdit && (
                 <button onClick={handleShareImage} className="text-text-muted hover:text-primary" title="Поделиться картинкой">
                    📸
                 </button>
             )}
             <button onClick={onClose} className="text-text-muted hover:text-text-main text-2xl leading-none">&times;</button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Title */}
          <div className="space-y-1.5">
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

          {/* Board & Status Selector */}
          <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                   <label className="text-xs font-medium text-text-muted">Доска</label>
                   <select 
                      value={formData.boardId}
                      onChange={e => setFormData({...formData, boardId: e.target.value})}
                      className="input-field font-bold text-primary"
                   >
                      {boards.map(b => (
                          <option key={b.id} value={b.id}>{b.title}</option>
                      ))}
                   </select>
               </div>
               <div className="space-y-1">
                   <label className="text-xs font-medium text-text-muted">Статус</label>
                   <select 
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value})}
                      className="input-field"
                   >
                      {columns.length > 0 ? columns.map(col => (
                          <option key={col.id} value={col.id}>{col.title}</option>
                      )) : <option value="backlog">Загрузка...</option>}
                   </select>
               </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                  <label className="text-xs font-medium text-text-muted">Дата</label>
                  <input 
                    type="date" 
                    value={formData.startDate}
                    onChange={e => setFormData({...formData, startDate: e.target.value})}
                    className="input-field"
                  />
              </div>
              <div className="space-y-1">
                  <label className="text-xs font-medium text-text-muted">Время</label>
                  <input 
                    type="time" 
                    value={formData.startTime}
                    onChange={e => setFormData({...formData, startTime: e.target.value})}
                    className="input-field"
                  />
              </div>
          </div>

          {/* Recurrence & Duration */}
          <div className="space-y-3 bg-bg-panel p-3 rounded-lg border border-border">
             <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <label className="text-xs font-medium text-text-muted">Повтор</label>
                   <select
                     value={formData.recurrenceFreq}
                     onChange={e => setFormData({...formData, recurrenceFreq: e.target.value as any})}
                     className="input-field text-sm"
                   >
                     <option value="none">Не повторять</option>
                     <option value="daily">Ежедневно</option>
                     <option value="weekly">Еженедельно</option>
                     <option value="monthly">Ежемесячно</option>
                   </select>
                 </div>
                 <div className="space-y-1">
                    <label className="text-xs font-medium text-text-muted">Оценка (мин)</label>
                    <input
                      type="number"
                      value={formData.estimatedDuration}
                      onChange={e => setFormData({...formData, estimatedDuration: Number(e.target.value)})}
                      className="input-field text-sm"
                      placeholder="60"
                    />
                 </div>
             </div>

             {formData.recurrenceFreq === 'weekly' && (
                 <div className="space-y-1 pt-1">
                    <label className="text-xs font-medium text-text-muted block mb-1">Дни недели</label>
                    <div className="flex justify-between gap-1">
                        {WEEK_DAYS.map(({ label, val }) => (
                            <button
                                key={val}
                                type="button"
                                onClick={() => toggleDay(val)}
                                className={`
                                    w-8 h-8 rounded-full text-xs font-medium transition
                                    ${formData.recurrenceDays.includes(val) ? 'bg-primary text-white' : 'bg-bg-surface border border-border hover:bg-bg-main'}
                                `}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                 </div>
             )}
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1">
                <label className="text-xs font-medium text-text-muted">Цвет метки</label>
                <div className="flex gap-2 pt-2">
                    {['#3182CE', '#48BB78', '#F56565', '#ED8936', '#9F7AEA'].map(c => (
                        <div 
                            key={c}
                            onClick={() => setFormData({...formData, color: c})}
                            className={`w-6 h-6 rounded-full cursor-pointer border-2 transition-transform ${formData.color === c ? 'border-text-main scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                        ></div>
                    ))}
                </div>
             </div>
             
             <div className="flex items-center pt-6">
                <input 
                type="checkbox" 
                id="gcal-sync"
                checked={formData.syncToGCal}
                onChange={e => setFormData({...formData, syncToGCal: e.target.checked})}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary mr-2"
                />
                <label htmlFor="gcal-sync" className="text-xs text-text-main cursor-pointer leading-tight">
                    Синхронизация<br/>с Google Calendar
                </label>
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
             <label className="block text-sm font-medium text-text-muted">Блокирующие задачи</label>
             <select 
               multiple
               value={formData.dependencies}
               onChange={e => setFormData({...formData, dependencies: Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => option.value)})}
               className="input-field h-20 py-2 text-sm"
             >
                {availableTasks.map(t => (
                  <option key={t.id} value={t.id}>{t.title} ({t.status})</option>
                ))}
             </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-text-muted">Описание</label>
              <div className="flex items-center gap-2">
                {aiError && <span className="text-xs text-error">{aiError}</span>}
                {openRouterApiKey && (
                  <button
                    type="button"
                    onClick={handleAiImprove}
                    disabled={aiLoading}
                    className="text-xs font-semibold px-2 py-0.5 rounded text-purple-500 hover:bg-purple-50"
                  >
                    {aiLoading ? '...' : '✨ ИИ'}
                  </button>
                )}
              </div>
            </div>
            
            <SmartTextarea 
              value={formData.description}
              onChange={(val) => setFormData({...formData, description: val})}
              className="w-full"
              minRows={4}
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-border mt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Отмена</button>
            <button type="submit" className="btn-primary">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
};
