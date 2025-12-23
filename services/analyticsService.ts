
import { Task } from '../types';

export class AnalyticsService {
  
  static getWeeklyActivity(tasks: Task[]): { day: string; count: number }[] {
    const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    const result = Array(7).fill(0);
    const today = new Date();
    
    // Get start of week (Monday)
    // JS getDay(): 0=Sun, 1=Mon...
    const currentDay = today.getDay();
    // If Sunday (0), we need to go back 6 days. If Monday (1), 0 days.
    const daysToMon = currentDay === 0 ? 6 : currentDay - 1;
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - daysToMon);
    startOfWeek.setHours(0, 0, 0, 0);

    const completedTasks = tasks.filter(t => t.completed && t.updatedAt >= startOfWeek.getTime());

    completedTasks.forEach(t => {
      const d = new Date(t.updatedAt).getDay();
      // Map JS day (0=Sun) to Array index (6=Sun)
      const index = d === 0 ? 6 : d - 1;
      result[index]++;
    });

    return result.map((count, index) => ({
      day: days[index],
      count
    }));
  }

  static getStatusDistribution(tasks: Task[]): { name: string; value: number; color: string }[] {
    const counts: Record<string, number> = {};

    tasks.forEach(t => {
      const status = t.status || 'unknown';
      counts[status] = (counts[status] || 0) + 1;
    });
    
    // Define standard colors, generate others randomly or hash
    const getColor = (status: string) => {
        switch(status) {
            case 'done': return '#10b981';
            case 'in-progress': return '#3b82f6';
            case 'review': return '#f59e0b';
            case 'backlog': return '#9ca3af';
            default: return '#' + Math.floor(Math.random()*16777215).toString(16);
        }
    };

    return Object.entries(counts).map(([status, count]) => ({
        name: status,
        value: count,
        color: getColor(status)
    }));
  }

  static getUpcomingDeadlines(tasks: Task[], limit = 5): Task[] {
    const now = Date.now();
    return tasks
      .filter(t => !t.completed && t.deadline && t.deadline > now)
      .sort((a, b) => (a.deadline || 0) - (b.deadline || 0))
      .slice(0, limit);
  }

  static getCompletionRate(tasks: Task[]): number {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(t => t.completed).length;
    return Math.round((completed / tasks.length) * 100);
  }

  // --- New Advanced Analytics ---

  static getHeatmapData(tasks: Task[]): { date: string; count: number }[] {
    const map = new Map<string, number>();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    tasks.forEach(t => {
      if (t.completed) {
        const dateStr = new Date(t.updatedAt).toISOString().split('T')[0];
        map.set(dateStr, (map.get(dateStr) || 0) + 1);
      }
      // Also count creation for activity? Standard is completion or contribution. Let's stick to completion for now.
    });

    return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
  }

  static getTimeStats(tasks: Task[]): { tag: string; minutes: number }[] {
    const tagTime: Record<string, number> = {};
    let untaggedTime = 0;

    tasks.forEach(t => {
      if (!t.timeLogs || t.timeLogs.length === 0) return;
      
      const totalMs = t.timeLogs.reduce((acc, log) => {
        return acc + ((log.end || Date.now()) - log.start);
      }, 0);
      const minutes = Math.floor(totalMs / 60000);

      if (t.tags.length === 0) {
        untaggedTime += minutes;
      } else {
        t.tags.forEach(tag => {
          tagTime[tag] = (tagTime[tag] || 0) + minutes;
        });
      }
    });

    const result = Object.entries(tagTime).map(([tag, minutes]) => ({ tag, minutes }));
    if (untaggedTime > 0) result.push({ tag: 'No Tag', minutes: untaggedTime });
    
    return result.sort((a, b) => b.minutes - a.minutes);
  }

  static detectBottlenecks(tasks: Task[]): Task[] {
    // Tasks that are blocking many other tasks
    const dependencyCounts: Record<string, number> = {};
    
    tasks.forEach(t => {
      if (t.dependencies) {
        t.dependencies.forEach(depId => {
           dependencyCounts[depId] = (dependencyCounts[depId] || 0) + 1;
        });
      }
    });

    // Find incomplete tasks that block 2 or more other tasks
    return tasks.filter(t => 
      !t.completed && 
      dependencyCounts[t.id] && 
      dependencyCounts[t.id] >= 2
    );
  }

  static predictCompletion(tasks: Task[]): { estimatedDate: Date | null, totalHoursLeft: number } {
    const pending = tasks.filter(t => !t.completed);
    if (pending.length === 0) return { estimatedDate: new Date(), totalHoursLeft: 0 };

    // Calculate average velocity (minutes per task) from last 10 completed tasks with time logs
    const completedWithLogs = tasks
      .filter(t => t.completed && t.timeLogs && t.timeLogs.length > 0)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 10);
    
    let avgMinutes = 60; // Default fallback: 1 hour per task
    if (completedWithLogs.length > 0) {
       const totalMins = completedWithLogs.reduce((acc, t) => {
         const duration = t.timeLogs!.reduce((s, l) => s + (l.end! - l.start), 0) / 60000;
         return acc + duration;
       }, 0);
       avgMinutes = totalMins / completedWithLogs.length;
    }

    // Use specific estimates if available, else average
    const totalMinutesLeft = pending.reduce((acc, t) => {
       return acc + (t.estimatedDuration || avgMinutes);
    }, 0);

    // Assume 4 hours of productive work per day
    const daysLeft = totalMinutesLeft / (4 * 60);
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + Math.ceil(daysLeft));

    return {
      estimatedDate,
      totalHoursLeft: Math.round(totalMinutesLeft / 60 * 10) / 10
    };
  }
}
