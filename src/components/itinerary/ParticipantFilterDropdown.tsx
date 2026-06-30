"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAnchoredDropdownPosition } from "@/hooks/useAnchoredDropdownPosition";
import { useDropdownDismiss } from "@/hooks/useDropdownDismiss";

export function ParticipantFilterDropdown({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuStyle = useAnchoredDropdownPosition(open, triggerRef, {
    minWidth: 224,
    maxHeight: 280,
  });
  const showingAll = value.length === 0;
  const summary = showingAll
    ? "Everyone"
    : value.length === 1
      ? value[0]
      : `${value.length} selected`;

  useEffect(() => setMounted(true), []);
  useDropdownDismiss(open, () => setOpen(false), triggerRef, menuRef);

  function toggle(name: string) {
    let next = value.includes(name)
      ? value.filter((entry) => entry !== name)
      : [...value, name];

    if (next.length === options.length) {
      next = [];
    }

    onChange(next);
  }

  if (!options.length) return null;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm"
      >
        <span className="font-medium text-stone-700">Participants: {summary}</span>
        <ChevronDown
          className={[
            "h-4 w-4 text-stone-400 transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {open && mounted
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              aria-label="Filter by participant"
              style={menuStyle}
              className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl"
            >
              <div className="max-h-full overflow-y-auto overscroll-contain p-2">
                {value.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onChange([])}
                    className="mb-1 w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-brand-deep hover:bg-stone-50"
                  >
                    Show everyone
                  </button>
                )}
                {options.map((name) => (
                  <label
                    key={name}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-stone-50"
                  >
                    <input
                      type="checkbox"
                      checked={value.includes(name)}
                      onChange={() => toggle(name)}
                    />
                    <span>{name}</span>
                  </label>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
