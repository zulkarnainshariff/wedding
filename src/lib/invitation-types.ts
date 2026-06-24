export type InvitationCardFront = {
  headline: string;
  coupleNames: string;
  dateLine: string;
  venue: string;
  location: string;
  mapsUrl?: string;
  tagline?: string;
};

export type PublicInvitationEvent = {
  id: number;
  slug: string;
  name: string;
  eventDate: string;
  location: string | null;
  cardFront: InvitationCardFront;
  sortOrder: number;
};

export type PublicScheduleItem = {
  id: number;
  eventId: number;
  timeLabel: string;
  title: string;
  description: string | null;
  sortOrder: number;
};

export const DEFAULT_CARD_FRONT: InvitationCardFront = {
  headline: "You're invited",
  coupleNames: "Natalie & Zulkarnain",
  dateLine: "",
  venue: "",
  location: "",
  tagline: "We would be honoured by your presence",
};
