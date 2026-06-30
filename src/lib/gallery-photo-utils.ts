export function parseGuestNames(input: string): { guestName: string }[] {
  return input
    .split(/[,\n]/)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((guestName) => ({ guestName }));
}

export function formatGuestNames(tags: { guestName: string }[]): string {
  return tags.map((tag) => tag.guestName).join(", ");
}
