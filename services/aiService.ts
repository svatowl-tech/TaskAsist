
import { AppState, Task, Note, ChatMessage, ChecklistItem } from '../types';
import { AnalyticsService } from './analyticsService';
import { LocalAiService } from './localAiService';
import { StorageService } from './storageService';

// Updated Default to DeepSeek R1 as requested
const DEFAULT_MODEL = 'deepseek/deepseek-r1-0528:free'; 
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const AVAILABLE_MODELS = [
  { id: 'deepseek/deepseek-r1-0528:free', name: 'DeepSeek R1 (Default)' },
  { id: 'google/gemini-2.0-flash-lite-preview-02-05:free', name: 'Gemini 2.0 Flash Lite' },
  { id: 'meta-llama/llama-3.2-90b-vision-instruct:free', name: 'Llama 3.2 Vision' }, // Supports images
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (Paid)' },
  { id: 'local', name: '🏠 Local (Offline, WebGPU)' },
];

export interface ToolCall {
  name: string;
  arguments: any;
}

export interface AiIntentResult {
  type: 'project' | 'task';
  data: any;
  reasoning: string;
}

export class AiService {
  
  private static async getWeatherContext(): Promise<string> {
    try {
      return new Promise((resolve) => {
        if (!navigator.geolocation) resolve("Погода неизвестна");
        
        navigator.geolocation.getCurrentPosition(async (pos) => {
          try {
            const { latitude, longitude } = pos.coords;
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,is_day`);
            const data = await res.json();
            const temp = data.current.temperature_2m;
            const code = data.current.weather_code;
            const condition = code > 60 ? 'дождь' : code > 50 ? 'пасмурно' : 'ясно/облачно';
            resolve(`Погода: ${temp}°C, ${condition}`);
          } catch {
            resolve("Погода: не удалось получить данные");
          }
        }, () => {
             resolve("Погода: нет доступа к геопозиции");
        }, { timeout: 2000 });
      });
    } catch {
      return "";
    }
  }

  static async generateContext(state: AppState): Promise<string> {
    const now = new Date();
    const currentHour = now.getHours();
    const weather = await this.getWeatherContext();
    const activeTasks = state.tasks.filter(t => !t.completed);
    
    const relevantTasks = activeTasks.filter(t => {
      if (t.status === 'in-progress') return true;
      if (t.deadline && t.deadline < now.getTime() + 48 * 3600 * 1000) return true;
      if (!t.deadline && t.status === 'backlog') return false;
      return true;
    }).slice(0, 15);

    const taskStr = relevantTasks.map(t => 
      `- [${t.status}] ${t.title} (ID: ${t.id})${t.deadline ? `, Дедлайн: ${new Date(t.deadline).toLocaleDateString()}` : ''}`
    ).join('\n');

    const prefTone = state.settings.assistantTone || 'professional';
    const memoryContext = state.memory.map(m => `Пользователь: ${JSON.stringify(m.value)}`).join('\n');
    const timeOfDay = currentHour < 12 ? 'Утро' : currentHour < 18 ? 'День' : 'Вечер';

    return `
      Системное время: ${now.toLocaleString('ru-RU')} (${timeOfDay}).
      ${weather}
      Настройки стиля: ${prefTone}
      Выученные предпочтения: ${memoryContext}
      Актуальные задачи: ${taskStr || 'Нет срочных задач.'}
    `;
  }

  static getTools() {
    return [
      {
        type: "function",
        function: {
          name: "create_task",
          description: "Создать новую задачу.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              due_date: { type: "string" },
              status: { type: "string", enum: ["backlog", "in-progress", "done"] }
            },
            required: ["title"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_note",
          description: "Создать заметку.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              content: { type: "string" }
            },
            required: ["title", "content"]
          }
        }
      }
    ];
  }

  private static parseError(err: any, statusText?: string): string {
    if (err && typeof err === 'object') {
      if (err.error) {
        const e = err.error;
        if (typeof e === 'string') return e;
        if (typeof e.message === 'string') return e.message;
        try { return JSON.stringify(e); } catch {}
      }
      // OpenRouter sometimes returns error object directly
      if (err.message) return err.message;
      try { return JSON.stringify(err); } catch {}
    }
    return statusText || 'Unknown API Error';
  }

  static async sendMessage(
    apiKey: string, 
    messages: { role: string; content: string | any[] }[], 
    context: string,
    model?: string,
    tools?: any[]
  ): Promise<{ content: string; toolCalls?: ToolCall[] }> {
    
    const useLocal = model === 'local' || (!navigator.onLine && LocalAiService.isSupported());
    const selectedModel = model === 'local' ? 'local' : (model || DEFAULT_MODEL);

    const systemMessage = {
      role: "system",
      content: `Ты полезный Персональный Ассистент (Copilot).
      Твоя цель: помогать управлять делами.
      ОТВЕЧАЙ ТОЛЬКО НА РУССКОМ ЯЗЫКЕ.
      
      КОНТЕКСТ:
      ${context}`
    };

    if (useLocal) {
       console.log("Using Local AI...");
       const textMessages = messages.map(m => ({
         role: m.role,
         content: Array.isArray(m.content) ? (m.content[0] as any).text : m.content
       }));
       const response = await LocalAiService.generate([systemMessage, ...textMessages as any], tools);
       return { content: response };
    }

    const formattedMessages = [systemMessage, ...messages];
    const payload: any = {
      model: selectedModel,
      messages: formattedMessages
    };

    if (tools && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = "auto";
    }

    try {
      const response = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "TaskAssist PWA"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const err = await response.json();
          const parsed = this.parseError(err, response.statusText);
          if (parsed && parsed !== '{}') errorMsg = parsed;
        } catch (e) { /* ignore json parse error */ }

        // Fallback for models not supporting tools
        if (tools && tools.length > 0 && (
          errorMsg.toLowerCase().includes('tool') || errorMsg.toLowerCase().includes('endpoint')
        )) {
          console.warn("Model does not support tools. Retrying without tools.");
          return this.sendMessage(apiKey, messages, context, model, undefined);
        }

        throw new Error(errorMsg);
      }

      const data = await response.json();
      const choice = data.choices[0];
      return {
        content: choice.message.content || '',
        toolCalls: choice.message.tool_calls?.map((tc: any) => ({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments)
        }))
      };
    } catch (error: any) {
      // Final catch ensuring no object leaks
      const safeMsg = this.parseError(error);
      throw new Error(safeMsg === '{}' || safeMsg === '[object Object]' ? 'Connection failed' : safeMsg);
    }
  }

  static async learnFromFeedback(feedback: 'like' | 'dislike', messageContent: string, lastUserQuery: string) {
    if (feedback === 'like') {
       const value = `User liked response to "${lastUserQuery.slice(0, 20)}...". Style: ${messageContent.length < 100 ? 'Concise' : 'Detailed'}.`;
       await StorageService.setMemory(crypto.randomUUID(), value);
    }
  }

  static async enhanceText(apiKey: string, text: string, type: 'grammar' | 'professional' | 'summarize' | 'structure', model?: string): Promise<string> {
    let prompt = "";
    switch (type) {
      case 'grammar': prompt = "Исправь грамматику и пунктуацию. Верни только текст."; break;
      case 'professional': prompt = "Перепиши в деловом стиле. Верни только текст."; break;
      case 'summarize': prompt = "Суммируй (TL;DR). Верни только текст."; break;
      case 'structure': prompt = "Структурируй (Markdown headers/lists)."; break;
    }
    const messages = [{ role: "user", content: `${prompt}\n\nТекст:\n${text}` }];
    const response = await this.sendMessage(apiKey, messages, "", model);
    return response.content;
  }

  static async generateChecklistFromText(apiKey: string, text: string, model?: string): Promise<ChecklistItem[]> {
    const messages = [{ role: "user", content: `Преобразуй в чеклист (JSON Array strings only). Text:\n${text}` }];
    const response = await this.sendMessage(apiKey, messages, "", model);
    try {
      const clean = response.content.replace(/```json|```/g, '').trim();
      const items: string[] = JSON.parse(clean);
      return items.map(text => ({ id: crypto.randomUUID(), text, completed: false }));
    } catch (e) { return []; }
  }

  // --- Magic Button Logic ---

  static async analyzeUserIntent(apiKey: string, text: string, model?: string): Promise<AiIntentResult> {
    const now = new Date();
    const prompt = `
      Ты — интеллектуальный диспетчер задач. Твоя цель — проанализировать запрос пользователя и структурировать его.
      Текущее время: ${now.toISOString()}.

      Критерии:
      1. Если текст описывает сложный проект, глобальную цель, свадьбу, переезд или большую тему с подзадачами — это PROJECT.
      2. Если текст описывает конкретное действие, напоминание, встречу или простую задачу — это TASK.

      Ответь СТРОГО в формате JSON без markdown обертки.

      Формат для PROJECT:
      {
        "type": "project",
        "data": {
           "title": "Название доски",
           "columns": ["To Do", "In Progress", "Done"], // Можешь адаптировать названия колонок под тему
           "tasks": [
              { "title": "Задача 1", "column": "To Do", "description": "..." },
              { "title": "Задача 2", "column": "To Do" }
           ]
        },
        "reasoning": "Краткое объяснение"
      }

      Формат для TASK:
      {
        "type": "task",
        "data": {
           "title": "Название задачи",
           "description": "Детали",
           "startTime": "ISO String или null (если указано время)",
           "deadline": "ISO String или null (если указан дедлайн)",
           "durationMinutes": 60, // оценка
           "tags": ["tag1"]
        },
        "reasoning": "Краткое объяснение"
      }

      Запрос: "${text}"
    `;

    const messages = [{ role: "user", content: prompt }];
    
    // Force Cloud AI for this complex logic usually, unless model supports JSON well
    const response = await this.sendMessage(apiKey, messages, "", model);
    
    try {
        let clean = response.content.trim();
        // Remove markdown code blocks if present
        if (clean.startsWith('```json')) clean = clean.replace(/^```json/, '').replace(/```$/, '');
        if (clean.startsWith('```')) clean = clean.replace(/^```/, '').replace(/```$/, '');
        
        const result = JSON.parse(clean);
        return result as AiIntentResult;
    } catch (e) {
        console.error("AI JSON Parse Error", e);
        throw new Error("Не удалось распознать структуру ответа ИИ");
    }
  }
}
