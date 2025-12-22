
import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { Layout } from './components/Layout';
import { WidgetView } from './components/WidgetView';
// Lazy load heavy components
const KanbanBoard = React.lazy(() => import('./components/KanbanBoard').then(m => ({ default: m.KanbanBoard })));
const TaskList = React.lazy(() => import('./components/TaskList').then(m => ({ default: m.TaskList })));
const CalendarView = React.lazy(() => import('./components/CalendarView').then(m => ({ default: m.CalendarView })));
const NotesView = React.lazy(() => import('./components/NotesView').then(m => ({ default: m.NotesView })));
const AnalyticsView = React.lazy(() => import('./components/AnalyticsView').then(m => ({ default: m.AnalyticsView })));
const AutomationView = React.lazy(() => import('./components/AutomationView').then(m => ({ default: m.AutomationView })));
const ChatAssistant = React.lazy(() => import('./components/ChatAssistant').then(m => ({ default: m.ChatAssistant })));
const SettingsView = React.lazy(() => import('./components/SettingsView').then(m => ({ default: m.SettingsView })));

import { TaskModal } from './components/TaskModal';
import { Skeleton } from './components/Skeleton';
import { CommandPalette } from './components/CommandPalette';
import { PomodoroTimer } from './components/PomodoroTimer'; // Import Timer
import { StorageService } from './services/storageService';
import { SyncService } from './services/syncService';
import { AuthService } from './services/authService';
import { NotificationService } from './services/notificationService';
import { AutomationService } from './services/automationService';
import { CopilotService } from './services/copilotService';
import { DeveloperApiService } from './services/developerApiService';
import { MonitoringService } from './services/monitoringService'; // Monitoring
import { Task, Note, AppState, ViewMode, TaskStatus, User, AppSettings, Goal, AutomationRule, ProjectTemplate } from './types';
import { appStore } from './lib/store';

// Test Runner Imports
import { runner } from './lib/testRunner';
import { registerTests } from './tests/app.test';

// Page-level Skeleton
const PageSkeleton = () => (
  <div className="p-4 space-y-6">
    <div className="flex justify-between">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-8 w-24" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Skeleton className="h-[500px]" />
      <Skeleton className="h-[500px]" />
      <Skeleton className="h-[500px]" />
    </div>
  </div>
);

