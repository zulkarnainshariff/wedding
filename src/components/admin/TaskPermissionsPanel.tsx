"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { ViewableUsersPicker } from "@/components/admin/ViewableUsersPicker";
import { SectionShell } from "@/components/layout/PageShell";
import type { WeddingEvent } from "@/lib/schema";

type UserBrief = { id: number; username: string };

type PermissionRow = {
  userId: number;
  username: string;
  canAssign: boolean;
  canAssignForOthers: boolean;
  canViewOthersTasks: boolean;
  viewableUserIds: number[];
};

export function TaskPermissionsPanel({
  initialEvents,
}: {
  initialEvents: WeddingEvent[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(initialEvents[0]?.id ?? null);
  const [allUsers, setAllUsers] = useState<UserBrief[]>([]);
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
        setError(
          response.status === 403
            ? "You don't have permission to manage task access."
            : "Failed to load task permissions.",
        );
        return;
      }
      const data = await response.json();
      const users: UserBrief[] = data.users.map(
        (user: { id: number; username: string }) => ({
          id: user.id,
          username: user.username,
        }),
      );
      setAllUsers(users);
      const rows: PermissionRow[] = users.map((user) => {
        const existing = data.permissions.find(
          (perm: { userId: number }) => perm.userId === user.id,
        );
        const viewableUserIds = Array.isArray(existing?.viewableUserIds)
          ? existing.viewableUserIds.map((id: number) => Number(id)).filter((id: number) => id > 0)
          : [];
        return {
          userId: user.id,
          username: user.username,
          canAssign: existing?.canAssign ?? false,
          canAssignForOthers: existing?.canAssignForOthers ?? false,
          canViewOthersTasks: existing?.canViewOthersTasks ?? false,
          viewableUserIds,
        };
      });
      setPermissions(rows);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!selectedId) return;
    setStatus(null);
    setError(null);
    void loadPermissions(selectedId);
  }, [selectedId]);

  function selectEvent(eventId: number) {
    setSelectedId(eventId);
  }

  function toggleViewableUser(rowUserId: number, targetUserId: number, checked: boolean) {
    setPermissions((current) =>
      current.map((entry) => {
        if (entry.userId !== rowUserId) return entry;
        const next = new Set(entry.viewableUserIds);
        if (checked) next.add(targetUserId);
        else next.delete(targetUserId);
        return { ...entry, viewableUserIds: Array.from(next) };
      }),
    );
  }

  async function savePermissions() {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/tasks/events/${selectedId}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        permissions: permissions
          .filter(
            (row) =>
              row.canAssign ||
              row.canAssignForOthers ||
              row.canViewOthersTasks ||
              row.viewableUserIds.length > 0,
          )
          .map((row) => ({
            userId: row.userId,
            canAssign: row.canAssign,
            canAssignForOthers: row.canAssignForOthers,
            canViewOthersTasks: row.canViewOthersTasks,
            viewableUserIds: row.canViewOthersTasks ? [] : row.viewableUserIds,
          })),
      }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("Failed to save task permissions.");
      return;
    }
    const eventName = initialEvents.find((event) => event.id === selectedId)?.name;
    setStatus(
      eventName
        ? `Permissions saved for ${eventName}.`
        : "Task permissions saved.",
    );
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
                onClick={() => selectEvent(event.id)}
                className={[
                  "rounded-full px-4 py-1.5 text-sm font-medium",
                  event.id === selectedId
                    ? "bg-brand-deep text-white"
                    : "border border-stone-200 text-stone-600",
                ].join(" ")}
              >
                {event.name}
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm text-stone-500">
            Admins always see everyone&apos;s tasks. For other users, choose who can
            assign tasks and whose tasks they can view — everyone or specific people.
          </p>
        </>
      }
    >
      <div className="space-y-3">
        {permissions.map((row) => (
          <div
            key={row.userId}
            className="rounded-lg border border-stone-200 px-3 py-3 text-sm"
          >
            <p className="font-medium text-stone-700">{row.username}</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
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
                          ? {
                              ...entry,
                              canViewOthersTasks: e.target.checked,
                              viewableUserIds: e.target.checked
                                ? []
                                : entry.viewableUserIds,
                            }
                          : entry,
                      ),
                    )
                  }
                />
                View everyone&apos;s tasks
              </label>
            </div>
            {!row.canViewOthersTasks && (
              <div className="mt-3 border-t border-stone-100 pt-3">
                <p className="text-xs font-medium tracking-wide text-stone-400 uppercase">
                  Or view tasks assigned to
                </p>
                <ViewableUsersPicker
                  rowUserId={row.userId}
                  allUsers={allUsers}
                  selectedIds={row.viewableUserIds}
                  onToggle={(targetUserId, checked) =>
                    toggleViewableUser(row.userId, targetUserId, checked)
                  }
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void savePermissions()}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-deep px-4 py-2 text-sm font-medium text-white"
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
