"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { AdminItemDetailsForm } from "./AdminItemDetailsForm";
import { FlightScheduleTimes } from "./FlightScheduleTimes";
import { InvitationManagement } from "./InvitationManagement";
import { TravelInsurancePanel } from "./TravelInsurancePanel";
import { AppearanceSettingsPanel } from "./AppearanceSettingsPanel";
import { PublicFeaturesPanel } from "./PublicFeaturesPanel";
import { GalleryManagementPanel } from "./GalleryManagementPanel";
import { GuestbookManagementPanel } from "./GuestbookManagementPanel";
import { LandingPagePanel } from "./LandingPagePanel";
import { TripDaysPanel } from "./TripDaysPanel";
import { TbcItemsPanel } from "./TbcItemsPanel";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { GuestListClient } from "@/components/guests/GuestListClient";
import { TaskPermissionsPanel } from "./TaskPermissionsPanel";
import { SystemDiagnosticsPanel } from "./SystemDiagnosticsPanel";
import { UserManagement, type ManagedUser } from "./UserManagement";
import {
  applyStructuredDetailsToForm,
  buildItemApiPayload,
  emptyItemForm,
  itemFormsEqual,
  itemToForm,
  type ItemFormState,
} from "@/lib/admin-item-form";
import { getItemSortTime } from "@/lib/item-schedule-datetime";
import { useUnsavedChangesGuard } from "@/components/layout/NavigationGuard";
import { useDisplayFormat } from "@/hooks/useDisplayFormat";
import { DocumentsPanelContent } from "@/components/itinerary/DocumentsPanel";
import { PageShell, SectionShell } from "@/components/layout/PageShell";
import { CATEGORY_META, CATEGORIES, type Category } from "@/lib/types";
import type { AppThemeId } from "@/lib/app-theme";
import type {
  PublicInvitationEvent,
  PublicScheduleItem,
} from "@/lib/invitation-types";
import type { ItineraryDay, ItineraryItem, PublicScheduleItemRow, WeddingEvent } from "@/lib/schema";
import { isItemTbc } from "@/lib/item-tbc";

type AdminTab =
  | "days"
  | "items"
  | "documents"
  | "tbc"
  | "users"
  | "invitations"
  | "landing"
  | "guests"
  | "tasks"
  | "insurance"
  | "appearance"
  | "public"
  | "gallery"
  | "guestbook"
  | "diagnostics";

