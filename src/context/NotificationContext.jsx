import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../services/api';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  const [notifPermission, setNotifPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window 
      ? Notification.permission 
      : 'unsupported'
  );

  // Initial load
  useEffect(() => {
    async function loadData() {
      try {
        const data = await api.notifications.get();
        setNotifications(data);
      } catch (err) {
        console.error('Failed to load notifications:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    // Background Polling (30s)
    const interval = setInterval(() => loadData(), 30000);
    return () => clearInterval(interval);
  }, []);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return 'unsupported';
    const permission = await Notification.requestPermission();
    setNotifPermission(permission);
    return permission;
  };

  async function addNotification(teacherId, message, type = 'substitution') {
    const notif = {
      id: 'notif_' + Date.now() + Math.random(),
      teacherId,
      message,
      type,
      unread: true,
      timestamp: new Date().toISOString(),
    };
    const updated = [...notifications, notif];
    setNotifications(updated);
    await api.notifications.create(notif);

    // Trigger System Notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          registration.showNotification('RPB Routine Alert', {
            body: message,
            icon: '/pwa-logo.png',
            badge: '/pwa-logo.png',
            vibrate: [200, 100, 200]
          });
        });
      } else {
        new Notification('RPB Routine Alert', {
          body: message,
          icon: '/pwa-logo.png'
        });
      }
    }
  }

  async function markRead(notifId) {
    const updated = notifications.map(n => n.id === notifId ? { ...n, unread: false } : n);
    setNotifications(updated);
    await api.notifications.update(notifId, { unread: false });
  }

  async function markAllRead(teacherId) {
    const updated = notifications.map(n => n.teacherId === teacherId ? { ...n, unread: false } : n);
    setNotifications(updated);
    
    for (const n of updated.filter(n => n.teacherId === teacherId && !n.unread)) {
      await api.notifications.update(n.id, { unread: false });
    }
  }

  function getTeacherNotifications(teacherId) {
    return notifications.filter(n => n.teacherId === teacherId);
  }

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  function dismissToast(id) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  return (
    <NotificationContext.Provider value={{
      notifications, loading, addNotification, markRead, markAllRead,
      getTeacherNotifications, toasts, showToast, dismissToast,
      notifPermission, requestNotificationPermission
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  return useContext(NotificationContext);
}
