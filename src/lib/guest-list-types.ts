export const RSVP_STATUSES = [
  "attending",
  "not_attending",
  "not_responded",
  "not_confirmed",
] as const;

export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export const RSVP_STATUS_LABELS: Record<RsvpStatus, string> = {
  attending: "Attending",
  not_attending: "Not attending",
  not_responded: "Have not responded",
  not_confirmed: "Not confirmed",
};

/** Labels for summary stat cards (invitation counts, not guest headcount). */
export const RSVP_SUMMARY_STAT_LABELS: Record<RsvpStatus, string> = {
  attending: "Invitations confirmed",
  not_attending: "Invitations declined",
  not_responded: "Awaiting response",
  not_confirmed: "Not confirmed",
};

export type GuestListAccess = {
  eventId: number;
  eventSlug: string;
  eventName: string;
  canView: boolean;
  canEdit: boolean;
  isWeddingCoordinator?: boolean;
  canModerateGuestbook?: boolean;
};

export type GuestMemberInput = {
  id?: number;
  name: string;
  under13?: boolean;
  attending?: boolean;
  sortOrder?: number;
};

export type GuestRecord = {
  id: number;
  eventId: number;
  inviteToken: string;
  label: string;
  allowIncludeFamily: boolean;
  expectedHeadcount: number;
  rsvpStatus: RsvpStatus;
  rsvpAttendingCount: number | null;
  rsvpNotes: string | null;
  adminNotes: string | null;
  contactEmail: string | null;
  sortOrder: number;
  members: GuestMemberInput[];
};

export function isRsvpStatus(value: string): value is RsvpStatus {
  return RSVP_STATUSES.includes(value as RsvpStatus);
}

export function buildRsvpUrl(token: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/rsvp?token=${token}`;
  }
  return `/rsvp?token=${token}`;
}
