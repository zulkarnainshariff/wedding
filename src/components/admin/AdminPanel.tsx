"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { CATEGORY_META, CATEGORIES, type Category } from "@/lib/types";
import type { ItineraryDay, ItineraryItem } from "@/lib/schema";

const EMPTY_DETAILS: Record<Category, Record<string, string>> = {
  flight: {
    airline: "",
    flightNumber: "",
    departureAirport: "",
    arrivalAirport: "",
    departureTime: "",
    arrivalTime: "",
    confirmationCode: "",
    terminal: "",
    seat: "",
    notes: "",
  },
  accommodation: {
    platform: "Airbnb",
    listingUrl: "",
    address: "",
    lat: "",
    lng: "",
    checkInTime: "",
    checkOutTime: "",
    hostName: "",
    confirmationCode: "",
    notes: "",
  },
  car_rental: {
    company: "",
    vehicleModel: "",
    pickupLocation: "",
    pickupLat: "",
    pickupLng: "",
    pickupTime: "",
    returnLocation: "",
    returnLat: "",
    returnLng: "",
    returnTime: "",
    confirmationCode: "",
    notes: "",
  },
  travel_insurance: {
    provider: "",
    policyNumber: "",
    coverage: "",
    emergencyPhone: "",
    documentUrl: "",
    notes: "",
  },
};

function toDatetimeLocal(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseDetails(
  category: Category,
  details: Record<string, unknown>,
): Record<string, string> {
  const base = { ...EMPTY_DETAILS[category] };
  for (const key of Object.keys(base)) {
    const val = details[key];
    if (val != null) base[key] = String(val);
  }
  return base;
}

function buildDetailsPayload(
  category: Category,
  fields: Record<string, string>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!value) continue;
    if (["lat", "lng", "pickupLat", "pickupLng", "returnLat", "returnLng"].includes(key)) {
      payload[key] = Number(value);
    } else {
      payload[key] = value;
    }
  }
  return payload;
}

type ItemFormState = {
  id?: number;
  dayId: string;
  category: Category;
  title: string;
  summary: string;
  startDatetime: string;
  endDatetime: string;
  sortOrder: string;
  details: Record<string, string>;
};

function emptyItemForm(category: Category = "flight"): ItemFormState {
  return {
    dayId: "",
    category,
    title: "",
    summary: "",
    startDatetime: "",
    endDatetime: "",
    sortOrder: "0",
    details: { ...EMPTY_DETAILS[category] },
  };
}

function itemToForm(item: ItineraryItem): ItemFormState {
  const category = item.category as Category;
  return {
    id: item.id,
    dayId: item.dayId ? String(item.dayId) : "",
    category,
    title: item.title,
    summary: item.summary ?? "",
    startDatetime: toDatetimeLocal(item.startDatetime),
    endDatetime: toDatetimeLocal(item.endDatetime),
    sortOrder: String(item.sortOrder ?? 0),
    details: parseDetails(category, item.details as Record<string, unknown>),
  };
}

