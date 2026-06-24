"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type NavigationGuardContextValue = {
  setGuard: (guard: (() => boolean) | null) => void;
  confirmNavigation: () => boolean;
};

const NavigationGuardContext =
  createContext<NavigationGuardContextValue | null>(null);

export function NavigationGuardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [guard, setGuardState] = useState<(() => boolean) | null>(null);

  const setGuard = useCallback((next: (() => boolean) | null) => {
    setGuardState(() => next);
  }, []);

  const confirmNavigation = useCallback(() => {
    if (!guard) return true;
    return guard();
  }, [guard]);

  return (
    <NavigationGuardContext.Provider value={{ setGuard, confirmNavigation }}>
      {children}
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  return useContext(NavigationGuardContext);
}

export function useUnsavedChangesGuard(
  isDirty: boolean,
  message = "You have unsaved changes. Leave without saving?",
) {
  const { setGuard } = useNavigationGuard() ?? { setGuard: () => {} };

  const guard = useCallback(() => {
    if (!isDirty) return true;
    return window.confirm(message);
  }, [isDirty, message]);

  useEffect(() => {
    if (!setGuard) return;
    setGuard(isDirty ? guard : null);
    return () => setGuard(null);
  }, [isDirty, guard, setGuard]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);
}
