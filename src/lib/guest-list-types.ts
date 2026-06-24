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

export type GuestListAccess = {
  eventId: number;
  eventSlug: string;
  eventName: string;
  canView: boolean;
  canEdit: boolean;
};

export type GuestMemberInput = {
  id?: number;
  name: string;
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
