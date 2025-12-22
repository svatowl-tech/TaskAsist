
import React, { useEffect, useState, useRef } from 'react';
import { ViewMode, User } from '../types';
import { AuthService } from '../services/authService';

interface LayoutProps {
  children: React.ReactNode;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  user: User | null;
  isSyncing: boolean;
  lastSynced?: number;
  onNewTask: () => void;
  onRefresh?: () => Promise<void>;
  onLogout?: () => void;
  onToggleChat?: () => void; // Added for right swipe gesture
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  viewMode, 
  setViewMode,
  isSidebarOpen,
  toggleSidebar,
  user,
  isSyncing,
  lastSynced,
  onNewTask,
  onRefresh,
  onLogout,
  onToggleChat
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Gesture Refs
  const touchStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then(registration => {
        // @ts-ignore
        return registration.sync.register('sync-tasks');
      }).catch(() => console.log('Bg Sync not supported'));
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const navItems: { id: ViewMode; label: string; icon: string }[] = [
    { id: 'tasks', label: 'Задачи', icon: '📋' },
    { id: 'calendar', label: 'Календарь', icon: '📅' },
    { id: 'board', label: 'Доска', icon: '📊' },
    { id: 'notes', label: 'Заметки', icon: '📝' },
    { id: 'analytics', label: 'Инфо', icon: '📈' },
    { id: 'automation', label: 'Авто', icon: '⚡' },
    { id: 'settings', label: 'Настройки', icon: '⚙️' },
  ];

  // Gestures Logic
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    
    // Pull to refresh only if at top
    if (contentRef.current && contentRef.current.scrollTop === 0) {
      // Logic handled in move
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const dy = touch.clientY - touchStart.current.y;
    
    // Pull to Refresh Logic (Vertical)
    if (contentRef.current && contentRef.current.scrollTop <= 0 && dy > 0 && dy < 200) {
      setPullY(dy * 0.4);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStart.current.x;
    const dy = touch.clientY - touchStart.current.y;
    
    // Horizontal Swipes (Sidebar/Chat)
    // Only if vertical movement is small (to avoid triggering on scrolling)
    if (Math.abs(dy) < 50 && Math.abs(dx) > 100) {
       // Swipe Right (Open Sidebar) - only if starting from left edge
       if (dx > 0 && touchStart.current.x < 50) {
          if (!isSidebarOpen) toggleSidebar();
       }
       // Swipe Left (Open Chat) - only if starting from right edge
       if (dx < 0 && touchStart.current.x > window.innerWidth - 50) {
          if (onToggleChat) onToggleChat();
       }
    }

    // Pull to Refresh End
    if (pullY > 60) {
      setIsRefreshing(true);
      if (navigator.vibrate) navigator.vibrate(20);
      setPullY(60);
      
      if (onRefresh) {
        onRefresh().finally(() => {
          setIsRefreshing(false);
          setPullY(0);
        });
      } else {
        setTimeout(() => {
          setIsRefreshing(false);
          setPullY(0);
        }, 1000);
      }
    } else {
      setPullY(0);
    }
  };

  const getStatusColor = () => {
    if (!isOnline) return 'bg-error';
    if (isSyncing) return 'bg-warning animate-pulse';
    if (user && lastSynced && (Date.now() - lastSynced > 5 * 60 * 1000)) return 'bg-warning';
    return 'bg-success';
  };
  
  const getViewName = (mode: ViewMode) => {
    const item = navItems.find(i => i.id === mode);
    return item ? item.label : mode;
  };

  return (
    <div className="flex h-screen bg-bg-main text-text-main overflow-hidden relative">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm transition-opacity"
          onClick={toggleSidebar}
        ></div>
      )}

      {/* Desktop/Mobile Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-[260px] bg-bg-panel border-r border-border flex flex-col transition-transform duration-300 transform 
        ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center gap-3 h-16 px-6 border-b border-border">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
             TA
          </div>
          <h1 className="text-lg font-semibold tracking-tight">TaskAssist</h1>
        </div>
        
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setViewMode(item.id); if(window.innerWidth < 1024) toggleSidebar(); }}
              className={`
                w-full flex items-center px-3 py-2.5 text-sm rounded-[6px] transition-all duration-200
                ${viewMode === item.id 
                  ? 'bg-primary/10 text-primary font-medium' 
                  : 'text-text-muted hover:bg-bg-surface hover:text-text-main'}
              `}
            >
              <span className="mr-3 opacity-70 text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border bg-bg-panel">
          {user ? (
            <div className="flex items-center p-2 rounded-[6px] hover:bg-bg-surface transition border border-transparent hover:border-border cursor-pointer">
              {user.avatar && <img src={user.avatar} className="w-8 h-8 rounded-full" alt="avatar" />}
              <div className="ml-3 overflow-hidden flex-1">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                   <div className={`w-1.5 h-1.5 rounded-full ${getStatusColor()}`}></div>
                   <span className="text-xs text-text-muted truncate">
                     {isOnline ? 'В сети' : 'Офлайн'}
                   </span>
                </div>
              </div>
            </div>
          ) : (
             <button 
               onClick={() => AuthService.login('local')} 
               className="w-full btn-secondary text-xs h-9 border-primary/30 text-primary hover:bg-primary/5"
             >
               Войти как Гость
             </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div 
        className="flex-1 flex flex-col min-w-0 overflow-hidden bg-bg-main relative"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull to Refresh Indicator */}
        <div 
          className="absolute top-0 left-0 w-full flex justify-center items-center pointer-events-none transition-transform duration-200 ease-out z-0"
          style={{ height: '60px', transform: `translateY(${pullY - 60}px)` }}
        >
          {isRefreshing ? (
             <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          ) : (
             <span className="text-text-muted text-xs font-bold tracking-widest uppercase">Обновление...</span>
          )}
        </div>

        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between h-14 px-4 bg-bg-surface border-b border-border flex-shrink-0 z-20 pt-safe">
           <div className="flex items-center gap-3">
             <button onClick={toggleSidebar} className="text-2xl leading-none text-text-main">≡</button>
             <div className="flex items-center gap-2">
                <h1 className="font-semibold text-lg capitalize">{getViewName(viewMode)}</h1>
             </div>
           </div>
           <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        </header>

        {/* Scrollable Content Container */}
        <main 
           ref={contentRef}
           className="flex-1 overflow-y-auto p-4 lg:p-8 scroll-smooth z-10 transition-transform duration-200 ease-out pb-24 lg:pb-8"
           style={{ transform: `translateY(${pullY}px)` }}
           onScroll={() => {
              // Hide pull to refresh when scrolling down
              if (pullY > 0) setPullY(0);
           }}
        >
          <div className="max-w-[1200px] mx-auto h-full">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-bg-surface border-t border-border pb-safe z-30 shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex justify-around items-center h-14">
            {navItems.slice(0, 5).map(item => (
              <button
                key={item.id}
                onClick={() => {
                   if (navigator.vibrate) navigator.vibrate(5);
                   setViewMode(item.id);
                }}
                className={`flex flex-col items-center justify-center w-full h-full space-y-0.5 ${viewMode === item.id ? 'text-primary' : 'text-text-disabled'}`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-[9px] font-medium">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* FAB */}
        <button
          onClick={() => {
            if (navigator.vibrate) navigator.vibrate(10);
            onNewTask();
          }}
          className="lg:hidden fixed bottom-20 right-4 w-12 h-12 bg-primary text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-40 active:scale-95 transition-transform"
        >
          +
        </button>
      </div>
    </div>
  );
};
