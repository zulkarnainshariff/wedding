import { PublicLanding } from "@/components/landing/PublicLanding";
import { getAppSettings, isGuestbookEnabled, isPhotoGalleryEnabled } from "@/lib/app-settings";
import { getInvitationEventsWithSchedules } from "@/lib/public-queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [events, settings] = await Promise.all([
    getInvitationEventsWithSchedules(),
    getAppSettings(),
  ]);
  return (
    <PublicLanding
      events={events}
      guestbookEnabled={isGuestbookEnabled(settings)}
      photoGalleryEnabled={isPhotoGalleryEnabled(settings)}
    />
  );
}
