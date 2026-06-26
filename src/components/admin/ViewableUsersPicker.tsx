"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

type UserBrief = { id: number; username: string };

export function ViewableUsersPicker({
  rowUserId,
  allUsers,
  selectedIds,
  onToggle,
}: {
  rowUserId: number;
  allUsers: UserBrief[];
  selectedIds: number[];
  onToggle: (targetUserId: number, checked: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const options = allUsers.filter((user) => user.id !== rowUserId);
  const selected = options.filter((user) => selectedIds.includes(user.id));

  const label =
    selected.length === 0
      ? "Select people…"
      : selected.length === 1
        ? selected[0].username
        : `${selected.length} people selected`;

  return (
    <div className="relative mt-2 max-w-sm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-left text-sm text-stone-700 hover:border-stone-300"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className={selected.length === 0 ? "text-stone-400" : ""}>
          {label}
        </span>
        <ChevronDown
          className={[
            "h-4 w-4 shrink-0 text-stone-400 transition",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            aria-multiselectable
            className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg"
          >
            {options.length === 0 ? (
              <p className="px-3 py-2 text-sm text-stone-400">No other users</p>
            ) : (
              options.map((user) => (
                <label
                  key={user.id}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(user.id)}
                    onChange={(event) =>
                      onToggle(user.id, event.target.checked)
                    }
                  />
                  {user.username}
                </label>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
