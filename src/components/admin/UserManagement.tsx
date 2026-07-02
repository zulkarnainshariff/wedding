"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2 } from "lucide-react";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { SectionShell } from "@/components/layout/PageShell";
import { adminUserRowId, scrollToElementById } from "@/lib/day-jump";
import { CATEGORIES, CATEGORY_META, type Category } from "@/lib/types";
import type { UserPermissions } from "@/lib/permissions";

export type ManagedUser = {
  id: number;
  username: string;
  isAdmin: boolean;
  permissions: UserPermissions;
  guardianUserIds?: number[];
};

const EMPTY_FORM = {
  username: "",
  password: "",
  isAdmin: false,
  viewAllCategories: true,
  viewCategories: [] as Category[],
  viewAllTravellers: true,
  viewTravellers: [] as string[],
  guardianUserIds: [] as number[],
  canEdit: false,
};

function formatTravellerAccess(permissions: UserPermissions): string {
  if (permissions.viewTravellers === "all") return "All travellers";
  if (permissions.viewTravellers.length <= 3) {
    return permissions.viewTravellers.join(", ");
  }
  return `${permissions.viewTravellers.length} travellers`;
}

export function UserManagement({
  initialUsers,
  allowAdminPromotion = false,
}: {
  initialUsers: ManagedUser[];
  allowAdminPromotion?: boolean;
}) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [forceUserIds, setForceUserIds] = useState<number[]>([]);
  const [forcePassword, setForcePassword] = useState("");
  const [scrollToUserId, setScrollToUserId] = useState<number | null>(null);
  const editSectionRef = useRef<HTMLDivElement>(null);

  const lockedUsername = form.username.trim().toLowerCase();

  async function refreshUsers() {
    const response = await fetch("/api/users");
    if (response.ok) {
      setUsers(await response.json());
    }
  }

  function startEdit(user: ManagedUser) {
    setEditingId(user.id);
    setForm({
      username: user.username,
      password: "",
      isAdmin: user.isAdmin,
      viewAllCategories: user.permissions.viewCategories === "all",
      viewCategories:
        user.permissions.viewCategories === "all"
          ? []
          : [...user.permissions.viewCategories],
      viewAllTravellers: user.permissions.viewTravellers === "all",
      viewTravellers:
        user.permissions.viewTravellers === "all"
          ? []
          : [...user.permissions.viewTravellers],
      canEdit: user.permissions.canEdit,
      guardianUserIds: user.guardianUserIds ?? [],
    });
    setError(null);
    requestAnimationFrame(() => {
      editSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function saveUser() {
    setSaving(true);
    setError(null);

    const permissions = {
      viewCategories:
        form.isAdmin || form.viewAllCategories ? "all" : form.viewCategories,
      viewTravellers:
        form.isAdmin || form.viewAllTravellers ? "all" : form.viewTravellers,
      canEdit: form.isAdmin || form.canEdit,
      canManageUsers: form.isAdmin,
    };

    try {
      const payload = {
        username: form.username,
        password: form.password || undefined,
        isAdmin: form.isAdmin,
        permissions,
        ...(editingId ? { guardianUserIds: form.guardianUserIds } : {}),
      };

      const response = await fetch(
        editingId ? `/api/users/${editingId}` : "/api/users",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "Unable to save user");
        return;
      }

      const savedUserId = editingId;
      resetForm();
      await refreshUsers();
      if (savedUserId) {
        setScrollToUserId(savedUserId);
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(id: number) {
    if (!confirm("Delete this user?")) return;
    const response = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Unable to delete user");
      return;
    }
    if (editingId === id) resetForm();
    await refreshUsers();
  }

  async function forcePasswordReset() {
    if (!forceUserIds.length || !forcePassword) {
      setError("Select at least one user and enter a new password.");
      return;
    }
    setSaving(true);
    setError(null);
    const response = await fetch("/api/users/force-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userIds: forceUserIds, password: forcePassword }),
    });
    setSaving(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Unable to reset passwords");
      return;
    }
    setForceUserIds([]);
    setForcePassword("");
    await refreshUsers();
  }

  function toggleCategory(category: Category) {
    setForm((current) => ({
      ...current,
      viewCategories: current.viewCategories.includes(category)
        ? current.viewCategories.filter((c) => c !== category)
        : [...current.viewCategories, category],
    }));
  }

  function toggleViewTraveller(username: string) {
    const normalized = username.toLowerCase();
    if (normalized === lockedUsername) return;

    setForm((current) => ({
      ...current,
      viewTravellers: current.viewTravellers.includes(normalized)
        ? current.viewTravellers.filter((name) => name !== normalized)
        : [...current.viewTravellers, normalized],
    }));
  }

  function toggleGuardian(guardianUserId: number) {
    setForm((current) => ({
      ...current,
      guardianUserIds: current.guardianUserIds.includes(guardianUserId)
        ? current.guardianUserIds.filter((id) => id !== guardianUserId)
        : [...current.guardianUserIds, guardianUserId],
    }));
  }

  function toggleForceUser(id: number) {
    setForceUserIds((current) =>
      current.includes(id) ? current.filter((userId) => userId !== id) : [...current, id],
    );
  }

  function isTravellerSelected(username: string) {
    const normalized = username.toLowerCase();
    if (form.viewAllTravellers || form.isAdmin) return true;
    return (
      normalized === lockedUsername ||
      form.viewTravellers.includes(normalized)
    );
  }

  useLayoutEffect(() => {
    if (scrollToUserId == null) return;
    const userId = scrollToUserId;
    const frame = requestAnimationFrame(() => {
      scrollToElementById(adminUserRowId(userId));
      setScrollToUserId(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollToUserId, users]);

  return (
    <SectionShell title={editingId ? "Edit user" : "Add user"}>
      <p className="text-sm text-stone-500">
        Create accounts, control category access, and choose whose itineraries
        each user can see.
      </p>

      <div ref={editSectionRef} className="scroll-mt-24">
      <form
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void saveUser();
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Username</span>
          <input
            value={form.username}
            onChange={(e) =>
              setForm((current) => ({
                ...current,
                username: e.target.value.toLowerCase(),
              }))
            }
            disabled={Boolean(editingId)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 disabled:bg-stone-100"
            required
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">
            Password {editingId ? "(leave blank to keep current)" : ""}
          </span>
          <PasswordInput
            value={form.password}
            onChange={(value) =>
              setForm((current) => ({ ...current, password: value }))
            }
            required={!editingId}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 pr-11"
          />
        </label>

        <div className="space-y-3 sm:col-span-2">
          {allowAdminPromotion && (
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={form.isAdmin}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    isAdmin: e.target.checked,
                    viewAllCategories: e.target.checked ? true : current.viewAllCategories,
                    viewAllTravellers: e.target.checked ? true : current.viewAllTravellers,
                    canEdit: e.target.checked ? true : current.canEdit,
                  }))
                }
              />
              Administrator (full access)
            </label>
          )}

          {!form.isAdmin && (
            <>
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={form.canEdit}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      canEdit: e.target.checked,
                    }))
                  }
                />
                Can edit itinerary
              </label>

              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={form.viewAllCategories}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      viewAllCategories: e.target.checked,
                    }))
                  }
                />
                Can view all categories
              </label>

              {!form.viewAllCategories && (
                <div className="space-y-2">
                  <p className="text-sm text-stone-500">Visible categories</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {CATEGORIES.map((category) => (
                      <label
                        key={category}
                        className="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={form.viewCategories.includes(category)}
                          onChange={() => toggleCategory(category)}
                        />
                        {CATEGORY_META[category].label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={form.viewAllTravellers}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      viewAllTravellers: e.target.checked,
                    }))
                  }
                />
                Can view all travellers&apos; itineraries
              </label>

              {!form.viewAllTravellers && (
                <div className="space-y-2">
                  <p className="text-sm text-stone-500">Visible travellers</p>
                  <p className="text-xs text-stone-400">
                    Users always see their own bookings. Select additional
                    travellers whose itineraries they may view.
                  </p>
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-stone-200 bg-white p-2">
                    {users.map((user) => {
                      const isSelf = user.username === lockedUsername;
                      const selected = isTravellerSelected(user.username);

                      return (
                        <label
                          key={user.id}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-stone-50"
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={isSelf}
                            onChange={() => toggleViewTraveller(user.username)}
                          />
                          <span className={isSelf ? "font-medium text-brand-deep" : ""}>
                            {user.username}
                            {isSelf ? " (always included)" : ""}
                          </span>
                        </label>
                      );
                    })}
                    {lockedUsername &&
                      !users.some((user) => user.username === lockedUsername) && (
                        <label className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                          <input type="checkbox" checked disabled readOnly />
                          <span className="font-medium text-brand-deep">
                            {lockedUsername} (always included)
                          </span>
                        </label>
                      )}
                  </div>
                </div>
              )}
            </>
          )}

          {editingId && !form.isAdmin && (
            <div className="space-y-2 sm:col-span-2">
              <p className="text-sm text-stone-500">Guardians</p>
              <p className="text-xs text-stone-400">
                Guardians can view all of {form.username}&apos;s itinerary entries
                automatically, without being added as extra viewers on each item.
              </p>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-stone-200 bg-white p-2">
                {users
                  .filter((user) => user.id !== editingId)
                  .map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-stone-50"
                    >
                      <input
                        type="checkbox"
                        checked={form.guardianUserIds.includes(user.id)}
                        onChange={() => toggleGuardian(user.id)}
                      />
                      <span>{user.username}</span>
                    </label>
                  ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-deep px-4 py-2 text-sm font-medium text-white"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : editingId ? "Update user" : "Create user"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm text-stone-600"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
      </div>

      <div className="mt-6 divide-y divide-stone-100">
        {users.map((user) => (
          <div
            key={user.id}
            id={adminUserRowId(user.id)}
            className="scroll-mt-24 flex items-start justify-between gap-4 py-3"
          >
            <div>
              <p className="font-medium text-stone-800">{user.username}</p>
              <p className="text-sm text-stone-500">
                {user.isAdmin
                  ? "Administrator"
                  : [
                      user.permissions.viewCategories === "all"
                        ? "All categories"
                        : `Categories: ${user.permissions.viewCategories
                            .map((c) => CATEGORY_META[c].label)
                            .join(", ")}`,
                      `Itineraries: ${formatTravellerAccess(user.permissions)}`,
                      user.permissions.canEdit ? "Can edit" : "Read only",
                      "Guest lists: per event",
                    ].join(" · ")}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => startEdit(user)}
                className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void deleteUser(user.id)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <h3 className="mt-6 text-sm font-semibold tracking-wide text-stone-600 uppercase">
        Force password reset
      </h3>
      <p className="mt-2 text-sm text-stone-500">
        Selected users will be logged out immediately and must sign in with the
        new password.
      </p>
      <div className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-stone-200 bg-surface-soft p-2">
        {users.map((user) => (
          <label
            key={user.id}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-stone-50"
          >
            <input
              type="checkbox"
              checked={forceUserIds.includes(user.id)}
              onChange={() => toggleForceUser(user.id)}
            />
            {user.username}
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <PasswordInput
          value={forcePassword}
          onChange={setForcePassword}
          placeholder="New password for selected users"
          className="flex-1 rounded-lg border border-stone-200 px-3 py-2 pr-11 text-sm"
        />
        <button
          type="button"
          disabled={saving || !forceUserIds.length || !forcePassword}
          onClick={() => void forcePasswordReset()}
          className="rounded-lg bg-brand-deep px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Force reset
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </SectionShell>
  );
}
