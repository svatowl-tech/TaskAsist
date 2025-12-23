
import { AppState, Task, Note, Goal, AutomationRule, ProjectTemplate, CopilotMemory, User, AppSettings, BoardColumn, Board, GlobalEvent } from '../types';

type Listener = (state: AppState) => void;

// Default columns for new boards
export const DEFAULT_COLUMNS: BoardColumn[] = [
  { id: 'backlog', title: 'Бэклог', order: 0 },
  { id: 'in-progress', title: 'В работе', order: 1 },
  { id: 'review', title: 'Проверка', order: 2 },
  { id: 'done', title: 'Готово', order: 3 },
];

const DEFAULT_BOARD: Board = {
  id: 'default-board',
  title: 'Главная',
  columns: DEFAULT_COLUMNS
};

const INITIAL_STATE: AppState = {
  tasks: [],
  notes: [],
  goals: [],
  automations: [],
  templates: [],
  memory: [],
  boards: [DEFAULT_BOARD],
  activeBoardId: 'default-board',
  globalEvents: [],
  user: null,
  settings: { theme: 'dark', workSchedule: { type: 'standard', workDays: [1,2,3,4,5] } },
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
  
  setActiveBoard(id: string) {
    this.setState({ activeBoardId: id });
  }

  updateBoard(board: Board) {
    this.setState(prev => ({
      boards: prev.boards.map(b => b.id === board.id ? board : b)
    }));
  }
  
  addGlobalEvent(event: GlobalEvent) {
    this.setState(prev => ({
        globalEvents: [...prev.globalEvents, event]
    }));
  }
  
  deleteGlobalEvent(id: string) {
    this.setState(prev => ({
        globalEvents: prev.globalEvents.filter(e => e.id !== id)
    }));
  }
}

export const appStore = new Store();
