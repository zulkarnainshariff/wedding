"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAnchoredDropdownPosition } from "@/hooks/useAnchoredDropdownPosition";
import { useDropdownDismiss } from "@/hooks/useDropdownDismiss";

export function CheckboxDropdown({
  label,
  options,
  value,
  onChange,
  emptyLabel = "Select…",
  className = "",
}: {
  label?: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  emptyLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuStyle = useAnchoredDropdownPosition(open, triggerRef, {
    minWidth: 288,
    maxHeight: 224,
    zIndex: 80,
  });

  const summary =
    value.length === 0
      ? emptyLabel
      : value.length === 1
        ? value[0]
        : `${value.length} selected`;

  useEffect(() => setMounted(true), []);
  useDropdownDismiss(open, () => setOpen(false), triggerRef, menuRef);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("blur", close);
    return () => window.removeEventListener("blur", close);
  }, [open]);

  function toggle(name: string) {
    onChange(
      value.includes(name)
        ? value.filter((entry) => entry !== name)
        : [...value, name],
    );
  }

  return (
    <div className={["text-sm", className].join(" ")}>
      {label ? <p className="mb-2 text-stone-500">{label}</p> : null}
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="flex w-full items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-left shadow-sm"
        >
          <span className={value.length === 0 ? "text-stone-400" : "text-stone-800"}>
            {summary}
          </span>
          <ChevronDown
            className={[
              "h-4 w-4 shrink-0 text-stone-400 transition-transform",
              open ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>
        {open && mounted
          ? createPortal(
              <div
                ref={menuRef}
                role="listbox"
                aria-label={label ?? emptyLabel}
                style={menuStyle}
                className="overflow-y-auto overscroll-contain rounded-xl border border-stone-200 bg-white p-2 shadow-lg"
              >
                {options.length === 0 ? (
                  <p className="px-2 py-1.5 text-xs text-stone-500">
                    No options available.
                  </p>
                ) : (
                  options.map((name) => (
                    <label
                      key={name}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-stone-50"
                    >
                      <input
                        type="checkbox"
                        checked={value.includes(name)}
                        onChange={(event) => {
                          event.stopPropagation();
                          toggle(name);
                        }}
                      />
                      <span>{name}</span>
                    </label>
                  ))
                )}
              </div>,
              document.body,
            )
          : null}
      </div>
    </div>
  );
}
