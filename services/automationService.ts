
import { Task, AutomationRule, AppState } from '../types';
import { StorageService } from './storageService';
import { NotificationService } from './notificationService';

export class AutomationService {
  
  // Haversine Formula for Geofencing
  private static getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3; // Radius of the earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
  }

  private static deg2rad(deg: number) {
    return deg * (Math.PI / 180);
  }

  // --- Main Evaluation Logic ---

  static async evaluateRules(
    task: Task, 
    previousTaskState: Task | null, 
    rules: AutomationRule[],
    context?: { location?: { lat: number, lng: number }, weather?: string }
  ): Promise<Task> {
    let updatedTask = { ...task };
    let hasChanges = false;
    const now = Date.now();

    for (const rule of rules) {
      if (!rule.isActive) continue;

      let triggered = false;

      // 1. Status Change
      if (rule.trigger.type === 'status_change') {
        if (
          previousTaskState && 
          previousTaskState.status !== task.status && 
          task.status === rule.trigger.value
        ) {
          triggered = true;
        }
      }
      
      // 2. Tag Added
      else if (rule.trigger.type === 'tag_added') {
        const tag = rule.trigger.value;
        if (previousTaskState && !previousTaskState.tags.includes(tag) && task.tags.includes(tag)) {
          triggered = true;
        }
      }

      // 3. Location Triggers (Geofencing)
      else if (context?.location && rule.trigger.location) {
        const dist = this.getDistanceFromLatLonInMeters(
          context.location.lat, context.location.lng,
          rule.trigger.location.lat, rule.trigger.location.lng
        );
        
        // ENTER Geofence
        if (rule.trigger.type === 'location_enter' && dist <= rule.trigger.location.radius) {
           // Prevent spam: check lastRun > 1 hour
           if (!rule.lastRun || (now - rule.lastRun > 3600000)) triggered = true;
        }
        // LEAVE Geofence
        if (rule.trigger.type === 'location_leave' && dist > rule.trigger.location.radius) {
           if (!rule.lastRun || (now - rule.lastRun > 3600000)) triggered = true;
        }
      }

      // 4. Inactivity Trigger (Stale Tasks)
      else if (rule.trigger.type === 'inactivity' && !task.completed) {
         const days = rule.trigger.inactivityDays || 7;
         const diffTime = Math.abs(now - task.updatedAt);
         const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
         if (diffDays >= days) {
            // Only trigger once per day max
            if (!rule.lastRun || (now - rule.lastRun > 24 * 3600000)) triggered = true;
         }
      }

      // Execute Action
      if (triggered) {
        console.log(`[Automation] Rule "${rule.name}" triggered for task "${task.title}"`);
        
        // Update Last Run
        rule.lastRun = now;
        await StorageService.addAutomation(rule); // Save lastRun state (simplified update)

        if (rule.action.type === 'add_tag') {
           if (!updatedTask.tags.includes(rule.action.value)) {
             updatedTask.tags = [...updatedTask.tags, rule.action.value];
             hasChanges = true;
           }
        } else if (rule.action.type === 'set_color') {
           updatedTask.color = rule.action.value;
           hasChanges = true;
        } else if (rule.action.type === 'assign_user') {
           updatedTask.assignee = rule.action.value;
           hasChanges = true;
        } else if (rule.action.type === 'create_notification') {
           NotificationService.show(rule.action.value, { body: task.title });
        } else if (rule.action.type === 'webhook') {
           try {
             fetch(rule.action.value, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify(updatedTask)
             }).catch(console.error);
           } catch (e) { console.error('Webhook failed', e); }
        }
      }
    }

    return hasChanges ? updatedTask : task;
  }

  // --- Simulation for Testing ---
  
  static simulateRule(rule: AutomationRule, tasks: Task[]): Task[] {
    const affectedTasks: Task[] = [];
    const now = Date.now();

    tasks.forEach(task => {
      let wouldTrigger = false;

      if (rule.trigger.type === 'status_change') {
         // Cannot simulate state change purely on static list, assume match if status matches
         if (task.status === rule.trigger.value) wouldTrigger = true;
      }
      else if (rule.trigger.type === 'tag_added') {
         if (task.tags.includes(rule.trigger.value)) wouldTrigger = true;
      }
      else if (rule.trigger.type === 'inactivity' && !task.completed) {
         const days = rule.trigger.inactivityDays || 7;
         const diffTime = Math.abs(now - task.updatedAt);
         const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
         if (diffDays >= days) wouldTrigger = true;
      }
      
      if (wouldTrigger) {
        affectedTasks.push(task);
      }
    });

    return affectedTasks;
  }

  static async checkRecurringTasks(tasks: Task[]): Promise<Task[]> {
    const now = Date.now();
    const newTasks: Task[] = [];
    const oneDay = 24 * 60 * 60 * 1000;

    for (const task of tasks) {
      if (!task.recurrence || task.recurrence === 'none') continue;
      if (task.status !== 'done') continue; 

      const lastRun = task.lastRecurrence || task.createdAt;
      let shouldSpawn = false;
      let nextDate = 0;

      if (task.recurrence === 'daily') {
         if (now - lastRun > oneDay) {
           shouldSpawn = true;
           nextDate = now + oneDay;
         }
      } else if (task.recurrence === 'weekly') {
         if (now - lastRun > oneDay * 7) {
           shouldSpawn = true;
           nextDate = now + oneDay * 7;
         }
      } else if (task.recurrence === 'monthly') {
         if (now - lastRun > oneDay * 30) {
           shouldSpawn = true;
           nextDate = now + oneDay * 30;
         }
      }

      if (shouldSpawn) {
        const newTask: Task = {
          ...task,
          id: crypto.randomUUID(),
          status: 'backlog',
          completed: false,
          createdAt: now,
          updatedAt: now,
          recurrence: task.recurrence, 
          lastRecurrence: now,
          startTime: undefined, 
          endTime: undefined,
          deadline: task.deadline ? task.deadline + (nextDate - lastRun) : undefined
        };
        
        await StorageService.updateTask(task.id, { lastRecurrence: now });
        newTasks.push(newTask);
      }
    }
    
    for (const t of newTasks) {
      await StorageService.addTask(t);
    }

    return newTasks;
  }

  static formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
}
