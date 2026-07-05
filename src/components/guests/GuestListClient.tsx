"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { GuestListPanel } from "@/components/guests/GuestListPanel";
import type { WeddingEvent } from "@/lib/schema";

export function GuestListClient({
  events,
  initialAccess,
}: {
  events: WeddingEvent[];
  /** Fresh access from the server; overrides stale AuthProvider cache when set. */
  initialAccess?: import("@/lib/guest-list-types").GuestListAccess[];
}) {
  const { guestListAccess, canManageUsers, refreshUser } = useAuth();

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const access =
    initialAccess && initialAccess.length > 0
      ? initialAccess
      : guestListAccess;

  return (
    <GuestListPanel
      events={events}
      access={access}
      canManagePermissions={canManageUsers}
    />
  );
}
