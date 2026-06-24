"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { GuestListPanel } from "@/components/guests/GuestListPanel";
import type { WeddingEvent } from "@/lib/schema";

export function GuestListClient({
  events,
}: {
  events: WeddingEvent[];
}) {
  const { guestListAccess, canManageUsers } = useAuth();

  return (
    <GuestListPanel
      events={events}
      access={guestListAccess}
      canManagePermissions={canManageUsers}
    />
  );
}
