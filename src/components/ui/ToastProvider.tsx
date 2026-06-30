"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type ToastVariant = "success" | "error" | "info";

export type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toast: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, message, variant }]);
      window.setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      toast: show,
      success: (message: string) => show(message, "success"),
      error: (message: string) => show(message, "error"),
    }),
    [show],
  );

  const toastLayer =
    mounted && toasts.length > 0
      ? createPortal(
          <div
            aria-live="polite"
            className="pointer-events-none fixed top-4 right-4 z-[200] flex max-w-sm flex-col gap-2 sm:top-6 sm:right-6"
          >
            {toasts.map((entry) => (
              <div
                key={entry.id}
                className={[
                  "pointer-events-auto rounded-xl border px-4 py-3 text-sm font-medium shadow-lg backdrop-blur-sm",
                  entry.variant === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                    : entry.variant === "error"
                      ? "border-red-200 bg-red-50 text-red-800"
                      : "border-stone-200 bg-white/95 text-stone-800",
                ].join(" ")}
              >
                {entry.message}
              </div>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toastLayer}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
