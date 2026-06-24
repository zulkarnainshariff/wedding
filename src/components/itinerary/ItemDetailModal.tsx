"use client";

import { useEffect, useState } from "react";
import { ItemDetailView } from "@/components/itinerary/ItemDetail";
import { ItemEditView } from "@/components/itinerary/ItemEditView";
import { useAuth } from "@/components/auth/AuthProvider";
import { useItineraryUI } from "@/components/itinerary/ItineraryUIContext";

export function ItemDetailModal() {
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

  useEffect(() => {
    setEditing(false);
  }, [selectedItemId]);

  if (!selectedItemId || isClosingItem) return null;

  function handleClose() {
    setEditing(false);
    closeItem();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      onClick={handleClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-stone-900/45 backdrop-blur-[2px]" />

      <div
        className="relative w-full max-w-3xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {loadingItem && (
          <div className="rounded-3xl border border-stone-200 bg-white p-10 text-center text-stone-500">
            Loading...
          </div>
        )}

        {!loadingItem && selectedItem && editing && canEdit && (
          <ItemEditView
            item={selectedItem}
            modal
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              void refreshSelectedItem();
            }}
          />
        )}

        {!loadingItem && selectedItem && !editing && (
          <ItemDetailView
            item={selectedItem}
            onClose={handleClose}
            onEdit={canEdit ? () => setEditing(true) : undefined}
            modal
          />
        )}

        {!loadingItem && !selectedItem && (
          <div className="rounded-3xl border border-stone-200 bg-white p-10 text-center text-stone-500">
            {itemLoadError === "forbidden"
              ? "You do not have permission to view this item."
              : "Item not found."}
          </div>
        )}
      </div>
    </div>
  );
}
