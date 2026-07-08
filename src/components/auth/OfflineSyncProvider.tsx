"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  readOfflineCache,
  writeOfflineCache,
  clearOfflineCache,
  type OfflineCache,
} from "@/lib/offline-store";
import { canViewItemTravellers } from "@/lib/permissions";
import { dispatchSyncUpdated } from "@/lib/sync-client";

type SyncCheckResult = "upToDate" | "updateAvailable" | "offline" | "error";

type OfflineSyncContextValue = {
  updateId: string | null;
  lastSyncedAt: string | null;
  syncing: boolean;
  isOffline: boolean;
  syncNow: () => Promise<void>;
  checkForUpdates: () => Promise<SyncCheckResult>;
  getCachedItem: (id: number) => OfflineCache["items"][number] | null;
};

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);
const IS_DEV = process.env.NODE_ENV === "development";
const SYNC_TIMEOUT_MS = IS_DEV ? 10_000 : 60_000;

async function fetchSync(query: string, signal?: AbortSignal) {
  return fetch(`/api/sync${query}`, { signal });
}

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [updateId, setUpdateId] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [cache, setCache] = useState<OfflineCache | null>(null);
  const updateIdRef = useRef<string | null>(null);
  const syncInFlightRef = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    updateIdRef.current = updateId;
  }, [updateId]);

  const applyCache = useCallback((payload: OfflineCache) => {
    setCache(payload);
    setUpdateId(payload.updateId);
    setLastSyncedAt(payload.cachedAt);
  }, []);

  const publishSyncUpdate = useCallback(
    (payload: OfflineCache) => {
      const previousId = updateIdRef.current;
      if (previousId && previousId !== payload.updateId) {
        dispatchSyncUpdated({ updateId: payload.updateId });
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current);
        }
        refreshTimerRef.current = setTimeout(() => {
          router.refresh();
        }, 300);
      }
    },
    [router],
  );

  const syncNow = useCallback(async () => {
    if (typeof window === "undefined" || syncInFlightRef.current || !user) return;

    syncInFlightRef.current = true;
    setSyncing(true);
    try {
      const existing = await readOfflineCache();
      const cacheMatchesUser = existing?.userId === user.id;
      const query =
        cacheMatchesUser && existing?.updateId
          ? `?updateId=${existing.updateId}`
          : "";
      const response = await fetchSync(
        query,
        AbortSignal.timeout(SYNC_TIMEOUT_MS),
      );

      if (response.status === 304 && existing && cacheMatchesUser) {
        applyCache(existing);
        setIsOffline(false);
        return;
      }

      if (!response.ok) {
        if (existing && cacheMatchesUser) applyCache(existing);
        return;
      }

      const data = await response.json();
      const payload: OfflineCache = {
        userId: user.id,
        updateId: data.updateId,
        days: data.days,
        items: data.items,
        cachedAt: new Date().toISOString(),
      };
      await writeOfflineCache(payload);
      applyCache(payload);
      publishSyncUpdate(payload);
      setIsOffline(false);
    } catch {
      const existing = await readOfflineCache();
      if (existing) applyCache(existing);
      setIsOffline(!navigator.onLine);
    } finally {
      syncInFlightRef.current = false;
      setSyncing(false);
    }
  }, [applyCache, publishSyncUpdate, user]);

  const checkForUpdates = useCallback(async (): Promise<SyncCheckResult> => {
    if (!navigator.onLine) return "offline";
    try {
      const existing = await readOfflineCache();
      const query = existing?.updateId ? `?updateId=${existing.updateId}` : "";
      const response = await fetchSync(
        query,
        AbortSignal.timeout(SYNC_TIMEOUT_MS),
      );
      if (response.status === 304) return "upToDate";
      if (response.ok) return "updateAvailable";
      return "error";
    } catch {
      return "error";
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    void readOfflineCache().then((existing) => {
      if (existing?.userId === user.id) {
        applyCache(existing);
      } else if (existing) {
        void clearOfflineCache();
      }
    });
  }, [applyCache, authLoading, user]);

  useEffect(() => {
    if (authLoading || !user) return;
    void syncNow();
  }, [authLoading, user, syncNow]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      void syncNow();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncNow]);

  useEffect(() => {
    if (authLoading || !user || typeof window === "undefined") return;

    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      source?.close();
      source = new EventSource("/api/sync/stream");
      source.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as { updateId?: string };
          if (
            payload.updateId &&
            updateIdRef.current &&
            payload.updateId !== updateIdRef.current
          ) {
            void syncNow();
          }
        } catch {
          /* ignore malformed events */
        }
      };
      source.onerror = () => {
        source?.close();
        reconnectTimer = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      source?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [authLoading, user, syncNow]);

  useEffect(() => {
    if (authLoading || !user) return;

    const interval = window.setInterval(() => {
      void checkForUpdates().then((result) => {
        if (result === "updateAvailable") {
          void syncNow();
        }
      });
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [authLoading, user, checkForUpdates, syncNow]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  const getCachedItem = useCallback(
    (id: number) => {
      if (!user || cache?.userId !== user.id) return null;
      const item = cache.items.find((entry) => entry.id === id) ?? null;
      if (!item) return null;
      return canViewItemTravellers(item, user) ? item : null;
    },
    [cache, user],
  );

  return (
    <OfflineSyncContext.Provider
      value={{
        updateId,
        lastSyncedAt,
        syncing,
        isOffline,
        syncNow,
        checkForUpdates,
        getCachedItem,
      }}
    >
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSync() {
  const context = useContext(OfflineSyncContext);
  if (!context) {
    throw new Error("useOfflineSync must be used within OfflineSyncProvider");
  }
  return context;
}
