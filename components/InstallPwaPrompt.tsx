
import React, { useState, useEffect } from 'react';

export const InstallPwaPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // 1. Check if already installed
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(isStandaloneMode);
    if (isStandaloneMode) return;

    // 2. Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // Show iOS prompt only if not dismissed previously
    if (isIosDevice && !localStorage.getItem('pwa_ios_dismissed')) {
        // Delay slightly for better UX
        setTimeout(() => setShow(true), 2000);
    }

    // 3. Capture Android/Chrome event
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShow(false);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    if (isIos) {
        localStorage.setItem('pwa_ios_dismissed', 'true');
    }
  };

  if (!show || isStandalone) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-bg-surface dark:bg-gray-800 text-text-main p-4 rounded-xl shadow-2xl border border-border max-w-md mx-auto relative overflow-hidden">
        
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>

        <div className="flex items-start gap-4 relative z-10">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center text-white text-2xl shadow-lg flex-shrink-0">
            TA
          </div>
          
          <div className="flex-1">
            <h3 className="font-bold text-lg leading-tight mb-1">Установить приложение</h3>
            <p className="text-sm text-text-muted mb-3">
              {isIos 
                ? 'Установите TaskAssist на экран «Домой» для быстрого доступа и работы офлайн.' 
                : 'Добавьте приложение на главный экран для максимального удобства.'}
            </p>

            {isIos ? (
              <div className="text-sm bg-bg-panel p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <span>1. Нажмите кнопку «Поделиться»</span>
                  <span className="text-blue-500 text-xl leading-none">⎋</span> {/* Share Icon approximation */}
                </div>
                <div className="flex items-center gap-2">
                  <span>2. Выберите</span>
                  <span className="font-semibold bg-gray-200 dark:bg-gray-700 px-1.5 rounded text-xs">На экран «Домой»</span>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button 
                  onClick={handleInstallClick} 
                  className="btn-primary py-2 px-4 text-sm shadow-lg shadow-primary/20"
                >
                  Установить
                </button>
                <button 
                  onClick={handleDismiss} 
                  className="px-4 py-2 rounded-lg text-sm font-medium text-text-muted hover:bg-bg-panel transition-colors"
                >
                  Позже
                </button>
              </div>
            )}
          </div>

          {isIos && (
             <button onClick={handleDismiss} className="text-text-muted hover:text-text-main p-1">
               ✕
             </button>
          )}
        </div>
      </div>
    </div>
  );
};
