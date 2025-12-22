
import { AppState, Task } from '../types';
import { AiService } from './aiService';
import { StorageService } from './storageService';

export class CopilotService {

  static async generateMorningBriefing(state: AppState): Promise<string | null> {
    const apiKey = state.settings.openRouterApiKey;
    if (!apiKey) return null;

    // Check if briefing already generated today
    const lastBriefing = await StorageService.getMemoryItem('last_briefing_date');
    const today = new Date().toDateString();
    
    if (lastBriefing === today) {
      return null; // Already briefed
    }

    // Identify stale tasks
    const now = Date.now();
    const staleTasks = state.tasks.filter(t => 
      !t.completed && 
      (now - t.updatedAt > 5 * 24 * 60 * 60 * 1000) // 5 days untouched
    );

    // Identify urgent tasks
    const urgentTasks = state.tasks.filter(t => 
        !t.completed && t.deadline && (t.deadline - now < 48 * 60 * 60 * 1000)
    );

    const context = `
      Зависшие задачи (> 5 дней): ${staleTasks.map(t => t.title).join(', ')}
      Срочные задачи (< 48ч): ${urgentTasks.map(t => t.title).join(', ')}
      Всего активных: ${state.tasks.filter(t => !t.completed).length}
    `;

    const messages = [{
      role: 'user',
      content: `Сгенерируй "Утреннюю сводку" для меня на русском языке.
      1. Поприветствуй (дружелюбно).
      2. Выдели топ-3 задачи, на которых стоит сфокусироваться (исходя из срочности).
      3. Мягко напомни о ${staleTasks.length} зависших задачах, если они есть.
      4. Дай одну короткую мотивационную цитату или совет.
      Будь краток (до 150 слов).`
    }];

    try {
      const response = await AiService.sendMessage(
        apiKey, 
        messages, 
        context,
        state.settings.aiModel
      );
      
      // Save that we briefed today
      await StorageService.setMemory('last_briefing_date', today);
      
      return response.content;
    } catch (e) {
      console.error("Briefing failed", e);
      return null;
    }
  }

  static async analyzeWorkload(state: AppState): Promise<string> {
    const apiKey = state.settings.openRouterApiKey;
    if (!apiKey) return "ИИ не настроен.";

    // Simple distribution analysis
    const taskCounts = {
      backlog: state.tasks.filter(t => t.status === 'backlog').length,
      inProgress: state.tasks.filter(t => t.status === 'in-progress').length,
      review: state.tasks.filter(t => t.status === 'review').length,
    };

    const messages = [{
      role: 'user',
      content: `Проанализируй мою нагрузку.
      Бэклог: ${taskCounts.backlog}
      В работе: ${taskCounts.inProgress}
      Проверка: ${taskCounts.review}
      
      Есть ли "бутылочное горлышко"? Предложи стратегию оптимизации на русском языке.`
    }];

    const response = await AiService.sendMessage(apiKey, messages, "", state.settings.aiModel);
    return response.content;
  }
}
