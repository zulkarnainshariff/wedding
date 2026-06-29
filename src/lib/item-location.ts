export type ItemLocation = {
  name?: string;
  mapLink?: string;
  airportCode?: string;
  plusCode?: string;
};

export type ItemMapLink = {
  href: string;
  label?: string;
};

function trimUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

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

export function getItemMapLink(
  details: Record<string, unknown> | null | undefined,
  category?: string,
): ItemMapLink | null {
  if (!details) return null;

  const shared = getItemLocation(details);
  const sharedLink = trimUrl(shared?.mapLink);
  if (sharedLink) {
    return { href: sharedLink, label: shared?.name };
  }

  const topLevelMapUrl = trimUrl(details.mapUrl);
  if (topLevelMapUrl) {
    const locationName =
      typeof details.location === "string"
        ? details.location.trim()
        : typeof details.locationName === "string"
          ? details.locationName.trim()
          : typeof details.pickupLocation === "string"
            ? details.pickupLocation.trim()
            : undefined;

    return {
      href: topLevelMapUrl,
      label: locationName || shared?.name,
    };
  }

  if (category === "activity") {
    const location = details.location;
    if (location && typeof location === "object") {
      const mapLink = trimUrl((location as ItemLocation).mapLink);
      if (mapLink) {
        const name = trimUrl((location as ItemLocation).name);
        return { href: mapLink, label: name };
      }
    }
  }

  return null;
}
