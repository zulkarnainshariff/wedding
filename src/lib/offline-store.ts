const DB_NAME = "wedding-itinerary";
const STORE_NAME = "cache";
const CACHE_KEY = "itinerary";

export type OfflineCache = {
  updateId: string;
  days: import("./schema").ItineraryDay[];
  items: import("./schema").ItineraryItem[];
  cachedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export async function readOfflineCache(): Promise<OfflineCache | null> {
  if (typeof indexedDB === "undefined") return null;

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(CACHE_KEY);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve((request.result as OfflineCache) ?? null);
  });
}

export async function writeOfflineCache(data: OfflineCache): Promise<void> {
  if (typeof indexedDB === "undefined") return;

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(data, CACHE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearOfflineCache(): Promise<void> {
  if (typeof indexedDB === "undefined") return;

  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(CACHE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
