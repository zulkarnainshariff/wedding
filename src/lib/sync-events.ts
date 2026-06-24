import { EventEmitter } from "events";

export const syncEvents = new EventEmitter();
syncEvents.setMaxListeners(200);

export function notifySyncUpdate(updateId: string) {
  syncEvents.emit("update", updateId);
}
