"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus, Save, Trash2 } from "lucide-react";
import { SectionShell } from "@/components/layout/PageShell";
import {
  RSVP_STATUSES,
  RSVP_STATUS_LABELS,
  buildRsvpUrl,
  type GuestListAccess,
  type RsvpStatus,
} from "@/lib/guest-list-types";
import type { Guest, GuestMember, WeddingEvent } from "@/lib/schema";

type GuestWithMembers = Guest & { members: GuestMember[] };

type PermissionRow = {
  userId: number;
  username: string;
  canView: boolean;
  canEdit: boolean;
};

type PanelTab = "summary" | "invitations" | "settings";

const EMPTY_GUEST = {
  label: "",
  allowIncludeFamily: false,
  expectedHeadcount: 1,
  rsvpStatus: "not_responded" as RsvpStatus,
  adminNotes: "",
  contactEmail: "",
  memberNames: [] as string[],
};

export function GuestListPanel({
  events,
  access,
  canManagePermissions = false,
}: {
  events: WeddingEvent[];
  access: GuestListAccess[];
  canManagePermissions?: boolean;
}) {
  const router = useRouter();
  const accessibleEvents = useMemo(
    () =>
      events.filter((event) =>
        access.some((entry) => entry.eventId === event.id && entry.canView),
      ),
    [events, access],
  );

  const [selectedId, setSelectedId] = useState(accessibleEvents[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<PanelTab>("summary");
  const [guests, setGuests] = useState<GuestWithMembers[]>([]);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [rsvpSettings, setRsvpSettings] = useState({
    rsvpEnabled: true,
    rsvpDeadline: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
  });
  const [newGuest, setNewGuest] = useState(EMPTY_GUEST);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_GUEST);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedAccess = access.find((entry) => entry.eventId === selectedId);
  const canEdit = selectedAccess?.canEdit ?? false;
  const canOpenSettings = canEdit || canManagePermissions;

  const tabs = useMemo(() => {
    const items: { id: PanelTab; label: string }[] = [
      { id: "summary", label: "Summary" },
    ];
    if (canEdit) items.push({ id: "invitations", label: "Invitations" });
    if (canOpenSettings) items.push({ id: "settings", label: "Settings" });
    return items;
  }, [canEdit, canOpenSettings]);

  const summaryStats = useMemo(() => {
    const statusCounts = Object.fromEntries(
      RSVP_STATUSES.map((s) => [s, 0]),
    ) as Record<RsvpStatus, number>;

    let totalExpected = 0;
    let attendingHeadcount = 0;

    for (const guest of guests) {
      totalExpected += guest.expectedHeadcount;
      const rsvpStatus = guest.rsvpStatus as RsvpStatus;
      if (RSVP_STATUSES.includes(rsvpStatus)) {
        statusCounts[rsvpStatus] += 1;
      }
      if (rsvpStatus === "attending") {
        attendingHeadcount += guest.rsvpAttendingCount ?? guest.expectedHeadcount;
      }
    }

    return { totalExpected, attendingHeadcount, statusCounts };
  }, [guests]);

  async function loadEventData(eventId: number) {
    setBusy(true);
    setError(null);
    try {
      const [guestRes, settingsRes] = await Promise.all([
        fetch(`/api/guests/events/${eventId}/guests`),
        fetch(`/api/guests/events/${eventId}/rsvp-settings`),
      ]);
      if (guestRes.ok) {
        setGuests(await guestRes.json());
      }
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        if (settings) {
          setRsvpSettings({
            rsvpEnabled: settings.rsvpEnabled,
            rsvpDeadline: settings.rsvpDeadline
              ? new Date(settings.rsvpDeadline).toISOString().slice(0, 16)
              : "",
            contactName: settings.contactName ?? "",
            contactPhone: settings.contactPhone ?? "",
            contactEmail: settings.contactEmail ?? "",
          });
        }
      }
      if (canManagePermissions) {
        const permRes = await fetch(`/api/guests/events/${eventId}/permissions`);
        if (permRes.ok) {
          const data = await permRes.json();
          const rows: PermissionRow[] = data.users.map(
            (user: { id: number; username: string }) => {
              const existing = data.permissions.find(
                (perm: { userId: number }) => perm.userId === user.id,
              );
              return {
                userId: user.id,
                username: user.username,
                canView: existing?.canView ?? false,
                canEdit: existing?.canEdit ?? false,
              };
            },
          );
          setPermissions(rows);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  function selectEvent(eventId: number) {
    setSelectedId(eventId);
    setEditingId(null);
  }

  useEffect(() => {
    if (!selectedId) return;
    void loadEventData(selectedId);
  }, [selectedId, canManagePermissions]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab("summary");
    }
  }, [tabs, activeTab]);

  async function saveRsvpSettings() {
    if (!selectedId) return;
    setBusy(true);
    const response = await fetch(`/api/guests/events/${selectedId}/rsvp-settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...rsvpSettings,
        rsvpDeadline: rsvpSettings.rsvpDeadline || null,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("Failed to save RSVP settings.");
      return;
    }
    setStatus("RSVP settings saved.");
    router.refresh();
  }

  async function savePermissions() {
    if (!selectedId) return;
    setBusy(true);
    const response = await fetch(`/api/guests/events/${selectedId}/permissions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        permissions: permissions
          .filter((row) => row.canView || row.canEdit)
          .map((row) => ({
            userId: row.userId,
            canView: row.canView,
            canEdit: row.canEdit,
          })),
      }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("Failed to save permissions.");
      return;
    }
    setStatus("Guest list permissions saved.");
    router.refresh();
  }

  async function addGuest() {
    if (!selectedId || !newGuest.label.trim()) return;
    setBusy(true);
    const response = await fetch(`/api/guests/events/${selectedId}/guests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newGuest,
        members: newGuest.memberNames
          .filter(Boolean)
          .map((name) => ({ name })),
      }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("Failed to add guest.");
      return;
    }
    const created = await response.json();
    setGuests((current) => [...current, created]);
    setNewGuest(EMPTY_GUEST);
    setStatus("Guest added.");
  }

  function startEdit(guest: GuestWithMembers) {
    setEditingId(guest.id);
    setEditForm({
      label: guest.label,
      allowIncludeFamily: guest.allowIncludeFamily,
      expectedHeadcount: guest.expectedHeadcount,
      rsvpStatus: guest.rsvpStatus as RsvpStatus,
      adminNotes: guest.adminNotes ?? "",
      contactEmail: guest.contactEmail ?? "",
      memberNames: guest.members.map((member) => member.name),
    });
  }

  async function saveGuest() {
    if (!editingId) return;
    setBusy(true);
    const response = await fetch(`/api/guests/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...editForm,
        members: editForm.memberNames.filter(Boolean).map((name) => ({ name })),
      }),
    });
    setBusy(false);
    if (!response.ok) {
      setError("Failed to save guest.");
      return;
    }
    const updated = await response.json();
    setGuests((current) =>
      current.map((guest) => (guest.id === editingId ? updated : guest)),
    );
    setEditingId(null);
    setStatus("Guest saved.");
  }

  async function deleteGuest(id: number) {
    if (!confirm("Delete this guest invite?")) return;
    setBusy(true);
    await fetch(`/api/guests/${id}`, { method: "DELETE" });
    setBusy(false);
    setGuests((current) => current.filter((guest) => guest.id !== id));
  }

  async function copyRsvpLink(token: string) {
    await navigator.clipboard.writeText(buildRsvpUrl(token));
    setStatus("RSVP link copied.");
  }

  if (!accessibleEvents.length) {
    return (
      <p className="text-sm text-stone-500">
        You do not have access to any guest lists yet.
      </p>
    );
  }

  return (
    <SectionShell
      title="Guest lists"
      toolbar={
        <>
          <div className="flex flex-wrap gap-2">
            {accessibleEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                onClick={() => selectEvent(event.id)}
                className={[
                  "rounded-full px-4 py-1.5 text-sm font-medium",
                  event.id === selectedId
                    ? "bg-brand-deep text-white"
                    : "border border-stone-200 text-stone-600",
                ].join(" ")}
              >
                {event.name}
              </button>
            ))}
          </div>

          <div className="mt-4 flex gap-2 border-b border-stone-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "border-b-2 px-4 py-2 text-sm font-medium",
                  activeTab === tab.id
                    ? "border-brand-deep text-brand-deep"
                    : "border-transparent text-stone-500 hover:text-stone-700",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </>
      }
    >

      {activeTab === "summary" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Expected headcount" value={summaryStats.totalExpected} />
            <StatCard label="Attending headcount" value={summaryStats.attendingHeadcount} />
            {RSVP_STATUSES.map((rsvpStatus) => (
              <StatCard
                key={rsvpStatus}
                label={RSVP_STATUS_LABELS[rsvpStatus]}
                value={summaryStats.statusCounts[rsvpStatus]}
              />
            ))}
          </div>

          <div className="mt-8 divide-y divide-stone-100">
            {guests.length === 0 ? (
              <p className="py-4 text-sm text-stone-500">No invitations yet.</p>
            ) : (
              guests.map((guest) => (
                <div
                  key={guest.id}
                  className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <p className="font-medium text-stone-800">{guest.label}</p>
                  <p className="text-sm text-stone-500">
                    {RSVP_STATUS_LABELS[guest.rsvpStatus as RsvpStatus]}
                    {guest.rsvpStatus === "attending" && guest.rsvpAttendingCount != null
                      ? ` · ${guest.rsvpAttendingCount} attending`
                      : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {activeTab === "invitations" && canEdit && (
        <>
          <div className="divide-y divide-stone-100">
            {guests.map((guest) => (
              <div key={guest.id} className="py-4">
                {editingId === guest.id ? (
                  <GuestForm
                    value={editForm}
                    onChange={setEditForm}
                    onSave={() => void saveGuest()}
                    onCancel={() => setEditingId(null)}
                    busy={busy}
                  />
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-stone-800">{guest.label}</p>
                      <p className="mt-1 text-sm text-stone-500">
                        Expected {guest.expectedHeadcount}
                        {guest.allowIncludeFamily ? " · family allowed" : ""}
                        {guest.members.length > 0
                          ? ` · ${guest.members.map((m) => m.name).join(", ")}`
                          : ""}
                      </p>
                      <p className="mt-1 text-sm">
                        RSVP: {RSVP_STATUS_LABELS[guest.rsvpStatus as RsvpStatus]}
                        {guest.rsvpAttendingCount != null
                          ? ` · ${guest.rsvpAttendingCount} attending`
                          : ""}
                      </p>
                      {guest.rsvpNotes && (
                        <p className="mt-1 text-sm text-stone-500">{guest.rsvpNotes}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void copyRsvpLink(guest.inviteToken)}
                        className="inline-flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-1.5 text-sm"
                      >
                        <Copy className="h-4 w-4" />
                        Copy RSVP link
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(guest)}
                        className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteGuest(guest.id)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-dashed border-stone-300 p-4">
            <p className="text-sm font-medium text-stone-600">Add guest invite</p>
            <GuestForm
              value={newGuest}
              onChange={setNewGuest}
              onSave={() => void addGuest()}
              busy={busy}
              submitLabel="Add guest"
            />
          </div>
        </>
      )}

      {activeTab === "settings" && canOpenSettings && (
        <>
          {canEdit && (
            <>
              <h3 className="text-sm font-semibold tracking-wide text-stone-600 uppercase">
                RSVP settings
              </h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={rsvpSettings.rsvpEnabled}
                    onChange={(e) =>
                      setRsvpSettings((current) => ({
                        ...current,
                        rsvpEnabled: e.target.checked,
                      }))
                    }
                  />
                  Accept public RSVP responses
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-stone-500">RSVP deadline</span>
                  <input
                    type="datetime-local"
                    value={rsvpSettings.rsvpDeadline}
                    onChange={(e) =>
                      setRsvpSettings((current) => ({
                        ...current,
                        rsvpDeadline: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-stone-200 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-stone-500">Contact name</span>
                  <input
                    value={rsvpSettings.contactName}
                    onChange={(e) =>
                      setRsvpSettings((current) => ({
                        ...current,
                        contactName: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-stone-200 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-stone-500">Contact phone</span>
                  <input
                    value={rsvpSettings.contactPhone}
                    onChange={(e) =>
                      setRsvpSettings((current) => ({
                        ...current,
                        contactPhone: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-stone-200 px-3 py-2"
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block text-stone-500">Contact email</span>
                  <input
                    type="email"
                    value={rsvpSettings.contactEmail}
                    onChange={(e) =>
                      setRsvpSettings((current) => ({
                        ...current,
                        contactEmail: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-stone-200 px-3 py-2"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveRsvpSettings()}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-deep px-4 py-2 text-sm font-medium text-white"
              >
                <Save className="h-4 w-4" />
                Save RSVP settings
              </button>
            </>
          )}

          {canManagePermissions && (
            <div className={canEdit ? "mt-8" : ""}>
              <h3 className="text-sm font-semibold tracking-wide text-stone-600 uppercase">
                Guest list access
              </h3>
              <p className="mt-1 text-sm text-stone-500">
                Choose which users can view or edit this event&apos;s guest list.
              </p>
              <div className="mt-3 space-y-2">
                {permissions.map((row) => (
                  <div
                    key={row.userId}
                    className="flex flex-wrap items-center gap-4 rounded-lg border border-stone-200 px-3 py-2 text-sm"
                  >
                    <span className="min-w-24 font-medium text-stone-700">
                      {row.username}
                    </span>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={row.canView}
                        onChange={(e) =>
                          setPermissions((current) =>
                            current.map((entry) =>
                              entry.userId === row.userId
                                ? {
                                    ...entry,
                                    canView: e.target.checked,
                                    canEdit: e.target.checked ? entry.canEdit : false,
                                  }
                                : entry,
                            ),
                          )
                        }
                      />
                      View
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={row.canEdit}
                        onChange={(e) =>
                          setPermissions((current) =>
                            current.map((entry) =>
                              entry.userId === row.userId
                                ? {
                                    ...entry,
                                    canEdit: e.target.checked,
                                    canView: e.target.checked ? true : entry.canView,
                                  }
                                : entry,
                            ),
                          )
                        }
                      />
                      Edit
                    </label>
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void savePermissions()}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-brand-deep px-4 py-2 text-sm font-medium text-white"
              >
                <Save className="h-4 w-4" />
                Save permissions
              </button>
            </div>
          )}
        </>
      )}

      {status && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {status}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </SectionShell>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">
        {label}
      </p>
      <p className="mt-1 font-serif text-2xl text-brand-deep">{value}</p>
    </div>
  );
}

function GuestForm({
  value,
  onChange,
  onSave,
  onCancel,
  busy,
  submitLabel = "Save guest",
}: {
  value: typeof EMPTY_GUEST;
  onChange: (value: typeof EMPTY_GUEST) => void;
  onSave: () => void;
  onCancel?: () => void;
  busy: boolean;
  submitLabel?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-stone-500">Invite label</span>
        <input
          value={value.label}
          onChange={(e) => onChange({ ...value, label: e.target.value })}
          placeholder='e.g. "Bob and family" or "Jack, Jill & Rob"'
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Expected headcount</span>
        <input
          type="number"
          min={1}
          value={value.expectedHeadcount}
          onChange={(e) =>
            onChange({ ...value, expectedHeadcount: Number(e.target.value) || 1 })
          }
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">RSVP status</span>
        <select
          value={value.rsvpStatus}
          onChange={(e) =>
            onChange({ ...value, rsvpStatus: e.target.value as RsvpStatus })
          }
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        >
          {RSVP_STATUSES.map((status) => (
            <option key={status} value={status}>
              {RSVP_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={value.allowIncludeFamily}
          onChange={(e) =>
            onChange({ ...value, allowIncludeFamily: e.target.checked })
          }
        />
        Allow family members on RSVP (guest can enter headcount and names)
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-stone-500">
          Named members (one per line, optional)
        </span>
        <textarea
          value={value.memberNames.join("\n")}
          onChange={(e) =>
            onChange({
              ...value,
              memberNames: e.target.value.split("\n"),
            })
          }
          rows={3}
          placeholder={"Jack\nJill\nRob"}
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-stone-500">Admin notes</span>
        <input
          value={value.adminNotes}
          onChange={(e) => onChange({ ...value, adminNotes: e.target.value })}
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button
          type="button"
          disabled={busy}
          onClick={onSave}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-deep px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" />
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-stone-200 px-4 py-2 text-sm"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
