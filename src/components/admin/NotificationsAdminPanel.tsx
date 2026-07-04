"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Mail,
  MailOpen,
  Trash2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SectionShell } from "@/components/layout/PageShell";
import { SYSTEM_ACCOUNT_USERNAMES } from "@/lib/item-travellers";

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

type BriefUser = { id: number; username: string };

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

function NotificationStatus({ item }: { item: AdminNotification }) {
  if (item.archivedAt) return <>Archived</>;
  if (item.readAt) return <>Read</>;
  return <>Unread</>;
}

function NotificationActions({
  item,
  onSetReadState,
  onArchive,
  onDelete,
}: {
  item: AdminNotification;
  onSetReadState: (id: number, read: boolean) => void;
  onArchive: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const isRead = Boolean(item.readAt);
  const readLabel = isRead ? "Mark unread" : "Mark read";
  const ReadIcon = isRead ? Mail : MailOpen;

  return (
    <div className="flex flex-wrap gap-2">
      {!item.archivedAt ? (
        <button
          type="button"
          onClick={() => onSetReadState(item.id, !isRead)}
          className="inline-flex items-center justify-center rounded-lg border border-stone-200 p-1.5 hover:bg-stone-50"
          title={readLabel}
          aria-label={readLabel}
        >
          <ReadIcon className="h-4 w-4" />
        </button>
      ) : null}
      {!item.archivedAt ? (
        <button
          type="button"
          onClick={() => onArchive(item.id)}
          className="inline-flex items-center justify-center rounded-lg border border-stone-200 p-1.5 hover:bg-stone-50"
          title="Archive"
          aria-label="Archive"
        >
          <Archive className="h-4 w-4" />
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => onDelete(item.id)}
        className="inline-flex items-center justify-center rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
        title="Delete"
        aria-label="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function NotificationTitleButton({
  item,
  onOpen,
}: {
  item: AdminNotification;
  onOpen: (item: AdminNotification) => void;
}) {
  const targetHref = notificationTargetHref(item);
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      disabled={!targetHref}
      className={[
        "text-left",
        targetHref ? "cursor-pointer hover:underline" : "cursor-default",
      ].join(" ")}
    >
      <p className="font-medium text-stone-800">{item.title}</p>
      {item.body ? <p className="mt-0.5 text-stone-500">{item.body}</p> : null}
      {targetHref ? (
        <p className="mt-1 text-xs text-brand-deep">Open linked item</p>
      ) : null}
    </button>
  );
}

export function NotificationsAdminPanel() {
  const router = useRouter();
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [username, setUsername] = useState("");
  const [userOptions, setUserOptions] = useState<BriefUser[]>([]);
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

  useEffect(() => {
    void fetch("/api/users/brief")
      .then((response) => (response.ok ? response.json() : []))
      .then((users: BriefUser[]) => {
        setUserOptions(
          users.filter(
            (user) => !SYSTEM_ACCOUNT_USERNAMES.has(user.username.toLowerCase()),
          ),
        );
      })
      .catch(() => setUserOptions([]));
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
            <select
              value={username}
              onChange={(e) => {
                const next = e.target.value;
                setUsername(next);
                void load({ username: next });
              }}
              className="rounded-lg border border-stone-200 px-3 py-2"
            >
              <option value="">All users</option>
              {userOptions.map((user) => (
                <option key={user.id} value={user.username}>
                  {user.username}
                </option>
              ))}
            </select>
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
          {loading ? (
            <span className="text-sm text-stone-500">Loading…</span>
          ) : null}
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

        <div className="space-y-3 md:hidden">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-stone-200 bg-white p-3 text-sm"
            >
              <div className="mb-2 flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => toggleSelected(item.id)}
                  aria-label={`Select notification ${item.title}`}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-stone-500">
                    {new Date(item.createdAt).toLocaleString("en-GB")}
                  </p>
                  <p className="mt-1 font-medium text-stone-700">
                    {item.username ?? item.userId}
                  </p>
                  <div className="mt-2">
                    <NotificationTitleButton item={item} onOpen={openNotification} />
                  </div>
                  <p className="mt-2 text-xs text-stone-500">
                    <NotificationStatus item={item} />
                  </p>
                </div>
              </div>
              <NotificationActions
                item={item}
                onSetReadState={(id, read) => void setReadState(id, read)}
                onArchive={(id) => void archive(id)}
                onDelete={(id) => setPendingDeleteIds([id])}
              />
            </div>
          ))}
          {!loading && items.length === 0 ? (
            <p className="rounded-xl border border-stone-200 px-3 py-6 text-center text-stone-500">
              No notifications found.
            </p>
          ) : null}
        </div>

        <div className="hidden overflow-hidden rounded-xl border border-stone-200 md:block">
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
              {items.map((item) => (
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
                    <NotificationTitleButton item={item} onOpen={openNotification} />
                  </td>
                  <td className="px-3 py-2 text-stone-500">
                    <NotificationStatus item={item} />
                  </td>
                  <td className="px-3 py-2">
                    <NotificationActions
                      item={item}
                      onSetReadState={(id, read) => void setReadState(id, read)}
                      onArchive={(id) => void archive(id)}
                      onDelete={(id) => setPendingDeleteIds([id])}
                    />
                  </td>
                </tr>
              ))}
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
