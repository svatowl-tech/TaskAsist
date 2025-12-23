
import React from 'react';
import { AppState, AutomationRule, ProjectTemplate, Task, Board, BoardColumn } from '../types';
import { StorageService } from '../services/storageService';
import { appStore } from '../lib/store';

interface AutomationViewProps {
  appState: AppState;
  onUpdateAutomations: (rules: AutomationRule[]) => void;
  onUpdateTemplates: (templates: ProjectTemplate[]) => void;
  onRefresh?: () => void;
}

const TEMPLATES_LIBRARY: (ProjectTemplate & { category: string, color: string })[] = [
  {
    id: 't_software_agile',
    name: 'Разработка ПО (Agile)',
    description: 'Стандартный процесс для Sprint: планирование, разработка, тесты.',
    category: 'Работа',
    color: 'bg-blue-500',
    columns: ['Бэклог', 'В работе', 'Code Review', 'QA', 'Готово'],
    tasks: [
      { title: 'Sprint Planning', status: 'done', tags: ['meeting'] },
      { title: 'Настройка окружения', status: 'done', tags: ['devops'] },
      { title: 'Реализация API', status: 'in-progress', tags: ['backend'] },
      { title: 'Верстка компонентов', status: 'in-progress', tags: ['frontend'] },
      { title: 'Написание тестов', status: 'backlog', tags: ['qa'] },
    ]
  },
  {
    id: 't_marketing_launch',
    name: 'Запуск рекламной кампании',
    description: 'Чек-лист для подготовки и запуска маркетинговой активности.',
    category: 'Маркетинг',
    color: 'bg-purple-500',
    columns: ['Идеи', 'Контент', 'Настройка', 'Запущено', 'Аналитика'],
    tasks: [
      { title: 'Определить целевую аудиторию', status: 'done', tags: ['strategy'] },
      { title: 'Написать тексты объявлений', status: 'in-progress', tags: ['copywriting'] },
      { title: 'Подготовить креативы (баннеры)', status: 'in-progress', tags: ['design'] },
      { title: 'Настройка таргетинга', status: 'backlog', tags: ['ads'] },
      { title: 'Сбор статистики (через неделю)', status: 'backlog', tags: ['analytics'] },
    ]
  },
  {
    id: 't_personal_moving',
    name: 'Переезд в новую квартиру',
    description: 'Чтобы ничего не забыть и не сойти с ума при переезде.',
    category: 'Личное',
    color: 'bg-orange-500',
    columns: ['Сделать до', 'Сбор вещей', 'В день переезда', 'Сделать после'],
    tasks: [
      { title: 'Найти коробки и скотч', status: 'done', tags: ['packing'] },
      { title: 'Расторгнуть договор интернета', status: 'backlog', tags: ['docs'] },
      { title: 'Собрать зимнюю одежду', status: 'backlog', tags: ['packing'] },
      { title: 'Заказать грузчиков', status: 'backlog', tags: ['logistics'] },
      { title: 'Помыть старую квартиру', status: 'backlog', tags: ['cleaning'] },
    ]
  },
  {
    id: 't_trip_planning',
    name: 'Планирование отпуска',
    description: 'Подготовка к путешествию: билеты, отели, маршруты.',
    category: 'Путешествия',
    color: 'bg-teal-500',
    columns: ['To Do', 'Бронирование', 'Сборы', 'В поездке'],
    tasks: [
      { title: 'Выбрать даты и направление', status: 'done', tags: ['planning'] },
      { title: 'Купить авиабилеты', status: 'backlog', tags: ['booking'] },
      { title: 'Забронировать отель', status: 'backlog', tags: ['booking'] },
      { title: 'Сделать страховку', status: 'backlog', tags: ['docs'] },
      { title: 'Собрать аптечку', status: 'backlog', tags: ['packing'] },
    ]
  },
  {
    id: 't_website_launch',
    name: 'Запуск веб-сайта',
    description: 'Чек-лист перед релизом сайта в продакшн.',
    category: 'Работа',
    color: 'bg-indigo-500',
    columns: ['Контент', 'SEO', 'Техническое', 'Релиз'],
    tasks: [
      { title: 'Проверить все ссылки (404)', status: 'backlog', tags: ['qa'] },
      { title: 'Настроить мета-теги', status: 'backlog', tags: ['seo'] },
      { title: 'Подключить Google Analytics', status: 'backlog', tags: ['analytics'] },
      { title: 'Проверить мобильную версию', status: 'backlog', tags: ['qa'] },
      { title: 'Настроить SSL сертификат', status: 'backlog', tags: ['devops'] },
    ]
  },
  {
    id: 't_onboarding',
    name: 'Онбординг сотрудника',
    description: 'План введения нового человека в команду.',
    category: 'HR',
    color: 'bg-pink-500',
    columns: ['До выхода', 'День 1', 'Неделя 1', 'Месяц 1'],
    tasks: [
      { title: 'Подготовить рабочее место', status: 'backlog', tags: ['admin'] },
      { title: 'Создать корпоративную почту', status: 'backlog', tags: ['it'] },
      { title: 'Выдать доступы (Jira, Slack)', status: 'backlog', tags: ['it'] },
      { title: 'Intro встреча с командой', status: 'backlog', tags: ['meeting'] },
      { title: 'Постановка целей на ИС', status: 'backlog', tags: ['management'] },
    ]
  }
];

