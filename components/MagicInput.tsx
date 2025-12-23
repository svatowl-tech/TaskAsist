
import React, { useState } from 'react';
import { AiService, AiIntentResult } from '../services/aiService';
import { AppState } from '../types';

interface MagicInputProps {
  isOpen: boolean;
  onClose: () => void;
  appState: AppState;
  onResult: (result: AiIntentResult) => Promise<void>;
}

export const MagicInput: React.FC<MagicInputProps> = ({ isOpen, onClose, appState, onResult }) => {
  const [text, setText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<AiIntentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    if (!appState.settings.openRouterApiKey && appState.settings.aiModel !== 'local') {
        setError('Требуется API ключ (в настройках) или локальная модель');
        return;
    }

    setIsLoading(true);
    setError(null);
    setPreview(null);

    try {
      const apiKey = appState.settings.openRouterApiKey || '';
      const result = await AiService.analyzeUserIntent(apiKey, text, appState.settings.aiModel);
      setPreview(result);
    } catch (e: any) {
      setError(e.message || "Ошибка анализа");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (preview) {
        await onResult(preview);
        onClose();
        setText('');
        setPreview(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative w-full max-w-2xl bg-bg-surface rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
           <h2 className="text-2xl font-bold flex items-center gap-2">
             🪄 Волшебный ввод
           </h2>
           <p className="text-indigo-100 text-sm mt-1">
             Опишите задачу, проект или идею. ИИ создаст структуру за вас.
           </p>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
           {!preview ? (
               <div className="space-y-4">
                   <textarea 
                     autoFocus
                     value={text}
                     onChange={e => setText(e.target.value)}
                     placeholder="Например: 'Спланировать день рождения в эти выходные' или 'Купить молоко завтра в 18:00'..."
                     className="w-full h-32 p-4 rounded-xl border-2 border-border bg-bg-main text-lg resize-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                     onKeyDown={e => {
                         if (e.key === 'Enter' && e.metaKey) handleAnalyze();
                     }}
                   />
                   <div className="flex justify-end">
                       <button 
                         onClick={handleAnalyze} 
                         disabled={isLoading || !text.trim()}
                         className="btn-primary py-3 px-6 text-base shadow-lg shadow-primary/20 disabled:opacity-50 disabled:shadow-none"
                       >
                         {isLoading ? 'Думаю...' : '✨ Распознать'}
                       </button>
                   </div>
                   {error && (
                       <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-lg border border-red-200 dark:border-red-800 text-sm">
                           {error}
                       </div>
                   )}
               </div>
           ) : (
               <div className="space-y-6 animate-in slide-in-from-bottom-4">
                   <div className="flex items-center justify-between">
                       <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${preview.type === 'project' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                           {preview.type === 'project' ? 'Проект (Доска)' : 'Задача'}
                       </span>
                       <button onClick={() => setPreview(null)} className="text-sm text-text-muted hover:text-text-main underline">Изменить запрос</button>
                   </div>

                   <div className="bg-bg-panel rounded-xl p-5 border border-border">
                       <h3 className="text-xl font-bold mb-2">{preview.data.title}</h3>
                       <p className="text-text-muted text-sm mb-4">{preview.reasoning}</p>
                       
                       {preview.type === 'project' ? (
                           <div className="space-y-3">
                               <div className="text-sm font-semibold">Колонки:</div>
                               <div className="flex gap-2 flex-wrap">
                                   {preview.data.columns.map((c: string) => (
                                       <span key={c} className="px-2 py-1 bg-bg-surface border border-border rounded text-xs">{c}</span>
                                   ))}
                               </div>
                               <div className="text-sm font-semibold mt-2">Задачи:</div>
                               <ul className="space-y-1">
                                   {preview.data.tasks.map((t: any, i: number) => (
                                       <li key={i} className="text-sm flex items-start gap-2">
                                           <span className="text-primary">•</span> 
                                           <span>{t.title} <span className="opacity-50 text-xs">({t.column})</span></span>
                                       </li>
                                   ))}
                               </ul>
                           </div>
                       ) : (
                           <div className="space-y-2 text-sm">
                               {preview.data.startTime && (
                                   <div className="flex gap-2"><span className="text-text-muted">Начало:</span> {new Date(preview.data.startTime).toLocaleString()}</div>
                               )}
                               {preview.data.deadline && (
                                   <div className="flex gap-2"><span className="text-text-muted">Дедлайн:</span> {new Date(preview.data.deadline).toLocaleString()}</div>
                               )}
                               {preview.data.description && (
                                   <div className="p-2 bg-bg-surface rounded border border-border mt-2">{preview.data.description}</div>
                               )}
                           </div>
                       )}
                   </div>

                   <div className="flex gap-3 pt-2">
                       <button onClick={onClose} className="btn-secondary flex-1">Отмена</button>
                       <button onClick={handleConfirm} className="btn-primary flex-1">
                           {preview.type === 'project' ? '🚀 Создать доску' : '✅ Создать задачу'}
                       </button>
                   </div>
               </div>
           )}
        </div>
      </div>
    </div>
  );
};
