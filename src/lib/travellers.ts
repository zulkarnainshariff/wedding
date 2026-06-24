export const TRAVELLER_ALIASES: Record<string, string> = {
  Papa: "Zulkarnain",
  Nenek: "Zaiton",
  Angah: "Asmah",
  Nat: "Natalie",
};

export const TRAVELLER_NAMES = [
  "Zaiton",
  "Zulkarnain",
  "Natalie",
  "Nadya",
  "Nadra",
  "Asmah",
  "Kamal",
  "Everyone",
] as const;

export function normalizeTravellerName(name: string): string {
  return TRAVELLER_ALIASES[name] ?? name;
}

export function normalizeTravellerList(names: string[]): string[] {
  return names.map(normalizeTravellerName);
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeGuestText(text: string): string {
  return Object.entries(TRAVELLER_ALIASES).reduce((result, [from, to]) => {
    const regex = new RegExp(`\\b${escapeRegExp(from)}\\b`, "g");
    return result.replace(regex, to);
  }, text);
}

export function normalizeNotes(notes?: string[]): string[] | undefined {
  if (!notes) return notes;
  return notes.map(normalizeGuestText);
}
