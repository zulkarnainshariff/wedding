"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SectionShell } from "@/components/layout/PageShell";

type AdminNotification = {
  id: number;
  userId: number;
  username: string | null;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
};

function notificationTargetHref(item: AdminNotification): string | null {
  if (item.href) return item.href;
  const meta = item.metadata;
  if (meta && typeof meta.itemId === "number") {
    const taskId =
      typeof meta.taskId === "number" ? `&task=${meta.taskId}` : "";
    return `/itinerary?item=${meta.itemId}${taskId}`;
  }
  if (meta && typeof meta.taskId === "number") {
    return `/tasks?task=${meta.taskId}`;
  }
  return null;
}

export function NotificationsAdminPanel() {
  const router = useRouter();
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<number[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (filters?: { username?: string; includeArchived?: boolean }) => {
      setLoading(true);
      setStatus(null);
      const params = new URLSearchParams();
      const archived = filters?.includeArchived ?? includeArchived;
      const usernameFilter = filters?.username ?? username;
      if (archived) params.set("includeArchived", "true");
      if (usernameFilter.trim()) params.set("username", usernameFilter.trim());

      try {
        const response = await fetch(`/api/system/notifications?${params.toString()}`);
        if (!response.ok) {
          setStatus(
            response.status === 403
              ? "You do not have permission to view notifications."
              : "Could not load notifications.",
          );
          setItems([]);
          setSelectedIds([]);
          return;
        }

        const payload = (await response.json()) as { items: AdminNotification[] };
        setItems(payload.items ?? []);
        setSelectedIds([]);
      } catch {
        setStatus("Could not load notifications.");
        setItems([]);
        setSelectedIds([]);
      } finally {
        setLoading(false);
      }
    },
    [includeArchived, username],
  );

  useEffect(() => {
    void load({ includeArchived: false, username: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allSelected = useMemo(
    () => items.length > 0 && selectedIds.length === items.length,
    [items.length, selectedIds.length],
  );

  function toggleSelected(id: number) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );
  }

  function toggleSelectAll() {
    setSelectedIds(allSelected ? [] : items.map((item) => item.id));
  }

  async function archive(id: number) {
    const response = await fetch("/api/system/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, archive: true }),
    });
    if (!response.ok) {
      setStatus("Could not archive notification.");
      return;
    }
    await load();
  }

  async function setReadState(id: number, read: boolean) {
    const response = await fetch("/api/system/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read }),
    });
    if (!response.ok) {
      setStatus(`Could not mark notification as ${read ? "read" : "unread"}.`);
      return;
    }
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, readAt: read ? new Date().toISOString() : null }
          : item,
      ),
    );
  }

  async function confirmDelete() {
    if (!pendingDeleteIds?.length) return;
    setDeleting(true);
    setStatus(null);
    try {
      const params = new URLSearchParams({
        ids: pendingDeleteIds.join(","),
      });
      const response = await fetch(`/api/system/notifications?${params.toString()}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        setStatus("Could not delete notification.");
        return;
      }
      setPendingDeleteIds(null);
      await load();
    } finally {
      setDeleting(false);
    }
  }

  function openNotification(item: AdminNotification) {
    const target = notificationTargetHref(item);
    if (!target) return;
    router.push(target);
  }

  return (
    <>
      <SectionShell title="All user notifications">
        <p className="mb-4 text-sm text-stone-500">
          View, archive, or delete notifications for any user. Click a notification
          to open its linked item or task. Archived notifications are hidden from
          user bell menus but remain here when included.
        </p>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-stone-500">Filter by username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void load();
                }
              }}
              className="rounded-lg border border-stone-200 px-3 py-2"
              placeholder="e.g. natalie"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-600">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => {
                const next = e.target.checked;
                setIncludeArchived(next);
                void load({ includeArchived: next });
              }}
            />
            Include archived
          </label>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg border border-stone-200 px-3 py-2 text-sm hover:bg-stone-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          {selectedIds.length > 0 ? (
            <button
              type="button"
              onClick={() => setPendingDeleteIds(selectedIds)}
              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
              Delete selected ({selectedIds.length})
            </button>
          ) : null}
        </div>

        {status && <p className="mb-3 text-sm text-red-600">{status}</p>}

        <div className="overflow-hidden rounded-xl border border-stone-200">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-stone-500">
              <tr>
                <th className="px-3 py-2 font-medium">
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all notifications"
                    />
                    <span className="sr-only">Select all</span>
                  </label>
                </th>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const targetHref = notificationTargetHref(item);
                return (
                  <tr key={item.id} className="border-t border-stone-100 align-top">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={() => toggleSelected(item.id)}
                        aria-label={`Select notification ${item.title}`}
                      />
                    </td>
                    <td className="px-3 py-2 text-stone-500">
                      {new Date(item.createdAt).toLocaleString("en-GB")}
                    </td>
                    <td className="px-3 py-2">{item.username ?? item.userId}</td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => openNotification(item)}
                        disabled={!targetHref}
                        className={[
                          "text-left",
                          targetHref
                            ? "cursor-pointer hover:underline"
                            : "cursor-default",
                        ].join(" ")}
                      >
                        <p className="font-medium text-stone-800">{item.title}</p>
                        {item.body ? (
                          <p className="mt-0.5 text-stone-500">{item.body}</p>
                        ) : null}
                        {targetHref ? (
                          <p className="mt-1 text-xs text-brand-deep">Open linked item</p>
                        ) : null}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-stone-500">
                      {item.archivedAt
                        ? "Archived"
                        : item.readAt
                          ? "Read"
                          : "Unread"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {!item.archivedAt ? (
                          <button
                            type="button"
                            onClick={() =>
                              void setReadState(item.id, !item.readAt)
                            }
                            className="rounded-lg border border-stone-200 px-2 py-1 text-xs hover:bg-stone-50"
                          >
                            {item.readAt ? "Mark unread" : "Mark read"}
                          </button>
                        ) : null}
                        {!item.archivedAt && (
                          <button
                            type="button"
                            onClick={() => void archive(item.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-xs hover:bg-stone-50"
                          >
                            <Archive className="h-3.5 w-3.5" />
                            Archive
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setPendingDeleteIds([item.id])}
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-stone-500">
                    No notifications found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionShell>

      <ConfirmDialog
        open={pendingDeleteIds != null}
        title={
          pendingDeleteIds?.length === 1
            ? "Delete notification?"
            : `Delete ${pendingDeleteIds?.length ?? 0} notifications?`
        }
        message={
          pendingDeleteIds?.length === 1
            ? "This permanently removes the notification. This cannot be undone."
            : "This permanently removes the selected notifications. This cannot be undone."
        }
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onClose={() => {
          if (!deleting) setPendingDeleteIds(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
