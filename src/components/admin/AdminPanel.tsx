"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2 } from "lucide-react";
import { AdminItemDetailsForm } from "./AdminItemDetailsForm";
import { InvitationManagement } from "./InvitationManagement";
import { TravelInsurancePanel } from "./TravelInsurancePanel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { GuestListClient } from "@/components/guests/GuestListClient";
import { TaskPermissionsPanel } from "./TaskPermissionsPanel";
import { UserManagement, type ManagedUser } from "./UserManagement";
import {
  buildItemApiPayload,
  emptyItemForm,
  itemToForm,
  type ItemFormState,
} from "@/lib/admin-item-form";
import { getItemSortTime } from "@/lib/item-schedule-datetime";
import { useUnsavedChangesGuard } from "@/components/layout/NavigationGuard";
import { PageShell, SectionShell } from "@/components/layout/PageShell";
import { CATEGORY_META, CATEGORIES, type Category } from "@/lib/types";
import type { ItineraryDay, ItineraryItem, PublicScheduleItemRow, WeddingEvent } from "@/lib/schema";

type AdminTab = "days" | "items" | "users" | "invitations" | "guests" | "tasks" | "insurance";

type EventWithSchedule = WeddingEvent & {
  schedule: PublicScheduleItemRow[];
};

const EMPTY_DAY_FORM = { dayNumber: "", date: "", title: "", notes: "" };

const TAB_CONTENT_CLASS = "mx-auto flex w-full max-w-5xl flex-col";

function sortItems(items: ItineraryItem[]) {
  return [...items].sort((a, b) => {
    const aTime = getItemSortTime(a);
    const bTime = getItemSortTime(b);
    if (aTime !== bTime) return aTime - bTime;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id - b.id;
  });
}

