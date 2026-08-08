"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  emptyLabel,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const summary =
    selected.length === 0
      ? emptyLabel
      : selected.length === 1
        ? (options.find((option) => option.value === selected[0])?.label ??
          selected[0])
        : `${selected.length} selected`;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className="min-w-[10rem] rounded-lg border border-stone-200 bg-white px-3 py-2 text-left text-sm text-stone-700"
      >
        <span className="block text-[10px] uppercase tracking-wide text-stone-400">
          {label}
        </span>
        <span className="block truncate">{summary}</span>
      </button>
      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-multiselectable
          className="absolute z-30 mt-1 max-h-56 w-64 overflow-y-auto rounded-xl border border-stone-200 bg-white p-2 shadow-lg"
        >
          <button
            type="button"
            className="mb-1 w-full rounded-lg px-2 py-1.5 text-left text-xs text-stone-500 hover:bg-stone-50"
            onClick={() => onChange([])}
          >
            Clear
          </button>
          {options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={checked}
                  onChange={() => {
                    onChange(
                      checked
                        ? selected.filter((value) => value !== option.value)
                        : [...selected, option.value],
                    );
                  }}
                />
                <span className="min-w-0 flex-1 break-words">{option.label}</span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function useStableOptionList(
  values: string[],
): { value: string; label: string }[] {
  return useMemo(
    () => values.map((value) => ({ value, label: value })),
    [values],
  );
}
