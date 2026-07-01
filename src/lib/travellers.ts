export function normalizeTravellerName(name: string): string {
  return name.trim();
}

export function normalizeTravellerList(names: string[]): string[] {
  return names.map(normalizeTravellerName).filter(Boolean);
}

export function normalizeTravellerRecord<T>(
  record: Record<string, T>,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      normalizeTravellerName(key),
      value,
    ]),
  );
}

export function normalizeGuestText(text: string): string {
  return text.trim();
}

export function normalizeNotes(notes?: string[]): string[] | undefined {
  if (!notes) return notes;
  return notes.map(normalizeGuestText);
}
