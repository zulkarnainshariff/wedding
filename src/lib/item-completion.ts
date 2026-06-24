import type { ItineraryItem } from "@/lib/schema";

const COMPLETION_KEY = "_completion";

export type ItemCompletion = {
  completedAt: string;
  completedBy?: string | null;
};

export function getItemCompletion(details: unknown): ItemCompletion | null {
  if (!details || typeof details !== "object") return null;
  const raw = (details as Record<string, unknown>)[COMPLETION_KEY];
  if (!raw || typeof raw !== "object") return null;

  const value = raw as Partial<ItemCompletion>;
  if (!value.completedAt || typeof value.completedAt !== "string") return null;

  return {
    completedAt: value.completedAt,
    completedBy:
      typeof value.completedBy === "string" ? value.completedBy : null,
  };
}

export function isItemCompleted(item: ItineraryItem): boolean {
  return getItemCompletion(item.details) != null;
}

export function withItemCompletion(
  details: Record<string, unknown>,
  completion: ItemCompletion | null,
): Record<string, unknown> {
  const next = { ...details };
  if (completion) {
    next[COMPLETION_KEY] = completion;
  } else {
    delete next[COMPLETION_KEY];
  }
  return next;
}
