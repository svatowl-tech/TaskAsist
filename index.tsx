
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { MonitoringService } from './services/monitoringService';

// Initialize Monitoring & Error Tracking
MonitoringService.init();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Use relative path to support various hosting environments/subpaths
    navigator.serviceWorker.register('./service-worker.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        // Suppress SecurityError which happens in sandboxed/preview environments
        if (registrationError.name === 'SecurityError') {
          console.warn('SW registration skipped due to security restrictions (sandbox environment).');
          return;
        }
        console.log('SW registration failed: ', registrationError);
        MonitoringService.captureException(registrationError, { context: 'SW Registration' });
      });
  });
}
