
import { Task } from '../types';

export class GoogleCalendarService {
  private static BASE_URL = 'https://www.googleapis.com/calendar/v3';

  static async listEvents(token: string, timeMin: string, timeMax: string): Promise<any[]> {
    try {
      const params = new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: 'true',
        orderBy: 'startTime',
      });

      const response = await fetch(`${this.BASE_URL}/calendars/primary/events?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) return [];
      const data = await response.json();
      return data.items || [];
    } catch (e) {
      console.error("GCal List Error", e);
      return [];
    }
  }

  static async createTask(token: string, task: Task): Promise<string | null> {
    if (!task.startTime) return null; // GCal needs a start time for events usually

    // Default duration 1 hour if not specified
    const startDateTime = new Date(task.startTime).toISOString();
    const endDateTime = task.endTime 
      ? new Date(task.endTime).toISOString() 
      : new Date(task.startTime + 60 * 60 * 1000).toISOString();

    const event = {
      summary: task.title,
      description: task.description || '',
      start: { dateTime: startDateTime },
      end: { dateTime: endDateTime },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 10 },
        ],
      },
    };

    try {
      const response = await fetch(`${this.BASE_URL}/calendars/primary/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (response.ok) {
        const data = await response.json();
        return data.id;
      }
    } catch (e) {
      console.error("GCal Create Error", e);
    }
    return null;
  }
}
