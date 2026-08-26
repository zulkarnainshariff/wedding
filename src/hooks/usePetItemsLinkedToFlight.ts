"use client";

import { useEffect, useState } from "react";
import { useOfflineSync } from "@/components/auth/OfflineSyncProvider";
import type { ItineraryItem } from "@/lib/schema";
import { getPetRelocationDetails } from "@/lib/types";

export function usePetItemsLinkedToFlight(flightItemId?: number | null) {
  const { getCachedItem } = useOfflineSync();
  const [petItems, setPetItems] = useState<ItineraryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!flightItemId) {
      setPetItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    function applyItems(items: ItineraryItem[]) {
      if (cancelled) return;
      setPetItems(
        items.filter((item) => {
          if (item.category !== "pet_relocation") return false;
          const details = getPetRelocationDetails(item.details);
          return details?.linkedItemId === flightItemId;
        }),
      );
    }

    setLoading(true);
    fetch("/api/items?category=pet_relocation")
      .then((response) => (response.ok ? response.json() : []))
      .then((items: ItineraryItem[]) => {
        applyItems(items);
      })
      .catch(() => {
        if (!cancelled) setPetItems([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [flightItemId, getCachedItem]);

  return { petItems, loading };
}
