import type {
  PublicInvitationEvent,
  PublicScheduleItem,
} from "@/lib/invitation-types";
import { InvitationCards } from "./InvitationCards";
import { PublicHeader } from "./PublicHeader";

export function PublicLanding({
  events,
  guestbookEnabled = false,
  photoGalleryEnabled = false,
}: {
  events: Array<PublicInvitationEvent & { schedule: PublicScheduleItem[] }>;
  guestbookEnabled?: boolean;
  photoGalleryEnabled?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />
      <main className="flex flex-1 flex-col">
        <InvitationCards
          events={events}
          guestbookEnabled={guestbookEnabled}
          photoGalleryEnabled={photoGalleryEnabled}
        />
      </main>
    </div>
  );
}
