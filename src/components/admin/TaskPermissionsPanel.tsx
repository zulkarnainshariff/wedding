"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { SectionShell } from "@/components/layout/PageShell";
import type { WeddingEvent } from "@/lib/schema";

type PermissionRow = {
  userId: number;
  username: string;
  canAssign: boolean;
  canAssignForOthers: boolean;
  canViewOthersTasks: boolean;
};

export function TaskPermissionsPanel({
  initialEvents,
}: {
  initialEvents: WeddingEvent[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(initialEvents[0]?.id ?? null);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadPermissions(eventId: number) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/tasks/events/${eventId}/permissions`);
      if (!response.ok) {
        setError("Failed to load task permissions.");
        return;
      }
      const data = await response.json();
      const rows: PermissionRow[] = data.users.map(
        (user: { id: number; username: string }) => {
          const existing = data.permissions.find(
            (perm: { userId: number }) => perm.userId === user.id,
          );
          return {
            userId: user.id,
            username: user.username,
            canAssign: existing?.canAssign ?? false,
            canAssignForOthers: existing?.canAssignForOthers ?? false,
            canViewOthersTasks: existing?.canViewOthersTasks ?? false,
          };
        },
      );
      setPermissions(rows);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!selectedId) return;
    void loadPermissions(selectedId);
  }, [selectedId]);

  async function savePermissions() {
    if (!selectedId) return;
    setBusy(true);
    const response = await fetch(`/api/tasks/events/${selectedId}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        permissions: permissions
          .filter(
            (row) =>
              row.canAssign || row.canAssignForOthers || row.canViewOthersTasks,
          )
          .map((row) => ({
            userId: row.userId,
            canAssign: row.canAssign,
            canAssignForOthers: row.canAssignForOthers,
            canViewOthersTasks: row.canViewOthersTasks,
          })),
      }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("Failed to save task permissions.");
      return;
    }
    setStatus("Task permissions saved.");
    router.refresh();
  }

  if (!initialEvents.length) {
    return (
      <p className="text-sm text-stone-500">No wedding events configured yet.</p>
    );
  }

  return (
    <SectionShell
      title="Task access"
      toolbar={
        <>
          <div className="flex flex-wrap gap-2">
            {initialEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => setSelectedId(event.id)}
                className={[
                  "rounded-full px-4 py-1.5 text-sm font-medium",
                  event.id === selectedId
                    ? "bg-[#1e3a5f] text-white"
                    : "border border-stone-200 text-stone-600",
                ].join(" ")}
              >
                {event.name}
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm text-stone-500">
            Choose which users can assign tasks, assign on behalf of others, or view
            other people&apos;s tasks for this event.
          </p>
        </>
      }
    >
      <div className="space-y-2">
        {permissions.map((row) => (
          <div
            key={row.userId}
            className="flex flex-wrap items-center gap-4 rounded-lg border border-stone-200 px-3 py-2 text-sm"
          >
            <span className="min-w-24 font-medium text-stone-700">
              {row.username}
            </span>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={row.canAssign}
                onChange={(e) =>
                  setPermissions((current) =>
                    current.map((entry) =>
                      entry.userId === row.userId
                        ? { ...entry, canAssign: e.target.checked }
                        : entry,
                    ),
                  )
                }
              />
              Can assign
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={row.canAssignForOthers}
                onChange={(e) =>
                  setPermissions((current) =>
                    current.map((entry) =>
                      entry.userId === row.userId
                        ? {
                            ...entry,
                            canAssignForOthers: e.target.checked,
                            canAssign: e.target.checked ? true : entry.canAssign,
                          }
                        : entry,
                    ),
                  )
                }
              />
              Assign for others
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={row.canViewOthersTasks}
                onChange={(e) =>
                  setPermissions((current) =>
                    current.map((entry) =>
                      entry.userId === row.userId
                        ? { ...entry, canViewOthersTasks: e.target.checked }
                        : entry,
                    ),
                  )
                }
              />
              View others&apos; tasks
            </label>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void savePermissions()}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white"
      >
        <Save className="h-4 w-4" />
        Save permissions
      </button>

      {status && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {status}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </SectionShell>
  );
}
