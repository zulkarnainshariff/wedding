export const GALLERY_PAGE_SIZE = 36;

export function photoPreviewUrl(photo: {
  url: string;
  thumbUrl?: string | null;
}): string {
  return photo.thumbUrl?.trim() || photo.url;
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
