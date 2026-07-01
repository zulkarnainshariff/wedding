"use client";

import { ChevronDown, Link2 } from "lucide-react";
import { useState } from "react";
import { IconTooltip } from "@/components/ui/IconTooltip";
import {
  pruneViewerLinks,
  type ViewerLinks,
} from "@/lib/item-viewer-links";
import { normalizeTravellerName } from "@/lib/travellers";

const LINK_VIEWER_TOOLTIP =
  "Link this viewer to specific participants. They will see this item in the context of those travellers.";

export function updateViewersWithLinks(
  viewers: string[],
  viewerLinks: ViewerLinks,
): ViewerLinks {
  return pruneViewerLinks(viewers, viewerLinks);
}

function viewerSummary(
  viewers: string[],
  viewerLinks: ViewerLinks,
  emptyLabel: string,
): string {
  if (viewers.length === 0) return emptyLabel;
  if (viewers.length === 1) {
    const viewer = viewers[0];
    const linked = viewerLinks[normalizeTravellerName(viewer)];
    if (linked?.length) {
      return `${viewer} · ${linked.join(", ")}`;
    }
    return viewer;
  }
  return `${viewers.length} selected`;
}

export function AdditionalViewersDropdown({
  label,
  options,
  viewers,
  viewerLinks,
  participantOptions,
  onChange,
  emptyLabel = "No additional viewers",
  className = "",
}: {
  label?: string;
  options: string[];
  viewers: string[];
  viewerLinks: ViewerLinks;
  participantOptions: string[];
  onChange: (next: {
    viewers: string[];
    viewerLinks: ViewerLinks;
  }) => void;
  emptyLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [linkEditorOpen, setLinkEditorOpen] = useState<Record<string, boolean>>(
    {},
  );

  function toggleViewer(name: string) {
    const key = normalizeTravellerName(name);
    const nextViewers = viewers.includes(name)
      ? viewers.filter((entry) => entry !== name)
      : [...viewers, name];

    if (viewers.includes(name)) {
      setLinkEditorOpen((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }

    onChange({
      viewers: nextViewers,
      viewerLinks: updateViewersWithLinks(nextViewers, viewerLinks),
    });
  }

  function toggleLinkEditor(viewer: string) {
    const key = normalizeTravellerName(viewer);
    setLinkEditorOpen((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function toggleLinkedParticipant(viewer: string, participant: string) {
    const key = normalizeTravellerName(viewer);
    const current = viewerLinks[key] ?? [];
    const nextLinked = current.includes(participant)
      ? current.filter((entry) => entry !== participant)
      : [...current, participant];

    onChange({
      viewers,
      viewerLinks: {
        ...viewerLinks,
        [key]: nextLinked,
      },
    });
  }

  return (
    <div className={["text-sm", className].join(" ")}>
      {label ? <p className="mb-2 text-stone-500">{label}</p> : null}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex w-full items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-left shadow-sm"
        >
          <span
            className={viewers.length === 0 ? "text-stone-400" : "text-stone-800"}
          >
            {viewerSummary(viewers, viewerLinks, emptyLabel)}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-stone-400" />
        </button>
        {open ? (
          <>
            <button
              type="button"
              aria-label={`Close ${label ?? emptyLabel}`}
              className="fixed inset-0 z-10"
              onClick={() => setOpen(false)}
            />
            <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white p-2 shadow-lg">
              {options.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-stone-500">
                  No options available.
                </p>
              ) : (
                options.map((name) => {
                  const selected = viewers.includes(name);
                  const key = normalizeTravellerName(name);
                  const linked = viewerLinks[key] ?? [];
                  const showLinkEditor = Boolean(linkEditorOpen[key]);

                  return (
                    <div key={name} className="rounded-md">
                      <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-stone-50">
                        <label className="flex min-w-0 flex-1 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(event) => {
                              event.stopPropagation();
                              toggleViewer(name);
                            }}
                          />
                          <span className="truncate font-medium text-stone-800">
                            {name}
                          </span>
                        </label>
                        {selected ? (
                          <IconTooltip label={LINK_VIEWER_TOOLTIP}>
                            <button
                              type="button"
                              onClick={() => toggleLinkEditor(name)}
                              aria-label={`Link ${name} to participants`}
                              aria-expanded={showLinkEditor}
                              className={[
                                "shrink-0 rounded-md p-1 transition-colors",
                                linked.length > 0 || showLinkEditor
                                  ? "bg-accent/10 text-brand-deep"
                                  : "text-stone-400 hover:bg-stone-100 hover:text-stone-600",
                              ].join(" ")}
                            >
                              <Link2 className="h-4 w-4" />
                            </button>
                          </IconTooltip>
                        ) : null}
                      </div>
                      {selected && !showLinkEditor && linked.length > 0 ? (
                        <p className="mb-1 ml-8 text-xs text-stone-500">
                          Linked to {linked.join(", ")}
                        </p>
                      ) : null}
                      {selected && showLinkEditor ? (
                        <div className="mb-2 ml-8 border-l border-stone-200 pl-3">
                          <p className="px-1 py-1 text-[11px] font-medium tracking-wide text-stone-500 uppercase">
                            View linked to
                          </p>
                          {participantOptions.length === 0 ? (
                            <p className="px-1 py-1 text-xs text-stone-400">
                              Add participants first.
                            </p>
                          ) : (
                            participantOptions.map((participant) => (
                              <label
                                key={`${name}-${participant}`}
                                className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-stone-50"
                              >
                                <input
                                  type="checkbox"
                                  checked={linked.includes(participant)}
                                  onChange={(event) => {
                                    event.stopPropagation();
                                    toggleLinkedParticipant(name, participant);
                                  }}
                                />
                                <span className="text-stone-700">{participant}</span>
                              </label>
                            ))
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
