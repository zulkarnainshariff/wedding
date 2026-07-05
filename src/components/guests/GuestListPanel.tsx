"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus, Save, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { SectionShell } from "@/components/layout/PageShell";
import {
  RSVP_STATUSES,
  RSVP_STATUS_LABELS,
  RSVP_SUMMARY_STAT_LABELS,
  buildRsvpUrl,
  type GuestListAccess,
  type RsvpStatus,
} from "@/lib/guest-list-types";
import {
  applyGuestMemberDefaults,
  emptyGuestInviteForm,
  guestInviteFormFromGuest,
  guestMembersForSave,
  inviteLabelOptions,
  type GuestInviteForm,
} from "@/lib/guest-invite-form";
import type { Guest, GuestMember, WeddingEvent } from "@/lib/schema";

type GuestWithMembers = Guest & { members: GuestMember[] };

type PermissionRow = {
  userId: number;
  username: string;
  canView: boolean;
  canEdit: boolean;
  isWeddingCoordinator: boolean;
  canModerateGuestbook: boolean;
};

type PanelTab = "summary" | "invitations" | "settings";

const EMPTY_GUEST = emptyGuestInviteForm();

function formatMemberSummary(member: GuestMember) {
  const parts = [member.name];
  if (member.under13) parts.push("child");
  if (member.attending === false) parts.push("not attending");
  return parts.join(" · ");
}

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
  const toast = useToast();
  const accessibleEvents = useMemo(
    () =>
      events.filter((event) =>
        access.some(
          (entry) =>
            entry.eventId === event.id &&
            (entry.canView || entry.canEdit || entry.isWeddingCoordinator),
        ),
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
  const canViewGuests = Boolean(
    selectedAccess?.canView ||
      selectedAccess?.canEdit ||
      selectedAccess?.isWeddingCoordinator,
  );
  const canManageGuests = Boolean(
    selectedAccess?.canEdit || selectedAccess?.isWeddingCoordinator,
  );
  const canOpenSettings = canManageGuests || canManagePermissions;

  const tabs = useMemo(() => {
    const items: { id: PanelTab; label: string }[] = [
      { id: "summary", label: "Summary" },
    ];
    if (canViewGuests) items.push({ id: "invitations", label: "Invitations" });
    if (canOpenSettings) items.push({ id: "settings", label: "Settings" });
    return items;
  }, [canViewGuests, canOpenSettings]);

  const accessHint =
    !canManageGuests && canViewGuests
      ? "View-only access — you can see guest invites but cannot edit them or change RSVP settings."
      : !canViewGuests && !canOpenSettings && selectedAccess
        ? "Summary only — ask an admin to grant View, Edit, or Wedding coordinator access for this event."
        : null;

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
    setGuests([]);
    try {
      const [guestRes, settingsRes] = await Promise.all([
        fetch(`/api/guests/events/${eventId}/guests`),
        fetch(`/api/guests/events/${eventId}/rsvp-settings`),
      ]);
      if (guestRes.ok) {
        setGuests(await guestRes.json());
      } else if (guestRes.status === 403) {
        setError("You do not have permission to view invitations for this event.");
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
                isWeddingCoordinator: existing?.isWeddingCoordinator ?? false,
                canModerateGuestbook: existing?.canModerateGuestbook ?? false,
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
    setError(null);
    setActiveTab("summary");
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
          .filter(
            (row) =>
              row.canView ||
              row.canEdit ||
              row.isWeddingCoordinator ||
              row.canModerateGuestbook,
          )
          .map((row) => ({
            userId: row.userId,
            canView: row.canView,
            canEdit: row.canEdit,
            isWeddingCoordinator: row.isWeddingCoordinator,
            canModerateGuestbook: row.canModerateGuestbook,
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
    const members = guestMembersForSave(newGuest.members);
    if (!selectedId || members.length === 0 || !newGuest.label.trim()) {
      setError("Add at least one guest name and choose an invite label.");
      return;
    }
    setBusy(true);
    const response = await fetch(`/api/guests/events/${selectedId}/guests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newGuest,
        members,
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
    setEditForm(guestInviteFormFromGuest(guest));
  }

  async function persistGuest(
    guestId: number,
    form: GuestInviteForm,
    options?: { successMessage?: string },
  ) {
    const members = guestMembersForSave(form.members);
    if (members.length === 0 || !form.label.trim()) {
      setError("Add at least one guest name and choose an invite label.");
      return false;
    }
    setBusy(true);
    const payload = {
      ...form,
      members,
      ...(form.rsvpStatus === "attending"
        ? {
            rsvpAttendingCount:
              form.rsvpAttendingCount || form.expectedHeadcount,
          }
        : { rsvpAttendingCount: null }),
    };
    const response = await fetch(`/api/guests/${guestId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      const message = data.error ?? "Failed to save guest.";
      setError(message);
      toast.error(message);
      return false;
    }
    const updated = (await response.json()) as GuestWithMembers;
    setGuests((current) =>
      current.map((guest) => (guest.id === guestId ? updated : guest)),
    );
    const message = options?.successMessage ?? "Guest saved.";
    setStatus(message);
    toast.success(message);
    return true;
  }

  async function saveGuest() {
    if (!editingId) return;
    const ok = await persistGuest(editingId, editForm);
    if (ok) setEditingId(null);
  }

  async function updateGuestRsvp(guest: GuestWithMembers, rsvpStatus: RsvpStatus) {
    const form = applyGuestMemberDefaults({
      ...guestInviteFormFromGuest(guest),
      rsvpStatus,
      members:
        rsvpStatus === "attending"
          ? guestInviteFormFromGuest(guest).members.map((member) => ({
              ...member,
              attending: true,
            }))
          : guestInviteFormFromGuest(guest).members,
    });
    await persistGuest(guest.id, form, { successMessage: "RSVP status updated." });
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
    toast.success("RSVP link copied.");
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

      {accessHint ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {accessHint}
        </p>
      ) : null}
      {error ? (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {activeTab === "summary" && (
        <>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <StatCard
                label="Guests invited"
                value={summaryStats.totalExpected}
                hint="Sum of each invitation's expected headcount"
              />
              <StatCard
                label="Guests confirmed attending"
                value={summaryStats.attendingHeadcount}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {RSVP_STATUSES.map((rsvpStatus) => (
                <StatCard
                  key={rsvpStatus}
                  label={RSVP_SUMMARY_STAT_LABELS[rsvpStatus]}
                  value={summaryStats.statusCounts[rsvpStatus]}
                />
              ))}
            </div>
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
                      ? ` · ${guest.rsvpAttendingCount} guest${guest.rsvpAttendingCount === 1 ? "" : "s"}`
                      : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {activeTab === "invitations" && canViewGuests && (
        <>
          <div className="divide-y divide-stone-100">
            {guests.map((guest) => (
              <div key={guest.id} className="py-4">
                {canManageGuests && editingId === guest.id ? (
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
                          ? ` · ${guest.members.map((m) => formatMemberSummary(m)).join(", ")}`
                          : ""}
                      </p>
                      <p className="mt-1 text-sm">
                        RSVP:{" "}
                        {canManageGuests ? (
                          <select
                            value={guest.rsvpStatus}
                            disabled={busy || editingId === guest.id}
                            onChange={(e) =>
                              void updateGuestRsvp(
                                guest,
                                e.target.value as RsvpStatus,
                              )
                            }
                            className="ml-1 rounded border border-stone-200 px-2 py-0.5 text-sm"
                          >
                            {RSVP_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {RSVP_STATUS_LABELS[status]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          RSVP_STATUS_LABELS[guest.rsvpStatus as RsvpStatus]
                        )}
                        {guest.rsvpAttendingCount != null
                          ? ` · ${guest.rsvpAttendingCount} guest${guest.rsvpAttendingCount === 1 ? "" : "s"}`
                          : ""}
                      </p>
                      {guest.rsvpNotes && (
                        <p className="mt-1 text-sm text-stone-500">{guest.rsvpNotes}</p>
                      )}
                    </div>
                    {canManageGuests ? (
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
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>

          {canManageGuests ? (
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
          ) : null}
        </>
      )}

      {activeTab === "settings" && canOpenSettings && (
        <>
          {canManageGuests && (
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
            <div className={canManageGuests ? "mt-8" : ""}>
              <h3 className="text-sm font-semibold tracking-wide text-stone-600 uppercase">
                Guest list access
              </h3>
              <p className="mt-1 text-sm text-stone-500">
                Assign view, edit, coordinator, and guestbook moderator access for
                this event.
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
                                    canEdit: e.target.checked
                                      ? entry.canEdit
                                      : false,
                                    isWeddingCoordinator: e.target.checked
                                      ? entry.isWeddingCoordinator
                                      : false,
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
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={row.isWeddingCoordinator}
                        onChange={(e) =>
                          setPermissions((current) =>
                            current.map((entry) =>
                              entry.userId === row.userId
                                ? {
                                    ...entry,
                                    isWeddingCoordinator: e.target.checked,
                                    canView: e.target.checked ? true : entry.canView,
                                    canEdit: e.target.checked ? true : entry.canEdit,
                                    canModerateGuestbook: e.target.checked
                                      ? true
                                      : entry.canModerateGuestbook,
                                  }
                                : entry,
                            ),
                          )
                        }
                      />
                      Wedding coordinator (invite alerts)
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={row.canModerateGuestbook}
                        onChange={(e) =>
                          setPermissions((current) =>
                            current.map((entry) =>
                              entry.userId === row.userId
                                ? {
                                    ...entry,
                                    canModerateGuestbook: e.target.checked,
                                  }
                                : entry,
                            ),
                          )
                        }
                      />
                      Guestbook moderator
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

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-3">
      <p className="text-xs font-medium tracking-wide text-stone-500 uppercase">
        {label}
      </p>
      <p className="mt-1 font-serif text-2xl text-brand-deep">{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-stone-400">{hint}</p>
      ) : null}
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
  value: GuestInviteForm;
  onChange: (value: GuestInviteForm) => void;
  onSave: () => void;
  onCancel?: () => void;
  busy: boolean;
  submitLabel?: string;
}) {
  const nameInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const labelOptions = inviteLabelOptions(value.members, value.label);

  function updateForm(next: GuestInviteForm, syncMembers = false) {
    onChange(syncMembers ? applyGuestMemberDefaults(next) : next);
  }

  function updateMember(
    index: number,
    patch: Partial<GuestInviteForm["members"][number]>,
  ) {
    const members = value.members.map((member, memberIndex) =>
      memberIndex === index ? { ...member, ...patch } : member,
    );
    updateForm({ ...value, members }, true);
  }

  function addMemberRow(focusIndex?: number) {
    const members = [...value.members, { name: "", under13: false, attending: true }];
    updateForm({ ...value, members });
    const nextIndex = focusIndex ?? members.length - 1;
    requestAnimationFrame(() => {
      nameInputRefs.current[nextIndex]?.focus();
    });
  }

  function removeMemberRow(index: number) {
    if (value.members.length <= 1) return;
    const members = value.members.filter((_, memberIndex) => memberIndex !== index);
    updateForm({ ...value, members }, true);
  }

  function handleNameKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    index: number,
  ) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (index === value.members.length - 1) {
      addMemberRow(index + 1);
      return;
    }
    nameInputRefs.current[index + 1]?.focus();
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-3 sm:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-stone-700">
            Named guests <span className="text-red-600">*</span>
          </span>
          <button
            type="button"
            onClick={() => addMemberRow()}
            className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
          >
            Add row
          </button>
        </div>
        {value.members.map((member, index) => (
          <div
            key={index}
            className="grid gap-3 rounded-lg border border-stone-200 bg-stone-50/70 p-3 sm:grid-cols-[1fr_auto_auto_auto]"
          >
            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">Name</span>
              <input
                ref={(element) => {
                  nameInputRefs.current[index] = element;
                }}
                value={member.name}
                onChange={(e) => updateMember(index, { name: e.target.value })}
                onKeyDown={(e) => handleNameKeyDown(e, index)}
                placeholder="Bob Smith"
                className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
              />
            </label>
            <label className="flex items-end gap-2 pb-2 text-sm text-stone-600">
              <input
                type="checkbox"
                checked={member.under13}
                onChange={(e) => updateMember(index, { under13: e.target.checked })}
              />
              Child
            </label>
            {value.rsvpStatus === "attending" && member.name.trim() ? (
              <label className="flex items-end gap-2 pb-2 text-sm text-stone-600">
                <input
                  type="checkbox"
                  checked={member.attending}
                  onChange={(e) =>
                    updateMember(index, { attending: e.target.checked })
                  }
                />
                Attending
              </label>
            ) : (
              <div className="hidden sm:block" />
            )}
            <div className="flex items-end pb-1">
              <button
                type="button"
                onClick={() => removeMemberRow(index)}
                disabled={value.members.length <= 1}
                className="rounded-lg border border-stone-200 px-3 py-2 text-sm text-stone-600 disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-stone-500">Invite label</span>
        <select
          value={value.label}
          onChange={(e) => onChange({ ...value, label: e.target.value })}
          disabled={labelOptions.length === 0}
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        >
          {labelOptions.length === 0 ? (
            <option value="">Add guest names first</option>
          ) : (
            labelOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))
          )}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Expected headcount</span>
        <input
          type="number"
          min={1}
          value={value.expectedHeadcount}
          readOnly
          className="w-full rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-stone-600"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">RSVP status</span>
        <select
          value={value.rsvpStatus}
          onChange={(e) => {
            const rsvpStatus = e.target.value as RsvpStatus;
            const members =
              rsvpStatus === "attending"
                ? value.members.map((member) => ({
                    ...member,
                    attending: member.name.trim() ? true : member.attending,
                  }))
                : value.members;
            updateForm(
              {
                ...value,
                rsvpStatus,
                members,
                rsvpAttendingCount: value.expectedHeadcount,
              },
              true,
            );
          }}
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        >
          {RSVP_STATUSES.map((status) => (
            <option key={status} value={status}>
              {RSVP_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>

      {value.rsvpStatus === "attending" && (
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Attending count</span>
          <input
            type="number"
            min={1}
            value={value.rsvpAttendingCount}
            readOnly
            className="w-full rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-stone-600"
          />
        </label>
      )}

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
