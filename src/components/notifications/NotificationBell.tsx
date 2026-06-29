"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bell, X } from "lucide-react";

type NotificationItem = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationBell({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [urgent, setUrgent] = useState<NotificationItem | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications");
      if (!response.ok) return;
      const data = await response.json();
      setItems(data.items ?? []);
      setUnreadCount(data.unreadCount ?? 0);

      const urgentItem = (data.items as NotificationItem[] | undefined)?.find(
        (item) =>
          !item.readAt &&
          (item.type === "task_urgent" || item.type === "task_assigned") &&
          item.type === "task_urgent",
      );
      if (urgentItem) {
        const shown = sessionStorage.getItem(`urgent-${urgentItem.id}`);
        if (!shown) {
          setUrgent(urgentItem);
          sessionStorage.setItem(`urgent-${urgentItem.id}`, "1");
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  async function markRead(id: number) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    void refresh();
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    void refresh();
  }

  function openItem(item: NotificationItem) {
    void markRead(item.id);
    setOpen(false);
    if (item.href) router.push(item.href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={[
          "relative rounded-xl border border-stone-200/80 bg-white p-2 text-stone-600 hover:bg-stone-50",
          compact ? "mx-auto" : "ml-auto",
        ].join(" ")}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {urgent && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-stone-900/45" />
          <div className="relative w-full max-w-sm rounded-2xl border border-red-200 bg-white p-6 shadow-xl">
            <h2 className="font-serif text-xl text-red-700">Urgent task</h2>
            <p className="mt-2 font-medium text-stone-800">{urgent.title}</p>
            {urgent.body && <p className="mt-1 text-sm text-stone-500">{urgent.body}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUrgent(null)}
                className="rounded-lg border border-stone-200 px-4 py-2 text-sm"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setUrgent(null);
                  if (urgent.href) router.push(urgent.href);
                }}
                className="rounded-lg bg-brand-deep px-4 py-2 text-sm font-medium text-white"
              >
                View task
              </button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-[65] flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-stone-900/30"
            onClick={() => setOpen(false)}
            aria-label="Close notifications"
          />
          <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
              <h2 className="font-serif text-xl text-brand-deep">Notifications</h2>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void markAllRead()}
                    className="text-xs text-brand-deep underline"
                  >
                    Mark all read
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-stone-100">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <p className="p-4 text-sm text-stone-500">No notifications yet.</p>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openItem(item)}
                    className={[
                      "block w-full border-b border-stone-100 px-4 py-3 text-left transition hover:bg-stone-50/80",
                      item.readAt
                        ? "bg-white"
                        : "bg-stone-100/90",
                    ].join(" ")}
                  >
                    <p
                      className={[
                        "text-stone-800",
                        item.readAt ? "font-normal" : "font-semibold",
                      ].join(" ")}
                    >
                      {item.title}
                    </p>
                    {item.body && (
                      <p
                        className={[
                          "mt-1 text-sm",
                          item.readAt ? "text-stone-500" : "text-stone-600",
                        ].join(" ")}
                      >
                        {item.body}
                      </p>
                    )}
                  </button>
                ))
              )}
            </div>
            <div className="border-t border-stone-200 p-3">
              <Link href="/tasks" onClick={() => setOpen(false)} className="text-sm text-brand-deep underline">
                View all tasks
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
