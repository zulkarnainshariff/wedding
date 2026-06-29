"use client";

import { useEffect, useState } from "react";
import { useOfflineSync } from "@/components/auth/OfflineSyncProvider";
import type { ItineraryItem } from "@/lib/schema";

export function useLinkedItem(linkedItemId?: number | null) {
  const { getCachedItem } = useOfflineSync();
  const [linkedItem, setLinkedItem] = useState<ItineraryItem | null>(() =>
    linkedItemId ? getCachedItem(linkedItemId) : null,
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!linkedItemId) {
      setLinkedItem(null);
      setLoading(false);
      return;
    }

    const cached = getCachedItem(linkedItemId);
    if (cached) {
      setLinkedItem(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(`/api/items/${linkedItemId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((item: ItineraryItem | null) => {
        if (!cancelled) setLinkedItem(item);
      })
      .catch(() => {
        if (!cancelled) setLinkedItem(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [getCachedItem, linkedItemId]);

  useEffect(() => {
    if (!linkedItemId) return;
    const cached = getCachedItem(linkedItemId);
    if (cached) setLinkedItem(cached);
  }, [getCachedItem, linkedItemId]);

  return { linkedItem, loading };
}
