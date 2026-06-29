"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

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
  const showingAll = value.length === 0;
  const summary = showingAll
    ? "Everyone"
    : value.length === 1
      ? value[0]
      : `${value.length} selected`;

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
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm"
      >
        <span className="font-medium text-stone-700">Participants: {summary}</span>
        <ChevronDown className="h-4 w-4 text-stone-400" />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close participant filter"
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 max-h-56 min-w-[14rem] overflow-y-auto rounded-xl border border-stone-200 bg-white p-2 shadow-lg">
            {value.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="mb-1 w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-[#1e3a5f] hover:bg-stone-50"
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
        </>
      )}
    </div>
  );
}
