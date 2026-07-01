import {
  travellerMatchesUsername,
  usernameToTravellerName,
} from "@/lib/item-travellers";
import { extractItemAdditionalViewers } from "@/lib/item-viewers";
import {
  userIsAdditionalViewer,
  userIsItemParticipant,
} from "@/lib/item-privacy";
import type { SessionUser } from "@/lib/permissions";
import type { ItineraryItem } from "@/lib/schema";
import { normalizeTravellerName } from "@/lib/travellers";

export type ViewerLinks = Record<string, string[]>;

export function extractViewerLinks(details: unknown): ViewerLinks {
  if (!details || typeof details !== "object") return {};
  const raw = (details as Record<string, unknown>).viewerLinks;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};

  const links: ViewerLinks = {};
  for (const [viewer, linked] of Object.entries(raw)) {
    if (!Array.isArray(linked)) continue;
    const participants = linked
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => normalizeTravellerName(entry))
      .filter(Boolean);
    if (participants.length === 0) continue;
    links[normalizeTravellerName(viewer)] = participants;
  }
  return links;
}

export function parseViewerLinks(raw: unknown): ViewerLinks {
  return extractViewerLinks({ viewerLinks: raw });
}

export function pruneViewerLinks(
  viewers: string[],
  links: ViewerLinks,
): ViewerLinks {
  const next: ViewerLinks = {};
  for (const viewer of viewers) {
    const key = normalizeTravellerName(viewer);
    if (links[key]?.length) {
      next[key] = links[key];
    }
  }
  return next;
}

export function normalizeViewerLinksPayload(links: ViewerLinks): ViewerLinks {
  const next: ViewerLinks = {};
  for (const [viewer, linked] of Object.entries(links)) {
    const key = normalizeTravellerName(viewer);
    const participants = [
      ...new Set(
        linked
          .map((name) => normalizeTravellerName(name))
          .filter(Boolean),
      ),
    ];
    if (participants.length > 0) {
      next[key] = participants;
    }
  }
  return next;
}

export function getLinkedParticipantsForViewer(
  details: unknown,
  viewerName: string,
): string[] {
  const links = extractViewerLinks(details);
  return links[normalizeTravellerName(viewerName)] ?? [];
}

export function getViewerLinkedParticipantsForUser(
  item: ItineraryItem,
  user: SessionUser,
): string[] | null {
  if (userIsItemParticipant(item, user)) return null;
  if (!userIsAdditionalViewer(item, user)) return null;

  const viewers = extractItemAdditionalViewers(item.details);
  for (const viewer of viewers) {
    if (travellerMatchesUsername(viewer, user.username)) {
      return getLinkedParticipantsForViewer(item.details, viewer);
    }
  }

  return [];
}

export function viewerLinkLabel(participants: string[]): string | null {
  if (participants.length === 0) return null;
  return participants.join(", ");
}

export function displayNameForViewerAccount(username: string): string {
  return usernameToTravellerName(username);
}
