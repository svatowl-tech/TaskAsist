
import { User, AuthProvider } from '../types';

// TODO: Replace with your actual Client IDs from Google Cloud Console and Yandex OAuth
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const YANDEX_CLIENT_ID = 'YOUR_YANDEX_CLIENT_ID';

const REDIRECT_URI = window.location.origin; // e.g., http://localhost:3000

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
    let url = '';
    const state = crypto.randomUUID();
    sessionStorage.setItem('auth_state', state);

    if (provider === 'google') {
      const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email');
      url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=token&scope=${scope}&state=${state}&prompt=select_account`;
    } else if (provider === 'yandex') {
      url = `https://oauth.yandex.com/authorize?response_type=token&client_id=${YANDEX_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&state=${state}`;
    }

    window.location.href = url;
  }

  static handleCallback(): { token: string; provider: AuthProvider } | null {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const state = params.get('state');

    // Simple state check (in production, verify strictly)
    const storedState = sessionStorage.getItem('auth_state');
    
    if (accessToken) {
      // Determine provider based on what we initiated or infer (simplified here)
      // Since Yandex/Google callbacks look similar, we assume the user knows what they clicked 
      // or we rely on the fact that we clear session storage on init.
      // A better way is checking the 'issuer' or trying an API call.
      
      // Heuristic: If we are here, we save the token.
      sessionStorage.setItem('auth_token', accessToken);
      
      // Clean URL
      window.history.replaceState(null, '', window.location.pathname);
      return { token: accessToken, provider: 'google' }; // Defaulting type return, actual provider set in fetchProfile
    }
    return null;
  }

  static async fetchUserProfile(token: string): Promise<User | null> {
    try {
      // Try Google First
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

      // Try Yandex
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
    } catch (e) {
      console.error("Failed to fetch profile", e);
    }
    return null;
  }
}
