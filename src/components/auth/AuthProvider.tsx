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
  guestbookEnabled: boolean;
  loading: boolean;
  elevatedAdmin: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  elevateAdmin: (
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  dropAdminElevation: () => Promise<void>;
  canView: (category: Category) => boolean;
  canEdit: boolean;
  canManageUsers: boolean;
  isAdmin: boolean;
  canAccessDiagnostics: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  hasSession = true,
}: {
  children: React.ReactNode;
  hasSession?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [guestListAccess, setGuestListAccess] = useState<GuestListAccess[]>([]);
  const [taskPermissions, setTaskPermissions] = useState<TaskPermissionAccess[]>([]);
  const [guestbookEnabled, setGuestbookEnabled] = useState(false);
  const [loading, setLoading] = useState(
    pathname !== "/login" && hasSession,
  );

  const refreshUser = useCallback(async () => {
    if (pathname === "/login") {
      setUser(null);
      setGuestListAccess([]);
      setTaskPermissions([]);
      setGuestbookEnabled(false);
      setLoading(false);
      return;
    }

    if (!hasSession) {
      setUser(null);
      setGuestListAccess([]);
      setTaskPermissions([]);
      setGuestbookEnabled(false);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/me");
      if (!response.ok) {
        setUser(null);
        setGuestListAccess([]);
        setTaskPermissions([]);
        setGuestbookEnabled(false);
        return;
      }
      const data = await response.json();
      setUser(data.user);
      setGuestListAccess(data.user.guestListAccess ?? []);
      setTaskPermissions(data.user.taskPermissions ?? []);
      setGuestbookEnabled(Boolean(data.user.guestbookEnabled));
    } catch {
      setUser(null);
      setGuestListAccess([]);
      setTaskPermissions([]);
      setGuestbookEnabled(false);
    } finally {
      setLoading(false);
    }
  }, [pathname, hasSession]);

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

  const elevateAdmin = useCallback(async (password: string) => {
    const response = await fetch("/api/auth/elevate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        ok: false,
        error: typeof data.error === "string" ? data.error : "Invalid admin password",
      };
    }
    await refreshUser();
    return { ok: true };
  }, [refreshUser]);

  const dropAdminElevation = useCallback(async () => {
    await fetch("/api/auth/de-elevate", { method: "POST" });
    await refreshUser();
  }, [refreshUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      guestListAccess,
      taskPermissions,
      guestbookEnabled,
      loading,
      elevatedAdmin: Boolean(user?.elevatedAdmin),
      refreshUser,
      logout,
      elevateAdmin,
      dropAdminElevation,
      canView: (category) => (user ? canViewCategory(user, category) : false),
      canEdit: user ? canEditItinerary(user) : false,
      canManageUsers: user ? userCanManageUsers(user) : false,
      isAdmin: user?.isAdmin ?? false,
      canAccessDiagnostics: user ? isSuperuser(user) : false,
    }),
    [
      user,
      guestListAccess,
      taskPermissions,
      guestbookEnabled,
      loading,
      refreshUser,
      logout,
      elevateAdmin,
      dropAdminElevation,
    ],
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
