import type { ItemDocument, ItineraryItem } from "@/lib/schema";
import { normalizeTravellerName } from "@/lib/travellers";
import { extractItemTravellers } from "@/lib/item-travellers";

/** Shared copy for document upload/edit UI */
export const DOCUMENT_LINKED_TRAVELLERS_LABEL =
  "Document linked to these travellers";
export const ADDITIONAL_VIEWERS_LABEL = "Additional viewers allowed";

export function parseExtraViewers(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function parseCoveredTravellers(
  doc: Pick<ItemDocument, "travellerName" | "coversTravellers">,
): string[] {
  const covered = Array.isArray(doc.coversTravellers)
    ? doc.coversTravellers
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => normalizeTravellerName(entry))
        .filter(Boolean)
    : [];

  if (covered.length > 0) {
    return [...new Set(covered)];
  }

  return doc.travellerName ? [normalizeTravellerName(doc.travellerName)] : [];
}

export function extractTravellerOptions(item: ItineraryItem): string[] {
  const names = extractItemTravellers(item.details, item.category);
  return [...new Set(names.map(normalizeTravellerName))].sort();
}

export function formatExtraViewersInput(raw: unknown): string {
  return parseExtraViewers(raw).join(", ");
}

export function parseExtraViewersInput(raw: string): string[] {
  return parseExtraViewers(
    raw
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}