const App: React.FC = () => {
  // Use state only for triggering re-renders from store
  const [state, setState] = useState<AppState>(appStore.getState());
  
  const [viewMode, setViewMode] = useState<ViewMode>('tasks'); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [briefing, setBriefing] = useState<string | null>(null);
  
  // UI State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  
  // Test State
  const [testResults, setTestResults] = useState<any>(null);
  
  // Modal Prefills
  const [initialModalStatus, setInitialModalStatus] = useState<TaskStatus>('backlog');
  const [initialModalDate, setInitialModalDate] = useState<number | undefined>(undefined);
  const [prefillTaskData, setPrefillTaskData] = useState<{title: string, description: string} | null>(null);

  // Undo Stack (Last deleted ID)
  const lastDeletedTask = useRef<Task | null>(null);

  const syncTimeoutRef = useRef<number | null>(null);

  // Subscribe to store updates
  useEffect(() => {
    const unsubscribe = appStore.subscribe((newState) => {
      setState(newState);
    });
    return unsubscribe;
  }, []);

  // --- Global Listeners (Cmd+K, Shake) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCmdPaletteOpen(prev => !prev);
      }
    };
    
    // Shake Detection
    let lastX = 0, lastY = 0, lastZ = 0;
    let lastUpdate = 0;
    const SHAKE_THRESHOLD = 15;

    const handleDeviceMotion = (e: DeviceMotionEvent) => {
       const curTime = Date.now();
       if ((curTime - lastUpdate) > 100) {
         const diffTime = curTime - lastUpdate;
         lastUpdate = curTime;
         
         const x = e.accelerationIncludingGravity?.x || 0;
         const y = e.accelerationIncludingGravity?.y || 0;
         const z = e.accelerationIncludingGravity?.z || 0;
         
         const speed = Math.abs(x + y + z - lastX - lastY - lastZ) / diffTime * 10000;
         
         if (speed > SHAKE_THRESHOLD) {
            handleUndo();
         }
         
         lastX = x; lastY = y; lastZ = z;
       }
    };

    window.addEventListener('keydown', handleKeyDown);
    if (window.DeviceMotionEvent) {
       window.addEventListener('devicemotion', handleDeviceMotion, false);
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('devicemotion', handleDeviceMotion);
    };
  }, []);

  const handleUndo = async () => {
    if (lastDeletedTask.current) {
       if (confirm(`Вернуть удаленную задачу "${lastDeletedTask.current.title}"?`)) {
          const t = lastDeletedTask.current;
          await StorageService.addTask(t);
          appStore.addTask(t);
          lastDeletedTask.current = null;
          if (navigator.vibrate) navigator.vibrate(50);
       }
    }
  };

  // --- Initialization & Theme ---

  useEffect(() => {
    if (state.settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.settings.theme]);

  const loadData = async () => {
    const measure = MonitoringService.startTransaction('app_load_data');
    const tasks = await StorageService.getTasks();
    const notes = await StorageService.getNotes();
    const goals = await StorageService.getGoals();
    const automations = await StorageService.getAutomations();
    const templates = await StorageService.getTemplates();
    const memory = await StorageService.getMemory();
    
    const newRecurringTasks = await AutomationService.checkRecurringTasks(tasks);
    let finalTasks = tasks;
    if (newRecurringTasks.length > 0) {
      finalTasks = [...tasks, ...newRecurringTasks];
    }
    
    finalTasks = finalTasks.map(t => ({
      ...t,
      status: t.status || (t.completed ? 'done' : 'backlog'),
      tags: t.tags || [],
      order: t.order || 0,
      eventType: t.eventType || 'task',
      color: t.color || '#3b82f6',
      recurrence: t.recurrence || 'none'
    }));
    measure.finish();
    return { tasks: finalTasks, notes, goals, automations, templates, memory };
  };

  useEffect(() => {
    const initApp = async () => {
      const params = new URLSearchParams(window.location.search);
      const shareTitle = params.get('title');
      const shareText = params.get('text');
      const shareUrl = params.get('url');
      const action = params.get('action');
      const mode = params.get('mode');

      // Check for Test Mode
      if (mode === 'test') {
        registerTests();
        const results = await runner.run();
        setTestResults(results);
      }

      if (shareTitle || shareText || shareUrl) {
         setPrefillTaskData({
           title: shareTitle || 'Shared Item',
           description: `${shareText || ''} ${shareUrl || ''}`.trim()
         });
         setIsModalOpen(true);
         if (mode !== 'widget' && mode !== 'test') window.history.replaceState(null, '', window.location.pathname);
      } else if (action === 'new_task') {
        setIsModalOpen(true);
      } else if (action === 'briefing') {
         // handled below
      }

      const authResult = AuthService.handleCallback();
      let token = authResult?.token || AuthService.getToken();
      
      await StorageService.init();
      DeveloperApiService.init();
      
      const loadedData = await loadData();

      let user: User | null = null;
      if (token) {
        user = await AuthService.fetchUserProfile(token);
        if (!user) {
           AuthService.logout();
           token = null;
        }
      }

      const loadedState = { 
        ...loadedData, 
        user, 
        settings: state.settings, 
        isLoading: false 
      };

      appStore.setState(loadedState);
      NotificationService.requestPermission();

      if (token && user) {
        await performInitialSync(token, user.provider, loadedState);
      }

      if (loadedState.settings.openRouterApiKey && (action === 'briefing' || !action) && mode !== 'widget' && mode !== 'test') {
         CopilotService.generateMorningBriefing(loadedState).then(res => {
           if (res) setBriefing(res);
         });
      }
    };

    initApp();
  }, []);

  const refreshData = async () => {
    setIsSyncing(true);
    const data = await loadData();
    appStore.setState(data);
    setIsSyncing(false);
  };

  // --- Sync Logic ---

  const performInitialSync = async (token: string, provider: any, localState: AppState) => {
    setIsSyncing(true);
    try {
      const cloudResult = await SyncService.download(token, provider);
      
      if (cloudResult.data) {
        const localTime = localState.lastSynced || 0;
        const cloudTime = cloudResult.updatedAt;

        if (cloudTime > localTime + 60000) {
           const confirmOverwrite = true; 

           if (confirmOverwrite) {
             const newData = cloudResult.data;
             await Promise.all(localState.tasks.map(t => StorageService.deleteTask(t.id)));
             await Promise.all(newData.tasks.map(t => StorageService.addTask(t)));
             await Promise.all(localState.notes.map(n => StorageService.deleteNote(n.id)));
             await Promise.all(newData.notes.map(n => StorageService.addNote(n)));
             await Promise.all(localState.goals.map(g => StorageService.deleteGoal(g.id)));
             if (newData.goals) await Promise.all(newData.goals.map(g => StorageService.addGoal(g)));
             if (newData.automations) await Promise.all(newData.automations.map(a => StorageService.addAutomation(a)));
             if (newData.templates) await Promise.all(newData.templates.map(t => StorageService.addTemplate(t)));
             if (newData.memory) await Promise.all(newData.memory.map(m => StorageService.setMemory(m.key, m.value)));

             appStore.setState({ 
               tasks: newData.tasks, 
               notes: newData.notes,
               goals: newData.goals || [],
               automations: newData.automations || [],
               templates: newData.templates || [],
               memory: newData.memory || [],
               settings: newData.settings || { theme: 'dark' }, 
               lastSynced: Date.now() 
             });
           }
        } else if (cloudResult.data.settings) {
            appStore.setState(prev => ({ settings: { ...prev.settings, ...cloudResult.data?.settings } }));
        }
      }
    } catch (e) {
      console.error("Initial Sync Failed", e);
      MonitoringService.captureException(e, { context: 'Initial Sync' });
    } finally {
      setIsSyncing(false);
    }
  };

  const triggerCloudSync = useCallback((newState: AppState) => {
    if (!newState.user || !AuthService.getToken()) return;

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    setIsSyncing(true);
    syncTimeoutRef.current = window.setTimeout(async () => {
      try {
        const token = AuthService.getToken();
        if (token && newState.user) {
          await SyncService.upload(newState, token, newState.user.provider);
          appStore.setState({ lastSynced: Date.now() });
        }
      } catch (e) {
        console.error("Auto-sync failed", e);
        MonitoringService.captureException(e, { context: 'Auto Sync' });
      } finally {
        setIsSyncing(false);
      }
    }, 2000);
  }, []);

  // Monitor state changes for sync
  useEffect(() => {
    if (!state.isLoading && state.user) {
       triggerCloudSync(state);
    }
  }, [state.tasks, state.notes, state.goals, state.settings]);


  // --- Handlers ---

  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    appStore.setState(prev => ({ settings: { ...prev.settings, ...newSettings } }));
  };

  const handleUpdateGoals = (newGoals: Goal[]) => {
    appStore.setState({ goals: newGoals });
  };

  const handleUpdateAutomations = (rules: AutomationRule[]) => {
      appStore.setState({ automations: rules });
  };

  const handleUpdateTemplates = (tpls: ProjectTemplate[]) => {
      appStore.setState({ templates: tpls });
  };

  const handleSaveTask = async (taskData: Partial<Task>) => {
    const transaction = MonitoringService.startTransaction('save_task');
    try {
        if (editingTask) {
          const oldTask = state.tasks.find(t => t.id === editingTask.id) || null;
          let updatedTask = { ...editingTask, ...taskData, updatedAt: Date.now() };
          updatedTask = await AutomationService.evaluateRules(updatedTask as Task, oldTask, state.automations);

          await StorageService.updateTask(updatedTask.id, updatedTask);
          appStore.updateTask(updatedTask);
        } else {
          let newTask: Task = {
            id: crypto.randomUUID(),
            title: taskData.title || 'Untitled',
            description: taskData.description,
            status: taskData.status || 'backlog',
            tags: taskData.tags || [],
            assignee: taskData.assignee,
            deadline: taskData.deadline,
            startTime: taskData.startTime,
            endTime: taskData.endTime,
            eventType: taskData.eventType,
            color: taskData.color,
            reminderTime: taskData.reminderTime,
            reminderFired: false,
            completed: taskData.status === 'done',
            recurrence: taskData.recurrence || 'none',
            timeLogs: taskData.timeLogs,
            order: Date.now(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            estimatedDuration: taskData.estimatedDuration || 0,
            dependencies: taskData.dependencies || []
          };
          
          newTask = await AutomationService.evaluateRules(newTask, null, state.automations);
          await StorageService.addTask(newTask);
          appStore.addTask(newTask);
        }
    } finally {
        transaction.finish();
    }
  };
  
  const handleMoveTask = useCallback(async (taskId: string, newStatus: TaskStatus) => {
    const task = appStore.getState().tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;

    let updatedTask = { 
      ...task, 
      status: newStatus, 
      completed: newStatus === 'done',
      updatedAt: Date.now() 
    };

    updatedTask = await AutomationService.evaluateRules(updatedTask, task, appStore.getState().automations);
    
    await StorageService.updateTask(taskId, updatedTask);
    appStore.updateTask(updatedTask);
  }, []);

  const handleDeleteTask = useCallback(async (id: string) => {
    const task = state.tasks.find(t => t.id === id);
    if (task) lastDeletedTask.current = task; // Save for Undo
    
    await StorageService.deleteTask(id);
    appStore.deleteTask(id);
    setIsModalOpen(false);
  }, [state.tasks]);

  const handleSaveNote = async (note: Partial<Note>) => {
     const existingIndex = state.notes.findIndex(n => n.id === note.id);
     if (existingIndex >= 0) {
       const updatedNote = { ...state.notes[existingIndex], ...note, updatedAt: Date.now() };
       await StorageService.updateNote(note.id!, updatedNote);
       appStore.setState(prev => ({
         notes: prev.notes.map(n => n.id === note.id ? updatedNote : n)
       }));
     } else {
       const newNote = note as Note; 
       await StorageService.addNote(newNote);
       appStore.setState(prev => ({
         notes: [newNote, ...prev.notes]
       }));
     }
  };

  const handleDeleteNote = async (id: string) => {
    await StorageService.deleteNote(id);
    appStore.setState(prev => ({
      notes: prev.notes.filter(n => n.id !== id)
    }));
  };

  const handleImportData = async (data: AppState, merge: boolean) => {
    if (!merge) {
      await Promise.all(state.tasks.map(t => StorageService.deleteTask(t.id)));
      await Promise.all(state.notes.map(n => StorageService.deleteNote(n.id)));
    }
    
    if (data.tasks) await Promise.all(data.tasks.map(t => StorageService.addTask(t)));
    if (data.notes) await Promise.all(data.notes.map(n => StorageService.addNote(n)));
    if (data.goals) await Promise.all(data.goals.map(g => StorageService.addGoal(g)));
    
    await refreshData();
  };

  const handleClearData = async () => {
    const dbs = await window.indexedDB.databases();
    dbs.forEach(db => window.indexedDB.deleteDatabase(db.name!));
    appStore.setState({
      tasks: [], notes: [], goals: [], automations: [], templates: [], memory: [],
      user: null, settings: { theme: 'dark' }, isLoading: false
    });
  };

  const handleLogout = () => {
    AuthService.logout();
    appStore.setUser(null);
  };

  const handleUpdateTaskLog = async (taskId: string, start: number, end: number) => {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const newLogs = [...(task.timeLogs || []), { start, end }];
    const updatedTask = { ...task, timeLogs: newLogs };
    await StorageService.updateTask(taskId, updatedTask);
    appStore.updateTask(updatedTask);
  };

  if (state.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Skeleton className="h-12 w-12 rounded-full" />
      </div>
    );
  }

  // Check for Widget Mode
  const isWidgetMode = new URLSearchParams(window.location.search).get('mode') === 'widget';
  if (isWidgetMode) {
    return <WidgetView appState={state} onToggleTask={(id, c) => handleMoveTask(id, c ? 'done' : 'in-progress')} />;
  }

  return (
    <>
      {/* Test Runner Overlay */}
      {testResults && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-bg-surface w-full max-w-2xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center bg-bg-panel">
              <h2 className="text-lg font-bold">QA Test Suite Results</h2>
              <button onClick={() => setTestResults(null)} className="text-text-muted hover:text-text-main">✕</button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 font-mono text-sm">
              <div className="mb-4 flex gap-4">
                <span className="text-green-500 font-bold">✔ Passed: {testResults.totalPass}</span>
                <span className="text-red-500 font-bold">✘ Failed: {testResults.totalFail}</span>
                <span className="text-text-muted">Time: {testResults.totalTime.toFixed(0)}ms</span>
              </div>
              {testResults.results.map((suite: any, i: number) => (
                <div key={i} className="mb-4">
                  <h3 className="font-bold border-b border-border/50 mb-2 pb-1 text-primary">{suite.name}</h3>
                  <ul className="space-y-1">
                    {suite.tests.map((t: any, j: number) => (
                      <li key={j} className={t.status === 'pass' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {t.status === 'pass' ? '✔' : '✘'} {t.name} <span className="text-text-disabled opacity-50">({t.duration.toFixed(1)}ms)</span>
                        {t.error && <div className="ml-4 text-xs opacity-75">{t.error}</div>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <Layout 
        viewMode={viewMode} 
        setViewMode={setViewMode}
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        user={state.user}
        isSyncing={isSyncing}
        lastSynced={state.lastSynced}
        onNewTask={() => {
           setEditingTask(null);
           setIsModalOpen(true);
        }}
        onRefresh={refreshData}
        onLogout={handleLogout}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
      >
        {briefing && (
          <div className="mb-6 mx-auto max-w-4xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4 rounded-xl shadow-lg relative animate-in fade-in slide-in-from-top-4">
            <h3 className="font-bold text-lg mb-1">☀️ Morning Briefing</h3>
            <p className="whitespace-pre-wrap text-indigo-50 text-sm">{briefing}</p>
            <button 
              onClick={() => setBriefing(null)} 
              className="absolute top-2 right-2 text-white/70 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}
        
        <CommandPalette 
          isOpen={isCmdPaletteOpen}
          onClose={() => setIsCmdPaletteOpen(false)}
          tasks={state.tasks}
          notes={state.notes}
          onNavigate={(mode) => setViewMode(mode)}
          onSelectTask={(task) => { setEditingTask(task); setIsModalOpen(true); }}
          onSelectNote={(note) => { setViewMode('notes'); /* logic to select note */ }}
          toggleTheme={() => handleUpdateSettings({ theme: state.settings.theme === 'dark' ? 'light' : 'dark' })}
        />

        <Suspense fallback={<PageSkeleton />}>
          {viewMode === 'tasks' && (
             <TaskList 
               tasks={state.tasks} 
               onAdd={async (t) => handleSaveTask({title: t, status: 'backlog'})} 
               onToggle={(id, c) => handleMoveTask(id, c ? 'done' : 'in-progress')}
               onDelete={handleDeleteTask}
             />
          )}

          {viewMode === 'board' && (
            <div className="h-full">
              <KanbanBoard 
                tasks={state.tasks} 
                onTaskClick={(t) => { setEditingTask(t); setIsModalOpen(true); }}
                onMoveTask={handleMoveTask}
                onAddClick={(s) => { setInitialModalStatus(s); setIsModalOpen(true); }}
              />
            </div>
          )}

          {viewMode === 'calendar' && (
            <div className="h-full">
              <CalendarView 
                tasks={state.tasks}
                onTaskClick={(t) => { setEditingTask(t); setIsModalOpen(true); }}
                onDateClick={(date) => { setInitialModalDate(date); setIsModalOpen(true); }}
              />
            </div>
          )}
          
          {viewMode === 'notes' && (
            <div className="h-full">
              <NotesView 
                notes={state.notes}
                onSaveNote={handleSaveNote}
                onDeleteNote={handleDeleteNote}
                onCreateTask={(t, d) => {
                  setEditingTask(null);
                  setPrefillTaskData({ title: t, description: d || '' });
                  setIsModalOpen(true);
                }}
                openRouterApiKey={state.settings.openRouterApiKey}
                aiModel={state.settings.aiModel}
              />
            </div>
          )}

          {viewMode === 'analytics' && (
            <AnalyticsView 
              appState={state}
              onUpdateGoals={handleUpdateGoals}
            />
          )}

          {viewMode === 'automation' && (
             <AutomationView 
               appState={state}
               onUpdateAutomations={handleUpdateAutomations}
               onUpdateTemplates={handleUpdateTemplates}
               onRefresh={refreshData}
             />
          )}
          
          {viewMode === 'settings' && (
            <SettingsView 
              user={state.user}
              settings={state.settings}
              appState={state}
              lastSynced={state.lastSynced}
              onUpdateSettings={handleUpdateSettings}
              onImportData={handleImportData}
              onClearData={handleClearData}
              onLogout={handleLogout}
            />
          )}
        </Suspense>
      </Layout>

      <PomodoroTimer 
        activeTask={editingTask} // Ideally allow picking any task, but for now linking to edited or let user pick via other UI
        onUpdateTaskLog={handleUpdateTaskLog}
      />

      <TaskModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTask}
        initialStatus={initialModalStatus}
        initialDate={initialModalDate}
        taskToEdit={editingTask}
        initialData={prefillTaskData}
        openRouterApiKey={state.settings.openRouterApiKey}
        aiModel={state.settings.aiModel}
      />

      <Suspense fallback={null}>
        <ChatAssistant 
          appState={state}
          isOpen={isChatOpen}
          onToggle={() => setIsChatOpen(!isChatOpen)}
          onUpdateSettings={(key, tone, voice) => handleUpdateSettings({ openRouterApiKey: key, assistantTone: tone, voiceEnabled: voice })}
          onAddTask={async (t) => {
            const nt: any = { ...t, id: crypto.randomUUID(), createdAt: Date.now(), updatedAt: Date.now(), tags: [], eventType: 'task', color: '#3b82f6', completed: false, order: Date.now() };
            const processed = await AutomationService.evaluateRules(nt, null, state.automations);
            await StorageService.addTask(processed);
            appStore.addTask(processed);
          }}
          onUpdateTask={async (id, u) => {
            await StorageService.updateTask(id, u);
            appStore.updateTask({ ...state.tasks.find(t => t.id === id)!, ...u });
          }}
          onAddNote={handleSaveNote}
        />
      </Suspense>
    </>
  );
};

export default App;