export function AdminPanel({
  initialDays,
  initialItems,
}: {
  initialDays: ItineraryDay[];
  initialItems: ItineraryItem[];
}) {
  const router = useRouter();
  const [days, setDays] = useState(initialDays);
  const [items, setItems] = useState(initialItems);
  const [itemForm, setItemForm] = useState<ItemFormState>(emptyItemForm());
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [dayForm, setDayForm] = useState({
    dayNumber: "",
    date: "",
    title: "",
    notes: "",
  });
  const [editingDayId, setEditingDayId] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

    setDayForm({ dayNumber: "", date: "", title: "", notes: "" });
    setEditingDayId(null);
    setStatus("Day saved.");
    await refresh();
  }

  async function deleteDay(id: number) {
    if (!confirm("Delete this day? Items linked to it will become unassigned.")) return;
    setBusy(true);
    await fetch(`/api/days/${id}`, { method: "DELETE" });
    setBusy(false);
    await refresh();
  }

  async function saveItem() {
    setBusy(true);
    setStatus(null);

    const payload = {
      dayId: itemForm.dayId ? Number(itemForm.dayId) : null,
      category: itemForm.category,
      title: itemForm.title,
      summary: itemForm.summary || null,
      startDatetime: itemForm.startDatetime || null,
      endDatetime: itemForm.endDatetime || null,
      sortOrder: Number(itemForm.sortOrder || 0),
      details: buildDetailsPayload(itemForm.category, itemForm.details),
    };

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

    setItemForm(emptyItemForm());
    setEditingItemId(null);
    setStatus("Item saved.");
    await refresh();
  }

  async function deleteItem(id: number) {
    if (!confirm("Delete this item?")) return;
    setBusy(true);
    await fetch(`/api/items/${id}`, { method: "DELETE" });
    setBusy(false);
    if (editingItemId === id) {
      setItemForm(emptyItemForm());
      setEditingItemId(null);
    }
    await refresh();
  }

  function startEditItem(item: ItineraryItem) {
    setEditingItemId(item.id);
    setItemForm(itemToForm(item));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEditDay(day: ItineraryDay) {
    setEditingDayId(day.id);
    setDayForm({
      dayNumber: String(day.dayNumber),
      date: day.date,
      title: day.title ?? "",
      notes: day.notes ?? "",
    });
  }

  const detailFields = Object.keys(EMPTY_DETAILS[itemForm.category]);

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <header>
        <p className="text-xs font-semibold tracking-[0.2em] text-[#d4a853] uppercase">
          Manage
        </p>
        <h1 className="mt-1 font-serif text-3xl text-[#1e3a5f]">Edit Itinerary</h1>
        <p className="mt-2 text-stone-500">
          Add, update, or remove days and bookings. Changes appear immediately on
          the itinerary.
        </p>
        {status && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {status}
          </p>
        )}
      </header>

      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="font-serif text-xl text-[#1e3a5f]">
          {editingDayId ? "Edit day" : "Add day"}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
            className="inline-flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Save day
          </button>
          {editingDayId && (
            <button
              type="button"
              onClick={() => {
                setEditingDayId(null);
                setDayForm({ dayNumber: "", date: "", title: "", notes: "" });
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
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="font-serif text-xl text-[#1e3a5f]">
          {editingItemId ? "Edit item" : "Add item"}
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-stone-500">Category</span>
            <select
              value={itemForm.category}
              onChange={(e) => {
                const category = e.target.value as Category;
                setItemForm({
                  ...itemForm,
                  category,
                  details: { ...EMPTY_DETAILS[category] },
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
            <span className="mb-1 block text-stone-500">Day (optional)</span>
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
            <span className="mb-1 block text-stone-500">Title</span>
            <input
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

          <label className="block text-sm">
            <span className="mb-1 block text-stone-500">Sort order</span>
            <input
              type="number"
              value={itemForm.sortOrder}
              onChange={(e) =>
                setItemForm({ ...itemForm, sortOrder: e.target.value })
              }
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
        </div>

        <h3 className="mt-6 text-sm font-semibold text-stone-600 uppercase tracking-wide">
          {CATEGORY_META[itemForm.category].label} details
        </h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {detailFields.map((field) => (
            <label key={field} className="block text-sm">
              <span className="mb-1 block capitalize text-stone-500">
                {field.replace(/([A-Z])/g, " $1")}
              </span>
              {field === "notes" ? (
                <textarea
                  value={itemForm.details[field] ?? ""}
                  onChange={(e) =>
                    setItemForm({
                      ...itemForm,
                      details: { ...itemForm.details, [field]: e.target.value },
                    })
                  }
                  rows={3}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                />
              ) : (
                <input
                  value={itemForm.details[field] ?? ""}
                  onChange={(e) =>
                    setItemForm({
                      ...itemForm,
                      details: { ...itemForm.details, [field]: e.target.value },
                    })
                  }
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                />
              )}
            </label>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy || !itemForm.title}
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
                setEditingItemId(null);
                setItemForm(emptyItemForm());
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
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-stone-800">{item.title}</p>
                <p className="text-sm text-stone-500">
                  {CATEGORY_META[item.category as Category]?.label ?? item.category}
                  {item.summary ? ` · ${item.summary}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
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
      </section>
    </div>
  );
}
