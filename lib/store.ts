
import { AppState, Task, Note, Goal, AutomationRule, ProjectTemplate, CopilotMemory, User, AppSettings } from '../types';

type Listener = (state: AppState) => void;

const INITIAL_STATE: AppState = {
  tasks: [],
  notes: [],
  goals: [],
  automations: [],
  templates: [],
  memory: [],
  user: null,
  settings: { theme: 'dark' },
  isLoading: true,
};

class Store {
  private state: AppState = INITIAL_STATE;
  private listeners: Set<Listener> = new Set();

  getState(): AppState {
    return this.state;
  }

  setState(partial: Partial<AppState> | ((prev: AppState) => Partial<AppState>)) {
    const update = typeof partial === 'function' ? partial(this.state) : partial;
    
    // Shallow merge
    this.state = { ...this.state, ...update };
    
    // Notify listeners
    this.listeners.forEach(listener => listener(this.state));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // --- Actions ---

  setLoading(isLoading: boolean) {
    this.setState({ isLoading });
  }

  setUser(user: User | null) {
    this.setState({ user });
  }

  updateTask(task: Task) {
    this.setState(prev => ({
      tasks: prev.tasks.map(t => t.id === task.id ? task : t)
    }));
  }

  addTask(task: Task) {
    this.setState(prev => ({
      tasks: [...prev.tasks, task]
    }));
  }

  deleteTask(id: string) {
    this.setState(prev => ({
      tasks: prev.tasks.filter(t => t.id !== id)
    }));
  }
}

export const appStore = new Store();
