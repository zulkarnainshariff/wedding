import { GalleryClient } from "@/components/landing/GalleryClient";
import {
  getAppSettings,
  isGuestbookEnabled,
  isPhotoGalleryEnabled,
} from "@/lib/app-settings";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const settings = await getAppSettings();
  const photoGalleryEnabled = isPhotoGalleryEnabled(settings);
  return (
    <GalleryClient
      enabled={photoGalleryEnabled}
      guestbookEnabled={isGuestbookEnabled(settings)}
      photoGalleryEnabled={photoGalleryEnabled}
    />
  );
}
