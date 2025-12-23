
import React, { useState, useEffect, useRef } from 'react';
import { AppState, Goal, DashboardWidgetConfig, Task } from '../types';
import { StorageService } from '../services/storageService';
import { AiService } from '../services/aiService';
import { AnalyticsService } from '../services/analyticsService';
import { WorkerService } from '../services/workerService';

interface AnalyticsViewProps {
  appState: AppState;
  onUpdateGoals: (goals: Goal[]) => void;
}

const DEFAULT_WIDGETS: DashboardWidgetConfig[] = [
  { id: 'w1', type: 'summary', title: 'Сводка', w: 'col-span-1 md:col-span-3' },
  { id: 'w2', type: 'activity_chart', title: 'Активность', w: 'col-span-1 md:col-span-2' },
  { id: 'w_heat', type: 'heatmap', title: 'Карта вклада (Heatmap)', w: 'col-span-1 md:col-span-3' },
  { id: 'w_time', type: 'time_stats', title: 'Затрачено времени (мин)', w: 'col-span-1 md:col-span-1' },
  { id: 'w_gantt', type: 'gantt', title: 'Хронология и Зависимости', w: 'col-span-1 md:col-span-3' },
];

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ appState, onUpdateGoals }) => {
  const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>(
    appState.settings.dashboardLayout || DEFAULT_WIDGETS
  );
  const [report, setReport] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  const [heatmapData, setHeatmapData] = useState<{date: string, count: number}[]>([]);
  const [timeStats, setTimeStats] = useState<{tag: string, minutes: number}[]>([]);
  const [bottlenecks, setBottlenecks] = useState<Task[]>([]);
  const [prediction, setPrediction] = useState<{estimatedDate: Date | null, totalHoursLeft: number}>({ estimatedDate: null, totalHoursLeft: 0 });

  const [weeklyStats, setWeeklyStats] = useState<any[]>([]);
  const [statusStats, setStatusStats] = useState<any[]>([]);

  useEffect(() => {
    // Basic stats
    setWeeklyStats(AnalyticsService.getWeeklyActivity(appState.tasks));
    setStatusStats(AnalyticsService.getStatusDistribution(appState.tasks));

    // Advanced Stats
    setHeatmapData(AnalyticsService.getHeatmapData(appState.tasks));
    setTimeStats(AnalyticsService.getTimeStats(appState.tasks));
    setBottlenecks(AnalyticsService.detectBottlenecks(appState.tasks));
    setPrediction(AnalyticsService.predictCompletion(appState.tasks));
  }, [appState.tasks]);

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const content = document.getElementById('analytics-content')?.innerHTML;
      printWindow.document.write(`
        <html>
          <head>
            <title>Отчет TaskAssist</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              body { padding: 40px; }
              @media print { .no-print { display: none; } }
            </style>
          </head>
          <body>
            <h1 class="text-3xl font-bold mb-4">Отчет о продуктивности</h1>
            <p class="text-gray-500 mb-8">Сгенерировано: ${new Date().toLocaleString()}</p>
            ${content}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 500);
    }
  };

  // --- Renderers ---

  const renderHeatmap = () => {
    // Simple last 5 months grid
    const today = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 5);
    
    const days: Date[] = [];
    let d = new Date(startDate);
    while (d <= today) {
      days.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }

    const getColor = (date: Date) => {
      const dateStr = date.toISOString().split('T')[0];
      const found = heatmapData.find(h => h.date === dateStr);
      const count = found ? found.count : 0;
      if (count === 0) return 'bg-gray-100 dark:bg-gray-700';
      if (count < 2) return 'bg-green-200';
      if (count < 4) return 'bg-green-400';
      return 'bg-green-600';
    };

    return (
      <div className="flex flex-wrap gap-1">
        {days.map(day => (
          <div 
            key={day.toISOString()} 
            className={`w-3 h-3 rounded-sm ${getColor(day)}`}
            title={`${day.toLocaleDateString()}: ${heatmapData.find(h => h.date === day.toISOString().split('T')[0])?.count || 0} задач`}
          ></div>
        ))}
      </div>
    );
  };

  const renderGantt = () => {
    // Simplified Gantt: Just active tasks with timeline
    const activeTasks = appState.tasks
      .filter(t => !t.completed && t.deadline)
      .sort((a, b) => (a.startTime || a.createdAt) - (b.startTime || b.createdAt))
      .slice(0, 10);

    if (activeTasks.length === 0) return <p className="text-gray-400">Нет активных задач со сроками</p>;

    const minTime = Math.min(...activeTasks.map(t => t.startTime || t.createdAt));
    const maxTime = Math.max(...activeTasks.map(t => t.deadline || Date.now() + 86400000));
    const totalDuration = maxTime - minTime;

    return (
      <div className="space-y-3">
        {activeTasks.map(task => {
          const start = task.startTime || task.createdAt;
          const end = task.deadline || (Date.now() + 86400000);
          const left = ((start - minTime) / totalDuration) * 100;
          const width = Math.max(((end - start) / totalDuration) * 100, 5); // min 5% width

          return (
             <div key={task.id} className="relative h-8 bg-gray-50 dark:bg-gray-800 rounded flex items-center mb-1">
                <div className="absolute left-2 text-xs font-medium z-10 truncate max-w-[150px]">{task.title}</div>
                <div 
                  className="absolute h-full bg-blue-100 dark:bg-blue-900/40 border-l-4 border-blue-500 rounded-r opacity-80"
                  style={{ left: `${left}%`, width: `${width}%` }}
                ></div>
             </div>
          );
        })}
      </div>
    );
  };

  const renderWidgetContent = (type: string) => {
    switch(type) {
      case 'summary':
        const done = appState.tasks.filter(t => t.completed).length;
        return (
          <div className="flex justify-around items-center h-full">
            <div className="text-center">
              <p className="text-3xl font-bold text-blue-600">{done}</p>
              <p className="text-xs text-gray-500 uppercase">Сделано</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-600">{bottlenecks.length}</p>
              <p className="text-xs text-gray-500 uppercase">Блокирующих</p>
            </div>
             <div className="text-center">
              <p className="text-xl font-bold text-gray-600">{prediction.totalHoursLeft} ч</p>
              <p className="text-xs text-gray-500 uppercase">Осталось работы</p>
            </div>
          </div>
        );
      case 'activity_chart':
         const maxVal = Math.max(...weeklyStats.map(d => d.count), 1);
         return (
          <div className="flex items-end justify-between h-40 px-2 pt-4">
             {weeklyStats.map(d => (
               <div key={d.day} className="flex flex-col items-center gap-2 group w-full">
                  <div className="w-4/5 bg-blue-500 rounded-t-md" style={{ height: `${(d.count / maxVal) * 100}%`, minHeight: '4px' }}></div>
                  <span className="text-xs text-gray-400">{d.day}</span>
               </div>
             ))}
          </div>
         );
      case 'heatmap': return <div className="p-2 overflow-x-auto">{renderHeatmap()}</div>;
      case 'time_stats':
        return (
           <div className="space-y-2 max-h-48 overflow-y-auto">
             {timeStats.map(stat => (
               <div key={stat.tag} className="flex justify-between text-sm">
                 <span className="text-gray-600 dark:text-gray-300">#{stat.tag}</span>
                 <span className="font-mono font-medium">{stat.minutes} мин</span>
               </div>
             ))}
             {timeStats.length === 0 && <p className="text-gray-400 text-xs">Таймер не использовался</p>}
           </div>
        );
      case 'gantt': return <div className="p-2">{renderGantt()}</div>;
      default: return null;
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-8">
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center no-print">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Аналитика</h2>
          <div className="flex gap-2">
             <button 
               onClick={handlePrintReport}
               className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition text-sm"
             >
               🖨️ PDF Отчет
             </button>
          </div>
        </div>

        {prediction.estimatedDate && (
           <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 flex items-center gap-3">
              <span className="text-2xl">🔮</span>
              <div>
                <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">Прогноз завершения всех задач</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  При текущем темпе вы закончите примерно <b>{prediction.estimatedDate.toLocaleDateString()}</b>.
                </p>
              </div>
           </div>
        )}

        <div id="analytics-content" className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-20">
          {widgets.map((widget) => (
            <div
              key={widget.id}
              className={`
                ${widget.w} bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 
                flex flex-col
              `}
            >
               <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-50 dark:border-gray-700/50">
                 <h3 className="font-semibold text-gray-700 dark:text-gray-200">{widget.title}</h3>
               </div>
               <div className="flex-1 min-h-[100px]">
                 {renderWidgetContent(widget.type)}
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
