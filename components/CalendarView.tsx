
import React, { useState, useMemo, useEffect } from 'react';
import { Task, Note, WorkSchedule, GlobalEvent } from '../types';
import { AuthService } from '../services/authService';
import { GoogleCalendarService } from '../services/googleCalendarService';
import { appStore } from '../lib/store';

interface CalendarViewProps {
  tasks: Task[];
  notes: Note[];
  onTaskClick: (task: Task) => void;
  onDateClick: (date: number) => void;
  onTaskDrop: (taskId: string, date: number) => void;
}

type CalendarMode = 'month' | 'day';

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const CalendarView: React.FC<CalendarViewProps> = ({ tasks, notes, onTaskClick, onDateClick, onTaskDrop }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mode, setMode] = useState<CalendarMode>('month');
  const [externalEvents, setExternalEvents] = useState<any[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  
  // Get Global Settings
  const { settings, globalEvents } = appStore.getState();
  const workSchedule = settings.workSchedule || { type: 'standard', workDays: [1,2,3,4,5] };

  // Fetch Google Calendar Events
  useEffect(() => {
    const fetchEvents = async () => {
       const token = AuthService.getToken();
       const provider = AuthService.getProvider();
       
       if (token && provider === 'google') {
          setIsLoadingEvents(true);
          const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
          const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString();
          
          const events = await GoogleCalendarService.listEvents(token, start, end);
          setExternalEvents(events);
          setIsLoadingEvents(false);
       }
    };
    fetchEvents();
  }, [currentDate.getMonth(), currentDate.getFullYear()]);

  // Combine Tasks, Events, Global Events, and Notes
  const allItems = useMemo(() => {
      const taskItems = tasks.map(t => ({
          id: t.id,
          title: t.title,
          start: t.startTime ? new Date(t.startTime) : (t.deadline ? new Date(t.deadline) : null),
          end: t.endTime ? new Date(t.endTime) : (t.startTime ? new Date(t.startTime + 3600000) : null),
          color: t.color || 'var(--color-primary)',
          completed: t.completed,
          type: 'task',
          original: t
      }));

      const noteItems = notes.map(n => ({
          id: n.id,
          title: n.title,
          start: new Date(n.updatedAt || n.createdAt),
          end: new Date(n.updatedAt || n.createdAt),
          color: '#FBBF24', // Amber for notes
          completed: false,
          type: 'note',
          original: null
      }));

      const googleItems = externalEvents.map(e => ({
          id: e.id,
          title: e.summary || '(Без названия)',
          start: e.start.dateTime ? new Date(e.start.dateTime) : new Date(e.start.date),
          end: e.end.dateTime ? new Date(e.end.dateTime) : new Date(e.end.date),
          color: '#E040FB', // Purple for Google
          completed: false,
          type: 'google',
          original: null
      }));
      
      const globalItems = globalEvents.map(e => {
          let eventDate = new Date(e.date);
          if (e.isRecurringYearly) {
              eventDate.setFullYear(currentDate.getFullYear());
          }
          return {
              id: e.id,
              title: e.title,
              start: eventDate,
              end: eventDate,
              color: e.type === 'holiday' ? '#F56565' : '#ED8936',
              completed: false,
              type: 'global',
              icon: e.type === 'birthday' ? '🎂 ' : e.type === 'vacation' ? '✈️ ' : '🎉 ',
              original: null
          };
      });

      return [...taskItems, ...noteItems, ...googleItems, ...globalItems].filter(i => i.start);
  }, [tasks, notes, externalEvents, globalEvents, currentDate]);

  // --- Helpers ---
  
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    
    // JS getDay(): 0 = Sun, 1 = Mon ... 6 = Sat
    let firstDayIndex = new Date(year, month, 1).getDay();
    // Shift to Mon=0, Sun=6
    const firstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    
    return { days, firstDay };
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getDate() === d2.getDate() && 
           d1.getMonth() === d2.getMonth() && 
           d1.getFullYear() === d2.getFullYear();
  };

  const isWorkDay = (date: Date): boolean => {
      if (workSchedule.type === 'standard') {
          return (workSchedule.workDays || []).includes(date.getDay());
      } 
      else if (workSchedule.type === 'shift' && workSchedule.shiftConfig) {
          const { startDate, workCount, offCount } = workSchedule.shiftConfig;
          if (!startDate) return true;
          
          const start = new Date(startDate);
          start.setHours(0,0,0,0);
          const current = new Date(date);
          current.setHours(0,0,0,0);
          
          const diffTime = current.getTime() - start.getTime();
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          const cycleLength = workCount + offCount;
          const dayInCycle = ((diffDays % cycleLength) + cycleLength) % cycleLength;
          
          return dayInCycle < workCount;
      }
      return true;
  };

  // --- Drag & Drop ---
  const handleDragStart = (e: React.DragEvent, taskId: string, type: string) => {
      if (type !== 'task') {
          e.preventDefault();
          return;
      }
      e.dataTransfer.setData('text/plain', taskId);
      e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
      e.preventDefault();
      setDragOverDate(dateStr);
  };

  const handleDrop = (e: React.DragEvent, date: Date) => {
      e.preventDefault();
      setDragOverDate(null);
      const taskId = e.dataTransfer.getData('text/plain');
      if (taskId) {
          onTaskDrop(taskId, date.getTime());
      }
  };

  // --- Navigation ---

  const next = () => {
    const newDate = new Date(currentDate);
    if (mode === 'month') newDate.setMonth(newDate.getMonth() + 1);
    else newDate.setDate(newDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const prev = () => {
    const newDate = new Date(currentDate);
    if (mode === 'month') newDate.setMonth(newDate.getMonth() - 1);
    else newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const goToToday = () => setCurrentDate(new Date());

  // --- Renderers ---

  const renderMonthView = () => {
    const { days, firstDay } = getDaysInMonth(currentDate);
    const blanks = Array.from({ length: firstDay }, (_, i) => i);
    const monthDays = Array.from({ length: days }, (_, i) => i + 1);

    return (
      <div className="bg-bg-surface rounded-card shadow-card border border-border overflow-hidden flex flex-col h-full">
        {/* Days Header */}
        <div className="grid grid-cols-7 bg-bg-panel border-b border-border flex-shrink-0">
          {DAYS.map(day => (
            <div key={day} className="py-2.5 text-center text-xs font-semibold text-text-muted uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 auto-rows-fr flex-1 overflow-y-auto">
          {blanks.map(i => (
            <div key={`blank-${i}`} className="bg-bg-panel/30 border-b border-r border-border" />
          ))}
          
          {monthDays.map(day => {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const dateStr = date.toISOString().split('T')[0];
            const dayItems = allItems.filter(i => i.start && isSameDay(i.start, date));
            const isToday = isSameDay(date, new Date());
            const isWorking = isWorkDay(date);
            const isOver = dragOverDate === dateStr;

            return (
              <div 
                key={day} 
                onClick={() => onDateClick(date.getTime())}
                onDragOver={(e) => handleDragOver(e, dateStr)}
                onDragLeave={() => setDragOverDate(null)}
                onDrop={(e) => handleDrop(e, date)}
                className={`
                  p-1 border-b border-r border-border transition-colors cursor-pointer flex flex-col gap-1 overflow-hidden relative min-h-[80px]
                  ${isOver ? 'bg-primary/20 ring-inset ring-2 ring-primary' : 'hover:bg-bg-panel'}
                  ${isToday ? 'bg-primary/5' : !isWorking ? 'bg-gray-100/50 dark:bg-gray-800/30' : ''}
                `}
              >
                <div className="flex justify-between items-start p-1">
                  <span className={`
                    text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full
                    ${isToday ? 'bg-primary text-white' : isWorking ? 'text-text-main' : 'text-error'}
                  `}>
                    {day}
                  </span>
                  {!isWorking && <span className="text-[10px] text-text-muted uppercase font-bold tracking-tighter opacity-50">Вых</span>}
                </div>
                
                <div className="flex-1 flex flex-col gap-1 overflow-y-auto max-h-[100px] no-scrollbar">
                  {dayItems.map(item => (
                    <div 
                      key={item.id}
                      draggable={item.type === 'task'}
                      onDragStart={(e) => handleDragStart(e, item.id, item.type)}
                      onClick={(e) => { 
                          if (item.type === 'task' && item.original) {
                              e.stopPropagation(); 
                              onTaskClick(item.original); 
                          }
                      }}
                      className={`
                        text-[10px] px-1.5 py-0.5 rounded-[4px] truncate border-l-2 cursor-grab active:cursor-grabbing
                        ${item.completed ? 'opacity-50 line-through' : ''}
                        ${item.type === 'global' ? 'font-bold' : ''}
                        ${item.type === 'note' ? 'italic opacity-90' : ''}
                      `}
                      style={{ 
                        backgroundColor: (item.color || 'var(--color-primary)') + '1A', 
                        borderColor: item.color || 'var(--color-primary)',
                        color: 'var(--color-text-main)'
                      }}
                      title={item.title}
                    >
                      {item.type === 'google' && '📅 '}
                      {item.type === 'note' && '📝 '}
                      {item.type === 'global' && (item as any).icon}
                      {item.type !== 'global' && item.start && <span className="opacity-75 mr-1">{item.start.getHours()}:{item.start.getMinutes().toString().padStart(2, '0')}</span>}
                      {item.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const dayItems = allItems.filter(i => i.start && isSameDay(i.start, currentDate));
    const isWorking = isWorkDay(currentDate);

    return (
      <div className="bg-bg-surface rounded-card shadow-card border border-border overflow-hidden flex flex-col h-full">
         <div className={`p-2 text-center text-sm border-b border-border ${!isWorking ? 'bg-red-50 dark:bg-red-900/20 text-red-600' : 'bg-green-50 dark:bg-green-900/20 text-green-600'}`}>
             {isWorking ? 'Рабочий день' : 'Выходной день'}
         </div>
         <div className="flex-1 overflow-y-auto relative h-[600px] no-scrollbar">
            {HOURS.map(hour => (
              <div key={hour} className="flex border-b border-border min-h-[60px] relative">
                <div className="w-16 flex-shrink-0 text-xs text-text-muted text-right pr-3 py-2 sticky left-0 bg-bg-surface border-r border-border z-10">
                  {hour.toString().padStart(2, '0')}:00
                </div>
                <div 
                  className="flex-1 relative" 
                  onDragOver={(e) => handleDragOver(e, `${currentDate.toISOString().split('T')[0]}-${hour}`)}
                  onDrop={(e) => {
                     e.preventDefault();
                     const taskId = e.dataTransfer.getData('text/plain');
                     const d = new Date(currentDate);
                     d.setHours(hour, 0, 0, 0);
                     if(taskId) onTaskDrop(taskId, d.getTime());
                  }}
                  onClick={() => {
                   const d = new Date(currentDate);
                   d.setHours(hour, 0, 0, 0);
                   onDateClick(d.getTime());
                }}>
                  {dayItems.map(item => {
                    // Global events
                    if (item.type === 'global' && hour === 0) {
                        return (
                            <div key={item.id} className="mb-1 bg-yellow-100 text-yellow-800 text-xs p-1 rounded border border-yellow-300">
                                {(item as any).icon} {item.title}
                            </div>
                        );
                    }
                    if (item.type === 'global') return null;
                    if (!item.start || item.start.getHours() !== hour) return null;

                    const startMin = item.start.getMinutes();
                    const duration = item.end ? (item.end.getTime() - item.start.getTime()) / (1000 * 60) : 60;
                    
                    return (
                      <div
                        key={item.id}
                        draggable={item.type === 'task'}
                        onDragStart={(e) => handleDragStart(e, item.id, item.type)}
                        onClick={(e) => { 
                            if (item.type === 'task' && item.original) {
                                e.stopPropagation(); 
                                onTaskClick(item.original); 
                            }
                        }}
                        className="absolute left-1 right-1 rounded-[4px] border-l-4 p-1.5 text-xs shadow-sm overflow-hidden z-10 hover:z-20 cursor-pointer transition-all hover:shadow-md active:cursor-grabbing"
                        style={{
                          top: `${(startMin / 60) * 100}%`,
                          height: `${Math.max((duration / 60) * 100, 30)}%`,
                          backgroundColor: (item.color || 'var(--color-primary)') + '1A',
                          borderColor: item.color || 'var(--color-primary)',
                        }}
                      >
                        <div className="font-semibold text-text-main flex items-center gap-1">
                            {item.type === 'google' && '📅'}
                            {item.type === 'note' && '📝'}
                            {item.title}
                        </div>
                        <div className="text-text-muted">
                          {item.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
         </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full gap-4 p-4 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Calendar Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-bg-surface p-3 rounded-card shadow-card border border-border">
        <div className="flex items-center gap-2">
          <button onClick={prev} className="p-2 hover:bg-bg-panel rounded-[6px] text-text-muted transition-colors">◀</button>
          <h2 className="text-lg font-bold w-48 text-center text-text-main flex flex-col items-center justify-center">
            {currentDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}
            {isLoadingEvents && <span className="text-[10px] text-primary animate-pulse">Синхронизация Google...</span>}
          </h2>
          <button onClick={next} className="p-2 hover:bg-bg-panel rounded-[6px] text-text-muted transition-colors">▶</button>
          <button onClick={goToToday} className="text-sm text-primary font-medium px-3 py-1.5 bg-primary/10 rounded-[6px] hover:bg-primary/20 transition-colors">
            Сегодня
          </button>
        </div>

        <div className="flex bg-bg-panel p-1 rounded-[6px] border border-border">
          <button 
            onClick={() => setMode('month')}
            className={`px-3 py-1 text-sm rounded-[4px] transition ${mode === 'month' ? 'bg-bg-surface shadow-sm text-text-main font-medium' : 'text-text-muted'}`}
          >
            Месяц
          </button>
          <button 
            onClick={() => setMode('day')}
            className={`px-3 py-1 text-sm rounded-[4px] transition ${mode === 'day' ? 'bg-bg-surface shadow-sm text-text-main font-medium' : 'text-text-muted'}`}
          >
            День
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {mode === 'month' ? renderMonthView() : renderDayView()}
      </div>
    </div>
  );
};
