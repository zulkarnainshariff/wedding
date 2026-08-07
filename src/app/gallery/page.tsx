import { GalleryClient } from "@/components/landing/GalleryClient";
import {
  getAppSettings,
  getGalleryAlbumMoveTagMode,
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
      initialAlbumMoveTagMode={getGalleryAlbumMoveTagMode(settings)}
    />
  );
}
