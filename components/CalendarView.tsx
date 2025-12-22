
import React, { useState, useMemo } from 'react';
import { Task } from '../types';

interface CalendarViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onDateClick: (date: number) => void;
}

type CalendarMode = 'month' | 'day';

const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const CalendarView: React.FC<CalendarViewProps> = ({ tasks, onTaskClick, onDateClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mode, setMode] = useState<CalendarMode>('month');

  // --- Helpers ---
  
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { days, firstDay };
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getDate() === d2.getDate() && 
           d1.getMonth() === d2.getMonth() && 
           d1.getFullYear() === d2.getFullYear();
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
      <div className="bg-bg-surface rounded-card shadow-card border border-border overflow-hidden">
        {/* Days Header */}
        <div className="grid grid-cols-7 bg-bg-panel border-b border-border">
          {DAYS.map(day => (
            <div key={day} className="py-2.5 text-center text-xs font-semibold text-text-muted uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 auto-rows-[minmax(100px,1fr)]">
          {blanks.map(i => (
            <div key={`blank-${i}`} className="bg-bg-panel/30 border-b border-r border-border" />
          ))}
          
          {monthDays.map(day => {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const dayTasks = tasks.filter(t => {
              // Check deadline or startTime
              const tDate = t.startTime ? new Date(t.startTime) : (t.deadline ? new Date(t.deadline) : null);
              return tDate && isSameDay(tDate, date);
            });
            const isToday = isSameDay(date, new Date());

            return (
              <div 
                key={day} 
                onClick={() => onDateClick(date.getTime())}
                className={`
                  p-1 border-b border-r border-border transition-colors hover:bg-bg-panel cursor-pointer flex flex-col gap-1 overflow-hidden
                  ${isToday ? 'bg-primary/5' : ''}
                `}
              >
                <div className="flex justify-between items-start p-1">
                  <span className={`
                    text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full
                    ${isToday ? 'bg-primary text-white' : 'text-text-main'}
                  `}>
                    {day}
                  </span>
                </div>
                
                <div className="flex-1 flex flex-col gap-1 overflow-y-auto max-h-[100px] no-scrollbar">
                  {dayTasks.map(task => (
                    <div 
                      key={task.id}
                      onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                      className={`
                        text-[10px] px-1.5 py-0.5 rounded-[4px] truncate border-l-2 cursor-pointer
                        ${task.completed ? 'opacity-50 line-through' : ''}
                      `}
                      style={{ 
                        backgroundColor: (task.color || 'var(--color-primary)') + '1A', // 10% opacity hex approximation
                        borderColor: task.color || 'var(--color-primary)',
                        color: 'var(--color-text-main)'
                      }}
                      title={task.title}
                    >
                      {task.startTime && <span className="opacity-75 mr-1">{new Date(task.startTime).getHours()}:{new Date(task.startTime).getMinutes().toString().padStart(2, '0')}</span>}
                      {task.title}
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
    // Filter tasks for this day
    const dayTasks = tasks.filter(t => {
       const tDate = t.startTime ? new Date(t.startTime) : (t.deadline ? new Date(t.deadline) : null);
       return tDate && isSameDay(tDate, currentDate);
    });

    return (
      <div className="bg-bg-surface rounded-card shadow-card border border-border overflow-hidden flex flex-col h-full">
         <div className="flex-1 overflow-y-auto relative h-[600px] no-scrollbar">
            {HOURS.map(hour => (
              <div key={hour} className="flex border-b border-border min-h-[60px] relative">
                {/* Time Label */}
                <div className="w-16 flex-shrink-0 text-xs text-text-muted text-right pr-3 py-2 sticky left-0 bg-bg-surface border-r border-border z-10">
                  {hour.toString().padStart(2, '0')}:00
                </div>
                {/* Grid Line */}
                <div className="flex-1 relative" onClick={() => {
                   const d = new Date(currentDate);
                   d.setHours(hour, 0, 0, 0);
                   onDateClick(d.getTime());
                }}>
                  {/* Task Blocks */}
                  {dayTasks.map(task => {
                    const taskStart = task.startTime ? new Date(task.startTime) : null;
                    const taskEnd = task.endTime ? new Date(task.endTime) : (taskStart ? new Date(taskStart.getTime() + 60*60*1000) : null);
                    
                    if (!taskStart || taskStart.getHours() !== hour) return null;

                    const startMin = taskStart.getMinutes();
                    // Duration in minutes
                    const duration = taskEnd ? (taskEnd.getTime() - taskStart.getTime()) / (1000 * 60) : 60;
                    
                    return (
                      <div
                        key={task.id}
                        onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                        className="absolute left-1 right-1 rounded-[4px] border-l-4 p-1.5 text-xs shadow-sm overflow-hidden z-10 hover:z-20 cursor-pointer transition-all hover:shadow-md"
                        style={{
                          top: `${(startMin / 60) * 100}%`,
                          height: `${Math.max((duration / 60) * 100, 30)}%`, // min height for visibility
                          backgroundColor: (task.color || 'var(--color-primary)') + '1A',
                          borderColor: task.color || 'var(--color-primary)',
                        }}
                      >
                        <div className="font-semibold text-text-main">{task.title}</div>
                        <div className="text-text-muted">
                          {taskStart.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {taskEnd?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {/* Current Time Indicator */}
            {isSameDay(currentDate, new Date()) && (
              <div 
                className="absolute left-16 right-0 border-t-2 border-error z-20 pointer-events-none flex items-center"
                style={{ top: `${(new Date().getHours() * 60 + new Date().getMinutes()) / (24 * 60) * 100}%` }}
              >
                <div className="w-2 h-2 rounded-full bg-error -ml-1"></div>
              </div>
            )}
         </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Calendar Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-bg-surface p-3 rounded-card shadow-card border border-border">
        <div className="flex items-center gap-2">
          <button onClick={prev} className="p-2 hover:bg-bg-panel rounded-[6px] text-text-muted transition-colors">◀</button>
          <h2 className="text-lg font-bold w-48 text-center text-text-main">
            {currentDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}
            {mode === 'day' && <span className="block text-xs text-text-muted font-normal">{currentDate.toLocaleDateString('ru-RU')}</span>}
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
