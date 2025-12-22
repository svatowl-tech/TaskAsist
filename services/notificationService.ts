export class NotificationService {
  static async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn("This browser does not support desktop notification");
      return false;
    }
    
    if (Notification.permission === 'granted') {
      return true;
    }
    
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    
    return false;
  }

  static async show(title: string, options?: NotificationOptions): Promise<void> {
    if (Notification.permission === 'granted') {
      try {
        // Try to use Service Worker registration for notifications (better for PWA)
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          // registration.showNotification is available in SW context
          await registration.showNotification(title, {
            icon: 'https://picsum.photos/64/64',
            badge: 'https://picsum.photos/32/32',
            vibrate: [200, 100, 200],
            ...options
          } as any);
        } else {
          // Fallback to standard Notification API
          new Notification(title, options);
        }
      } catch (e) {
        console.error("Notification failed", e);
        new Notification(title, options);
      }
    }
  }
}