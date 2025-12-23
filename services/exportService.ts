
import { AppState, Task } from '../types';
// @ts-ignore
import html2canvas from 'html2canvas';

export class ExportService {
  
  static downloadJSON(state: AppState) {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `task_assist_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static downloadTasksCSV(tasks: Task[]) {
    const headers = ['ID', 'Title', 'Status', 'DueDate', 'Description', 'Tags'];
    const rows = tasks.map(t => [
      t.id,
      `"${t.title.replace(/"/g, '""')}"`,
      t.status,
      t.deadline ? new Date(t.deadline).toISOString() : '',
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${t.tags.join(',')}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasks_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  static downloadICS(task: Task) {
    const formatDate = (timestamp: number) => {
      return new Date(timestamp).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const now = formatDate(Date.now());
    const start = task.startTime ? formatDate(task.startTime) : (task.deadline ? formatDate(task.deadline) : now);
    const end = task.endTime ? formatDate(task.endTime) : start;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//TaskAssist//PWA//RU',
      'BEGIN:VEVENT',
      `UID:${task.id}@taskassist.app`,
      `DTSTAMP:${now}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${task.title}`,
      `DESCRIPTION:${task.description || ''}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `task_${task.id}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  static async importJSON(file: File): Promise<AppState> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          // Basic validation
          if (Array.isArray(json.tasks) && Array.isArray(json.notes)) {
             resolve(json as AppState);
          } else {
             reject(new Error("Invalid backup format"));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsText(file);
    });
  }

  static async shareAsImage(element: HTMLElement, filename: string = 'share.png') {
    try {
      // Capture
      const canvas = await html2canvas(element, {
        backgroundColor: window.getComputedStyle(document.body).backgroundColor, // Ensure background matches theme
        scale: 2, // High DPI
        logging: false,
        useCORS: true, // For images
      });

      canvas.toBlob(async (blob: Blob | null) => {
        if (!blob) return;
        
        const file = new File([blob], filename, { type: 'image/png' });

        // Try Native Share API (Mobile)
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: 'Поделиться',
              text: 'Посмотрите на эту задачу из TaskAssist'
            });
            return;
          } catch (e) {
            // Share cancelled or failed, fallback to download
            console.log("Share failed/cancelled, falling back to download");
          }
        }

        // Fallback: Download
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      }, 'image/png');

    } catch (e) {
      console.error("Failed to generate image", e);
      alert("Не удалось создать изображение.");
    }
  }
}
