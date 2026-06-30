import Link from "next/link";
import { BookOpen, Images } from "lucide-react";

export function PublicFeatureLinks({
  guestbookEnabled = false,
  photoGalleryEnabled = false,
}: {
  guestbookEnabled?: boolean;
  photoGalleryEnabled?: boolean;
}) {
  if (!guestbookEnabled && !photoGalleryEnabled) return null;

  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
      {guestbookEnabled && (
        <Link
          href="/guestbook"
          className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-surface/90 px-5 py-2.5 text-sm font-medium text-brand-deep shadow-sm transition hover:bg-accent-pearl/60"
        >
          <BookOpen className="h-4 w-4" aria-hidden />
          Guestbook
        </Link>
      )}
      {photoGalleryEnabled && (
        <Link
          href="/gallery"
          className="inline-flex items-center gap-2 rounded-full border border-brand/25 bg-surface/90 px-5 py-2.5 text-sm font-medium text-brand-deep shadow-sm transition hover:bg-accent-pearl/60"
        >
          <Images className="h-4 w-4" aria-hidden />
          Photo gallery
        </Link>
      )}
    </div>
  );
}
