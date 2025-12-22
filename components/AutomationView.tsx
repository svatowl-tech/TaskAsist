
import React, { useState, useEffect } from 'react';
import { AppState, AutomationRule, ProjectTemplate, Task } from '../types';
import { StorageService } from '../services/storageService';
import { AutomationService } from '../services/automationService';

interface AutomationViewProps {
  appState: AppState;
  onUpdateAutomations: (rules: AutomationRule[]) => void;
  onUpdateTemplates: (templates: ProjectTemplate[]) => void;
  onRefresh?: () => void;
}

// ... (Project Templates Array kept same as before, simplified for this snippet to focus on Editor)
const DEFAULT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 't_software',
    name: '💻 Разработка ПО (Agile)',
    description: 'Базовый процесс для разработки новой фичи',
    tasks: [
      { title: 'Анализ требований и ТЗ', status: 'done', tags: ['dev', 'planning'] },
      { title: 'Реализация API', status: 'backlog', tags: ['backend'] },
      { title: 'Реализация UI', status: 'backlog', tags: ['frontend'] },
    ]
  },
  {
    id: 't_marketing',
    name: '🚀 Маркетинговая кампания',
    description: 'Чек-лист запуска рекламной кампании',
    tasks: [
      { title: 'Определить целевую аудиторию', status: 'in-progress', tags: ['marketing'] },
      { title: 'Подготовить креативы', status: 'backlog', tags: ['design'] },
    ]
  },
  {
    id: 't_geo',
    name: '🌍 Гео-напоминания',
    description: 'Шаблон правил для геолокации (требует настройки)',
    tasks: [],
    // This template doesn't create tasks, it's conceptually a ruleset starter
  }
];

