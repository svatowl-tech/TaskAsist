
export type TaskStatus = string; // Changed from union to string for dynamic board columns
export type EventType = 'task' | 'meeting' | 'personal' | 'reminder';
export type NoteType = 'text' | 'checklist';

export interface TimeLog {
  start: number;
  end?: number;
}

// Updated Recurrence to object for complex rules
export interface RecurrenceConfig {
  frequency: 'none' | 'daily' | 'weekly' | 'monthly';
  interval: number; // e.g. every 1 week
  daysOfWeek?: number[]; // 0 = Sunday, 1 = Monday, etc.
}

export interface BoardColumn {
  id: string;
  title: string;
  order: number;
}

export interface Board {
  id: string;
  title: string;
  columns: BoardColumn[];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  tags: string[];
  assignee?: string;
  deadline?: number; // timestamp
  completed: boolean;
  order: number;
  createdAt: number;
  updatedAt: number;
  
  // Board Association
  boardId?: string; 

  // Calendar & Event Properties
  startTime?: number; // timestamp
  endTime?: number;   // timestamp
  eventType?: EventType;
  color?: string;     // hex code or tailwind class
  
  // Reminder Properties
  reminderTime?: number; // timestamp
  reminderFired?: boolean;

  // New Smart Features
  timeLogs?: TimeLog[];
  recurrence?: RecurrenceConfig | string; // Backward compatibility with string
  lastRecurrence?: number; // timestamp of last spawn
  
  // Google Calendar Integration
  gCalEventId?: string;
  
  // Advanced Analytics
  estimatedDuration?: number; // minutes
  dependencies?: string[]; // IDs of tasks that block this task
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string; // For text notes
  type: NoteType;
  items?: ChecklistItem[]; // For checklists
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Goal {
  id: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: 'tasks' | 'hours';
  period: 'weekly' | 'monthly';
  deadline?: number;
}

// Automation Types
export type TriggerType = 
  | 'status_change' 
  | 'tag_added' 
  | 'location_enter' 
  | 'location_leave'
  | 'weather_condition'
  | 'inactivity';

export type ActionType = 'add_tag' | 'set_color' | 'assign_user' | 'webhook' | 'create_notification';

export interface AutomationRule {
  id: string;
  name: string;
  isActive: boolean;
  description?: string;
  trigger: {
    type: TriggerType;
    value: string; // Generic value
    // Extended Config
    location?: { lat: number; lng: number; radius: number }; // Radius in meters
    weather?: 'sunny' | 'rain' | 'cloudy' | 'snow';
    inactivityDays?: number;
  };
  action: {
    type: ActionType;
    value: string;
  };
  lastRun?: number;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  tasks: Partial<Task>[];
  columns?: string[];
}

export type WidgetType = 'summary' | 'activity_chart' | 'status_chart' | 'goals' | 'upcoming' | 'heatmap' | 'gantt' | 'time_stats';

export interface DashboardWidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  w: string; // width class (e.g. col-span-1)
}

export type AuthProvider = 'google' | 'yandex' | 'github' | 'local';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: AuthProvider;
}

export type ThemeMode = 'light' | 'dark';

// Copilot Settings
export type AssistantTone = 'professional' | 'friendly' | 'concise' | 'humorous';

export interface CopilotMemory {
  id: string;
  key: string; // e.g., 'last_briefing_date', 'user_preference_work_hours', 'style_preference'
  value: any;
  updatedAt: number;
}

// --- NEW SCHEDULING TYPES ---

export type GlobalEventType = 'holiday' | 'birthday' | 'vacation' | 'other';

export interface GlobalEvent {
  id: string;
  title: string;
  date: number; // timestamp
  type: GlobalEventType;
  isRecurringYearly: boolean; // For birthdays/fixed holidays
  color?: string;
}

export interface WorkSchedule {
  type: 'standard' | 'shift' | 'flexible';
  
  // For 'standard' (e.g. 5/2)
  workDays?: number[]; // [1,2,3,4,5] for Mon-Fri
  
  // For 'shift' (e.g. 2/2, 3/3)
  shiftConfig?: {
    workCount: number; // 2
    offCount: number;  // 2
    startDate: number; // Reference date to calculate cycle
  };
}

export interface AppSettings {
  openRouterApiKey?: string;
  aiModel?: string;
  theme?: ThemeMode;
  reminderDefaultMinutes?: number;
  dashboardLayout?: DashboardWidgetConfig[];
  
  // Schedule Config
  workSchedule?: WorkSchedule;
  
  // Sync & Backup
  githubToken?: string;
  githubGistId?: string;
  encryptionPassword?: string;
  syncStrategy?: 'manual' | 'auto' | 'cloud_force';
  
  // Copilot Settings
  assistantTone?: AssistantTone;
  voiceEnabled?: boolean;
  voiceName?: string;
  
  // Local AI
  useLocalModel?: boolean;
  localModelId?: string;
}

export interface BackupSnapshot {
  id: string;
  timestamp: number;
  label: string;
  data: AppState;
}

export interface AppState {
  tasks: Task[];
  notes: Note[];
  goals: Goal[];
  automations: AutomationRule[];
  templates: ProjectTemplate[];
  memory: CopilotMemory[];
  boards: Board[]; 
  activeBoardId: string | null;
  globalEvents: GlobalEvent[]; // New Store for holidays etc
  user: User | null;
  settings: AppSettings;
  isLoading: boolean;
  lastSynced?: number; 
}

export type ViewMode = 'tasks' | 'board' | 'calendar' | 'notes' | 'analytics' | 'automation' | 'settings';

export interface SyncResult {
  success: boolean;
  data?: AppState;
  timestamp?: number;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  imageUrl?: string; // Base64 data URI
  timestamp: number;
  feedback?: 'like' | 'dislike';
}
