
import { Task } from '../types';

// Web Worker Code as a string to avoid external file loading issues in this environment
const WORKER_CODE = `
  self.onmessage = function(e) {
    const { type, payload } = e.data;
    
    if (type === 'CALCULATE_ANALYTICS') {
      const { tasks } = payload;
      // Analytics logic embedded
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      // Weekly
      const weekly = Array(7).fill(0);
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      tasks.forEach(t => {
        if (t.completed && t.updatedAt >= startOfWeek.getTime()) {
          const dayIndex = new Date(t.updatedAt).getDay();
          weekly[dayIndex]++;
        }
      });
      const weeklyResult = weekly.map((count, index) => ({ day: days[index], count }));

      // Status Dist
      const counts = { 'backlog': 0, 'in-progress': 0, 'review': 0, 'done': 0 };
      tasks.forEach(t => {
        if (counts[t.status] !== undefined) counts[t.status]++;
      });
      const statusDist = [
        { name: 'Done', value: counts['done'], color: '#10b981' },
        { name: 'In Progress', value: counts['in-progress'], color: '#3b82f6' },
        { name: 'Review', value: counts['review'], color: '#f59e0b' },
        { name: 'Backlog', value: counts['backlog'], color: '#9ca3af' },
      ].filter(i => i.value > 0);

      // Upcoming
      const now = Date.now();
      const upcoming = tasks
        .filter(t => !t.completed && t.deadline && t.deadline > now)
        .sort((a, b) => (a.deadline || 0) - (b.deadline || 0))
        .slice(0, 5);

      // Completion Rate
      const completionRate = tasks.length === 0 ? 0 : Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100);
      
      self.postMessage({
        type: 'ANALYTICS_RESULT',
        payload: { weekly: weeklyResult, statusDist, upcoming, completionRate }
      });
    }
  };
`;

export class WorkerService {
  private static worker: Worker | null = null;
  private static useMainThread = false;

  static init() {
    if (this.worker || this.useMainThread) return;

    try {
      const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      this.worker = new Worker(url);
      
      this.worker.onerror = (e) => {
        console.warn("Worker error (possibly CSP), falling back to main thread", e);
        this.useMainThread = true;
        this.worker?.terminate();
        this.worker = null;
      };
    } catch (e) {
      console.warn("Worker creation failed, using main thread", e);
      this.useMainThread = true;
    }
  }

  static calculateAnalytics(tasks: Task[]): Promise<any> {
    this.init();
    return new Promise((resolve) => {
      if (this.useMainThread || !this.worker) {
        // Fallback execution on main thread
        resolve(this.runAnalyticsLocally(tasks));
        return;
      }

      const handler = (e: MessageEvent) => {
        if (e.data.type === 'ANALYTICS_RESULT') {
          this.worker?.removeEventListener('message', handler);
          resolve(e.data.payload);
        }
      };

      this.worker.addEventListener('message', handler);
      this.worker.postMessage({ type: 'CALCULATE_ANALYTICS', payload: { tasks } });
    });
  }

  // Duplicated logic for fallback to avoid complexity of sharing code between worker string and class
  private static runAnalyticsLocally(tasks: Task[]) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      // Weekly
      const weekly = Array(7).fill(0);
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      tasks.forEach(t => {
        if (t.completed && t.updatedAt >= startOfWeek.getTime()) {
          const dayIndex = new Date(t.updatedAt).getDay();
          weekly[dayIndex]++;
        }
      });
      const weeklyResult = weekly.map((count, index) => ({ day: days[index], count }));

      // Status Dist
      const counts: any = { 'backlog': 0, 'in-progress': 0, 'review': 0, 'done': 0 };
      tasks.forEach(t => {
        if (counts[t.status] !== undefined) counts[t.status]++;
      });
      const statusDist = [
        { name: 'Done', value: counts['done'], color: '#10b981' },
        { name: 'In Progress', value: counts['in-progress'], color: '#3b82f6' },
        { name: 'Review', value: counts['review'], color: '#f59e0b' },
        { name: 'Backlog', value: counts['backlog'], color: '#9ca3af' },
      ].filter(i => i.value > 0);

      // Upcoming
      const now = Date.now();
      const upcoming = tasks
        .filter(t => !t.completed && t.deadline && t.deadline > now)
        .sort((a, b) => (a.deadline || 0) - (b.deadline || 0))
        .slice(0, 5);

      // Completion Rate
      const completionRate = tasks.length === 0 ? 0 : Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100);

      return { weekly: weeklyResult, statusDist, upcoming, completionRate };
  }
}