export function AdminPanel({
  initialDays,
  initialItems,
  initialUsers = [],
  initialEvents = [],
  showUserManagement = false,
  showFullAdmin = true,
}: {
  initialDays: ItineraryDay[];
  initialItems: ItineraryItem[];
  initialUsers?: ManagedUser[];
  initialEvents?: EventWithSchedule[];
  showUserManagement?: boolean;
  showFullAdmin?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>(
    showFullAdmin ? "days" : "insurance",
  );
  const [days, setDays] = useState(initialDays);
  const [items, setItems] = useState(initialItems);
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItemForm());
  const [itemBaseline, setItemBaseline] = useState<ItemFormState>(emptyItemForm());
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [dayForm, setDayForm] = useState(EMPTY_DAY_FORM);
  const [dayBaseline, setDayBaseline] = useState(EMPTY_DAY_FORM);
  const [editingDayId, setEditingDayId] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingDeleteItemId, setPendingDeleteItemId] = useState<number | null>(
    null,
  );

  const dayDirty = useMemo(
    () => JSON.stringify(dayForm) !== JSON.stringify(dayBaseline),
    [dayForm, dayBaseline],
  );
  const itemDirty = useMemo(
    () => JSON.stringify(itemForm) !== JSON.stringify(itemBaseline),
    [itemForm, itemBaseline],
  );

  useUnsavedChangesGuard(dayDirty || itemDirty);

  const sortedItems = useMemo(() => sortItems(items), [items]);

  const tabs: ReadonlyArray<readonly [AdminTab, string]> = showFullAdmin
    ? [
        ["days", "Days"],
        ["items", "Items"],
        ["invitations", "Invitations"],
        ["guests", "Guest lists"],
        ["tasks", "Task access"],
        ["insurance", "Travel insurance"],
        ...(showUserManagement ? ([["users", "Users"]] as const) : []),
      ]
    : [["insurance", "Travel insurance"]];

  function switchTab(next: AdminTab) {
    if (dayDirty || itemDirty) {
      const ok = window.confirm(
        "You have unsaved changes. Leave this tab without saving?",
      );
      if (!ok) return;
    }
    setTab(next);
  }

  async function refresh() {
    const [daysRes, itemsRes] = await Promise.all([
      fetch("/api/days"),
      fetch("/api/items"),
    ]);
    setDays(await daysRes.json());
    setItems(await itemsRes.json());
    router.refresh();
  }

  async function saveDay() {
    setBusy(true);
    setStatus(null);
    const payload = {
      dayNumber: Number(dayForm.dayNumber),
      date: dayForm.date,
      title: dayForm.title || null,
      notes: dayForm.notes || null,
    };

    const res = editingDayId
      ? await fetch(`/api/days/${editingDayId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/days", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    setBusy(false);
    if (!res.ok) {
      setStatus("Failed to save day.");
      return;
    }

    setDayForm(EMPTY_DAY_FORM);
    setDayBaseline(EMPTY_DAY_FORM);
    setEditingDayId(null);
    setStatus("Day saved.");
    await refresh();
  }

  async function saveItem() {
    if (!itemForm.title.trim()) {
      setStatus("Title is required.");
      return;
    }

    setBusy(true);
    setStatus(null);

    const payload = buildItemApiPayload(itemForm);

    const res = editingItemId
      ? await fetch(`/api/items/${editingItemId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    setBusy(false);
    if (!res.ok) {
      setStatus("Failed to save item.");
      return;
    }

    const cleared = emptyItemForm();
    setItemForm(cleared);
    setItemBaseline(cleared);
    setEditingItemId(null);
    setStatus("Item saved.");
    await refresh();
  }

  async function deleteDay(id: number) {
    if (!confirm("Delete this day? Items linked to it will become unassigned.")) return;
    setBusy(true);
    await fetch(`/api/days/${id}`, { method: "DELETE" });
    setBusy(false);
    await refresh();
  }

  async function deleteItem(id: number) {
    setPendingDeleteItemId(id);
  }

  async function confirmDeleteItem() {
    if (pendingDeleteItemId == null) return;

    const id = pendingDeleteItemId;
    setBusy(true);
    const response = await fetch(`/api/items/${id}`, { method: "DELETE" });
    setBusy(false);
    setPendingDeleteItemId(null);

    if (!response.ok) {
      alert("Could not delete this item.");
      return;
    }
    if (editingItemId === id) {
      const cleared = emptyItemForm();
      setItemForm(cleared);
      setItemBaseline(cleared);
      setEditingItemId(null);
    }
    await refresh();
  }

  function startEditItem(item: ItineraryItem) {
    const form = itemToForm(item);
    setTab("items");
    setEditingItemId(item.id);
    setItemForm(form);
    setItemBaseline(form);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEditDay(day: ItineraryDay) {
    const form = {
      dayNumber: String(day.dayNumber),
      date: day.date,
      title: day.title ?? "",
      notes: day.notes ?? "",
    };
    setTab("days");
    setEditingDayId(day.id);
    setDayForm(form);
    setDayBaseline(form);
  }

  return (
    <>
      <PageShell
      eyebrow="Manage"
      title="Edit Itinerary"
      toolbar={
        <div className="flex gap-2 border-b border-stone-200">
          {tabs.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => switchTab(value)}
              className={[
                "cursor-pointer border-b-2 px-4 py-2 text-sm font-medium",
                tab === value
                  ? "border-[#1e3a5f] text-[#1e3a5f]"
                  : "border-transparent text-stone-500 hover:text-stone-700",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      {tab === "users" && showUserManagement && (
        <div className={TAB_CONTENT_CLASS}>
          <UserManagement initialUsers={initialUsers} />
        </div>
      )}

      {tab === "guests" && showFullAdmin && (
        <div className={TAB_CONTENT_CLASS}>
          <GuestListClient events={initialEvents.map(({ schedule: _s, ...event }) => event)} />
        </div>
      )}

      {tab === "tasks" && showFullAdmin && (
        <div className={TAB_CONTENT_CLASS}>
          <TaskPermissionsPanel
            initialEvents={initialEvents.map(({ schedule: _s, ...event }) => event)}
          />
        </div>
      )}

      {tab === "insurance" && (
        <div className={TAB_CONTENT_CLASS}>
          <TravelInsurancePanel initialItems={items} />
        </div>
      )}

      {tab === "invitations" && showFullAdmin && (
        <div className={TAB_CONTENT_CLASS}>
          <InvitationManagement initialEvents={initialEvents} />
        </div>
      )}

      {tab === "days" && showFullAdmin && (
        <div className={TAB_CONTENT_CLASS}>
          {status && (
            <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {status}
            </p>
          )}
          <SectionShell title={editingDayId ? "Edit day" : "Add day"}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-stone-500">Day number</span>
                <input
                  type="number"
                  value={dayForm.dayNumber}
                  onChange={(e) => setDayForm({ ...dayForm, dayNumber: e.target.value })}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-stone-500">Date</span>
                <input
                  type="date"
                  value={dayForm.date}
                  onChange={(e) => setDayForm({ ...dayForm, date: e.target.value })}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-stone-500">Title</span>
                <input
                  value={dayForm.title}
                  onChange={(e) => setDayForm({ ...dayForm, title: e.target.value })}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-stone-500">Notes</span>
                <textarea
                  value={dayForm.notes}
                  onChange={(e) => setDayForm({ ...dayForm, notes: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                />
              </label>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={saveDay}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white"
              >
                <Save className="h-4 w-4" />
                Save day
              </button>
              {editingDayId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingDayId(null);
                    setDayForm(EMPTY_DAY_FORM);
                    setDayBaseline(EMPTY_DAY_FORM);
                  }}
                  className="rounded-lg border border-stone-200 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="mt-6 divide-y divide-stone-100">
              {days.map((day) => (
                <div key={day.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-stone-800">
                      Day {day.dayNumber} · {day.title || "Untitled"}
                    </p>
                    <p className="text-sm text-stone-500">{day.date}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEditDay(day)}
                      className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteDay(day.id)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionShell>
        </div>
      )}

      {tab === "items" && showFullAdmin && (
        <div className={TAB_CONTENT_CLASS}>
          {status && (
            <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {status}
            </p>
          )}
          <SectionShell title={editingItemId ? "Edit item" : "Add item"}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-stone-500">Category</span>
                <select
                  value={itemForm.category}
                  onChange={(e) => {
                    const category = e.target.value as Category;
                    setItemForm({
                      ...itemForm,
                      category,
                      structured: emptyItemForm(category).structured,
                    });
                  }}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_META[c].label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-stone-500">Day</span>
                <select
                  value={itemForm.dayId}
                  onChange={(e) => setItemForm({ ...itemForm, dayId: e.target.value })}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                >
                  <option value="">Unassigned</option>
                  {days.map((day) => (
                    <option key={day.id} value={day.id}>
                      Day {day.dayNumber} — {day.title || day.date}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-stone-500">Title *</span>
                <input
                  required
                  value={itemForm.title}
                  onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                />
              </label>

              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-stone-500">Summary</span>
                <input
                  value={itemForm.summary}
                  onChange={(e) => setItemForm({ ...itemForm, summary: e.target.value })}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-stone-500">
                  {itemForm.category === "flight"
                    ? `Departs${itemForm.structured.simple.fromIata ? ` (${itemForm.structured.simple.fromIata})` : ""} — airport local`
                    : "Start"}
                </span>
                <input
                  type="datetime-local"
                  value={itemForm.startDatetime}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, startDatetime: e.target.value })
                  }
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-stone-500">
                  {itemForm.category === "flight"
                    ? `Arrives${itemForm.structured.simple.toIata ? ` (${itemForm.structured.simple.toIata})` : ""} — airport local`
                    : "End"}
                </span>
                <input
                  type="datetime-local"
                  value={itemForm.endDatetime}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, endDatetime: e.target.value })
                  }
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                />
              </label>
            </div>

            <h3 className="mt-6 text-sm font-semibold tracking-wide text-stone-600 uppercase">
              {CATEGORY_META[itemForm.category].label} details
            </h3>
            <AdminItemDetailsForm
              category={itemForm.category}
              structured={itemForm.structured}
              allItems={items}
              onChange={(structured) => setItemForm({ ...itemForm, structured })}
            />

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={busy || !itemForm.title.trim()}
                onClick={saveItem}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Save item
              </button>
              {editingItemId ? (
                <button
                  type="button"
                  onClick={() => {
                    const cleared = emptyItemForm();
                    setEditingItemId(null);
                    setItemForm(cleared);
                    setItemBaseline(cleared);
                  }}
                  className="rounded-lg border border-stone-200 px-4 py-2 text-sm"
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setItemForm(emptyItemForm(itemForm.category))}
                  className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-4 py-2 text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Clear form
                </button>
              )}
            </div>

            <div className="mt-6 divide-y divide-stone-100">
              {sortedItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-stone-800">{item.title}</p>
                    <p className="text-sm text-stone-500">
                      {CATEGORY_META[item.category as Category]?.label ?? item.category}
                      {item.startDatetime
                        ? ` · ${new Date(item.startDatetime).toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEditItem(item)}
                      className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteItem(item.id)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SectionShell>
        </div>
      )}
    </PageShell>

      <ConfirmDialog
        open={pendingDeleteItemId != null}
        title="Delete item?"
        message="This item will be permanently removed, including any sub-items and attached documents."
        confirmLabel="Delete"
        destructive
        busy={busy}
        onClose={() => {
          if (!busy) setPendingDeleteItemId(null);
        }}
        onConfirm={() => void confirmDeleteItem()}
      />
    </>
  );
}
