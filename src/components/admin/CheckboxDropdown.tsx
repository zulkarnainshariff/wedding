"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

export function CheckboxDropdown({
  label,
  options,
  value,
  onChange,
  emptyLabel = "Select…",
  className = "",
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
  emptyLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const summary =
    value.length === 0
      ? emptyLabel
      : value.length === 1
        ? value[0]
        : `${value.length} selected`;

  function toggle(name: string) {
    onChange(
      value.includes(name)
        ? value.filter((entry) => entry !== name)
        : [...value, name],
    );
  }

  return (
    <div className={["text-sm", className].join(" ")}>
      <p className="mb-2 text-stone-500">{label}</p>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex w-full items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-left shadow-sm"
        >
          <span className={value.length === 0 ? "text-stone-400" : "text-stone-800"}>
            {summary}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-stone-400" />
        </button>
        {open ? (
          <>
            <button
              type="button"
              aria-label={`Close ${label}`}
              className="fixed inset-0 z-10"
              onClick={() => setOpen(false)}
            />
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white p-2 shadow-lg">
              {options.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-stone-500">No options available.</p>
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
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
