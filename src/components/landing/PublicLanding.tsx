"use client";

import type {
  PublicInvitationEvent,
  PublicScheduleItem,
} from "@/lib/invitation-types";
import { InvitationCards } from "./InvitationCards";
import { PublicHeader } from "./PublicHeader";

export function PublicLanding({
  events,
}: {
  events: Array<PublicInvitationEvent & { schedule: PublicScheduleItem[] }>;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />
      <main className="flex flex-1 flex-col pt-24">
        <InvitationCards events={events} />
      </main>
    </div>
  );
}
