
import React, { useState, useEffect } from 'react';
import { AppSettings, User, AppState, BackupSnapshot, WorkSchedule, GlobalEvent } from '../types';
import { AuthService } from '../services/authService';
import { StorageService } from '../services/storageService';
import { SyncService } from '../services/syncService';
import { ExportService } from '../services/exportService';
import { AVAILABLE_MODELS } from '../services/aiService';
import { LocalAiService } from '../services/localAiService';
import { DeveloperApiService } from '../services/developerApiService';
import { appStore } from '../lib/store';

interface SettingsViewProps {
  user: User | null;
  settings: AppSettings;
  appState: AppState;
  lastSynced?: number;
  onUpdateSettings: (settings: Partial<AppSettings>) => void;
  onImportData: (data: AppState, merge: boolean) => void;
  onClearData: () => void;
  onLogout?: () => void;
}

const WEEK_DAYS = [
    { label: 'Пн', val: 1 },
    { label: 'Вт', val: 2 },
    { label: 'Ср', val: 3 },
    { label: 'Чт', val: 4 },
    { label: 'Пт', val: 5 },
    { label: 'Сб', val: 6 },
    { label: 'Вс', val: 0 },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  settings,
  appState,
  lastSynced,
  onUpdateSettings,
  onImportData,
  onClearData,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'schedule' | 'sync' | 'backup' | 'ai' | 'dev'>('general');
  const [backups, setBackups] = useState<BackupSnapshot[]>([]);
  const [encryptionPwd, setEncryptionPwd] = useState(settings.encryptionPassword || '');
  const [githubToken, setGithubToken] = useState(settings.githubToken || '');
  
  // Sync State
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<string | null>(null);

  // Local AI State
  const [downloadProgress, setDownloadProgress] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);

  // Schedule State
  const [scheduleConfig, setScheduleConfig] = useState<WorkSchedule>(settings.workSchedule || { type: 'standard', workDays: [1,2,3,4,5] });
  const [newEvent, setNewEvent] = useState<{title: string, date: string, type: string, recurring: boolean}>({
      title: '', date: '', type: 'holiday', recurring: false
  });

  useEffect(() => {
    if (activeTab === 'backup') {
      StorageService.getBackups().then(setBackups);
    }
    if (activeTab === 'dev') {
      DeveloperApiService.init();
    }
  }, [activeTab]);

  const handleCreateBackup = async () => {
    await StorageService.createBackup(appState, 'Manual Backup');
    const bks = await StorageService.getBackups();
    setBackups(bks);
  };

  const handleRestoreBackup = async (id: string) => {
    if (confirm('Восстановить? Текущие данные будут перезаписаны.')) {
      const bk = await StorageService.restoreBackup(id);
      if (bk && bk.data) {
        onImportData(bk.data, false);
        alert('Восстановлено!');
      }
    }
  };

  // --- Manual Sync Handlers ---

  const handleManualCloudSave = async () => {
      const token = AuthService.getToken();
      const provider = AuthService.getProvider();
      
      if (!token || !user) {
          alert('Сначала войдите в аккаунт');
          return;
      }
      
      setIsCloudLoading(true);
      setCloudStatus('Сохранение...');
      try {
          await SyncService.upload(appState, token, provider || 'google');
          setCloudStatus('Успешно сохранено ✅');
          appStore.setState({ lastSynced: Date.now() });
          setTimeout(() => setCloudStatus(null), 3000);
      } catch (e) {
          console.error(e);
          setCloudStatus('Ошибка сохранения ❌');
          alert('Ошибка при сохранении в облако');
      } finally {
          setIsCloudLoading(false);
      }
  };

  const handleManualCloudLoad = async () => {
      const token = AuthService.getToken();
      const provider = AuthService.getProvider();
      
      if (!token || !user) {
          alert('Сначала войдите в аккаунт');
          return;
      }

      setIsCloudLoading(true);
      setCloudStatus('Загрузка...');
      try {
          const result = await SyncService.download(token, provider || 'google', settings.encryptionPassword);
          if (result.data) {
              if (confirm('Это перезапишет текущие данные данными из облака. Продолжить?')) {
                  onImportData(result.data, false);
                  setCloudStatus('Данные загружены ✅');
              } else {
                  setCloudStatus('Отменено');
              }
          } else {
              setCloudStatus('Файл в облаке не найден');
          }
          setTimeout(() => setCloudStatus(null), 3000);
      } catch (e) {
          console.error(e);
          setCloudStatus('Ошибка загрузки ❌');
          alert('Ошибка загрузки. Если используете шифрование, проверьте пароль.');
      } finally {
          setIsCloudLoading(false);
      }
  };

  const saveSecuritySettings = () => {
    onUpdateSettings({ 
      encryptionPassword: encryptionPwd,
      githubToken: githubToken
    });
    alert('Настройки безопасности сохранены');
  };

  const saveSchedule = () => {
      onUpdateSettings({ workSchedule: scheduleConfig });
      alert('Расписание сохранено');
  };

  const handleAddGlobalEvent = async () => {
      if (!newEvent.title || !newEvent.date) return;
      const event: GlobalEvent = {
          id: crypto.randomUUID(),
          title: newEvent.title,
          date: new Date(newEvent.date).getTime(),
          type: newEvent.type as any,
          isRecurringYearly: newEvent.recurring
      };
      await StorageService.addGlobalEvent(event);
      appStore.addGlobalEvent(event);
      setNewEvent({ title: '', date: '', type: 'holiday', recurring: false });
  };

  const handleDeleteGlobalEvent = async (id: string) => {
      await StorageService.deleteGlobalEvent(id);
      appStore.deleteGlobalEvent(id);
  };

  const initLocalModel = async () => {
    if (!LocalAiService.isSupported()) {
      alert("Ваш браузер не поддерживает WebGPU.");
      return;
    }
    setIsDownloading(true);
    setDownloadProgress('Starting...');
    try {
      await LocalAiService.init(LocalAiService.DEFAULT_LOCAL_MODEL, (text) => {
         setDownloadProgress(text);
      });
      alert("Локальная модель загружена и готова к работе!");
      onUpdateSettings({ aiModel: 'local' });
    } catch (e) {
      alert("Ошибка загрузки модели.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto min-h-screen pb-20">
      <h2 className="text-3xl font-bold text-text-main mb-6">Настройки</h2>
      
      <div className="flex gap-4 mb-8 overflow-x-auto pb-2 border-b border-border no-scrollbar">
        <button onClick={() => setActiveTab('general')} className={`pb-2 px-2 whitespace-nowrap ${activeTab === 'general' ? 'border-b-2 border-primary font-bold text-primary' : 'text-text-muted'}`}>Общие</button>
        <button onClick={() => setActiveTab('schedule')} className={`pb-2 px-2 whitespace-nowrap ${activeTab === 'schedule' ? 'border-b-2 border-primary font-bold text-primary' : 'text-text-muted'}`}>Расписание и События</button>
        <button onClick={() => setActiveTab('ai')} className={`pb-2 px-2 whitespace-nowrap ${activeTab === 'ai' ? 'border-b-2 border-primary font-bold text-primary' : 'text-text-muted'}`}>AI</button>
        <button onClick={() => setActiveTab('sync')} className={`pb-2 px-2 whitespace-nowrap ${activeTab === 'sync' ? 'border-b-2 border-primary font-bold text-primary' : 'text-text-muted'}`}>Синхронизация</button>
        <button onClick={() => setActiveTab('backup')} className={`pb-2 px-2 whitespace-nowrap ${activeTab === 'backup' ? 'border-b-2 border-primary font-bold text-primary' : 'text-text-muted'}`}>Бэкап</button>
        <button onClick={() => setActiveTab('dev')} className={`pb-2 px-2 whitespace-nowrap ${activeTab === 'dev' ? 'border-b-2 border-primary font-bold text-primary' : 'text-text-muted'}`}>Dev</button>
      </div>

      {activeTab === 'general' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Account */}
          <section className="card p-6">
            <h3 className="text-lg font-semibold mb-4 text-text-main">Аккаунт</h3>
            {user ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {user.avatar && <img src={user.avatar} className="w-12 h-12 rounded-full border border-border" alt="avatar" />}
                  <div>
                    <p className="font-medium text-lg">{user.name}</p>
                    <p className="text-sm text-text-muted">{user.email || user.provider}</p>
                    {user.provider === 'local' && <span className="text-xs bg-gray-200 text-gray-700 px-2 rounded">Локальный профиль</span>}
                  </div>
                </div>
                <button onClick={onLogout} className="btn-secondary text-error border-error/30 hover:bg-error/5">
                  Выйти
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                 <button onClick={() => AuthService.login('google')} className="btn-primary w-full justify-center opacity-70">
                   Войти через Google Drive
                 </button>
                 <button onClick={() => AuthService.login('local')} className="btn-secondary w-full justify-center">
                   Войти как Гость (Локально)
                 </button>
              </div>
            )}
          </section>

          {/* Appearance */}
          <section className="card p-6">
            <h3 className="text-lg font-semibold mb-4 text-text-main">Внешний вид</h3>
            <div className="flex items-center justify-between">
              <label className="text-text-main font-medium">Тема</label>
              <div className="flex bg-bg-panel p-1 rounded-lg border border-border">
                <button 
                  onClick={() => onUpdateSettings({ theme: 'light' })}
                  className={`px-4 py-1.5 rounded-[4px] text-sm font-medium transition ${settings.theme !== 'dark' ? 'bg-bg-surface shadow-sm text-text-main' : 'text-text-muted'}`}
                >
                  Светлая
                </button>
                <button 
                  onClick={() => onUpdateSettings({ theme: 'dark' })}
                  className={`px-4 py-1.5 rounded-[4px] text-sm font-medium transition ${settings.theme === 'dark' ? 'bg-bg-surface shadow-sm text-text-main' : 'text-text-muted'}`}
                >
                  Темная
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'schedule' && (
          <div className="space-y-6 animate-in fade-in">
              <section className="card p-6">
                  <h3 className="text-lg font-semibold mb-4">Рабочий график</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-medium text-text-muted mb-2">Тип графика</label>
                          <select 
                            value={scheduleConfig.type} 
                            onChange={(e) => setScheduleConfig({...scheduleConfig, type: e.target.value as any})}
                            className="input-field"
                          >
                              <option value="standard">Стандартный (по дням недели)</option>
                              <option value="shift">Сменный (2/2, 3/3 и т.д.)</option>
                          </select>
                      </div>

                      {scheduleConfig.type === 'standard' && (
                          <div>
                              <label className="block text-sm font-medium text-text-muted mb-2">Рабочие дни</label>
                              <div className="flex gap-2 flex-wrap">
                                  {WEEK_DAYS.map(({ label, val }) => (
                                      <button 
                                        key={val}
                                        onClick={() => {
                                            const current = scheduleConfig.workDays || [];
                                            const newDays = current.includes(val) ? current.filter(d => d !== val) : [...current, val];
                                            setScheduleConfig({...scheduleConfig, workDays: newDays});
                                        }}
                                        className={`w-10 h-10 rounded-full border ${scheduleConfig.workDays?.includes(val) ? 'bg-primary text-white border-primary' : 'bg-bg-surface border-border'}`}
                                      >
                                          {label}
                                      </button>
                                  ))}
                              </div>
                          </div>
                      )}

                      {scheduleConfig.type === 'shift' && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                  <label className="block text-sm font-medium text-text-muted">Рабочих дней</label>
                                  <input 
                                    type="number" 
                                    value={scheduleConfig.shiftConfig?.workCount || 2}
                                    onChange={e => setScheduleConfig({
                                        ...scheduleConfig, 
                                        shiftConfig: { 
                                            ...scheduleConfig.shiftConfig || {startDate: Date.now(), offCount: 2, workCount: 2}, 
                                            workCount: parseInt(e.target.value) 
                                        }
                                    })}
                                    className="input-field"
                                  />
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-text-muted">Выходных дней</label>
                                  <input 
                                    type="number" 
                                    value={scheduleConfig.shiftConfig?.offCount || 2}
                                    onChange={e => setScheduleConfig({
                                        ...scheduleConfig, 
                                        shiftConfig: { 
                                            ...scheduleConfig.shiftConfig || {startDate: Date.now(), offCount: 2, workCount: 2}, 
                                            offCount: parseInt(e.target.value) 
                                        }
                                    })}
                                    className="input-field"
                                  />
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-text-muted">Дата начала первой смены</label>
                                  <input 
                                    type="date" 
                                    value={scheduleConfig.shiftConfig?.startDate ? new Date(scheduleConfig.shiftConfig.startDate).toISOString().split('T')[0] : ''}
                                    onChange={e => setScheduleConfig({
                                        ...scheduleConfig, 
                                        shiftConfig: { 
                                            ...scheduleConfig.shiftConfig || {startDate: Date.now(), offCount: 2, workCount: 2}, 
                                            startDate: new Date(e.target.value).getTime() 
                                        }
                                    })}
                                    className="input-field"
                                  />
                              </div>
                          </div>
                      )}
                      
                      <button onClick={saveSchedule} className="btn-primary">Сохранить график</button>
                  </div>
              </section>

              <section className="card p-6">
                  <h3 className="text-lg font-semibold mb-4">Глобальные события (Праздники, Отпуск)</h3>
                  
                  {/* List */}
                  <div className="space-y-2 mb-6 max-h-60 overflow-y-auto">
                      {appState.globalEvents.map(event => (
                          <div key={event.id} className="flex justify-between items-center p-3 bg-bg-panel rounded-lg">
                              <div>
                                  <span className="font-medium mr-2">{event.title}</span>
                                  <span className="text-xs px-2 py-0.5 rounded bg-bg-surface text-text-muted border border-border">
                                      {new Date(event.date).toLocaleDateString()} {event.isRecurringYearly ? '(Ежегодно)' : ''}
                                  </span>
                              </div>
                              <button onClick={() => handleDeleteGlobalEvent(event.id)} className="text-error hover:underline text-sm">Удалить</button>
                          </div>
                      ))}
                      {appState.globalEvents.length === 0 && <p className="text-text-muted text-sm">Список пуст.</p>}
                  </div>

                  {/* Add Form */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end bg-bg-panel p-4 rounded-lg">
                      <div className="md:col-span-1">
                          <label className="text-xs mb-1 block">Название</label>
                          <input type="text" value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} className="input-field h-9 text-sm" placeholder="День рождения..." />
                      </div>
                      <div>
                          <label className="text-xs mb-1 block">Дата</label>
                          <input type="date" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} className="input-field h-9 text-sm" />
                      </div>
                      <div>
                          <label className="text-xs mb-1 block">Тип</label>
                          <select value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value})} className="input-field h-9 text-sm">
                              <option value="holiday">Праздник</option>
                              <option value="birthday">День рождения</option>
                              <option value="vacation">Отпуск</option>
                              <option value="other">Другое</option>
                          </select>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                          <input type="checkbox" checked={newEvent.recurring} onChange={e => setNewEvent({...newEvent, recurring: e.target.checked})} id="recur" />
                          <label htmlFor="recur" className="text-sm cursor-pointer">Каждый год</label>
                      </div>
                      <div className="md:col-span-4 flex justify-end">
                          <button onClick={handleAddGlobalEvent} className="btn-secondary text-sm">Добавить событие</button>
                      </div>
                  </div>
              </section>
          </div>
      )}
      
      {activeTab === 'ai' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Cloud AI */}
          <section className="card p-6">
            <h3 className="text-lg font-semibold mb-4 text-text-main">Cloud Copilot (OpenRouter)</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-main mb-2">OpenRouter API Key</label>
                <input 
                  type="password"
                  value={settings.openRouterApiKey || ''}
                  onChange={(e) => onUpdateSettings({ openRouterApiKey: e.target.value })}
                  className="input-field font-mono text-sm"
                  placeholder="sk-or-..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-main mb-2">Активная модель</label>
                <select
                  value={settings.aiModel || 'deepseek/deepseek-r1-0528:free'}
                  onChange={(e) => onUpdateSettings({ aiModel: e.target.value })}
                  className="input-field"
                >
                  {AVAILABLE_MODELS.map(model => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>
          
          {/* Local AI */}
          <section className="card p-6 border-l-4 border-green-500">
             <div className="flex justify-between items-start mb-4">
               <div>
                  <h3 className="text-lg font-semibold text-text-main flex items-center gap-2">
                    🏠 Offline AI (WebGPU)
                    {settings.aiModel === 'local' && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Активно</span>}
                  </h3>
                  <p className="text-sm text-text-muted mt-1">
                    Запускает нейросеть прямо в браузере. Работает без интернета. Требует скачивания ~2-4 ГБ данных.
                  </p>
               </div>
             </div>

             {isDownloading && (
               <div className="bg-bg-panel p-3 rounded-lg mb-4 text-sm font-mono text-text-main">
                 {downloadProgress}
               </div>
             )}

             <div className="flex gap-3">
               <button 
                 onClick={initLocalModel}
                 disabled={isDownloading}
                 className="btn-primary"
               >
                 {isDownloading ? 'Загрузка...' : 'Загрузить и включить Local AI'}
               </button>
             </div>
          </section>
        </div>
      )}

      {activeTab === 'sync' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Google Drive Controls */}
          <section className="card p-6 border-l-4 border-blue-500">
             <div className="flex justify-between items-start mb-4">
                 <div>
                     <h3 className="text-lg font-semibold mb-1">Google Drive Синхронизация</h3>
                     <p className="text-sm text-text-muted">
                       Автоматическая синхронизация при входе и выходе.
                       {lastSynced && ` Посл. синхронизация: ${new Date(lastSynced).toLocaleTimeString()}`}
                     </p>
                 </div>
                 {cloudStatus && <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded animate-pulse">{cloudStatus}</span>}
             </div>
             
             <div className="flex gap-3 flex-wrap">
                 <button 
                   onClick={handleManualCloudSave} 
                   disabled={isCloudLoading || !user}
                   className="btn-primary gap-2"
                 >
                   ☁️ Выгрузить в облако (Save)
                 </button>
                 <button 
                   onClick={handleManualCloudLoad} 
                   disabled={isCloudLoading || !user}
                   className="btn-secondary gap-2"
                 >
                   📥 Загрузить из облака (Load)
                 </button>
             </div>
             {!user && <p className="text-xs text-error mt-2">Войдите через Google для использования.</p>}
          </section>

          <section className="card p-6 border-l-4 border-l-purple-500">
             <h3 className="text-lg font-semibold mb-2">Шифрование (E2EE)</h3>
             <p className="text-xs text-text-muted mb-3">Если задан пароль, данные шифруются перед отправкой в облако.</p>
             <div className="flex gap-2">
               <input 
                 type="password" 
                 value={encryptionPwd}
                 onChange={e => setEncryptionPwd(e.target.value)}
                 className="input-field" 
                 placeholder="Пароль шифрования"
               />
               <button onClick={saveSecuritySettings} className="btn-primary">Сохранить</button>
             </div>
          </section>

          <section className="card p-6">
            <h3 className="text-lg font-semibold mb-2">GitHub Gist Sync</h3>
            <div className="space-y-3">
              <input 
                 type="password" 
                 value={githubToken}
                 onChange={e => setGithubToken(e.target.value)}
                 className="input-field font-mono text-sm" 
                 placeholder="ghp_..."
               />
               <div className="flex justify-end">
                  <button onClick={saveSecuritySettings} className="btn-secondary">Сохранить Token</button>
               </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="space-y-6 animate-in fade-in">
           <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-text-muted">Локальные снимки состояния (IndexedDB)</p>
              <button onClick={handleCreateBackup} className="btn-primary text-sm">+ Создать сейчас</button>
           </div>
           
           <div className="space-y-3">
             {backups.length === 0 && <p className="text-center text-text-disabled py-4">Нет резервных копий</p>}
             {backups.map(bk => (
               <div key={bk.id} className="bg-bg-surface p-4 rounded-lg border border-border flex justify-between items-center">
                 <div>
                   <p className="font-bold text-text-main">{bk.label}</p>
                   <p className="text-xs text-text-muted">{new Date(bk.timestamp).toLocaleString()}</p>
                   <p className="text-xs text-text-disabled">Задач: {bk.data.tasks?.length || 0}</p>
                 </div>
                 <button 
                   onClick={() => handleRestoreBackup(bk.id)}
                   className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 text-sm font-medium"
                 >
                   Восстановить
                 </button>
               </div>
             ))}
           </div>
           
           <div className="pt-8 text-center">
             <button onClick={onClearData} className="text-error text-sm hover:underline">
               Сбросить все данные приложения
             </button>
           </div>
        </div>
      )}

      {activeTab === 'dev' && (
        <div className="space-y-6 animate-in fade-in">
          <section className="card p-6 border-l-4 border-l-yellow-400">
             <h3 className="text-lg font-semibold mb-2 text-text-main">Developer API</h3>
             <p className="text-sm text-text-muted mb-4">
               Приложение прослушивает <code>BroadcastChannel('task_assist_api')</code>.
               Внешние скрипты (расширения, букмарклеты) могут взаимодействовать с этим API.
             </p>
             <div className="bg-bg-panel p-3 rounded-lg font-mono text-xs overflow-x-auto text-text-main">
               // Пример добавления задачи через консоль<br/>
               const bc = new BroadcastChannel('task_assist_api');<br/>
               bc.postMessage({'{'} type: 'ADD_TASK', payload: {'{'} title: 'From Console' {'}'} {'}'});
             </div>
             <div className="mt-4">
               <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">API Active</span>
             </div>
          </section>

          <section className="card p-6">
            <h3 className="text-lg font-semibold mb-2 text-text-main">Deep Links (Protocol Handlers)</h3>
            <p className="text-sm text-text-muted mb-4">
              Используйте <code>web+taskassist://</code> для открытия приложения.
            </p>
            <div className="space-y-2">
               <a href="web+taskassist://?action=new_task" className="text-primary text-sm hover:underline block">Тест: Создать задачу (web+taskassist://?action=new_task)</a>
               <a href="/?mode=widget" target="_blank" className="text-primary text-sm hover:underline block">Тест: Режим виджета (/mode=widget)</a>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
