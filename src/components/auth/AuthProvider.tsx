"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { GuestListAccess } from "@/lib/guest-list-types";
import type { TaskPermissionAccess } from "@/lib/task-types";
import type { SessionUser } from "@/lib/permissions";
import {
  canEditItinerary,
  canManageUsers as userCanManageUsers,
  canViewCategory,
  isSuperuser,
} from "@/lib/permissions";
import type { Category } from "@/lib/types";

type AuthContextValue = {
  user: SessionUser | null;
  guestListAccess: GuestListAccess[];
  taskPermissions: TaskPermissionAccess[];
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  canView: (category: Category) => boolean;
  canEdit: boolean;
  canManageUsers: boolean;
  isAdmin: boolean;
  canAccessDiagnostics: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [guestListAccess, setGuestListAccess] = useState<GuestListAccess[]>([]);
  const [taskPermissions, setTaskPermissions] = useState<TaskPermissionAccess[]>([]);
  const [loading, setLoading] = useState(pathname !== "/login");

  const refreshUser = useCallback(async () => {
    if (pathname === "/login") {
      setUser(null);
      setGuestListAccess([]);
      setTaskPermissions([]);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/me");
      if (!response.ok) {
        setUser(null);
        setGuestListAccess([]);
        setTaskPermissions([]);
        return;
      }
      const data = await response.json();
      setUser(data.user);
      setGuestListAccess(data.user.guestListAccess ?? []);
      setTaskPermissions(data.user.taskPermissions ?? []);
    } catch {
      setUser(null);
      setGuestListAccess([]);
      setTaskPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [pathname]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    const { clearOfflineCache } = await import("@/lib/offline-store");
    await clearOfflineCache();
    setUser(null);
    router.push("/");
    router.refresh();
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      guestListAccess,
      taskPermissions,
      loading,
      refreshUser,
      logout,
      canView: (category) => (user ? canViewCategory(user, category) : false),
      canEdit: user ? canEditItinerary(user) : false,
      canManageUsers: user ? userCanManageUsers(user) : false,
      isAdmin: user?.isAdmin ?? false,
      canAccessDiagnostics: user ? isSuperuser(user) : false,
    }),
    [user, guestListAccess, taskPermissions, loading, refreshUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
