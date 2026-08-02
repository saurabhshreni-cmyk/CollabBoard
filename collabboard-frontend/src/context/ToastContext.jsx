import { createContext, useContext, useCallback, useState, useRef } from 'react';

const ToastContext = createContext({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 1;

const TYPE_STYLES = {
  success: { bar: 'bg-emerald-500', icon: '✓' },
  error: { bar: 'bg-red-500', icon: '✕' },
  info: { bar: 'bg-blue-500', icon: 'ℹ' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    );
    // Remove after the slide-out animation.
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 250);
  }, []);

  const showToast = useCallback(
    (message, type = 'info', duration = 3000) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, type, leaving: false }]);
      timers.current[id] = setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[1000] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => {
          const style = TYPE_STYLES[toast.type] || TYPE_STYLES.info;
          return (
            <div
              key={toast.id}
              onClick={() => dismiss(toast.id)}
              className={`pointer-events-auto cursor-pointer flex items-center gap-3 min-w-[240px] max-w-sm bg-gray-800 border border-gray-700 text-gray-100 rounded-lg shadow-lg overflow-hidden transition-all duration-250 ${
                toast.leaving
                  ? 'opacity-0 translate-x-6'
                  : 'opacity-100 translate-x-0'
              }`}
            >
              <span className={`w-1.5 self-stretch ${style.bar}`} />
              <span
                className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs text-white ${style.bar}`}
              >
                {style.icon}
              </span>
              <span className="py-2.5 pr-3 text-sm">{toast.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
