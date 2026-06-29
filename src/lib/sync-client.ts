export const SYNC_UPDATED_EVENT = "wedding:sync-updated";

export type SyncUpdatedDetail = {
  updateId: string;
};

export function dispatchSyncUpdated(detail: SyncUpdatedDetail) {
  window.dispatchEvent(
    new CustomEvent<SyncUpdatedDetail>(SYNC_UPDATED_EVENT, { detail }),
  );
}

export function subscribeSyncUpdated(
  listener: (detail: SyncUpdatedDetail) => void,
) {
  const handler = (event: Event) => {
    listener((event as CustomEvent<SyncUpdatedDetail>).detail);
  };
  window.addEventListener(SYNC_UPDATED_EVENT, handler);
  return () => window.removeEventListener(SYNC_UPDATED_EVENT, handler);
}
