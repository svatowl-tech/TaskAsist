
import React, { useState, useEffect, useRef } from 'react';
import { Task } from '../types';

interface PomodoroTimerProps {
  activeTask?: Task | null;
  onUpdateTaskLog: (taskId: string, start: number, end: number) => void;
}

type TimerMode = 'work' | 'short_break' | 'long_break';

const MODES: Record<TimerMode, { label: string; minutes: number; color: string }> = {
  work: { label: 'Фокус', minutes: 25, color: 'bg-red-500' },
  short_break: { label: 'Короткий перерыв', minutes: 5, color: 'bg-green-500' },
  long_break: { label: 'Длинный перерыв', minutes: 15, color: 'bg-blue-500' }
};

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ activeTask, onUpdateTaskLog }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<TimerMode>('work');
  const [timeLeft, setTimeLeft] = useState(MODES.work.minutes * 60);
  const [isActive, setIsActive] = useState(false);
  const sessionStartRef = useRef<number | null>(null);

  useEffect(() => {
    let interval: number | null = null;
    if (isActive && timeLeft > 0) {
      interval = window.setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      // Timer finished
      setIsActive(false);
      playAlarm();
      if (mode === 'work' && activeTask && sessionStartRef.current) {
        onUpdateTaskLog(activeTask.id, sessionStartRef.current, Date.now());
      }
      sessionStartRef.current = null;
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isActive, timeLeft, mode, activeTask]);

  const toggleTimer = () => {
    if (!isActive) {
      // Start
      setIsActive(true);
      if (mode === 'work') sessionStartRef.current = Date.now();
    } else {
      // Pause/Stop
      setIsActive(false);
      // Log partial progress if stopping work
      if (mode === 'work' && activeTask && sessionStartRef.current) {
        onUpdateTaskLog(activeTask.id, sessionStartRef.current, Date.now());
        sessionStartRef.current = null;
      }
    }
  };

  const resetTimer = (newMode: TimerMode) => {
    setIsActive(false);
    setMode(newMode);
    setTimeLeft(MODES[newMode].minutes * 60);
    sessionStartRef.current = null;
  };

  const playAlarm = () => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.connect(ctx.destination);
    osc.frequency.value = 440;
    osc.start();
    setTimeout(() => osc.stop(), 500);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 left-6 z-50 w-12 h-12 bg-bg-surface border border-border rounded-full shadow-lg flex items-center justify-center text-xl hover:scale-105 transition"
      >
        🍅
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 left-6 z-50 w-72 bg-bg-surface border border-border rounded-xl shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-2 overflow-hidden">
      <div className={`p-4 text-white flex justify-between items-center ${MODES[mode].color} transition-colors duration-300`}>
        <span className="font-bold">{MODES[mode].label}</span>
        <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">✕</button>
      </div>
      
      <div className="p-6 text-center">
        <div className="text-5xl font-mono font-bold text-text-main mb-6 tabular-nums">
          {formatTime(timeLeft)}
        </div>
        
        {activeTask && mode === 'work' && (
          <div className="text-xs text-text-muted mb-4 bg-bg-panel py-1 px-2 rounded truncate">
            Задача: {activeTask.title}
          </div>
        )}

        <div className="flex justify-center gap-4 mb-6">
          <button 
            onClick={toggleTimer}
            className={`px-6 py-2 rounded-full font-bold text-white transition-transform active:scale-95 ${isActive ? 'bg-text-disabled' : 'bg-primary'}`}
          >
            {isActive ? 'Пауза' : 'Старт'}
          </button>
        </div>

        <div className="flex justify-center gap-2 border-t border-border pt-4">
          <button onClick={() => resetTimer('work')} className="text-xs px-2 py-1 rounded hover:bg-bg-panel text-text-muted">Work</button>
          <button onClick={() => resetTimer('short_break')} className="text-xs px-2 py-1 rounded hover:bg-bg-panel text-text-muted">Short</button>
          <button onClick={() => resetTimer('long_break')} className="text-xs px-2 py-1 rounded hover:bg-bg-panel text-text-muted">Long</button>
        </div>
      </div>
    </div>
  );
};
