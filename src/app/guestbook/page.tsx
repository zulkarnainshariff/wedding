import { GuestbookClient } from "@/components/landing/GuestbookClient";
import { getAppSettings, isGuestbookEnabled, isPhotoGalleryEnabled } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

export default async function GuestbookPage() {
  const settings = await getAppSettings();
  const guestbookEnabled = isGuestbookEnabled(settings);
  return (
    <GuestbookClient
      enabled={guestbookEnabled}
      guestbookEnabled={guestbookEnabled}
      photoGalleryEnabled={isPhotoGalleryEnabled(settings)}
    />
  );
}
