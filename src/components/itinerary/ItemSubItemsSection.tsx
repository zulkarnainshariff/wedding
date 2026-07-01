"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { SubItemAdditionalViewersField } from "@/components/itinerary/SubItemAdditionalViewersField";
import { SubItemParticipantsField } from "@/components/itinerary/SubItemParticipantsField";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SubItemRow } from "@/components/itinerary/SubItemDisplay";
import { getSubItemFormPlaceholders } from "@/lib/sub-item-placeholders";
import { parentItemParticipants } from "@/lib/item-subitems";
import { useAccountUsernames } from "@/hooks/useAccountUsernames";
import type { ItineraryItem } from "@/lib/schema";

function SubItemDetailRow({
  subItem,
  canEdit,
  onDelete,
}: {
  subItem: ItineraryItem;
  canEdit: boolean;
  onDelete: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const description =
    subItem.summary ||
    (typeof subItem.details === "object" &&
    subItem.details &&
    "description" in subItem.details
      ? String((subItem.details as { description?: string }).description ?? "")
      : "");

  return (
    <div className="rounded-xl border border-stone-200 bg-white">
      <div className="flex items-start gap-2">
        {description ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="mt-3 ml-1 shrink-0 text-stone-400 hover:text-stone-600"
            aria-label={open ? "Collapse details" : "Expand details"}
          >
            {open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <SubItemRow subItem={subItem} />
          {description && open && (
            <p className="px-3 pb-3 whitespace-pre-wrap text-sm text-stone-600">
              {description}
            </p>
          )}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => onDelete(subItem.id)}
            className="mt-2 mr-2 shrink-0 rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
            aria-label="Delete sub-item"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

export function ItemSubItemsSection({ item }: { item: ItineraryItem }) {
  const { canEdit } = useAuth();
  const [subItems, setSubItems] = useState<ItineraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationMapUrl, setLocationMapUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [participants, setParticipants] = useState<string[]>([]);
  const [viewers, setViewers] = useState<string[]>([]);
  const [viewerLinks, setViewerLinks] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const placeholders = getSubItemFormPlaceholders(item);
  const accountUsernames = useAccountUsernames();
  const parentParticipants = useMemo(
    () => parentItemParticipants(item),
    [item],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/items/${item.id}/subitems`);
      if (response.ok) {
        setSubItems(await response.json());
      }
    } finally {
      setLoading(false);
    }
  }, [item.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    const response = await fetch(`/api/items/${item.id}/subitems`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        time: time || null,
        locationName: locationName.trim() || null,
        locationMapUrl: locationMapUrl.trim() || null,
        summary: summary.trim() || null,
        participants,
        viewers,
        viewerLinks,
      }),
    });
    setSaving(false);

    if (!response.ok) return;

    setTitle("");
    setTime("");
    setLocationName("");
    setLocationMapUrl("");
    setSummary("");
    setParticipants([]);
    setViewers([]);
    setViewerLinks({});
    await refresh();
  }

  function requestDelete(id: number) {
    setPendingDeleteId(id);
  }

  async function confirmDelete() {
    if (pendingDeleteId == null) return;

    setDeleting(true);
    const response = await fetch(`/api/items/${pendingDeleteId}`, {
      method: "DELETE",
    });
    setDeleting(false);
    setPendingDeleteId(null);

    if (response.ok) {
      await refresh();
    }
  }

  if (!loading && subItems.length === 0 && !canEdit) {
    return null;
  }

  return (
    <>
      <div className="border-t border-stone-100 py-4">
        <h3 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
          Sub-itinerary
        </h3>

        {loading ? (
          <p className="mt-3 text-sm text-stone-400">Loading…</p>
        ) : subItems.length === 0 ? (
          <p className="mt-3 text-sm text-stone-400">No sub-items yet.</p>
        ) : (
          <div className="mt-3 space-y-2 border-l-2 border-accent/40 pl-3">
            {subItems.map((subItem) => (
              <SubItemDetailRow
                key={subItem.id}
                subItem={subItem}
                canEdit={canEdit}
                onDelete={requestDelete}
              />
            ))}
          </div>
        )}

        {canEdit && (
          <form
            onSubmit={(e) => void handleAdd(e)}
            className="mt-4 space-y-3 rounded-xl border border-dashed border-stone-300 bg-white p-4"
          >
            <p className="text-sm font-medium text-stone-700">Add sub-item</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-stone-500">Title *</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={placeholders.title}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                  required
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-stone-500">Time (optional)</span>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                />
              </label>
              <SubItemParticipantsField
                participants={participants}
                onChange={setParticipants}
                parentParticipants={parentParticipants}
              />
              <SubItemAdditionalViewersField
                parentItem={item}
                participants={participants}
                viewers={viewers}
                viewerLinks={viewerLinks}
                onChange={({ viewers: nextViewers, viewerLinks: nextLinks }) => {
                  setViewers(nextViewers);
                  setViewerLinks(nextLinks);
                }}
                accountUsernames={accountUsernames}
              />
              <label className="block text-sm">
                <span className="mb-1 block text-stone-500">Location name (optional)</span>
                <input
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder={placeholders.locationName}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-stone-500">
                  Google Maps link (optional)
                </span>
                <input
                  type="url"
                  value={locationMapUrl}
                  onChange={(e) => setLocationMapUrl(e.target.value)}
                  placeholder={placeholders.locationMapUrl}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-stone-500">Details (optional)</span>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-deep px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {saving ? "Adding…" : "Add sub-item"}
            </button>
          </form>
        )}
      </div>

      <ConfirmDialog
        open={pendingDeleteId != null}
        title="Delete sub-item?"
        message="This sub-item will be permanently removed."
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onClose={() => {
          if (!deleting) setPendingDeleteId(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
