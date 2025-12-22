
import { Task, Note, Goal, AutomationRule, ProjectTemplate, CopilotMemory, BackupSnapshot } from '../types';

const DB_NAME = 'TaskAssistDB';
const DB_VERSION = 6; // Incremented for Backups
const STORES = {
  TASKS: 'tasks',
  NOTES: 'notes',
  GOALS: 'goals',
  AUTOMATIONS: 'automations',
  TEMPLATES: 'templates',
  MEMORY: 'memory',
  USER: 'user',
  BACKUPS: 'backups'
};

// LRU Cache Implementation
class LRUCache<K, V> {
  private capacity: number;
  private map: Map<K, V>;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.map = new Map();
  }

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const val = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }

  put(key: K, value: V) {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      // Assert non-null because size > 0 guarantees at least one key
      this.map.delete(this.map.keys().next().value!);
    }
    this.map.set(key, value);
  }
}

export class StorageService {
  private static db: IDBDatabase | null = null;
  private static taskCache = new LRUCache<string, Task>(100);

  static async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error("IndexedDB error:", event);
        reject("Could not open IndexedDB");
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = (event.target as IDBOpenDBRequest).transaction;

        if (!db.objectStoreNames.contains(STORES.TASKS)) {
          const taskStore = db.createObjectStore(STORES.TASKS, { keyPath: 'id' });
          taskStore.createIndex('status_idx', 'status', { unique: false });
          taskStore.createIndex('completed_idx', 'completed', { unique: false });
        } else {
           const taskStore = transaction?.objectStore(STORES.TASKS);
           if (taskStore && !taskStore.indexNames.contains('status_idx')) {
             taskStore.createIndex('status_idx', 'status', { unique: false });
           }
        }

        if (!db.objectStoreNames.contains(STORES.NOTES)) db.createObjectStore(STORES.NOTES, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORES.GOALS)) db.createObjectStore(STORES.GOALS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORES.AUTOMATIONS)) db.createObjectStore(STORES.AUTOMATIONS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORES.TEMPLATES)) db.createObjectStore(STORES.TEMPLATES, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORES.MEMORY)) db.createObjectStore(STORES.MEMORY, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORES.USER)) db.createObjectStore(STORES.USER, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORES.BACKUPS)) db.createObjectStore(STORES.BACKUPS, { keyPath: 'id' });
      };
    });
  }

  private static getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) throw new Error("Database not initialized");
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // --- Task Operations ---
  static async getTasks(): Promise<Task[]> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore(STORES.TASKS);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      } catch (e) { reject(e); }
    });
  }

  static async addTask(task: Task): Promise<void> {
    this.taskCache.put(task.id, task);
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.TASKS, 'readwrite');
      const request = store.add(task);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  static async updateTask(id: string, updates: Partial<Task>): Promise<void> {
    const cached = this.taskCache.get(id);
    if (cached) this.taskCache.put(id, { ...cached, ...updates });

    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.TASKS, 'readwrite');
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const task = getRequest.result as Task;
        if (!task) return reject("Task not found");
        const updatedTask = { ...task, ...updates };
        const putRequest = store.put(updatedTask);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  static async deleteTask(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.TASKS, 'readwrite');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- Note Operations ---
  static async getNotes(): Promise<Note[]> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore(STORES.NOTES);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      } catch (e) { reject(e); }
    });
  }

  static async addNote(note: Note): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.NOTES, 'readwrite');
      const request = store.add(note);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  static async updateNote(id: string, updates: Partial<Note>): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.NOTES, 'readwrite');
      const getRequest = store.get(id);
      getRequest.onsuccess = () => {
        const note = getRequest.result as Note;
        if (!note) return reject("Note not found");
        const updatedNote = { ...note, ...updates };
        const putRequest = store.put(updatedNote);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  static async deleteNote(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.NOTES, 'readwrite');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // --- Other Stores (Goals, Automations, Templates, Memory) ---
  // Simplified for brevity, assume similar patterns...
  static async getGoals(): Promise<Goal[]> { return this.getAll(STORES.GOALS); }
  static async addGoal(goal: Goal): Promise<void> { return this.add(STORES.GOALS, goal); }
  static async deleteGoal(id: string): Promise<void> { return this.delete(STORES.GOALS, id); }
  
  static async getAutomations(): Promise<AutomationRule[]> { return this.getAll(STORES.AUTOMATIONS); }
  static async addAutomation(rule: AutomationRule): Promise<void> { return this.add(STORES.AUTOMATIONS, rule); }
  static async deleteAutomation(id: string): Promise<void> { return this.delete(STORES.AUTOMATIONS, id); }

  static async getTemplates(): Promise<ProjectTemplate[]> { return this.getAll(STORES.TEMPLATES); }
  static async addTemplate(tpl: ProjectTemplate): Promise<void> { return this.add(STORES.TEMPLATES, tpl); }

  static async getMemory(): Promise<CopilotMemory[]> { return this.getAll(STORES.MEMORY); }
  static async setMemory(key: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(STORES.MEMORY, 'readwrite');
      const mem: CopilotMemory = { id: key, key, value, updatedAt: Date.now() };
      const request = store.put(mem);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  static async getMemoryItem(key: string): Promise<any> {
     const store = this.getStore(STORES.MEMORY);
     const request = store.get(key);
     return new Promise(resolve => {
         request.onsuccess = () => resolve(request.result?.value || null);
         request.onerror = () => resolve(null);
     });
  }

  // --- Backup Operations ---
  static async createBackup(data: any, label: string = 'Auto-Backup'): Promise<void> {
    const backup: BackupSnapshot = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      label,
      data
    };
    await this.add(STORES.BACKUPS, backup);
    
    // Cleanup old backups (keep last 5)
    const backups = await this.getAll(STORES.BACKUPS);
    if (backups.length > 5) {
      backups.sort((a, b) => b.timestamp - a.timestamp); // Newest first
      const toDelete = backups.slice(5);
      for (const b of toDelete) {
        await this.delete(STORES.BACKUPS, b.id);
      }
    }
  }

  static async getBackups(): Promise<BackupSnapshot[]> {
    return (await this.getAll(STORES.BACKUPS)).sort((a, b) => b.timestamp - a.timestamp);
  }

  static async restoreBackup(id: string): Promise<BackupSnapshot | null> {
    return new Promise((resolve) => {
      const store = this.getStore(STORES.BACKUPS);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  // --- Generic Helpers ---
  private static async getAll(storeName: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      try {
        const store = this.getStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      } catch (e) { resolve([]); }
    });
  }
  private static async add(storeName: string, item: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, 'readwrite');
      const request = store.add(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
  private static async delete(storeName: string, id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const store = this.getStore(storeName, 'readwrite');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
