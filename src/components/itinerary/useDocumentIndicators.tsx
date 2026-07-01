"use client";

import { useEffect, useState } from "react";
import { subscribeSyncUpdated } from "@/lib/sync-client";
import { ItemDocumentIcon } from "@/components/itinerary/ItemDocumentIcon";

export function useDocumentIndicators() {
  const [counts, setCounts] = useState<Record<number, number>>({});

  const refresh = () => {
    void fetch("/api/items/document-indicators")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) {
          setCounts(data.counts ?? {});
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    refresh();
    const unsubscribeSync = subscribeSyncUpdated(() => refresh());
    const interval = window.setInterval(refresh, 30000);
    return () => {
      unsubscribeSync();
      window.clearInterval(interval);
    };
  }, []);

  return counts;
}

export function ItemDocumentIndicator({ count }: { count?: number }) {
  if (!count) return null;
  return <ItemDocumentIcon count={count} />;
}
