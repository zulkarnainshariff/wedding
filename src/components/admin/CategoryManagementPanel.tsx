"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { useCategories } from "@/components/categories/CategoriesProvider";
import {
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_ICON_OPTIONS,
  getCategoryIconByName,
  getCategoryStylesByColor,
} from "@/lib/category-ui";
import { slugifyCategoryLabel } from "@/lib/app-categories";
import type { AppCategoryRow } from "@/lib/schema";

type UsageCounts = Record<string, { items: number; documents: number }>;

type EditFormState = {
  label: string;
  plural: string;
  shortLabel: string;
  icon: string;
  color: string;
  sortOrder: string;
};

type NewFormState = EditFormState & {
  slug: string;
  forItems: boolean;
  forDocuments: boolean;
};

function emptyEditForm(): EditFormState {
  return {
    label: "",
    plural: "",
    shortLabel: "",
    icon: "layout-grid",
    color: "stone",
    sortOrder: "100",
  };
}

function emptyNewForm(): NewFormState {
  return {
    ...emptyEditForm(),
    slug: "",
    forItems: true,
    forDocuments: false,
  };
}

function CategoryRowPreview({
  row,
  counts,
}: {
  row: AppCategoryRow;
  counts: UsageCounts;
}) {
  const styles = getCategoryStylesByColor(row.color);
  const Icon = getCategoryIconByName(row.icon);
  const usage = counts[row.slug] ?? { items: 0, documents: 0 };

  return (
    <div className="flex items-start gap-3">
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${styles.bg} ${styles.border}`}
      >
        <Icon className={`h-5 w-5 ${styles.text}`} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-stone-900">{row.label}</p>
        <p className="text-xs text-stone-500">
          <span className="font-mono">{row.slug}</span>
          {" · "}
          {row.pageBehavior}
        </p>
        <p className="mt-1 text-xs text-stone-400">
          {usage.items} item{usage.items === 1 ? "" : "s"}
          {" · "}
          {usage.documents} document{usage.documents === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}

export function CategoryManagementPanel() {
  const toast = useToast();
  const { refresh } = useCategories();
  const [section, setSection] = useState<"items" | "documents">("items");
  const [categories, setCategories] = useState<AppCategoryRow[]>([]);
  const [usageCounts, setUsageCounts] = useState<UsageCounts>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>(emptyEditForm());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newForm, setNewForm] = useState<NewFormState>(emptyNewForm());
  const [deleteTarget, setDeleteTarget] = useState<AppCategoryRow | null>(null);
  const [reassignTo, setReassignTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/system/categories");
      if (!response.ok) throw new Error("Failed to load categories");
      const data = (await response.json()) as {
        categories: AppCategoryRow[];
        usageCounts: UsageCounts;
      };
      setCategories(data.categories);
      setUsageCounts(data.usageCounts ?? {});
    } catch {
      toast.error("Could not load categories.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredCategories = useMemo(
    () =>
      categories
        .filter((row) =>
          section === "items" ? row.forItems : row.forDocuments,
        )
        .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug)),
    [categories, section],
  );

  const reassignOptions = useMemo(() => {
    if (!deleteTarget) return [];
    return categories.filter((row) => {
      if (row.slug === deleteTarget.slug) return false;
      if (deleteTarget.forItems && !row.forItems) return false;
      if (deleteTarget.forDocuments && !row.forDocuments) return false;
      return true;
    });
  }, [categories, deleteTarget]);

  function startEdit(row: AppCategoryRow) {
    setEditingSlug(row.slug);
    setEditForm({
      label: row.label,
      plural: row.plural,
      shortLabel: row.shortLabel,
      icon: row.icon,
      color: row.color,
      sortOrder: String(row.sortOrder),
    });
    setShowAddForm(false);
  }

  function cancelEdit() {
    setEditingSlug(null);
    setEditForm(emptyEditForm());
  }

  async function saveEdit() {
    if (!editingSlug) return;
    setBusy(true);
    try {
      const response = await fetch("/api/system/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: editingSlug,
          label: editForm.label,
          plural: editForm.plural,
          shortLabel: editForm.shortLabel,
          icon: editForm.icon,
          color: editForm.color,
          sortOrder: Number(editForm.sortOrder) || 0,
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Could not save category");
      }
      toast.success("Category updated.");
      cancelEdit();
      await load();
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save category.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function createCategory() {
    setBusy(true);
    try {
      const response = await fetch("/api/system/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: newForm.slug,
          label: newForm.label,
          plural: newForm.plural || newForm.label,
          shortLabel: newForm.shortLabel || newForm.label,
          icon: newForm.icon,
          color: newForm.color,
          sortOrder: Number(newForm.sortOrder) || 100,
          forItems: newForm.forItems,
          forDocuments: newForm.forDocuments,
          pageBehavior: "list",
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Could not create category");
      }
      toast.success("Category created.");
      setShowAddForm(false);
      setNewForm(emptyNewForm());
      await load();
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create category.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || !reassignTo) return;
    setBusy(true);
    try {
      const response = await fetch("/api/system/categories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: deleteTarget.slug,
          reassignTo,
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Could not delete category");
      }
      toast.success("Category deleted.");
      setDeleteTarget(null);
      setReassignTo("");
      await load();
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete category.",
      );
    } finally {
      setBusy(false);
    }
  }

  function renderEditFields(
    form: EditFormState,
    setForm: (next: EditFormState) => void,
  ) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-stone-500">Label</span>
          <input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Plural</span>
          <input
            value={form.plural}
            onChange={(e) => setForm({ ...form, plural: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Short label</span>
          <input
            value={form.shortLabel}
            onChange={(e) => setForm({ ...form, shortLabel: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Icon</span>
          <select
            value={form.icon}
            onChange={(e) => setForm({ ...form, icon: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          >
            {CATEGORY_ICON_OPTIONS.map((icon) => (
              <option key={icon} value={icon}>
                {icon}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Color</span>
          <select
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          >
            {CATEGORY_COLOR_OPTIONS.map((color) => (
              <option key={color} value={color}>
                {color}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Sort order</span>
          <input
            type="number"
            value={form.sortOrder}
            onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          />
        </label>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-xl text-brand-deep">Categories</h2>
        <p className="mt-1 text-sm text-stone-500">
          Manage item and document categories. Built-in categories keep their
          specialized pages; new item categories use the generic list view.
        </p>
      </div>

      <div className="flex gap-2">
        {(["items", "documents"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setSection(key);
              cancelEdit();
              setShowAddForm(false);
            }}
            className={[
              "rounded-xl px-4 py-2 text-sm font-medium",
              section === key
                ? "bg-brand-deep text-white"
                : "border border-stone-200 bg-white text-stone-600",
            ].join(" ")}
          >
            {key === "items" ? "Item categories" : "Document categories"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading categories…
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCategories.map((row) => (
            <div
              key={row.slug}
              className="rounded-2xl border border-stone-200 bg-white p-4"
            >
              {editingSlug === row.slug ? (
                <div className="space-y-4">
                  {renderEditFields(editForm, setEditForm)}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void saveEdit()}
                      disabled={busy}
                      className="rounded-xl bg-brand-deep px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={busy}
                      className="rounded-xl border border-stone-200 px-4 py-2 text-sm text-stone-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <CategoryRowPreview row={row} counts={usageCounts} />
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"
                      aria-label={`Edit ${row.label}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteTarget(row);
                        const options = categories.filter((candidate) => {
                          if (candidate.slug === row.slug) return false;
                          if (row.forItems && !candidate.forItems) return false;
                          if (row.forDocuments && !candidate.forDocuments)
                            return false;
                          return true;
                        });
                        setReassignTo(options[0]?.slug ?? "");
                      }}
                      className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                      aria-label={`Delete ${row.label}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddForm ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/50 p-4">
          <h3 className="font-medium text-stone-900">Add category</h3>
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-stone-500">Label</span>
                <input
                  value={newForm.label}
                  onChange={(e) => {
                    const label = e.target.value;
                    setNewForm({
                      ...newForm,
                      label,
                      slug: newForm.slug
                        ? newForm.slug
                        : slugifyCategoryLabel(label),
                      plural: newForm.plural || label,
                      shortLabel: newForm.shortLabel || label,
                    });
                  }}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="mb-1 block text-stone-500">Slug</span>
                <input
                  value={newForm.slug}
                  onChange={(e) =>
                    setNewForm({ ...newForm, slug: e.target.value })
                  }
                  className="w-full rounded-lg border border-stone-200 px-3 py-2 font-mono text-sm"
                />
              </label>
            </div>
            {renderEditFields(newForm, (next) => setNewForm({ ...newForm, ...next }))}
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newForm.forItems}
                  onChange={(e) =>
                    setNewForm({ ...newForm, forItems: e.target.checked })
                  }
                />
                For itinerary items
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newForm.forDocuments}
                  onChange={(e) =>
                    setNewForm({ ...newForm, forDocuments: e.target.checked })
                  }
                />
                For documents
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void createCategory()}
                disabled={busy || !newForm.label.trim() || !newForm.slug.trim()}
                className="rounded-xl bg-brand-deep px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setNewForm(emptyNewForm());
                }}
                disabled={busy}
                className="rounded-xl border border-stone-200 px-4 py-2 text-sm text-stone-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setShowAddForm(true);
            cancelEdit();
            setNewForm({
              ...emptyNewForm(),
              forItems: section === "items",
              forDocuments: section === "documents",
            });
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:border-brand/30"
        >
          <Plus className="h-4 w-4" />
          Add category
        </button>
      )}

      {deleteTarget ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-stone-900/45 backdrop-blur-[2px]"
            onClick={() => {
              if (!busy) {
                setDeleteTarget(null);
                setReassignTo("");
              }
            }}
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <h2 className="font-serif text-xl text-brand-deep">
              Delete {deleteTarget.label}?
            </h2>
            <p className="mt-2 text-sm text-stone-500">
              Items and documents using this category will be reassigned. Choose
              a replacement category.
            </p>
            {reassignOptions.length === 0 ? (
              <p className="mt-4 text-sm text-red-600">
                No compatible replacement category is available. Create one
                first or edit another category to support the same scope.
              </p>
            ) : (
              <label className="mt-4 block text-sm">
                <span className="mb-1 block font-medium text-stone-700">
                  Reassign to
                </span>
                <select
                  value={reassignTo}
                  onChange={(e) => setReassignTo(e.target.value)}
                  disabled={busy}
                  className="w-full rounded-lg border border-stone-200 px-3 py-2"
                >
                  {reassignOptions.map((row) => (
                    <option key={row.slug} value={row.slug}>
                      {row.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setReassignTo("");
                }}
                disabled={busy}
                className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={busy || !reassignTo || reassignOptions.length === 0}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                Delete category
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
