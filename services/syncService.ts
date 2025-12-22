
import { AppState, AuthProvider } from '../types';
import { StorageService } from './storageService';
import { CryptoService } from './cryptoService';

const BACKUP_FILE_NAME = 'task_assistant_data.json';

export class SyncService {
  
  // --- CORE SYNC LOGIC: MERGING & ENCRYPTION ---

  private static mergeEntities(local: any[], cloud: any[]): any[] {
    const mergedMap = new Map();
    
    // Add all local items
    local.forEach(item => mergedMap.set(item.id, item));

    // Merge cloud items
    cloud.forEach(cloudItem => {
      const localItem = mergedMap.get(cloudItem.id);
      if (!localItem) {
        // New item from cloud
        mergedMap.set(cloudItem.id, cloudItem);
      } else {
        // Conflict Resolution: Last Updated Wins
        if ((cloudItem.updatedAt || 0) > (localItem.updatedAt || 0)) {
          mergedMap.set(cloudItem.id, cloudItem);
        }
      }
    });

    return Array.from(mergedMap.values());
  }

  private static mergeStates(local: AppState, cloud: AppState): AppState {
    return {
      ...local,
      tasks: this.mergeEntities(local.tasks, cloud.tasks),
      notes: this.mergeEntities(local.notes, cloud.notes),
      goals: this.mergeEntities(local.goals, cloud.goals),
      automations: this.mergeEntities(local.automations, cloud.automations),
      templates: this.mergeEntities(local.templates, cloud.templates),
      memory: this.mergeEntities(local.memory, cloud.memory),
      // Settings: usually cloud wins if newer, but simpler to keep local for some prefs. 
      // Let's assume cloud settings overwrite local if user explicitly syncs
      settings: { ...local.settings, ...cloud.settings },
      lastSynced: Date.now()
    };
  }

  private static async prepareUploadData(state: AppState): Promise<string> {
    const json = JSON.stringify(state);
    if (state.settings.encryptionPassword) {
      return await CryptoService.encrypt(json, state.settings.encryptionPassword);
    }
    return json;
  }

  private static async parseDownloadData(content: string, password?: string): Promise<AppState> {
    try {
      // Try parsing as JSON first
      return JSON.parse(content);
    } catch (e) {
      // Not JSON, maybe encrypted?
      if (password) {
        try {
          const decrypted = await CryptoService.decrypt(content, password);
          return JSON.parse(decrypted);
        } catch (decErr) {
          throw new Error("Не удалось расшифровать данные. Неверный пароль?");
        }
      }
      throw new Error("Формат данных не распознан или зашифрован.");
    }
  }

  // --- GITHUB GIST IMPLEMENTATION ---

  private static async getGist(token: string, gistId?: string): Promise<any> {
    if (gistId) {
      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        headers: { Authorization: `token ${token}` }
      });
      if (res.ok) return await res.json();
    }
    
    // Find gist by description if ID not provided
    const res = await fetch(`https://api.github.com/gists`, {
       headers: { Authorization: `token ${token}` }
    });
    const gists = await res.json();
    return gists.find((g: any) => g.description === 'TaskAssist Backup');
  }

  private static async uploadGitHub(state: AppState, token: string, gistId?: string): Promise<void> {
    const content = await this.prepareUploadData(state);
    
    const body = {
      description: 'TaskAssist Backup',
      public: false,
      files: {
        [BACKUP_FILE_NAME]: { content }
      }
    };

    let url = 'https://api.github.com/gists';
    let method = 'POST';

    // If we have an ID or find one, update it
    const existing = await this.getGist(token, gistId);
    if (existing) {
      url = `https://api.github.com/gists/${existing.id}`;
      method = 'PATCH';
    }

    await fetch(url, {
      method,
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  private static async downloadGitHub(token: string, gistId?: string, password?: string): Promise<{ data: AppState | null, updatedAt: number }> {
    const gist = await this.getGist(token, gistId);
    if (!gist || !gist.files[BACKUP_FILE_NAME]) return { data: null, updatedAt: 0 };

    const rawContent = gist.files[BACKUP_FILE_NAME].content;
    // Gist sometimes truncates content in the list view, fetch raw if truncated
    let content = rawContent;
    if (gist.truncated) {
        const rawRes = await fetch(gist.files[BACKUP_FILE_NAME].raw_url);
        content = await rawRes.text();
    }

    const data = await this.parseDownloadData(content, password);
    return { data, updatedAt: new Date(gist.updated_at).getTime() };
  }

  // --- GOOGLE DRIVE IMPLEMENTATION (Existing + Updated) ---
  // ... (Code reused from previous, but logic wrapped in prepareUploadData/parseDownloadData)
  
  private static async findGoogleFileId(token: string): Promise<string | null> {
    const q = encodeURIComponent(`name = '${BACKUP_FILE_NAME}' and 'appDataFolder' in parents and trashed = false`);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=appDataFolder&fields=files(id, modifiedTime)`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.files && data.files.length > 0 ? data.files[0].id : null;
  }

  private static async uploadGoogle(state: AppState, token: string): Promise<void> {
    const fileId = await this.findGoogleFileId(token);
    const content = await this.prepareUploadData(state);
    const blob = new Blob([content], { type: 'application/json' });

    if (fileId) {
      await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: blob
      });
    } else {
      const metadata = { name: BACKUP_FILE_NAME, parents: ['appDataFolder'] };
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', blob);

      await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });
    }
  }

  private static async downloadGoogle(token: string, password?: string): Promise<{ data: AppState | null, updatedAt: number }> {
    const fileId = await this.findGoogleFileId(token);
    if (!fileId) return { data: null, updatedAt: 0 };

    const metaResp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const meta = await metaResp.json();
    const updatedAt = new Date(meta.modifiedTime).getTime();

    const contentResp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const text = await contentResp.text();
    const data = await this.parseDownloadData(text, password);
    
    return { data, updatedAt };
  }

  // --- PUBLIC API ---

  static async upload(state: AppState, token: string, provider: AuthProvider): Promise<void> {
    // 1. Auto-Backup before sync
    await StorageService.createBackup(state, 'Pre-Sync Backup');

    // 2. Upload
    if (provider === 'google') {
      await this.uploadGoogle(state, token);
    } else if (provider === 'github') {
      await this.uploadGitHub(state, token, state.settings.githubGistId);
    }
    // Yandex impl omitted for brevity but follows same pattern
  }

  static async download(token: string, provider: AuthProvider, password?: string): Promise<{ data: AppState | null, updatedAt: number }> {
    if (provider === 'google') {
      return this.downloadGoogle(token, password);
    } else if (provider === 'github') {
      return this.downloadGitHub(token, undefined, password);
    }
    return { data: null, updatedAt: 0 };
  }

  static merge(local: AppState, cloud: AppState): AppState {
    return this.mergeStates(local, cloud);
  }
}
