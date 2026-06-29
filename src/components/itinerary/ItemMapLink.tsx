import { MapPin } from "lucide-react";

export function ItemMapLink({
  href,
  label,
  className = "",
}: {
  href: string;
  label?: string;
  className?: string;
}) {
  const title = label ?? "Open in Google Maps";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      className={[
        "inline-flex shrink-0 items-center gap-1 rounded-lg border border-brand-deep/15 bg-brand-deep/5 px-2 py-1 text-xs font-medium text-brand-deep transition-colors hover:bg-brand-deep/10",
        className,
      ].join(" ")}
      title={title}
      aria-label={title}
    >
      <MapPin className="h-3.5 w-3.5 shrink-0" />
      <span className="max-w-[8rem] truncate sm:max-w-[10rem]">
        {label ?? "Maps"}
      </span>
    </a>
  );
}
