
export class MonitoringService {
  private static isInitialized = false;
  private static sessionEvents: string[] = [];
  
  // Configuration
  private static SLOW_INTERACTION_THRESHOLD = 100; // ms
  private static SLOW_API_THRESHOLD = 500; // ms

  static init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Global Error Tracking
    window.addEventListener('error', (event) => {
      this.captureException(event.error, { 
        type: 'uncaught_exception',
        message: event.message,
        filename: event.filename
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.captureException(event.reason, { type: 'unhandled_rejection' });
    });

    // 2. Performance Observer (Core Web Vitals subset)
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            // Detect slow paints or layout shifts
            if (entry.entryType === 'largest-contentful-paint') {
              this.logMetric('LCP', entry.startTime);
            }
            if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
              this.logMetric('CLS', (entry as any).value);
            }
          }
        });
        observer.observe({ type: 'layout-shift', buffered: true });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (e) {
        console.warn('PerformanceObserver init failed', e);
      }
    }

    console.log('[Monitoring] Service Initialized');
  }

  // --- Error Tracking (Sentry Facade) ---

  static captureException(error: any, context: Record<string, any> = {}) {
    let errorMessage = 'Unknown Error';
    let stack = undefined;

    // Safe error message extraction
    if (error instanceof Error) {
      errorMessage = error.message;
      stack = error.stack;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      try {
        errorMessage = JSON.stringify(error);
        if (errorMessage === '{}') errorMessage = 'Empty Error Object';
      } catch {
        errorMessage = String(error);
      }
    } else {
      errorMessage = String(error);
    }

    // Explicitly catch [object Object] stringification results
    if (errorMessage === '[object Object]') {
      errorMessage = 'Unknown Error (Object)';
    }

    const errorLog = {
      timestamp: new Date().toISOString(),
      error: errorMessage,
      stack,
      context,
      breadcrumbs: this.sessionEvents.slice(-5) // Attach last 5 user actions
    };

    // In production, send this to Sentry/LogRocket
    console.group('%c🚨 Error Captured', 'color: red; font-weight: bold');
    console.error(errorLog);
    console.groupEnd();

    // Persist critical errors to localStorage for next-boot reporting
    try {
      const logs = JSON.parse(localStorage.getItem('error_logs') || '[]');
      logs.push(errorLog);
      localStorage.setItem('error_logs', JSON.stringify(logs.slice(-20))); // Keep last 20
    } catch (e) { /* ignore storage errors */ }
  }

  static addBreadcrumb(message: string, category: string = 'ui') {
    const entry = `[${category.toUpperCase()}] ${message}`;
    this.sessionEvents.push(entry);
    if (this.sessionEvents.length > 50) this.sessionEvents.shift();
  }

  // --- Performance Monitoring ---

  static startTransaction(name: string) {
    const start = performance.now();
    return {
      finish: () => {
        const duration = performance.now() - start;
        this.checkThreshold(name, duration);
        return duration;
      }
    };
  }

  static async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.checkThreshold(name, duration);
      return result;
    } catch (e) {
      const duration = performance.now() - start;
      this.logMetric(`${name}_error`, duration);
      throw e;
    }
  }

  private static checkThreshold(name: string, duration: number) {
    const threshold = name.includes('api') ? this.SLOW_API_THRESHOLD : this.SLOW_INTERACTION_THRESHOLD;
    
    if (duration > threshold) {
      console.warn(`[Performance] 🐢 Slow operation detected: ${name} took ${duration.toFixed(2)}ms (Threshold: ${threshold}ms)`);
      this.trackEvent('performance_degradation', { operation: name, duration });
    }
  }

  private static logMetric(name: string, value: number) {
    // console.log(`[Metric] ${name}: ${value}`);
  }

  // --- Analytics ---

  static trackEvent(eventName: string, props: Record<string, any> = {}) {
    this.addBreadcrumb(`Event: ${eventName}`, 'analytics');
    // In real app: send to Google Analytics / Mixpanel
  }
}
