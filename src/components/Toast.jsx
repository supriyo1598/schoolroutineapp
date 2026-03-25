import { useNotification } from '../context/NotificationContext';

export default function Toast() {
  const { toasts, dismissToast } = useNotification();

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className={`toast toast-${toast.type}`}>
          <span className="toast-icon">
            {toast.type === 'error' ? '✕' : toast.type === 'success' ? '✓' : 'ℹ'}
          </span>
          <span className="toast-message">{toast.message}</span>
          <button className="toast-close" onClick={() => dismissToast(toast.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
