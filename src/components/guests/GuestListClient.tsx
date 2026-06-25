"use client";

import { useMemo } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { GuestListPanel } from "@/components/guests/GuestListPanel";
import {
  canEditAllGuestLists,
  canViewAllGuestLists,
} from "@/lib/permissions";
import type { GuestListAccess } from "@/lib/guest-list-types";
import type { WeddingEvent } from "@/lib/schema";

export function GuestListClient({
  events,
}: {
  events: WeddingEvent[];
}) {
  const { guestListAccess, canManageUsers, user } = useAuth();

  const access = useMemo<GuestListAccess[]>(() => {
    if (guestListAccess.length > 0) return guestListAccess;
    if (!user || !canViewAllGuestLists(user)) return [];

    const canEdit = canEditAllGuestLists(user);
    return events.map((event) => ({
      eventId: event.id,
      eventSlug: event.slug,
      eventName: event.name,
      canView: true,
      canEdit,
    }));
  }, [events, guestListAccess, user]);

  return (
    <GuestListPanel
      events={events}
      access={access}
      canManagePermissions={canManageUsers}
    />
  );
}
