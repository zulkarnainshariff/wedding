import type { FlightLiveStatus } from "@/lib/flight-tracking";

export type FlightStatusResponse = FlightLiveStatus & {
  detailsUpdated?: boolean;
};

type CacheEntry = {
  data: FlightStatusResponse;
  fetchedAt: number;
  ttlMs: number;
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<FlightStatusResponse>>();

function cacheKey(itemId: number, asOf: string): string {
  return `${itemId}:${asOf}`;
}

function ttlForStatus(status: FlightStatusResponse): number {
  if (!status.available) return 5 * 60_000;

  switch (status.flightStatus) {
    case "landed":
      return 30 * 60_000;
    case "active":
      return (status.remainingMinutes ?? 999) <= 15 ? 90_000 : 3 * 60_000;
    case "scheduled":
      return 5 * 60_000;
    default:
      return 5 * 60_000;
  }
}

function scheduleFetchedKey(itemId: number, asOf: string): string {
  return `flight-schedule-synced:${itemId}:${asOf}`;
}

function hasSyncedSchedule(itemId: number, asOf: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(scheduleFetchedKey(itemId, asOf)) === "1";
  } catch {
    return false;
  }
}

function markScheduleSynced(itemId: number, asOf: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(scheduleFetchedKey(itemId, asOf), "1");
  } catch {
    /* ignore */
  }
}

export function clearFlightStatusCache(itemId?: number) {
  if (itemId == null) {
    cache.clear();
    inflight.clear();
    return;
  }

  for (const key of cache.keys()) {
    if (key.startsWith(`${itemId}:`)) cache.delete(key);
  }
  for (const key of inflight.keys()) {
    if (key.startsWith(`${itemId}:`)) inflight.delete(key);
  }
}

export async function fetchFlightStatus(
  itemId: number,
  asOf: string,
  options?: { force?: boolean; includeSchedule?: boolean },
): Promise<FlightStatusResponse> {
  const key = cacheKey(itemId, asOf);
  const force = options?.force ?? false;
  const includeSchedule =
    options?.includeSchedule ?? !hasSyncedSchedule(itemId, asOf);

  const cached = cache.get(key);
  if (!force && cached && Date.now() - cached.fetchedAt < cached.ttlMs) {
    return cached.data;
  }

  const pending = inflight.get(key);
  if (pending && !force) return pending;

  const request = (async () => {
    const params = new URLSearchParams({ asOf });
    if (includeSchedule) params.set("schedule", "1");

    const response = await fetch(
      `/api/flights/${itemId}/status?${params.toString()}`,
      { cache: "no-store" },
    );

    const data = (response.ok
      ? await response.json()
      : {
          available: false,
          reason: "provider_error",
          message: "Unable to load live flight data.",
        }) as FlightStatusResponse;

    if (includeSchedule && response.ok) {
      markScheduleSynced(itemId, asOf);
    }

    cache.set(key, {
      data,
      fetchedAt: Date.now(),
      ttlMs: ttlForStatus(data),
    });

    return data;
  })();

  inflight.set(key, request);

  try {
    return await request;
  } finally {
    inflight.delete(key);
  }
}

export function pollIntervalForStatus(status: FlightStatusResponse | null): number | null {
  if (!status?.available) return null;
  if (status.flightStatus === "landed" || status.computedOnly) return null;

  if (status.flightStatus === "active") {
    return (status.remainingMinutes ?? 999) <= 15 ? 90_000 : 3 * 60_000;
  }

  return 5 * 60_000;
}
