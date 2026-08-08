export const GALLERY_PAGE_SIZE = 24;

export function photoPreviewUrl(photo: {
  url: string;
  thumbUrl?: string | null;
}): string {
  return photo.thumbUrl?.trim() || photo.url;
}

/** Prefer album name alone when it matches the event name. */
export function photoLocationLabel(photo: {
  albumName?: string | null;
  eventName: string;
}): string {
  const album = photo.albumName?.trim() ?? "";
  const event = photo.eventName.trim();
  if (album && album.toLowerCase() === event.toLowerCase()) return album;
  if (album) return `${album} · ${event}`;
  return event;
}

export function parseGuestNames(input: string): { guestName: string }[] {
  return parseCommaList(input).map((guestName) => ({ guestName }));
}

export function formatGuestNames(tags: { guestName: string }[]): string {
  return tags.map((tag) => tag.guestName).join(", ");
}

export function parseCommaList(input: string): string[] {
  return [
    ...new Set(
      input
        .split(/[,\n]/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
}

export function formatCommaList(values: string[]): string {
  return values.join(", ");
}
