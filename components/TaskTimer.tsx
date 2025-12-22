
import React, { useState, useEffect } from 'react';
import { Task, TimeLog } from '../types';
import { AutomationService } from '../services/automationService';

interface TaskTimerProps {
  task: Task;
  onUpdateLogs: (logs: TimeLog[]) => void;
}

export const TaskTimer: React.FC<TaskTimerProps> = ({ task, onUpdateLogs }) => {
  // Check if timer is running (last log has no end)
  const isRunning = task.timeLogs && task.timeLogs.length > 0 && !task.timeLogs[task.timeLogs.length - 1].end;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let interval: number;

    const calculateElapsed = () => {
      let total = 0;
      if (task.timeLogs) {
        task.timeLogs.forEach(log => {
          const end = log.end || Date.now();
          total += (end - log.start);
        });
      }
      setElapsed(total);
    };

    calculateElapsed();

    if (isRunning) {
      interval = window.setInterval(calculateElapsed, 1000);
    }

    return () => clearInterval(interval);
  }, [task.timeLogs, isRunning]);

  const toggleTimer = () => {
    let newLogs = [...(task.timeLogs || [])];
    
    if (isRunning) {
      // Stop
      const lastIndex = newLogs.length - 1;
      newLogs[lastIndex] = { ...newLogs[lastIndex], end: Date.now() };
    } else {
      // Start
      newLogs.push({ start: Date.now() });
    }
    
    onUpdateLogs(newLogs);
  };

  return (
    <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
      <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}></div>
      <span className="font-mono text-sm font-medium tabular-nums">
        {AutomationService.formatDuration(elapsed)}
      </span>
      <button 
        onClick={toggleTimer}
        className={`ml-1 text-xs font-bold px-2 py-0.5 rounded text-white transition
          ${isRunning ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}
        `}
      >
        {isRunning ? 'STOP' : 'START'}
      </button>
    </div>
  );
};