type EventWithSchedule = WeddingEvent & {
  schedule: PublicScheduleItemRow[];
};

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
  initialLandingEvents = [],
  showUserManagement = false,
  showFullAdmin = true,
  canEditItinerary = false,
  showDiagnostics = false,
  showSuperuserTools = false,
  initialThemeId,
  initialFeatures = { guestbookEnabled: false, photoGalleryEnabled: false },
  tripStartDate = null,
  tripEndDate = null,
}: {
  initialDays: ItineraryDay[];
  initialItems: ItineraryItem[];
  initialUsers?: ManagedUser[];
  initialEvents?: EventWithSchedule[];
  initialLandingEvents?: Array<
    PublicInvitationEvent & { schedule: PublicScheduleItem[] }
  >;
  showUserManagement?: boolean;
  showFullAdmin?: boolean;
  canEditItinerary?: boolean;
  showDiagnostics?: boolean;
  showSuperuserTools?: boolean;
  initialThemeId: AppThemeId;
  initialFeatures?: { guestbookEnabled: boolean; photoGalleryEnabled: boolean };
  tripStartDate?: string | null;
  tripEndDate?: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<AdminTab>(showFullAdmin ? "days" : "insurance");
  const [days, setDays] = useState(initialDays);
  const assignableDays = useMemo(
    () =>
      [...days]
        .filter((day) => !day.hidden)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [days],
  );
  const [items, setItems] = useState(initialItems);
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItemForm());
  const [itemBaseline, setItemBaseline] = useState<ItemFormState>(emptyItemForm());
  const systemUsernames = useMemo(
    () =>
      [...new Set(initialUsers.map((user) => user.username))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [initialUsers],
  );
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [pendingDeleteItemId, setPendingDeleteItemId] = useState<number | null>(
    null,
  );

  const itemDirty = useMemo(
    () => !itemFormsEqual(itemForm, itemBaseline),
    [itemForm, itemBaseline],
  );

  useUnsavedChangesGuard(tab === "items" && itemDirty);
  const { formatDayOption, formatDateOnly } = useDisplayFormat();
  const showItineraryExtras = showFullAdmin || canEditItinerary;
  const sortedItems = useMemo(() => sortItems(items), [items]);
  const tbcItems = useMemo(
    () => sortedItems.filter((item) => isItemTbc(item)),
    [sortedItems],
  );

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (
      requestedTab &&
      [
        "days",
        "items",
        "documents",
        "tbc",
        "invitations",
        "landing",
        "guests",
        "tasks",
        "insurance",
        "appearance",
        "public",
        "gallery",
        "guestbook",
        "users",
        "diagnostics",
      ].includes(requestedTab) &&
      (showFullAdmin ||
        requestedTab === "insurance" ||
        (showItineraryExtras &&
          (requestedTab === "documents" || requestedTab === "tbc")))
    ) {
      setTab(requestedTab as AdminTab);
    }
  }, [showFullAdmin, showItineraryExtras]);

  const itineraryExtraTabs: ReadonlyArray<readonly [AdminTab, string]> =
    showItineraryExtras
      ? [
          ["documents", "Documents"],
          ["tbc", "TBC"],
        ]
      : [];

  const tabs: ReadonlyArray<readonly [AdminTab, string]> = showFullAdmin
    ? [
        ["days", "Days"],
        ["items", "Items"],
        ...itineraryExtraTabs,
        ["invitations", "Invitations"],
        ["landing", "Landing page"],
        ["guests", "Guest lists"],
        ["tasks", "Task access"],
        ["insurance", "Travel insurance"],
        ["appearance", "Appearance"],
        ["public", "Public features"],
        ["gallery", "Gallery"],
        ["guestbook", "Guestbook"],
        ...(showUserManagement ? ([["users", "Users"]] as const) : []),
        ...(showDiagnostics ? ([["diagnostics", "Diagnostics"]] as const) : []),
      ]
    : canEditItinerary
      ? [["insurance", "Travel insurance"], ...itineraryExtraTabs]
      : [["insurance", "Travel insurance"]];

  function switchTab(next: AdminTab) {
    if (tab === "items" && itemDirty) {
      const ok = window.confirm(
        "You have unsaved changes. Leave this tab without saving?",
      );
      if (!ok) return;
      const cleared = emptyItemForm();
      setItemForm(cleared);
      setItemBaseline(cleared);
      setEditingItemId(null);
      setStatus(null);
    }
    setTab(next);
  }

  async function refreshDays() {
    const daysRes = await fetch("/api/days");
    if (daysRes.ok) {
      setDays(await daysRes.json());
    }
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

  async function saveItem() {
    if (!itemForm.title.trim()) {
      setStatus("Title is required.");
      return;
    }

    setBusy(true);
    setSavingItem(true);
    setStatus(null);

    try {
      const day = itemForm.dayId
        ? days.find((entry) => String(entry.id) === itemForm.dayId)
        : undefined;
      const formForSave =
        day && !itemForm.startDatetime && !itemForm.eventDate
          ? { ...itemForm, eventDate: day.date }
          : itemForm;

      const existingItem = editingItemId
        ? items.find((entry) => entry.id === editingItemId)
        : undefined;
      const payload = buildItemApiPayload(
        formForSave,
        existingItem?.details as Record<string, unknown> | undefined,
      );

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

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        const message = body.error ?? "Failed to save item.";
        setStatus(message);
        toast.error(message);
        return;
      }

      const saved = (await res.json()) as ItineraryItem;
      if (editingItemId) {
        const savedForm = itemToForm(saved);
        setItemForm(savedForm);
        setItemBaseline(savedForm);
        setStatus("Item saved.");
        toast.success("Item saved.");
      } else {
        const cleared = emptyItemForm();
        setItemForm(cleared);
        setItemBaseline(cleared);
        setEditingItemId(null);
        setStatus("Item saved.");
        toast.success("Item saved.");
      }
      await refresh();
    } finally {
      setSavingItem(false);
      setBusy(false);
    }
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
                  ? "border-brand-deep text-brand-deep"
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
          <UserManagement
            initialUsers={initialUsers}
            allowAdminPromotion={showSuperuserTools}
          />
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

      {tab === "appearance" && showFullAdmin && (
        <div className={TAB_CONTENT_CLASS}>
          <AppearanceSettingsPanel initialThemeId={initialThemeId} />
        </div>
      )}

      {tab === "public" && showFullAdmin && (
        <div className={TAB_CONTENT_CLASS}>
          <PublicFeaturesPanel
            key={`${initialFeatures.guestbookEnabled}-${initialFeatures.photoGalleryEnabled}`}
            initialFeatures={initialFeatures}
          />
        </div>
      )}

      {tab === "gallery" && showFullAdmin && (
        <div className={TAB_CONTENT_CLASS}>
          <GalleryManagementPanel
            events={initialEvents.map((event) => ({
              id: event.id,
              name: event.name,
            }))}
            photoGalleryEnabled={initialFeatures.photoGalleryEnabled}
          />
        </div>
      )}

      {tab === "guestbook" && showFullAdmin && (
        <div className={TAB_CONTENT_CLASS}>
          <GuestbookManagementPanel
            guestbookEnabled={initialFeatures.guestbookEnabled}
          />
        </div>
      )}

      {tab === "diagnostics" && showDiagnostics && (
        <div className={TAB_CONTENT_CLASS}>
          <SystemDiagnosticsPanel showSuperuserTools={showSuperuserTools} />
        </div>
      )}

      {tab === "invitations" && showFullAdmin && (
        <div className={TAB_CONTENT_CLASS}>
          <InvitationManagement initialEvents={initialEvents} />
        </div>
      )}

      {tab === "landing" && showFullAdmin && (
        <div className={TAB_CONTENT_CLASS}>
          <LandingPagePanel events={initialLandingEvents} />
        </div>
      )}

      {tab === "days" && showFullAdmin && (
        <div className={TAB_CONTENT_CLASS}>
          <TripDaysPanel
            initialDays={days}
            initialItems={items}
            tripStartDate={tripStartDate}
            tripEndDate={tripEndDate}
            onDaysChanged={refreshDays}
          />
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
                  {assignableDays.map((day) => (
                    <option key={day.id} value={day.id}>
                      {formatDayOption(day)}
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

              {itemForm.category === "flight" ? (
                <FlightScheduleTimes itemForm={itemForm} setItemForm={setItemForm} />
              ) : itemForm.category !== "accommodation" &&
                itemForm.category !== "activity" ? (
                <>
                  <label className="block text-sm">
                    <span className="mb-1 block text-stone-500">Start</span>
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
                    <span className="mb-1 block text-stone-500">End</span>
                    <input
                      type="datetime-local"
                      value={itemForm.endDatetime}
                      onChange={(e) =>
                        setItemForm({ ...itemForm, endDatetime: e.target.value })
                      }
                      className="w-full rounded-lg border border-stone-200 px-3 py-2"
                    />
                  </label>
                </>
              ) : null}
            </div>

            <h3 className="mt-6 text-sm font-semibold tracking-wide text-stone-600 uppercase">
              {CATEGORY_META[itemForm.category].label} details
            </h3>
            <AdminItemDetailsForm
              category={itemForm.category}
              structured={itemForm.structured}
              allItems={items}
              systemUsernames={systemUsernames}
              eventDate={itemForm.eventDate}
              startDatetime={itemForm.startDatetime}
              endDatetime={itemForm.endDatetime}
              onChange={(structured) =>
                setItemForm((current) =>
                  applyStructuredDetailsToForm(current, structured),
                )
              }
            />

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={busy || savingItem || !itemForm.title.trim()}
                onClick={saveItem}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-deep px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {savingItem ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {savingItem ? "Saving…" : "Save item"}
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

      {tab === "documents" && showItineraryExtras && (
        <div className={TAB_CONTENT_CLASS}>
          <SectionShell title="Documents">
            <p className="mb-4 text-sm text-stone-500">
              All documents you can access, grouped by itinerary item type.
            </p>
            <DocumentsPanelContent
              onOpenLinkedItem={(itemId) => {
                const item = items.find((entry) => entry.id === itemId);
                if (item) startEditItem(item);
              }}
            />
          </SectionShell>
        </div>
      )}

      {tab === "tbc" && showItineraryExtras && (
        <div className={TAB_CONTENT_CLASS}>
          <SectionShell title="TBC & unbooked items">
            <p className="mb-4 text-sm text-stone-500">
              Flights and pet travel marked to be confirmed, plus stays and car
              rentals that are not booked yet.
            </p>
            <TbcItemsPanel items={tbcItems} days={days} onEdit={startEditItem} />
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
