"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOfflineSync } from "@/components/auth/OfflineSyncProvider";
import { subscribeSyncUpdated } from "@/lib/sync-client";
import type { ItineraryItem } from "@/lib/schema";

export type ViewMode = "condensed" | "detailed";

type ItemLoadError = "not_found" | "forbidden" | null;

type ItineraryUIContextValue = {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  selectedItemId: number | null;
  openItem: (id: number) => void;
  closeItem: () => void;
  selectedItem: ItineraryItem | null;
  loadingItem: boolean;
  itemLoadError: ItemLoadError;
  isClosingItem: boolean;
  refreshSelectedItem: (options?: { silent?: boolean }) => Promise<void>;
};

const ItineraryUIContext = createContext<ItineraryUIContextValue | null>(null);

const STORAGE_KEY = "wedding-itinerary-view-mode";

export function ItineraryUIProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const itemParam = searchParams.get("item");

  const [viewMode, setViewModeState] = useState<ViewMode>("condensed");
  const [selectedItem, setSelectedItem] = useState<ItineraryItem | null>(null);
  const [loadingItem, setLoadingItem] = useState(false);
  const [itemLoadError, setItemLoadError] = useState<ItemLoadError>(null);
  const [isClosingItem, setIsClosingItem] = useState(false);
  const { getCachedItem, updateId } = useOfflineSync();

  const selectedItemId = itemParam ? Number(itemParam) : null;

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "condensed" || stored === "detailed") {
      setViewModeState(stored);
    }
  }, []);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, []);

  const closeItem = useCallback(() => {
    setIsClosingItem(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("item");
    params.delete("task");
    params.delete("createTask");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const openItem = useCallback(
    (id: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("item", String(id));
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const refreshSelectedItem = useCallback(async (options?: { silent?: boolean }) => {
    if (!selectedItemId || Number.isNaN(selectedItemId)) return;

    if (!options?.silent) {
      setLoadingItem(true);
    }
    try {
      const response = await fetch(`/api/items/${selectedItemId}`);
      if (response.ok) {
        setItemLoadError(null);
        setSelectedItem(await response.json());
        return;
      }
      if (response.status === 403) {
        setItemLoadError("forbidden");
        setSelectedItem(getCachedItem(selectedItemId));
        return;
      }
      if (response.status === 404) {
        setItemLoadError("not_found");
        setSelectedItem(null);
        return;
      }
      setItemLoadError(null);
      setSelectedItem(getCachedItem(selectedItemId));
    } catch {
      setItemLoadError(null);
      setSelectedItem(getCachedItem(selectedItemId));
    } finally {
      if (!options?.silent) {
        setLoadingItem(false);
      }
    }
  }, [selectedItemId, getCachedItem]);

  useEffect(() => {
    if (!selectedItemId || Number.isNaN(selectedItemId)) {
      setSelectedItem(null);
      setItemLoadError(null);
      setLoadingItem(false);
      setIsClosingItem(false);
      return;
    }

    setIsClosingItem(false);
    setItemLoadError(null);
    let cancelled = false;
    setLoadingItem(true);

    fetch(`/api/items/${selectedItemId}`)
      .then(async (res) => {
        if (res.ok) {
          setItemLoadError(null);
          return res.json();
        }
        if (res.status === 403) {
          if (!cancelled) setItemLoadError("forbidden");
          return getCachedItem(selectedItemId);
        }
        if (res.status === 404) {
          if (!cancelled) setItemLoadError("not_found");
          return null;
        }
        if (!cancelled) setItemLoadError(null);
        return getCachedItem(selectedItemId);
      })
      .then((data) => {
        if (!cancelled) setSelectedItem(data);
      })
      .catch(() => {
        if (!cancelled) {
          setItemLoadError(null);
          setSelectedItem(getCachedItem(selectedItemId));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingItem(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedItemId, getCachedItem]);

  useEffect(() => {
    if (!selectedItemId || Number.isNaN(selectedItemId)) return;
    const cached = getCachedItem(selectedItemId);
    if (cached) {
      setSelectedItem(cached);
    }
  }, [selectedItemId, getCachedItem, updateId]);

  useEffect(() => {
    if (!selectedItemId || Number.isNaN(selectedItemId)) return;
    return subscribeSyncUpdated(() => {
      void refreshSelectedItem({ silent: true });
    });
  }, [selectedItemId, refreshSelectedItem]);

  useEffect(() => {
    if (!selectedItemId || isClosingItem) {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      for (const element of document.querySelectorAll<HTMLElement>(
        "[data-page-scroll]",
      )) {
        element.style.overflow = "";
      }
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeItem();
    };

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    for (const element of document.querySelectorAll<HTMLElement>(
      "[data-page-scroll]",
    )) {
      element.style.overflow = "hidden";
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      for (const element of document.querySelectorAll<HTMLElement>(
        "[data-page-scroll]",
      )) {
        element.style.overflow = "";
      }
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedItemId, isClosingItem, closeItem]);

  return (
    <ItineraryUIContext.Provider
      value={{
        viewMode,
        setViewMode,
        selectedItemId,
        openItem,
        closeItem,
        selectedItem,
        loadingItem,
        itemLoadError,
        isClosingItem,
        refreshSelectedItem,
      }}
    >
      {children}
    </ItineraryUIContext.Provider>
  );
}

export function useItineraryUI() {
  const context = useContext(ItineraryUIContext);
  if (!context) {
    throw new Error("useItineraryUI must be used within ItineraryUIProvider");
  }
  return context;
}
