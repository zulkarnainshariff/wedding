import type { RsvpStatus } from "@/lib/guest-list-types";

export type GuestMemberFormRow = {
  name: string;
  under13: boolean;
  attending: boolean;
};

export type GuestInviteForm = {
  label: string;
  allowIncludeFamily: boolean;
  expectedHeadcount: number;
  rsvpStatus: RsvpStatus;
  rsvpAttendingCount: number;
  adminNotes: string;
  contactEmail: string;
  members: GuestMemberFormRow[];
};

export function guestFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? "";
}

export function namedMemberCount(members: GuestMemberFormRow[]): number {
  return members.filter((member) => member.name.trim()).length;
}

export function formatInviteNameList(names: string[]): string {
  const trimmed = names.map((name) => name.trim()).filter(Boolean);
  if (trimmed.length === 0) return "";
  if (trimmed.length === 1) return trimmed[0]!;
  if (trimmed.length === 2) return `${trimmed[0]} and ${trimmed[1]}`;
  return `${trimmed.slice(0, -1).join(", ")} and ${trimmed[trimmed.length - 1]}`;
}

export function inviteLabelOptions(
  members: GuestMemberFormRow[],
  currentLabel = "",
): string[] {
  const names = members.map((member) => member.name.trim()).filter(Boolean);
  if (names.length === 0) return currentLabel ? [currentLabel] : [];

  const firstNames = names.map(guestFirstName).filter(Boolean);
  if (firstNames.length === 0) return currentLabel ? [currentLabel] : [];

  const options: string[] = [];
  if (firstNames.length >= 2) {
    options.push(formatInviteNameList(firstNames));
  }
  options.push(`${firstNames[0]} and family`);

  const unique = [...new Set(options)];
  if (currentLabel && !unique.includes(currentLabel)) {
    return [currentLabel, ...unique];
  }
  return unique;
}

export function attendingMemberCount(members: GuestMemberFormRow[]): number {
  const named = members.filter((member) => member.name.trim());
  if (named.length === 0) return 1;
  const selected = named.filter((member) => member.attending);
  return Math.max(1, selected.length);
}

export function applyGuestMemberDefaults(form: GuestInviteForm): GuestInviteForm {
  const count = Math.max(1, namedMemberCount(form.members));
  const labelOptions = inviteLabelOptions(form.members, form.label);
  const label = labelOptions.includes(form.label)
    ? form.label
    : (labelOptions[0] ?? "");

  const members =
    form.rsvpStatus === "attending"
      ? form.members.map((member) =>
          member.name.trim()
            ? { ...member, attending: member.attending }
            : member,
        )
      : form.members;

  return {
    ...form,
    label,
    expectedHeadcount: count,
    members,
    rsvpAttendingCount:
      form.rsvpStatus === "attending"
        ? attendingMemberCount(members)
        : form.rsvpAttendingCount,
  };
}

export function emptyGuestInviteForm(): GuestInviteForm {
  return {
    label: "",
    allowIncludeFamily: false,
    expectedHeadcount: 1,
    rsvpStatus: "not_responded",
    rsvpAttendingCount: 1,
    adminNotes: "",
    contactEmail: "",
    members: [{ name: "", under13: false, attending: true }],
  };
}

export function guestInviteFormFromGuest(guest: {
  label: string;
  allowIncludeFamily: boolean;
  expectedHeadcount: number;
  rsvpStatus: string;
  rsvpAttendingCount: number | null;
  adminNotes: string | null;
  contactEmail: string | null;
  members: Array<{
    name: string;
    under13?: boolean | null;
    attending?: boolean | null;
  }>;
}): GuestInviteForm {
  const members =
    guest.members.length > 0
      ? guest.members.map((member) => ({
          name: member.name,
          under13: Boolean(member.under13),
          attending: member.attending !== false,
        }))
      : [{ name: "", under13: false, attending: true }];

  const form: GuestInviteForm = {
    label: guest.label,
    allowIncludeFamily: guest.allowIncludeFamily,
    expectedHeadcount: guest.expectedHeadcount,
    rsvpStatus: guest.rsvpStatus as RsvpStatus,
    rsvpAttendingCount: guest.rsvpAttendingCount ?? guest.expectedHeadcount,
    adminNotes: guest.adminNotes ?? "",
    contactEmail: guest.contactEmail ?? "",
    members,
  };

  return applyGuestMemberDefaults(form);
}

export function guestMembersForSave(members: GuestMemberFormRow[]) {
  return members
    .filter((member) => member.name.trim())
    .map((member) => ({
      name: member.name.trim(),
      under13: member.under13,
      attending: member.attending,
    }));
}
