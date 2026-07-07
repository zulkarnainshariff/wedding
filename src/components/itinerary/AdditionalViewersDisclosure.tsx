"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { viewerLinkLabel, type ViewerLinks } from "@/lib/item-viewer-links";

type AdditionalViewersDisclosureProps = {
  viewers: string[];
  viewerLinks?: ViewerLinks;
  variant?: "detail" | "compact";
};

function formatViewerEntry(viewer: string, viewerLinks: ViewerLinks): string {
  const linked = viewerLinks[viewer];
  if (!linked?.length) return viewer;
  return `${viewer} (viewing ${viewerLinkLabel(linked)})`;
}

export function AdditionalViewersDisclosure({
  viewers,
  viewerLinks = {},
  variant = "detail",
}: AdditionalViewersDisclosureProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();

  if (viewers.length === 0) return null;

  const countLabel =
    viewers.length === 1 ? "1 person" : `${viewers.length} people`;

  const entries = viewers.map((viewer) => ({
    key: viewer,
    label: formatViewerEntry(viewer, viewerLinks),
  }));

  if (variant === "compact") {
    return (
      <div className="text-xs text-stone-500">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setOpen((value) => !value);
          }}
          aria-expanded={open}
          aria-controls={listId}
          className="inline-flex items-center gap-1 hover:text-stone-700"
        >
          <span>Also visible to ({viewers.length})</span>
          <ChevronDown
            className={[
              "h-3.5 w-3.5 shrink-0 transition-transform",
              open ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>
        {open ? (
          <ul id={listId} className="mt-1 space-y-0.5 pl-3">
            {entries.map((entry) => (
              <li key={entry.key}>{entry.label}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div className="border-b border-stone-100 py-3 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={listId}
        className="flex w-full items-start gap-1 text-left sm:grid sm:grid-cols-[10rem_1fr]"
      >
        <span className="text-sm font-medium text-stone-500">Also visible to</span>
        <span className="flex items-center gap-1.5 text-sm text-stone-800">
          {!open ? <span>{countLabel}</span> : null}
          <ChevronDown
            className={[
              "h-4 w-4 shrink-0 text-stone-400 transition-transform",
              open ? "rotate-180" : "",
            ].join(" ")}
          />
        </span>
      </button>
      {open ? (
        <ul
          id={listId}
          className="mt-2 space-y-2 pl-0 text-sm text-stone-800 sm:ml-[10rem]"
        >
          {entries.map((entry) => (
            <li key={entry.key}>{entry.label}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
