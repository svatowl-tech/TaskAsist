
import { User, AuthProvider } from '../types';

// Используем переменные окружения Vite.
// Для локальной разработки создайте файл .env в корне: VITE_GOOGLE_CLIENT_ID=ваш_ид
// Для Vercel добавьте это в Settings -> Environment Variables
const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
const YANDEX_CLIENT_ID = (import.meta as any).env?.VITE_YANDEX_CLIENT_ID || '';

const REDIRECT_URI = window.location.origin; // Автоматически: http://localhost:3000 или https://ваш-проект.vercel.app

const LOCAL_USER_MOCK: User = {
  id: 'guest-user-01',
  name: 'Гость',
  email: 'local@taskassist.app',
  avatar: 'https://ui-avatars.com/api/?name=Guest&background=3182CE&color=fff',
  provider: 'local'
};

export class AuthService {
  static getToken(): string | null {
    return sessionStorage.getItem('auth_token');
  }

  static getProvider(): AuthProvider | null {
    return sessionStorage.getItem('auth_provider') as AuthProvider | null;
  }

  static logout() {
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_provider');
    // Avoid reload() as it crashes in blob/sandbox environments
    window.location.href = window.location.origin + window.location.pathname;
  }

  static login(provider: AuthProvider) {
    // 1. Handle Local/Guest Login
    if (provider === 'local') {
      sessionStorage.setItem('auth_token', 'mock_guest_token');
      sessionStorage.setItem('auth_provider', 'local');
      window.location.reload();
      return;
    }

    // 2. Check for Missing Configuration
    if (provider === 'google' && !GOOGLE_CLIENT_ID) {
      alert("Ошибка конфигурации: VITE_GOOGLE_CLIENT_ID не найден.\n\nДобавьте Client ID в переменные окружения Vercel или файл .env для локальной работы.");
      return;
    }
    
    if (provider === 'yandex' && !YANDEX_CLIENT_ID) {
      alert("Ошибка конфигурации: VITE_YANDEX_CLIENT_ID не найден.");
      return;
    }

    // 3. Perform OAuth Redirect
    let url = '';
    const state = crypto.randomUUID();
    sessionStorage.setItem('auth_state', state);

    if (provider === 'google') {
      // Scopes: Drive AppData (hidden folder), Profile, Email, AND Google Calendar Events
      const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.events');
      url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=token&scope=${scope}&state=${state}&prompt=select_account`;
    } else if (provider === 'yandex') {
      url = `https://oauth.yandex.com/authorize?response_type=token&client_id=${YANDEX_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&state=${state}`;
    }

    if (url) window.location.href = url;
  }

  static handleCallback(): { token: string; provider: AuthProvider } | null {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    
    if (accessToken) {
      sessionStorage.setItem('auth_token', accessToken);
      // Clean URL hash
      window.history.replaceState(null, '', window.location.pathname);
      return { token: accessToken, provider: 'google' }; // Default assumption, updated by fetchProfile
    }
    return null;
  }

  static async fetchUserProfile(token: string): Promise<User | null> {
    const storedProvider = sessionStorage.getItem('auth_provider');

    // Handle Local Guest
    if (storedProvider === 'local' || token === 'mock_guest_token') {
      return LOCAL_USER_MOCK;
    }

    try {
      // Try Google First (if provider is google or unknown)
      if (!storedProvider || storedProvider === 'google') {
        const googleResp = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (googleResp.ok) {
          const data = await googleResp.json();
          sessionStorage.setItem('auth_provider', 'google');
          return {
            id: data.id,
            name: data.name,
            email: data.email,
            avatar: data.picture,
            provider: 'google'
          };
        }
      }

      // Try Yandex
      if (!storedProvider || storedProvider === 'yandex') {
        const yandexResp = await fetch('https://login.yandex.ru/info?format=json', {
          headers: { Authorization: `OAuth ${token}` }
        });

        if (yandexResp.ok) {
          const data = await yandexResp.json();
          sessionStorage.setItem('auth_provider', 'yandex');
          return {
            id: data.id,
            name: data.real_name || data.display_name,
            email: data.default_email,
            avatar: `https://avatars.yandex.net/get-yapic/${data.default_avatar_id}/islands-200`,
            provider: 'yandex'
          };
        }
      }
    } catch (e) {
      console.error("Failed to fetch profile", e);
    }
    return null;
  }
}
