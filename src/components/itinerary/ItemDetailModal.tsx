"use client";

import { useEffect, useState } from "react";
import { ItemDetailView } from "@/components/itinerary/ItemDetail";
import { ItemEditView } from "@/components/itinerary/ItemEditView";
import { SubItemEditForm } from "@/components/itinerary/SubItemEditForm";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/components/auth/AuthProvider";
import { useItineraryUI } from "@/components/itinerary/ItineraryUIContext";
import { isSubItem } from "@/lib/item-subitems";
import { itemSectionId, scrollToElementById } from "@/lib/day-jump";
import type { ItineraryItem } from "@/lib/schema";
import { useRouter } from "next/navigation";

export function ItemDetailModal() {
  const router = useRouter();
  const { canEdit } = useAuth();
  const {
    selectedItemId,
    selectedItem,
    loadingItem,
    itemLoadError,
    isClosingItem,
    closeItem,
    refreshSelectedItem,
  } = useItineraryUI();
  const [editing, setEditing] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [parentItem, setParentItem] = useState<ItineraryItem | null>(null);

  useEffect(() => {
    setEditing(false);
    setDeleteConfirmOpen(false);
  }, [selectedItemId]);

  useEffect(() => {
    if (!editing) return;
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>('[role="dialog"] [data-item-edit-scroll]')
        ?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [editing, selectedItemId]);

  function handleEditSaved() {
    const itemId = selectedItem?.id;
    setEditing(false);
    void refreshSelectedItem({ silent: true }).then(() => {
      if (itemId == null) return;
      requestAnimationFrame(() => {
        scrollToElementById(itemSectionId(itemId));
      });
    });
  }

  useEffect(() => {
    if (!selectedItem?.parentItemId) {
      setParentItem(null);
      return;
    }

    void fetch(`/api/items/${selectedItem.parentItemId}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((item: ItineraryItem | null) => setParentItem(item))
      .catch(() => setParentItem(null));
  }, [selectedItem?.parentItemId]);

  if (!selectedItemId || isClosingItem) return null;

  function handleClose() {
    setEditing(false);
    setDeleteConfirmOpen(false);
    closeItem();
  }

  function requestDelete() {
    setDeleteConfirmOpen(true);
  }

  async function confirmDelete() {
    if (!selectedItem) return;

    setDeleting(true);
    const response = await fetch(`/api/items/${selectedItem.id}`, {
      method: "DELETE",
    });
    setDeleting(false);

    if (!response.ok) {
      alert("Could not delete this item.");
      return;
    }

    setDeleteConfirmOpen(false);
    router.refresh();
    handleClose();
  }

  const deleteLabel = selectedItem?.parentItemId ? "sub-item" : "item";
  const deleteMessage = selectedItem?.parentItemId
    ? "This sub-item will be permanently removed."
    : "This item will be permanently removed, including any sub-items and attached documents.";

  return (
    <>
      <div
        data-item-detail-modal
        className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden p-0 sm:items-center sm:p-4"
        role="presentation"
      >
        <div className="absolute inset-0 bg-stone-900/45 backdrop-blur-[2px]" />

        <div
          className="relative flex max-h-[min(92dvh,100%)] w-full max-w-3xl flex-col overflow-hidden"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {!selectedItem && !itemLoadError && (
            <div className="rounded-3xl border border-stone-200 bg-white p-10 text-center text-stone-500">
              Loading...
            </div>
          )}

          {selectedItem && editing && canEdit && isSubItem(selectedItem) && (
            <SubItemEditForm
              item={selectedItem}
              parentItem={parentItem}
              modal
              onCancel={() => setEditing(false)}
              onSaved={handleEditSaved}
              onDelete={requestDelete}
            />
          )}

          {selectedItem && editing && canEdit && !isSubItem(selectedItem) && (
            <ItemEditView
              item={selectedItem}
              modal
              onCancel={() => setEditing(false)}
              onSaved={handleEditSaved}
              onDelete={requestDelete}
            />
          )}

          {selectedItem && !editing && (
            <ItemDetailView
              item={selectedItem}
              onClose={handleClose}
              onEdit={canEdit ? () => setEditing(true) : undefined}
              onDelete={canEdit ? requestDelete : undefined}
              canEdit={canEdit}
              modal
            />
          )}

          {itemLoadError === "forbidden" && !selectedItem && !loadingItem && (
            <div className="rounded-3xl border border-stone-200 bg-white p-10 text-center text-stone-500">
              You do not have permission to view this item.
            </div>
          )}

          {itemLoadError === "not_found" && !selectedItem && !loadingItem && (
            <div className="rounded-3xl border border-stone-200 bg-white p-10 text-center text-stone-500">
              Item not found.
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title={`Delete ${deleteLabel}?`}
        message={deleteMessage}
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onClose={() => {
          if (!deleting) setDeleteConfirmOpen(false);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}