export const AutomationView: React.FC<AutomationViewProps> = ({ 
  appState, 
  onUpdateAutomations,
  onUpdateTemplates,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState<'editor' | 'library'>('editor');
  
  // Editor State
  const [editingRule, setEditingRule] = useState<Partial<AutomationRule>>({
    name: 'Новое правило',
    isActive: true,
    trigger: { type: 'status_change', value: 'done' },
    action: { type: 'add_tag', value: '' }
  });
  
  // Simulation State
  const [simulationResult, setSimulationResult] = useState<Task[] | null>(null);

  const saveRule = async () => {
    if (!editingRule.name || !editingRule.action?.value) {
      alert("Заполните имя и действие");
      return;
    }

    const rule: AutomationRule = {
      id: editingRule.id || crypto.randomUUID(),
      name: editingRule.name!,
      isActive: editingRule.isActive !== false,
      trigger: editingRule.trigger as any,
      action: editingRule.action as any,
      lastRun: 0
    };

    if (editingRule.id) {
       // Update
       const updated = appState.automations.map(r => r.id === rule.id ? rule : r);
       onUpdateAutomations(updated);
       await StorageService.addAutomation(rule);
    } else {
       // Create
       onUpdateAutomations([...appState.automations, rule]);
       await StorageService.addAutomation(rule);
    }

    // Reset
    setEditingRule({
      name: 'Новое правило',
      isActive: true,
      trigger: { type: 'status_change', value: 'done' },
      action: { type: 'add_tag', value: '' }
    });
    setSimulationResult(null);
  };

  const deleteRule = async (id: string) => {
    if(confirm('Удалить правило?')) {
        await StorageService.deleteAutomation(id);
        onUpdateAutomations(appState.automations.filter(r => r.id !== id));
        if (editingRule.id === id) {
             setEditingRule({ name: 'Новое правило', isActive: true, trigger: { type: 'status_change', value: 'done' }, action: { type: 'add_tag', value: '' } });
        }
    }
  };

  const runSimulation = () => {
    // Construct temp rule object
    const ruleMock = {
        ...editingRule,
        id: 'temp',
        isActive: true,
    } as AutomationRule;

    const affected = AutomationService.simulateRule(ruleMock, appState.tasks);
    setSimulationResult(affected);
  };
  
  const handleApplyTemplate = async (template: ProjectTemplate) => {
    for (const t of template.tasks) {
      const newTask: any = {
        ...t,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: t.tags || [],
        completed: false,
        color: '#3b82f6',
        description: '',
        assignee: '',
        order: Date.now()
      };
      await StorageService.addTask(newTask);
    }
    if (onRefresh) onRefresh();
    alert(`Шаблон "${template.name}" применен!`);
  };

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden bg-bg-main">
      {/* LEFT: Rules List */}
      <div className="w-80 bg-bg-surface border-r border-border flex flex-col hidden lg:flex">
        <div className="p-4 border-b border-border">
          <h3 className="font-bold text-lg mb-2">Мои правила</h3>
          <button 
             onClick={() => {
                 setEditingRule({ name: 'Новое правило', isActive: true, trigger: { type: 'status_change', value: 'done' }, action: { type: 'add_tag', value: '' } });
                 setSimulationResult(null);
             }}
             className="w-full btn-secondary text-sm"
          >
            + Создать
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {appState.automations.map(rule => (
            <div 
              key={rule.id}
              onClick={() => { setEditingRule(rule); setSimulationResult(null); }}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${editingRule.id === rule.id ? 'bg-primary/10 border-primary' : 'bg-bg-panel border-transparent hover:border-border'}`}
            >
               <div className="flex justify-between items-center mb-1">
                 <span className="font-semibold text-sm truncate">{rule.name}</span>
                 <div className={`w-2 h-2 rounded-full ${rule.isActive ? 'bg-success' : 'bg-gray-300'}`}></div>
               </div>
               <div className="text-xs text-text-muted truncate">
                 {rule.trigger.type} ➜ {rule.action.type}
               </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: Visual Editor */}
      <div className="flex-1 flex flex-col bg-bg-main overflow-y-auto">
        <div className="p-4 border-b border-border bg-bg-surface flex justify-between items-center">
           <input 
             type="text" 
             value={editingRule.name}
             onChange={e => setEditingRule({...editingRule, name: e.target.value})}
             className="text-xl font-bold bg-transparent border-none focus:outline-none text-text-main"
             placeholder="Название правила..."
           />
           <div className="flex gap-2">
             {editingRule.id && (
                 <button onClick={() => deleteRule(editingRule.id!)} className="text-error hover:bg-error/10 px-3 py-1.5 rounded transition">Удалить</button>
             )}
             <button onClick={saveRule} className="btn-primary">Сохранить</button>
           </div>
        </div>

        <div className="flex-1 p-6 md:p-10 max-w-4xl mx-auto w-full space-y-8">
           
           {/* TRIGGER BLOCK */}
           <div className="relative group">
              <div className="absolute left-6 top-full h-8 w-0.5 bg-gray-300 dark:bg-gray-600 -z-10"></div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-yellow-400 p-5 relative">
                 <div className="absolute -left-3 -top-3 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center font-bold text-white text-sm">IF</div>
                 <h4 className="text-xs font-bold text-yellow-500 uppercase mb-3">Триггер (Когда это происходит)</h4>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-xs text-text-muted">Тип события</label>
                       <select 
                         value={editingRule.trigger?.type}
                         onChange={e => setEditingRule({ ...editingRule, trigger: { ...editingRule.trigger!, type: e.target.value as any } })}
                         className="input-field"
                       >
                         <option value="status_change">Изменился статус</option>
                         <option value="tag_added">Добавлен тег</option>
                         <option value="inactivity">Задача не активна (дней)</option>
                         <option value="location_enter">Вход в геозону</option>
                         <option value="location_leave">Выход из геозоны</option>
                       </select>
                    </div>

                    {/* Dynamic Inputs based on Trigger */}
                    {editingRule.trigger?.type === 'status_change' && (
                        <div className="space-y-1">
                          <label className="text-xs text-text-muted">Станет равным</label>
                          <select 
                            value={editingRule.trigger.value}
                            onChange={e => setEditingRule({ ...editingRule, trigger: { ...editingRule.trigger!, value: e.target.value } })}
                            className="input-field"
                          >
                            <option value="backlog">Бэклог</option>
                            <option value="in-progress">В работе</option>
                            <option value="review">Проверка</option>
                            <option value="done">Готово</option>
                          </select>
                        </div>
                    )}
                    
                    {editingRule.trigger?.type === 'tag_added' && (
                        <div className="space-y-1">
                          <label className="text-xs text-text-muted">Тег</label>
                          <input 
                            type="text"
                            value={editingRule.trigger.value}
                            onChange={e => setEditingRule({ ...editingRule, trigger: { ...editingRule.trigger!, value: e.target.value } })}
                            className="input-field"
                            placeholder="напр. urgent"
                          />
                        </div>
                    )}

                    {editingRule.trigger?.type === 'inactivity' && (
                        <div className="space-y-1">
                          <label className="text-xs text-text-muted">Дней без изменений</label>
                          <input 
                            type="number"
                            value={editingRule.trigger.inactivityDays || 7}
                            onChange={e => setEditingRule({ ...editingRule, trigger: { ...editingRule.trigger!, inactivityDays: parseInt(e.target.value) } })}
                            className="input-field"
                          />
                        </div>
                    )}

                    {(editingRule.trigger?.type === 'location_enter' || editingRule.trigger?.type === 'location_leave') && (
                        <>
                           <div className="space-y-1">
                             <label className="text-xs text-text-muted">Широта (Lat)</label>
                             <input 
                               type="number" step="0.0001"
                               value={editingRule.trigger.location?.lat || 0}
                               onChange={e => setEditingRule({ ...editingRule, trigger: { ...editingRule.trigger!, location: { lat: parseFloat(e.target.value), lng: editingRule.trigger?.location?.lng || 0, radius: editingRule.trigger?.location?.radius || 100 } } })}
                               className="input-field"
                             />
                           </div>
                           <div className="space-y-1">
                             <label className="text-xs text-text-muted">Долгота (Lng)</label>
                             <input 
                               type="number" step="0.0001"
                               value={editingRule.trigger.location?.lng || 0}
                               onChange={e => setEditingRule({ ...editingRule, trigger: { ...editingRule.trigger!, location: { lat: editingRule.trigger?.location?.lat || 0, lng: parseFloat(e.target.value), radius: editingRule.trigger?.location?.radius || 100 } } })}
                               className="input-field"
                             />
                           </div>
                           <div className="space-y-1 col-span-2">
                             <label className="text-xs text-text-muted">Радиус (метров)</label>
                             <input 
                               type="number"
                               value={editingRule.trigger.location?.radius || 100}
                               onChange={e => setEditingRule({ ...editingRule, trigger: { ...editingRule.trigger!, location: { ...editingRule.trigger!.location!, radius: parseInt(e.target.value) } } })}
                               className="input-field"
                             />
                             <button 
                               type="button" 
                               onClick={() => {
                                 navigator.geolocation.getCurrentPosition(pos => {
                                   setEditingRule({ ...editingRule, trigger: { ...editingRule.trigger!, location: { lat: pos.coords.latitude, lng: pos.coords.longitude, radius: 100 } } });
                                 });
                               }}
                               className="text-xs text-primary underline mt-1"
                             >
                               📍 Взять текущую позицию
                             </button>
                           </div>
                        </>
                    )}
                 </div>
              </div>
           </div>

           {/* ACTION BLOCK */}
           <div className="relative">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border-2 border-blue-500 p-5 relative">
                 <div className="absolute -left-3 -top-3 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center font-bold text-white text-sm">DO</div>
                 <h4 className="text-xs font-bold text-blue-500 uppercase mb-3">Действие (Что сделать)</h4>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-xs text-text-muted">Тип действия</label>
                       <select 
                         value={editingRule.action?.type}
                         onChange={e => setEditingRule({ ...editingRule, action: { ...editingRule.action!, type: e.target.value as any } })}
                         className="input-field"
                       >
                         <option value="add_tag">Добавить тег</option>
                         <option value="set_color">Установить цвет</option>
                         <option value="assign_user">Назначить на...</option>
                         <option value="create_notification">Показать уведомление</option>
                         <option value="webhook">Отправить Webhook</option>
                       </select>
                    </div>

                    <div className="space-y-1">
                       <label className="text-xs text-text-muted">Значение / URL</label>
                       <input 
                         type="text"
                         value={editingRule.action?.value}
                         onChange={e => setEditingRule({ ...editingRule, action: { ...editingRule.action!, value: e.target.value } })}
                         className="input-field"
                         placeholder={editingRule.action?.type === 'set_color' ? '#FF0000' : 'Значение'}
                       />
                       {editingRule.action?.type === 'set_color' && (
                         <div className="flex gap-2 mt-2">
                           {['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'].map(c => (
                             <div 
                               key={c} 
                               onClick={() => setEditingRule({ ...editingRule, action: { ...editingRule.action!, value: c } })}
                               className="w-6 h-6 rounded-full cursor-pointer border border-gray-200" style={{ backgroundColor: c }}
                             ></div>
                           ))}
                         </div>
                       )}
                    </div>
                 </div>
              </div>
           </div>

           {/* SIMULATOR */}
           <div className="bg-bg-panel rounded-xl p-5 border border-dashed border-border">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-text-muted uppercase text-xs">Симуляция на исторических данных</h4>
                <button onClick={runSimulation} className="text-xs px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded hover:opacity-80">
                  ▶ Запустить тест
                </button>
              </div>
              
              {simulationResult && (
                 <div className="text-sm">
                    {simulationResult.length === 0 ? (
                      <p className="text-text-muted">Правило не затронет ни одной текущей задачи.</p>
                    ) : (
                      <div>
                        <p className="mb-2 text-success">Правило сработает для <b>{simulationResult.length}</b> задач:</p>
                        <ul className="list-disc list-inside space-y-1 text-text-muted max-h-32 overflow-y-auto">
                          {simulationResult.slice(0, 5).map(t => (
                            <li key={t.id}>{t.title} <span className="text-xs opacity-50">({t.status})</span></li>
                          ))}
                          {simulationResult.length > 5 && <li>...и еще {simulationResult.length - 5}</li>}
                        </ul>
                      </div>
                    )}
                 </div>
              )}
           </div>

           {/* Templates Section (Simplified) */}
           <div className="mt-12 pt-8 border-t border-border">
              <h3 className="text-xl font-bold mb-4">Библиотека шаблонов</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DEFAULT_TEMPLATES.map(tpl => (
                  <div key={tpl.id} className="p-4 border border-border rounded-lg hover:shadow-md transition bg-bg-surface">
                    <h5 className="font-bold">{tpl.name}</h5>
                    <p className="text-xs text-text-muted mb-3">{tpl.description}</p>
                    <button onClick={() => handleApplyTemplate(tpl)} className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded">Использовать</button>
                  </div>
                ))}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