export const AutomationView: React.FC<AutomationViewProps> = ({ 
  onRefresh 
}) => {
  
  const handleApplyTemplate = async (template: typeof TEMPLATES_LIBRARY[0]) => {
    if(!confirm(`Создать новую доску "${template.name}" и заполнить её задачами?`)) return;

    // 1. Create Board
    const boardId = crypto.randomUUID();
    const columns: BoardColumn[] = (template.columns || ['To Do', 'Done']).map((title, i) => ({
        id: title.toLowerCase().replace(/\s/g, '_') + '_' + Math.floor(Math.random()*1000),
        title,
        order: i
    }));

    const newBoard: Board = {
        id: boardId,
        title: template.name,
        columns
    };

    await StorageService.saveBoard(newBoard);
    appStore.updateBoard(newBoard);
    appStore.setActiveBoard(boardId);

    // 2. Create Tasks
    for (const t of template.tasks) {
      // Find matching column ID based on index or name approximation, defaulting to first column
      // Since template.tasks has a 'status' which is just a string key in the template definition,
      // we map it to our newly created columns.
      // Simple mapping: If template task status is 'backlog', try to find col 0.
      
      let targetColId = columns[0].id;
      // Heuristic: try to map generic statuses to created columns
      if (t.status === 'done') targetColId = columns[columns.length - 1].id;
      if (t.status === 'in-progress' && columns.length > 2) targetColId = columns[1].id;
      
      // If the template defines columns, try to map by index if implicit order matches
      // (This is a simplification, a real system would have strict ID mapping in templates)

      const newTask: any = {
        ...t,
        id: crypto.randomUUID(),
        status: targetColId,
        boardId: boardId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: t.tags || [],
        completed: false,
        color: '#3b82f6',
        description: `Создано из шаблона: ${template.name}`,
        order: Date.now()
      };
      await StorageService.addTask(newTask);
      appStore.addTask(newTask);
    }

    if (onRefresh) onRefresh();
    alert(`Шаблон "${template.name}" успешно применен! Перейдите на доску.`);
  };

  return (
    <div className="h-full overflow-y-auto bg-bg-main p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-text-main mb-2">Библиотека шаблонов</h2>
          <p className="text-text-muted">
            Выберите готовый набор задач и колонок, чтобы быстро запустить проект.
            При выборе шаблона будет создана новая доска.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
          {TEMPLATES_LIBRARY.map(template => (
            <div 
              key={template.id} 
              className="bg-bg-surface border border-border rounded-xl shadow-card hover:shadow-lg transition-all duration-300 flex flex-col overflow-hidden group"
            >
              <div className={`h-2 ${template.color} w-full`}></div>
              
              <div className="p-6 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-3">
                   <span className="text-xs font-bold uppercase tracking-wider text-text-muted bg-bg-panel px-2 py-1 rounded">
                     {template.category}
                   </span>
                </div>
                
                <h3 className="text-xl font-bold text-text-main mb-2 group-hover:text-primary transition-colors">
                  {template.name}
                </h3>
                <p className="text-sm text-text-muted mb-6 flex-1">
                  {template.description}
                </p>

                {/* Mini Preview */}
                <div className="bg-bg-panel rounded-lg p-3 mb-6 space-y-2 border border-border/50">
                   <div className="text-xs font-semibold text-text-muted mb-2">Пример задач:</div>
                   {template.tasks.slice(0, 3).map((t, i) => (
                     <div key={i} className="flex items-center gap-2 text-xs text-text-main">
                        <div className={`w-1.5 h-1.5 rounded-full ${t.status === 'done' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                        <span className="truncate">{t.title}</span>
                     </div>
                   ))}
                   {template.tasks.length > 3 && (
                     <div className="text-xs text-text-disabled pl-3.5">+ еще {template.tasks.length - 3}</div>
                   )}
                </div>

                <button 
                  onClick={() => handleApplyTemplate(template)}
                  className="w-full btn-primary justify-center py-2.5 rounded-lg font-medium shadow-sm hover:shadow-md transition-all active:scale-95"
                >
                  Использовать шаблон
                </button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="text-center text-text-disabled text-sm mt-8 pb-8">
           Хотите создать свой шаблон? Настройте доску и сохраните её конфигурацию (Скоро).
        </div>
      </div>
    </div>
  );
};
