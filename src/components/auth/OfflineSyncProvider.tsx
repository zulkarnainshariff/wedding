"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useTripTime } from "@/components/itinerary/TripTimeContext";
import { shouldFetchFlightLiveStatus } from "@/lib/flight-live-eligibility";
import {
  readOfflineCache,
  writeOfflineCache,
  type OfflineCache,
} from "@/lib/offline-store";
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
  const { effectiveDate, effectiveDateString } = useTripTime();
  const [updateId, setUpdateId] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [cache, setCache] = useState<OfflineCache | null>(null);
  const updateIdRef = useRef<string | null>(null);
  const syncInFlightRef = useRef(false);
  const flightRefreshKeyRef = useRef<string | null>(null);

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
        router.refresh();
      }
    },
    [router],
  );

  const syncNow = useCallback(async () => {
    if (typeof window === "undefined" || syncInFlightRef.current) return;

    syncInFlightRef.current = true;
    setSyncing(true);
    try {
      const existing = await readOfflineCache();
      const query = existing?.updateId ? `?updateId=${existing.updateId}` : "";
      const response = await fetchSync(
        query,
        AbortSignal.timeout(SYNC_TIMEOUT_MS),
      );

      if (response.status === 304 && existing) {
        applyCache(existing);
        setIsOffline(false);
        return;
      }

      if (!response.ok) {
        if (existing) applyCache(existing);
        return;
      }

      const data = await response.json();
      const payload: OfflineCache = {
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
  }, [applyCache, publishSyncUpdate]);

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
    void readOfflineCache().then((existing) => {
      if (existing) applyCache(existing);
    });
  }, [applyCache]);

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
    if (!user || !cache?.items?.length) return;

    const key = `${user.id}:${cache.cachedAt}`;
    if (flightRefreshKeyRef.current === key) return;
    flightRefreshKeyRef.current = key;

    for (const item of cache.items) {
      if (item.category !== "flight" || !item.id) continue;
      if (!shouldFetchFlightLiveStatus(item, effectiveDate)) continue;
      void fetch(
        `/api/flights/${item.id}/status?asOf=${encodeURIComponent(effectiveDateString)}`,
        { cache: "no-store" },
      );
    }
  }, [user, cache, effectiveDate, effectiveDateString]);

  const getCachedItem = useCallback(
    (id: number) => cache?.items.find((item) => item.id === id) ?? null,
    [cache],
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
