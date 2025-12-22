
import { AppState, Task } from '../types';
import { StorageService } from './storageService';
import { appStore } from '../lib/store';

// Define the API protocol
type ApiMessage = 
  | { type: 'GET_STATE'; requestId: string }
  | { type: 'ADD_TASK'; requestId: string; payload: { title: string; description?: string } }
  | { type: 'PING'; requestId: string };

export class DeveloperApiService {
  private static channel: BroadcastChannel | null = null;

  static init() {
    if (this.channel) return;

    // "task_assist_api" is the public channel external scripts/extensions can join
    this.channel = new BroadcastChannel('task_assist_api');
    
    this.channel.onmessage = async (event: MessageEvent) => {
      const msg = event.data as ApiMessage;
      if (!msg || !msg.type) return;

      console.log('[DevAPI] Received:', msg);

      switch (msg.type) {
        case 'PING':
          this.respond(msg.requestId, { status: 'ok', version: '1.0.0' });
          break;

        case 'GET_STATE':
          const state = appStore.getState();
          // Filter sensitive data
          const publicState = {
            tasks: state.tasks,
            notes: state.notes,
            goals: state.goals
          };
          this.respond(msg.requestId, publicState);
          break;

        case 'ADD_TASK':
          if (msg.payload && msg.payload.title) {
            const newTask: Task = {
               id: crypto.randomUUID(),
               title: msg.payload.title,
               description: msg.payload.description || '',
               status: 'backlog',
               tags: ['api-import'],
               completed: false,
               createdAt: Date.now(),
               updatedAt: Date.now(),
               order: Date.now()
            };
            await StorageService.addTask(newTask);
            appStore.addTask(newTask);
            this.respond(msg.requestId, { status: 'created', taskId: newTask.id });
          } else {
            this.respond(msg.requestId, { error: 'Title required' });
          }
          break;
      }
    };
    
    console.log('Developer API initialized on channel: task_assist_api');
  }

  private static respond(requestId: string, data: any) {
    this.channel?.postMessage({
      type: 'API_RESPONSE',
      requestId,
      data
    });
  }
}
