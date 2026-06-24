export type ItemLocation = {
  name?: string;
  mapLink?: string;
  airportCode?: string;
  plusCode?: string;
};

export function getItemLocation(
  details: Record<string, unknown> | null | undefined,
): ItemLocation | null {
  if (!details) return null;

  if (details.location && typeof details.location === "object") {
    return details.location as ItemLocation;
  }

  const name = details.locationName
    ? String(details.locationName)
    : undefined;
  const mapLink = details.locationMapUrl
    ? String(details.locationMapUrl)
    : undefined;

  if (!name && !mapLink) return null;
  return { name, mapLink };
}

export function buildLocationPayload(
  name?: string,
  mapLink?: string,
): ItemLocation | undefined {
  if (!name && !mapLink) return undefined;
  return {
    name: name || undefined,
    mapLink: mapLink || undefined,
  };
}
