"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, Trash2 } from "lucide-react";
import { SectionShell } from "@/components/layout/PageShell";

type AdminNotification = {
  id: number;
  userId: number;
  username: string | null;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
};

export function NotificationsAdminPanel() {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    const params = new URLSearchParams();
    if (includeArchived) params.set("includeArchived", "true");
    if (username.trim()) params.set("username", username.trim());

    const response = await fetch(`/api/system/notifications?${params.toString()}`);
    if (!response.ok) {
      setStatus("Could not load notifications.");
      setItems([]);
      setLoading(false);
      return;
    }

    const payload = (await response.json()) as { items: AdminNotification[] };
    setItems(payload.items ?? []);
    setLoading(false);
  }, [includeArchived, username]);

  useEffect(() => {
    void load();
  }, [load]);

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

  async function remove(id: number) {
    const response = await fetch(`/api/system/notifications?id=${id}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setStatus("Could not delete notification.");
      return;
    }
    await load();
  }

  return (
    <SectionShell title="All user notifications">
      <p className="mb-4 text-sm text-stone-500">
        View, archive, or delete notifications for any user. Archived notifications
        are hidden from user bell menus but remain here when included.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-stone-500">Filter by username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded-lg border border-stone-200 px-3 py-2"
            placeholder="e.g. natalie"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          Include archived
        </label>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-stone-200 px-3 py-2 text-sm hover:bg-stone-50"
        >
          Refresh
        </button>
      </div>

      {status && <p className="mb-3 text-sm text-red-600">{status}</p>}

      <div className="overflow-hidden rounded-xl border border-stone-200">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-stone-500">
            <tr>
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
                <td className="px-3 py-2 text-stone-500">
                  {new Date(item.createdAt).toLocaleString("en-GB")}
                </td>
                <td className="px-3 py-2">{item.username ?? item.userId}</td>
                <td className="px-3 py-2">
                  <p className="font-medium text-stone-800">{item.title}</p>
                  {item.body && (
                    <p className="mt-0.5 text-stone-500">{item.body}</p>
                  )}
                </td>
                <td className="px-3 py-2 text-stone-500">
                  {item.archivedAt
                    ? "Archived"
                    : item.readAt
                      ? "Read"
                      : "Unread"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
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
                      onClick={() => void remove(item.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-stone-500">
                  No notifications found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SectionShell>
  );
}
